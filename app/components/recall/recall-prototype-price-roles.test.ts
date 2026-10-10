import { describe, expect, it } from "vitest";

import { buildRecallPrototypePriceRoles } from "./recall-workspace";

const planPriceLines = [
  { id: "entry", price: 56, title: "计划入场" },
  { id: "stop", price: 52, title: "初始止损" },
  { id: "target", price: 68, title: "止盈目标" },
] as const;

describe("recommended recall price role readout", () => {
  it("keeps S0 actual cost hidden while retaining the complete plan roles", () => {
    const roles = buildRecallPrototypePriceRoles({
      mode: "recommended",
      phase: "pre-entry",
      planPriceLines,
      position: { quantity: "1000", averageCost: "56" },
      pnlAvailable: true,
      quantityAvailable: true,
      currency: "CNY",
    });

    expect(roles.map((role) => role.text)).toEqual([
      "计划入场 56.00",
      "初始止损 52.00",
      "止盈目标 68.00",
      "实际成交尚未揭示",
    ]);
    expect(roles.some((role) => role.text.includes("实际成本"))).toBe(false);
  });

  it("labels known holding cost separately from the planned entry", () => {
    const roles = buildRecallPrototypePriceRoles({
      mode: "recommended",
      phase: "holding",
      planPriceLines,
      position: { quantity: "1000", averageCost: "56" },
      pnlAvailable: true,
      quantityAvailable: true,
      currency: "CNY",
    });

    expect(roles.map((role) => role.text)).toContain("计划入场 56.00");
    expect(roles.map((role) => role.text)).toContain("实际成本 56.00 CNY");
  });

  it("reports a known post-review zero quantity as cleared", () => {
    const roles = buildRecallPrototypePriceRoles({
      mode: "recommended",
      phase: "post-review",
      planPriceLines,
      position: { quantity: "0", averageCost: "56" },
      pnlAvailable: true,
      quantityAvailable: true,
      currency: "CNY",
    });

    expect(roles.map((role) => role.text)).toContain("实际已清仓 · 持仓 0");
    expect(roles.some((role) => role.text.includes("实际成本"))).toBe(false);
  });

  it("does not add prototype readout nodes for the baseline workspace", () => {
    expect(buildRecallPrototypePriceRoles({
      mode: "baseline",
      phase: "holding",
      planPriceLines,
      position: { quantity: "1000", averageCost: "56" },
      pnlAvailable: true,
      quantityAvailable: true,
      currency: "CNY",
    })).toEqual([]);
  });
});
