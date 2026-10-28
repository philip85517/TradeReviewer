import { Temporal } from "@js-temporal/polyfill";
import Decimal from "decimal.js";

import { canonicalInstrumentId } from "../instruments/display-name";
import { resolvedTradeNatureOf } from "../trades/nature-resolution";
import type { TradeExecution } from "../trades/types";

export type ReconciliationDecision =
  | "keep-existing"
  | "use-incoming"
  | "keep-both";

export type ExecutionConflict = {
  id: string;
  candidateKey: string;
  existing: TradeExecution[];
  incoming: TradeExecution[];
};

export type ExecutionReconciliation = {
  acceptedIncoming: TradeExecution[];
  automaticReplacementIds: string[];
  duplicates: Array<{
    kept: TradeExecution;
    skipped: TradeExecution;
  }>;
  conflicts: ExecutionConflict[];
};

type TaggedExecution = {
  execution: TradeExecution;
  origin: "current" | "incoming";
  candidateKey: string;
  coreKey: string;
  sourceInstanceId: string;
  rowVerified: boolean;
  instantVerified: boolean;
  coreVerified: boolean;
};

function executionInstantIdentity(executedAt: string) {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(executedAt)) {
      return { value: `date:${Temporal.PlainDate.from(executedAt).toString()}`, verified: true } as const;
    }
    return {
      value: Temporal.Instant.from(executedAt).toString(),
      verified: true,
    } as const;
  } catch {
    return { value: `invalid:${executedAt}`, verified: false } as const;
  }
}

function decimalIdentity(value: unknown, allowZero = false) {
  const raw = typeof value === "string" ? value : String(value ?? "");
  try {
    const decimal = new Decimal(raw);
    if (!decimal.isFinite() || (allowZero ? decimal.lt(0) : !decimal.gt(0))) {
      return { value: `invalid:${raw}`, verified: false } as const;
    }
    return { value: decimal.toString(), verified: true } as const;
  } catch {
    return { value: `invalid:${raw}`, verified: false } as const;
  }
}

function executionInstrumentIdentity(execution: TradeExecution) {
  const instrument = execution.instrument;
  const symbol = instrument?.symbol;
  const market = instrument?.market;
  if (
    typeof symbol === "string" &&
    symbol.trim() &&
    typeof market === "string" &&
    market.trim()
  ) {
    return canonicalInstrumentId(symbol, market);
  }
  const instrumentId = instrument?.id;
  return typeof instrumentId === "string" && instrumentId.trim()
    ? instrumentId.trim().toUpperCase()
    : `unknown:${execution.id}`;
}

function executionScopeIdentity(execution: TradeExecution) {
  const nature = resolvedTradeNatureOf(execution);
  const source = execution.source;
  const simulation = nature === "simulation" || source.simulationRunId !== undefined;
  return JSON.stringify([
    execution.accountId,
    executionInstrumentIdentity(execution),
    execution.instrument.currency.trim().toUpperCase(),
    nature,
    simulation ? source.simulationRunId?.trim() || source.fileFingerprint?.trim() || execution.id : "",
    simulation ? source.sourceTradeId ?? source.simulationTradeId ?? "" : "",
    simulation ? source.simulationRole ?? "unknown" : "",
  ]);
}

export function executionCandidateKey(execution: TradeExecution) {
  return `${executionScopeIdentity(execution)}|${execution.source.timePrecision ?? "instant"}|${executionInstantIdentity(execution.executedAt).value}`;
}

function executionCoreIdentity(execution: TradeExecution) {
  const quantity = decimalIdentity(execution.quantity);
  const price = decimalIdentity(execution.price, true);
  return {
    value: [
      execution.side,
      quantity.value,
      price.value,
      ...(execution.source.timePrecision === "date-only" ? [execution.source.statementRowFingerprint ?? "", decimalIdentity(execution.fee || "0", true).value] : []),
    ].join("|"),
    verified: quantity.verified && price.verified,
  };
}

export function executionCoreKey(execution: TradeExecution) {
  return executionCoreIdentity(execution).value;
}

function reportedFeesDisagree(left: TradeExecution, right: TradeExecution) {
  if (left.source.feeStatus !== "reported" || right.source.feeStatus !== "reported") return false;
  try {
    const leftFee = new Decimal(left.fee);
    const rightFee = new Decimal(right.fee);
    return leftFee.isFinite() && rightFee.isFinite() && !leftFee.eq(rightFee);
  } catch {
    return false;
  }
}

