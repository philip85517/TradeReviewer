# Unified Replay, Chart Tools, and Position Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give imported trade episodes the same cursor-safe multi-period replay, working chart controls, editable drawing tools, position-path statistics, and episode notes as the demo workspace.

**Architecture:** Preserve the current daily market-data path while adding a native `15m` provider/cache path and deriving `1H` and `4H` locally. Extract pure interval availability, position-ledger, path-metric, drawing-command, and imported-replay modules, then compose them through one shared review shell for demo and imported episodes.

**Tech Stack:** React 19, TypeScript 5.9, vinext/Vite, TradingView Lightweight Charts 5.2, Decimal.js 10.6, IndexedDB, Vitest, Testing Library, Lucide React.

## Global Constraints

- Node.js remains `>=22.13.0`; do not add a new runtime dependency.
- Imported brokerage files and normalized executions stay on the user’s device.
- Public providers remain no-key, best-effort sources; never synthesize intraday candles from daily data.
- `15m` is native provider data; `1H` and `4H` derive only from native `15m`; `1W` derives only from native `1D`.
- Future candles, executions, P&L, path statistics, drawings, layer rows, and completed outcomes must not cross the knowledge cursor.
- Monetary, quantity, and position-path calculations use Decimal.js.
- Existing version-2 IndexedDB daily candles, coverage, provider symbols, reviews, and local imported executions remain readable after migration.
- Drawings, review state, chart preferences, and notes remain device-local and episode-scoped.
- The top-level “模式洞察” navigation is not part of this plan.
- No test contacts a live market-data provider.

---

## File Responsibility Map

- `app/lib/market/contracts.ts`: daily compatibility types plus normalized native-interval contracts.
- `app/lib/market/availability.ts`: pure mapping from cached native data and coverage to enabled display periods and disabled reasons.
- `app/lib/market/aggregate.ts`: coarser-only OHLCV aggregation.
- `app/lib/market/providers/*.ts`: parse and fetch native daily or `15m` candles.
- `app/api/market-data/intraday/route.ts`: guarded same-origin `15m` endpoint.
- `app/lib/storage/indexeddb-schema.ts`: version-3 object-store migration.
- `app/lib/storage/market-data-repository.ts`: daily compatibility and interval-aware repository interfaces.
- `app/lib/storage/indexeddb-market-data-repository.ts`: IndexedDB implementation and lazy daily compatibility reads.
- `app/lib/market/intraday-sync-service.ts`: bounded intraday gap requests, cache commit, and partial-coverage reporting.
- `app/lib/replay/position-ledger.ts`: reusable decimal position reconstruction at one mark price.
- `app/lib/replay/position-path-metrics.ts`: cursor-safe MFE, MAE, drawdown, giveback, and plan comparison.
- `app/lib/replay/imported-replay.ts`: local episode cursor/timeline operations.
- `app/lib/chart/drawings.ts`: drawing contracts, validation, replay safety, and risk/reward calculations.
- `app/lib/chart/drawing-commands.ts`: immutable drawing edits and undo/redo state.
- `app/lib/chart/drawing-geometry.ts`: projection-independent hit testing and anchor manipulation.
- `app/components/chart/drawing-canvas.tsx`: rendering, creation, selection, handles, dragging, and inline text editing.
- `app/components/chart/drawing-layers-panel.tsx`: layer rename, visibility, lock, order, and delete controls.
- `app/components/chart/chart-toolbar.tsx`: toolbar orchestration and disabled states.
- `app/components/chart/instrument-search-popover.tsx`: local-library symbol/name search.
- `app/components/chart/market-data-popover.tsx`: source, coverage, limitations, and refresh.
- `app/components/chart/chart-settings-popover.tsx`: persisted chart display preferences.
- `app/components/chart/use-fullscreen.ts`: browser Fullscreen API state and actions.
- `app/components/review/position-stats-panel.tsx`: right-panel metric presentation.
- `app/components/review/episode-notes-panel.tsx`: compact episode review form with autosave.
- `app/components/review/review-side-panel.tsx`: tabs and narrow-screen drawer content.
- `app/components/review/review-chart-workspace.tsx`: shared chart/replay/drawing shell.
- `app/components/trade-review-workspace.tsx`: data loading, selected instrument/episode, demo/imported adapters, and persistence.

---

### Task 1: Native interval contracts, coarser-only aggregation, and availability

**Files:**
- Modify: `app/lib/market/contracts.ts`
- Modify: `app/lib/market/types.ts`
- Modify: `app/lib/market/aggregate.ts`
- Modify: `app/lib/market/aggregate.test.ts`
- Create: `app/lib/market/availability.ts`
- Create: `app/lib/market/availability.test.ts`

**Interfaces:**
- Produces: `NativeMarketInterval`, `MarketCandleRecord`, `ProviderMarketCandle`, `IntervalCoverageSegment`, `marketRecordToChartCandle(record)`, `aggregateCandles(candles, timeframe, options?)`, and `resolveTimeframeAvailability(input)`.
- Consumes: existing `Timeframe`, `Candle`, `CoverageStatus`, provider IDs, and `marketTradingDate`.

- [ ] **Step 1: Write failing interval conversion and aggregation tests**

Add a `MarketCandleRecord` fixture with `interval: "15m"` and absolute
timestamps. Assert that conversion preserves the timestamp, and that four
15-minute candles become one hourly candle while a daily candle cannot be
used to produce `15m`.

```ts
it("aggregates native 15m candles into 1h without crossing a market date", () => {
  const hourly = aggregateCandles(fifteenMinuteCandles, "1h", {
    sourceInterval: "15m",
    market: "US",
  });

  expect(hourly).toEqual([
    {
      time: "2025-01-02T14:30:00.000Z",
      open: 10,
      high: 12,
      low: 9,
      close: 11.5,
      volume: 460,
    },
  ]);
});

it("rejects an attempt to derive 15m candles from daily candles", () => {
  expect(() =>
    aggregateCandles(dailyCandles, "15m", {
      sourceInterval: "1D",
      market: "US",
    }),
  ).toThrow("不能从 1D 生成 15m");
});
```

- [ ] **Step 2: Run the aggregation tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/market/aggregate.test.ts
```

Expected: FAIL because `sourceInterval` and finer-interval rejection do not
exist.

- [ ] **Step 3: Add the normalized interval contracts and aggregation guard**

Add these exact public types and conversion function:

```ts
export type NativeMarketInterval = "15m" | "1D";

export type MarketCandleRecord = {
  instrumentId: string;
  interval: NativeMarketInterval;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  currency: string;
  provider: MarketDataProviderId;
  providerSymbol: string;
  adjustmentMode: AdjustmentMode;
  fetchedAt: string;
};

export type ProviderMarketCandle = Pick<
  MarketCandleRecord,
  "timestamp" | "open" | "high" | "low" | "close" | "volume"
>;

export type IntervalCoverageSegment = {
  interval: NativeMarketInterval;
  requestedStart: string;
  requestedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: CoverageStatus;
  provider?: MarketDataProviderId;
  fetchedAt?: string;
  reason?: string;
};

