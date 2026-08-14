const MICRO_UNIT = /^-?(?:0|[1-9][0-9]*)$/;
const RESOURCE_UNITS = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

export const MICRO_UNITS_PER_RESOURCE = 1_000_000n;
export const POSTGRES_BIGINT_MIN = -(1n << 63n);
export const POSTGRES_BIGINT_MAX = (1n << 63n) - 1n;

export function assertPostgresBigInt(value: bigint): bigint {
  if (value < POSTGRES_BIGINT_MIN || value > POSTGRES_BIGINT_MAX) throw new Error("Ledger amount exceeds PostgreSQL bigint range.");
  return value;
}

/** Parses a signed integer micro-unit amount before it reaches the immutable ledger. */
export function parseMicroUnits(value: string): bigint {
  if (!MICRO_UNIT.test(value)) throw new Error("Ledger amounts must be signed integer micro-units.");
  const amount = assertPostgresBigInt(BigInt(value));
  if (amount === 0n) throw new Error("Ledger amounts cannot be zero.");
  return amount;
}

/** Converts a canonical decimal resource quantity once, using half-away-from-zero rounding. */
export function resourceUnitsToMicro(value: string): bigint {
  if (!RESOURCE_UNITS.test(value)) throw new Error("Resource units must be a canonical decimal string.");
  const negative = value.startsWith("-");
  const [wholeText, fractionText = ""] = (negative ? value.slice(1) : value).split(".");
  const whole = BigInt(wholeText ?? "0") * MICRO_UNITS_PER_RESOURCE;
  const retained = BigInt((fractionText.slice(0, 6)).padEnd(6, "0"));
  const rounded = fractionText.length > 6 && (fractionText[6] ?? "0") >= "5" ? 1n : 0n;
  const amount = negative ? -(whole + retained + rounded) : whole + retained + rounded;
  const checked = assertPostgresBigInt(amount);
  if (checked === 0n) throw new Error("Resource units round to zero micro-units.");
  return checked;
}
