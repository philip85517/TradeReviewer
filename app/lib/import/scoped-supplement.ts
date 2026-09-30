import type { TradeExecution } from "../trades/types";
import { canonicalRecord, type TradeChange } from "../storage/trade-revisions";
import { canonicalInstrumentId } from "../instruments/display-name";
import type { StatementParseResult } from "./contracts";
import type { ImportDiagnostic } from "./import-result";
import { isMonthlyEvidenceScope, type MonthlyStatement } from "./monthly-statement";
import { applyMonthlyHistoryEvidence } from "./statement-evidence";

export type SupplementScope = { instrumentId: string; accountId: string; accountLabel: string; kind: "file" | "screenshot" };

export type SupplementChangeSummary = {
  newTradeCount: number;
  revisedTradeCount: number;
  evidenceRevisionCount: number;
  unchangedTradeCount: number;
};

function scopeMarketAndSymbol(scope: SupplementScope) {
  const separator = scope.instrumentId.indexOf(":");
  if (separator < 1) return { market: "", symbol: scope.instrumentId };
  return {
    market: scope.instrumentId.slice(0, separator),
    symbol: scope.instrumentId.slice(separator + 1),
  };
}

function matchesScope(
  item: { accountId: string; market?: string; symbol?: string },
  scope: SupplementScope,
) {
  if (!item.market || !item.symbol) return false;
  if (scope.kind !== "screenshot" && item.accountId !== scope.accountId) return false;
  return canonicalInstrumentId(item.symbol, item.market) === scope.instrumentId;
}

function executionMatchesScope(execution: TradeExecution, scope: SupplementScope) {
  return execution.instrument.id === scope.instrumentId &&
    (scope.kind === "screenshot" || execution.accountId === scope.accountId);
}

function diagnosticMatchesScope(diagnostic: ImportDiagnostic, scope: SupplementScope) {
  if (diagnostic.instrumentSymbol) {
    const { market } = scopeMarketAndSymbol(scope);
    const value = diagnostic.instrumentSymbol.trim();
    const separator = value.indexOf(":");
    const candidate = separator > 0
      ? canonicalInstrumentId(value.slice(separator + 1), value.slice(0, separator))
      : canonicalInstrumentId(value, market);
    return candidate === scope.instrumentId;
  }
  // A diagnostic without an instrument identity cannot be proven to belong to
  // an excluded row. Keep it as an unassigned/document-level warning so a
  // scoped review never silently hides a possible target gap. Only an
  // explicitly identified different instrument is removed above.
  return true;
}

function applicableDiagnostics(
  diagnostics: readonly ImportDiagnostic[],
  scope: SupplementScope,
) {
  return diagnostics.filter((diagnostic) => diagnosticMatchesScope(diagnostic, scope));
}

/** Keep the original document identity while narrowing evidence to one stock/account. */
export function scopeMonthlyStatement(
  monthly: MonthlyStatement | undefined,
  scope: SupplementScope,
  diagnostics: readonly ImportDiagnostic[] = [],
): MonthlyStatement | undefined {
  if (!monthly) return undefined;
  const evidenceScope = { instrumentId: scope.instrumentId, accountId: scope.accountId };
  if (!isMonthlyEvidenceScope(evidenceScope)) throw new Error("Invalid monthly evidence scope");
  const positions = monthly.positions.filter((position) => matchesScope(position, scope));
  const events = monthly.events.filter((event) => matchesScope(event, scope));
  const incompleteInstruments = (monthly.incompleteInstruments ?? []).filter((instrument) =>
    canonicalInstrumentId(instrument.symbol, instrument.market) === scope.instrumentId,
  );
  // `historyIncomplete` is a document-level, unassigned gap. The parser may
  // also report a named gap for another instrument in the same document, but
  // that does not prove the unassigned row belongs to the excluded instrument.
  const genericHistoryIncomplete = Boolean(monthly.historyIncomplete);
  const hasNamedIncompleteInstruments = (monthly.incompleteInstruments?.length ?? 0) > 0;
  const hasApplicableWarning = diagnostics.some((diagnostic) => diagnostic.severity !== "info");
  const hasUnattributedReview = monthly.reviewRequired && (
    genericHistoryIncomplete ||
    !hasNamedIncompleteInstruments
  );
  const result: MonthlyStatement = {
    ...monthly,
    evidenceScope,
    positions,
    events,
    reviewRequired: hasUnattributedReview || incompleteInstruments.length > 0 || hasApplicableWarning,
  };
  if (incompleteInstruments.length > 0) result.incompleteInstruments = incompleteInstruments;
  else delete result.incompleteInstruments;
  if (genericHistoryIncomplete) result.historyIncomplete = true;
  else delete result.historyIncomplete;
  return result;
}

