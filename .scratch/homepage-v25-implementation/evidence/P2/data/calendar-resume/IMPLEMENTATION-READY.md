# Resume candidate 1 — implementation ready, awaiting root acceptance

Owner: `/root/finance_calendar_resume`; dispatched actual model `gpt-6.1-sol / ultra`. Same financial A task; restored budget is at most 3 candidates. This is the first restored candidate. No threshold, fixture, financial contract, or cache-budget changes. Original three candidate failures, original multimarket cold **2617.548995ms FAIL**, and old future-FX RED evidence remain binding and untouched. This worker has run **no formal heavy benchmark**; root owns the quiet window and final acceptance. This record claims implementation readiness only.

## Scope and references

Writes are limited to `app/lib/reviews/homepage-v25-performance.ts`, additive content in its existing test, and new files here. `14-scope-preservation.json` confirms all 971 original test lines remain an exact byte prefix and ledger/source tests, series/source tests, market calendar and sync range retain their input hashes. Input dirty status is preserved in `INPUT-STATUS.txt`; no commit, push, merge, service, database, browser, UI, or subagent action was performed.

Read the current project development, task-decomposition and issue-tracker workflows; systematic-debugging and TDD skills; original HP02:193–252 and HP09:467–518 spec; coverage rows HV25-14..22/47..49; full `period.svg`, `chart-gap.svg`, `chart-hover.svg`; complete P2 finance contract and coordinator decisions; independent-review test/review/RED logs; immutable-sharing checkpoint, profile plan and diagnostic-v2 summary; full performance source and original test, ledger, calendar and sync-range source. The root-independent log actually resides under `p2-b/ROOT-independent-future-currency.log` (not directly under data).

The data journey is actual executions → summaries → library original lineage → prepared financial source → boundaries/independent current → unchanged series. Root retains whole-page consistency, complete data-flow and independent acceptance ownership. This pure-finance scope has no changed UI or persistence flow; UI/database checks are scope-NA here. The page, controls, visual and persistence gates remain separately NOT VERIFIED.

## Implementation

1. Construct every native endpoint/current Amount before requesting FX. Derive required currencies from actual `eligible` facts, including null/unknown amounts, independently eligible incurred fees and canonical known fees. Preserve all source groups and future carriers so early statement inventory/fees remain discoverable. Retain historical closed-period realized dependencies while deriving current dependencies only from current open/unknown facts. FX knowledge rules, Decimal money arithmetic, fees, source/provenance fields, quote selection and all eleven endpoint metrics remain unchanged.
2. A construction-only `BatchMarketCalendar` caches the unchanged required-range calculation by exact `(market,cursor)`, date ranges by exact `(market,start,end)`, and market-local day strings with reused formatter instances. Cache CalendarOutOfRange errors without changing classification or swallowing other errors. Create it after the batch memo miss, share it across opening/endpoints/current, then clear it. No maps attach to source/index/memo. Instrument raw quote selection, invalid price/currency, missing sessions and knownness remain instrument-specific. Standalone F3 wrappers retain their default quote path; prepared current calls the same wrapper selection with identical shared calendar results.

## Evidence

| Gate | Worker result | Evidence |
|---|---|---|
| Original independent future-HKD reproduction | RED preserved, then GREEN | `01-independent-red.log`, `05-independent-fx-green.log`, final `09-final-independent-green.log` (1 test) |
| FX TDD, before calendar changes | 6 additive regressions GREEN | `02-fx-additive-red.log`, `03-fx-additive-green.log`; `fx-stage-performance.ts` and test snapshot |
| Intermediate F/A/B/ledger | 204 tests PASS | `04-fx-targeted-suite.log` |
| Calendar TDD | 3 new tests PASS | `06-calendar-red.log`, `07-calendar-green.log` |
| Final original F/A/B/ledger plus 9 additive tests | 207 tests PASS, 3 files | `08-final-targeted-suite.log`; original performance 141 + 9 = 150 preserved |
| Calendar complete public equivalence against FX-stage oracle | PASS across original 6 scenario families and repeat/reversed orders | `11-public-equivalence-green.log` (8 tests total), `11-calendar-public-equivalence.json`; every public field compared, only operational `diagnostics` excluded |
| Original normal fully eligible live three-currency public equality | PASS, complete bytes equal | Same report, SHA `d6fecc0365f8d86126e9f7f46195bcc51522de6136b7ed33f762cba09dfbeef2` for candidate and input oracle |
| Intentional old FX oracle correction isolated | PASS, old/new complete outputs retained | `11-intentional-fx-oracle-delta.json`: pre-exposure requiredPairs becomes empty, native money equal, independent normal current equal |
| Strict dependency-scope TypeScript | PASS, exit 0 | `12-strict-tsc.log`, then `15-strict-tsc-with-runner.log` after adding benchmark runner to scope |
| Product source and existing test ESLint | PASS, exit 0 | `13-eslint.log` |
| Native runtime / runner syntax | PASS | `16-runtime.json`; `bash -n` only, benchmark script not executed |
| Formal 1866 fills ×365 points ×3 shapes ×3 fresh processes, 3 repeats each | **NOT VERIFIED** | Root quiet-window acceptance still required. Cold≤2000ms, each repeat≤200ms, cache≤64MiB/8192, complete public bytes, 365 literal oracle, no extra canonical repeat work unchanged |

