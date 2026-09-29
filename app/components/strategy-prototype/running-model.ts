import type { Time } from "lightweight-charts";
import type { StrategyId } from "./creation-prototype";

export type RunningDraft = {
  date: string;
  collection: "review" | "watchlist";
  capital: string;
  horizon: string;
  blind: boolean;
  scenario: "complete" | "missing" | "partial" | "empty";
  selected: StrategyId[];
  presets: Record<StrategyId, string>;
};

export type RuntimeProgress = {
  status: string;
  knownDate: string;
  viewDate: string;
  completed?: boolean;
  exposure?: { date: string; source: string; time: string };
};

export type SourceExposure = {
  experimentName: string;
  knownDate: string;
  time?: string;
};

export const STRATEGY_PORTFOLIO_IDS = {
  ema: "strategy-portfolio-ema-main",
  quality: "strategy-portfolio-quality-main",
} as const;

export const DEMO_PORTFOLIO_IDS = {
  longName: "demo-portfolio-long-name",
  extraEma: "demo-portfolio-extra-ema",
  extraQuality: "demo-portfolio-extra-quality",
  extraBalanced: "demo-portfolio-extra-balanced",
} as const;

export type PortfolioId = (typeof STRATEGY_PORTFOLIO_IDS)[keyof typeof STRATEGY_PORTFOLIO_IDS]
  | (typeof DEMO_PORTFOLIO_IDS)[keyof typeof DEMO_PORTFOLIO_IDS];

export type PortfolioIdentity = {
  id: PortfolioId;
  name: string;
  strategy: StrategyId;
  demoOnly: boolean;
  capitalMultiplier: number;
};

export const SYMBOL_IDS = ["A", "B", "C", "D"] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];
export type Bar = { time: Time; date: string; open: number; high: number; low: number; close: number };
export type Position = { symbol: SymbolId; quantity: number; price: number; value: number };
export type Trade = { symbol: SymbolId; delta: number; price: number };
export type ExecutionOverride = { cursor: number; kind: "partial" | "unfilled" };
export type ExecutionStatus = "filled" | "partial" | "unfilled";
export type TradeEvent = {
  cursor: number;
  date: string;
  reason: string;
  oldWeight: string;
  targetWeight: string;
  actualWeight: string;
  trades: Trade[];
  executionStatus?: ExecutionStatus;
  executionNote?: string;
  plannedTrades?: Trade[];
};
export type Snapshot = { date: string; cash: number; holdings: Position[]; equity: number; netValue: number; events: TradeEvent[] };
export type Calendar = {
  bars: Record<SymbolId, Bar[]>;
  dates: string[];
  cutoffIndex: number;
  endIndex: number;
  nominalEnd: string;
};
export type PortfolioMetrics = {
  totalAssets: number;
  cumulativeReturn: number;
  dailyAmount: number | null;
  dailyReturn: number | null;
  cashRatio: number;
};

export const T0_CURSOR = 19;
export const STRATEGY_NAMES: Record<StrategyId, string> = { ema: "EMA20 v1.4", quality: "低波动质量 v2.1" };
const SYMBOLS: readonly SymbolId[] = SYMBOL_IDS;

export function portfolioSymbols(draft: Pick<RunningDraft, "scenario">, strategy: StrategyId): SymbolId[] {
  if (draft.scenario === "empty" || (draft.scenario === "missing" && strategy === "ema")) return [];
  if (draft.scenario === "partial") return strategy === "ema" ? ["A", "B", "C"] : ["A", "B", "D"];
  return ["A", "B"];
}

function dateText(date: Date): string { return date.toISOString().slice(0, 10); }
function weekday(date: Date): boolean { return date.getUTCDay() !== 0 && date.getUTCDay() !== 6; }
function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
function nominalEnd(start: Date, horizon: string): Date {
  if (horizon === "1 周") return addDays(start, 7);
  const months = horizon === "1 个月" ? 1 : horizon === "3 个月" ? 3 : horizon === "半年" ? 6 : 12;
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return target;
}

