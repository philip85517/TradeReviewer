import type { SupportedMarket } from "./contracts";
import { marketCalendarDateOffset } from "./trading-date";
import type { IntradayTimeRange } from "./intraday-sync-service";
import { requiredMarketDataRange } from "./sync-range";
import type { TradeEpisode } from "../trades/types";

const INTRADAY_BAR_MILLISECONDS = 60 * 60 * 1000;
const INTRADAY_PRE_ENTRY_CONTEXT_DAYS = 7;

function containingIntradayBarEnd(timestamp: string) {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) return timestamp;
  const barStart =
    Math.floor(milliseconds / INTRADAY_BAR_MILLISECONDS) *
    INTRADAY_BAR_MILLISECONDS;
  return new Date(
    barStart + INTRADAY_BAR_MILLISECONDS - 1,
  ).toISOString();
}

function latestIso(values: string[], fallback: string) {
  return values.reduce(
    (latest, value) => (value > latest ? value : latest),
    fallback,
  );
}

function endOfIsoDate(value: string) {
  return `${value.slice(0, 10)}T23:59:59.999Z`;
}

function intradayContextStart(timestamp: string, market: string) {
  return marketCalendarDateOffset(
    timestamp,
    market,
    -INTRADAY_PRE_ENTRY_CONTEXT_DAYS,
  );
}

function episodeIntradaySyncRange(
  episode: TradeEpisode,
  market: SupportedMarket,
): IntradayTimeRange {
  const lastExecutionAt = latestIso(
    episode.executions.map((execution) => execution.executedAt),
    episode.startedAt,
  );
  const startTime = intradayContextStart(
    episode.startedAt,
    episode.instrument.market,
  );
  if (episode.status === "closed") {
    return {
      startTime,
      endTime: containingIntradayBarEnd(
        episode.endedAt ?? lastExecutionAt,
      ),
    };
  }
  const latestCompletedSession = requiredMarketDataRange(
    episode.startedAt,
    lastExecutionAt,
    { open: true, market },
  ).endDate;
  return {
    startTime,
    endTime: endOfIsoDate(latestCompletedSession),
  };
}

export function mergeIntradayTimeRanges(
  ranges: ReadonlyArray<IntradayTimeRange>,
) {
  const sorted = [...ranges].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
  const merged: IntradayTimeRange[] = [];
  for (const range of sorted) {
    const current = merged.at(-1);
    if (!current || range.startTime > current.endTime) {
      merged.push({ ...range });
      continue;
    }
    if (range.endTime > current.endTime) {
      current.endTime = range.endTime;
    }
  }
  return merged;
}

export function buildIntradaySyncRanges(
  episodes: ReadonlyArray<TradeEpisode>,
  market: SupportedMarket,
) {
  return mergeIntradayTimeRanges(
    episodes.map((episode) => episodeIntradaySyncRange(episode, market)),
  );
}
