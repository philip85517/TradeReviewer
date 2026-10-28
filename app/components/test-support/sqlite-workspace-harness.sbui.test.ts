import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteWorkspaceHarness } from "./sqlite-workspace-harness";
import { createSqliteHttpClient, StorageHttpError } from "../../lib/storage/sqlite-http-client";
import { ApiInstrumentMetadataRepository, ApiMarketDataRepository } from "../../lib/storage/sqlite-repositories";
import type { TradeExecution } from "../../lib/trades/types";
import type { DailyCandleRecord, MarketCandleRecord } from "../../lib/market/contracts";
import type { ResolvedInstrument } from "../../lib/instruments/metadata-contracts";
import type { TradeBookRead } from "../../lib/storage/trade-read-contract";
import type { MarketDataJob } from "../../lib/storage/market-data-job-contract";

const instrument = { id: "CN-SH:600938", symbol: "600938", name: "中国海油", market: "CN-SH", currency: "CNY" };
const execution: TradeExecution = { id: "sbui:contract:buy", instrument, accountId: "sbui:account", accountLabel: "合同账户", side: "buy", executedAt: "2026-01-02T02:00:00.000Z", quantity: "100", price: "15.20", fee: "5", source: { platform: "china-merchants", page: 1, row: 1, tradeNature: "live" } };
const fetchedAt = "2026-01-03T08:00:00.000Z";
const daily: DailyCandleRecord = { instrumentId: instrument.id, tradingDate: "2026-01-02", open: "15.20", high: "15.60", low: "15.10", close: "15.40", volume: "10000", currency: "CNY", provider: "tencent", providerSymbol: "sh600938", adjustmentMode: "raw", fetchedAt };
const interval: MarketCandleRecord = { instrumentId: instrument.id, interval: "1h", timestamp: "2026-01-02T01:30:00.000Z", knowledgeAt: "2026-01-02T02:30:00.000Z", open: "15.20", high: "15.60", low: "15.10", close: "15.40", volume: "1000", currency: "CNY", provider: "tencent", providerSymbol: "sh600938", adjustmentMode: "raw", fetchedAt };
const coverage = [{ startDate: "2026-01-02", endDate: "2026-01-02", status: "complete" as const, provider: "tencent" as const, fetchedAt, missingTradingDates: [] }];
const intervalCoverage = [{ interval: "1h" as const, requestedStart: interval.timestamp, requestedEnd: interval.timestamp, actualStart: interval.timestamp, actualEnd: interval.timestamp, status: "complete" as const, provider: "tencent" as const, fetchedAt }];
// Read receipts describe each acquisition; the persisted book is the stable comparison.
function persistedBook(book: TradeBookRead) {
  return { bookVersion: book.bookVersion, facts: book.facts, executions: book.executions, instruments: book.instruments, importHistory: book.importHistory,
    snapshots: book.pages.map(({ snapshot: { receipt: _receipt, ...snapshot } }) => snapshot) };
}
const owned: ReturnType<typeof createSqliteWorkspaceHarness>[] = [];
function workspace() { const h = createSqliteWorkspaceHarness({ tradeData: { executions: [structuredClone(execution)], instruments: [{ ...instrument }], importHistory: [] } }); owned.push(h); return h; }
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => { for (const h of owned.splice(0)) h.dispose(); vi.unstubAllGlobals(); });

