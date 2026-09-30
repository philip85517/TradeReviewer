import Decimal from "decimal.js";

import {
  compareExecutions,
  type ExecutionConflict,
  type ExecutionReconciliation,
  reconcileExecutions,
} from "./execution-reconciliation";
import {
  executionSettlementCurrency,
  tradeNatureOf,
  type TradeExecution,
} from "../trades/types";

function explicitNatureConflict(execution: TradeExecution): boolean {
  const explicit = execution.source.tradeNature;
  const legacy = execution.source.tradingNature;
  return Boolean(
    (explicit === "simulation" && legacy && legacy !== "simulated") ||
      (explicit && explicit !== "simulation" && legacy === "simulated"),
  );
}

function tradingViewReimportEvidenceKey(
  execution: TradeExecution,
): string | undefined {
  const source = execution.source;
  if (source.platform.trim().toLowerCase() !== "tradingview") return undefined;
  const fingerprint = source.fileFingerprint?.trim();
  const market = execution.instrument.market.trim().toUpperCase();
  const symbol = execution.instrument.symbol.trim().toUpperCase();
  const tradeId = (source.sourceTradeId ?? source.simulationTradeId)?.trim();
  const role = source.simulationRole;
  const sourceDate = source.sourceTimestampText?.trim();
  if (
    !fingerprint ||
    !market ||
    !symbol ||
    !tradeId ||
    (role !== "entry" && role !== "exit") ||
    !sourceDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
  ) {
    return undefined;
  }
  return [
    fingerprint,
    `${market}:${symbol}`,
    tradeId,
    role,
    sourceDate,
  ].join("|");
}

/**
 * The legacy TradingView export and the current parser deliberately keep
 * different row ids and UTC instants.  This identity is the source evidence
 * that survives that representation change.  It never falls back to a
 * derived instant or an account id, because both changed during migration.
 */
export function tradingViewReimportKey(
  execution: TradeExecution,
): string | undefined {
  if (
    explicitNatureConflict(execution) ||
    tradeNatureOf(execution) !== "simulation"
  ) {
    return undefined;
  }
  return tradingViewReimportEvidenceKey(execution);
}

/**
 * The first row-ID parser emitted this exact source shape before it added
 * `simulationRole`. Match that history only when the complete parser row ID
 * and source evidence agree; this is not a price/quantity fuzzy fallback.
 */
function currentParserRowSourceIdentity(
  execution: TradeExecution,
): string | undefined {
  const source = execution.source;
  const fingerprint = source.fileFingerprint?.trim();
  const market = execution.instrument.market.trim();
  const symbol = execution.instrument.symbol.trim();
  const tradeId = source.sourceTradeId?.trim();
  const sourceDate = source.sourceTimestampText?.trim();
  if (
    source.platform.trim().toLowerCase() !== "tradingview" ||
    source.inputKind !== "tradingview" ||
    !fingerprint ||
    !market ||
    !symbol ||
    !tradeId ||
    !Number.isInteger(source.row) ||
    source.row < 1 ||
    !sourceDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
  ) {
    return undefined;
  }
  const expectedId = `tradingview:${fingerprint}:${market}:${symbol}:${tradeId}:${source.row}`;
  if (execution.id !== expectedId) return undefined;
  return JSON.stringify([
    execution.id,
    fingerprint,
    market,
    symbol,
    tradeId,
    sourceDate,
  ]);
}

function currentParserRowIdentity(execution: TradeExecution): string | undefined {
  if (
    explicitNatureConflict(execution) ||
    tradeNatureOf(execution) !== "simulation"
  ) {
    return undefined;
  }
  return currentParserRowSourceIdentity(execution);
}

function decimalValue(value: unknown): Decimal | undefined {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!raw) return undefined;
  try {
    const decimal = new Decimal(raw);
    return decimal.isFinite() ? decimal : undefined;
  } catch {
    return undefined;
  }
}

function decimalEqual(left: unknown, right: unknown) {
  const leftValue = decimalValue(left);
  const rightValue = decimalValue(right);
  return Boolean(leftValue && rightValue && leftValue.eq(rightValue));
}

function optionalSourceAmount(
  execution: TradeExecution,
  field: "grossAmount" | "netAmount",
) {
  const source = execution.source;
  const direct = field === "grossAmount" ? source.grossAmount : source.cashChange;
  const settlement = source.settlement?.[field];
  return direct?.trim() || settlement?.trim() || undefined;
}

function normalizedCurrency(execution: TradeExecution) {
  return executionSettlementCurrency(execution).trim().toUpperCase();
}

