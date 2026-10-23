import { describe, expect, it } from "vitest";
import { buildHomepageV25Performance as build, type HomepageV25Input } from "../../../../app/lib/reviews/homepage-v25-performance";
import type { TradeExecution } from "../../../../app/lib/trades/types";
import type { TradeLibraryEntry } from "../../../../app/lib/trades/library";

const instrument = { id: "CN:AAA", symbol: "AAA", name: "AAA", market: "CN", currency: "CNY" };
const execution = (id: string, side: "buy" | "sell", quantity: string, price: string, executedAt: string): TradeExecution => ({ id, accountId: "a", accountLabel: "A", instrument, side, quantity, price, fee: "0", executedAt, source: { platform: "statement", row: 1 } });
const base = (overrides: Partial<HomepageV25Input>): HomepageV25Input => ({ period: { start: "2026-01-01", end: "2026-01-31" }, executions: [], openingPositions: [], valuations: [], ...overrides });
const val = (kind: "period-start" | "period-end" | "current", quantity: string, price: string | null, date = "2026-01-31", instrumentId = instrument.id) => ({ kind, quantity, price, date, instrumentId, accountId: "a", currency: "CNY" });
const candle = (tradingDate: string, close: string) => ({ instrumentId: instrument.id, tradingDate, open: close, high: close, low: close, close, volume: "1", currency: "CNY", provider: "eastmoney" as const, providerSymbol: "AAA", adjustmentMode: "raw" as const, fetchedAt: `${tradingDate}T09:00:00Z` });

describe("coordinator remaining specified finance boundaries", () => {
  it("computes opening float100 + realized150 + closing float0 as net50", () => {
    const result = build(base({ openingPositions: [{ accountId: "a", instrumentId: instrument.id, direction: "long", quantity: "1", unitCost: "100", currency: "CNY" }], executions: [execution("sell", "sell", "1", "250", "2026-01-02T02:00:00Z")], valuations: [val("period-start", "1", "200", "2026-01-01"), val("period-end", "0", "250")] }));
    expect([result.openingUnrealized.value,result.periodRealized.value,result.closingUnrealized.value,result.net.value]).toEqual(["100","150","0","50"]);
  });
  it("includes timestamp-only trades by Shanghai business day", () => {
    const result = build(base({ executions: [execution("midnight", "buy", "1", "100", "2025-12-31T16:30:00Z")], valuations: [val("period-end", "1", "110")] }));
    expect(result.closingUnrealized.value).toBe("10");
    expect(result.net.value).toBe("10");
  });
  it("records available current coverage without publishing a false complete total", () => {
    const result = build(base({ openingPositions: [instrument.id,"CN:BBB"].map(instrumentId=>({accountId:"a",instrumentId,direction:"long" as const,quantity:"1",unitCost:"100",currency:"CNY"})), valuations: [val("current", "1", "110"),val("current", "1", null,"2026-01-31","CN:BBB")] }));
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.coverage).toEqual({total:2,available:1});
  });
  it("keeps a failed realized instrument unknown after a later valid opening execution", () => {
    const result = build(base({ executions: [execution("unknown-sell","sell","1","150","2026-01-02T02:00:00Z"),execution("buy","buy","1","100","2026-01-03T02:00:00Z")], valuations: [val("period-end","1","110")] }));
    expect(result.periodRealized.value).toBeNull();
    expect(result.instruments.find(row=>row.key === "a|CN:AAA")?.periodRealized.value).toBeNull();
  });
  it("aggregates multiple episodes for one account and instrument before valuation", () => {
    const oldBuy=execution("old-buy","buy","1","50","2025-12-01T02:00:00Z");
    const oldSell=execution("old-sell","sell","1","60","2025-12-02T02:00:00Z");
    const newBuy=execution("new-buy","buy","1","100","2026-01-15T02:00:00Z");
    const episode = (id:string,executions:TradeExecution[],status:"open"|"closed") => ({episode:{id,accountId:"a",accountLabel:"A",instrument,direction:"long",status,startedAt:executions[0].executedAt,openingQuantity:"1",remainingQuantity:status==="open"?"1":"0",executions},metrics:{},reviewStatus:"pending",confirmedTagIds:[],tagDictionaryVersion:1,rMultiple:null});
    const entry={instrument,executions:[oldBuy,oldSell,newBuy],episodes:[episode("old",[oldBuy,oldSell],"closed"),episode("new",[newBuy],"open")]} as unknown as TradeLibraryEntry;
    const result=build(base({entries:[entry],asOf:"2026-01-31",candlesByInstrument:{[instrument.id]:[candle("2025-12-31","70"),candle("2026-01-01","70"),candle("2026-01-31","110")]}}));
    expect(result.net.value).toBe("10");
    expect(result.currentMarketValue.value).toBe("110");
  });
});
