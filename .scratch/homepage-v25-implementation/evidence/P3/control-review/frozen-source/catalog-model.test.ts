import { describe, expect, it } from "vitest";
import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { buildHomepageCatalog, searchHomepageCatalog } from "./catalog-model";

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
    expect(catalog.items[0]).toMatchObject({ exchange: "SSE", assetType: "unknown", identity: null, hasExecutions: true });
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
