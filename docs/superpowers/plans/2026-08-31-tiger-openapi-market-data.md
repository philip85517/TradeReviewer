# Tiger OpenAPI Market Data Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-only Tiger OpenAPI market-data provider that reads the user's external properties file, returns validated US/HK daily and 1-hour candles, and participates in the existing fallback, sync, and SQLite persistence chain.

**Architecture:** Keep credentials outside the repository and enable Tiger only when `TIGER_OPENAPI_CONFIG` points to a valid properties file. Because the repository is TypeScript/Node and the official SDK is Python, a small JSON-over-stdio Python helper will call `tigeropen`; a Node provider will validate and normalize its output into the existing provider contracts. The router will try Tiger first for supported markets and continue to public providers when Tiger is unavailable, unauthorized, timed out, empty, or sparse.

**Tech Stack:** TypeScript, Node.js server runtime, Python 3, `tigeropen==3.7.1`, Vitest, existing market-data contracts/router/sync service, SQLite storage.

**Spec:** `docs/superpowers/specs/2026-08-31-tiger-openapi-market-data-design.md`

## Global Constraints

- Tiger credentials are read only on the server and the config path is supplied through `TIGER_OPENAPI_CONFIG`.
- The private key, account value, config contents, raw SDK response, and full traceback must never be logged, persisted, or returned to the browser.
- Tiger is limited to `US` and `HK`; `CN-SH` and `CN-SZ` continue to use the existing public providers.
- Daily requests use Tiger `day`; 1-hour requests use Tiger `60min`; saved candles remain `raw`.
- An empty or failed Tiger response must not erase existing candles or create a false complete-coverage segment.
- The helper exposes quote reads only; it must not import or call trade, order, asset, or position APIs.
- All fake-provider tests must be deterministic and must not use the user's real configuration.

---

## File Map

- Create `requirements-tiger.txt` — optional local Python dependency pin for the official SDK.
- Create `app/lib/market/tiger-config.ts` — external properties path discovery and non-sensitive validation.
- Create `app/lib/market/tiger-config.test.ts` — properties parsing and redaction tests.
- Create `scripts/tiger-market-data.py` — JSON-over-stdio adapter around `tigeropen.QuoteClient.get_bars`.
- Create `app/lib/market/tiger-process.ts` — Node child-process runner, timeout, JSON parsing, and safe error mapping.
- Create `app/lib/market/tiger-process.test.ts` — process runner tests with injected fake process behavior.
- Create `app/lib/market/providers/tiger.ts` — Tiger response parser and `MarketDataProvider` implementation.
- Create `app/lib/market/providers/tiger.test.ts` — Tiger candle conversion and provider error tests.
- Modify `app/lib/market/contracts.ts` — add `tiger` to `MarketDataProviderId`.
- Modify `app/lib/market/sync-service.ts` — accept `tiger` when reading persisted provider metadata.
- Modify `app/lib/market/providers/router.ts` — instantiate Tiger conditionally and put it first for US/HK daily/1H requests.
- Modify `app/lib/market/providers/providers.test.ts` — preserve public fallback tests and add Tiger priority/fallback coverage.
- Modify `README.md` — document optional SDK installation, external config setup, and safe local smoke-test commands.

### Task 1: Add safe Tiger configuration discovery

**Files:**
- Create: `requirements-tiger.txt`
- Create: `app/lib/market/tiger-config.ts`
- Test: `app/lib/market/tiger-config.test.ts`

**Interfaces:**
- Produces `TigerOpenApiConfig` with only `configPath` and non-sensitive capability flags.
- Produces `readTigerOpenApiConfig(environment?: NodeJS.ProcessEnv): TigerOpenApiConfig | undefined`.
- Produces `parseTigerProperties(contents: string): TigerPropertiesSummary` for unit tests; the summary contains key presence and never returns private-key or account values.

- [ ] **Step 1: Write the failing configuration tests**

  Add tests for these exact cases:

  ```ts
  expect(parseTigerProperties([
    "private_key_pk1=pk1-secret",
    "private_key_pk8=pk8-secret",
    "tiger_id=123",
    "account=acct",
    "license=TBSG",
    "env=PRO",
  ].join("\\n"))).toEqual({
    hasPrivateKeyPk1: true,
    hasPrivateKeyPk8: true,
    hasTigerId: true,
    hasAccount: true,
    hasLicense: true,
    hasEnv: true,
  });

  expect(parseTigerProperties("tiger_id=123\\naccount=acct\\nprivate_key_pk8=key"))
    .toMatchObject({ hasPrivateKeyPk8: true, hasPrivateKeyPk1: false });

  expect(JSON.stringify(parseTigerProperties("account=acct\\nprivate_key_pk1=secret")))
    .not.toContain("secret");
  ```

  Also assert `readTigerOpenApiConfig({})` returns `undefined`, a missing path returns `undefined`, and a valid path returns the absolute path with no secret fields.

