#!/usr/bin/env python3
"""Validate the structural invariants of GAME_PLAN.md.

This check deliberately uses only the Python standard library so it can run
before the game workspace and its package manager have been bootstrapped.
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path


ALLOWED_STATUSES = {"COMPLETE", "ACTIVE", "READY", "BLOCKED", "PAUSED"}
EXPECTED_PHASES = set(range(11))


def section(text: str, start_heading: str, end_heading: str | None = None) -> str:
    start = text.find(start_heading)
    if start == -1:
        return ""
    if end_heading is None:
        return text[start:]
    end = text.find(end_heading, start + len(start_heading))
    return text[start:] if end == -1 else text[start:end]


def expand_evidence_ids(evidence_text: str) -> set[str]:
    ids = set(re.findall(r"\bP\d+\.\d+\b", evidence_text))
    ranges = re.findall(r"\bP(\d+)\.(\d+)-P(\d+)\.(\d+)\b", evidence_text)
    for start_phase, start_task, end_phase, end_task in ranges:
        if start_phase != end_phase:
            continue
        first = int(start_task)
        last = int(end_task)
        if first <= last:
            ids.update(f"P{start_phase}.{task}" for task in range(first, last + 1))
    return ids


def main() -> int:
    plan_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("GAME_PLAN.md")
    errors: list[str] = []

    if not plan_path.is_file():
        print(f"FAIL: plan not found: {plan_path}")
        return 1

    text = plan_path.read_text(encoding="utf-8")
    repository = plan_path.resolve().parent

    required_fragments = [
        "# NEXUS",
        "## 1. Kaynak-of-truth sözleşmesi",
        "## 5. Faz özeti",
        "## 18. Kalite kapısı protokolü",
        "## 20. Definition of Ready",
        "## 21. Definition of Done",
        "## 22. Proje ajanları",
        "## 23. Proje becerileri",
        "## 24. Karar kaydı",
        "## 25. Risk kaydı",
        "## 26. Tamamlama kanıtı",
        "## 27. Değişiklik protokolü",
    ]
    for fragment in required_fragments:
        if fragment not in text:
            errors.append(f"missing required section or marker: {fragment}")

    for forbidden in ("TODO", "TBD", "PLACEHOLDER", "\ufffd"):
        if forbidden in text:
            errors.append(f"forbidden unresolved marker found: {forbidden!r}")

    lowered = text.lower()
    if "günlük geliştirme" not in lowered or "tek operasyonel kaynak" not in lowered:
        errors.append("GAME_PLAN.md is not declared as the daily operational source")
    if "docx" not in lowered or "rutin" not in lowered:
        errors.append("the plan does not explicitly prohibit routine DOCX consultation")

    summary = section(text, "## 5. Faz özeti", "## 6.")
    phase_rows = re.findall(
        r"^\|\s*(\d+)\s*\|.*?\|\s*`(COMPLETE|ACTIVE|READY|BLOCKED|PAUSED)`\s*\|",
        summary,
        flags=re.MULTILINE,
    )
    phase_statuses: dict[int, str] = {}
    for phase_text, status in phase_rows:
        phase = int(phase_text)
        if phase in phase_statuses:
            errors.append(f"duplicate phase summary row: {phase}")
        phase_statuses[phase] = status
        if status not in ALLOWED_STATUSES:
            errors.append(f"invalid phase status for phase {phase}: {status}")

    missing_phases = sorted(EXPECTED_PHASES - phase_statuses.keys())
    extra_phases = sorted(phase_statuses.keys() - EXPECTED_PHASES)
    if missing_phases:
        errors.append(f"missing phase summary rows: {missing_phases}")
    if extra_phases:
        errors.append(f"unexpected phase summary rows: {extra_phases}")

    active = [phase for phase, status in phase_statuses.items() if status == "ACTIVE"]
    ready = [phase for phase, status in phase_statuses.items() if status == "READY"]
    if len(active) > 1:
        errors.append(f"more than one ACTIVE phase: {active}")
    if not active and len(ready) != 1:
        errors.append(f"with no ACTIVE phase, exactly one READY phase is required; found {ready}")

    active_work = section(text, "## 2. Aktif çalışma", "## 3.")
    current_match = re.search(
        r"^\|\s*Mevcut faz\s*\|\s*Faz\s+(\d+).*?`(COMPLETE|ACTIVE|READY|BLOCKED|PAUSED)`",
        active_work,
        flags=re.MULTILINE,
    )
    next_match = re.search(
        r"^\|\s*Sonraki faz\s*\|\s*Faz\s+(\d+).*?`(COMPLETE|ACTIVE|READY|BLOCKED|PAUSED)`",
        active_work,
        flags=re.MULTILINE,
    )
    if current_match is None or next_match is None:
        errors.append("Aktif çalışma must declare current and next phase with a status")
    else:
        current_phase, current_status = int(current_match.group(1)), current_match.group(2)
        next_phase, next_status = int(next_match.group(1)), next_match.group(2)
        if phase_statuses.get(current_phase) != current_status:
            errors.append(
                f"current phase status disagrees with phase summary: phase {current_phase} "
                f"is {current_status}, summary is {phase_statuses.get(current_phase)}"
            )
        if phase_statuses.get(next_phase) != next_status:
            errors.append(
                f"next phase status disagrees with phase summary: phase {next_phase} "
                f"is {next_status}, summary is {phase_statuses.get(next_phase)}"
            )
        expected_current = active[0] if active else max(
            (phase for phase, status in phase_statuses.items() if status == "COMPLETE"),
            default=0,
        )
        if current_phase != expected_current:
            errors.append(
                f"Aktif çalışma current phase should be {expected_current}, found {current_phase}"
            )
        if next_phase != min(current_phase + 1, max(EXPECTED_PHASES)):
            errors.append(
                f"Aktif çalışma next phase should follow current phase {current_phase}, found {next_phase}"
            )

    task_rows = re.findall(
        r"^- \[([ xX])\] \*\*(P(\d+)\.(\d+))\*\*",
        text,
        flags=re.MULTILINE,
    )
    task_states: dict[str, bool] = {}
    tasks_by_phase: dict[int, list[str]] = {phase: [] for phase in EXPECTED_PHASES}
    for mark, task_id, phase_text, _task_text in task_rows:
        if task_id in task_states:
            errors.append(f"duplicate task id: {task_id}")
            continue
        phase = int(phase_text)
        task_states[task_id] = mark.lower() == "x"
        tasks_by_phase.setdefault(phase, []).append(task_id)

    for phase in sorted(EXPECTED_PHASES):
        if not tasks_by_phase.get(phase):
            errors.append(f"phase {phase} has no task definitions")
            continue
        status = phase_statuses.get(phase)
        states = [task_states[task_id] for task_id in tasks_by_phase[phase]]
        if status == "COMPLETE" and not all(states):
            errors.append(f"COMPLETE phase {phase} contains unchecked tasks")
        if status in {"READY", "BLOCKED"} and any(states):
            errors.append(f"{status} phase {phase} contains checked tasks")

    heading_phases = [
        int(value)
        for value in re.findall(r"^## \d+\. Faz (\d+) -", text, flags=re.MULTILINE)
    ]
    if set(heading_phases) != EXPECTED_PHASES or len(heading_phases) != len(EXPECTED_PHASES):
        errors.append(f"phase headings must contain phases 0..10 exactly once; found {heading_phases}")

    for index, phase in enumerate(heading_phases):
        start_marker = re.search(rf"^## \d+\. Faz {phase} -.*$", text, flags=re.MULTILINE)
        if start_marker is None:
            continue
        start = start_marker.start()
        if index + 1 < len(heading_phases):
            next_phase = heading_phases[index + 1]
            next_marker = re.search(
                rf"^## \d+\. Faz {next_phase} -.*$", text[start_marker.end() :], flags=re.MULTILINE
            )
            end = start_marker.end() + next_marker.start() if next_marker else len(text)
        else:
            end_match = re.search(r"^## 19\.", text[start_marker.end() :], flags=re.MULTILINE)
            end = start_marker.end() + end_match.start() if end_match else len(text)
        if "çıkış kapısı" not in text[start:end].lower():
            errors.append(f"phase {phase} has no explicit exit gate")

    evidence = section(text, "## 26. Tamamlama kanıtı", "## 27.")
    evidenced_ids = expand_evidence_ids(evidence)
    for task_id, complete in task_states.items():
        if complete and task_id not in evidenced_ids:
            errors.append(f"completed task has no entry in completion evidence: {task_id}")

    decisions = section(text, "## 24. Karar kaydı", "## 25.")
    decision_ids = re.findall(r"^\|\s*(D-\d{3})\s*\|", decisions, flags=re.MULTILINE)
    if not decision_ids:
        errors.append("decision log has no decisions")
    if len(decision_ids) != len(set(decision_ids)):
        errors.append("decision log contains duplicate decision ids")

    expected_skills = {
        "execute-game-phase",
        "verify-game-phase",
        "balance-game-systems",
        "review-safe-cyber-content",
    }
    for skill_name in sorted(expected_skills):
        skill_file = repository / ".agents" / "skills" / skill_name / "SKILL.md"
        interface_file = skill_file.parent / "agents" / "openai.yaml"
        if not skill_file.is_file() or not interface_file.is_file():
            errors.append(f"missing project skill artifact: {skill_name}")

    expected_agents = {
        "phase-architect.toml": ("phase_architect", "read-only"),
        "implementation-worker.toml": ("implementation_worker", "workspace-write"),
        "gameplay-economy-reviewer.toml": ("gameplay_economy_reviewer", "read-only"),
        "quality-gate-reviewer.toml": ("quality_gate_reviewer", "workspace-write"),
        "security-safety-reviewer.toml": ("security_safety_reviewer", "read-only"),
        "lifecycle-game-tester.toml": ("lifecycle_game_tester", "workspace-write"),
    }
    for filename, (expected_name, expected_sandbox) in expected_agents.items():
        agent_file = repository / ".codex" / "agents" / filename
        if not agent_file.is_file():
            errors.append(f"missing custom agent artifact: {filename}")
            continue
        try:
            with agent_file.open("rb") as handle:
                agent = tomllib.load(handle)
        except (OSError, tomllib.TOMLDecodeError) as exc:
            errors.append(f"invalid custom agent TOML {filename}: {exc}")
            continue
        if agent.get("name") != expected_name or agent.get("sandbox_mode") != expected_sandbox:
            errors.append(
                f"custom agent contract mismatch {filename}: "
                f"name={agent.get('name')!r}, sandbox={agent.get('sandbox_mode')!r}"
            )
        if not agent.get("description") or not agent.get("developer_instructions"):
            errors.append(f"custom agent lacks description/instructions: {filename}")

    balance_result = repository / "docs" / "balance_results_v1.1.json"
    try:
        balance_data = json.loads(balance_result.read_text(encoding="utf-8"))
        metadata = balance_data["metadata"]
        if metadata.get("formula_version") != "balance-1.2":
            errors.append("balance result formula_version does not match balance-1.2")
        if metadata.get("content_version") != "asteria-baseline-0.2":
            errors.append("balance result content_version does not match asteria-baseline-0.2")
        if metadata.get("prng") != "PCG-XSH-RR 32":
            errors.append("balance result PRNG metadata is missing or incorrect")
        if not balance_data.get("audit_checks"):
            errors.append("balance result contains no audit checks")
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        errors.append(f"balance evidence is missing or invalid: {exc}")

    for phase, status in phase_statuses.items():
        if status == "COMPLETE":
            report = repository / "docs" / "phase-reports" / f"P{phase}-gate.md"
            if not report.is_file():
                errors.append(f"COMPLETE phase {phase} has no gate report: {report.relative_to(repository)}")
            lifecycle_report = repository / "docs" / "test-reports" / f"P{phase}-lifecycle.md"
            if not lifecycle_report.is_file():
                errors.append(
                    f"COMPLETE phase {phase} has no lifecycle report: "
                    f"{lifecycle_report.relative_to(repository)}"
                )

    if errors:
        print(f"FAIL: {len(errors)} plan invariant(s) violated")
        for error in errors:
            print(f"- {error}")
        return 1

    completed_tasks = sum(task_states.values())
    print(
        "PASS: "
        f"{len(phase_statuses)} phases, {len(task_states)} tasks, "
        f"{completed_tasks} completed tasks, {len(decision_ids)} decisions validated"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
