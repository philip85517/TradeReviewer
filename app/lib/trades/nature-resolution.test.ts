import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { displayTradeNature, simulationScope } from "./trading-nature";
import { tradeNatureOf, tradeScopeKey, type TradeExecution } from "./types";
import { parseFutuPdfPages } from "../import/futu-pdf";
import { parseFutuWorkbook } from "../import/futu";
import { parseBrokerStatement } from "../import/dispatcher";
import { legacy, f4 } from "../import/__fixtures__/futu-pdf-layouts";
import { contracts } from "../import/__fixtures__/futu-pdf-contracts";
import { TIGER_PAGES } from "../import/__fixtures__/tiger-pages";
import { CHINA_MERCHANTS_PAGES } from "../import/__fixtures__/china-merchants-pages";

const fill = (source: Partial<TradeExecution["source"]> = {}): TradeExecution => ({
  id: "fill", accountId: "a", accountLabel: "A", instrument: { id: "US:X", symbol: "X", name: "X", market: "US", currency: "USD" },
  side: "buy", executedAt: "2026-01-01T15:00:00Z", quantity: "1", price: "10", fee: "0",
  source: { platform: "futu", row: 1, formatRuleId: "futu/pdf/f1-execution@1", fileFingerprint: "evidence", ...source },
});

describe("evidence-backed business nature without identity migration", () => {
  it.each([
    ["futu", "futu/pdf/f0-contract-date@1"], ["futu", "futu/pdf/f1-execution@1"],
    ["futu", "futu/pdf/f2-order-time@1"], ["futu", "futu/pdf/f3-order-total@1"],
    ["futu", "futu/pdf/f4-cash-detail@1"], ["futu", "futu/xlsx/trades-v1"],
    ["tiger", "tiger/pdf/monthly-v1"], ["china-merchants", "china-merchants/pdf/monthly-v1"],
  ])("resolves supported %s / %s while retaining raw unknown identity", (platform, formatRuleId) => {
    const execution = fill({ platform, formatRuleId });
    expect(displayTradeNature(execution)).toBe("live");
    expect(tradeNatureOf(execution)).toBe("unknown");
    expect(tradeScopeKey(execution)).toBe("unknown");
  });

  it.each([
    { tradeNature: "unknown" as const }, { tradingNature: "unknown" as const },
    { formatRuleId: undefined }, { formatRuleId: "futu/pdf/unknown@1" },
    { platform: "constructor" }, { platform: "toString" },
    { formatRuleId: "futu/pdf/f4a-order-date@1" }, { formatRuleId: "tiger/pdf/monthly-v1" },
    { formatRuleId: "manual/verified-ipo-allotment@1" }, { fileFingerprint: undefined }, { fileFingerprint: "  " },
    { inputKind: "screenshot" as const }, { inputKind: "tradingview" as const },
    { simulationRunId: "run" }, { simulationTradeId: "1" }, { simulationRole: "entry" as const },
    { simulationSignal: "buy" }, { simulationReport: {} }, { sourceReport: {} as TradeExecution["source"]["sourceReport"] },
    { tradeNature: "live" as const, tradingNature: "simulated" as const },
    { tradeNature: "live" as const, simulationRunId: "run" },
  ])("does not promote contradictory or unsupported evidence: %j", source => {
    expect(displayTradeNature(fill(source))).toBe("unknown");
  });

  it("honors explicit nature and retains legacy simulation ordering scope", () => {
    expect(displayTradeNature(fill({ tradeNature: "live", formatRuleId: undefined, fileFingerprint: undefined }))).toBe("live");
    expect(displayTradeNature(fill({ tradeNature: "simulation", simulationRunId: "run" }))).toBe("simulation");
    // sourceTradeId also carries ordinary broker order evidence; it is not a simulation signal.
    expect(displayTradeNature(fill({ sourceTradeId: "broker-order" }))).toBe("live");
    const legacy = fill({ platform: "tradingview", formatRuleId: undefined, fileFingerprint: undefined });
    expect(displayTradeNature(legacy)).toBe("simulation");
    expect(simulationScope(legacy)).toBe("simulation:fill");
    expect(simulationScope(fill({ tradeNature: "live", tradingNature: "simulated", simulationRunId: "run" }))).toBe("");
  });

  it("accepts provenance actually emitted by all supported parser families", async () => {
    const options = { fileName: "fixture.pdf", fileFingerprint: "fixture" };
    const parsed = await Promise.all([TIGER_PAGES, CHINA_MERCHANTS_PAGES].map(pages =>
      parseBrokerStatement(new File([new TextEncoder().encode("%PDF-fixture")], "fixture.pdf"), { extractPdfPages: async () => pages })));
    const records = [
      ...parseFutuPdfPages(contracts(), options).records,
      ...parseFutuPdfPages(legacy("F1"), options).records,
      ...parseFutuPdfPages(legacy("F2"), options).records,
      ...parseFutuPdfPages(legacy("F3"), options).records,
      ...parseFutuPdfPages(f4(), options).records,
      ...parsed.flatMap(result => result.records),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["成交时间", "账户名称", "账户号码", "品类", "代码名称", "交易所/市场", "方向", "交收日期", "币种", "数量/面值", "价格", "成交金额", "总费用", "变动金额"],
      ["2025-03-13 00:38:57", "美股账户", "0855", "证券", "BABA", "US", "买入开仓", "20250313", "USD", "20", "137.65", "-2753", "2.05", "-2755.05"],
    ]), "证券-交易流水");
    records.push(...parseFutuWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" })).records);
    expect(new Set(records.map(record => record.source.formatRuleId)).size).toBe(8);
    for (const record of records) expect(displayTradeNature(record)).toBe("live");
  });
});
