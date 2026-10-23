# P1 freeze 1 — independent owned-read peer recheck

2026-10-23 01:50:01–01:50:07 Asia/Shanghai (2026-10-22T17:50:01.033Z–17:50:07.023Z). **15/15 PASS, scoped to jsdom hook/adapter behavior. This is not formal P1 or product acceptance.** No product files were changed; no services, browser, or DB were used by this review. F verification is outside this runner.

Command:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/run-frozen-recheck.mjs p1-round1 67ca968a215963a648c09033ac76f65a2c321b23f88e896f71aa18693c2ca4b9 55e40ada6ba54e64fe1e714eeca7af7a267822471fff5169ce1761b6af52db8c
```

The runner used fixed Node v26.0.0, Vitest v4.1.10, exact two-file include, one worker, and no cache. Exit 0; 2 test files / 15 tests passed, test duration 196ms and total Vitest duration 5.32s. Full log: `p1-round1.log`. Exact command, timestamp, SHA-256 before/after, stable=true, and exit code: `p1-round1-manifest.json`. Immutable reviewed source copies: `p1-round1-source/`.

|File|SHA-256, unchanged before/after|
|---|---|
|use-homepage-host.ts|`67ca968a215963a648c09033ac76f65a2c321b23f88e896f71aa18693c2ca4b9`|
|trade-review-workspace.tsx|`55e40ada6ba54e64fe1e714eeca7af7a267822471fff5169ce1761b6af52db8c`|
|session-model.ts|`45e73c3b315b75f1660d6829694272d0d5bfcd1f51452a95fcacd2accf652973`|
|accepted S source|`ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`|
|old-six probe and independent copy (identical)|`64b67b64b755e207b8f1b44c7973651878541e0e31194f9c3eabcf79b3df9740`|
|new-nine owned-read probe|`8fce4c4a4442c7b14213d0ef472faca5372e2bde30d815525309004a20a66c4d`|
|exact-include config|`751ec775fcb6bbe34a30959be73484f5a506b6ef78307b84b4c390b8b3844577`|

All eleven captured inputs in the manifest were stable. The original six tests were copied without edits; original RED logs and source snapshots remain intact. These results supersede their current-status descriptions only for this fingerprint and tested boundary.

|ID|Exact behavior checked|Result|
|---|---|---|
|PS01|Explicit valid URL B stays authoritative over different valid source A|PASS|
|PS02|Timeout followed by late owned success cannot publish data/committed scope or callback|PASS|
|PS03|Fresh return bootstrap removing saved account produces a host explanation|PASS|
|PS04|Synthetic unindexed same-document popstate reaches leave guard|PASS|
|PS05|Workspace-shaped options.data rebuild cannot replace accepted fresh FX with old FX|PASS|
|PS06|Successful valid-account correction clears invalid direct-home route error and syncs scope|PASS|
|PS07|ready=false delays initialization/read; ready=true starts exactly one owned complete first read, retaining seed until success|PASS|
|PS08|B atomically commits rows and full FX facts; late A and unowned external seed updates cannot overwrite B|PASS|
|PS09|Focus starts a new owned read C; complete B remains visible until complete C succeeds|PASS|
|PS10|Cancelled leave preserves address, source snapshot, accepted data, and UI; no reload starts|PASS|
|PS11|Obsolete rejected A cannot cancel B or replace B's pending state; B can succeed|PASS|
|PS12|Response carrying wrong owner requestId cannot satisfy the current pending request or callback|PASS|
|PS13|Fresh return account deletion retains remaining valid accounts and non-scope UI, with notice|PASS|
|PS14|A concrete direct target account absent from its own fresh catalog fails without widening, publishing data, or callback|PASS|
|PS15|Direct target symbol absent from first owned fresh catalog fails without publishing unfiltered data; target URL remains explicit|PASS|

## Remaining boundaries

- Browser back/forward timing remains **NOT VERIFIED** here. Current source replaced the old zero-delay timer with an `afterPopReverted` continuation triggered by compensating `popstate`; the root must still exercise actual browser history, immediate/async guard cancel/allow, and repeated navigation. PS04 uses a synthetic unindexed event and does not exercise that indexed async compensation path. The original R4 risk/evidence remains in the historical report.
- PS10 tests cancelled **leave**, not cancellation of an already running host read; the current host exposes no separate request-cancel API. PS02/PS08/PS11/PS12 separately establish timeout, supersession, obsolete rejection, and wrong-owner invalidation at the hook boundary. Do not claim all cancellation journeys from these results.
- Hook fixtures replace `reload`; they prove bundle ownership and adapter publication, not real API/bootstrap/FX writes, repository persistence, browser focus/scroll, actual controls, or visual fidelity. Root-owned isolated-DB journey, reload, physical/browser input, and visual evidence remain required.
- `SECONDARY-STATIC-REVIEW.md` records M01: the broad trade-merge metadata validator can bypass the official exchange contract. It is a concrete source-level gap separate from this all-green hook matrix. Normal validated official merge and ordinary execution-list/final-close-statistics paths showed no additional static defect. Their persistence is not accepted by this report.
- This pass does not authorize P2–P4, accept F, or increment formal P1 acceptance. Root owns those decisions.