export function marketRecordToChartCandle(
  record: MarketCandleRecord,
): Candle {
  return {
    time: record.timestamp,
    open: Number(record.open),
    high: Number(record.high),
    low: Number(record.low),
    close: Number(record.close),
    volume: Number(record.volume),
  };
}
```

Extend `aggregateCandles` with:

```ts
type AggregationOptions = {
  sourceInterval?: NativeMarketInterval;
  market?: string;
};
```

Use source/display ranks `{ "15m": 0, "1h": 1, "4h": 2, "1D": 3, "1W": 4 }`
to reject finer output. For intraday output, split candles by
`marketTradingDate(candle.time, market)` and aggregate consecutive groups of
4 for `1h` or 16 for `4h`; preserve the first candle timestamp as the bucket
timestamp. Keep the current deterministic UTC behavior when options are
omitted so demo tests remain compatible.

- [ ] **Step 4: Run the aggregation tests to verify GREEN**

Run:

```bash
npm run test:unit -- app/lib/market/aggregate.test.ts
```

Expected: PASS, including existing demo aggregation coverage.

- [ ] **Step 5: Write failing availability tests**

```ts
it("enables only periods backed by the required native data", () => {
  const result = resolveTimeframeAvailability({
    intradayCandles: [intradayRecord],
    dailyCandles: [dailyRecord],
    intradayCoverage: [],
  });

  expect(result["15m"].enabled).toBe(true);
  expect(result["1h"].enabled).toBe(true);
  expect(result["4h"].enabled).toBe(true);
  expect(result["1D"].enabled).toBe(true);
  expect(result["1W"].enabled).toBe(true);
});

it("explains why intraday periods are unavailable", () => {
  const result = resolveTimeframeAvailability({
    intradayCandles: [],
    dailyCandles: [dailyRecord],
    intradayCoverage: [
      {
        interval: "15m",
        requestedStart: "2025-01-01T00:00:00.000Z",
        requestedEnd: "2025-01-10T00:00:00.000Z",
        status: "partial",
        reason: "provider-history-limit",
      },
    ],
  });

  expect(result["15m"]).toEqual({
    enabled: false,
    reason: "公开行情源未覆盖该交易日期的 15 分钟行情",
  });
});
```

- [ ] **Step 6: Run availability tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/market/availability.test.ts
```

Expected: FAIL because `resolveTimeframeAvailability` does not exist.

- [ ] **Step 7: Implement the pure availability mapping**

Export:

```ts
export type TimeframeAvailability = Record<
  Timeframe,
  { enabled: boolean; reason?: string }
>;

export function resolveTimeframeAvailability(input: {
  intradayCandles: MarketCandleRecord[];
  dailyCandles: DailyCandleRecord[];
  intradayCoverage: IntervalCoverageSegment[];
}): TimeframeAvailability;
```

Enable `15m`, `1h`, and `4h` together only when at least one valid native
`15m` record exists. Enable `1D` and `1W` when at least one daily record
exists. Convert known reasons into stable Chinese explanations and use
`"尚未获取该周期行情"` when no request has been made.

- [ ] **Step 8: Verify Task 1 and commit**

Run:

```bash
npm run test:unit -- app/lib/market/aggregate.test.ts app/lib/market/availability.test.ts
git add app/lib/market/contracts.ts app/lib/market/types.ts app/lib/market/aggregate.ts app/lib/market/aggregate.test.ts app/lib/market/availability.ts app/lib/market/availability.test.ts
git commit -m "feat: add interval-aware market contracts"
```

Expected: tests PASS and the commit contains only Task 1 files.

---

### Task 2: Public-provider `15m` adapters and guarded API route

**Files:**
- Modify: `app/lib/market/providers/errors.ts`
- Modify: `app/lib/market/providers/router.ts`
- Modify: `app/lib/market/providers/tencent.ts`
- Modify: `app/lib/market/providers/eastmoney.ts`
- Modify: `app/lib/market/providers/yahoo.ts`
- Modify: `app/lib/market/providers/providers.test.ts`
- Modify: `app/lib/market/request-policy.ts`
- Create: `app/api/market-data/intraday/route.ts`
- Create: `app/api/market-data/intraday/route.test.ts`

**Interfaces:**
- Consumes: `ProviderMarketCandle`, `SupportedMarket`, provider symbols, and existing provider error semantics.
- Produces: `IntradayCandleRequest`, `parseIntradayCandleRequest(url)`, provider `fetchIntraday(request, fetcher?)`, router `fetchIntraday(request)`, and `GET /api/market-data/intraday`.

- [ ] **Step 1: Write failing parser tests for Tencent, Eastmoney, and Yahoo**

Add fixed provider responses containing timestamps and assert the normalized
shape:

```ts
expect(parseTencentIntraday(tencentValue, "hk01810")).toEqual([
  {
    timestamp: "2025-01-02T01:30:00.000Z",
    open: "34.1",
    high: "35",
    low: "33.8",
    close: "34.5",
    volume: "1200",
  },
]);

expect(parseEastmoneyIntraday(eastmoneyValue, "Asia/Shanghai")).toEqual([
  expect.objectContaining({
    timestamp: "2025-01-02T01:30:00.000Z",
    close: "102",
  }),
]);

expect(parseYahooIntraday(yahooValue)).toEqual([
  expect.objectContaining({
    timestamp: "2025-01-02T14:30:00.000Z",
    close: "11",
  }),
]);
```

Also assert that a `null` OHLC member and a changed envelope throw an
invalid-response error rather than yielding a partial fake candle.

- [ ] **Step 2: Run provider tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/market/providers/providers.test.ts
```

Expected: FAIL because intraday parser exports do not exist.

- [ ] **Step 3: Implement provider-specific intraday parsing and fetching**

Add:

```ts
export type IntradayCandleRequest = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  interval: "15m";
  startTime: string;
  endTime: string;
};
```

Each provider class implements:

```ts
fetchIntraday(
  request: IntradayCandleRequest,
  fetcher?: typeof fetch,
): Promise<{
  provider: MarketDataProviderId;
  providerSymbol: string;
  fetchedAt: string;
  interval: "15m";
  candles: ProviderMarketCandle[];
  warnings: string[];
}>;
```

Use Tencent’s 15-minute K-line parameter, Eastmoney `klt=15`, and Yahoo
`interval=15m`. Convert provider-local timestamps with explicit market time
zones (`America/New_York`, `Asia/Hong_Kong`, or `Asia/Shanghai`) before
returning ISO timestamps. Filter the normalized result to the requested
inclusive range. Add `"unsupported-interval"` and `"provider-history-limit"`
to `MarketDataErrorCode`.

- [ ] **Step 4: Add router fallback tests and implement `fetchIntraday`**

Test that an unavailable Tencent response falls back to Eastmoney for
A-shares, that US/HK can fall back to Yahoo, and that history-limit semantics
survive when all eligible sources lack the requested history.

```ts
export type ProviderRouter = {
  fetchDaily(request: DailyCandleRequest): Promise<ProviderResult>;
  fetchIntraday(
    request: IntradayCandleRequest,
  ): Promise<IntradayProviderResult>;
};
```

Reuse the current ordered provider loop and preserve the most actionable
error priority:

```ts
[
  "source-rate-limited",
  "source-forbidden",
  "provider-history-limit",
  "invalid-response",
  "source-timeout",
  "source-unavailable",
  "no-data",
]
```

- [ ] **Step 5: Write failing intraday request-policy and route tests**

```ts
it("accepts only a bounded 15m request", () => {
  expect(
    parseIntradayCandleRequest(
      new URL(
        "http://local/api?market=HK&symbol=1810&interval=15m&start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-10T00%3A00%3A00.000Z",
      ),
    ),
  ).toMatchObject({ market: "HK", symbol: "1810", interval: "15m" });
});

