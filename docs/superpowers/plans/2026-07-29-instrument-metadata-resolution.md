# Instrument Metadata Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically resolve and cache stock/ETF names and asset types from `market + symbol` without API keys or user-entered names.

**Architecture:** A client service checks IndexedDB first and sends only unresolved normalized identifiers to a server route. The server router validates results from official US/HK catalogs and portal fallbacks, returns source/confidence metadata, and exposes no statement or account data. Successful client results are cached by canonical instrument ID and reused by imports and single-stock refresh.

**Tech Stack:** TypeScript 5.9, Next 16 route handlers, Vitest 4, fake-indexeddb, SheetJS `xlsx`, Cloudflare-compatible `fetch`, IndexedDB.

## Global Constraints

- Inputs are limited to `US`, `HK`, `CN-SH`, and `CN-SZ` plus a normalized symbol.
- Only `stock` and `etf` are successful asset types.
- No API key or user-entered security name is allowed.
- Original statements, accounts, executions, and positions never reach the metadata route.
- Cache key is canonical `market:symbol`; cached traded instruments are not repeatedly requested.
- Nasdaq and HKEX official catalogs refresh at most once per day.
- Provider failures rotate to the next source; no immediate retry loop against one source.
- Yahoo is not part of the critical name-resolution path.
- Unit tests use frozen fixtures; live provider smoke tests are non-blocking and excluded from CI.

---

## File Map

### New files

- `app/lib/instruments/metadata-contracts.ts`: lookup/result/provider/error types and runtime result validation.
- `app/lib/instruments/asset-classification.ts`: conservative, tested exchange-code fallback for A-share stock/ETF classification.
- `app/lib/instruments/metadata-request-policy.ts`: route query validation and canonical request parsing.
- `app/lib/instruments/providers/metadata-errors.ts`: typed provider failures.
- `app/lib/instruments/providers/tencent-metadata.ts`: Tencent name/type parser and provider.
- `app/lib/instruments/providers/eastmoney-metadata.ts`: Eastmoney fallback parser and provider.
- `app/lib/instruments/providers/sina-metadata.ts`: Sina fallback parser and provider.
- `app/lib/instruments/providers/nasdaq-directory.ts`: official US directory parser/provider.
- `app/lib/instruments/providers/hkex-directory.ts`: official HK list parser/provider.
- `app/lib/instruments/providers/sec-company-tickers.ts`: SEC stock-only fallback.
- `app/lib/instruments/providers/metadata-router.ts`: market-specific fallback order and validation.
- `app/api/instruments/resolve/route.ts`: public, rate-limited metadata route.
- `app/lib/storage/instrument-metadata-repository.ts`: browser cache interface.
- `app/lib/storage/indexeddb-instrument-metadata-repository.ts`: IndexedDB implementation.
- `app/lib/instruments/resolve-service.ts`: cache-first client batch resolver.

### Modified files

- `app/lib/storage/indexeddb-schema.ts`: add `instrumentMetadata` store and database version 4.
- `app/components/trade-review-workspace.tsx`: refresh stale metadata with single-stock data updates.

### Tests and frozen fixtures

- `app/lib/instruments/metadata-contracts.test.ts`
- `app/lib/instruments/providers/metadata-providers.test.ts`
- `app/lib/instruments/providers/metadata-router.test.ts`
- `app/api/instruments/resolve/route.test.ts`
- `app/lib/storage/indexeddb-instrument-metadata-repository.test.ts`
- `app/lib/instruments/resolve-service.test.ts`
- `app/components/trade-review-workspace.test.tsx`
- `app/lib/instruments/providers/__fixtures__/nasdaqlisted.txt`
- `app/lib/instruments/providers/__fixtures__/otherlisted.txt`
- `app/lib/instruments/providers/__fixtures__/hkex-securities.json`
- `app/lib/instruments/providers/__fixtures__/provider-responses.ts`

## Task 1: Define the metadata contract and canonical request policy

**Files:**
- Create: `app/lib/instruments/metadata-contracts.ts`
- Create: `app/lib/instruments/metadata-contracts.test.ts`
- Create: `app/lib/instruments/asset-classification.ts`
- Create: `app/lib/instruments/metadata-request-policy.ts`
- Test: `app/lib/instruments/metadata-contracts.test.ts`

