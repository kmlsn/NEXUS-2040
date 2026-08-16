import type { Clock } from "@nexus/contracts";
import { advanceWorldState, type WorldAdvance, type WorldState } from "@nexus/simulation";
import type { Pool, PoolClient } from "pg";

const POSTGRES_BIGINT_MAX = (1n << 63n) - 1n;

interface WorldStateRow {
  content_version: string;
  formula_version: string;
  master_seed: string;
  epoch_ms: string;
  completed_cycles: string;
  state_revision: string;
}

export type WorldCycleOutcome = WorldAdvance;

function rowToState(row: WorldStateRow): WorldState {
  return {
    contentVersion: row.content_version,
    formulaVersion: row.formula_version,
    masterSeed: BigInt(row.master_seed),
    epochMs: BigInt(row.epoch_ms),
    completedCycles: BigInt(row.completed_cycles),
    stateRevision: BigInt(row.state_revision),
  };
}

function assertServerNow(serverNowMs: bigint): void {
  if (serverNowMs < 0n || serverNowMs > POSTGRES_BIGINT_MAX) throw new Error("Server time is outside the supported range.");
}

/** Owns no time source: callers may supply server time only, while production uses its injected server clock. */
export class WorldCycleService {
  constructor(private readonly pool: Pool, private readonly clock: Clock) {}

  async advanceNow(): Promise<WorldCycleOutcome> {
    const now = this.clock.nowMs();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Server clock returned an invalid time.");
    return this.advanceTo(BigInt(now));
  }

  async advanceTo(serverNowMs: bigint): Promise<WorldCycleOutcome> {
    assertServerNow(serverNowMs);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const outcome = await this.advanceInTransaction(client, serverNowMs);
      await client.query("COMMIT");
      return outcome;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Advances a locked singleton state inside a transaction owned by the caller. */
  async advanceInTransaction(client: PoolClient, serverNowMs: bigint): Promise<WorldCycleOutcome> {
    assertServerNow(serverNowMs);
    const result = await client.query<WorldStateRow>("SELECT content_version, formula_version, master_seed, epoch_ms, completed_cycles, state_revision FROM world_state WHERE id = 1 FOR UPDATE");
    const row = result.rows[0];
    if (!row) throw new Error("World state is not initialized.");
    const outcome = advanceWorldState(rowToState(row), serverNowMs);
    if (outcome.advancedCycles > 0n) {
      await client.query(
        "UPDATE world_state SET completed_cycles = $1, state_revision = $2, updated_at = now() WHERE id = 1",
        [outcome.state.completedCycles.toString(), outcome.state.stateRevision.toString()],
      );
    }
    return outcome;
  }
}
