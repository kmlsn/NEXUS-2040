import hashlib
import json
import math
from pathlib import Path

MASK = (1 << 64) - 1
U32 = 1 << 32
SCORE_SCALE = 1_000_000_000

def round_div_half_away_positive(numerator, denominator):
    assert numerator >= 0 and denominator > 0
    return (numerator * 2 + denominator) // (2 * denominator)

def price_score_micro(bid, fair):
    assert bid > 0 and fair > 0
    deviation = abs(bid - fair)
    if deviation >= fair:
        return 0
    return round_div_half_away_positive(100 * (fair - deviation) * SCORE_SCALE, fair)

def next32(state, inc):
    old = state; state = (old * 6364136223846793005 + inc) & MASK
    x = (((old >> 18) ^ old) >> 27) & 0xffffffff; r = old >> 59
    return state, ((x >> r) | (x << ((-r) & 31))) & 0xffffffff

def draw(formula, content, seed, stream):
    digest = hashlib.sha256(f"{formula}|{content}|{seed}|{stream}".encode()).digest(); s = int.from_bytes(digest[:8], 'little'); st = int.from_bytes(digest[8:16], 'little'); inc = ((st << 1) | 1) & MASK
    state = 0; state, _ = next32(state, inc); state = (state + s) & MASK; state, _ = next32(state, inc); _, value = next32(state, inc); return value

fixture = json.loads((Path(__file__).parents[1] / "packages" / "simulation" / "fixtures" / "contract-offer-v1.json").read_text())
c = fixture["case"]
fair = int(c["fair_value_micro"]); bid = int(c["bid_micro"])
price_micro = price_score_micro(bid, fair)
price = price_micro / SCORE_SCALE
score = .45*c["preparedness"] + .25*c["reputation"] + .20*c["urgency_fit"] + .10*price
prob = .10 + .80 / (1 + math.exp(-(score-c["best_npc_score"])/9))
threshold = math.floor(math.floor(prob * 1_000_000_000 + .5) / 1_000_000_000 * U32)
value = draw(fixture["formula_version"], fixture["content_version"], int(c["master_seed"]), c["stream_id"])
assert price == c["price_score"] and score == c["player_score"] and threshold == c["threshold"] and value == c["draw"] and (value < threshold) == c["awarded"]
for boundary in fixture["price_score_boundaries"]:
    actual = price_score_micro(int(boundary["bid_micro"]), int(boundary["fair_value_micro"]))
    assert actual == int(boundary["price_score_scaled"])
print("PASS: Python contract-offer fixture matches score, threshold, PCG draw, and award.")
