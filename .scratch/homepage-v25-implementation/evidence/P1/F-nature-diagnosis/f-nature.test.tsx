import "fake-indexeddb/auto";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type AtRule, type Node } from "postcss";

import type { EnrichedImportResult } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/enrich-import";
import type { StatementParseResult } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/contracts";
import { createRecallDocument } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/recall/document";
import type {
  OcrImageResult,
  ScreenshotField,
  ScreenshotInput,
  ScreenshotTradeDraft,
} from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/screenshot/contracts";
import { requiredMarketDataRange } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/market/sync-range";
import type { DemoReplayFrame } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/demo/replay-frame";
import type { EpisodeReviewRecord } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/reviews/types";
import { StorageHttpError, type SqliteHttpClient } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-http-client";
import type { BrowserStatePayload, StorageBootstrap } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-contracts";
import { IndexedDbEpisodeReviewRepository } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/indexeddb-episode-review-repository";
import {
  loadImportedExecutions,
  saveImportedExecutions,
} from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/import-library";
import { loadImportHistory } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/import-history";
import { IndexedDbMarketDataRepository } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/indexeddb-market-data-repository";
import { saveReviewState } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/review-storage";
import { buildTradeEpisodes } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/trades/episodes";
import type { TradeExecution } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/trades/types";
import type { CashBaselineHistoryRecord, CashBaselineStorageState } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/cash/cash-baseline-contracts";
import type { CashBaselineRecord, CashSummary } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/cash/cash-model";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/trades/tradingview-account-identity";
import type { ScreenshotImportDependencies } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/import/use-screenshot-import";
import { tradeRepairClient } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/trade-repair-client";
import {
  accountIdForQualityCheck,
  defaultAccountIdForInstrument,
  TradeReviewWorkspace,
} from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/trade-review-workspace";
import { createLegacySqliteClient } from "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/test-support/legacy-sqlite-client";

const mockSqliteClient = vi.hoisted(() => ({ current: undefined as unknown }));

const mockRecallRepository = vi.hoisted(() => ({
  documents: new Map<string, unknown>(),
  saveError: undefined as Error | undefined,
  loadDelayMs: 0,
}));

const mockBuildIntradaySyncRanges = vi.hoisted(() => vi.fn());
const mockBuildCachedTagSuggestions = vi.hoisted(() => vi.fn());

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/market/intraday-sync-ranges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/market/intraday-sync-ranges")>();
  return {
    ...actual,
    buildIntradaySyncRanges: (...args: Parameters<typeof actual.buildIntradaySyncRanges>) => {
      mockBuildIntradaySyncRanges(...args);
      return actual.buildIntradaySyncRanges(...args);
    },
  };
});

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/insights/tag-suggestion-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/insights/tag-suggestion-cache")>();
  return {
    ...actual,
    buildCachedTagSuggestions: (...args: Parameters<typeof actual.buildCachedTagSuggestions>) => {
      mockBuildCachedTagSuggestions(...args);
      return actual.buildCachedTagSuggestions(...args);
    },
  };
});

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/recall/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/recall/repository")>();
  return {
    ...actual,
    createRecallRepository: () => ({
      load: async (episodeId: string) => {
        if (mockRecallRepository.loadDelayMs) await new Promise(resolve => setTimeout(resolve, mockRecallRepository.loadDelayMs));
        return mockRecallRepository.documents.get(episodeId) ?? null;
      },
      fetch: async (episodeId: string) => mockRecallRepository.documents.get(episodeId) ?? null,
      save: async (document: Record<string, unknown> & { episodeId: string; revision: number }) => {
        if (mockRecallRepository.saveError) throw mockRecallRepository.saveError;
        const saved = { ...document, revision: document.revision + 1 };
        mockRecallRepository.documents.set(document.episodeId, saved);
        return saved;
      },
    }),
  };
});

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-http-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/storage/sqlite-http-client")>()),
  createSqliteHttpClient: () => mockSqliteClient.current,
}));

const globalStyles = postcss.parse(
  readFileSync(join(process.cwd(), "app/globals.css"), "utf8"),
);

function mediaMatches(parent: Node["parent"], viewportWidth: number) {
  let current: Node["parent"] = parent;
  while (current) {
    const atRule = current as AtRule;
    if (current.type === "atrule" && atRule.name === "media") {
      const query = atRule.params;
      const maximum = query.match(/max-width:\s*(\d+)px/);
      const minimum = query.match(/min-width:\s*(\d+)px/);
      if (maximum && viewportWidth > Number(maximum[1])) return false;
      if (minimum && viewportWidth < Number(minimum[1])) return false;
      if (/prefers-reduced-motion/.test(query)) return false;
    }
    current = current.parent;
  }
  return true;
}

