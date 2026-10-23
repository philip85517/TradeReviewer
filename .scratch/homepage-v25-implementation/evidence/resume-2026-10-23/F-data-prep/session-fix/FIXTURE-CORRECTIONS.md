# Fixture corrections and preserved failures

Only F source and its same-name product test changed. Original historical F/F-debug/coordinator/peer tests and original P1 test remain read-only. Copies under this directory retain the financial assertions, relocate imports/output, and use valid market/session evidence. All changes have *.fixture.patch records; before-correction copies are retained as *.txt.

The first 18-file run used uncorrected copied evidence plus the frozen original P1 test: 335 PASS / 14 FAIL. Its full output is original-evidence-fixtures.log. No failure is treated as a pass. The next run corrected only historical evidence copies: 347 PASS / 2 FAIL (the unchanged frozen P1 file). The final green run substitutes the copied P1 test with corrected US raw dates: 349/349 PASS. This establishes the F/model closure; it does not accept or modify the frozen P1 task.

## All 14 failures

| File / test | Invalid old evidence | Observed after fix | New evidence counterpart |
|---|---|---|---|
| holdings-model: keeps partial or future FX unknown and accepts production colon rates from complete timely evidence | US raw Oct23 / Shanghai asOf Oct23 date-only; NY23 session unfinished | null instead of 1636.25 | Evidence copy only: Oct23 default US raw → Oct22; FX/asOf unchanged |
| holdings-model: reports US in USD without needing FX for USD, converting other settlement currencies only with evidence | same unfinished US23 raw | null instead of 233.75 | Evidence copy only: Oct23 default US raw → Oct22; CN23 and explicit stale US15 retained |
| F-acceptance-2-interface-trace: records real library, boundary, canonical and projection interfaces | Jan31 US Saturday raw; Jan1 opening boundary sits in unverified 2025 session | missing current quote and unknown opening; trace array mismatch | raw Jan31→Jan30; default period start Jan1→Jan2 (same fill membership) |
| F-acceptance-2-ipo-fee-contract: projects attributable canonical fees when it covers a cross-period short | period start Jan9; Jan8 Shanghai EOD precedes US Jan8 close | opening 36/net -12 instead of opening16/net8 | opening raw Jan8→Jan7; current raw Jan31→Jan30 |
| F-contract: converts using the production complete FX pair keys | US Jan31 Saturday raw | null instead of net70/current770 | raw Jan31→Jan30 |
| F-contract: keeps unknown opening fees unknown without losing a known current quantity | US Jan31 Saturday raw | null instead of current110 | raw Jan31→Jan30 |
| coordinator-round3-boundaries: does not seed a Shanghai first-day execution into pre-period inventory | US Jan31 Saturday raw | net0 instead of net10; opening0 unchanged | raw Jan31→Jan30; period Jan1 and precise Jan1 fill retained |
| coordinator-round3-boundaries: excludes executions after asOf from current inventory as well as from prices | Jan31 Saturday and Jan1 holiday raw | null instead of current110 | raw Jan31→Jan30; future fill unchanged |
| coordinator-round3-boundaries: selects the latest eligible current candle when a later candle also exists | Jan31 Saturday and Jan1 holiday raw | null instead of current110 | raw Jan31→Jan30; future Feb2 raw unchanged |
| invariant-red: R04 production FX snapshot keys convert current value | US Jan31 Saturday raw | 700 instead of 770 via old Dec31 price100 fallback | raw Jan31→Jan30 |
| invariant-red: R08 inclusive first-day PnL uses the pre-period mark | Jan1 opening in unverified 2025 session; US Jan1 holiday/Jan31 Saturday raw | null instead of net30 | period Jan1→Jan2; first-day raw Jan1→Jan2; closing raw Jan31→Jan30 |
| peer: assigns the IPO fee across short close and new long inventory | US Jan31 Saturday raw | closingUF48.5 instead of 8.5 from Dec31 150 fallback | raw Jan31→Jan30 |
| peer: deduplicates identical raw executions without reducing known market value | US Jan31 Saturday raw | 150 instead of current110 from Dec31 fallback | raw Jan31→Jan30 |
| peer: keeps ordinary cross-period fee bridge correct | Jan1 opening in unverified US2025 intraday session | opening/net null instead of 48/-31 | period Jan1→Jan2, preserving old Dec2 open / Jan2 close membership |

## Same-name F product test changes

- Every positive raw Jan31 2026 fixture becomes raw Jan30 with the same price/currency: Jan31 was Saturday for US/HK/CN; the asOf/statement knowledge dates remain Jan31. The explicit negative raw Jan31 price999 remains rejected. Expected financial amounts are unchanged.
- Four pre-period inventory cases (first-day gain, carried entry fee, average-cost components, unseen future short) move period start Jan1→Jan2. Jan1 opening means Dec31 2025 Shanghai EOD, when US2025 exceptional session timing is unverified; the approved policy is unknown. Jan2 opening means Jan1 Shanghai EOD, a known US holiday, so completed Dec31 raw is valid. No fill in these four scenarios changes period membership.
- The first-day gain test also replaces raw US Jan1 holiday with raw Jan2, retaining its financial values100/120/130 and net30.
- Mixed original-currency fixture uses CN-SH:BBB / market CN-SH instead of unsupported CN:BBB / CN.
- The final earlier-coverage-gap test replaces a fabricated CN-market entry and never-casts with buildInstrumentTradeSummaries→buildTradeLibraryEntries for a true CN-SH instrument. Its buy moves Jan2→Jan5 (Jan2 CN holiday), mark130/quantity1/current130 assertions unchanged.
- An old same-day bar test title now names completed US session/unfinished-or-weekend raw; its expectations and explicit raw Jan31 negative control remain. New valid US Oct22 intraday and post-close cases independently test the actual session boundary.
- All original75 cases remain, plus25 new cases. product-test.patch records the exact diff; before-test.ts.txt is the frozen original.
