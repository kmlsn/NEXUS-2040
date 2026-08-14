#!/usr/bin/env python3
"""Verify the D-017 decimal-to-micro-unit boundary fixture without dependencies."""
import json
import re
from pathlib import Path

fixture = json.loads((Path(__file__).resolve().parents[1] / "fixtures" / "micro-units-v1.json").read_text(encoding="utf-8"))
SCALE = int(fixture["micro_units_per_resource"])
MIN, MAX = -(1 << 63), (1 << 63) - 1
PATTERN = re.compile(r"^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$")

def convert(value: str) -> int:
    negative = value.startswith("-")
    text = value[1:] if negative else value
    if not PATTERN.fullmatch(value):
        raise ValueError("invalid decimal")
    whole_text, _, fraction = text.partition(".")
    magnitude = int(whole_text) * SCALE + int((fraction[:6]).ljust(6, "0"))
    if len(fraction) > 6 and fraction[6] >= "5":
        magnitude += 1
    amount = -magnitude if negative else magnitude
    if amount == 0 or amount < MIN or amount > MAX:
        raise ValueError("out of range")
    return amount

for case in fixture["cases"]:
    assert str(convert(case["units"])) == case["micro"]
for value in fixture["rejected_units"]:
    try:
        convert(value)
    except ValueError:
        continue
    raise AssertionError(f"Expected rejection: {value}")
print("PASS: Python micro-unit fixture matches D-017.")