**Interfaces:**
- Consumes: `canonicalInstrumentId(symbol, market)` and `canonicalInstrumentSymbol(symbol, market)` from `app/lib/instruments/display-name.ts`.
- Produces: `InstrumentLookup`, `ResolvedInstrument`, `InstrumentMetadataSource`, `InstrumentMetadataFailure`, `parseInstrumentLookup(url)`, `validateResolvedInstrument(value, lookup)`, and `classifyExchangeTradedAsset(lookup, sourceName)`.

- [ ] **Step 1: Write failing contract and request-policy tests**

```ts
import { describe, expect, it } from "vitest";
import {
  validateResolvedInstrument,
  type InstrumentLookup,
} from "./metadata-contracts";
import {
  InvalidInstrumentLookup,
  parseInstrumentLookup,
} from "./metadata-request-policy";

describe("instrument metadata contracts", () => {
  const lookup: InstrumentLookup = { market: "HK", symbol: "700" };

  it("accepts a matching stock or ETF result", () => {
    expect(
      validateResolvedInstrument(
        {
          market: "HK",
          symbol: "700",
          name: "腾讯控股",
          assetType: "stock",
          source: "tencent",
          confidence: "portal",
          resolvedAt: "2026-07-29T00:00:00.000Z",
        },
        lookup,
      ).name,
    ).toBe("腾讯控股");
  });

  it("rejects a mismatched code, blank name, or unsupported type", () => {
    expect(() =>
      validateResolvedInstrument(
        {
          market: "HK",
          symbol: "9988",
          name: " ",
          assetType: "bond",
          source: "tencent",
          confidence: "portal",
          resolvedAt: "2026-07-29T00:00:00.000Z",
        },
        lookup,
      ),
    ).toThrow();
  });

  it("normalizes route input and rejects unsupported markets", () => {
    expect(
      parseInstrumentLookup(
        new URL("https://example.test/api/instruments/resolve?market=HK&symbol=00700"),
      ),
    ).toEqual({ market: "HK", symbol: "700" });
    expect(() =>
      parseInstrumentLookup(
        new URL("https://example.test/api/instruments/resolve?market=JP&symbol=7203"),
      ),
    ).toThrow(InvalidInstrumentLookup);
  });

  it("classifies only audited A-share stock and ETF code families", () => {
    expect(
      classifyExchangeTradedAsset(
        { market: "CN-SH", symbol: "600519" },
        "贵州茅台",
      ),
    ).toBe("stock");
    expect(
      classifyExchangeTradedAsset(
        { market: "CN-SZ", symbol: "159915" },
        "创业板ETF",
      ),
    ).toBe("etf");
    expect(
      classifyExchangeTradedAsset(
        { market: "CN-SH", symbol: "113703" },
        "翔26转债",
      ),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- app/lib/instruments/metadata-contracts.test.ts`

Expected: FAIL because the contract and request-policy modules do not exist.

- [ ] **Step 3: Implement the exact domain types and validators**

```ts
export type InstrumentLookup = {
  market: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol: string;
};

export type InstrumentAssetType = "stock" | "etf";
export type InstrumentMetadataSource =
  | "statement"
  | "nasdaq"
  | "sec"
  | "hkex"
  | "tencent"
  | "eastmoney"
  | "sina";
export type InstrumentMetadataConfidence =
  | "statement"
  | "official"
  | "portal";

export type ResolvedInstrument = InstrumentLookup & {
  name: string;
  assetType: InstrumentAssetType;
  source: InstrumentMetadataSource;
  confidence: InstrumentMetadataConfidence;
  resolvedAt: string;
};

export type InstrumentMetadataFailure = InstrumentLookup & {
  attempts: Array<{
    source: Exclude<InstrumentMetadataSource, "statement">;
    code: string;
    message: string;
  }>;
};
```

Implement `validateResolvedInstrument` so it canonicalizes both symbols, rejects names equal to the code, rejects non-stock/ETF values, and returns a normalized copy. Implement `parseInstrumentLookup` using the existing display-name canonicalizers and a strict symbol length/character policy.

