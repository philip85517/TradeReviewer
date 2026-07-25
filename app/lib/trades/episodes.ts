import Decimal from "decimal.js";

import type { TradeEpisode, TradeExecution } from "./types";

type EpisodeAccumulator = {
  episode: TradeEpisode;
  position: Decimal;
  openingQuantity: Decimal;
};

function sortByExecutionTime(a: TradeExecution, b: TradeExecution) {
  return a.executedAt.localeCompare(b.executedAt);
}

function episodeKey(execution: TradeExecution) {
  return `${execution.accountId}:${execution.instrument.id}`;
}

function signedQuantity(execution: TradeExecution) {
  const quantity = new Decimal(execution.quantity).abs();
  return execution.side === "buy" ? quantity : quantity.negated();
}

function createEpisode(execution: TradeExecution): EpisodeAccumulator {
  const position = signedQuantity(execution);
  const direction = position.isNegative() ? "short" : "long";
  const openingQuantity = position.abs();

  return {
    position,
    openingQuantity,
    episode: {
      id: `${episodeKey(execution)}:${execution.executedAt}`,
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      instrument: execution.instrument,
      direction,
      status: "open",
      startedAt: execution.executedAt,
      openingQuantity: openingQuantity.toString(),
      remainingQuantity: position.abs().toString(),
      executions: [execution],
    },
  };
}

export function buildTradeEpisodes(
  executions: TradeExecution[],
): TradeEpisode[] {
  const active = new Map<string, EpisodeAccumulator>();
  const episodes: TradeEpisode[] = [];

  for (const execution of [...executions].sort(sortByExecutionTime)) {
    const key = episodeKey(execution);
    const existing = active.get(key);

    if (!existing) {
      const created = createEpisode(execution);
      if (created.position.isZero()) continue;
      active.set(key, created);
      continue;
    }

    const delta = signedQuantity(execution);
    const addsExposure =
      existing.position.isPositive() === delta.isPositive();

    existing.episode.executions.push(execution);
    existing.position = existing.position.plus(delta);

    if (addsExposure) {
      existing.openingQuantity = existing.openingQuantity.plus(delta.abs());
    }

    existing.episode.openingQuantity =
      existing.openingQuantity.toString();
    existing.episode.remainingQuantity = existing.position.abs().toString();

    if (existing.position.isZero()) {
      existing.episode.status = "closed";
      existing.episode.endedAt = execution.executedAt;
      episodes.push(existing.episode);
      active.delete(key);
    }
  }

  for (const accumulator of active.values()) {
    episodes.push(accumulator.episode);
  }

  return episodes.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
