#!/usr/bin/env python3
"""Dependency-free D-029 fixed-point market fixture verification."""
import json
from pathlib import Path

fixture = json.loads((Path(__file__).resolve().parents[1] / "packages" / "simulation" / "fixtures" / "market-v1.json").read_text(encoding="utf-8"))

def advance(previous: int, shock: int) -> int:
    if not 8500 <= previous <= 11500:
        raise ValueError("market index outside corridor")
    numerator = 1_000_000 + 72 * (previous - 10_000) + 100 * shock
    numerator = max(850_000, min(1_150_000, numerator))
    return (numerator + 50) // 100

assert fixture["formula_version"] == "balance-1.2"
assert fixture["scale"] == 10_000
for case in fixture["cases"]:
    assert advance(case["previous"], case["shock"]) == case["expected"], case
print("PASS: Python fixed-point market fixture matches D-029.")
