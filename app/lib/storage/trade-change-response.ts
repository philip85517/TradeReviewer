import { validFileContentIdentity } from "../import/file-fingerprint";
import type { CommitReceipt, ReviewPlan } from "./sqlite-contracts";
import { validBookVersion } from "./trade-read-contract";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const decisions = new Set(["keep-existing", "use-incoming", "keep-both"]);
function fact(v: unknown) {
  return object(v) && text(v.instrumentId) && (v.accountId === null || typeof v.accountId === "string")
    && text(v.side) && text(v.quantity) && text(v.price) && text(v.executedAt)
    && (v.fee === null || typeof v.fee === "string") && (v.currency === null || typeof v.currency === "string");
}
function execution(v: unknown) {
  return object(v) && text(v.id) && typeof v.accountId === "string" && object(v.instrument)
    && ["id", "symbol", "name", "market", "currency"].every(k => typeof v.instrument === "object" && v.instrument !== null && typeof (v.instrument as Record<string, unknown>)[k] === "string")
    && ["quantity", "price", "fee", "executedAt", "side"].every(k => typeof v[k] === "string") && object(v.source);
}
function changes(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.every(c => {
    if (!object(c) || !["add", "replace", "revise", "withdraw", "reactivate", "material-version", "link"].includes(String(c.kind))) return false;
    for (const key of ["before", "after"]) if (c[key] !== undefined && c[key] !== null && !fact(c[key])) return false;
    for (const key of ["executionId", "materialId", "versionId", "observationId"]) if (c[key] !== undefined && !text(c[key])) return false;
    if (c.when !== undefined) {
      const w = c.when;
      if (!object(w)) return false;
      if (text(w.conflictId)) return strings(w.decisions) && (w.decisions as string[]).every(d => decisions.has(d));
      if (text(w.missingExecutionId)) return w.action === "withdraw";
      if (text(w.reactivateExecutionId)) return w.action === "activate";
      return false;
    }
    return true;
  });
}

function uniqueStrings(v: unknown, nonempty = false): v is string[] {
  return strings(v) && (!nonempty || v.length > 0) && v.every(text) && new Set(v).size === v.length;
}
function tvSummary(v: unknown): boolean {
  if (!object(v) || v.policy !== "tv-import-v1" || !object(v.facts) || !["accepted", "duplicate", "conflict"].every(k => count((v.facts as Record<string, unknown>)[k])) || !object(v.identity) || !object(v.material)) return false;
  if (v.identity.kind === "kept-independent") {
    const {bindings,resolvedFrom}=v.identity;
    if (!Array.isArray(bindings) || !bindings.length || !bindings.every(b=>object(b)&&text(b.candidateId)&&text(b.factId))
      || !uniqueStrings(bindings.map(b=>b.candidateId)) || !uniqueStrings(bindings.map(b=>b.factId)) || !object(resolvedFrom)
      || !text(resolvedFrom.reviewPlanId) || !text(resolvedFrom.inputDigest) || !uniqueStrings(resolvedFrom.candidateIds,true)
      || bindings.map(b=>b.candidateId).sort().join("\0")!==resolvedFrom.candidateIds.slice().sort().join("\0")) return false;
  } else if (v.identity.kind !== "unchanged") return false;
  const m=v.material;
  if (m.kind === "normalized-only") return m.reason === "legacy-no-decoded-observations";
  if (!["reuse-exact","save-evidence"].includes(String(m.kind)) || !text(m.materialId) || !text(m.versionId) || !text(m.semanticDigest)) return false;
  return m.kind === "reuse-exact" || ["first-evidence","independent","explicit-new-version"].includes(String(m.reason)) && count(m.observations) && count(m.links);
}
function identityScope(v: unknown): boolean {
  return object(v) && typeof v.accountId === "string" && text(v.instrumentId) && text(v.market) && text(v.currency) && ["simulation","live","unknown"].includes(String(v.nature)) && object(v.rawRun)
    && (v.rawRun.kind === "absent" && v.rawRun.raw === undefined || v.rawRun.kind === "present" && typeof v.rawRun.raw === "string");
}
function identityReviews(v: unknown): v is Record<string, unknown>[] {
  if (!Array.isArray(v)) return false;
  return v.every(r=> {
    if (!object(r) || !text(r.id) || !["unproven-source-declaration","same-id-scope-conflict"].includes(String(r.kind))
      || !uniqueStrings(r.incomingIds,true) || !uniqueStrings(r.existingIds,true)
      || !Array.isArray(r.incomingScopes) || r.incomingScopes.length!==r.incomingIds.length || !r.incomingScopes.every(identityScope)
      || !Array.isArray(r.existingScopes) || r.existingScopes.length!==r.existingIds.length || !r.existingScopes.every(identityScope)
      || !uniqueStrings(r.reasons,true) || !r.reasons.every(x=>["account","instrument","nature","run","locator-ambiguous","proof-unavailable"].includes(x))
      || !Array.isArray(r.allowed) || r.allowed.length!==1 || r.allowed[0]!=="keep-independent" || !object(r.locator)) return false;
    const l=r.locator;
    return l.kind === "execution-id" ? text(l.executionId) : l.kind === "tv-source-slot-v1" && ["fileFingerprint","market","symbol","sourceTradeId"].every(k=>text(l[k])) && ["entry","exit"].includes(String(l.role));
  }) && uniqueStrings(v.map(r=>r.id)) && uniqueStrings(v.flatMap(r=>r.incomingIds));
}

