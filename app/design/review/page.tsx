import { resolve } from "node:path";

import { openSqliteDatabase } from "../../../db/sqlite";
import { buildTradeEpisodes } from "../../lib/trades/episodes";
import type { TradeExecution } from "../../lib/trades/types";
import { getSqliteStore } from "../../lib/storage/sqlite-store";
import { createRecallDocument } from "../../lib/recall/document";
import { getRecallDocument, saveRecallDocument } from "../../lib/recall/server-repository";
import type { RecallDocument, RecallWorkingContext } from "../../lib/recall/types";
import { NO_REVEALED_EXECUTIONS } from "../../lib/replay/recall-replay";
import type { Candle, Timeframe } from "../../lib/market/types";
import type { Instrument } from "../../lib/trades/types";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import { ReviewDesignIndex, ReviewDesignPreview } from "../../components/review-design-preview/review-design-preview";

export const dynamic = "force-dynamic";

const FIXTURE_EPISODE_ID = "design-system-20261006";
const FIXTURE_ACCOUNT_ID = "design-system-sample-account";
const FIXTURE_INSTRUMENT: Instrument = {
  id: "CN-SH:DEMO-L",
  symbol: "DEMO-L",
  name: "示例标的（合成）",
  market: "CN-SH",
  currency: "CNY",
};

function fixtureExecutions(): TradeExecution[] {
  const source = (row: number) => ({ platform: "design-system-fixture", row });
  return [
    { id: "design-system-buy-1000", accountId: FIXTURE_ACCOUNT_ID, accountLabel: "设计样板账户", instrument: FIXTURE_INSTRUMENT, side: "buy", executedAt: "2026-03-18T07:00:00.000Z", quantity: "1000", price: "56", fee: "12.00", source: source(1) },
    { id: "design-system-sell-400", accountId: FIXTURE_ACCOUNT_ID, accountLabel: "设计样板账户", instrument: FIXTURE_INSTRUMENT, side: "sell", executedAt: "2026-04-08T07:00:00.000Z", quantity: "400", price: "61.5", fee: "8.00", source: source(2) },
    { id: "design-system-sell-600", accountId: FIXTURE_ACCOUNT_ID, accountLabel: "设计样板账户", instrument: FIXTURE_INSTRUMENT, side: "sell", executedAt: "2026-04-22T07:00:00.000Z", quantity: "600", price: "64", fee: "10.00", source: source(3) },
  ];
}

function fixtureCandles(): Candle[] {
  const candles: Candle[] = [];
  let previous = 54;
  for (let index = 0; index < 120; index += 1) {
    const wave = Math.sin(index / 4) * 0.55;
    // Keep the synthetic candles internally consistent with the three fixture
    // executions. The post-entry leg is intentionally stepped up so each
    // execution price falls inside its day's OHLC range.
    const trend = index < 52
      ? index * 0.025
      : index < 72
        ? 1.3 + (index - 52) * 0.03
        : index <= 93
          ? 3.45 + (index - 72) * (4.05 / 21)
          : index <= 107
            ? 7.5 + (index - 93) * (2.5 / 14)
            : 10 + (index - 107) * 0.02;
    const close = Math.round((54 + trend + wave) * 100) / 100;
    const open = Math.round(previous * 100) / 100;
    const high = Math.round((Math.max(open, close) + 0.65) * 100) / 100;
    const low = Math.round((Math.min(open, close) - 0.55) * 100) / 100;
    const date = new Date(Date.UTC(2026, 0, 5 + index));
    candles.push({ time: date.toISOString(), knowledgeAt: `${date.toISOString().slice(0, 10)}T07:00:00.000Z`, tradingDates: [date.toISOString().slice(0, 10)], open, high, low, close, volume: 860_000 + index * 8_000 });
    previous = close;
  }
  return candles;
}

function fixtureDrawing(episodeId: string, id: string, anchor: Candle, text: string, stage: "pre-trade" | "during-replay" | "post-review"): NormalizedDrawing {
  return { version: 2, id, episodeId, name: "样板复盘文字", tool: "text", zIndex: 10, createdAtCursor: anchor.time, anchors: [{ time: anchor.time, price: anchor.close }], style: { color: "#9ec5ff", lineWidth: 1, opacity: 1 }, hidden: false, locked: false, visibleOn: "all", stage, text, placement: "anchor", textWidth: 300, fontSize: 14, background: "#142236", recallOwnerId: "global", textRevision: 1, recallHasSeenFuture: stage !== "pre-trade" };
}

function fixtureTrend(episodeId: string, start: Candle, end: Candle): NormalizedDrawing {
  return { version: 2, id: "design-system-original-trend", episodeId, name: "原始趋势线", tool: "trend-line", zIndex: 8, createdAtCursor: start.time, anchors: [{ time: start.time, price: start.close }, { time: end.time, price: end.close }], style: { color: "#7aa7dc", lineWidth: 2, opacity: 0.9 }, hidden: false, locked: false, visibleOn: "all", stage: "pre-trade", recallOwnerId: "global", recallHasSeenFuture: false };
}

