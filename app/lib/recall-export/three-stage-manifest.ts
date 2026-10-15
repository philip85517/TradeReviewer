import { getRecallStoryboard, STORYBOARD_PHASE_LABELS } from "../recall/storyboard";
import { RECALL_DERIVED_CAPTURE_RENDERERS } from "../recall/types";
import type {
  RecallDocument,
  RecallDerivedCapture,
  RecallPhase,
  RecallPlanVersion,
  RecallRetainedBundle,
  RecallSnapshot,
} from "../recall/types";
import type { RecallExitEvaluationVersion } from "../recall/exit-evaluations";
import { RecallExportError, selectRecallExportDocument } from "./manifest";
import type { RecallExportSource } from "./types";
import { formatBeijingDateTime } from "../replay/format-time";
import { sha256 } from "../recall/retained-digest";
import { pngDimensions } from "../recall/document";

export const THREE_STAGE_EXPORT_FRAME = Object.freeze({ width: 1440, height: 810 });

/** Fixed 16:9 layout shared by the manifest budget and SVG renderer. */
export const THREE_STAGE_LAYOUT = Object.freeze({
  cardX: 24, cardGap: 14, cardWidth: 456, cardY: 96, cardHeight: 556,
  imageXInset: 12, imageY: 167, imageWidth: 432, imageHeight: 280,
  contentXInset: 12, preImageTop: 129, contentTop: 461, contentBottomInset: 26, contentBottom: 626,
  metaLineHeight: 15, textLineHeight: 21,
  tableY: 670, tableHeaderY: 681, tableFirstRowY: 715, tableRowHeight: 34,
});

export function threeStageContentPixelBudget(): number {
  return THREE_STAGE_LAYOUT.cardY + THREE_STAGE_LAYOUT.cardHeight - THREE_STAGE_LAYOUT.contentBottomInset - THREE_STAGE_LAYOUT.contentTop;
}

export function threeStagePreImagePixelBudget(): number {
  return THREE_STAGE_LAYOUT.imageY - THREE_STAGE_LAYOUT.preImageTop;
}

const TEXT_PIXEL_WIDTH = 416;
const MAX_STAGE_TEXT_LINES = 8;
const MAX_EXECUTION_ROWS = 5;

export type ThreeStageWarningCode =
  | "missing-phase" | "missing-image" | "invalid-image" | "missing-viewport"
  | "price-scale-unverified" | "content-overflow" | "missing-bundle" | "derived-fallback";

export type ThreeStageText = {
  key: string; drawingId: string; phase: RecallPhase; sourceSnapshotId: string;
  revision: string; ownerId: string; text: string; lines: readonly string[];
  formingPhase: RecallPhase | undefined; hasSeenFuture: boolean | undefined;
  cursor: string; executionCursor: string;
  sourceNumber?: number; anchorTime?: string; anchorPrice?: number;
  anchorStatus?: "visible-anchor" | "off-range" | "canvas-position" | "missing-anchor";
};

export type ThreeStageContentRow = {
  kind: "meta" | "text" | "warning"; text: string; lines: readonly string[]; textKey?: string;
  placement?: "before-image" | "body";
};

export type ThreeStageExecution = {
  id: string; executedAt: string; side: "buy" | "sell"; quantity: string;
  price: string; fee: string; currency: string; sourceBundleId: string;
  sourceDocumentRevision: number; sourceDigest: string;
};

export type ThreeStageRecordIndexEntry = {
  kind: "snapshot" | "execution" | "plan" | "evaluation" | "bundle" | "manual-evaluation" | "risk-baseline" | "plan-association";
  id: string; phase?: RecallPhase; snapshotId?: string; bundleId?: string;
  retained: boolean; selected?: boolean; imageSaved?: boolean; status?: string;
  details?: readonly string[];
};

export type ThreeStageMetric = {
  key: string; label: string; value: string | null; reason: string | null;
  currency: string | null; unit: string;
};

export type ThreeStageCapitalSource = {
  planVersionId: string; amount: string | null; currency: string | null;
  asOf: string | null; source: string | null; snapshotRef: string | null;
};

export type ThreeStageFinancialSummary = {
  bundleId: string | null; bundleSnapshotId: string | null;
  bundleDocumentRevision: number | null; retainedAt: string | null;
  evidenceDigest: string | null; metrics: readonly ThreeStageMetric[];
  capitalSources: readonly ThreeStageCapitalSource[]; executionIds: readonly string[];
};