function declarationsAt(
  selector: string | string[],
  viewportWidth: number,
) {
  const selectors = Array.isArray(selector) ? selector : [selector];
  const declarations = new Map<string, string>();
  globalStyles.walkRules((rule) => {
    if (
      rule.selectors.some((item) => selectors.includes(item)) &&
      mediaMatches(rule.parent, viewportWidth)
    ) {
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
    }
  });
  return declarations;
}

function reducedMotionDeclarations(selector: string) {
  const declarations = new Map<string, string>();
  globalStyles.walkAtRules("media", (media) => {
    if (!/prefers-reduced-motion:\s*reduce/.test(media.params)) return;
    media.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
    });
  });
  return declarations;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const { mockDispatcher, mockEnrichment, mockMarketDataSync } = vi.hoisted(
  () => ({
    mockDispatcher: vi.fn(),
    mockEnrichment: vi.fn(),
    mockMarketDataSync: vi.fn(),
  }),
);

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/dispatcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/dispatcher")>();
  return {
    ...actual,
    parseBrokerStatement: (...args: Parameters<typeof actual.parseBrokerStatement>) =>
      mockDispatcher.getMockImplementation()
        ? mockDispatcher(...args)
        : actual.parseBrokerStatement(...args),
  };
});

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/enrich-import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/import/enrich-import")>();
  return {
    ...actual,
    enrichStatementImport: (...args: Parameters<typeof actual.enrichStatementImport>) =>
      mockEnrichment.getMockImplementation()
        ? mockEnrichment(...args)
        : actual.enrichStatementImport(...args),
  };
});

vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/market/sync-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/lib/market/sync-service")>();
  return {
    ...actual,
    syncMarketData: (...args: Parameters<typeof actual.syncMarketData>) =>
      mockMarketDataSync.getMockImplementation()
        ? mockMarketDataSync(...args)
        : actual.syncMarketData(...args),
  };
});

const chartProbe = vi.hoisted(() => ({ enabled: false, candles: [] as Array<{ time: string }> }));
vi.mock("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/chart/replay-chart", async importOriginal => {
  const actual = await importOriginal<typeof import("/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/app/components/chart/replay-chart")>();
  return { ...actual, ReplayChart: (props: Parameters<typeof actual.ReplayChart>[0]) => {
    if (chartProbe.enabled) chartProbe.candles = props.candles;
    return <actual.ReplayChart {...props}/>;
  } };
});

const initialFrame: DemoReplayFrame = {
  cursorIndex: 0,
  cursor: "2025-01-02T14:30:00.000Z",
  candles15m: [
    {
      time: "2025-01-02T14:30:00.000Z",
      open: 10,
      high: 10.2,
      low: 9.9,
      close: 10.1,
      volume: 1_000,
    },
  ],
  executions: [],
  canGoBack: false,
  canGoForward: true,
};

const nextFrame: DemoReplayFrame = {
  ...initialFrame,
  cursorIndex: 1,
  cursor: "2025-01-02T14:45:00.000Z",
  candles15m: [
    ...initialFrame.candles15m,
    {
      time: "2025-01-02T14:45:00.000Z",
      open: 10.1,
      high: 10.5,
      low: 10,
      close: 10.4,
      volume: 1_200,
    },
  ],
  canGoBack: true,
};

function defaultEpisodeRecord(
  episodeId: string,
  instrumentId: string,
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt: "2025-01-07T00:00:00.000Z",
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "",
      confidence: null,
    },
    review: {
      decisionQuality: null,
      executionQuality: null,
      riskManagement: "",
      psychology: "",
      reusableRule: "",
      completed: false,
    },
    confirmedTagIds: [],
  };
}

const availabilityInstrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};

function availabilityExecution(input: {
  id: string;
  row: number;
  side: "buy" | "sell";
  executedAt: string;
}): TradeExecution {
  return {
    id: input.id,
    source: { platform: "futu", row: input.row },
    accountId: "acct",
    accountLabel: "富途",
    instrument: availabilityInstrument,
    side: input.side,
    executedAt: input.executedAt,
    quantity: "10",
    price: input.side === "buy" ? "10" : "11",
    fee: "0",
  };
}

