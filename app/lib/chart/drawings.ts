import Decimal from "decimal.js";

import type { Timeframe } from "../market/types";

export type DrawingTool =
  | "cursor"
  | "trend-line"
  | "horizontal-line"
  | "vertical-line"
  | "rectangle"
  | "arrow"
  | "parallel-channel"
  | "fibonacci"
  | "price-label"
  | "text"
  | "measure"
  | "long-risk-reward"
  | "short-risk-reward";

export type DrawingAnchor = {
  time: string;
  price: number;
};

export type CanonicalDrawingTool = Exclude<
  DrawingTool,
  "cursor"
>;

export const DEFAULT_FIBONACCI_LEVELS = [
  0,
  0.236,
  0.382,
  0.5,
  0.618,
  0.786,
  1,
] as const;

export const FIBONACCI_LEVELS = DEFAULT_FIBONACCI_LEVELS;

export type LegacyDrawing = {
  version?: 1 | 2;
  id: string;
  episodeId?: string;
  name?: string;
  tool: CanonicalDrawingTool | "risk-reward";
  anchors: DrawingAnchor[];
  style: {
    color: string;
    lineWidth: number;
    opacity: number;
  };
  text?: string;
  zIndex?: number;
  hidden: boolean;
  locked: boolean;
  visibleOn: "all" | Timeframe[];
  stage: "pre-trade" | "during-replay" | "post-review";
  /**
   * Replay knowledge boundary. Optional only for v1 persisted drawings;
   * every newly committed drawing receives the current cursor.
   */
  createdAtCursor?: string;
  placement?: "canvas" | "anchor";
  canvasX?: number;
  canvasY?: number;
  textWidth?: number;
  fontSize?: 12 | 14 | 16 | 18 | 24 | 32;
  background?: string;
  recallOwnerId?: string;
  textRevision?: number;
};

export type NormalizedDrawing = Omit<
  LegacyDrawing,
  "version" | "episodeId" | "name" | "tool" | "zIndex" | "createdAtCursor"
> & {
  version: 2;
  episodeId: string;
  name: string;
  tool: CanonicalDrawingTool;
  zIndex: number;
  createdAtCursor: string;
  /** Text placement is additive; legacy text is anchored by default. */
  placement?: "canvas" | "anchor";
  /** Normalized canvas coordinates for free text (0..1 where possible). */
  canvasX?: number;
  canvasY?: number;
  /** Text dimensions/styles are CSS values and survive viewport changes. */
  textWidth?: number;
  fontSize?: 12 | 14 | 16 | 18 | 24 | 32;
  background?: string;
  /** Recall metadata is optional so chart callers remain independent. */
  recallOwnerId?: string;
  textRevision?: number;
};

export type RiskRewardInput = {
  direction: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  quantity?: number;
};

export type RiskRewardMetrics = {
  riskPerShare: number;
  rewardPerShare: number;
  riskPercent: number;
  rewardPercent: number;
  ratio: number;
  riskAmount: number;
  rewardAmount: number;
};

function number(value: Decimal) {
  return value.toDecimalPlaces(6).toNumber();
}

const anchorCounts: Record<DrawingTool | "risk-reward", number> = {
  cursor: 0,
  "trend-line": 2,
  "horizontal-line": 1,
  "vertical-line": 1,
  rectangle: 2,
  arrow: 2,
  "parallel-channel": 3,
  fibonacci: 2,
  "price-label": 1,
  text: 1,
  measure: 2,
  "long-risk-reward": 3,
  "short-risk-reward": 3,
  "risk-reward": 3,
};

export function requiredAnchorCount(tool: DrawingTool | "risk-reward") {
  return anchorCounts[tool];
}

function canonicalTool(
  drawing: LegacyDrawing | NormalizedDrawing,
): CanonicalDrawingTool {
  if (drawing.tool !== "risk-reward") return drawing.tool;
  return drawing.anchors[1]?.price < drawing.anchors[0]?.price
    ? "long-risk-reward"
    : "short-risk-reward";
}

