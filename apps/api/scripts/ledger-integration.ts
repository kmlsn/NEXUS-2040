import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { IdempotencyKeyReusedError, InsufficientResourcesError, PostgresLedgerService } from "../src/ledger/ledger-service";
import { LazyAccrualService } from "../src/economy/accrual-service";
import { FacilityQueueService } from "../src/economy/facility-queue-service";
import { applyMigrations } from "../src/migrations/runner";

const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = "nexus_ledger_test";
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);

async function createProfile(pool: Pool): Promise<string> {
  const id = randomUUID();
  await pool.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [id]);
  return id;
}

const admin = new Client({ connectionString: adminUrl });
admin.on("error", () => undefined);
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${testDb}`);
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();

const pool = new Pool({ connectionString: testUrl });
try {
  await applyMigrations(testUrl, "002_resource_ledger_idempotency");
  const legacy = new Client({ connectionString: testUrl });
  await legacy.connect();
  const legacyProfile = randomUUID();
  const legacyRequest = randomUUID();
  const legacyTransaction = randomUUID();
  await legacy.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [legacyProfile]);
  await legacy.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'legacy','backfill',$3,'completed')", [legacyRequest, legacyProfile, "a".repeat(64)]);
  await legacy.query("INSERT INTO ledger_transactions(id, profile_id, idempotency_request_id, reason_code) VALUES($1,$2,$3,'system_grant')", [legacyTransaction, legacyProfile, legacyRequest]);
  await legacy.query("INSERT INTO resource_ledger_entries(transaction_id, profile_id, resource, amount_micro, reason_code) VALUES($1,$2,'capital','1500','system_grant')", [legacyTransaction, legacyProfile]);
  await legacy.end();
  await applyMigrations(testUrl);
  const backfill = await pool.query<{ resource: string; balance_micro: string }>("SELECT resource, balance_micro FROM resource_balances WHERE profile_id = $1 ORDER BY resource", [legacyProfile]);
  if (backfill.rowCount !== 5 || backfill.rows.find((row) => row.resource === "capital")?.balance_micro !== "1500" || backfill.rows.filter((row) => row.resource !== "capital").some((row) => row.balance_micro !== "0")) throw new Error("Legacy ledger balance backfill was incorrect.");
  const ledger = new PostgresLedgerService(pool);
  const profileId = await createProfile(pool);
  const grant = await ledger.apply({
    profileId, scope: "bootstrap", idempotencyKey: "grant-all-five", reason: "system_grant",
    deltas: { energy: "1000000", compute: "1000000", components: "1000000", capital: "1000000", expertise: "1000000" },
  });
  if (Object.values(grant.balances).some((amount) => amount !== "1000000")) throw new Error("Five-resource grant did not produce exact balances.");
  let invalidReasonRejected = false;
  try { await ledger.apply({ profileId, scope: "invalid", idempotencyKey: "invalid-reason", reason: "unknown" as never, deltas: { energy: "1" } }); } catch { invalidReasonRejected = true; }
  if (!invalidReasonRejected) throw new Error("Unknown ledger reason was accepted.");
  const replay = await ledger.apply({
    profileId, scope: "bootstrap", idempotencyKey: "grant-all-five", reason: "system_grant",
    deltas: { energy: "1000000", compute: "1000000", components: "1000000", capital: "1000000", expertise: "1000000" },
  });
  if (!replay.replayed || replay.transactionId !== grant.transactionId) throw new Error("Idempotent replay did not return the original transaction.");
  await ledger.apply({ profileId, scope: "facility", idempotencyKey: "facility-cost-1", reason: "facility_cost", deltas: { capital: "-400000", components: "-20000" } });
  let reusedRejected = false;
  try { await ledger.apply({ profileId, scope: "facility", idempotencyKey: "facility-cost-1", reason: "facility_cost", deltas: { capital: "-500000" } }); } catch (error) { reusedRejected = error instanceof IdempotencyKeyReusedError; }
  if (!reusedRejected) throw new Error("Idempotency key reuse with a different intent was accepted.");
  let insufficientRejected = false;
  try { await ledger.apply({ profileId, scope: "facility", idempotencyKey: "facility-cost-overdraw", reason: "facility_cost", deltas: { capital: "-1000000" } }); } catch (error) { insufficientRejected = error instanceof InsufficientResourcesError; }
  if (!insufficientRejected) throw new Error("Negative resource balance was accepted.");

  const accrualProfile = await createProfile(pool);
  const gridId = randomUUID();
  const dataId = randomUUID();
  const asOf = 1_800_000_000_000n;
  const start = asOf - 3_600_000n;
  await pool.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level, energy_priority) VALUES($1,$2,'microgrid',1,1),($3,$2,'data_center',1,1)", [gridId, accrualProfile, dataId]);
  await pool.query("INSERT INTO profile_facility_accrual_state(facility_id,last_accrued_at) VALUES($1,to_timestamp($3::double precision/1000)),($2,to_timestamp($3::double precision/1000))", [gridId, dataId, start.toString()]);
  const accrual = new LazyAccrualService(pool);
  const settled = await accrual.settle(accrualProfile, asOf);
  if (!settled.settled || settled.deltas.energy !== "20000000" || settled.deltas.compute !== "150000000") throw new Error("Atomic lazy accrual output was incorrect.");
  const replaySettlement = await accrual.settle(accrualProfile, asOf);
  if (replaySettlement.settled) throw new Error("Repeated lazy settlement produced another credit.");
  const storedEnergyProfile = await createProfile(pool);
  const storedDataId = randomUUID();
  await ledger.apply({ profileId: storedEnergyProfile, scope: "bootstrap", idempotencyKey: "accrual-energy", reason: "system_grant", deltas: { energy: "70000000" } });
  await pool.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level, energy_priority) VALUES($1,$2,'data_center',1,1)", [storedDataId, storedEnergyProfile]);
  await pool.query("INSERT INTO profile_facility_accrual_state(facility_id,last_accrued_at) VALUES($1,to_timestamp($2::double precision/1000))", [storedDataId, start.toString()]);
  const storedEnergySettlement = await accrual.settle(storedEnergyProfile, asOf);
  if (storedEnergySettlement.deltas.energy !== "-70000000" || storedEnergySettlement.deltas.compute !== "150000000") throw new Error("Stored energy was not available to an energy consumer.");
  const unequalWindowProfile = await createProfile(pool);
  const unequalGrid = randomUUID();
  const unequalData = randomUUID();
  const staleStart = asOf - 129_600_000n;
  await pool.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level, energy_priority) VALUES($1,$2,'microgrid',1,1),($3,$2,'data_center',9,1)", [unequalGrid, unequalWindowProfile, unequalData]);
  await pool.query("INSERT INTO profile_facility_accrual_state(facility_id,last_accrued_at) VALUES($1,to_timestamp($3::double precision/1000)),($2,to_timestamp($3::double precision/1000))", [unequalGrid, unequalData, staleStart.toString()]);
  const unequalSettlement = await accrual.settle(unequalWindowProfile, asOf);
  if (!unequalSettlement.settled || !unequalSettlement.deltas.compute || unequalSettlement.deltas.energy !== undefined) throw new Error("Unequal storage windows did not settle chronologically and conservatively.");

  const queueProfile = await createProfile(pool);
  await ledger.apply({ profileId: queueProfile, scope: "bootstrap", idempotencyKey: "queue-grant", reason: "system_grant", deltas: { capital: "10000000000", components: "1000000000" } });
  let queueNow = Number(asOf);
  const queueService = new FacilityQueueService(pool, { nowMs: () => queueNow });
  const cancelledBuild = await queueService.enqueue(queueProfile, "microgrid", "queue-cancel-build");
  const enqueueReplay = await queueService.enqueue(queueProfile, "microgrid", "queue-cancel-build");
  if (enqueueReplay.id !== cancelledBuild.id || cancelledBuild.targetLevel !== 1) throw new Error("Facility queue enqueue replay was not idempotent.");
  const initialSnapshot = await pool.query<{ capital_cost_micro: string; components_cost_micro: string; duration_ms: string; content_version: string; formula_version: string }>("SELECT capital_cost_micro::text, components_cost_micro::text, duration_ms::text, content_version, formula_version FROM facility_queue_items WHERE id = $1", [cancelledBuild.id]);
  const initial = initialSnapshot.rows[0];
  if (!initial || initial.capital_cost_micro !== "220000000" || initial.components_cost_micro !== "12000000" || initial.duration_ms !== "90000" || initial.content_version !== "asteria-baseline-0.2" || initial.formula_version !== "balance-1.2") throw new Error("Level one queue did not snapshot canonical cost, duration, and versions.");
  queueNow = Number(cancelledBuild.finishAtMs - 1n);
  const cancelled = await queueService.cancel(queueProfile, cancelledBuild.id, "queue-cancel");
  if (cancelled.status !== "cancelled" || !cancelled.refundTransactionId) throw new Error("Pre-finish construction cancellation did not refund.");
  const cancelReplay = await queueService.cancel(queueProfile, cancelledBuild.id, "queue-cancel-another-key");
  if (cancelReplay.refundTransactionId !== cancelled.refundTransactionId) throw new Error("Cancelled construction created a second refund.");
  const refundConservation = await pool.query<{ resource: string; total: string; count: string }>("SELECT resource, SUM(amount_micro)::text AS total, count(*)::text AS count FROM resource_ledger_entries WHERE transaction_id = ANY($1::uuid[]) GROUP BY resource ORDER BY resource", [[cancelledBuild.costTransactionId, cancelled.refundTransactionId]]);
  if (refundConservation.rows.length !== 2 || refundConservation.rows.some((row) => row.total !== "0" || row.count !== "2")) throw new Error("Queue debit and refund did not conserve each resource exactly once.");
  const refunded = await pool.query<{ resource: string; balance_micro: string }>("SELECT resource, balance_micro FROM resource_balances WHERE profile_id = $1 AND resource IN ('capital','components') ORDER BY resource", [queueProfile]);
  if (refunded.rows.find((row) => row.resource === "capital")?.balance_micro !== "10000000000" || refunded.rows.find((row) => row.resource === "components")?.balance_micro !== "1000000000") throw new Error("Facility cancellation was not a full one-time refund.");
  queueNow += 1;
  const firstBuild = await queueService.enqueue(queueProfile, "microgrid", "queue-complete-build");
  queueNow = Number(firstBuild.finishAtMs);
  const historicalCancel = await queueService.cancel(queueProfile, cancelledBuild.id, "queue-historical-id");
  if (historicalCancel.status !== "cancelled") throw new Error("Historical cancellation did not return its own terminal item.");
  const stillActiveAtBoundary = await pool.query<{ status: string }>("SELECT status FROM facility_queue_items WHERE id = $1", [firstBuild.id]);
  if (stillActiveAtBoundary.rows[0]?.status !== "active") throw new Error("Historical cancellation completed a different due queue item.");
  const completedAtBoundary = await queueService.cancel(queueProfile, firstBuild.id, "queue-too-late");
  if (completedAtBoundary.status !== "completed") throw new Error("Completion did not win at the finish boundary.");
  const firstFacility = await pool.query<{ level: number }>("SELECT level FROM profile_facilities WHERE profile_id = $1 AND facility_kind = 'microgrid'", [queueProfile]);
  if (firstFacility.rows[0]?.level !== 1) throw new Error("Finished construction did not create level one facility.");
  queueNow += 1;
  const upgrade = await queueService.enqueue(queueProfile, "microgrid", "queue-upgrade-build");
  if (upgrade.targetLevel !== 2) throw new Error("Existing facility queue did not target the next level.");
  const upgradeSnapshot = await pool.query<{ capital_cost_micro: string; components_cost_micro: string; duration_ms: string }>("SELECT capital_cost_micro::text, components_cost_micro::text, duration_ms::text FROM facility_queue_items WHERE id = $1", [upgrade.id]);
  const upgraded = upgradeSnapshot.rows[0];
  if (!upgraded || upgraded.capital_cost_micro !== "341000000" || upgraded.components_cost_micro !== "18000000" || upgraded.duration_ms !== "138000") throw new Error("Upgrade queue did not snapshot target-level cost and duration.");
  queueNow = Number(upgrade.finishAtMs + 3_600_000n);
  const completedUpgrade = await queueService.reconcile(queueProfile);
  if (completedUpgrade?.status !== "completed") throw new Error("Late construction reconciliation did not complete.");
  const upgradedFacility = await pool.query<{ level: number }>("SELECT level FROM profile_facilities WHERE profile_id = $1 AND facility_kind = 'microgrid'", [queueProfile]);
  if (upgradedFacility.rows[0]?.level !== 2) throw new Error("Completed upgrade did not apply its target level.");
  const queuedEnergy = await pool.query<{ balance_micro: string }>("SELECT balance_micro FROM resource_balances WHERE profile_id = $1 AND resource = 'energy'", [queueProfile]);
  if (queuedEnergy.rows[0]?.balance_micro !== "115050025") throw new Error("Queue boundary did not preserve old then new facility output.");

  const queueRaceProfile = await createProfile(pool);
  await ledger.apply({ profileId: queueRaceProfile, scope: "bootstrap", idempotencyKey: "queue-race-grant", reason: "system_grant", deltas: { capital: "10000000000", components: "1000000000" } });
  const queueFirstPool = new Pool({ connectionString: testUrl });
  const queueSecondPool = new Pool({ connectionString: testUrl });
  try {
    const queueResults = await Promise.allSettled([
      new FacilityQueueService(queueFirstPool, { nowMs: () => Number(asOf) }).enqueue(queueRaceProfile, "microgrid", "queue-race-a"),
      new FacilityQueueService(queueSecondPool, { nowMs: () => Number(asOf) }).enqueue(queueRaceProfile, "data_center", "queue-race-b"),
    ]);
    if (queueResults.filter((result) => result.status === "fulfilled").length !== 1 || queueResults.filter((result) => result.status === "rejected").length !== 1) throw new Error("Concurrent queue starts did not resolve to exactly one active item.");
  } finally { await Promise.all([queueFirstPool.end(), queueSecondPool.end()]); }
  const activeQueues = await pool.query<{ count: string }>("SELECT count(*) FROM facility_queue_items WHERE profile_id = $1 AND status = 'active'", [queueRaceProfile]);
  if (activeQueues.rows[0]?.count !== "1") throw new Error("Concurrent queue starts created multiple active items.");

  const raceProfile = await createProfile(pool);
  const raceGrant = await ledger.apply({ profileId: raceProfile, scope: "bootstrap", idempotencyKey: "race-grant", reason: "system_grant", deltas: { energy: "100" } });
  const grantRequest = await pool.query<{ id: string }>("SELECT id FROM idempotency_requests WHERE completed_transaction_id = $1", [grant.transactionId]);
  let orphanCompletedRejected = false;
  try { await pool.query("UPDATE idempotency_requests SET status = 'completed', completed_transaction_id = NULL WHERE id = $1", [grantRequest.rows[0]?.id]); } catch { orphanCompletedRejected = true; }
  if (!orphanCompletedRejected) throw new Error("Completed idempotency request without a transaction was accepted.");
  let crossProfileRejected = false;
  try { await pool.query("UPDATE idempotency_requests SET completed_transaction_id = $1 WHERE id = $2", [raceGrant.transactionId, grantRequest.rows[0]?.id]); } catch { crossProfileRejected = true; }
  if (!crossProfileRejected) throw new Error("Cross-profile idempotency transaction reference was accepted.");
  const firstPool = new Pool({ connectionString: testUrl });
  const secondPool = new Pool({ connectionString: testUrl });
  try {
    const results = await Promise.allSettled([
      new PostgresLedgerService(firstPool).apply({ profileId: raceProfile, scope: "facility", idempotencyKey: "race-cost-a", reason: "facility_cost", deltas: { energy: "-80" } }),
      new PostgresLedgerService(secondPool).apply({ profileId: raceProfile, scope: "facility", idempotencyKey: "race-cost-b", reason: "facility_cost", deltas: { energy: "-80" } }),
    ]);
    if (results.filter((result) => result.status === "fulfilled").length !== 1 || results.filter((result) => result.status === "rejected").length !== 1) throw new Error("Concurrent debits did not resolve to one success and one rejection.");
  } finally {
    await Promise.all([firstPool.end(), secondPool.end()]);
  }
  const raceBalance = await pool.query<{ balance_micro: string }>("SELECT balance_micro FROM resource_balances WHERE profile_id = $1 AND resource = 'energy'", [raceProfile]);
  if (raceBalance.rows[0]?.balance_micro !== "20") throw new Error("Concurrent debit left an incorrect balance.");
  const raceEntries = await pool.query<{ count: string }>("SELECT count(*) FROM resource_ledger_entries WHERE profile_id = $1 AND resource = 'energy'", [raceProfile]);
  if (raceEntries.rows[0]?.count !== "2") throw new Error("Concurrent debit created more than one committed debit entry.");
  console.log("PASS: five-resource atomic ledger, idempotency replay/conflict, and concurrent spending guards verified.");
} finally {
  await pool.end();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const cleanup = new Client({ connectionString: adminUrl });
  cleanup.on("error", () => undefined);
  await cleanup.connect();
  await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [testDb]);
  await cleanup.query(`DROP DATABASE IF EXISTS ${testDb}`);
  await cleanup.end();
}
