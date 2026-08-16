import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { parseMicroUnits } from "../src/ledger/micro-units";
import { applyMigrations, rollbackLatestMigration } from "../src/migrations/runner";
import { ensureProfileNpcRelationships } from "../src/npc/organization-service";

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
  const worldClient = new Client({ connectionString: testUrl });
  worldClient.on("error", () => undefined);
  await worldClient.connect();
  const singleton = await worldClient.query<{ count: string }>("SELECT count(*) FROM world_state");
  if (singleton.rows[0]?.count !== "1") throw new Error("World state singleton was not initialized.");
  const npcCount = await worldClient.query<{ count: string }>("SELECT count(*) FROM npc_organization_state");
  if (npcCount.rows[0]?.count !== "3") throw new Error("NPC organization state was not deterministically initialized.");
  const npcStates = await worldClient.query<{
    organization_id: string;
    world_state_id: number;
    content_version: string;
    formula_version: string;
    doctrine_id: string;
    capacity_readiness: number;
    state_revision: string;
  }>("SELECT organization_id, world_state_id, content_version, formula_version, doctrine_id, capacity_readiness, state_revision FROM npc_organization_state ORDER BY organization_id");
  const expectedNpcStates = [
    ["asteria_civic_grid", 1, "asteria-baseline-0.2", "balance-1.2", "continuity", 60, "1"],
    ["free_mesh", 1, "asteria-baseline-0.2", "balance-1.2", "distribute", 55, "1"],
    ["nexilune_industrial", 1, "asteria-baseline-0.2", "balance-1.2", "centralize", 65, "1"],
  ];
  const actualNpcStates = npcStates.rows.map((row) => [row.organization_id, row.world_state_id, row.content_version, row.formula_version, row.doctrine_id, row.capacity_readiness, row.state_revision]);
  if (JSON.stringify(actualNpcStates) !== JSON.stringify(expectedNpcStates)) throw new Error("NPC organization baseline state did not match D-028.");
  const marketState = await worldClient.query<{ world_state_id: number; content_version: string; formula_version: string; market_index_basis_points: number; applied_cycles: string; state_revision: string }>("SELECT world_state_id, content_version, formula_version, market_index_basis_points, applied_cycles, state_revision FROM npc_market_state");
  if (JSON.stringify(marketState.rows) !== JSON.stringify([{ world_state_id: 1, content_version: "asteria-baseline-0.2", formula_version: "balance-1.2", market_index_basis_points: 10000, applied_cycles: "0", state_revision: "1" }])) throw new Error("NPC market state was not deterministically initialized.");
  for (const sql of [
    "UPDATE npc_organization_state SET capacity_readiness = 101 WHERE organization_id = 'free_mesh'",
    "UPDATE npc_organization_state SET doctrine_id = 'player_doctrine' WHERE organization_id = 'free_mesh'",
    "UPDATE npc_organization_state SET formula_version = 'balance-1.3' WHERE organization_id = 'free_mesh'",
    "UPDATE npc_organization_state SET capacity_readiness = 56 WHERE organization_id = 'free_mesh'",
  ]) {
    let rejected = false;
    try { await worldClient.query(sql); } catch { rejected = true; }
    if (!rejected) throw new Error(`NPC organization constraint accepted: ${sql}`);
  }
  for (const sql of [
    "UPDATE npc_market_state SET market_index_basis_points = 8499",
    "UPDATE npc_market_state SET formula_version = 'balance-1.3'",
    "UPDATE npc_market_state SET applied_cycles = 1, state_revision = 2",
  ]) {
    let rejected = false;
    try { await worldClient.query(sql); } catch { rejected = true; }
    if (!rejected) throw new Error(`NPC market constraint accepted: ${sql}`);
  }
  const relationshipProfile = randomUUID();
  await worldClient.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [relationshipProfile]);
  const bootstrapRelationshipCount = await worldClient.query<{ count: string }>("SELECT count(*) FROM profile_npc_relationships WHERE profile_id = $1 AND relationship_tenths = 0", [relationshipProfile]);
  if (bootstrapRelationshipCount.rows[0]?.count !== "3") throw new Error("Direct profile insertion did not bootstrap neutral NPC relationships.");
  const relationshipPools = [new Pool({ connectionString: testUrl }), new Pool({ connectionString: testUrl })];
  try { await Promise.all(relationshipPools.map((pool) => ensureProfileNpcRelationships(pool, relationshipProfile))); } finally { await Promise.all(relationshipPools.map((pool) => pool.end())); }
  const relationshipCount = await worldClient.query<{ count: string }>("SELECT count(*) FROM profile_npc_relationships WHERE profile_id = $1 AND relationship_tenths = 0", [relationshipProfile]);
  if (relationshipCount.rows[0]?.count !== "3") throw new Error("Concurrent NPC relationship initialization was not idempotent.");
  let duplicateRelationshipRejected = false;
  try { await worldClient.query("INSERT INTO profile_npc_relationships(profile_id, organization_id, relationship_tenths) VALUES($1, 'free_mesh', 0)", [relationshipProfile]); } catch { duplicateRelationshipRejected = true; }
  if (!duplicateRelationshipRejected) throw new Error("Duplicate NPC relationship was accepted.");
  const marketRollback = await rollbackLatestMigration(testUrl);
  if (marketRollback !== "014_npc_market_state") throw new Error("Expected pristine NPC market migration rollback.");
  let npcRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { npcRollbackRejected = true; }
  if (!npcRollbackRejected) throw new Error("NPC organization rollback with persisted relationship was accepted.");
  await worldClient.query("DELETE FROM profile_npc_relationships WHERE profile_id = $1", [relationshipProfile]);
  await worldClient.query("DELETE FROM profiles WHERE id = $1", [relationshipProfile]);
  const npcRollback = await rollbackLatestMigration(testUrl);
  if (npcRollback !== "013_npc_organization_state") throw new Error("Expected pristine NPC organization migration rollback.");
  await applyMigrations(testUrl);
  const marketRollbackBeforeNpcStateChange = await rollbackLatestMigration(testUrl);
  if (marketRollbackBeforeNpcStateChange !== "014_npc_market_state") throw new Error("Expected NPC market migration to be removed before NPC state rollback coverage.");
  await worldClient.query("UPDATE npc_organization_state SET capacity_readiness = 56, state_revision = 2 WHERE organization_id = 'free_mesh'");
  let changedNpcRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { changedNpcRollbackRejected = true; }
  if (!changedNpcRollbackRejected) throw new Error("NPC organization rollback with changed canonical state was accepted.");
  await worldClient.query("DELETE FROM npc_organization_state WHERE organization_id = 'free_mesh'");
  await worldClient.query("INSERT INTO npc_organization_state(organization_id, world_state_id, content_version, formula_version, doctrine_id, capacity_readiness, state_revision) VALUES('free_mesh', 1, 'asteria-baseline-0.2', 'balance-1.2', 'distribute', 55, 1)");
  const finalNpcRollback = await rollbackLatestMigration(testUrl);
  if (finalNpcRollback !== "013_npc_organization_state") throw new Error("Expected NPC organization migration to be removed before world rollback coverage.");
  await applyMigrations(testUrl);
  for (const sql of [
    "INSERT INTO world_state(id, content_version, formula_version, master_seed, epoch_ms) VALUES(2, 'asteria-baseline-0.2', 'balance-1.2', 1, 0)",
    "UPDATE world_state SET master_seed = 20260810 WHERE id = 1",
    "UPDATE world_state SET master_seed = 18446744073709551616 WHERE id = 1",
    "UPDATE world_state SET content_version = 'unknown' WHERE id = 1",
    "UPDATE world_state SET epoch_ms = 1767225600001 WHERE id = 1",
    "UPDATE world_state SET completed_cycles = 1, state_revision = 1 WHERE id = 1",
  ]) {
    let rejected = false;
    try { await worldClient.query(sql); } catch { rejected = true; }
    if (!rejected) throw new Error(`World state constraint accepted: ${sql}`);
  }
  await worldClient.end();
  for (let index = 0; index < 3; index += 1) {
    const marketRollback = await rollbackLatestMigration(testUrl);
    if (marketRollback !== "014_npc_market_state") throw new Error("Expected NPC market migration rollback before world configuration coverage.");
    const npcRollback = await rollbackLatestMigration(testUrl);
    if (npcRollback !== "013_npc_organization_state") throw new Error("Expected NPC organization migration rollback before world configuration coverage.");
    const rollback = await rollbackLatestMigration(testUrl);
    if (rollback !== "012_world_state_immutability") throw new Error("Expected pristine world-state configuration migration rollback.");
    await applyMigrations(testUrl);
  }
  const finalMarketConfigurationRollback = await rollbackLatestMigration(testUrl);
  if (finalMarketConfigurationRollback !== "014_npc_market_state") throw new Error("Expected NPC market migration to be removed before final configuration rollback.");
  const finalNpcConfigurationRollback = await rollbackLatestMigration(testUrl);
  if (finalNpcConfigurationRollback !== "013_npc_organization_state") throw new Error("Expected NPC organization migration to be removed before final configuration rollback.");
  const finalConfigurationRollback = await rollbackLatestMigration(testUrl);
  if (finalConfigurationRollback !== "012_world_state_immutability") throw new Error("Expected world-state configuration migration to be removed before state rollback coverage.");
  const finalWorldRollback = await rollbackLatestMigration(testUrl);
  if (finalWorldRollback !== "011_world_state") throw new Error("Expected world-state migration to be removed before legacy rollback coverage.");

  const client = new Client({ connectionString: testUrl });
  client.on("error", () => undefined);
  await client.connect();
  const balance13Profile = randomUUID();
  await client.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.3')", [balance13Profile]);
  let balance13RollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { balance13RollbackRejected = true; }
  if (!balance13RollbackRejected) throw new Error("balance-1.3 migration rollback with persisted profile was accepted.");
  await client.query("DELETE FROM profiles WHERE id=$1", [balance13Profile]);
  const balance13Rollback = await rollbackLatestMigration(testUrl);
  if (balance13Rollback !== "010_balance_1_3") throw new Error("Expected the empty balance-1.3 migration to roll back first.");
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
  await applyMigrations(testUrl);
  await client.query("UPDATE world_state SET completed_cycles = 1, state_revision = 2 WHERE id = 1");
  const marketRollbackBeforeWorld = await rollbackLatestMigration(testUrl);
  if (marketRollbackBeforeWorld !== "014_npc_market_state") throw new Error("Expected NPC market migration rollback before advanced world rollback coverage.");
  let persistedNpcStateRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { persistedNpcStateRollbackRejected = true; }
  if (!persistedNpcStateRollbackRejected) throw new Error("NPC organization rollback with backfilled profile state was accepted.");
  await client.query("DELETE FROM profile_npc_relationships");
  const npcRollbackBeforeWorld = await rollbackLatestMigration(testUrl);
  if (npcRollbackBeforeWorld !== "013_npc_organization_state") throw new Error("Expected NPC organization migration rollback before advanced world rollback coverage.");
  let advancedWorldRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { advancedWorldRollbackRejected = true; }
  if (!advancedWorldRollbackRejected) throw new Error("Advanced world-state configuration rollback was accepted.");
  let backwardWorldStateRejected = false;
  try { await client.query("UPDATE world_state SET completed_cycles = 0, state_revision = 1 WHERE id = 1"); } catch { backwardWorldStateRejected = true; }
  if (!backwardWorldStateRejected) throw new Error("World state was allowed to move backwards.");
  await applyMigrations(testUrl);
  let marketDeleteRejected = false;
  try { await client.query("DELETE FROM npc_market_state WHERE world_state_id = 1"); } catch { marketDeleteRejected = true; }
  if (!marketDeleteRejected) throw new Error("NPC market singleton deletion was accepted.");
  await client.query("UPDATE npc_market_state SET applied_cycles = 1, state_revision = 2 WHERE world_state_id = 1");
  let advancedMarketRollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { advancedMarketRollbackRejected = true; }
  if (!advancedMarketRollbackRejected) throw new Error("NPC market rollback with advanced state was accepted.");
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
