import { csv } from "../lib/import/__fixtures__/tradingview";
import "fake-indexeddb/auto";

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import { fingerprintBytes } from "../lib/import/file-fingerprint";
import { parseTradingViewSimulationCsv } from "../lib/import/tradingview-simulation";
import { requiredMarketDataRange } from "../lib/market/sync-range";
import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import {
  loadImportedExecutions,
  saveImportedExecutions,
} from "../lib/storage/import-library";
import { IndexedDbMarketDataRepository } from "../lib/storage/indexeddb-market-data-repository";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import type { TradeExecution } from "../lib/trades/types";
import { tradeRepairClient } from "../lib/storage/trade-repair-client";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
import { createSqliteWorkspaceHarness } from "./test-support/sqlite-workspace-harness";
import { createSqliteHttpClient, StorageHttpError } from "../lib/storage/sqlite-http-client";
import type { TradeChangeCommit, TradeChangeIntent } from "../lib/storage/sqlite-contracts";
import type { TradeBookRead } from "../lib/storage/trade-read-contract";
import { parseTradeCommitReceipt, parseTradePlan } from "../lib/storage/trade-change-response";
import { StockDataDialog } from "./review/stock-data-dialog";

const ownedClients = vi.hoisted(() => ({ current: undefined as undefined | { client: unknown; recallRepository: unknown } }));
let ownedHarness: ReturnType<typeof createSqliteWorkspaceHarness> | undefined;
const mockSqliteClient = vi.hoisted(() => ({ current: undefined as unknown }));

const mockRecallRepository = vi.hoisted(() => ({
  documents: new Map<string, unknown>(),
}));

vi.mock("../lib/recall/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/recall/repository")>();
  return {
    ...actual,
    createRecallRepository: (fetcher?: Parameters<typeof actual.createRecallRepository>[0]) => fetcher ? actual.createRecallRepository(fetcher) : ownedClients.current?.recallRepository ?? ({
      load: async (episodeId: string) => mockRecallRepository.documents.get(episodeId) ?? null,
      fetch: async (episodeId: string) => mockRecallRepository.documents.get(episodeId) ?? null,
      save: async (document: Record<string, unknown> & { episodeId: string; revision: number }) => {
        const saved = { ...document, revision: document.revision + 1 };
        mockRecallRepository.documents.set(document.episodeId, saved);
        return saved;
      },
    }),
  };
});

vi.mock("../lib/storage/sqlite-http-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storage/sqlite-http-client")>();
  return { ...actual, createSqliteHttpClient: (fetcher?: Parameters<typeof actual.createSqliteHttpClient>[0]) => fetcher ? actual.createSqliteHttpClient(fetcher) : ownedClients.current?.client ?? mockSqliteClient.current };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function expectOnlyLocalRoomFetches() {
  const unexpectedRequests = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
    const path = String(input);
    if (path !== "/api/fx" && path !== "/api/trading-room/fx" && path !== "/api/trading-room/reference-capital" && path !== "/api/storage/recall/summaries") return true;
    const requestInit = (init ?? {}) as RequestInit;
    const method = requestInit.method?.toUpperCase() ?? "GET";
    return requestInit.cache !== "no-store" || method !== "GET";
  });
  expect(unexpectedRequests).toEqual([]);
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

type TestUser = ReturnType<typeof userEvent.setup>;

async function openImportManagement(user: TestUser) {
  await waitFor(() => {
    if (
      screen.queryByRole("button", { name: "打开导入与数据管理" }) ||
      screen.queryByLabelText("导入交易记录", { selector: "input" })
    ) {
      return;
    }
    throw new Error("import entry is not ready");
  });
  const trigger = screen.queryByRole("button", {
    name: "打开导入与数据管理",
  });
  if (trigger) {
    await user.click(trigger);
    return screen.findByRole("dialog", { name: "导入与数据管理" });
  }
  return null;
}

async function uploadStatement(user: TestUser, file: File) {
  const drawer = await openImportManagement(user);
  const input = drawer
    ? within(drawer).getByLabelText("导入交易记录", { selector: "input" })
    : await screen.findByLabelText("导入交易记录", { selector: "input" });
  await user.upload(input, file);
}