// UTC is only a calendar arithmetic container: the input itself is Shanghai wall time.
export function makeCalendar(draft: RunningDraft): Calendar {
  const [day, clock] = draft.date.split("T");
  const selectedDate = new Date(`${day}T00:00:00Z`);
  const hour = Number(clock.split(":")[0]);
  let cutoff = selectedDate;
  if (weekday(cutoff) && hour < 15) cutoff = addDays(cutoff, -1);
  while (!weekday(cutoff)) cutoff = addDays(cutoff, -1);
  const end = nominalEnd(selectedDate, draft.horizon);
  const dates: string[] = [];
  let context = cutoff;
  while (dates.length < T0_CURSOR + 1) {
    if (weekday(context)) dates.unshift(dateText(context));
    context = addDays(context, -1);
  }
  // A same-date opening is never executed retroactively, including an intraday T0.
  for (let future = addDays(selectedDate, 1); future <= end; future = addDays(future, 1)) {
    if (weekday(future)) dates.push(dateText(future));
  }
  const bars: Record<SymbolId, Bar[]> = { A: [], B: [], C: [], D: [] };
  const priceCurves: Record<SymbolId, { base: number; drift: number; phase: number }> = {
    A: { base: 94, drift: 0.075, phase: 0 },
    B: { base: 73, drift: 0.045, phase: 2.3 },
    C: { base: 51, drift: 0.052, phase: 1.1 },
    D: { base: 126, drift: 0.061, phase: 3.2 },
  };
  for (const symbol of SYMBOLS) {
    bars[symbol] = dates.map((date, index) => {
      const curve = priceCurves[symbol];
      const base = curve.base + index * curve.drift
        + Math.sin(index / 2.9 + curve.phase) * 2.6 + Math.cos(index / 6.1 + curve.phase) * 1.4;
      const open = Math.max(20, base + Math.sin(index * 1.7 + curve.phase) * 0.55);
      const close = Math.max(20, open + Math.sin(index / 1.8 + curve.phase) * 1.15);
      return { time: date as Time, date, open, close,
        high: Math.max(open, close) + 0.8, low: Math.min(open, close) - 0.7 };
    });
  }
  return { bars, dates, cutoffIndex: T0_CURSOR, endIndex: dates.length - 1, nominalEnd: dateText(end) };
}

function weights(symbols: SymbolId[], values: number[], cash: number, equity: number): string {
  const holdings = symbols.map((symbol, index) => `${symbol} ${(values[index] / equity * 100).toFixed(1)}%`);
  return `${holdings.join(" / ")} / 现金 ${(cash / equity * 100).toFixed(1)}%`;
}

function hasPlannedExecution(day: number, followsStrategy: boolean, cadence: number): boolean {
  return day === 1 || (followsStrategy && day % cadence === 0);
}

export function nextExecutionCursor(
  calendar: Calendar,
  fromCursor: number,
  draft: RunningDraft,
  strategy: StrategyId,
): number | null {
  if (portfolioSymbols(draft, strategy).length === 0) return null;
  const followsStrategy = draft.presets[strategy].startsWith("随策略");
  const cadence = strategy === "ema" ? 5 : 20;
  const afterCursor = Number.isFinite(fromCursor) ? Math.floor(fromCursor) : T0_CURSOR;
  const startCursor = Math.max(T0_CURSOR + 1, afterCursor + 1);

  for (let cursor = startCursor; cursor <= calendar.endIndex; cursor += 1) {
    if (hasPlannedExecution(cursor - T0_CURSOR, followsStrategy, cadence)) return cursor;
  }
  return null;
}

