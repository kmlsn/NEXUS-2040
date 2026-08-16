export const WORLD_CYCLE_MS = 21_600_000n;
export const WORLD_MASTER_SEED_MAX = (1n << 64n) - 1n;

export interface WorldState {
  contentVersion: string;
  formulaVersion: string;
  masterSeed: bigint;
  epochMs: bigint;
  completedCycles: bigint;
  stateRevision: bigint;
}

export interface WorldAdvance {
  state: WorldState;
  advancedCycles: bigint;
  firstAdvancedCycle: bigint | null;
  lastAdvancedCycle: bigint | null;
}

function assertNonNegativeInteger(value: bigint, name: string): void {
  if (value < 0n) throw new Error(`${name} must be a non-negative integer.`);
}

export function assertWorldState(state: WorldState): void {
  if (state.contentVersion.length === 0 || state.formulaVersion.length === 0) throw new Error("World state versions must not be empty.");
  if (state.masterSeed < 0n || state.masterSeed > WORLD_MASTER_SEED_MAX) throw new Error("World master seed must be an unsigned 64-bit integer.");
  assertNonNegativeInteger(state.epochMs, "World epoch");
  assertNonNegativeInteger(state.completedCycles, "Completed world cycles");
  if (state.stateRevision !== state.completedCycles + 1n) throw new Error("World state revision must equal completed cycles plus one.");
}

export function worldCycleStreamId(cycle: bigint): string {
  assertNonNegativeInteger(cycle, "World cycle");
  return `world:${cycle}`;
}

/** Advances only completed six-hour boundaries; it has no clock, database, or other side effects. */
export function advanceWorldState(state: WorldState, serverNowMs: bigint): WorldAdvance {
  assertWorldState(state);
  assertNonNegativeInteger(serverNowMs, "Server time");
  if (serverNowMs <= state.epochMs) return { state, advancedCycles: 0n, firstAdvancedCycle: null, lastAdvancedCycle: null };

  const targetCompletedCycles = (serverNowMs - state.epochMs) / WORLD_CYCLE_MS;
  if (targetCompletedCycles <= state.completedCycles) return { state, advancedCycles: 0n, firstAdvancedCycle: null, lastAdvancedCycle: null };

  const advancedCycles = targetCompletedCycles - state.completedCycles;
  return {
    state: { ...state, completedCycles: targetCompletedCycles, stateRevision: targetCompletedCycles + 1n },
    advancedCycles,
    firstAdvancedCycle: state.completedCycles,
    lastAdvancedCycle: targetCompletedCycles - 1n,
  };
}
