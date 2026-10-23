# Domain host candidate1 — implementation frozen, root acceptance pending

2026-10-23 11:24 CST; worker `/root/metrics_candidate2`; actual `gpt-6.1-sol` / `ultra`.

New configured three-domain capability candidate1 is ready for root's independent acceptance. This is implementation evidence, not feature acceptance. New capability formal rounds remain 0/3 until root records its first decision. P1 2/3 FAIL, old global/navigation/source FAIL and NOT VERIFIED, MetricCards candidate3 and HistoryStatsCards candidate1 statuses remain unchanged. Neither frozen leaf was edited.

## Approved boundary and resulting behavior

Root explicitly approved the exact proposal before implementation; see `ROOT-APPROVAL.md`. Proposal SHA256 remains `f84cbf3e5483ae03af73dbe1cee6688cb311dc16ea102b3f2423ef180f383e43`.

Configured sessions now contain complete opaque global/current, period, and history packages. S remains the only range and acceptance authority. A matching local completion publishes its applied label and its complete slot in one session update, preserving global/current and the other slot. Global starts invalidate both local owners first. Global acceptance projects restored source UI once and replaces the complete package in one session publication; a failing `fromGlobal` extractor leaves old labels and all old data in place.

Period/history have separate typed loaders, complete echoed owner validation, retry/cancel/error/timeout ownership, and separate accepted notifications. UI-only updates issue no read and do not extend deadlines. Configured global and both local paths enforce the original absolute 15,000 ms cutoff, including checking the clock when a response arrives before its scheduled timer runs. Legacy unconfigured 15,010 ms policy remains; this ticket does not repair or close the old boundary failure. Legacy `onReadAccepted(data)` receives only global/collection acceptance; local results cannot become Workspace bootstrap data. Notification exceptions cannot reverse accepted state.

Existing Workspace and Surface call sites are unchanged. Domain configuration and both seeds are mount-time capabilities. A future caller must provide both complete seeds, pure `fromGlobal`, both typed loaders, and render the applied label and opaque package from the same session. Financial identity/as-of/currency/quality evidence belongs to those upstream packages; this protocol does not calculate or certify it. Review/drawing CAS and daily-only merge remain in Workspace.

## Exact frozen version

HEAD at dispatch: `5a94ee3ff76e32993fe2c4791a83b40e877a7344` (detached). All four files were already untracked at dispatch and remain untracked. `SOURCE-SNAPSHOT.patch` is a full snapshot against `/dev/null`, not a fabricated tracked before/after diff. `DESIGN-BASELINE.json` retains their actual pre-implementation fingerprints.

| File | SHA256 |
| --- | --- |
| `app/components/homepage-v25/session-model.ts` | `5ae3597d31f51122e6666bfa1869ea45a804914d16a12eca8d7f14eb44023b64` |
| `app/components/homepage-v25/session-model.test.ts` | `4a9a30e707f2288c044a4d1341d7e2645f5b25849dbe45b2118126c0b0a211a9` |
| `app/components/homepage-v25/use-homepage-host.ts` | `bf9a5b1cadffbba59807923f503757df38ff0803d00d8d11d0d754a99e332da1` |
| `app/components/homepage-v25/use-homepage-host.test.tsx` | `6359aad6abad0abb69eef65702654ac6be5de0b3c2478f74d334baa2e8eebc05` |

`FROZEN-SOURCE-SHA256.json` also compares the protected S source/test, Workspace, both frozen three-file leaves, dispatch, and proposal against their pre-write fingerprints: all 11 match. This is a finite protected-file comparison, not a claim to have audited every unrelated concurrent file.

## Actual RED → GREEN and checks

| Evidence | Actual result |
| --- | --- |
| `RED.log` | Original 28 cases PASS; 42 new cases FAIL (70 total) on the original implementation. Missing slots/actions and configured acceptance/range behavior, not a test setup error. |
| `GREEN-ATTEMPT-1.log` | 70/70 PASS after implementation. |
| `RED-GUARDED-INVALID-EXIT.log` | Additional real popstate counterexample: 1 FAIL / 53 skipped. Accepted invalid collection address left new local owners active. |
| `GREEN-FINAL.log` | 71/71 PASS: 17 session + 54 hook; original 4 + 24 retained; 43 new cases. 10.46 s. |
| `TSC-FINAL.log` | Scoped strict dependency TypeScript check, exit 0 (empty log). |
| `LINT-FINAL.log` | Exact four assigned files, exit 0 (empty log). |
| `NARROW-LEGACY-REGRESSION.log` | Existing navigation-deadline, navigation-recovery, attachment-host suites: 3 files / 30 cases PASS, 14.10 s. This finite regression does not close any old host FAIL. |

Earlier type/lint attempts and their corrections remain preserved. Literal-key widening, render-time ref access, and unused test parameters were fixed; no original business assertion was removed or weakened. Self-review of accepted invalid address exit resulted in a real RED before its product correction.