describe("TradeReviewWorkspace", () => {
  it("reviews a monthly statement before enrichment and cancels without saving", async () => {
    const user = userEvent.setup(), h = bindOwned();
    const before = durableBook(await h.client.readTradeBook());
    const monthly = { documentId: "monthly-test", month: "2025-06", templateIds: ["futu-combined"], positions: [], events: [], reviewRequired: true };
    mockDispatcher.mockResolvedValue({ ...cmsParsedResult, broker: "futu", monthly, diagnostics: [{ severity: "warning", code: "zone", message: "请核对来源时区" }] });
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "2025-06.pdf", { type: "application/pdf" }));
    await screen.findByRole("heading", { name: "核对月结单与时间口径" });
    expect(mockEnrichment).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "继续核对并导入" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
  });

  it("reparses missing source time and persists reviewed monthly evidence only on final confirmation", async () => {
    const user = userEvent.setup(), h = bindOwned();
    const monthly = { documentId: "monthly-test", month: "2025-06", templateIds: ["futu-combined"], positions: [], events: [], reviewRequired: false };
    mockDispatcher.mockResolvedValueOnce({ ...cmsParsedResult, broker: "futu", blocked: true, monthly, diagnostics: [{ severity: "error", code: "missing-statement-timezone", message: "时区缺失" }] })
      .mockResolvedValueOnce({ ...cmsParsedResult, broker: "futu", monthly, diagnostics: [] });
    mockEnrichment.mockResolvedValue({ ...cmsEnrichedResult, broker: "futu", monthly });
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    const before = durableBook(await h.client.readTradeBook());
    await uploadStatement(user, new File(["pdf"], "2025-06.pdf", { type: "application/pdf" }));
    await screen.findByRole("heading", { name: "核对月结单与时间口径" });
    await user.selectOptions(screen.getByLabelText("月结单来源时区"), "Asia/Hong_Kong");
    await user.click(screen.getByRole("button", { name: "按所选时间口径重新解析" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "继续核对并导入" })).toBeEnabled());
    expect(mockDispatcher).toHaveBeenLastCalledWith(expect.any(File), { sourceTimezone: "Asia/Hong_Kong", overrideDocumentTimezone: true });
    await user.click(screen.getByRole("button", { name: "继续核对并导入" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.importHistory[0]?.monthly).toEqual(monthly);
    expect(saved.pages.flatMap(page => page.snapshot.materialHistory)).toHaveLength(1);
    expectSavedRead(h);
    await returnAndRemount(user, h, saved);
  });

  it.each(["keep-existing", "use-incoming", "keep-both"] as const)("persists the explicit monthly conflict choice %s", async decision => {
    const user = userEvent.setup(), existing = monthlyExecution("old-fill", "old-doc");
    const h = await saveFirstMonthly(user, [existing]);
    const before = await h.client.readTradeBook();
    const materialId = before.pages[0].snapshot.materialHistory[0].id;
    const incoming = { ...existing, id: "new-fill", quantity: "200", source: { ...existing.source, fileFingerprint: "new-doc" } };
    setMonthlyInput([incoming]);
    await uploadMonthly(user);
    await waitFor(() => expect(screen.getByLabelText("来源材料处理")).toBeEnabled());
    expect(screen.getByLabelText("来源材料处理")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("来源材料处理"), materialId);
    await user.selectOptions(await screen.findByRole("combobox", { name: "冲突处理 1" }), decision);
    if (decision === "use-incoming") {
      expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
      await user.type(screen.getByLabelText("替换理由 1"), "核对原始文件后替换数量");
    }
    await user.selectOptions(screen.getByRole("combobox", { name: "缺失成交处理 1" }), "keep");
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.executions.map(e => e.id).sort()).toEqual((decision === "keep-existing" ? ["old-fill"] : decision === "use-incoming" ? ["new-fill"] : ["new-fill", "old-fill"]).sort());
    expect(saved.pages[0].snapshot.materialHistory[0]).toMatchObject({ id: materialId, versions: expect.arrayContaining(before.pages[0].snapshot.materialHistory[0].versions) });
    expect(saved.pages[0].snapshot.materialHistory[0].versions).toHaveLength(2);
    expectSavedRead(h);
  }, 15000);

  it("replaces corrected times only after selecting the existing monthly material and a reason", async () => {
    const user = userEvent.setup(), existing = monthlyExecution("same-fill", "same-doc");
    const h = await saveFirstMonthly(user, [existing]);
    const before = await h.client.readTradeBook();
    const incoming = { ...existing, executedAt: "2026-03-01T08:00:00.000Z" };
    setMonthlyInput([incoming]);
    await uploadMonthly(user);
    await waitFor(() => expect(screen.getByLabelText("来源材料处理")).toBeEnabled());
    expect(screen.getByLabelText("来源材料处理")).toHaveValue("");
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    await user.selectOptions(screen.getByLabelText("来源材料处理"), before.pages[0].snapshot.materialHistory[0].id);
    await user.selectOptions(await screen.findByRole("combobox", { name: "冲突处理 1" }), "use-incoming");
    await user.type(screen.getByLabelText("替换理由 1"), "按原始凭据校正成交时刻");
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toEqual([expect.objectContaining({ id: existing.id, executedAt: incoming.executedAt, quantity: existing.quantity, price: existing.price, fee: existing.fee })]);
    expect(saved.pages[0].snapshot.materialHistory[0].versions).toHaveLength(2);
    await returnAndRemount(user, h, saved);
  }, 15000);

  it("blocks partial same-file replacement while stock classification remains unresolved", async () => {
    const user = userEvent.setup(), existing = monthlyExecution("same-fill", "same-doc");
    const h = await saveFirstMonthly(user, [existing]);
    const before = await h.client.readTradeBook();
    setMonthlyInput([existing, { ...existing, id: "unresolved-row", source: { ...existing.source, row: 2 }, instrument: cmsUnresolvedExecution.instrument }], [], [{ market: "HK", symbol: "99999", attempts: [] }]);
    await uploadMonthly(user);
    expect(await screen.findByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(1);
  });

  it("preserves monthly facts and original observations across an explicit same-file version and idempotent commit retry", async () => {
    const user = userEvent.setup(), existing = monthlyExecution("same-monthly-fill", "same-monthly-doc");
    const h = await saveFirstMonthly(user, [existing]);
    const before = await h.client.readTradeBook();
    expect(durableBook(before)).toMatchObject({ facts: [{ id: existing.id, accountId: "futu:test", instrumentId: "US:TEST", tradeNature: "live", quantity: "100", price: "15.20", fee: "5", rawEvidenceJson: expect.any(String) }] });
    const firstCommit = h.calls.journey.filter(call => call.operation === "commitTradeChanges").at(-1)!;
    const firstRequest = firstCommit.parameters as TradeChangeCommit;
    const firstReceipt = parseTradeCommitReceipt(firstCommit.result);
    expect(await h.client.getTradeCommit(firstRequest.requestId)).toEqual(firstReceipt);
    const firstMaterial = before.pages[0].snapshot.materialHistory[0];
    expect(firstMaterial.versions).toHaveLength(1);
    expect(firstMaterial.versions[0].observations).toEqual([expect.objectContaining({ originalAccountId: "futu:test", raw: { parsedExecution: existing, sourceEvidence: existing.source }, executionIds: [existing.id] })]);
    await uploadMonthly(user);
    await waitFor(() => expect(screen.getByLabelText("来源材料处理")).toBeEnabled());
    expect(screen.getByLabelText("来源材料处理")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("来源材料处理"), firstMaterial.id);
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    expect(await h.client.getTradeCommit(firstRequest.requestId)).toEqual(firstReceipt);
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.facts).toEqual(before.facts);
    expect(saved.executions).toEqual(before.executions);
    expect(saved.instruments).toEqual(before.instruments);
    expect(saved.bookVersion).toMatchObject({ databaseId: before.bookVersion.databaseId, epoch: before.bookVersion.epoch });
    expect(saved.bookVersion.sequence).toBeGreaterThan(before.bookVersion.sequence);
    const material = saved.pages[0].snapshot.materialHistory[0];
    expect(saved.pages[0].snapshot.materialHistory).toHaveLength(1);
    expect(material).toMatchObject({ id: firstMaterial.id, versions: expect.arrayContaining(firstMaterial.versions) });
    expect(material.versions).toHaveLength(2);
    expect(material.currentVersionId).not.toBe(firstMaterial.currentVersionId);
    expect(material.versions.find(version => version.id === material.currentVersionId)).toMatchObject({ supersedesVersionId: firstMaterial.currentVersionId, fileFingerprint: "same-monthly-doc", observations: [expect.objectContaining({ raw: { parsedExecution: existing, sourceEvidence: existing.source }, originalAccountId: "futu:test", executionIds: [existing.id] })] });
    expect(saved.pages[0].snapshot.withdrawnFacts).toEqual([]);
    const commit = h.calls.journey.filter(call => call.operation === "commitTradeChanges").at(-1)!;
    const request = commit.parameters as TradeChangeCommit;
    const receipt = parseTradeCommitReceipt(commit.result);
    expect(receipt).toMatchObject({ planId: request.planId, bookVersion: saved.bookVersion, result: { report: { inserted: 0, duplicate: 1, conflict: 0 } } });
    expect(receipt.result.appliedChanges).toHaveLength(2);
    expect(receipt.result.appliedChanges).toEqual(expect.arrayContaining([
      { kind: "material-version", materialId: firstMaterial.id, previousVersionId: firstMaterial.currentVersionId, versionId: material.currentVersionId },
      { kind: "link", materialId: firstMaterial.id, versionId: material.currentVersionId, observationId: material.versions.find(version => version.id === material.currentVersionId)!.observations[0].id, executionId: existing.id },
    ]));
    expectSavedRead(h);
    expect(await h.client.getTradeCommit(request.requestId)).toEqual(receipt);
    expect(await h.client.commitTradeChanges(request)).toEqual(receipt);
    expect(await h.client.getTradeCommit(request.requestId)).toEqual(receipt);
    expect(await h.client.getTradeCommit(firstRequest.requestId)).toEqual(firstReceipt);
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(saved));
    await returnAndRemount(user, h, saved);
    expect(await h.client.getTradeCommit(request.requestId)).toEqual(receipt);
  }, 15000);

  it("does not infer an exact material retry from fully unresolved monthly rows", async () => {
    const user = userEvent.setup(), existing = monthlyExecution("same-file-fill", "same-doc");
    const h = await saveFirstMonthly(user, [existing]);
    const before = await h.client.readTradeBook();
    setMonthlyInput([existing], [], [{ market: "US", symbol: "TEST", attempts: [] }]);
    await uploadMonthly(user);
    await waitFor(() => expect(screen.getByLabelText("来源材料处理")).toBeEnabled());
    expect(screen.getByLabelText("来源材料处理")).toHaveValue("");
    expect(screen.queryByText("精确重导：复用已有完整材料，成交与来源沿革不变。")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(1);
  });

  afterEach(() => {
    cleanup();
    ownedHarness?.dispose(); ownedHarness = undefined; ownedClients.current = undefined;
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    ownedClients.current = undefined;
    window.localStorage.clear();
    mockRecallRepository.documents.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => String(input) === "/api/storage/recall/summaries"
        ? Response.json({ summaries: [] })
        : { ok: true, json: async () => nextFrame }),
    );
    mockDispatcher.mockReset();
    mockEnrichment.mockReset();
    mockMarketDataSync.mockReset();
    mockSqliteClient.current = createLegacySqliteClient();
    mockMarketDataSync.mockResolvedValue({
      source: "cache",
      status: "complete",
      candles: [],
      requestedRanges: [],
    });
  });

  async function configureCurrentTradingViewCsvImport() {
    const dispatcher = await vi.importActual<typeof import('../lib/import/dispatcher')>('../lib/import/dispatcher');
    const enrichment = await vi.importActual<typeof import('../lib/import/enrich-import')>('../lib/import/enrich-import');
    mockDispatcher.mockImplementation(dispatcher.parseBrokerStatement);
    mockEnrichment.mockImplementation((statement, options) =>
      enrichment.enrichStatementImport(statement, {
        ...options,
        resolver: async () => ({
          resolved: new Map([
            ["CN-SH:600330", {
              market: "CN-SH",
              symbol: "600330",
              name: "天通股份",
              assetType: "stock",
              source: "tencent",
              confidence: "portal",
              resolvedAt: "2026-09-07T00:00:00Z",
            }],
          ]),
          unresolved: new Map(),
          cacheHits: 0,
          backgroundRefresh: Promise.resolve(),
        }),
      }),
    );
  }

  type Wire = (input: string, init: RequestInit | undefined, next: (input: string, init?: RequestInit) => Promise<Response>) => Promise<Response>;
  function bindOwned(executions: TradeExecution[] = [], wire?: Wire) {
    const h = createSqliteWorkspaceHarness({ tradeData: { executions } }); ownedHarness = h;
    const transport = (input: string, init?: RequestInit) => wire ? wire(input, init, h.fetcher) : h.fetcher(input, init);
    const client = createSqliteHttpClient(transport); ownedClients.current = { client, recallRepository: h.recallRepository };
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const path = String(input);
      if (path.startsWith("/api/storage/")) return transport(path, init);
      if (["/api/fx", "/api/trading-room/fx"].includes(path)) return Response.json({ rates: {}, asOf: "2026-10-26" });
      if (path === "/api/trading-room/reference-capital") return Response.json({ amount: null });
      throw new Error(`Unexpected candidate5 request: ${path}`);
    }));
    return { ...h, client };
  }
  const tvFileName = "回放交易_SSE_600330_2026-09-03.csv";
  function tvRows() { const bytes = new TextEncoder().encode(csv); return parseTradingViewSimulationCsv(bytes, { fileName: tvFileName, sourceFileId: fingerprintBytes(bytes) }).records; }
  function weakTvRows(kind: "W15" | "W16" | "W17"): TradeExecution[] {
    const fp = fingerprintBytes(new TextEncoder().encode(csv));
    return tvRows().map(parsed => {
      const record = { ...parsed, instrument: { ...parsed.instrument, name: "天通股份" } };
      if (kind !== "W15") return { ...record, accountId: `tradingview:${fp}`, accountLabel: `TradingView · 模拟盘 · ${fp.slice(0, 8)}`, price: kind === "W17" && record.source.row === 3 ? "999" : record.price, source: { ...record.source, simulationRole: undefined } };
      const { tradeNature: _nature, sourceTradeId: _trade, ...legacy } = record.source, role = record.source.row === 3 ? "entry" : "exit";
      return { ...record, id: `tradingview:${fp}:CN-SH:600330:1:${role}`, accountId: `tradingview:${fp}:CN-SH:600330`, accountLabel: `TradingView · 模拟盘 · ${fp.slice(0, 8)}`, executedAt: record.source.sourceTimestampText === "2021-02-19" ? "2021-02-19T07:00:00.000Z" : "2021-03-01T07:00:00.000Z", source: { ...legacy, inputKind: "statement", tradingNature: "simulated", simulationTradeId: "1", simulationRole: role, simulationRunId: `${fp}:CN-SH:600330` } };
    });
  }
  async function uploadTV(user: TestUser) {
    await openImportManagement(user);
    const file = new File([csv], tvFileName, { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(csv).buffer });
    await user.upload(await screen.findByLabelText("导入 TradingView 模拟交易"), file);
    await screen.findByRole("heading", { name: "确认导入交易记录" });
  }
  async function confirmOwned(user: TestUser) {
    const confirm = await screen.findByRole("button", { name: "确认导入并开始更新行情" });
    await waitFor(() => expect(confirm).toBeEnabled()); await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "确认导入交易记录" })).not.toBeInTheDocument());
  }
  function durableBook(book: TradeBookRead) {
    return { ...book, pages: book.pages.map(page => {
      // Read identities/times and their envelope digest vary on each read. The
      // production client validates both digests before returning these pages.
      const { receiptId, knownAt, ...receipt } = page.snapshot.receipt;
      expect(receiptId).toEqual(expect.any(String));
      expect(Number.isFinite(Date.parse(knownAt))).toBe(true);
      return { display: page.display, snapshot: { ...page.snapshot, receipt } };
    }) };
  }
  function expectSavedRead(h: ReturnType<typeof bindOwned>) {
    const commit = h.calls.journey.filter(call => call.operation === "commitTradeChanges").at(-1)!;
    const receipt = parseTradeCommitReceipt(commit.result);
    const read = h.calls.journey.find(call => call.operation === "readTradeSnapshot" && call.invocationOrder! > commit.invocationOrder! && call.delivered);
    expect(read).toMatchObject({ parameters: { version: { atLeast: receipt.bookVersion } }, invoked: true, delivered: true, status: 200 });
  }
  async function returnAndRemount(user: TestUser, h: ReturnType<typeof bindOwned>, saved: TradeBookRead) {
    await user.click(screen.getByRole("button", { name: "交易库" }));
    expect(await screen.findByRole("heading", { name: "交易库" })).toBeInTheDocument();
    cleanup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await user.click(await screen.findByRole("button", { name: "交易库" }));
    await screen.findByRole("heading", { name: "交易库" });
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(saved));
  }
  async function expectDuplicateHistory(user: TestUser) {
    await user.click(screen.getByRole("button", { name: "数据" }));
    await user.click(await screen.findByRole("button", { name: /查看导入记录/ }));
    const history = await screen.findByRole("dialog", { name: "导入记录" });
    await waitFor(() => expect(within(history).getByRole("cell", { name: "1 / 0" })).toBeInTheDocument());
    expect(within(history).getByText(/导入前重复预估 0 笔；实际核对重复 1 笔/)).toBeInTheDocument();
    expect(within(history).queryByText(/实际跳过重复/)).not.toBeInTheDocument();
    await user.click(within(history).getByRole("button", { name: "关闭导入记录" }));
  }
  function monthlyExecution(id: string, fingerprint: string): TradeExecution {
    return { ...cmsExecution, id, accountId: "futu:test", accountLabel: "富途测试账户",
      instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
      source: { platform: "futu", fileFingerprint: fingerprint, fileName: "2026-03.pdf", page: 1, row: 1, statementMonth: "2026-03", tradeNature: "live" } };
  }
  function setMonthlyInput(records: TradeExecution[], importable = records, unresolved: EnrichedImportResult["unresolved"] = []) {
    const monthly = { documentId: `futu:${records[0]?.source.fileFingerprint ?? "same-doc"}`, month: "2026-03", accountId: "futu:test", templateIds: ["F4"], positions: [], events: [], reviewRequired: false };
    mockDispatcher.mockResolvedValue({ ...cmsParsedResult, broker: "futu", records, monthly, diagnostics: [] });
    mockEnrichment.mockResolvedValue({ ...cmsEnrichedResult, broker: "futu", importable, monthly, unresolved, exclusions: [] });
  }
  async function uploadMonthly(user: TestUser) {
    await uploadStatement(user, new File(["pdf"], "2026-03.pdf", { type: "application/pdf" }));
    await user.click(await screen.findByRole("button", { name: "继续核对并导入" }));
    await screen.findByRole("heading", { name: "确认导入交易记录" });
  }
  async function saveFirstMonthly(user: TestUser, records: TradeExecution[]) {
    const h = bindOwned();
    setMonthlyInput(records);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadMonthly(user);
    await confirmOwned(user);
    return h;
  }
  async function weakTVJourney(kind: "W15" | "W16" | "W17") {
    const user = userEvent.setup(), seed = weakTvRows(kind), h = bindOwned(seed), before = await h.client.readTradeBook();
    await configureCurrentTradingViewCsvImport(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user);
    await screen.findByRole("button", { name: "确认全部为独立记录并重新准备" });
    expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
    expect((await h.client.readTradeBook()).bookVersion).toEqual(before.bookVersion);
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "确认全部为独立记录并重新准备" })); await confirmOwned(user);
    const after = await h.client.readTradeBook(); expect(after.executions).toHaveLength(4);
    for (const old of before.executions) expect(after.executions.find(e => e.id === old.id)).toEqual(old);
    const added = after.executions.filter(e => !before.executions.some(old => old.id === e.id));
    expect(added).toHaveLength(2);
    expect(new Set(after.executions.map(e => e.id)).size).toBe(4);
    for (const incoming of tvRows()) {
      expect(added.find(e => e.source.row === incoming.source.row)).toMatchObject({ ...incoming, id: expect.any(String), instrument: { ...incoming.instrument, name: "天通股份" } });
    }
    const prepares = h.calls.journey.filter(c => c.operation === "prepareTradeChanges"); expect(prepares).toHaveLength(2);
    expect(prepares[0].result).toMatchObject({ status: "review-required" }); expect(prepares[1].result).toMatchObject({ status: "ready" });
    const commits = h.calls.journey.filter(c => c.operation === "commitTradeChanges"); expect(commits).toHaveLength(1); expect(commits[0]).toMatchObject({ invoked: true, delivered: true, status: 200 });
    expect(h.calls.seed.map(c => c.operation)).toContain("seed.tradeData.compatibilityCommit");
    cleanup(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await openImportManagement(user);
    expect((await h.client.readTradeBook()).executions).toEqual(after.executions);
    expect(h.calls.journey.some(c => c.operation === "readTradeSnapshot" && c.delivered)).toBe(true);
  }
  it("reviews the unchanged migrated-shape TradingView seed before keeping it independent", () => weakTVJourney("W15"));
  it("reviews unchanged roleless current-parser IDs before keeping them independent", () => weakTVJourney("W16"));
  it("reviews the weak cross-account price collision without a finance veto", () => weakTVJourney("W17"));

  it("imports a real TradingView CSV through confirmation and restores its simulation identity", async () => {
    const user = userEvent.setup(), h = bindOwned(); await configureCurrentTradingViewCsvImport();
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user);
    expect((await h.client.readTradeBook()).executions).toEqual([]); await confirmOwned(user);
    const saved = await h.client.readTradeBook(); expect(saved.executions).toHaveLength(2);
    expect(saved.executions.every(e => e.source.platform === "tradingview" && e.source.tradeNature === "simulation")).toBe(true);
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(1);
    cleanup(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await openImportManagement(user);
    expect((await h.client.readTradeBook()).executions).toEqual(saved.executions);
  });
  it("keeps formal revision reachable after a proven TV import veto and reloads its persisted audit", async () => {
    const user = userEvent.setup(), rows = tvRows().map(e => ({ ...e, price: "999" })), h = bindOwned(rows);
    await configureCurrentTradingViewCsvImport(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user);
    await screen.findByText("同一已证明的 TradingView 来源身份存在财务矛盾。导入未保存，请通过正式成交修订核对原值、改后值与理由。");
    expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled(); expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    const before = (await h.client.readTradeBook()).executions[0]; cleanup();
    render(<StockDataDialog instrument={before.instrument} initialAccountId={before.accountId} executions={[before]} marketSummary="行情未更新" marketDetails={[]} refreshing={false} onRefresh={() => {}} onClose={() => {}} onSupplement={() => {}} retainedReviews={[]} loadHistory={tradeRepairClient.history} prepareRevision={revision => h.client.prepareTradeChanges({ kind: "revision", revision })} onRevise={async (_input, review) => { if (!review) throw new Error("Missing reviewed revision"); await h.client.commitTradeChanges({ requestId: review.requestId, planId: review.plan.planId, choices: review.choices }); }} />);
    await user.click(screen.getByRole("button", { name: "编辑成交" })); await user.clear(screen.getByLabelText("价格（CNY）")); await user.type(screen.getByLabelText("价格（CNY）"), "0");
    await user.type(screen.getByLabelText("修订原因"), "核对原凭证零价修订"); await user.click(screen.getByRole("button", { name: "预览修改" })); await user.click(await screen.findByRole("button", { name: "确认保存修订" }));
    await waitFor(async () => expect((await h.client.readTradeBook()).executions.find(e => e.id === before.id)?.price).toBe("0"));
    const history = await tradeRepairClient.history(before.instrument.id); expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "核对原凭证零价修订", changes: [{ before, after: expect.objectContaining({ price: "0" }) }] })]));
    expect(h.calls.journey.some(c => c.operation === "getTradeRevisions" && c.invoked && c.delivered && c.status === 200)).toBe(true);
    cleanup(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await openImportManagement(user);
    expect((await h.client.readTradeBook()).executions.find(e => e.id === before.id)?.price).toBe("0");
  });
  it("saves first TV evidence then blocks the successful original file before confirmation", async () => {
    const user = userEvent.setup(), h = bindOwned(tvRows()), initial = await h.client.readTradeBook(); await configureCurrentTradingViewCsvImport();
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user);
    await screen.findByText("本次将保存来源证据与沿革；成交重复不代表材料已经存在。"); await confirmOwned(user);
    const first = await h.client.readTradeBook();
    expect(first.bookVersion).toMatchObject({ databaseId: initial.bookVersion.databaseId, epoch: initial.bookVersion.epoch });
    expect(first.bookVersion.sequence).toBeGreaterThan(initial.bookVersion.sequence);
    expect(first.executions).toEqual(initial.executions);
    expectSavedRead(h);
    const firstMaterialHistory = first.pages.flatMap(page => page.snapshot.materialHistory); expect(firstMaterialHistory).not.toHaveLength(0);
    await uploadTV(user); await screen.findByText("此文件已成功导入，不能重复导入。文件名变化不会改变此结果。请取消并选择其他文件。");
    expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^取消$/ }));
    const exact = await h.client.readTradeBook(); expect(exact.bookVersion).toEqual(first.bookVersion); expect(exact.pages.flatMap(page => page.snapshot.materialHistory)).toEqual(firstMaterialHistory); expect(exact.executions).toEqual(first.executions); expect(exact.importHistory).toEqual(first.importHistory);
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(1);
  });
  it("refuses an incomplete TV v2 plan and obtains a new plan after policy changes", async () => {
    const user = userEvent.setup(); let prepareCount = 0;
    const h = bindOwned([], async (input, init, next) => {
      if (input === "/api/storage/trades/plans") {
        prepareCount += 1;
        if (prepareCount === 2) h.faults.once({ operation: "prepareTradeChanges", ordinal: 2, parameters: JSON.parse(String(init!.body)), at: "afterInvokeBeforeDelivery", effect: { throw: new StorageHttpError(409, "POLICY_CHANGED", "审核规则已更新") } });
        const response = await next(input, init); if (prepareCount === 1) { const body = parseTradePlan(await response.json(), "import"); return Response.json({ ...body, status: undefined, summary: { ...body.summary, tradingViewImport: undefined } }); } return response;
      }
      return next(input, init);
    });
    await configureCurrentTradingViewCsvImport(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user);
    await screen.findByRole("button", { name: "重新准备审核计划" }); expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重新准备审核计划" })); await screen.findByText("审核规则已更新，请重新准备计划。");
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0); await user.click(screen.getByRole("button", { name: "重新准备审核计划" })); await confirmOwned(user);
    expect(h.calls.journey.filter(c => c.operation === "prepareTradeChanges")).toHaveLength(3); expect((await h.client.readTradeBook()).executions).toHaveLength(2);
  });
  it("binds independent reprepare to the frozen preview and ignores a cancelled late response", async () => {
    const user = userEvent.setup(); let pauseNext = false, gate: ReturnType<ReturnType<typeof createSqliteWorkspaceHarness>["faults"]["once"]> | undefined;
    const h = bindOwned(weakTvRows("W16"), async (input, init, next) => {
      if (pauseNext && input === "/api/storage/trades/plans") { pauseNext = false; gate = h.faults.once({ operation: "prepareTradeChanges", ordinal: h.calls.journey.filter(c => c.operation === "prepareTradeChanges").length + 1, parameters: JSON.parse(String(init!.body)), at: "afterInvokeBeforeDelivery", effect: "pause" }); }
      return next(input, init);
    });
    await configureCurrentTradingViewCsvImport(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user);
    await user.click(await screen.findByRole("button", { name: "确认全部为独立记录并重新准备" })); await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    const inputs = h.calls.journey.filter(c => c.operation === "prepareTradeChanges").map(c => structuredClone(c.parameters) as Extract<TradeChangeIntent, { kind: "import" }>);
    expect(inputs[1].tradingViewImport?.identity).toMatchObject({ reviewPlanId: expect.any(String), inputDigest: expect.any(String), candidateIds: tvRows().map(e => e.id).sort() }); delete inputs[1].tradingViewImport!.identity; expect(inputs[1]).toEqual(inputs[0]);
    await user.click(screen.getByRole("button", { name: /^取消$/ })); pauseNext = true; await uploadTV(user); await waitFor(() => expect(gate).toBeDefined()); await gate!.reached;
    await user.click(screen.getByRole("button", { name: /^取消$/ })); await act(async () => { gate!.release(); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "确认导入交易记录" })).not.toBeInTheDocument()); expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0); expect((await h.client.readTradeBook()).executions).toHaveLength(2);
  });
  it("recovers an ambiguous saved TV request from its legacy-compatible receipt before preparing again", async () => {
    const user = userEvent.setup(); let failCommit = true;
    const h = bindOwned([], async (input, init, next) => {
      if (failCommit && input === "/api/storage/trades/commit") { failCommit = false; h.faults.once({ operation: "commitTradeChanges", ordinal: 1, parameters: JSON.parse(String(init!.body)), at: "afterInvokeBeforeDelivery", effect: { throw: new TypeError("delivery lost after saved commit") } }); }
      const response = await next(input, init);
      if (input.startsWith("/api/storage/trades/receipts")) { const value = await response.json(); if (value === null) return Response.json(null); const body = parseTradeCommitReceipt(value); return Response.json({ ...body, result: { ...body.result, tradingViewImport: undefined } }); } return response;
    });
    await configureCurrentTradingViewCsvImport(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadTV(user); await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled()); await user.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
    await user.click(await screen.findByRole("button", { name: "查询原请求并核实保存结果" })); await waitFor(() => expect(screen.queryByRole("heading", { name: "确认导入交易记录" })).not.toBeInTheDocument());
    const calls = h.calls.journey, commits = calls.filter(c => c.operation === "commitTradeChanges"), receipt = calls.find(c => c.operation === "getTradeCommit")!;
    expect(commits).toHaveLength(1); expect(commits[0]).toMatchObject({ invoked: true, delivered: false, status: 200 }); expect(receipt).toMatchObject({ invoked: true, delivered: true, status: 200 }); expect(receipt.invocationOrder).toBeGreaterThan(commits[0].invocationOrder!);
    expect((await h.client.readTradeBook()).executions).toHaveLength(2); expect(calls.filter(c => c.operation === "prepareTradeChanges")).toHaveLength(1);
    cleanup(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await openImportManagement(user); expect((await h.client.readTradeBook()).executions).toHaveLength(2);
  });

  it("imports a recognized PDF locally without asking for stock names", async () => {
    const user = userEvent.setup();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await uploadStatement(
      user,
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

  it("links statement executions to the import batch persisted with the history entry", async () => {
    const user = userEvent.setup(), h = bindOwned();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    const before = durableBook(await h.client.readTradeBook());
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toEqual([expect.objectContaining({
      id: "cms:fixture:7", source: expect.objectContaining({ batchId: "import:cms-fixture" }),
    })]);
    expect(saved.importHistory).toEqual([expect.objectContaining({ id: "import:cms-fixture", tradeCount: 1 })]);
    expectSavedRead(h);
    await returnAndRemount(user, h, saved);
  });

  it("persists only complete records and starts cache-first gap sync for the imported instrument", async () => {
    const user = userEvent.setup(), h = bindOwned();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue({ ...cmsEnrichedResult, unresolved: [{ market: "HK", symbol: "99999", attempts: [] }] });
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toEqual([expect.objectContaining({
      id: "cms:fixture:7", accountId: "cms:account-1", quantity: "100", price: "15.20", fee: "5",
      source: expect.objectContaining({ sourceOrder: 3, timePrecision: "date-only" }),
      instrument: expect.objectContaining({ id: "CN-SH:600938", name: "中国海油" }),
    })]);
    expect(saved.importHistory).toEqual([expect.objectContaining({ tradeCount: 1, instrumentCount: 1, unresolvedInstrumentCount: 1 })]);
    await waitFor(() => expect(mockMarketDataSync).toHaveBeenCalledWith(expect.objectContaining({
      instrumentId: "CN-SH:600938",
      required: requiredMarketDataRange(cmsExecution.executedAt, cmsExecution.executedAt, { open: true, market: "CN-SH" }),
    })));
    expectSavedRead(h);
  });

  it("retries only selected unresolved canonical instruments while preserving the full result", async () => {
    const user = userEvent.setup(), h = bindOwned(cmsEnrichedResult.importable);
    const before = await h.client.readTradeBook();
    const other = { ...cmsUnresolvedExecution, id: "cms:fixture:9", source: { ...cmsUnresolvedExecution.source, row: 9 }, instrument: { ...cmsUnresolvedExecution.instrument, id: "HK:88888", symbol: "88888" } };
    const parsed = { ...cmsParsedResult, records: [...cmsParsedResult.records, other] };
    const firstEnriched: EnrichedImportResult = { ...cmsEnrichedResult, unresolved: [
      { market: "HK", symbol: "99999", attempts: [] }, { market: "HK", symbol: "88888", attempts: [] },
    ] };
    const resolved = { ...cmsUnresolvedExecution, instrument: { ...cmsUnresolvedExecution.instrument, name: "测试港股" } };
    mockDispatcher.mockResolvedValue(parsed);
    mockEnrichment.mockResolvedValueOnce(firstEnriched).mockResolvedValueOnce({ ...firstEnriched, importable: [...cmsEnrichedResult.importable, resolved], unresolved: [{ market: "HK", symbol: "88888", attempts: [] }] });
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    await user.click(screen.getByLabelText("选择重新查询 88888"));
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(mockEnrichment).toHaveBeenLastCalledWith(parsed, expect.objectContaining({ forceRefresh: true, onlyInstrumentIds: ["HK:99999"], previous: firstEnriched }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    expect(screen.getByText("服务器核对重复候选 1 笔")).toBeInTheDocument();
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toHaveLength(2);
    expect(saved.executions.find(e => e.id === before.executions[0].id)).toEqual(before.executions[0]);
    expect(saved.executions.find(e => e.id === resolved.id)).toMatchObject(resolved);
    expect(parseTradeCommitReceipt(h.calls.journey.find(c => c.operation === "commitTradeChanges")!.result).result.report).toEqual({ inserted: 1, duplicate: 1, conflict: 0 });
    expect(saved.importHistory[0]).toMatchObject({ duplicateTradeCount: 0, unresolvedInstrumentCount: 1 });
    expect(h.calls.journey.filter(c => c.operation === "prepareTradeChanges")).toHaveLength(2);
    expectSavedRead(h);
    await expectDuplicateHistory(user);
    await returnAndRemount(user, h, saved);
    await expectDuplicateHistory(user);
  }, 15000);

  it("rebuilds the scoped change summary after an unresolved retry before confirmation", async () => {
    const user = userEvent.setup();
    const original: TradeExecution = { ...cmsExecution, source: { ...cmsExecution.source, tradeNature: "live" } };
    const added: TradeExecution = {
      ...original,
      id: "cms:supplement:1",
      executedAt: "2026-03-02T07:00:00.000Z",
      source: {
        ...original.source,
        fileName: "补充.pdf",
        fileFingerprint: "supplement-file",
        row: 12,
        sourceOrder: 12,
        sourceTimestampText: "2026-03-02",
      },
    };
    const otherAccount = {
      ...added,
      id: "cms:supplement:other-account",
      accountId: "other-account",
    };
    const otherInstrument = {
      ...added,
      id: "cms:supplement:other-instrument",
      instrument: {
        ...added.instrument,
        id: "CN-SH:600000",
        symbol: "600000",
      },
    };
    const firstEnriched: EnrichedImportResult = {
      broker: "china-merchants",
      importable: [],
      unresolved: [{ market: "CN-SH", symbol: "600938", attempts: [] }],
      exclusions: [],
      diagnostics: [],
      cacheHits: 0,
    };
    const retriedEnriched: EnrichedImportResult = {
      ...firstEnriched,
      importable: [added],
      unresolved: [],
      diagnostics: [{
        severity: "warning",
        code: "duplicate-trade",
        message: "同一来源重复成交",
      }],
    };
    const h = bindOwned([original]);
    const before = await h.client.readTradeBook();
    const historyBefore = await tradeRepairClient.history(original.instrument.id);
    mockDispatcher.mockResolvedValue({
      broker: "china-merchants",
      records: [added, otherAccount, otherInstrument],
      candidates: [],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    });
    mockEnrichment
      .mockResolvedValueOnce(firstEnriched)
      .mockResolvedValueOnce(retriedEnriched);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await user.click(await screen.findByRole("button", { name: "交易库" }));
    const library = await screen.findByRole("region", { name: "交易库" });
    await user.click(within(library).getByRole("tab", { name: "按标的浏览" }));
    await user.click(
      await within(library).findByRole("button", { name: "展开名称待行情源补充交易回合" }),
    );
    await user.click(
      within(library).getByRole("button", { name: /^打开名称待行情源补充第\d+次交易/ }),
    );
    await screen.findByLabelText("图表工具栏", {}, { timeout: 10000 });
    await user.click(screen.getByRole("button", { name: "检查/修复数据" }));
    const repairDialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    await user.click(within(repairDialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await user.click(screen.getByRole("button", { name: "为本股补充文件" }));
    await user.upload(
      screen.getByLabelText("导入交易记录"),
      new File(["pdf"], "补充.pdf", { type: "application/pdf" }),
    );

    await user.click(await screen.findByRole("button", { name: "重新查询" }));
    const changeSummary = await screen.findByRole("region", { name: "补充导入实际变更" });
    expect(changeSummary).toHaveTextContent("新增成交 1 笔");
    expect(changeSummary).toHaveTextContent("修订 0 笔");
    expect(changeSummary).toHaveTextContent("来源重复 1 笔");
    expect(changeSummary).toHaveTextContent("未新增成交");
    expect(changeSummary).toHaveTextContent("已有成交仍可能修订证据");
    expect(mockEnrichment).toHaveBeenLastCalledWith(
      expect.objectContaining({ records: [added] }),
      expect.objectContaining({
        forceRefresh: true,
        onlyInstrumentIds: ["CN-SH:600938"],
        previous: firstEnriched,
      }),
    );

    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    const confirm = screen.getByRole("button", { name: "确认补充当前股票成交" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "确认导入交易记录" })).not.toBeInTheDocument());
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toHaveLength(2);
    expect(saved.executions.find(e => e.id === original.id)).toEqual(before.executions[0]);
    expect(saved.executions.find(e => e.id === added.id)).toMatchObject(added);
    expect(saved.executions.some(e => [otherAccount.id, otherInstrument.id].includes(e.id))).toBe(false);
    const plan = h.calls.journey.filter(c => c.operation === "prepareTradeChanges").at(-1)!;
    expect(plan.parameters).toMatchObject({ kind: "revision", revision: {
      instrumentId: original.instrument.id, accountId: original.accountId,
      changes: [{ before: null, after: expect.objectContaining({ id: added.id }) }],
      expectedScope: before.executions,
    } });
    const history = await tradeRepairClient.history(original.instrument.id);
    expect(history).toHaveLength(historyBefore.length + 1);
    expect(history).toEqual(expect.arrayContaining([...historyBefore, expect.objectContaining({ reason: "补充导入：补充.pdf", changes: [{ before: null, after: expect.objectContaining({ id: added.id }) }] })]));
    expectSavedRead(h);
    await returnAndRemount(user, h, saved);
  }, 15000);

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
    await uploadStatement(
      user,
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

  it("disables confirmation through an unresolved retry and its new server plan", async () => {
    const user = userEvent.setup(), pendingRetry = deferred<EnrichedImportResult>();
    let gate: ReturnType<ReturnType<typeof createSqliteWorkspaceHarness>["faults"]["once"]> | undefined;
    const h = bindOwned([], async (input, init, next) => {
      if (input === "/api/storage/trades/plans" && h.calls.journey.filter(c => c.operation === "prepareTradeChanges").length === 1) gate = h.faults.once({ operation: "prepareTradeChanges", ordinal: 2, parameters: JSON.parse(String(init!.body)), at: "afterInvokeBeforeDelivery", effect: "pause" });
      return next(input, init);
    });
    const before = durableBook(await h.client.readTradeBook());
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValueOnce({ ...cmsEnrichedResult, unresolved: [{ market: "HK", symbol: "99999", attempts: [] }] }).mockReturnValueOnce(pendingRetry.promise);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    const confirm = await screen.findByRole("button", { name: "确认导入并开始更新行情" });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByText("服务器核对重复候选 0 笔")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新查询" }));
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole("region", { name: "服务器重复核对" })).not.toBeInTheDocument();
    await user.click(confirm);
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    await act(async () => { pendingRetry.resolve(cmsEnrichedResult); await pendingRetry.promise; });
    await waitFor(() => expect(gate).toBeDefined());
    await gate!.reached;
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole("region", { name: "服务器重复核对" })).not.toBeInTheDocument();
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    await act(async () => { gate!.release(); });
    await confirmOwned(user);
    expect(h.calls.journey.filter(c => c.operation === "prepareTradeChanges")).toHaveLength(2);
    expect((await h.client.readTradeBook()).executions).toHaveLength(1);
    expectSavedRead(h);
  });

  it("blocks successful original-byte reimports before confirmation and keeps cancellation safe", async () => {
    const user = userEvent.setup(), h = bindOwned();
    const fileContent = { sha256: "c".repeat(64), byteLength: 42 };
    mockDispatcher.mockResolvedValue({ ...cmsParsedResult, fileContent });
    mockEnrichment.mockResolvedValue({ ...cmsEnrichedResult, fileContent });
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "首次.pdf", { type: "application/pdf" }));
    await confirmOwned(user);
    const saved = durableBook(await h.client.readTradeBook());
    expect(h.calls.journey.filter(call => call.operation === "commitTradeChanges")).toHaveLength(1);
    await uploadStatement(user, new File(["pdf"], "重命名.pdf", { type: "application/pdf" }));
    const message = await screen.findByText("此文件已成功导入，不能重复导入。文件名变化不会改变此结果。请取消并选择其他文件。");
    expect(message).toHaveAttribute("role", "alert");
    expect(screen.queryByText("0 笔（原始预估）")).not.toBeInTheDocument();
    expect(screen.getByText("已导入，不可重复导入")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新准备审核计划" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "文件导入核对结果" })).getByRole("alert")).toBe(message);
    const confirm = screen.getByRole("button", { name: "确认导入并开始更新行情" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(h.calls.journey.filter(call => call.operation === "commitTradeChanges")).toHaveLength(1);
    expect(durableBook(await h.client.readTradeBook())).toEqual(saved);
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("heading", { name: "确认导入交易记录" })).not.toBeInTheDocument();
    expect(durableBook(await h.client.readTradeBook())).toEqual(saved);
  });

  it.each(["missing-summary", "failed"] as const)("keeps an ordinary %s prepare unknown until a successful retry", async failure => {
    const user = userEvent.setup();
    let failed = false;
    const h = bindOwned([], async (input, init, next) => {
      if (input === "/api/storage/trades/plans" && !failed) {
        failed = true;
        if (failure === "failed") throw new Error("审核暂不可用");
        const response = await next(input, init);
        const body = await response.json() as { summary: { importDuplicates?: unknown } };
        delete body.summary.importDuplicates;
        return Response.json(body);
      }
      return next(input, init);
    });
    const before = durableBook(await h.client.readTradeBook());
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    const retry = await screen.findByRole("button", { name: "重新准备审核计划" });
    const confirm = screen.getByRole("button", { name: "确认导入并开始更新行情" });
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole("region", { name: "服务器审核计划" })).not.toBeInTheDocument();
    expect(screen.queryByText("服务器核对重复候选 0 笔")).not.toBeInTheDocument();
    if (failure === "failed") expect(screen.getByText("审核暂不可用")).toHaveAttribute("role", "alert");
    await user.click(confirm);
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    await user.click(retry);
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByText("服务器核对重复候选 0 笔")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
  });

  it("does not revive cancelled ordinary duplicate review from a late prepare response", async () => {
    const user = userEvent.setup();
    let gate: ReturnType<ReturnType<typeof createSqliteWorkspaceHarness>["faults"]["once"]> | undefined;
    const h = bindOwned(cmsEnrichedResult.importable, async (input, init, next) => {
      if (input === "/api/storage/trades/plans") gate = h.faults.once({ operation: "prepareTradeChanges", ordinal: 1, parameters: JSON.parse(String(init!.body)), at: "afterInvokeBeforeDelivery", effect: "pause" });
      return next(input, init);
    });
    const before = durableBook(await h.client.readTradeBook());
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(gate).toBeDefined());
    await gate!.reached;
    expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await act(async () => { gate!.release(); });
    expect(screen.queryByRole("heading", { name: "确认导入交易记录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "服务器重复核对" })).not.toBeInTheDocument();
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
  });

  it("reviews server duplicate candidates before confirming an ordinary repeated statement", async () => {
    const user = userEvent.setup();
    let gate: ReturnType<ReturnType<typeof createSqliteWorkspaceHarness>["faults"]["once"]> | undefined;
    const h = bindOwned(cmsEnrichedResult.importable, async (input, init, next) => {
      if (input === "/api/storage/trades/plans") {
        gate = h.faults.once({ operation: "prepareTradeChanges", ordinal: 1, parameters: JSON.parse(String(init!.body)), at: "afterInvokeBeforeDelivery", effect: "pause" });
      }
      return next(input, init);
    });
    const before = durableBook(await h.client.readTradeBook());
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    const confirm = await screen.findByRole("button", { name: "确认导入并开始更新行情" });
    await waitFor(() => expect(gate).toBeDefined());
    await gate!.reached;
    expect(confirm).toBeDisabled();
    expect(screen.getByText("正在核对当前已存成交与本次候选…")).toHaveAttribute("role", "status");
    expect(screen.queryByText("服务器核对重复候选 0 笔")).not.toBeInTheDocument();
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);

    await act(async () => { gate!.release(); });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByText("服务器核对重复候选 1 笔")).toBeInTheDocument();
    const duplicates = screen.getByRole("region", { name: "服务器重复核对" });
    expect(duplicates).toHaveTextContent("中国海油");
    expect(duplicates).toHaveTextContent("招商证券 · 账户 1");
    expect(duplicates).toHaveTextContent("招商证券.pdf");
    expect(duplicates).toHaveTextContent("第 2 页");
    expect(duplicates).toHaveTextContent("第 7 行");
    expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(0);
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
  });

  it("invalidates the displayed server review when its commit plan becomes stale", async () => {
    const user = userEvent.setup();
    const h = bindOwned(cmsEnrichedResult.importable, async (input, init, next) => {
      if (input === "/api/storage/trades/commit") {
        h.faults.once({ operation: "commitTradeChanges", ordinal: 1, parameters: JSON.parse(String(init!.body)), at: "beforeInvoke", effect: { throw: new StorageHttpError(409, "BOOK_VERSION_CHANGED", "账本版本已变化") } });
      }
      return next(input, init);
    });
    const before = durableBook(await h.client.readTradeBook());
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    const confirm = await screen.findByRole("button", { name: "确认导入并开始更新行情" });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByRole("region", { name: "服务器审核计划" })).toBeInTheDocument();
    await user.click(confirm);
    await screen.findByText("已存数据或审核计划已变化。请重新准备，并再次逐项确认选择。");
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole("region", { name: "服务器审核计划" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "服务器重复核对" })).not.toBeInTheDocument();
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    await user.click(screen.getByRole("button", { name: "重新准备审核计划" }));
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getByRole("region", { name: "服务器审核计划" })).toBeInTheDocument();
    expect(h.calls.journey.filter(c => c.operation === "prepareTradeChanges")).toHaveLength(2);
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(durableBook(await h.client.readTradeBook())).toEqual(before);
  });

  it("reports server-authoritative stable-id duplicates when the same statement is imported again", async () => {
    const user = userEvent.setup(), h = bindOwned(cmsEnrichedResult.importable);
    const before = await h.client.readTradeBook();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认导入并开始更新行情" })).toBeEnabled());
    expect(screen.getByText("服务器核对重复候选 1 笔")).toBeInTheDocument();
    expect(screen.getByText("0 笔（原始预估）")).toBeInTheDocument();
    expect(durableBook(await h.client.readTradeBook())).toEqual(durableBook(before));
    await confirmOwned(user);
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toEqual(before.executions);
    expect(parseTradeCommitReceipt(h.calls.journey.find(c => c.operation === "commitTradeChanges")!.result).result.report).toEqual({ inserted: 0, duplicate: 1, conflict: 0 });
    expect(saved.importHistory[0]).toMatchObject({ duplicateTradeCount: 0 });
    expectSavedRead(h);
    await expectDuplicateHistory(user);
    await returnAndRemount(user, h, saved);
    await expectDuplicateHistory(user);
  }, 15000);

  it.each(["keep-existing", "use-incoming", "keep-both"] as const)("resolves the unchanged W24 statement overlap with %s", async decision => {
    const user = userEvent.setup(), existing = { ...cmsEnrichedResult.importable[0], id: "old-file:1", source: { ...cmsEnrichedResult.importable[0].source, row: 1, sourceOrder: 1, fileFingerprint: "old-file" } };
    const incoming = [7, 8].map(row => ({ ...cmsEnrichedResult.importable[0], id: `new-file:${row}`, source: { ...cmsEnrichedResult.importable[0].source, row, sourceOrder: row, fileFingerprint: "new-file" } }));
    const h = bindOwned([existing]); mockDispatcher.mockResolvedValue({ ...cmsParsedResult, records: incoming }); mockEnrichment.mockResolvedValue({ ...cmsEnrichedResult, importable: incoming });
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await uploadStatement(user, new File(["pdf"], "重叠区间.pdf", { type: "application/pdf" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "冲突处理 1" }), decision);
    if (decision === "use-incoming") await user.type(screen.getByLabelText("替换理由 1"), "已核对原始来源，明确替换");
    await confirmOwned(user);
    const after = await h.client.readTradeBook(); expect(after.executions.map(e => e.id).sort()).toEqual((decision === "keep-existing" ? [existing.id, incoming[1].id] : decision === "use-incoming" ? incoming.map(e => e.id) : [existing.id, ...incoming.map(e => e.id)]).sort());
    expect(h.calls.journey.filter(c => c.operation === "prepareTradeChanges")[0].result).toMatchObject({ conflicts: [expect.objectContaining({ allowed: expect.arrayContaining([decision]) })] }); expect(h.calls.journey.filter(c => c.operation === "commitTradeChanges")).toHaveLength(1);
    cleanup(); render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />); await openImportManagement(user); expect((await h.client.readTradeBook()).executions).toEqual(after.executions);
  });

  it("keeps executions and import history when post-import K-line sync fails", async () => {
    const user = userEvent.setup(), h = bindOwned();
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    mockMarketDataSync.mockRejectedValue(new Error("公开行情暂不可用"));
    render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false} />);
    await uploadStatement(user, new File(["pdf"], "招商证券.pdf", { type: "application/pdf" }));
    await confirmOwned(user);
    await waitFor(() => expect(mockMarketDataSync).toHaveBeenCalled());
    const saved = await h.client.readTradeBook();
    expect(saved.executions).toHaveLength(1);
    expect(saved.importHistory).toHaveLength(1);
    expectSavedRead(h);
    await returnAndRemount(user, h, saved);
  });

  it("advances one candle without revealing the future and preserves the cursor across periods", async () => {
    const user = userEvent.setup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    const cursorBefore = (await screen.findByTestId("replay-cursor")).textContent;

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
    rejectNextDemoReplayRequest();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.click(
      await screen.findByRole("button", { name: "下一根 K 线" }),
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
      await screen.findByRole("heading", { name: /小米集团-W/ }),
    ).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expectOnlyLocalRoomFetches();
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
    await screen.findByRole("heading", { name: /小米集团-W/ });
    await screen.findByLabelText("图表工具栏");
    expect(document.querySelector(".chart-stage")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/instruments/resolve?market=HK&symbol=1810",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(document.querySelector(".chart-stage")).toBeInTheDocument();
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
    const fallbackFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) =>
      String(input) === "/api/instruments/resolve?market=HK&symbol=1810"
        ? Promise.resolve(Response.json({
        market: "HK",
        symbol: "1810",
        name: "小米集团-W（更新）",
        assetType: "stock",
        source: "hkex",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      }))
        : fallbackFetch?.(input, init) ?? Promise.resolve(Response.json({})),
    );
    mockMarketDataSync.mockRejectedValueOnce(
      new Error("K 线更新失败"),
    );

    const view = render(
      <TradeReviewWorkspace initialFrame={initialFrame} />,
    );
    await screen.findByRole("heading", { name: /旧证券名称/ });
    await screen.findByLabelText("图表工具栏");
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));

    expect(
      (await screen.findAllByRole("heading", {
        name: /小米集团-W（更新）/,
      })).length,
    ).toBeGreaterThan(0);
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
      cache: "no-store",
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
      (await screen.findAllByRole("heading", {
        name: /小米集团-W（更新）/,
      })).length,
    ).toBeGreaterThan(0);
    expectOnlyLocalRoomFetches();
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
    const fallbackFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) =>
      String(input) === "/api/instruments/resolve?market=HK&symbol=1810"
        ? metadataResponse.promise
        : fallbackFetch?.(input, init) ?? Promise.resolve(Response.json({})),
    );
    mockDispatcher.mockResolvedValue(cmsParsedResult);
    mockEnrichment.mockResolvedValue(cmsEnrichedResult);
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: /小米旧名称/ });
    await screen.findByLabelText("图表工具栏");

    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));
    await uploadStatement(
      user,
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

    const stockSidebar = screen.getByRole("heading", { name: "我的交易" }).closest("aside");
    expect(stockSidebar).not.toBeNull();
    expect(
      await within(stockSidebar!).findByText("小米并发更新名称"),
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
    const fallbackFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) =>
      String(input) === "/api/instruments/resolve?market=HK&symbol=1810"
        ? Promise.resolve(Response.json({
        market: "HK",
        symbol: "1810",
        name: "无法持久化的新名称",
        assetType: "stock",
        source: "hkex",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      }))
        : fallbackFetch?.(input, init) ?? Promise.resolve(Response.json({})),
    );
    const client = createLegacySqliteClient();
    const mergeExecutions = vi.fn((input: { executions: TradeExecution[] }) =>
      input.executions.length > 0
        ? Promise.reject(new Error("quota"))
        : Promise.resolve({ inserted: 0, duplicate: 0, conflict: 0 }),
    );
    mockSqliteClient.current = { ...client, mergeExecutions };
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findAllByRole("heading", { name: /保存前名称/ });
    await screen.findByLabelText("图表工具栏");

    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));

    await waitFor(() => expect(mergeExecutions).toHaveBeenCalledTimes(2));
    expect(mergeExecutions.mock.calls.at(-1)?.[0].executions).toHaveLength(1);
    expect(
      screen.getAllByRole("heading", { name: /保存前名称/ }).length,
    ).toBeGreaterThan(0);
    expect(loadImportedExecutions()[0].instrument.name).toBe(
      "保存前名称",
    );
    expect(
      screen.queryByText("无法持久化的新名称"),
    ).not.toBeInTheDocument();
  });

  it("opens a stock library entry in the shared workbench without requesting market data", async () => {
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
          tradeNature: "live",
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
          tradeNature: "live",
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
          tradeNature: "live",
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
      name: /小鹏汽车/,
    });
    await user.click(screen.getByRole("button", { name: "交易库" }));

    expect(
      await screen.findByRole("heading", { name: "交易库" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "按标的浏览" }));
    await user.click(
      screen.getByRole("button", { name: "展开小鹏汽车交易回合" }),
    );
    await user.click(
      screen.getByRole("button", { name: /^打开小鹏汽车第2次交易/ }),
    );
    expect(await screen.findByLabelText("图表工具栏")).toBeInTheDocument();
    expect(screen.queryByText("当前决策首笔成交")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "持仓过程" }));
    expect(await screen.findByText("当前决策首笔成交")).toBeInTheDocument();
    expect(document.querySelector(".recall-selected-fill")).toHaveTextContent(
      "买 100 @ 11",
    );
    expectOnlyLocalRoomFetches();
  });

  it("hydrates cached candles for library stocks that are not selected in replay", async () => {
    const user = userEvent.setup();
    const executions: TradeExecution[] = [
      {
        id: "xiaomi-buy",
        source: { platform: "futu", tradeNature: "live", row: 2 },
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
        source: { platform: "futu", tradeNature: "live", row: 3 },
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
    await screen.findByRole("heading", { name: /小米集团-W/ });
    await user.click(screen.getByRole("button", { name: "交易库" }));
    await user.click(await screen.findByRole("tab", { name: "按标的浏览" }));
    await user.click(
      screen.getByRole("button", { name: "展开小鹏汽车交易回合" }),
    );
    await user.click(
      screen.getByRole("button", { name: /^打开小鹏汽车第\d+次交易/ }),
    );

    expect(await screen.findByLabelText("图表工具栏")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "行情数据详情" })).toBeInTheDocument();
    expectOnlyLocalRoomFetches();
  });

  it("opens the exact position episode in Recall without a side-note form", async () => {
    const user = userEvent.setup();
    const executions: TradeExecution[] = [
      {
        id: "xpev-review-buy",
        source: { platform: "futu", tradeNature: "live", row: 2 },
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
        source: { platform: "futu", tradeNature: "live", row: 3 },
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
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: /小鹏汽车/ });
    await user.click(screen.getByRole("button", { name: "交易库" }));
    await user.click(await screen.findByRole("tab", { name: "按标的浏览" }));
    await user.click(
      await screen.findByRole("button", {
        name: "展开小鹏汽车交易回合",
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: /^打开小鹏汽车第\d+次交易/ }),
    );

    expect(await screen.findByLabelText("图表工具栏")).toBeInTheDocument();
    expect(screen.queryByText("当前决策首笔成交")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "持仓过程" }));
    expect(await screen.findByText("当前决策首笔成交")).toBeInTheDocument();
    expect(document.querySelector(".recall-selected-fill")).toHaveTextContent(
      "买 100 @ 10",
    );
    expect(screen.queryByLabelText("买入理由")).not.toBeInTheDocument();
    expectOnlyLocalRoomFetches();
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
          tradeNature: "live",
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
          tradeNature: "live",
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
          tradeNature: "live",
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
    const client = createLegacySqliteClient();
    const putSuggestionDecision = vi.fn(client.putSuggestionDecision);
    mockSqliteClient.current = {
      ...client,
      putSuggestionDecision,
    };

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: /小鹏汽车/ });
    await user.click(screen.getByRole("button", { name: "分析" }));
    await user.click(screen.getByRole("tab", { name: "模式分析" }));
    await user.click(await screen.findByText(/待确认规则建议（/));

    expect(
      await screen.findByRole("heading", { name: "待确认规则建议" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("分批进入", { selector: "b" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "查看小鹏汽车第 1 次交易",
      }),
    );
    expect(
      await screen.findByLabelText("图表工具栏"),
    ).toBeInTheDocument();
    expect(screen.queryByText("当前决策首笔成交")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "持仓过程" }));
    expect(await screen.findByText("当前决策首笔成交")).toBeInTheDocument();
    expect(document.querySelector(".recall-selected-fill")).toHaveTextContent(
      "买 50 @ 10",
    );
    await user.click(screen.getByRole("button", { name: "分析" }));
    await user.click(screen.getByRole("tab", { name: "模式分析" }));
    await user.click(await screen.findByText(/待确认规则建议（/));
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "调整“分批进入”建议标签",
      }),
      "planned",
    );
    await user.click(
      screen.getByRole("button", { name: "确认标签改为“计划内”" }),
    );

    await waitFor(() =>
      expect(putSuggestionDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestion: expect.objectContaining({ episodeId: episode.id, status: "edited", finalTagId: "planned" }),
          review: expect.objectContaining({ episodeId: episode.id, confirmedTagIds: expect.arrayContaining(["planned"]) }),
        }),
      ),
    );

    expect(await screen.findByText("暂无待确认建议")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.every(([url]) => {
      const path = String(url);
      return path.startsWith("/api/storage/review-summaries?") || path === "/api/trading-room/reference-capital" || path === "/api/storage/recall/summaries";
    })).toBe(true);
  });
});
