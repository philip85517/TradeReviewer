# HistoryStatsCards candidate2 — pre-edit coverage and bounded repair

2026-10-23. Implementer `/root/metrics_candidate2`, actual GPT-6.1 SOL / ultra. Same leaf, second candidate; formal round1/3 remains FAIL. P4 whole-ticket0/3 unchanged. Root owns integrated visual consistency and complete data/persistence flow and independently accepts this candidate. No design deviation or new approval is needed for the explicitly dispatched correction.

## Trigger, scope and cause

The semantic trigger is a frontend layout/precision regression; `docs/agents/frontend-control-audit.md` applies. Root's candidate1 real 1440×1000/DPR1/100% comparison found the submitted `64.285714285714285714` percentage rendered without bounded formatting, yielding a 393px DOM number in a 161.234px space and hiding `%` behind ellipsis. `ROOT-ACCEPTANCE-1.md` and its original screenshot/geometry remain historical FAIL evidence. This candidate changes only the primary percentage display; complete AX/detail readings retain the submitted string.

Allowed sources: `app/components/homepage-v25/history-stats-cards.{tsx,css,test.tsx}`. Evidence writes only here. All other source, host/session, MetricCards, Bars, financial logic, services, configuration, database, shared trackers and old evidence are outside this candidate's write scope. No browser, network, performance run, commit or subagent. Database-write gate is NOT APPLICABLE for this read-only leaf; actual whole-page financial/range/persistence journeys remain NOT VERIFIED and belong to root.

## Original references read before implementation

Approved source: `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`, HP05 lines349–394, HP09 lines467–515 and HP08 lines516–549. Original SVG sources read: `images/history.svg`, `history-stats-win.svg`, `history-stats-rounds.svg`, `history-stats-empty.svg`, `history-stats-error.svg`, `history-stats-source-missing.svg`, `history-stats-extreme.svg`, `atoms.svg`, `visual-samples-board.svg`. The seven original historical SVG-derived reference PNGs in `evidence/continue-2026-10-23/history-references/` were directly viewed. A/B win-card examples are explicitly in `visual-samples-board.svg`; the public atoms source was also inspected. These are design references, not rendered-product evidence.

Current repository workflow, decomposition, UI templates, issue tracking and frontend-control audit govern the work. Original `ROOT-DISPATCH.md`, `ROOT-ACCEPTANCE-1.md`, `ROOT-CANDIDATE2-DISPATCH.md`, `P4/ROOT-FINANCIAL-DECISIONS.md`, candidate1 control/state map and exact current sources were read. Review/debugging/TDD/verification skills apply, with the explicit targeted-check scope overriding a generic whole-suite suggestion.

## Requirement / element / journey / acceptance map

The original text provides chapter/block locators, not stable SVG element IDs. Existing IDs are retained; no invented original element identity.