function futuImportFile(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "成交时间",
      "账户名称",
      "账户号码",
      "品类",
      "代码名称",
      "交易所/市场",
      "方向",
      "交收日期",
      "币种",
      "数量/面值",
      "价格",
      "成交金额",
      "总费用",
      "变动金额",
    ],
    ...rows,
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "证券-交易流水");
  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
  const file = new File([buffer], "later-xpev-episode.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => buffer,
  });
  return file;
}

type TestUser = ReturnType<typeof userEvent.setup>;

async function openImportManagement(user: TestUser) {
  await waitFor(() => {
    if (
      screen.queryByRole("button", { name: "打开导入与数据管理" }) ||
      screen.queryByRole("button", { name: "导入" }) ||
      screen.queryByLabelText("导入交易记录", { selector: "input" })
    ) {
      return;
    }
    throw new Error("import entry is not ready");
  }, { timeout: 5000 });
  const trigger = screen.queryByRole("button", {
    name: "打开导入与数据管理",
  });
  if (trigger) {
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "导入与数据管理" });
    return;
  }
  const compactImport = screen.queryByRole("button", { name: "导入" });
  if (!compactImport) return;
  if (compactImport.getAttribute("aria-expanded") !== "true") {
    await user.click(compactImport);
  }
}

async function uploadStatement(user: TestUser, file: File) {
  await openImportManagement(user);
  const management = screen.queryByRole("dialog", { name: "导入与数据管理" });
  if (management) {
    await user.click(within(management).getByRole("button", { name: /^导入交易记录/ }));
  } else if (screen.queryByRole("button", { name: "导入" })) {
    await user.click(screen.getByRole("button", { name: "导入记录 · PDF / Excel" }));
  }
  const inputs = screen.getAllByLabelText("导入交易记录", { selector: "input" });
  await user.upload(
    inputs.at(-1)!,
    file,
  );
}

async function uploadScreenshots(user: TestUser, files: File | File[]) {
  await openImportManagement(user);
  const management = screen.queryByRole("dialog", { name: "导入与数据管理" });
  if (management) {
    await user.click(within(management).getByRole("button", { name: /^从截图恢复交易/ }));
  } else if (screen.queryByRole("button", { name: "导入" })) {
    await user.click(screen.getByRole("button", { name: "截图恢复" }));
  }
  const inputs = screen.getAllByLabelText("从截图恢复交易", { selector: "input" });
  await user.upload(
    inputs.at(-1)!,
    files,
  );
}

async function cacheAvailabilityCandles(timestamps: string[]) {
  const repository = new IndexedDbMarketDataRepository();
  await repository.commitIntervalSyncResult({
    instrumentId: availabilityInstrument.id,
    interval: "15m",
    candles: timestamps.map((timestamp) => ({
      instrumentId: availabilityInstrument.id,
      interval: "15m" as const,
      timestamp,
      open: "10",
      high: "11",
      low: "9",
      close: "10.5",
      volume: "1000",
      currency: "USD",
      provider: "yahoo" as const,
      providerSymbol: "XPEV",
      adjustmentMode: "raw" as const,
      fetchedAt: "2025-01-07T00:00:00.000Z",
    })),
    coverage: timestamps.length === 0
      ? []
      : [{
          interval: "15m",
          requestedStart: timestamps[0],
          requestedEnd: timestamps.at(-1) ?? timestamps[0],
          actualStart: timestamps[0],
          actualEnd: timestamps.at(-1) ?? timestamps[0],
          status: "complete",
          provider: "yahoo",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        }],
    providerSymbol: { provider: "yahoo", symbol: "XPEV" },
  });
}

function intradayRequests() {
  return vi.mocked(fetch).mock.calls.flatMap(([input]) =>
    String(input).includes("/api/market-data/intraday")
      ? [new URL(String(input), "http://localhost")]
      : [],
  );
}

function expectOnlyLocalFxFetches() {
  const unexpectedRequests = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
    const path = String(input);
    if (path !== "/api/fx" && path !== "/api/trading-room/fx" && path !== "/api/trading-room/reference-capital" && path !== "/api/storage/recall/summaries") return true;
    const requestInit = (init ?? {}) as RequestInit;
    const method = requestInit.method?.toUpperCase() ?? "GET";
    return requestInit.cache !== "no-store" || method !== "GET";
  });
  expect(
    unexpectedRequests.map(([input, init]) => ({ input: String(input), init })),
    `unexpected local fetches: ${unexpectedRequests.map(([input]) => String(input)).join(", ")}`,
  ).toHaveLength(0);
}