Implement `classifyExchangeTradedAsset` as an explicit allowlist of tested
Shanghai/Shenzhen stock and ETF code families. Check bond/repo name and code
families first and return `undefined`; never treat an unknown code family as a
stock. Portal providers may use this classifier only when their response code
and name already match the request.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:unit -- app/lib/instruments/metadata-contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add app/lib/instruments/metadata-contracts.ts app/lib/instruments/metadata-contracts.test.ts app/lib/instruments/metadata-request-policy.ts app/lib/instruments/asset-classification.ts
git commit -m "feat: define instrument metadata contract"
```

## Task 2: Add a durable IndexedDB metadata cache

**Files:**
- Modify: `app/lib/storage/indexeddb-schema.ts`
- Create: `app/lib/storage/instrument-metadata-repository.ts`
- Create: `app/lib/storage/indexeddb-instrument-metadata-repository.ts`
- Create: `app/lib/storage/indexeddb-instrument-metadata-repository.test.ts`

**Interfaces:**
- Consumes: `ResolvedInstrument` from Task 1.
- Produces: `InstrumentMetadataRepository.get(instrumentId)`, `.put(record)`, and `.getMany(instrumentIds)`.

- [ ] **Step 1: Write failing cache and database-upgrade tests**

```ts
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbInstrumentMetadataRepository } from "./indexeddb-instrument-metadata-repository";

