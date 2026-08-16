import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { MARKET_INDEX_MAX, MARKET_INDEX_MIN, MARKET_INDEX_SCALE, MARKET_STORY_SHOCKS, advanceMarketIndex, advanceMarketState, marketShockForCompletedCycle } from "../src/market";

assert.equal(advanceMarketIndex(MARKET_INDEX_SCALE, 0), MARKET_INDEX_SCALE);
assert.equal(advanceMarketIndex(MARKET_INDEX_MIN, -420), MARKET_INDEX_MIN);
assert.equal(advanceMarketIndex(MARKET_INDEX_MAX, 420), MARKET_INDEX_MAX);
assert.equal(advanceMarketIndex(MARKET_INDEX_SCALE, -1500), MARKET_INDEX_MIN);
assert.equal(advanceMarketIndex(MARKET_INDEX_SCALE, 1500), MARKET_INDEX_MAX);
assert.equal(advanceMarketIndex(11_500, 0), 11_080);
assert.equal(advanceMarketIndex(11_080, 0), 10_778);
assert.deepEqual(MARKET_STORY_SHOCKS, [
  { id: "E01", completedCycle: 120n, shockBasisPoints: 900 },
  { id: "E02", completedCycle: 300n, shockBasisPoints: -800 },
]);
assert.equal(marketShockForCompletedCycle(120n), 900);
assert.equal(marketShockForCompletedCycle(300n), -800);
assert.equal(marketShockForCompletedCycle(1n), 0);
const fixture = JSON.parse(await readFile(fileURLToPath(new URL("../fixtures/market-v1.json", import.meta.url)), "utf8")) as { formula_version: string; scale: number; cases: { previous: number; shock: number; expected: number }[] };
assert.equal(fixture.formula_version, "balance-1.2");
assert.equal(fixture.scale, MARKET_INDEX_SCALE);
for (const item of fixture.cases) assert.equal(advanceMarketIndex(item.previous, item.shock), item.expected);

for (let previous = MARKET_INDEX_MIN; previous <= MARKET_INDEX_MAX; previous += 1) {
  const low = advanceMarketIndex(previous, -10_000);
  const high = advanceMarketIndex(previous, 10_000);
  assert.ok(low >= MARKET_INDEX_MIN && low <= MARKET_INDEX_MAX);
  assert.ok(high >= MARKET_INDEX_MIN && high <= MARKET_INDEX_MAX);
  assert.ok(low <= high);
}
for (const shock of [-20_000, -1_500, -420, 0, 420, 1_500, 20_000]) {
  let last = MARKET_INDEX_MIN;
  for (let previous = MARKET_INDEX_MIN; previous <= MARKET_INDEX_MAX; previous += 1) {
    const current = advanceMarketIndex(previous, shock);
    assert.ok(current >= last);
    last = current;
  }
}
for (const previous of [MARKET_INDEX_MIN, 9_000, MARKET_INDEX_SCALE, 11_000, MARKET_INDEX_MAX]) {
  let last = MARKET_INDEX_MIN;
  for (let shock = -20_000; shock <= 20_000; shock += 97) {
    const current = advanceMarketIndex(previous, shock);
    assert.ok(current >= last);
    last = current;
  }
}

const initial = { indexBasisPoints: MARKET_INDEX_SCALE, appliedCycles: 0n, stateRevision: 1n };
const oneStep = advanceMarketState(initial, 5n, (cycle) => cycle === 3n ? 900 : 0);
const repeated = [1n, 2n, 3n, 4n, 5n].reduce((state, cycle) => advanceMarketState(state, cycle, (item) => item === 3n ? 900 : 0).state, initial);
assert.deepEqual(oneStep.state, repeated);
assert.equal(advanceMarketState(oneStep.state, 5n, () => 0).advancedCycles, 0n);
assert.throws(() => advanceMarketIndex(8_499, 0));
assert.throws(() => marketShockForCompletedCycle(0n));
assert.throws(() => advanceMarketState({ ...initial, stateRevision: 2n }, 1n, () => 0));

console.log("PASS: fixed-point NPC market corridor, mean reversion, and ordered catch-up verified.");
