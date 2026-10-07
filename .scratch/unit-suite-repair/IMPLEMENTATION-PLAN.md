# 全仓单测修复 Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development within the project's coordinator + bounded Luna workflow. Preserve the local task ledger and existing uncommitted changes; do not commit without a user request.

State: closed
Status: accepted
Coordinator: /root
Accepted: 2026-10-06T22:39:08+08:00

**Goal:** Make bare `npm run test:unit` pass while preserving all tested product contracts and original trade data.

**Architecture:** Repair deterministic fixture inputs before considering production changes. Compare the previously failing complete files under a bounded worker pool with the saved full-suite red run; only adopt a worker bound after it resolves those failures without weakening assertions or extending timeouts.

**Tech Stack:** Node 26.0.0, Vitest 4.1.10, jsdom 29.1.1, React Testing Library.

**Spec:** Current user request and `README.md`, `DESIGN-COVERAGE.md`; exact cases in `reports/prior-failure-census.json`; current `docs/agents/development-workflow.md`; `docs/specs/2026-09-19-trading-room-domain.md`; approved chart-first contract remains unchanged.

## Global Constraints

- Preserve all existing assertions and test cases; no new skips or deleted failing cases.
- Do not increase default or per-test timeouts to obtain a pass.
- No product/UI changes without a deterministic red case, approved contract mapping, and applicable independent acceptance.
- Only temporary fixture storage; no formal SQLite writes, service restarts, deployments, commits, pushes, or merges.
- Luna (`gpt-5.6-luna`, medium) implements bounded file-disjoint changes; root independently reviews and runs integrated checks.
- Only root runs the integrated affected-files probe and full suite; no other heavy test process runs concurrently with final acceptance.

## Review Focus

1. Invalid trading dates must still fall through to the market-calendar date; retaining the available-quote assertion catches a regression to the later execution-derived date.
2. Old quotes must remain stale in product behavior; a fixed fixture date must not expand `staleAfterDays` or alter product clock semantics.
3. Full-suite resource contention must be distinguished from isolated async failures; any failure in the bounded affected-files probe reopens diagnosis.
4. CLI/process and UI tests keep their existing wall-clock budgets; a worker bound cannot conceal an isolated hung process.
5. Existing skipped cases must remain exactly the original six; completion requires no failures and no newly skipped cases.

## Task 1 — deterministic holdings fixture (R08)

Owner: unit_holdings. Allowed file: `app/lib/reviews/trading-room-holdings.test.ts` only.

- [x] Exact existing test is red, expected available / actual stale (`reports/holdings-red-20261006.log`).
- [x] Add `asOf: "2026-09-19T00:00:00.000Z"` only to the options of `falls through invalid source dates before applying the market calendar fallback`.
- [x] Preserve invalid `tradingDate`, valid `marketCalendarDate`, quote date, 30-day freshness window, and both existing status expectations.
- [x] Run the exact case and all 30 holdings cases; both pass with unchanged assertions (`reports/holdings-green-case.log`, `reports/holdings-green-full.log`).
- [x] Root reviewed the one-line fixture repair against `latestSourceTradingDate`, `quoteFreshness` and the current domain contract. Scoped spec/quality and final integrated acceptance pass (reports/full-unit-final-v2.log).

## Task 2 — affected complete-file concurrency probe (R01–R07, R09)

Owner: root; no product/test changes initially.

- [x] Save original full red run and diagnosis reports; representative workspace/import/recall/deploy cases pass independently.
- [x] Once diagnosis processes finish, run all nine previously failing complete files with `--maxWorkers=2` and the existing timeout values. Capture a JSON result and full log (`reports/affected-files.log`, `reports/affected-files.json`).
- [x] All existing cases in these nine files pass in reports/full-unit-final-v2.log after the recorded bounded repairs; the original affected-files probe remains preserved as red history.

R04 reopened diagnostic signal: the four-file serial probe produced 57/58 passes and a missing market-details button at the saved-summary test. Source review places this before any provider refresh in the local-market loading branch; the per-case mocks are both explicitly overwritten, so mock implementation leakage does not explain the failure. The nine-file two-worker probe passes all eight refresh tests without edits; retain the original failure and require full-suite confirmation.

