import { describe, expect, it } from "vitest";
import {
  PLAN_AXIS_COLORS,
  PLAN_AXIS_TEXT_FONT,
  PLAN_AXIS_TEXT_FONT_FAMILY,
  PLAN_AXIS_TEXT_LINE_HEIGHT,
  PLAN_AXIS_TEXT_SIZE,
  layoutPlanAxisLabels,
  planAxisLineOptions,
} from "./plan-axis-labels";

const bounds = {
  plotRight: 300,
  axisRight: 460,
  top: 20,
  bottom: 220,
  lineHeight: 18,
  gap: 4,
};

describe("plan axis label layout", () => {
  it("keeps the semantic line at its true y while moving only a crowded outside label", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "target", price: 68, title: "止盈目标", displayPrice: "68.0000001", trueY: 100 },
        { id: "stop", price: 67.999, title: "初始止损", displayPrice: "67.9990000", trueY: 105 },
      ],
      bounds,
      text => text.length * 7,
    );

    expect(result).toHaveLength(2);
    expect(result[0].connectorY).toBe(100);
    expect(result[1].connectorY).toBe(105);
    expect(result[1].labelY - result[0].labelY).toBeGreaterThanOrEqual(22);
    expect(result[0].rect.x).toBeLessThanOrEqual(bounds.axisRight);
    expect(result[0].neededAxisWidth).toBeGreaterThan(0);
  });

  it("merges exactly equal prices while retaining every source and lexical value", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "entry", price: 56, title: "计划入场", displayPrice: "56.0000", trueY: 120 },
        { id: "cost", price: 56, title: "实际成本", displayPrice: "56.00", trueY: 120 },
      ],
      bounds,
      text => text.length,
    );

    expect(result).toHaveLength(1);
    expect(result[0].sourceIds).toEqual(["entry", "cost"]);
    expect(result[0].text).toContain("计划入场 56.0000");
    expect(result[0].text).toContain("实际成本 56.00");
    expect(result[0].nameText).toBe("计划入场 / 实际成本");
    expect(result[0].valueText).toBe("56.0000 / 56.00");
    expect(result[0].connectorY).toBe(120);
  });

  it("budgets measured name/value columns and an axis gutter instead of a fixed SDK width", () => {
    const result = layoutPlanAxisLabels(
      [{ id: "target", price: 68, title: "止盈目标", displayPrice: "68.0000000000001", trueY: 100 }],
      bounds,
      text => text.length * 10,
    );

    expect(result[0].nameWidth).toBe("止盈目标".length * 10);
    expect(result[0].valueWidth).toBe("68.0000000000001".length * 10);
    expect(result[0].contentWidth).toBeGreaterThan(0);
    expect(result[0].neededAxisWidth).toBeGreaterThan(result[0].contentWidth);
    expect(result[0].neededAxisWidth).toBeGreaterThan(84);
  });

  it("shares the visible name/value columns and right edge across rows", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "entry", price: 56, title: "计划入场", displayPrice: "56.00", trueY: 80 },
        { id: "target", price: 68, title: "非常长的止盈目标", displayPrice: "68.0000000000001", trueY: 160 },
      ],
      bounds,
      text => text.length * 7,
    );

    expect(result.map(label => label.rect.x)).toEqual([result[0].rect.x, result[0].rect.x]);
    expect(result.map(label => label.nameWidth)).toEqual([result[0].nameWidth, result[0].nameWidth]);
    expect(result.map(label => label.valueWidth)).toEqual([result[0].valueWidth, result[0].valueWidth]);
    expect(result.map(label => label.rect.x + label.nameWidth + 8 + label.valueWidth)).toEqual([
      result[0].rect.x + result[0].nameWidth + 8 + result[0].valueWidth,
      result[0].rect.x + result[0].nameWidth + 8 + result[0].valueWidth,
    ]);
  });

  it("moves only outside text away from the native current-price obstacle", () => {
    const result = layoutPlanAxisLabels(
      [{ id: "entry", price: 56, title: "计划入场", displayPrice: "56", trueY: 100 }],
      { ...bounds, obstacleYs: [102] },
      text => text.length * 7,
    );

    expect(result[0].connectorY).toBe(100);
    expect(Math.abs(result[0].labelY - 102)).toBeGreaterThanOrEqual(22);
  });

  it("keeps every final row separated and clear of native obstacles at plot edges", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "top", price: 70, title: "顶部", displayPrice: "70", trueY: 32 },
        { id: "entry", price: 68, title: "计划入场", displayPrice: "68", trueY: 100 },
        { id: "target", price: 67, title: "止盈目标", displayPrice: "67", trueY: 110 },
        { id: "bottom", price: 60, title: "底部", displayPrice: "60", trueY: 208 },
      ],
      { ...bounds, obstacleYs: [32, 102, 208] },
      text => text.length * 7,
    );

    expect(result.map(label => label.connectorY)).toEqual([32, 100, 110, 208]);
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].labelY - result[index - 1].labelY).toBeGreaterThanOrEqual(22);
    }
    for (const label of result) {
      for (const obstacleY of [32, 102, 208]) {
        expect(Math.abs(label.labelY - obstacleY)).toBeGreaterThanOrEqual(22);
      }
    }
  });

  it("keeps a feasible dense cluster on one side of a native current-price label", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "target", price: 70, title: "止盈目标", displayPrice: "70", trueY: 15 },
        { id: "entry", price: 68, title: "计划入场", displayPrice: "68", trueY: 20 },
        { id: "stop", price: 66, title: "初始止损", displayPrice: "66", trueY: 25 },
      ],
      { plotRight: 300, axisRight: 460, top: 0, bottom: 200, lineHeight: 18, gap: 4, obstacleYs: [40] },
      text => text.length * 7,
    );

    expect(result.map(label => label.connectorY)).toEqual([15, 20, 25]);
    expect(result.map(label => label.labelY)).toEqual([15, 62, 84]);
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].labelY - result[index - 1].labelY).toBeGreaterThanOrEqual(22);
    }
    expect(result.every(label => Math.abs(label.labelY - 40) >= 22)).toBe(true);
  });

  it("keeps live hit rows apart without changing the visual row height", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "entry", price: 56, title: "计划入场", displayPrice: "56.0000", trueY: 100 },
        { id: "target", price: 56.01, title: "止盈目标", displayPrice: "56.0100", trueY: 105 },
      ],
      { ...bounds, rowClearance: 36 },
      text => text.length * 7,
    );

    expect(result.map(label => label.connectorY)).toEqual([100, 105]);
    expect(result[1].labelY - result[0].labelY).toBeGreaterThanOrEqual(36);
    expect(result.every(label => label.rect.height === 18)).toBe(true);
  });

  it("keeps every live row clear of native labels across both plot edges", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "top", price: 70, title: "顶部", displayPrice: "70", trueY: 20 },
        { id: "entry", price: 68, title: "计划入场", displayPrice: "68", trueY: 80 },
        { id: "target", price: 67, title: "止盈目标", displayPrice: "67", trueY: 130 },
        { id: "bottom", price: 60, title: "底部", displayPrice: "60", trueY: 220 },
      ],
      { plotRight: 300, axisRight: 460, top: 0, bottom: 260, lineHeight: 18, gap: 4, rowClearance: 36, obstacleYs: [40, 150, 240] },
      text => text.length * 7,
    );

    expect(result.map(label => label.connectorY)).toEqual([20, 80, 130, 220]);
    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].labelY - result[index - 1].labelY).toBeGreaterThanOrEqual(36);
    }
    for (const label of result) {
      for (const obstacleY of [40, 150, 240]) {
        expect(Math.abs(label.labelY - obstacleY)).toBeGreaterThanOrEqual(22);
      }
      expect(label.rect.height).toBe(18);
    }
  });

  it("finds a globally feasible chain when both local directions reject the preferred cluster", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "target", price: 1, title: "止盈目标", displayPrice: "1", trueY: 80 },
        { id: "entry", price: 2, title: "计划入场", displayPrice: "2", trueY: 80 },
        { id: "stop", price: 3, title: "初始止损", displayPrice: "3", trueY: 80 },
      ],
      { plotRight: 800, axisRight: 1000, top: 0, bottom: 100, lineHeight: 18, gap: 4, rowClearance: 36 },
      text => text.length * 7,
    );

    expect(result.map(label => label.labelY)).toEqual([19, 55, 91]);
    expect(result.every(label => label.layoutFeasible)).toBe(true);
  });

  it("marks an impossible bounded layout instead of pretending rows are clear", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "target", price: 1, title: "止盈目标", displayPrice: "1", trueY: 20 },
        { id: "entry", price: 2, title: "计划入场", displayPrice: "2", trueY: 20 },
        { id: "stop", price: 3, title: "初始止损", displayPrice: "3", trueY: 20 },
      ],
      { plotRight: 800, axisRight: 1000, top: 0, bottom: 40, lineHeight: 18, gap: 4, rowClearance: 36 },
      text => text.length * 7,
    );

    expect(result.every(label => !label.layoutFeasible)).toBe(true);
    expect(result.map(label => label.connectorY)).toEqual([20, 20, 20]);
  });

  it("publishes the shared SDK axis text metric", () => {
    expect(PLAN_AXIS_TEXT_SIZE).toBe(12);
    expect(PLAN_AXIS_TEXT_LINE_HEIGHT).toBe(18);
    expect(PLAN_AXIS_TEXT_FONT_FAMILY).toContain("PingFang SC");
    expect(PLAN_AXIS_TEXT_FONT).toContain("400 12px");
  });

  it("does not merge near prices and reports an offscreen source without changing its true connector", () => {
    const result = layoutPlanAxisLabels(
      [
        { id: "entry", price: 56, title: "计划入场", displayPrice: "56", trueY: 10 },
        { id: "target", price: 56.0001, title: "止盈目标", displayPrice: "56.0001", trueY: 250 },
      ],
      bounds,
      text => text.length,
    );

    expect(result).toHaveLength(2);
    expect(result.map(item => item.offscreen)).toEqual([true, true]);
    expect(result.map(item => item.connectorY)).toEqual([10, 250]);
    expect(result[0].sourceIds).toEqual(["entry"]);
    expect(result[1].sourceIds).toEqual(["target"]);
  });

  it("uses role colors for SDK lines and disables in-plot title and axis labels", () => {
    expect(planAxisLineOptions({ id: "entry", price: 56, title: "计划入场" })).toMatchObject({
      price: 56,
      title: "",
      color: PLAN_AXIS_COLORS.entry,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
    });
    expect(planAxisLineOptions({ id: "stop", price: 52, title: "初始止损" }).color).toBe(PLAN_AXIS_COLORS.stop);
    expect(planAxisLineOptions({ id: "target", price: 68, title: "止盈目标" }).color).toBe(PLAN_AXIS_COLORS.target);
  });
});
