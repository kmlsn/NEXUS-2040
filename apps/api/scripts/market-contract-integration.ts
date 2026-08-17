import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { ContractUnavailableError, MarketContractService, OfferBidMismatchError } from "../src/contracts/market-contract-service";
import { PostgresLedgerService } from "../src/ledger/ledger-service";
import { applyMigrations, rollbackLatestMigration } from "../src/migrations/runner";

const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = "nexus_contract_offer_test";
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);
const admin = new Client({ connectionString: adminUrl });
admin.on("error", () => undefined);
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${testDb}`);
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();

const pool = new Pool({ connectionString: testUrl });
try {
  await applyMigrations(testUrl);
  const pristineRollback = await rollbackLatestMigration(testUrl);
  if (pristineRollback !== "015_market_contract_offers") throw new Error("Pristine contract offer migration did not roll back.");
  await applyMigrations(testUrl);
  const profileId = randomUUID();
  let invalidFairValueRejected = false;
  try {
    await pool.query("INSERT INTO market_contract_snapshots(id, world_state_id, counterparty_organization_id, content_version, formula_version, world_revision, market_index_basis_points, master_seed, tier, base_reward_micro, fair_value_micro) SELECT $1,1,'nexilune_industrial',world.content_version,world.formula_version,world.state_revision,market.market_index_basis_points,world.master_seed,1,1000000000,1 FROM world_state world JOIN npc_market_state market ON market.world_state_id = world.id WHERE world.id = 1", [randomUUID()]);
  } catch { invalidFairValueRejected = true; }
  if (!invalidFairValueRejected) throw new Error("Market snapshot accepted a fair value that does not match the basis-point formula.");
  await pool.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [profileId]);
  const ledger = new PostgresLedgerService(pool);
  await ledger.apply({ profileId, scope: "contract-bootstrap", idempotencyKey: "capital", reason: "system_grant", deltas: { capital: "10000000000" } });
  const service = new MarketContractService(pool);
  const snapshot = await service.createSnapshot();
  const initial = await service.submitOffer(profileId, snapshot.id, snapshot.fairValueMicro, "offer-a");
  const replay = await service.submitOffer(profileId, snapshot.id, snapshot.fairValueMicro, "offer-b");
  if (!replay.replayed || replay.id !== initial.id || replay.refundTransactionId !== initial.refundTransactionId) throw new Error("Market offer replay did not return the single terminal settlement.");
  let bidMismatchRejected = false;
  try { await service.submitOffer(profileId, snapshot.id, (BigInt(snapshot.fairValueMicro) - 1n).toString(), "offer-c"); } catch (error) { bidMismatchRejected = error instanceof OfferBidMismatchError; }
  if (!bidMismatchRejected) throw new Error("A different bid was accepted for an existing profile contract offer.");
  for (const invalidBid of ["01", "+1", " 1", "1 "]) {
    let rejected = false;
    try { await service.submitOffer(profileId, snapshot.id, invalidBid, `invalid-${invalidBid}`); } catch { rejected = true; }
    if (!rejected) throw new Error(`Non-canonical bid was accepted: ${invalidBid}`);
  }
  const offer = await pool.query<{ held_micro: string; status: string; hold_reason: string; refund_reason: string; net: string }>(
    "SELECT offers.held_micro::text, offers.status, holds.reason_code AS hold_reason, refunds.reason_code AS refund_reason, SUM(entries.amount_micro)::text AS net FROM market_contract_offers offers JOIN ledger_transactions holds ON holds.id = offers.hold_transaction_id JOIN ledger_transactions refunds ON refunds.id = offers.refund_transaction_id JOIN resource_ledger_entries entries ON entries.transaction_id IN (offers.hold_transaction_id, offers.refund_transaction_id) WHERE offers.id = $1 GROUP BY offers.held_micro, offers.status, holds.reason_code, refunds.reason_code",
    [initial.id],
  );
  const row = offer.rows[0];
  if (!row || BigInt(row.held_micro) < 4n || row.hold_reason !== "contract_collateral_hold" || row.refund_reason !== "contract_collateral_refund") throw new Error("Contract offer did not retain ledger-linked collateral snapshots.");
  const expectedNet = initial.awarded ? "0" : (-BigInt(initial.heldMicro) + BigInt(initial.refundMicro)).toString();
  if (row.net !== expectedNet) throw new Error("Contract collateral did not conserve its exact terminal refund.");
  const competitorId = randomUUID();
  await pool.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2')", [competitorId]);
  await ledger.apply({ profileId: competitorId, scope: "contract-bootstrap", idempotencyKey: "capital", reason: "system_grant", deltas: { capital: "10000000000" } });
  let unavailableRejected = false;
  try { await service.submitOffer(competitorId, snapshot.id, snapshot.fairValueMicro, "competitor") } catch (error) { unavailableRejected = error instanceof ContractUnavailableError; }
  if (!unavailableRejected) throw new Error("A second profile was accepted for the single-settlement market contract.");
  const racedSnapshot = await service.createSnapshot();
  const racedProfileA = randomUUID();
  const racedProfileB = randomUUID();
  await pool.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1, 'asteria-baseline-0.2', 'balance-1.2'),($2, 'asteria-baseline-0.2', 'balance-1.2')", [racedProfileA, racedProfileB]);
  await Promise.all([racedProfileA, racedProfileB].map((id, index) => ledger.apply({ profileId: id, scope: "contract-bootstrap", idempotencyKey: `race-${index}`, reason: "system_grant", deltas: { capital: "10000000000" } })));
  const racePoolA = new Pool({ connectionString: testUrl });
  const racePoolB = new Pool({ connectionString: testUrl });
  try {
    const raced = await Promise.allSettled([
      new MarketContractService(racePoolA).submitOffer(racedProfileA, racedSnapshot.id, racedSnapshot.fairValueMicro, "race-a"),
      new MarketContractService(racePoolB).submitOffer(racedProfileB, racedSnapshot.id, racedSnapshot.fairValueMicro, "race-b"),
    ]);
    if (raced.filter((result) => result.status === "fulfilled").length !== 1 || raced.filter((result) => result.status === "rejected").length !== 1) throw new Error("Concurrent market contract offers did not resolve to one terminal settlement.");
  } finally { await Promise.all([racePoolA.end(), racePoolB.end()]); }
  const racedOffers = await pool.query<{ count: string }>("SELECT count(*) FROM market_contract_offers WHERE contract_id = $1", [racedSnapshot.id]);
  if (racedOffers.rows[0]?.count !== "1") throw new Error("Concurrent offers created more than one terminal offer.");
  let rollbackRejected = false;
  try { await rollbackLatestMigration(testUrl); } catch { rollbackRejected = true; }
  if (!rollbackRejected) throw new Error("Contract offer rollback accepted persisted snapshot history.");
  console.log("PASS: atomic market contract offer snapshot, deterministic settlement, replay, and collateral ledger guards verified.");
} finally {
  await pool.end();
  const cleanup = new Client({ connectionString: adminUrl });
  cleanup.on("error", () => undefined);
  await cleanup.connect();
  await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [testDb]);
  await cleanup.query(`DROP DATABASE IF EXISTS ${testDb}`);
  await cleanup.end();
}