Task 2 first result: 270 passed / 3 failed (273), 8/9 complete files green, 190.03s; `reports/affected-files.log` and `.json`. Remaining exact failures are all default-5s timeouts in `trade-review-workspace.test.tsx`: `retains a Recall drawing draft per episode and gates completion until a snapshot exists`, `keeps the latest Recall drawing draft while completion is gated`, and `keeps library context through a confirmed import with failed market refresh`. R01 is reopened; Task 3 is blocked pending exact-case diagnosis and repair. Owner unit_workspace is running the three-case one-worker probe and inspecting deterministic timer / accessible-query overhead. No UI/product change is indicated yet.

R01 bounded repair contract: `issues/01-workspace-implementation.md`. One-worker exact probe also fails all three at the unchanged 5s deadline. The drawing journeys wait a real 1000ms autosave timer; control that clock while preserving pending/saved/repository/remount/completion assertions. Scope queries to their real accessible regions without hidden queries or bypassed interactions. The confirmed-import journey may receive query scoping; any remaining blocked action needs timing diagnosis. Only the main workspace test file is owned by this worker.

R01 implementation reopened: fake-clock experiments exposed RTL's zero-delay drain needing Jest compatibility, then still failed saved-state waits. Worker reverted all experimental code. Current implementation uses real clocks with exact region/control query scoping and retains the real 1000ms autosave. This revised minimal contract supersedes the proposed clock implementation, with every acceptance assertion and the original timeout budgets intact. A post-import failure remains in `main.is-review`; it needs actual local-market read timing, not inference from the global navigation's library button. See the latest ruling in `issues/01-workspace-implementation.md` and `reports/import-readiness-followup.md`.

Ruling: after the three-case repair, reuse the unchanged eight-file green evidence and require the full modified 91-case file to pass at two workers; the final bare full-suite run supplies integrated evidence for all nine files. Repeating all eight unchanged files before the full suite would add no coverage. This updates Task 2's intermediate validation without removing any final gate.

## Task 3 — test runner resource bound (R10)

Owner: bounded Luna worker; allowed file `vitest.config.ts` only. Integrated acceptance remains dependent on Task 2 passing.

Scheduling ruling: the eight unchanged affected files pass at two workers, while all three remaining workspace cases also fail independently at one worker. Their repairs and the already-supported runner resource bound therefore own disjoint files and can proceed independently; a workspace repair is not a causal prerequisite for writing the runner bound. Root authorizes parallel implementation of this small config change, preserving the original full-suite gate. No claim that the bound resolves the three isolated failures is permitted.

- [x] Set test `maxWorkers: 2`, with a brief comment explaining jsdom plus child-process suite resource contention. Retain file isolation, timeout values, setup, includes, excludes and all other pre-existing deployment changes (`reports/runner-bound-implementation.md`).
- [x] Root reviews the two-line diff against `reports/vitest-config.before.txt` and confirms local Vitest's override semantics from installed source. No hardware/clock-dependent assertions or redundant configuration-text tests. Scoped code acceptance and the final bare command pass (reports/full-unit-final-v2.log).

## Task 4 — independent integrated acceptance

Owner: root, fresh independent review when worker slots are free.

- [x] Run bare `npm run test:unit` with no worker/timeout CLI overrides; collect log and machine-readable result if a reporter is configured without altering script semantics.
- [x] Require all 322 existing files collected, zero failures, and six pre-existing skips only. Record exact totals from output.
- [x] Run typecheck and scoped lint appropriate to changed TypeScript tests/config.
- [x] Run `make deploy-test` and `make debug-test` after Vitest completes; these cover all seven pre-existing native Node test files excluded from Vitest. Entrypoint and opt-in corpus audit: `reports/unit-entrypoint-audit.md`.
- [x] Review final scoped diff independently for spec compliance and quality, including absence of skip/assertion/timeout weakening and protection of previous uncommitted work.
- [x] Update local tickets, coverage and final acceptance together; report actual checks and no deployment/remote action.

## Historical dispatch / diagnosis rulings

The records below preserve earlier failures and pending gates as they occurred. The final acceptance at the end supersedes their status statements. Earlier Task 2 diagnosis above is also historical.

## Pre-flight consistency / rulings

