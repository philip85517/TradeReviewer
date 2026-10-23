# Four KPI leaf: implementation ready, frozen for root review

Prepared 2026-10-23 CST by `/root/metric_cards`, actual **gpt-6.1-sol / ultra** in `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`, base HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. This is bounded preparation, not a completed UI delivery or P2/P4 release. Root formal leaf acceptance remains **0/3**, max3 for the same task. Worker synthetic passes do not consume or replace independent root acceptance.

## Frozen files

Only these three new product files were written:

| File | Exact SHA256 |
| --- | --- |
| app/components/homepage-v25/metric-cards.tsx | 344ee710457cc95f2cf384a882b9c800e84cc5c1ea068216c44cc4e915284bea |
| app/components/homepage-v25/metric-cards.css | 5a99e9f9a77cb2e7d20340d9a40e0757cbc7917222e74fbc358646c4c9267194 |
| app/components/homepage-v25/metric-cards.test.tsx | 4c4aeb1393c09bdc7a81d127002d3a032c2fb5850011cf502117426abf2e3d3a |

Full new-file diff: `NEW-FILES.diff`. Exact reference/type inputs and product hashes: `SOURCE-SHA256.json`. All additional writes by this worker are in this metrics evidence directory. Existing shared work was preserved. No shared tracker, existing product/test/config, A/B/F ledger/cache, service, network, DB or dependency was modified. No browser, child agents, commit, push, merge, full suite or performance experiment occurred. A performance remains failed3/paused; no threshold waiver, fourth fix or reopened task is implied.

## Public caller contract

Named exports: `MetricCards`, `MetricCardsProps`.

```ts
type MetricCardsProps = Readonly<{
  series: Readonly<HomepageV25SeriesBundle> | null;
  reportCurrency: string;
  status: Readonly<{ kind: "ready" }>
    | Readonly<{ kind: "pending" | "error" | "empty"; reason: string }>;
}>;
```

The host passes its last committed, complete same-generation B bundle during pending/error and changes range labels/data atomically outside the leaf. Null means no committed data. This component stores only transient detail selection/position; no local data cache, fetch, callback requesting data, projector call, amount arithmetic, fee calculation, qualification or FX conversion. Decimal is used only to format supplied decimal strings into established two-place 万/亿 presentation. All original exact strings remain available in details and the trigger accessible name.

The three period cards read `periodSummary.net`, `.periodRealized`, `.unrealizedChange`; the fourth reads `current.currentMarketValue`. It never substitutes `closingUnrealized`, prior points or latest current data for a historical period. Current details also read `current.currentUnrealized`, supplied original currency/FX/coverage/reasons and current context. Existing available/value is the financial authority; explicit empty/future hides that context's amounts, with the current snapshot remaining independent for future periods. Generation/source/currency replacement closes any stale detail and restores its opener.

## Spec compliance self-review

Original source spec/manual and five reference images were read/directly viewed as recorded in `REFERENCE-READS.md`. Full finite key/state/control ownership and acceptance table: `CONTROL-STATE-MAP.md`.

Code and synthetic review finds four simultaneous ordered 88px cards,14/20 labels,28/34 primary values,12px gaps, positive/negative/zero/current-neutral tones. Each full-card semantic button opens a nonmodal detail portal; Tab order, Enter/Space, Esc, close/outside restoration and direct card switching have consumer assertions. Pending/error old bundle stays intact; first load uses four skeletons; empty/missing uses — with explanation, no CTA. Hover highlights only the detail affordance; focus ring is2px; reduced-motion disables transitions/entry animation. The proposed local container layout is4 columns at996+ content pixels,2 at492–995,1 below492; original baseline276×88 is not treated as fixed page width. Root must compare it at actual1440/1280/390 viewports and both sides of these boundaries.

Root ruling1 (display currency): `reportCurrency` is the report context. A mismatched money.targetCurrency produces — and 币种与报表不一致, retaining true source amount/currency and origin in details, also for currentUnrealized. It never labels USD as CNY or creates mixed card headings, and performs no financial requalification. Minimal literal mismatch consumer test passes.

Root ruling2 (extreme spatial fallback): no scientific notation or smaller typography. Established two-place 万/亿 remains. Only actual numeric overflow receives visible CSS ellipsis; sign is at the retained start and 万/亿 unit is a nonshrinking suffix. Raw values are never rewritten/truncated. Trigger accessible name and details retain full exact precision. Regular/reference extreme numbers must not ellipsize. The30-digit consumer precision assertion passes; actual overflow, sign/unit visibility and full detail readability require root browser visual acceptance. No JSDOM geometry was fabricated to claim this.

## Quality self-review and verification

Final source/test and new-file diff were reviewed against the original contract. Literal B fixtures import only the public types, not the financial projector or service. Deep-frozen input/rerender test confirms no input mutation, atomic new generation and current independence. No hook lint suppressions, unsafe HTML or network mocking was introduced. Global document/resize/scroll listeners and ResizeObserver are cleaned up; portal geometry uses actual DOM placement and24px edge budget, with bounded vertical scrolling for long details. Semantic labels include complete exact amount; missing values are called unknown rather than zero.

Two meaningful boundary defects found during self-review were fixed through separate RED→GREEN logs: future details leaked supplied period numeric evidence; clicking another card was incorrectly handled as an outside-close. Both regression assertions pass in the final20-test run. This self-review is not independent acceptance.

| Gate | Result / exact evidence |
| --- | --- |
| New consumer behavior tests | **PASS20/20**,10-final-tests.log, pinned Node26, Vitest1 file/single worker, exit0 |
| Strict scoped TypeScript | **PASS**,11-final-types.log, exit0/no diagnostics |
| Scoped ESLint TSX/test | **PASS**,12-final-lint.log, exit0/no diagnostics |
| Original reference read/direct view | Done; REFERENCE-READS.md plus input hashes; no implementation screenshot |
| Real mouse/keyboard interaction | **NOT VERIFIED**, no browser permitted in worker scope |
| Emulated / physical touch | **NOT VERIFIED**, no touch evidence |
| Host/page end-to-end same-generation integration | **NOT VERIFIED**, root-owned caller not implemented here |
| Independent matching-state visual comparison | **NOT VERIFIED**, root-owned; not replaced by tests/CSS inspection |
| Leaf DB write persistence | **NOT APPLICABLE**: readonly no-IO leaf; future page persistence gates unchanged |
| Broader build/full suite/performance | Not run under bounded dispatch; no broader pass claimed |

Exact commands/exits and preserved RED history: `COMMANDS.md`, logs01–12. Passing Vitest emits the runner's Node DEP0205 module.register deprecation; no application warning/error appeared. CSS was source-reviewed, not claimed ESLint-validated.

## Remaining root acceptance and freeze

Root must create its separately owned real controlled caller, independently verify changed/affected journeys, compare original/reference states at1440/1280/narrow390 and actual container boundary sides, check no card value/affordance overlap, full focus ring, long Chinese/amount readability, 24px detail edge/scroll budget, normal/reference extreme non-ellipsis and authorized pressure-value fallback. Root must track actual mouse, keyboard, emulated touch and physical touch separately and record version-bound evidence. No preview URL or completed UI claim is supplied by this worker because no service/browser was authorized here.

All worker writes freeze with this report. Any root finding reopens only this bounded leaf within the existing formal cap; no extra scope or A performance work is authorized. Product SHA verification after evidence generation is recorded in `13-freeze.log`.