function rejectNextDemoReplayRequest() {
  const fetchMock = vi.mocked(fetch);
  const fallback = fetchMock.getMockImplementation();
  let rejected = false;
  fetchMock.mockImplementation(async (input, init) => {
    const path = String(input);
    if (!rejected && path.startsWith("/api/demo-replay?")) {
      rejected = true;
      throw new Error("offline");
    }
    return fallback ? fallback(input, init) : Response.json({});
  });
}

async function findImportConfirmation(timeout = 10_000) {
  const dialog = await screen.findByRole(
    "dialog",
    { name: "确认导入交易记录" },
    { timeout },
  );
  await within(dialog).findByRole(
    "heading",
    { name: "确认导入交易记录" },
    { timeout },
  );
  return within(dialog).findByRole(
    "button",
    { name: "确认导入并开始更新行情" },
    { timeout },
  );
}

const screenshotFields: ScreenshotField[] = [
  "market",
  "symbol",
  "side",
  "quantity",
  "price",
  "executedAt",
];

function screenshotDraft(
  imageId: string,
  row: number,
  symbol: string,
  sourceName: string,
  sourceTimestampText: string,
  price: string,
  options: { lowConfidencePrice?: boolean; timestampConfirmed?: boolean } = {},
): ScreenshotTradeDraft {
  return {
    id: `${imageId}:draft:${row}`,
    broker: "futu",
    layoutVersion: "futu-orders-dark-v1",
    imageId,
    sourceRowIndex: row,
    sourceBounds: { x: 10, y: row * 100 + 20, width: 500, height: 60 },
    market: "US",
    symbol,
    sourceName,
    side: "buy",
    quantity: "1",
    price,
    sourceTimestampText,
    sourceAccountSuffix: "1234",
    fieldEvidence: Object.fromEntries(
      screenshotFields.map((field) => [
        field,
        {
          rawText: field === "price" ? price : sourceTimestampText,
          confidence:
            field === "price" && options.lowConfidencePrice ? 0.5 : 0.99,
          repaired: false,
          confirmedByUser:
            field === "executedAt"
              ? (options.timestampConfirmed ?? false)
              : false,
          sourceBounds: { x: 10, y: row * 100 + 20, width: 100, height: 20 },
        },
      ]),
    ),
  };
}

