# Chart candidate 2 — focus lifetime repair, worker handoff

- Owner: `/root/chart_focus_fix`, dispatched actual `gpt-6.1-sol / ultra`; root `/root` owns whole-page visual consistency, complete data/persistence flow and independent acceptance.
- Worktree: `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`; detached HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. Verification: 2026-10-23 06:53–06:55 Asia/Shanghai; final freeze timestamp is in `source-freeze.json`.
- Status: **implementation-ready, pending root acceptance**. Chart leaf root round 1/3 FAIL remains recorded in `../ROOT-CANDIDATE1-ACCEPTANCE.md`. This candidate does not increment/reset a round or supersede prior evidence. P2 page remains 0/3 and P1 2/3 FAIL. If the same task reaches round 3 FAIL/required NV, pause it as instructed.
- Allowed writes: the three chart files plus this new `candidate2/` directory. Actual product changes are TSX and append-only tests; CSS is byte-identical. No other product/test/configuration/dependency files, shared tracker, old evidence, service, browser, network, DB, subagent or commit was changed/used.

## Contract and diagnosis

Read current AGENTS and all five project workflow documents named in the dispatch, the systematic-debugging/TDD skills and writing-good-tests reference. Read original `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:223–249` and `component-manual.html:872–959`, plus `ROOT-DISPATCH.md`, `CONTROL-STATE-MAP.md`, root rejection, independent review and its actual counterexample/runner. Directly viewed original-derived hover, keyboard and tooltip-atom PNGs. These are reference images, not rendered product evidence.

Requirement HV25-19 / HOME-HP02-B030 (no original element ID): keyboard focus shows detail immediately and keeps its reading location until actual focus exit, pin action or Esc. The approved 264px natural-height/padding12 chart contract and authorized below-stage fallback are retained. No size, hierarchy, placement or data authority changes were introduced.

CH-IR-01 root cause was the common `leave` path: point/gap leave queued an unconditional 100ms hide even while a chart/detail node owned focus. The detail-only mouse-leave check protected only focus already present at that event; focus entering during an already queued hide remained vulnerable. The unchanged independent counterexample reproduced 1 FAIL / 1 PASS before editing production code.

The repair centralizes pointer-hide cancellation, checks actual active focus inside the chart root before scheduling hide, and checks again when the 100ms callback runs. Root focus capture cancels a queued pointer hide when any chart/detail reading control receives focus. Date-detail pointer enter/leave uses the same helper/path. Actual focus leaving still closes an unpinned detail; pinning, Esc suppression/reentry, 300ms show, controlled-generation reset and unmount cleanup retain their existing paths.

## RED / GREEN and command evidence

Exact commands and exit codes are in [commands.json](commands.json); every command redirects its own stdout/stderr to the linked log without overwriting earlier evidence.

| Log | Exit | Observed result |
| --- | ---: | --- |
| [01-RED-focus-lifetime.log](01-RED-focus-lifetime.log) | 1 | 5 FAIL / 29 PASS; all five appended focus-lifetime cases fail by missing tooltip after 100ms |
| [02-RED-independent-counterexample.log](02-RED-independent-counterexample.log) | 1 | 1 FAIL / 1 PASS; original point-leave counterexample reproduced |
| [03-GREEN-chart-tests.log](03-GREEN-chart-tests.log) | 0 | 34 PASS; original 29 plus five appended cases |
| [04-GREEN-independent-counterexample.log](04-GREEN-independent-counterexample.log) | 0 | 2 PASS; original independent file and runner unchanged |
| [05-typecheck.log](05-typecheck.log) | 0 | strict scoped check, empty diagnostics |
| [06-eslint.log](06-eslint.log) | 0 | scoped lint, empty diagnostics |

All five new cases failed before the TSX repair because the real rendered tooltip was gone after the hide deadline, rather than a setup/type error. They use actual DOM `.focus()` and assert retained DOM focus/readout. The added cases cover graph focus, amount/source focus, focus entering 50ms after point leave, focus entering 50ms after detail leave, and focused gap reason with Esc exit. The two queued-hide cases also verify subsequent actual focus exit closes detail.

The 29 original tests and assertions are preserved byte for byte as the exact 27,104-byte prefix of the final file; see [preservation.json](preservation.json). They continue to cover pointer-only 299/300ms show and 99/100ms hide, keyboard navigation, pin/Esc/reentry, focus-out, controlled data/read-state reset, timer cleanup and financial display/gap/future/geometry behavior. [product.diff](product.diff) shows the complete candidate1-to-candidate2 change. The existing Node `[DEP0205] module.register()` deprecation warning appears in test logs; no unhandled test errors occurred. No full suite or performance run was executed, per the bounded dispatch. Type checking includes only the chart, its test and existing setup, with transitive imports, strict true and incremental false; it is not a whole-repository check.

