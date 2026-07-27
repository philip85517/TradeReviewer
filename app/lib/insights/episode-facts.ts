import Decimal from "decimal.js";

import type { DailyCandleRecord } from "../market/contracts";
import type { MarketDataSyncStatus } from "../market/sync-status";
import { marketTradingDate } from "../market/trading-date";
import type { TradeLibraryEntry } from "../trades/library";
import type { TagSuggestionRecord } from "./types";

export type InsightExclusionReason =
  | "open-episode"
  | "incomplete-market-data"
  | "missing-episode-candles"
  | "missing-comparison-metric";

export type InsightEpisodeExclusion = {
  episodeId: string;
  instrumentId: string;
  instrumentName: string;
  startedAt: string;
  endedAt: string | null;
  reason: InsightExclusionReason;
  reasonLabel: string;
};

export type ConfirmedRuleVersion = {
  tagId: string;
  ruleId: string;
  ruleVersion: number;
};

export type InsightEpisodeFact = {
  episodeId: string;
  instrumentId: string;
  instrumentSymbol: string;
  instrumentName: string;
  market: string;
  direction: "long" | "short";
  startedAt: string;
  endedAt: string;
  netPnl: string;
  returnPercent: string | null;
  rMultiple: string | null;
  holdingMilliseconds: number;
  holdingDays: string;
  averageEntryPrice: string;
  openingExecutionCount: number;
  addOnCount: number;
  mfePercent: string;
  maePercent: string;
  givebackPercent: string;
  confirmedTagIds: string[];
  confirmedRuleVersions: ConfirmedRuleVersion[];
  calculationVersion: 1;
};

export type InsightEpisodeFactResult = {
  facts: InsightEpisodeFact[];
  excluded: InsightEpisodeExclusion[];
};

const REASON_LABELS: Record<InsightExclusionReason, string> = {
  "open-episode": "持仓回合尚未结束",
  "incomplete-market-data": "本地行情覆盖不完整",
  "missing-episode-candles": "回合起止日期缺少完整 K 线",
  "missing-comparison-metric": "缺少当前统计口径所需指标",
};

function exclusion(
  entry: TradeLibraryEntry,
  item: TradeLibraryEntry["episodes"][number],
  reason: InsightExclusionReason,
): InsightEpisodeExclusion {
  return {
    episodeId: item.episode.id,
    instrumentId: entry.instrument.id,
    instrumentName: entry.instrument.name,
    startedAt: item.episode.startedAt,
    endedAt: item.episode.endedAt ?? null,
    reason,
    reasonLabel: REASON_LABELS[reason],
  };
}

function isComplete(status: MarketDataSyncStatus | undefined) {
  return status === "complete" || status === "ready";
}

function averageEntry(
  item: TradeLibraryEntry["episodes"][number],
) {
  const openingSide =
    item.episode.direction === "long" ? "buy" : "sell";
  const openings = item.episode.executions.filter(
    ({ side }) => side === openingSide,
  );
  const quantity = openings.reduce(
    (total, execution) => total.plus(execution.quantity),
    new Decimal(0),
  );
  if (quantity.isZero()) return null;
  const value = openings.reduce(
    (total, execution) =>
      total.plus(
        new Decimal(execution.quantity).times(execution.price),
      ),
    new Decimal(0),
  );
  return {
    price: value.div(quantity),
    count: openings.length,
  };
}

function excursionMetrics(
  direction: "long" | "short",
  price: Decimal,
  candles: DailyCandleRecord[],
  returnPercent: string | null,
) {
  const maximum = candles.reduce(
    (value, candle) => Decimal.max(value, candle.high),
    new Decimal(candles[0].high),
  );
  const minimum = candles.reduce(
    (value, candle) => Decimal.min(value, candle.low),
    new Decimal(candles[0].low),
  );
  const mfe =
    direction === "long"
      ? maximum.minus(price).div(price).times(100)
      : price.minus(minimum).div(price).times(100);
  const mae =
    direction === "long"
      ? minimum.minus(price).div(price).times(100)
      : price.minus(maximum).div(price).times(100);
  const giveback =
    returnPercent === null
      ? new Decimal(0)
      : Decimal.max(0, mfe.minus(returnPercent));
  return {
    mfePercent: mfe.toString(),
    maePercent: mae.toString(),
    givebackPercent: giveback.toString(),
  };
}