// Each independent ledger shares only the calendar. Signals are a fixed demonstration
// template, known before the execution day; they do not inspect that day's close.
export function buildLedger(
  calendar: Calendar,
  maxCursor: number,
  draft: RunningDraft,
  strategy: StrategyId,
  overrides: readonly ExecutionOverride[] = [],
): Snapshot[] {
  const initial = Number(draft.capital);
  const investSymbols = portfolioSymbols(draft, strategy);
  const overrideByCursor = new Map<number, ExecutionOverride["kind"]>();
  for (const override of overrides) {
    if (
      Number.isInteger(override.cursor) &&
      override.cursor > T0_CURSOR &&
      override.cursor <= calendar.endIndex &&
      (override.kind === "partial" || override.kind === "unfilled")
    ) {
      overrideByCursor.set(override.cursor, override.kind);
    }
  }
  let cash = initial;
  let quantities = SYMBOLS.map(() => 0);
  const events: TradeEvent[] = [];
  const snapshots: Snapshot[] = [{ date: draft.date.slice(0, 10), cash, holdings: [], equity: initial, netValue: 1, events: [] }];
  const cadence = strategy === "ema" ? 5 : 20;
  const cashWeight = strategy === "ema" ? 0.1 : 0.2;
  const followsStrategy = draft.presets[strategy].startsWith("随策略");
  for (let cursor = T0_CURSOR + 1; cursor <= maxCursor; cursor += 1) {
    const day = cursor - T0_CURSOR;
    const opening = SYMBOLS.map(symbol => calendar.bars[symbol][cursor].open);
    const shouldTrade = investSymbols.length > 0 && hasPlannedExecution(day, followsStrategy, cadence);
    if (shouldTrade) {
      const oldValues = quantities.map((quantity, index) => quantity * opening[index]);
      const openingEquity = cash + oldValues.reduce((sum, value) => sum + value, 0);
      const baseWeight = (1 - cashWeight) / investSymbols.length;
      // Partial samples keep additional names at their equal-weight target while
      // later synthetic rebalances tilt only the first two candidates.
      const tilt = investSymbols.length < 2 || day === 1 ? 0 : Math.floor(day / cadence) % 2 === 1 ? 0.1 : -0.1;
      const targetWeights = investSymbols.map((_, index) => baseWeight + (index === 0 ? tilt : index === 1 ? -tilt : 0));
      const nextQuantities = [...quantities];
      const plannedTrades = investSymbols.map((symbol, index) => {
        const symbolIndex = SYMBOLS.indexOf(symbol);
        nextQuantities[symbolIndex] = openingEquity * targetWeights[index] / opening[symbolIndex];
        return { symbol, delta: nextQuantities[symbolIndex] - quantities[symbolIndex], price: opening[symbolIndex] };
      });
      const oldValuesForPortfolio = investSymbols.map(symbol => oldValues[SYMBOLS.indexOf(symbol)]);
      const oldWeight = weights(investSymbols, oldValuesForPortfolio, cash, openingEquity);
      const overrideKind = overrideByCursor.get(cursor);
      let trades = plannedTrades;
      if (overrideKind === "partial") {
        trades = plannedTrades
          .map(trade => ({ ...trade, delta: trade.delta * 0.5 }))
          .filter(trade => Math.abs(trade.delta) > Number.EPSILON);
        const filledDeltas = new Map(trades.map(trade => [trade.symbol, trade.delta]));
        quantities = quantities.map((quantity, index) =>
          quantity + (filledDeltas.get(SYMBOLS[index]) ?? 0),
        );
        cash = openingEquity - quantities.reduce((sum, quantity, index) => sum + quantity * opening[index], 0);
      } else if (overrideKind === "unfilled") {
        trades = [];
      } else {
        cash = openingEquity - nextQuantities.reduce((sum, quantity, index) => sum + quantity * opening[index], 0);
        quantities = nextQuantities;
      }
      const actualValues = investSymbols.map(symbol => quantities[SYMBOLS.indexOf(symbol)] * opening[SYMBOLS.indexOf(symbol)]);
      const event: TradeEvent = { cursor, date: calendar.dates[cursor],
        reason: day === 1 ? "T0 已确定初始目标，下一交易日开盘建仓" : `前一交易日已定模板：每 ${cadence} 个合成交易日开盘再平衡`,
        oldWeight, targetWeight: weights(investSymbols, targetWeights.map(weight => weight * openingEquity), cashWeight * openingEquity, openingEquity),
        actualWeight: weights(investSymbols, actualValues, cash, openingEquity), trades };
      if (overrideKind === "partial") {
        event.executionStatus = "partial";
        event.executionNote = "演示部分成交：每笔计划差量仅执行 50%，剩余部分未成交；不含费用或真实撮合。";
        event.plannedTrades = plannedTrades;
      } else if (overrideKind === "unfilled") {
        event.executionStatus = "unfilled";
        event.executionNote = "演示未成交：计划保留但没有任何实际成交；不含费用或真实撮合。";
        event.plannedTrades = plannedTrades;
      }
      events.push(event);
    }
    const holdings = quantities.every(quantity => quantity === 0) ? [] : SYMBOLS.flatMap((symbol, index) => {
      if (quantities[index] === 0) return [];
      const price = calendar.bars[symbol][cursor].close;
      return [{ symbol, quantity: quantities[index], price, value: quantities[index] * price }];
    });
    const equity = cash + holdings.reduce((sum, holding) => sum + holding.value, 0);
    snapshots.push({ date: calendar.dates[cursor], cash, holdings, equity, netValue: equity / initial, events: [...events] });
  }
  return snapshots;
}

// One calculation feeds the running summary and downstream result views.
export function portfolioMetrics(snapshots: Snapshot[], snapshotIndex: number): PortfolioMetrics {
  const current = snapshots[snapshotIndex];
  const previous = snapshotIndex > 0 ? snapshots[snapshotIndex - 1] : null;
  return {
    totalAssets: current.equity,
    cumulativeReturn: current.netValue - 1,
    dailyAmount: previous ? current.equity - previous.equity : null,
    dailyReturn: previous ? (current.equity - previous.equity) / previous.equity : null,
    cashRatio: current.equity === 0 ? 0 : current.cash / current.equity,
  };
}
