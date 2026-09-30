import {
  SYMBOL_IDS,
  T0_CURSOR,
  type Snapshot,
  type SymbolId,
  type TradeEvent,
} from "./running-model";

const QUANTITY_EPSILON = 1e-8;

export type ResultPoint = {
  cursor: number;
  date: string;
  equity: number;
  netValue: number;
  drawdown: number;
  cashWeight: number;
  symbolWeights: Record<SymbolId, number>;
};

export type SymbolContribution = {
  symbol: SymbolId;
  closedRoundCount: number;
  closedRoundNetPnl: number;
  partialReductionRealized: number;
  unrealizedPnl: number;
  totalPnl: number;
  hasActivity: boolean;
};

export type ResultAnalysis = {
  cursor: number;
  points: ResultPoint[];
  events: TradeEvent[];
  hasAnalyzablePeriod: boolean;
  startDate: string | null;
  endDate: string | null;
  initialAssets: number | null;
  totalAssets: number | null;
  netValue: number | null;
  cumulativeReturn: number | null;
  maxDrawdown: number | null;
  eventCount: number;
  initialExecutionCount: number;
  rebalanceCount: number;
  partialExecutionCount: number;
  unfilledExecutionCount: number;
  tradeCount: number;
  turnoverNotional: number;
  turnoverOnInitialCapital: number | null;
  cashBalance: number | null;
  cashWeight: number | null;
  cashPnl: number;
  closedRoundCount: number;
  closedRoundWins: number | null;
  closedRoundWinRate: number | null;
  closedRoundNetPnl: number | null;
  partialReductionRealized: number | null;
  openUnrealizedPnl: number | null;
  symbolContributions: SymbolContribution[];
  totalPnl: number | null;
  reconciliationDifference: number | null;
  reconcilesToLedger: boolean;
  accountingConsistent: boolean;
};

type Lot = { quantity: number; unitCost: number };
type SymbolLedger = {
  lots: Lot[];
  openRoundRealized: number;
  openRoundReductionCount: number;
  closedRoundCount: number;
  closedRoundWins: number;
  closedRoundNetPnl: number;
  hasActivity: boolean;
};

function emptySymbolLedger(): SymbolLedger {
  return {
    lots: [],
    openRoundRealized: 0,
    openRoundReductionCount: 0,
    closedRoundCount: 0,
    closedRoundWins: 0,
    closedRoundNetPnl: 0,
    hasActivity: false,
  };
}

function quantityOf(lots: readonly Lot[]): number {
  return lots.reduce((total, lot) => total + lot.quantity, 0);
}

export function clampResultCursor(
  cursor: number,
  maxCursor: number,
  ledgerLength: number,
): number {
  const ledgerMaxCursor = T0_CURSOR + Math.max(0, ledgerLength - 1);
  const availableMaxCursor = Math.max(T0_CURSOR, Math.min(maxCursor, ledgerMaxCursor));
  const finiteCursor = Number.isFinite(cursor) ? Math.floor(cursor) : T0_CURSOR;
  return Math.max(T0_CURSOR, Math.min(finiteCursor, availableMaxCursor));
}

/**
 * Calculate one portfolio result from the ledger prefix visible at R.
 * Trade P&L uses FIFO lots so open-round partial sales stay separate from
 * completed rounds. Cash yield, fees, and slippage are zero in this prototype.
 */