export function executionSourceIdentity(execution: TradeExecution) {
  const source = execution.source;
  const fingerprint =
    typeof source?.fileFingerprint === "string"
      ? source.fileFingerprint.trim()
      : "";
  if (fingerprint) {
    return { id: `fingerprint:${source.platform.trim()}|${fingerprint}`, verified: true } as const;
  }

  const platform =
    typeof source?.platform === "string" ? source.platform.trim() : "";
  const fileName =
    typeof source?.fileName === "string" ? source.fileName.trim() : "";
  if (platform && fileName) {
    return { id: `file:${platform}|${fileName}`, verified: false } as const;
  }

  return { id: `execution:${execution.id}`, verified: false } as const;
}

export function executionSourceInstanceId(execution: TradeExecution) {
  return executionSourceIdentity(execution).id;
}

export function compareExecutions(
  left: TradeExecution,
  right: TradeExecution,
) {
  const leftKey = executionOrderKey(left);
  const rightKey = executionOrderKey(right);
  const categoryDifference = leftKey.timeCategory - rightKey.timeCategory;
  let timeDifference = 0;
  if (leftKey.timeCategory === 0 && rightKey.timeCategory === 0) {
    const leftInstant = leftKey.timeValue as bigint;
    const rightInstant = rightKey.timeValue as bigint;
    timeDifference =
      leftInstant < rightInstant ? -1 : leftInstant > rightInstant ? 1 : 0;
  } else if (leftKey.timeCategory === 1 && rightKey.timeCategory === 1) {
    timeDifference = String(leftKey.timeValue).localeCompare(
      String(rightKey.timeValue),
    );
  }
  return (
    categoryDifference ||
    timeDifference ||
    Number(rightKey.dateOnly) - Number(leftKey.dateOnly) ||
    leftKey.sourceOrder - rightKey.sourceOrder ||
    leftKey.id.localeCompare(rightKey.id)
  );
}

function executionOrderKey(execution: TradeExecution) {
  const executedAt =
    typeof execution.executedAt === "string" ? execution.executedAt : "";
  let timeCategory: 0 | 1 = 0;
  let timeValue: bigint | string;
  let dateOnly = false;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(executedAt)) {
      const date = Temporal.PlainDate.from(executedAt).toString();
      // A UTC day-start anchor defines a transitive display order only. The
      // original date remains date precision; it is never stored as an instant.
      timeValue = Temporal.Instant.from(`${date}T00:00:00Z`).epochNanoseconds;
      dateOnly = true;
    } else timeValue = Temporal.Instant.from(executedAt).epochNanoseconds;
  } catch {
    timeCategory = 1;
    timeValue = executedAt;
  }
  const source = execution.source;
  const sourceOrderCandidate = source?.sourceOrder ?? source?.row;
  const sourceOrder =
    typeof sourceOrderCandidate === "number" &&
    Number.isFinite(sourceOrderCandidate)
      ? sourceOrderCandidate
      : Number.MAX_SAFE_INTEGER;
  return {
    timeCategory,
    timeValue,
    dateOnly,
    sourceOrder,
    id: typeof execution.id === "string" ? execution.id : "",
  };
}

function hasMeaningfulAccount(execution: TradeExecution) {
  const account = `${execution.accountId ?? ""} ${
    execution.accountLabel ?? ""
  }`.trim();
  return Boolean(account) && !/(unknown|unassigned|未指定|未知)/i.test(account);
}

function hasMeaningfulFee(execution: TradeExecution) {
  try {
    return !new Decimal(execution.fee || 0).isZero();
  } catch {
    return false;
  }
}

function hasResolvedName(execution: TradeExecution) {
  const name =
    typeof execution.instrument?.name === "string"
      ? execution.instrument.name.trim()
      : "";
  const symbol =
    typeof execution.instrument?.symbol === "string"
      ? execution.instrument.symbol.trim().toUpperCase()
      : "";
  return Boolean(name) &&
    name !== "名称待行情源补充" &&
    (!symbol || name.toUpperCase() !== symbol);
}

function evidenceRank(execution: TradeExecution) {
  return [
    Number(hasMeaningfulFee(execution)),
    Number(hasMeaningfulAccount(execution)),
    Number(hasResolvedName(execution)),
    Number(execution.source?.inputKind === "statement"),
  ] as const;
}

export function compareExecutionEvidence(
  left: TradeExecution,
  right: TradeExecution,
) {
  // A reported zero is evidence too; unknown placeholders must not outrank it.
  // Leave records without explicit fee status on the legacy ranking path.
  if (left.source.feeStatus === "reported" && right.source.feeStatus === "unknown") return 1;
  if (right.source.feeStatus === "reported" && left.source.feeStatus === "unknown") return -1;
  const leftRank = evidenceRank(left);
  const rightRank = evidenceRank(right);
  const leftCount = leftRank[0] + leftRank[1] + leftRank[2];
  const rightCount = rightRank[0] + rightRank[1] + rightRank[2];
  return (
    leftCount - rightCount ||
    leftRank[3] - rightRank[3] ||
    leftRank[0] - rightRank[0] ||
    leftRank[1] - rightRank[1] ||
    leftRank[2] - rightRank[2]
  );
}

