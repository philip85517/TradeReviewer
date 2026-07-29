# Multi-Broker Statement Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import Futu XLSX, Tiger PDF, and China Merchants Securities PDF through one local-only browser workflow, keeping only fully identified stock and ETF executions.

**Architecture:** A content-based dispatcher selects one focused broker parser. PDF.js extracts positioned text locally; Tiger and China Merchants parsers convert frozen table layouts into the same `TradeExecution` model as Futu, while an enrichment stage calls the metadata batch service from the prerequisite plan. The preview separates importable, duplicate, excluded, and unresolved instruments before persisting complete records and triggering gap-only market-data sync.

**Tech Stack:** TypeScript 5.9, React 19, Next 16, Vitest 4, Testing Library, Decimal.js, SheetJS, `pdfjs-dist`, IndexedDB/localStorage.

## Global Constraints

- Prerequisite: complete `2026-07-29-instrument-metadata-resolution.md`.
- Statement files and execution contents are parsed in the browser and never uploaded.
- One import entry accepts `.xlsx`, `.xls`, and `.pdf`; users never select a broker.
- Supported sources are Futu XLSX, Tiger PDF, and China Merchants Securities PDF.
- Only stocks and ETFs enter the trade library.
- Funds, FX, convertible bonds, repos, cash, dividends, interest, subscriptions, allotments, and unknown asset types are excluded.
- Security name input fields are removed; codes never masquerade as names.
- Tiger short opening/closing must create correct short episodes.
- China Merchants date-only rows preserve source order and never claim a precise time.
- Identical legitimate fills are preserved; only broker-layout duplicate rows and cross-file duplicate occurrences are collapsed.
- Existing cached instrument metadata and candles are preferred; only missing K-line ranges are fetched.

---

## File Map

### New files

- `app/lib/import/contracts.ts`: broker parser, statement input, candidate, exclusion, and time-precision contracts.
- `app/lib/import/file-fingerprint.ts`: stable browser file fingerprint shared by XLSX/PDF parsers.
- `app/lib/import/pdf-text.ts`: local PDF.js positioned-text extraction.
- `app/lib/import/pdf-layout.ts`: row/column grouping helpers independent of broker semantics.
- `app/lib/import/tiger.ts`: Tiger detection and parser.
- `app/lib/import/china-merchants.ts`: China Merchants detection and parser.
- `app/lib/import/dispatcher.ts`: content-based format selection.
- `app/lib/import/enrich-import.ts`: metadata enrichment and stock/ETF filtering.
- `app/lib/import/__fixtures__/tiger-pages.ts`: minimal positioned, anonymized Tiger fixture.
- `app/lib/import/__fixtures__/china-merchants-pages.ts`: minimal positioned, anonymized CMS fixture.
- `app/lib/import/pdf-layout.test.ts`
- `app/lib/import/tiger.test.ts`
- `app/lib/import/china-merchants.test.ts`
- `app/lib/import/dispatcher.test.ts`
- `app/lib/import/enrich-import.test.ts`

### Modified files

- `package.json` and lockfile: add pinned `pdfjs-dist`.
- `app/lib/trades/types.ts`: add source page, source order, and time precision.
- `app/lib/import/futu.ts`: implement common parser output and remove manual-name dependency.
- `app/lib/import/futu.test.ts`
- `app/lib/import/import-result.ts`: richer candidates/exclusions and source identity.
- `app/lib/import/import-preview.ts`: async enrichment-aware preview categories.
- `app/lib/import/import-preview.test.ts`
- `app/lib/storage/import-library.ts`: preserve date-only ordering and best resolved metadata.
- `app/lib/storage/import-library.test.ts`
- `app/components/review/episode-sidebar.tsx`: accept PDF and show phased progress.
- `app/components/import/import-confirm-dialog.tsx`: remove input and show categorized outcomes.
- `app/components/import/import-confirm-dialog.test.tsx`
- `app/components/trade-review-workspace.tsx`: dispatch, enrich, retry unresolved, persist complete records.
- `app/components/trade-review-workspace.test.tsx`
- `app/globals.css`: progress and categorized preview states.

## Task 1: Establish common import contracts and date precision

**Files:**
- Create: `app/lib/import/contracts.ts`
- Create: `app/lib/import/file-fingerprint.ts`
- Modify: `app/lib/trades/types.ts`
- Modify: `app/lib/import/import-result.ts`
- Modify: `app/lib/storage/import-library.ts`
- Modify: `app/lib/storage/import-library.test.ts`

