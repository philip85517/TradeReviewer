# Chart candidate 1 — worker handoff, no feature acceptance

Owner `/root/daily_chart`, actual `gpt-6.1-sol / ultra`. Only the three new performance-chart files and this chart evidence subtree were written. No host/page wiring, F/S/B changes, other-leaf changes, dependencies, configuration, global CSS, service, browser, network, database, commit or subagent. Existing unrelated workspace changes were preserved.

## Result and explicit limits

The controlled leaf reads frozen B points and six historical metrics in the approved order. It distinguishes real zero, unavailable data and future data; splits all gaps; preserves supplied currency and decimal precision; exposes exact reasons and available original/source evidence. It never reads current to replace history, computes financial results, projects/builds B, performs FX conversion, or reads clock/storage.

Mouse 300ms / leave100ms, immediate keyboard selection, valid-point arrows/Home/End, pinning and Esc/reentry suppression have actual-component tests. Local timers cancel on controlled generation/read-status changes and unmount. Same-key metric/evidence refreshes read current props rather than retaining an old financial object.

Reference reads and control inventory are in `../CONTROL-STATE-MAP.md`. Original PNGs are original-SVG derivatives, not rendered product evidence. The default plot has 51:16 dimensions with minimum height280 and actual-pixel 12px SVG text; detail is264 wide, padding12, natural height and 12/13px amounts. Normal quote/FX success badges, retry and date-exposure navigation are absent.

Root explicitly approved the responsive strategy: all in-card candidates must fit complete measured natural dimensions and avoid the point/main line; otherwise detail becomes a relative-positioned sibling after the fixed plot stage, in normal document flow. The card grows around its full natural height and closes back to the default stage. `flow-root` prevents child margins escaping the card. No absolute overflow is used as the fallback. This is root's adjudication of the narrow/extreme-content case, not a pixel prescription from the old SVG. Tests check measured candidate geometry and the normal-flow DOM/CSS contract; **they do not prove real next-module pixel separation or visual fidelity**.

## Verification commands and exit codes

All test runs used `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/homepage-v25/performance-chart.test.tsx`. Log filenames below preserve every failure; no failed log was overwritten.

|Log|Exit|Observed result|
|---|---:|---|
|01-RED-missing-component.log|1|New component import absent|
|02-RED-behavior.log|1|18/18 behavior tests failed against minimal stub|
|03-first-GREEN-attempt.log|0|18/18 passed|
|04-RED-controlled-read-hover.log|1|3 failed,22 passed: same-key stale metrics, gap description association, pointer detail lifetime|
|05-RED-detail-focus-exit.log|1|4 failed,22 passed: added unpinned detail focus-out regression|
|06-GREEN-controlled-read-hover.log|0|26/26 passed|
|07-typecheck.log|0|Initial strict scoped check|
|08-eslint.log|0|Initial two-file ESLint check|
|09-RED-curve-avoidance.log|1|1 failed,26 passed: corner candidates unnecessarily covered main curve|
|10-GREEN-curve-avoidance.log|0|27/27 passed after adding interior candidates|
|11-RED-escape-suppression.log|1|1 failed,26 passed: Enter/click reopened escaped same point before reentry|
|12-GREEN-escape-suppression.log|0|27/27 passed|
|13-RED-flow-fallback.log|1|2 failed,27 passed: no reserved-flow fallback for tall/narrow or intersecting candidates|
|14-GREEN-flow-fallback.log|0|29/29 passed|
|15-FINAL-tests.log|0|29/29 passed, one test file|
|16-FINAL-typecheck.log|0|Final strict scoped check, empty diagnostics|
|17-FINAL-eslint.log|0|Final scoped ESLint check, empty diagnostics|

Final type command: `./scripts/native-node.sh node_modules/typescript/bin/tsc -p .scratch/homepage-v25-implementation/evidence/P2/chart/candidate-1/tsconfig.chart.json`. Config includes only the new component/test and existing test setup; imports are type-checked transitively, incremental disabled, strict true.

Final lint command: `./scripts/native-node.sh node_modules/eslint/bin/eslint.js app/components/homepage-v25/performance-chart.tsx app/components/homepage-v25/performance-chart.test.tsx`.

Final negative source scan: `rg -n '\bfetch\b|localStorage|sessionStorage|Date\.(now|parse)|new Date|buildHomepage|projectHomepage|process\.env'` on the three new files returned exit1/no matches. This is a scoped static check, not a runtime acceptance claim. Test logs contain the existing Node `[DEP0205] module.register()` deprecation warning; no product failure accompanied it. No full suite or performance run was executed.

## Coverage and remaining gates

Literal fixtures cover positive/negative/zero, sparse/singleton/all-missing/empty/unavailable, internal and leading/trailing gaps, future values excluded from axes/readouts, CNY/HKD/USD, mixed/missing currency authority, partial FX, six-field order and full trailing precision, extreme and zero axes ≤7 ticks, anomaly explanations/source evidence, loading/error suppressing stale values, read-status/data/unmount cancellation, detail focus/mouse lifetime, Esc suppression, measured390 width, card-internal line avoidance and reserved-flow fallback.

|Gate|Status|
|---|---|
|Worker component behavior / strict scoped type / scoped lint|PASS, version-bound to `source-freeze.json`|
|Real mouse / real keyboard / emulated touch / physical touch|NOT VERIFIED, individually distinct; real operation coverage numerator0|
|Independent visual at1440/1280/390 and long detail / next-module boundaries|NOT VERIFIED, root directly compares rendered product to originals|
|Page integration, atomic financial updates, contribution/navigation and complete data chain|NOT VERIFIED, root-owned and outside leaf authorization|
|Leaf database write persistence|NOT APPLICABLE: leaf has no IO/write/callback; no page persistence gate released|
|A performance / P2 / P4 and every prior FAIL/NV|Unchanged; P2 formal0/3. Worker PASS is not leaf or feature acceptance|

Three product files are SHA-frozen in `../source-freeze.json`. Worker stops writes and hands the candidate to root for independent review and real-browser acceptance; no preview/service was started in this worker's prohibited scope.
