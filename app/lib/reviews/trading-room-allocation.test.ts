import { expect, it } from "vitest";
import { buildCurrentPortfolio, type CurrentPortfolioRow } from "./trading-room-portfolio";
import { createDefaultRoomScope } from "./trading-room-scope";
import { buildRoomAllocation } from "./trading-room-allocation";
function portfolio() {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  const row = (market: string, currency: string, value: string | null, assetType = "stock") => ({ holding: { market, marketLabel: market, settlementCurrency: currency, assetType, direction: value?.startsWith("-") ? "short" : "long" }, marketValue: value }) as CurrentPortfolioRow;
  model.rows = [row("US", "USD", "100", "etf"), row("HK", "HKD", "-40"), row("US", "USD", null)];
  return model;
}
it("keeps original currency groups, visible unknown coverage and signed short bars", () => {
  const result = buildRoomAllocation(portfolio(), { dimension: "market", reportCurrency: "original" });
  expect(result.groups).toHaveLength(2);
  expect(result.groups.find(g => g.currency === "USD")?.items[0]).toMatchObject({ amount: "100", percent: null, available: 1, total: 2 });
  expect(result.groups.find(g => g.currency === "HKD")?.items[0]).toMatchObject({ amount: "-40", percent: "-100" });
  expect(result.complete).toBe(false);
});

it("keeps long and short exposure separate while using gross exposure for side percentages", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  const row = (value: string, direction: "long" | "short") => ({
    holding: { market: "US", marketLabel: "美股", settlementCurrency: "USD", assetType: "stock", direction },
    marketValue: value,
  }) as CurrentPortfolioRow;
  model.rows = [row("100", "long"), row("-100", "short")];

  const result = buildRoomAllocation(model, { dimension: "market", reportCurrency: "original" });
  expect(result.groups[0]).toMatchObject({
    currency: "USD",
    signed: true,
    denominator: "200",
    netValue: "0",
  });
  expect(result.groups[0]?.items[0]).toMatchObject({
    amount: "0",
    percent: "0",
    longAmount: "100",
    shortAmount: "-100",
    longPercent: "50",
    shortPercent: "-50",
  });
});

it("does not normalize a partially valued subset to a complete distribution", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  const row = (market: string, value: string | null) => ({
    holding: { market, marketLabel: market, settlementCurrency: "HKD", assetType: "stock", direction: "long" },
    marketValue: value,
  }) as CurrentPortfolioRow;
  model.rows = [row("HK", "100"), row("US", null)];

  const result = buildRoomAllocation(model, { dimension: "market", reportCurrency: "HKD" });
  expect(result.groups[0]?.items.every(item => item.percent === null)).toBe(true);
  expect(result.groups[0]?.note).toContain("缺失");
});
it("merges only complete CNY FX and partitions ETF once", () => {
  const model = portfolio();
  model.rows.pop();
  const fx = { id: "fx", baseCurrency: "CNY" as const, asOf: "2026-09-25", source: "fixture", status: "complete" as const, rates: { "USD/CNY": "7", "HKD/CNY": "1" } };
  const result = buildRoomAllocation(model, { dimension: "assetType", reportCurrency: "CNY", fxSnapshot: fx });
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0].netValue).toBe("660");
  expect(result.groups[0].items.map(i => i.label).sort()).toEqual(["ETF", "股票"]);
  const incomplete = buildRoomAllocation(model, { dimension: "market", reportCurrency: "CNY", fxSnapshot: { ...fx, status: "partial" } });
  expect(incomplete.groups).toHaveLength(1);
  expect(incomplete.groups[0]?.items[0]?.percent).toBeNull();
  expect(incomplete.groups[0]?.note).toContain("汇率");
});
it("merges the same positions into the selected HKD target", () => {
  const model = portfolio();
  model.rows.pop();
  const fx = { id: "fx-hkd", baseCurrency: "CNY" as const, asOf: "2026-09-25", source: "fixture", status: "complete" as const, rates: { "USD/CNY": "7", "HKD/CNY": "1" } };
  const result = buildRoomAllocation(model, { dimension: "market", reportCurrency: "HKD", fxSnapshot: fx });
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0]?.currency).toBe("HKD");
  expect(result.groups[0]?.netValue).toBe("660");
});

it("merges Shanghai and Shenzhen holdings into one A-share market bucket", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  const row = (market: string, label: string, value: string) => ({
    holding: { market, marketLabel: label, settlementCurrency: "CNY", assetType: "stock", direction: "long" },
    marketValue: value,
  }) as CurrentPortfolioRow;
  model.rows = [row("CN-SH", "A股·沪市", "100"), row("CN-SZ", "A股·深市", "200")];
  const result = buildRoomAllocation(model, { dimension: "market", reportCurrency: "original" });
  expect(result.groups[0]?.items).toHaveLength(1);
  expect(result.groups[0]?.items[0]).toMatchObject({ label: "A股", amount: "300" });
});
