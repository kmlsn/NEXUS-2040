import type { ServiceBoundary } from "@nexus/contracts";
import { createHash } from "node:crypto";

export * from "./energy.js";
export * from "./accrual.js";
export * from "./world.js";

const U64_MASK = (1n << 64n) - 1n;
const U32_RANGE = 2 ** 32;
const MULTIPLIER = 6364136223846793005n;

function u64(value: bigint): bigint { return value & U64_MASK; }
function bytesToLe64(bytes: Uint8Array): bigint {
  return bytes.reduce((value, byte, index) => value | (BigInt(byte) << BigInt(index * 8)), 0n);
}

export function roundHalfAway(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.sign(value) * Math.floor(Math.abs(value) * factor + 0.5) / factor;
}

export function probabilityThreshold(probability: number): number {
  const quantized = roundHalfAway(Math.max(0, Math.min(1, probability)), 9);
  return Math.max(0, Math.min(U32_RANGE, Math.floor(quantized * U32_RANGE)));
}

export class Pcg32 {
  private state = 0n;
  private readonly increment: bigint;
  constructor(seed: bigint, stream: bigint) {
    this.increment = u64((stream << 1n) | 1n);
    this.nextUint32(); this.state = u64(this.state + seed); this.nextUint32();
  }
  nextUint32(): number {
    const old = this.state; this.state = u64(old * MULTIPLIER + this.increment);
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rotation = Number((old >> 59n) & 31n);
    return ((xorshifted >>> rotation) | (xorshifted << ((-rotation) & 31))) >>> 0;
  }
  uniform(): number { return (this.nextUint32() + 0.5) / U32_RANGE; }
  normalClt(): number { let total = 0; for (let index = 0; index < 12; index += 1) total += this.uniform(); return total - 6; }
}

export function deterministicRng(formulaVersion: string, contentVersion: string, masterSeed: bigint, streamId: string): Pcg32 {
  if (masterSeed < 0n || masterSeed > U64_MASK) throw new Error("masterSeed must be an unsigned 64-bit integer.");
  const digest = createHash("sha256").update(`${formulaVersion}|${contentVersion}|${masterSeed}|${streamId}`, "utf8").digest();
  return new Pcg32(bytesToLe64(digest.slice(0, 8)), bytesToLe64(digest.slice(8, 16)));
}

export type SimulationAuthority = Extract<ServiceBoundary, "api" | "worker">;