| Tasks | Interface or shared file | Finding |
| --- | --- | --- |
| 1 / 2 | Fixed fixture is consumed by affected-file probe | Sequential dependency; no overlap |
| 2 / 3 | Probe evidence authorizes worker-bound adoption | Task 3 cannot start before green probe |
| 3 / 4 | Bare test command consumes runner config | Sequential dependency; root final check |
| 1 | Same named case, same expectations | Fixture clock repair only |
| 2 | Nine existing full files | No test-name filter may hide unselected cases |
| 3 | `vitest.config.ts` already dirty from earlier task | Preserve old diff; record the new hunk separately |
| 4 | Prior skips and coverage | Original failures stay in scope until all pass |

Ruling: retain the user/project local task directory and no-commit policy instead of generic skill plan paths or automatic commits. The current user request authorizes repair execution; no repeated confirmation is needed.

## Latest scoped refinement (supersedes historical implementation descriptions)

The two drawing cases now use only setTimeout/clearTimeout fake timers with shouldAdvanceTime, after real market/bootstrap readiness, with real interactions, actual 1000ms debounce advancement under React act, all pending/saved/repository/reopen/gate assertions, and failure-safe real-clock restoration. Root found a missing document-membership assertion in the import candidate and returned it to the sole testfile owner for restoration.

Independent probes show first drawing passes at 4680ms and confirmed-import still fails at 5211ms. Apply final exact query scopes, and add a disjoint test-only adapter optimization (R11, issue06): parallelize independent real IDB readonly getters while preserving return shapes, coverage records and errors. Root will run both worker-count three-case probes, all 91 modified-file cases, and the bare full suite after both candidates are frozen. The adapter is also consumed by four other workspace files; the full suite must validate those consumers. No extra skips, assertion removals, path bypass, product edits or timeout increases are authorized.

## Full-suite failure closure ruling

The frozen three-case one/two-worker probes and full 91-case file passed, but reports/full-unit-final.log finished FAIL: 3062 passed / 2 failed / 6 existing skips, 488.87s. Complete stacks identify import-toolbar readiness (3163ms) and canonical alias preference persistence (668ms). Preserve this run; it is not accepted integration evidence.

R01 owner unit_workspace_finish now waits for the actual confirmation dialog to disappear after merge3 observation, then awaits the currently mounted Recall and original toolbar membership before actual return/search assertions. R12 owner unit_market_adapter wraps only the original exact persisted JSON assertion in default waitFor after the deferred loader and three existing UI checks. Both changes preserve original fixtures, case/wait defaults and every assertion. Reports/workspace-alias-synchronization-v2.log passes the complete four-case alias file plus the exact import case: 5 passed; 90 main-file cases unselected by filter.

The next bare full-suite run covers the complete 91-case file again, all adapter consumers, and every prior failed file. Do not redundantly run the 91-case file separately after this minimal synchronization delta. Typecheck, scoped lint, independent review of these deltas, then all native unit entrypoints remain required.

## Native debug fixture closure ruling

Bare full-unit-final-v2.log passes 3064 tests, 319 files, with the same six corpus skips / three corpus files and no failures; all five frozen source hashes remain unchanged. make deploy-test also passes 57/57. make debug-test fails 5/15 because non-port scenarios use the real occupied3333 host probe before reaching their actual backup/launch/cancellation assertions. Production refusal and preview service are correct.

R13 (issue08) assigns unit_market_adapter the sole previously-untracked scripts/debug-local.test.mjs file. Inject existing isPortOccupied:false function only in six non-port calls; retain the explicit occupied=true rejection case, all real temporary SQLite records/backups and original assertions. Fresh make debug-test under the still-running3333 service plus independent exact-delta review are required. Existing full-unit/typecheck/lint and deploy-native evidence stays valid: no compiled source or Vitest-collected file changes in this final disjoint repair.

## Final coordinated acceptance

All plan gates are complete. Bare Vitest collects all322 existing files:319 PASS/3 existing corpus skips;3064 PASS/0 FAIL/6 existing corpus skips,449.66s (`reports/full-unit-final-v2.log`). Native deploy57/57 and native debug15/15 pass; the shared4 environment tests occur in both entrypoints and are not unique additional cases. Typecheck/scoped lint/whitespace/source-freeze checks pass. Root read and accepted all four independent reviews: scoped holdings/config, main/adapter, final synchronization and exact debug-port delta. R13 only changes an excluded native test file, so the frozen full-unit evidence remains valid.

No production source, formal data/service, deployment or remote actions were changed by this task. All coverage rows and issue records are accepted together with FINAL-ACCEPTANCE.md. Earlier FAIL logs and discarded experiments remain archived and are not active acceptance failures.
