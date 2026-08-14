export const FACILITY_KINDS = ["microgrid", "data_center", "robotics_workshop", "research_lab", "security_operations_center"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];
export type ResourceOutput = "energy" | "compute" | "components" | "expertise";

export interface FacilityLevelDefinition {
  readonly facility: FacilityKind;
  readonly level: number;
  readonly output: { readonly kind: "resource"; readonly resource: ResourceOutput; readonly perHourMicro: string } | { readonly kind: "heat_reduction"; readonly perHourMicro: string };
  readonly upgradeCapitalMicro: string;
  readonly upgradeComponentsMicro: string;
  readonly upgradeTimeTenthsMinutes: number;
  readonly storageTenthsHours: number;
}

interface FacilityBase { kind: FacilityKind; output: ResourceOutput | "heat_reduction"; baseOutput: number; capital: number; components: number; minutes: number; }
const bases: readonly FacilityBase[] = [
  { kind: "microgrid", output: "energy", baseOutput: 90, capital: 220, components: 12, minutes: 1.5 },
  { kind: "data_center", output: "compute", baseOutput: 150, capital: 260, components: 18, minutes: 2 },
  { kind: "robotics_workshop", output: "components", baseOutput: 18, capital: 320, components: 8, minutes: 2.5 },
  { kind: "research_lab", output: "expertise", baseOutput: 8, capital: 340, components: 22, minutes: 3 },
  { kind: "security_operations_center", output: "heat_reduction", baseOutput: 0.9, capital: 380, components: 26, minutes: 3 },
];

function roundHalfAway(value: number): number { return Math.sign(value) * Math.floor(Math.abs(value) + 0.5); }
function micro(value: number): string { return String(roundHalfAway(value * 1_000_000)); }

export const FACILITY_LEVELS: readonly FacilityLevelDefinition[] = bases.flatMap((base) => Array.from({ length: 12 }, (_, index) => {
  const level = index + 1;
  const perHourMicro = micro(base.baseOutput * 1.24 ** index);
  const output = base.output === "heat_reduction"
    ? { kind: "heat_reduction" as const, perHourMicro }
    : { kind: "resource" as const, resource: base.output, perHourMicro };
  return {
    facility: base.kind,
    level,
    output,
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