**Interfaces:**
- Consumes: existing `TradeExecution`, `ImportDiagnostic`, and canonical instrument helpers.
- Produces: `StatementInput`, `StatementParseResult`, `ParsedInstrumentCandidate`, `ImportExclusion`, `BrokerStatementParser`, `TradeTimePrecision`, and `fingerprintBytes`.

- [ ] **Step 1: Write failing contract/order/storage tests**

```ts
it("preserves date-only source order for same-day executions", () => {
  const laterSourceRow = execution({
    id: "cms:b",
    executedAt: "2026-02-24T07:00:00.000Z",
    source: { platform: "china-merchants", row: 12, timePrecision: "date-only" },
  });
  const earlierSourceRow = execution({
    id: "cms:a",
    executedAt: "2026-02-24T07:00:00.000Z",
    source: { platform: "china-merchants", row: 11, timePrecision: "date-only" },
  });
  expect(mergeExecutions([], [laterSourceRow, earlierSourceRow]).map(x => x.id))
    .toEqual(["cms:a", "cms:b"]);
});
```

Add a fingerprint test proving identical bytes return the same ID and one changed byte returns a different ID.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/storage/import-library.test.ts app/lib/import/file-fingerprint.test.ts`

Expected: FAIL because new source fields and fingerprint helper do not exist.

- [ ] **Step 3: Define contracts and minimal storage changes**

Extend execution source:

```ts
export type TradeTimePrecision = "second" | "date-only";

source: {
  platform: string;
  sheet?: string;
  page?: number;
  row: number;
  sourceOrder?: number;
  timePrecision?: TradeTimePrecision;
  fileName?: string;
  fileFingerprint?: string;
  sourceTimestampText?: string;
  sourceTimezone?: string;
};
```

Define:

```ts
export type ParsedInstrumentCandidate = {
  market: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol: string;
  sourceName?: string;
  sourceAssetType?: "stock" | "etf" | "unknown";
};

export type ImportExclusion = {
  category:
    | "fund"
    | "fx"
    | "bond"
    | "repo"
    | "cash"
    | "corporate-action"
    | "subscription"
    | "unknown-asset"
    | "invalid-row";
  label: string;
  count: number;
  instrumentSymbol?: string;
};

export type StatementParseResult = {
  broker: "futu" | "tiger" | "china-merchants";
  records: TradeExecution[];
  candidates: ParsedInstrumentCandidate[];
  exclusions: ImportExclusion[];
  diagnostics: ImportDiagnostic[];
  blocked: boolean;
};
```

Make `fingerprintBytes` the single stable byte-hash implementation and update merge sorting to use `executedAt`, `sourceOrder ?? row`, then `id`.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:unit -- app/lib/storage/import-library.test.ts app/lib/import/file-fingerprint.test.ts app/lib/trades/episodes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit common contracts**

```bash
git add app/lib/import/contracts.ts app/lib/import/file-fingerprint.ts app/lib/import/file-fingerprint.test.ts app/lib/trades/types.ts app/lib/import/import-result.ts app/lib/storage/import-library.ts app/lib/storage/import-library.test.ts
git commit -m "refactor: define broker statement import contracts"
```

## Task 2: Add local positioned PDF extraction

**Files:**
- Modify: `package.json`
- Modify: lockfile
- Create: `app/lib/import/pdf-text.ts`
- Create: `app/lib/import/pdf-layout.ts`
- Create: `app/lib/import/pdf-layout.test.ts`

**Interfaces:**
- Consumes: browser `ArrayBuffer`.
- Produces: `extractPdfPages(input)`, `PdfTextPage`, `PdfTextItem`, `groupItemsIntoRows(items, tolerance)`, and `cellsForColumns(row, boundaries)`.

- [ ] **Step 1: Install the pinned PDF.js dependency**

Run: `npm install pdfjs-dist@6.1.200`

Expected: `package.json` and `package-lock.json` contain exactly `pdfjs-dist@6.1.200`.

- [ ] **Step 2: Write failing layout tests**

```ts
it("groups text items by y and sorts cells from left to right", () => {
  const rows = groupItemsIntoRows(
    [
      { text: "买入", x: 300, y: 500, width: 20, height: 10 },
      { text: "00700", x: 100, y: 500.4, width: 30, height: 10 },
      { text: "100", x: 400, y: 500.2, width: 20, height: 10 },
    ],
    1,
  );
  expect(rows[0].items.map(item => item.text)).toEqual([
    "00700",
    "买入",
    "100",
  ]);
});

