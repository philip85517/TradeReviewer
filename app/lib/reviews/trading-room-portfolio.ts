import Decimal from "decimal.js";
import type { TradeLibraryEntry } from "../trades/library";
import { buildTradingRoomHoldings, type TradingRoomHoldingRow, type TradingRoomHoldingsOptions } from "./trading-room-holdings";
import { buildRoomMoneyView, roomMoneyValue, type RoomFxSnapshot, type RoomMoneyView, type RoomTargetCurrency } from "./trading-room-scope";

export type CurrentPortfolioOptions = TradingRoomHoldingsOptions & { fxSnapshot?: RoomFxSnapshot; targetCurrency?: RoomTargetCurrency };
export type CurrentPortfolioRow = {
  holding: TradingRoomHoldingRow;
  marketValue: string | null;
  cost: string | null;
  unrealizedPnl: string | null;
  unrealizedReturnPercent: string | null;
  reasons: string[];
};
export type PortfolioCoverage = { available: number; total: number; complete: boolean };
export type CurrentPortfolioModel = ReturnType<typeof buildCurrentPortfolio>;

function ratio(pnl: string | null, cost: string | null): string | null {
  return pnl !== null && cost !== null && new Decimal(cost).gt(0)
    ? new Decimal(pnl).div(cost).mul(100).toDecimalPlaces(8).toString() : null;
}

/** Current gross mark-to-cost PnL excludes fees; remaining long cost is its return denominator. */
export function buildCurrentPortfolio(entries: readonly TradeLibraryEntry[], options: CurrentPortfolioOptions) {
  const projection = buildTradingRoomHoldings(entries, options);
  const active = projection.rows.filter(row => row.quantity === null || !new Decimal(row.quantity).isZero());
  const holdings = {
    ...projection, rows: active,
    groups: projection.groups.map(group => ({ ...group, rows: group.rows.filter(row => active.includes(row)) })).filter(group => group.rows.length),
    availablePnlCount: active.filter(row => row.unrealizedPnlStatus === "available").length,
    unavailablePnlCount: active.filter(row => row.unrealizedPnlStatus !== "available").length,
  };
  const rows: CurrentPortfolioRow[] = active.map(holding => {
    const trusted = holding.direction !== "unknown" && holding.quantity !== null;
    const marketValue = trusted && holding.quoteStatus === "available" && holding.quote?.price
      ? new Decimal(holding.quantity!).mul(holding.quote.price).toDecimalPlaces(8).toString() : null;
    const cost = trusted && holding.costStatus === "available" && holding.averageCost !== null
      ? new Decimal(holding.quantity!).mul(holding.averageCost).toDecimalPlaces(8).toString() : null;
    const unrealizedPnl = marketValue !== null && cost !== null
      ? new Decimal(marketValue).minus(cost).toDecimalPlaces(8).toString() : null;
    const unrealizedReturnPercent = holding.direction === "long" ? ratio(unrealizedPnl, cost) : null;
    return { holding, marketValue, cost, unrealizedPnl, unrealizedReturnPercent,
      reasons: [...new Set([
        ...(holding.statusReason ? [holding.statusReason] : []),
        ...(holding.direction === "short" ? ["空头净市值带负号；空头收益率分母暂不支持"] : []),
        ...(cost !== null && new Decimal(cost).isZero() ? ["剩余持仓成本为零，收益率不可用"] : []),
      ])],
    };
  });
  const keys = ["marketValue", "cost", "unrealizedPnl"] as const;
  const coverage = Object.fromEntries(keys.map(key => [key, {
    available: rows.filter(row => row[key] !== null).length,
    total: rows.length,
    complete: rows.every(row => row[key] !== null),
  }])) as Record<typeof keys[number], PortfolioCoverage>;
  const money = (key: typeof keys[number]): RoomMoneyView => buildRoomMoneyView(rows.map(row => ({
    currency: row.holding.settlementCurrency ?? "", amount: row[key],
  })), options.fxSnapshot, options.targetCurrency);
  const marketValue = money("marketValue");
  const cost = money("cost");
  const unrealizedPnl = money("unrealizedPnl");
  const scalar = (view: RoomMoneyView) => options.targetCurrency || options.fxSnapshot ? roomMoneyValue(view)
    : Object.keys(view.originalByCurrency).length === 1 ? Object.values(view.originalByCurrency)[0] : null;
  const unrealizedReturnPercent = coverage.cost.complete && coverage.unrealizedPnl.complete && rows.every(row => row.holding.direction === "long")
    ? ratio(scalar(unrealizedPnl), scalar(cost)) : null;
  return { holdings, rows, marketValue, cost, unrealizedPnl, unrealizedReturnPercent, coverage,
    count: new Set(rows.map(row => row.holding.instrumentId)).size,
    complete: keys.every(key => coverage[key].complete),
    empty: rows.length === 0,
    asOf: options.asOf ?? new Date().toISOString(),
    basis: "市值为多空净市值；成本为带符号的剩余持仓成本；未实现盈亏不扣交易费用；收益率仅支持多头剩余成本分母。",
  };
}
