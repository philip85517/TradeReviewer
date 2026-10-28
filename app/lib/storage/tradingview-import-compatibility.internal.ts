/** Closed, pure import policy. Ordinary imports never run the account migration. */
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { canonicalInstrumentId } from "../instruments/display-name";
import { reconcileExecutions, type ExecutionReconciliation } from "../import/execution-reconciliation";
import { replayTradingViewDecodedEvidence } from "../import/tradingview-simulation";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";
import type { TradingViewDecodedEvidence } from "../import/contracts";
import { tradeNatureOf, type TradeExecution } from "../trades/types";
import { canonicalOriginalImport, tradeChangeInputDigest, type StandardInternalIntent } from "./trade-changes-engine.internal";
import { TradeChangeError, type TradingViewIdentityReview, type TradingViewIdentityScope, type TradingViewImportSummary } from "./sqlite-contracts";
import { materializeSourceMaterialContext, type MaterialVersion, type MaterialVersionInput, type SourceMaterialRows, type JsonObject } from "./source-materials";

export const TV_IMPORT_POLICY = "tv-compat-v1" as const;
export const isTradingViewExecution = (e: TradeExecution) => e.source.platform === "tradingview" || e.source.inputKind === "tradingview";
type Slot = Extract<TradingViewIdentityReview["locator"], { kind: "tv-source-slot-v1" }>;
export type SourceIdentityProof = { kind: "verified"; digest: string } | { kind: "unavailable"; reason: string };
export type TVAssessment = {
  policy: typeof TV_IMPORT_POLICY; digest: string; originalInput: string;
  reviews: TradingViewIdentityReview[]; reconciliation: ExecutionReconciliation;
  bindings: { candidateId: string; factId: string }[];
};
const key = tradeChangeInputDigest;
function fail(code: string, phase: "prepare" | "commit", message: string): never {
  throw new TradeChangeError(code, phase, message, randomUUID());
}
export function tvIdentityScope(e: TradeExecution): TradingViewIdentityScope {
  return { accountId: e.accountId, instrumentId: canonicalInstrumentId(e.instrument.symbol, e.instrument.market), market: e.instrument.market, currency: e.instrument.currency, nature: tradeNatureOf(e),
    rawRun: e.source.simulationRunId === undefined ? { kind: "absent" } : { kind: "present", raw: e.source.simulationRunId } };
}
function sameBusinessScope(a: TradeExecution, b: TradeExecution) {
  const x = tvIdentityScope(a), y = tvIdentityScope(b);
  return x.instrumentId === y.instrumentId && x.market === y.market && x.currency === y.currency && x.nature === y.nature && key(x.rawRun) === key(y.rawRun);
}
/** Roleless rows need the complete unique incoming row identity. No row-number role inference. */
function locator(e: TradeExecution, incoming: TradeExecution[], linked: boolean): Slot | null {
  const s = e.source, fp = s.fileFingerprint, trade = s.sourceTradeId ?? s.simulationTradeId;
  if (!isTradingViewExecution(e) || typeof fp !== "string" || !fp || typeof trade !== "string" || !trade) return null;
  const base = `tradingview:${fp}:${e.instrument.market}:${e.instrument.symbol}:${trade}:`;
  let role = s.simulationRole;
  if (role === undefined) {
    const peers = incoming.filter(other => other.id === e.id && other.source.fileFingerprint === fp && other.source.sourceTradeId === trade && other.source.row === s.row);
    if (peers.length !== 1) return null;
    role = peers[0].source.simulationRole;
  }
  if (role !== "entry" && role !== "exit") return null;
  if (!linked && e.id !== `${base}${role}` && !(Number.isInteger(s.row) && e.id === `${base}${s.row}`)) return null;
  return { kind: "tv-source-slot-v1", fileFingerprint: fp, market: e.instrument.market, symbol: e.instrument.symbol, sourceTradeId: trade, role };
}
function financial(e: TradeExecution) {
  const decimal = (v: string) => new Decimal(v).toString();
  return { side: e.side, quantity: decimal(e.quantity), price: decimal(e.price),
    fee: e.source.feeStatus === "unknown" ? { kind: "unknown" } : { kind: "known", value: decimal(e.fee) },
    currency: e.instrument.currency, executedAt: Number.isFinite(Date.parse(e.executedAt)) ? new Date(e.executedAt).toISOString() : e.executedAt,
    timePrecision: e.source.timePrecision ?? "instant", report: e.source.sourceReport ?? null };
}
/** Verify every current observation and its complete link set against the saved projection. */
function completeDecodedVersion(version: MaterialVersion, source: SourceMaterialRows): boolean {
  try {
    const projection = version.content.projection as unknown as { evidence: import("../import/contracts").TradingViewDecodedEvidence; executions: {candidateId:string;factId:string;slot:Slot|null}[] };
    const evidence = projection.evidence;
    const rowIds=evidence.rows.flatMap(r=>r.candidateIds);
    if(new Set(rowIds).size!==rowIds.length || new Set(projection.executions.map(e=>e.candidateId)).size!==projection.executions.length
      || projection.executions.some(e=>!rowIds.includes(e.candidateId))
      || key(version.scope)!==key({accounts:{values:[evidence.derived.accountId],unknown:false},instruments:{values:[canonicalInstrumentId(evidence.derived.symbol,evidence.derived.market)],unknown:false},markets:{values:[evidence.derived.market],unknown:false},periods:{values:[],unknown:true}})) return false;
    if (!projection || evidence.kind !== "tradingview-xlsx-records-v1" || evidence.fidelity !== "xlsx-decoded-records-raw-false"
      || key(projection) !== version.content.tvSemanticDigest || version.parserVersion !== evidence.parserVersion
      || version.sourceKind !== "tradingview" || version.fileFingerprint !== evidence.fileFingerprint
      || key(version.locator) !== key({policy:TV_IMPORT_POLICY,fp:evidence.fileFingerprint})
      || source.materials.filter(m=>m.current_version_id===version.id && m.id===version.materialId).length!==1
      || source.mappings.some(m=>m.material_id===version.materialId)
      || new Set(evidence.rows.map(r=>r.logicalRow)).size!==evidence.rows.length
      || version.observations.length!==evidence.rows.length) return false;
    const expectedDiagnostics=evidence.cellDiagnostics.map(d=>({code:"UNSUPPORTED_DECODED_CELL",detail:JSON.stringify(d)}));
    if (key(version.diagnostics)!==key(expectedDiagnostics)) return false;
    for (const row of evidence.rows) {
      const observations=version.observations.filter(o=>o.key===`decoded-row:${row.logicalRow}`);
      if(observations.length!==1) return false;
      const o=observations[0], records=projection.executions.filter(e=>row.candidateIds.includes(e.candidateId));
      const ids=records.map(e=>e.factId).sort();
      if(new Set(ids).size!==ids.length || o.identityStatus!=="located"
        || o.originalAccountId!==evidence.derived.accountId || key(o.raw)!==key(row)
        || key(o.locator)!==key({policy:TV_IMPORT_POLICY,sheet:evidence.sheet,logicalRow:row.logicalRow,slot:records[0]?.slot??null})
        || key(o.executionIds.slice().sort())!==key(ids)) return false;
      const links=source.links.filter(l=>l.observation_id===o.id);
      if(links.length!==ids.length || links.some(l=>l.reason!=="TradingView decoded source record" || l.recorded_at!==version.recordedAt)
        || key(links.map(l=>String(l.execution_id)).sort())!==key(ids)) return false;
    }
    return true;
  } catch { return false; }
}
function evidenceLink(source: SourceMaterialRows, executionId: string, slot: Slot): boolean {
  try {
    const hits=materializeSourceMaterialContext(source).versions.filter(v=>completeDecodedVersion(v,source)
      && v.observations.some(o=>key(o.locator.slot)===key(slot)&&o.executionIds.includes(executionId)));
    return hits.length===1;
  } catch { return false; }
}
export function assessTradingViewImport(input: {
  intent: StandardInternalIntent; current: TradeExecution[]; source: SourceMaterialRows;
  proof: (existing: TradeExecution, incoming: TradeExecution) => SourceIdentityProof;
  independent?: { candidateId: string; factId: string }[]; phase?: "prepare" | "commit";
}): TVAssessment | null {
  const { intent, current, source } = input, phase = input.phase ?? "prepare";
  if (intent.kind !== "import" && intent.kind !== "browser-migration") return null;
  const all = intent.kind === "import" ? intent.candidates : intent.payload.executions;
  const incoming = all.filter(isTradingViewExecution);
  if (!incoming.length) return null; // An envelope cannot manufacture TV authority.
  const envelope=intent.kind==="import"?intent.tradingViewImport:undefined;
  if(envelope && (envelope.policy!=="tv-import-v1" || !envelope.material || !["reuse-exact-or-propose","independent","new-version"].includes(envelope.material.kind)
    || envelope.material.kind==="new-version" && (!envelope.material.materialId?.trim() || !envelope.material.expectedCurrentVersionId?.trim()))) fail("INVALID_INPUT",phase,"Invalid TradingView import envelope");
  const slots = new Map(incoming.map(e => [e.id, locator(e, incoming, false)]));
  const reviews: TradingViewIdentityReview[] = [], duplicates: ExecutionReconciliation["duplicates"] = [], consumed = new Set<string>();
  const proofDigests: string[] = [];
  const groups = new Map<string, TradeExecution[]>();
  for (const e of incoming) { const k = key(slots.get(e.id) ?? { id: e.id }); groups.set(k, [...groups.get(k) ?? [], e]); }
  for (const group of groups.values()) {
    const first = group[0], slot = slots.get(first.id);
    const matches = current.filter(e => {
      const loc = locator(e, incoming, false);
      return e.id === first.id || !!slot && (key(loc) === key(slot) || evidenceLink(source, e.id, slot));
    });
    const proven = group.length === 1 && slot ? matches.filter(e => {
      if (!isTradingViewExecution(e) || !sameBusinessScope(e, first) || !(key(locator(e, incoming, false)) === key(slot) || evidenceLink(source, e.id, slot))) return false;
      const proof = input.proof(e, first);
      if (proof.kind !== "verified") return e.accountId === first.accountId && proof.reason === "no-formal-operation";
      proofDigests.push(proof.digest); return true;
    }) : [];
    if (proven.length === 1) {
      if (key(financial(proven[0])) !== key(financial(first))) fail("TRADINGVIEW_SOURCE_FINANCIAL_MISMATCH", phase, "同一已证明的 TradingView 来源身份存在财务或时间矛盾，请使用正式修订。");
      duplicates.push({ kept: proven[0], skipped: first }); consumed.add(first.id); continue;
    }
    if (!matches.length) continue;
    const reasons = new Set<TradingViewIdentityReview["reasons"][number]>();
    for (const e of matches) {
      const a = tvIdentityScope(e), b = tvIdentityScope(first);
      if (a.accountId !== b.accountId) reasons.add("account");
      if (a.instrumentId !== b.instrumentId || a.market !== b.market || a.currency !== b.currency) reasons.add("instrument");
      if (a.nature !== b.nature) reasons.add("nature");
      if (key(a.rawRun) !== key(b.rawRun)) reasons.add("run");
    }
    reasons.add(group.length !== 1 || proven.length > 1 ? "locator-ambiguous" : "proof-unavailable");
    reviews.push({ id: `identity:${key([slot ?? first.id, group.map(e => e.id), matches.map(e => e.id).sort()])}`,
      kind: slot ? "unproven-source-declaration" : "same-id-scope-conflict", incomingIds: group.map(e => e.id).sort(), existingIds: matches.map(e => e.id).sort(),
      incomingScopes: group.map(tvIdentityScope), existingScopes: matches.map(tvIdentityScope),
      locator: slot ?? { kind: "execution-id", executionId: first.id }, reasons: [...reasons].sort(), allowed: ["keep-independent"] });
  }
  const selected = input.independent;
  const required = [...new Set(reviews.flatMap(r => r.incomingIds))].sort();
  if (selected && (key(selected.map(b => b.candidateId).sort()) !== key(required) || new Set(selected.map(b => b.factId)).size !== selected.length)) fail("TRADINGVIEW_REVIEW_BINDING_INVALID", phase, "Independent selection does not cover the complete identity closure");
  const bindings = selected ?? [];
  for (const b of bindings) if (!all.some(e => e.id === b.candidateId) || current.some(e => e.id === b.factId) || (b.factId !== b.candidateId && all.some(e => e.id === b.factId))) fail("TRADINGVIEW_REVIEW_BINDING_INVALID", phase, "Independent fact identity is occupied");
  const reconciliation: ExecutionReconciliation = { acceptedIncoming: [], automaticReplacementIds: [], duplicates, conflicts: [] };
  // Reconciliation's ordinary heuristics are permitted only inside an exact TV namespace.
  const scopes = new Map<string, TradeExecution[]>();
  for (const e of incoming.filter(e => !consumed.has(e.id))) {
    if (required.includes(e.id) && !selected) continue;
    const b = bindings.find(b => b.candidateId === e.id);
    if (b) { reconciliation.acceptedIncoming.push({ ...e, id: b.factId }); continue; }
    const s = key(tvIdentityScope(e)); scopes.set(s, [...scopes.get(s) ?? [], e]);
  }
  for (const [scope, rows] of scopes) {
    const result = reconcileExecutions(current.filter(e => isTradingViewExecution(e) && key(tvIdentityScope(e)) === scope), rows);
    reconciliation.acceptedIncoming.push(...result.acceptedIncoming); reconciliation.duplicates.push(...result.duplicates);
    reconciliation.automaticReplacementIds.push(...result.automaticReplacementIds); reconciliation.conflicts.push(...result.conflicts);
  }
  const originalInput = canonicalOriginalImport(intent);
  return { policy: TV_IMPORT_POLICY, originalInput, reviews: selected ? [] : reviews, reconciliation, bindings,
    digest: key({ policy: TV_IMPORT_POLICY, originalInput, reviews, bindings, proofDigests: proofDigests.sort(), current, source }) };
}

