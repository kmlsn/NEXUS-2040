---
name: balance-game-systems
description: Validate and tune NEXUS 2040 game mathematics for operations, resources, facilities, rewards, markets, progression, active-versus-casual limits, and NPC adaptation. Use whenever formulas, constants, target tiers, economy flows, or simulation assumptions change.
---

# Balance Game Systems

## Workflow

1. Read the active task, balance targets, invariants, decisions, and risks in `GAME_PLAN.md`.
2. Identify every changed input, formula, unit, bound, sink/source, and downstream consumer. Refuse unit mixing hidden behind similarly named values.
3. Update the canonical deterministic model in `tools/balance_model.py` or the later repository equivalent. Keep formula and content versions explicit.
4. Add or update checks for bounds, monotonicity, conservation, overflow, negative values, dominant loops, repeat farming, and deterministic seeds.
5. Run fixed-seed Monte Carlo for probabilistic systems. Preserve enough samples to support the claim; do not tune by repeatedly changing the seed.
6. Check at minimum:
   - Matched-tier success remains `%60-%85` unless the plan changes.
   - Heat increases detection monotonically.
   - Failure returns meaningful analysis value.
   - Market configuration equals `0.85-1.15`; forced low/high shocks and simulated values remain inside it.
   - The 30-day ledger-based net progression gap between otherwise identical 2 and 10 operations/day profiles remains below `%20`; an abstract activity multiplier alone is insufficient evidence.
   - Node Routing changes success by at most `+10` percentage points from neutral score `50` to best score `100`, and at most `-10` points from neutral to worst score `0`.
   - NPC exposure forgets `%25` before new exposure every 6-hour world cycle; exposure is non-negative and adaptation never exceeds `+10` defense points.
   - No single loadout, facility, contract, or sale loop has more than `%12` median net-progression advantage over the next viable alternative in at least `%70` of representative seeds without a measurable risk, time, or resource tradeoff.
7. Ask `gameplay_economy_reviewer` for an independent read-only pass using raw model outputs, not the intended conclusion.
8. Update plan evidence only after the model, tests, and review agree.

## Output

Report changed formulas, assumptions, seed and sample count, before/after metrics, invariant results, reviewer findings, and unresolved tuning hypotheses. Distinguish defects from subjective tuning choices.