- [ ] **Step 2: Run the focused tests and verify the new tests fail**

  Run: `npm run test:unit -- app/lib/market/tiger-config.test.ts --run`

  Expected: FAIL because the parser and config-discovery module do not exist.

- [ ] **Step 3: Implement the minimal parser and path validation**

  Parse UTF-8 lines by splitting on the first `=` after trimming whitespace; ignore blank lines and lines beginning with `#` or `;`. Treat a key as present only when its value is non-empty. Require `tiger_id`, `account`, and at least one of `private_key_pk1`/`private_key_pk8`; treat `license` and `env` as optional. Read only the path from `environment.TIGER_OPENAPI_CONFIG`, resolve it with `path.resolve`, and verify it is a regular file. Return `undefined` for absent/invalid config so the existing public-only chain remains unchanged.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `npm run test:unit -- app/lib/market/tiger-config.test.ts --run`

  Expected: PASS with no output containing any fixture secret.

- [ ] **Step 5: Add the optional SDK dependency declaration and commit**

  Put exactly this in `requirements-tiger.txt`:

  ```text
  tigeropen==3.7.1
  ```

  Run: `git add requirements-tiger.txt app/lib/market/tiger-config.ts app/lib/market/tiger-config.test.ts && git commit -m "feat: add safe Tiger configuration discovery"`

### Task 2: Implement the JSON-over-stdio Tiger SDK helper and Node runner

**Files:**
- Create: `scripts/tiger-market-data.py`
- Create: `app/lib/market/tiger-process.ts`
- Test: `app/lib/market/tiger-process.test.ts`

**Interfaces:**
- Python stdin request: `{ "symbol": string, "period": "day" | "60min", "beginTime": string, "endTime": string }`.
- Python stdout success: `{ "bars": Array<{ "symbol": string, "time": number, "open": number, "high": number, "low": number, "close": number, "volume": number }> }`.
- Node `runTigerBars(request: TigerBarRequest, options?: TigerProcessOptions): Promise<TigerBar[]>`.
- `TigerProcessOptions` accepts injected `spawn`, `pythonCommand`, `helperPath`, and `timeoutMs` so tests never need the real SDK.

