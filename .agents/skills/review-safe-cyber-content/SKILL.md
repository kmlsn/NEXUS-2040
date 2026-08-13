---
name: review-safe-cyber-content
description: Review NEXUS 2040 cyber-operation mechanics, missions, UI text, data, and code for safe fictional realism and application-security boundaries. Use whenever adding or changing reconnaissance, access, network, detection, containment, evidence, target, or security-themed content.
---

# Review Safe Cyber Content

## Review procedure

1. Read decisions `D-004`, `D-006`, `D-008`, and `D-011`, the cyber-safety rules in `AGENTS.md`, and the affected active-phase acceptance criteria.
2. Inspect all new player-visible text, target data, mechanics, examples, fixtures, tests, logs, and developer comments in scope.
3. Reject or abstract any real command, payload, exploit chain, operational CVE step, credential attack recipe, real organization, public IP, real target, reusable malware behavior, or instruction that materially enables misuse.
4. Preserve realism through non-operational decisions: uncertainty, budgets, topology abstraction, segmentation, monitoring, noise, detection, containment, evidence integrity, service impact, recovery, and legal authorization.
5. Review application boundaries separately: server authority, schema validation, authorization, idempotency, ledger integrity, secrets, rate limits, logging, privacy, and user-controlled text.
6. Ask `security_safety_reviewer` for an independent pass when content is ambiguous or the change touches a trust boundary.
7. Record every reviewed content file or target in the phase content manifest with content version, SHA-256 digest, reviewer, result, and finding reference. An unlisted file is not reviewed.
8. Require the smallest safe rewrite for a violation. Do not remove all technical flavor when abstraction resolves the risk.

## Result format

Return `PASS` or `FAIL`. For each finding include severity, exact evidence, why it crosses the boundary, and a safe replacement pattern. Do not reproduce disallowed operational detail in the report.
