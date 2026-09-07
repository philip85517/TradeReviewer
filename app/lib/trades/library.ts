import { simulationScope, tradingNature, tradingNatureLabel } from "./trading-nature";
import { buildInstrumentTradeSummaries } from "./instruments";
import Decimal from "decimal.js";

import type { DailyCandleRecord } from "../market/contracts";
import type { MarketDataSyncStatus } from "../market/sync-status";
import { marketTradingDate } from "../market/trading-date";
import {
  calculateRMultiple,
  episodeReviewStatus,
} from "../reviews/review-metrics";
import { REVIEW_TAG_DICTIONARY_VERSION } from "../reviews/review-tags";
import type {
  EpisodeReviewRecord,
  EpisodeReviewStatus,
} from "../reviews/types";
import {
  summarizeTradeEpisode,
  type TradeEpisodeMetrics,
} from "./episode-metrics";
import { buildTradeEpisodes } from "./episodes";
import type { InstrumentTradeSummary } from "./instruments";
import type { Instrument, TradeEpisode, TradeExecution } from "./types";

export type TradeLibraryEpisode = {
  episode: TradeEpisode;
  metrics: TradeEpisodeMetrics;
  review?: EpisodeReviewRecord;
  reviewStatus: EpisodeReviewStatus;
  confirmedTagIds: string[];
  tagDictionaryVersion: number;
  rMultiple: string | null;
};

export type TradeLibraryEntry = {
  groupId?: string;
  tradingLabel?: string;
  instrument: Instrument;
  executions: TradeExecution[];
  episodes: TradeLibraryEpisode[];
  accountCount: number;
  tradeCount: number;
  episodeCount: number;
  firstTradeAt: string;
  lastTradeAt: string;
  status: "open" | "closed";
  netPnl: string | null;
  returnPercent: string | null;
  reviewedEpisodeCount: number;
  confirmedTagIds: string[];
  cumulativeR: string | null;
};

export function buildTradeLibraryEntries(
  summaries: InstrumentTradeSummary[],
  candlesByInstrument: Record<string, DailyCandleRecord[]>,
  marketDataStatuses: Record<string, MarketDataSyncStatus>,
  reviewsByEpisode: Record<string, EpisodeReviewRecord> = {},
): TradeLibraryEntry[] {
  const separated = summaries.flatMap(summary => {
    const groups = new Map<string, TradeExecution[]>();
    for (const record of summary.executions) {
      const key = simulationScope(record) || tradingNature(record);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    return [...groups.values()].flatMap(buildInstrumentTradeSummaries);
  });
  return separated
    .map((summary) => {
      const latestCandle = [...(
        candlesByInstrument[summary.instrument.id] ?? []
      )].sort((a, b) =>
        a.tradingDate.localeCompare(b.tradingDate),
      ).at(-1);
      const marketDataStatus =
        marketDataStatuses[summary.instrument.id] ?? "not-requested";
      const hasCompleteMarketData =
        marketDataStatus === "complete" ||
        marketDataStatus === "ready";
      const episodes = buildTradeEpisodes(summary.executions)
        .map((episode) => {
          const latestExecution =
            episode.executions.at(-1) ?? episode.executions[0];
          const latestExecutionTradingDate = marketTradingDate(
            latestExecution.executedAt,
            episode.instrument.market,
          );
          const metrics = summarizeTradeEpisode(
            episode,
            episode.status === "open" &&
              hasCompleteMarketData &&
              latestCandle &&
              latestCandle.tradingDate >= latestExecutionTradingDate
              ? latestCandle.close
              : undefined,
          );
          const review = reviewsByEpisode[episode.id];
          return {
            episode,
            metrics,
            review,
            reviewStatus: episodeReviewStatus(review),
            confirmedTagIds: review?.confirmedTagIds ?? [],
            tagDictionaryVersion:
              review?.tagDictionaryVersion ??
              REVIEW_TAG_DICTIONARY_VERSION,
            rMultiple: calculateRMultiple(
              metrics,
              review?.plan.plannedRiskAmount ?? "",
            ),
          };
        })
        .sort(
          (a, b) =>
            b.episode.startedAt.localeCompare(a.episode.startedAt) ||
            b.episode.id.localeCompare(a.episode.id),
        );
      const metricsAreComplete = episodes.every(
        ({ metrics }) => metrics.netPnl !== null,
      );
      const netPnl = metricsAreComplete
        ? episodes.reduce(
            (total, { metrics }) =>
              total.plus(metrics.netPnl as string),
            new Decimal(0),
          )
        : null;
      const grossExposure = episodes.reduce(
        (total, { metrics }) => total.plus(metrics.grossExposure),
        new Decimal(0),
      );
      const returnPercent =
        netPnl === null || grossExposure.isZero()
          ? null
          : netPnl.div(grossExposure).times(100);
      const confirmedTagIds = [
        ...new Set(
          episodes.flatMap(({ confirmedTagIds: tagIds }) => tagIds),
        ),
      ];
      const rValues = episodes
        .map(({ rMultiple }) => rMultiple)
        .filter((value): value is string => value !== null);
      const cumulativeR =
        rValues.length === 0
          ? null
          : rValues
              .reduce(
                (total, value) => total.plus(value),
                new Decimal(0),
              )
              .toString();

      return {
        groupId: simulationScope(summary.executions[0])
          ? `${summary.instrument.id}|${simulationScope(summary.executions[0])}`
          : `${summary.instrument.id}|${tradingNature(summary.executions[0])}`,
        tradingLabel: tradingNatureLabel(summary.executions[0]),
        instrument: summary.instrument,
        executions: summary.executions,
        episodes,
        accountCount: new Set(
          summary.executions.map((execution) => execution.accountId),
        ).size,
        tradeCount: summary.tradeCount,
        episodeCount: episodes.length,
        firstTradeAt: summary.firstTradeAt,
        lastTradeAt: summary.lastTradeAt,
        status: episodes.some(
          ({ episode }) => episode.status === "open",
        )
          ? ("open" as const)
          : ("closed" as const),
        netPnl: netPnl?.toString() ?? null,
        returnPercent: returnPercent?.toString() ?? null,
        reviewedEpisodeCount: episodes.filter(
          ({ reviewStatus }) => reviewStatus === "completed",
        ).length,
        confirmedTagIds,
        cumulativeR,
      };
    })
    .sort(
      (a, b) =>
        b.lastTradeAt.localeCompare(a.lastTradeAt) ||
        a.instrument.symbol.localeCompare(b.instrument.symbol),
    );
}
