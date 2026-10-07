# Legacy market fixture read overhead

State: closed
Status: accepted
Assignee: unit_market_adapter
Refs: DESIGN-COVERAGE.md R11; app/components/test-support/legacy-sqlite-client.ts getMarketData; app/lib/storage/indexeddb-market-data-repository.ts readonly getters; reports/workspace-import-isolated-current.log

The import context test still independently times out at its original 5000ms budget after query scoping. The real legacy fixture adapter serializes separate database opens/readonly transactions for unrelated candle and coverage reads. Preserve the actual fixture data and failed refresh coverage instead of replacing the response with constant empty arrays.

Allowed implementation: only `app/components/test-support/legacy-sqlite-client.ts` getMarketData. Start independent existing getter calls together with Promise.all; retain exact defaults, date slicing, dailyOnly/non-daily branches, return keys and conditional 1D coverage, and rejection behavior. Do not change repository/product code, mock data, catch errors, or remove async IDB. Concurrent reads do not create a snapshot contract absent from the previous separate transactions; tests must still verify affected journeys and existing deferred-read safety.

No tests while another owner is running tests. Coordinator runs three-case, full workspace and full unit gates after the candidate is frozen. No nested agents, browser, business DB, service, deployment, commit or remote actions. Read current workflow and source references before editing. Report exact diff and semantic risks to coordinator; no accepted/completion claim.

Frozen implementation: only getMarketData now uses Promise.all for existing independent readonly getters. Independent review passes (reports/independent-review-final.md). The actual original response/defaults/records remain; simultaneous multiple failures can select a different first rejected error, with no error-priority contract observed. Root three-case one/two-worker probes each pass 3/3, and complete workspace passes 91/91 (reports/workspace-full-frozen.log). All other adapter consumers and bare full-suite acceptance remain pending.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

Root and independent-review-final.md accept only concurrent independent readonly getters, preserving defaults, shapes, actual IDB records, conditional coverage and rejected errors. Full-unit-final-v2.log passes the complete main file plus all four other adapter consumers and existing deferred-read/cancel/dispose safety coverage. Concurrent failures may report first temporal rejection; no prior error-priority or atomic-snapshot contract exists. No product repository or business DB change.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
