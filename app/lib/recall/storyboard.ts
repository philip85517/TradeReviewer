import { cloneRecallDocument, RecallValidationError } from "./document";
import type { RecallDocument, RecallPhase, RecallSnapshot } from "./types";

export const STORYBOARD_PHASES: readonly RecallPhase[] = ["pre-entry", "holding", "post-review"];
export const STORYBOARD_PHASE_LABELS: Record<RecallPhase, string> = {
  "pre-entry": "入场前判断", holding: "持仓过程", "post-review": "事后复盘",
};
export type StoryboardReason = "missing-phase" | "stale-reference" | "phase-mismatch" |
  "unresolved-owner" | "missing-viewport" | "timeframe-difference" | "time-window-difference" |
  "composition-difference" | "price-scale-unverified" | "price-scale-difference" | "missing-global-bundle";
export const STORYBOARD_REASON_LABELS: Record<StoryboardReason, string> = {
  "missing-phase": "该阶段尚无已留存快照",
  "stale-reference": "所选快照已删除或被替换，请重新选择",
  "phase-mismatch": "所选快照的阶段已改变，请重新选择",
  "unresolved-owner": "快照归属待确认，可能来自拆分或重新导入",
  "missing-viewport": "未保存观察窗口，无法核对同窗",
  "timeframe-difference": "与入场前参考图的周期不同",
  "time-window-difference": "与入场前参考图的时间窗口不同或无法核对",
  "composition-difference": "与入场前参考图的尺寸或构图不同",
  "price-scale-unverified": "未保存明确价格轴范围，保留原图，不保证价格轴一致",
  "price-scale-difference": "与入场前参考图的价格轴范围或刻度方向不同",
  "missing-global-bundle": "缺少已留存全局版本组合，汇总不可用",
};
export type StagePreview = {
  phase: RecallPhase;
  snapshot: RecallSnapshot | null;
  selectedSnapshotId: string | null;
  selection: "explicit" | "default" | "missing";
  reasons: StoryboardReason[];
};

/** Stale references are valid historical pointers and are explicitly flagged by the preview. */
export function validateRecallStoryboard(value: unknown, _snapshots: readonly RecallSnapshot[]): void {
  void _snapshots;
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecallValidationError("storyboard must be an object");
  }
  for (const [phase, reference] of Object.entries(value)) {
    if (!STORYBOARD_PHASES.includes(phase as RecallPhase) || !reference || typeof reference !== "object" || Array.isArray(reference)) {
      throw new RecallValidationError(`storyboard.${phase} must be a known stage reference`);
    }
    const entry = reference as Record<string, unknown>;
    if (Object.keys(entry).some((key) => key !== "snapshotId") || typeof entry.snapshotId !== "string" || !entry.snapshotId.trim()) {
      throw new RecallValidationError(`storyboard.${phase}.snapshotId must be a non-empty string`);
    }
  }
}

export function selectRecallStageSnapshot(document: RecallDocument, phase: RecallPhase, snapshotId: string | null): RecallDocument {
  if (!STORYBOARD_PHASES.includes(phase)) throw new RecallValidationError("unknown storyboard phase");
  if (snapshotId !== null) {
    const snapshot = document.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot || snapshot.phase !== phase) throw new RecallValidationError("storyboard selection requires a retained snapshot with matching known phase");
  }
  const next = cloneRecallDocument(document);
  next.storyboard = { ...next.storyboard };
  if (snapshotId === null) delete next.storyboard[phase];
  else next.storyboard[phase] = { snapshotId };
  next.updatedAt = new Date().toISOString();
  // Selecting presentation evidence is not a completion action and never touches lastCompleted.
  return next;
}

function ownerUnresolved(document: RecallDocument, snapshot: RecallSnapshot): boolean {
  return snapshot.decisionId !== "global" && !document.decisions.some((decision) => decision.id === snapshot.decisionId && decision.executionIds.length > 0);
}

