# One bounded immutable-sharing candidate

Actual model gpt-6.1-sol / ultra. P2 remains 0/3 and requires root independent acceptance. Input manifest and byte-exact before copies are adjacent. No ledger, series, UI, dependencies, config, database, service or tracker writes.

Root cause: the same complete immutable public metadata is allocated for each metric, and ProjectionMemo evicts its existing working set before discovering a candidate alone exceeds 64 MiB. The frozen three-market fixture is an explicit FAIL, preserved in p2-a.

Single hypothesis: a batch-local exact-content interner for public metric/coverage/reasons/native-subtotal/FX-provenance objects, plus exact same-boundary Amount context reuse of the existing metric oracle, eliminates redundant allocations/conversions and lets the full unchanged result graph fit the same conservative 64 MiB budget. No financial formula or evidence field changes. Existing graph accounting counts each genuinely shared identity once. All construction maps are explicitly cleared before result admission; none live in source/index or memo. Public objects are recursively frozen.

Memo correction: preflight candidate-alone retained estimate before evicting. Reject an oversized graph without deleting existing entries; then admit legal graphs with existing identity/reference counts and limits. No estimator margin or budget reduction.

RED: catch missing exact metric/metadata identity sharing, distinguish equal numeric values with different coverage/reasons/FX clocks, verify complete immutable field content and cache identity, and catch destructive rejection via an intentionally oversized request. GREEN: one implementation of that hypothesis. Preserve original F100/canonical33 byte prefixes. Run small F and exact-content regressions, tsc/lint. Request root quiet window before the unchanged 1866×365 primary, all-buy, and 3account/3market 3cold+3repeat probes. Any performance miss is a stop/report, never another variant.

Approved references read: HP02 lines191–252, Metric611–698, ChartTooltip872–959, period.svg, chart-hover.svg, chart-hover--keyboard.svg, chart-gap.svg and atom-charttooltip.svg. Six independent tooltip fields, original-currency subtotals, source clocks, strict gaps and independent current remain the API contract. This bounded data-only candidate has no browser/control/layout changes; UI acceptance remains root-owned and NOT VERIFIED here.
