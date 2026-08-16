export const CONTRACT_KINDS = ["story", "market"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export interface ContractVisibilityInput {
  readonly kind: ContractKind;
  /** Server-derived campaign eligibility; concrete campaign content belongs to P6.1. */
  readonly storyEligible: boolean;
  /** Server-derived market-listing eligibility; bidding and expiry belong to P3.5/P3.6. */
  readonly marketListed: boolean;
}

/**
 * D-030: story availability is intentionally independent from market state,
 * scores, bids, RNG, or another contract's result.
 */
export function isContractVisible(input: ContractVisibilityInput): boolean {
  if (!CONTRACT_KINDS.includes(input.kind)) throw new Error("Unknown contract kind.");
  return input.kind === "story" ? input.storyEligible : input.marketListed;
}
