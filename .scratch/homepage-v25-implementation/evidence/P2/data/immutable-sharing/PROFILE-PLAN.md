# One opt-in CPU diagnostic; no fourth candidate

Status: PREPARED, NOT RUN by the implementation owner. Root decides whether to execute this one diagnostic. Frozen F source/test and all seven root-independent samples remain binding. P2 stays 0/3; multimarket cold 2617.548995ms FAIL and multimarket cold samples 2/3 NOT VERIFIED are preserved.

Run once from repository root only after root authorization and a quiet CPU window:

```sh
P2_ALLOW_DIAGNOSTIC_PROFILE=1 /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/profile.config.ts > .scratch/homepage-v25-implementation/evidence/P2/data/immutable-sharing/diagnostic-multimarket.log 2>&1
```

The harness starts `node:inspector/promises` CPU profiling inside the actual Vitest test worker after imports, fixture construction and real summaries→entries upstream finish. A 1000μs sampling interval covers exactly one `prepareHomepageV25Source` plus one `projectHomepageV25Boundaries`. Profiler stops before serialization, graph comparison, the frozen oracle and repeats. This avoids profiling the Vitest coordinator instead of the implementation worker. No source instrumentation, proxies, fixture substitutions, financial answer precomputation or source/index answer storage are introduced.

The exact same `largeFixture("multimarket")` has 1866 raw fills, three accounts/markets, 365 requested endpoints, 743 session quotes and 365 dated FX observations. Before starting, the harness asserts source SHA `094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a`, input SHA `befe3b83a976e5016b0602d475f18980a1d323e9d83316073240943f3e2c490c`, request SHA `7e6b24950ade6eb6b41899df76771ad999bb01bf6712908a276fffa9522285e9`. Existing `.started.json` blocks silent reruns/overwrites. A failed attempt remains evidence; do not remove its marker to retry.

Outputs in this directory:

- `diagnostic-multimarket.started.json`: timestamp, runtime, hashes, exact fixture and nonformal diagnostic scope.
- `diagnostic-multimarket.cpuprofile`: raw V8 CPU profile, one cold capture.
- `diagnostic-multimarket.batch.json`: every batch field, including all diagnostics, numeric money, coverage, reasons, source clocks, fee facts and lineage. No fields are pruned.
- `diagnostic-multimarket.report.json`: diagnostic prepare/batch durations, three exact identity repeats, actual memo admission, 365 independent numeric oracles, and complete public-byte equality against the frozen implementation (only operational `diagnostics` excluded from equality, retained separately in the full batch).
- `diagnostic-multimarket.log`: process result and any failure.

Profile durations include instrumentation overhead and are NEVER a formal ≤2000ms cold sample. They neither repair the existing FAIL nor authorize a new performance variant. The 64MiB estimator and ≤200ms repeat gates are unchanged.

## Read-only attribution before any architecture proposal

Use the `.cpuprofile` samples/timeDeltas and call tree, with the frozen source/hash and source locations, rather than inferring causes from the 2277ms batch total. Report weighted sampled CPU time and both inclusive/self shares. Do not double count parent/child shares.

1. Separate preparation from projection using the `prepareHomepageV25Source` and `projectHomepageV25Boundaries` stacks. Inside preparation, report source capture/digest, group/index construction, canonical checkpoints, and `accountPermanent` traversal where samples distinguish them.
2. In projection, identify `ProjectionSharing.exact` and the same-boundary closure: full-content JSON keys, full-precision Amount keys, Map probes and freezing. Native `JSON.stringify` may appear only as caller self time; label that share as sharing self/native unless source-line/native evidence isolates serialization. Do not describe all sharing self time as proven serialization cost.
3. Separately identify the unchanged `metric`/Decimal and `fxFor`/pair provenance work. Keep preparation Decimal work within preparation; avoid attributing every Decimal frame to output conversion.
4. Identify `ProjectionMemo.set`, `shape`, `retain`, `release`, candidate preflight and eviction traversal. Attribute nested graph work to graph accounting rather than also to sharing or source/index totals.
5. Report canonical prepared queries, prefix selection, quote/session logic, evidence/fee assembly and remaining named stacks. Keep GC, runtime/native frames without defensible ownership, profiler overhead and unclassified samples explicit.

Call-stack CPU samples do not prove allocation counts or wall-clock waiting, and a single sampled run has resolution limits. If native serialization or GC cannot be separated, preserve that ambiguity instead of inventing percentages. Discuss a subsequent architecture change only after this one diagnostic establishes which category actually dominates and which evidence remains unresolved. No optimization is authorized by this plan.
