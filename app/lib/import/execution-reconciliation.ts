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

function normalizedDecimal(value: string) {
  try {
    return new Decimal(value).toString();
  } catch {
    return `invalid:${value}`;
  }
}

export function executionCandidateKey(execution: TradeExecution) {
  return `${canonicalInstrumentId(
    execution.instrument.symbol,
    execution.instrument.market,
  )}|${executionInstantIdentity(execution.executedAt).value}`;
}

export function executionCoreKey(execution: TradeExecution) {
  return [
    execution.side,
    normalizedDecimal(execution.quantity),
    normalizedDecimal(execution.price),
  ].join("|");
}

export function executionSourceIdentity(execution: TradeExecution) {
  const fingerprint = execution.source.fileFingerprint?.trim();
  if (fingerprint) {
    return { id: `fingerprint:${fingerprint}`, verified: true } as const;
  }

  const platform = execution.source.platform.trim();
  const fileName = execution.source.fileName?.trim();
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
  let timeDifference: number;
  try {
    timeDifference = Temporal.Instant.compare(left.executedAt, right.executedAt);
  } catch {
    timeDifference = left.executedAt.localeCompare(right.executedAt);
  }
  return (
    timeDifference ||
    (left.source.sourceOrder ?? left.source.row) -
      (right.source.sourceOrder ?? right.source.row) ||
    left.id.localeCompare(right.id)
  );
}

function hasMeaningfulAccount(execution: TradeExecution) {
  const account = `${execution.accountId} ${execution.accountLabel}`.trim();
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
  const name = execution.instrument.name.trim();
  return Boolean(name) &&
    name !== "名称待行情源补充" &&
    name.toUpperCase() !== execution.instrument.symbol.trim().toUpperCase();
}

function evidenceRank(execution: TradeExecution) {
  return [
    Number(hasMeaningfulFee(execution)),
    Number(hasMeaningfulAccount(execution)),
    Number(hasResolvedName(execution)),
    Number(execution.source.inputKind === "statement"),
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

function selectRepresentative(candidates: TaggedExecution[]) {
  return [...candidates].sort(
    (left, right) =>
      compareExecutionEvidence(right.execution, left.execution) ||
      Number(right.origin === "current") - Number(left.origin === "current") ||
      compareTagged(left, right),
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
  const tagged: TaggedExecution[] = [
    ...current.map((execution) => {
      const sourceIdentity = executionSourceIdentity(execution);
      const instantIdentity = executionInstantIdentity(execution.executedAt);
      return {
        execution,
        origin: "current" as const,
        candidateKey: executionCandidateKey(execution),
        coreKey: executionCoreKey(execution),
        sourceInstanceId: sourceIdentity.id,
        sourceVerified: sourceIdentity.verified,
        instantVerified: instantIdentity.verified,
      };
    }),
    ...incoming.map((execution) => {
      const sourceIdentity = executionSourceIdentity(execution);
      const instantIdentity = executionInstantIdentity(execution.executedAt);
      return {
        execution,
        origin: "incoming" as const,
        candidateKey: executionCandidateKey(execution),
        coreKey: executionCoreKey(execution),
        sourceInstanceId: sourceIdentity.id,
        sourceVerified: sourceIdentity.verified,
        instantVerified: instantIdentity.verified,
      };
    }),
  ];
  const acceptedIncoming = new Set<TaggedExecution>();
  const automaticReplacementIds = new Set<string>();
  const duplicates: ExecutionReconciliation["duplicates"] = [];
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
        ({ sourceVerified, instantVerified }) =>
          !sourceVerified || !instantVerified,
      )) {
        unmatched[record.origin].push(record);
        if (record.origin === "incoming") acceptedIncoming.add(record);
      }
      const sourceGroups = [
        ...groupBy(
          coreGroup.filter(
            ({ sourceVerified, instantVerified }) =>
              sourceVerified && instantVerified,
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
