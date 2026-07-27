import Decimal from "decimal.js";

import type { DailyCandleRecord } from "../market/contracts";
import { marketTradingDate } from "../market/trading-date";
import type { TradeLibraryEntry } from "../trades/library";
import type { TradeLibraryEpisode } from "../trades/library";
import type {
  SuggestionEvidence,
  TagSuggestionRecord,
  TagSuggestionRuleId,
} from "./types";

export type {
  SuggestionEvidence,
  TagSuggestionRecord,
  TagSuggestionRuleId,
} from "./types";

const RULE_VERSION = 1 as const;

function suggestionId(
  episodeId: string,
  ruleId: TagSuggestionRuleId,
) {
  return `${episodeId}:${ruleId}:${RULE_VERSION}`;
}

function createSuggestion(
  item: TradeLibraryEpisode,
  tagId: string,
  ruleId: TagSuggestionRuleId,
  evidence: SuggestionEvidence[],
  generatedAt: string,
): TagSuggestionRecord {
  return {
    version: 1,
    id: suggestionId(item.episode.id, ruleId),
    episodeId: item.episode.id,
    instrumentId: item.episode.instrument.id,
    tagId,
    finalTagId: null,
    ruleId,
    ruleVersion: RULE_VERSION,
    status: "suggested",
    suggestedAt: generatedAt,
    decidedAt: null,
    evidence,
  };
}

function maximumHigh(candles: DailyCandleRecord[]) {
  return candles.reduce(
    (highest, candle) => Decimal.max(highest, candle.high),
    new Decimal(candles[0].high),
  );
}

function openingExecutions(item: TradeLibraryEpisode) {
  const openingSide =
    item.episode.direction === "long" ? "buy" : "sell";
  return item.episode.executions.filter(
    ({ side }) => side === openingSide,
  );
}

function breakoutSuggestion(
  item: TradeLibraryEpisode,
  candles: DailyCandleRecord[],
  generatedAt: string,
) {
  const opening = openingExecutions(item)[0];
  if (!opening) return null;
  const entryDate = marketTradingDate(
    opening.executedAt,
    item.episode.instrument.market,
  );
  const prior = candles
    .filter(({ tradingDate }) => tradingDate < entryDate)
    .sort((a, b) => a.tradingDate.localeCompare(b.tradingDate))
    .slice(-20);
  if (prior.length < 20) return null;
  const reference = maximumHigh(prior);
  const observed = new Decimal(opening.price);
  if (!observed.gt(reference)) return null;

  return createSuggestion(
    item,
    "breakout",
    "entry-20d-breakout",
    [
      {
        kind: "price-comparison",
        tradingDate: entryDate,
        observed: observed.toString(),
        reference: reference.toString(),
      },
    ],
    generatedAt,
  );
}

function pullbackSuggestion(
  item: TradeLibraryEpisode,
  candles: DailyCandleRecord[],
  generatedAt: string,
) {
  const opening = openingExecutions(item)[0];
  if (!opening) return null;
  const entryDate = marketTradingDate(
    opening.executedAt,
    item.episode.instrument.market,
  );
  const prior = candles
    .filter(({ tradingDate }) => tradingDate < entryDate)
    .sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
  const recentStart = Math.max(20, prior.length - 5);
  const observed = new Decimal(opening.price);

  for (let index = prior.length - 1; index >= recentStart; index -= 1) {
    const breakoutCandle = prior[index];
    const lookback = prior.slice(index - 20, index);
    if (lookback.length < 20) continue;
    const reference = maximumHigh(lookback);
    const brokeOut = new Decimal(breakoutCandle.close).gt(reference);
    const nearLevel =
      observed.gte(reference.times("0.97")) &&
      observed.lte(reference.times("1.03"));
    if (!brokeOut || !nearLevel) continue;

    return createSuggestion(
      item,
      "pullback",
      "first-pullback-after-breakout",
      [
        {
          kind: "breakout-pullback",
          tradingDate: entryDate,
          breakoutDate: breakoutCandle.tradingDate,
          observed: observed.toString(),
          reference: reference.toString(),
        },
      ],
      generatedAt,
    );
  }
  return null;
}

function scaleInSuggestion(
  item: TradeLibraryEpisode,
  generatedAt: string,
) {
  const count = openingExecutions(item).length;
  if (count < 2) return null;
  return createSuggestion(
    item,
    "scale-in",
    "scale-in",
    [
      {
        kind: "execution-count",
        observed: String(count),
        reference: "1",
      },
    ],
    generatedAt,
  );
}

export function buildTagSuggestions(
  entries: TradeLibraryEntry[],
  candlesByInstrument: Record<string, DailyCandleRecord[]>,
  priorSuggestions: TagSuggestionRecord[],
  generatedAt: string,
) {
  const byId = new Map(
    priorSuggestions.map((suggestion) => [suggestion.id, suggestion]),
  );

  for (const entry of entries) {
    const candles = candlesByInstrument[entry.instrument.id] ?? [];
    for (const item of entry.episodes) {
      const candidates = [
        breakoutSuggestion(item, candles, generatedAt),
        pullbackSuggestion(item, candles, generatedAt),
        scaleInSuggestion(item, generatedAt),
      ].filter(
        (candidate): candidate is TagSuggestionRecord =>
          candidate !== null,
      );

      for (const candidate of candidates) {
        if (item.confirmedTagIds.includes(candidate.tagId)) continue;
        if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
      }
    }
  }

  return [...byId.values()].sort(
    (a, b) =>
      a.episodeId.localeCompare(b.episodeId) ||
      a.id.localeCompare(b.id),
  );
}
