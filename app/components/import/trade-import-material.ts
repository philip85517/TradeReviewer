import type { ImportPreview } from "../../lib/import/import-preview";
import type { TradeBookRead } from "../../lib/storage/trade-read-contract";
import { importIntentForPreview } from "./trade-import-plan";
import type { JsonObject, MaterialScope, MaterialVersionInput } from "../../lib/storage/source-materials";

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function jsonObject(value: unknown): JsonObject { return JSON.parse(JSON.stringify(value)) as JsonObject; }

function fingerprint(preview: ImportPreview) {
  const values = [...new Set(preview.records.map(e => e.source.fileFingerprint).filter((v): v is string => !!v))];
  return values.length === 1 ? values[0] : null;
}
function fileVersions(preview: ImportPreview, book?: TradeBookRead) {
  const fileFingerprint = fingerprint(preview);
  return fileFingerprint ? (book?.pages ?? []).flatMap(page => page.snapshot.materialHistory.flatMap(material => material.versions.filter(version => version.fileFingerprint === fileFingerprint).map(version => ({ materialId: material.id, version })))) : [];
}
function projectionBatchId(version: ReturnType<typeof fileVersions>[number]["version"]) {
  const projection = version.content.historyProjection;
  if (object(projection) && typeof projection.batchId === "string") return projection.batchId;
  return version.legacy?.batchId ?? null;
}
export function monthlyFileAlreadyImported(preview: ImportPreview, book: TradeBookRead) {
  return fileVersions(preview, book).length > 0;
}

export function tradingViewImportIntent(preview: ImportPreview, selection: string, book: TradeBookRead) {
  const intent=importIntentForPreview(preview);
  if (!intent.tradingViewImport) throw new Error("TradingView 来源意图缺失");
  const selected=selection && selection!=="__tv_independent__" ? importMaterialOptions(book).find(option=>option.id===selection) : null;
  if (selection && selection!=="__tv_independent__" && !selected) throw new Error("所选材料头当前不可核实，请重新选择。");
  intent.tradingViewImport.material=selected ? {kind:"new-version",materialId:selected.id,expectedCurrentVersionId:selected.currentVersionId} : selection==="__tv_independent__" ? {kind:"independent"} : {kind:"reuse-exact-or-propose"};
  return intent;
}

export function monthlyImportIntent(preview: ImportPreview, materialId: string | null, versionId: string, recordedAt: string, book?: TradeBookRead) {
  const intent = importIntentForPreview(preview);
  if (!preview.monthly) return intent;
  const priorVersions = fileVersions(preview, book);
  const ownedBatch = priorVersions.find(item => item.materialId === materialId && projectionBatchId(item.version));
  const existingDisplay = priorVersions.find(item => projectionBatchId(item.version));
  // A compatibility batch has one material owner. An independent material can
  // refer to an existing display row, but never claim that row as its projection.
  const batchId = ownedBatch ? projectionBatchId(ownedBatch.version)! : `import-attempt:${versionId}`;
  const displayReference = !ownedBatch && existingDisplay ? {
    batchId: projectionBatchId(existingDisplay.version)!, relationship: "display-only",
    fileFingerprint: fingerprint(preview), explanation: "相同文件已有展示批次参考；不证明材料身份、替代关系或账户归属",
  } : null;
  const history = { ...intent.importHistory![0], id: batchId, importedAt: recordedAt };
  const account = preview.monthly.accountId;
  const month = preview.monthly.month;
  const period = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? {
    from: `${month}-01`, to: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10),
  } : null;
  // Month/account describe scope; neither is used to infer material identity.
  const scope: MaterialScope = {
    accounts: account && !account.includes(":document:") ? { values: [account], unknown: false } : { values: [], unknown: true },
    markets: { values: [], unknown: true }, instruments: { values: [], unknown: true },
    periods: period ? { values: [period], unknown: false } : { values: [], unknown: true },
  };
  const material: MaterialVersionInput = {
    materialId: materialId ?? `material:${versionId}`, versionId, parserVersion: "desktop-monthly-material-v1",
    sourceKind: preview.sourceKind, recordedAt, fileFingerprint: fingerprint(preview),
    locator: { fileName: preview.fileName, documentId: preview.monthly.documentId }, scope,
    diagnostics: (preview.diagnostics ?? []).map(d => ({ code: d.code, detail: d.message })),
    content: { monthly: jsonObject(preview.monthly), originalPreviewId: preview.id, ...(displayReference ? { existingFileDisplayReference: displayReference } : {}) },
    observations: preview.records.map((execution, index) => {
      const { page, row, fragments } = execution.source;
      const locator = jsonObject({ ...(page === undefined ? {} : { page }), ...(row === undefined ? {} : { row }), ...(fragments ? { fragments } : {}) });
      return { id: `${versionId}:observation:${index}`, key: page !== undefined && row !== undefined ? `${page}:${row}` : null,
        locator, raw: jsonObject({ parsedExecution: execution, sourceEvidence: execution.source }), originalAccountId: execution.accountId || null,
        executionIds: [execution.id], linkReason: "Parsed file observation contributes to the reviewed execution" };
    }),
    ...(displayReference ? {} : { historyProjection: { batchId, reconciliation: jsonObject(history) } }),
  };
  return { ...intent, candidates: intent.candidates.map(e => {
    const source = { ...e.source };
    if (displayReference) delete source.batchId;
    else source.batchId = batchId;
    return { ...e, source };
  }), importHistory: undefined, materials: [material] };
}

export type ImportMaterialOption = { id: string; currentVersionId: string; label: string };
export function importMaterialOptions(book: TradeBookRead): ImportMaterialOption[] {
  const options = new Map<string, ImportMaterialOption>();
  for (const page of book.pages) for (const material of page.snapshot.materialHistory) {
    const current = material.versions.find(v => v.id === material.currentVersionId);
    if (!current) continue;
    const projection = current.content.historyProjection;
    const history = object(projection) && object(projection.reconciliation) ? projection.reconciliation
      : object(current.content.legacyImportHistory) ? current.content.legacyImportHistory : null;
    const file = typeof current.locator.fileName === "string" ? current.locator.fileName
      : typeof history?.fileName === "string" ? history.fileName : "未记录文件名";
    const accounts = current.scope.accounts.unknown ? "账户范围含未知" : current.scope.accounts.values.join("、") || "未记录账户";
    const month = current.monthly?.month ?? "月份未知";
    const fingerprint = current.fileFingerprint ? `指纹 ${current.fileFingerprint.slice(0, 12)}…` : "指纹未记录";
    options.set(material.id, { id: material.id, currentVersionId: current.id, label: `${file} · ${accounts} · ${month} · ${fingerprint}` });
  }
  return [...options.values()];
}
