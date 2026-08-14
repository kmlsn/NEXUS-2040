export const FACILITY_KINDS = ["microgrid", "data_center", "robotics_workshop", "research_lab", "security_operations_center"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];
export type ResourceOutput = "energy" | "compute" | "components" | "expertise";

export interface FacilityLevelDefinition {
  readonly facility: FacilityKind;
  readonly level: number;
  readonly output: { readonly kind: "resource"; readonly resource: ResourceOutput; readonly perHourMicro: string } | { readonly kind: "heat_reduction"; readonly perHourMicro: string };
  /** Hourly energy demand in micro-units. A microgrid deliberately has zero demand. */
  readonly energyDemandPerHourMicro: string;
  readonly upgradeCapitalMicro: string;
  readonly upgradeComponentsMicro: string;
  readonly upgradeTimeTenthsMinutes: number;
  readonly storageTenthsHours: number;
}

interface FacilityBase { kind: FacilityKind; output: ResourceOutput | "heat_reduction"; baseOutputMicro: bigint; baseEnergyDemandMicro: bigint; capital: number; components: number; minutes: number; }
const bases: readonly FacilityBase[] = [
  { kind: "microgrid", output: "energy", baseOutputMicro: 90_000_000n, baseEnergyDemandMicro: 0n, capital: 220, components: 12, minutes: 1.5 },
  { kind: "data_center", output: "compute", baseOutputMicro: 150_000_000n, baseEnergyDemandMicro: 70_000_000n, capital: 260, components: 18, minutes: 2 },
  { kind: "robotics_workshop", output: "components", baseOutputMicro: 18_000_000n, baseEnergyDemandMicro: 35_000_000n, capital: 320, components: 8, minutes: 2.5 },
  { kind: "research_lab", output: "expertise", baseOutputMicro: 8_000_000n, baseEnergyDemandMicro: 45_000_000n, capital: 340, components: 22, minutes: 3 },
  { kind: "security_operations_center", output: "heat_reduction", baseOutputMicro: 900_000n, baseEnergyDemandMicro: 30_000_000n, capital: 380, components: 26, minutes: 3 },
];

function roundHalfAway(value: number): number { return Math.sign(value) * Math.floor(Math.abs(value) + 0.5); }
function power(base: bigint, exponent: number): bigint { let result = 1n; for (let index = 0; index < exponent; index += 1) result *= base; return result; }
function roundPositiveRatio(numerator: bigint, denominator: bigint): bigint { return (2n * numerator + denominator) / (2n * denominator); }
function scaledMicro(baseMicro: bigint, numerator: bigint, denominator: bigint, exponent: number): string {
  return String(roundPositiveRatio(baseMicro * power(numerator, exponent), power(denominator, exponent)));
}

export const FACILITY_LEVELS: readonly FacilityLevelDefinition[] = bases.flatMap((base) => Array.from({ length: 12 }, (_, index) => {
  const level = index + 1;
  const perHourMicro = scaledMicro(base.baseOutputMicro, 31n, 25n, index);
  const output = base.output === "heat_reduction"
    ? { kind: "heat_reduction" as const, perHourMicro }
    : { kind: "resource" as const, resource: base.output, perHourMicro };
  return {
    facility: base.kind,
    level,
    output,
    energyDemandPerHourMicro: scaledMicro(base.baseEnergyDemandMicro, 59n, 50n, index),
    upgradeCapitalMicro: String(roundHalfAway(base.capital * 1.55 ** index) * 1_000_000),
    upgradeComponentsMicro: String(roundHalfAway(base.components * 1.48 ** index) * 1_000_000),
    upgradeTimeTenthsMinutes: roundHalfAway(Math.min(360, base.minutes * 1.5 ** index) * 10),
    storageTenthsHours: Math.min(360, roundHalfAway((24 + 1.5 * index) * 10)),
  };
}));

export function facilityLevel(facility: FacilityKind, level: number): FacilityLevelDefinition {
  const definition = FACILITY_LEVELS.find((item) => item.facility === facility && item.level === level);
  if (!definition) throw new Error("Unknown facility level.");
  return definition;
}
