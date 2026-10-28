import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ImportHistoryEntry } from "./import-history-contract";
import { parseTradeCommitReceipt, parseTradePlan } from "./trade-change-response";
import { canonicalRecord } from "./trade-revisions";
import { assertImportHistoryOwnership } from "./import-history-ownership";

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : undefined;
}
function parsedObject(json: string): ObjectValue | undefined {
  try { return object(JSON.parse(json)); } catch { return undefined; }
}

function materialKey(value: ObjectValue): string | undefined {
  return typeof value.materialId === "string" && value.materialId.trim() && typeof value.versionId === "string" && value.versionId.trim()
    ? JSON.stringify([value.materialId, value.versionId]) : undefined;
}

/** Explicit input ownership only: current/kept executions may belong to other batches. */
function retainedBatchScope(bodyJson: unknown, digest: unknown, planId: string, receipt: ObjectValue | undefined, consumedExactly: boolean, decoded?: ObjectValue): Set<string> | undefined {
  try {
    if (typeof bodyJson !== "string" || createHash("sha256").update(bodyJson).digest("hex") !== digest) return;
    const body = decoded ?? parsedObject(bodyJson), review = object(body?.review), prepared = object(body?.prepared);
    const intent = object(prepared?.intent), kind = review?.kind;
    // Fixed maintenance uses a different envelope and never reports import
    // insertions/duplicates. Only its complete, internally bound receipt can
    // prove that exclusion; a kind label alone is insufficient.
    if (kind === "tradingview-account-migration" || kind === "tradingview-account-migration-rollback") {
      const maintenance = object(prepared?.tradingView), input = object(maintenance?.intent), preview = object(maintenance?.preview);
      const result = object(receipt?.result), report = object(result?.report), outcome = object(result?.tradingView), summary = object(review?.summary);
      const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string" && !!item.trim());
      const empty = (value: unknown) => Array.isArray(value) && value.length === 0;
      const rollback = kind === "tradingview-account-migration-rollback";
      const allowed = rollback ? ["kind", "operationId", "rollbackOperationId", "expectedAfterSnapshotDigest"] : ["kind", "operationId"];
      if (!consumedExactly || review?.planId !== planId || !prepared || Object.keys(prepared).join() !== "tradingView" ||
          !maintenance || !input || input.kind !== kind || Object.keys(input).some(key => !allowed.includes(key)) ||
          typeof input.operationId !== "string" || !input.operationId.trim() ||
          rollback && (typeof input.rollbackOperationId !== "string" || !input.rollbackOperationId.trim() || typeof input.expectedAfterSnapshotDigest !== "string") ||
          !summary || summary.candidateCount !== 0 || summary.inputDigest !== createHash("sha256").update(canonicalRecord(input)).digest("hex") ||
          !empty(summary.changes) || !empty(review.conflicts) || !empty(review.missingExecutions) || !empty(review.reactivateExecutionIds) ||
          !preview || preview.status !== "ready" || preview.operationId !== input.operationId || canonicalRecord(review.tradingView) !== canonicalRecord(preview) ||
          !Array.isArray(maintenance.dependencies) || !maintenance.dependencies.every(value => { const dependency = object(value); return dependency && ["tableName", "rowKey", "rowDigest"].every(key => typeof dependency[key] === "string" && !!dependency[key]); }) ||
          !strings(object(maintenance.scope)?.identities) || !strings(object(maintenance.scope)?.executionIds) ||
          !Array.isArray(maintenance.beforeImages) || !Array.isArray(maintenance.rollbackRows) || !object(maintenance.source) ||
          !empty(result?.appliedChanges) || report?.inserted !== 0 || report.duplicate !== 0 || report.conflict !== 0 ||
          !outcome || outcome.operationId !== input.operationId || outcome.status !== (rollback ? "rolled-back" : "committed") ||
          typeof outcome.afterSnapshotDigest !== "string" || typeof outcome.idempotent !== "boolean" ||
          rollback && outcome.rollbackOperationId !== input.rollbackOperationId) return;
      parseTradePlan(review, kind, { retainedEvidence: true });
      parseTradeCommitReceipt(receipt, planId);
      if (rollback ? preview.expectedAfterSnapshotDigest !== input.expectedAfterSnapshotDigest || !empty(preview.blockers)
        : !empty(preview.blockers) || !empty(preview.adapterBlockers) || !Array.isArray(preview.executionPlan) || !Array.isArray(preview.referencePlan)) return;
      return new Set();
    }
    if (kind !== "import" && kind !== "revision" && kind !== "material" && kind !== "browser-migration") return;
    if (review?.planId !== planId || intent?.kind !== kind || !Array.isArray(prepared?.materials)) return;
    parseTradePlan(review, kind, { retainedEvidence: true });
    const ids = new Set<string>();
    const add = (id: unknown) => {
      if (typeof id !== "string" || !id.trim()) throw new Error("Missing batch identity");
      ids.add(id);
    };
    const history = (value: unknown) => {
      const entry = object(value);
      if (!entry) throw new Error("Invalid history");
      add(entry.id);
    };
    for (const material of prepared.materials) {
      const input = object(object(material)?.input);
      if (!input || !materialKey(input)) return;
      if (input.historyProjection !== undefined) {
        const projection = object(input.historyProjection);
        if (!projection) return;
        add(projection.batchId); history(projection.reconciliation);
      }
    }
    if (intent.materials !== undefined) {
      if (!Array.isArray(intent.materials)) return;
      for (const inputValue of intent.materials) {
        const input=object(inputValue);
        if (!input || !materialKey(input)) return;
        if (input.historyProjection !== undefined) {
          const projection=object(input.historyProjection); if (!projection) return;
          add(projection.batchId); history(projection.reconciliation);
        }
      }
    }
    if (kind === "import") {
      if (!Array.isArray(intent.candidates) || intent.importHistory !== undefined && !Array.isArray(intent.importHistory)) return;
      for (const entry of intent.importHistory ?? []) history(entry);
      for (const candidate of intent.candidates) {
        const source = object(object(candidate)?.source);
        if (!source) return;
        if (source.batchId !== undefined) add(source.batchId);
      }
    } else if (kind === "revision") {
      const revision = object(intent.revision);
      if (!revision || !Array.isArray(revision.changes)) return;
      if (revision.importHistory !== undefined) history(revision.importHistory);
    } else if (kind === "material") {
      if (!Array.isArray(intent.materials)) return;
    } else {
      const payload = object(intent.payload);
      if (!Array.isArray(payload?.importHistory)) return;
      for (const entry of payload.importHistory) history(entry);
    }
    return ids;
  } catch { return; }
}

