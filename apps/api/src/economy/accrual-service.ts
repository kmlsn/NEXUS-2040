import { createHash } from "node:crypto";
import { facilityLevel, type FacilityKind } from "@nexus/content";
import { accrueWithCanonicalCarry, cappedElapsedMs, reconcileEnergy, type AccrualCarry, type EnergyFacilityInput, type ExactMicroRate } from "@nexus/simulation";
import type { Pool, PoolClient } from "pg";
import { PostgresLedgerService, type ResourceDeltas } from "../ledger/ledger-service";

interface FacilityRow {
  id: string; facility_kind: FacilityKind; level: number; energy_priority: number; last_accrued_ms: string;
  output_carry_numerator: string; output_carry_denominator: string; energy_carry_numerator: string; energy_carry_denominator: string;
}

export interface AccrualOutcome { readonly settled: boolean; readonly elapsedMs: bigint; readonly transactionId?: string; readonly deltas: ResourceDeltas; }

function asCarry(numerator: string, denominator: string): AccrualCarry { return { numerator: BigInt(numerator), denominator: BigInt(denominator) }; }
function rateFrom(allocation: { actualOutputMicroPerHour: ExactMicroRate }): ExactMicroRate { return allocation.actualOutputMicroPerHour; }
function resourceFor(kind: FacilityKind): keyof ResourceDeltas | undefined {
  const resources: Partial<Record<FacilityKind, keyof ResourceDeltas>> = { microgrid: "energy", data_center: "compute", robotics_workshop: "components", research_lab: "expertise" };
  return resources[kind];
}

/** Server-only lazy settlement. Callers that compose state changes use settleInTransaction. */
export class LazyAccrualService {
  private readonly ledger: PostgresLedgerService;
  constructor(private readonly pool: Pool) { this.ledger = new PostgresLedgerService(pool); }