The calendar test directly checks CN-SH close before/after, HK auction before/after, US summer/winter closes and verified half-day cutoff, and distinct CN-SZ market keys. Successful requiredRange calls fall from 176 repetitions to 48 exact keys for 4 markets × (10 cursors + opening + current). A different batch recalculates 44 keys because its independent current object is already memoized; it does not reuse a permanent calendar cache. Repeated unsupported-calendar failures fall from 8 to 3 exact market/cursor calculations. A peer with a complete quote does not repair another instrument's missing session. Existing original tests still cover all other original semantics including holiday/unknown knowledge, immutable graphs and memo bounds.

All RED/FAIL logs are preserved. `02` included one **new test expectation** currency-order mistake alongside the reproduced product bugs; only the newly appended expectation was corrected to actual retained group ordering. `10-public-equivalence.log` is also retained: 7 tests passed and one newly written old-oracle assertion expected the reversed requiredPairs order. Its sole test expectation was corrected and the output report moved to `11`; no old test or financial result was changed to get green. These are internal TDD iterations within restored candidate 1, not silent formal benchmark reruns.

## Frozen artifacts and hashes

- Source: `1e64b1c23aa0d42b96331d1eb89b6ec4c16e7d26c13454edc7c7449567df0542`.
- Test: `4e65eef8d568d9a56d258e328229a7f06c9f513583b90d85f328d4902395c33a`.
- Exact input → candidate diffs: `homepage-v25-performance.ts.diff`, `homepage-v25-performance.test.ts.diff`.
- Original byte snapshots: `input-performance.ts`, `input-performance.test.ts`; native hashes in `INPUT-HASHES.json`.
- Candidate byte snapshots: `candidate1-performance.ts`, `candidate1-performance.test.ts`.
- Relocated read-only execution oracles: `input-oracle.ts` and `fx-stage-oracle.ts` differ from their source snapshot only in import paths resolving to the same app dependencies. Source snapshots remain unmodified.

## Exact commands

Working directory `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`. All commands use the project-pinned native Node/SQLite wrapper. Logs `01` through `15` are outputs of these exact command forms; RED and final repetitions use different log paths and preserve prior files.

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/independent.config.ts --configLoader native
./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/targeted.config.ts --configLoader native app/lib/reviews/homepage-v25-performance.test.ts -t 'P2 boundary FX eligibility'
./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/targeted.config.ts --configLoader native app/lib/reviews/homepage-v25-performance.test.ts -t 'P2 batch-local market calendar sharing'
./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/targeted.config.ts --configLoader native
./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/equivalence.config.ts --configLoader native
./scripts/native-node.sh node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/tsconfig.json --noEmit
./scripts/native-node.sh node_modules/eslint/bin/eslint.js app/lib/reviews/homepage-v25-performance.ts app/lib/reviews/homepage-v25-performance.test.ts
bash -n .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/benchmark-runner.sh
```

Only after root has established its quiet window:

```sh
bash .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/benchmark-runner.sh
```

That script launches fresh Vitest processes using the unchanged imported `immutable-sharing/fixtures.ts` and the original benchmark test logic (only local output path and input-oracle import relocated), with `P2_RUN=root-resume1`, each `P2_SHAPE=rounds|long-prefix|multimarket`, each `P2_SAMPLE=1|2|3`. It refuses to overwrite an existing sample/log and stops on any failure, preserving failure and remaining NOT VERIFIED for root to assess. Root can also invoke any exact fresh sample directly:

```sh
P2_RUN=root-resume1 P2_SHAPE=rounds P2_SAMPLE=1 ./scripts/native-node.sh node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/P2/data/calendar-resume/benchmark.config.ts --configLoader native
```

Remaining: root independently review source/diff and numerical coverage, run final targeted checks at frozen hashes, run formal quiet-window benchmark and full literal/public oracle gates, then update feature README/final acceptance together. No worker-only PASS is whole-feature acceptance; known old FAIL and page NOT VERIFIED stay explicit until root accepts evidence.
