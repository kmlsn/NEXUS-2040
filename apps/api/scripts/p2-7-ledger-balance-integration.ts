import { Client, Pool } from "pg";
import { LazyAccrualService } from "../src/economy/accrual-service";
import { PostgresLedgerService, type ResourceKind } from "../src/ledger/ledger-service";
import { applyMigrations } from "../src/migrations/runner";

const DAY_MS = 86_400_000n;
const START_MS = 1_800_000_000_000n;
const FIXTURE_SEED = "20260809";
const VALUE_NUMERATOR = 7_000n;
/** Exact shadow price: the L1 24h grid/data/workshop fixture values to 1_000 capital units/day. */
const VALUE_DENOMINATOR = 26_928n;
const adminUrl = process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres";
const testDb = "nexus_p27_balance_test";
const testUrl = adminUrl.replace(/\/[^/]+(?:\?.*)?$/, `/${testDb}`);

/** `balance-1.3` P2 economy comparator; operation-resolution math remains `balance-1.2` until P4. */
function activity(operations: number): number { return Math.min(0.12, 0.035 * Math.log1p(operations)); }
function micro(units: number): string { return String(BigInt(Math.floor(units * 1_000_000 + 0.5))); }
function fixtureUuid(sequence: number): string { return `00000000-0000-5000-8000-${String(sequence).padStart(12, "0")}`; }
function valueMicro(resource: ResourceKind, delta: bigint): bigint {
  return resource === "capital" ? delta : delta * VALUE_NUMERATOR / VALUE_DENOMINATOR;
}

interface Result { days: number; operations: number; cadenceHours: number; facilityValueMicro: string; operationNetMicro: string; netValueMicro: string; }

async function runScenario(pool: Pool, days: number, operations: number, cadenceHours: number): Promise<Result> {
  const sequence = days * 1_000 + operations * 100 + cadenceHours;
  const profileId = fixtureUuid(sequence * 10 + 1);
  await pool.query("INSERT INTO profiles(id, content_version, formula_version) VALUES($1,'asteria-baseline-0.2','balance-1.3')", [profileId]);
  const ledger = new PostgresLedgerService(pool);
  await ledger.apply({ profileId, scope: "p2.7", idempotencyKey: "initial-capital", reason: "system_grant", deltas: { capital: "1000000000000000" } });
  const grid = fixtureUuid(sequence * 10 + 2); const data = fixtureUuid(sequence * 10 + 3); const workshop = fixtureUuid(sequence * 10 + 4);
  await pool.query("INSERT INTO profile_facilities(id,profile_id,facility_kind,level,energy_priority) VALUES($1,$4,'microgrid',1,1),($2,$4,'data_center',1,1),($3,$4,'robotics_workshop',1,2)", [grid, data, workshop, profileId]);
  await pool.query("INSERT INTO profile_facility_accrual_state(facility_id,last_accrued_at) VALUES($1,to_timestamp($4::double precision/1000)),($2,to_timestamp($4::double precision/1000)),($3,to_timestamp($4::double precision/1000))", [grid, data, workshop, START_MS.toString()]);
  const accrual = new LazyAccrualService(pool);
  const cadenceDays = cadenceHours / 24;
  for (let day = 1; day <= days; day += 1) {
    if (day % cadenceDays === 0 || day === days) await accrual.settle(profileId, START_MS + BigInt(day) * DAY_MS);
    const reward = 1_000 * activity(operations);
    const cost = reward * 0.35;
    const sink = (1_000 + reward) * 0.25;
    await ledger.apply({ profileId, scope: "p2.7.operation", idempotencyKey: `reward-${day}`, reason: "operation_reward", deltas: { capital: micro(reward) } });
    await ledger.apply({ profileId, scope: "p2.7.operation", idempotencyKey: `cost-${day}`, reason: "operation_cost", deltas: { capital: `-${micro(cost)}` } });
    await ledger.apply({ profileId, scope: "p2.7.progression", idempotencyKey: `sink-${day}`, reason: "operation_cost", deltas: { capital: `-${micro(sink)}` } });
  }
  const rows = await pool.query<{ reason_code: string; resource: ResourceKind; total: string }>("SELECT t.reason_code, e.resource, SUM(e.amount_micro)::text AS total FROM ledger_transactions t JOIN resource_ledger_entries e ON e.transaction_id=t.id WHERE t.profile_id=$1 GROUP BY t.reason_code,e.resource", [profileId]);
  let facilityValue = 0n; let operationNet = 0n;
  for (const row of rows.rows) {
    const value = valueMicro(row.resource, BigInt(row.total));
    if (row.reason_code === "accrual_settlement") facilityValue += value;
    if (row.reason_code === "operation_reward" || row.reason_code === "operation_cost") operationNet += value;
  }
  const balances = await pool.query<{ balance_micro: string }>("SELECT balance_micro::text FROM resource_balances WHERE profile_id=$1", [profileId]);
  if (balances.rows.some((row) => BigInt(row.balance_micro) < 0n)) throw new Error("P2.7 scenario produced a negative balance.");
  return { days, operations, cadenceHours, facilityValueMicro: facilityValue.toString(), operationNetMicro: operationNet.toString(), netValueMicro: (facilityValue + operationNet).toString() };
}

async function dropTestDatabase(client: Client): Promise<void> {
  await client.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()",
    [testDb],
  );
  await client.query(`DROP DATABASE IF EXISTS ${testDb}`);
}

const admin = new Client({ connectionString: adminUrl });
admin.on("error", () => undefined);
await admin.connect();
await dropTestDatabase(admin);
await admin.query(`CREATE DATABASE ${testDb}`);
await admin.end();
const pool = new Pool({ connectionString: testUrl });
try {
  await applyMigrations(testUrl);
  const results: Result[] = [];
  for (const days of [7, 30]) for (const cadenceHours of [24, 48, 72]) for (const operations of [2, 10]) results.push(await runScenario(pool, days, operations, cadenceHours));
  for (const days of [7, 30]) for (const cadenceHours of [24, 48, 72]) {
    const casual = results.find((result) => result.days === days && result.operations === 2 && result.cadenceHours === cadenceHours);
    const engaged = results.find((result) => result.days === days && result.operations === 10 && result.cadenceHours === cadenceHours);
    if (!casual || !engaged) throw new Error("P2.7 paired scenario is incomplete.");
    if (BigInt(casual.netValueMicro) <= 0n || BigInt(engaged.netValueMicro) <= 0n) throw new Error("P2.7 progression comparison requires positive normalized net values.");
    const casualNet = BigInt(casual.netValueMicro);
    const engagedNet = BigInt(engaged.netValueMicro);
    if ((engagedNet - casualNet) * 100n >= casualNet * 20n) {
      throw new Error(`P2.7 active/casual gap exceeded the strict limit at ${days}d/${cadenceHours}h.`);
    }
  }
  const daily = results.find((result) => result.days === 30 && result.operations === 2 && result.cadenceHours === 24);
  const every72 = results.find((result) => result.days === 30 && result.operations === 2 && result.cadenceHours === 72);
  if (!daily || !every72 || BigInt(every72.facilityValueMicro) >= BigInt(daily.facilityValueMicro)) throw new Error("P2.7 claim cadence did not expose storage-window foregone production.");
  console.log(`PASS: P2.7 deterministic full-ledger comparison seed=${FIXTURE_SEED} ${JSON.stringify(results)}`);
} finally {
  await pool.end();
  const cleanup = new Client({ connectionString: adminUrl }); cleanup.on("error", () => undefined); await cleanup.connect();
  await dropTestDatabase(cleanup); await cleanup.end();
}