export type ThreeStageSourceIdentity = {
  source: RecallExportSource; episodeId: string; documentRevision: number;
  status: RecallDocument["status"]; updatedAt: string; completedAt: string | null;
  selectedBundleId: string | null; selectedBundleSnapshotId: string | null;
  selectedBundleDocumentRevision: number | null; selectedBundleRetainedAt: string | null;
  selectedBundleEvidenceDigest: string | null;
};

export type ThreeStageExportStage = {
  phase: RecallPhase; title: string; snapshotId: string | null; imageDataUrl: string | null;
  /** Canonical 1280×720 image retained for PPTX/legacy ZIP consumers. */
  canonicalImageDataUrl: string | null;
  derivedCapture?: RecallDerivedCapture;
  viewport: RecallSnapshot["viewport"] | null; marketCutoff: string | null;
  executionCutoff: string | null; snapshotDocumentRevision: number;
  hasSeenFuture: boolean | undefined; texts: readonly ThreeStageText[];
  contentRows: readonly ThreeStageContentRow[]; contentPixelHeight: number;
  contentPixelBudget: number; warningCodes: readonly ThreeStageWarningCode[];
  warnings: readonly string[];
};

export type ThreeStageExportManifest = {
  version: 2; source: RecallExportSource; episodeId: string; documentRevision: number;
  generatedAt: string; fileName: string; frame: typeof THREE_STAGE_EXPORT_FRAME;
  instrument: { symbol: string; name: string; market: string; currency: string };
  sourceIdentity: ThreeStageSourceIdentity; stages: readonly ThreeStageExportStage[];
  texts: readonly ThreeStageText[]; executions: readonly ThreeStageExecution[];
  acceptedBundleId: string | null; plans: readonly RecallPlanVersion[];
  exitEvaluations: readonly RecallExitEvaluationVersion[]; financial: ThreeStageFinancialSummary;
  allRecordIndex: readonly ThreeStageRecordIndexEntry[];
  warningCodes: readonly ThreeStageWarningCode[]; warnings: readonly string[];
  contentOverflow: boolean;
};

export type ThreeStageInstrumentIdentity = {
  episodeId: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
};

export type ManifestOptions = {
  source?: RecallExportSource;
  generatedAt?: string;
  /** Frozen episode identity supplied by the caller before any async export work. */
  instrument?: ThreeStageInstrumentIdentity;
};

function freeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  return Object.freeze(value);
}

function isWideCodePoint(codePoint: number): boolean {
  return (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff);
}

/** Approximate the locked 14px CJK sans font in CSS pixels without a live canvas. */
export function threeStageTextPixelWidth(value: string, fontSize = 14): number {
  const scale = fontSize / 14;
  return Array.from(value).reduce((width, character) => {
    if (character === "\t") return width + 28 * scale;
    if (character === " ") return width + 4 * scale;
    return width + (isWideCodePoint(character.codePointAt(0) ?? 0) ? 14 : 7) * scale;
  }, 0);
}

function wrapText(value: string, maxWidth = TEXT_PIXEL_WIDTH, fontSize = 14): string[] {
  const source = value.replace(/\r\n?/g, "\n");
  return source.split("\n").flatMap(line => {
    if (line.length === 0) return [""];
    const lines: string[] = [];
    let current = "";
    let width = 0;
    for (const character of Array.from(line)) {
      const nextWidth = threeStageTextPixelWidth(character, fontSize);
      if (current && width + nextWidth > maxWidth) {
        lines.push(current); current = character; width = nextWidth;
      } else { current += character; width += nextWidth; }
    }
    if (current || !lines.length) lines.push(current);
    return lines;
  });
}

function isPngDataUrl(value: unknown): value is string {
  if (typeof value !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)) return false;
  try {
    const bytes = Uint8Array.from(atob(value.slice(value.indexOf(",") + 1)), character => character.charCodeAt(0));
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  } catch { return false; }
}

function acceptedBundle(document: RecallDocument, bundle: RecallRetainedBundle): boolean {
  return bundle.documentRevision > 0 && document.snapshots.some(snapshot => snapshot.id === bundle.snapshotId && snapshot.retainedBundleId === bundle.id);
}