export type ImportPlanProof = {
  /** null means consumed evidence whose complete batch scope cannot be proven. */
  scope: string[] | null;
  consumed: boolean;
  kind: string | null;
  bodyDigest: string;
  receiptId: string | null;
  memberships: { batchId: string; count?: number; historyDigest?: string }[];
  materialRefs: { materialId: string; versionId: string }[];
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const historyEvidenceDigest = (value: unknown) => hash(canonicalRecord(value));

/** Complete initial certification. Every plan is inspected, including unrelated input scopes. */
export function inspectImportHistoryPlan(database: DatabaseSync, planId: string): ImportPlanProof {
  const stored = database.prepare("select receipt_id,body_json,body_digest from trade_change_plans where id=?").get(planId);
  const rows = database.prepare("select id,receipt_json from trade_change_receipts where plan_id=?").all(planId);
  const proof: ImportPlanProof = { scope: null, consumed: stored?.receipt_id !== null, kind: null, bodyDigest: String(stored?.body_digest ?? ""), receiptId: typeof stored?.receipt_id === "string" ? stored.receipt_id : null, memberships: [], materialRefs: [] };
  // A receipt whose reverse link is still NULL is not a formal consumed operation.
  if (stored?.receipt_id === null) { proof.consumed=false; proof.scope=[]; return proof; }
  const row=rows.length===1 ? rows[0] : undefined, raw=row && parsedObject(String(row.receipt_json));
  const body=typeof stored?.body_json === "string" ? parsedObject(stored.body_json) : undefined;
  const scope=stored && retainedBatchScope(stored.body_json,stored.body_digest,planId,raw,stored.receipt_id===row?.id && raw?.receiptId===row?.id,body);
  const review=object(body?.review), prepared=object(body?.prepared), intent=object(prepared?.intent), reconciliation=object(prepared?.reconciliation);
  proof.kind=typeof review?.kind === "string" ? review.kind : null;
  const linked=new Set(scope ?? []);
  const result=object(raw?.result);
  const materialChanges=(Array.isArray(result?.appliedChanges) ? result.appliedChanges : []).map(object).filter(change=>change?.kind==="material-version");
  const version=database.prepare("select json_extract(content_json,'$.historyProjection') as history_projection,json_type(content_json,'$.historyProjection') as projection_type from source_material_versions where id=? and material_id=?");
  const projectionFor=(materialId: string,versionId: string) => {
    proof.materialRefs.push({materialId,versionId});
    const retained=version.get(versionId,materialId);
    const projection=retained?.projection_type === "object" && typeof retained.history_projection === "string" ? parsedObject(retained.history_projection) : undefined;
    for (const id of [projection?.batchId,object(projection?.reconciliation)?.id]) if (typeof id === "string" && id.trim()) linked.add(id);
    return {retained,projection};
  };
  let incomplete=false;
  for (const change of materialChanges) {
    if (!change || !materialKey(change)) { incomplete=true; continue; }
    const {retained,projection}=projectionFor(String(change.materialId),String(change.versionId));
    if (!retained || retained.projection_type!==null && !projection || projection && (typeof projection.batchId!=="string" || typeof object(projection.reconciliation)?.id!=="string")) incomplete=true;
  }
  proof.scope=scope ? [...linked] : null;
  let matchedId: string | undefined, count: number | undefined, historyDigest: string | undefined;
  try {
    if (!scope || incomplete || !row || !stored || stored.receipt_id!==row.id) throw new Error("Unbound consumed evidence");
    const receipt=parseTradeCommitReceipt(raw,planId);
    if (receipt.receiptId!==row.id || review?.planId!==planId || review.kind!=="import" || intent?.kind!=="import" ||
        !Array.isArray(intent.candidates) || !Array.isArray(prepared?.materials) || !Array.isArray(reconciliation?.duplicates) ||
        receipt.result.report.duplicate!==reconciliation.duplicates.length || !Array.isArray(reconciliation.conflicts) ||
        receipt.result.report.conflict!==reconciliation.conflicts.length ||
        receipt.result.report.inserted!==receipt.result.appliedChanges.filter(change=>change.kind==="add"||change.kind==="replace").length ||
        receipt.result.report.duplicate>0 && intent.candidates.length===0) throw new Error("Unsupported import result");
    const inputs=prepared.materials.map(material=>object(object(material)?.input));
    const inputKeys=inputs.map(input=>input && materialKey(input)), changeKeys=materialChanges.map(change=>change && materialKey(change));
    if (inputKeys.some(key=>!key) || changeKeys.some(key=>!key) || new Set(inputKeys).size!==inputKeys.length ||
        new Set(changeKeys).size!==changeKeys.length || new Set(inputs.map(input=>input?.materialId)).size!==inputs.length ||
        new Set(inputs.map(input=>input?.versionId)).size!==inputs.length || inputKeys.length!==changeKeys.length || inputKeys.some(key=>!changeKeys.includes(key))) throw new Error("Material set mismatch");
    for (const input of inputs) {
      const {retained,projection}=projectionFor(String(input!.materialId),String(input!.versionId));
      if (!retained || retained.projection_type!==null && retained.projection_type!=="object" || canonicalRecord(projection)!==canonicalRecord(input!.historyProjection)) throw new Error("Material evidence mismatch");
    }
    const histories=inputs.filter(input=>input?.historyProjection!==undefined);
    if (histories.length!==1) throw new Error("Aggregate history");
    const projection=object(histories[0]!.historyProjection), original=object(projection?.reconciliation);
    if (typeof projection?.batchId!=="string" || !projection.batchId || original?.id!==projection.batchId ||
        !intent.candidates.every(candidate=>object(object(candidate)?.source)?.batchId===projection.batchId) || scope.size!==1 || !scope.has(projection.batchId)) throw new Error("Batch scope mismatch");
    const batch=database.prepare("select reconciliation_json from import_batches where id=?").get(projection.batchId);
    const current=batch && parsedObject(String(batch.reconciliation_json));
    if (!current || canonicalRecord(current)!==canonicalRecord(original)) throw new Error("History mismatch");
    assertImportHistoryOwnership(prepared,review,receipt.result.appliedChanges,projection.batchId);
    matchedId=projection.batchId; count=receipt.result.report.duplicate; historyDigest=historyEvidenceDigest(original);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && String(error.code).startsWith("ERR_")) throw error;
    // Unsupported evidence is scoped unknown; native storage errors escape.
  }
  proof.memberships=[...linked].map(batchId=>({batchId,...(batchId===matchedId && count!==undefined ? {count,historyDigest}: {})}));
  return proof;
}
