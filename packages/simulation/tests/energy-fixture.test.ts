import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileEnergy, type EnergyFacilityInput } from "../src/index";

interface FixtureFacility { facility_id: string; facility_kind: EnergyFacilityInput["facilityKind"]; priority: number; demand_micro: string; nominal_output_micro: string; }
interface FixtureExpected { facility_id: string; allocated_micro: string; output_numerator: string; output_denominator: string; }
interface FixtureCase { available_energy_micro: string; facilities: readonly FixtureFacility[]; expected: readonly FixtureExpected[]; }

const fixture = JSON.parse(await readFile(resolve(fileURLToPath(new URL("..", import.meta.url)), "fixtures/energy-v1.json"), "utf8")) as { cases: readonly FixtureCase[] };
for (const item of fixture.cases) {
  const resolution = reconcileEnergy(BigInt(item.available_energy_micro), item.facilities.map((facility) => ({
    facilityId: facility.facility_id, facilityKind: facility.facility_kind, priority: facility.priority,
    demandEnergyMicro: BigInt(facility.demand_micro), nominalOutputMicro: BigInt(facility.nominal_output_micro),
  })));
  const actual = resolution.allocations.map((allocation) => ({
    facility_id: allocation.facilityId,
    allocated_micro: String(allocation.allocatedEnergyMicro),
    output_numerator: String(allocation.actualOutputMicroPerHour.numerator),
    output_denominator: String(allocation.actualOutputMicroPerHour.denominator),
  }));
  if (JSON.stringify(actual) !== JSON.stringify(item.expected)) throw new Error("Energy golden fixture mismatch.");
}
console.log("PASS: TypeScript exact energy fixture matches P2.3.");
