import { describe, expect, it } from "vitest";
import { buildHomepageHoldings } from "../../../../../app/components/homepage-v25/holdings-model";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import { tradeNatureOf, type TradeExecution } from "../../../../../app/lib/trades/types";

// Literal counterpart of availabilityExecution + the two failed tests.
// Imports are real product functions; no services, storage repositories, or fixtures are mocked.
const returnFill: TradeExecution = {
  id: "room-holding-return", source: { platform: "futu", row: 2 },
  accountId: "acct", accountLabel: "富途",
  instrument: { id: "US:XPEV", symbol: "XPEV", name: "小鹏汽车", market: "US", currency: "USD" },
  side: "buy", executedAt: "2026-09-10T14:30:00.000Z", quantity: "10", price: "10", fee: "0",
};
const etfFill: TradeExecution = {
  ...returnFill, id: "room-etf-open", source: { platform: "futu", row: 1 },
  instrument: { id: "US:ROOM-ETF", symbol: "ROOM-ETF", name: "交易室ETF", market: "US", currency: "USD" },
};
const scope = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const empty = { categories: [], openOnly: false, pendingReview: [] };
const entries = (fill: TradeExecution) => buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill]));
const live = (fill: TradeExecution): TradeExecution => ({ ...fill, source: { ...fill.source, tradeNature: "live" } });
const options = { scope, asOf: "2026-10-23T00:00:00.000Z" };

describe("read-only diagnosis of the two unchanged legacy workspace fixtures", () => {
  it("both raw old fills are unknown and produce no homepage live groups or rows", () => {
    for (const fill of [etfFill, returnFill]) {
      expect(tradeNatureOf(fill)).toBe("unknown");
      const actual = buildHomepageHoldings(entries(fill), { ...options, attachments: empty });
      expect(actual.selection.groups).toHaveLength(0);
      expect(actual.rows).toHaveLength(0);
    }
  });
  it("explicit live plus the stored ETF metadata retains one ETF group, and excludes it from stock", () => {
    const instrumentMetadata = new Map([[etfFill.instrument.id, { market: "US" as const, symbol: "ROOM-ETF", assetType: "etf" as const }]]);
    const actual = buildHomepageHoldings(entries(live(etfFill)), { ...options, instrumentMetadata, attachments: { ...empty, categories: ["etf"] } });
    expect(actual.selection.eligibleGroups).toHaveLength(1);
    expect(actual.selection.eligibleGroups[0].category.value).toBe("etf");
    expect(actual.rows).toHaveLength(1);
    expect(actual.rows[0].assetType).toBe("etf");
    expect(actual.rows[0].identity).toBeNull();
    expect(buildHomepageHoldings(entries(live(etfFill)), { ...options, instrumentMetadata, attachments: { ...empty, categories: ["stock"] } }).rows).toHaveLength(0);
  });
  it("live return fixture has a row but cannot establish US identity until exchange evidence exists", () => {
    const actual = buildHomepageHoldings(entries(live(returnFill)), { ...options, attachments: empty });
    expect(actual.rows).toHaveLength(1);
    expect(actual.rows[0].identity).toBeNull();
    expect(actual.rows[0].identityReason).toContain("交易所证据尚未解析");
    expect(actual.rows[0].assetType).toBe("unknown");
    const resolved = buildHomepageHoldings(entries(live(returnFill)), { ...options, attachments: empty,
      exchangeByInstrument: { "US:XPEV": { code: "NYSE", source: "sec", resolvedAt: "2026-09-10T00:00:00.000Z" } },
    });
    expect(resolved.rows[0].identity).toBe("NYSE:XPEV");
  });
});