- [ ] **Step 1: Write failing runner tests**

  Cover successful one-line JSON output, malformed JSON, non-zero exit, missing `bars`, timeout, and stderr redaction. The timeout test must use a fake child that never closes and a `timeoutMs` of `10`.

  The success assertion must prove the child receives the exact JSON request and that the returned value is the parsed `bars` array. Error assertions must match only safe codes/messages such as `tiger SDK 未安装或不可用` and must assert that `private_key_pk1`, `account`, and fixture secret values are absent.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- app/lib/market/tiger-process.test.ts --run`

  Expected: FAIL because the runner module does not exist.

- [ ] **Step 3: Implement the Python helper**

  Read `TIGER_OPENAPI_CONFIG` from the helper environment and parse the same properties format only to validate non-empty `tiger_id`, `account`, and at least one private-key field; do not print or return parsed values. Instantiate `TigerOpenClientConfig(props_path=config_path)` and let the pinned official SDK remain the credential-format source of truth: `tigeropen==3.7.1` loads the adjacent config file and currently resolves `private_key_pk8` before `private_key_pk1`, while also loading an adjacent `tiger_openapi_token.properties` when required by an HK license. Then create `QuoteClient` and call:

  ```python
  bars = quote_client.get_bars(
      [request["symbol"]],
      period=request["period"],
      begin_time=request["beginTime"],
      end_time=request["endTime"],
      right="nr",
      limit=1200,
  )
  ```

  Convert the returned DataFrame rows to plain JSON numbers using only `symbol`, `time`, `open`, `high`, `low`, `close`, and `volume`. On empty data, emit `{ "bars": [] }`. On all errors, write a fixed safe error category to stderr and exit non-zero; never print the properties contents or traceback.

- [ ] **Step 4: Implement the Node child-process runner**

  Spawn `python3 -u <helperPath>` with `TIGER_OPENAPI_CONFIG` in the child environment, write one JSON request followed by `\n`, collect stdout/stderr, and enforce a default 12-second timeout. Parse only a single JSON object with an array-valued `bars`; reject extra/invalid output. Map spawn failures, non-zero exits, malformed output, and timeout to `MarketDataProviderError` with `source-unavailable`, `invalid-response`, or `source-timeout`; pass no raw stderr to the browser-facing error.

- [ ] **Step 5: Run the focused tests and verify they pass**

  Run: `npm run test:unit -- app/lib/market/tiger-process.test.ts --run`

  Expected: PASS.

- [ ] **Step 6: Commit the helper and runner**

  Run: `git add scripts/tiger-market-data.py app/lib/market/tiger-process.ts app/lib/market/tiger-process.test.ts && git commit -m "feat: bridge Tiger OpenAPI bars through Python SDK"`

### Task 3: Add the Tiger provider and wire it into the router

**Files:**
- Create: `app/lib/market/providers/tiger.ts`
- Test: `app/lib/market/providers/tiger.test.ts`
- Modify: `app/lib/market/contracts.ts`
- Modify: `app/lib/market/sync-service.ts`
- Modify: `app/lib/market/providers/router.ts`
- Modify: `app/lib/market/providers/providers.test.ts`

**Interfaces:**
- `TigerProvider` implements `MarketDataProvider` and supports only `US` and `HK`.
- `TigerProvider.fetchDaily(request, fetcher?)` maps to `period: "day"`.
- `TigerProvider.fetchIntraday(request, fetcher?)` maps `1h` to `period: "60min"`; it must reject `15m` with an existing provider error rather than silently return a different interval.
- `parseTigerBars(bars, request): ProviderDailyCandle[] | ProviderMarketCandle[]` validates every numeric field and timestamp before conversion.

- [ ] **Step 1: Write failing provider tests**

  Use an injected `runBars` fake and assert:

  ```ts
  const provider = new TigerProvider(
    { configPath: "/tmp/tiger.properties" },
    async (request) => [{
      symbol: request.symbol,
      time: Date.parse("2025-01-02T14:30:00.000Z"),
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 800,
    }],
  );

  await expect(provider.fetchDaily({
    instrumentId: "US:AAPL",
    symbol: "AAPL",
    market: "US",
    startDate: "2025-01-01",
    endDate: "2025-01-03",
  })).resolves.toMatchObject({
    provider: "tiger",
    providerSymbol: "AAPL",
    candles: [{ tradingDate: "2025-01-02", close: "101", volume: "800" }],
  });
  ```

  Add tests for HK symbol normalization (`700`), 1H `60min` mapping, invalid/null numeric fields, invalid timestamps, unsupported CN markets, and an empty bar response.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- app/lib/market/providers/tiger.test.ts --run`

  Expected: FAIL because the Tiger provider and `tiger` provider ID do not exist.

- [ ] **Step 3: Implement Tiger parsing and provider methods**

  Normalize US symbols with the existing `normalizeMarketSymbol`; normalize HK symbols to the four-digit Tiger code without `.HK`. Convert `time` milliseconds with `new Date(time).toISOString()`. For daily, use the UTC ISO date; for intraday, preserve the complete ISO timestamp. Convert numeric values to decimal strings, call `validateProviderCandles`/`validateProviderMarketCandles`, and return `warnings: []` for valid data. Set `provider: "tiger"`, `adjustmentMode: "raw"` at the existing route/sync boundary, and map empty data to `no-data` only when the provider router decides no later provider is available.

- [ ] **Step 4: Extend provider identity validation**

  Add `"tiger"` to `MarketDataProviderId` and to the provider guard in `sync-service.ts`. Search for every exhaustive provider union with `rg -n 'baidu|sina|yahoo|eastmoney' app db` and update only cases that validate persisted provider IDs; do not add Tiger to browser/public-source lists.

- [ ] **Step 5: Wire conditional Tiger priority into the router**

  Change `createProviderRouter` to accept an optional runtime environment or provider override for tests. When `readTigerOpenApiConfig()` returns a valid config, prepend `new TigerProvider(config)` to daily and 1H US/HK provider lists. Keep the current public lists and ordering unchanged when no config exists. For 15m, retain current public providers because the first Tiger implementation exposes only daily/1H.

- [ ] **Step 6: Add router regression tests**

  Add deterministic tests with an injected Tiger provider that assert Tiger is called before public providers for US daily and HK 1H, public providers run after a Tiger error, CN requests never call Tiger, and a sparse Tiger 1H result allows a later public provider to supply a fuller result. Keep all existing provider fixtures and assertions unchanged.

