export const MARKET_INDEX_SCALE = 10_000;
export const MARKET_INDEX_MIN = 8_500;
export const MARKET_INDEX_MAX = 11_500;
const MEAN_REVERSION_NUMERATOR = 72;
const MEAN_REVERSION_DENOMINATOR = 100;

export const MARKET_STORY_SHOCKS = [
  { id: "E01", completedCycle: 120n, shockBasisPoints: 900 },
  { id: "E02", completedCycle: 300n, shockBasisPoints: -800 },
] as const;

export interface MarketState {
  readonly indexBasisPoints: number;
  readonly appliedCycles: bigint;
  readonly stateRevision: bigint;
}

export interface MarketAdvance {
  readonly state: MarketState;
  readonly advancedCycles: bigint;
  readonly firstAppliedCycle: bigint | null;
  readonly lastAppliedCycle: bigint | null;
}

/** P3.3's server-owned market-only portion of the two deterministic story shocks. */
export function marketShockForCompletedCycle(completedCycle: bigint): number {
  if (completedCycle < 1n) throw new Error("Completed world cycle must be positive.");
  return MARKET_STORY_SHOCKS.find((shock) => shock.completedCycle === completedCycle)?.shockBasisPoints ?? 0;
}

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer.`);
}

function roundHalfAwayDiv(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator);
  return sign * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}

export function assertMarketState(state: MarketState): void {
  assertSafeInteger(state.indexBasisPoints, "Market index");
  if (state.indexBasisPoints < MARKET_INDEX_MIN || state.indexBasisPoints > MARKET_INDEX_MAX) throw new Error("Market index is outside the configured corridor.");
  if (state.appliedCycles < 0n) throw new Error("Applied market cycles must be non-negative.");
  if (state.stateRevision !== state.appliedCycles + 1n) throw new Error("Market state revision must equal applied cycles plus one.");
}

/** Exact fixed-point form of D-029's clamped 0.72 mean-reversion formula. */
export function advanceMarketIndex(previousIndexBasisPoints: number, shockBasisPoints: number): number {
  assertSafeInteger(previousIndexBasisPoints, "Previous market index");
  assertSafeInteger(shockBasisPoints, "Market shock");
  if (previousIndexBasisPoints < MARKET_INDEX_MIN || previousIndexBasisPoints > MARKET_INDEX_MAX) throw new Error("Previous market index is outside the configured corridor.");
  const numerator = MARKET_INDEX_SCALE * MEAN_REVERSION_DENOMINATOR
    + MEAN_REVERSION_NUMERATOR * (previousIndexBasisPoints - MARKET_INDEX_SCALE)
    + shockBasisPoints * MEAN_REVERSION_DENOMINATOR;
  const clamped = Math.max(MARKET_INDEX_MIN * MEAN_REVERSION_DENOMINATOR, Math.min(MARKET_INDEX_MAX * MEAN_REVERSION_DENOMINATOR, numerator));
  return roundHalfAwayDiv(clamped, MEAN_REVERSION_DENOMINATOR);
}

/** Resolves every missed six-hour cycle in order; the shock source is server-owned by the caller. */
export function advanceMarketState(state: MarketState, targetCompletedCycles: bigint, shockForCompletedCycle: (cycle: bigint) => number): MarketAdvance {
  assertMarketState(state);
  if (targetCompletedCycles < 0n) throw new Error("Target completed cycles must be non-negative.");
  if (targetCompletedCycles <= state.appliedCycles) return { state, advancedCycles: 0n, firstAppliedCycle: null, lastAppliedCycle: null };

  let indexBasisPoints = state.indexBasisPoints;
  for (let cycle = state.appliedCycles + 1n; cycle <= targetCompletedCycles; cycle += 1n) {
    indexBasisPoints = advanceMarketIndex(indexBasisPoints, shockForCompletedCycle(cycle));
  }
  return {
    state: { indexBasisPoints, appliedCycles: targetCompletedCycles, stateRevision: targetCompletedCycles + 1n },
    advancedCycles: targetCompletedCycles - state.appliedCycles,
    firstAppliedCycle: state.appliedCycles + 1n,
    lastAppliedCycle: targetCompletedCycles,
  };
}
