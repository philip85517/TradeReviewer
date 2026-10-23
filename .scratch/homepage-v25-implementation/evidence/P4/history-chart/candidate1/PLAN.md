# HistoryChart first candidate implementation plan

> Native execution by /root/contribution_bars, actual gpt-6.1-sol / ultra. Parent /root independently accepts. Explicit dispatch forbids child agents, commits, service/browser/DB work and changes outside the three new product files and this evidence directory.

**Goal:** A controlled, operable SVG history chart for four caller-computed modes, with faithful gaps and complete temporary readings.

**Architecture:** Immutable committed input is selected and formatted, never financially aggregated. One fixed 320px card and shared axis slot contain an SVG plot. Local state stores only transient reading identity; props remain the sole source of financial facts. Semantic period hit targets support mouse and keyboard, including gaps.

**Tech stack:** Existing React 19, TypeScript, decimal.js, Vitest/jsdom and Testing Library; no dependency changes.

**Spec:** `../ROOT-DISPATCH.md`; approved visual-design.candidate.md HP05:349–394 and shared norms:467–518; nine original SVGs and complete prototypes/round5/history.{html,css,js}, HISTORY-NOTES.md, all personally read/viewed. Exact mapping is in DESIGN-COVERAGE.md.

## Constraints and approved decisions

- Product scope: only new history-chart.tsx, history-chart.css, history-chart.test.tsx. Old contribution candidate 3 stays frozen; all existing products untouched.
- History leaf starts 0/3; P4 whole starts 0/3. Old contribution was dispatched at 2/3 FAIL; root subsequently recorded final 3/3 FAIL and paused it. Its frozen products remain untouched. Current PerformanceChart FAIL remains independent.
- Caller supplies period/cumulative monetary values, count, winning count and percentage. No sum, carry, ratio, attribution, FX or known-subset total calculation.
- Original chart 320px wins over old prototype 438px. Reference is 1440×1000; parent compares 1280×800 and 390×1000 at DPR1.
- Parent confirmed original cumulative exception: a no-round period may draw explicitly available cumulativeNet; retain its no-round reason. No local carry.
- Parent acknowledged 390px implementation proposal: 11px semantic labels and stable axis slot; long readings use a normal-flow safe slot. This is pending actual-browser visual acceptance, not accepted fidelity.
- Data replacement fade 150ms, hover color 120ms, reduced motion directly terminal. Different units never morph paths.
- Pure leaf DB writes are N/A. Host financial calculation, atomic history/cards/contribution replacement, real context chain, details return and persistence stay NOT VERIFIED for future integration.
- Performance quiet window was respected and explicitly released by root after its nine accepted samples. No benchmark was repeated. All new feature slices followed observed RED.

## Review focus

- Explicitly available cumulative field during no-round state versus all unavailable fields: draw only caller values and never fabricate zero/carry.
- Source/currency/mode/data identity roundtrip must permanently invalidate old readings, not only hide them.
- Contradictory future/loading/error points carrying numbers must not leak those numbers into scale, path or reading.
- Huge decimal source strings and FX provenance must remain exact and wrap within the safe reading slot.
- Axis width must consider all four modes so switching units cannot shift plot geometry.

## Task 1 — minimal real chart journey (before matrix expansion)

Files: the three authorized new files; own config/logs only in this directory.

Interface: exported HistoryChart; mode uses HomepageHistoryChartMode. Data has sourceId, requestGeneration, grain, range {label,start,end,timeZone}, ordered points with key/start/end/label/state/reasons; each point independently supplies periodNet, cumulativeNet, roundCount, winningRounds, winRate. Props add reportCurrency and readState ready/pending/error/empty with reason when applicable. No activation/navigation/repair callbacks.

- [x] Write one behavioral test: literal committed data → period path and real zero → hover exact point/gap reading → Esc closes → caller switches each mode → same SVG plot bounds, corresponding provided value/semantic unit.
- [x] After quiet-window release, exact include/single-worker run, preserve genuine RED.
- [x] Implement the minimum real SVG line/point/gap targets and temporary reading; run same test GREEN.
- [x] Report minimal candidate to parent for independent real-browser journey. Keep required browser gate NV until parent's evidence; do not claim full delivery.

## Task 2 — full HC01–15 matrix

- [x] After minimal journey gate, add focused behavioral regressions in groups: semantic states/fields; axes/extremes; keyboard/mouse/context; status/motion.
- [x] Observe each meaningful RED before implementing corresponding behavior, preserving raw logs.
- [x] Render semantic background regions separately and split segments on unknowns; future never plots; true zero remains a point. Read all source facts without deriving them.
- [x] Fixed 0–100% rate, integer count ticks, compact money ticks, one shared axis slot. All negative/zero/single-point and invalid values remain finite/safe.
- [x] Reading parity for hover and keyboard, reachable gaps, Home/End/arrows, blur/leave/Esc closure, no context resurrection.
- [x] Old complete props survive pending/error with blue/red textual status; initial pending/error/empty retain plot space and fabricate no path.
- [x] Atomic 150ms surface fade; 120ms hover color; reduced-motion cancellation/direct state; no path morph.

## Task 3 — scoped verification and freeze

- [x] Exact product test include, pinned Node 26.0.0, maxWorkers=1; strict scoped tsc and lint only the two new TSX files; no Workspace tests/build/benchmarks.
- [x] Save complete new-file diff, exact SHA256s, raw commands/stdout/stderr/exit, control-state matrix and exclusions. Preserve every RED/FAIL/NV.
- [x] Freeze IMPLEMENTATION-READY once complete; stop writing product/evidence after freeze. Parent independently accepts functionality and rendered visual comparison. Worker PASS is scoped preparation only.

## Final candidate 1 record

The minimal actual-SVG prerequisite received only root's limited gate in ROOT-MINIMAL-JOURNEY-GATE.md before full matrix expansion. Current 49/49 exact-file tests, strict dependency-inclusive scoped tsc and ESLint zero-warning runs pass (green/tsc/lint-candidate1-final.log). PLAN check marks describe implementer work, never independent feature acceptance. HC01–15 scope, exclusions and remaining NV are in DESIGN-COVERAGE/CONTROL-STATE-MATRIX/REPORT. Product SHA256s are in PRODUCT-SHA256.json; final freeze marker is IMPLEMENTATION-READY.md.

Root-approved responsive adaptations, including removal of the former760px hard gate, are formally appended to ../ROOT-DISPATCH.md and detailed in AUTHORIZED-DEVIATIONS.md. The 30/40-year and759/760/761 regressions each preserve observed RED→GREEN. No whole suite/build/service/browser/DB/network/commit or child agent was used.
