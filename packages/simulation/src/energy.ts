export const ENERGY_FACILITY_KINDS = [
  "microgrid",
  "data_center",
  "robotics_workshop",
  "research_lab",
  "security_operations_center",
] as const;

export type EnergyFacilityKind = (typeof ENERGY_FACILITY_KINDS)[number];

/** A canonical exact non-negative fraction of micro-units per hour. */
export interface ExactMicroRate {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/** All amounts are exact micro-units per hour from the version-pinned content catalog. */
export interface EnergyFacilityInput {
  readonly facilityId: string;
  readonly facilityKind: EnergyFacilityKind;
  readonly priority: number;
  readonly demandEnergyMicro: bigint;
  readonly nominalOutputMicro: bigint;
}

export interface EnergyAllocation {
  readonly facilityId: string;
  readonly facilityKind: EnergyFacilityKind;
  readonly priority: number;
  readonly demandEnergyMicro: bigint;
  readonly allocatedEnergyMicro: bigint;
  /** Allocation / demand; microgrids use the identity ratio 1/1. */
  readonly efficiency: ExactMicroRate;
  /** Never rounded here: P2.4 persists the carry while turning this rate into ledger deltas. */
  readonly actualOutputMicroPerHour: ExactMicroRate;
}

export interface EnergyResolution {
  readonly allocations: readonly EnergyAllocation[];
  readonly consumedEnergyMicro: bigint;
  readonly remainingEnergyMicro: bigint;
}

const SIGNED_64_MIN = -(1n << 63n);
const SIGNED_64_MAX = (1n << 63n) - 1n;

function assertSigned64(value: bigint, name: string): void {
  if (value < SIGNED_64_MIN || value > SIGNED_64_MAX) throw new Error(`${name} exceeds signed 64-bit range.`);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function fraction(numerator: bigint, denominator: bigint): ExactMicroRate {
  if (numerator < 0n || denominator <= 0n) throw new Error("Exact rates must be non-negative with a positive denominator.");
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function compareByPriorityThenId(left: EnergyFacilityInput, right: EnergyFacilityInput): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return left.facilityId < right.facilityId ? -1 : left.facilityId > right.facilityId ? 1 : 0;
}

function compareById(left: EnergyFacilityInput, right: EnergyFacilityInput): number {
  return left.facilityId < right.facilityId ? -1 : left.facilityId > right.facilityId ? 1 : 0;
}

function validateFacility(facility: EnergyFacilityInput, seenIds: Set<string>): void {
  if (!facility.facilityId || seenIds.has(facility.facilityId)) throw new Error("facilityId must be non-empty and unique.");
  seenIds.add(facility.facilityId);
  if (!ENERGY_FACILITY_KINDS.includes(facility.facilityKind)) throw new Error("Unknown facility kind.");
  if (!Number.isInteger(facility.priority) || facility.priority < 1 || facility.priority > 5) throw new Error("priority must be an integer from 1 through 5.");
  assertSigned64(facility.demandEnergyMicro, "demandEnergyMicro");
  assertSigned64(facility.nominalOutputMicro, "nominalOutputMicro");
  if (facility.demandEnergyMicro < 0n || facility.nominalOutputMicro < 0n) throw new Error("Energy quantities must be non-negative.");
  const zeroDemand = facility.demandEnergyMicro === 0n;
  if ((facility.facilityKind === "microgrid") !== zeroDemand) throw new Error("Only microgrids may have zero energy demand.");
}

/**
 * Resolves one fixed hourly energy budget without side effects or input mutation.
 * The caller supplies the already-available energy for the interval (including
 * microgrid production when settling time in P2.4). Exact output rates avoid
 * per-interval rounding drift; the later accrual layer owns carry persistence.
 */
export function reconcileEnergy(availableEnergyMicro: bigint, facilities: readonly EnergyFacilityInput[]): EnergyResolution {
  assertSigned64(availableEnergyMicro, "availableEnergyMicro");
  if (availableEnergyMicro < 0n) throw new Error("availableEnergyMicro must be non-negative.");
  const seenIds = new Set<string>();
  for (const facility of facilities) validateFacility(facility, seenIds);

  const microgrids = facilities.filter((facility) => facility.facilityKind === "microgrid").sort(compareById);
  const consumers = facilities.filter((facility) => facility.facilityKind !== "microgrid").sort(compareByPriorityThenId);
  const allocations: EnergyAllocation[] = microgrids.map((facility) => ({
    facilityId: facility.facilityId, facilityKind: facility.facilityKind, priority: facility.priority,
    demandEnergyMicro: 0n, allocatedEnergyMicro: 0n, efficiency: fraction(1n, 1n),
    actualOutputMicroPerHour: fraction(facility.nominalOutputMicro, 1n),
  }));
  let remaining = availableEnergyMicro;
  for (const facility of consumers) {
    const allocatedEnergyMicro = facility.demandEnergyMicro < remaining ? facility.demandEnergyMicro : remaining;
    allocations.push({
      facilityId: facility.facilityId, facilityKind: facility.facilityKind, priority: facility.priority,
      demandEnergyMicro: facility.demandEnergyMicro, allocatedEnergyMicro,
      efficiency: fraction(allocatedEnergyMicro, facility.demandEnergyMicro),
      actualOutputMicroPerHour: fraction(facility.nominalOutputMicro * allocatedEnergyMicro, facility.demandEnergyMicro),
    });
    remaining -= allocatedEnergyMicro;
  }
  return { allocations, consumedEnergyMicro: availableEnergyMicro - remaining, remainingEnergyMicro: remaining };
}
