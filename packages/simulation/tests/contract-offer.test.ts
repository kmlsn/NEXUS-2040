import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTRACT_MIN_HELD_MICRO, collateralMicro, collateralRefundMicro, contractProbability, fairValueMicro, offerScore, priceScore, resolveContractOffer } from "../src/contract-offer";

assert.equal(fairValueMicro(1_000_000_000n, 10_000n), 1_000_000_000n);
assert.equal(fairValueMicro(1_000_000_000n, 11_500n), 1_150_000_000n);
assert.equal(priceScore(1_000_000_000n, 1_000_000_000n), 100);
assert.equal(priceScore(999_000_000n, 1_000_000_000n), 99.9);
assert.ok(priceScore(900_000_000n, 1_000_000_000n) > priceScore(700_000_000n, 1_000_000_000n));
assert.ok(offerScore({ preparedness: 80, reputation: 50, urgencyFit: 50 }, 1_000_000_000n, 1_000_000_000n) > offerScore({ preparedness: 60, reputation: 50, urgencyFit: 50 }, 1_000_000_000n, 1_000_000_000n));
assert.ok(contractProbability(70, 50) > contractProbability(50, 50));
assert.ok(contractProbability(50, 70) < contractProbability(50, 50));
assert.equal(collateralMicro(1_000_000_000n, 1, 10_000_000_000n), 80_000_000n);
assert.equal(collateralMicro(1_000_000_000n, 1, 10n), 2n);
assert.equal(collateralRefundMicro(CONTRACT_MIN_HELD_MICRO, "lost"), 3n);
assert.throws(() => collateralRefundMicro(3n, "lost"));
const one = resolveContractOffer("balance-1.2", "asteria-baseline-0.2", 20260809n, "contract:fixed:offer:profile:award", { preparedness: 50, reputation: 50, urgencyFit: 50, bestNpcScore: 70 }, 1_000_000_000n, 1_000_000_000n);
const two = resolveContractOffer("balance-1.2", "asteria-baseline-0.2", 20260809n, "contract:fixed:offer:profile:award", { preparedness: 50, reputation: 50, urgencyFit: 50, bestNpcScore: 70 }, 1_000_000_000n, 1_000_000_000n);
assert.deepEqual(one, two);
const fixture = JSON.parse(readFileSync(new URL("../fixtures/contract-offer-v1.json", import.meta.url), "utf8"));
for (const boundary of fixture.price_score_boundaries) {
  assert.equal(priceScore(BigInt(boundary.bid_micro), BigInt(boundary.fair_value_micro)), Number(boundary.price_score_scaled) / 1_000_000_000);
}
const golden = fixture.case;
const resolved = resolveContractOffer(fixture.formula_version, fixture.content_version, BigInt(golden.master_seed), golden.stream_id, { preparedness: golden.preparedness, reputation: golden.reputation, urgencyFit: golden.urgency_fit, bestNpcScore: golden.best_npc_score }, BigInt(golden.bid_micro), BigInt(golden.fair_value_micro));
assert.equal(resolved.playerScore, golden.player_score); assert.equal(resolved.priceScore, golden.price_score); assert.equal(resolved.threshold, golden.threshold); assert.equal(resolved.draw, golden.draw); assert.equal(resolved.awarded, golden.awarded);
console.log("PASS: contract-offer score, collateral, and deterministic award boundaries.");
