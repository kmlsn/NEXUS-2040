import { FixedClock, SequenceUuidGenerator } from "../src/index";

if (new FixedClock(1_726_080_900_000).nowMs() !== 1_726_080_900_000) throw new Error("Fixed clock drifted.");
const ids = new SequenceUuidGenerator(["a", "b"]);
if (ids.next() !== "a" || ids.next() !== "b") throw new Error("UUID sequence changed order.");
let exhausted = false;
try { ids.next(); } catch { exhausted = true; }
if (!exhausted) throw new Error("UUID sequence did not reject exhaustion.");
console.log("PASS: deterministic runtime ports are stable and fail closed.");
