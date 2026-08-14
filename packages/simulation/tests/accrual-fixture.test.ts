import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { accrueExactRate, accrueWithCanonicalCarry, emptyAccrualCarry } from "../src/index";

interface AccrualCase { rate_numerator: string; rate_denominator: string; elapsed_ms: string; carry_numerator: string; expected_micro: string; expected_carry_numerator: string; expected_carry_denominator: string; }
interface Transition { readonly segments: readonly Pick<AccrualCase, "rate_numerator" | "rate_denominator" | "elapsed_ms">[]; readonly expected_micro: string; readonly expected_carry_numerator: string; readonly expected_carry_denominator: string; }
const fixture = JSON.parse(await readFile(resolve(fileURLToPath(new URL("..", import.meta.url)), "fixtures/accrual-v1.json"), "utf8")) as { cases: readonly AccrualCase[]; transitions: readonly Transition[] };
for (const item of fixture.cases) {
  const rate = { numerator: BigInt(item.rate_numerator), denominator: BigInt(item.rate_denominator) };
  const carry = BigInt(item.carry_numerator) === 0n ? emptyAccrualCarry(rate) : { numerator: BigInt(item.carry_numerator), denominator: BigInt(item.expected_carry_denominator) };
  const actual = accrueExactRate(rate, BigInt(item.elapsed_ms), carry);
  if (actual.producedMicro !== BigInt(item.expected_micro) || actual.carry.numerator !== BigInt(item.expected_carry_numerator) || actual.carry.denominator !== BigInt(item.expected_carry_denominator)) throw new Error("Accrual golden fixture mismatch.");
}
for (const item of fixture.transitions) {
  let produced = 0n;
  let carry = { numerator: 0n, denominator: 1n };
  for (const segment of item.segments) {
    const rate = { numerator: BigInt(segment.rate_numerator), denominator: BigInt(segment.rate_denominator) };
    const next = accrueWithCanonicalCarry(rate, BigInt(segment.elapsed_ms), carry);
    produced += next.producedMicro;
    carry = next.carry;
  }
  if (produced !== BigInt(item.expected_micro) || carry.numerator !== BigInt(item.expected_carry_numerator) || carry.denominator !== BigInt(item.expected_carry_denominator)) throw new Error("Canonical accrual transition fixture mismatch.");
}
console.log("PASS: TypeScript exact accrual fixture matches P2.4.");
