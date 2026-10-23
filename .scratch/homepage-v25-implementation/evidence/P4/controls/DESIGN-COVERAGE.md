# P4 history controls — bounded design contract

2026-10-23. Owner `/root/responsive_shell`, GPT-6.1 SOL / ultra. Root owns integrated UX, data flow and independent acceptance. This is one preparation candidate, not P4 release: formal P4 remains 0/3 and P1 remains 2/3 FAIL. Frozen scope: only new history-controls.tsx/.css/.test.tsx plus this evidence directory. No service, browser, DB, performance, full suite, subagents, existing-file changes or commits.

## Sources read before implementation

- Baseline `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP05 lines349–394 (357 range/granularity,361 atomic caller application).
- Baseline `source/component-manual.html` lines103/107; A composite, no persistent duplicate subline, 36px hitbox, 14px labels and year arrow semantics.
- Original `source/images/{history,journeys-year,history-stats-cumulative,history-stats-win,history-stats-rounds,history-stats-error}.svg`, each1440×1000. Read SVG text/geometry and directly inspect locally rasterized selector crops in reference-controls-six.png (same ordered six rows), plus exact root history-year-reference.png. Coordinates are drawing coordinates, not breakpoints.
- round5/history.css and round4/ui-select.js: popup appearance/action reference only. Prototype arrow-immediate-commit behavior is superseded by explicit submit contract. Older three-control screenshot is not authority.
- Current development-workflow, task-decomposition, frontend-control-audit, ui-task-templates; task-local records only, parent dispatch overrides shared tracker edits.

## Interface / journey

`HistoryControls({appliedRange, chartMode, rangeOptions: readonly {id,label,range}[], pending?, error?, onRangeApply, onChartModeChange})`. Existing S types imported type-only. S modes year/this-year (explicit year)/years/all all representable. Caller supplies actual options, labels and stable IDs; no current year, earliest trade, clock, network, storage, money or committed-range state inferred. Match selection by range content; unknown applied option gets semantic fallback from appliedRange, never first option. Years must be integers1..9999, interval ordered, matching existing S validation. Invalid options remain non-submittable with readable reason; no additional editor.

2026 -> open range -> request2024–2026 -> caller pending retains2026/month label/selection -> caller error retains2026 and readable reason -> reselect to retry -> only caller applied-range commit changes range/yearly label -> metric changes report mode only. Example years exist only in tests, never product defaults. Esc/outside close+restore original trigger; Tab closes and leaves normally; arrows/Home/End focus only, Enter/Space submit. One menu open. Range pending blocks resubmission; metric stays independently operable. External props synchronize selection without callbacks and without page state ownership.

## Requirement / complete local inventory

| ID | Source / exact element | Owner / journey | Evidence / gate |
|---|---|---|---|
| HV25-33/HOME-HP05-B001 range | HP05 357/361; A combo left | leaf requests, caller commits | suite; root actual input/atomic history+contribution NV |
| HV25-34 metric | HP05 357/359; A combo right | leaf reports period-pnl,cumulative-pnl,win-rate,round-count in that order | suite; root chart geometry/data NV |
| HV25-33/option:{caller.id} | every supplied option, no sampling | range list dynamic denominator N, fixture N=4 (year,this-year,years,all), invalid fixture N=5 | suite synthetic events; real browser NV |
| HV25-34/option:{mode} | all four metric options | labels from appliedRange; never pending target | suite synthetic events; real browser NV |
| HV25-33,34/close | Esc, outside, Tab, trigger toggle, other-menu open | focus/close, no callbacks | suite; actual mouse/keyboard NV |
| HV25-33/error,empty,pending | readable conditional feedback, no extra control/editor | old applied data, retry selection | suite; real visual NV |

Fixed control denominator2 triggers + N range options +4 metric options = N+6 (fixture10); conditional feedback adds no actions. All dynamic instances use caller.id or metric mode as stable identity. Close paths are separate journeys, not hidden new controls. Error retry is choosing range again, no invented standalone action.

## Visual contract

A composite282×36px baseline, radius7, bg#111a26, border#283448; two independent centered14px triggers with downward arrows and 36px hitboxes, middle20px line. No calendar, extra granularity selector or persistent subline. Popup absolute, bg#162233, border#283448, radius6, padding4, option padding7px10px, selected/hover#243b5c; reduced-motion respected. Menus bounded by composite width and viewport24px gutters, options/error wrap. At390 viewport host available342; same two-trigger composite. No authorized deviation. CSS visual targets1440×1000,1280×800,390×844; native zoom/DPR/actual host placement remain NV until root browser checks. Spec selector drawing x1102/y42/w282/h36; year-range text1114, metric1228. Long numerical range0001–9999 is separate fixture; error wraps without covering field. Popup does not push page; feedback may add a following text row, never overlap the current field.

## Eight-state denominator (2 triggers ×8 =16 state rows)

| State | Range trigger/menu | Metric trigger/menu | Evidence boundary |
|---|---|---|---|
| default | applied label/selection | controlled mode and derived period label | component suite only |
| hover | approved hover surface | approved hover surface | CSS static; visual NV |
| focus | visible focus, selected option on open | same | synthetic focus suite; real NV |
| pressed | active/open feedback | same | behavior suite/CSS; visual NV |
| disabled | pending range options aria-disabled, trigger still allows close | N/A: no disable prop, pending independence required | suite, one N/A scope row |
| loading | old applied/selection, readable busy reason, no repeats | independently operable | suite; visual NV |
| empty | no options reason, no fake options | N/A: fixed four modes nonempty | suite, one N/A scope row |
| error | readable reason, old applied, reselect retry | no own async request; same controlled mode | suite; visual NV |

16 total rows:14 applicable,2 N/A. Metric error row is stability under range error, not invented metric I/O. Browser execution coverage0/10 fixture controls; physical/emulated touch and actual mouse/keyboard NOT VERIFIED. No jsdom result counts as browser coverage or visual PASS.

## Plan / acceptance gates

1. Tests first + inert exported stub, observe assertion RED (not import error).
2. One minimal controlled leaf candidate, same targeted suite GREEN; scoped dependency tsc, eslint, CSS parse only.
3. Freeze exact hashes/diff, report Implementation-ready to root.

Functional component contract:32/32 targeted synthetic-event checks PASS (GREEN-final.log); independent real behavior gate remains NV. Real browser E2E + independent visual fidelity: NOT VERIFIED, root owner. Real history/contribution atomic refresh/save/return/reload: NOT VERIFIED, later integration. Leaf DB gate NOT APPLICABLE: no reads/writes or persistence API. No overall accepted claim. Formal rounds unchanged.
