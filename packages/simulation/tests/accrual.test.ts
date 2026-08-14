import { accrueExactRate, accrueWithCanonicalCarry, cappedElapsedMs, emptyAccrualCarry } from "../src/index";

const rate = { numerator: 32_000_000n, denominator: 9n };
const one = accrueExactRate(rate, 86_400_000n, emptyAccrualCarry(rate));
const eight = accrueExactRate(rate, 28_800_000n, emptyAccrualCarry(rate));
const sixteen = accrueExactRate(rate, 57_600_000n, eight.carry);
if (one.producedMicro !== 85_333_333n || one.carry.numerator !== 10_800_000n || one.carry.denominator !== 32_400_000n || sixteen.producedMicro + eight.producedMicro !== one.producedMicro || sixteen.carry.numerator !== one.carry.numerator) throw new Error("Exact accrual split invariance failed.");
if (cappedElapsedMs(0n, 48n * 3_600_000n, 240) !== 24n * 3_600_000n || cappedElapsedMs(10n, 5n, 240) !== 0n) throw new Error("Storage elapsed cap is wrong.");
let propertyState = 0x20400008;
for (let index = 0; index < 256; index += 1) {
  propertyState = (Math.imul(propertyState, 1_664_525) + 1_013_904_223) >>> 0;
  const last = BigInt(propertyState % 1_000_000);
  propertyState = (Math.imul(propertyState, 1_664_525) + 1_013_904_223) >>> 0;
  const asOf = BigInt(propertyState % 1_000_000);
  const storageTenths = 240 + propertyState % 121;
  const elapsed = cappedElapsedMs(last, asOf, storageTenths);
  if (elapsed < 0n || elapsed > BigInt(storageTenths) * 360_000n || (asOf <= last && elapsed !== 0n)) throw new Error("Generated storage-cap property failed.");
}
const high = { numerator: 523_000_875_946_378_408n, denominator: 432_314_817n };
const highAccrual = accrueExactRate(high, 129_600_000n, emptyAccrualCarry(high));
if (highAccrual.producedMicro !== 43_551_668_352n || highAccrual.carry.numerator !== 1_548_183_974_400_000n) throw new Error("Overflow-safe accrual decomposition is wrong.");
const firstRate = { numerator: 32_000_000n, denominator: 9n };
const secondRate = { numerator: 16_000_000n, denominator: 9n };
const firstTransition = accrueWithCanonicalCarry(firstRate, 3_600_000n, { numerator: 0n, denominator: 1n });
const secondTransition = accrueWithCanonicalCarry(secondRate, 3_600_000n, firstTransition.carry);
if (firstTransition.producedMicro + secondTransition.producedMicro !== 5_333_333n || secondTransition.carry.numerator !== 1n || secondTransition.carry.denominator !== 3n) throw new Error("Cross-rate carry conservation failed.");
console.log("PASS: exact lazy-accrual carry and storage cap.");
