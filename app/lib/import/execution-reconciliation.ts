import { Temporal } from "@js-temporal/polyfill";
import Decimal from "decimal.js";

import { canonicalInstrumentId } from "../instruments/display-name";
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
  sourceVerified: boolean;
  instantVerified: boolean;
  coreVerified: boolean;
};

function executionInstantIdentity(executedAt: string) {
  try {
    return {
      value: Temporal.Instant.from(executedAt).toString(),
      verified: true,
    } as const;
  } catch {
    return { value: `invalid:${executedAt}`, verified: false } as const;
  }
}

function decimalIdentity(value: unknown) {
  const raw = typeof value === "string" ? value : String(value ?? "");
  try {
    const decimal = new Decimal(raw);
    if (!decimal.isFinite() || !decimal.gt(0)) {
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

export function executionCandidateKey(execution: TradeExecution) {
  return `${executionInstrumentIdentity(execution)}|${
    executionInstantIdentity(execution.executedAt).value
  }`;
}

function executionCoreIdentity(execution: TradeExecution) {
  const quantity = decimalIdentity(execution.quantity);
  const price = decimalIdentity(execution.price);
  return {
    value: [
      execution.side,
      quantity.value,
      price.value,
    ].join("|"),
    verified: quantity.verified && price.verified,
  };
}

export function executionCoreKey(execution: TradeExecution) {
  return executionCoreIdentity(execution).value;
}

export function executionSourceIdentity(execution: TradeExecution) {
  const source = execution.source;
  const fingerprint =
    typeof source?.fileFingerprint === "string"
      ? source.fileFingerprint.trim()
      : "";
  if (fingerprint) {
    return { id: `fingerprint:${fingerprint}`, verified: true } as const;
  }

  const platform =
    typeof source?.platform === "string" ? source.platform.trim() : "";
  const fileName =
    typeof source?.fileName === "string" ? source.fileName.trim() : "";
  if (platform && fileName) {
    return { id: `file:${platform}|${fileName}`, verified: true } as const;
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
    leftKey.sourceOrder - rightKey.sourceOrder ||
    leftKey.id.localeCompare(rightKey.id)
  );
}

function executionOrderKey(execution: TradeExecution) {
  const executedAt =
    typeof execution.executedAt === "string" ? execution.executedAt : "";
  let timeCategory: 0 | 1 = 0;
  let timeValue: bigint | string;
  try {
    timeValue = Temporal.Instant.from(executedAt).epochNanoseconds;
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
>(candidates: T[]) {
  return [...candidates].sort(
    (left, right) =>
      compareExecutionEvidence(right.execution, left.execution) ||
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
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

export function reconcileExecutions(
  current: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
): ExecutionReconciliation {
  const sameIdGroups = groupBy(
    [
      ...current.map((execution) => ({
        execution,
        origin: "current" as const,
      })),
      ...incoming.map((execution) => ({
        execution,
        origin: "incoming" as const,
      })),
    ],
    ({ execution }) => execution.id,
  );
  const effective: Array<{
    execution: TradeExecution;
    origin: "current" | "incoming";
  }> = [];
  const identityDuplicates: ExecutionReconciliation["duplicates"] = [];
  const identityReplacementIds = new Set<string>();
  for (const group of sameIdGroups.values()) {
    const hasIncoming = group.some(({ origin }) => origin === "incoming");
    if (!hasIncoming || group.length === 1) {
      effective.push(...group);
      continue;
    }
    const kept = selectRepresentative(group);
    effective.push(kept);
    for (const skipped of group) {
      if (skipped === kept) continue;
      identityDuplicates.push({
        kept: kept.execution,
        skipped: skipped.execution,
      });
    }
    if (
      kept.origin === "incoming" &&
      group.some(({ origin }) => origin === "current")
    ) {
      identityReplacementIds.add(kept.execution.id);
    }
  }

  const tagged: TaggedExecution[] = effective.map(({ execution, origin }) => {
    const sourceIdentity = executionSourceIdentity(execution);
    const instantIdentity = executionInstantIdentity(execution.executedAt);
    const coreIdentity = executionCoreIdentity(execution);
    return {
      execution,
      origin,
      candidateKey: executionCandidateKey(execution),
      coreKey: coreIdentity.value,
      sourceInstanceId: sourceIdentity.id,
      sourceVerified: sourceIdentity.verified,
      instantVerified: instantIdentity.verified,
      coreVerified: coreIdentity.verified,
    };
  });
  const acceptedIncoming = new Set<TaggedExecution>();
  const automaticReplacementIds = new Set(identityReplacementIds);
  const duplicates: ExecutionReconciliation["duplicates"] = [
    ...identityDuplicates,
  ];
  const unmatchedByCandidate = new Map<
    string,
    { current: TaggedExecution[]; incoming: TaggedExecution[] }
  >();

  const candidateGroups = groupBy(tagged, ({ candidateKey }) => candidateKey);
  for (const [candidateKey, candidateGroup] of [...candidateGroups].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const unmatched = { current: [], incoming: [] } as {
      current: TaggedExecution[];
      incoming: TaggedExecution[];
    };
    const coreGroups = groupBy(candidateGroup, ({ coreKey }) => coreKey);
    for (const coreGroup of [...coreGroups.values()]) {
      for (const record of coreGroup.filter(
        ({ sourceVerified, instantVerified, coreVerified }) =>
          !sourceVerified || !instantVerified || !coreVerified,
      )) {
        unmatched[record.origin].push(record);
        if (record.origin === "incoming") acceptedIncoming.add(record);
      }
      const sourceGroups = [
        ...groupBy(
          coreGroup.filter(
            ({ sourceVerified, instantVerified, coreVerified }) =>
              sourceVerified && instantVerified && coreVerified,
          ),
          ({ sourceInstanceId }) => sourceInstanceId,
        ),
      ]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, records]) => [...records].sort(compareTagged));
      const maximumMultiplicity = Math.max(
        0,
        ...sourceGroups.map((records) => records.length),
      );

      for (let index = 0; index < maximumMultiplicity; index += 1) {
        const automaticPair = sourceGroups
          .map((records) => records[index])
          .filter((record): record is TaggedExecution => Boolean(record));
        if (automaticPair.length === 1) {
          const [record] = automaticPair;
          unmatched[record.origin].push(record);
          if (record.origin === "incoming") acceptedIncoming.add(record);
          continue;
        }

        const kept = selectRepresentative(automaticPair);
        if (kept.origin === "incoming") acceptedIncoming.add(kept);
        for (const skipped of automaticPair) {
          if (skipped === kept) continue;
          duplicates.push({ kept: kept.execution, skipped: skipped.execution });
          if (kept.origin === "incoming" && skipped.origin === "current") {
            automaticReplacementIds.add(skipped.execution.id);
          }
        }
      }
    }
    unmatchedByCandidate.set(candidateKey, unmatched);
  }

  const conflicts: ExecutionConflict[] = [];
  for (const [candidateKey, unmatched] of [...unmatchedByCandidate].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const conflictingIncoming = unmatched.incoming.filter((candidate) =>
      unmatched.current.some(
        (existing) =>
          existing.sourceVerified &&
          candidate.sourceVerified &&
          existing.instantVerified &&
          candidate.instantVerified &&
          existing.coreVerified &&
          candidate.coreVerified &&
          existing.sourceInstanceId !== candidate.sourceInstanceId &&
          existing.coreKey !== candidate.coreKey,
      ),
    );
    if (conflictingIncoming.length === 0) continue;
    const conflictingExisting = unmatched.current.filter((existing) =>
      conflictingIncoming.some(
        (candidate) =>
          existing.sourceVerified &&
          candidate.sourceVerified &&
          existing.instantVerified &&
          candidate.instantVerified &&
          existing.coreVerified &&
          candidate.coreVerified &&
          existing.sourceInstanceId !== candidate.sourceInstanceId &&
          existing.coreKey !== candidate.coreKey,
      ),
    );
    for (const conflict of conflictingIncoming) {
      acceptedIncoming.delete(conflict);
    }
    conflicts.push({
      id: `conflict:${candidateKey}`,
      candidateKey,
      existing: conflictingExisting
        .map(({ execution }) => execution)
        .sort(compareExecutions),
      incoming: conflictingIncoming
        .map(({ execution }) => execution)
        .sort(compareExecutions),
    });
  }

  return {
    acceptedIncoming: [...acceptedIncoming]
      .map(({ execution }) => execution)
      .sort(compareExecutions),
    automaticReplacementIds: [...automaticReplacementIds].sort(),
    duplicates: duplicates.sort(
      (left, right) =>
        compareExecutions(left.skipped, right.skipped) ||
        compareExecutions(left.kept, right.kept),
    ),
    conflicts,
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
