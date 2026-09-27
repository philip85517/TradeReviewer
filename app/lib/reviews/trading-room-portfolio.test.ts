import { describe, expect, it } from "vitest";
import type { TradeLibraryEntry } from "../trades/library";
import type { Instrument, TradeEpisode, TradeExecution } from "../trades/types";
import { createDefaultRoomScope } from "./trading-room-scope";
import { buildCurrentPortfolio } from "./trading-room-portfolio";
function instrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: "US:TEST",
    symbol: "TEST",
    name: "测试标的",
    market: "US",
    currency: "USD",
    ...overrides,
  };
}

function execution(
  base: Instrument,
  side: "buy" | "sell",
  executedAt: string,
  accountId = "account-1",
): TradeExecution {
  return {
    id: `${accountId}:${side}:${executedAt}`,
    source: { platform: "fixture", row: 1 },
    accountId,
    accountLabel: accountId === "account-1" ? "主账户" : "副账户",
    instrument: base,
    side,
    executedAt,
    quantity: "2",
    price: side === "buy" ? "10" : "11",
    fee: "0",
  };
}

function openEntry(
  base: Instrument,
  startedAt: string,
  accountId = "account-1",
  netPnl = "999",
): TradeLibraryEntry {
  const executions = [execution(base, "buy", startedAt, accountId)];
  const episode: TradeEpisode = {
    id: `${accountId}:${base.id}:${startedAt}`,
    accountId,
    accountLabel: accountId === "account-1" ? "主账户" : "副账户",
    instrument: base,
    tradeNature: "live",
    direction: "long",
    status: "open",
    startedAt,
    openingQuantity: "2",
    remainingQuantity: "2",
    executions,
  };
  return {
    groupId: `${base.id}:live`,
    tradeNature: "live",
    instrument: base,
    executions,
    episodes: [{
      episode,
      metrics: {
        buyCount: 1,
        sellCount: 0,
        boughtQuantity: "2",
        soldQuantity: "0",
        grossExposure: "20",
        fees: "0",
        realizedPnl: "0",
        unrealizedPnl: netPnl,
        netPnl,
        returnPercent: "999",
        holdingMilliseconds: null,
      },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: 1,
    episodeCount: 1,
    firstTradeAt: startedAt,
    lastTradeAt: startedAt,
    status: "open",
    netPnl,
    returnPercent: "999",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

const options = { scope: createDefaultRoomScope(), asOf: "2026-09-25", quotesByInstrument: { "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-25", fetchedAt: null, provider: "fixture", freshness: "current" as const } } };
describe("buildCurrentPortfolio", () => {
 it("uses remaining cost, counts securities across accounts, and excludes closed positions", () => {
  const first = openEntry(instrument(), "2026-09-01", "a");
  const sell = execution(first.instrument, "sell", "2026-09-02", "a"); sell.quantity = "1";
  first.episodes[0].episode.executions.push(sell);
  const model = buildCurrentPortfolio([first, openEntry(instrument(), "2026-09-01", "b")], options);
  expect(model.count).toBe(1); expect(model.rows).toHaveLength(2);
  expect(model.cost.originalByCurrency).toEqual({ USD: "30" });
  expect(model.marketValue.originalByCurrency).toEqual({ USD: "36" });
  expect(model.unrealizedReturnPercent).toBe("20");
 });
 it("keeps missing price and missing cost coverage independent", () => {
  const good = openEntry(instrument(), "2026-09-01");
  const missing = openEntry(instrument({id:"US:OTHER"}), "2026-09-01");
  const model = buildCurrentPortfolio([good, missing], options);
  expect(model.coverage.marketValue.complete).toBe(false);
  expect(model.coverage.cost.complete).toBe(true);
  expect(model.marketValue.convertedCny).toBeNull();
  expect(model.marketValue.originalByCurrency).toEqual({ USD: "24" });
  expect(model.unrealizedReturnPercent).toBeNull();
  good.episodes[0].episode.accuracy = { pnl: "unavailable", reasons: ["unknown-fees"] };
  const unknownCost = buildCurrentPortfolio([good], options);
  expect(unknownCost.rows[0].marketValue).toBe("24");
  expect(unknownCost.rows[0].cost).toBeNull();
 });
 it("accepts signed verified shorts but not unsupported return denominators or negative evidence", () => {
  const short = openEntry(instrument(), "2026-09-01");
  short.episodes[0].episode.executions[0].side = "sell";
  const unknown = buildCurrentPortfolio([short], options);
  expect(unknown.rows[0].marketValue).toBeNull();
  short.episodes[0].episode.executions[0].source.positionEffect = "open-short";
  const verified = buildCurrentPortfolio([short], options);
  expect(verified.rows[0].marketValue).toBe("-24");
  expect(verified.rows[0].unrealizedReturnPercent).toBeNull();
  expect(verified.unrealizedReturnPercent).toBeNull();
 });
 it("refreshes freshness against each supplied clock and represents empty portfolios", () => {
  const model = buildCurrentPortfolio([openEntry(instrument(), "2026-09-01")], {...options, asOf:"2026-10-01"});
  expect(model.rows[0].marketValue).toBeNull();
  const empty = buildCurrentPortfolio([], options);
  expect(empty.count).toBe(0); expect(empty.marketValue.convertedCny).toBeNull();
 });
 it("filters to one simulation run and excludes fully closed positions", () => {
  const first = openEntry(instrument(), "2026-09-01");
  first.tradeNature = "simulation"; first.episodes[0].episode.tradeNature = "simulation";
  first.episodes[0].episode.simulationRunId = "run-1";
  expect(buildCurrentPortfolio([first], {...options, scope:{...options.scope,nature:"simulation",simulationRunId:"run-1"}}).count).toBe(1);
  expect(buildCurrentPortfolio([first], {...options, scope:{...options.scope,nature:"simulation",simulationRunId:"run-2"}}).count).toBe(0);
  const closed = openEntry(instrument(), "2026-09-01");
  closed.episodes[0].episode.executions.push(execution(closed.instrument, "sell", "2026-09-02"));
  expect(buildCurrentPortfolio([closed], options).empty).toBe(true);
 });
 it("requires complete FX for CNY totals and keeps cross-currency returns unavailable", () => {
  const usd = openEntry(instrument(), "2026-09-01");
  const cny = openEntry(instrument({id:"CN:TEST",currency:"CNY"}), "2026-09-01");
  const mixed = {...options,quotesByInstrument:{...options.quotesByInstrument,"CN:TEST":{...options.quotesByInstrument["US:TEST"],currency:"CNY"}}};
  const raw = buildCurrentPortfolio([usd,cny], mixed);
  expect(raw.marketValue.convertedCny).toBeNull(); expect(raw.unrealizedReturnPercent).toBeNull();
  const fx = {id:"fx",baseCurrency:"CNY" as const,asOf:"2026-09-25",source:"fixture",status:"complete" as const,rates:{"USD/CNY":"7"}};
  const converted = buildCurrentPortfolio([usd,cny], {...mixed,fxSnapshot:fx});
  expect(converted.marketValue.convertedCny).toBe("192"); expect(converted.unrealizedReturnPercent).toBe("20");
  expect(buildCurrentPortfolio([usd,cny], {...mixed,fxSnapshot:{...fx,status:"partial"}}).marketValue.convertedCny).toBeNull();
 });
 it("exposes target HKD totals while retaining the original USD values", () => {
  const usd = openEntry(instrument(), "2026-09-01");
  const fx = { id:"fx-hkd",baseCurrency:"CNY" as const,asOf:"2026-09-25",source:"fixture",status:"complete" as const,rates:{"USD/CNY":"7","HKD/CNY":"0.875"} };
  const converted = buildCurrentPortfolio([usd], {...options,fxSnapshot:fx,targetCurrency:"HKD"});
  expect(converted.marketValue).toMatchObject({ originalByCurrency: { USD: "24" }, targetCurrency: "HKD", converted: "192" });
  expect(converted.unrealizedPnl).toMatchObject({ targetCurrency: "HKD", converted: "32" });
 });
 it("does not divide by a zero remaining cost", () => {
  const free = openEntry(instrument(), "2026-09-01");
  free.episodes[0].episode.executions[0].price = "0";
  const model = buildCurrentPortfolio([free], options);
  expect(model.rows[0].cost).toBe("0"); expect(model.rows[0].unrealizedReturnPercent).toBeNull();
 });

});
