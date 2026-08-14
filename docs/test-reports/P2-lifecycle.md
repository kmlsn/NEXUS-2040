# Phase 2 Lifecycle Regression Report

## Result

`PASS`

## Test identity

| Field | Value |
|---|---|
| Mode | `phase-regression` |
| Phase | Phase 2 — Strategic economy (`P2.1` through `P2.8`) |
| Commit/build | `2b99025260d03d73fb3071238b9753a11c6f4954` with concurrent uncommitted P2 closeout work preserved; Node `v24.16.0`, pnpm `11.19.0`, Python `3.14.5`, NumPy `2.3.5` |
| Formula/content versions | `balance-1.2` / `asteria-baseline-0.2`; P2.7’s test-only normalised ledger comparator is pinned to `balance-1.3` as specified by D-026 |
| Environment | Windows host; Docker Compose PostgreSQL 17.7 and Redis 7.4.3 on loopback `15432`/`16379`; Vite `8.2.1` production build |
| Seeds/fixtures | PCG reference `20260809`; P2.7 fixed seed `20260809`, 7/30 days × 2/10 intents × 24/48/72-hour claims; P2.8 LCG seed `541065224`, 16 overspend and 8 exact-balance cases; phase journey fixed server time `1800000000000` ms |
| Date/agent | 2026-08-14 / `lifecycle_game_tester` |

## Delivered player journeys and invariants

| Journey/invariant | Expected observable behavior | Result | Evidence |
|---|---|---|---|
| Fresh profile and invalid economy start | A new profile starts with no facilities; an unfunded construction request is rejected with no queue item or value creation. | PASS | Independent disposable phase journey read an empty center profile and observed the expected insufficient-resource rejection before any successful grant. |
| Ledger, persistence, invalid input, and retry | Five resource balances are server-authoritative, exact-micro-unit, non-negative and within signed 64-bit bounds; malformed/reused intents do not create a second transaction. | PASS | API integration passed version pinning, migration/backfill guards, immutable ledger, atomic rejected underflow/overflow, distinct concurrent spend, and one replayed identical intent. P2.8 deterministic property runner passed. |
| Facility catalog boundaries | All five facility kinds have level 1–12 definitions; output/cost monotonicity, minimum storage, and six-hour upgrade cap hold; invalid kinds/levels do not persist. | PASS | Content, simulation, Python balance, and full verification checks passed the 60 definitions, monotonic curves, storage and timing limits. |
| Energy allocation and constrained recovery | Energy is allocated by player priority then stable facility ID, with conservation, partial efficiency, non-consuming microgrid output, and no output from an offline consumer. | PASS | Simulation unit/fixture regression and Python fixture checks passed deterministic allocation, conservation, exact partial efficiency, and storage-cap behavior. The center test reported exact estimates and constrained/offline recovery states. |
| Build, production, upgrade, and returning profile | A funded player can build a microgrid and data center, accrue one hour of authoritative production, see the resource reason, then upgrade; replay at the same clock time adds nothing. | PASS | Independent phase journey built both facilities through the server-time queue, accrued exactly `energy +20000000` and `compute +150000000` micro-units, verified an empty repeat, checked the center’s `accrual_settlement` reason, then completed a level-2 microgrid upgrade. |
| Cancel/interruption/retry boundary | Pre-finish cancellation returns the original refund exactly once; completion wins at the finish boundary and later reconciliation is idempotent. | PASS | Independent phase journey cancelled a research-lab job one millisecond before finish and observed a single persisted refund transaction on retry. API integration retained queue finish/refund/concurrency regressions. |
| Lazy accrual persistence and clock recovery | 24–36-hour storage windows, canonical fractional carry, no-energy cursor advance, exact same-time replay, and equal/backward-clock settlement cannot mutate state or create value. | PASS | Simulation/Python accrual fixtures and P2.8 property integration passed; P2.8 fixed persisted-cursor fixture tested equal, one-millisecond-earlier, and zero timestamps with unchanged cursor/carry and transaction count. |
| Seven- and thirty-day balance | All 2/10-intent full-ledger scenarios remain positive; engagement gap is strictly under 20% at 24/48/72-hour claims; delayed claims expose foregone facility production. | PASS | Direct P2.7 runner and complete integration checked 7 and 30 days. 30-day casual/active normalized values were `22961.42/23507.12` (24h), `7961.42/8507.12` (48h), and `2961.42/3507.12` (72h), respectively; each pair is positive and under the gate. |
| Center screen, invalid context, and service recovery | The visible center presents accessible status, exact estimates, resource reasons, shortage explanation, and safe unavailable-data recovery; API/worker shell can restart without temporary listeners. | PASS | Web test, production build, web smoke, and HTTP smoke all passed. The documented unconfigured context remains a safe 404 without a client-supplied profile identity. |
| Determinism, cleanup, and leak recovery | Fixed fixtures reproduce; temporary test databases and transient listeners do not outlive testing. | PASS | P2.7/P2.8 direct reruns passed fixed seeds. Final catalog found no migration, ledger, P2.7, P2.8, or phase-journey test database; no listeners remained on `3100`/`3101`. |

