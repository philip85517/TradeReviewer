# Two-Level Trade Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a functional transaction library that first groups imported executions by stock, then opens a stock detail view whose left rail lists paired position episodes and whose right pane shows the selected episode’s chart, executions, and review state.

**Architecture:** Keep imported executions immutable and derive all library rows, episodes, allocations, and metrics through pure domain functions. The workspace owns only navigation and selected-stock state; a focused `TradeLibrary` component owns search/filter/detail presentation. Existing IndexedDB candles remain the single chart source, so opening or switching library views never triggers a network request.

**Tech Stack:** TypeScript, React 19, Decimal.js, Vitest, Testing Library, Lightweight Charts, IndexedDB-backed daily candle repository.

## Global Constraints

- The library has exactly two levels: stock collection, then position episodes for one stock.
- Episodes are built independently per `accountId + instrumentId`.
- A position changing from zero to non-zero starts an episode; returning to zero closes it.
- A fill crossing zero is allocated between the closing episode and a new reverse-direction episode without mutating the imported execution.
- Stock and episode views read local executions and local candles only; navigation must issue zero market-data requests.
- Persisted monetary and quantity facts remain decimal strings; calculations use Decimal.js.
- Imported stocks support only local `1D` and `1W` candles in this phase.
- AI-generated summaries and pattern insights remain out of scope for this phase.
- Confirmed tags, tag filtering, cumulative R, and persisted review status depend on the Phase 3 structured review/tag store. Phase 2 renders explicit “待复盘 / 标签待确认 / R —” placeholders and must not synthesize these facts.

---

### Task 1: Deterministic Episode Metrics

**Files:**
- Modify: `app/lib/trades/episodes.ts`
- Modify: `app/lib/trades/episodes.test.ts`
- Create: `app/lib/trades/episode-metrics.ts`
- Create: `app/lib/trades/episode-metrics.test.ts`

**Interfaces:**
- Consumes: `TradeEpisode`, `TradeExecution`, and an optional decimal-string mark price.
- Produces: `summarizeTradeEpisode(episode, markPrice?) => TradeEpisodeMetrics`.

- [ ] **Step 1: Write failing stable-order and metric tests**

Test that equal-time executions sort by file fingerprint, source row, and execution ID; a closed long returns literal net P&L and return percentage; an open long uses the supplied mark; and no mark returns `null` unrealized/net return fields rather than inventing prices.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec vitest run app/lib/trades/episodes.test.ts app/lib/trades/episode-metrics.test.ts
```

Expected: failures show missing deterministic tie-breakers and missing `summarizeTradeEpisode`.

- [ ] **Step 3: Implement deterministic sorting and Decimal metrics**

Define:

```ts
type TradeEpisodeMetrics = {
  buyCount: number;
  sellCount: number;
  boughtQuantity: string;
  soldQuantity: string;
  grossExposure: string;
  fees: string;
  realizedPnl: string;
  unrealizedPnl: string | null;
  netPnl: string | null;
  returnPercent: string | null;
  holdingMilliseconds: number | null;
};
```

Use signed cash flow plus `signedRemainingPosition * markPrice` for open episodes. For closed episodes, compute net P&L directly from all allocated fills and fees.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 1 test command and expect all tests to pass.

### Task 2: Stock-Level Library Projection

**Files:**
- Create: `app/lib/trades/library.ts`
- Create: `app/lib/trades/library.test.ts`

**Interfaces:**
- Consumes: `InstrumentTradeSummary[]` and `Record<instrumentId, DailyCandleRecord[]>`.
- Produces: `buildTradeLibraryEntries(summaries, candlesByInstrument) => TradeLibraryEntry[]`.

- [ ] **Step 1: Write failing projection tests**

Use literal fixtures to prove that executions across accounts become independent episodes, account/episode counts are correct, open state is propagated, episode net P&L rolls up only when calculable, and rows sort by latest execution descending.

- [ ] **Step 2: Run the projection test and verify RED**

```bash
pnpm exec vitest run app/lib/trades/library.test.ts
```

Expected: module/function missing.

- [ ] **Step 3: Implement the pure projection**

Define a `TradeLibraryEntry` containing the normalized instrument, executions, recent-first episodes with their metrics, account count, first/last trade timestamps, status, and nullable aggregate P&L/return.

- [ ] **Step 4: Run the projection test and verify GREEN**

Run the Task 2 command and expect all tests to pass.

### Task 3: Two-Level Trade Library UI

**Files:**
- Create: `app/components/library/trade-library.tsx`
- Create: `app/components/library/trade-library.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: library entries, candle map, market-data statuses, selected timeframe, import callback, and “open in replay” callback.
- Produces: a stock collection with search/market/account/year/open/data-status filters, a visibly deferred tag filter, and a stock detail with a recent-first episode rail.

