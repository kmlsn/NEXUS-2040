import { facilityLevel, type FacilityKind } from "@nexus/content";
import type { CenterSnapshot } from "@nexus/contracts";
import { reconcileEnergy, type EnergyFacilityInput } from "@nexus/simulation";
import type { Pool } from "pg";

export class CenterService {
  constructor(private readonly pool: Pool) {}

  async snapshot(profileId: string, nowMs: bigint): Promise<CenterSnapshot | undefined> {
    const profile = await this.pool.query<{ content_version: string; formula_version: string }>("SELECT content_version, formula_version FROM profiles WHERE id=$1", [profileId]);
    if (!profile.rows[0]) return undefined;
    const [balances, facilities, reasons] = await Promise.all([
      this.pool.query<{ resource: string; balance_micro: string }>("SELECT resource, balance_micro::text FROM resource_balances WHERE profile_id=$1 ORDER BY resource", [profileId]),
      this.pool.query<{ id: string; facility_kind: FacilityKind; level: number; energy_priority: number }>("SELECT id, facility_kind, level, energy_priority FROM profile_facilities WHERE profile_id=$1 ORDER BY id", [profileId]),
      this.pool.query<{ resource: string; reason_code: string }>("SELECT DISTINCT ON (resource) resource, reason_code FROM resource_ledger_entries WHERE profile_id=$1 ORDER BY resource, id DESC", [profileId]),
    ]);
    const inputs: EnergyFacilityInput[] = facilities.rows.map((facility) => {
      const definition = facilityLevel(facility.facility_kind, facility.level);
      return { facilityId: facility.id, facilityKind: facility.facility_kind, priority: facility.energy_priority, demandEnergyMicro: BigInt(definition.energyDemandPerHourMicro), nominalOutputMicro: BigInt(definition.output.perHourMicro) };
    });
    const energyBalance = BigInt(balances.rows.find((balance) => balance.resource === "energy")?.balance_micro ?? "0");
    const grid = inputs.filter((input) => input.facilityKind === "microgrid").reduce((total, input) => total + input.nominalOutputMicro, 0n);
    const energy = reconcileEnergy(grid + energyBalance, inputs);
    const demand = inputs.filter((input) => input.facilityKind !== "microgrid").reduce((total, input) => total + input.demandEnergyMicro, 0n);
    const constrained = energy.allocations.some((allocation) => allocation.facilityKind !== "microgrid" && allocation.allocatedEnergyMicro < allocation.demandEnergyMicro);
    const status = demand === 0n ? "sufficient" : constrained ? (grid + energyBalance === 0n ? "offline" : "constrained") : "sufficient";
    const reasonByResource = new Map(reasons.rows.map((reason) => [reason.resource, reason.reason_code]));
    const facilityById = new Map(facilities.rows.map((facility) => [facility.id, facility]));
    return {
      asOfMs: nowMs.toString(),
      contentVersion: profile.rows[0].content_version,
      formulaVersion: profile.rows[0].formula_version,
      resources: balances.rows.map((balance) => {
        const latestReason = reasonByResource.get(balance.resource);
        return latestReason ? { kind: balance.resource, balanceMicro: balance.balance_micro, lastReason: latestReason } : { kind: balance.resource, balanceMicro: balance.balance_micro };
      }),
      facilities: energy.allocations.map((allocation) => {
        const facility = facilityById.get(allocation.facilityId);
        if (!facility) throw new Error("Center facility snapshot is incomplete.");
        return {
          id: allocation.facilityId,
          kind: allocation.facilityKind,
          level: facility.level,
          priority: facility.energy_priority,
          estimateMicroPerHour: { numerator: allocation.actualOutputMicroPerHour.numerator.toString(), denominator: allocation.actualOutputMicroPerHour.denominator.toString() },
        };
      }),
      energy: {
        status,
        availableMicroPerHour: (grid + energyBalance).toString(),
        demandMicroPerHour: demand.toString(),
        explanation: status === "sufficient" ? "Enerji talebi bu an için karşılanıyor." : status === "offline" ? "Enerji kaynağı yok; tüketen tesisler üretim yapmıyor." : "Enerji kısıtlı; tahminler öncelik sırasına göre azaltıldı.",
      },
    };
  }
}