/** Logical coordinates only compare when they address the same retained time grid. */
function sameTimeWindow(a: RecallSnapshot, b: RecallSnapshot): boolean {
  const left = a.viewport?.logicalRange;
  const right = b.viewport?.logicalRange;
  if (!left || !right || left.from !== right.from || left.to !== right.to) return false;
  // A shared visible grid is evidence; equal numerical indices alone are not.
  const start = Math.max(0, Math.floor(left.from));
  // Check the union of retained visible indices, not just their shared prefix.
  // Both-sided empty future space contributes no evidence and is never inferred.
  const end = Math.min(Math.ceil(left.to), Math.max(a.candles.length, b.candles.length) - 1);
  if (end < start) return false;
  for (let i = start; i <= end; i++) if (a.candles[i]?.time !== b.candles[i]?.time) return false;
  return a.candles[0]?.time === b.candles[0]?.time;
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function retainedPriceAxis(snapshot: RecallSnapshot): string | null {
  const range = object(snapshot.viewport?.priceRange);
  const options = object(snapshot.viewport?.priceScaleOptions);
  const margins = object(options?.scaleMargins);
  if (!range || !finite(range.from) || !finite(range.to) || range.from >= range.to || !options || !finite(options.mode) || typeof options.invertScale !== "boolean" || !margins || !finite(margins.top) || !finite(margins.bottom)) return null;
  return JSON.stringify([range.from, range.to, options.mode, options.invertScale, margins.top, margins.bottom]);
}
function retainedImageFrame(snapshot: RecallSnapshot): string | null {
  const frame = object(snapshot.viewport?.imageFrame);
  return frame?.version === 1 && finite(frame.width) && frame.width > 0 && finite(frame.height) && frame.height > 0 && finite(frame.pixelRatio) && frame.pixelRatio > 0
    ? JSON.stringify([frame.version, frame.width, frame.height, frame.pixelRatio]) : null;
}
function comparisonReasons(snapshot: RecallSnapshot, reference?: RecallSnapshot | null): StoryboardReason[] {
  const reasons: StoryboardReason[] = [];
  const axis = retainedPriceAxis(snapshot);
  const referenceAxis = reference ? retainedPriceAxis(reference) : null;
  if (!axis || (reference && !referenceAxis)) reasons.push("price-scale-unverified");
  else if (referenceAxis && axis !== referenceAxis) reasons.push("price-scale-difference");
  if (!snapshot.viewport) reasons.push("missing-viewport");
  if (!reference || reference.id === snapshot.id) return reasons;
  if (snapshot.timeframe !== reference.timeframe) reasons.push("timeframe-difference");
  if (!sameTimeWindow(snapshot, reference)) reasons.push("time-window-difference");
  const a = snapshot.viewport;
  const b = reference.viewport;
  const aFrame = retainedImageFrame(snapshot);
  const bFrame = retainedImageFrame(reference);
  if (aFrame || bFrame) {
    if (aFrame !== bFrame) reasons.push("composition-difference");
  } else if (a && b && (a.width !== b.width || a.height !== b.height || a.barSpacing !== b.barSpacing || a.rightOffset !== b.rightOffset)) reasons.push("composition-difference");
  return reasons;
}
function defaultSnapshot(document: RecallDocument, phase: RecallPhase, reference?: RecallSnapshot | null): RecallSnapshot | null {
  const candidates = document.snapshots.filter((snapshot) => snapshot.phase === phase);
  candidates.sort((a, b) => {
    const unresolved = Number(ownerUnresolved(document, a)) - Number(ownerUnresolved(document, b));
    if (unresolved) return unresolved;
    if (phase === "post-review" && (a.decisionId === "global") !== (b.decisionId === "global")) return a.decisionId === "global" ? -1 : 1;
    if (reference) {
      const difference = comparisonReasons(a, reference).length - comparisonReasons(b, reference).length;
      if (difference) return difference;
    }
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  return candidates[0] ?? null;
}

/** Reads retained evidence only; no current drawings, prices, plans or future extrema. */
export function getRecallStoryboard(document: RecallDocument): StagePreview[] {
  let reference: RecallSnapshot | null = null;
  return STORYBOARD_PHASES.map((phase) => {
    const selected = document.storyboard?.[phase]?.snapshotId;
    const candidate = selected ? document.snapshots.find((snapshot) => snapshot.id === selected) ?? null : defaultSnapshot(document, phase, reference);
    const reasons: StoryboardReason[] = [];
    let snapshot = candidate;
    if (selected && !candidate) reasons.push("stale-reference");
    if (candidate && candidate.phase !== phase) { snapshot = null; reasons.push("phase-mismatch"); }
    if (!snapshot) reasons.push("missing-phase");
    else {
      if (ownerUnresolved(document, snapshot)) reasons.push("unresolved-owner");
      reasons.push(...comparisonReasons(snapshot, reference));
    }
    if (phase === "pre-entry") reference = snapshot;
    if (phase === "post-review") {
      const global = document.snapshots.find((item) => item.decisionId === "global");
      if (!global?.retainedBundleId || !document.retainedBundles?.some((bundle) => bundle.id === global.retainedBundleId && bundle.snapshotId === global.id)) reasons.push("missing-global-bundle");
    }
    return { phase, snapshot, selectedSnapshotId: selected ?? snapshot?.id ?? null, selection: selected ? "explicit" : snapshot ? "default" : "missing", reasons };
  });
}
