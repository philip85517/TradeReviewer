# Trade Reviewer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable first vertical slice that imports Futu XLSX trades, groups them into review episodes, replays multi-timeframe candles without leaking future data, and provides a TradingView-style chart workspace with core drawing tools.

**Architecture:** Keep broker parsing, accounting, replay, market aggregation, and drawing state as framework-independent TypeScript modules. A client-side React workspace composes those modules around Lightweight Charts, while browser-local persistence keeps imported records and annotations on the device. The first release uses deterministic demo market data and user-imported Futu executions; PDF adapters and licensed historical-data providers remain separate follow-on slices.

**Tech Stack:** React 19, TypeScript 5.9, vinext/Vite, TradingView Lightweight Charts 5.x, SheetJS XLSX, Decimal.js, Lucide React, Vitest, Testing Library.

## Global Constraints

- Brokerage exports under `trades/` and local databases must never be committed or deployed.
- Future candles, future executions, future P&L, and later annotations must never cross the replay boundary.
- Execution prices remain unadjusted broker truth; chart transformations must preserve marker alignment.
- Monetary and quantity calculations use decimal arithmetic.
- The UI follows TradingView interaction patterns but does not copy TradingView branding, code, or proprietary assets.
- The first vertical slice supports demo OHLCV at 15m, 1h, 4h, 1D, and 1W; unsupported periods are visibly disabled.
- Drawings are device-local, versioned, and clamped to the revealed replay range.

---

### Task 1: Project contracts and privacy boundary

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `app/lib/trades/types.ts`
- Create: `app/lib/trades/episodes.test.ts`
- Create: `app/lib/trades/episodes.ts`

**Interfaces:**
- Produces: `TradeExecution`, `Instrument`, `TradeEpisode`, `buildTradeEpisodes(executions)`.
- Consumes: no production modules.

- [ ] **Step 1: Add test tooling and runtime dependencies**

Add exact-version dependencies for `lightweight-charts`, `xlsx`, `decimal.js`, and `lucide-react`; add dev dependencies for `vitest`, `jsdom`, and Testing Library. Add `test:unit`, `test:watch`, and `typecheck` scripts.

- [ ] **Step 2: Write the failing episode test**

```ts
it("groups partial buys and sells until the position returns to zero", () => {
  const episodes = buildTradeEpisodes([
    execution("buy", "2025-01-02T14:30:00Z", 100, 10),
    execution("buy", "2025-01-03T14:30:00Z", 50, 11),
    execution("sell", "2025-01-08T14:30:00Z", 75, 12),
    execution("sell", "2025-01-09T14:30:00Z", 75, 13),
  ]);
  expect(episodes).toHaveLength(1);
  expect(episodes[0]).toMatchObject({ status: "closed", openingQuantity: "150" });
});
```

- [ ] **Step 3: Run the test to verify RED**

Run: `npm run test:unit -- app/lib/trades/episodes.test.ts`

Expected: FAIL because `buildTradeEpisodes` does not exist.

- [ ] **Step 4: Implement minimal episode construction**

Build episodes per `accountId + instrumentId`, sort by execution time, maintain signed quantity with Decimal.js, close an episode on zero, and create an open episode for a non-zero ending position.

- [ ] **Step 5: Run the test to verify GREEN**

Run: `npm run test:unit -- app/lib/trades/episodes.test.ts`

Expected: PASS.

### Task 2: Timeframe aggregation and replay boundary

**Files:**
- Create: `app/lib/market/types.ts`
- Create: `app/lib/market/aggregate.test.ts`
- Create: `app/lib/market/aggregate.ts`
- Create: `app/lib/replay/replay-engine.test.ts`
- Create: `app/lib/replay/replay-engine.ts`

**Interfaces:**
- Consumes: `TradeExecution`, `TradeEpisode`.
- Produces: `Candle`, `Timeframe`, `aggregateCandles(candles, timeframe)`, `createReplaySnapshot(input)`.

- [ ] **Step 1: Write the failing aggregation test**