- [ ] **Step 1: Write failing component tests**

Prove the first level shows stock name/code, account count, fill count, episode count, range, status, and P&L; search/filter hides non-matches; selecting a stock opens the second level; selecting an episode updates its chart/execution details; and back returns to the stock collection.

- [ ] **Step 2: Run the component test and verify RED**

```bash
pnpm exec vitest run app/components/library/trade-library.test.tsx
```

Expected: missing component.

- [ ] **Step 3: Implement first-level stock collection**

Render the searchable/filterable stock table/cards, meaningful empty states, local market-data status, and recent-first ordering without any effects that call `fetch`.

- [ ] **Step 4: Implement second-level episode detail**

Render a back action, stock identity, episode rail, local daily/weekly `ReplayChart`, scoped fill table, metric cards, and explicit empty states for plan/review fields not yet recorded.

- [ ] **Step 5: Run the component test and verify GREEN**

Run the Task 3 command and expect all tests to pass.

### Task 4: Workspace Navigation Integration

**Files:**
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`

**Interfaces:**
- Consumes: current imported executions, cached candles, sync statuses, and timeframe.
- Produces: working `逐笔复盘` and `交易库` navigation; `模式洞察` remains visibly scheduled for the next implementation phase.

- [ ] **Step 1: Write failing workspace navigation tests**

Persist two completed episodes for one imported stock, click `交易库`, verify the two-level library appears, open the stock and the most recent episode, then return to `逐笔复盘`. Clear the `fetch` mock before navigation and assert it remains untouched.

- [ ] **Step 2: Run the workspace test and verify RED**

```bash
pnpm exec vitest run app/components/trade-review-workspace.test.tsx
```

Expected: `交易库` button does not change the view.

- [ ] **Step 3: Wire explicit workspace mode state**

Add a discriminated view state, active nav styling/ARIA, render `TradeLibrary` for the library mode, and route “进入逐笔复盘” back to review with the selected imported instrument.

- [ ] **Step 4: Run the workspace test and verify GREEN**

Run Task 4 tests and expect navigation and zero-network assertions to pass.

### Task 5: Acceptance and Public Release

**Files:**
- Modify only files required by defects found during verification.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: reviewed, committed, pushed, and publicly deployed Sites version.

- [ ] **Step 1: Run complete automated verification**

```bash
pnpm run test:unit
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
node --test tests/rendered-html.test.mjs
git diff --check
```

- [ ] **Step 2: Review against the approved specification**

Confirm stock grouping, account-isolated episode pairing, zero-crossing allocation, local-only navigation, recent-first episode selection, and chart/detail behavior. Fix every Critical or Important finding through a failing regression test.

- [ ] **Step 3: Perform browser acceptance**

Using imported fixtures, verify the top navigation, stock library, stock detail, episode switching, cached chart rendering, transaction table, empty plan/review states, and return-to-replay action. Confirm no browser errors and no market request caused by library navigation.

- [ ] **Step 4: Commit and push**

Commit with `feat: add two-level trade library` and push the current branch.

- [ ] **Step 5: Save and deploy the exact Sites version**

Push the exact commit to the configured Sites source repository, package that exact build, save a new version, deploy publicly, and poll deployment status to success.
