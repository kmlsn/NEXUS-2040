from __future__ import annotations

import json
import hashlib
import math
import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "docs" / "assets"
OUTPUT_JSON = ROOT / "docs" / "balance_results_v1.1.json"
SEED = 20260809
N_SIM = 100_000
FORMULA_VERSION = "balance-1.2"
CONTENT_VERSION = "asteria-baseline-0.2"
MARKET_CORRIDOR = (0.85, 1.15)
WORLD_CYCLE_HOURS = 6
NPC_FORGETTING_RATE = 0.25
NODE_NEUTRAL_SCORE = 50.0
NODE_MAX_BONUS_PP = 0.10
UINT32_RANGE = 1 << 32
UINT64_MASK = (1 << 64) - 1
MICRO_UNITS_PER_RESOURCE = 1_000_000
POSTGRES_BIGINT_MIN = -(1 << 63)
POSTGRES_BIGINT_MAX = (1 << 63) - 1
RESOURCE_UNITS_PATTERN = re.compile(r"^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$")


def resource_units_to_micro(value: str) -> int:
    """D-017 exact decimal conversion; never route ledger values through float."""
    if not RESOURCE_UNITS_PATTERN.fullmatch(value):
        raise ValueError("invalid resource decimal")
    try:
        units = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("invalid resource decimal") from exc
    if not units.is_finite():
        raise ValueError("invalid resource decimal")
    magnitude = int((abs(units) * Decimal(MICRO_UNITS_PER_RESOURCE)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    amount = -magnitude if units.is_signed() else magnitude
    if amount == 0 or amount < POSTGRES_BIGINT_MIN or amount > POSTGRES_BIGINT_MAX:
        raise ValueError("resource micro-unit out of PostgreSQL bigint range")
    return amount


def round_half_away(value: float, digits: int = 0) -> float:
    factor = 10**digits
    magnitude = math.floor(abs(value) * factor + 0.5) / factor
    return math.copysign(magnitude, value)


def probability_threshold(probability: float) -> int:
    quantized = round_half_away(clamp(0.0, 1.0, probability), 9)
    return min(UINT32_RANGE, max(0, math.floor(quantized * UINT32_RANGE)))


class PCG32:
    """PCG-XSH-RR with explicit 64-bit wrapping for cross-runtime replay."""

    def __init__(self, seed: int, stream: int) -> None:
        self.state = 0
        self.increment = ((stream << 1) | 1) & UINT64_MASK
        self.next_uint32()
        self.state = (self.state + seed) & UINT64_MASK
        self.next_uint32()

    def next_uint32(self) -> int:
        old_state = self.state
        self.state = (old_state * 6364136223846793005 + self.increment) & UINT64_MASK
        xorshifted = (((old_state >> 18) ^ old_state) >> 27) & 0xFFFFFFFF
        rotation = (old_state >> 59) & 31
        return ((xorshifted >> rotation) | (xorshifted << ((-rotation) & 31))) & 0xFFFFFFFF

    def uniform(self) -> float:
        return (self.next_uint32() + 0.5) / UINT32_RANGE

    def normal_clt(self) -> float:
        return sum(self.uniform() for _ in range(12)) - 6.0


def deterministic_rng(master_seed: int, stream_id: str) -> PCG32:
    material = f"{FORMULA_VERSION}|{CONTENT_VERSION}|{master_seed}|{stream_id}".encode("utf-8")
    digest = hashlib.sha256(material).digest()
    seed = int.from_bytes(digest[:8], "little")
    stream = int.from_bytes(digest[8:16], "little")
    return PCG32(seed, stream)


def clamp(low: float, high: float, value: float) -> float:
    return max(low, min(high, value))


def sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def effective_stat(raw: float) -> float:
    """Stats above 60 retain value but have diminishing marginal returns."""
    return raw if raw <= 60 else 60 + 0.55 * (raw - 60)


@dataclass(frozen=True)
class PlayerProfile:
    name: str
    recon: float
    access: float
    control: float
    stealth: float
    analysis: float
    tool_points: float
    cover_points: float
    intel_units: int
    heat: float
    score_mean: float
    score_sd: float


@dataclass(frozen=True)
class TargetTier:
    tier: int
    label: str
    hardening: float
    monitoring: float
    segmentation: float
    resilience: float
    noise: float
    compute_cost: int
    energy_cost: int
    base_capital: int
    base_evidence: int


@dataclass(frozen=True)
class FacilitySpec:
    name: str
    output_kind: str
    base_output_per_hour: float
    base_capital_cost: int
    base_component_cost: int
    base_time_minutes: float


PLAYERS = [
    PlayerProfile("Çırak", 38, 36, 34, 42, 36, 4, 2, 1, 10, 55, 15),
    PlayerProfile("Operatör", 48, 46, 44, 52, 46, 6, 4, 2, 12, 58, 14),
    PlayerProfile("Uzman", 58, 56, 55, 62, 58, 7, 6, 2, 14, 60, 13),
    PlayerProfile("Kıdemli", 68, 66, 65, 71, 68, 8, 8, 3, 16, 62, 12),
    PlayerProfile("Elit", 78, 77, 75, 81, 78, 10, 10, 4, 18, 65, 11),
]


TARGETS = [
    TargetTier(1, "Yerel düğüm", 30, 25, 20, 25, 6, 120, 18, 180, 5),
    TargetTier(2, "Kurumsal ağ", 42, 36, 32, 38, 8, 260, 36, 360, 9),
    TargetTier(3, "Sektörel omurga", 54, 50, 46, 50, 10, 520, 68, 680, 15),
    TargetTier(4, "Kritik hizmet", 66, 63, 60, 64, 12, 900, 110, 1200, 24),
    TargetTier(5, "Otonom çekirdek", 78, 76, 73, 80, 14, 1400, 165, 2000, 36),
]


FACILITIES = [
    FacilitySpec("Mikro Şebeke", "Enerji", 90, 220, 12, 1.5),
    FacilitySpec("Veri Merkezi", "İşlem Gücü", 150, 260, 18, 2.0),
    FacilitySpec("Robotik Atölye", "Bileşen", 18, 320, 8, 2.5),
    FacilitySpec("Araştırma Laboratuvarı", "Uzmanlık", 8, 340, 22, 3.0),
    FacilitySpec("Güvenlik Operasyon Merkezi", "Isı Azaltımı", 0.9, 380, 26, 3.0),
]

ENERGY_BASE_DEMANDS = {
    "Veri Merkezi": 70.0,
    "Robotik Atölye": 35.0,
    "Araştırma Laboratuvarı": 45.0,
    "Güvenlik Operasyon Merkezi": 30.0,
}

LOADOUT_MODES = {
    "silent": {"support": 0.0, "detection_delta": -0.05, "reward_multiplier": 0.95, "heat_delta": -2},
    "balanced": {"support": 0.0, "detection_delta": 0.0, "reward_multiplier": 1.0, "heat_delta": 0},
    "fast": {"support": 0.08, "detection_delta": 0.08, "reward_multiplier": 1.05, "heat_delta": 4},
}


ATTACK_WEIGHTS = {
    "recon": 0.22,
    "access": 0.24,
    "control": 0.20,
    "stealth": 0.20,
    "analysis": 0.14,
}
DEFENSE_WEIGHTS = {
    "hardening": 0.28,
    "monitoring": 0.28,
    "segmentation": 0.22,
    "resilience": 0.22,
}


def attack_rating(player: PlayerProfile) -> float:
    values = {
        "recon": effective_stat(player.recon),
        "access": effective_stat(player.access),
        "control": effective_stat(player.control),
        "stealth": effective_stat(player.stealth),
        "analysis": effective_stat(player.analysis),
    }
    return sum(values[key] * weight for key, weight in ATTACK_WEIGHTS.items())


def defense_rating(target: TargetTier) -> float:
    return sum(getattr(target, key) * weight for key, weight in DEFENSE_WEIGHTS.items())


def intel_bonus(intel_units: int) -> float:
    return 0.18 * math.log1p(clamp(0, 5, intel_units))


def node_probability_delta(score: float) -> float:
    """Node Routing changes success by at most +/-10 percentage points from neutral."""
    return clamp(-NODE_MAX_BONUS_PP, NODE_MAX_BONUS_PP, (score - NODE_NEUTRAL_SCORE) / 500)


def success_probability(
    player: PlayerProfile,
    target: TargetTier,
    score: float = 50,
    support_bonus: float = 0.0,
) -> float:
    heat_penalty = max(0.0, player.heat - 40) * 0.006
    z = (
        (attack_rating(player) + player.tool_points - defense_rating(target)) / 11
        + intel_bonus(player.intel_units)
        + support_bonus
        - heat_penalty
    )
    base_probability = 0.08 + 0.84 * sigmoid(z)
    return clamp(0.08, 0.92, base_probability + node_probability_delta(score))


def detection_probability(player: PlayerProfile, target: TargetTier, score: float = 50) -> float:
    score_noise_delta = 6 - 0.12 * score
    z = (
        target.monitoring
        + target.noise
        + score_noise_delta
        + 0.25 * player.heat
        - effective_stat(player.stealth)
        - player.cover_points
    ) / 12
    return 0.03 + 0.55 * sigmoid(z)


def reward_quality(success_p: float, score: float) -> float:
    return clamp(0.65, 1.15, 0.80 + 0.20 * success_p + 0.003 * (score - 50))


def simulate_pair(player: PlayerProfile, target: TargetTier, n: int = N_SIM) -> dict:
    stream_base = f"pair:{player.name}:tier-{target.tier}:n-{n}"
    score_rng = deterministic_rng(SEED, f"{stream_base}:score")
    success_rng = deterministic_rng(SEED, f"{stream_base}:success")
    detection_rng = deterministic_rng(SEED, f"{stream_base}:detection")
    reward_rng = deterministic_rng(SEED, f"{stream_base}:reward")
    scores = np.fromiter(
        (
            clamp(0, 100, player.score_mean + player.score_sd * score_rng.normal_clt())
            for _ in range(n)
        ),
        dtype=float,
        count=n,
    )
    success_ps = np.array([success_probability(player, target, float(s)) for s in scores])
    detection_ps = np.array([detection_probability(player, target, float(s)) for s in scores])
    success_draws = np.fromiter(
        (success_rng.next_uint32() for _ in range(n)), dtype=np.uint64, count=n
    )
    detection_draws = np.fromiter(
        (detection_rng.next_uint32() for _ in range(n)), dtype=np.uint64, count=n
    )
    success_thresholds = np.array([probability_threshold(float(p)) for p in success_ps], dtype=np.uint64)
    detection_thresholds = np.array(
        [probability_threshold(float(p)) for p in detection_ps], dtype=np.uint64
    )
    successes = success_draws < success_thresholds
    detected = detection_draws < detection_thresholds
    qualities = np.array([reward_quality(float(p), float(s)) for p, s in zip(success_ps, scores)])
    reward_jitter = np.fromiter(
        (0.92 + 0.16 * reward_rng.uniform() for _ in range(n)), dtype=float, count=n
    )
    stealth_mult = np.where(detected, 0.72, 1.0)
    rewards = target.base_capital * qualities * stealth_mult * reward_jitter * successes
    success_evidence = target.base_evidence * qualities * stealth_mult * reward_jitter
    failure_evidence = target.base_evidence * 0.25 * np.where(detected, 0.80, 1.0) * reward_jitter
    evidence = np.where(successes, success_evidence, failure_evidence)
    heat_gain = np.where(
        successes & ~detected,
        4 + 2 * (target.tier - 1),
        np.where(
            successes & detected,
            12 + 2 * (target.tier - 1),
            np.where(~successes & ~detected, 7 + 2 * (target.tier - 1), 18 + 2 * (target.tier - 1)),
        ),
    )
    return {
        "player": player.name,
        "target_tier": target.tier,
        "target": target.label,
        "attack_rating": round_half_away(attack_rating(player), 2),
        "defense_rating": round_half_away(defense_rating(target), 2),
        "mean_minigame_score": round_half_away(float(scores.mean()), 2),
        "success_rate": round_half_away(float(successes.mean()), 4),
        "detection_rate": round_half_away(float(detected.mean()), 4),
        "success_and_undetected_rate": round_half_away(float((successes & ~detected).mean()), 4),
        "expected_capital_per_attempt": round_half_away(float(rewards.mean()), 2),
        "expected_evidence_per_attempt": round_half_away(float(evidence.mean()), 2),
        "expected_heat_gain": round_half_away(float(heat_gain.mean()), 2),
    }


def facility_output(base_output: float, level: int) -> float:
    return base_output * 1.24 ** (level - 1)


def facility_energy_demand(base_demand: float, level: int) -> float:
    return base_demand * 1.18 ** (level - 1)


def allocate_energy(available: float, facilities: list[dict]) -> list[dict]:
    """Allocate by priority then stable id and return linear partial-efficiency output."""
    remaining = max(0.0, available)
    result: list[dict] = []
    for item in sorted(facilities, key=lambda row: (row["priority"], row["facility_id"])):
        demand = max(0.0, float(item["demand"]))
        allocation = min(demand, remaining)
        remaining -= allocation
        efficiency = 1.0 if demand == 0 else allocation / demand
        result.append(
            {
                "facility_id": item["facility_id"],
                "allocation": round_half_away(allocation, 6),
                "efficiency": round_half_away(efficiency, 6),
                "actual_output": round_half_away(float(item["nominal_output"]) * efficiency, 6),
            }
        )
    return result


def facility_capital_cost(base_cost: int, level: int) -> int:
    return int(round_half_away(base_cost * 1.55 ** (level - 1)))


def facility_component_cost(base_cost: int, level: int) -> int:
    return int(round_half_away(base_cost * 1.48 ** (level - 1)))


def facility_time_minutes(base_time: float, level: int) -> float:
    return round_half_away(min(360.0, base_time * 1.50 ** (level - 1)), 1)


def storage_hours(level: int) -> float:
    return min(36.0, round_half_away(24.0 + 1.5 * (level - 1), 1))


def facility_rows(levels: int = 12) -> list[dict]:
    rows: list[dict] = []
    for facility in FACILITIES:
        for level in range(1, levels + 1):
            rows.append(
                {
                    "facility": facility.name,
                    "output_kind": facility.output_kind,
                    "level": level,
                    "output_per_hour": round_half_away(
                        facility_output(facility.base_output_per_hour, level), 2
                    ),
                    "upgrade_capital_cost": facility_capital_cost(facility.base_capital_cost, level),
                    "upgrade_component_cost": facility_component_cost(facility.base_component_cost, level),
                    "upgrade_time_minutes": facility_time_minutes(facility.base_time_minutes, level),
                    "storage_hours": storage_hours(level),
                }
            )
    return rows


def facility_summary(levels: tuple[int, ...] = (1, 5, 10, 12)) -> list[dict]:
    selected = []
    full = facility_rows(max(levels))
    for row in full:
        if row["level"] in levels:
            selected.append(row)
    return selected


def activity_bonus(operations_per_day: float) -> float:
    """Economic acceleration is deliberately capped; extra play mostly yields mastery and options."""
    return min(0.20, 0.08 * math.log1p(max(0.0, operations_per_day)))


def activity_profiles() -> list[dict]:
    profiles = [("Bakım", 0), ("Kısa", 2), ("Düzenli", 5), ("Yoğun", 10), ("Maraton", 30)]
    return [
        {
            "profile": name,
            "operations_per_day": operations,
            "economic_bonus": round_half_away(activity_bonus(operations), 4),
            "daily_progress_index": round_half_away(100 * (1 + activity_bonus(operations)), 2),
        }
        for name, operations in profiles
    ]


def ledger_progression(operations_per_day: int, days: int = 30) -> dict:
    """Normalized ledger baseline for active-versus-casual progression comparison."""
    facility_credit = 1_000.0
    operation_credit = facility_credit * activity_bonus(operations_per_day)
    operation_cost = operation_credit * 0.35
    progression_sink = (facility_credit + operation_credit) * 0.25
    daily_net = facility_credit + operation_credit - operation_cost - progression_sink
    return {
        "operations_per_day": operations_per_day,
        "days": days,
        "facility_credit": round_half_away(facility_credit * days, 2),
        "operation_reward_credit": round_half_away(operation_credit * days, 2),
        "operation_cost_debit": round_half_away(operation_cost * days, 2),
        "upgrade_research_sink_debit": round_half_away(progression_sink * days, 2),
        "net_progression_value": round_half_away(daily_net * days, 2),
    }


def market_transition(previous: float, shock: float) -> float:
    return clamp(MARKET_CORRIDOR[0], MARKET_CORRIDOR[1], 1 + 0.72 * (previous - 1) + shock)


def market_series(days: int = 120) -> list[dict]:
    rng = deterministic_rng(SEED, f"market:days-{days}")
    value = 1.0
    rows = []
    for day in range(1, days + 1):
        shock = rng.normal_clt() * 0.035
        if day in (30, 75):
            shock += 0.09 if day == 30 else -0.08
        value = market_transition(value, shock)
        rows.append({"day": day, "market_index": round_half_away(value, 4)})
    return rows


def contract_probability(player_score: float, best_npc_score: float) -> float:
    return 0.10 + 0.80 * sigmoid((player_score - best_npc_score) / 9)


def offer_score(
    preparedness: float,
    reputation: float,
    urgency_fit: float,
    bid: float,
    fair_value: float,
) -> float:
    price_score = clamp(0.0, 100.0, 100.0 - 100.0 * abs(bid - fair_value) / max(1.0, fair_value))
    return clamp(
        0.0,
        100.0,
        0.45 * preparedness + 0.25 * reputation + 0.20 * urgency_fit + 0.10 * price_score,
    )


def collateral(base_reward: float, tier: int, liquid_capital: float) -> float:
    target = round_half_away(base_reward * (0.05 + 0.03 * tier))
    return min(target, round_half_away(0.20 * max(0.0, liquid_capital)))


def collateral_refund(held: float, outcome: str) -> float:
    rates = {"success": 1.0, "system_cancel": 1.0, "failure": 0.75, "abandon": 0.50}
    return round_half_away(max(0.0, held) * rates[outcome])


def bandwidth_capacity(data_center_level: int, bandwidth_research: int) -> int:
    return int(clamp(12, 40, 10 + 2 * data_center_level + math.floor(bandwidth_research / 5)))


def loadout_is_valid(tool_costs: list[int], capacity: int) -> bool:
    return bool(tool_costs) and all(isinstance(cost, int) and 1 <= cost <= 10 for cost in tool_costs) and sum(tool_costs) <= capacity


def apply_loadout_mode(mode: str, base_detection: float, base_reward: float, base_heat: float) -> dict:
    modifiers = LOADOUT_MODES[mode]
    return {
        "support": modifiers["support"],
        "detection": round_half_away(
            clamp(0.03, 0.85, base_detection + modifiers["detection_delta"]), 9
        ),
        "reward": round_half_away(max(0.0, base_reward) * modifiers["reward_multiplier"], 6),
        "heat": round_half_away(max(0.0, base_heat + modifiers["heat_delta"]), 4),
    }


def node_routing_score(
    weighted_risk: float,
    total_latency: float,
    max_latency: float,
    delivered: float,
    required: float,
    invalid_edge_count: int = 0,
) -> int:
    risk_component = 100.0 - clamp(0.0, 100.0, weighted_risk)
    latency_component = 100.0 * clamp(0.0, 1.0, 1.0 - total_latency / max(1.0, max_latency))
    packet_component = 100.0 * clamp(0.0, 1.0, delivered / max(1.0, required))
    value = (
        0.45 * risk_component
        + 0.30 * latency_component
        + 0.25 * packet_component
        - 20.0 * max(0, invalid_edge_count)
    )
    return int(round_half_away(clamp(0.0, 100.0, value)))


def node_route_can_launch(path_exists: bool, invalid_edge_count: int, delivered: float, required: float) -> bool:
    return path_exists and invalid_edge_count == 0 and required > 0 and delivered >= required


def planned_resolution_probability(
    neutral_success_probability: float,
    neutral_detection_probability: float,
    mastered_successes: int,
    formula_version: str = FORMULA_VERSION,
    content_version: str = CONTENT_VERSION,
) -> float | None:
    if formula_version != FORMULA_VERSION or content_version != CONTENT_VERSION:
        return None
    raw_probability = neutral_success_probability + min(0.06, 0.02 * max(0, mastered_successes))
    if mastered_successes < 3 or neutral_detection_probability > 0.25 or raw_probability < 0.78:
        return None
    return clamp(0.78, 0.88, raw_probability)


def world_axis_delta(grade: float, axis_vector: float) -> float:
    return round_half_away(clamp(-8.0, 8.0, 8.0 * grade * clamp(-1.0, 1.0, axis_vector)), 1)


def relationship_delta(grade: float, alignment: float) -> float:
    return round_half_away(clamp(-10.0, 10.0, 6.0 * grade * clamp(-1.0, 1.0, alignment)), 1)


def apply_world_axis(current: float, grade: float, axis_vector: float) -> float:
    return round_half_away(clamp(0.0, 100.0, current + world_axis_delta(grade, axis_vector)), 1)


def apply_relationship(current: float, grade: float, alignment: float) -> float:
    return round_half_away(clamp(-100.0, 100.0, current + relationship_delta(grade, alignment)), 1)


def adaptation_modifier(exposure: float) -> float:
    return min(10.0, 2.5 * math.log1p(max(0.0, exposure)))


def next_exposure(previous: float, new_exposure: float) -> float:
    """Apply forgetting first, add current-cycle exposure, then round once."""
    retained = max(0.0, previous) * (1.0 - NPC_FORGETTING_RATE)
    return round_half_away(max(0.0, retained + max(0.0, new_exposure)), 4)


def adaptation_rows() -> list[dict]:
    return [
        {
            "exposure": exposure,
            "defense_modifier": round_half_away(adaptation_modifier(exposure), 2),
        }
        for exposure in (0, 1, 3, 6, 10, 20)
    ]


def xp_rows(levels: int = 20) -> list[dict]:
    rows = []
    cumulative = 0
    for level in range(1, levels + 1):
        required = int(round_half_away(60 * level ** 1.35))
        cumulative += required
        rows.append({"level": level, "xp_to_next": required, "cumulative_xp": cumulative})
    return rows


def tier_rows() -> list[dict]:
    result = []
    for target in TARGETS:
        row = asdict(target)
        row["defense_rating"] = round_half_away(defense_rating(target), 2)
        result.append(row)
    return result


def audit_results(matched: list[dict], cross_tier: list[dict]) -> list[str]:
    assert resource_units_to_micro("9223372036854.775807") == POSTGRES_BIGINT_MAX
    assert resource_units_to_micro("-9223372036854.775808") == POSTGRES_BIGINT_MIN
    checks: list[str] = []
    assert FORMULA_VERSION == "balance-1.2"
    assert CONTENT_VERSION == "asteria-baseline-0.2"
    assert NODE_MAX_BONUS_PP == 0.10
    assert NPC_FORGETTING_RATE == 0.25
    assert WORLD_CYCLE_HOURS == 6
    assert round_half_away(2.5) == 3.0
    assert round_half_away(-2.5) == -3.0
    assert round_half_away(1.25, 1) == 1.3
    assert round_half_away(-1.25, 1) == -1.3
    assert probability_threshold(0.0) == 0
    assert probability_threshold(0.5) == UINT32_RANGE // 2
    assert probability_threshold(1.0) == UINT32_RANGE
    golden_rng = deterministic_rng(SEED, "golden")
    assert [golden_rng.next_uint32() for _ in range(5)] == [
        1019786244,
        2580556072,
        2564031293,
        2736638898,
        3790840288,
    ]
    isolated_detection_a = deterministic_rng(SEED, "isolation:detection")
    detection_vector_a = [isolated_detection_a.next_uint32() for _ in range(5)]
    unrelated_score = deterministic_rng(SEED, "isolation:score")
    for _ in range(100):
        unrelated_score.next_uint32()
    isolated_detection_b = deterministic_rng(SEED, "isolation:detection")
    detection_vector_b = [isolated_detection_b.next_uint32() for _ in range(5)]
    assert detection_vector_a == detection_vector_b
    checks.append(
        "Sürüm, half-away yuvarlama, olasılık eşiği, PCG32 golden/stream izolasyonu, Node sınırı, unutma ve dünya çevrimi planla eşleşiyor."
    )
    facilities = facility_rows()
    for facility in FACILITIES:
        rows = [row for row in facilities if row["facility"] == facility.name]
        assert all(rows[i]["output_per_hour"] < rows[i + 1]["output_per_hour"] for i in range(len(rows) - 1))
        assert all(
            rows[i]["upgrade_capital_cost"] < rows[i + 1]["upgrade_capital_cost"]
            for i in range(len(rows) - 1)
        )
        assert all(
            rows[i]["upgrade_component_cost"] < rows[i + 1]["upgrade_component_cost"]
            for i in range(len(rows) - 1)
        )
        assert all(row["upgrade_time_minutes"] <= 360 for row in rows)
    checks.append("Beş tesisin üretim ve maliyet eğrileri monoton; süreler 6 saat tavanını aşmıyor.")
    energy_fixture = [
        {
            "facility_id": "data",
            "priority": 1,
            "demand": ENERGY_BASE_DEMANDS["Veri Merkezi"],
            "nominal_output": 150,
        },
        {
            "facility_id": "lab",
            "priority": 2,
            "demand": ENERGY_BASE_DEMANDS["Araştırma Laboratuvarı"],
            "nominal_output": 8,
        },
        {
            "facility_id": "workshop",
            "priority": 3,
            "demand": ENERGY_BASE_DEMANDS["Robotik Atölye"],
            "nominal_output": 18,
        },
    ]
    allocation = allocate_energy(90.0, energy_fixture)
    assert sum(row["allocation"] for row in allocation) == 90.0
    assert allocation[0]["facility_id"] == "data" and allocation[0]["efficiency"] == 1.0
    assert allocation[1]["facility_id"] == "lab" and allocation[1]["allocation"] == 20.0
    checks.append("Enerji çözümleyicisi öncelik/id sırasını, korunumu ve doğrusal kısmi verimi sağlıyor.")
    assert all(0.60 <= row["success_rate"] <= 0.85 for row in matched)
    checks.append("Eş-kademe başarı oranları %60-%85 tasarım bandında.")
    for player, target in zip(PLAYERS[:4], TARGETS[:4]):
        low = PlayerProfile(**{**asdict(player), "heat": 0.0})
        high = PlayerProfile(**{**asdict(player), "heat": 100.0})
        assert detection_probability(high, target, player.score_mean) > detection_probability(
            low, target, player.score_mean
        )
    checks.append("Isı yükseldikçe tespit olasılığı her profilde artıyor.")
    by_player: dict[str, list[dict]] = {}
    for row in cross_tier:
        by_player.setdefault(row["player"], []).append(row)
    for rows in by_player.values():
        rows.sort(key=lambda item: item["target_tier"])
        assert all(rows[i]["success_rate"] > rows[i + 1]["success_rate"] for i in range(len(rows) - 1))
    checks.append("Hedef kademesi yükseldikçe başarı oranı her profilde düşüyor.")
    for player, target in zip(PLAYERS, TARGETS):
        neutral = success_probability(player, target, NODE_NEUTRAL_SCORE)
        best = success_probability(player, target, 100)
        worst = success_probability(player, target, 0)
        assert best - neutral <= NODE_MAX_BONUS_PP + 1e-12
        assert neutral - worst <= NODE_MAX_BONUS_PP + 1e-12
    checks.append("Node Routing etkisi nötrden en iyi skora en fazla +10 yüzde puan; en kötüden nötre en fazla +10 puan.")
    assert all(activity_bonus(n) <= 0.20 for n in range(0, 101))
    casual = ledger_progression(2)
    engaged = ledger_progression(10)
    gap = engaged["net_progression_value"] / casual["net_progression_value"] - 1
    assert gap <= 0.20
    checks.append(
        f"30 günlük normalize ledger'da 2 ve 10 operasyon/gün ilerleme farkı %{gap*100:.1f}; hedef <%20."
    )
    assert MARKET_CORRIDOR == (0.85, 1.15)
    assert market_transition(1.0, -10.0) == MARKET_CORRIDOR[0]
    assert market_transition(1.0, 10.0) == MARKET_CORRIDOR[1]
    market = market_series()
    assert all(MARKET_CORRIDOR[0] <= row["market_index"] <= MARKET_CORRIDOR[1] for row in market)
    checks.append("Pazar yapılandırması ve zorlanmış uç şoklar 0,85-1,15 koridoruna kilitli.")
    assert contract_probability(80, 50) > contract_probability(50, 50) > contract_probability(20, 50)
    assert offer_score(80, 60, 70, 100, 100) > offer_score(60, 60, 70, 150, 100)
    held = collateral(1_000, 3, 10_000)
    assert collateral_refund(held, "success") > collateral_refund(held, "failure")
    assert collateral_refund(held, "failure") > collateral_refund(held, "abandon")
    checks.append("Teklif/teminat matematiği hazırlık ve adil fiyatı ödüllendiriyor; iadeler sıralı ve sınırlı.")
    assert bandwidth_capacity(1, 0) == 12
    assert bandwidth_capacity(20, 100) == 40
    assert loadout_is_valid([3, 4, 5], 12)
    assert not loadout_is_valid([3, 4, 6], 12)
    assert not loadout_is_valid([0, 3], 12)
    silent_mode = apply_loadout_mode("silent", 0.20, 100.0, 1.0)
    fast_mode = apply_loadout_mode("fast", 0.20, 100.0, 1.0)
    assert silent_mode == {"support": 0.0, "detection": 0.15, "reward": 95.0, "heat": 0.0}
    assert fast_mode == {"support": 0.08, "detection": 0.28, "reward": 105.0, "heat": 5.0}
    good_route = node_routing_score(10, 20, 100, 100, 100)
    bad_route = node_routing_score(70, 90, 100, 50, 100)
    assert good_route > bad_route
    assert node_routing_score(10, 20, 100, 100, 100, 1) < good_route
    assert node_route_can_launch(True, 0, 100, 100)
    assert not node_route_can_launch(True, 1, 100, 100)
    assert not node_route_can_launch(False, 0, 100, 100)
    assert planned_resolution_probability(0.74, 0.20, 3) == 0.80
    assert planned_resolution_probability(0.74, 0.30, 3) is None
    assert planned_resolution_probability(0.74, 0.20, 3, "stale", CONTENT_VERSION) is None
    assert world_axis_delta(1.0, 1.0) == 8.0
    assert relationship_delta(-0.60, 1.0) == -3.6
    assert apply_world_axis(98.0, 1.0, 1.0) == 100.0
    assert apply_world_axis(2.0, -0.60, 1.0) == 0.0
    assert apply_relationship(99.0, 1.0, 1.0) == 100.0
    checks.append(
        "Yükleme/mod, Node geçerliliği, sürümlü planlı çözüm ve 0-100 dünya uygulaması sınır kontrollerini geçiyor."
    )
    assert all(
        adaptation_modifier(exposure) <= adaptation_modifier(exposure + 1)
        for exposure in range(0, 30)
    )
    assert all(adaptation_modifier(exposure) <= 10.0 for exposure in range(0, 10_000))
    assert next_exposure(8.0, 0.0) == 6.0
    assert next_exposure(-4.0, -2.0) == 0.0
    checks.append(
        "NPC maruziyeti her 6 saatlik çevrimde önce %25 unutuluyor; adaptasyon monoton ve +10 puanda sınırlı."
    )
    return checks


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path("C:/Windows/Fonts") / name
    return ImageFont.truetype(str(path), size=size)


def _line_chart(
    path: Path,
    title: str,
    x_label: str,
    y_label: str,
    x_values: np.ndarray,
    series: list[tuple[str, np.ndarray, str]],
    y_min: float,
    y_max: float,
    x_ticks: list[float],
    y_ticks: list[float],
) -> None:
    width, height = 1512, 756
    left, top, right, bottom = 155, 105, 55, 125
    plot_w = width - left - right
    plot_h = height - top - bottom
    image = Image.new("RGB", (width, height), "#FFFFFF")
    draw = ImageDraw.Draw(image)
    grid = "#D7DEE8"
    ink = "#243447"
    muted = "#59697A"
    draw.text((left, 28), title, font=_font(31, True), fill=ink)

    def xp(v: float) -> int:
        return round(left + (v - float(x_values.min())) / (float(x_values.max()) - float(x_values.min())) * plot_w)

    def yp(v: float) -> int:
        return round(top + (y_max - v) / (y_max - y_min) * plot_h)

    for tick in y_ticks:
        y = yp(tick)
        draw.line((left, y, left + plot_w, y), fill=grid, width=2)
        label = f"{tick:g}"
        box = draw.textbbox((0, 0), label, font=_font(19))
        draw.text((left - 14 - (box[2] - box[0]), y - 11), label, font=_font(19), fill=muted)
    for tick in x_ticks:
        x = xp(tick)
        draw.line((x, top, x, top + plot_h), fill="#EEF2F6", width=1)
        label = f"{tick:g}"
        box = draw.textbbox((0, 0), label, font=_font(19))
        draw.text((x - (box[2] - box[0]) / 2, top + plot_h + 12), label, font=_font(19), fill=muted)
    draw.line((left, top, left, top + plot_h), fill=ink, width=3)
    draw.line((left, top + plot_h, left + plot_w, top + plot_h), fill=ink, width=3)

    for label, values, color in series:
        points = [(xp(float(x)), yp(float(y))) for x, y in zip(x_values, values)]
        draw.line(points, fill=color, width=5, joint="curve")

    draw.text((left + plot_w / 2 - 150, height - 62), x_label, font=_font(21), fill=ink)
    draw.text((18, top + plot_h / 2 - 12), y_label, font=_font(20), fill=ink)
    legend_x, legend_y = left + 18, top + 16
    for idx, (label, _, color) in enumerate(series):
        y = legend_y + idx * 34
        draw.line((legend_x, y + 12, legend_x + 45, y + 12), fill=color, width=5)
        draw.text((legend_x + 58, y), label, font=_font(19), fill=ink)
    image.save(path, optimize=True)


def build_charts() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    accent = "#00A86B"
    blue = "#1976A3"
    red = "#C23B4A"
    gold = "#B7791F"

    diffs = np.linspace(-35, 35, 281)
    neutral = (0.08 + 0.84 / (1 + np.exp(-(diffs / 11)))) * 100
    prepared = np.clip(
        0.08
        + 0.84 / (1 + np.exp(-(diffs / 11 + intel_bonus(3))))
        + node_probability_delta(80),
        0.08,
        0.92,
    ) * 100
    _line_chart(
        ASSET_DIR / "success_curve_v1_1.png",
        "Başarı eğrisi: hazırlık avantaj sağlar, sonucu garanti etmez",
        "Saldırı gücü - savunma gücü",
        "Başarı (%)",
        diffs,
        [("Nötr hazırlık", neutral, blue), ("3 istihbarat + iyi mini oyun", prepared, accent)],
        5,
        95,
        [-30, -20, -10, 0, 10, 20, 30],
        [10, 30, 50, 70, 90],
    )

    levels = np.arange(1, 13)
    facilities = [row for row in facility_rows(12) if row["facility"] == "Veri Merkezi"]
    rates = np.array([row["output_per_hour"] for row in facilities], dtype=float)
    costs = np.array([row["upgrade_capital_cost"] for row in facilities], dtype=float)
    normalized_rates = rates / rates.max() * 100
    normalized_costs = costs / costs.max() * 100
    _line_chart(
        ASSET_DIR / "facility_curve_v1_1.png",
        "Tesis büyümesi: fayda artar, yatırım kararı giderek ağırlaşır",
        "Tesis seviyesi",
        "Normalize değer",
        levels.astype(float),
        [("Üretim hızı", normalized_rates, accent), ("Yükseltme maliyeti", normalized_costs, blue)],
        0,
        105,
        [1, 3, 5, 7, 9, 11, 12],
        [0, 25, 50, 75, 100],
    )

    heats = np.linspace(0, 100, 101)
    heat_series = []
    for player, target, color in zip(PLAYERS[:4], TARGETS[:4], [accent, blue, gold, red]):
        ps = []
        for heat in heats:
            adjusted = PlayerProfile(**{**asdict(player), "heat": float(heat)})
            ps.append(detection_probability(adjusted, target, player.score_mean) * 100)
        heat_series.append((f"Kademe {target.tier}", np.array(ps), color))
    _line_chart(
        ASSET_DIR / "heat_detection_curve_v1_1.png",
        "Isı bir enerji duvarı değil, görünür bir risk çarpanıdır",
        "Isı / dikkat seviyesi",
        "Tespit (%)",
        heats,
        heat_series,
        0,
        65,
        [0, 20, 40, 60, 80, 100],
        [0, 15, 30, 45, 60],
    )

    operations = np.linspace(0, 30, 121)
    bonuses = np.array([activity_bonus(float(value)) * 100 for value in operations])
    _line_chart(
        ASSET_DIR / "activity_gap_curve_v1_1.png",
        "Aktif oyun ekonomik gücü sınırsız büyütmez",
        "Günlük tamamlanan operasyon",
        "Ekonomik hız bonusu (%)",
        operations,
        [("Aktif katkı", bonuses, accent)],
        0,
        22,
        [0, 2, 5, 10, 20, 30],
        [0, 5, 10, 15, 20],
    )

    market = market_series()
    days = np.array([row["day"] for row in market], dtype=float)
    market_values = np.array([row["market_index"] * 100 for row in market], dtype=float)
    _line_chart(
        ASSET_DIR / "market_index_curve_v1_1.png",
        "NPC pazarı şok üretir ancak kontrolsüz enflasyona kaçmaz",
        "Simülasyon günü",
        "Pazar endeksi (100=nötr)",
        days,
        [("Pazar endeksi", market_values, blue)],
        82,
        118,
        [1, 20, 40, 60, 80, 100, 120],
        [85, 90, 100, 110, 115],
    )


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    matched = [simulate_pair(player, target) for player, target in zip(PLAYERS, TARGETS)]
    cross_tier = []
    for idx, player in enumerate(PLAYERS):
        for target_idx in sorted(set([max(0, idx - 1), idx, min(len(TARGETS) - 1, idx + 1)])):
            cross_tier.append(simulate_pair(player, TARGETS[target_idx], n=50_000))
    audits = audit_results(matched, cross_tier)
    results = {
        "metadata": {
            "formula_version": FORMULA_VERSION,
            "content_version": CONTENT_VERSION,
            "seed": SEED,
            "simulations_per_matched_pair": N_SIM,
            "world_cycle_hours": WORLD_CYCLE_HOURS,
            "prng": "PCG-XSH-RR 32",
            "probability_quantization_digits": 9,
            "rounding": "half-away-from-zero",
        },
        "formulas": {
            "success": "clamp(0.08, 0.92, 0.08 + 0.84*sigmoid((A + tool - D)/11 + 0.18*ln(1+intel) - heat_penalty + support) + node_delta)",
            "node_delta": "clamp(-0.10, 0.10, (score-50)/500)",
            "detection": "0.03 + 0.55 * sigmoid((monitoring + noise + score_noise + 0.25*heat - stealth - cover)/12)",
            "facility_rate": "base_rate * 1.24^(level-1)",
            "facility_capital_cost": "base_capital * 1.55^(level-1)",
            "facility_component_cost": "base_components * 1.48^(level-1)",
            "facility_time_minutes": "min(360, base_time * 1.50^(level-1))",
            "facility_energy_demand": "base_demand * 1.18^(level-1)",
            "energy_efficiency": "allocation / demand; allocation ordered by priority then facility_id",
            "activity_bonus": "min(0.20, 0.08*ln(1+operations_per_day))",
            "market_index": "clamp(0.85, 1.15, 1 + 0.72*(previous-1) + shock)",
            "contract_probability": "0.10 + 0.80*sigmoid((player_score-best_npc_score)/9)",
            "offer_score": "0.45*preparedness + 0.25*reputation + 0.20*urgency_fit + 0.10*price_score",
            "bandwidth": "clamp(12,40,10+2*data_center_level+floor(research/5))",
            "loadout_valid": "all tool costs are integer 1..10 and sum(costs)<=bandwidth",
            "loadout_modes": LOADOUT_MODES,
            "node_score": "round(clamp(0,100,0.45*R+0.30*L+0.25*K-20*invalid_edges))",
            "node_launch": "path_exists and invalid_edges==0 and delivered>=required>0",
            "planned_resolution": "raw=P_success(score50)+min(0.06,0.02*mastered_successes); clamp(0.78,0.88,raw)",
            "world_axis_delta": "round1(clamp(-8,8,8*grade*axis_vector))",
            "world_axis_apply": "round1(clamp(0,100,current+delta))",
            "npc_adaptation": "min(10, 2.5*ln(1+exposure))",
            "npc_exposure_next": "round4(max(0, 0.75*previous_exposure + max(0,new_exposure)))",
            "failure_analysis": "base_evidence * 0.25 * (0.80 if detected else 1.0) * jitter",
            "xp_to_next": "60 * level^1.35",
        },
        "matched_simulation": matched,
        "cross_tier_simulation": cross_tier,
        "facility_table": facility_rows(),
        "facility_energy_base_demands": ENERGY_BASE_DEMANDS,
        "facility_summary": facility_summary(),
        "activity_profiles": activity_profiles(),
        "ledger_progression_profiles": [ledger_progression(2), ledger_progression(10)],
        "market_series": market_series(),
        "adaptation_table": adaptation_rows(),
        "xp_table": xp_rows(),
        "target_tiers": tier_rows(),
        "audit_checks": audits,
    }
    OUTPUT_JSON.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    build_charts()
    print(json.dumps(results["matched_simulation"], ensure_ascii=False, indent=2))
    print("AUDIT:")
    for check in audits:
        print(f"- {check}")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