```ts
it("aggregates intraday candles without crossing a UTC trading day", () => {
  const hourly = aggregateCandles(fifteenMinuteFixture, "1h");
  expect(hourly[0]).toMatchObject({ open: 10, high: 12, low: 9, close: 11.5 });
});
```

- [ ] **Step 2: Run the aggregation test to verify RED**

Run: `npm run test:unit -- app/lib/market/aggregate.test.ts`

Expected: FAIL because `aggregateCandles` does not exist.

- [ ] **Step 3: Implement deterministic 1h, 4h, 1D, and 1W aggregation**

Group by explicit time bucket, preserve first open, max high, min low, last close, and summed volume. Reject attempts to synthesize a lower timeframe.

- [ ] **Step 4: Write the failing future-boundary test**

```ts
it("returns only candles and executions at or before the replay cursor", () => {
  const snapshot = createReplaySnapshot({ candles, executions, cursor: candles[2].time });
  expect(snapshot.candles).toEqual(candles.slice(0, 3));
  expect(snapshot.executions.every((item) => item.executedAt <= snapshot.cursor)).toBe(true);
});
```

- [ ] **Step 5: Run the replay test to verify RED**

Run: `npm run test:unit -- app/lib/replay/replay-engine.test.ts`

Expected: FAIL because `createReplaySnapshot` does not exist.

- [ ] **Step 6: Implement replay snapshots and decimal P&L**

Return revealed candles/executions only, current signed quantity, weighted average cost, realized P&L, unrealized P&L, total fees, and current return percentage. Never include a future count, next timestamp, or final outcome.

- [ ] **Step 7: Run both test files to verify GREEN**

Run: `npm run test:unit -- app/lib/market/aggregate.test.ts app/lib/replay/replay-engine.test.ts`

Expected: PASS.

### Task 3: Futu XLSX import

**Files:**
- Create: `app/lib/import/futu.test.ts`
- Create: `app/lib/import/futu.ts`
- Create: `app/lib/import/import-result.ts`

**Interfaces:**
- Consumes: browser `ArrayBuffer`.
- Produces: `parseFutuWorkbook(buffer): ImportResult<TradeExecution>`.

- [ ] **Step 1: Write the failing parser test with an in-memory workbook**

Build a workbook containing the exact `证券-交易流水` headers and three rows: a buy, a sell, and a fund redemption. Assert that only the two securities executions are returned and that source rows and warnings are preserved.

- [ ] **Step 2: Run the parser test to verify RED**

Run: `npm run test:unit -- app/lib/import/futu.test.ts`

Expected: FAIL because `parseFutuWorkbook` does not exist.

- [ ] **Step 3: Implement deterministic header mapping**

Detect the sheet and required columns, map `买入开仓`/`卖出平仓`, preserve account, market, currency, quantity, price, fees, source sheet and row, skip non-securities rows with an explicit diagnostic, and mask account display values.

- [ ] **Step 4: Add malformed workbook and duplicate-row tests**

Assert a missing required sheet returns a blocking diagnostic; exact duplicate executions return one execution plus a warning.

- [ ] **Step 5: Run the parser suite to verify GREEN**

Run: `npm run test:unit -- app/lib/import/futu.test.ts`

Expected: PASS.

### Task 4: Drawing model and persistence

**Files:**
- Create: `app/lib/chart/drawings.test.ts`
- Create: `app/lib/chart/drawings.ts`
- Create: `app/lib/storage/review-storage.test.ts`
- Create: `app/lib/storage/review-storage.ts`

**Interfaces:**
- Produces: `Drawing`, `DrawingTool`, `clampDrawingToCursor`, `serializeReviewState`, `loadReviewState`.
- Consumes: replay cursor timestamp.

- [ ] **Step 1: Write the failing drawing clamp test**

```ts
it("clamps every anchor to the revealed cursor", () => {
  const clamped = clampDrawingToCursor(futureTrendLine, cursor);
  expect(clamped.anchors.every((anchor) => anchor.time <= cursor)).toBe(true);
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npm run test:unit -- app/lib/chart/drawings.test.ts`

Expected: FAIL because the drawing model does not exist.

- [ ] **Step 3: Implement core drawing types**

