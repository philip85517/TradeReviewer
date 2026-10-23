# P3 attachment integration — worker freeze for independent root review

**Implementation frozen for root review, not accepted delivery. P3 formal 0/3; P1 formal 2/3 FAIL.** No commit, service/browser/database operation, network, full-suite run, performance work or child agent. Root approved the interface before edits and later approved conditional strict Recall reads. Scope and original reference mapping remain `ROOT-DISPATCH.md` / root `DESIGN-COVERAGE.md`; local controls and eight states are recorded in `CONTROL-INVENTORY.md`.

## Product and test ownership

Exact final content is bound by `FINAL-MANIFEST.json`, generated 2026-10-22T22:42:59Z at detached git HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. Seven product files:

| File under app/components | Final responsibility |
| --- | --- |
| homepage-v25/attachment-groups.ts | Complete episode-coverage evidence and exact account/instrument/nature/run selection; one canonical rebuilt entry per instrument from all eligible whole-group fills; no account×instrument widening |
| homepage-v25/holdings-model.ts | Reuse canonical current quantity projection; expose shared selection; holdings and CSV consume selected entries; no new financial formula |
| homepage-v25/session-model.ts | Read provenance helper validates source schema and market/accounts/date scope compatibility; source-to-symbol narrowing allowed; S token and state authority unchanged; successful apply resets holdings page |
| homepage-v25/use-homepage-host.ts | S-owned draft/apply/clear/reset/cancel/remove; immutable request/readTarget provenance; accepted collection target; complete sources retained through fresh catalog fallback |
| homepage-v25/home-surface.tsx | Real attachment trigger/popover/actions, applied badge and removable tokens; transient open/submission state only |
| homepage-v25/home-surface.css | Attachment anchor, badge/tokens and <=600 fixed popover reachability; original attachment-filter CSS unchanged |
| trade-review-workspace.tsx | Owned bootstrap + conditional strict Recall summary; final-scope qualification for homepage/ordinary; existing review baseline/draft protections retained |

Four independent new tests: `homepage-v25/attachment-integration.test.ts`, `attachment-host.test.tsx`, `attachment-surface.test.tsx`, `attachment-workspace.test.tsx`. Sixteen protected baseline files in the manifest remain byte-identical, including existing Workspace/Surface/host/session/filter/group/holdings/search/navigation tests, attachment-filter implementation/CSS and S state module. `protectedViolations: []`. No tests were edited/deleted/skipped and no existing expectations changed; the 91 nonselected old Workspace tests are solely the explicit `-t` filter, not added skips.

## Authority and final data flow

| Owner | Reads | Writes / acceptance boundary |
| --- | --- | --- |
| Existing S/session | C, D, source snapshots, generations, identity/deadline/recovery | Sole C/D/UI authority; accepted apply then holdings page1. No separate applied filter state; no business DB write |
| Host | Exact S token + validated compatible source bytes; fresh owned catalog/data | `readTarget` is request provenance, not `token.target`; source schema/market/accounts/range/from/to/date match required. Global/unrelated native `/trades` does not inherit source filters. Fresh missing account falls back remaining/all before final consumer selection |
| Workspace owned read | Bootstrap; home FX/market data; strict Recall summary iff pendingReview has exactly one boolean | Required summary failure rejects entire bundle. No/both predicate returns `reviewSummariesComplete:false`; ambient summaries cannot establish complete coverage. Cancel/supersession ignore late whole bundle. Full source histories survive catalog validation |
| Shared qualification | Full exact composite groups, canonical asOf quantity, trusted category and owned coverage | Unknown category/open stays unknown; pending=false requires complete history and authoritative summary read. pending=true has the explicit existing reviewState default boundary below. No period truncation before eligibility. Holdings/CSV/accurate ordinary use this selection |
| Ordinary collection | Accepted final collectionTarget + complete owned sources, exact catalog symbol IDs | Owned collection read avoids FX/market hydration; existing unrelated ambient FX GET/daily-cache effects still exist and are not claimed absent |
| Existing detail/Recall/replay owners | Exact selected episode and real Recall response parser | No auto-first; no library/replay or business save implementation changed. Existing review baseline/CAS/nav-save guards remain. Actual write/persistence acceptance remains root's P1 gate |

Return chain: filter success → exact AX detail → 查看交易 with HKEX:X native URL/source → fresh compatible collection target → only AX explicit episode → guarded return to collection → fresh home bootstrap/strict summaries → source UI restore → remount/source reload. Host/Workspace fixtures prove this bounded chain with actual production components and real summary/Recall parsers; no actual browser reload or SQLite/server save claim.

### pendingFact evidence limit (root review item)

