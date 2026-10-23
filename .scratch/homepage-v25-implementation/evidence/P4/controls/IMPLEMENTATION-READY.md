# History controls leaf — Implementation-ready, frozen

2026-10-23. GPT-6.1 SOL / ultra; one candidate, no root integration or formal acceptance performed. P4 formal0/3 and P1 2/3 FAIL remain unchanged. Root owns independent whole-page, visual and data acceptance.

Only three new product/test files were written: history-controls.tsx, history-controls.css, history-controls.test.tsx. Existing home-surface.css remains exactly its starting hash (see candidate-manifest.json). No service/browser/DB/performance/full-suite/subagent/commit activity. New CSS is not imported by existing host/page: integration remains root-owned. All evidence writes are confined to P4/controls.

## Interface and behavior

Exported `HistoryControls`, `HistoryControlsProps`, `HistoryRangeOption`. Props are appliedRange/chartMode/rangeOptions/pending/error/onRangeApply/onChartModeChange. Actual caller range options carry stable id,label,range. Existing HomepageHistoryRange/ChartMode are imported type-only. All four S modes supported; year integers1..9999 and ordered intervals checked, invalid choices visibly non-submittable. No extra editor, clock, default-year list, request, storage, money, committed range or chart data owned by leaf.

Two-trigger282×36 A selector, scoped CSS, absolute single menu, derived applied-range metric labels. Navigation never applies; Enter/Space/click explicitly request. Pending retains old applied range/selection/period text, range resubmission blocked, metric independent. Error is readable below current field; range reselection retries. Caller commits alone change labels/selection. Escape/outside restore trigger; Tab follows native focus order and closes afterward. Expanded trigger is temporarily removed from Tab sequence so the options and next control form a normal forward/backward exit.

## Verification evidence

- RED.log: inert exported stub,31 expected assertion failures, no import error. RED-stub.tsx.txt and RED-manifest.json bind initial tests/source.
- GREEN-attempt1.log:29passed/2failed; these were Tab focus failures in the initial internal implementation. Cause: keydown unmounted the focused option before native default navigation used its starting node. Fixed within this single candidate: menu DOM immediately follows owning trigger; Tab leaves the mounted option normally and blur closes it. This is internal preparation, not a formal round.
- RED-escape-boundary.log:31passed/1failed; Escape bubbled to an independent parent page state and closed it. Handled Escape now stops propagation. This preserves the local menu boundary.
- GREEN-final.log: **32passed/0failed**, this suite only, exit0. Native Node26/Vitest emits preexisting tooling DEP0205 module.register deprecation; no component warnings.
- typecheck-final.log: both owned TSX plus transitive type dependency, strict/noEmit/incremental false, exit0.
- lint-final.log: only owned TSX files, exit0.
- css-parse-final.json: PostCSS syntax PASS,20rules/99declarations.
- Static CSS cascade review: existing `.hp-home-surface button` plus hover/p margins would override a bare leaf class. All controls/feedback rules are scoped inside `.hp-history-controls` with sufficient local specificity; wrapping/options height are explicit. No existing CSS modified, and no CSS-mirror test added.
- Exact SHA256, byte/line counts and new-file patch in candidate-manifest.json / candidate.patch. Python hashlib used after system shasum failed due unavailable Perl C.UTF-8 locale.

The detailed reference mapping, complete dynamic control inventory and16-row eight-state contract are in DESIGN-COVERAGE.md. Reference source crops directly inspected in reference-controls-six.png, rows default/year-range/cumulative/win/rounds/error. The drawing itself varies range segment width with its text; both controls remain one fixed basewidth composite. No authorized design deviations.

## Independent gates / remaining NOT VERIFIED

Component behavior: scoped synthetic-event suite PASS only. Real browser execution coverage remains0/10 for the registered4-range-option fixture (2triggers+4range+4metric options); this is not an actual mouse/keyboard result. Hover/pressed/focus rendering,14applicable state rows, physical/emulated touch, reference1440×1000,1280×800,390×844 viewport comparison, long range/error readability, popup gutters and placement, host CSS and affected downstream geometry remain NOT VERIFIED until root directly checks them.

Caller business option construction, history/chart data and units, history+history-contribution atomic refresh, current contribution mode preservation, stale request/error integration, persistence/save/return/reload are NOT VERIFIED and outside this preparatory leaf. Leaf DB gate NOT APPLICABLE because no DB/API/persistence path exists in this component. No data/page release or accepted claim.

Files are frozen for root to inspect/integrate. No further writes by this worker after notification.