describe("SQLite workspace SBUI preflight contracts", () => {
  it("records a real empty browser migration receipt separately from journey calls while a virgin database remains unmigrated", async () => {
    const virgin = createSqliteWorkspaceHarness({}); owned.push(virgin);
    expect((await virgin.client.getBootstrap()).migration).toBeNull();
    expect(() => createSqliteWorkspaceHarness({ migratedEmpty: { sourceClientId: "invalid", sourceFingerprint: "invalid" }, tradeData: { executions: [] } })).toThrow("mutually exclusive");
    const source = { sourceClientId: "sbui:empty:contract", sourceFingerprint: "sbui:empty:contract:fp" };
    const h = createSqliteWorkspaceHarness({ migratedEmpty: source }); owned.push(h);
    expect(h.calls.journey).toEqual([]);
    expect(h.calls.seed.map(call => call.operation)).toEqual(["seed.emptyMigration.write", "seed.emptyMigration.receipt", "seed.emptyMigration.readback", "seed.emptyMigration.status"]);
    const report = h.calls.seed[0].result;
    const receipt = await h.client.getTradeCommit(`browser:${source.sourceFingerprint}`);
    expect(receipt).not.toBeNull();
    expect(h.calls.seed[1].result).toEqual(receipt);
    const home = await h.client.getHomepageSource();
    expect(home.bookVersion).toEqual(receipt!.bookVersion);
    expect(home.bootstrap.migration).toEqual(report);
    expect(home.bootstrap.migration).toMatchObject({ sourceFingerprint: source.sourceFingerprint, inserted: 0, failed: 0, validationDigest: expect.any(String) });
    expect(home.receipt.counts).toEqual({ executions: 0, instruments: 0, importHistory: 0, legacyReviewRows: 0, recallDocuments: 0 });
    expect(home.tradeReadPages[0].snapshot).toMatchObject({ facts: [], materials: [], materialHistory: [] });
    expect(h.calls.seed[2].result).toMatchObject({ bookVersion: home.bookVersion, bootstrap: home.bootstrap, recallSummaries: home.recallSummaries });
    expect((h.calls.seed[2].result as typeof home).tradeReadPages.map(page => page.snapshot.facts)).toEqual(home.tradeReadPages.map(page => page.snapshot.facts));
    expect(h.calls.seed[3].result).toEqual(await h.client.getStatus());
    expect(h.calls.seed.every(call => call.delivered && call.phase === "seed")).toBe(true);
    expect(h.calls.journey.every(call => call.phase === "journey")).toBe(true);
  });

  it("round-trips daily and interval caches, coverage, provider symbols and jobs through the same Store without advancing the trade book", async () => {
    const h = workspace(), separate = workspace();
    const repository = new ApiMarketDataRepository(h.client);
    const rebuilt = new ApiMarketDataRepository(createSqliteHttpClient(h.fetcher));
    const before = await h.client.readTradeBook();
    await repository.commitSyncResult({ instrumentId: instrument.id, candles: [daily], coverage, providerSymbol: { provider: "tencent", symbol: "sh600938" } });
    await repository.commitIntervalSyncResult({ instrumentId: instrument.id, interval: "1h", candles: [interval], coverage: intervalCoverage, providerSymbol: { provider: "tencent", symbol: "sh600938" } });
    expect(await rebuilt.getDailyMarketData(instrument.id, "2026-01-02", "2026-01-02")).toEqual({ candles: [daily], coverage });
    expect(await rebuilt.getIntervalMarketData(instrument.id, "1h", interval.timestamp, interval.timestamp)).toEqual({ candles: [interval], coverage: intervalCoverage });
    expect(await rebuilt.getProviderSymbol(instrument.id, "tencent")).toBe("sh600938");
    expect(await rebuilt.getProviderSymbol(instrument.id, "yahoo")).toBeUndefined();
    expect(await rebuilt.getDailyCandles(instrument.id, "2026-01-03", "2026-01-03")).toEqual([]);
    expect(await new ApiMarketDataRepository(separate.client).getDailyCandles(instrument.id, "2026-01-02", "2026-01-02")).toEqual([]);
    const syncing: MarketDataJob = { instrumentId: instrument.id, symbol: instrument.symbol, market: instrument.market, requestedAt: fetchedAt, status: "syncing", intervals: [{ interval: "1D", status: "syncing" }, { interval: "1h", status: "syncing" }] };
    expect(await h.client.putMarketDataJob(syncing)).toEqual(syncing);
    const completed: MarketDataJob = { ...syncing, status: "complete", intervals: syncing.intervals.map(part => ({ ...part, status: "complete" })) };
    expect(await h.client.putMarketDataJob(completed)).toEqual(completed);
    expect((await h.client.getBootstrap()).marketDataJobs).toEqual([completed]);
    const after = await h.client.readTradeBook();
    expect(persistedBook(after)).toEqual(persistedBook(before));
    expect(h.calls.journey.filter(call => ["putMarketData", "putMarketDataJob"].includes(call.operation)).every(call => call.delivered && call.status === 200)).toBe(true);
  });

  it("round-trips metadata through the real repository while preserving canonical names and trade facts", async () => {
    const h = workspace(), before = await h.client.readTradeBook();
    const record: ResolvedInstrument = { market: "CN-SH", symbol: "600938", name: "供应方名称", assetType: "stock", source: "tencent", confidence: "portal", resolvedAt: fetchedAt };
    await new ApiInstrumentMetadataRepository(h.client).put(record);
    const readback = await new ApiInstrumentMetadataRepository(createSqliteHttpClient(h.fetcher)).getMany([instrument.id]);
    expect(readback.get(instrument.id)).toEqual(record);
    expect(readback.size).toBe(1);
    const after = await h.client.readTradeBook();
    expect(after.bookVersion).toEqual(before.bookVersion);
    expect(after.facts).toEqual(before.facts);
    expect(after.executions).toEqual(before.executions);
    expect(after.instruments[0]).toMatchObject({ id: instrument.id, name: instrument.name, metadata: record });
    expect(h.calls.journey.filter(call => /InstrumentMetadata$/.test(call.operation)).map(call => [call.operation, call.status, call.delivered])).toEqual([["putInstrumentMetadata", 200, true], ["getInstrumentMetadata", 200, true]]);
  });

  it("rejects unknown instruments and unsupported cache operations without publishing acknowledgements or changing stored state", async () => {
    const h = workspace(), before = await h.client.readTradeBook();
    const repository = new ApiMarketDataRepository(h.client);
    await expect(repository.getCandles("CN-SH:missing", "1h", interval.timestamp, interval.timestamp)).rejects.toMatchObject({ name: "StorageHttpError", status: 404, code: "not-found" });
    await expect(repository.commitSyncResult({ instrumentId: "CN-SH:missing", candles: [{ ...daily, instrumentId: "CN-SH:missing" }], coverage: [] })).rejects.toBeInstanceOf(StorageHttpError);
    await expect(repository.commitIntervalSyncResult({ instrumentId: instrument.id, interval: "1h", candles: [{ ...interval, interval: "15m" }], coverage: [] })).rejects.toMatchObject({ status: 400, code: "invalid-request" });
    const unsupported: [string, RequestInit | undefined][] = [
      [`/api/storage/market-data?instrumentId=${instrument.id}&provider=tencent&interval=1h`, undefined],
      [`/api/storage/market-data?instrumentId=${instrument.id}&interval=1h&extra=1`, undefined],
      ["/api/storage/market-data", { method: "PUT", body: JSON.stringify({ kind: "unknown" }) }],
      ["/api/storage/market-data", { method: "DELETE", body: "{}" }],
      ["/api/storage/unlisted", undefined],
      ["/api/storage/instruments/metadata?id=CN-SH:600938&extra=1", undefined],
    ];
    for (const [url, init] of unsupported) await expect(h.fetcher(url, init)).rejects.toThrow("Unsupported workspace operation");
    const errors = h.calls.journey.filter(call => call.typedError || call.transportError);
    expect(errors).toHaveLength(3 + unsupported.length);
    expect(errors.filter(call => call.transportError).every(call => !call.invoked && !call.delivered && call.status === undefined)).toBe(true);
    expect(errors.filter(call => call.typedError).map(call => call.status)).toEqual([404, 404, 400]);
    expect(persistedBook(await h.client.readTradeBook())).toEqual(persistedBook(before));
    expect(await repository.getDailyCandles(instrument.id, "2026-01-02", "2026-01-02")).toEqual([]);
    expect(await repository.getIntervalCoverage(instrument.id, "1h")).toEqual([]);
    expect((await h.client.getBootstrap()).marketDataJobs).toEqual([]);
  });
});
