import { Client, Pool } from "pg";
import { LazyAccrualService } from "../src/economy/accrual-service";
import { InsufficientResourcesError, PostgresLedgerService } from "../src/ledger/ledger-service";
import { POSTGRES_BIGINT_MAX } from "../src/ledger/micro-units";
import { applyMigrations } from "../src/migrations/runner";

const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = "nexus_p28_property_test";
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);
const SEED = 0x20400008;
let state = SEED;
function next(): number { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state; }
function id(index: number): string { return `00000000-0000-5000-8000-${String(index).padStart(12, "0")}`; }

async function dropDatabase(client: Client): Promise<void> {
  await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()", [testDb]);
  await client.query(`DROP DATABASE IF EXISTS ${testDb}`);
}
async function profile(pool: Pool, index: number): Promise<string> {
  const profileId = id(index);
  await pool.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1,'asteria-baseline-0.2','balance-1.2')", [profileId]);
  return profileId;
}
async function assertProjection(pool: Pool, profileId: string): Promise<void> {
  const result = await pool.query<{ resource: string; balance: string; total: string }>(
    "SELECT b.resource, b.balance_micro::text AS balance, COALESCE(SUM(e.amount_micro),0)::text AS total FROM resource_balances b LEFT JOIN resource_ledger_entries e ON e.profile_id=b.profile_id AND e.resource=b.resource WHERE b.profile_id=$1 GROUP BY b.resource,b.balance_micro",
    [profileId],
  );
  if (result.rowCount !== 5 || result.rows.some((row) => BigInt(row.balance) < 0n || BigInt(row.balance) > POSTGRES_BIGINT_MAX || row.balance !== row.total)) throw new Error("Ledger projection property failed.");
}