export function validateDrawing(
  drawing: LegacyDrawing | NormalizedDrawing,
) {
  const canvasText =
    drawing.tool === "text" && drawing.placement === "canvas";
  if (
    (!canvasText && drawing.anchors.length !== requiredAnchorCount(drawing.tool)) ||
    (canvasText && drawing.anchors.length > 1)
  ) {
    throw new Error(`绘图锚点数量必须为 ${requiredAnchorCount(drawing.tool)}`);
  }
  if (
    drawing.anchors.some(
      (anchor) =>
        !anchor.time ||
        !Number.isFinite(anchor.price),
    )
  ) {
    throw new Error("绘图锚点无效");
  }

  const tool = canonicalTool(drawing);
  if (tool === "long-risk-reward") {
    const [entry, stop, target] = drawing.anchors;
    if (stop.price >= entry.price) {
      throw new Error("做多止损必须低于入场价");
    }
    if (target.price <= entry.price) {
      throw new Error("做多目标必须高于入场价");
    }
  }
  if (tool === "short-risk-reward") {
    const [entry, stop, target] = drawing.anchors;
    if (stop.price <= entry.price) {
      throw new Error("做空止损必须高于入场价");
    }
    if (target.price >= entry.price) {
      throw new Error("做空目标必须低于入场价");
    }
  }
}

export function normalizeDrawing(
  drawing: LegacyDrawing | NormalizedDrawing,
  episodeId: string,
  replayCursor: string,
  zIndex: number,
): NormalizedDrawing {
  const tool = canonicalTool(drawing);
  const normalized: NormalizedDrawing = {
    ...drawing,
    version: 2,
    episodeId,
    name: drawing.name ?? tool,
    tool,
    anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
    style: { ...drawing.style },
    visibleOn:
      drawing.visibleOn === "all" ? "all" : [...drawing.visibleOn],
    zIndex: drawing.version === 2 ? (drawing.zIndex ?? zIndex) : zIndex,
    createdAtCursor: drawing.createdAtCursor ?? replayCursor,
    placement:
      drawing.tool === "text"
        ? (drawing.placement ?? "anchor")
        : drawing.placement,
  };
  validateDrawing(normalized);
  return normalized;
}

export function clampDrawingToCursor(
  drawing: NormalizedDrawing,
  cursor: string,
): NormalizedDrawing {
  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => ({
      ...anchor,
      time: anchor.time > cursor ? cursor : anchor.time,
    })),
    style: { ...drawing.style },
    visibleOn:
      drawing.visibleOn === "all" ? "all" : [...drawing.visibleOn],
    createdAtCursor: drawing.createdAtCursor ?? cursor,
  };
}

export function visibleDrawingsAtCursor(
  drawings: NormalizedDrawing[],
  cursor: string,
  timeframe: Timeframe,
) {
  return drawings.filter((drawing) => {
    const visibleOnTimeframe =
      drawing.visibleOn === "all" ||
      drawing.visibleOn.includes(timeframe);

    return (
      !drawing.hidden &&
      visibleOnTimeframe &&
      drawing.createdAtCursor <= cursor
    );
  });
}

export function calculateRiskReward(
  input: RiskRewardInput,
): RiskRewardMetrics {
  const entry = new Decimal(input.entry);
  const stop = new Decimal(input.stop);
  const target = new Decimal(input.target);
  const quantity = new Decimal(input.quantity ?? 0);
  const validLong = stop.lt(entry) && target.gt(entry);
  const validShort = stop.gt(entry) && target.lt(entry);

  if (
    (input.direction === "long" && !validLong) ||
    (input.direction === "short" && !validShort)
  ) {
    throw new Error("止损、入场和目标价格顺序无效");
  }

  const riskPerShare = stop.minus(entry).abs();
  const rewardPerShare = target.minus(entry).abs();
  const riskPercent = riskPerShare.div(entry).mul(100);
  const rewardPercent = rewardPerShare.div(entry).mul(100);

  return {
    riskPerShare: number(riskPerShare),
    rewardPerShare: number(rewardPerShare),
    riskPercent: number(riskPercent),
    rewardPercent: number(rewardPercent),
    ratio: number(rewardPerShare.div(riskPerShare)),
    riskAmount: number(riskPerShare.mul(quantity)),
    rewardAmount: number(rewardPerShare.mul(quantity)),
  };
}