/** Scope every preview field before the monthly review and enrichment stages consume it. */
export function scopeStatementParseResult(
  parsed: StatementParseResult,
  scope: SupplementScope,
): StatementParseResult {
  const diagnostics = applicableDiagnostics(parsed.diagnostics, scope);
  const monthly = scopeMonthlyStatement(parsed.monthly, scope, diagnostics);
  const records = scopedRecords(parsed.records, scope);
  const scopedMonthlyHasContent = Boolean(
    monthly && (
      monthly.positions.length > 0 ||
      monthly.events.length > 0 ||
      monthly.incompleteInstruments?.length ||
      monthly.historyIncomplete
    ),
  );
  // A broker parser can block a whole document because one excluded row is
  // malformed. Once the selected scope has usable rows/evidence, only keep a
  // blocking result when a relevant error survived diagnostic filtering. A
  // structural/document error with no scoped content remains blocked.
  const blocked = parsed.blocked && (
    diagnostics.some((diagnostic) => diagnostic.severity === "error") ||
    (records.length === 0 && !scopedMonthlyHasContent)
  );
  return {
    ...parsed,
    // Broker parsers may already have attached the full document's evidence
    // before the supplement scope is known. Rebuild those attachments here so
    // the preview carries only the selected instrument/account as well.
    records: monthly ? applyScopedMonthlyEvidence(records, [monthly], scope) : records,
    candidates: parsed.candidates.filter((candidate) => canonicalInstrumentId(candidate.symbol, candidate.market) === scope.instrumentId),
    diagnostics,
    monthly,
    blocked,
  };
}

/**
 * Apply monthly evidence only to the selected scope. Existing rows outside the
 * scope are returned byte-for-byte, which keeps a same-document supplement for
 * another stock from rewriting unrelated executions.
 */
export function applyScopedMonthlyEvidence(
  executions: readonly TradeExecution[],
  monthly: readonly MonthlyStatement[],
  scope: SupplementScope,
): TradeExecution[] {
  if (monthly.length === 0) return [...executions];
  const selected = executions.filter((execution) => executionMatchesScope(execution, scope));
  if (selected.length === 0) return [...executions];
  const enriched = applyMonthlyHistoryEvidence(selected, [...monthly]);
  const byId = new Map(enriched.map((execution) => [execution.id, execution]));
  return executions.map((execution) => byId.get(execution.id) ?? execution);
}

function financialRecordKey(execution: TradeExecution) {
  return canonicalRecord({
    instrumentId: execution.instrument.id,
    accountId: execution.accountId,
    side: execution.side,
    executedAt: execution.executedAt,
    quantity: execution.quantity,
    price: execution.price,
    fee: execution.fee,
  });
}

/** Summarize the actual target-scope diff shown before a supplement is saved. */
export function supplementChangeSummary(
  before: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
  after: readonly TradeExecution[],
  scope: SupplementScope,
): SupplementChangeSummary {
  const changes = supplementChanges(before, after, scope);
  const changedIds = new Set(changes.map((change) => (change.before ?? change.after)!.id));
  const newChanges = changes.filter((change) => change.before === null && change.after !== null);
  const revisedChanges = changes.filter((change) => change.before !== null && change.after !== null);
  const evidenceRevisionCount = revisedChanges.filter((change) =>
    financialRecordKey(change.before!) === financialRecordKey(change.after!),
  ).length;
  const incomingIds = new Set(
    incoming.filter((execution) => executionMatchesScope(execution, scope)).map((execution) => execution.id),
  );
  return {
    newTradeCount: newChanges.length,
    revisedTradeCount: revisedChanges.length,
    evidenceRevisionCount,
    unchangedTradeCount: [...incomingIds].filter((id) => !changedIds.has(id)).length,
  };
}

export function scopedRecords(records: TradeExecution[], scope: SupplementScope) {
  return records
    .filter(e => e.instrument.id === scope.instrumentId && (scope.kind === "screenshot" || e.accountId === scope.accountId))
    .map(e => scope.kind === "screenshot" ? {...e, accountId: scope.accountId, accountLabel: scope.accountLabel} : e);
}
export function supplementChanges(before: readonly TradeExecution[], after: readonly TradeExecution[], scope: SupplementScope): TradeChange[] {
  const old = new Map(before.map(e=>[e.id,e])); const next = new Map(after.map(e=>[e.id,e]));
  const changes: TradeChange[] = [];
  for (const id of new Set([...old.keys(),...next.keys()])) {
    const a = old.get(id) ?? null; const b = next.get(id) ?? null;
    if (canonicalRecord(a) === canonicalRecord(b)) continue;
    if ([a,b].some(e=>e && (e.instrument.id !== scope.instrumentId || e.accountId !== scope.accountId))) throw new Error("补充导入超出当前股票或账户范围");
    changes.push({before:a,after:b});
  }
  return changes;
}
