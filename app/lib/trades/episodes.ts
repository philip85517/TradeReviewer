import Decimal from "decimal.js";
import { simulationScope } from "./trading-nature";

import { canonicalInstrumentId } from "../instruments/display-name";
import type { MonthlyStatement, StatementPosition, StatementEvent } from "../import/monthly-statement";
import { isExecutionBackedIpoAllocation, replayExecutionAt, replayCursorAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
import { resolveIpoAcquisitionCost, type IpoAcquisitionCost } from "./ipo-cost";
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

function isZeroStatementQuantity(value: string | undefined): boolean {
  if (value === undefined) return false;
  try {
    return new Decimal(value).isZero();
  } catch {
    return false;
  }
}

function statementCoverageGaps(previous: string | undefined, next: string, coveredMonths: string[]): Array<{ from: string; to: string }> {
  if (!previous) return [];
  const ordinal = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const monthLabel = (value: number) => `${Math.floor(value / 12).toString().padStart(4, "0")}-${(value % 12 + 1).toString().padStart(2, "0")}`;
  const covered = new Set(coveredMonths.map(ordinal));
  const gaps: Array<{ from: string; to: string }> = [];
  let start: number | undefined;
  let end: number | undefined;
  for (let month = ordinal(previous) + 1; month < ordinal(next); month++) {
    if (!covered.has(month)) {
      start ??= month;
      end = month;
      continue;
    }
    if (start !== undefined && end !== undefined) gaps.push({ from: monthLabel(start), to: monthLabel(end) });
    start = undefined;
    end = undefined;
  }
  if (start !== undefined && end !== undefined) gaps.push({ from: monthLabel(start), to: monthLabel(end) });
  return gaps;
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
  const blockingReason = (reason: string) => reason !== "coverage-gap";
  const reasonsForAccuracy = (reasons: Iterable<string>) => [...new Set([...reasons].filter(blockingReason))];
  const flag = (key: string, reason: string, episode?: TradeEpisode) => {
    const reasons = issues.get(key) ?? new Set<string>();
    reasons.add(reason);
    issues.set(key, reasons);
    const accuracyReasons = reasonsForAccuracy([...(episode?.accuracy?.reasons ?? []), ...reasons]);
    if (episode && accuracyReasons.length) episode.accuracy = { pnl: "unavailable", reasons: accuracyReasons };
  };
  const evidenceKey = (item: StatementPosition | StatementEvent) => {
    // Broker inventory is evidence for actual fills only, never a simulation run.
    const template = executions.find(execution =>
      tradeNatureOf(execution) !== "simulation" && execution.accountId === item.accountId &&
      item.symbol && item.market && canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) === canonicalInstrumentId(item.symbol, item.market));
    return template ? episodeKey(template) : undefined;
  };
  type Entry = { at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; uncertaintyKey?: string };
  const timeline: Entry[] = executions.filter(e => !new Decimal(e.quantity).isZero()).map(execution => ({ at: replayExecutionAt(execution), execution }));
  const positions = [...new Map([...evidence.flatMap(e => e.positions), ...executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])].map(p => [JSON.stringify([p.documentId, evidenceKey(p), p.phase, p.date, p.quantity]), p])).values()];
  const events = [...evidence.flatMap(e => e.events), ...executions.flatMap(e => e.source.positionEvents ?? [])];
  const ipoAllocations = [...new Map(events.filter(event => event.kind === "ipo" && event.quantity !== undefined).map(event => [event.id, event])).values()];
  const ipoCosts = new Map<string, IpoAcquisitionCost>();
  const ipoEvidenceCosts = new Map<string, IpoAcquisitionCost>();
  const ipoCashEvidenceIds = new Set<string>();
  const actualExecutions = executions.filter(execution => tradeNatureOf(execution) !== "simulation");
  const executionsForAllocation = (allocation: StatementEvent) => actualExecutions.filter(execution =>
    execution.accountId === allocation.accountId && allocation.symbol !== undefined && allocation.market !== undefined &&
    canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) === canonicalInstrumentId(allocation.symbol, allocation.market),
  );
  const eventById = new Map(events.map(event => [event.id, event]));
  for (const allocation of ipoAllocations) {
    const scopedExecutions = executionsForAllocation(allocation);
    const currencies = new Set(scopedExecutions.map(execution => execution.instrument.currency.toUpperCase()));
    if (currencies.size > 1) {
      for (const execution of scopedExecutions) flag(episodeKey(execution), "currency-conflict");
      continue;
    }
    const instrumentCurrency = [...currencies][0];
    const evidenceCost = resolveIpoAcquisitionCost(allocation, events, [], instrumentCurrency);
    if (evidenceCost) ipoEvidenceCosts.set(allocation.id, evidenceCost);
    for (const id of evidenceCost?.evidenceIds ?? []) ipoCashEvidenceIds.add(id);
    const cost = resolveIpoAcquisitionCost(allocation, events, actualExecutions, instrumentCurrency);
    if (cost) ipoCosts.set(allocation.id, cost);
  }
  const isAttributableIpoCashEvent = (event: StatementEvent) => ipoCashEvidenceIds.has(event.id);
  const isNonInventoryIpoEvidence = (event: StatementEvent) =>
    event.kind === "ipo" && event.quantity !== undefined && isZeroStatementQuantity(event.quantity);
  const seen = new Set<string>();
  const pendingEvents = new Map<string, StatementEvent[]>();
  const coverageWarnings = new Map<string, NonNullable<TradeEpisode["warnings"]>>();
  const addCoverageWarning = (key: string, warning: { from: string; to: string }, episode?: TradeEpisode) => {
    const warnings = coverageWarnings.get(key) ?? [];
    if (!warnings.some(item => item.from === warning.from && item.to === warning.to)) warnings.push({ code: "statement-coverage-gap", ...warning });
    coverageWarnings.set(key, warnings);
    if (episode) episode.warnings = [...warnings];
  };
  const attachPendingEvents = (key: string, target: TradeEpisode) => {
    const pending = pendingEvents.get(key);
    if (!pending?.length) return;
    target.positionEvents = [...new Map([...(target.positionEvents ?? []), ...pending].map(event => [event.id, event])).values()];
    pendingEvents.delete(key);
    if (pending.some(event => !isAttributableIpoCashEvent(event) && !isNonInventoryIpoEvidence(event))) flag(key, "position-event", target);
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
    timeline.push({ at: event.kind !== "ipo" && event.date.length === 10 ? `${event.date}T00:00:00.000Z` : statementEventAt(event), event });
  }
  // Activate uncertainty at the affected day/month boundary, before its fills
  // or inventory evidence. Earlier closed rounds must not inherit future risk.
  for (const allocation of ipoAllocations) {
    if (!new Decimal(allocation.quantity!).isPositive() || isExecutionBackedIpoAllocation(allocation, actualExecutions)) continue;
    const preciseOpen = /^\d{4}-\d{2}-\d{2}$/.test(allocation.date) && allocation.displayTimePolicy === "session-open";
    if (!preciseOpen) for (const execution of executionsForAllocation(allocation)) {
      const date = execution.source.tradingDate ?? execution.source.marketCalendarDate ?? execution.executedAt.slice(0, 10);
      if (date.startsWith(allocation.date)) {
        const boundary = `${allocation.date.length === 7 ? `${allocation.date}-01` : allocation.date}T00:00:00.000Z`;
        // A market-calendar fill may occur before its date's UTC midnight.
        const at = [boundary, replayExecutionAt(execution)].sort()[0];
        timeline.push({ at, uncertaintyKey: episodeKey(execution) });
      }
    }
  }
  const rank = (entry: Entry) => entry.uncertaintyKey ? -1 : entry.position ? (entry.position.phase === "opening" ? 0 : 3) : entry.event ? 1 : 2;
  timeline.sort((a, b) => a.at.localeCompare(b.at) || rank(a) - rank(b) || (a.execution && b.execution ? sortByExecutionTime(a.execution, b.execution) : 0));

  for (const entry of timeline) {
    if (entry.uncertaintyKey) {
      flag(entry.uncertaintyKey, "ambiguous-event-order", active.get(entry.uncertaintyKey)?.episode);
      continue;
    }
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
        const covered = [...executions.filter(e => episodeKey(e) === key).flatMap(e => e.source.statementMonth ? [e.source.statementMonth] : []), ...positions.filter(p => evidenceKey(p) === key).map(p => p.date.slice(0, 7)), ...evidence.filter(e => e.accountId === item.accountId && e.month && [...e.positions, ...e.events].some(row => row.accountId === item.accountId && row.market === item.market)).map(e => e.month!)];
        const coverageGaps = statementCoverageGaps(lastActivity.get(key), entry.position.date, covered);
        if (existing && next.eq(existing.position)) {
          for (const gap of coverageGaps) addCoverageWarning(key, gap, existing.episode);
          if (coverageGaps.length) flag(key, "coverage-gap", existing.episode);
        } else if (coverageGaps.length) {
          flag(key, "position-gap", existing?.episode);
        }
        lastActivity.set(key, entry.position.date);
        if (existing && !next.eq(existing.position)) flag(key, "position-gap", existing.episode);
        if (existing && next.eq(existing.position)) continue; // Snapshots are boundaries, never additions.
      } else {
        const event = entry.event!;
        if (isExecutionBackedIpoAllocation(event, actualExecutions)) continue;
        // Attributed cash belongs to its acquisition round, not the round that
        // happened to be active on the cash posting date.
        if (isAttributableIpoCashEvent(event)) continue;
        const isIpoAllocation = event.kind === "ipo" && event.quantity !== undefined;
        if (isIpoAllocation && isZeroStatementQuantity(event.quantity)) {
          if (existing) {
            (existing.episode.positionEvents ??= []).push(event);
          } else {
            const pending = pendingEvents.get(key) ?? [];
            if (!pending.some(item => item.id === event.id)) pending.push(event);
            pendingEvents.set(key, pending);
          }
          continue; // A zero allotment is evidence of a failed application, not inventory.
        }
        if (isIpoAllocation && new Decimal(event.quantity!).isNegative()) {
          if (existing) {
            (existing.episode.positionEvents ??= []).push(event);
            flag(key, "position-event", existing.episode);
          } else {
            const pending = pendingEvents.get(key) ?? [];
            if (!pending.some(item => item.id === event.id)) pending.push(event);
            pendingEvents.set(key, pending);
          }
          continue; // A negative IPO result is not trusted as a positive lot.
        }
        if (event.kind !== "transfer-in" && event.kind !== "transfer-out" && !isIpoAllocation) {
          if (existing) {
            (existing.episode.positionEvents ??= []).push(event);
            if (!isAttributableIpoCashEvent(event) && !isNonInventoryIpoEvidence(event)) flag(key, "position-event", existing.episode);
          } else {
            const pending = pendingEvents.get(key) ?? [];
            if (!pending.some(item => item.id === event.id)) pending.push(event);
            pendingEvents.set(key, pending);
          }
          continue; // Non-inventory evidence never creates another fill or inventory lot.
        }
        const ipoHasExplicitReplayOrder = isIpoAllocation
          && /^\d{4}-\d{2}-\d{2}$/.test(event.date)
          && event.displayTimePolicy === "session-open";
        const ambiguous = !ipoHasExplicitReplayOrder && ((event.date.length === 10
          && executions.some(e => episodeKey(e) === key && (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)) === event.date))
          || (event.date.length === 7
            && executions.some(e => episodeKey(e) === key && (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)).startsWith(event.date))));
        if (ambiguous) flag(key, "ambiguous-event-order", existing?.episode);
        if (event.quantity === undefined) {
          flag(key, "position-event", existing?.episode);
          continue;
        }
        const isAddition = event.kind === "transfer-in" || isIpoAllocation;
        next = next.plus(new Decimal(event.quantity).abs().times(isAddition ? 1 : -1));
        const knownIpoCost = isIpoAllocation && ipoCosts.has(event.id);
        if (!knownIpoCost) flag(key, "position-event", existing?.episode);
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
        const inherited = reasonsForAccuracy(issues.get(key) ?? []);
        if (inherited.length) target.episode.accuracy = { pnl: "unavailable", reasons: inherited };
        target.episode.id += `:evidence:${encodeURIComponent(entry.at)}`;
        target.episode.executions = [];
        target.episode.startedAt = entry.at;
        target.episode.direction = next.isNegative() ? "short" : "long";
        target.openingQuantity = next.abs();
        if (entry.position) target.episode.initialPosition = entry.position;
        if (coverageWarnings.has(key)) target.episode.warnings = [...coverageWarnings.get(key)!];
        attachPendingEvents(key, target.episode);
        if (!(entry.event?.kind === "ipo" && entry.event.quantity !== undefined && ipoCosts.has(entry.event.id))) flag(key, "initial-position", target.episode);
        active.set(key, target);
      }
      if (entry.event) (target.episode.positionEvents ??= []).push(entry.event);
      const cost = entry.event && ipoCosts.get(entry.event.id);
      if (cost) {
        (target.episode.ipoCostEvidence ??= []).push({ allocationId: entry.event!.id, evidenceIds: [...cost.evidenceIds] });
        const cashEvidence = cost.evidenceIds.map(id => eventById.get(id)!);
        target.episode.positionEvents = [...new Map([...(target.episode.positionEvents ?? []), ...cashEvidence].map(event => [event.id, event])).values()];
      }
      target.position = next;
      target.episode.openingQuantity = target.openingQuantity.toString();
      target.episode.remainingQuantity = next.abs().toString();
      const eventHasKnownCost = entry.event?.kind === "ipo"
        && entry.event.quantity !== undefined
        && ipoCosts.has(entry.event.id);
      if (!eventHasKnownCost) flag(key, "unknown-cost", target.episode);
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
      if (issues.has(key)) {
        const accuracyReasons = reasonsForAccuracy(issues.get(key)!);
        if (accuracyReasons.length) created.episode.accuracy = { pnl: "unavailable", reasons: accuracyReasons };
      }
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
      if (existing.episode.accuracy?.reasons.some(reason => ["ambiguous-event-order", "ambiguous-opening", "history-incomplete", "unknown-fees", "currency-conflict"].includes(reason))) reversed.episode.accuracy = existing.episode.accuracy;
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
    // An execution-backed acquisition owns the same cash context, while the
    // shared duplicate predicate prevents adding its inventory/cost twice.
    for (const allocation of ipoAllocations) {
      if (episode.tradeNature === "simulation" || !isExecutionBackedIpoAllocation(allocation, episode.executions)) continue;
      const cost = ipoEvidenceCosts.get(allocation.id);
      if (!cost) continue;
      const cash = cost.evidenceIds.map(id => eventById.get(id)!);
      episode.positionEvents = [...new Map([...(episode.positionEvents ?? []), allocation, ...cash].map(event => [event.id, event])).values()];
    }
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
          if (ipoCashEvidenceIds.has(e.id)) return episodeEventIds.has(e.id);
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
