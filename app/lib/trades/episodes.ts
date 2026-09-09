import Decimal from "decimal.js";
import { simulationScope } from "./trading-nature";

import { canonicalInstrumentId } from "../instruments/display-name";
import type { MonthlyStatement, StatementPosition, StatementEvent } from "../import/monthly-statement";
import { hasStatementMonthGap, replayExecutionAt, replayCursorAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
import {
  tradeNatureOf,
  tradeScopeKey,
  type TradeEpisode,
  type TradeExecution,
} from "./types";

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
    (simulationScope(a) && simulationScope(b)
      ? (a.source.sourceOrder ?? a.source.row) - (b.source.sourceOrder ?? b.source.row)
      : a.source.row - b.source.row) ||
    a.id.localeCompare(b.id)
  );
}

function episodeKey(execution: TradeExecution) {
  return `${execution.accountId}:${canonicalInstrumentId(
    execution.instrument.symbol,
    execution.instrument.market,
  )}${tradeNatureOf(execution) === "unknown" ? "" : `:${tradeScopeKey(execution)}`}`;
}

function signedQuantity(execution: TradeExecution) {
  const quantity = new Decimal(execution.quantity).abs();
  return execution.side === "buy" ? quantity : quantity.negated();
}

function stableOpeningKey(execution: TradeExecution) {
  // Persisted legacy simulation reviews use a prefixed scope. Keep their
  // identity while using the canonical scope for episode accumulation.
  const legacySimulation = tradeNatureOf(execution) === "simulation" &&
    (execution.source.tradingNature === "simulated" || execution.source.simulationRole !== undefined);
  const openingScope = legacySimulation
    ? `${simulationScope(execution)}:${execution.accountId}:${canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market)}`
    : episodeKey(execution);
  return JSON.stringify([
    openingScope,
    execution.executedAt,
    execution.side,
    new Decimal(execution.quantity).abs().toString(),
    new Decimal(execution.price).toString(),
  ]);
}