Exact commands, repo working directory:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/session-model.test.ts app/components/homepage-v25/use-homepage-host.test.tsx --maxWorkers=1
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/domain-host/tsconfig.scoped.json --pretty false
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/eslint/bin/eslint.js app/components/homepage-v25/session-model.ts app/components/homepage-v25/session-model.test.ts app/components/homepage-v25/use-homepage-host.ts app/components/homepage-v25/use-homepage-host.test.tsx
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run app/components/homepage-v25/navigation-deadline.test.tsx app/components/homepage-v25/navigation-recovery.test.tsx app/components/homepage-v25/attachment-host.test.tsx --maxWorkers=1
```

`tsconfig.scoped.json` extends the repository config, sets `strict: true`, `incremental: false`, `noEmit: true`, and explicitly includes only the four assigned files; normal imports include the transitive S/library/type dependencies. It is not a full Workspace/page TypeScript check. All commands completed; no test process remains active from this worker. No service, browser, DB, performance, or build command was run.

## Version-bound control/data audit

Trigger: changed frontend data/state wiring. Scope is the session/hook capability and its affected protocol journeys; this package adds no visible UI and does not connect Surface/Workspace. Read-before-write references: approved `source/visual-design.candidate.md` HP02:193–252, HP05:349–432, HP06:434–465, HP09:467–515; `period.svg`, `journeys-year.svg`, `history-stats-error.svg`, `loading--stale-data.svg`, `error--update-failure.svg`, `library-return.svg` under `docs/design-system/baselines/2026-10-22-homepage-v2.5/`.

Requirement mapping is the dispatched matrix locator set: HV25-14..22/33..43/44..49/53/55, HOME-HP02-B001/B020/B024, HOME-HP05-B001, HOME-HP06-B018/B016, HOME-HP09-B001/B028. Original references without a separate stable per-control ID retain these existing matrix locators. Root owns the integrated visual consistency and complete persistence flow.

| Scoped journey / contract | Worker evidence at frozen version | Independent acceptance |
| --- | --- | --- |
| P/H concurrent, either completion order; each whole slot with its own applied label; global/current and other slot unchanged | Session both orders and hook rendered-session observations, all fields of opaque card/series/contribution fixtures | PENDING ROOT |
| Global identity/refresh/apply starts cancel P/H; late local data/notifications blocked | Session + real hook parameterized cases | PENDING ROOT |
| Same-domain supersession; malformed owner domain/generation/scopeKey/startedAt; same-owner wrong target | Session and hook malformed transport counterexamples; S rejects target mismatch | PENDING ROOT |
| Failure preserves old complete label/data; independent retry/cancel and drafts; original absolute deadlines | Hook real controlled deferred responses and fake-clock boundary cases, including response-time checks | PENDING ROOT |
| Chart/contribution/filter/sort/drill/page updates issue no reads or timer extension; history does not force chart/contribution mode | Hook checks both payload render identities, loader counts, modes and deadlines | PENDING ROOT |
| Global extractor throws: no partial bundle/new label; notification throws: accepted P/H state remains accepted | Root-requested concrete hook cases PASS | PENDING ROOT |
| Collection-only preserves both home slots; global source restore/fallback ranges equal actual committed snapshot | Root-requested concrete hook cases PASS; original collection/source assertions retained | PENDING ROOT |
| Ambient options are mount seeds; UI storage has no financial payload | Hook rerender and serialized-content cases PASS | PENDING ROOT |
| Unmount/disable/accepted route exit invalidate local ownership; cancelled guard preserves owner; accepted invalid pop cancels locals | Real hook/unmount/rerender/route and real PopStateEvent counterexamples PASS | PENDING ROOT |
| Legacy caller and narrow global/source/navigation/attachment behavior | Original 28 + existing narrow 30 PASS; old unresolved FAIL retained | PENDING ROOT, finite scope |

Author self-review is finite and is not independent acceptance. No new in-scope failure remains in these exercised protocol cases; unexercised end-to-end gates remain explicit below.

## Limits and outstanding gates

- Full Surface integration, financial payload correctness, actual cards/curves/contributions, real source/return persistence and reload: **NOT VERIFIED**, root future wiring/acceptance. Callback fixtures do not prove live financial data or Workspace integration.
- New visible UI, screenshot comparison, mouse/keyboard/touch controls and DB writes: **NOT APPLICABLE to this non-visible protocol package**, not an exception for future integrated UI. There is no new preview/service to link; browser/service operations were prohibited here.
- Root independent candidate1 review: **PENDING**. This worker does not declare formal PASS or close any previously recorded FAIL/NOT VERIFIED.
- Only the four assigned files and new evidence in this directory were written. No S, Workspace, Surface, financial code, leaves, config, DB, services, shared tracker, old evidence, agents, commits or benchmarks.

Freeze rule: no further writes to the four product/test files until root's independent acceptance feedback explicitly authorizes them. HistoryStatsCards candidate2 remains a separate pending dispatch after this freeze; the already recorded one-decimal display defect was not edited here.
