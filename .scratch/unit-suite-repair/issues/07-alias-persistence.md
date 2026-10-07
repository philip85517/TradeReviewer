# Alias preference persistence synchronization

State: closed
Status: accepted
Assignee: unit_market_adapter
Refs: DESIGN-COVERAGE.md R12; app/components/trade-review-workspace.alias-recovery.test.tsx:127–148; app/components/trade-review-workspace.tsx:1292–1299,2542–2564; reports/full-unit-final.log

Full red: expected canonical object, received null at line147, duration668ms. Test waits three rendered scope values then immediately reads localStorage; canonical write is a separate passive effect. Production does wait for aliases before restoration; no production defect demonstrated.

Sole allowed file: app/components/trade-review-workspace.alias-recovery.test.tsx, only this case. Wrap the existing exact JSON persisted-value assertion in default waitFor. Preserve the pre-alias null check, deferred loader resolution, all three UI assertions and original legacy-key assertion. Keep exact expected object and original timeouts. No mock/fixture/key/product/setup changes, no skip, test deletion or assertion relaxation. Root runs tests sequentially after both owners freeze. No nested agents, services, DB, deployment or remote actions.

Implementation frozen by unit_market_adapter; root reviewed exact 3-added/1-removed line diff. reports/workspace-alias-synchronization-v2.log passes all four alias cases plus import context at the default configured two workers. Independent synchronization review and bare full-unit-final-v2.log remain pending. Previous full FAIL is preserved.

## Final coordinated acceptance

Accepted: 2026-10-06T22:39:08+08:00

Final exact JSON assertion uses default waitFor after the actual deferred alias loader/UI restoration; original pre-alias null, three UI values and legacy-key assertion retained. workspace-alias-synchronization-v2.log5/5, full-unit-final-v2.log complete alias file and independent-review-synchronization.md pass. Case/default timeouts unchanged.

All earlier pending/blocked status text describes preserved diagnosis and dispatch history. Current state is closed/accepted. Evidence paths above resolve under ../reports/. Overall safety, corpus skips and gates: [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md).