function createEpisode(
  execution: TradeExecution,
  openingOccurrences: Map<string, number>,
): EpisodeAccumulator {
  const position = signedQuantity(execution);
  const direction = position.isNegative() ? "short" : "long";
  const openingQuantity = position.abs();
  const openingKey = stableOpeningKey(execution);
  const occurrence = (openingOccurrences.get(openingKey) ?? 0) + 1;
  openingOccurrences.set(openingKey, occurrence);

  return {
    position,
    openingQuantity,
    episode: {
      id: `episode:${encodeURIComponent(openingKey)}:${occurrence}`,
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      instrument: execution.instrument,
      tradeNature: tradeNatureOf(execution),
      ...(execution.source.simulationRunId
        ? { simulationRunId: execution.source.simulationRunId }
        : {}),
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
  evidence: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">[] = [],
): TradeEpisode[] {
  const active = new Map<string, EpisodeAccumulator>();
  const openingOccurrences = new Map<string, number>();
  const episodes: TradeEpisode[] = [];
  const issues = new Map<string, Set<string>>();
  const flag = (key: string, reason: string, episode?: TradeEpisode) => {
    const reasons = issues.get(key) ?? new Set<string>();
    reasons.add(reason);
    issues.set(key, reasons);
    if (episode) episode.accuracy = { pnl: "unavailable", reasons: [...new Set([...(episode.accuracy?.reasons ?? []), ...reasons])] };
  };
  const evidenceKey = (item: StatementPosition | StatementEvent) => {
    // Broker inventory is evidence for actual fills only, never a simulation run.
    const template = executions.find(execution =>
      tradeNatureOf(execution) !== "simulation" && execution.accountId === item.accountId &&
      item.symbol && item.market && canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) === canonicalInstrumentId(item.symbol, item.market));
    return template ? episodeKey(template) : undefined;
  };
  type Entry = { at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent };
  const timeline: Entry[] = executions.filter(e => !new Decimal(e.quantity).isZero()).map(execution => ({ at: replayExecutionAt(execution), execution }));
  const positions = [...new Map([...evidence.flatMap(e => e.positions), ...executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])].map(p => [JSON.stringify([p.documentId, evidenceKey(p), p.phase, p.date, p.quantity]), p])).values()];
  const events = [...evidence.flatMap(e => e.events), ...executions.flatMap(e => e.source.positionEvents ?? [])];
  const seen = new Set<string>();
  const pendingEvents = new Map<string, StatementEvent[]>();
  const attachPendingEvents = (key: string, target: TradeEpisode) => {
    const pending = pendingEvents.get(key);
    if (!pending?.length) return;
    target.positionEvents = [...new Map([...(target.positionEvents ?? []), ...pending].map(event => [event.id, event])).values()];
    pendingEvents.delete(key);
    flag(key, "position-event", target);
  };
  const lastActivity = new Map<string, string>();
  const knownBoundary = new Set<string>();
  const seenExecution = new Set<string>();
  for (const position of positions) {
    const id = JSON.stringify([evidenceKey(position), position.phase, position.date, position.quantity]);
    if (seen.has(id)) continue;
    seen.add(id);
    timeline.push({ at: statementPositionAt(position), position });
  }
  for (const event of events) {
    const id = `${event.accountId}:${event.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    timeline.push({ at: event.date.length === 10 ? `${event.date}T00:00:00.000Z` : statementEventAt(event), event });
  }
  const rank = (entry: Entry) => entry.position ? (entry.position.phase === "opening" ? 0 : 3) : entry.event ? 1 : 2;
  timeline.sort((a, b) => a.at.localeCompare(b.at) || rank(a) - rank(b) || (a.execution && b.execution ? sortByExecutionTime(a.execution, b.execution) : 0));

  for (const entry of timeline) {
    if (!entry.execution) {
      const item = entry.position ?? entry.event!;
      const key = evidenceKey(item);
      if (!key) continue;
      const template = executions.find(e => episodeKey(e) === key);
      if (!template) continue; // Inventory-only instruments need an Instrument from the caller before rendering.
      const existing = active.get(key);
      let next = existing?.position ?? new Decimal(0);
      if (entry.position) {
        knownBoundary.add(key);
        next = new Decimal(entry.position.quantity);
        const covered = [...executions.filter(e => episodeKey(e) === key).flatMap(e => e.source.statementMonth ? [e.source.statementMonth] : []), ...positions.filter(p => evidenceKey(p) === key).map(p => p.date.slice(0, 7)), ...evidence.filter(e => e.accountId === item.accountId && e.month).map(e => e.month!)];
        if (hasStatementMonthGap(lastActivity.get(key), entry.position.date, covered)) flag(key, "position-gap", existing?.episode);
        lastActivity.set(key, entry.position.date);
        if (existing && !next.eq(existing.position)) flag(key, "position-gap", existing.episode);
        if (existing && next.eq(existing.position)) continue; // Snapshots are boundaries, never additions.
      } else {
        const event = entry.event!;
        if (event.kind !== "transfer-in" && event.kind !== "transfer-out") {
          if (existing) {
            (existing.episode.positionEvents ??= []).push(event);
            flag(key, "position-event", existing.episode);
          } else {
            const pending = pendingEvents.get(key) ?? [];
            if (!pending.some(item => item.id === event.id)) pending.push(event);
            pendingEvents.set(key, pending);
          }
          continue; // IPO/distribution evidence never creates another fill or inventory lot.
        }
        const ambiguous = event.date.length === 10 && executions.some(e => episodeKey(e) === key && (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)) === event.date);
        if (ambiguous) flag(key, "ambiguous-event-order", existing?.episode);
        if (event.quantity === undefined) {
          flag(key, "position-event", existing?.episode);
          continue;
        }
        next = next.plus(new Decimal(event.quantity).abs().times(event.kind === "transfer-in" ? 1 : -1));
        flag(key, "position-event", existing?.episode);
      }
      if (existing && (next.isZero() || next.isPositive() !== existing.position.isPositive())) {
        existing.episode.status = "closed";
        existing.episode.endedAt = entry.at;
        existing.episode.remainingQuantity = "0";
        flag(key, "position-gap", existing.episode);
        episodes.push(existing.episode);
        active.delete(key);
      }
      if (next.isZero()) continue;
      let target = active.get(key);
      if (!target) {
        target = createEpisode(template, openingOccurrences);
        target.episode.id += `:evidence:${encodeURIComponent(entry.at)}`;
        target.episode.executions = [];
        target.episode.startedAt = entry.at;
        target.episode.direction = next.isNegative() ? "short" : "long";
        target.openingQuantity = next.abs();
        if (entry.position) target.episode.initialPosition = entry.position;
        attachPendingEvents(key, target.episode);
        flag(key, "initial-position", target.episode);
        active.set(key, target);
      }
      if (entry.event) (target.episode.positionEvents ??= []).push(entry.event);
      target.position = next;
      target.episode.openingQuantity = target.openingQuantity.toString();
      target.episode.remainingQuantity = next.abs().toString();
      flag(key, "unknown-cost", target.episode);
      continue;
    }
    const execution = entry.execution;
    const key = episodeKey(execution);
    lastActivity.set(key, execution.source.tradingDate ?? execution.executedAt);
    const existing = active.get(key);
    if (!existing && !seenExecution.has(key) && !knownBoundary.has(key) && execution.side === "sell" && (execution.source.statementMonth || execution.source.templateId) && execution.source.positionEffect !== "open-short") flag(key, "ambiguous-opening");
    seenExecution.add(key);
    if (execution.source.feeStatus === "unknown") flag(key, "unknown-fees", existing?.episode);
    if (execution.source.historyIncomplete?.length) flag(key, "history-incomplete", existing?.episode);

    if (!existing) {
      const created = createEpisode(execution, openingOccurrences);
      if (issues.has(key)) created.episode.accuracy = { pnl: "unavailable", reasons: [...issues.get(key)!] };
      attachPendingEvents(key, created.episode);
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

      const reversed = createEpisode(
        reversingExecution,
        openingOccurrences,
      );
      if (existing.episode.accuracy?.reasons.some(reason => ["ambiguous-event-order", "ambiguous-opening", "history-incomplete", "unknown-fees"].includes(reason))) reversed.episode.accuracy = existing.episode.accuracy;
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
      if (!existing.episode.accuracy?.reasons.includes("ambiguous-event-order")) issues.delete(key);
    }
  }

  for (const accumulator of active.values()) {
    episodes.push(accumulator.episode);
  }

  return episodes.filter(e => e.executions.length > 0).map(episode => {
    // Episode replay starts at its own boundary. Reusing a pre-reversal snapshot
    // on the new short episode would incorrectly seed the previous long again.
    const start = Date.parse(episode.startedAt);
    const end = episode.endedAt ? Date.parse(replayCursorAt(episode.endedAt)) : Infinity;
    return { ...episode, ...(episode.accuracy?.reasons.some(r => r === "ambiguous-event-order" || r === "ambiguous-opening") ? { directionKnown: false as const } : {}), executions: episode.executions.map((execution, index) => {
      const source = { ...execution.source };
      if (index === 0 && episode.initialPosition) source.openingPosition = episode.initialPosition;
      if (index === 0 && episode.positionEvents?.length) {
        source.positionEvents = [...new Map([...(source.positionEvents ?? []), ...episode.positionEvents].map(event => [event.id, event])).values()];
      }
      if (source.openingPosition) {
        const p = source.openingPosition;
        const at = Date.parse(statementPositionAt(p));
        if (at < start || at > end) delete source.openingPosition;
      }
      // Boundaries may follow the last fill, but cannot revive an already closed episode.
      const statementPositions = positions.filter(p => evidenceKey(p) === episodeKey(execution) && Date.parse(statementPositionAt(p)) >= start && Date.parse(statementPositionAt(p)) <= end);
      if (statementPositions.length) source.statementPositions = statementPositions;
      else delete source.statementPositions;
      if (source.positionEvents) {
        const episodeEventIds = new Set((episode.positionEvents ?? []).map(event => event.id));
        source.positionEvents = source.positionEvents.filter(e => {
          const at = Date.parse(e.date);
          // Keep same-day uncertainty so chart callers receive its accuracy flag.
          // Events attached before the first execution (notably IPO allotments)
          // are contextual evidence for this episode and must remain visible.
          return episodeEventIds.has(e.id) || ((at >= start || e.date === episode.startedAt.slice(0, 10)) && at <= end);
        });
        if (!source.positionEvents.length) delete source.positionEvents;
      }
      return { ...execution, source };
    }) };
  }).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
