#!/usr/bin/env python3
"""Dependency-free P2.4 exact carry and storage reference verifier."""
import json
from pathlib import Path

HOUR_MS = 3_600_000
MAX = (1 << 63) - 1
fixture = json.loads((Path(__file__).resolve().parents[1] / "packages" / "simulation" / "fixtures" / "accrual-v1.json").read_text(encoding="utf-8"))

def accrue(n: int, d: int, elapsed: int, carry: int) -> tuple[int, int, int]:
    denominator = d * HOUR_MS
    if n < 0 or d <= 0 or elapsed < 0 or not 0 <= carry < denominator:
        raise ValueError("invalid exact accrual")
    # Decompose the interval before multiplication.  This is deliberately the
    # same bounded integer arithmetic as the TypeScript solver: a valid content
    # rate multiplied by a 36-hour window can exceed a signed 64-bit
    # intermediate even though its normalized ledger result cannot.
    whole_hours, partial_ms = divmod(elapsed, HOUR_MS)
    per_hour_whole, per_hour_remainder = divmod(n, d)
    whole_output = per_hour_whole * whole_hours + (per_hour_remainder * whole_hours) // d
    whole_remainder = (per_hour_remainder * whole_hours) % d
    partial_whole, partial_remainder_rate = divmod(per_hour_whole, HOUR_MS)
    partial_output = partial_whole * partial_ms + (partial_remainder_rate * partial_ms) // HOUR_MS
    partial_remainder = (partial_remainder_rate * partial_ms) % HOUR_MS
    mixed_remainder = whole_remainder * HOUR_MS + per_hour_remainder * partial_ms + partial_remainder * d + carry
    produced, residue = divmod(mixed_remainder, denominator)
    produced += whole_output + partial_output
    if produced > MAX:
        raise ValueError("overflow")
    return produced, residue, denominator

def gcd(left: int, right: int) -> int:
    while right:
        left, right = right, left % right
    return abs(left)

def accrue_canonical(segments: list[dict]) -> tuple[int, int, int]:
    produced = 0
    carry_numerator, carry_denominator = 0, 1
    for segment in segments:
        whole, residue, denominator = accrue(
            int(segment["rate_numerator"]), int(segment["rate_denominator"]), int(segment["elapsed_ms"]), 0,
        )
        shared = carry_denominator // gcd(carry_denominator, denominator) * denominator
        combined = carry_numerator * (shared // carry_denominator) + residue * (shared // denominator)
        produced += whole + combined // shared
        carry_numerator, carry_denominator = divmod(combined, shared)[1], shared
        if carry_numerator == 0:
            carry_denominator = 1
        else:
            divisor = gcd(carry_numerator, carry_denominator)
            carry_numerator //= divisor
            carry_denominator //= divisor
    return produced, carry_numerator, carry_denominator

for case in fixture["cases"]:
    actual = accrue(int(case["rate_numerator"]), int(case["rate_denominator"]), int(case["elapsed_ms"]), int(case["carry_numerator"]))
    expected = (int(case["expected_micro"]), int(case["expected_carry_numerator"]), int(case["expected_carry_denominator"]))
    assert actual == expected, case["name"]
for case in fixture["storage_cases"]:
    elapsed = max(0, int(case["as_of_ms"]) - int(case["last_ms"]))
    cap = int(case["storage_tenths_hours"]) * 360_000
    assert min(elapsed, cap) == int(case["expected_elapsed_ms"])
for case in fixture["transitions"]:
    actual = accrue_canonical(case["segments"])
    expected = (int(case["expected_micro"]), int(case["expected_carry_numerator"]), int(case["expected_carry_denominator"]))
    assert actual == expected, case["name"]
print("PASS: Python exact accrual fixture matches P2.4.")