describe("IndexedDbInstrumentMetadataRepository", () => {
  it("round-trips one canonical metadata record", async () => {
    const repository = new IndexedDbInstrumentMetadataRepository(
      `metadata-${crypto.randomUUID()}`,
    );
    await repository.put({
      market: "US",
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      assetType: "etf",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    });
    await expect(repository.get("US:SPY")).resolves.toMatchObject({
      name: "SPDR S&P 500 ETF Trust",
      assetType: "etf",
    });
  });

  it("upgrades version three without losing existing stores", async () => {
    const databaseName = `metadata-upgrade-${crypto.randomUUID()}`;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 3);
      request.onupgradeneeded = () => {
        for (const name of [
          "dailyCandles",
          "coverage",
          "providerSymbols",
          "reviews",
          "tagSuggestions",
        ]) {
          request.result.createObjectStore(name);
        }
        request.transaction
          ?.objectStore("reviews")
          .put({ version: 1 }, "saved-review");
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const database = await openTradeReviewDatabase(databaseName);
    expect([...database.objectStoreNames]).toEqual(
      expect.arrayContaining([
        "dailyCandles",
        "coverage",
        "providerSymbols",
        "reviews",
        "tagSuggestions",
        "instrumentMetadata",
      ]),
    );
    const review = await requestValue(
      database.transaction("reviews").objectStore("reviews").get("saved-review"),
    );
    expect(review).toEqual({ version: 1 });
    database.close();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:unit -- app/lib/storage/indexeddb-instrument-metadata-repository.test.ts`

Expected: FAIL because the repository and store do not exist.

- [ ] **Step 3: Add database version 4 and the repository**

Update the schema constants:

```ts
export const DATABASE_VERSION = 4;
export const INSTRUMENT_METADATA = "instrumentMetadata";
```

Create the store in `onupgradeneeded`:

```ts
if (!database.objectStoreNames.contains(INSTRUMENT_METADATA)) {
  database.createObjectStore(INSTRUMENT_METADATA, {
    keyPath: "instrumentId",
  });
}
```

Store records as:

```ts
export type StoredInstrumentMetadata = ResolvedInstrument & {
  instrumentId: string;
};

export interface InstrumentMetadataRepository {
  get(instrumentId: string): Promise<ResolvedInstrument | undefined>;
  getMany(instrumentIds: string[]): Promise<Map<string, ResolvedInstrument>>;
  put(record: ResolvedInstrument): Promise<void>;
}
```

Use `canonicalInstrumentId` inside `.put()` and `requestValue`/`transactionDone` from `indexeddb-schema.ts`.

- [ ] **Step 4: Run storage tests and verify GREEN**

Run: `npm run test:unit -- app/lib/storage/indexeddb-instrument-metadata-repository.test.ts app/lib/storage/indexeddb-episode-review-repository.test.ts app/lib/storage/indexeddb-tag-suggestion-repository.test.ts`

Expected: PASS, including all upgrade tests.

- [ ] **Step 5: Commit the cache**

```bash
git add app/lib/storage/indexeddb-schema.ts app/lib/storage/instrument-metadata-repository.ts app/lib/storage/indexeddb-instrument-metadata-repository.ts app/lib/storage/indexeddb-instrument-metadata-repository.test.ts
git commit -m "feat: cache instrument metadata in indexeddb"
```

## Task 3: Implement portal metadata provider parsers

**Files:**
- Create: `app/lib/instruments/providers/metadata-errors.ts`
- Create: `app/lib/instruments/providers/tencent-metadata.ts`
- Create: `app/lib/instruments/providers/eastmoney-metadata.ts`
- Create: `app/lib/instruments/providers/sina-metadata.ts`
- Create: `app/lib/instruments/providers/__fixtures__/provider-responses.ts`
- Create: `app/lib/instruments/providers/metadata-providers.test.ts`

**Interfaces:**
- Consumes: `InstrumentLookup` and `ResolvedInstrument` from Task 1.
- Produces: providers with `id`, `supports(lookup)`, and `resolve(lookup, fetcher)`; parsers remain exported for frozen-fixture tests.

- [ ] **Step 1: Write failing frozen-response tests**

```ts
import { describe, expect, it } from "vitest";
import {
  parseTencentMetadata,
  TencentMetadataProvider,
} from "./tencent-metadata";
import { parseEastmoneyMetadata } from "./eastmoney-metadata";
import { parseSinaMetadata } from "./sina-metadata";

describe("portal metadata providers", () => {
  it("parses Tencent stock and ETF responses with matching codes", () => {
    expect(parseTencentMetadata(TENCENT_HK_700, { market: "HK", symbol: "700" }))
      .toMatchObject({ name: "腾讯控股", assetType: "stock" });
    expect(parseTencentMetadata(TENCENT_SZ_159915, {
      market: "CN-SZ",
      symbol: "159915",
    })).toMatchObject({ name: "创业板ETF易方达", assetType: "etf" });
  });

  it("rejects HTML, blank names, and code mismatches", () => {
    expect(() =>
      parseEastmoneyMetadata("<html>blocked</html>", {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toThrow("无法解析");
    expect(() =>
      parseSinaMetadata(SINA_OTHER_CODE, {
        market: "US",
        symbol: "AAPL",
      }),
    ).toThrow("代码不匹配");
  });
});
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `npm run test:unit -- app/lib/instruments/providers/metadata-providers.test.ts`

Expected: FAIL because provider modules and fixtures do not exist.

- [ ] **Step 3: Implement providers with strict response validation**

Define:

```ts
export interface InstrumentMetadataProvider {
  readonly id: Exclude<InstrumentMetadataSource, "statement">;
  supports(lookup: InstrumentLookup): boolean;
  resolve(
    lookup: InstrumentLookup,
    fetcher?: typeof fetch,
  ): Promise<ResolvedInstrument>;
}
```

Implementation requirements:

- Tencent: map `sh`, `sz`, `hk` padded to five digits, and `us`; decode the response explicitly; verify returned symbol and classify only `GP`/stock or `ETF`.
- Eastmoney: map `1`, `0`, `116`, and supported US market IDs; request `f57,f58,f107`; reject `data=null`; for A shares use the audited Task 1 classifier when no explicit type is returned.
- Sina: set `Referer: https://finance.sina.com.cn/`; map `sh`, `sz`, `rt_hk`, and `gb_`; validate the response variable and symbol; for A shares use the same audited classifier.
- Map HTTP 403/429/timeouts/invalid response into `InstrumentMetadataProviderError` codes.
- Never return a result with an inferred asset type unless the source response includes type evidence; return `no-data` so a later provider can decide.

- [ ] **Step 4: Run the provider test and verify GREEN**

Run: `npm run test:unit -- app/lib/instruments/providers/metadata-providers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit portal providers**

```bash
git add app/lib/instruments/providers/metadata-errors.ts app/lib/instruments/providers/tencent-metadata.ts app/lib/instruments/providers/eastmoney-metadata.ts app/lib/instruments/providers/sina-metadata.ts app/lib/instruments/providers/__fixtures__/provider-responses.ts app/lib/instruments/providers/metadata-providers.test.ts
git commit -m "feat: add no-key metadata providers"
```

## Task 4: Implement official US and HK catalogs

**Files:**
- Create: `app/lib/instruments/providers/nasdaq-directory.ts`
- Create: `app/lib/instruments/providers/hkex-directory.ts`
- Create: `app/lib/instruments/providers/sec-company-tickers.ts`
- Create: `app/lib/instruments/providers/__fixtures__/nasdaqlisted.txt`
- Create: `app/lib/instruments/providers/__fixtures__/otherlisted.txt`
- Create: `app/lib/instruments/providers/__fixtures__/hkex-securities.json`
- Modify: `app/lib/instruments/providers/metadata-providers.test.ts`

**Interfaces:**
- Consumes: `InstrumentMetadataProvider` from Task 3.
- Produces: `NasdaqDirectoryProvider`, `HkexDirectoryProvider`, and `SecCompanyTickersProvider`.

- [ ] **Step 1: Add failing catalog parser tests**

```ts
it("merges Nasdaq-listed and other-listed stock/ETF rows", () => {
  const directory = parseNasdaqDirectories(NASDAQ_LISTED, OTHER_LISTED);
  expect(directory.get("AAPL")).toMatchObject({
    assetType: "stock",
    source: "nasdaq",
  });
  expect(directory.get("SPY")).toMatchObject({
    assetType: "etf",
    source: "nasdaq",
  });
  expect(directory.has("ZVZZT")).toBe(false);
});

it("accepts only HK equities and ETFs from the official list", () => {
  const directory = parseHkexRows(HKEX_ROWS);
  expect(directory.get("00700")?.assetType).toBe("stock");
  expect(directory.get("02800")?.assetType).toBe("etf");
  expect(directory.has("convertible-bond-row")).toBe(false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/instruments/providers/metadata-providers.test.ts`

Expected: FAIL because official catalog parsers do not exist.

- [ ] **Step 3: Implement daily-cached official providers**

Use module-level promises to coalesce concurrent catalog downloads and a
`CatalogCache` adapter backed by the Cloudflare Cache API to respect a
24-hour freshness boundary across requests:

```ts
type CatalogSnapshot<T> = { loadedAt: number; value: T };
let snapshot: CatalogSnapshot<Map<string, ResolvedInstrument>> | undefined;
let inFlight: Promise<Map<string, ResolvedInstrument>> | undefined;

export interface CatalogCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}
```

Requirements:

- Nasdaq: fetch `nasdaqlisted.txt` and `otherlisted.txt`, parse pipe-delimited headers by name, exclude `Test Issue=Y`, classify `ETF=Y`.
- HKEX: fetch `ListOfSecurities.xlsx`, parse with SheetJS, normalize `Stock Code` to five digits, admit equity rows and rows explicitly categorized as ETF.
- SEC: fetch `company_tickers_exchange.json` with an identifying `User-Agent`; return only `stock`, never claim ETF coverage.
- Cache successful raw official files for 86,400 seconds and revalidate after expiry; tests inject an in-memory `CatalogCache`.
- Official names may be English. Portal localization is optional and must not replace a valid official identity with an unvalidated response.
- Expose a test-only constructor argument for clock/fetch injection instead of mutating global time.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:unit -- app/lib/instruments/providers/metadata-providers.test.ts`

Expected: PASS, including a test proving two same-day lookups download each official catalog once.

- [ ] **Step 5: Commit official catalogs**

```bash
git add app/lib/instruments/providers/nasdaq-directory.ts app/lib/instruments/providers/hkex-directory.ts app/lib/instruments/providers/sec-company-tickers.ts app/lib/instruments/providers/__fixtures__ app/lib/instruments/providers/metadata-providers.test.ts
git commit -m "feat: resolve instruments from official catalogs"
```

## Task 5: Add the server router and public API

**Files:**
- Create: `app/lib/instruments/providers/metadata-router.ts`
- Create: `app/lib/instruments/providers/metadata-router.test.ts`
- Create: `app/api/instruments/resolve/route.ts`
- Create: `app/api/instruments/resolve/route.test.ts`

**Interfaces:**
- Consumes: provider classes from Tasks 3-4 and `parseInstrumentLookup` from Task 1.
- Produces: `createMetadataRouter(fetcher, clock).resolve(lookup)` and `GET(request)`.

- [ ] **Step 1: Write failing fallback-order and route tests**

```ts
it("uses the market-specific order and returns all failed attempts", async () => {
  const router = createMetadataRouter(fetcher, clock, {
    US: [failingNasdaq, successfulTencent],
  });
  await expect(
    router.resolve({ market: "US", symbol: "NVDA" }),
  ).resolves.toMatchObject({ source: "tencent", name: "英伟达" });
});

it("never forwards statement data", async () => {
  const response = await GET(
    new Request(
      "http://localhost/api/instruments/resolve?market=HK&symbol=00700",
    ),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    market: "HK",
    symbol: "700",
    name: "腾讯控股",
  });
});
```

Also test 400 invalid request, 404 all providers no-data, 429 request throttling, provider timeout, and `Cache-Control`.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/instruments/providers/metadata-router.test.ts app/api/instruments/resolve/route.test.ts`

Expected: FAIL because router and route do not exist.

- [ ] **Step 3: Implement fallback order and route controls**

Order:

```ts
const providerOrder = {
  "CN-SH": [tencent, eastmoney, sina],
  "CN-SZ": [tencent, eastmoney, sina],
  HK: [hkex, tencent, eastmoney, sina],
  US: [nasdaq, tencent, sec, sina],
} satisfies Record<SupportedMarket, InstrumentMetadataProvider[]>;
```

The route must:

- parse only `market` and `symbol`;
- use the existing route pattern for per-client rate limiting;
- abort the full chain after 12 seconds;
- return successful results with `Cache-Control: public, max-age=21600, stale-while-revalidate=86400`;
- return a sanitized attempts list without raw provider bodies;
- never log query parameters beyond canonical instrument ID.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:unit -- app/lib/instruments/providers/metadata-router.test.ts app/api/instruments/resolve/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the route**

```bash
git add app/lib/instruments/providers/metadata-router.ts app/lib/instruments/providers/metadata-router.test.ts app/api/instruments/resolve/route.ts app/api/instruments/resolve/route.test.ts
git commit -m "feat: expose instrument metadata resolver"
```

## Task 6: Implement cache-first client batch resolution

**Files:**
- Create: `app/lib/instruments/resolve-service.ts`
- Create: `app/lib/instruments/resolve-service.test.ts`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`

**Interfaces:**
- Consumes: `InstrumentMetadataRepository` from Task 2 and `/api/instruments/resolve` from Task 5.
- Produces: `resolveInstrumentMetadataBatch(lookups, options)` and `refreshInstrumentMetadata(lookup, options)`.

- [ ] **Step 1: Write failing cache-first and concurrency tests**

```ts
function memoryRepository(seed: ResolvedInstrument[] = []) {
  const records = new Map(
    seed.map((record) => [
      canonicalInstrumentId(record.symbol, record.market),
      record,
    ]),
  );
  return {
    get: vi.fn(async (instrumentId: string) => records.get(instrumentId)),
    getMany: vi.fn(async (instrumentIds: string[]) =>
      new Map(
        instrumentIds.flatMap((instrumentId) => {
          const record = records.get(instrumentId);
          return record ? [[instrumentId, record] as const] : [];
        }),
      ),
    ),
    put: vi.fn(async (record: ResolvedInstrument) => {
      records.set(
        canonicalInstrumentId(record.symbol, record.market),
        record,
      );
    }),
  };
}

it("returns cached records without network requests", async () => {
  const fetcher = vi.fn();
  const seededRepository = memoryRepository([
    {
      market: "HK",
      symbol: "700",
      name: "腾讯控股",
      assetType: "stock",
      source: "hkex",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    },
  ]);
  const result = await resolveInstrumentMetadataBatch(
    [
      { market: "HK", symbol: "700" },
      { market: "HK", symbol: "00700" },
    ],
    { repository: seededRepository, fetcher, concurrency: 3 },
  );
  expect(result.resolved.size).toBe(1);
  expect(fetcher).not.toHaveBeenCalled();
});

it("deduplicates lookups, caps concurrency, and caches successes", async () => {
  let active = 0;
  let maximumActive = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    const url = new URL(String(input), "http://localhost");
    const symbol = url.searchParams.get("symbol") ?? "";
    return Response.json({
      market: "US",
      symbol,
      name: `${symbol} Incorporated`,
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2026-07-29T00:00:00.000Z",
    });
  });
  const repository = memoryRepository();
  const result = await resolveInstrumentMetadataBatch(
    ["AAPL", "MSFT", "NVDA", "META", "AAPL"].map((symbol) => ({
      market: "US" as const,
      symbol,
    })),
    { repository, fetcher, concurrency: 3 },
  );
  expect(result.resolved.size).toBe(4);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(repository.put).toHaveBeenCalledTimes(4);
  expect(maximumActive).toBeLessThanOrEqual(3);
});

it("preserves attempts for unresolved instruments", async () => {
  const fetcher = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "unresolved",
          attempts: [
            {
              source: "nasdaq",
              code: "no-data",
              message: "未找到证券",
            },
          ],
        },
      },
      { status: 404 },
    ),
  );
  const result = await resolveInstrumentMetadataBatch(
    [{ market: "US", symbol: "BROKEN" }],
    { repository: memoryRepository(), fetcher },
  );
  expect(result.unresolved.get("US:BROKEN")).toMatchObject({
    symbol: "BROKEN",
    attempts: [{ source: "nasdaq", code: "no-data" }],
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/instruments/resolve-service.test.ts`

Expected: FAIL because the client service does not exist.

- [ ] **Step 3: Implement the batch service**

Use:

```ts
export type ResolveBatchResult = {
  resolved: Map<string, ResolvedInstrument>;
  unresolved: Map<string, InstrumentMetadataFailure>;
  cacheHits: number;
};

export async function resolveInstrumentMetadataBatch(
  lookups: InstrumentLookup[],
  options: {
    repository: InstrumentMetadataRepository;
    fetcher?: typeof fetch;
    concurrency?: number;
    forceRefresh?: boolean;
    signal?: AbortSignal;
  },
): Promise<ResolveBatchResult>;
```

Canonicalize and deduplicate before calling `repository.getMany`. Use a worker-pool loop rather than `Promise.all` to enforce the concurrency limit. `forceRefresh` bypasses reads but still overwrites only validated successes.

Update the single-stock market refresh path so it calls `refreshInstrumentMetadata` before or alongside `syncMarketData`; metadata failure must not prevent cached candles from loading.

- [ ] **Step 4: Run focused and workspace tests**

Run: `npm run test:unit -- app/lib/instruments/resolve-service.test.ts app/components/trade-review-workspace.test.tsx`

Expected: PASS; the existing cache-first K-line assertions remain green.

- [ ] **Step 5: Run plan-wide verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit -- app/lib/instruments app/lib/storage/indexeddb-instrument-metadata-repository.test.ts app/api/instruments/resolve/route.test.ts app/components/trade-review-workspace.test.tsx
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the client service**

```bash
git add app/lib/instruments/resolve-service.ts app/lib/instruments/resolve-service.test.ts app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx
git commit -m "feat: resolve instrument metadata cache first"
```

## Self-Review Checklist

- Spec coverage: contract, four markets, official US/HK catalogs, three portal fallbacks, browser cache, server controls, single-stock refresh, no-key behavior, and failure attempts each map to a task.
- Privacy: the API contract has no file, account, execution, quantity, price, fee, or date fields.
- Placeholder scan: implementation steps define concrete files, signatures, test cases, provider order, commands, and expected outcomes.
- Type consistency: Tasks 2-6 consistently consume `InstrumentLookup`, `ResolvedInstrument`, `InstrumentMetadataFailure`, and `InstrumentMetadataRepository` defined in Tasks 1-2.
