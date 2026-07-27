import Decimal from "decimal.js";

import { canonicalInstrumentId } from "../instruments/display-name";
import type { TradeEpisode, TradeExecution } from "./types";

type EpisodeAccumulator = {
  episode: TradeEpisode;
  position: Decimal;
  openingQuantity: Decimal;
};

function sortByExecutionTime(a: TradeExecution, b: TradeExecution) {
  return (
    a.executedAt.localeCompare(b.executedAt) ||
    (a.source.fileFingerprint ?? a.source.fileName ?? "").localeCompare(
      b.source.fileFingerprint ?? b.source.fileName ?? "",
    ) ||
    a.source.row - b.source.row ||
    a.id.localeCompare(b.id)
  );
}

function episodeKey(execution: TradeExecution) {
  return `${execution.accountId}:${canonicalInstrumentId(
    execution.instrument.symbol,
    execution.instrument.market,
  )}`;
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
      id: `${episodeKey(execution)}:${execution.executedAt}:${execution.id}`,
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

function executionPart(
  execution: TradeExecution,
  quantity: Decimal,
  suffix: string,
  allocatedFee: Decimal,
): TradeExecution {
  return {
    ...execution,
    id: `${execution.id}:${suffix}`,
    source: { ...execution.source },
    instrument: { ...execution.instrument },
    quantity: quantity.toString(),
    fee: allocatedFee.toString(),
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

    const crossesZero =
      !addsExposure && delta.abs().gt(existing.position.abs());
    if (crossesZero) {
      const totalQuantity = delta.abs();
      const closingQuantity = existing.position.abs();
      const reversingQuantity = totalQuantity.minus(closingQuantity);
      const totalFee = new Decimal(execution.fee || 0);
      const closingFee = totalFee
        .mul(closingQuantity)
        .div(totalQuantity);
      const reversingFee = totalFee.minus(closingFee);
      const closingExecution = executionPart(
        execution,
        closingQuantity,
        "close",
        closingFee,
      );
      const reversingExecution = executionPart(
        execution,
        reversingQuantity,
        "reverse",
        reversingFee,
      );

      existing.episode.executions.push(closingExecution);
      existing.position = new Decimal(0);
      existing.episode.remainingQuantity = "0";
      existing.episode.status = "closed";
      existing.episode.endedAt = execution.executedAt;
      episodes.push(existing.episode);

      const reversed = createEpisode(reversingExecution);
      active.set(key, reversed);
      continue;
    }

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
