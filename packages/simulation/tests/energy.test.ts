import { reconcileEnergy, type EnergyFacilityInput } from "../src/index";

const micro = 1_000_000n;
const consumers: readonly EnergyFacilityInput[] = [
  { facilityId: "data", facilityKind: "data_center", priority: 1, demandEnergyMicro: 70n * micro, nominalOutputMicro: 150n * micro },
  { facilityId: "lab", facilityKind: "research_lab", priority: 2, demandEnergyMicro: 45n * micro, nominalOutputMicro: 8n * micro },
  { facilityId: "workshop", facilityKind: "robotics_workshop", priority: 3, demandEnergyMicro: 35n * micro, nominalOutputMicro: 18n * micro },
];

const partial = reconcileEnergy(90n * micro, consumers);
if (partial.consumedEnergyMicro !== 90n * micro || partial.remainingEnergyMicro !== 0n) throw new Error("Energy must be conserved.");
if (partial.allocations.map((item) => item.facilityId).join(",") !== "data,lab,workshop") throw new Error("Priority order is wrong.");
if (partial.allocations[0]?.actualOutputMicroPerHour.numerator !== 150n * micro || partial.allocations[1]?.actualOutputMicroPerHour.numerator !== 32n * micro || partial.allocations[1]?.actualOutputMicroPerHour.denominator !== 9n || partial.allocations[2]?.actualOutputMicroPerHour.numerator !== 0n) throw new Error("Partial efficiency rate is wrong.");

const reversedTie = reconcileEnergy(50n * micro, [
  { facilityId: "zeta", facilityKind: "data_center", priority: 1, demandEnergyMicro: 40n * micro, nominalOutputMicro: 100n * micro },
  { facilityId: "alpha", facilityKind: "research_lab", priority: 1, demandEnergyMicro: 40n * micro, nominalOutputMicro: 100n * micro },
]);
if (reversedTie.allocations.map((item) => item.facilityId).join(",") !== "alpha,zeta" || reversedTie.allocations[0]?.allocatedEnergyMicro !== 40n * micro || reversedTie.allocations[1]?.allocatedEnergyMicro !== 10n * micro) throw new Error("Facility ID tie-break is not stable.");

const grid = reconcileEnergy(0n, [{ facilityId: "grid", facilityKind: "microgrid", priority: 5, demandEnergyMicro: 0n, nominalOutputMicro: 90n * micro }]);
if (grid.allocations[0]?.actualOutputMicroPerHour.numerator !== 90n * micro || grid.consumedEnergyMicro !== 0n) throw new Error("Microgrid must produce without consuming energy.");

const moreEnergy = reconcileEnergy(91n * micro, consumers);
for (let index = 0; index < consumers.length; index += 1) {
  const before = partial.allocations[index]?.actualOutputMicroPerHour ?? { numerator: 0n, denominator: 1n };
  const after = moreEnergy.allocations[index]?.actualOutputMicroPerHour ?? { numerator: 0n, denominator: 1n };
  if (after.numerator * before.denominator < before.numerator * after.denominator) throw new Error("Output must be monotonic as energy increases.");
}

for (const invalid of [
  () => reconcileEnergy(-1n, consumers),
  () => reconcileEnergy(1n, [{ ...consumers[0]!, facilityId: "data" }, { ...consumers[1]!, facilityId: "data" }]),
  () => reconcileEnergy(1n, [{ ...consumers[0]!, priority: 0 }]),
  () => reconcileEnergy(1n, [{ ...consumers[0]!, demandEnergyMicro: 0n }]),
  () => reconcileEnergy(1n, [{ ...consumers[0]!, nominalOutputMicro: 1n << 63n }]),
]) {
  let rejected = false;
  try { invalid(); } catch { rejected = true; }
  if (!rejected) throw new Error("Invalid energy input was accepted.");
}

console.log("PASS: deterministic energy priority and exact partial-efficiency resolution.");
