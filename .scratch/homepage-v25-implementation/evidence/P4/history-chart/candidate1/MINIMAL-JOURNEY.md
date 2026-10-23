# Minimal real chart journey — prerequisite handoff

This is an intermediate operable slice, not a frozen or accepted full candidate. History leaf remains 0/3. Parent independent real-browser journey is required before dependent matrix expansion.

## Version sent to parent

| New product file | SHA256 |
|---|---|
| history-chart.tsx | 41501577ecb3e59eebbd627877c2f0404f5e1e9c5373389752140bd0eedf9dc8 |
| history-chart.css | 55c15a9ea9cd61aabd8b1fda00a7b0877e6a6ed03f450eb6f06248088f1f9919 |
| history-chart.test.tsx | 34c7e477c717e7ea09e2cdf5be4f5526925978647633b26f0222936d298ac3f4 |

## Smallest journey

1. Supply immutable literal HistoryChartData and ready readState in a real harness; render actual SVG with period net values 0 / no-round gap / -12345.678900. Default contains no temporary reading.
2. Hover third period: actual plotted point has exact source money reading, business interval/timeZone and crosshair. Leave returns to default.
3. Focus second/no-round period: explainable gap is reachable and reason is supplied. Esc closes with no navigation.
4. Caller rerenders cumulative/rate/count. Titles/units and values select the independently supplied fields, with same card and plot bounds. Esc closes each reading.

The product test uses actual SVG elements and events rather than a mock chart; 1/1 passed. This does not count as real-browser acceptance.

## Raw evidence and preserved failures

- red-minimal.log: first harness invocation failed because root path was one parent too high; not feature RED. Wrapper corrected to parents[6].
- red-minimal-feature.log: exact include failed because new HistoryChart import did not exist (missing feature), before product implementation.
- green-minimal.log: 1/1 behavior passed, exit0; existing DEP0205 module.register warning retained.
- tsc-minimal.log: first scoped strict compile failed on missing matcher type inclusion and union narrowing; corrected with explicit test matcher import and selecting monetary fields by mode.
- tsc-minimal-corrected.log: strict scoped compile exit0.
- lint-minimal.log: scoped lint exit0.
- System shasum failed due environment locale; hashes obtained with Python hashlib, no product consequence.

## Explicitly incomplete, pending next TDD slices

Strict scalar range/integer validation; no number leaks in non-readable-state full facts; all status overlays/old complete data; extreme/annual/adjacent states; containment at390; real keyboard movement and downstream journey; data/hover/reduced motion. Existing minimal code is intentionally not claimed to satisfy those gates. Product source held stable for parent's prerequisite browser run; full unit expansion is pending that gate.

## Preserved prerequisite outcome and later work

Root subsequently recorded limited real-browser PASS in ROOT-MINIMAL-JOURNEY-GATE.md and authorized the full HC matrix. That gate used the historical minimal version above; the earlier incomplete list remains historical evidence. The final candidate then added all requested leaf behaviors through preserved RED→GREEN slices, with49/49 final tests and separate strict tsc/lint passing. Final SHA-bound functional and visual acceptance remain root-owned NV; this historical prerequisite is not promoted to final acceptance.
