import assert from "node:assert/strict";
import { advanceWorldState, assertWorldState, WORLD_CYCLE_MS, worldCycleStreamId, type WorldState } from "../src/index";

const initial: WorldState = {
  contentVersion: "asteria-baseline-0.2",
  formulaVersion: "balance-1.2",
  masterSeed: 20_260_809n,
  epochMs: 1_767_225_600_000n,
  completedCycles: 0n,
  stateRevision: 1n,
};

const beforeBoundary = advanceWorldState(initial, initial.epochMs + WORLD_CYCLE_MS - 1n);
assert.equal(beforeBoundary.advancedCycles, 0n);
const firstBoundary = advanceWorldState(initial, initial.epochMs + WORLD_CYCLE_MS);
assert.equal(firstBoundary.advancedCycles, 1n);
assert.equal(firstBoundary.firstAdvancedCycle, 0n);
assert.equal(firstBoundary.lastAdvancedCycle, 0n);
assert.equal(firstBoundary.state.completedCycles, 1n);
assert.equal(firstBoundary.state.stateRevision, 2n);

const target = initial.epochMs + WORLD_CYCLE_MS * 5n + 17n;
const once = advanceWorldState(initial, target);
let stepped = initial;
for (let cycle = 1n; cycle <= 5n; cycle += 1n) stepped = advanceWorldState(stepped, initial.epochMs + WORLD_CYCLE_MS * cycle).state;
assert.deepEqual(once.state, stepped);
assert.deepEqual(advanceWorldState(initial, target), once);
assert.equal(advanceWorldState(once.state, target).advancedCycles, 0n);
assert.equal(advanceWorldState(once.state, target - WORLD_CYCLE_MS).advancedCycles, 0n);
assert.equal(worldCycleStreamId(4n), "world:4");

for (const invalid of [
  { ...initial, masterSeed: -1n },
  { ...initial, masterSeed: 1n << 64n },
  { ...initial, epochMs: -1n },
  { ...initial, completedCycles: -1n },
  { ...initial, stateRevision: 0n },
  { ...initial, stateRevision: 10n },
  { ...initial, contentVersion: "" },
]) assert.throws(() => assertWorldState(invalid));
assert.throws(() => advanceWorldState(initial, -1n));
assert.throws(() => worldCycleStreamId(-1n));

console.log("PASS: deterministic six-hour world-cycle state transitions verified.");
