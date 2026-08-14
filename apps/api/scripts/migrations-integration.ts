import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { parseMicroUnits } from "../src/ledger/micro-units";
import { applyMigrations, rollbackLatestMigration } from "../src/migrations/runner";

const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = "nexus_migration_test";
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);
const admin = new Client({ connectionString: adminUrl });
admin.on("error", () => undefined);
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${testDb}`);
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();

try {
  await applyMigrations(testUrl);
  await rollbackLatestMigration(testUrl);
  await rollbackLatestMigration(testUrl);
  await rollbackLatestMigration(testUrl);
  await applyMigrations(testUrl);
  await applyMigrations(testUrl);

  const client = new Client({ connectionString: testUrl });
  client.on("error", () => undefined);
  await client.connect();
  const profileId = randomUUID();
  await client.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [profileId]);
  const facilityId = randomUUID();
  await client.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level) VALUES($1,$2,'microgrid',1)", [facilityId, profileId]);
  let duplicateFacilityRejected = false;
  try { await client.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level) VALUES($1,$2,'microgrid',1)", [randomUUID(), profileId]); } catch { duplicateFacilityRejected = true; }
  if (!duplicateFacilityRejected) throw new Error("Duplicate profile facility was accepted.");
  let invalidFacilityLevelRejected = false;
  try { await client.query("INSERT INTO profile_facilities(id, profile_id, facility_kind, level) VALUES($1,$2,'data_center',13)", [randomUUID(), profileId]); } catch { invalidFacilityLevelRejected = true; }
  if (!invalidFacilityLevelRejected) throw new Error("Invalid facility level was accepted.");
  await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'operation','same-key',$3,'pending')", [randomUUID(), profileId, "a".repeat(64)]);
  let duplicateRejected = false;
  try { await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'operation','same-key',$3,'completed')", [randomUUID(), profileId, "b".repeat(64)]); } catch { duplicateRejected = true; }
  if (!duplicateRejected) throw new Error("Duplicate idempotency key was accepted.");
  const concurrentClients = [new Client({ connectionString: testUrl }), new Client({ connectionString: testUrl })];
  concurrentClients.forEach((concurrentClient) => concurrentClient.on("error", () => undefined));
  await Promise.all(concurrentClients.map((concurrentClient) => concurrentClient.connect()));
  try {
    const concurrentResults = await Promise.allSettled(concurrentClients.map((concurrentClient, index) => concurrentClient.query(
      "INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'operation','concurrent-key',$3,'pending')",
      [randomUUID(), profileId, index === 0 ? "c".repeat(64) : "d".repeat(64)],
    )));
    if (concurrentResults.filter((result) => result.status === "fulfilled").length !== 1 || concurrentResults.filter((result) => result.status === "rejected").length !== 1) {
      throw new Error("Concurrent duplicate idempotency requests were not resolved to exactly one record.");
    }
  } finally {
    await Promise.all(concurrentClients.map((concurrentClient) => concurrentClient.end()));
  }
  const concurrentCount = await client.query<{ count: string }>("SELECT count(*) FROM idempotency_requests WHERE profile_id = $1 AND scope = 'operation' AND idempotency_key = 'concurrent-key'", [profileId]);
  if (concurrentCount.rows[0]?.count !== "1") throw new Error("Concurrent idempotency key created more than one record.");
  const request = await client.query<{ id: string }>("SELECT id FROM idempotency_requests WHERE profile_id = $1", [profileId]);
  const transactionId = randomUUID();
  await client.query("INSERT INTO ledger_transactions(id, profile_id, idempotency_request_id, reason_code) VALUES($1,$2,$3,'system_grant')", [transactionId, profileId, request.rows[0]?.id]);
  const entry = await client.query<{ id: string }>("INSERT INTO resource_ledger_entries(transaction_id, profile_id, resource, amount_micro, reason_code) VALUES($1,$2,'capital',$3,'system_grant') RETURNING id", [transactionId, profileId, parseMicroUnits("1500").toString()]);
  let immutableRejected = false;
  try { await client.query("DELETE FROM resource_ledger_entries WHERE id = $1", [entry.rows[0]?.id]); } catch { immutableRejected = true; }
  if (!immutableRejected) throw new Error("Mutable ledger entry was accepted.");
  let truncateRejected = false;
  try { await client.query("TRUNCATE resource_ledger_entries"); } catch { truncateRejected = true; }
  if (!truncateRejected) throw new Error("Ledger truncation was accepted.");
  const costRequest = randomUUID();
  const costTransaction = randomUUID();
  await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'facility:queue-test','cost',$3,'pending')", [costRequest, profileId, "e".repeat(64)]);
  await client.query("INSERT INTO ledger_transactions(id, profile_id, idempotency_request_id, reason_code) VALUES($1,$2,$3,'facility_cost')", [costTransaction, profileId, costRequest]);
  let reasonRejected = false;
  try { await client.query("INSERT INTO facility_queue_items(id, profile_id, facility_kind, target_level, status, enqueued_at, finish_at, capital_cost_micro, components_cost_micro, duration_ms, content_version, formula_version, cost_transaction_id) VALUES($1,$2,'microgrid',1,'active',now(),now() + interval '1 minute',1,1,60000,'asteria-baseline-0.2','balance-1.2',$3)", [randomUUID(), profileId, transactionId]); } catch { reasonRejected = true; }
  if (!reasonRejected) throw new Error("Facility queue accepted non-cost ledger transaction.");
  let facilityBindingRejected = false;
  try { await client.query("INSERT INTO facility_queue_items(id, profile_id, facility_id, facility_kind, target_level, status, enqueued_at, finish_at, capital_cost_micro, components_cost_micro, duration_ms, content_version, formula_version, cost_transaction_id) VALUES($1,$2,$3,'data_center',2,'active',now(),now() + interval '1 minute',1,1,60000,'asteria-baseline-0.2','balance-1.2',$4)", [randomUUID(), profileId, facilityId, costTransaction]); } catch { facilityBindingRejected = true; }
  if (!facilityBindingRejected) throw new Error("Facility queue accepted a mismatched facility kind.");
  const otherProfile = randomUUID();
  const otherRequest = randomUUID();
  const otherTransaction = randomUUID();
  await client.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [otherProfile]);
  await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'facility:queue-test','other-cost',$3,'pending')", [otherRequest, otherProfile, "f".repeat(64)]);
  await client.query("INSERT INTO ledger_transactions(id, profile_id, idempotency_request_id, reason_code) VALUES($1,$2,$3,'facility_cost')", [otherTransaction, otherProfile, otherRequest]);
  let transactionProfileRejected = false;
  try { await client.query("INSERT INTO facility_queue_items(id, profile_id, facility_kind, target_level, status, enqueued_at, finish_at, capital_cost_micro, components_cost_micro, duration_ms, content_version, formula_version, cost_transaction_id) VALUES($1,$2,'microgrid',1,'active',now(),now() + interval '1 minute',1,1,60000,'asteria-baseline-0.2','balance-1.2',$3)", [randomUUID(), profileId, otherTransaction]); } catch { transactionProfileRejected = true; }
  if (!transactionProfileRejected) throw new Error("Facility queue accepted a cross-profile cost transaction.");
  await client.query("INSERT INTO facility_queue_items(id, profile_id, facility_id, facility_kind, target_level, status, enqueued_at, finish_at, capital_cost_micro, components_cost_micro, duration_ms, content_version, formula_version, cost_transaction_id) VALUES($1,$2,$3,'microgrid',2,'active',now(),now() + interval '1 minute',1,1,60000,'asteria-baseline-0.2','balance-1.2',$4)", [randomUUID(), profileId, facilityId, costTransaction]);
  let queueRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { queueRollbackRejected = true; }
  if (!queueRollbackRejected) throw new Error("Facility queue migration rollback with persisted queue was accepted.");
  await client.query("DELETE FROM facility_queue_items WHERE profile_id = $1", [profileId]);
  const queueRollback = await rollbackLatestMigration(testUrl);
  if (queueRollback !== "008_facility_queue") throw new Error("Expected the empty facility queue migration to roll back first.");
  for (const invalid of ["0", "1.5"]) {
    let rejected = false;
    try { parseMicroUnits(invalid); } catch { rejected = true; }
    if (!rejected) throw new Error(`Invalid amount ${invalid} was accepted.`);
  }
  let downRejected = false;
  await client.query("INSERT INTO profile_facility_accrual_state(facility_id) SELECT id FROM profile_facilities WHERE profile_id = $1", [profileId]);
  let facilitiesRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { facilitiesRollbackRejected = true; }
  if (!facilitiesRollbackRejected) throw new Error("Lazy accrual migration rollback with persisted state was accepted.");
  await client.query("DELETE FROM profile_facility_accrual_state WHERE facility_id IN (SELECT id FROM profile_facilities WHERE profile_id = $1)", [profileId]);
  const accrualRollback = await rollbackLatestMigration(testUrl);
  if (accrualRollback !== "007_lazy_accrual") throw new Error("Expected the empty lazy accrual migration to roll back first.");
  let profileFacilitiesRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { profileFacilitiesRollbackRejected = true; }
  if (!profileFacilitiesRollbackRejected) throw new Error("Profile facilities migration rollback with persisted data was accepted.");
  await client.query("DELETE FROM profile_facilities WHERE profile_id = $1", [profileId]);
  const facilitiesRollback = await rollbackLatestMigration(testUrl);
  if (facilitiesRollback !== "006_profile_facilities") throw new Error("Expected the empty profile facilities migration to roll back first.");
  const completionRollback = await rollbackLatestMigration(testUrl);
  if (completionRollback !== "005_idempotency_completion_integrity") throw new Error("Expected the empty completion migration to roll back first.");
  const integrityRollback = await rollbackLatestMigration(testUrl);
  if (integrityRollback !== "004_ledger_integrity") throw new Error("Expected the empty integrity migration to roll back second.");
  const projectionRollback = await rollbackLatestMigration(testUrl);
  if (projectionRollback !== "003_resource_balances") throw new Error("Expected the empty balance projection migration to roll back second.");
  try { await rollbackLatestMigration(testUrl); } catch { downRejected = true; }
  if (!downRejected) throw new Error("Rollback with persisted ledger data was accepted.");
  await client.end();
  console.log("PASS: migrations, version pinning, sequential/concurrent idempotency, immutable ledger, and rollback guard verified.");
} finally {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const cleanup = new Client({ connectionString: adminUrl });
  cleanup.on("error", () => undefined);
  await cleanup.connect();
  await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [testDb]);
  await cleanup.query(`DROP DATABASE IF EXISTS ${testDb}`);
  await cleanup.end();
}
