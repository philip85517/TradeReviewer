import type { DailyCandleRecord } from "../market/contracts";
import type { TradeLibraryEntry } from "../trades/library";
import {
  buildTagSuggestions,
  type TagSuggestionRecord,
} from "./tag-suggestions";

/** A shared empty input keeps missing daily data stable across renders. */
export const EMPTY_DAILY_CANDLES: readonly DailyCandleRecord[] = [];

type CachedEntrySuggestions = {
  candles: readonly DailyCandleRecord[];
  generatedAt: string;
  candidates: readonly TagSuggestionRecord[];
};

export type TagSuggestionCache = {
  byEntry: ReadonlyMap<TradeLibraryEntry, CachedEntrySuggestions>;
};

export type CachedTagSuggestionsResult = {
  suggestions: TagSuggestionRecord[];
  cache: TagSuggestionCache;
  /** Observable evidence for the bounded recomputation contract. */
  recomputedEntryCount: number;
};

function stableCandles(
  candles: readonly DailyCandleRecord[] | undefined,
): readonly DailyCandleRecord[] {
  return candles && candles.length > 0 ? candles : EMPTY_DAILY_CANDLES;
}

/**
 * Reuse rule candidates for unchanged entry/candle identities, then merge the
 * current persisted decisions exactly as buildTagSuggestions does.
 *
 * The caller owns the cache. Each invocation replaces its entry map with only
 * the current entries, so removed scopes cannot remain strongly reachable.
 * Entries and candle arrays are treated as immutable identity inputs by the
 * workspace caller; in-place mutation must be represented by a new object.
 */
export function buildCachedTagSuggestions(
  previous: TagSuggestionCache | undefined,
  entries: readonly TradeLibraryEntry[],
  candlesByInstrument: Readonly<
    Record<string, readonly DailyCandleRecord[] | undefined>
  >,
  priorSuggestions: readonly TagSuggestionRecord[],
  generatedAt: string,
): CachedTagSuggestionsResult {
  const byId = new Map(
    priorSuggestions.map((suggestion) => [suggestion.id, suggestion]),
  );
  const byEntry = new Map<TradeLibraryEntry, CachedEntrySuggestions>();
  let recomputedEntryCount = 0;

  for (const entry of entries) {
    const candles = stableCandles(candlesByInstrument[entry.instrument.id]);
    const cached = previous?.byEntry.get(entry);
    const candidates = cached &&
      cached.candles === candles &&
      cached.generatedAt === generatedAt
      ? cached.candidates
      : buildTagSuggestions(
          [entry],
          { [entry.instrument.id]: candles as DailyCandleRecord[] },
          [],
          generatedAt,
        );

    if (!cached || cached.candles !== candles || cached.generatedAt !== generatedAt) {
      recomputedEntryCount += 1;
    }
    byEntry.set(entry, { candles, generatedAt, candidates });

    for (const candidate of candidates) {
      if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
    }
  }

  return {
    suggestions: [...byId.values()].sort(
      (left, right) =>
        left.episodeId.localeCompare(right.episodeId) ||
        left.id.localeCompare(right.id),
    ),
    cache: { byEntry },
    recomputedEntryCount,
  };
}
