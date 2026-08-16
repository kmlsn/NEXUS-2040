import assert from "node:assert/strict";
import { FixedClock } from "@nexus/contracts";
import { WORLD_CYCLE_MS } from "@nexus/simulation";
import type { Pool, PoolClient } from "pg";
import { WorldCycleService } from "../src/world-cycle-service";

const epoch = 1_800_000_000_000n;
const row = {
  content_version: "asteria-baseline-0.2",
  formula_version: "balance-1.2",
  master_seed: "20260809",
  epoch_ms: epoch.toString(),
  completed_cycles: "0",
  state_revision: "1",
};
let updates = 0;
const client = {
  query: async (sql: string, values?: readonly string[]) => {
    if (sql.startsWith("SELECT content_version")) return { rows: [{ ...row }] };
    if (sql.startsWith("UPDATE world_state")) {
      row.completed_cycles = values?.[0] ?? "";
      row.state_revision = values?.[1] ?? "";
      updates += 1;
    }
    return { rows: [] };
  },
} as unknown as PoolClient;
const pool = { connect: async () => client } as unknown as Pool;
const service = new WorldCycleService(pool, new FixedClock(Number(epoch + WORLD_CYCLE_MS * 2n)));

const first = await service.advanceInTransaction(client, epoch + WORLD_CYCLE_MS * 2n);
assert.equal(first.advancedCycles, 2n);
assert.equal(row.completed_cycles, "2");
assert.equal(row.state_revision, "3");
const replay = await service.advanceInTransaction(client, epoch + WORLD_CYCLE_MS * 2n);
assert.equal(replay.advancedCycles, 0n);
assert.equal(updates, 1);
assert.equal((await service.advanceInTransaction(client, epoch)).advancedCycles, 0n);
assert.rejects(() => new WorldCycleService(pool, new FixedClock(-1)).advanceNow());

console.log("PASS: worker world-cycle locking adapter preserves forward-only deterministic state.");