  async settle(profileId: string, asOfMs: bigint): Promise<AccrualOutcome> {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const outcome = await this.settleInTransaction(client, profileId, asOfMs); await client.query("COMMIT"); return outcome; }
    catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  /**
   * Settles in a caller-owned transaction. The profile row is locked first so
   * queue and ledger mutations share one global economy lock order.
   */
  async settleInTransaction(client: PoolClient, profileId: string, asOfMs: bigint): Promise<AccrualOutcome> {
    if (asOfMs < 0n) throw new Error("Settlement time must be non-negative.");
    const profile = await client.query("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [profileId]);
    if (profile.rowCount !== 1) throw new Error("Profile does not exist.");
    await client.query("INSERT INTO profile_facility_accrual_state(facility_id) SELECT id FROM profile_facilities WHERE profile_id = $1 ON CONFLICT DO NOTHING", [profileId]);
    const rows = await client.query<FacilityRow>(
      "SELECT f.id, f.facility_kind, f.level, f.energy_priority, (extract(epoch FROM s.last_accrued_at) * 1000)::bigint::text AS last_accrued_ms, s.output_carry_numerator::text, s.output_carry_denominator::text, s.energy_carry_numerator::text, s.energy_carry_denominator::text FROM profile_facilities f JOIN profile_facility_accrual_state s ON s.facility_id = f.id WHERE f.profile_id = $1 ORDER BY f.id FOR UPDATE",
      [profileId],
    );
    if (rows.rowCount === 0) return { settled: false, elapsedMs: 0n, deltas: {} };
    const startMs = rows.rows.reduce((minimum, row) => { const value = BigInt(row.last_accrued_ms); return value < minimum ? value : minimum; }, asOfMs);
    if (asOfMs <= startMs) return { settled: false, elapsedMs: 0n, deltas: {} };
    const balance = await client.query<{ balance_micro: string }>("SELECT balance_micro::text FROM resource_balances WHERE profile_id = $1 AND resource = 'energy' FOR UPDATE", [profileId]);
    let availableEnergy = BigInt(balance.rows[0]?.balance_micro ?? "0");
    const state = new Map(rows.rows.map((row) => [row.id, { outputCarry: asCarry(row.output_carry_numerator, row.output_carry_denominator), energyCarry: asCarry(row.energy_carry_numerator, row.energy_carry_denominator) }]));
    const deltas = new Map<keyof ResourceDeltas, bigint>();
    let elapsedMax = 0n;
    const windows = new Map(rows.rows.map((row) => [row.id, cappedElapsedMs(BigInt(row.last_accrued_ms), asOfMs, facilityLevel(row.facility_kind, row.level).storageTenthsHours)]));
    for (const elapsed of windows.values()) if (elapsed > elapsedMax) elapsedMax = elapsed;
    for (let offset = 0n; offset < elapsedMax;) {
      const active = rows.rows.filter((row) => (windows.get(row.id) ?? 0n) >= elapsedMax - offset);
      const nextStart = rows.rows.map((row) => elapsedMax - (windows.get(row.id) ?? 0n)).filter((start) => start > offset)
        .reduce<bigint | undefined>((minimum, start) => minimum === undefined || start < minimum ? start : minimum, undefined);
      const untilBoundary = nextStart === undefined ? elapsedMax - offset : nextStart - offset;
      const duration = untilBoundary < 3_600_000n ? untilBoundary : 3_600_000n;
      const inputs: EnergyFacilityInput[] = active.map((row) => {
        const definition = facilityLevel(row.facility_kind, row.level);
        return { facilityId: row.id, facilityKind: row.facility_kind, priority: row.energy_priority, demandEnergyMicro: BigInt(definition.energyDemandPerHourMicro), nominalOutputMicro: BigInt(definition.output.perHourMicro) };
      });
      const totalDemand = inputs.filter((input) => input.facilityKind !== "microgrid").reduce((sum, input) => sum + input.demandEnergyMicro, 0n);
      const gridRate = inputs.filter((input) => input.facilityKind === "microgrid").reduce((sum, input) => sum + input.nominalOutputMicro, 0n);
      const energyNeeded = (totalDemand * duration + 3_600_000n - 1n) / 3_600_000n;
      const bankRate = availableEnergy >= energyNeeded ? totalDemand : (availableEnergy / duration) * 3_600_000n + ((availableEnergy % duration) * 3_600_000n) / duration;
      const resolution = reconcileEnergy(gridRate + bankRate, inputs);
      for (const allocation of resolution.allocations) {
        const row = active.find((item) => item.id === allocation.facilityId);
        if (!row) throw new Error("Missing active facility.");
        const local = state.get(row.id);
        if (!local) throw new Error("Missing accrual state.");
        const output = accrueWithCanonicalCarry(rateFrom(allocation), duration, local.outputCarry);
        const consumptionRate: ExactMicroRate = { numerator: allocation.allocatedEnergyMicro, denominator: 1n };
        const consumption = row.facility_kind === "microgrid" ? { producedMicro: 0n, carry: local.energyCarry } : accrueWithCanonicalCarry(consumptionRate, duration, local.energyCarry);
        local.outputCarry = output.carry; local.energyCarry = consumption.carry;
        const resource = resourceFor(row.facility_kind);
        if (resource && output.producedMicro > 0n) deltas.set(resource, (deltas.get(resource) ?? 0n) + output.producedMicro);
        if (consumption.producedMicro > 0n) deltas.set("energy", (deltas.get("energy") ?? 0n) - consumption.producedMicro);
        if (row.facility_kind === "microgrid") availableEnergy += output.producedMicro; else availableEnergy -= consumption.producedMicro;
        if (availableEnergy < 0n) throw new Error("Energy settlement exceeded the available balance.");
      }
      offset += duration;
    }
    for (const row of rows.rows) {
      const local = state.get(row.id);
      if (!local) throw new Error("Missing persisted accrual state.");
      await client.query("UPDATE profile_facility_accrual_state SET last_accrued_at = to_timestamp($2::double precision / 1000), output_carry_numerator = $3, output_carry_denominator = $4, energy_carry_numerator = $5, energy_carry_denominator = $6 WHERE facility_id = $1", [row.id, asOfMs.toString(), local.outputCarry.numerator.toString(), local.outputCarry.denominator.toString(), local.energyCarry.numerator.toString(), local.energyCarry.denominator.toString()]);
    }
    const serialized = Object.fromEntries([...deltas.entries()].filter(([, value]) => value !== 0n).map(([key, value]) => [key, value.toString()])) as ResourceDeltas;
    if (Object.keys(serialized).length === 0) return { settled: false, elapsedMs: elapsedMax, deltas: {} };
    const key = createHash("sha256").update(`${profileId}|${startMs}|${asOfMs}`, "utf8").digest("hex");
    const outcome = await this.ledger.applyInTransaction(client, { profileId, scope: "accrual", idempotencyKey: key, reason: "accrual_settlement", deltas: serialized });
    return { settled: !outcome.replayed, elapsedMs: elapsedMax, transactionId: outcome.transactionId, deltas: serialized };
  }
}
