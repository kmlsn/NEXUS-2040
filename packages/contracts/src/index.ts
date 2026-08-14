/** Shared, client-safe vocabulary only; authoritative state remains server-side. */
export type ServiceBoundary = "api" | "worker";

export const WEB_SHELL_TITLE = "NEXUS 2040";

export interface Clock { nowMs(): number; }
export interface UuidGenerator { next(): string; }
export interface HealthResponse { status: "ok"; service: ServiceBoundary; time: string; }
export type ApiErrorCode = "NOT_FOUND" | "INTERNAL_ERROR";
export interface ErrorResponse { error: { code: ApiErrorCode; message: string; requestId: string; }; }
export type CenterEnergyStatus = "sufficient" | "constrained" | "offline";
export interface CenterSnapshot {
  asOfMs: string; contentVersion: string; formulaVersion: string;
  resources: Array<{ kind: string; balanceMicro: string; lastReason?: string; lastDeltaMicro?: string }>;
  facilities: Array<{ id: string; kind: string; level: number; priority: number; estimateMicroPerHour: { numerator: string; denominator: string } }>;
  energy: { status: CenterEnergyStatus; availableMicroPerHour: string; demandMicroPerHour: string; explanation: string };
}

export class FixedClock implements Clock {
  constructor(private readonly value: number) {}
  nowMs(): number { return this.value; }
}

export class SequenceUuidGenerator implements UuidGenerator {
  private index = 0;
  constructor(private readonly values: readonly string[]) {}
  next(): string {
    const value = this.values[this.index++];
    if (!value) throw new Error("UUID sequence is exhausted.");
    return value;
  }
}