it("assigns wrapped items to stable table columns", () => {
  expect(cellsForColumns(row, [0, 200, 350, 500])).toEqual([
    "小米集团-W 01810",
    "开仓做空",
    "-800",
  ]);
});
```

- [ ] **Step 3: Run and verify RED**

Run: `npm run test:unit -- app/lib/import/pdf-layout.test.ts`

Expected: FAIL because layout helpers do not exist.

- [ ] **Step 4: Implement browser-only extraction and pure layout helpers**

```ts
export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfTextPage = {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};
```

In `extractPdfPages`, dynamically import `pdfjs-dist`, set:

```ts
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
```

Use `getDocument({ data: new Uint8Array(input) })`; map each text item through the viewport transform. Keep all broker semantics out of `pdf-text.ts` and `pdf-layout.ts`.

- [ ] **Step 5: Run and verify GREEN**

Run: `npm run test:unit -- app/lib/import/pdf-layout.test.ts`

Expected: PASS.

- [ ] **Step 6: Verify browser bundling and commit**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0 and PDF.js worker is bundled without Node-only module errors.

```bash
git add package.json package-lock.json app/lib/import/pdf-text.ts app/lib/import/pdf-layout.ts app/lib/import/pdf-layout.test.ts
git commit -m "feat: extract statement pdf text locally"
```

## Task 3: Implement the Tiger PDF parser

**Files:**
- Create: `app/lib/import/tiger.ts`
- Create: `app/lib/import/tiger.test.ts`
- Create: `app/lib/import/__fixtures__/tiger-pages.ts`

**Interfaces:**
- Consumes: `PdfTextPage` from Task 2 and common import contracts from Task 1.
- Produces: `TigerStatementParser`, `detectTigerStatement(pages)`, and `parseTigerPages(pages, options)`.

- [ ] **Step 1: Create a minimal anonymized positioned fixture and failing tests**

The fixture must include:

- the `Tiger Brokers (NZ) Limited` heading;
- one HK long buy/sell;
- one HK short opening/closing;
- one US ETF;
- one fund row excluded from the stock section;
- one adjacent duplicate display row with a blank repeated code cell;
- one legitimate identical fill that occurs as a separate named row and must remain.

```ts
it("imports long, short, and ETF rows without doubling display duplicates", () => {
  const result = parseTigerPages(TIGER_PAGES, {
    fileName: "Tiger_2025.pdf",
    fileFingerprint: "tiger-fixture",
  });
  expect(result.broker).toBe("tiger");
  expect(result.records).toHaveLength(5);
  expect(result.records.find(x => x.instrument.symbol === "1810"))
    .toMatchObject({ side: "sell", quantity: "800", price: "51.8" });
  expect(result.exclusions).toContainEqual(
    expect.objectContaining({ category: "fund" }),
  );
});