| Existing IDs / locators | Approved requirement and exact reference | Owner and journey | Candidate2 acceptance evidence |
| --- | --- | --- | --- |
| HV25-32/33/35; HOME-HP05-B001; HS01 | Four equal cards in net/rounds/rate/fees order; normal rate64.3% with9/14. HP05:349–357, `history.svg`, `history-stats-win.svg`, `history-stats-rounds.svg` | Worker displays committed readings; root whole-page review | Real new RED on the frozen64.285714285714285714 input; GREEN primary64.3%, raw AX/detail exact; root fresh rendered comparison NOT VERIFIED |
| Same IDs; HS02/03/11 | Genuine0% and100%; bounded primary presentation and exact original full reading. HP05 win-card A/B paragraph, `history-stats-extreme.svg`, public samples | Worker formatting only; supplied percentage independent from wins/rounds | Literal lower/upper rounding, independently submitted counts, raw trailing-zero endpoint precision; no percentage calculation |
| HV25-47–51; HOME-HP09-B001/B031; HS04–10/12 | Empty0 rounds with unknown rate, independent knownness, pending old complete summary, failure reason, currency scope. HP09:467–506; empty/error/source-missing references | Worker leaf; root eventual complete range/source chain | Preserve all29 original cases; add invalid/unavailable percentages, unrelated readings preserved; browser states NOT VERIFIED |
| HV25-32/33/35/47–51; HS13/14 | Four distinct read-only detail triggers and context/focus lifetime. HP08:516–549, original leaf dispatch | Worker implementation and synthetic regression; root native mouse/key review | Preserve source/currency/generation invalidation, four dialogs, Tab/Enter/Space/Esc/outside and exact focus tests; native mouse/key NOT VERIFIED for new hashes |
| HV25-47–51; HOME-HP09-B031; HS15 |160ms opacity/4px popover lifecycle,120ms hover color,150ms whole-group replacement; reduced motion immediate terminal state. HP09:508–515 | Worker preserves source; root actual intermediate frames | Original lifecycle tests and unchanged CSS hash; actual normal/reduced frames NOT VERIFIED |
| HOME-HP05-B001; HP08 public metric baseline |88px standard height;28px/600 main value; A321×88 baseline and B278×104, description4px above right count. `visual-samples-board.svg`, `history*.svg` | Root matching-state visual review; worker no CSS workaround | CSS byte-identical expected; real1440×1000,1280×800,390×1000 and both card-width298px boundary sides remain NOT VERIFIED until root review |

Main percentage rounds to one decimal place and omits a zero fractional digit to preserve the original29-case0%/100% contract. Thus normal64.285… →64.3%; endpoints0.000… →0% and100.000… →100%. This is display formatting, never a replacement of the supplied raw observation. No money format, count, denominator or knownness changes.

## Control/state inventory and evidence boundaries

Version boundary: candidate1 input SHA manifest will be captured before tests; final three-source hashes will bind all new logs. Stable control IDs remain `history-stat/<closedNet|closedRounds|winRate|allocatedFees>/trigger` and the matching `/detail/close`. Four triggers and four conditional close controls, no new controls. The candidate1 fully expanded `CONTROL-STATE-MAP.md` inventory (64 raw control/state entries,40 applicable and24 scope-based N/A) remains the identity/state reference; candidate2 evidence does not relabel its old results as fresh acceptance.

Normal, expanded, initial pending, stale pending, failure, empty and long precision are applicable. A selected chart point and ambiguous chart selection are N/A because this leaf has no chart. Close controls require their own open dialog; hidden-dialog state combinations remain N/A rather than passes. Actual native mouse, keyboard, emulated touch and physical touch are separate and all NOT VERIFIED for candidate2. Synthetic component interactions will be reported only as synthetic tests, never real clicks or visual coverage. Current fresh real-control execution/attempt coverage is0/40 applicable entries; outcome pass rate N/A because no real candidate2 interactions were executed.

Allowed spatial changes: shorter correctly formatted percentage text within the existing value slot. Prohibited: wider card, smaller typography, hidden percentage, changed ratio/order/denominator, changed card/grid/container geometry, shifted neighboring modules, or modified motion/interaction semantics. Original reference pixel size1440×1000 is known; its DPR is not specified. Root compares CSS viewports1440×1000,1280×800,390×1000 at100%/DPR1 and explicit A/B width boundaries.

## Execution plan

1. Capture exact candidate1 input copies, reference/workflow hashes and protected-file fingerprints. Add literal failing percentage regressions, preserving original29 cases unchanged; execute targeted RED before any product edit.
2. Change only the unbounded primary percentage formatting expression. Run the entire scoped test file, strict scoped dependency typecheck and TSX/test lint. CSS stays byte-identical.
3. Perform separate specification and quality self-reviews, preserve all failure logs, capture exact final three-file hashes/copies/diffs and limitations, then freeze IMPLEMENTATION-READY for root independent acceptance. Worker readiness does not change formal1/3 FAIL or mark any browser/visual/whole-page gate PASS.
