import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { POSTGRES_BIGINT_MAX, POSTGRES_BIGINT_MIN, parseMicroUnits, resourceUnitsToMicro } from "../src/ledger/micro-units";

const fixture = JSON.parse(await readFile(resolve(fileURLToPath(new URL("../../../fixtures/micro-units-v1.json", import.meta.url))), "utf8")) as { cases: Array<{ units: string; micro: string }>; rejected_units: string[] };
for (const item of fixture.cases) assert.equal(resourceUnitsToMicro(item.units), BigInt(item.micro));
assert.equal(parseMicroUnits(POSTGRES_BIGINT_MAX.toString()), POSTGRES_BIGINT_MAX);
assert.equal(parseMicroUnits(POSTGRES_BIGINT_MIN.toString()), POSTGRES_BIGINT_MIN);
for (const invalid of ["0", "1.5", (POSTGRES_BIGINT_MAX + 1n).toString(), (POSTGRES_BIGINT_MIN - 1n).toString()]) {
  assert.throws(() => parseMicroUnits(invalid));
}
for (const invalid of fixture.rejected_units) assert.throws(() => resourceUnitsToMicro(invalid));
assert.throws(() => resourceUnitsToMicro("1e3"));
console.log("PASS: ledger micro-unit conversion and PostgreSQL bigint bounds verified.");
