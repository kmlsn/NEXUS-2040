#!/usr/bin/env python3
"""Dependency-free P2.3 reference verification for exact energy allocation."""
import json
import math
from pathlib import Path

fixture = json.loads((Path(__file__).resolve().parents[1] / "packages" / "simulation" / "fixtures" / "energy-v1.json").read_text(encoding="utf-8"))
VALID_KINDS = {"microgrid", "data_center", "robotics_workshop", "research_lab", "security_operations_center"}
MAX = (1 << 63) - 1

def resolve(available: int, facilities: list[dict]) -> list[dict]:
    if not 0 <= available <= MAX:
        raise ValueError("invalid available energy")
    seen: set[str] = set()
    for facility in facilities:
        if not facility["facility_id"] or facility["facility_id"] in seen or facility["facility_kind"] not in VALID_KINDS:
            raise ValueError("invalid facility")
        seen.add(facility["facility_id"])
        if not 1 <= facility["priority"] <= 5:
            raise ValueError("invalid priority")
    grids = sorted((f for f in facilities if f["facility_kind"] == "microgrid"), key=lambda f: f["facility_id"])
    consumers = sorted((f for f in facilities if f["facility_kind"] != "microgrid"), key=lambda f: (f["priority"], f["facility_id"]))
    result: list[dict] = []
    remaining = available
    for facility in grids + consumers:
        demand = int(facility["demand_micro"])
        nominal = int(facility["nominal_output_micro"])
        if not 0 <= nominal <= MAX or demand < 0 or demand > MAX:
            raise ValueError("invalid quantities")
        if facility["facility_kind"] == "microgrid":
            if demand != 0:
                raise ValueError("microgrid demand")
            result.append({"facility_id": facility["facility_id"], "allocated_micro": 0, "output_numerator": nominal, "output_denominator": 1})
            continue
        if demand == 0:
            raise ValueError("consumer demand")
        allocation = min(demand, remaining)
        remaining -= allocation
        numerator = nominal * allocation
        if numerator == 0:
            result.append({"facility_id": facility["facility_id"], "allocated_micro": allocation, "output_numerator": 0, "output_denominator": 1})
            continue
        divisor = math.gcd(numerator, demand) if numerator else 1
        result.append({"facility_id": facility["facility_id"], "allocated_micro": allocation, "output_numerator": numerator // divisor, "output_denominator": demand // divisor})
    return result

for case in fixture["cases"]:
    facilities = [{**facility, "demand_micro": int(facility["demand_micro"]), "nominal_output_micro": int(facility["nominal_output_micro"])} for facility in case["facilities"]]
    actual = resolve(int(case["available_energy_micro"]), facilities)
    expected = [{**row, "allocated_micro": int(row["allocated_micro"]), "output_numerator": int(row["output_numerator"]), "output_denominator": int(row["output_denominator"])} for row in case["expected"]]
    assert actual == expected, case["name"]
print("PASS: Python exact energy fixture matches P2.3.")
