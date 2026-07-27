import Decimal from "decimal.js";

import type { DailyCandleRecord } from "../market/contracts";
import type { MarketDataSyncStatus } from "../market/sync-status";
import { marketTradingDate } from "../market/trading-date";
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
};

export type TradeLibraryEntry = {
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
};

export function buildTradeLibraryEntries(
  summaries: InstrumentTradeSummary[],
  candlesByInstrument: Record<string, DailyCandleRecord[]>,
  marketDataStatuses: Record<string, MarketDataSyncStatus>,
): TradeLibraryEntry[] {
  return summaries
    .map((summary) => {
      const latestCandle = [...(
        candlesByInstrument[summary.instrument.id] ?? []
      )].sort((a, b) =>
        a.tradingDate.localeCompare(b.tradingDate),
      ).at(-1);
      const marketDataStatus =
        marketDataStatuses[summary.instrument.id] ?? "not-requested";
      const hasCompleteMarketData =
        marketDataStatus === "complete" || marketDataStatus === "ready";
      const episodes = buildTradeEpisodes(summary.executions)
        .map((episode) => {
          const latestExecution =
            episode.executions.at(-1) ?? episode.executions[0];
          const latestExecutionTradingDate = marketTradingDate(
            latestExecution.executedAt,
            episode.instrument.market,
          );
          return {
            episode,
            metrics: summarizeTradeEpisode(
              episode,
              episode.status === "open" &&
                hasCompleteMarketData &&
                latestCandle &&
                latestCandle.tradingDate >= latestExecutionTradingDate
                ? latestCandle.close
                : undefined,
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

      return {
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
      };
    })
    .sort(
      (a, b) =>
        b.lastTradeAt.localeCompare(a.lastTradeAt) ||
        a.instrument.symbol.localeCompare(b.instrument.symbol),
    );
}
