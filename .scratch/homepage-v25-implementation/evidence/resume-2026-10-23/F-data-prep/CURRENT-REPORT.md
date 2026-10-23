# Current projection additive change

Implementation-ready for independent restored round 2/3, not independently accepted. UI NOT VERIFIED. Only the original F source and same-name test were edited. No shared ledger, import, page, dependency, service, business database, commit or push was changed by this worker.

## Behavior and evidence

The additive output reuses the existing current `State`, `amount`, `metric`, quote and fee pool. It adds global current net UF/open fees and per account/instrument current MV/net UF/open fees. It performs no new canonical replay. The exact consumption contract is in `CURRENT-INTERFACES.md`.

Six tests first failed because the requested fields were absent, then passed after the minimal additive implementation:

1. Independent current cutoff with a historical selected period and a future excluded execution.
2. Partial close retains only its remaining opening-fee pool; realized/net UF checked separately.
3. Unknown fees leave trusted MV available and current UF/open fees unavailable.
4. Two accounts retain original USD subtotals and production `USD:CNY` conversion/provenance.
5. True flat inventory is zero without a quote.
6. Missing `asOf` classifies every new current metric.

`03-current-api-red.log`: 6 FAIL, 98 skipped, accepted source snapshot. `06-current-api-final-green.log`: 7 files, 107 PASS, exit 0, 6.26 seconds total. This includes 75 same-name tests, 10 IPO fee tests, 10 diagnostic invariants, 4 independent coordinator contract tests, 4 historical true-pipeline boundary tests, 1 interface trace and 3 limited read-only data-preparation probes. The probes call through the actual canonical implementation; financial results are not mocked.

`07-current-api-typecheck.log`: F source, same-name tests and inherited strict dependency closure, exit 0. `08-current-api-eslint.log`: the two F product files, exit 0. The manifest records precise commands and final source/test/config hashes. No whole suite or new browser journey was run.

## Performance boundary

The new current fields add amount aggregation/conversion only. Existing repeated-builder probes still show 151 canonical calls for four 20-fill projections (25 distinct complete input hashes), and 711 calls for four 100-fill projections (105 distinct hashes). `probe-results.json` records local timings, inputs and actual results. These are bounded synthetic probes, not a 1866-fill/365-day performance acceptance. The current builder remains unsuitable for UI code that invokes it once per day. The separate plan will specify preparation, canonical reuse, evidence epochs and benchmark gates; no daily implementation is included here.

## Prior evidence integrity

The accepted source and tests were copied before editing, with their original SHA recorded in `accepted-round1-hashes.json`. Reusing the prior focused config inadvertently rewrote two trace JSON files in F-fix. Both were reconstructed using the accepted source and the original trace tests, then restored only after exact SHA and byte-count equality with the prior source manifest: interface trace `f1b9f916203ef60de7ce1ba05eca1ad41100c422da28483ffe3a525bda42fa76` / 80289 bytes; IPO trace `4784a006e69364ec27f7020a8038080671b7743c9f1d1b0877256d3a8de2cbde` / 273164 bytes. `05-accepted-trace-reconstruction.log` records 11 PASS; `evidence-restoration.json` records the cause, exact guard and restoration. The final configuration uses separate F-data-prep test copies and output paths. Prior accepted logs and the 277-test evidence were not rewritten.

The final manifest verifies every F-fix file listed in its original source manifest is byte-identical. Original acceptance and historical FAIL records remain separate; the new implementation-ready report does not rename them as accepted.
