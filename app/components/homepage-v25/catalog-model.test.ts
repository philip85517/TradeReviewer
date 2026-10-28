import { describe, expect, it } from "vitest";
import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { buildHomepageCatalog, searchHomepageCatalog } from "./catalog-model";
import { ownHomepageFinancialSource } from "./financial-source-model";

const stored = (id: string, code: "NASDAQ" | "NYSE", assetType: "stock" | "etf" = "stock"): StoredInstrument => ({
  id, market: "US", symbol: "SAME", name: "同名证券", currency: "USD",
  metadata: { market: "US", symbol: "SAME", name: "同名证券", assetType, source: "sec", confidence: "official", resolvedAt: "2026-10-22T08:00:00Z", exchange: { code, source: "sec", resolvedAt: "2026-10-22T08:00:00Z" } },
});
describe("homepage known instrument catalog", () => {
  it("includes metadata-only instruments without inventing holdings, across exchanges and classes", () => {
    const catalog = buildHomepageCatalog([], [stored("one", "NASDAQ"), stored("two", "NYSE"), stored("fund", "NASDAQ", "etf")]);
    expect(catalog.items.map(item => item.identity)).toEqual(["NASDAQ:SAME:etf", "NASDAQ:SAME:stock", "NYSE:SAME:stock"]);
    expect(searchHomepageCatalog(catalog, "同名")).toHaveLength(3);
    expect(searchHomepageCatalog(catalog, "")).toEqual([]);
    expect(catalog.items.every(item => item.hasExecutions === false)).toBe(true);
    expect(catalog.identities["NASDAQ:SAME"]).toBeUndefined(); // ambiguous class cannot choose one
  });
  it("deduplicates one trustworthy identity into its exact collection rather than taking a first instrument", () => {
    const catalog = buildHomepageCatalog([], [stored("one", "NASDAQ"), stored("two", "NASDAQ")]);
    expect(catalog.items).toHaveLength(1);
    expect(catalog.identities["NASDAQ:SAME:stock"]).toEqual(["one", "two"]);
    expect(catalog.identities["NASDAQ:SAME"]).toEqual(["one", "two"]);
  });
  it("retains real imported instruments with unknown category and does not infer live or stock", () => {
    const fill: TradeExecution = { id: "buy", accountId: "catalog-account", accountLabel: "目录测试账户", instrument: { id: "CN-SH:600519", market: "CN-SH", symbol: "600519", name: "贵州茅台", currency: "CNY" }, source: { platform: "futu", row: 1 }, side: "buy", quantity: "1", price: "1", fee: "0", executedAt: "2026-10-22T01:00:00Z" };
    const catalog = buildHomepageCatalog(buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill]), {}, {}), []);
    expect(catalog.items[0]).toMatchObject({ exchange: "SSE", assetType: "unknown", identity: "SSE:600519", hasExecutions: true });
    expect(catalog.items[0].reason).toMatch(/类别/);
    expect(catalog.identities["SSE:600519"]).toEqual(["CN-SH:600519"]); // existing P1 compatibility
  });
  it("fails closed on historical invalid exchange and conflicting metadata evidence", () => {
    const invalid = stored("bad", "NASDAQ");
    Object.assign(invalid.metadata!.exchange!, { code: "US", source: "tencent", resolvedAt: "invalid" });
    const conflict = [stored("conflict", "NASDAQ"), stored("conflict", "NYSE")];
    const catalog = buildHomepageCatalog([], [invalid, ...conflict]);
    expect(catalog.items).toHaveLength(2);
    expect(catalog.items.every(item => item.identity === null && item.reason)).toBe(true);
    expect(catalog.identities).toEqual({});
  });
});

const tencentRaw: StoredInstrument = { id: "HK:00700", market: "HK", symbol: "00700", name: "腾讯控股", currency: "HKD" };
const tencentKnown: StoredInstrument = { ...tencentRaw, id: "HK:700", symbol: "700", metadata: {
  market: "HK", symbol: "700", name: "腾讯控股", assetType: "stock", source: "hkex", confidence: "official", resolvedAt: "2026-10-22T08:00:00Z",
} };
const tencentFill: TradeExecution = { id: "homepage-p1-acceptance-v1:p1-edge-markets:HK:00700:buy", accountId: "p1-edge-markets", accountLabel: "边界市场账户",
  instrument: tencentRaw, source: { platform: "futu", row: 1, tradeNature: "live" }, side: "buy", quantity: "2", price: "100", fee: "1", executedAt: "2026-10-21T16:05:00Z" };
const fromFills = (fills: TradeExecution[]) => buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});