it("rejects an intraday request longer than 60 natural days", () => {
  expect(() => parseIntradayCandleRequest(overlongUrl)).toThrow(
    "15 分钟行情单次请求不能超过 60 个自然日",
  );
});
```

Route tests assert normalized output, same-origin transient caching,
per-client rate limiting, abort-on-timeout, and the public error code.

- [ ] **Step 6: Run route tests to verify RED**

Run:

```bash
npm run test:unit -- app/api/market-data/intraday/route.test.ts
```

Expected: FAIL because the route and parser do not exist.

- [ ] **Step 7: Implement request validation and the API route**

Mirror the daily route’s client rate limit and 12-second timeout. Use this
success body:

```ts
{
  provider,
  providerSymbol,
  fetchedAt,
  interval: "15m",
  adjustmentMode: "raw",
  candles,
  warnings,
}
```

Use `Cache-Control: public, max-age=1800, stale-while-revalidate=3600` for
successful intraday responses. Return `400` for invalid input, `429` for
source or application rate limiting, `403` for source refusal, and `502` for
other provider failures.

- [ ] **Step 8: Verify Task 2 and commit**

Run:

```bash
npm run test:unit -- app/lib/market/providers/providers.test.ts app/api/market-data/intraday/route.test.ts app/api/market-data/daily/route.test.ts
git add app/lib/market/providers app/lib/market/request-policy.ts app/api/market-data/intraday
git commit -m "feat: fetch real intraday market data"
```

Expected: all listed tests PASS; existing daily route behavior remains green.

---

### Task 3: Version-3 interval cache with daily compatibility

**Files:**
- Modify: `app/lib/storage/indexeddb-schema.ts`
- Modify: `app/lib/storage/market-data-repository.ts`
- Modify: `app/lib/storage/indexeddb-market-data-repository.ts`
- Modify: `app/lib/storage/indexeddb-market-data-repository.test.ts`
- Modify: `app/lib/storage/indexeddb-episode-review-repository.test.ts`

**Interfaces:**
- Consumes: `MarketCandleRecord`, `NativeMarketInterval`, and `IntervalCoverageSegment`.
- Produces: `getCandles`, `getIntervalCoverage`, and `commitIntervalSyncResult` while preserving `getDailyCandles`, `getCoverage`, and `commitSyncResult`.

- [ ] **Step 1: Write a failing version-2 upgrade preservation test**

Create a version-2 database directly with the current four stores, put one
daily candle, one coverage record, one provider symbol, and one review, close
it, then open it through the repository.

```ts
expect(
  await repo.getCandles(
    "HK:1810",
    "1D",
    "2025-01-01T00:00:00.000Z",
    "2025-01-31T23:59:59.999Z",
  ),
).toEqual([
  expect.objectContaining({
    instrumentId: "HK:1810",
    interval: "1D",
    timestamp: "2025-01-02T00:00:00.000Z",
    close: "34.5",
  }),
]);
expect(await reviews.get("episode-1")).toEqual(reviewRecord);
```

- [ ] **Step 2: Run repository tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/storage/indexeddb-market-data-repository.test.ts app/lib/storage/indexeddb-episode-review-repository.test.ts
```

Expected: FAIL because `getCandles` and version 3 stores do not exist.

- [ ] **Step 3: Add version-3 object stores and repository contracts**

Set:

```ts
export const DATABASE_VERSION = 3;
export const MARKET_CANDLES = "marketCandles";
export const INTERVAL_COVERAGE = "intervalCoverage";
```

Create `MARKET_CANDLES` with key path:

```ts
["instrumentId", "interval", "timestamp", "adjustmentMode"]
```

Create `INTERVAL_COVERAGE` with key path:

```ts
["instrumentId", "interval"]
```

Do not delete or rename `DAILY_CANDLES`, `COVERAGE`, `PROVIDER_SYMBOLS`, or
`REVIEWS`.

Extend the repository:

```ts
getCandles(
  instrumentId: string,
  interval: NativeMarketInterval,
  startTime: string,
  endTime: string,
): Promise<MarketCandleRecord[]>;

getIntervalCoverage(
  instrumentId: string,
  interval: NativeMarketInterval,
): Promise<IntervalCoverageSegment[]>;

commitIntervalSyncResult(result: {
  instrumentId: string;
  interval: NativeMarketInterval;
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  providerSymbol: {
    provider: MarketDataProviderId;
    symbol: string;
  };
}): Promise<void>;
```

For `interval === "1D"`, `getCandles` merges generic records with legacy
daily records converted to midnight-UTC `MarketCandleRecord` values, then
deduplicates by timestamp with generic records taking precedence.

- [ ] **Step 4: Add atomic interval write and idempotency tests**

Commit two identical `15m` results and assert one stored candle, the exact
coverage array, and provider symbol. Abort a transaction deliberately and
assert none of its three stores changed.

- [ ] **Step 5: Implement interval reads and atomic writes**

Use bounded compound-key reads:

```ts
IDBKeyRange.bound(
  [instrumentId, interval, startTime, "raw"],
  [instrumentId, interval, endTime, "raw"],
)
```

Write candles, interval coverage, and provider symbol in one read-write
transaction. Close the database in `finally`, matching the existing methods.

- [ ] **Step 6: Verify Task 3 and commit**

Run:

```bash
npm run test:unit -- app/lib/storage/indexeddb-market-data-repository.test.ts app/lib/storage/indexeddb-episode-review-repository.test.ts
git add app/lib/storage/indexeddb-schema.ts app/lib/storage/market-data-repository.ts app/lib/storage/indexeddb-market-data-repository.ts app/lib/storage/indexeddb-market-data-repository.test.ts app/lib/storage/indexeddb-episode-review-repository.test.ts
git commit -m "feat: persist interval market data"
```

Expected: upgrade, atomicity, and legacy compatibility tests PASS.

---

### Task 4: Bounded intraday synchronization and honest partial coverage

**Files:**
- Create: `app/lib/market/intraday-sync-service.ts`
- Create: `app/lib/market/intraday-sync-service.test.ts`
- Modify: `app/lib/market/sync-status.ts`
- Modify: `app/lib/market/sync-status.test.ts`
- Modify: `app/lib/storage/market-data-jobs.ts`
- Modify: `app/lib/storage/market-data-jobs.test.ts`

**Interfaces:**
- Consumes: interval-aware repository, intraday API response, `DateRange`, and abort signals.
- Produces: `splitIntradayRequestRange(range, 60)`, `syncIntradayMarketData(options)`, and per-interval job/status details.

- [ ] **Step 1: Write failing range-splitting and cache-hit tests**

