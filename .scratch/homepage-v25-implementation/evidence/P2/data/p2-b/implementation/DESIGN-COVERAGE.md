# P2-B pre-implementation coverage and RED plan

2026-10-23. Actual owner: gpt-6.1-sol / ultra. Bounded authorization: `../ROOT-DISPATCH.md` and root's explicit observation-window release. This record was written before either new product/test file. Input versions are in `INPUT-MANIFEST.json`; frozen A source/test match dispatch exactly. No A/F/S/ledger/UI/host/filter/config/database/shared tracker changes are authorized.

Read original HP02 lines191–252; Metric611–698 and ChartTooltip872–959; directly viewed all four original SVGs through lossless Sharp PNG renders in `references/`. They are design references, not product screenshots. Full Gregorian daily sequence, single period-net main line, six distinct amounts, full source/coverage, unknown gaps and independent current are binding. Presets, 88px cards, 264px tooltip, layout, pointer/keyboard/touch, generation rejection, loading/cancel/return/reload and whole-page visual acceptance remain UI-owner work. No new layout or interaction deviation is authorized by this data task.

| Requirements / elements | Exact original reference | Pure-series journey / new owner | Planned evidence and root acceptance |
|---|---|---|---|
| HV25-14/15, S01/S02 | HP02:193–209; Metric611–698 | Real summaries → entries → prepared A → one daily batch; three period metrics from final nonfuture point; independent current | O05/O06/O07 literal financial assertions; reference identity with actual A; root independent test/source review |
| HV25-16, X01/X02 | HP02:193–209/232–242; chart-gap.svg | Target/native values, quote/FX/lifetime coverage and lineage survive unchanged | O04/O06/O07/O08 exact amounts, reasons, IDs and actual batch object references |
| HV25-17 | HP02:210–221; period.svg | Caller supplies resolved actual dates; enumerate inclusive Shanghai Gregorian days without resolving presets | O01/O02/O03 day/instant, midnight, seven-day, 365/366 assertions |
| HV25-18 | HP02:210–221; period.svg | Reject nonexistent or reversed dates as one stable typed error; successful result carries caller generation in a new immutable wrapper | O03/O08 errors and immutable old/new generations; asynchronous applied-state behavior remains NOT VERIFIED |
| HV25-19 | HP02:222–231 | Each day exposes original precise period `net`; no rounding, interpolation, extra financial engine or series cache | O03/O04/O06 and single actual batch reference/cache-entry evidence; rendered chart NOT VERIFIED |
| HV25-20/21, T01/L01 | HP02:232–248; chart-hover.svg and chart-hover--keyboard.svg; ChartTooltip872–959 | One exported frozen six-key order: marketValue, unrealizedNet, lifetimeRealizedNet, lifetimeNet, net, periodFees; each point retains full metric/evidence | O05 literal 0/0/30/30/10/0, incomplete inception; O07 native/FX source; actual pointer/keyboard/visual NOT VERIFIED |
| HV25-22, X01/X02 | HP02:228/249–252; chart-gap.svg | Future day placeholders retained; final nonfuture missing point is summary; allfuture summary null/state future; true zero remains plottable | O04/O06 literal state/coverage/null/zero assertions; root independent evidence |

## Eight independent literal oracles, before implementation

1. **O01 day versus current instant**: Jan5 date-only fill is included in historical Jan5 at Jan6 asOf. At Jan5 08:00Z, only exact07:00 fill appears; date-only and09:00 remain absent. Historical precision day; clamped current precision instant/effectiveCursor08:00Z.
2. **O02 Shanghai midnight**: `2026-01-04T16:00:00Z` is Jan5's first instant; prior1ms is opening only. asOf crossing that1ms moves effectiveEnd Jan4 → Jan5; current entry IDs remain exact.
3. **O03 calendar/errors**: Dec29–Jan4 has seven explicit days; 2025 has365, 2024 has366 and oneFeb29. Reject 2026Feb29, malformed and reversed ranges. Preset resolution stays in S/host.
4. **O04 future/missing**: Jan5–9/asOfJan7 08Z has5 points, current-day clamp, Jan8/9 future null; summary Jan7 even if Jan7 missing and Jan6 valid. Allfuture Jan8–9 has effectiveEnd null/summary null/future state; current still real.
5. **O05 six fields/lifetime**: buy1@100 before period, opening120, sell130fee0 gives six amounts0/0/30/30/10/0 and period R30/open20/close0/change−20/net10. Changing start leaves lifetime30. Without inception evidence lifetime null, period10 remains known.
6. **O06 fees/gap/zero**: buy2@100fee2 before period/open110, sell1@120fee3/end115 gives openUF18/R16/closeUF14/change−4/net12/fees3/openFee1. Missing expected completed session nulls dependent fields but retains R16/fees3 and fallback quote evidence; true zero remains plottable.
7. **O07 FX/current**: native R30/change−20/net10, openingFX7/endFX8 gives240/−160/80 using endpointFX8; original amounts and observation sources retained. Latest-only history remains unknown; independent current MV840 from1×120×7 remains equal across historical ranges.
8. **O08 generation/version/single batch**: same handle/range g01/g02 returns equal financial references with each wrapper frozen and own generation. One inclusive request creates one A batch entry, no per-day calls. A changed raw quote with same revision creates different sourceId and10→50 native net; old source stays10. No requestGeneration written into A.

## Execution / acceptance boundary

Use real `buildInstrumentTradeSummaries` → `buildTradeLibraryEntries` → `prepareHomepageV25Source` and actual public A projection; no financial mock. First run missing-series RED, then callable assertion RED, then minimal daily wrapper. Preserve raw logs. Scoped new-file tests, tsc and lint only; no benchmark/full suite/browser/service/DB. Root independently accepts the frozen candidate. A cold performance remains FAIL; P2 formal0/3; UI/P4 release and rendered/data/persistence acceptance remain NOT VERIFIED. Series overhead measurement remains deferred to root's later quiet window.