function selectedBundle(document: RecallDocument): RecallRetainedBundle | null {
  const candidates = (document.retainedBundles ?? []).filter(bundle => acceptedBundle(document, bundle));
  // A first/global bundle may be an early capture with no financial fills. Choose
  // only accepted immutable evidence and prefer the bundle with the fullest fill set.
  candidates.sort((left, right) => {
    const executions = right.executionEvidence.payload.executions.length - left.executionEvidence.payload.executions.length;
    if (executions) return executions;
    const revisions = right.documentRevision - left.documentRevision;
    if (revisions) return revisions;
    const rightGlobal = document.snapshots.find(snapshot => snapshot.id === right.snapshotId)?.decisionId === "global";
    const leftGlobal = document.snapshots.find(snapshot => snapshot.id === left.snapshotId)?.decisionId === "global";
    if (rightGlobal !== leftGlobal) return Number(rightGlobal) - Number(leftGlobal);
    return right.retainedAt.localeCompare(left.retainedAt) || right.id.localeCompare(left.id);
  });
  return candidates[0] ?? null;
}

function phaseFromDrawingStage(value: unknown): RecallPhase | undefined {
  if (value === "pre-trade") return "pre-entry";
  if (value === "during-replay") return "holding";
  if (value === "post-review") return "post-review";
  return undefined;
}

function phaseLabel(phase: RecallPhase | undefined): string {
  return phase ? STORYBOARD_PHASE_LABELS[phase] : "未提供";
}

function compactDateTime(value: string): string | null {
  const display = formatBeijingDateTime(value);
  const match = display.match(/^(\d{4})年(\d{2})月(\d{2})日 (\d{2}:\d{2})(?::\d{2})?$/);
  return match ? `${match[1]}年${match[2]}月${match[3]}日 ${match[4]}` : null;
}

/** Human-facing export label; raw timestamps remain in the manifest and index. */
export function formatThreeStageDisplayDate(value: string): string {
  return compactDateTime(value) ?? "时间未知";
}

function compactMarketCutoff(value: string): string {
  return formatThreeStageDisplayDate(value) === "时间未知" ? "来源未提供" : formatThreeStageDisplayDate(value);
}

