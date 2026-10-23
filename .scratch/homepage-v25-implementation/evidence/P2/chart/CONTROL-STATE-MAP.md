# Chart leaf contract — candidate 1

Owner: `/root/daily_chart`, actual model `gpt-6.1-sol / ultra`. Integrated visual/data-flow/independent acceptance owner: `/root`. This is an isolated, removable leaf preparation; P2 remains formal 0/3. No prior FAIL / NOT VERIFIED is superseded.

## Authority and controlled input

Read `ROOT-DISPATCH.md`, current AGENTS, development workflow, decomposition, UI templates, issue tracking and frontend-control-audit. Read original `visual-design.candidate.md:223–248` and `component-manual.html:872–959`; directly viewed all eight PNGs in `reference-readback/` and `../data/p2-b/implementation/references/` (hover, keyboard, gap, compact/normal/wide/extreme, atom). These are original SVG derivatives, not product screenshots. HP02 updated prose overrides old dots, abbreviated tooltip numbers and fixed height.

`PerformanceChartProps`:
- `series: HomepageV25SeriesBundle | null`: read-only frozen B output; uses `points`, boundary and request identity. Does not read `current`, invoke A/B builders or synthesize financial amounts.
- `reportCurrency: string`: explicit report currency. Each metric must have the same `money.targetCurrency` and supported complete/same-currency conversion before its value can be shown. Unknown/mismatch/partial FX => `—` with reason; no exchange-rate calculation or suffix relabelling.
- `pointStatus?: Readonly<Record<string, Readonly<{state: 'loading' | 'error'; reason: string}> | undefined>>`: key lookup only; explicit unavailable point overrides every old value and plotted segment, keeping its supplied business date.
- `unavailableReason?: string`: visible chart-unavailable context. Null series or explicit chart-unavailable reason makes tooltip disabled/not rendered.

Output is only SVG + accessible local date detail. No callbacks, business writes, clock, storage, fetch, network, service, browser ownership or page integration. Financial source is B's exact six metrics in fixed order: marketValue / unrealizedNet / lifetimeRealizedNet / lifetimeNet / net / periodFees. Monetary originals stay unmodified; Decimal operations are formatting and coordinate geometry only. Do not fallback from a historical point to current.

## Layout and comparison contract

- Original card: 1020×320; actual container width is measured. Maintain 51:16 aspect with 280px minimum height, keeping text at actual CSS 12/16px at 390px rather than shrinking an SVG viewBox. At baseline plot left75, right36, top50, bottom50; axis gutter may grow for long formatted tick labels. Header title16. Single 2px line; 6px visible marker only hover/focus; neutral zero/grid colors #A8B6CB/#283448.
- At most seven money ticks (nice geometry domain, zero included), 12px labels, explicit currency. Axis uses two decimals and 万/亿; detail uses full comma-separated, non-exponential original precision (at least two decimals), independent positive/negative/zero colors and neutral fees. No preselected point.
- 264px date detail, padding12, natural content height; row label/value colors independent. Market value12, P&L12 except period net13; date/explanation12 secondary. Header anomaly Info16, hover/focus exposes exact reasons. Normal quote/FX does not display success checkmarks. Original currency and rate/quote sources are accessible with each value, and visible on value hover/focus.
- Tooltip measured before placement, candidate sides/corners/interior grid checked against curve and container/viewport. Root explicitly adjudicated the narrow/extreme-content strategy after reading source223–248: if no card-internal candidate fits the complete natural dimensions without covering the anchor/main curve, move detail below the fixed plot stage in normal document flow, reserving its entire natural height and expanding the card. Close restores the default stage/card size. This responsive strategy is root's authorized interpretation, not an original-design pixel rule. Never use absolute overflow to cover the next module, clip/max-height/shrink text. Keep horizontal margin12 and natural wrapping for long original/source/reason text. Root must directly verify 1440/1280/390, next-module boundaries and long text; DOM/component tests are insufficient for visual acceptance.
- Gaps split segments including leading/trailing; future points are never plotted and get neutral region/cutoff. Each contiguous unavailable state/date run has a focusable reason, including full missing ranges and no retry control.