## Version-bound control impact and boundaries

Trigger: repair to frontend pointer/keyboard interaction. Inventory is the existing `../CONTROL-STATE-MAP.md`, bound to this candidate's three-file SHA manifest. Dynamic point instances remain every eligible `point.key`, gap instances every contiguous unavailable date/state run, and amount/source controls six per shown detail. Synthetic fixtures are explicitly separate from actual B/page data; no builder/current/IO is used by the new tests.

| ID / scope | Journey and expected state | Synthetic evidence | Real input / independent acceptance |
| --- | --- | --- | --- |
| CH-HOVER / all eligible point hotspots | Hover300ms; pointer-only leave100ms; focus inside chart/detail keeps readout | Original timing test plus five new focus cases PASS | Mouse timing NOT VERIFIED / root |
| CH-FOCUS / graph keyboard entry | Actual graph focus survives point leave with same date detail; focus-out closes | New graph case + original focus-out PASS | Real keyboard NOT VERIFIED / root |
| CH-ORIGINAL / six values per detail | Focused amount/source is not unmounted; focus arriving during queued point/detail hide is retained | MarketValue focused in new tests; original six-field order/source tests PASS; no claim all six newly exercised | Real keyboard/source reading NOT VERIFIED / root |
| CH-REASON / contiguous gap controls | Keyboard-focused missing-date reason survives pointer leave; Esc closes and focus stays | New real-DOM-focus gap case PASS | Real gap focus/visual NOT VERIFIED / root |
| CH-PIN / Esc / reentry | Pin ignores unrelated hover; Esc closes, suppresses until reentry | Original unchanged tests and new gap Esc PASS | Real mouse/keyboard NOT VERIFIED / root |
| CH-DISABLED/LOADING/EMPTY/ERROR/FUTURE | Controlled reset/no stale values, gap/future behavior retained | Original unchanged tests PASS; no producer or authority changes | Integrated states NOT VERIFIED / root |
| Default / expanded / longtext / ambiguous | Existing natural layout, long evidence and deterministic date partition unchanged | Original geometry/content regressions PASS; CSS byte-identical | Matching-state visual and all viewport boundaries NOT VERIFIED / root |

Applicable state space remains normal, selected, expanded, empty, loading, error and longtext; dense/ambiguous point behavior remains the documented deterministic nearest-date partition. No state or viewport was newly excluded. Source inspection/tests are not real-operation coverage: this worker performed **0 real browser actions**, so real mouse, keyboard, emulated touch and physical touch each remain NOT VERIFIED and contribute zero to their respective coverage numerators. Their complete denominators are root's frozen dynamic browser inventory; this report does not claim 100% control coverage.

No service/port/URL, CSS viewport/DPR/zoom/scroll, product screenshot or browser timing evidence was produced because these were explicitly prohibited in this worker scope. Root must independently check the repaired mixed-input journey and matching-state layout at the approved widths/states, including before/during/after detail lifetime, long sources and next-module boundaries. This report does not substitute tests or byte-identical CSS for visual acceptance.

| Gate | Worker result | Required remaining evidence / owner |
| --- | --- | --- |
| Component behavior / strict scoped types / lint | PASS, three-file version-bound | Root direct review/reproduction before leaf acceptance |
| CH-IR-01 independent counterexample file | 2/2 PASS in worker rerun | Root independently reruns against freeze; prior 1/3 FAIL history retained |
| Page end-to-end / financial atomic updates / navigation / full state chain | NOT VERIFIED | Outside leaf authorization, root |
| Independent visual fidelity / 1440/1280/390 / next-module flow | NOT VERIFIED | Root, who did not implement this repair |
| Real mouse / real keyboard / emulated touch / physical touch | NOT VERIFIED, each distinct | Root acceptance evidence |
| Leaf DB writes / original business data | NOT APPLICABLE | This read-only leaf has no IO/callback/persistence and no DB was opened; page write gates unchanged |
| A performance / P2 / P4 | Unchanged | Existing FAIL/NV retained; no gate released |

## Final product fingerprints

| Product file | SHA-256 |
| --- | --- |
| `app/components/homepage-v25/performance-chart.tsx` | `387434f05ffded9744742d66a11abd761f2ec1a2c67b0b8117ef971f269e834c` |
| `app/components/homepage-v25/performance-chart.css` | `849139d7b76fc49a460b01c75f8e1991a002e2eb25c49ffa150f4f700e5c97e0` |
| `app/components/homepage-v25/performance-chart.test.tsx` | `0576c260323318752063a26baa5d7eae1e0a3fb4577cfd6b69cd74e15e9529dc` |

`source-freeze.json` binds these contents and command-log hashes. Worker stops all writes after that final freeze and hands the same leaf candidate to root. No preview/service or complete-UI claim is made.