The helper first evaluates applicable episodes with existing `reviewState(item)`, then checks coverage only if none returned pending. `reviewState` prioritizes Recall status, otherwise legacy completed/deferred state, and defaults to pending when both records are absent. Consequently, `summariesComplete=false` plus an otherwise applicable episode with no records returns pending=true, **not unknown**, even though episode coverage is incomplete. Current new tests do not establish the stronger raw-helper unknown contract, and the implementation does not provide it. Known pending here means the existing business review-state classification; it does not always mean an explicit pending record was fetched.

The actual restrictive path supplies the missing provenance: owned readTarget with one pending boolean → mandatory fresh summary fetch alongside bootstrap → failure rejects entire read → only success builds/accepts entries. In that path a missing summary row follows successful authoritative list retrieval and the existing semantics treat that episode as not reviewed. No/both values do not request strict summaries, explicitly set complete=false, and do not use pending as an eligibility restriction. Root must judge this call-chain boundary; a future pure-helper consumer cannot assume raw incomplete/no-record inputs become unknown. This is an explicit limitation, not a late product repair or broader acceptance claim.

## Final bounded verification

All listed commands used `/usr/local/Cellar/node/26.0.0/bin/node` from repository cwd; each final run returned exit 0. Earlier RED/intermediate failures remain alongside the final logs.

| Evidence | Command / selection | Result |
| --- | --- | --- |
| REGRESSION-bounded.log | `node_modules/vitest/vitest.mjs run` new attachment-integration/host/surface plus original attachment-groups, holdings-model, session-model, use-homepage-host, navigation-recovery/deadline, home-surface, attachment-filter, search-surface/recovery, catalog-model tests | 14 files, 122/122 PASS, 21.72s |
| REGRESSION-workspace.log | `node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.test.tsx -t 'production homepage holding detail\|failed cold scoped collection\|committed homepage scope on an independent FX\|owned metadata-only directory\|bare global browsing compatible\|nondefault homepage navigation scope\|genuine aliases HTTP failure\|older homepage read finishes\|typed draft after a caller CAS conflict\|parent review mounted until a failed navigation save'` | 10 selected PASS, 91 not selected, 28.38s |
| GREEN-workspace-final.log | `node_modules/vitest/vitest.mjs run app/components/homepage-v25/attachment-workspace.test.tsx` | 4/4 PASS, 16.25s |
| TYPECHECK-final.log | `node_modules/typescript/bin/tsc --noEmit` | exit 0, no diagnostics |
| LINT-final.log | `node_modules/eslint/bin/eslint.js` six owned TS/TSX product files plus four new tests (10 files total; CSS excluded) | exit 0, 0 errors, 11 warnings |

The lint warnings are existing Surface detailId effect dependency and Workspace unused imports/helper, hook dependencies, ref cleanup, and unused disable directive. They were retained within the approved scope; this is not a warning-free lint claim. Final product changes after successful tests were type-boundary copies/status normalization and replacement of effect/ref popover visibility bookkeeping; the final bounded and Workspace runs above are after these changes.

New Workspace four cases explicitly establish: (1) no/both pending values do not require another strict summary read even if ambient summary loading fails; (2) required fresh summary 503 rejects the bundle, retry selects AX/BY, exact ordinary excludes BX/Y, explicit AX enters the real Recall parser, fresh return/remount restore selected C; (3) cold compatible pending=false source accepts fresh completed BX with no extra owned FX/market reads; (4) canceled old summary response cannot overwrite a newer successful false predicate. All are mock transport/fake-indexeddb fixtures. No successful Recall PUT is used as proof of persistence.

Preserved failure evidence: RED-model/host/surface/workspace/projection; GREEN-host first scope-key failure and GREEN-workspace intermediate r1–r11 fixture/projection failures; initial typecheck/lint failures and later repairs. The duplicate-instrument canonical projection failure is preserved by `RED-projection.log` and fixed by merging eligible fills once before the canonical builder. Workspace transport fixture initially allowed native relative-URL fetch captured at module initialization; only the new test installs the hoisted stub before imports, keeping existing tests unchanged. No old #10/#11 business failure is canceled by obsolete selector classification; root's supplied migration classification is recorded in the proposal.

## Root acceptance remaining

Root independently reviews the whole-group projection, strict summary/coverage boundary, source compatibility and final-account fallback, then executes its directed tests. Real filter→detail→accurate ordinary→explicit round→guarded return→reload on the same isolated DB remains required, including actual Recall save under P1. Real mouse/keyboard/touch and original-reference visual comparison are NOT VERIFIED by this worker. No live-preview URL or startup evidence is claimed.

Four-zone shared qualification consumers, actual from/to period and history-four-mode/contribution restoration, financial page correctness and full data/persistence/visual gates remain FAIL / NOT VERIFIED under the original scope and later owners. Root must update feature README/final acceptance together if any formal issue status changes. The worker has not changed formal counters, accepted the feature, or converted unresolved gates to N/A.
