import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { IdempotencyKeyReusedError, InsufficientResourcesError, PostgresLedgerService } from "../src/ledger/ledger-service";
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