function screenshotExecution(
  id: string,
  symbol: string,
  name: string,
  executedAt: string,
  price: string,
): TradeExecution {
  return {
    id,
    source: {
      platform: "futu",
      row: 1,
      sourceOrder: 1,
      fileFingerprint: `statement:${id}`,
      inputKind: "statement",
    },
    accountId: "statement-account",
    accountLabel: "富途证券账户",
    instrument: {
      id: `US:${symbol}`,
      symbol,
      name,
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt,
    quantity: "1",
    price,
    fee: "1",
  };
}

function screenshotDependencies(
  draftsByImage: ReadonlyMap<string, ScreenshotTradeDraft[]>,
): ScreenshotImportDependencies {
  return {
    validateFiles: (files) => ({ ok: true, files }),
    buildInputs: async (files) =>
      files.map((selected, index): ScreenshotInput => ({
        id: `capture-${index + 1}`,
        index,
        file: selected,
        fingerprint: `capture-fingerprint-${index + 1}`,
      })),
    buildBatchId: () => "screenshot-batch-workspace",
    createObjectUrl: (selected) => `blob:${selected.name}`,
    revokeObjectUrl: vi.fn(),
    createOcrEngine: vi.fn().mockResolvedValue({
      recognize: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    }),
    recognize: async (input, _engine, options) => {
      options.onProgress(1, 1);
      return {
        imageId: input.id,
        width: 1_000,
        height: 2_000,
        lines: [],
      } satisfies OcrImageResult;
    },
    detectLayout: () => ({
      matched: true,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
      confidence: 1,
    }),
    parseFutu: (image) => draftsByImage.get(image.imageId) ?? [],
    parseTiger: () => [],
  };
}

describe("TradeReviewWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    chartProbe.enabled = false; chartProbe.candles = [];
    window.history.replaceState(null, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
    mockRecallRepository.documents.clear();
    mockRecallRepository.saveError = undefined;
    mockRecallRepository.loadDelayMs = 0;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input) => String(input).includes("/tradingview-account-migration/aliases")
        ? Response.json({ aliases: [] })
        : { ok: true, json: async () => nextFrame }),
    );
    mockDispatcher.mockReset();
    mockEnrichment.mockReset();
    mockMarketDataSync.mockReset();
    mockBuildIntradaySyncRanges.mockReset();
    mockBuildCachedTagSuggestions.mockReset();
    mockSqliteClient.current = createLegacySqliteClient();
  });


  function productionStorageClient(executions: TradeExecution[]) {
    const client = createLegacySqliteClient();
    client.getBootstrap = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      migration: null,
      executions,
      importHistory: [],
      instruments: [],
      reviews: [],
      reviewStates: [],
      tagSuggestions: [],
      marketDataJobs: [],
      settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
    } satisfies StorageBootstrap);
    return client;
  }

  function natureProbeFills(): TradeExecution[] {
    return [
      ["p1-live", "live", "live-account", undefined],
      ["p1-simulation", "simulation", "simulation-account", "run-f-probe"],
    ].map(([id, nature, accountId, run], index) => ({
      id: id!, accountId: accountId!, accountLabel: accountId!,
      source: { platform: "futu", row: index + 1, tradeNature: nature as "live" | "simulation", ...(run ? { simulationRunId: run } : {}) },
      instrument: { id: "CN-SH:600519", symbol: "600519", name: "F边界证券", market: "CN-SH", currency: "CNY" },
      side: "buy", executedAt: "2026-10-22T01:00:00Z", quantity: "1", price: "100", fee: "0",
    }));
  }

  it("F-RED homepage collection nature change must atomically enter bare global scope and keep homepage source", async () => {
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=live-account&rangeMode=all");
    const user = userEvent.setup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} storageClient={productionStorageClient(natureProbeFills())} />);
    await screen.findByRole("button", { name: "查看持仓详情" });
    await user.click(within(screen.getByRole("navigation", { name: "主导航" })).getByRole("button", { name: "交易库" }));
    const library = await screen.findByRole("region", { name: "交易库" });
    expect(location.search).toContain("accounts=live-account");
    expect(within(library).getByRole("combobox", { name: "交易性质" })).toHaveValue("live");
    await user.selectOptions(within(library).getByRole("combobox", { name: "交易性质" }), "simulation");
    const current = screen.getByRole("region", { name: "交易库" });
    const values = Array.from(within(current).getByRole("combobox", { name: "共享账户" }).querySelectorAll("option")).map(option => option.value);
    console.log("F_NATURE_OBSERVED", JSON.stringify({ url: location.pathname + location.search, nature: within(current).getByRole("combobox", { name: "交易性质" }).getAttribute("value") ?? (within(current).getByRole("combobox", { name: "交易性质" }) as HTMLSelectElement).value, accounts: values, runControl: Boolean(within(current).queryByRole("combobox", { name: "共享模拟运行" })), source: screen.queryByText(/普通交易库 · 成交日期/)?.textContent }));
    expect.soft(location.pathname + location.search).toBe("/trades");
    expect.soft(screen.queryByText("普通交易库 · 当前共享范围")).toBeInTheDocument();
    expect.soft(values).toContain("simulation-account");
    expect.soft(values).not.toContain("live-account");
    expect.soft(within(current).queryByRole("combobox", { name: "共享模拟运行" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回首页" }));
    await screen.findByRole("heading", { name: "首页", level: 1 });
    await waitFor(() => expect(location.search).toContain("accounts=live-account"));
    expect(location.search).toContain("market=a");
    expect(location.search).toContain("scope=live");
  });

  it("F-control bare global scope already supplies nature-matched account and run choices", async () => {
    history.replaceState(null, "", "/trades");
    const user = userEvent.setup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} storageClient={productionStorageClient(natureProbeFills())} />);
    const library = await screen.findByRole("region", { name: "交易库" });
    await user.selectOptions(within(library).getByRole("combobox", { name: "交易性质" }), "simulation");
    const current = screen.getByRole("region", { name: "交易库" });
    const values = Array.from(within(current).getByRole("combobox", { name: "共享账户" }).querySelectorAll("option")).map(option => option.value);
    expect(location.pathname + location.search).toBe("/trades");
    expect(values).toContain("simulation-account");
    expect(values).not.toContain("live-account");
    expect(within(current).getByRole("combobox", { name: "共享模拟运行" }).querySelector('option[value="run-f-probe"]')).toBeInTheDocument();
  });
});