```ts
it("splits inclusive intraday requests into at most 60-day chunks", () => {
  expect(
    splitIntradayRequestRange({
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-05-01T00:00:00.000Z",
    }),
  ).toEqual([
    {
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-03-01T23:59:59.999Z",
    },
    {
      startTime: "2025-03-02T00:00:00.000Z",
      endTime: "2025-04-30T23:59:59.999Z",
    },
    {
      startTime: "2025-05-01T00:00:00.000Z",
      endTime: "2025-05-01T00:00:00.000Z",
    },
  ]);
});

it("does not request the network for complete cached 15m coverage", async () => {
  const result = await syncIntradayMarketData(completeCacheOptions);
  expect(result.source).toBe("cache");
  expect(fetcher).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run intraday sync tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/market/intraday-sync-service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement bounded requests and cache commits**

Export:

```ts
export async function syncIntradayMarketData(options: {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  currency: string;
  required: { startTime: string; endTime: string };
  repository: MarketDataRepository;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{
  source: "cache" | "network";
  status: CoverageStatus;
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  requestedRanges: Array<{ startTime: string; endTime: string }>;
}>;
```

Before and after every fetch and before every commit, throw an `AbortError`
when the signal is cancelled. Convert each provider candle to a
`MarketCandleRecord` with `interval: "15m"`. A non-empty response records its
actual first/last timestamp. An empty or history-limited response records a
partial segment with reason `provider-history-limit`; it does not fabricate
missing timestamps or erase cached candles.

- [ ] **Step 4: Add failing stale-cache and abort tests**

Assert that:

- a provider failure returns existing candles with status
  `source-unavailable` from the caller-facing orchestration;
- a later abort prevents commits;
- a history-limit response yields a stable disabled-period reason;
- the second call after a successful sync performs no request.

- [ ] **Step 5: Extend market-data jobs with interval details**

Keep the existing stock-level status for sidebar compatibility and add:

```ts
type MarketDataIntervalJob = {
  interval: NativeMarketInterval;
  status: MarketDataSyncStatus;
  message?: string;
  coverageStart?: string;
  coverageEnd?: string;
};
```

Persist `intervals: MarketDataIntervalJob[]` on a version-2 job record and
migrate version-1 records to a single `1D` detail when loaded.

- [ ] **Step 6: Verify Task 4 and commit**

Run:

```bash
npm run test:unit -- app/lib/market/intraday-sync-service.test.ts app/lib/market/sync-status.test.ts app/lib/storage/market-data-jobs.test.ts
git add app/lib/market/intraday-sync-service.ts app/lib/market/intraday-sync-service.test.ts app/lib/market/sync-status.ts app/lib/market/sync-status.test.ts app/lib/storage/market-data-jobs.ts app/lib/storage/market-data-jobs.test.ts
git commit -m "feat: sync and report intraday coverage"
```

Expected: range, cache, abort, migration, and limitation tests PASS.

---

### Task 5: Reusable position ledger, cursor-safe path metrics, and local replay

**Files:**
- Create: `app/lib/replay/position-ledger.ts`
- Create: `app/lib/replay/position-ledger.test.ts`
- Create: `app/lib/replay/position-path-metrics.ts`
- Create: `app/lib/replay/position-path-metrics.test.ts`
- Create: `app/lib/replay/imported-replay.ts`
- Create: `app/lib/replay/imported-replay.test.ts`
- Modify: `app/lib/replay/replay-engine.ts`
- Modify: `app/lib/replay/replay-engine.test.ts`

**Interfaces:**
- Consumes: `Candle`, `TradeExecution`, `TradeEpisode`, cursor, and optional planned risk amount.
- Produces: `replayPositionAtPrice`, `calculatePositionPathMetrics`, `createImportedReplay`, and existing `createReplaySnapshot` backed by the shared ledger.

- [ ] **Step 1: Write failing position-ledger parity tests**

Move the current long/short/position-reversal expectations to a public pure
ledger API:

```ts
expect(
  replayPositionAtPrice({
    executions: [
      fill("buy", "2025-01-02T14:30:00Z", "100", "10", "2"),
      fill("sell", "2025-01-03T14:30:00Z", "40", "12", "1"),
    ],
    markPrice: "11",
  }),
).toEqual({
  quantity: "60",
  averageCost: "10",
  realizedPnl: "80",
  unrealizedPnl: "60",
  netPnl: "137",
  fees: "3",
  grossCapitalDeployed: "1000",
  returnPercent: "13.7",
});
```

- [ ] **Step 2: Run ledger tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/replay/position-ledger.test.ts
```

Expected: FAIL because `replayPositionAtPrice` does not exist.

- [ ] **Step 3: Extract decimal ledger logic and reuse it in replay snapshots**

Export:

```ts
export type PositionLedgerSnapshot = {
  quantity: string;
  averageCost: string;
  realizedPnl: string;
  unrealizedPnl: string;
  netPnl: string;
  fees: string;
  grossCapitalDeployed: string;
  returnPercent: string;
};

export function replayPositionAtPrice(input: {
  executions: TradeExecution[];
  markPrice: string;
}): PositionLedgerSnapshot;
```

Move the current weighted-average, cover, close, and reversal logic without
changing its ordering. Define net P&L as
`realized + unrealized - fees`. Track cumulative opening exposure as
`grossCapitalDeployed`. Make `createReplaySnapshot` call this function and
retain its existing public fields plus `netPnl` and
`grossCapitalDeployed`.

- [ ] **Step 4: Write failing MFE, MAE, drawdown, and giveback tests**

Use a closed long fixture whose net-P&L extreme path is known:

```ts
const metrics = calculatePositionPathMetrics({
  candles: [
    candle("2025-01-02T14:30:00Z", 10, 11, 9, 10),
    candle("2025-01-02T14:45:00Z", 10, 15, 8, 14),
    candle("2025-01-02T15:00:00Z", 14, 14, 11, 12),
  ],
  executions: [fill("buy", "2025-01-02T14:30:00Z", "10", "10", "0")],
  cursor: "2025-01-02T15:00:00Z",
  episodeStartedAt: "2025-01-02T14:30:00Z",
  plannedRiskAmount: "20",
});

expect(metrics).toMatchObject({
  mfe: { amount: "50", percent: "50" },
  mae: { amount: "-20", percent: "-20" },
  maximumDrawdown: { amount: "20", percent: "20" },
  profitGiveback: { amount: "30", percent: "30" },
  rMultiple: "1",
});
```

Add a short fixture and a scaled-entry/partial-exit fixture. Assert the JSON
result never contains a candle or execution timestamp after the cursor.

- [ ] **Step 5: Run path-metric tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/replay/position-path-metrics.test.ts
```

Expected: FAIL because the metrics module does not exist.

- [ ] **Step 6: Implement cursor-safe path metrics**

Export:

```ts
export type PathAmount = {
  amount: string;
  percent: string | null;
};

export type PositionPathMetrics = {
  current: PositionLedgerSnapshot;
  holdingMilliseconds: number | null;
  mfe: PathAmount | null;
  mae: PathAmount | null;
  maximumDrawdown: PathAmount | null;
  profitGiveback: PathAmount | null;
  rMultiple: string | null;
  unavailableReason?: string;
};

export function calculatePositionPathMetrics(input: {
  candles: Candle[];
  executions: TradeExecution[];
  cursor: string;
  episodeStartedAt: string;
  episodeEndedAt?: string;
  plannedRiskAmount?: string;
}): PositionPathMetrics;
```

Filter and sort both inputs before any calculation. At each candle, replay
only executions at or before the candle. For a positive position use `high`
for MFE and `low` for MAE; reverse them for a negative position. Use closes
for the net-P&L curve and track the highest previous close-marked net P&L for
drawdown. Divide path amounts by the maximum non-zero gross capital deployed
through the cursor. Return `null` plus an explanation before entry or when
there is no usable candle.

- [ ] **Step 7: Write failing imported replay timeline tests**

```ts
const replay = createImportedReplay({
  candles,
  executions,
  storedCursor: candles[1].time,
});

expect(replay.currentCursor).toBe(candles[1].time);
expect(replay.next()).toBe(candles[2].time);
expect(replay.previous()).toBe(candles[0].time);
expect(replay.nextExecution()).toBe(executions[1].executedAt);
expect(replay.cursorForTimeframe(hourlyCandles)).toBe(
  hourlyCandles[0].time,
);
```

- [ ] **Step 8: Implement the pure local replay API**

Return immutable cursor operations instead of a stateful class:

```ts
export type ImportedReplay = {
  currentCursor: string;
  canGoBack: boolean;
  canGoForward: boolean;
  previous(): string;
  next(): string;
  nextExecution(): string;
  cursorForTimeframe(nextCandles: Candle[]): string;
};

export function createImportedReplay(input: {
  candles: Candle[];
  executions: TradeExecution[];
  storedCursor?: string;
}): ImportedReplay;
```

Clamp a missing or out-of-range stored cursor to the first visible candle.
`cursorForTimeframe` returns the start timestamp of the candle containing the
same knowledge time and never returns a later candle.

- [ ] **Step 9: Verify Task 5 and commit**

Run:

```bash
npm run test:unit -- app/lib/replay/position-ledger.test.ts app/lib/replay/position-path-metrics.test.ts app/lib/replay/imported-replay.test.ts app/lib/replay/replay-engine.test.ts
git add app/lib/replay
git commit -m "feat: calculate cursor-safe position paths"
```

Expected: ledger, long/short path, future boundary, local replay, and existing
demo snapshot tests PASS.

---

### Task 6: Episode-scoped review state, chart settings, and drawing commands

**Files:**
- Modify: `app/lib/chart/drawings.ts`
- Modify: `app/lib/chart/drawings.test.ts`
- Create: `app/lib/chart/drawing-commands.ts`
- Create: `app/lib/chart/drawing-commands.test.ts`
- Create: `app/lib/chart/drawing-geometry.ts`
- Create: `app/lib/chart/drawing-geometry.test.ts`
- Modify: `app/lib/storage/review-storage.ts`
- Modify: `app/lib/storage/review-storage.test.ts`
- Create: `app/lib/storage/chart-settings.ts`
- Create: `app/lib/storage/chart-settings.test.ts`

**Interfaces:**
- Consumes: existing drawings, episode IDs, timeframes, and cursor.
- Produces: expanded drawing tools, immutable command history, hit-test geometry, version-2 review state, and persisted `ChartSettings`.

- [ ] **Step 1: Write failing expanded drawing-contract tests**

Assert exact anchor counts and valid long/short geometry:

```ts
expect(requiredAnchorCount("vertical-line")).toBe(1);
expect(requiredAnchorCount("rectangle")).toBe(2);
expect(requiredAnchorCount("arrow")).toBe(2);
expect(requiredAnchorCount("measure")).toBe(2);
expect(requiredAnchorCount("long-risk-reward")).toBe(3);
expect(requiredAnchorCount("short-risk-reward")).toBe(3);

expect(() =>
  validateDrawing(longRiskRewardWithStopAboveEntry),
).toThrow("做多止损必须低于入场价");
```

Also assert a moved future anchor is clamped to the cursor and a drawing
created after a rewound cursor stays hidden.

- [ ] **Step 2: Run drawing model tests to verify RED**

Run:

```bash
npm run test:unit -- app/lib/chart/drawings.test.ts
```

Expected: FAIL because the expanded tools and validation functions do not
exist.

- [ ] **Step 3: Extend drawing types and validation**

Use:

```ts
export type DrawingTool =
  | "cursor"
  | "trend-line"
  | "horizontal-line"
  | "vertical-line"
  | "rectangle"
  | "arrow"
  | "price-label"
  | "text"
  | "measure"
  | "long-risk-reward"
  | "short-risk-reward";

export type Drawing = {
  version: 2;
  id: string;
  episodeId: string;
  name: string;
  tool: Exclude<DrawingTool, "cursor">;
  anchors: DrawingAnchor[];
  style: DrawingStyle;
  text?: string;
  zIndex: number;
  hidden: boolean;
  locked: boolean;
  visibleOn: "all" | Timeframe[];
  stage: "pre-trade" | "during-replay" | "post-review";
  createdAtCursor: string;
};
```

Migrate version-1 drawings during load by assigning the current episode ID,
tool label as name, array order as z-index, version 2, and the saved cursor as
missing knowledge time. Map legacy `"risk-reward"` to
`"long-risk-reward"` when stop is below entry and `"short-risk-reward"`
otherwise.

- [ ] **Step 4: Write failing command-history and geometry tests**

```ts
let history = createDrawingHistory([trend]);
history = applyDrawingCommand(history, {
  type: "rename",
  id: trend.id,
  name: "下降趋势线",
});
history = undoDrawingCommand(history);
expect(history.present[0].name).toBe("趋势线");
history = redoDrawingCommand(history);
expect(history.present[0].name).toBe("下降趋势线");
```

Test create, update anchors, rename, toggle hidden, toggle locked, move
z-order, delete, clear unlocked, undo, and redo. Geometry tests assert
segment, rectangle-edge, and anchor-handle hit testing within a six-pixel
tolerance.

- [ ] **Step 5: Implement immutable drawing commands and geometry**

Export:

```ts
export type DrawingHistory = {
  past: Drawing[][];
  present: Drawing[];
  future: Drawing[][];
};

export type DrawingCommand =
  | { type: "add"; drawing: Drawing }
  | { type: "replace"; drawing: Drawing }
  | { type: "rename"; id: string; name: string }
  | { type: "toggle-hidden"; id: string }
  | { type: "toggle-locked"; id: string }
  | { type: "move"; id: string; direction: "up" | "down" }
  | { type: "delete"; id: string }
  | { type: "clear-unlocked" };
```

Every applied command pushes a deep-cloned `present` into `past` and clears
`future`. Locked drawings ignore replace/delete commands except an explicit
lock toggle. Geometry functions operate on projected `{x, y}` points and do
not import React or Lightweight Charts.

- [ ] **Step 6: Write failing review-state and chart-setting migration tests**

```ts
expect(loadReviewState("episode-1")).toMatchObject({
  version: 2,
  episodeId: "episode-1",
  timeframe: "1D",
  activePanelTab: "stats",
});

expect(loadChartSettings()).toEqual({
  version: 1,
  showGrid: true,
  showVolume: true,
  showExecutions: true,
  showAverageCost: true,
  colorScheme: "teal-red",
});
```

- [ ] **Step 7: Implement state and settings persistence**

Define:

```ts
export type StoredReviewState = {
  version: 2;
  episodeId: string;
  replayCursor: string;
  timeframe: Timeframe;
  activePanelTab: "stats" | "notes";
  drawings: Drawing[];
};

export type ChartSettings = {
  version: 1;
  showGrid: boolean;
  showVolume: boolean;
  showExecutions: boolean;
  showAverageCost: boolean;
  colorScheme: "teal-red" | "green-red" | "blue-orange";
};
```

Keep reading the existing `trade-reviewer:review:v1:<episodeId>` key and
write migrated state to `trade-reviewer:review:v2:<episodeId>`. Store chart
settings at `trade-reviewer:chart-settings:v1`.

- [ ] **Step 8: Verify Task 6 and commit**

Run:

```bash
npm run test:unit -- app/lib/chart/drawings.test.ts app/lib/chart/drawing-commands.test.ts app/lib/chart/drawing-geometry.test.ts app/lib/storage/review-storage.test.ts app/lib/storage/chart-settings.test.ts
git add app/lib/chart app/lib/storage/review-storage.ts app/lib/storage/review-storage.test.ts app/lib/storage/chart-settings.ts app/lib/storage/chart-settings.test.ts
git commit -m "feat: deepen episode drawing state"
```

Expected: drawing migration, command history, geometry, and persistence tests
PASS.

---

### Task 7: Usable drawing overlay and layer management

**Files:**
- Modify: `app/components/chart/drawing-toolbar.tsx`
- Modify: `app/components/chart/drawing-canvas.tsx`
- Create: `app/components/chart/drawing-canvas.test.tsx`
- Modify: `app/components/chart/replay-chart.tsx`
- Create: `app/components/chart/drawing-layers-panel.tsx`
- Create: `app/components/chart/drawing-layers-panel.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `DrawingHistory`, drawing commands, geometry, chart coordinate adapter, active tool, cursor, episode ID, and planned risk amount.
- Produces: toolbar tool selection, editable canvas interactions, and layer commands.

- [ ] **Step 1: Write failing toolbar visibility and canvas creation tests**

Assert all user-facing tools are present:

```ts
for (const name of [
  "趋势线",
  "水平线",
  "垂直线",
  "矩形区间",
  "箭头",
  "价格标注",
  "文字标注",
  "区间测量",
  "做多盈亏比",
  "做空盈亏比",
]) {
  expect(screen.getByRole("button", { name })).toBeEnabled();
}
```

For the canvas, stub the coordinate adapter, drag a rectangle, and assert
`onCommand` receives an `add` command with two clamped anchors. Place text
and assert an inline textbox appears and commits the entered content.

- [ ] **Step 2: Run drawing component tests to verify RED**

Run:

```bash
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx
```

Expected: FAIL because new tools, selection, and `onCommand` do not exist.

- [ ] **Step 3: Render and create every drawing tool**

Change `DrawingCanvas` props to:

```ts
type Props = {
  episodeId: string;
  candles: Candle[];
  cursor: string;
  drawings: Drawing[];
  selectedDrawingId: string | null;
  activeTool: DrawingTool;
  plannedRiskAmount?: string;
  onSelectDrawing: (id: string | null) => void;
  onCommand: (command: DrawingCommand) => void;
  coordinateAdapter?: ChartCoordinateAdapter;
  coordinateVersion?: number;
};
```

Render vertical lines, rectangles, arrows, measurement labels, and separate
long/short risk/reward zones. A risk/reward drag sets entry and stop; the
third target anchor starts at `2R` in the valid direction and remains
independently draggable. When planned risk is valid, label the zone with
currency risk, potential reward, and suggested integer quantity.

- [ ] **Step 4: Add failing selection, handle-drag, and locked-drawing tests**

Click a line within hit tolerance and assert it is selected. Drag an anchor
and assert one `replace` command. Assert locked drawings cannot move and
future anchor times are clamped to the cursor.

- [ ] **Step 5: Implement selection and editing**

Use `drawing-geometry.ts` for hit testing. Render selection handles on the
canvas; on pointer down, capture either an anchor index or the whole drawing.
On pointer move, keep only local preview state. On pointer up, emit one
`replace` command so one drag corresponds to one undo step. Position an HTML
`input` over a new or selected text drawing and commit on Enter/blur, cancel
on Escape.

- [ ] **Step 6: Write failing layer-panel tests**

```ts
await user.clear(screen.getByLabelText("重命名趋势线"));
await user.type(screen.getByLabelText("重命名趋势线"), "突破趋势");
await user.keyboard("{Enter}");
expect(onCommand).toHaveBeenCalledWith({
  type: "rename",
  id: "trend-1",
  name: "突破趋势",
});
```

Test show/hide, lock/unlock, move up/down, delete, empty state, and keyboard
focus behavior.

- [ ] **Step 7: Implement the layer manager and connect replay chart**

Render drawings sorted by descending z-index with tool icon, editable name,
visibility, lock, move, and delete buttons. Disabled move controls explain
top/bottom boundaries. Pass the expanded drawing props through `ReplayChart`.
Apply chart settings to volume, marker, cost-line, grid, and color options
without recreating the chart.

- [ ] **Step 8: Verify Task 7 and commit**

Run:

```bash
npm run test:unit -- app/components/chart/drawing-canvas.test.tsx app/components/chart/drawing-layers-panel.test.tsx app/components/chart/chart-toolbar.test.tsx
git add app/components/chart app/globals.css
git commit -m "feat: make chart drawings editable"
```

Expected: drawing creation, edit, layer, and existing toolbar tests PASS.

---

### Task 8: Functional search, data details, fullscreen, and chart settings

**Files:**
- Modify: `app/components/chart/chart-toolbar.tsx`
- Modify: `app/components/chart/chart-toolbar.test.tsx`
- Create: `app/components/chart/instrument-search-popover.tsx`
- Create: `app/components/chart/instrument-search-popover.test.tsx`
- Create: `app/components/chart/market-data-popover.tsx`
- Create: `app/components/chart/market-data-popover.test.tsx`
- Create: `app/components/chart/chart-settings-popover.tsx`
- Create: `app/components/chart/chart-settings-popover.test.tsx`
- Create: `app/components/chart/use-fullscreen.ts`
- Create: `app/components/chart/use-fullscreen.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: local instruments, timeframe availability, interval coverage, chart settings, refresh callback, and workspace element.
- Produces: observable actions for every in-scope top toolbar control.

- [ ] **Step 1: Write failing local instrument-search tests**

```ts
await user.click(screen.getByRole("button", { name: "搜索标的" }));
await user.type(screen.getByRole("searchbox"), "1357");
await user.click(
  screen.getByRole("option", { name: "美图公司 1357 HK" }),
);
expect(onSelectInstrument).toHaveBeenCalledWith("HK:1357");
```

Test name matching, symbol matching, empty results, ArrowDown/ArrowUp, Enter,
Escape, outside click, and focus return.

- [ ] **Step 2: Implement the search popover**

Use this item contract:

```ts
export type SearchableInstrument = {
  id: string;
  name: string;
  symbol: string;
  market: string;
};
```

Filter with trimmed case-insensitive substring matching over name and symbol.
Keep the bundled demo in results only when there are no imported instruments,
matching current first-run behavior.

- [ ] **Step 3: Write failing data-details and setting tests**

Open the data badge and assert source, actual coverage, fetch time, disabled
period reason, and refresh action are visible. Toggle volume and assert:

```ts
expect(onSettingsChange).toHaveBeenCalledWith(
  expect.objectContaining({ showVolume: false }),
);
```

Render no coverage and assert the copy explains that no request has been made
instead of showing an empty date.

- [ ] **Step 4: Implement data and settings popovers**

Use:

```ts
export type MarketDataDetails = {
  providerLabel: string | null;
  nativeInterval: NativeMarketInterval;
  coverageStart?: string;
  coverageEnd?: string;
  fetchedAt?: string;
  status: MarketDataSyncStatus;
  limitationReason?: string;
};
```

The settings popover owns no persistence; it emits a complete
`ChartSettings` value and the workspace saves it through
`saveChartSettings`.

- [ ] **Step 5: Write failing fullscreen hook tests**

Mock `requestFullscreen`, `document.exitFullscreen`, and the
`fullscreenchange` event. Assert the hook toggles, updates `isFullscreen`,
and returns `{ supported: false }` when the API is absent.

- [ ] **Step 6: Implement `useFullscreen`**

```ts
export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
): {
  supported: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
};
```

Subscribe to `fullscreenchange`, compare `document.fullscreenElement` with the
target, call `requestFullscreen` or `document.exitFullscreen`, and remove the
listener on unmount.

- [ ] **Step 7: Expand `ChartToolbar` orchestration**

Replace the previously inert icon buttons with controlled popover triggers and
callbacks. Add:

```ts
type Props = {
  timeframe: Timeframe;
  timeframeAvailability: TimeframeAvailability;
  onTimeframeChange: (timeframe: Timeframe) => void;
  instruments: SearchableInstrument[];
  onSelectInstrument: (instrumentId: string) => void;
  dataDetails: MarketDataDetails[];
  onRefreshMarketData: () => void;
  layersOpen: boolean;
  layersDisabledReason?: string;
  onToggleLayers: () => void;
  fullscreen: ReturnType<typeof useFullscreen>;
  settings: ChartSettings;
  onSettingsChange: (settings: ChartSettings) => void;
  symbol: string;
  instrumentName: string;
  market: string;
};
```

Set the disabled period’s `title` and `aria-description` from availability.
Use active/expanded ARIA states for popovers and layers.

- [ ] **Step 8: Verify Task 8 and commit**

Run:

```bash
npm run test:unit -- app/components/chart/chart-toolbar.test.tsx app/components/chart/instrument-search-popover.test.tsx app/components/chart/market-data-popover.test.tsx app/components/chart/chart-settings-popover.test.tsx app/components/chart/use-fullscreen.test.tsx
git add app/components/chart app/globals.css
git commit -m "feat: activate chart toolbar controls"
```

Expected: search, data, setting, fullscreen, period-reason, and accessibility
tests PASS.

---

### Task 9: Cursor-safe right panel and autosaved episode notes

**Files:**
- Create: `app/components/review/position-stats-panel.tsx`
- Create: `app/components/review/position-stats-panel.test.tsx`
- Create: `app/components/review/use-episode-review-autosave.ts`
- Create: `app/components/review/use-episode-review-autosave.test.tsx`
- Create: `app/components/review/episode-notes-panel.tsx`
- Create: `app/components/review/episode-notes-panel.test.tsx`
- Create: `app/components/review/review-side-panel.tsx`
- Create: `app/components/review/review-side-panel.test.tsx`
- Delete: `app/components/review/thesis-panel.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PositionPathMetrics`, instrument/episode labels, episode review record, repository save callback, and panel state.
- Produces: statistics/notes tabs, autosave status, and desktop/drawer panel content.

- [ ] **Step 1: Write failing statistics rendering tests**

```ts
expect(screen.getByText("最大盈利（MFE）")).toBeInTheDocument();
expect(screen.getByText("+HK$500.00")).toBeInTheDocument();
expect(screen.getByText("最大亏损（MAE）")).toBeInTheDocument();
expect(screen.getByText("-HK$120.00")).toBeInTheDocument();
expect(screen.getByText("最大回撤")).toBeInTheDocument();
expect(screen.getByText("盈利回吐")).toBeInTheDocument();
```

Also render `unavailableReason` and assert unavailable values display `—`
with the reason, not `0`. Test long duration, currency, percentage, planned
risk, and R multiple formatting.

- [ ] **Step 2: Implement `PositionStatsPanel`**

Render three labeled groups: current state, path risk, and plan comparison.
Use `Intl.NumberFormat("zh-CN", { style: "currency", currency })` with
sign display for P&L and path amounts. Format holding duration as hours below
48 hours and calendar days otherwise. Do not calculate metrics in the
component.

- [ ] **Step 3: Write failing debounced autosave tests**

Use fake timers:

```ts
await user.type(screen.getByLabelText("买入理由"), "等待回踩");
await vi.advanceTimersByTimeAsync(599);
expect(onSave).not.toHaveBeenCalled();
await vi.advanceTimersByTimeAsync(1);
expect(onSave).toHaveBeenCalledWith(
  expect.objectContaining({
    episodeId: "episode-1",
    plan: expect.objectContaining({ thesis: "等待回踩" }),
  }),
);
```

Assert saving/saved/error states, validation of planned risk, retry after a
rejection, and flushing a valid pending record when episode ID changes or
the component unmounts.

- [ ] **Step 4: Implement the autosave hook**

```ts
export function useEpisodeReviewAutosave(input: {
  episodeId: string;
  instrumentId: string;
  record?: EpisodeReviewRecord;
  delayMs?: number;
  onSave: (record: EpisodeReviewRecord) => Promise<void>;
}): {
  draft: EpisodeReviewRecord;
  status: "idle" | "dirty" | "saving" | "saved" | "error";
  error: string | null;
  updatePlan: <K extends keyof EpisodeReviewRecord["plan"]>(
    key: K,
    value: EpisodeReviewRecord["plan"][K],
  ) => void;
  updateReview: <K extends keyof EpisodeReviewRecord["review"]>(
    key: K,
    value: EpisodeReviewRecord["review"][K],
  ) => void;
  toggleTag: (tagId: string) => void;
  retry: () => Promise<void>;
};
```

Default to a 600ms debounce. Normalize and timestamp records with the existing
review-metrics helpers. Keep an in-memory dirty draft after a save failure.

- [ ] **Step 5: Write failing notes and drawer tests**

Assert every existing plan/review field remains editable in the compact
panel, tags and completion are present, the save status is announced, tabs
switch with correct ARIA state, and the narrow-screen trigger opens a dialog
and restores focus when closed.

- [ ] **Step 6: Implement notes, tabs, and drawer behavior**

`EpisodeNotesPanel` consumes the autosave hook and reuses
`REVIEW_TAGS`. `ReviewSidePanel` props:

```ts
type Props = {
  instrumentLabel: string;
  currency: string;
  metrics: PositionPathMetrics;
  review?: EpisodeReviewRecord;
  episodeId: string;
  instrumentId: string;
  activeTab: "stats" | "notes";
  onActiveTabChange: (tab: "stats" | "notes") => void;
  onSaveReview: (record: EpisodeReviewRecord) => Promise<void>;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
};
```

Render the same content inside the fixed desktop aside or modal drawer; do
not mount two editable note forms simultaneously.

- [ ] **Step 7: Verify Task 9 and commit**

Run:

```bash
npm run test:unit -- app/components/review/position-stats-panel.test.tsx app/components/review/use-episode-review-autosave.test.tsx app/components/review/episode-notes-panel.test.tsx app/components/review/review-side-panel.test.tsx app/components/review/episode-review-editor.test.tsx
git add app/components/review app/globals.css
git commit -m "feat: add path statistics and autosaved notes"
```

Expected: metrics presentation, autosave, episode isolation, tabs, and drawer
tests PASS.

---

### Task 10: Unified demo/imported replay workspace

**Files:**
- Create: `app/components/review/review-chart-workspace.tsx`
- Create: `app/components/review/review-chart-workspace.test.tsx`
- Modify: `app/components/review/episode-sidebar.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Delete: `app/components/review/imported-episode-review.tsx`
- Delete: `app/components/review/imported-episode-review.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: demo/imported replay view model, toolbar props, drawing history, chart settings, path metrics, episode review, and persistence callbacks.
- Produces: one observable review experience for both data sources.

- [ ] **Step 1: Write a failing imported-workspace integration test**

Seed one imported instrument, a closed episode, daily candles, `15m` candles,
coverage, and a review record. Render the top-level workspace and assert:

```ts
expect(
  await screen.findByRole("heading", { name: "小米集团-W（1810）" }),
).toBeInTheDocument();
expect(
  screen.getByRole("button", { name: "切换到 15m" }),
).toBeEnabled();
expect(
  screen.getByRole("button", { name: "趋势线" }),
).toBeEnabled();
expect(screen.getByText("最大盈利（MFE）")).toBeInTheDocument();
expect(
  screen.getByRole("button", { name: "下一根 K 线" }),
).toBeEnabled();
expect(
  screen.queryByLabelText("导入股票成交详情"),
).not.toBeInTheDocument();
```

Advance one candle and assert the cursor and metrics update without exposing
the closing execution. Switch to `1H` and assert the absolute knowledge time
does not advance.

- [ ] **Step 2: Run the integration test to verify RED**

Run:

```bash
npm run test:unit -- app/components/trade-review-workspace.test.tsx
```

Expected: FAIL because imported instruments still use the static component
and disable intraday, drawing, replay, and the right panel.

- [ ] **Step 3: Extract the shared chart shell**

Define a UI-only view model:

```ts
export type ReviewChartViewModel = {
  source: "demo" | "imported";
  episodeId: string;
  instrument: Instrument;
  timeframe: Timeframe;
  timeframeAvailability: TimeframeAvailability;
  cursor: string;
  candles: Candle[];
  executions: TradeExecution[];
  position: PositionLedgerSnapshot;
  pathMetrics: PositionPathMetrics;
  canGoBack: boolean;
  canGoForward: boolean;
  replayError: string | null;
  dataDetails: MarketDataDetails[];
};
```

`ReviewChartWorkspace` renders `ChartToolbar`, `DrawingToolbar`,
`DrawingLayersPanel`, position strip, `ReplayChart`, `ReplayControls`, and
replay status from this model. It receives callbacks for period, replay,
search, refresh, drawing, settings, fullscreen, and layers. It does not load
storage or fetch data.

- [ ] **Step 4: Add selected episode and imported market state**

In `TradeReviewWorkspace` derive episodes with
`buildTradeEpisodes(selectedImportedInstrument.executions)`, sort newest
first, and hold `selectedEpisodeId`. Selecting an imported instrument chooses
its most recent episode; selecting demo uses the fixed demo episode.

Maintain:

```ts
type InstrumentMarketState = {
  daily: DailyCandleRecord[];
  intraday: MarketCandleRecord[];
  dailyStatus: MarketDataSyncStatus;
  intradayStatus: MarketDataSyncStatus;
  intradayCoverage: IntervalCoverageSegment[];
};
```

Load cache before starting network work. Refresh runs daily and intraday sync
under the existing per-instrument abort sequence. A failure keeps cached
candles and records the interval-specific message.

- [ ] **Step 5: Adapt imported episodes to the local replay controller**

For the active display period:

- use native `15m` or derived `1H`/`4H` from `intraday`;
- use legacy-compatible `1D` or derived `1W` from `daily`;
- build `createImportedReplay` with the saved episode cursor;
- build `createReplaySnapshot` and `calculatePositionPathMetrics` with only
  the selected episode executions;
- persist cursor, timeframe, active right tab, and drawings under episode ID.

Imported previous/next/next-execution handlers update the local cursor.
Imported autoplay uses the existing speed values and stops at the last
candle. Demo handlers continue calling `/api/demo-replay`.

- [ ] **Step 6: Add the episode selector and execution details**

Extend the selected stock card or chart header with a labeled episode
selector:

```ts
type EpisodeOption = {
  id: string;
  label: string;
  startedAt: string;
  endedAt?: string;
  status: "open" | "closed";
};
```

Default to the newest episode. Keep execution details available in a
collapsible section/drawer keyed to the selected episode. Remove the static
`ImportedEpisodeReview` component and its CSS once its observable information
exists in the shared shell, data popover, episode selector, and execution
details.

- [ ] **Step 7: Connect drawings, toolbar, and right panel**

Create drawing history from stored episode drawings. Apply commands through
`applyDrawingCommand`, persist `history.present`, and filter through
`visibleDrawingsAtCursor`. Connect local instrument search, data popover,
fullscreen, chart settings, layers, position metrics, review record, and
autosave. The right panel is available for imported episodes even when market
data is missing; its stats tab explains the missing data and its notes tab
remains editable.

- [ ] **Step 8: Add future-boundary and unavailable-period integration tests**

Test that:

- a cached future candle and closing execution are absent before their cursor;
- MFE and final net P&L increase only after their candles are revealed;
- layer rows for later-created drawings are absent after rewinding;
- a daily-only instrument disables `15m`, `1H`, and `4H` with the provider
  limitation reason;
- selecting an enabled period preserves cursor knowledge time;
- switching episodes restores independent cursor, drawings, and notes;
- every in-scope toolbar button produces its documented observable result.

- [ ] **Step 9: Verify Task 10 and commit**

Run:

```bash
npm run test:unit -- app/components/review/review-chart-workspace.test.tsx app/components/trade-review-workspace.test.tsx
git add app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/components/review/review-chart-workspace.tsx app/components/review/review-chart-workspace.test.tsx app/components/review/episode-sidebar.tsx app/components/review/imported-episode-review.tsx app/components/review/imported-episode-review.test.tsx app/globals.css
git commit -m "feat: unify imported and demo replay"
```

Expected: imported/demo parity, future isolation, episode isolation, and
unavailable-period tests PASS. The deleted imported files are staged by the
listed paths.

---

### Task 11: Responsive polish, documentation, and full verification

**Files:**
- Modify: `app/globals.css`
- Modify: `README.md`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/components/trade-review-workspace.test.tsx`

**Interfaces:**
- Consumes: the completed unified workspace.
- Produces: documented, responsive, build-verified behavior.

- [ ] **Step 1: Add failing rendered and responsive behavior assertions**

Update the rendered HTML smoke test to assert the page includes the unified
review workspace, `持仓统计`, and the chart toolbar without requiring client
data. Add component assertions that at narrow width the fixed desktop panel
is hidden, the `打开复盘面板` trigger is operable, and the drawer closes with
Escape.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
npm run test:unit -- app/components/trade-review-workspace.test.tsx
```

Expected: FAIL until responsive drawer state and static labels are connected
to the unified shell.

- [ ] **Step 3: Finish responsive and interaction styling**

Keep the current desktop columns at widths above 1260px. Below 1260px, hide
the fixed right panel and show the drawer trigger. Below 1060px, retain the
existing single chart column and hidden instrument sidebar while ensuring
toolbar popovers stay within the viewport. Add visible selected, hover,
disabled, drag-handle, focus, saving, stale-data, and error states. Respect
`prefers-reduced-motion` for spinners and drawer transitions.

- [ ] **Step 4: Update documentation and current limitations**

README must state:

- imported episodes now share replay, drawing, statistics, and notes;
- real `15m` is cached when public sources cover it;
- `1H`/`4H` derive from real `15m`, while `1W` derives from daily;
- unavailable periods are disabled with a reason;
- public sources may limit older intraday history;
- chart settings, drawings, cursors, and reviews remain local;
- “模式洞察” remains outside this delivery.

Remove the outdated statement that real imports support only daily and weekly
data. Do not claim fixed historical intraday coverage.

- [ ] **Step 5: Run the complete verification suite**

Run each command separately and inspect the full output:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm test
```

Expected: every command exits 0 with no test failures, type errors, lint
errors, build errors, or rendered-HTML smoke failures.

- [ ] **Step 6: Inspect the built workspace manually**

Run:

```bash
npm run dev
```

In the local browser, verify:

- one imported instrument with intraday cache enables `15m`, `1H`, and `4H`;
- a daily-only instrument disables them and explains why;
- previous, next, play, next execution, and period switch preserve the
  knowledge boundary;
- search, data details, layers, fullscreen, and settings respond;
- trend, text, rectangle, and long/short risk-reward drawings can be created,
  moved, hidden, locked, undone, and restored after reload;
- MFE, MAE, drawdown, and giveback update only as the cursor advances;
- notes autosave to the selected episode;
- the right-panel drawer works below 1260px;
- the browser console has no errors or warnings caused by the application.

Stop the development server after inspection.

- [ ] **Step 7: Commit final polish**

```bash
git add app/globals.css README.md tests/rendered-html.test.mjs app/components/trade-review-workspace.test.tsx
git commit -m "docs: describe unified replay capabilities"
```

Expected: the final commit contains only responsive/test/documentation polish
not already committed by earlier tasks.

---

## Final Requirement Trace

- Real imported `15m`/`1H`/`4H`: Tasks 1–4 and 10.
- Honest public-source limitations and local caching: Tasks 2–4, 8, and 11.
- Unified imported replay and episode selection: Tasks 5 and 10.
- Search, data, layers, fullscreen, settings, and mobile panel: Tasks 7–10.
- Trend, line, rectangle, arrow, text, measurement, and risk/reward tools:
  Tasks 6–7.
- Episode-scoped drawing persistence and future safety: Tasks 6, 7, and 10.
- Current position, MFE, MAE, drawdown, giveback, and R: Tasks 5, 9, and 10.
- Episode notes with autosave and isolation: Tasks 9–10.
- Migration preservation, full automated verification, and documentation:
  Tasks 3 and 11.