export function buildInsightEpisodeFacts(
  entries: TradeLibraryEntry[],
  candlesByInstrument: Record<string, DailyCandleRecord[]>,
  marketDataStatuses: Record<string, MarketDataSyncStatus>,
  suggestionDecisions: TagSuggestionRecord[],
): InsightEpisodeFactResult {
  const facts: InsightEpisodeFact[] = [];
  const excluded: InsightEpisodeExclusion[] = [];

  for (const entry of entries) {
    const status = marketDataStatuses[entry.instrument.id];
    const candles = [
      ...(candlesByInstrument[entry.instrument.id] ?? []),
    ].sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));

    for (const item of entry.episodes) {
      if (
        item.episode.status !== "closed" ||
        !item.episode.endedAt ||
        item.metrics.holdingMilliseconds === null
      ) {
        excluded.push(exclusion(entry, item, "open-episode"));
        continue;
      }
      if (!isComplete(status)) {
        excluded.push(
          exclusion(entry, item, "incomplete-market-data"),
        );
        continue;
      }

      const startDate = marketTradingDate(
        item.episode.startedAt,
        item.episode.instrument.market,
      );
      const endDate = marketTradingDate(
        item.episode.endedAt,
        item.episode.instrument.market,
      );
      const episodeCandles = candles.filter(
        ({ tradingDate }) =>
          tradingDate >= startDate && tradingDate <= endDate,
      );
      if (
        episodeCandles[0]?.tradingDate !== startDate ||
        episodeCandles.at(-1)?.tradingDate !== endDate
      ) {
        excluded.push(
          exclusion(entry, item, "missing-episode-candles"),
        );
        continue;
      }
      const entryBasis = averageEntry(item);
      if (!entryBasis || item.metrics.netPnl === null) {
        excluded.push(
          exclusion(entry, item, "missing-comparison-metric"),
        );
        continue;
      }

      const confirmedRuleVersions = suggestionDecisions
        .filter(
          (suggestion) =>
            suggestion.episodeId === item.episode.id &&
            (suggestion.status === "confirmed" ||
              suggestion.status === "edited"),
        )
        .map((suggestion) => ({
          tagId: suggestion.finalTagId ?? suggestion.tagId,
          ruleId: suggestion.ruleId,
          ruleVersion: suggestion.ruleVersion,
        }))
        .sort(
          (a, b) =>
            a.tagId.localeCompare(b.tagId) ||
            a.ruleId.localeCompare(b.ruleId),
        );
      const excursions = excursionMetrics(
        item.episode.direction,
        entryBasis.price,
        episodeCandles,
        item.metrics.returnPercent,
      );

      facts.push({
        episodeId: item.episode.id,
        instrumentId: entry.instrument.id,
        instrumentSymbol: entry.instrument.symbol,
        instrumentName: entry.instrument.name,
        market: entry.instrument.market,
        direction: item.episode.direction,
        startedAt: item.episode.startedAt,
        endedAt: item.episode.endedAt,
        netPnl: item.metrics.netPnl,
        returnPercent: item.metrics.returnPercent,
        rMultiple: item.rMultiple,
        holdingMilliseconds: item.metrics.holdingMilliseconds,
        holdingDays: new Decimal(
          item.metrics.holdingMilliseconds,
        )
          .div(86_400_000)
          .toString(),
        averageEntryPrice: entryBasis.price.toString(),
        openingExecutionCount: entryBasis.count,
        addOnCount: Math.max(0, entryBasis.count - 1),
        ...excursions,
        confirmedTagIds: [...item.confirmedTagIds],
        confirmedRuleVersions,
        calculationVersion: 1,
      });
    }
  }

  return { facts, excluded };
}
