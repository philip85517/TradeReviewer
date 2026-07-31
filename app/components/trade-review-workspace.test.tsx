import "fake-indexeddb/auto";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { EnrichedImportResult } from "../lib/import/enrich-import";
import type { StatementParseResult } from "../lib/import/contracts";
import type {
  OcrImageResult,
  ScreenshotField,
  ScreenshotInput,
  ScreenshotTradeDraft,
} from "../lib/import/screenshot/contracts";
import { requiredMarketDataRange } from "../lib/market/sync-range";
import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import type { EpisodeReviewRecord } from "../lib/reviews/types";
import { IndexedDbEpisodeReviewRepository } from "../lib/storage/indexeddb-episode-review-repository";
import { IndexedDbTagSuggestionRepository } from "../lib/storage/indexeddb-tag-suggestion-repository";
import {
  loadImportedExecutions,
  saveImportedExecutions,
} from "../lib/storage/import-library";
import { loadImportHistory } from "../lib/storage/import-history";
import * as importTransaction from "../lib/storage/import-transaction";
import { IndexedDbMarketDataRepository } from "../lib/storage/indexeddb-market-data-repository";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import type { TradeExecution } from "../lib/trades/types";
import type { ScreenshotImportDependencies } from "./import/use-screenshot-import";
import { TradeReviewWorkspace } from "./trade-review-workspace";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const {
  mockDispatcher,
  mockEnrichment,
  mockMarketDataSync,
} = vi.hoisted(() => ({
  mockDispatcher: vi.fn(),
  mockEnrichment: vi.fn(),
  mockMarketDataSync: vi.fn(),
}));

vi.mock("../lib/import/dispatcher", () => ({
  parseBrokerStatement: mockDispatcher,
}));

vi.mock("../lib/import/enrich-import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/import/enrich-import")>()),
  enrichStatementImport: mockEnrichment,
}));

vi.mock("../lib/market/sync-service", () => ({
  syncMarketData: mockMarketDataSync,
}));

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

const cmsExecution: TradeExecution = {
  id: "cms:fixture:7",
  source: {
    platform: "china-merchants",
    page: 2,
    row: 7,
    sourceOrder: 3,
    timePrecision: "date-only",
    fileName: "招商证券.pdf",
    fileFingerprint: "cms-fixture",
    sourceTimestampText: "2026-03-01",
    sourceTimezone: "Asia/Shanghai",
  },
  accountId: "cms:account-1",
  accountLabel: "招商证券 · 账户 1",
  instrument: {
    id: "CN-SH:600938",
    symbol: "600938",
    name: "名称待行情源补充",
    market: "CN-SH",
    currency: "CNY",
  },
  side: "buy",
  executedAt: "2026-03-01T07:00:00.000Z",
  quantity: "100",
  price: "15.20",
  fee: "5",
};

const cmsUnresolvedExecution: TradeExecution = {
  ...cmsExecution,
  id: "cms:fixture:8",
  source: {
    ...cmsExecution.source,
    row: 8,
    sourceOrder: 4,
  },
  instrument: {
    id: "HK:99999",
    symbol: "99999",
    name: "名称待行情源补充",
    market: "HK",
    currency: "HKD",
  },
};

const cmsParsedResult: StatementParseResult = {
  broker: "china-merchants",
  records: [cmsExecution, cmsUnresolvedExecution],
  candidates: [
    {
      market: "CN-SH",
      symbol: "600938",
      sourceAssetType: "unknown",
    },
    {
      market: "HK",
      symbol: "99999",
      sourceAssetType: "unknown",
    },
  ],
  exclusions: [],
  diagnostics: [],
  blocked: false,
};

const cmsEnrichedResult: EnrichedImportResult = {
  broker: "china-merchants",
  importable: [
    {
      ...cmsExecution,
      instrument: {
        ...cmsExecution.instrument,
        name: "中国海油",
      },
    },
  ],
  unresolved: [],
  exclusions: [],
  diagnostics: [],
  cacheHits: 0,
};

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

async function confirmScreenshotTimestamp(
  user: ReturnType<typeof userEvent.setup>,
  symbol: string,
  timestamp: string,
) {
  await user.click(
    screen.getByRole("cell", {
      name: `${symbol} 成交时间 ${timestamp}，待确认`,
    }),
  );
  await user.click(screen.getByRole("button", { name: "确认识别值" }));
  await user.click(
    screen.getByRole("button", { name: "关闭截图识别依据" }),
  );
}

