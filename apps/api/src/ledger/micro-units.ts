const MICRO_UNIT = /^-?(?:0|[1-9][0-9]*)$/;

/** Parses a signed integer micro-unit amount before it reaches the immutable ledger. */
export function parseMicroUnits(value: string): bigint {
  if (!MICRO_UNIT.test(value)) throw new Error("Ledger amounts must be signed integer micro-units.");
  const amount = BigInt(value);
  if (amount === 0n) throw new Error("Ledger amounts cannot be zero.");
  return amount;
}