function sameFinancialCore(
  existing: TradeExecution,
  incoming: TradeExecution,
): boolean {
  if (existing.side !== incoming.side) return false;
  if (normalizedCurrency(existing) !== normalizedCurrency(incoming)) return false;
  if (!decimalEqual(existing.quantity, incoming.quantity)) return false;
  if (!decimalEqual(existing.price, incoming.price)) return false;
  if (!decimalEqual(existing.fee, incoming.fee)) return false;

  for (const field of ["grossAmount", "netAmount"] as const) {
    const existingAmount = optionalSourceAmount(existing, field);
    const incomingAmount = optionalSourceAmount(incoming, field);
    if (
      existingAmount !== undefined &&
      incomingAmount !== undefined &&
      !decimalEqual(existingAmount, incomingAmount)
    ) {
      return false;
    }
  }
  return true;
}

function groupedByKey(
  executions: readonly TradeExecution[],
) {
  const groups = new Map<string, TradeExecution[]>();
  for (const execution of executions) {
    const key = tradingViewReimportKey(execution);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), execution]);
  }
  return groups;
}

function groupedByCurrentParserRow(
  executions: readonly TradeExecution[],
): Map<string, TradeExecution[]> {
  const groups = new Map<string, TradeExecution[]>();
  for (const execution of executions) {
    const key = currentParserRowIdentity(execution);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), execution]);
  }
  return groups;
}

function groupedByCurrentParserSourceRow(
  executions: readonly TradeExecution[],
): Map<string, TradeExecution[]> {
  const groups = new Map<string, TradeExecution[]>();
  for (const execution of executions) {
    const key = currentParserRowSourceIdentity(execution);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), execution]);
  }
  return groups;
}

function groupedByEvidenceKey(
  executions: readonly TradeExecution[],
): Map<string, TradeExecution[]> {
  const groups = new Map<string, TradeExecution[]>();
  for (const execution of executions) {
    const key = tradingViewReimportEvidenceKey(execution);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), execution]);
  }
  return groups;
}

function conflictFor(
  key: string,
  existing: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
): ExecutionConflict {
  return {
    id: `tradingview-reimport:${key}`,
    candidateKey: key,
    existing: [...existing].sort(compareExecutions),
    incoming: [...incoming].sort(compareExecutions),
  };
}

/**
 * Reconcile TradingView rows before the generic execution matcher sees them.
 * A matched legacy row is always retained verbatim.  Ambiguous multiplicity
 * and financial differences become an explicit conflict so callers can block
 * the import instead of silently appending a second business record.
 */
