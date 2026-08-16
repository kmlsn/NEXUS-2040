import assert from "node:assert/strict";
import { CONTRACT_KINDS, isContractVisible, type ContractKind } from "../src/contracts";

assert.deepEqual(CONTRACT_KINDS, ["story", "market"]);
for (const kind of CONTRACT_KINDS) assert.ok(kind === "story" || kind === "market");

const story: ContractKind = "story";
for (const storyEligible of [false, true]) {
  for (const marketListed of [false, true]) {
    assert.equal(isContractVisible({ kind: story, storyEligible, marketListed }), storyEligible);
    assert.equal(isContractVisible({ kind: "market", storyEligible, marketListed }), marketListed);
  }
}
assert.throws(() => isContractVisible({ kind: "unknown" as ContractKind, storyEligible: true, marketListed: true }));

console.log("PASS: story and market contract visibility remain deterministically separated.");
