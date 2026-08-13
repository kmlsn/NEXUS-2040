---
name: execute-game-phase
description: Execute one bounded implementation task from the ACTIVE phase in GAME_PLAN.md, including tests and completion evidence. Use for coding, fixing, or integrating a planned game task; do not use for READY/BLOCKED phases, plan-only discussion, or final phase-gate approval.
---

# Execute Game Phase

## Workflow

1. Read `AGENTS.md` and these sections of `GAME_PLAN.md`: `Aktif çalışma`, the active phase, `Kalite kapısı protokolü`, `Definition of Ready`, `Definition of Done`, and relevant decisions/risks.
2. Confirm exactly one phase is `ACTIVE` and the requested task belongs to it. Stop and report the mismatch if the phase is `READY`, `BLOCKED`, `PAUSED`, or absent.
3. State a compact work contract: task ID, acceptance criteria, dependencies, affected modules, invariants, required tests, and reviewers.
4. Ask `phase_architect` for a read-only boundary check when the task crosses packages, changes a public contract, changes persistence, or has ambiguous dependencies.
5. Keep a single writer. Delegate only independent read-only exploration or review in parallel.
6. Implement the smallest coherent change. Preserve unrelated user work and avoid future-phase scaffolding unless the active task explicitly requires it.
7. Run the narrowest relevant checks first, then the phase verification command available in the repository. Treat a missing required command as incomplete work.
8. Use `$balance-game-systems` for formula/economy changes and `$review-safe-cyber-content` for cyber mechanics or narrative.
9. Request `quality_gate_reviewer` for every task closure. Scale the review depth to the change, but never omit the independent gate.
10. Run `$verify-game-phase` in task-gate mode. Update the task checkbox and `Tamamlama kanıtı` only after it returns `PASS`. Do not mark the phase `COMPLETE`; close it separately with `$verify-game-phase` in phase-gate mode.

## Output

Report the task ID, outcome, changed files, commands and results, reviewers used, plan evidence added, and any remaining limitation. Never claim a skipped or unavailable check passed.