## Commands and results

| Command | Exit code | Result |
|---|---:|---|
| `py -3 -B .agents/skills/verify-game-phase/scripts/validate_plan.py GAME_PLAN.md` | 0 | Plan consistency passed. |
| `pnpm services:up; pnpm services:check` | 0 | PostgreSQL and Redis were healthy for the regression window. |
| `Push-Location apps/api; <PowerShell stdin TypeScript independent phase-journey probe>; pnpm exec tsx -; Pop-Location` | 0 | Fresh/unfunded, grant, build, hourly production, retry, center, upgrade, cancellation/refund-retry journey passed; disposable `nexus_p2_phase_lifecycle` was dropped in `finally`. |
| `pnpm --filter @nexus/api exec tsx --env-file-if-exists=../../.env scripts/p2-7-ledger-balance-integration.ts` | 0 | Fixed-seed 7/30-day × 24/48/72-hour full-ledger comparator passed. |
| `pnpm --filter @nexus/api exec tsx --env-file-if-exists=../../.env scripts/p2-8-property-integration.ts` | 0 | Fixed-seed underflow/overflow, concurrency, replay, clock rollback, and accrual-overflow property suite passed. |
| `pnpm --filter @nexus/web run test; pnpm --filter @nexus/web run build; node scripts/web-smoke.mjs; node scripts/http-smoke.mjs` | 0 | Center accessibility/recovery test, production web shell, API/worker health, correlation, and public-error contract passed. |
| `pnpm test:integration` (first attempt) | 1 | Interrupted runner: migration and ledger segments passed, then PostgreSQL connection terminated during P2.7. This invocation is not counted as a pass. |
| `pnpm services:check; pnpm test:integration; py -3 -c "import numpy; print(numpy.__version__)"; pnpm balance:check` | 0 | Clean retry passed migrations, ledger/queue/accrual/P2.7/P2.8 integration, NumPy `2.3.5`, and the economy audit. |
| `pnpm verify` | 0 | Lint, typecheck, all unit/fixture/web/API/worker checks, integration, deferred early-phase E2E command, balance audit, and plan check passed. |
| PostgreSQL catalog cleanup query plus `Get-NetTCPConnection` probe | 0 | All five disposable databases absent; no `3100`/`3101` listeners; only expected Compose service ports remained. |

## Findings

No P0 or P1 defect was observed. The initial chained integration interruption did not reproduce in a fresh healthy service window: the complete retry and the later `pnpm verify` both passed. It is retained above as interruption/retry evidence, not as a product failure.

## Not verified in this phase

- Full browser E2E is **NOT VERIFIED**: `pnpm test:e2e` explicitly reports `DEFERRED` because a complete browser game flow is not delivered before the interface phases. The Phase 2 server-authoritative player journey and delivered center screen were independently exercised; no future operation, contract, NPC, or Node Routing feature was required.
- Manual cross-browser matrix, keyboard/focus traversal beyond the automated center test, color-independent review, reduced motion, API/load/FPS benchmarks, worker/Redis 10,000-event resilience, backup/restore, SAST/dependency audit, and release acceptance are **NOT VERIFIED**. The plan assigns these to later UI, performance/security, or release phases.

