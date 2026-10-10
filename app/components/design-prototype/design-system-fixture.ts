import type { Candle } from "../../lib/market/types";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import {
  NO_REVEALED_EXECUTIONS,
  revealableCandlesThroughCursor,
  visibleRecallExecutions,
} from "../../lib/replay/recall-replay";
import { visibleDrawingsAtCursor } from "../../lib/chart/drawings";
import type { TradeExecution, Instrument } from "../../lib/trades/types";
import { buildRoomMoneyView, type RoomScope } from "../../lib/reviews/trading-room-scope";
import { buildRoomMoneySubtotal } from "../../lib/reviews/holdings-money-subtotal";
import type { CurrentPortfolioModel } from "../../lib/reviews/trading-room-portfolio";
import type { HoldingsHistoryModel, HoldingsHistoryPoint } from "../../lib/reviews/trading-room-history";

export type DesignPhase = "pre-entry" | "holding" | "post-review";

export const DESIGN_EPISODE_ID = "design-preview-chart-first";
export const DESIGN_TIMEFRAME = "1D" as const;
export const DESIGN_KNOWN_WINDOW = {
  start: "2026-05-04T00:00:00.000Z",
  end: "2026-08-21T00:00:00.000Z",
};

export const designInstrument: Instrument = {
  id: "design-synthetic",
  symbol: "SAMPLE",
  name: "趋势复盘合成样例",
  market: "CN",
  currency: "CNY",
};

const dayAt = (index: number) => {
  const first = new Date("2026-05-04T00:00:00.000Z");
  let cursor = first;
  let weekdays = 0;
  while (weekdays < index - 1) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) weekdays += 1;
  }
  return cursor.toISOString().slice(0, 10);
};

const dates = Array.from({ length: 80 }, (_, index) => dayAt(index + 1));
const closePoints: Array<[number, number]> = [
  [1, 41.5], [10, 45], [18, 58], [24, 66.5], [30, 57], [35, 46.5],
  [40, 49], [45, 51], [50, 53], [55, 55], [60, 56], [64, 60],
  [68, 64], [69, 63], [72, 62], [74, 61], [77, 64], [80, 66],
];

function closeAt(day: number) {
  const exact = closePoints.find(([pointDay]) => pointDay === day);
  if (exact) return exact[1];
  for (let index = 0; index < closePoints.length - 1; index += 1) {
    const [leftDay, leftValue] = closePoints[index];
    const [rightDay, rightValue] = closePoints[index + 1];
    if (day <= rightDay) {
      const ratio = (day - leftDay) / (rightDay - leftDay);
    return leftValue + (rightValue - leftValue) * ratio + Math.sin(day * 1.85) * 0.55;
    }
  }
  return closePoints.at(-1)?.[1] ?? 66;
}