export function makeIndependentBindings(reviews: TradingViewIdentityReview[], current: TradeExecution[]) {
  return [...new Set(reviews.flatMap(r => r.incomingIds))].sort().map(candidateId => ({ candidateId, factId: current.some(e => e.id === candidateId) ? `execution:${randomUUID()}` : candidateId }));
}

/** A fixed projection, deliberately distinct from full original-input binding. */
function semanticExecution(e: TradeExecution, factId: string) {
  const s = e.source;
  return { candidateId:e.id, factId, slot:locator(e,[e],false), originalAccountId: e.accountId, scope: tvIdentityScope(e), financial: financial(e),
    source: { platform: s.platform, fileFingerprint: s.fileFingerprint ?? null, sourceTradeId: s.sourceTradeId ?? s.simulationTradeId ?? null,
      simulationRole: s.simulationRole ?? null, row: s.row ?? null, sourceTimestampText: s.sourceTimestampText ?? null,
      sourceTimezone: s.sourceTimezone ?? null, inputKind: s.inputKind ?? null } };
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonempty);
const fields = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every(field => Object.hasOwn(value, field));
function decodedCell(value: unknown): boolean {
  if (!object(value)) return false;
  switch (value.kind) {
    case "string": return fields(value,["kind","value"]) && typeof value.value === "string";
    case "number": return fields(value,["kind","value","negativeZero"]) && typeof value.value === "number" && Number.isFinite(value.value)
      && !Object.is(value.value,-0) && typeof value.negativeZero === "boolean" && (!value.negativeZero || value.value === 0);
    case "boolean": return fields(value,["kind","value"]) && typeof value.value === "boolean";
    case "null": case "undefined": return fields(value,["kind"]);
    case "non-finite": return fields(value,["kind","value"]) && typeof value.value === "string" && ["NaN", "+Infinity", "-Infinity"].includes(value.value);
    case "bigint": return fields(value,["kind","decimal"]) && typeof value.decimal === "string" && /^(?:0|-?[1-9]\d*)$/.test(value.decimal);
    case "error": return fields(value,["kind","code","message"]) && (value.code === null || typeof value.code === "string") && (value.message === null || typeof value.message === "string");
    case "unsupported": return fields(value,["kind","jsType","diagnosticId"]) && typeof value.jsType === "string" && ["object", "function", "symbol"].includes(value.jsType) && nonempty(value.diagnosticId);
    default: return false;
  }
}
function decodedEvidence(value: unknown): value is TradingViewDecodedEvidence {
  if (!object(value) || !fields(value,["kind","fidelity","parserVersion","fileFingerprint","sheet","headers","rows","cellDiagnostics","derived"])
    || value.kind !== "tradingview-xlsx-records-v1" || value.fidelity !== "xlsx-decoded-records-raw-false"
    || value.parserVersion !== "tradingview-simulation-v2" || !nonempty(value.fileFingerprint)
    || !object(value.sheet) || !fields(value.sheet,["ordinal","name"]) || value.sheet.ordinal !== 0 || !nonempty(value.sheet.name)
    || !Array.isArray(value.headers) || !value.headers.every(decodedCell)
    || !Array.isArray(value.cellDiagnostics) || !value.cellDiagnostics.every(d => object(d) && fields(d,["id","sheet","logicalRow","column"])
      && nonempty(d.id) && nonempty(d.sheet) && Number.isSafeInteger(d.logicalRow) && Number(d.logicalRow) >= 1 && nonempty(d.column))
    || !Array.isArray(value.rows) || !value.rows.every(row => object(row) && fields(row,["logicalRow","entries","outcome","candidateIds","diagnosticCodes"])
      && Number.isSafeInteger(row.logicalRow) && Number(row.logicalRow) >= 2
      && Array.isArray(row.entries) && row.entries.every(entry => object(entry) && fields(entry,["key","cell"]) && typeof entry.key === "string" && decodedCell(entry.cell))
      && ["accepted", "invalid", "duplicate-role", "unpaired", "ambiguous"].includes(String(row.outcome)) && strings(row.candidateIds) && strings(row.diagnosticCodes))
    || !object(value.derived) || !fields(value.derived,["accountId","accountOrigin","tradeNature","natureOrigin","sourceRun","runOrigin","market","symbol","currency"])) return false;
  const derived = value.derived;
  return nonempty(derived.accountId) && derived.accountOrigin === "parser-canonical-constant" && derived.tradeNature === "simulation"
    && derived.natureOrigin === "parser-format-contract" && nonempty(derived.sourceRun) && derived.runOrigin === "parser-fingerprint-market-symbol"
    && nonempty(derived.market) && nonempty(derived.symbol) && nonempty(derived.currency);
}
/** Validate original parser observations, then project links onto the selected candidates. */
export function validateTVImportEvidence(intent: Extract<StandardInternalIntent, { kind: "import" }>): void {
  const evidence = intent.tradingViewImport?.evidence;
  if (evidence === undefined) return;
  const invalid = () => fail("INVALID_INPUT", "prepare", "Decoded observations disagree with parser candidates");
  if (!decodedEvidence(evidence) || !intent.candidates.some(isTradingViewExecution)) invalid();
  if (evidence.derived.accountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID
    || !["CN-SH","CN-SZ"].includes(evidence.derived.market) || !/^\d{6}$/.test(evidence.derived.symbol)
    || evidence.derived.currency !== "CNY"
    || evidence.derived.sourceRun !== `tradingview:${evidence.fileFingerprint}:${evidence.derived.market}:${evidence.derived.symbol}`) invalid();
  const positions: TradingViewDecodedEvidence["cellDiagnostics"] = [];
  const position = (cell: TradingViewDecodedEvidence["headers"][number], logicalRow: number, column: string) => {
    if (cell.kind !== "unsupported") return;
    const id = `decoded:${logicalRow}:${column}`;
    if (cell.diagnosticId !== id) invalid();
    positions.push({id, sheet:evidence.sheet.name, logicalRow, column});
  };
  // Object.entries preserves one value per key, including the XLSX duplicate-header suffixes.
  for (const [index,row] of evidence.rows.entries()) {
    if (row.logicalRow !== index + 2 || new Set(row.entries.map(entry=>entry.key)).size !== row.entries.length
      || row.entries.some(entry=>!entry.key)) invalid();
    row.entries.forEach(entry=>position(entry.cell,row.logicalRow,entry.key));
  }
  evidence.headers.forEach((cell,index)=>position(cell,1,String(index)));
  if (key(positions) !== key(evidence.cellDiagnostics)) invalid();
  // Required columns must retain their actual decoded record keys. Extra XLSX columns remain observations.
  const required = ["交易编号","类型","日期和时间","信号","价格 CNY","大小（数量）","大小（价值）","净损益 CNY","回报 %","手续费 CNY","有利波动 CNY","有利波动 %","不利波动 CNY","不利波动 %","累计损益 CNY","累计损益 %","持续时间（K线）"];
  if (required.some(name=>!evidence.headers.some(cell=>cell.kind==="string" && cell.value.trim()===name))
    || evidence.rows.some(row=>required.some(name=>!row.entries.some(entry=>entry.key===name)))) invalid();
  const replay = replayTradingViewDecodedEvidence(evidence);
  if (key(replay.tradingViewEvidence) !== key(evidence)) invalid();
  const original = new Map(replay.records.map(record=>[record.id,record]));
  // Replacing both discriminators cannot turn a parser-bound ID into an unrelated residual row.
  const candidates = intent.candidates.filter(candidate=>isTradingViewExecution(candidate) || original.has(candidate.id));
  if (new Set(candidates.map(e=>e.id)).size !== candidates.length) invalid();
  const semanticSource = (e:TradeExecution) => {
    const {fileName,batchId,...source} = e.source;
    // These are the only source additions made by the verified display/preview flow.
    if (fileName !== undefined && typeof fileName !== "string" || batchId !== undefined && !nonempty(batchId)) invalid();
    return source;
  };
  for (const candidate of candidates) {
    const expected = original.get(candidate.id);
    if (!expected) invalid();
    if (!fields(semanticSource(candidate),Object.keys(semanticSource(expected!)))) invalid();
    const identity = (e:TradeExecution) => ({id:e.id, accountId:e.accountId, instrument:{id:e.instrument.id,symbol:e.instrument.symbol,market:e.instrument.market,currency:e.instrument.currency},
      financial:financial(e), source:semanticSource(e)});
    if (key(identity(candidate)) !== key(identity(expected!))) invalid();
  }
}
export function prepareTVMaterial(intent: StandardInternalIntent, assessment: TVAssessment, source: SourceMaterialRows): { summary: TradingViewImportSummary; material?: MaterialVersionInput } {
  const all = intent.kind === "import" ? intent.candidates : intent.kind === "browser-migration" ? intent.payload.executions : [];
  const candidates = all.filter(isTradingViewExecution), rec = assessment.reconciliation;
  const facts = { accepted: rec.acceptedIncoming.length, duplicate: rec.duplicates.length, conflict: rec.conflicts.length };
  const identity: TradingViewImportSummary["identity"] = assessment.bindings.length && intent.kind === "import" && intent.tradingViewImport?.identity
    ? { kind: "kept-independent", bindings: assessment.bindings, resolvedFrom: { reviewPlanId: intent.tradingViewImport.identity.reviewPlanId, inputDigest: intent.tradingViewImport.identity.inputDigest, candidateIds: intent.tradingViewImport.identity.candidateIds } }
    : { kind: "unchanged" };
  const base = { policy: "tv-import-v1" as const, facts, identity };
  const evidence = intent.kind === "import" ? intent.tradingViewImport?.evidence : undefined;
  if (!evidence) return { summary: { ...base, material: { kind: "normalized-only", reason: "legacy-no-decoded-observations" } } };
  const aliases = new Map([...rec.duplicates.map(d => [d.skipped.id, d.kept.id] as const), ...assessment.bindings.map(b => [b.candidateId, b.factId] as const)]);
  const projection = { evidence, executions: candidates.map(e => semanticExecution(e, aliases.get(e.id) ?? e.id)) };
  const semanticDigest = key(projection), context = materializeSourceMaterialContext(source);
  const matching = context.versions.filter(v => v.fileFingerprint === evidence.fileFingerprint);
  const exact = context.materials.flatMap(m => {
    const v = context.versions.find(v => v.id === m.currentVersionId);
    return v?.content.tvSemanticDigest === semanticDigest && key(v.content.projection)===key(projection) && completeDecodedVersion(v,source) ? [v] : [];
  });
  const handling = intent.kind === "import" ? intent.tradingViewImport?.material ?? { kind: "reuse-exact-or-propose" as const } : { kind: "reuse-exact-or-propose" as const };
  if (handling.kind === "reuse-exact-or-propose" && exact.length === 1 && !facts.accepted && !facts.conflict && evidence.cellDiagnostics.length === 0) return { summary: { ...base, material: { kind: "reuse-exact", materialId: exact[0].materialId, versionId: exact[0].id, semanticDigest } } };
  if (handling.kind === "reuse-exact-or-propose" && matching.length) fail("TRADINGVIEW_MATERIAL_CHOICE_REQUIRED", "prepare", "请选择独立材料或明确的新版本；同名或金额相同不能证明材料身份。");
  if (handling.kind === "new-version" && context.materials.find(m => m.id === handling.materialId)?.currentVersionId !== handling.expectedCurrentVersionId) fail("MATERIAL_HEAD_CHANGED", "prepare", "Selected material head changed");
  const materialId = handling.kind === "new-version" ? handling.materialId : `material:${randomUUID()}`, versionId = `version:${randomUUID()}`;
  const history = intent.kind === "import" ? intent.importHistory?.[0] : undefined;
  const material: MaterialVersionInput = { materialId, versionId, parserVersion: evidence.parserVersion, sourceKind: "tradingview", locator: { policy: TV_IMPORT_POLICY, fp: evidence.fileFingerprint }, fileFingerprint: evidence.fileFingerprint,
    recordedAt: history?.importedAt ?? new Date().toISOString(),
    scope: { accounts: { values: [...new Set(candidates.map(e => e.accountId))], unknown: false }, instruments: { values: [...new Set(candidates.map(e => e.instrument.id))], unknown: false }, markets: { values: [...new Set(candidates.map(e => e.instrument.market))], unknown: false }, periods: { values: [], unknown: true } },
    diagnostics: evidence.cellDiagnostics.map(d => ({ code: "UNSUPPORTED_DECODED_CELL", detail: JSON.stringify(d) })),
    content: JSON.parse(JSON.stringify({ tvSemanticDigest: semanticDigest, projection })) as JsonObject,
    observations: evidence.rows.map(row => {
      const records = candidates.filter(e => row.candidateIds.includes(e.id));
      const e = records[0], slot = e ? locator(e, candidates, false) : null;
      return { id: `observation:${randomUUID()}`, key: `decoded-row:${row.logicalRow}`, locator: JSON.parse(JSON.stringify({ policy: TV_IMPORT_POLICY, sheet: evidence.sheet, logicalRow: row.logicalRow, slot })) as JsonObject,
        raw: JSON.parse(JSON.stringify(row)), originalAccountId: evidence.derived.accountId, executionIds: records.map(e => aliases.get(e.id) ?? e.id), linkReason: "TradingView decoded source record" };
    }),
    ...(history ? { historyProjection: { batchId: history.id, reconciliation: JSON.parse(JSON.stringify(history)) as JsonObject } } : {}) };
  return { material, summary: { ...base, material: { kind: "save-evidence", materialId, versionId, semanticDigest, reason: handling.kind === "new-version" ? "explicit-new-version" : handling.kind === "independent" ? "independent" : "first-evidence", observations: material.observations.length, links: material.observations.reduce((n, o) => n + o.executionIds.length, 0) } } };
}
