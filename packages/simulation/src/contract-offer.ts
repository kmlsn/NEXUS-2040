import { deterministicRng, probabilityThreshold } from "./index.js";

export const CONTRACT_SCORE_MIN = 0;
export const CONTRACT_SCORE_MAX = 100;
export const CONTRACT_TIER_MIN = 1;
export const CONTRACT_TIER_MAX = 5;
export const CONTRACT_MIN_HELD_MICRO = 4n;
export const CONTRACT_MARKET_INDEX_SCALE = 10_000n;
const SCORE_SCALE = 1_000_000_000n;

export interface ContractOfferScores {
  readonly preparedness: number;
  readonly reputation: number;
  readonly urgencyFit: number;
  readonly bestNpcScore: number;
}

export interface ContractOfferResolution {
  readonly playerScore: number;
  readonly priceScore: number;
  readonly probability: number;
  readonly threshold: number;
  readonly draw: number;
  readonly awarded: boolean;
}

function assertScore(value: number, label: string): void {
  if (!Number.isFinite(value) || value < CONTRACT_SCORE_MIN || value > CONTRACT_SCORE_MAX) throw new Error(`${label} must be in [0,100].`);
}

function roundDivHalfAwayPositive(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error("Expected non-negative rational input.");
  return (numerator * 2n + denominator) / (2n * denominator);
}

export function fairValueMicro(baseRewardMicro: bigint, marketIndexBasisPoints: bigint): bigint {
  if (baseRewardMicro <= 0n || marketIndexBasisPoints < 8500n || marketIndexBasisPoints > 11500n) throw new Error("Market contract value is invalid.");
  return roundDivHalfAwayPositive(baseRewardMicro * marketIndexBasisPoints, CONTRACT_MARKET_INDEX_SCALE);
}

export function priceScore(bidMicro: bigint, fairValue: bigint): number {
  if (bidMicro <= 0n || fairValue <= 0n) throw new Error("Bid and fair value must be positive micro-units.");
  const deviation = bidMicro >= fairValue ? bidMicro - fairValue : fairValue - bidMicro;
  if (deviation >= fairValue) return 0;
  const scaled = roundDivHalfAwayPositive(100n * (fairValue - deviation) * SCORE_SCALE, fairValue);
  return Number(scaled) / Number(SCORE_SCALE);
}

export function offerScore(scores: Omit<ContractOfferScores, "bestNpcScore">, bidMicro: bigint, fairValue: bigint): number {
  assertScore(scores.preparedness, "preparedness");
  assertScore(scores.reputation, "reputation");
  assertScore(scores.urgencyFit, "urgencyFit");
  return Math.max(0, Math.min(100, 0.45 * scores.preparedness + 0.25 * scores.reputation + 0.20 * scores.urgencyFit + 0.10 * priceScore(bidMicro, fairValue)));
}

export function contractProbability(playerScore: number, bestNpcScore: number): number {
  assertScore(playerScore, "playerScore");
  assertScore(bestNpcScore, "bestNpcScore");
  return 0.10 + 0.80 / (1 + Math.exp(-(playerScore - bestNpcScore) / 9));
}

export function collateralMicro(baseRewardMicro: bigint, tier: number, liquidCapitalMicro: bigint): bigint {
  if (baseRewardMicro <= 0n || !Number.isInteger(tier) || tier < CONTRACT_TIER_MIN || tier > CONTRACT_TIER_MAX || liquidCapitalMicro < 0n) throw new Error("Collateral input is invalid.");
  const target = roundDivHalfAwayPositive(baseRewardMicro * BigInt(5 + 3 * tier), 100n);
  const liquidCap = roundDivHalfAwayPositive(liquidCapitalMicro * 20n, 100n);
  return target < liquidCap ? target : liquidCap;
}

export function collateralRefundMicro(heldMicro: bigint, outcome: "awarded" | "lost"): bigint {
  if (heldMicro < CONTRACT_MIN_HELD_MICRO) throw new Error("Collateral hold is below the minimum loss-safe amount.");
  return outcome === "awarded" ? heldMicro : roundDivHalfAwayPositive(heldMicro * 75n, 100n);
}

export function resolveContractOffer(
  formulaVersion: string,
  contentVersion: string,
  masterSeed: bigint,
  streamId: string,
  scores: ContractOfferScores,
  bidMicro: bigint,
  fairValue: bigint,
): ContractOfferResolution {
  assertScore(scores.bestNpcScore, "bestNpcScore");
  const playerScore = offerScore(scores, bidMicro, fairValue);
  const probability = contractProbability(playerScore, scores.bestNpcScore);
  const threshold = probabilityThreshold(probability);
  const draw = deterministicRng(formulaVersion, contentVersion, masterSeed, streamId).nextUint32();
  return { playerScore, priceScore: priceScore(bidMicro, fairValue), probability, threshold, draw, awarded: draw < threshold };
}