describe("TradeReviewWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    window.localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => nextFrame,
      }),
    );
    mockDispatcher.mockReset();
    mockEnrichment.mockReset();
    mockMarketDataSync.mockReset();
    mockMarketDataSync.mockResolvedValue({
      source: "cache",
      status: "complete",
      candles: [],
      requestedRanges: [],
    });
  });

  it("imports a recognized PDF locally without asking for stock names", async () => {
    const user = userEvent.setup();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "招商证券.pdf", {
        type: "application/pdf",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "确认导入交易记录" }),
    ).toBeInTheDocument();
    expect(mockDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({ name: "招商证券.pdf" }),
    );
    expect(screen.queryByRole("textbox", { name: /股票名称/ }))
      .not.toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.every(
        ([input]) => !String(input).includes("招商证券.pdf"),
      ),
    ).toBe(true);
  });

  it("persists only complete records and starts cache-first gap sync for the imported instrument", async () => {
    const user = userEvent.setup();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue({
      ...cmsEnrichedResult,
      unresolved: [
        {
          market: "HK",
          symbol: "99999",
          attempts: [
            {
              source: "hkex",
              code: "no-data",
              message: "未找到证券",
            },
          ],
        },
      ],
    });
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "招商证券.pdf", {
        type: "application/pdf",
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );

    expect(loadImportedExecutions()).toEqual([
      expect.objectContaining({
        id: "cms:fixture:7",
        accountId: "cms:account-1",
        source: expect.objectContaining({
          sourceOrder: 3,
          timePrecision: "date-only",
        }),
        instrument: expect.objectContaining({
          id: "CN-SH:600938",
          name: "中国海油",
        }),
      }),
    ]);
    expect(mockMarketDataSync).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentId: "CN-SH:600938",
        required: requiredMarketDataRange(
          cmsExecution.executedAt,
          cmsExecution.executedAt,
          { open: true, market: "CN-SH" },
        ),
      }),
    );
    expect(loadImportHistory()).toEqual([
      expect.objectContaining({
        sourceLabel: "招商证券",
        tradeCount: 1,
        instrumentCount: 1,
        unresolvedInstrumentCount: 1,
      }),
    ]);
    expect(
      vi.mocked(fetch).mock.calls.some(([input]) =>
        String(input).includes("/api/instruments/resolve"),
      ),
    ).toBe(false);
  });

  it("retries only selected unresolved canonical instruments while preserving the full result", async () => {
    const user = userEvent.setup();
    saveImportedExecutions(cmsEnrichedResult.importable);
    const firstEnriched: EnrichedImportResult = {
      ...cmsEnrichedResult,
      unresolved: [
        {
          market: "HK",
          symbol: "99999",
          attempts: [],
        },
      ],
    };
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment
      .mockResolvedValueOnce(firstEnriched)
      .mockResolvedValueOnce(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "招商证券.pdf", {
        type: "application/pdf",
      }),
    );
    expect(await screen.findByText("1 笔已跳过")).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "重新查询" }),
    );

    expect(mockEnrichment).toHaveBeenLastCalledWith(
      cmsParsedResult,
      expect.objectContaining({
        forceRefresh: true,
        onlyInstrumentIds: ["HK:99999"],
        previous: firstEnriched,
      }),
    );
    expect(
      (await screen.findAllByText("中国海油（600938）")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("1 笔已跳过")).toBeInTheDocument();
  });

  it("does not resurrect an import when a deferred unresolved retry finishes after cancel", async () => {
    const user = userEvent.setup();
    const pendingRetry = deferred<EnrichedImportResult>();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment
      .mockResolvedValueOnce({
        ...cmsEnrichedResult,
        unresolved: [
          { market: "HK", symbol: "99999", attempts: [] },
        ],
      })
      .mockReturnValueOnce(pendingRetry.promise);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "重新查询" }),
    );

    await user.click(screen.getByRole("button", { name: "取消" }));
    pendingRetry.resolve(cmsEnrichedResult);
    await pendingRetry.promise;
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(
      screen.queryByRole("heading", { name: "确认导入交易记录" }),
    ).not.toBeInTheDocument();
    expect(loadImportedExecutions()).toEqual([]);
  });

  it("disables confirmation while an unresolved retry is pending", async () => {
    const user = userEvent.setup();
    const pendingRetry = deferred<EnrichedImportResult>();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment
      .mockResolvedValueOnce({
        ...cmsEnrichedResult,
        unresolved: [
          { market: "HK", symbol: "99999", attempts: [] },
        ],
      })
      .mockReturnValueOnce(pendingRetry.promise);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "重新查询" }),
    );

    const confirmButton = screen.getByRole("button", {
      name: "确认导入并开始更新行情",
    });
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(loadImportedExecutions()).toEqual([]);
    pendingRetry.resolve(cmsEnrichedResult);
    expect(
      await screen.findByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    ).toBeEnabled();
  });

  it("reports stable-id duplicates when the same statement is imported again", async () => {
    const user = userEvent.setup();
    saveImportedExecutions(cmsEnrichedResult.importable);
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "中国海油（600938）" });
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByText("1 笔已跳过")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );
    expect(loadImportedExecutions()).toHaveLength(1);
    expect(loadImportHistory()[0].duplicateTradeCount).toBe(1);
  });

  it("retains the larger legitimate same-file fill multiplicity and counts only the overlap", async () => {
    const user = userEvent.setup();
    const existing = {
      ...cmsEnrichedResult.importable[0],
      id: "old-file:1",
      source: {
        ...cmsEnrichedResult.importable[0].source,
        row: 1,
        sourceOrder: 1,
        fileFingerprint: "old-file",
      },
    };
    const incoming = [7, 8].map((row) => ({
      ...cmsEnrichedResult.importable[0],
      id: `new-file:${row}`,
      source: {
        ...cmsEnrichedResult.importable[0].source,
        row,
        sourceOrder: row,
        fileFingerprint: "new-file",
      },
    }));
    saveImportedExecutions([existing]);
    mockDispatcher.mockResolvedValue({
      ...cmsParsedResult,
      records: incoming,
    });
    mockEnrichment.mockResolvedValue({
      ...cmsEnrichedResult,
      importable: incoming,
    });
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "重叠区间.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByText("1 笔已跳过")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );
    expect(loadImportedExecutions().map((item) => item.id)).toEqual([
      "new-file:7",
      "new-file:8",
    ]);
    expect(loadImportHistory()[0].duplicateTradeCount).toBe(1);
  });

  it("keeps executions and import history when post-import K-line sync fails", async () => {
    const user = userEvent.setup();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    mockMarketDataSync.mockRejectedValueOnce(
      new Error("公开行情暂不可用"),
    );
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );

    expect(loadImportedExecutions()).toHaveLength(1);
    expect(loadImportHistory()).toHaveLength(1);
    expect(
      await screen.findByRole("heading", { name: "中国海油（600938）" }),
    ).toBeInTheDocument();
  });

  it("keeps the statement input unchanged and exposes an independent multi-image screenshot input", () => {
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    const statementInput = screen.getByLabelText("导入交易记录");
    expect(statementInput).toHaveAttribute("accept", ".xlsx,.xls,.pdf");
    expect(statementInput).not.toHaveAttribute("multiple");

    const screenshotInput = screen.getByLabelText("从截图恢复交易");
    expect(screenshotInput).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    );
    expect(screenshotInput).toHaveAttribute("multiple");
  });

  it("reviews two screenshots and applies duplicate, use-incoming, and keep-both decisions through the existing import transaction", async () => {
    const user = userEvent.setup();
    const persistSpy = vi.spyOn(importTransaction, "persistImportBatch");
    const existing = [
      screenshotExecution(
        "existing-nvda",
        "NVDA",
        "英伟达",
        "2025-03-01T01:30:00Z",
        "100",
      ),
      screenshotExecution(
        "existing-msft",
        "MSFT",
        "微软",
        "2025-03-02T01:30:00Z",
        "200",
      ),
      screenshotExecution(
        "existing-tsla",
        "TSLA",
        "特斯拉",
        "2025-03-03T01:30:00Z",
        "300",
      ),
    ];
    saveImportedExecutions(existing);
    const draftsByImage = new Map([
      [
        "capture-1",
        [
          screenshotDraft(
            "capture-1",
            0,
            "NVDA",
            "英伟达",
            "2025-03-01 09:30:00",
            "100",
          ),
          screenshotDraft(
            "capture-1",
            1,
            "MSFT",
            "微软",
            "2025-03-02 09:30:00",
            "201",
          ),
        ],
      ],
      [
        "capture-2",
        [
          screenshotDraft(
            "capture-2",
            0,
            "TSLA",
            "特斯拉",
            "2025-03-03 09:30:00",
            "301",
          ),
          screenshotDraft(
            "capture-2",
            1,
            "AAPL",
            "苹果",
            "2025-04-10 09:30:00",
            "150",
            { lowConfidencePrice: true },
          ),
        ],
      ],
    ]);
    mockEnrichment.mockImplementation(async (parsed: StatementParseResult) => ({
      broker: parsed.broker,
      importable: parsed.records,
      unresolved: [],
      exclusions: [],
      diagnostics: [],
      cacheHits: 0,
    }));
    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        screenshotImportDependencies={screenshotDependencies(draftsByImage)}
      />,
    );

    await user.upload(screen.getByLabelText("从截图恢复交易"), [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ]);
    expect(
      await screen.findByRole("heading", { name: "从截图恢复交易" }),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("截图成交时区"),
      "Asia/Shanghai",
    );
    await user.clear(screen.getByLabelText("交易账户"));
    await user.type(screen.getByLabelText("交易账户"), "截图测试账户");
    await confirmScreenshotTimestamp(user, "NVDA", "2025-03-01 09:30:00");
    await confirmScreenshotTimestamp(user, "MSFT", "2025-03-02 09:30:00");
    await confirmScreenshotTimestamp(user, "TSLA", "2025-03-03 09:30:00");
    await confirmScreenshotTimestamp(user, "AAPL", "2025-04-10 09:30:00");

    await user.click(
      screen.getByRole("cell", { name: "AAPL 价格 150，待确认" }),
    );
    await user.clear(screen.getByRole("textbox", { name: "修改价格" }));
    await user.type(screen.getByRole("textbox", { name: "修改价格" }), "151");
    await user.click(screen.getByRole("button", { name: "保存修改" }));
    await user.click(
      screen.getByRole("button", { name: "关闭截图识别依据" }),
    );

    expect(
      screen.getByRole("status", {
        name: "批次统计：总成交 4，待确认 0，自动重复 1，冲突 2",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "处理 MSFT 冲突" }));
    await user.click(screen.getByRole("radio", { name: /使用截图记录/ }));
    await user.click(
      screen.getByRole("button", { name: "关闭截图识别依据" }),
    );
    await user.click(screen.getByRole("button", { name: "处理 TSLA 冲突" }));
    await user.click(screen.getByRole("radio", { name: /全部保留/ }));
    await user.click(
      screen.getByRole("button", { name: "关闭截图识别依据" }),
    );
    await user.click(screen.getByRole("button", { name: "确认导入" }));

    expect(
      await screen.findByRole("heading", { name: "确认导入交易记录" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 张交易截图")).toBeInTheDocument();
    expect(screen.getByText(/已自动识别为 富途截图 交易记录/)).toBeInTheDocument();
    expect(screen.getByText("1 笔已跳过")).toBeInTheDocument();
    expect(screen.getByText("2 笔已处理")).toBeInTheDocument();
    expect(screen.getByText("3 笔成交")).toBeInTheDocument();
    expect(mockEnrichment).toHaveBeenCalledWith(
      expect.objectContaining({
        records: expect.arrayContaining([
          expect.objectContaining({ instrument: expect.objectContaining({ symbol: "MSFT" }) }),
          expect.objectContaining({ instrument: expect.objectContaining({ symbol: "TSLA" }) }),
          expect.objectContaining({ instrument: expect.objectContaining({ symbol: "AAPL" }) }),
        ]),
      }),
      expect.anything(),
    );
    expect(mockEnrichment.mock.calls[0][0].records).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "确认导入并开始更新行情" }),
    );

    const persisted = loadImportedExecutions();
    expect(persisted.map(({ id }) => id)).not.toContain("existing-msft");
    expect(persisted.map(({ id }) => id)).toContain("existing-nvda");
    expect(persisted.filter(({ instrument }) => instrument.symbol === "NVDA"))
      .toHaveLength(1);
    expect(persisted.filter(({ instrument }) => instrument.symbol === "TSLA"))
      .toHaveLength(2);
    expect(persisted).toHaveLength(5);
    expect(persistSpy).toHaveBeenCalledWith(
      existing,
      expect.arrayContaining([
        expect.objectContaining({ id: "existing-nvda" }),
      ]),
      expect.objectContaining({
        sourceKind: "screenshot",
        captureCount: 2,
        conflictTradeCount: 2,
      }),
    );
    expect(mockMarketDataSync).toHaveBeenCalledTimes(1);
    expect(mockMarketDataSync).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentId: "US:AAPL",
        required: requiredMarketDataRange(
          "2025-04-10T01:30:00Z",
          "2025-04-10T01:30:00Z",
          { open: true, market: "US" },
        ),
      }),
    );
  }, 15_000);

  it("does not persist when a prepared screenshot import preview is canceled", async () => {
    const user = userEvent.setup();
    const persistSpy = vi.spyOn(importTransaction, "persistImportBatch");
    const draftsByImage = new Map([
      [
        "capture-1",
        [
          screenshotDraft(
            "capture-1",
            0,
            "AAPL",
            "苹果",
            "2025-04-10 09:30:00",
            "150",
            { timestampConfirmed: true },
          ),
        ],
      ],
    ]);
    mockEnrichment.mockImplementation(async (parsed: StatementParseResult) => ({
      broker: parsed.broker,
      importable: parsed.records,
      unresolved: [],
      exclusions: [],
      diagnostics: [],
      cacheHits: 0,
    }));
    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        screenshotImportDependencies={screenshotDependencies(draftsByImage)}
      />,
    );

    await user.upload(screen.getByLabelText("从截图恢复交易"),
      new File(["one"], "one.png", { type: "image/png" }),
    );
    await user.selectOptions(
      await screen.findByLabelText("截图成交时区"),
      "Asia/Shanghai",
    );
    await user.click(screen.getByRole("button", { name: "确认导入" }));
    await screen.findByRole("heading", { name: "确认导入交易记录" });
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(loadImportedExecutions()).toEqual([]);
    expect(loadImportHistory()).toEqual([]);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(mockMarketDataSync).not.toHaveBeenCalled();
  });

  it("hides the frozen screenshot review while import preparation is pending", async () => {
    const user = userEvent.setup();
    const enrichment = deferred<EnrichedImportResult>();
    const draftsByImage = new Map([
      [
        "capture-1",
        [
          screenshotDraft(
            "capture-1",
            0,
            "AAPL",
            "苹果",
            "2025-04-10 09:30:00",
            "150",
            { timestampConfirmed: true },
          ),
        ],
      ],
    ]);
    mockEnrichment.mockReturnValue(enrichment.promise);
    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        screenshotImportDependencies={screenshotDependencies(draftsByImage)}
      />,
    );

    await user.upload(screen.getByLabelText("从截图恢复交易"), [
      new File(["one"], "one.png", { type: "image/png" }),
    ]);
    await user.selectOptions(
      await screen.findByLabelText("截图成交时区"),
      "Asia/Shanghai",
    );
    await user.clear(screen.getByLabelText("交易账户"));
    await user.type(screen.getByLabelText("交易账户"), "截图测试账户");
    await user.click(screen.getByRole("button", { name: "确认导入" }));

    expect(
      screen.queryByRole("heading", { name: "从截图恢复交易" }),
    ).not.toBeInTheDocument();

    enrichment.resolve({
      broker: "futu",
      importable: [],
      unresolved: [],
      exclusions: [],
      diagnostics: [],
      cacheHits: 0,
    });
    expect(
      await screen.findByRole("heading", { name: "确认导入交易记录" }),
    ).toBeInTheDocument();
  });

  it("advances one candle without revealing the future and preserves the cursor across periods", async () => {
    const user = userEvent.setup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    const cursorBefore = screen.getByTestId("replay-cursor").textContent;

    expect(screen.queryByText("未来成交")).not.toBeInTheDocument();
    expect(screen.queryByText(/共 \d+ 根/)).not.toBeInTheDocument();
    expect(screen.getByText("尚未成交")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );

    expect(screen.getByTestId("replay-cursor").textContent).not.toBe(
      cursorBefore,
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("mode=next"),
      { cache: "no-store" },
    );

    const cursorAfterAdvance =
      screen.getByTestId("replay-cursor").textContent;
    await user.click(screen.getByRole("button", { name: "切换到 1W" }));

    expect(screen.getByTestId("replay-cursor")).toHaveTextContent(
      cursorAfterAdvance ?? "",
    );
  });

  it("stops replay and reports a recoverable message when a step fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("回放数据暂时无法读取");
  });

  it("loads imported stocks after a page reload without starting a market request", async () => {
    const imported: TradeExecution = {
      id: "futu:2",
      source: { platform: "futu", row: 2 },
      accountId: "acct",
      accountLabel: "富途",
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "小米集团-W",
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "10",
    };
    saveImportedExecutions([imported]);
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    expect(
      await screen.findByRole("heading", { name: "小米集团-W（1810）" }),
    ).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes metadata without blocking cached candles when metadata is unresolved", async () => {
    const user = userEvent.setup();
    const imported: TradeExecution = {
      id: "futu:metadata-refresh",
      source: { platform: "futu", row: 2 },
      accountId: "acct",
      accountLabel: "富途",
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "小米集团-W",
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "10",
    };
    saveImportedExecutions([
      imported,
      {
        ...imported,
        id: "futu:metadata-refresh-sell",
        source: { platform: "futu", row: 3 },
        side: "sell",
        executedAt: "2025-01-03T02:00:00.000Z",
      },
    ]);
    const repository = new IndexedDbMarketDataRepository();
    await repository.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [
        {
          instrumentId: "HK:1810",
          tradingDate: "2025-01-02",
          open: "34",
          high: "35",
          low: "33",
          close: "34.5",
          volume: "1000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2026-07-29T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          startDate: "2023-11-01",
          endDate: "2025-03-01",
          status: "complete",
          provider: "tencent",
          fetchedAt: "2026-07-29T00:00:00.000Z",
          missingTradingDates: [],
        },
      ],
      providerSymbol: {
        provider: "tencent",
        symbol: "hk01810",
      },
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: "unresolved",
          attempts: [
            {
              source: "hkex",
              code: "no-data",
              message: "未找到证券",
            },
          ],
        },
      }),
    } as Response);
    mockMarketDataSync.mockResolvedValueOnce({
      source: "cache",
      status: "complete",
      candles: [
        {
          instrumentId: "HK:1810",
          tradingDate: "2025-01-02",
          open: "34",
          high: "35",
          low: "33",
          close: "34.5",
          volume: "1000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2026-07-29T00:00:00.000Z",
        },
      ],
      requestedRanges: [],
    });

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小米集团-W（1810）" });
    expect(await screen.findByTestId("imported-market-chart")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "更新小米集团-W行情" }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/instruments/resolve?market=HK&symbol=1810",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByTestId("imported-market-chart")).toBeInTheDocument();
  });

  it("applies a refreshed canonical name to every execution and keeps it after candle failure and reload", async () => {
    const user = userEvent.setup();
    const base: TradeExecution = {
      id: "name-refresh-buy",
      source: { platform: "tiger", row: 2 },
      accountId: "private-account-88",
      accountLabel: "Tiger 私密账户",
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "旧证券名称",
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "10",
    };
    saveImportedExecutions([
      base,
      {
        ...base,
        id: "name-refresh-sell",
        source: { platform: "tiger", row: 3 },
        side: "sell",
        executedAt: "2025-01-03T02:00:00.000Z",
      },
    ]);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        market: "HK",
        symbol: "1810",
        name: "小米集团-W（更新）",
        assetType: "stock",
        source: "hkex",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      }),
    );
    mockMarketDataSync.mockRejectedValueOnce(
      new Error("K 线更新失败"),
    );

    const view = render(
      <TradeReviewWorkspace initialFrame={initialFrame} />,
    );
    await screen.findByRole("heading", { name: "旧证券名称（1810）" });
    await user.click(
      screen.getByRole("button", { name: "更新旧证券名称行情" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "小米集团-W（更新）（1810）",
      }),
    ).toBeInTheDocument();
    expect(
      loadImportedExecutions().map((item) => item.instrument.name),
    ).toEqual(["小米集团-W（更新）", "小米集团-W（更新）"]);
    const metadataRequest = vi.mocked(fetch).mock.calls.find(
      ([input]) =>
        String(input) ===
        "/api/instruments/resolve?market=HK&symbol=1810",
    );
    expect(metadataRequest).toBeDefined();
    expect(metadataRequest?.[1]).toEqual({
      signal: expect.any(AbortSignal),
    });
    expect(metadataRequest?.[1]).not.toHaveProperty("body");
    expect(metadataRequest?.[1]).not.toHaveProperty("method");
    expect(JSON.stringify(metadataRequest)).not.toContain(
      "private-account-88",
    );
    expect(JSON.stringify(metadataRequest)).not.toContain(
      "Tiger 私密账户",
    );

    view.unmount();
    vi.mocked(fetch).mockClear();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    expect(
      await screen.findByRole("heading", {
        name: "小米集团-W（更新）（1810）",
      }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("merges a deferred metadata name with an overlapping import confirmation without losing either", async () => {
    const user = userEvent.setup();
    const metadataResponse = deferred<Response>();
    const existing: TradeExecution = {
      id: "deferred-name-buy",
      source: { platform: "tiger", row: 2 },
      accountId: "tiger-account",
      accountLabel: "Tiger",
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "小米旧名称",
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "10",
    };
    saveImportedExecutions([existing]);
    vi.mocked(fetch).mockReturnValue(metadataResponse.promise);
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小米旧名称（1810）" });

    await user.click(
      screen.getByRole("button", { name: "更新小米旧名称行情" }),
    );
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "确认导入并开始更新行情",
      }),
    );
    metadataResponse.resolve(
      Response.json({
        market: "HK",
        symbol: "1810",
        name: "小米并发更新名称",
        assetType: "stock",
        source: "hkex",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      }),
    );

    expect(
      await screen.findByText("小米并发更新名称"),
    ).toBeInTheDocument();
    expect(
      loadImportedExecutions().map((item) => [
        item.instrument.id,
        item.instrument.name,
      ]),
    ).toEqual([
      ["HK:1810", "小米并发更新名称"],
      ["CN-SH:600938", "中国海油"],
    ]);
  });

  it("keeps UI and durable executions unchanged when refreshed-name persistence fails", async () => {
    const user = userEvent.setup();
    const existing: TradeExecution = {
      id: "failed-name-save",
      source: { platform: "tiger", row: 2 },
      accountId: "tiger-account",
      accountLabel: "Tiger",
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "保存前名称",
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "10",
    };
    saveImportedExecutions([existing]);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        market: "HK",
        symbol: "1810",
        name: "无法持久化的新名称",
        assetType: "stock",
        source: "hkex",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      }),
    );
    const originalSetItem = window.localStorage.setItem.bind(
      window.localStorage,
    );
    vi.spyOn(window.localStorage, "setItem").mockImplementation(
      (key, value) => {
        if (key === "trade-reviewer:executions:v1") {
          throw new Error("quota");
        }
        originalSetItem(key, value);
      },
    );
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "保存前名称（1810）" });

    await user.click(
      screen.getByRole("button", { name: "更新保存前名称行情" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("新名称未能保存");
    expect(
      screen.getByRole("heading", { name: "保存前名称（1810）" }),
    ).toBeInTheDocument();
    expect(loadImportedExecutions()[0].instrument.name).toBe(
      "保存前名称",
    );
    expect(
      screen.queryByText("无法持久化的新名称"),
    ).not.toBeInTheDocument();
  });

  it("navigates through stock and episode library levels without requesting market data", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    };
    const imported: TradeExecution[] = [
      {
        id: "old-buy",
        source: {
          platform: "futu",
          row: 2,
          sourceTimestampText: "旧回合买入",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "100",
        price: "10",
        fee: "1",
      },
      {
        id: "old-sell",
        source: {
          platform: "futu",
          row: 3,
          sourceTimestampText: "旧回合卖出",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "100",
        price: "12",
        fee: "1",
      },
      {
        id: "new-buy",
        source: {
          platform: "futu",
          row: 4,
          sourceTimestampText: "新回合买入",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-05T14:30:00.000Z",
        quantity: "100",
        price: "11",
        fee: "1",
      },
    ];
    saveImportedExecutions(imported);
    vi.mocked(fetch).mockClear();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByRole("heading", {
      name: "小鹏汽车（XPEV）",
    });
    await user.click(screen.getByRole("button", { name: "交易库" }));

    expect(
      await screen.findByRole("heading", { name: "股票交易库" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );
    expect(
      screen.getByRole("button", { name: /第 2 次交易/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("新回合买入")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "进入逐笔复盘" }),
    );
    expect(
      screen.getByRole("heading", { name: "小鹏汽车（XPEV）" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hydrates cached candles for library stocks that are not selected in replay", async () => {
    const user = userEvent.setup();
    const executions: TradeExecution[] = [
      {
        id: "xiaomi-buy",
        source: { platform: "futu", row: 2 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "HK:1810",
          symbol: "1810",
          name: "小米集团-W",
          market: "HK",
          currency: "HKD",
        },
        side: "buy",
        executedAt: "2025-01-02T02:00:00.000Z",
        quantity: "100",
        price: "34.5",
        fee: "1",
      },
      {
        id: "xpev-buy",
        source: { platform: "futu", row: 3 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "US:XPEV",
          symbol: "XPEV",
          name: "小鹏汽车",
          market: "US",
          currency: "USD",
        },
        side: "buy",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "10",
        price: "10",
        fee: "1",
      },
    ];
    saveImportedExecutions(executions);
    const repository = new IndexedDbMarketDataRepository();
    for (const item of [
      {
        instrumentId: "HK:1810",
        tradingDate: "2025-01-03",
        currency: "HKD",
        close: "35",
      },
      {
        instrumentId: "US:XPEV",
        tradingDate: "2025-01-06",
        currency: "USD",
        close: "11",
      },
    ]) {
      await repository.commitSyncResult({
        instrumentId: item.instrumentId,
        candles: [
          {
            ...item,
            open: item.close,
            high: item.close,
            low: item.close,
            volume: "1000",
            provider: "tencent",
            providerSymbol: item.instrumentId,
            adjustmentMode: "raw",
            fetchedAt: "2025-01-07T00:00:00Z",
          },
        ],
        coverage: [
          {
            startDate: "2024-01-01",
            endDate: "2025-02-01",
            status: "complete",
            provider: "tencent",
            fetchedAt: "2025-01-07T00:00:00Z",
            missingTradingDates: [],
          },
        ],
        providerSymbol: {
          provider: "tencent",
          symbol: item.instrumentId,
        },
      });
    }
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小米集团-W（1810）" });
    await user.click(screen.getByRole("button", { name: "交易库" }));
    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );

    expect(
      await screen.findByText("日线 · 本地缓存 · 买卖点"),
    ).toBeInTheDocument();
    expect(screen.queryByText("本地尚无行情")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hydrates and updates the review record for the exact position episode", async () => {
    const user = userEvent.setup();
    const executions: TradeExecution[] = [
      {
        id: "xpev-review-buy",
        source: { platform: "futu", row: 2 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "US:XPEV",
          symbol: "XPEV",
          name: "小鹏汽车",
          market: "US",
          currency: "USD",
        },
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "100",
        price: "10",
        fee: "0",
      },
      {
        id: "xpev-review-sell",
        source: { platform: "futu", row: 3 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "US:XPEV",
          symbol: "XPEV",
          name: "小鹏汽车",
          market: "US",
          currency: "USD",
        },
        side: "sell",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "100",
        price: "12",
        fee: "0",
      },
    ];
    saveImportedExecutions(executions);
    const [episode] = buildTradeEpisodes(executions);
    const record: EpisodeReviewRecord = {
      version: 1,
      episodeId: episode.id,
      instrumentId: "US:XPEV",
      updatedAt: "2025-01-04T00:00:00.000Z",
      plan: {
        thesis: "等待突破",
        expectedPath: "",
        invalidationCondition: "",
        targetRange: "",
        plannedRiskAmount: "100",
        confidence: 4,
      },
      review: {
        decisionQuality: 4,
        executionQuality: 4,
        riskManagement: "",
        psychology: "",
        reusableRule: "",
        completed: true,
      },
      confirmedTagIds: ["breakout"],
    };
    const reviews = new IndexedDbEpisodeReviewRepository();
    await reviews.put(record);
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小鹏汽车（XPEV）" });
    await user.click(screen.getByRole("button", { name: "交易库" }));
    await user.click(
      await screen.findByRole("button", {
        name: "打开小鹏汽车交易回合",
      }),
    );

    expect(await screen.findByLabelText("买入理由")).toHaveValue(
      "等待突破",
    );
    expect(screen.getAllByText("已复盘").length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("买入理由"));
    await user.type(screen.getByLabelText("买入理由"), "等待回踩");
    await user.click(
      screen.getByRole("button", { name: "保存当前回合复盘" }),
    );

    expect(await screen.findByText("已保存在本机")).toBeInTheDocument();
    expect((await reviews.get(episode.id))?.plan.thesis).toBe("等待回踩");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts an edited cached suggestion and opens the exact episode without requesting market data", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    };
    const executions: TradeExecution[] = [
      {
        id: "scale-in-1",
        source: {
          platform: "futu",
          row: 2,
          sourceTimestampText: "目标回合买入一",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "50",
        price: "10",
        fee: "0",
      },
      {
        id: "scale-in-2",
        source: {
          platform: "futu",
          row: 3,
          sourceTimestampText: "目标回合买入二",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T15:30:00.000Z",
        quantity: "50",
        price: "11",
        fee: "0",
      },
      {
        id: "scale-in-close",
        source: {
          platform: "futu",
          row: 4,
          sourceTimestampText: "目标回合卖出",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "100",
        price: "12",
        fee: "0",
      },
    ];
    saveImportedExecutions(executions);
    const [episode] = buildTradeEpisodes(executions);
    await new IndexedDbMarketDataRepository().commitSyncResult({
      instrumentId: instrument.id,
      candles: ["2025-01-02", "2025-01-03"].map(
        (tradingDate, index) => ({
          instrumentId: instrument.id,
          tradingDate,
          open: index === 0 ? "10" : "11",
          high: index === 0 ? "11" : "12",
          low: index === 0 ? "9" : "10",
          close: index === 0 ? "10.5" : "12",
          volume: "1000",
          currency: "USD",
          provider: "tencent" as const,
          providerSymbol: "usXPEV",
          adjustmentMode: "raw" as const,
          fetchedAt: "2025-01-04T00:00:00.000Z",
        }),
      ),
      coverage: [
        {
          startDate: "2024-01-01",
          endDate: "2025-02-01",
          status: "complete",
          provider: "tencent",
          fetchedAt: "2025-01-04T00:00:00.000Z",
          missingTradingDates: [],
        },
      ],
      providerSymbol: {
        provider: "tencent",
        symbol: "usXPEV",
      },
    });
    vi.mocked(fetch).mockClear();
    let releaseReviews!: (records: EpisodeReviewRecord[]) => void;
    vi.spyOn(
      IndexedDbEpisodeReviewRepository.prototype,
      "getAll",
    ).mockReturnValueOnce(
      new Promise((resolve) => {
        releaseReviews = resolve;
      }),
    );

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小鹏汽车（XPEV）" });
    await user.click(screen.getByRole("button", { name: "模式洞察" }));

    expect(
      await screen.findByRole("heading", { name: "待确认规则建议" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "确认“分批进入”" }),
    ).not.toBeInTheDocument();
    releaseReviews([]);
    expect(
      await screen.findByText("分批进入", { selector: "b" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "查看小鹏汽车第 1 次交易",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "第 1 次交易" }),
    ).toBeInTheDocument();
    expect(screen.getByText("目标回合买入一")).toBeInTheDocument();
    expect(screen.getByText("目标回合买入二")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "模式洞察" }));
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "调整“分批进入”建议标签",
      }),
      "planned",
    );
    await user.click(
      screen.getByRole("button", { name: "确认改为“计划内”" }),
    );

    const suggestions =
      await new IndexedDbTagSuggestionRepository().getAll();
    expect(suggestions).toEqual([
      expect.objectContaining({
        episodeId: episode.id,
        status: "edited",
        finalTagId: "planned",
      }),
    ]);
    expect(
      (await new IndexedDbEpisodeReviewRepository().get(episode.id))
        ?.confirmedTagIds,
    ).toContain("planned");

    expect(screen.getByText("暂无待确认建议")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
