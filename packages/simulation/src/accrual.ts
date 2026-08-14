import type { ExactMicroRate } from "./energy.js";

export const HOUR_MS = 3_600_000n;
const I64_MAX = (1n << 63n) - 1n;

export interface AccrualCarry { readonly numerator: bigint; readonly denominator: bigint; }
export interface RateAccrual { readonly producedMicro: bigint; readonly carry: AccrualCarry; }

function gcd(left: bigint, right: bigint): bigint { let a = left < 0n ? -left : left; let b = right < 0n ? -right : right; while (b !== 0n) [a, b] = [b, a % b]; return a; }
function normalize(numerator: bigint, denominator: bigint): AccrualCarry {
  if (numerator < 0n || denominator <= 0n) throw new Error("Invalid accrual fraction.");
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

/**
 * Advances an exact micro-per-hour rate without rounding a partial interval.
 * Carry is normalized against `rate.denominator * HOUR_MS`; persisting it makes
 * a long elapsed interval exactly equal to adjacent intervals at a fixed rate.
 */
export function accrueExactRate(rate: ExactMicroRate, elapsedMs: bigint, carry: AccrualCarry): RateAccrual {
  if (rate.numerator < 0n || rate.denominator <= 0n || elapsedMs < 0n) throw new Error("Accrual rate and elapsed time must be non-negative.");
  const denominator = rate.denominator * HOUR_MS;
  if (carry.denominator !== denominator || carry.numerator < 0n || carry.numerator >= denominator) throw new Error("Accrual carry does not match the rate.");
  // Split whole hours from the sub-hour portion before multiplication. Content
  // bounds keep every resulting term below signed-64; raw rate*elapsed does not.
  const wholeHours = elapsedMs / HOUR_MS;
  const partialMs = elapsedMs % HOUR_MS;
  const perHourWhole = rate.numerator / rate.denominator;
  const perHourRemainder = rate.numerator % rate.denominator;
  const wholeOutput = perHourWhole * wholeHours + (perHourRemainder * wholeHours) / rate.denominator;
  const wholeRemainder = (perHourRemainder * wholeHours) % rate.denominator;
  const perHourPartialWhole = perHourWhole / HOUR_MS;
  const perHourPartialRemainder = perHourWhole % HOUR_MS;
  const partialOutput = perHourPartialWhole * partialMs + (perHourPartialRemainder * partialMs) / HOUR_MS;
  const partialRemainder = (perHourPartialRemainder * partialMs) % HOUR_MS;
  const mixedRemainder = wholeRemainder * HOUR_MS + perHourRemainder * partialMs + partialRemainder * rate.denominator + carry.numerator;
  const producedMicro = wholeOutput + partialOutput + mixedRemainder / denominator;
  if (producedMicro > I64_MAX) throw new Error("Accrual result exceeds PostgreSQL bigint range.");
  return { producedMicro, carry: { numerator: mixedRemainder % denominator, denominator } };
}

export function emptyAccrualCarry(rate: ExactMicroRate): AccrualCarry {
  if (rate.numerator < 0n || rate.denominator <= 0n) throw new Error("Invalid exact rate.");
  return { numerator: 0n, denominator: rate.denominator * HOUR_MS };
}

/** Accrues across a rate boundary, retaining one exact canonical fractional credit. */
export function accrueWithCanonicalCarry(rate: ExactMicroRate, elapsedMs: bigint, carry: AccrualCarry): RateAccrual {
  if (carry.numerator < 0n || carry.denominator <= 0n || carry.numerator >= carry.denominator) throw new Error("Invalid canonical accrual carry.");
  const segment = accrueExactRate(rate, elapsedMs, emptyAccrualCarry(rate));
  const segmentDenominator = segment.carry.denominator;
  const sharedDenominator = (carry.denominator / gcd(carry.denominator, segmentDenominator)) * segmentDenominator;
  const combinedNumerator = carry.numerator * (sharedDenominator / carry.denominator) + segment.carry.numerator * (sharedDenominator / segmentDenominator);
  return {
    producedMicro: segment.producedMicro + combinedNumerator / sharedDenominator,
    carry: normalize(combinedNumerator % sharedDenominator, sharedDenominator),
  };
}

export function cappedElapsedMs(lastAccruedMs: bigint, asOfMs: bigint, storageTenthsHours: number): bigint {
  if (!Number.isInteger(storageTenthsHours) || storageTenthsHours < 240 || storageTenthsHours > 360) throw new Error("Storage must be 24-36 hours.");
  if (asOfMs <= lastAccruedMs) return 0n;
  const cap = BigInt(storageTenthsHours) * 360_000n;
  return asOfMs - lastAccruedMs < cap ? asOfMs - lastAccruedMs : cap;
}