function compactAnchorTime(value: string | undefined): string {
  if (!value) return "时间未提供";
  const display = formatThreeStageDisplayDate(value);
  const match = display.match(/^(\d{4})年(\d{2})月(\d{2})日 (\d{2}:\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}` : "时间未提供";
}

function executionCutoffLabel(value: string, bundle: RecallRetainedBundle | null): string {
  if (value === "__recall_before_first_execution__") return "首笔成交前";
  const execution = bundle?.executionEvidence.payload.executions.find(item => item.id === value);
  if (!execution) return "来源未提供";
  const side = execution.side === "buy" ? "买入" : "卖出";
  const executedAt = formatThreeStageDisplayDate(execution.executedAt);
  return `${side}${execution.quantity}股·${executedAt === "时间未知" ? "时间未提供" : executedAt}`;
}

function formingTextLabel(phase: RecallPhase | undefined): string {
  return phase ? phaseLabel(phase) : "形成阶段未提供";
}

function futureTextLabel(value: boolean | undefined): string {
  return value === undefined ? "未提供" : value ? "是" : "否";
}

function bodyRole(phase: RecallPhase | undefined): string {
  if (phase === "pre-entry") return "原判断";
  if (phase === "holding") return "当前补充";
  if (phase === "post-review") return "最终结论";
  return "复盘补记";
}

function snapshotTexts(snapshot: RecallSnapshot, phase: RecallPhase): ThreeStageText[] {
  const bindings = validDerivedCapture(snapshot) ? snapshot.derivedCapture.textSourceBindings : undefined;
  return snapshot.drawings.flatMap(drawing => {
    if (drawing.tool !== "text" || typeof drawing.text !== "string") return [];
    const revision = drawing.textRevision === undefined ? `legacy:${drawing.id}` : String(drawing.textRevision);
    const sourceKey = `${snapshot.id}:${drawing.id}:${revision}`;
    const binding = bindings?.find(item => item.sourceKey === sourceKey);
    return [{
      key: sourceKey, drawingId: drawing.id, phase,
      sourceSnapshotId: snapshot.id, revision, ownerId: drawing.recallOwnerId?.trim() || snapshot.decisionId,
      text: drawing.text, lines: wrapText(drawing.text),
      // Unknown/raw stage remains unknown; a retrospective export cannot infer post-review.
      formingPhase: phaseFromDrawingStage((drawing as { stage?: unknown }).stage),
      hasSeenFuture: drawing.recallHasSeenFuture, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor,
      ...(binding ? { sourceNumber: binding.sourceNumber, anchorTime: binding.anchorTime, anchorPrice: binding.anchorPrice, anchorStatus: binding.status } : {}),
    }];
  });
}

function recordWarning(code: ThreeStageWarningCode): string {
  return {
    "missing-phase": "该阶段尚无已留存快照，未借用其他阶段图片",
    "missing-image": "该阶段没有已保存 PNG，保留明确占位",
    "invalid-image": "该阶段保存的图片不是可验证 PNG，未伪造导出图片",
    "missing-viewport": "该阶段未保存观察窗口，保留原图且无法核对视野",
    "price-scale-unverified": "未保存明确价格轴范围，保留原图，不保证价格轴一致",
    "content-overflow": "固定 1440×810 画布无法容纳全部文字或成交记录，已阻止完整 PNG 成功",
    "missing-bundle": "缺少已接受留存版本组合，未使用当前草稿或回合数据填补",
    "derived-fallback": "派生 PNG 缺少有效来源绑定，已回退 canonical PNG；本阶段不声明 CB27 视觉通过",
  }[code];
}

function validDerivedCapture(snapshot: RecallSnapshot): snapshot is RecallSnapshot & { derivedCapture: RecallDerivedCapture } {
  const derived = snapshot.derivedCapture;
  if (!derived || typeof snapshot.imageDataUrl !== "string" || derived.version !== 1 || !isPngDataUrl(derived.imageDataUrl)) return false;
  const frame = derived.imageFrame;
  if (!frame || typeof frame !== "object" || frame.version !== 1 || frame.width !== 432 || frame.height !== 280 || frame.pixelRatio !== 2) return false;
  if (!RECALL_DERIVED_CAPTURE_RENDERERS.includes(derived.rendererVersion as typeof RECALL_DERIVED_CAPTURE_RENDERERS[number]) || derived.textOverlayPolicy !== "body-only") return false;
  const dimensions = pngDimensions(derived.imageDataUrl);
  if (!dimensions || dimensions.width !== 864 || dimensions.height !== 560) return false;
  if (!/^[0-9a-f]{64}$/.test(derived.sourceCanonicalDigest) || derived.sourceCanonicalDigest !== sha256(snapshot.imageDataUrl)) return false;
  const visibleTextKeys = snapshot.drawings
    .filter(drawing => !drawing.hidden && drawing.tool === "text" && typeof drawing.text === "string")
    .map(drawing => `${snapshot.id}:${drawing.id}:${drawing.textRevision === undefined ? `legacy:${drawing.id}` : drawing.textRevision}`);
  if (!Array.isArray(derived.textSourceKeys) || derived.textSourceKeys.some(key => typeof key !== "string" || key.trim().length === 0) || derived.textSourceKeys.length !== visibleTextKeys.length || derived.textSourceKeys.some(key => !visibleTextKeys.includes(key))) return false;
  if (!Array.isArray(derived.textSourceBindings)) return false;
  const keys = new Set(derived.textSourceKeys);
  const bindingKeys = new Set(derived.textSourceBindings.map(binding => binding?.sourceKey));
  if (derived.textSourceBindings.length !== keys.size || bindingKeys.size !== keys.size || derived.textSourceBindings.some(binding => {
    if (!binding || typeof binding.sourceKey !== "string" || !keys.has(binding.sourceKey) || typeof binding.drawingId !== "string") return true;
    const drawing = snapshot.drawings.find(candidate => candidate.id === binding.drawingId && !candidate.hidden && candidate.tool === "text" && typeof candidate.text === "string");
    if (!drawing) return true;
    const expectedKey = `${snapshot.id}:${drawing.id}:${drawing.textRevision === undefined ? `legacy:${drawing.id}` : drawing.textRevision}`;
    if (expectedKey !== binding.sourceKey) return true;
    const anchor = drawing.anchors?.[0];
    if (drawing.placement === "canvas" && binding.status !== "canvas-position") return true;
    if (drawing.placement !== "canvas" && !anchor && binding.status !== "missing-anchor") return true;
    if (anchor && binding.status !== "canvas-position" && binding.status !== "missing-anchor" && (binding.anchorTime !== anchor.time || binding.anchorPrice !== anchor.price)) return true;
    if (!Number.isInteger(binding.sourceNumber) || binding.sourceNumber < 1 || binding.sourceNumber > keys.size) return true;
    if (!["visible-anchor", "off-range", "canvas-position", "missing-anchor"].includes(binding.status)) return true;
    return binding.anchorTime !== undefined && typeof binding.anchorTime !== "string" || binding.anchorPrice !== undefined && !Number.isFinite(binding.anchorPrice);
  }) || new Set(derived.textSourceBindings.map(binding => binding.sourceNumber)).size !== derived.textSourceBindings.length) return false;
  return Array.isArray(derived.warnings) && derived.warnings.every(warning => typeof warning === "string");
}

function stageContentRows(snapshot: RecallSnapshot | null, phase: RecallPhase, revision: number, bundle: RecallRetainedBundle | null, texts: readonly ThreeStageText[], warnings: readonly string[]): ThreeStageContentRow[] {
  const rows: ThreeStageContentRow[] = [];
  const meta = (text: string) => rows.push({ kind: "meta", text, lines: wrapText(text, TEXT_PIXEL_WIDTH, 12) });
  if (!snapshot) {
    rows.push({ kind: "meta", placement: "before-image", text: `未留存快照 · ${STORYBOARD_PHASE_LABELS[phase]}`, lines: wrapText(`未留存快照 · ${STORYBOARD_PHASE_LABELS[phase]}`, TEXT_PIXEL_WIDTH, 12) });
    meta(`文档修订：${revision}`);
  } else {
    // Long immutable IDs stay in the manifest/index and dialog. The fixed PNG
    // body keeps only a short, timezone-normalized cutoff before the chart.
    const marketCutoff = `行情截止 ${compactMarketCutoff(snapshot.cursor)}`;
    const executionCutoff = `成交截止 ${executionCutoffLabel(snapshot.executionCursor, bundle)}`;
    rows.push({ kind: "meta", placement: "before-image", text: marketCutoff, lines: wrapText(marketCutoff, TEXT_PIXEL_WIDTH, 12) });
    rows.push({ kind: "meta", placement: "before-image", text: executionCutoff, lines: wrapText(executionCutoff, TEXT_PIXEL_WIDTH, 12) });
  }
  for (const text of texts) {
    // Keep each saved judgment complete at the locked 14px/21px body size.
    // Source evidence gets its own compact 12px row so long Chinese judgments
    // do not lose text or silently wrap an anchor into an unreadable suffix.
    const displayText = `${formingTextLabel(text.formingPhase)}：${text.text}`;
    rows.push({ kind: "text", text: displayText, lines: wrapText(displayText), textKey: text.key });
    const sourceMetadata = text.anchorStatus === "visible-anchor"
      ? `来源${text.sourceNumber ?? "未提供"} · 锚点${compactAnchorTime(text.anchorTime)} / ${text.anchorPrice ?? "价格未提供"}`
      : text.anchorStatus === "off-range"
        ? `来源未显示 · 锚点在当前图窗外：${compactAnchorTime(text.anchorTime)} / ${text.anchorPrice ?? "价格未提供"}`
        : text.anchorStatus === "canvas-position"
          ? "来源未显示 · 画布定位，无价格锚点"
          : text.anchorStatus === "missing-anchor"
            ? "来源未显示 · 锚点未提供"
            : null;
    if (sourceMetadata) rows.push({ kind: "meta", text: sourceMetadata, lines: wrapText(sourceMetadata, TEXT_PIXEL_WIDTH, 12), textKey: text.key });
  }
  const status = texts.length > 0
    ? `正文角色：${texts.map(text => `${bodyRole(text.formingPhase)}·后续${futureTextLabel(text.hasSeenFuture)}`).join("；")}`
    : `正文角色：${bodyRole(phase)}·后续${futureTextLabel(snapshot?.hasSeenFuture)}`;
  meta(status);
  for (const warning of warnings) {
    const beforeImage = warning.includes("派生 PNG 缺少有效来源绑定");
    rows.push({ kind: "warning", ...(beforeImage ? { placement: "before-image" as const } : {}), text: warning, lines: wrapText(warning, TEXT_PIXEL_WIDTH, 12) });
  }
  return rows;
}

function contentPixelHeight(rows: readonly ThreeStageContentRow[]): number {
  return rows.filter(row => row.placement !== "before-image").reduce((height, row) => height + row.lines.length * (row.kind === "text" ? THREE_STAGE_LAYOUT.textLineHeight : THREE_STAGE_LAYOUT.metaLineHeight), 0);
}

function metricSummary(bundle: RecallRetainedBundle | null): ThreeStageMetric[] {
  if (!bundle?.actualMetrics) return [];
  const labels: Record<string, string> = { netPnl: "实际净盈亏", realizedNet: "已实现净盈亏", unrealizedGross: "持仓浮动盈亏", totalFees: "总手续费", actualR: "实际 R", remainingQuantity: "剩余数量" };
  return Object.entries(bundle.actualMetrics.metrics).filter(([key]) => key in labels).map(([key, metric]) => ({ key, label: labels[key], value: metric.value, reason: metric.reason, currency: metric.currency, unit: metric.unit }));
}

function capitalSources(plans: readonly RecallPlanVersion[]): ThreeStageCapitalSource[] {
  return plans.flatMap(plan => plan.input.capital ? [{ planVersionId: plan.id, amount: plan.input.capital.amount, currency: plan.input.capital.currency, asOf: plan.input.capital.asOf, source: plan.input.capital.source, snapshotRef: plan.input.capital.snapshotRef ?? null }] : []);
}

export function createThreeStageExportManifest(input: RecallDocument, options: ManifestOptions = {}): ThreeStageExportManifest {
  const selected = selectRecallExportDocument(input, options.source);
  // This clone is the synchronous freeze seam. No live document/episode/chart is read afterwards.
  const document = structuredClone(selected.document);
  if (options.instrument && options.instrument.episodeId !== document.episodeId) {
    throw new RecallExportError("导出 episode 与 instrument 来源不一致");
  }
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) throw new RecallExportError("导出时间无效");
  const previews = getRecallStoryboard(document);
  const sourceBundle = selectedBundle(document);
  const retainedInstrument = sourceBundle?.executionEvidence.payload.episode.instrument;
  if (options.instrument && retainedInstrument) {
    const supplied = options.instrument;
    const mismatched = ["symbol", "market", "currency"].some(key => {
      const suppliedValue = supplied[key as "symbol" | "market" | "currency"].trim();
      const retainedValue = retainedInstrument[key as "symbol" | "market" | "currency"].trim();
      return suppliedValue !== retainedValue;
    });
    if (mismatched) throw new RecallExportError("导出 instrument 与 retained evidence 不一致");
  }
  const stages = previews.map(({ phase, snapshot, reasons }) => {
    const warningCodes: ThreeStageWarningCode[] = [];
    const canonicalImageDataUrl = snapshot && isPngDataUrl(snapshot.imageDataUrl) ? snapshot.imageDataUrl : null;
    const derivedCapture = snapshot && validDerivedCapture(snapshot) ? snapshot.derivedCapture : undefined;
    if (!snapshot) warningCodes.push("missing-phase");
    else {
      if (!snapshot.viewport) warningCodes.push("missing-viewport");
      if (!snapshot.viewport?.priceRange || !snapshot.viewport?.priceScaleOptions) warningCodes.push("price-scale-unverified");
      if (!snapshot.imageDataUrl) warningCodes.push("missing-image");
      else if (!isPngDataUrl(snapshot.imageDataUrl)) warningCodes.push("invalid-image");
      if (!snapshot.derivedCapture || !derivedCapture) warningCodes.push("derived-fallback");
    }
    for (const reason of reasons) {
      if (reason === "missing-phase" || reason === "missing-global-bundle") continue;
      const mapped = reason as ThreeStageWarningCode;
      if (["missing-viewport", "price-scale-unverified"].includes(mapped) && !warningCodes.includes(mapped)) warningCodes.push(mapped);
    }
    const texts = snapshot ? snapshotTexts(snapshot, phase) : [];
    const warnings = warningCodes.map(recordWarning);
    const contentRows = stageContentRows(snapshot, phase, document.revision, sourceBundle, texts, warnings);
    const stageHeight = contentPixelHeight(contentRows);
    const preImageHeight = contentRows.filter(row => row.placement === "before-image").reduce((height, row) => height + row.lines.length * THREE_STAGE_LAYOUT.metaLineHeight, 0);
    if (stageHeight > threeStageContentPixelBudget() || preImageHeight > threeStagePreImagePixelBudget()) warningCodes.push("content-overflow");
    const stageWarnings = warningCodes.map(recordWarning);
    return {
      phase, title: STORYBOARD_PHASE_LABELS[phase], snapshotId: snapshot?.id ?? null,
      imageDataUrl: derivedCapture?.imageDataUrl ?? canonicalImageDataUrl,
      canonicalImageDataUrl,
      ...(derivedCapture ? { derivedCapture } : {}),
      viewport: snapshot?.viewport ?? null, marketCutoff: snapshot?.cursor ?? null,
      executionCutoff: snapshot?.executionCursor ?? null, snapshotDocumentRevision: document.revision,
      hasSeenFuture: snapshot?.hasSeenFuture, texts, contentRows,
      contentPixelHeight: stageHeight,
      contentPixelBudget: threeStageContentPixelBudget(),
      warningCodes, warnings: stageWarnings,
    };
  });
  const allTexts = stages.flatMap(stage => stage.texts);
  const executions: ThreeStageExecution[] = sourceBundle?.executionEvidence.payload.executions.map(execution => ({
    id: execution.id, executedAt: execution.executedAt, side: execution.side, quantity: execution.quantity,
    price: execution.price, fee: execution.fee, currency: execution.instrument.currency,
    sourceBundleId: sourceBundle.id, sourceDocumentRevision: sourceBundle.documentRevision, sourceDigest: sourceBundle.executionEvidence.digest,
  })) ?? [];
  const plans = sourceBundle ? (document.plans?.versions ?? []).filter(plan => sourceBundle.planVersionIds.includes(plan.id)) : [];
  const exitEvaluations = sourceBundle ? (document.exitEvaluations?.versions ?? []).filter(evaluation => sourceBundle.evaluationRevisionIds?.includes(evaluation.id)) : [];
  const allPlans = document.plans?.versions ?? [];
  const allEvaluations = document.exitEvaluations?.versions ?? [];
  const allManualEvaluations = document.manualEvaluations?.versions ?? [];
  const allRiskBaselines = document.plans?.riskBaselines ?? [];
  const allPlanAssociations = document.planAssociations ?? [];
  const allBundles = document.retainedBundles ?? [];
  const allBundleExecutions = allBundles.flatMap(bundle => bundle.executionEvidence.payload.executions.map(execution => ({ bundle, execution })));
  const selectedBundleId = sourceBundle?.id ?? null;
  const recordIndex: ThreeStageRecordIndexEntry[] = [
    ...document.snapshots.map(snapshot => ({ kind: "snapshot" as const, id: snapshot.id, phase: snapshot.phase, retained: true, selected: stages.some(stage => stage.snapshotId === snapshot.id), imageSaved: isPngDataUrl(snapshot.imageDataUrl), details: [`快照：${snapshot.id}`, `形成阶段：${phaseLabel(snapshot.phase)}`, `文档修订：${document.revision}`, `行情截止：${snapshot.cursor}`, `成交截止：${snapshot.executionCursor}`] })),
    ...allBundles.map(bundle => ({ kind: "bundle" as const, id: bundle.id, snapshotId: bundle.snapshotId, bundleId: bundle.id, retained: acceptedBundle(document, bundle), selected: bundle.id === selectedBundleId, details: [`快照：${bundle.snapshotId}`, `文档修订：${bundle.documentRevision}`, `留存于：${bundle.retainedAt}`, `证据摘要：${bundle.executionEvidence.digest}`] })),
    ...allBundleExecutions.map(({ bundle, execution }) => ({ kind: "execution" as const, id: execution.id, snapshotId: bundle.snapshotId, bundleId: bundle.id, retained: acceptedBundle(document, bundle), selected: bundle.id === selectedBundleId, details: [`来源组合：${bundle.id}`, `文档修订：${bundle.documentRevision}`, `成交时间：${execution.executedAt}`, `来源摘要：${bundle.executionEvidence.digest}`] })),
    ...allPlans.map(plan => ({ kind: "plan" as const, id: plan.id, bundleId: sourceBundle?.planVersionIds.includes(plan.id) ? sourceBundle.id : undefined, retained: true, selected: plans.some(selectedPlan => selectedPlan.id === plan.id), details: [`版本：${plan.id}`, `形成阶段：${phaseLabel(plan.recordedPhase)}`, `来源：${plan.source}`, `行情截止：${plan.knowledgeCutoff.cursor}`, `成交截止：${plan.knowledgeCutoff.executionCursor}`] })),
    ...allEvaluations.map(evaluation => ({ kind: "evaluation" as const, id: evaluation.id, bundleId: sourceBundle?.evaluationRevisionIds?.includes(evaluation.id) ? sourceBundle.id : undefined, retained: true, selected: exitEvaluations.some(selectedEvaluation => selectedEvaluation.id === evaluation.id), details: [`修订：${evaluation.id}`, `形成阶段：${phaseLabel(evaluation.recordedPhase)}`, `来源：${evaluation.source}`, `原因：${evaluation.reason ?? "未提供"}`, `理由：${evaluation.reasonDetail ?? "未提供"}`] })),
    ...allManualEvaluations.map(evaluation => ({ kind: "manual-evaluation" as const, id: evaluation.id, bundleId: sourceBundle?.manualEvaluationRevisionIds?.includes(evaluation.id) ? sourceBundle.id : undefined, retained: true, selected: sourceBundle?.manualEvaluationRevisionIds?.includes(evaluation.id) ?? false, details: [`修订：${evaluation.id}`, `形成阶段：${phaseLabel(evaluation.recordedPhase)}`, `来源：${evaluation.source}`, `标签：${evaluation.tags.join("、") || "未提供"}`, `行情截止：${evaluation.knowledgeCutoff.cursor}`, `成交截止：${evaluation.knowledgeCutoff.executionCursor}`] })),
    ...allRiskBaselines.map(baseline => ({ kind: "risk-baseline" as const, id: baseline.id, bundleId: sourceBundle?.riskBaselineIds.includes(baseline.id) ? sourceBundle.id : undefined, retained: true, selected: sourceBundle?.riskBaselineIds.includes(baseline.id) ?? false, details: [`计划版本：${baseline.planVersionId}`, `金额：${baseline.amount} ${baseline.currency}`, `方法：${baseline.method}`, `冻结于：${baseline.frozenAt}`] })),
    ...allPlanAssociations.map((association, index) => {
      const id = `association:${association.planId}:${association.decisionId ?? "episode"}:${index}`;
      const selectedAssociation = association.status === "linked" && Boolean(sourceBundle?.planVersionIds.includes(association.planId));
      return { kind: "plan-association" as const, id, bundleId: selectedAssociation ? sourceBundle?.id : undefined, retained: true, selected: selectedAssociation, status: association.status, details: [`计划版本：${association.planId}`, `决策：${association.decisionId ?? "全局"}`, `状态：${association.status === "linked" ? "已关联" : "待确认"}`, `成交：${association.executionIds?.join("、") || "未提供"}`] };
    }),
  ];
  const warningCodes = [...new Set<ThreeStageWarningCode>([
    ...stages.flatMap(stage => stage.warningCodes), ...(sourceBundle ? [] : ["missing-bundle" as ThreeStageWarningCode]),
    ...(stages.some(stage => stage.contentPixelHeight > stage.contentPixelBudget) || executions.length > MAX_EXECUTION_ROWS ? ["content-overflow" as ThreeStageWarningCode] : []),
  ])];
  const warnings = [...new Set(warningCodes.map(recordWarning))];
  const suppliedInstrument = options.instrument;
  const symbol = suppliedInstrument?.symbol.trim() || retainedInstrument?.symbol || "未提供";
  const name = suppliedInstrument?.name.trim() || "未提供";
  const market = suppliedInstrument?.market.trim() || retainedInstrument?.market || "未提供";
  const currency = suppliedInstrument?.currency.trim() || retainedInstrument?.currency || "未提供";
  const financial: ThreeStageFinancialSummary = {
    bundleId: sourceBundle?.id ?? null, bundleSnapshotId: sourceBundle?.snapshotId ?? null,
    bundleDocumentRevision: sourceBundle?.documentRevision ?? null, retainedAt: sourceBundle?.retainedAt ?? null,
    evidenceDigest: sourceBundle?.executionEvidence.digest ?? null, metrics: metricSummary(sourceBundle),
    capitalSources: capitalSources(plans), executionIds: executions.map(execution => execution.id),
  };
  const sourceIdentity: ThreeStageSourceIdentity = {
    source: selected.source, episodeId: document.episodeId, documentRevision: document.revision,
    status: document.status, updatedAt: document.updatedAt, completedAt: document.completedAt ?? null,
    selectedBundleId: sourceBundle?.id ?? null, selectedBundleSnapshotId: sourceBundle?.snapshotId ?? null,
    selectedBundleDocumentRevision: sourceBundle?.documentRevision ?? null, selectedBundleRetainedAt: sourceBundle?.retainedAt ?? null,
    selectedBundleEvidenceDigest: sourceBundle?.executionEvidence.digest ?? null,
  };
  const safeName = `${symbol}_${selected.source === "completed" ? "正式" : "草稿"}_${generatedAt.slice(0, 10)}`.replace(/[<>:"/\\|?*]/g, "_");
  return freeze({
    version: 2, source: selected.source, episodeId: document.episodeId, documentRevision: document.revision,
    generatedAt, fileName: `${safeName}.png`, frame: THREE_STAGE_EXPORT_FRAME, instrument: { symbol, name, market, currency },
    sourceIdentity, stages, texts: allTexts, executions, acceptedBundleId: sourceBundle?.id ?? null,
    plans, exitEvaluations, financial, allRecordIndex: recordIndex, warningCodes, warnings,
    contentOverflow: warningCodes.includes("content-overflow"),
  });
}

export { isPngDataUrl as hasValidSavedPng, wrapText as wrapThreeStageText, MAX_STAGE_TEXT_LINES, MAX_EXECUTION_ROWS };
