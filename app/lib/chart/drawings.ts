import Decimal from "decimal.js";

import type { Timeframe } from "../market/types";

export type DrawingTool =
  | "cursor"
  | "trend-line"
  | "horizontal-line"
  | "price-label"
  | "text"
  | "risk-reward";

export type DrawingAnchor = {
  time: string;
  price: number;
};

export type Drawing = {
  id: string;
  tool: Exclude<DrawingTool, "cursor">;
  anchors: DrawingAnchor[];
  style: {
    color: string;
    lineWidth: number;
    opacity: number;
  };
  text?: string;
  hidden: boolean;
  locked: boolean;
  visibleOn: "all" | Timeframe[];
  stage: "pre-trade" | "during-replay" | "post-review";
  /**
   * Replay knowledge boundary. Optional only for v1 persisted drawings;
   * every newly committed drawing receives the current cursor.
   */
  createdAtCursor?: string;
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

export function clampDrawingToCursor(
  drawing: Drawing,
  cursor: string,
): Drawing {
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
  drawings: Drawing[],
  cursor: string,
  timeframe: Timeframe,
) {
  return drawings.filter((drawing) => {
    const knowledgeTime =
      drawing.createdAtCursor ??
      drawing.anchors.reduce(
        (latest, anchor) => (anchor.time > latest ? anchor.time : latest),
        "",
      );
    const visibleOnTimeframe =
      drawing.visibleOn === "all" ||
      drawing.visibleOn.includes(timeframe);

    return !drawing.hidden && visibleOnTimeframe && knowledgeTime <= cursor;
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
