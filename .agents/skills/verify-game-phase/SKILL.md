---
name: verify-game-phase
description: Verify a NEXUS 2040 task or phase against GAME_PLAN.md, actual code, tests, reviewer evidence, and phase exit gates. Use before marking work complete, promoting a phase, auditing plan drift, or checking whether completion evidence is truthful.
---

# Verify Game Phase

## Workflow

1. Read `AGENTS.md`, `Aktif çalışma`, the target phase, `Kalite kapısı protokolü`, `Test matrisi`, `Definition of Done`, relevant decisions, and risks.
2. Run `scripts/validate_plan.py` from this skill against the repository `GAME_PLAN.md`.
3. Declare the gate type before checking anything:
   - **Task gate:** compare the selected task's deliverables and acceptance criteria with actual files, tests, and observable behavior. Run the task-specific commands and the repository-wide command required by the active phase at that point.
   - **Phase gate:** compare every phase deliverable and exit condition with actual files, migrations, schemas, tests, and observable behavior. Run every command required by the full phase.
4. Record each command, exit code, and relevant result. A missing command or unavailable dependency is `NOT VERIFIED`, not `PASS`. Do not demand artifacts from unfinished sibling tasks during a task gate.
5. Ask the relevant read-only reviewer:
   - `gameplay_economy_reviewer` for formulas, rewards, markets, progression, or NPC adaptation.
   - `security_safety_reviewer` for persistence, authorization, input boundaries, or cyber content.
   - `quality_gate_reviewer` for the consolidated gate.
   - `lifecycle_game_tester` in `task-smoke` mode for executable behavior, in `phase-regression` mode for every phase close, and in `release-acceptance` mode after Phase 10 or for a release candidate.
6. Check that every completed task has evidence and that no future phase was implemented silently.
7. For a task gate, return the result before its checkbox or evidence is updated. For a phase close, require `docs/test-reports/P<phase>-lifecycle.md`, then create `docs/phase-reports/P<phase>-gate.md` with scope, commands, lifecycle result, reviewer findings, accepted risks, and PASS/FAIL.
8. After a task-gate `PASS`, the executing writer may mark only that task complete and add its evidence. Mark a phase `COMPLETE` and the next phase `READY` only after every exit condition passes. Never activate the next phase implicitly.

## Result format

Return exactly one gate result: `PASS`, `FAIL`, or `NOT VERIFIED`. List blockers first, then evidence. A `PASS` must name every required command and reviewer actually checked.