function compareTagged(left: TaggedExecution, right: TaggedExecution) {
  return (
    compareExecutions(left.execution, right.execution) ||
    left.sourceInstanceId.localeCompare(right.sourceInstanceId) ||
    left.origin.localeCompare(right.origin)
  );
}

function selectRepresentative<
  T extends { execution: TradeExecution; origin: "current" | "incoming" },
>(candidates: T[], occurrenceCount: (candidate: T) => number = () => 0) {
  return [...candidates].sort(
    (left, right) =>
      compareExecutionEvidence(right.execution, left.execution) ||
      occurrenceCount(right) - occurrenceCount(left) ||
      Number(right.origin === "current") - Number(left.origin === "current") ||
      compareExecutions(left.execution, right.execution) ||
      executionSourceInstanceId(left.execution).localeCompare(
        executionSourceInstanceId(right.execution),
      ),
  )[0];
}

function groupBy<T>(values: readonly T[], keyOf: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

/** A fingerprint identifies a version; the locator identifies one observation. */
function executionRowIdentity(execution: TradeExecution) {
  const source = execution.source;
  if (!source.fileFingerprint?.trim() || !Number.isInteger(source.row) || source.row < 0) return undefined;
  return JSON.stringify([
    executionScopeIdentity(execution), executionSourceInstanceId(execution),
    source.sheet ?? "", source.page ?? null, source.row,
  ]);
}

function semanticStatementIdentity(execution: TradeExecution) {
  const source = execution.source;
  // china-merchants.ts hashes the security account, actual date, financial
  // values, fees and both post-transaction balances. This is the existing
  // legacy/column-layout overlap contract, rather than a generic broker ID.
  if (source.platform !== "china-merchants" || source.timePrecision !== "date-only" ||
      !source.fileFingerprint?.trim() || !source.statementRowFingerprint?.trim() || !source.settlement) return undefined;
  return JSON.stringify([executionScopeIdentity(execution), source.platform, source.statementRowFingerprint]);
}

export function reconcileExecutions(
  current: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
): ExecutionReconciliation {
  const tag = (execution: TradeExecution, origin: TaggedExecution["origin"]): TaggedExecution => ({
    execution, origin, candidateKey: executionCandidateKey(execution),
    coreKey: executionCoreKey(execution),
    sourceInstanceId: executionSourceInstanceId(execution),
    rowVerified: executionRowIdentity(execution) !== undefined,
    instantVerified: executionInstantIdentity(execution.executedAt).verified,
    coreVerified: executionCoreIdentity(execution).verified,
  });
  const taggedCurrent = current.map(execution => tag(execution, "current"));
  const taggedIncoming = incoming.map(execution => tag(execution, "incoming"));
  const remainingCurrent = new Set(taggedCurrent);
  const remainingIncoming = new Set(taggedIncoming);
  const acceptedIncoming = new Set(taggedIncoming);
  const automaticReplacementIds = new Set<string>();
  const duplicates: ExecutionReconciliation["duplicates"] = [];
  const conflicts: ExecutionConflict[] = [];

  const sameContent = (left: TaggedExecution, right: TaggedExecution) =>
    left.candidateKey === right.candidateKey && left.coreKey === right.coreKey &&
    !reportedFeesDisagree(left.execution, right.execution);
  const conflict = (key: string, existing: TaggedExecution[], additions: TaggedExecution[]) => {
    existing.forEach(record => remainingCurrent.delete(record));
    additions.forEach(record => { remainingIncoming.delete(record); acceptedIncoming.delete(record); });
    conflicts.push({
      id: `conflict:${key}`, candidateKey: key,
      existing: existing.map(record => record.execution).sort(compareExecutions),
      incoming: additions.map(record => record.execution).sort(compareExecutions),
    });
  };
  const duplicate = (existing: TaggedExecution, addition: TaggedExecution) => {
    const kept = selectRepresentative([existing, addition]);
    const skipped = kept === existing ? addition : existing;
    remainingCurrent.delete(existing);
    remainingIncoming.delete(addition);
    if (kept === existing) acceptedIncoming.delete(addition);
    else automaticReplacementIds.add(existing.execution.id);
    duplicates.push({ kept: kept.execution, skipped: skipped.execution });
  };

  // IDs remain authoritative for an exact retry, but never silently upgrade a
  // changed account, nature or core value merely because the ID was reused.
  const incomingIds = groupBy(taggedIncoming, record => record.execution.id);
  const currentIds = new Map(taggedCurrent.map(record => [record.execution.id, record]));
  for (const [id, additions] of incomingIds) {
    const existing = currentIds.get(id);
    if (existing) {
      const [addition, ...retries] = additions;
      if (additions.every(record => sameContent(existing, record))) {
        const kept = selectRepresentative([existing, ...additions]);
        remainingCurrent.delete(existing);
        for (const record of additions) {
          remainingIncoming.delete(record);
          if (record !== kept) acceptedIncoming.delete(record);
        }
        if (kept.origin === "incoming") automaticReplacementIds.add(id);
        for (const record of [existing, ...additions]) {
          if (record !== kept) duplicates.push({ kept: kept.execution, skipped: record.execution });
        }
      } else conflict(`id:${id}`, [existing], [addition, ...retries]);
    } else if (additions.length > 1 && additions.every(record => sameContent(additions[0], record))) {
      const kept = selectRepresentative(additions);
      for (const record of additions) {
        if (record === kept) continue;
        acceptedIncoming.delete(record);
        remainingIncoming.delete(record);
        duplicates.push({ kept: kept.execution, skipped: record.execution });
      }
    }
  }

  const pairIdentities = (identityOf: (execution: TradeExecution) => string | undefined, prefix: string) => {
    const groups = groupBy([...remainingCurrent].filter(record => identityOf(record.execution)), record => identityOf(record.execution)!);
    for (const addition of [...remainingIncoming].sort(compareTagged)) {
      const identity = identityOf(addition.execution);
      if (!identity) continue;
      const existing = groups.get(identity)?.find(record => remainingCurrent.has(record));
      if (!existing) continue;
      if (sameContent(existing, addition) && existing.instantVerified && addition.instantVerified && existing.coreVerified && addition.coreVerified) {
        duplicate(existing, addition);
      } else conflict(`${prefix}:${identity}`, [existing], [addition]);
    }
  };
  pairIdentities(executionRowIdentity, "row");
  pairIdentities(semanticStatementIdentity, "statement");

  // Equality of values across independent material versions is only a
  // candidate association. Pair exact cores first, then remaining candidates,
  // with each observation participating at most once. A user choice can never
  // accidentally replace two same-second fills with one incoming row.
  const currentCandidates = groupBy([...remainingCurrent].filter(record => record.instantVerified && record.coreVerified), record => record.candidateKey);
  for (const [key, additions] of groupBy([...remainingIncoming], record => record.candidateKey)) {
    const existing = (currentCandidates.get(key) ?? []).sort(compareTagged);
    const pairs: Array<[TaggedExecution, TaggedExecution]> = [];
    const pair = (addition: TaggedExecution, exact: boolean) => {
      if (!addition.instantVerified || !addition.coreVerified) return false;
      const index = existing.findIndex(record =>
        // Only two proven stable locators establish independent same-file rows.
        // A fingerprint alone cannot establish that a malformed row is new.
        (!record.rowVerified || !addition.rowVerified || record.sourceInstanceId !== addition.sourceInstanceId) &&
        (!exact || sameContent(record, addition)),
      );
      if (index < 0) return false;
      pairs.push([existing.splice(index, 1)[0], addition]);
      return true;
    };
    const unmatched = additions.sort(compareTagged).filter(addition => !pair(addition, true));
    unmatched.forEach(addition => pair(addition, false));
    if (pairs.length) conflict(key, pairs.map(([record]) => record), pairs.map(([, record]) => record));
  }

  return {
    acceptedIncoming: [...acceptedIncoming].map(record => record.execution).sort(compareExecutions),
    automaticReplacementIds: [...automaticReplacementIds].sort(),
    duplicates: duplicates.sort((left, right) => compareExecutions(left.skipped, right.skipped) || compareExecutions(left.kept, right.kept)),
    conflicts: conflicts.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function applyReconciliationDecisions(
  current: readonly TradeExecution[],
  reconciliation: ExecutionReconciliation,
  decisions: ReadonlyMap<string, ReconciliationDecision>,
): {
  currentAfterReplacements: TradeExecution[];
  incomingToMerge: TradeExecution[];
} {
  const removalIds = new Set(reconciliation.automaticReplacementIds);
  const incomingToMerge = [...reconciliation.acceptedIncoming];

  for (const conflict of reconciliation.conflicts) {
    const decision = decisions.get(conflict.id);
    if (!decision) {
      throw new Error(`Reconciliation decision required for ${conflict.id}`);
    }
    if (decision === "keep-existing") continue;
    incomingToMerge.push(...conflict.incoming);
    if (decision === "use-incoming") {
      for (const existing of conflict.existing) removalIds.add(existing.id);
    }
  }

  return {
    currentAfterReplacements: current
      .filter(({ id }) => !removalIds.has(id))
      .sort(compareExecutions),
    incomingToMerge: incomingToMerge.sort(compareExecutions),
  };
}