const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function duplicateFact(value: unknown): boolean {
  if (!object(value) || !exactKeys(value,["accountId","accountLabel","instrument","executedAt","side","quantity","price","fee","source"]) ||
      typeof value.accountId !== "string" || typeof value.accountLabel !== "string" || !object(value.instrument) ||
      !exactKeys(value.instrument,["id","symbol","name","market","currency"]) || !Object.values(value.instrument).every(text) ||
      !date(value.executedAt) || !["buy","sell"].includes(String(value.side)) ||
      ![value.quantity,value.price].every(v => text(v) && Number.isFinite(Number(v))) ||
      !(value.fee === null || text(value.fee) && Number.isFinite(Number(value.fee))) || !object(value.source) ||
      !exactKeys(value.source,["platform","fileName","page","row"])) return false;
  const source=value.source;
  return text(source.platform) && (source.fileName === null || text(source.fileName) && !/[\\/]/.test(source.fileName)) &&
    (source.page === null || count(source.page)) && count(source.row);
}
function duplicateSummary(value: unknown): boolean {
  return object(value) && exactKeys(value,["policy","count","pairs"]) && value.policy === "import-duplicate-review-v1" && count(value.count) &&
    Array.isArray(value.pairs) && value.count === value.pairs.length && value.pairs.every(pair => object(pair) && exactKeys(pair,["kept","skipped"]) && duplicateFact(pair.kept) && duplicateFact(pair.skipped));
}

/** Successful transport is insufficient: these values control destructive choices and recovery. */
export function parseTradePlan(value: unknown, expectedKind: ReviewPlan["kind"], options: { retainedEvidence?: boolean } = {}): ReviewPlan {
  if (!object(value) || !text(value.planId) || value.policy !== "trade-changes-v1" || value.kind !== expectedKind
    || !validBookVersion(value.baseVersion) || !date(value.createdAt) || !date(value.expiresAt)
    || !object(value.summary) || !count(value.summary.candidateCount) || !text(value.summary.inputDigest) || !changes(value.summary.changes)
    || !Array.isArray(value.diagnostics) || !value.diagnostics.every(d => object(d) && ["code", "locator", "detail"].every(k => typeof d[k] === "string"))
    || !Array.isArray(value.conflicts) || !value.conflicts.every(c => object(c) && text(c.id) && text(c.candidateKey) && Array.isArray(c.existing) && c.existing.every(execution) && Array.isArray(c.incoming) && c.incoming.every(execution) && strings(c.allowed) && c.allowed.length > 0 && c.allowed.every((d: string) => decisions.has(d)))
    || !Array.isArray(value.missingExecutions) || !value.missingExecutions.every(m => object(m) && text(m.executionId) && strings(m.previousObservationIds) && strings(m.otherSourceObservationIds) && strings(m.revisionIds))
    || !strings(value.reactivateExecutionIds)) throw new Error("Invalid trade plan");
  if (new Set(value.conflicts.map(c => c.id)).size !== value.conflicts.length || new Set(value.missingExecutions.map(m => m.executionId)).size !== value.missingExecutions.length) throw new Error("Repeated trade decision");
  const v2=["reviewContract","status","identityReviews","tvImportGuard"].some(k=>Object.hasOwn(value,k)) || Object.hasOwn(value.summary,"tradingViewImport");
  if (v2 && (value.reviewContract!=="trade-review-v2" || !["ready","review-required"].includes(String(value.status)) || !identityReviews(value.identityReviews)
    || (value.status==="ready" ? value.identityReviews.length!==0 : value.identityReviews.length===0)
    || value.tvImportGuard!==undefined && (!object(value.tvImportGuard) || value.tvImportGuard.policy!=="tv-compat-v1" || !tvSummary(value.summary.tradingViewImport))
    || value.summary.tradingViewImport!==undefined && (!tvSummary(value.summary.tradingViewImport) || !object(value.tvImportGuard))
    || value.status==="review-required" && (!object(value.tvImportGuard) || value.summary.changes.length!==0 || value.conflicts.length!==0 || value.missingExecutions.length!==0 || value.reactivateExecutionIds.length!==0))) throw new Error("Invalid v2 trade plan");
  if (Object.hasOwn(value.summary,"importDuplicates") && (!duplicateSummary(value.summary.importDuplicates) || value.kind !== "import" || value.summary.tradingViewImport !== undefined)) throw new Error("Invalid import duplicate summary");
  if (!options.retainedEvidence && value.kind === "import" && value.summary.tradingViewImport === undefined && value.status !== "review-required" && !duplicateSummary(value.summary.importDuplicates)) throw new Error("Missing import duplicate summary");
  return value as ReviewPlan;
}

export function parseTradeCommitReceipt(value: unknown, expectedPlanId?: string): CommitReceipt {
  if (!object(value) || !text(value.receiptId) || !text(value.planId) || (expectedPlanId !== undefined && value.planId !== expectedPlanId)
    || value.policy !== "trade-changes-v1" || !date(value.committedAt) || !validBookVersion(value.bookVersion)
    || !object(value.result) || !object(value.result.report) || !["inserted", "duplicate", "conflict"].every(k => count((value.result as { report: Record<string, unknown> }).report[k]))
    || !changes(value.result.appliedChanges)) throw new Error("Invalid trade receipt");
  if (Object.hasOwn(value.result, "importedFile") && !validFileContentIdentity(value.result.importedFile)) throw new Error("Invalid imported file evidence");
  if (Object.hasOwn(value.result,"tradingViewImport") && !tvSummary(value.result.tradingViewImport)) throw new Error("Invalid TradingView receipt summary");
  return value as CommitReceipt;
}

export function parseWriteAcknowledgement(value: unknown): { ok: true } {
  if (!object(value) || value.ok !== true) throw new Error("Invalid write acknowledgement");
  return { ok: true };
}