const admin = new Client({ connectionString: adminUrl });
admin.on("error", () => undefined);
await admin.connect();
await dropDatabase(admin);
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();
const pool = new Pool({ connectionString: testUrl });
try {
  await applyMigrations(testUrl);
  const ledger = new PostgresLedgerService(pool);

  const atomicProfile = await profile(pool, 1);
  await ledger.apply({ profileId: atomicProfile, scope: "p2.8", idempotencyKey: "grant", reason: "system_grant", deltas: { energy: "100", capital: "100" } });
  const beforeAtomic = await pool.query<{ count: string }>("SELECT count(*)::text FROM ledger_transactions WHERE profile_id=$1", [atomicProfile]);
  await Promise.all([
    ledger.apply({ profileId: atomicProfile, scope: "p2.8", idempotencyKey: "underflow", reason: "system_reversal", deltas: { energy: "-101", capital: "1" } }).then(() => { throw new Error("Atomic underflow was accepted."); }, (error) => { if (!(error instanceof InsufficientResourcesError)) throw error; }),
    ledger.apply({ profileId: atomicProfile, scope: "p2.8", idempotencyKey: "overflow", reason: "system_grant", deltas: { compute: (POSTGRES_BIGINT_MAX + 1n).toString() } }).then(() => { throw new Error("Overflow was accepted."); }, () => undefined),
  ]);
  const afterAtomic = await pool.query<{ count: string }>("SELECT count(*)::text FROM ledger_transactions WHERE profile_id=$1", [atomicProfile]);
  if (beforeAtomic.rows[0]?.count !== afterAtomic.rows[0]?.count) throw new Error("Rejected mutation was not atomic.");
  await assertProjection(pool, atomicProfile);

  for (let index = 0; index < 16; index += 1) {
    const balance = BigInt(100 + next() % 10_000);
    const first = balance / 2n + 1n;
    const second = balance - first + 1n;
    const profileId = await profile(pool, 100 + index);
    await ledger.apply({ profileId, scope: "p2.8", idempotencyKey: "grant", reason: "system_grant", deltas: { energy: balance.toString() } });
    const left = new Pool({ connectionString: testUrl }); const right = new Pool({ connectionString: testUrl });
    try {
      const results = await Promise.allSettled([
        new PostgresLedgerService(left).apply({ profileId, scope: "p2.8.race", idempotencyKey: "left", reason: "facility_cost", deltas: { energy: `-${first}` } }),
        new PostgresLedgerService(right).apply({ profileId, scope: "p2.8.race", idempotencyKey: "right", reason: "facility_cost", deltas: { energy: `-${second}` } }),
      ]);
      if (results.filter((result) => result.status === "fulfilled").length !== 1 || results.filter((result) => result.status === "rejected").length !== 1) throw new Error("Generated concurrent underflow did not resolve once.");
      const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (!(rejected?.reason instanceof InsufficientResourcesError)) throw new Error("Generated concurrent underflow rejected for the wrong reason.");
    } finally { await Promise.all([left.end(), right.end()]); }
    await assertProjection(pool, profileId);
  }

  for (let index = 0; index < 8; index += 1) {
    const balance = BigInt(100 + next() % 10_000);
    const first = balance / 2n;
    const second = balance - first;
    const profileId = await profile(pool, 200 + index);
    await ledger.apply({ profileId, scope: "p2.8", idempotencyKey: "grant", reason: "system_grant", deltas: { energy: balance.toString() } });
    const left = new Pool({ connectionString: testUrl }); const right = new Pool({ connectionString: testUrl });
    try {
      const results = await Promise.all([
        new PostgresLedgerService(left).apply({ profileId, scope: "p2.8.exact", idempotencyKey: "left", reason: "facility_cost", deltas: { energy: `-${first}` } }),
        new PostgresLedgerService(right).apply({ profileId, scope: "p2.8.exact", idempotencyKey: "right", reason: "facility_cost", deltas: { energy: `-${second}` } }),
      ]);
      if (results.some((result) => result.replayed)) throw new Error("Distinct exact-balance debits unexpectedly replayed.");
    } finally { await Promise.all([left.end(), right.end()]); }
    const balanceRow = await pool.query<{ balance: string }>("SELECT balance_micro::text AS balance FROM resource_balances WHERE profile_id=$1 AND resource='energy'", [profileId]);
    if (balanceRow.rows[0]?.balance !== "0") throw new Error("Exact concurrent debits did not reach zero.");
    await assertProjection(pool, profileId);
  }

  const replayProfile = await profile(pool, 300);
  await ledger.apply({ profileId: replayProfile, scope: "p2.8", idempotencyKey: "grant", reason: "system_grant", deltas: { energy: "100" } });
  const replayPools = [new Pool({ connectionString: testUrl }), new Pool({ connectionString: testUrl })];
  try {
    const results = await Promise.all(replayPools.map((candidate) => new PostgresLedgerService(candidate).apply({ profileId: replayProfile, scope: "p2.8.replay", idempotencyKey: "same", reason: "facility_cost", deltas: { energy: "-40" } })));
    if (results[0].transactionId !== results[1].transactionId || results.filter((result) => result.replayed).length !== 1) throw new Error("Concurrent identical intent was not exactly-once.");
  } finally { await Promise.all(replayPools.map((candidate) => candidate.end())); }
  await assertProjection(pool, replayProfile);

  const timeProfile = await profile(pool, 400);
  const grid = id(401); const data = id(402);
  await pool.query("INSERT INTO profile_facilities(id,profile_id,facility_kind,level,energy_priority) VALUES($1,$3,'microgrid',1,1),($2,$3,'data_center',1,1)", [grid, data, timeProfile]);
  await pool.query("INSERT INTO profile_facility_accrual_state(facility_id,last_accrued_at) VALUES($1,to_timestamp(1800000000100::double precision/1000)),($2,to_timestamp(1800000000200::double precision/1000))", [grid, data]);
  const accrual = new LazyAccrualService(pool);
  await accrual.settle(timeProfile, 1_800_000_000_150n);
  const middle = await pool.query<{ id: string; last: string }>("SELECT facility_id::text AS id,(extract(epoch FROM last_accrued_at)*1000)::bigint::text AS last FROM profile_facility_accrual_state WHERE facility_id IN ($1,$2) ORDER BY facility_id", [grid, data]);
  if (middle.rows.find((row) => row.id === data)?.last !== "1800000000200") throw new Error("Settlement moved a newer facility cursor backward.");
  await accrual.settle(timeProfile, 1_800_000_000_300n);
  const snapshot = await pool.query("SELECT facility_id,last_accrued_at,output_carry_numerator,output_carry_denominator,energy_carry_numerator,energy_carry_denominator FROM profile_facility_accrual_state WHERE facility_id IN ($1,$2) ORDER BY facility_id", [grid, data]);
  const transactions = await pool.query<{ count: string }>("SELECT count(*)::text FROM ledger_transactions WHERE profile_id=$1", [timeProfile]);
  for (const past of [1_800_000_000_300n, 1_800_000_000_299n, 0n]) {
    const outcome = await accrual.settle(timeProfile, past);
    if (outcome.settled) throw new Error("Equal or backward settlement produced output.");
  }
  const afterClock = await pool.query("SELECT facility_id,last_accrued_at,output_carry_numerator,output_carry_denominator,energy_carry_numerator,energy_carry_denominator FROM profile_facility_accrual_state WHERE facility_id IN ($1,$2) ORDER BY facility_id", [grid, data]);
  const afterTransactions = await pool.query<{ count: string }>("SELECT count(*)::text FROM ledger_transactions WHERE profile_id=$1", [timeProfile]);
  if (JSON.stringify(snapshot.rows) !== JSON.stringify(afterClock.rows) || transactions.rows[0]?.count !== afterTransactions.rows[0]?.count) throw new Error("Clock rollback mutated persistent accrual state.");
  await assertProjection(pool, timeProfile);

  const overflowAccrualProfile = await profile(pool, 500);
  const overflowGrid = id(501);
  await ledger.apply({ profileId: overflowAccrualProfile, scope: "p2.8", idempotencyKey: "grant-max", reason: "system_grant", deltas: { energy: POSTGRES_BIGINT_MAX.toString() } });
  await pool.query("INSERT INTO profile_facilities(id,profile_id,facility_kind,level,energy_priority) VALUES($1,$2,'microgrid',1,1)", [overflowGrid, overflowAccrualProfile]);
  await pool.query("INSERT INTO profile_facility_accrual_state(facility_id,last_accrued_at) VALUES($1,to_timestamp(1800000000000::double precision/1000))", [overflowGrid]);
  await accrual.settle(overflowAccrualProfile, 1_800_000_003_600n).then(() => { throw new Error("Overflowing accrual was accepted."); }, () => undefined);
  const overflowState = await pool.query<{ last: string; output: string; outputDenominator: string; energy: string; energyDenominator: string }>("SELECT (extract(epoch FROM last_accrued_at)*1000)::bigint::text AS last, output_carry_numerator::text AS output, output_carry_denominator::text AS \"outputDenominator\", energy_carry_numerator::text AS energy, energy_carry_denominator::text AS \"energyDenominator\" FROM profile_facility_accrual_state WHERE facility_id=$1", [overflowGrid]);
  const stateRow = overflowState.rows[0];
  if (!stateRow || stateRow.last !== "1800000000000" || stateRow.output !== "0" || stateRow.outputDenominator !== "1" || stateRow.energy !== "0" || stateRow.energyDenominator !== "1") throw new Error("Overflowing accrual mutated persistent state.");
  await assertProjection(pool, overflowAccrualProfile);
  console.log(`PASS: P2.8 property integration seed=${SEED} cases=16.`);
} finally {
  await pool.end();
  const cleanup = new Client({ connectionString: adminUrl }); cleanup.on("error", () => undefined); await cleanup.connect(); await dropDatabase(cleanup); await cleanup.end();
}