it("builds a closed short episode from short-open then close", () => {
  const result = parseTigerPages(TIGER_SHORT_PAGES, options);
  const [episode] = buildTradeEpisodes(result.records);
  expect(episode).toMatchObject({
    direction: "short",
    status: "closed",
    openingQuantity: "800",
    remainingQuantity: "0",
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/import/tiger.test.ts`

Expected: FAIL because the Tiger parser does not exist.

- [ ] **Step 3: Implement detection, table parsing, fees, and duplicate-layout collapse**

Detection requires both the broker heading and a stock table header containing code, transaction type, quantity, price, and execution time.

Map explicit direction labels first:

```ts
const SIDE_BY_LABEL: Record<string, TradeSide> = {
  买入: "buy",
  开仓做多: "buy",
  平仓空头: "buy",
  卖出: "sell",
  平仓多头: "sell",
  开仓做空: "sell",
};
```

For generic `开仓` or `平仓`, derive buy/sell from the signed quantity:
positive is buy and negative is sell. Parse timestamps with the timezone
printed in each row. Sum absolute fee components from the fee cell with
`Decimal`. Collapse only an immediately adjacent continuation row with blank
identity cells and an exact match across direction, quantity, price, fee,
timestamp, settlement date, and currency.

- [ ] **Step 4: Run Tiger and episode tests**

Run: `npm run test:unit -- app/lib/import/tiger.test.ts app/lib/trades/episodes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the Tiger parser**

```bash
git add app/lib/import/tiger.ts app/lib/import/tiger.test.ts app/lib/import/__fixtures__/tiger-pages.ts
git commit -m "feat: import tiger pdf statements"
```

## Task 4: Implement the China Merchants Securities PDF parser

**Files:**
- Create: `app/lib/import/china-merchants.ts`
- Create: `app/lib/import/china-merchants.test.ts`
- Create: `app/lib/import/__fixtures__/china-merchants-pages.ts`

**Interfaces:**
- Consumes: `PdfTextPage` and common import contracts.
- Produces: `ChinaMerchantsStatementParser`, `detectChinaMerchantsStatement(pages)`, and `parseChinaMerchantsPages(pages, options)`.

- [ ] **Step 1: Create a minimal anonymized fixture and failing tests**

The fixture must include:

- 流水明细 and 招商证券 markers;
- A-share stock buy/sell;
- A-share ETF buy/sell;
- HK Connect stock buy;
- convertible bond sell;
- repo opening/redemption;
- cash and subscription rows;
- two stock rows on one date with distinct source order.

```ts
it("keeps stock and ETF candidates and categorizes excluded flows", () => {
  const result = parseChinaMerchantsPages(CMS_PAGES, {
    fileName: "招商证券.pdf",
    fileFingerprint: "cms-fixture",
  });
  expect(result.records.map(x => x.instrument.symbol)).toEqual([
    "700",
    "518880",
    "600938",
  ]);
  expect(result.exclusions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ category: "bond" }),
      expect.objectContaining({ category: "repo" }),
      expect.objectContaining({ category: "cash" }),
    ]),
  );
});

it("marks missing times as date-only and keeps source order", () => {
  expect(result.records[0].source.timePrecision).toBe("date-only");
  expect(result.records.map(x => x.source.sourceOrder)).toEqual([0, 1, 2]);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/import/china-merchants.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement market, business-type, and date-only parsing**

Map markets:

```ts
function cmsMarket(label: string, symbol: string) {
  if (label.includes("港股通")) return "HK";
  if (label.includes("上海")) return "CN-SH";
  if (label.includes("深圳")) return "CN-SZ";
  throw new Error(`不支持的招商市场：${label}`);
}
```

Admit only `证券买入` and `证券卖出` as candidates. Categorize known repo/cash/subscription flags before attempting numeric parsing. Identify obvious convertible bonds from metadata evidence first, then fixed exchange code/name rules (`转债`, `发债`, and tested bond code families) and mark them `bond`.

For date-only rows, convert `YYYYMMDD` to a stable local-market instant, set `sourceTimestampText` to the original date, set `sourceTimezone` to `Asia/Shanghai`, set `timePrecision: "date-only"`, and preserve `sourceOrder`.

- [ ] **Step 4: Run CMS tests**

Run: `npm run test:unit -- app/lib/import/china-merchants.test.ts app/lib/storage/import-library.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the CMS parser**

```bash
git add app/lib/import/china-merchants.ts app/lib/import/china-merchants.test.ts app/lib/import/__fixtures__/china-merchants-pages.ts
git commit -m "feat: import china merchants pdf statements"
```

## Task 5: Add format dispatch and metadata enrichment

**Files:**
- Create: `app/lib/import/dispatcher.ts`
- Create: `app/lib/import/dispatcher.test.ts`
- Create: `app/lib/import/enrich-import.ts`
- Create: `app/lib/import/enrich-import.test.ts`
- Modify: `app/lib/import/futu.ts`
- Modify: `app/lib/import/futu.test.ts`

**Interfaces:**
- Consumes: all broker parsers, `extractPdfPages`, and `resolveInstrumentMetadataBatch` from the prerequisite plan.
- Produces: `parseBrokerStatement(file)`, `enrichStatementImport(result, options)`, and `EnrichedImportResult`.

- [ ] **Step 1: Write failing dispatcher and enrichment tests**

```ts
it.each([
  ["futu.xlsx", FUTU_BYTES, "futu"],
  ["tiger.pdf", TIGER_BYTES, "tiger"],
  ["cms.pdf", CMS_BYTES, "china-merchants"],
])("detects %s by content", async (fileName, bytes, broker) => {
  const result = await parseBrokerStatement(
    new File([bytes], fileName),
    {
      extractPdfPages: async () =>
        fileName === "tiger.pdf" ? TIGER_PAGES : CMS_PAGES,
    },
  );
  expect(result.broker).toBe(broker);
});

it("uses statement names, resolves missing names, and excludes non-stock types", async () => {
  const result = await enrichStatementImport(parsed, {
    resolver: fakeResolver,
  });
  expect(result.importable.map(x => x.instrument.name)).toEqual([
    "腾讯控股",
    "SPDR S&P 500 ETF Trust",
  ]);
  expect(result.unresolved).toContainEqual(
    expect.objectContaining({ symbol: "BROKEN" }),
  );
  expect(result.exclusions).toContainEqual(
    expect.objectContaining({ category: "bond" }),
  );
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/import/dispatcher.test.ts app/lib/import/enrich-import.test.ts`

Expected: FAIL because dispatcher and enrichment do not exist.

- [ ] **Step 3: Implement content-based dispatch and enrichment**

Dispatcher requirements:

- inspect XLSX workbook structure for the Futu trade sheet;
- extract PDF pages once, then run Tiger/CMS detectors;
- accept a parser only when exactly one detector reaches the required confidence;
- return a format-level diagnostic when none or multiple match;
- use shared byte fingerprint and never upload the `File`.

Enrichment result:

```ts
export type EnrichedImportResult = {
  broker: StatementParseResult["broker"];
  importable: TradeExecution[];
  unresolved: InstrumentMetadataFailure[];
  exclusions: ImportExclusion[];
  diagnostics: ImportDiagnostic[];
  cacheHits: number;
};
```

Trust a nonblank statement name only when asset type is known as stock/ETF; otherwise resolve both name and type. Apply resolved metadata to every matching execution.

Update Futu to return common candidates/exclusions and use the shared fingerprint. Remove the hardcoded unresolved-name blocker but keep known names as compatible fallback data, not as the primary source of truth.

- [ ] **Step 4: Run parser/enrichment regression tests**

Run:

```bash
npm run test:unit -- app/lib/import/futu.test.ts app/lib/import/tiger.test.ts app/lib/import/china-merchants.test.ts app/lib/import/dispatcher.test.ts app/lib/import/enrich-import.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit dispatch and enrichment**

```bash
git add app/lib/import/dispatcher.ts app/lib/import/dispatcher.test.ts app/lib/import/enrich-import.ts app/lib/import/enrich-import.test.ts app/lib/import/futu.ts app/lib/import/futu.test.ts
git commit -m "feat: dispatch and enrich broker statements"
```

## Task 6: Redesign preview state and confirmation UI

**Files:**
- Modify: `app/lib/import/import-preview.ts`
- Modify: `app/lib/import/import-preview.test.ts`
- Modify: `app/components/import/import-confirm-dialog.tsx`
- Modify: `app/components/import/import-confirm-dialog.test.tsx`
- Modify: `app/components/review/episode-sidebar.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `EnrichedImportResult` from Task 5.
- Produces: categorized `ImportPreview`, `onRetryUnresolved`, and phased import progress UI.

- [ ] **Step 1: Write failing preview and UI tests**

```tsx
it("shows complete names, categorized exclusions, and unresolved retry", async () => {
  render(
    <ImportConfirmDialog
      preview={previewWithResolvedAndUnresolved}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onRetryUnresolved={onRetry}
    />,
  );
  expect(screen.getByText("腾讯控股（700）")).toBeInTheDocument();
  expect(screen.getByText("可转债 2 笔")).toBeInTheDocument();
  expect(screen.getByText("1 个标的暂未导入")).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: /股票名称/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "重新查询" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("accepts xlsx, xls, and pdf from one input", () => {
  render(<EpisodeSidebar {...props} />);
  expect(screen.getByLabelText("导入交易记录")).toHaveAttribute(
    "accept",
    ".xlsx,.xls,.pdf",
  );
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/lib/import/import-preview.test.ts app/components/import/import-confirm-dialog.test.tsx`

Expected: FAIL because preview categories/retry do not exist and the name input is still rendered.

- [ ] **Step 3: Implement categorized preview and remove manual naming**

Preview fields:

```ts
type ImportPreview = {
  id: string;
  fileName: string;
  sourceLabel: string;
  records: TradeExecution[];
  instruments: InstrumentTradeSummary[];
  unresolved: InstrumentMetadataFailure[];
  exclusionGroups: ImportExclusion[];
  tradeCount: number;
  instrumentCount: number;
  duplicateTradeCount: number;
  unresolvedInstrumentCount: number;
  firstTradeAt?: string;
  lastTradeAt?: string;
  blocked: boolean;
};
```

UI requirements:

- delete `onRenameInstrument`, `instrument-name-field`, and all unresolved-name input logic;
- display broker/file, date range, valid executions, stock/ETF count, duplicates, unresolved count, and grouped exclusions;
- list only `name（symbol）` for importable instruments;
- show attempted sources and one `重新查询` action for unresolved instruments;
- allow confirmation when at least one complete instrument exists;
- show progress labels: `识别格式`, `解析成交`, `识别股票`, `补全名称`, `准备行情`.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:unit -- app/lib/import/import-preview.test.ts app/components/import/import-confirm-dialog.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit preview UI**

```bash
git add app/lib/import/import-preview.ts app/lib/import/import-preview.test.ts app/components/import/import-confirm-dialog.tsx app/components/import/import-confirm-dialog.test.tsx app/components/review/episode-sidebar.tsx app/globals.css
git commit -m "feat: confirm categorized statement imports"
```

## Task 7: Integrate the workflow and market-data handoff

**Files:**
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Modify: `app/lib/storage/import-history.ts`
- Modify: `app/lib/storage/import-history.test.ts`
- Modify: `app/lib/storage/import-transaction.ts`
- Modify: `app/lib/storage/import-transaction.test.ts`

**Interfaces:**
- Consumes: dispatcher, enrichment, preview, metadata repository, and existing `syncMarketData`.
- Produces: complete user flow from file selection to persisted import and gap-only market-data updates.

- [ ] **Step 1: Write failing workspace integration tests**

```tsx
const CMS_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

it("imports a recognized PDF without uploading it or asking for names", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  mockDispatcher.mockResolvedValue(cmsParsedResult);
  mockEnrichment.mockResolvedValue(cmsEnrichedResult);
  render(<TradeReviewWorkspace initialFrame={frame} />);
  await user.upload(
    screen.getByLabelText("导入交易记录"),
    new File([CMS_PDF_BYTES], "招商证券.pdf", {
      type: "application/pdf",
    }),
  );
  expect(
    await screen.findByRole("heading", { name: "确认导入交易记录" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: /股票名称/ }))
    .not.toBeInTheDocument();
  expect(fetcher.mock.calls.every(([input]) =>
    !String(input).includes("招商证券.pdf"),
  )).toBe(true);
});

it("persists only complete stock/ETF records and updates new gaps", async () => {
  const syncSpy = vi.spyOn(marketSync, "syncMarketData");
  mockDispatcher.mockResolvedValue(cmsParsedResult);
  mockEnrichment.mockResolvedValue({
    ...cmsEnrichedResult,
    unresolved: [
      {
        market: "CN-SH",
        symbol: "BROKEN",
        attempts: [
          {
            source: "tencent",
            code: "no-data",
            message: "未找到证券",
          },
        ],
      },
    ],
  });
  render(<TradeReviewWorkspace initialFrame={frame} />);
  await user.upload(
    screen.getByLabelText("导入交易记录"),
    new File([CMS_PDF_BYTES], "招商证券.pdf", {
      type: "application/pdf",
    }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "确认导入并开始更新行情",
    }),
  );
  expect(loadImportedExecutions().map(x => x.instrument.id)).toEqual([
    "CN-SH:600938",
  ]);
  expect(syncSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      instrumentId: "CN-SH:600938",
      required: {
        startDate: "2026-02-20",
        endDate: "2026-03-13",
      },
    }),
  );
});

it("retries only unresolved canonical instruments", async () => {
  mockDispatcher.mockResolvedValue(cmsParsedResult);
  mockEnrichment
    .mockResolvedValueOnce({
      ...cmsEnrichedResult,
      unresolved: [
        {
          market: "HK",
          symbol: "99999",
          attempts: [],
        },
      ],
    })
    .mockResolvedValueOnce(cmsEnrichedResult);
  render(<TradeReviewWorkspace initialFrame={frame} />);
  await user.upload(
    screen.getByLabelText("导入交易记录"),
    new File([CMS_PDF_BYTES], "招商证券.pdf", {
      type: "application/pdf",
    }),
  );
  await user.click(
    await screen.findByRole("button", { name: "重新查询" }),
  );
  expect(mockEnrichment).toHaveBeenLastCalledWith(
    cmsParsedResult,
    expect.objectContaining({
      forceRefresh: true,
      onlyInstrumentIds: ["HK:99999"],
    }),
  );
});
```

At the top of the test file, mock `parseBrokerStatement`,
`enrichStatementImport`, and `syncMarketData` with `vi.mock`, and define
`cmsParsedResult`/`cmsEnrichedResult` with one complete `CN-SH:600938`
execution whose required range is the expected range asserted above.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- app/components/trade-review-workspace.test.tsx`

Expected: FAIL because workspace still calls `parseFutuWorkbook` directly.

- [ ] **Step 3: Replace direct Futu parsing with phased dispatch/enrichment**

Implement:

```ts
type ImportPhase =
  | "idle"
  | "detecting"
  | "parsing"
  | "classifying"
  | "resolving"
  | "ready";
```

`parseImport(file)` must:

1. call `parseBrokerStatement(file)`;
2. call `enrichStatementImport`;
3. build the preview;
4. retain the parsed result for unresolved retry;
5. never send the file or raw records to `fetch`.

`confirmImport()` persists only `preview.records`, updates richer import-history counts, selects the first imported instrument, and reuses the existing `requiredRangeExpanded` logic to start only necessary K-line work.

`retryUnresolved()` calls enrichment with `forceRefresh: true` for unresolved candidates only and replaces the preview atomically.

- [ ] **Step 4: Run workspace and persistence tests**

Run:

```bash
npm run test:unit -- app/components/trade-review-workspace.test.tsx app/lib/storage/import-history.test.ts app/lib/storage/import-transaction.test.ts app/lib/storage/import-library.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit workspace integration**

```bash
git add app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx app/lib/storage/import-history.ts app/lib/storage/import-history.test.ts app/lib/storage/import-transaction.ts app/lib/storage/import-transaction.test.ts
git commit -m "feat: integrate multi-broker import workflow"
```

## Task 8: Final privacy, regression, and build verification

**Files:**
- Modify only files implicated by failures from the commands below.

**Interfaces:**
- Consumes: completed Tasks 1-7 and the prerequisite metadata plan.
- Produces: a release-ready branch with no real statement fixtures committed.

- [ ] **Step 1: Scan for manual-name UI and accidental statement fixtures**

Run:

```bash
rg -n "请输入股票名称|onRenameInstrument|名称待行情源补充" app
git ls-files trades '*.pdf' '*.xlsx' '*.xls'
```

Expected: the first command finds no interactive manual-name path; the second finds no real files under `trades` and only explicitly anonymized test fixtures, if any.

- [ ] **Step 2: Run all import, metadata, storage, and episode tests**

Run:

```bash
npm run test:unit -- app/lib/import app/lib/instruments app/lib/storage app/lib/trades/episodes.test.ts app/components/import app/components/trade-review-workspace.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 3: Run static and production checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Expected: every command exits 0.

- [ ] **Step 4: Manually verify in a local production-like browser**

Run: `npm run dev`

Verify:

1. one import control accepts Futu XLSX, Tiger PDF, and CMS PDF;
2. the browser network panel never contains a statement upload;
3. the confirmation dialog shows full names and grouped exclusions;
4. Tiger short episodes display as short;
5. CMS rows display date-only precision;
6. repeated import does not duplicate executions;
7. cached metadata and candles prevent repeated provider requests;
8. single-stock refresh performs only metadata/K-line gap work.

- [ ] **Step 5: Commit any verification-only fixes**

If verification changed files:

```bash
git add app package.json package-lock.json
git commit -m "fix: harden multi-broker import verification"
```

If no files changed, do not create an empty commit.

## Self-Review Checklist

- Spec coverage: all three broker formats, content detection, local PDF extraction, stocks/ETF filtering, short trades, date-only precision, duplicate handling, enrichment, retry, preview categories, persistence, K-line handoff, and privacy verification each map to a task.
- Placeholder scan: every task identifies concrete files, public interfaces, failing tests, implementation rules, commands, expected results, and commit scope.
- Type consistency: `StatementParseResult` flows from parsers to dispatcher; `EnrichedImportResult` flows from enrichment to preview; `ImportPreview.records` is the only persisted execution set.
- Fixture safety: tests require minimal anonymized positioned-text fixtures, never the user’s original statements.