Support `trend-line`, `horizontal-line`, `price-label`, `text`, and `risk-reward`; store stable IDs, anchors, style, locked/hidden state, timeframe visibility, and knowledge stage. Clamp future anchors and reject invalid risk/reward geometry.

- [ ] **Step 4: Write storage round-trip test**

Persist a review state under a versioned localStorage key and assert drawings, replay cursor, active timeframe, and thesis draft round-trip without type loss.

- [ ] **Step 5: Implement and verify local persistence**

Run: `npm run test:unit -- app/lib/chart/drawings.test.ts app/lib/storage/review-storage.test.ts`

Expected: PASS.

### Task 5: TradingView-style review workspace

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `app/components/trade-review-workspace.tsx`
- Create: `app/components/chart/replay-chart.tsx`
- Create: `app/components/chart/drawing-canvas.tsx`
- Create: `app/components/chart/chart-toolbar.tsx`
- Create: `app/components/chart/drawing-toolbar.tsx`
- Create: `app/components/replay/replay-controls.tsx`
- Create: `app/components/review/episode-sidebar.tsx`
- Create: `app/components/review/thesis-panel.tsx`
- Create: `app/data/demo-market.ts`
- Create: `app/data/demo-trades.ts`
- Create: `app/components/trade-review-workspace.test.tsx`

**Interfaces:**
- Consumes: all Tasks 1-4 interfaces.
- Produces: the complete browser-facing MVP.

- [ ] **Step 1: Write the failing workspace interaction test**

Render the workspace, assert future candle count is absent, click “下一根”, and assert the revealed date and unrealized P&L update. Switch from `1D` to `1W` and assert the replay cursor is unchanged.

- [ ] **Step 2: Run to verify RED**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx`

Expected: FAIL because the workspace does not exist.

- [ ] **Step 3: Build the workspace shell and responsive layout**

Create the top symbol/timeframe bar, left drawing rail, center chart, right review sidebar, bottom replay controls, and compact mobile fallback. Use product-specific Chinese copy and no starter skeleton.

- [ ] **Step 4: Integrate Lightweight Charts**

Render candlesticks, volume, current price line, revealed buy/sell markers, average cost line, responsive resize, crosshair values, and TradingView attribution required by the Apache-2.0 library notice.

- [ ] **Step 5: Implement drawing interaction**

Use one transparent Canvas overlay for pointer hit-testing and rendering. Implement selection, create, drag, style color, lock, hide, delete, undo, and redo for the five core tools. Render risk/reward zones and R multiple.

- [ ] **Step 6: Connect replay controls and thesis state**

Implement previous/next candle, next revealed execution, play/pause, speed choice, P&L cards, episode selection, thesis draft, and automatic local save.

- [ ] **Step 7: Connect private Futu import**

Provide a local file chooser for `.xlsx`, parse in the browser, show diagnostics, build episodes, and never upload the file. Keep the demo episode available as a safe first-run experience.

- [ ] **Step 8: Run component and unit suites**

Run: `npm run test:unit`

Expected: all tests PASS.

### Task 6: Validation, documentation, and deployment

**Files:**
- Modify: `README.md`
- Modify: `tests/rendered-html.test.mjs`
- Remove: `app/_sites-preview/**`
- Modify: `.openai/hosting.json`

**Interfaces:**
- Consumes: completed MVP.
- Produces: validated build and private production deployment.

- [ ] **Step 1: Replace starter metadata and documentation**

Document local setup, privacy model, supported Futu fields, demo limitations, and the fact that market data is deterministic demo data until a licensed provider is configured.

- [ ] **Step 2: Update rendered HTML smoke assertions**

Assert the built page includes `交易复盘`, `逐根回放`, and the chart workspace landmark.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm test
```

Expected: every command exits 0.

- [ ] **Step 4: Inspect the live local workspace**

Verify the demo loads, period switching preserves the cursor, “下一根” changes P&L, a trend line can be drawn, and no browser console errors are present.

- [ ] **Step 5: Publish the exact validated source**

Create the Sites project once, save the validated version from the exact pushed source state, deploy privately, poll to success, and open the production URL in Codex.

