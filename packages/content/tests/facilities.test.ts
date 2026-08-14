import { strict as assert } from "node:assert";
import { FACILITY_KINDS, FACILITY_LEVELS, facilityLevel } from "../src/facilities";

assert.equal(FACILITY_LEVELS.length, 60);
for (const kind of FACILITY_KINDS) {
  const rows = FACILITY_LEVELS.filter((row) => row.facility === kind);
  assert.deepEqual(rows.map((row) => row.level), Array.from({ length: 12 }, (_, index) => index + 1));
  for (let index = 1; index < rows.length; index += 1) {
    assert(BigInt(rows[index]?.output.perHourMicro ?? "0") > BigInt(rows[index - 1]?.output.perHourMicro ?? "0"));
    assert(BigInt(rows[index]?.upgradeCapitalMicro ?? "0") > BigInt(rows[index - 1]?.upgradeCapitalMicro ?? "0"));
    assert(BigInt(rows[index]?.upgradeComponentsMicro ?? "0") > BigInt(rows[index - 1]?.upgradeComponentsMicro ?? "0"));
  }
  assert(rows.every((row) => row.upgradeTimeTenthsMinutes <= 3600 && row.storageTenthsHours >= 240 && row.storageTenthsHours <= 360));
}
assert.equal(facilityLevel("microgrid", 1).output.perHourMicro, "90000000");
assert.equal(facilityLevel("security_operations_center", 1).output.kind, "heat_reduction");
assert.throws(() => facilityLevel("microgrid", 13));
console.log("PASS: 60 versioned facility-level definitions satisfy the P2.2 bounds.");
