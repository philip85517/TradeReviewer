import type { RecallReviewSummary } from "../recall/summary";
import type { DailyCandleRecord } from "../market/contracts";
import type { MarketDataSyncStatus } from "../market/sync-status";
import {
  buildTradeLibraryEntries,
  type TradeLibraryEntry,
} from "../trades/library";
import type { InstrumentTradeSummary } from "../trades/instruments";
import type { EpisodeReviewRecord } from "./types";

/** A shared immutable fallback keeps missing daily data from changing identity on every render. */
export const EMPTY_DAILY_CANDLES: readonly DailyCandleRecord[] = [];

type CachedInstrumentEntries = {
  summary: InstrumentTradeSummary;
  candles: readonly DailyCandleRecord[];
  status: MarketDataSyncStatus;
  entries: TradeLibraryEntry[];
};

export type TradeLibraryEntryCache = {
  byInstrument: ReadonlyMap<string, CachedInstrumentEntries>;
  entries: TradeLibraryEntry[];
  reviewsByEpisode: Record<string, EpisodeReviewRecord>;
  summariesByEpisode: Record<string, RecallReviewSummary>;
};

export type CachedTradeLibraryEntriesResult = {
  entries: TradeLibraryEntry[];
  cache: TradeLibraryEntryCache;
};

function sortEntries(left: TradeLibraryEntry, right: TradeLibraryEntry): number {
  return right.lastTradeAt.localeCompare(left.lastTradeAt) ||
    left.instrument.symbol.localeCompare(right.instrument.symbol) ||
    (left.scopeKey ?? "").localeCompare(right.scopeKey ?? "");
}

/**
 * Rebuild only the instrument whose market projection changed.
 *
 * The cache is caller-owned and replaced on every call, so it is bounded by
 * the current inventory and cannot retain old imports or old market snapshots.
 * Review maps are identity barriers: a changed review map invalidates all
 * entries because an episode can belong to any instrument.
 */
export function buildCachedTradeLibraryEntries(
  previous: TradeLibraryEntryCache | undefined,
  summaries: readonly InstrumentTradeSummary[],
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  marketDataStatuses: Readonly<Record<string, MarketDataSyncStatus | undefined>>,
  reviewsByEpisode: Record<string, EpisodeReviewRecord> = {},
  summariesByEpisode: Record<string, RecallReviewSummary> = {},
): CachedTradeLibraryEntriesResult {
  const reviewInputsStable = previous?.reviewsByEpisode === reviewsByEpisode &&
    previous?.summariesByEpisode === summariesByEpisode;
  const nextByInstrument = new Map<string, CachedInstrumentEntries>();
  const allEntries: TradeLibraryEntry[] = [];

  for (const summary of summaries) {
    const instrumentId = summary.instrument.id;
    const inputCandles = candlesByInstrument[instrumentId];
    const candles = inputCandles?.length ? inputCandles : EMPTY_DAILY_CANDLES;
    const status = marketDataStatuses[instrumentId] ?? "not-requested";
    const cached = reviewInputsStable ? previous?.byInstrument.get(instrumentId) : undefined;
    const item = cached && cached.summary === summary && cached.candles === candles && cached.status === status
      ? cached
      : {
          summary,
          candles,
          status,
          entries: buildTradeLibraryEntries(
            [summary],
            { [instrumentId]: candles as DailyCandleRecord[] },
            { [instrumentId]: status },
            reviewsByEpisode,
            summariesByEpisode,
          ),
        } satisfies CachedInstrumentEntries;
    nextByInstrument.set(instrumentId, item);
    allEntries.push(...item.entries);
  }

  const sortedEntries = allEntries.sort(sortEntries);
  const entries = previous &&
    sortedEntries.length === previous.entries.length &&
    sortedEntries.every((entry, index) => previous.entries[index] === entry)
    ? previous.entries
    : sortedEntries;

  return {
    entries,
    cache: {
      byInstrument: nextByInstrument,
      entries,
      reviewsByEpisode,
      summariesByEpisode,
    },
  };
}