export const fullCandles: Candle[] = dates.map((date, index) => {
  const day = index + 1;
  const close = closeAt(day);
  const previousClose = day === 1 ? close - 0.6 : closeAt(day - 1);
  const high = Math.max(previousClose, close) + 0.7;
  const low = Math.min(previousClose, close) - 0.7;
  return {
    time: `${date}T00:00:00.000Z`,
    knowledgeAt: `${date}T07:00:00.000Z`,
    tradingDates: [date],
    open: Number(previousClose.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    close: Number(close.toFixed(2)),
    volume: 100_000 + (index * 13_000) % 270_000,
  };
});

const source = (row: number) => ({
  platform: "设计合成样例",
  tradingNature: "simulated" as const,
  row,
  timePrecision: "second" as const,
  sourceTimeKind: "execution" as const,
  sourceTimezone: "Asia/Shanghai",
});

const execution = (
  id: string,
  day: number,
  side: TradeExecution["side"],
  quantity: string,
  price: string,
  fee: string,
  row: number,
): TradeExecution => ({
  id,
  source: source(row),
  accountId: "design-account",
  accountLabel: "样板账户",
  instrument: designInstrument,
  side,
  executedAt: `${dates[day - 1]}T08:00:00.000Z`,
  quantity,
  price,
  fee,
});

export const fullExecutions: TradeExecution[] = [
  execution("sample-buy", 60, "buy", "1000", "56", "10", 60),
  execution("sample-reduce", 68, "sell", "600", "64", "20", 68),
  execution("sample-exit", 74, "sell", "400", "61", "10", 74),
];

export const fullOriginalNote =
  "原判断 · 入场前条件（合成原稿）\n低点抬高，仍视为通道回踩。\n价格确认后按计划入场；跌破 52 则假设失效。\n计划入场 56 · 初始止损 52 · 目标 68。";
export const holdingSupplement =
  "当前补充 · 持仓中（复盘补记）\nD68 已减仓 600 股，当前已知持仓 400 股。\n回落时先观察通道支撑，不替原判断改写理由。\n尚未揭示后续退出，执行评价留到展开结果后。";
export const postReviewSupplement =
  "结果补记 · 退出后（复盘补记）\nD74 退出剩余 400 股，执行结果已揭示。\n把结果与原判断分开记录，不回写入场前文字。";

const drawingBase = {
  version: 2 as const,
  episodeId: DESIGN_EPISODE_ID,
  hidden: false,
  visibleOn: "all" as const,
  style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
  zIndex: 0,
};

export const originalDrawings: NormalizedDrawing[] = [
  {
    ...drawingBase,
    id: "original-channel",
    name: "原判断通道",
    tool: "parallel-channel",
    stage: "pre-trade",
    locked: true,
    createdAtCursor: fullCandles[59].knowledgeAt!,
    anchors: [
      { time: fullCandles[34].time, price: 46.5 },
      { time: fullCandles[59].time, price: 56 },
      { time: fullCandles[34].time, price: 50 },
    ],
    recallHasSeenFuture: false,
    recallOwnerId: DESIGN_EPISODE_ID,
  },
  {
    ...drawingBase,
    id: "original-text",
    name: "原判断文字",
    tool: "text",
    stage: "pre-trade",
    locked: true,
    createdAtCursor: fullCandles[59].knowledgeAt!,
    anchors: [{ time: fullCandles[44].time, price: 51 }],
    text: fullOriginalNote,
    textWidth: 290,
    fontSize: 14,
    recallHasSeenFuture: false,
    recallOwnerId: DESIGN_EPISODE_ID,
  },
];

export const supplementalDrawings: NormalizedDrawing[] = [
  {
    ...drawingBase,
    id: "holding-text",
    name: "持仓补充",
    tool: "text",
    stage: "during-replay",
    locked: false,
    createdAtCursor: fullCandles[68].knowledgeAt!,
    anchors: [{ time: fullCandles[67].time, price: 64 }],
    text: holdingSupplement,
    textWidth: 310,
    fontSize: 14,
    recallHasSeenFuture: false,
    recallOwnerId: DESIGN_EPISODE_ID,
  },
  {
    ...drawingBase,
    id: "post-review-text",
    name: "结果补记",
    tool: "text",
    stage: "post-review",
    locked: false,
    createdAtCursor: fullCandles[79].knowledgeAt!,
    anchors: [{ time: fullCandles[73].time, price: 61 }],
    text: postReviewSupplement,
    textWidth: 300,
    fontSize: 14,
    recallHasSeenFuture: true,
    recallOwnerId: DESIGN_EPISODE_ID,
  },
];

export const phaseMeta: Record<DesignPhase, {
  label: string;
  marketCutoffDay: number;
  executionCursor: string;
  description: string;
}> = {
  "pre-entry": {
    label: "S0 入场前",
    marketCutoffDay: 60,
    executionCursor: NO_REVEALED_EXECUTIONS,
    description: "D60 收盘已知；成交未揭示，执行列表保持空白。",
  },
  holding: {
    label: "S1 持仓中",
    marketCutoffDay: 69,
    executionCursor: "sample-reduce",
    description: "已知买入与减仓；后续退出仍未揭示。",
  },
  "post-review": {
    label: "S2退出后",
    marketCutoffDay: 80,
    executionCursor: "sample-exit",
    description: "用户主动展开后才显示完整执行链和结果补记。",
  },
};

export function candleCursorForDay(day: number) {
  return fullCandles[Math.max(1, Math.min(80, day)) - 1].knowledgeAt!;
}

export function filterDesignFixture(
  phase: DesignPhase,
  dayOverride?: number,
  drawings: NormalizedDrawing[] = [...originalDrawings, ...supplementalDrawings],
) {
  const day = dayOverride ?? phaseMeta[phase].marketCutoffDay;
  const cursor = candleCursorForDay(day);
  const candles = revealableCandlesThroughCursor(fullCandles, cursor);
  const executions = visibleRecallExecutions(
    fullExecutions,
    phaseMeta[phase].executionCursor,
    cursor,
  );
  const phaseRank: Record<DesignPhase, number> = {
    "pre-entry": 0,
    holding: 1,
    "post-review": 2,
  };
  const allowedStage = phaseRank[phase];
  const phaseDrawings = drawings.filter((drawing) => {
    const drawingStage = drawing.stage === "pre-trade" ? 0 : drawing.stage === "during-replay" ? 1 : 2;
    return drawingStage <= allowedStage;
  });
  const visibleDrawings = visibleDrawingsAtCursor(phaseDrawings, cursor, DESIGN_TIMEFRAME).map((drawing) => {
    const drawingStage = drawing.stage === "pre-trade" ? 0 : drawing.stage === "during-replay" ? 1 : 2;
    return drawingStage < allowedStage ? { ...drawing, locked: true } : drawing;
  });
  return { day, cursor, candles, executions, drawings: visibleDrawings };
}

export const planLines = {
  direction: "long" as const,
  entry: "56",
  stop: "52",
  target: "68",
  quantity: "1000",
};

export const designFixture = {
  episodeId: DESIGN_EPISODE_ID,
  instrument: designInstrument,
  candles: fullCandles,
  executions: fullExecutions,
  originalDrawings,
  supplementalDrawings,
  planLines,
  fixedPrices: { entry: 56, stop: 52, target: 68 },
  knownWindow: DESIGN_KNOWN_WINDOW,
};

export const DESIGN_HOME_END_DAY = 69;
export const designHomeScope: RoomScope = {
  nature: "simulation",
  assetCategory: "all",
  assetType: "all",
  period: { preset: "custom", startDate: dates[65], endDate: dates[68] },
  simulationRunId: "design-preview",
  query: "",
  accountIds: [], instrumentIds: [], markets: [], currencies: ["CNY"],
  reviewStatuses: ["pending", "completed", "deferred"],
};

const homeMoney = (amount: string | null) => buildRoomMoneyView([{ currency: "CNY", amount }]);
const homeSubtotal = (memberKey: string, amount: string | null) => buildRoomMoneySubtotal([{ memberKey, currency: "CNY", amount }]);
function homeSnapshot(day: number) {
  const candle = fullCandles[day - 1];
  const quantity = day >= 69 ? 400 : 1000;
  const price = candle.close;
  const cost = quantity * 56;
  const marketValue = quantity * price;
  return { day, date: dates[day - 1], quantity, price, cost, marketValue, pnl: marketValue - cost };
}

function homeHolding(snapshot: ReturnType<typeof homeSnapshot>) {
  return {
    key: `design-history-${snapshot.date}`,
    instrumentId: designInstrument.id, instrumentName: designInstrument.name,
    accountId: "design-account", currency: "CNY", quantity: String(snapshot.quantity),
    marketValue: String(snapshot.marketValue), cost: String(snapshot.cost), unrealizedPnl: String(snapshot.pnl),
    unrealizedReturnPercent: String(snapshot.pnl / snapshot.cost * 100), quoteDate: snapshot.date,
    quotePrice: String(snapshot.price), quantityAvailable: true, marketValueAvailable: true,
    costAvailable: true, reasons: [],
  };
}

function homeHistoryPoint(day: number, previous: ReturnType<typeof homeSnapshot> | null): HoldingsHistoryPoint {
  const snapshot = homeSnapshot(day);
  const quantityChanged = Boolean(previous && previous.quantity !== snapshot.quantity);
  const daily = previous && !quantityChanged ? snapshot.marketValue - previous.marketValue : null;
  const dailyReason = !previous
    ? "观察区间首日缺少前一交易日估值"
    : quantityChanged
      ? "持仓发生变化；样板未计算成交回款及手续费，不能把市值变化称为日盈亏"
      : null;
  return {
    date: snapshot.date, valuationDate: snapshot.date,
    dailyPnl: homeMoney(daily === null ? null : String(daily)), dailyPnlAvailable: daily !== null,
    dailyPnlReasons: dailyReason ? [dailyReason] : [],
    dailyPnlDenominator: homeMoney(previous && !quantityChanged ? String(previous.marketValue) : null),
    dailyPnlPercent: daily !== null && previous && previous.marketValue !== 0 ? String(daily / previous.marketValue * 100) : null,
    dailyPnlPercentAvailable: daily !== null && Boolean(previous?.marketValue),
    dailyPnlPercentReasons: dailyReason ? [dailyReason] : [],
    dailyCapital: homeMoney(previous && !quantityChanged ? String(previous.marketValue) : null),
    dailyReturnPercent: daily !== null && previous && previous.marketValue !== 0 ? String(daily / previous.marketValue * 100) : null,
    dailyReturnPercentAvailable: daily !== null && Boolean(previous?.marketValue),
    dailyReturnPercentReasons: dailyReason ? [dailyReason] : [],
    holdings: [homeHolding(snapshot)], marketValue: homeMoney(String(snapshot.marketValue)), cost: homeMoney(String(snapshot.cost)),
    unrealizedPnl: homeMoney(String(snapshot.pnl)), unrealizedReturnPercent: String(snapshot.pnl / snapshot.cost * 100),
    knownSubtotals: {
      marketValue: homeSubtotal(`design-history-${snapshot.date}`, String(snapshot.marketValue)),
      cost: homeSubtotal(`design-history-${snapshot.date}`, String(snapshot.cost)),
      unrealizedPnl: homeSubtotal(`design-history-${snapshot.date}`, String(snapshot.pnl)),
    },
    available: true, quantityAvailable: true, marketValueAvailable: true, costAvailable: true, unrealizedPnlAvailable: true,
    coverage: { total: 1, quantity: 1, marketValue: 1, cost: 1, unrealizedPnl: 1 }, reasons: [],
  };
}

export function deriveDesignHomeModels() {
  const current = homeSnapshot(DESIGN_HOME_END_DAY);
  const valuationCursor = candleCursorForDay(DESIGN_HOME_END_DAY);
  const latestKnownExecution = fullExecutions
    .filter((execution) => execution.executedAt <= valuationCursor)
    .at(-1);
  const latestTradeDate = latestKnownExecution?.executedAt.slice(0, 10) ?? null;
  const valuationActivity = `${current.date}T07:00:00.000Z`;
  const activityNote = latestTradeDate
    ? `最后活动时间为 D69 估值（${valuationActivity}）；最近成交为 D68（${latestTradeDate}）。`
    : `最后活动时间为 D69 估值（${valuationActivity}）；暂无成交。`;
  const holding = {
    row: {} as never, instrumentId: designInstrument.id, instrumentName: designInstrument.name,
    symbol: designInstrument.symbol, market: "CN-SH", marketLabel: "A股·沪市", accountId: "design-account", accountLabel: "样板账户",
    episodeId: DESIGN_EPISODE_ID, settlementCurrency: "CNY", latestTradeDate, sourceNature: "simulation" as const,
    simulationRunId: "design-preview", assetCategory: "a-share-stock" as const, assetType: "stock" as const, assetReason: null,
    lastActivityAt: valuationActivity, position: null, quantity: String(current.quantity), quantityStatus: "available" as const,
    averageCost: "56", costStatus: "available" as const,
    quote: { price: String(current.price), currency: "CNY", quoteDate: current.date, fetchedAt: null, provider: "合成样例", freshness: "current" as const },
    quoteStatus: "available" as const, unrealizedPnl: String(current.pnl), unrealizedPnlStatus: "available" as const, statusReason: null,
    direction: "long" as const, positionEvidence: { status: "verified-long" as const, summary: "合成样例已知多头", missing: [], sourceFormatRuleIds: [] }, diagnostic: "available" as const,
  };
  const portfolio: CurrentPortfolioModel = {
    holdings: { scope: designHomeScope, asOf: `${current.date}T07:00:00.000Z`, latestImportedTradeDate: latestTradeDate, rows: [holding], groups: [], availablePnlCount: 1, unavailablePnlCount: 0 },
    rows: [{ holding, marketValue: String(current.marketValue), cost: String(current.cost), unrealizedPnl: String(current.pnl), unrealizedReturnPercent: String(current.pnl / current.cost * 100), reasons: [] }],
    marketValue: homeMoney(String(current.marketValue)), cost: homeMoney(String(current.cost)), unrealizedPnl: homeMoney(String(current.pnl)),
    subtotals: {
      marketValue: homeSubtotal(DESIGN_EPISODE_ID, String(current.marketValue)),
      cost: homeSubtotal(DESIGN_EPISODE_ID, String(current.cost)),
      unrealizedPnl: homeSubtotal(DESIGN_EPISODE_ID, String(current.pnl)),
    },
    unrealizedReturnPercent: String(current.pnl / current.cost * 100), coverage: { marketValue: { available: 1, total: 1, complete: true }, cost: { available: 1, total: 1, complete: true }, unrealizedPnl: { available: 1, total: 1, complete: true } },
    count: 1, complete: true, empty: false, asOf: `${current.date}T07:00:00.000Z`, basis: `固定合成数据；成本按成交价展示且未含手续费；未知字段保持不可用，不将未知视为 0。${activityNote}`,
  };
  const points = [66, 67, 68, 69].map((day, index, values) => homeHistoryPoint(day, index === 0 ? null : homeSnapshot(values[index - 1])));
  const history: HoldingsHistoryModel = { points, start: dates[65], end: dates[68], reasons: [], scope: designHomeScope, fxSnapshotId: null };
  return { portfolio, history, current, dailyPnl: points.at(-1)?.dailyPnlAvailable ? points.at(-1)?.dailyPnl : undefined, dailyPnlAvailable: points.at(-1)?.dailyPnlAvailable ?? false, dailyReturnPercent: points.at(-1)?.dailyReturnPercentAvailable ? points.at(-1)?.dailyReturnPercent ?? null : null };
}