export function calculateResultAnalysis(
  sourceLedger: readonly Snapshot[],
  requestedCursor: number,
  maxCursor: number,
): ResultAnalysis {
  const cursor = clampResultCursor(requestedCursor, maxCursor, sourceLedger.length);
  const count = Math.max(0, Math.min(sourceLedger.length, cursor - T0_CURSOR + 1));
  const snapshots = sourceLedger.slice(0, count);
  const current = snapshots.at(-1) ?? null;
  const first = snapshots[0] ?? null;
  const initialAssets = first && Number.isFinite(first.equity) && first.equity > 0
    ? first.equity
    : null;
  const hasAnalyzablePeriod = snapshots.length > 1;

  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdownValue: number | null = null;
  const points: ResultPoint[] = snapshots.map((snapshot, index) => {
    peak = Math.max(peak, snapshot.netValue);
    const drawdown = peak > 0 ? snapshot.netValue / peak - 1 : 0;
    if (index > 0) maxDrawdownValue = maxDrawdownValue === null
      ? drawdown
      : Math.min(maxDrawdownValue, drawdown);
    const equity = snapshot.equity;
    const symbolWeights = Object.fromEntries(SYMBOL_IDS.map(symbol => {
      const holdingValue = snapshot.holdings
        .filter(holding => holding.symbol === symbol)
        .reduce((total, holding) => total + holding.value, 0);
      return [symbol, equity > 0 ? holdingValue / equity : 0];
    })) as Record<SymbolId, number>;
    return {
      cursor: T0_CURSOR + index,
      date: snapshot.date,
      equity,
      netValue: snapshot.netValue,
      drawdown,
      cashWeight: equity > 0 ? snapshot.cash / equity : 0,
      symbolWeights,
    };
  });

  const symbolLedgers = Object.fromEntries(
    SYMBOL_IDS.map(symbol => [symbol, emptySymbolLedger()]),
  ) as Record<SymbolId, SymbolLedger>;
  let turnoverNotional = 0;
  let tradeCount = 0;
  let accountingConsistent = true;

  snapshots.forEach((snapshot, index) => {
    if (index === 0) return;
    const absoluteCursor = T0_CURSOR + index;
    const currentEvents = snapshot.events.filter(event => event.cursor === absoluteCursor);
    for (const event of currentEvents) {
      if (event.executionStatus === "unfilled") continue;
      for (const trade of event.trades) {
        const state = symbolLedgers[trade.symbol];
        const delta = trade.delta;
        const notional = Math.abs(delta * trade.price);
        if (Number.isFinite(notional)) turnoverNotional += notional;
        if (Math.abs(delta) > QUANTITY_EPSILON) tradeCount += 1;
        if (!Number.isFinite(delta) || !Number.isFinite(trade.price) || trade.price <= 0) {
          accountingConsistent = false;
          continue;
        }
        state.hasActivity = true;
        if (delta > QUANTITY_EPSILON) {
          if (quantityOf(state.lots) <= QUANTITY_EPSILON) {
            state.lots = [];
            state.openRoundRealized = 0;
            state.openRoundReductionCount = 0;
          }
          state.lots.push({ quantity: delta, unitCost: trade.price });
          continue;
        }
        if (delta >= -QUANTITY_EPSILON) continue;

        let quantityToSell = -delta;
        let realized = 0;
        while (quantityToSell > QUANTITY_EPSILON && state.lots.length > 0) {
          const lot = state.lots[0];
          const matched = Math.min(quantityToSell, lot.quantity);
          realized += matched * (trade.price - lot.unitCost);
          lot.quantity -= matched;
          quantityToSell -= matched;
          if (lot.quantity <= QUANTITY_EPSILON) state.lots.shift();
        }
        if (quantityToSell > QUANTITY_EPSILON) accountingConsistent = false;
        state.openRoundRealized += realized;
        const remaining = quantityOf(state.lots);
        if (remaining <= QUANTITY_EPSILON) {
          state.closedRoundCount += 1;
          if (state.openRoundRealized > 0) state.closedRoundWins += 1;
          state.closedRoundNetPnl += state.openRoundRealized;
          state.openRoundRealized = 0;
          state.openRoundReductionCount = 0;
          state.lots = [];
        } else {
          state.openRoundReductionCount += 1;
        }
      }
    }
  });

  let openUnrealizedPnlTotal = 0;
  const symbolContributions = SYMBOL_IDS.flatMap(symbol => {
    const state = symbolLedgers[symbol];
    const ledgerHoldingQuantity = current?.holdings
      .filter(holding => holding.symbol === symbol)
      .reduce((total, holding) => total + holding.quantity, 0) ?? 0;
    const ledgerHolding = current?.holdings.find(holding => holding.symbol === symbol);
    const lotQuantity = quantityOf(state.lots);
    if (Math.abs(ledgerHoldingQuantity - lotQuantity) > 1e-6) accountingConsistent = false;
    let unrealizedPnl = 0;
    if (lotQuantity > QUANTITY_EPSILON) {
      state.hasActivity = true;
      if (!ledgerHolding || !Number.isFinite(ledgerHolding.price)) {
        accountingConsistent = false;
      } else {
        unrealizedPnl = state.lots.reduce(
          (total, lot) => total + lot.quantity * (ledgerHolding.price - lot.unitCost),
          0,
        );
      }
    }
    const partialReductionRealized = state.openRoundReductionCount > 0
      ? state.openRoundRealized
      : 0;
    const totalPnl = state.closedRoundNetPnl + partialReductionRealized + unrealizedPnl;
    openUnrealizedPnlTotal += unrealizedPnl;
    if (!state.hasActivity) return [];
    return [{
      symbol,
      closedRoundCount: state.closedRoundCount,
      closedRoundNetPnl: state.closedRoundNetPnl,
      partialReductionRealized,
      unrealizedPnl,
      totalPnl,
      hasActivity: state.hasActivity,
    } satisfies SymbolContribution];
  });

  const closedRoundCount = SYMBOL_IDS.reduce(
    (total, symbol) => total + symbolLedgers[symbol].closedRoundCount,
    0,
  );
  const closedRoundWins = SYMBOL_IDS.reduce(
    (total, symbol) => total + symbolLedgers[symbol].closedRoundWins,
    0,
  );
  const closedRoundNetPnlTotal = SYMBOL_IDS.reduce(
    (total, symbol) => total + symbolLedgers[symbol].closedRoundNetPnl,
    0,
  );
  const partialReductionRealizedTotal = SYMBOL_IDS.reduce((total, symbol) => {
    const state = symbolLedgers[symbol];
    return total + (state.openRoundReductionCount > 0 ? state.openRoundRealized : 0);
  }, 0);
  const totalPnl = current && initialAssets !== null ? current.equity - initialAssets : null;
  const symbolPnlTotal = symbolContributions.reduce((total, item) => total + item.totalPnl, 0);
  const cashPnl = 0;
  const reconciliationDifference = totalPnl === null ? null : totalPnl - symbolPnlTotal - cashPnl;
  const cashBalance = current?.cash ?? null;
  const cashWeight = current && current.equity > 0 ? current.cash / current.equity : current ? 0 : null;
  const cumulativeReturn = current && initialAssets !== null
    ? current.netValue - 1
    : null;
  const events = current?.events.filter(event => event.cursor <= cursor) ?? [];
  const initialExecutionCount = events.filter(event =>
    event.cursor === T0_CURSOR + 1 && event.executionStatus !== "unfilled",
  ).length;
  const rebalanceCount = events.filter(event =>
    event.cursor > T0_CURSOR + 1 && event.executionStatus !== "unfilled",
  ).length;
  const partialExecutionCount = events.filter(event => event.executionStatus === "partial").length;
  const unfilledExecutionCount = events.filter(event => event.executionStatus === "unfilled").length;
  const reconcilesToLedger = reconciliationDifference !== null
    && Math.abs(reconciliationDifference) <= 0.01;
  if (!reconcilesToLedger) accountingConsistent = false;

  return {
    cursor,
    points,
    events,
    hasAnalyzablePeriod,
    startDate: first?.date ?? null,
    endDate: current?.date ?? null,
    initialAssets,
    totalAssets: current?.equity ?? null,
    netValue: current?.netValue ?? null,
    cumulativeReturn,
    maxDrawdown: maxDrawdownValue,
    eventCount: events.length,
    initialExecutionCount,
    rebalanceCount,
    partialExecutionCount,
    unfilledExecutionCount,
    tradeCount,
    turnoverNotional,
    turnoverOnInitialCapital: initialAssets && initialAssets > 0
      ? turnoverNotional / initialAssets
      : null,
    cashBalance,
    cashWeight,
    cashPnl,
    closedRoundCount,
    closedRoundWins: closedRoundCount > 0 ? closedRoundWins : null,
    closedRoundWinRate: closedRoundCount > 0 ? closedRoundWins / closedRoundCount : null,
    closedRoundNetPnl: closedRoundCount > 0 ? closedRoundNetPnlTotal : null,
    partialReductionRealized: SYMBOL_IDS.some(symbol => symbolLedgers[symbol].openRoundReductionCount > 0)
      ? partialReductionRealizedTotal
      : null,
    openUnrealizedPnl: current ? openUnrealizedPnlTotal : null,
    symbolContributions,
    totalPnl,
    reconciliationDifference,
    reconcilesToLedger,
    accountingConsistent,
  };
}
