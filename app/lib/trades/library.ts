import { tradingNatureLabel } from "./trading-nature";
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
import {
  tradeScopeKey,
  type Instrument,
  type TradeEpisode,
  type TradeExecution,
} from "./types";

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
  scopeKey?: string;
  tradeNature?: "live" | "simulation" | "unknown";
  simulationRunId?: string;
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
  return summaries
    .flatMap((summary) => {
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
      const allEpisodes = buildTradeEpisodes(summary.executions);
      const episodesByScope = new Map<string, TradeEpisode[]>();
      for (const episode of allEpisodes) {
        const key = tradeScopeKey(episode.executions[0]);
        episodesByScope.set(key, [
          ...(episodesByScope.get(key) ?? []),
          episode,
        ]);
      }

      return [...episodesByScope.entries()].map(([scopeKey, scopeEpisodes]) => {
        const scopedExecutions = summary.executions.filter(
          (execution) => tradeScopeKey(execution) === scopeKey,
        );
        const episodes = scopeEpisodes
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

        const nature = scopeEpisodes[0]?.tradeNature ?? "unknown";
        return {
          ...(nature !== "unknown" ? { scopeKey } : {}),
          tradeNature: nature,
          groupId: `${summary.instrument.id}|${scopeKey}`,
          tradingLabel: tradingNatureLabel(scopedExecutions[0]),
          ...(scopeEpisodes[0]?.simulationRunId
            ? { simulationRunId: scopeEpisodes[0].simulationRunId }
            : {}),
          instrument: summary.instrument,
          executions: scopedExecutions,
          episodes,
          accountCount: new Set(
            scopedExecutions.map((execution) => execution.accountId),
          ).size,
          tradeCount: scopedExecutions.length,
          episodeCount: episodes.length,
          firstTradeAt: scopedExecutions[0]?.executedAt ?? summary.firstTradeAt,
          lastTradeAt: scopedExecutions.at(-1)?.executedAt ?? summary.lastTradeAt,
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
      });
    })
    .sort(
      (a, b) =>
        b.lastTradeAt.localeCompare(a.lastTradeAt) ||
        a.instrument.symbol.localeCompare(b.instrument.symbol) ||
        (a.scopeKey ?? "").localeCompare(b.scopeKey ?? ""),
    );
}
