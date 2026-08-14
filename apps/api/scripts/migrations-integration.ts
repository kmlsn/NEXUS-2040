import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { parseMicroUnits } from "../src/ledger/micro-units";
import { applyMigrations, rollbackLatestMigration } from "../src/migrations/runner";

const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = "nexus_migration_test";
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);
const admin = new Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${testDb}`);
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();

try {
  await applyMigrations(testUrl);
  await rollbackLatestMigration(testUrl);
  await rollbackLatestMigration(testUrl);
  await applyMigrations(testUrl);
  await applyMigrations(testUrl);

  const client = new Client({ connectionString: testUrl });
  await client.connect();
  const profileId = randomUUID();
  await client.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [profileId]);
  await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'operation','same-key',$3,'completed')", [randomUUID(), profileId, "a".repeat(64)]);
  let duplicateRejected = false;
  try { await client.query("INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'operation','same-key',$3,'completed')", [randomUUID(), profileId, "b".repeat(64)]); } catch { duplicateRejected = true; }
  if (!duplicateRejected) throw new Error("Duplicate idempotency key was accepted.");
  const concurrentClients = [new Client({ connectionString: testUrl }), new Client({ connectionString: testUrl })];
  await Promise.all(concurrentClients.map((concurrentClient) => concurrentClient.connect()));
  try {
    const concurrentResults = await Promise.allSettled(concurrentClients.map((concurrentClient, index) => concurrentClient.query(
      "INSERT INTO idempotency_requests(id, profile_id, scope, idempotency_key, request_fingerprint, status) VALUES($1,$2,'operation','concurrent-key',$3,'completed')",
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
  await client.query("INSERT INTO ledger_transactions(id, profile_id, idempotency_request_id, reason_code) VALUES($1,$2,$3,'test_credit')", [transactionId, profileId, request.rows[0]?.id]);
  const entry = await client.query<{ id: string }>("INSERT INTO resource_ledger_entries(transaction_id, profile_id, resource, amount_micro, reason_code) VALUES($1,$2,'capital',$3,'test_credit') RETURNING id", [transactionId, profileId, parseMicroUnits("1500").toString()]);
  let immutableRejected = false;
  try { await client.query("DELETE FROM resource_ledger_entries WHERE id = $1", [entry.rows[0]?.id]); } catch { immutableRejected = true; }
  if (!immutableRejected) throw new Error("Mutable ledger entry was accepted.");
  let truncateRejected = false;
  try { await client.query("TRUNCATE resource_ledger_entries"); } catch { truncateRejected = true; }
  if (!truncateRejected) throw new Error("Ledger truncation was accepted.");
  for (const invalid of ["0", "1.5"]) {
    let rejected = false;
    try { parseMicroUnits(invalid); } catch { rejected = true; }
    if (!rejected) throw new Error(`Invalid amount ${invalid} was accepted.`);
  }
  let downRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { downRejected = true; }
  if (!downRejected) throw new Error("Rollback with persisted ledger data was accepted.");
  await client.end();
  console.log("PASS: migrations, version pinning, sequential/concurrent idempotency, immutable ledger, and rollback guard verified.");
} finally {
  const cleanup = new Client({ connectionString: adminUrl });
  await cleanup.connect();
  await cleanup.query(`DROP DATABASE IF EXISTS ${testDb} WITH (FORCE)`);
  await cleanup.end();
}
