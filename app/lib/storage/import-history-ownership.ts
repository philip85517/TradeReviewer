import { reconcileExecutions } from "../import/execution-reconciliation";
import type { TradeExecution } from "../trades/types";
import type { ReviewChange, ReviewFactValues } from "./sqlite-contracts";
import { canonicalRecord } from "./trade-revisions";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unsupported ownership evidence");
  return value as RecordValue;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Unsupported ownership evidence");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Unsupported ownership evidence");
  return value;
}
function execution(value: unknown): TradeExecution {
  const row = record(value), instrument = record(row.instrument), source = record(row.source);
  for (const field of ["id", "accountId", "accountLabel", "quantity", "price", "executedAt"]) text(row[field]);
  for (const field of ["id", "symbol", "market", "currency"]) text(instrument[field]);
  text(source.platform);
  if (typeof row.fee !== "string" || !["buy", "sell"].includes(String(row.side)) || typeof source.row !== "number") throw new Error("Unsupported execution");
  return row as TradeExecution;
}
const factFields = ["instrumentId", "accountId", "side", "quantity", "price", "fee", "executedAt", "currency"] as const;

/**
 * Prove the complete ordinary import reconciliation and every possible change,
 * including conditional branches. Existing snapshots may legitimately be from
 * another batch; incoming rows, duplicate metadata and writes cannot invent one.
 * Policies whose result cannot be reproduced from these retained inputs fail
 * closed. This verifier never prepares a new plan or consults mutable live facts.
 */
export function assertImportHistoryOwnership(preparedValue: unknown, reviewValue: unknown, applied: ReviewChange[], batchId: string): void {
  const prepared = record(preparedValue), review = record(reviewValue), intent = record(prepared.intent);
  const incoming = array(intent.candidates).map(execution), current = array(prepared.current).map(execution);
  if (incoming.some(row => row.source.batchId !== batchId)) throw new Error("Foreign input");
  const reconciliation = reconcileExecutions(current, incoming);
  if (canonicalRecord(reconciliation) !== canonicalRecord(prepared.reconciliation)) throw new Error("Unproven reconciliation");
  // Import plans do not inherit revision-only unknown-fee overrides.
  if (array(prepared.inheritedUnknownFees).length) throw new Error("Unsupported import fee override");
  const states = array(prepared.stateFacts).map(record), stateById = new Map(states.map(state => [text(state.id), state]));
  if (stateById.size !== states.length) throw new Error("Ambiguous fact snapshot");
  const withdrawn = array(prepared.withdrawnIds).map(text);
  const prior = (id: string): ReviewFactValues | null => {
    const state = stateById.get(id);
    if (!state) return null;
    const result = Object.fromEntries(factFields.map(field => [field, state[field]]));
    if (factFields.some(field => result[field] === undefined)) throw new Error("Incomplete fact snapshot");
    return result as ReviewFactValues;
  };
  const values = (row: TradeExecution): ReviewFactValues => ({ instrumentId: row.instrument.id, accountId: row.accountId, side: row.side, quantity: row.quantity, price: row.price, fee: row.fee, executedAt: row.executedAt, currency: row.instrument.currency });
  const expected: ReviewChange[] = [];
  const write = (row: TradeExecution, when?: ReviewChange["when"]) => expected.push({ kind: stateById.has(row.id) ? "replace" : "add", executionId: row.id, before: prior(row.id), after: values(row), ...(when ? { when } : {}) });
  const withdraw = (id: string, when?: ReviewChange["when"]) => {
    if (!current.some(row => row.id === id) || !stateById.has(id)) throw new Error("Unproven withdrawal");
    expected.push({ kind: "withdraw", executionId: id, before: prior(id), after: null, ...(when ? { when } : {}) });
  };
  for (const row of reconciliation.acceptedIncoming) if (!withdrawn.includes(row.id)) write(row);
  for (const id of reconciliation.automaticReplacementIds) if (!reconciliation.acceptedIncoming.some(row => row.id === id)) withdraw(id);
  const conditions = new Map<string, ReviewChange["when"]>();
  for (const conflict of reconciliation.conflicts) {
    const decisions = conflict.incoming.some(row => conflict.existing.some(old => old.id === row.id)) ? ["use-incoming"] as const : ["use-incoming", "keep-both"] as const;
    for (const row of conflict.incoming) {
      const when = { conflictId: conflict.id, decisions: [...decisions] };
      if (!withdrawn.includes(row.id)) write(row, when);
      if (!stateById.has(row.id)) conditions.set(row.id, when);
    }
    for (const row of conflict.existing) if (!conflict.incoming.some(candidate => candidate.id === row.id)) withdraw(row.id, { conflictId: conflict.id, decisions: ["use-incoming"] });
  }
  // A missing-source withdrawal needs the earlier material dependency closure,
  // which this bounded historical DTO does not retain as a reproducible policy.
  // Do not use an arbitrary stored execution ID as authority for such a change.
  if (array(review.missingExecutions).length || array(prepared.materials).some(material => array(record(material).missingExecutions).length)) throw new Error("Unsupported material withdrawal proof");
  const reactivations = [...new Set(incoming.filter(row => withdrawn.includes(row.id)).map(row => row.id))];
  if (canonicalRecord(reactivations) !== canonicalRecord(review.reactivateExecutionIds)) throw new Error("Unproven reactivation");
  for (const id of reactivations) {
    if (!stateById.has(id) || !current.some(row => row.id === id)) throw new Error("Missing withdrawn snapshot");
    expected.push({ kind: "reactivate", executionId: id, before: prior(id), after: prior(id), when: { reactivateExecutionId: id, action: "activate" } });
  }
  const linkIds = new Set([...incoming.map(row => row.id), ...reconciliation.duplicates.map(pair => pair.kept.id)]);
  for (const materialValue of array(prepared.materials)) {
    const material = record(materialValue), input = record(material.input);
    const materialId = text(input.materialId), versionId = text(input.versionId);
    expected.push({ kind: "material-version", materialId, versionId, previousVersionId: material.expectedCurrentVersionId as string | null });
    for (const observationValue of array(input.observations)) {
      const observation = record(observationValue), observationId = text(observation.id);
      for (const id of array(observation.executionIds).map(text)) {
        if (!linkIds.has(id)) throw new Error("Foreign material link");
        const when = conditions.get(id);
        expected.push({ kind: "link", materialId, versionId, observationId, executionId: id, ...(when ? { when } : {}) });
      }
    }
  }
  if (canonicalRecord(expected) !== canonicalRecord(prepared.reviewChanges) || canonicalRecord(expected) !== canonicalRecord(record(review.summary).changes)) throw new Error("Unproven review changes");
  // Match a multiset after removing reviewed conditions. Extra fields, values,
  // repeated writes and changes absent from either immutable review are rejected.
  const available = expected.map(({ when, ...change }) => ({ key: canonicalRecord(change), required: when === undefined }));
  for (const change of applied) {
    const index = available.findIndex(candidate => candidate.key === canonicalRecord(change));
    if (index < 0) throw new Error("Unproven applied change");
    available.splice(index, 1);
  }
  if (available.some(candidate => candidate.required)) throw new Error("Missing unconditional change");
}