## Eight states and control inventory

Trigger: frontend interaction/layout implementation. Scope: chart leaf only; host, financial atomics, persistence, contribution, navigation and all page integration remain NOT VERIFIED/root-owned. Version binds to final `source-freeze.json`.

|ID/state|Entry/action|Visible contract / exit|Instance rule|Evidence owner/status|
|---|---|---|---|---|
|CH-DEFAULT/default|render ready series|single line, no permanent point/tooltip; stable chart geometry|one chart|component tests; real browser NV/root|
|CH-HOVER/hover|mouse enters point|marker feedback120ms, tooltip after300ms; leave closes after100ms; cancel timers on key/data/unmount|every eligible point.key, no sampling implied|synthetic tests separate; real mouse NV/root|
|CH-FOCUS/focus|Tab chart; arrows/Home/End|immediate first/adjacent valid point, 2px focus ring, same six rows; gaps/future skipped|one roving chart plus all valid point.key journeys|synthetic tests; real keyboard NV/root|
|CH-PIN/pressed|click/Enter/Space|pin exact date; other hover cannot replace; Esc closes/refocuses trigger and suppresses until reentry|one selected point at a time|synthetic tests; browser NV/root|
|CH-DISABLED/disabled|series null/explicit unavailable|visible reason, no tooltip or enabled chart selection|one chart; tooltip not rendered per manual|component tests; browser NV/root|
|CH-LOADING/loading|pointStatus[key].loading|date + six dashes/loading reason, no old line/value; keyboard valid navigation excludes point|each explicit point key, contiguous gap grouping|synthetic tests; browser NV/root|
|CH-EMPTY/empty|B missing/no points/no eligible point|date range/reason, no interpolated line/fake zero; Tab gap explanation; Esc closes|each contiguous missing range; empty series one message|synthetic tests; browser NV/root|
|CH-ERROR/error|pointStatus[key].error|date + six dashes/error reason; focusable reason, no retry|each explicit key, contiguous range|synthetic tests; browser NV/root|
|CH-REASON|tooltip anomaly Info16 hover/focus|specific quote/FX/metric reasons; Esc returns point without reopening|one per shown abnormal detail|synthetic tests; browser NV/root|
|CH-ORIGINAL|value hover/focus|complete original amounts and available quote/FX source; no financial transformation|six rows per detail|synthetic tests; browser NV/root|
|CH-FUTURE|supplied future state|neutral coverage region + effective cutoff; never use stale supplied future values|each future range; no valid point instance|synthetic tests; browser NV/root|

`normal`, `selected`, `expanded`, `empty`, `loading`, `error`, `longtext` applicable. Dense/ambiguous point columns use nearest date partition deterministically; no invented ambiguous financial result. Mouse, keyboard, emulated touch and physical touch evidence remain separate. No browser operations authorized for worker. Real interaction coverage = 0 / applicable registered instances until root executes; synthetic tests are not included in real coverage numerator.

## Minimum leaf journey and acceptance boundary

Caller supplies literal single-series -> Tab/arrow/Enter/Esc -> actual zero -> internal and edge gaps -> future -> long reason/source. B snapshots and synthetic caller must be labelled separately. No page branch is opened. Tests first RED -> minimal stub behavior RED -> one candidate GREEN; strict new-files type/lint only. Freeze three product files SHA and stop writes for root review.

|Gate|Worker status|Required evidence|
|---|---|---|
|Component behavior|WORKER PASS (scoped only)|29/29 actual-component literal-data tests; preserved RED/GREEN logs; strict scoped type/lint exit0; see `candidate-1/REPORT.md`|
|Page end-to-end / state chain|NOT VERIFIED|root page integration and real browser|
|Independent visual|NOT VERIFIED|root direct comparison to original at comparable widths/states|
|DB write persistence|NOT APPLICABLE|leaf has no IO or writes; does not release any page persistence gate|
|A performance / P2 / P4|NOT VERIFIED|not in worker scope; old failures preserved|
