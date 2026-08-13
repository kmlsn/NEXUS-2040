import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deterministicRng, probabilityThreshold, roundHalfAway } from "../src/index";

const fixture = JSON.parse(await readFile(resolve(fileURLToPath(new URL("..", import.meta.url)), "fixtures/pcg32-v1.json"), "utf8"));
for (const item of fixture.cases) {
  const rng = deterministicRng(fixture.formula_version, fixture.content_version, BigInt(item.master_seed), item.stream_id);
  const actual = item.uint32.map(() => rng.nextUint32());
  if (actual.join(",") !== item.uint32.join(",")) throw new Error(`Golden mismatch: ${item.stream_id}`);
}
for (const [probability, threshold] of fixture.thresholds) if (probabilityThreshold(probability) !== threshold) throw new Error(`Threshold mismatch: ${probability}`);
if (roundHalfAway(-2.5) !== -3 || roundHalfAway(1.25, 1) !== 1.3) throw new Error("Half-away rounding mismatch.");
const success = deterministicRng(fixture.formula_version, fixture.content_version, 20260809n, "operation:test-17:success");
const baseline = [success.nextUint32(), success.nextUint32(), success.nextUint32()];
const unrelated = deterministicRng(fixture.formula_version, fixture.content_version, 20260809n, "operation:test-17:detection");
for (let index = 0; index < 100; index += 1) unrelated.nextUint32();
const replay = deterministicRng(fixture.formula_version, fixture.content_version, 20260809n, "operation:test-17:success");
if (baseline.join(",") !== [replay.nextUint32(), replay.nextUint32(), replay.nextUint32()].join(",")) throw new Error("Streams are not isolated.");
const bounded = deterministicRng(fixture.formula_version, fixture.content_version, 0n, "bounds");
if (!(bounded.uniform() > 0 && bounded.uniform() < 1)) throw new Error("Uniform is outside its open interval.");
let invalidSeed = false;
try { deterministicRng(fixture.formula_version, fixture.content_version, 1n << 64n, "invalid"); } catch { invalidSeed = true; }
if (!invalidSeed) throw new Error("Out-of-range seed was accepted.");
console.log("PASS: TypeScript PCG32 golden vectors and probability thresholds match the canonical fixture.");
