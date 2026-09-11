import { canonicalInstrumentId } from "../instruments/display-name";
import type { TradeExecution } from "../trades/types";
import {
  executionCandidateKey,
  executionCoreKey,
} from "./execution-reconciliation";
import type { EnrichedImportResult } from "./enrich-import";
import { UNRESOLVED_ASSET_EXCLUSION_LABEL } from "./enrich-import";
import type { MonthlyStatement } from "./monthly-statement";
import { belongsToMonthlyDocument } from "./statement-identity";

export type MonthlyReimportAssessment = {
  idempotent: boolean;
  enriched: EnrichedImportResult;
};

function documentExecutions(
  executions: readonly TradeExecution[],
  monthly: MonthlyStatement,
) {
  return executions.filter((execution) =>
    belongsToMonthlyDocument(execution, monthly),
  );
}

function hasExactExecutionIds(
  existing: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
) {
  if (existing.length !== incoming.length) return false;

  const existingIds = new Set(existing.map((execution) => execution.id));
  const incomingIds = new Set(incoming.map((execution) => execution.id));
  return (
    existingIds.size === existing.length &&
    incomingIds.size === incoming.length &&
    [...incomingIds].every((id) => existingIds.has(id))
  );
}

function sameExecutionContent(
  existing: TradeExecution,
  incoming: TradeExecution,
) {
  return (
    existing.id === incoming.id &&
    existing.accountId === incoming.accountId &&
    executionCandidateKey(existing) === executionCandidateKey(incoming) &&
    executionCoreKey(existing) === executionCoreKey(incoming) &&
    existing.fee === incoming.fee &&
    existing.source.platform === incoming.source.platform &&
    existing.source.fileFingerprint === incoming.source.fileFingerprint &&
    existing.source.page === incoming.source.page &&
    existing.source.row === incoming.source.row &&
    existing.source.sourceOrder === incoming.source.sourceOrder
  );
}

/**
 * Reuses already persisted rows only when the parser produced the exact same
 * execution set for the same statement. A partial set is deliberately not
 * considered safe: replacing it could silently delete an existing fill.
 */
export function assessMonthlyReimport(
  current: readonly TradeExecution[],
  parsedRecords: readonly TradeExecution[],
  enriched: EnrichedImportResult,
  monthly: MonthlyStatement,
): MonthlyReimportAssessment {
  const existing = documentExecutions(current, monthly);
  if (
    enriched.exclusions.some(
      (exclusion) => exclusion.category === "invalid-row",
    ) ||
    enriched.unresolved.some(
      (failure) =>
        !parsedRecords.some(
          (record) =>
            canonicalInstrumentId(
              record.instrument.symbol,
              record.instrument.market,
            ) === canonicalInstrumentId(failure.symbol, failure.market),
        ),
    ) ||
    !hasExactExecutionIds(existing, parsedRecords)
  ) {
    return { idempotent: false, enriched };
  }

  const existingById = new Map(
    existing.map((execution) => [execution.id, execution]),
  );
  if (
    parsedRecords.some((record) => {
      const stored = existingById.get(record.id);
      return !stored || !sameExecutionContent(stored, record);
    })
  ) {
    return { idempotent: false, enriched };
  }
  const importableById = new Map(
    enriched.importable.map((execution) => [execution.id, execution]),
  );
  const reusedRecords = parsedRecords
    .map((record) =>
      importableById.has(record.id)
        ? undefined
        : existingById.get(record.id),
    )
    .filter((record): record is TradeExecution => Boolean(record));
  if (
    reusedRecords.length + enriched.importable.length !==
    parsedRecords.length
  ) {
    return { idempotent: false, enriched };
  }

  const reusedInstrumentIds = new Set(
    reusedRecords.map((record) =>
      canonicalInstrumentId(record.instrument.symbol, record.instrument.market),
    ),
  );
  const reusedSymbols = new Set(
    enriched.unresolved
      .filter((failure) =>
        reusedInstrumentIds.has(
          canonicalInstrumentId(failure.symbol, failure.market),
        ),
      )
      .map((failure) => failure.symbol.trim().toUpperCase()),
  );
  const importable = parsedRecords.map(
    (record) => importableById.get(record.id) ?? existingById.get(record.id)!,
  );

  return {
    idempotent: true,
    enriched: {
      ...enriched,
      importable,
      unresolved: enriched.unresolved.filter(
        (failure) =>
          !reusedInstrumentIds.has(
            canonicalInstrumentId(failure.symbol, failure.market),
          ),
      ),
      exclusions: enriched.exclusions.filter(
        (exclusion) =>
          !(
            exclusion.category === "unknown-asset" &&
            exclusion.label.trim() === UNRESOLVED_ASSET_EXCLUSION_LABEL &&
            typeof exclusion.instrumentSymbol === "string" &&
            reusedSymbols.has(exclusion.instrumentSymbol.trim().toUpperCase())
          ),
      ),
    },
  };
}