- [ ] **Step 7: Run provider and router tests and verify they pass**

  Run: `npm run test:unit -- app/lib/market/providers/tiger.test.ts app/lib/market/providers/providers.test.ts --run`

  Expected: PASS.

- [ ] **Step 8: Commit the provider integration**

  Run: `git add app/lib/market/contracts.ts app/lib/market/sync-service.ts app/lib/market/providers/tiger.ts app/lib/market/providers/tiger.test.ts app/lib/market/providers/router.ts app/lib/market/providers/providers.test.ts && git commit -m "feat: add Tiger market data provider"`

### Task 4: Verify API, persistence, documentation, and the real configured chain

**Files:**
- Modify: `README.md`
- Test: `app/api/market-data/daily/route.test.ts`
- Test: `app/api/market-data/intraday/route.test.ts`
- Test: `app/lib/market/sync-service.test.ts`

**Interfaces:**
- Existing routes remain `GET /api/market-data/daily?market=US&symbol=AAPL&start=YYYY-MM-DD&end=YYYY-MM-DD` and `GET /api/market-data/intraday?market=US&symbol=AAPL&interval=1h&start=<ISO UTC>&end=<ISO UTC>`.
- Successful responses continue to return `provider`, `providerSymbol`, `fetchedAt`, `candles`, `warnings`, `request`, and `adjustmentMode`.

- [ ] **Step 1: Add API tests for configured and unconfigured environments**

  Inject a fake Tiger provider/router dependency into route tests and assert configured US/HK requests return the existing response shape with `provider: "tiger"`; assert a missing configuration still reaches the public provider path. Assert an upstream Tiger failure returns a public fallback result instead of a 502 when a public source succeeds.

- [ ] **Step 2: Add a sync persistence regression test**

  Run `syncMarketData` with a fake route response whose `provider` is `tiger`, then assert the repository receives raw candles, a complete/partial coverage segment with provider `tiger`, and no duplicate writes on a second cache-only sync.

- [ ] **Step 3: Run the API and sync tests**

  Run: `npm run test:unit -- app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.test.ts app/lib/market/sync-service.test.ts --run`

  Expected: PASS.

- [ ] **Step 4: Document local setup without embedding credentials**

  Add a README section with:

  ```bash
  python3 -m pip install -r requirements-tiger.txt
  TIGER_OPENAPI_CONFIG=/absolute/path/tiger_openapi_config.properties npm run dev
  ```

  Explain that the file stays outside the repository, the pinned official SDK resolves `private_key_pk8` before `private_key_pk1` when both fields exist, and only US/HK daily/1H requests use Tiger. Do not add the user's path or any account/key value to the README.

- [ ] **Step 5: Run the complete verification suite**

  Run these commands serially from the repository root:

  ```bash
  npm run typecheck
  npm run test:unit -- --run
  npm run lint
  npm test
  ```

  Expected: all commands exit 0; lint may retain the existing unused `workspacePath` warning but must report 0 errors.

- [ ] **Step 6: Install the SDK and run real read-only smoke tests**

  Install only the pinned quote SDK:

  ```bash
  python3 -m pip install -r requirements-tiger.txt
  ```

  Start the local service with the external config and make read-only requests using one US symbol and one HK symbol already present in the user's imported data:

  ```bash
  TIGER_OPENAPI_CONFIG=/absolute/path/tiger_openapi_config.properties npm run dev
  curl -sS 'http://localhost:3000/api/market-data/daily?market=US&symbol=AAPL&start=2025-01-02&end=2025-01-03'
  curl -sS 'http://localhost:3000/api/market-data/intraday?market=US&symbol=AAPL&interval=1h&start=2025-01-02T00:00:00.000Z&end=2025-01-03T23:59:59.000Z'
  curl -sS 'http://localhost:3000/api/market-data/daily?market=HK&symbol=700&start=2025-01-02&end=2025-01-03'
  curl -sS 'http://localhost:3000/api/market-data/intraday?market=HK&symbol=700&interval=1h&start=2025-01-02T00:00:00.000Z&end=2025-01-03T23:59:59.000Z'
  ```

  Record only HTTP status, `provider`, candle count, first/last timestamp, and safe error code. Treat a 200 response with `provider: "tiger"` and non-empty validated candles as success; if Tiger returns a permission/history error, preserve the public fallback result and report the safe Tiger error category without exposing the SDK response.

- [ ] **Step 7: Commit documentation and final verification**

  Run: `git add README.md app/api/market-data/daily/route.test.ts app/api/market-data/intraday/route.test.ts app/lib/market/sync-service.test.ts && git commit -m "docs: document Tiger market data setup"`