describe("canonical catalog carrier selection", () => {
  it("keeps the literal Tencent raw fill through canonical display, catalog and S1 without proving its class", () => {
    const entries = fromFills([tencentFill]);
    expect(entries[0].instrument.id).toBe("HK:700");
    expect(entries[0].executions[0].instrument.id).toBe("HK:00700");
    const catalog = buildHomepageCatalog(entries, [tencentKnown, tencentRaw]);
    const raw = { entries, asOf: "2026-10-24T00:00:00Z", reviewSummariesComplete: false,
      instrumentMetadata: { "HK:700": { market: "HK", symbol: "700", assetType: "stock" as const } }, candlesByInstrument: {}, marketDataStatuses: {},
      fxObservations: [], currentFxSnapshot: null, lifetimeSourceCoverage: [], revisions: { trades: "t", metadata: "m", quotes: "q", fx: "f" },
      universeCoverage: { state: "unknown" as const, knownAt: null, evidenceIds: [], reasons: ["not-proven"] } };
    const scope = { live: true as const, market: "all" as const, accounts: ["p1-edge-markets"], rangeMode: "all" as const, symbolIdentity: "HKEX:700" };
    const attachments = { categories: [], openOnly: false, pendingReview: [] };
    const owned = ownHomepageFinancialSource(raw, { scope, attachments, symbolInstrumentIds: catalog.identities["HKEX:700"] });
    expect(owned.selectedEntries.flatMap(entry => entry.executions).map(fill => [fill.id, fill.instrument.id, fill.accountId, fill.quantity, fill.price, fill.fee, fill.source.tradeNature])).toEqual([
      ["homepage-p1-acceptance-v1:p1-edge-markets:HK:00700:buy", "HK:00700", "p1-edge-markets", "2", "100", "1", "live"],
    ]);
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0]).toMatchObject({ identity: "HKEX:700", assetType: "unknown", hasExecutions: true, instrumentIds: ["HK:00700", "HK:700"] });
    expect(catalog.identities["HKEX:700:stock"]).toEqual(["HK:700"]);
    expect(ownHomepageFinancialSource(raw, { scope, attachments: { ...attachments, categories: ["stock"] }, symbolInstrumentIds: catalog.identities["HKEX:700"] }).selectedEntries).toEqual([]);
  });

  it("discovers raw-only carriers without mistaking the canonical display entry for a fill", () => {
    const entries = fromFills([tencentFill]);
    const catalog = buildHomepageCatalog(entries, []);
    expect(catalog.identities["HKEX:700"]).toEqual(["HK:00700", "HK:700"]);
    expect(catalog.items[0]).toMatchObject({ identity: "HKEX:700", hasExecutions: true, assetType: "unknown" });
    expect(searchHomepageCatalog(catalog, "00700")).toHaveLength(1);
    expect(buildHomepageCatalog([], [tencentRaw]).items[0].hasExecutions).toBe(false);
  });

  it("merges known canonical aliases but partitions a real class conflict and strands unknown members", () => {
    const knownRaw = { ...tencentRaw, metadata: tencentKnown.metadata };
    const same = buildHomepageCatalog([], [tencentKnown, knownRaw]);
    expect(same.items).toHaveLength(1);
    expect(same.identities["HKEX:700:stock"]).toEqual(["HK:00700", "HK:700"]);
    const fund: StoredInstrument = { ...tencentKnown, id: "HK:0700:fund", symbol: "0700", metadata: { ...tencentKnown.metadata!, assetType: "etf" } };
    const conflict = buildHomepageCatalog([], [tencentKnown, tencentRaw, fund]);
    expect(conflict.identities).toEqual({ "HKEX:700:stock": ["HK:700"], "HKEX:700:etf": ["HK:0700:fund"] });
    expect(conflict.items.find(item => item.instrumentIds.includes("HK:00700"))).toMatchObject({ identity: null, assetType: "unknown" });
  });

  it("keeps US exchange evidence on its own raw identity and normalizes proven case aliases", () => {
    const lower = { ...stored("us-lower", "NASDAQ"), symbol: "same" };
    const unknown: StoredInstrument = { id: "us-unknown", market: "US", symbol: "same", name: "同名证券", currency: "USD" };
    const catalog = buildHomepageCatalog([], [lower, stored("us-upper", "NASDAQ"), stored("ny", "NYSE"), unknown]);
    expect(catalog.identities["NASDAQ:SAME:stock"]).toEqual(["us-lower", "us-upper"]);
    expect(catalog.identities["NYSE:SAME"]).toEqual(["ny"]);
    expect(catalog.items.find(item => item.instrumentIds.includes("us-unknown"))).toMatchObject({ identity: null, exchange: null });
  });

  it("does not combine CN exchanges or invent an exchange for unspecified CN", () => {
    const instruments = ["CN-SH", "CN-SZ", "CN"].map(market => ({ id: `${market}:000001`, market, symbol: "000001", name: "同代码", currency: "CNY" }));
    const catalog = buildHomepageCatalog([], instruments);
    expect(catalog.identities).toEqual({ "SSE:000001": ["CN-SH:000001"], "SZSE:000001": ["CN-SZ:000001"] });
    expect(catalog.items.find(item => item.market === "CN")?.identity).toBeNull();
  });

  it("rejects currency collisions and does not launder invalid same-ID evidence through a good alias", () => {
    const foreignCurrency = { ...tencentRaw, currency: "USD" };
    expect(buildHomepageCatalog([], [tencentKnown, foreignCurrency]).identities).toEqual({});
    const bad = { ...tencentRaw, metadata: { ...tencentKnown.metadata!, market: "CN-SH" as const } };
    const catalog = buildHomepageCatalog([], [tencentKnown, bad]);
    expect(catalog.identities["HKEX:700"]).toEqual(["HK:700"]);
    expect(catalog.items.find(item => item.instrumentIds.includes("HK:00700"))?.identity).toBeNull();
    const conflicting = buildHomepageCatalog([], [tencentKnown, { ...tencentKnown, symbol: "701" }]);
    expect(conflicting.identities).toEqual({});
  });

  it("does not mutate raw carriers or metadata while building navigation membership", () => {
    const entries = fromFills([structuredClone(tencentFill)]), records = [structuredClone(tencentRaw), structuredClone(tencentKnown)];
    const before = JSON.stringify({ entries, records });
    buildHomepageCatalog(entries, records);
    expect(JSON.stringify({ entries, records })).toBe(before);
    expect(entries[0].executions[0].instrument.symbol).toBe("00700");
  });
});