export function reconcileTradingViewReimports(
  current: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
): ExecutionReconciliation {
  const customCurrent = new Set<string>();
  const customIncoming = new Set<string>();
  const acceptedIncoming: TradeExecution[] = [];
  const duplicates: ExecutionReconciliation["duplicates"] = [];
  const conflicts: ExecutionConflict[] = [];

  const currentEvidenceGroups = groupedByEvidenceKey(current);
  const incomingEvidenceGroups = groupedByEvidenceKey(incoming);
  const explicitNatureConflictKeys = new Set<string>();
  for (const execution of incoming) {
    if (!explicitNatureConflict(execution)) continue;
    explicitNatureConflictKeys.add(
      tradingViewReimportEvidenceKey(execution) ?? `invalid:${execution.id}`,
    );
  }
  for (const execution of current) {
    if (!explicitNatureConflict(execution)) continue;
    const key = tradingViewReimportEvidenceKey(execution);
    if (key && incomingEvidenceGroups.has(key)) explicitNatureConflictKeys.add(key);
  }
  for (const key of [...explicitNatureConflictKeys].sort()) {
    const existing = key.startsWith("invalid:")
      ? []
      : currentEvidenceGroups.get(key) ?? [];
    const next = key.startsWith("invalid:")
      ? incoming.filter((execution) => `invalid:${execution.id}` === key)
      : incomingEvidenceGroups.get(key) ?? [];
    if (next.length === 0) continue;
    conflicts.push(conflictFor(`nature-conflict:${key}`, existing, next));
    for (const execution of existing) customCurrent.add(execution.id);
    for (const execution of next) customIncoming.add(execution.id);
  }

  // A historic row-ID parser record can lack simulationRole, so it cannot
  // form the newer evidence key above. When its exact parser row identity
  // conflicts with the other side's source nature, block that pair here.
  const currentNatureRows = groupedByCurrentParserSourceRow(
    current.filter((execution) => !customCurrent.has(execution.id)),
  );
  const incomingNatureRows = groupedByCurrentParserSourceRow(
    incoming.filter((execution) => !customIncoming.has(execution.id)),
  );
  const natureRowKeys = [...new Set([
    ...currentNatureRows.keys(),
    ...incomingNatureRows.keys(),
  ])].sort();
  for (const key of natureRowKeys) {
    const existing = currentNatureRows.get(key) ?? [];
    const next = incomingNatureRows.get(key) ?? [];
    if (
      existing.length === 0 ||
      next.length === 0 ||
      ![...existing, ...next].some(explicitNatureConflict)
    ) {
      continue;
    }
    conflicts.push(conflictFor(`nature-conflict-row:${key}`, existing, next));
    for (const execution of existing) customCurrent.add(execution.id);
    for (const execution of next) customIncoming.add(execution.id);
  }

  const currentRowGroups = groupedByCurrentParserRow(
    current.filter((execution) => !customCurrent.has(execution.id)),
  );
  const incomingRowGroups = groupedByCurrentParserRow(
    incoming.filter((execution) => !customIncoming.has(execution.id)),
  );
  const rowKeys = [...new Set([...currentRowGroups.keys(), ...incomingRowGroups.keys()])].sort();
  for (const key of rowKeys) {
    const existing = currentRowGroups.get(key) ?? [];
    const next = incomingRowGroups.get(key) ?? [];
    if (existing.length === 0 || next.length === 0) continue;
    if (![...existing, ...next].some((execution) => execution.source.simulationRole === undefined)) continue;
    for (const execution of existing) customCurrent.add(execution.id);
    for (const execution of next) customIncoming.add(execution.id);
    if (existing.length !== 1 || next.length !== 1) {
      conflicts.push(conflictFor(`historical-row:${key}`, existing, next));
      continue;
    }
    const [kept] = existing;
    const [candidate] = next;
    if (
      kept.source.simulationRole &&
      candidate.source.simulationRole &&
      kept.source.simulationRole !== candidate.source.simulationRole
    ) {
      conflicts.push(conflictFor(`historical-row:${key}`, existing, next));
    } else if (sameFinancialCore(kept, candidate)) {
      duplicates.push({ kept, skipped: candidate });
    } else {
      conflicts.push(conflictFor(`historical-row:${key}`, existing, next));
    }
  }

  const currentGroups = groupedByKey(
    current.filter((execution) => !customCurrent.has(execution.id)),
  );
  const incomingGroups = groupedByKey(
    incoming.filter((execution) => !customIncoming.has(execution.id)),
  );
  for (const execution of [...currentGroups.values()].flat()) customCurrent.add(execution.id);
  for (const execution of [...incomingGroups.values()].flat()) customIncoming.add(execution.id);

  const keys = [...new Set([...currentGroups.keys(), ...incomingGroups.keys()])].sort();
  for (const key of keys) {
    const existing = currentGroups.get(key) ?? [];
    const next = incomingGroups.get(key) ?? [];
    if (next.length === 0) continue;
    if (existing.length === 0) {
      if (next.length === 1) acceptedIncoming.push(next[0]);
      else conflicts.push(conflictFor(key, [], next));
      continue;
    }
    if (existing.length !== 1 || next.length !== 1) {
      conflicts.push(conflictFor(key, existing, next));
      continue;
    }
    const [kept] = existing;
    const [candidate] = next;
    if (sameFinancialCore(kept, candidate)) {
      duplicates.push({ kept, skipped: candidate });
    } else {
      conflicts.push(conflictFor(key, existing, next));
    }
  }

  const generic = reconcileExecutions(
    current.filter((execution) => !customCurrent.has(execution.id)),
    incoming.filter((execution) => !customIncoming.has(execution.id)),
  );
  return {
    acceptedIncoming: [...acceptedIncoming, ...generic.acceptedIncoming].sort(
      compareExecutions,
    ),
    automaticReplacementIds: generic.automaticReplacementIds,
    duplicates: [...duplicates, ...generic.duplicates].sort(
      (left, right) =>
        compareExecutions(left.skipped, right.skipped) ||
        compareExecutions(left.kept, right.kept),
    ),
    conflicts: [...conflicts, ...generic.conflicts].sort((left, right) =>
      left.candidateKey.localeCompare(right.candidateKey),
    ),
  };
}

export type TradingViewReimportMerge = {
  merged?: TradeExecution[];
  reconciliation: ExecutionReconciliation;
};

export function mergeTradingViewReimports(
  current: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
): TradingViewReimportMerge {
  const reconciliation = reconcileTradingViewReimports(current, incoming);
  if (reconciliation.conflicts.length > 0) {
    return { reconciliation };
  }
  const replacementIds = new Set(reconciliation.automaticReplacementIds);
  const merged = [
    ...current.filter((execution) => !replacementIds.has(execution.id)),
    ...reconciliation.acceptedIncoming,
  ];
  const byId = new Map<string, TradeExecution>();
  for (const execution of merged) {
    if (!byId.has(execution.id)) byId.set(execution.id, execution);
  }
  return {
    reconciliation,
    merged: [...byId.values()].sort(compareExecutions),
  };
}