function withFixtureDocument(document: RecallDocument, episodeId: string, executions: TradeExecution[], candles: Candle[]): RecallDocument {
  const trend = fixtureTrend(episodeId, candles[32], candles[71]);
  const original = fixtureDrawing(episodeId, "design-system-original-note", { ...candles[44], close: 55.4 }, "原始判断：\n回撤后观察承接，站回 56 再考虑做多。\n跌破 52 则结构失效。", "pre-trade");
  const current = { ...fixtureDrawing(episodeId, "design-system-current-note", { ...candles[40], close: 60 }, "当前观察：\n买入已揭示，先按原计划持有。\n跌破 52 再检查结构。", "during-replay"), recallHasSeenFuture: false };
  const conclusion = { ...fixtureDrawing(episodeId, "design-system-conclusion-note", { ...candles[70], close: 66 }, "复盘结论：\n分批止盈执行稳定，下一次保留更多趋势空间。", "post-review"), textWidth: 340 };
  const preCursor = candles[71].knowledgeAt ?? candles[71].time;
  const holdingCursor = candles[72].knowledgeAt ?? candles[72].time;
  const postCursor = candles[110].knowledgeAt ?? candles[110].time;
  const context = (_phase: "pre-entry" | "holding" | "post-review", cursor: string, executionCursor: string, drawings: NormalizedDrawing[]): RecallWorkingContext => ({ mode: "global", decisionId: "global", drawings, timeframe: "1D", cursor, executionCursor });
  const plan = { id: "design-system-plan-1", planId: "design-system-plan-1", decisionId: executions[0].id, kind: "initial" as const, input: { direction: "long" as const, currency: "CNY", priceBasis: "raw" as const, entry: "56", initialStop: "52", targets: [{ id: "target-1", price: "68", quantity: null, ratio: null }], sizeInputMode: "quantity" as const, sizeInputValue: "1000", resolvedQuantity: "1000", quantityUnit: "share" as const, capital: { amount: "200000", currency: "CNY", asOf: "2026-10-06", source: "manual-reference" as const } }, recordedPhase: "pre-entry" as const, source: "retrospective" as const, recordedAt: "2026-10-06T00:00:00.000Z", knowledgeCutoff: { cursor: preCursor, executionCursor: NO_REVEALED_EXECUTIONS }, hasSeenFuture: false, reason: "样板初始计划：回撤承接后执行。" };
  const next = { ...document, working: { ...document.working, phase: "pre-entry" as const, hasSeenFuture: false, drawings: [trend, original], timeframe: "1D" as Timeframe, cursor: preCursor, executionCursor: NO_REVEALED_EXECUTIONS, selectedDecisionId: null, phaseContexts: { "pre-entry": context("pre-entry", preCursor, NO_REVEALED_EXECUTIONS, [trend, original]), holding: context("holding", holdingCursor, executions[0].executedAt, [trend, original, current]), "post-review": context("post-review", postCursor, executions[2].executedAt, [trend, original, current, conclusion]) } }, plans: { drafts: [plan], versions: [], riskBaselines: [] }, planAssociations: [{ planId: plan.planId, decisionId: executions[0].id, status: "linked" as const }], status: "in-progress" as const };
  return next;
}

function ensureFixture() {
  const explicitPath = process.env.TRADEREVIEW_DB_PATH?.trim();
  if (process.env.NODE_ENV === "production") return { error: "设计样板仅在开发环境提供。" } as const;
  if (!explicitPath) return { error: "设计样板需要显式设置 TRADEREVIEW_DB_PATH 指向隔离数据库。" } as const;
  const expectedPath = resolve(process.cwd(), ".scratch/review-design-system-20261006/acceptance.sqlite");
  if (resolve(explicitPath) !== expectedPath) return { error: "设计样板只允许写入 .scratch/review-design-system-20261006/acceptance.sqlite，请勿指向共享业务数据库。" } as const;
  const database = openSqliteDatabase(explicitPath);
  const executions = fixtureExecutions();
  getSqliteStore(database).mergeTradeData({ instruments: [FIXTURE_INSTRUMENT], executions });
  const episode = buildTradeEpisodes(getSqliteStore(database).getExecutions()).find(candidate => candidate.accountId === FIXTURE_ACCOUNT_ID && candidate.instrument.id === FIXTURE_INSTRUMENT.id);
  if (!episode) return { error: "设计样板交易回合创建失败。" } as const;
  const candles = fixtureCandles();
  const stored = getRecallDocument(database, episode.id);
  if (!stored) saveRecallDocument(database, { document: withFixtureDocument(createRecallDocument(episode), episode.id, executions, candles) as RecallDocument, expectedRevision: 0 });
  return { episode, candles, document: getRecallDocument(database, episode.id) } as const;
}

export default async function ReviewDesignPage({ searchParams }: { searchParams: Promise<{ variant?: string; index?: string }> }) {
  const fixture = ensureFixture();
  if ("error" in fixture) return <main style={{ padding: 32, fontFamily: "Geist, PingFang SC, Microsoft YaHei, sans-serif" }}><h1>复盘设计样板</h1><p>{fixture.error}</p></main>;
  const params = await searchParams;
  if (params.index === "1") return <ReviewDesignIndex revision={fixture.document?.revision ?? 0} fixtureId={FIXTURE_EPISODE_ID} />;
  const variant = params.variant === "baseline" ? "baseline" : "recommended";
  const instrument = fixture.episode.instrument;
  return <ReviewDesignPreview variant={variant} episode={fixture.episode} candles={fixture.candles} instrument={instrument} />;
}
