import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseFutuWorkbook } from "./futu";

const headers = [
  "成交时间",
  "账户名称",
  "账户号码",
  "品类",
  "代码名称",
  "交易所/市场",
  "方向",
  "交收日期",
  "币种",
  "数量/面值",
  "价格",
  "成交金额",
  "总费用",
  "变动金额",
];

function workbookBuffer(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, sheet, "证券-交易流水");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

function missingTradeSheetBuffer() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["其他数据"], ["无成交"]]),
    "账户信息",
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("parseFutuWorkbook", () => {
  it("imports securities trades and reports skipped fund activity", () => {
    const result = parseFutuWorkbook(
      workbookBuffer([
        [
          "2025-03-13 00:38:57",
          "美股孖展账户(0855)",
          "1001100200280855",
          "证券",
          "BABA",
          "US",
          "买入开仓",
          "20250313",
          "USD",
          "20.00000000",
          "137.65000000",
          "-2753.00000000",
          "2.05000000",
          "-2755.05000000",
        ],
        [
          "2025-04-10 14:20:00",
          "美股孖展账户(0855)",
          "1001100200280855",
          "证券",
          "BABA",
          "US",
          "卖出平仓",
          "20250410",
          "USD",
          "-20.00000000",
          "145.00000000",
          "2900.00000000",
          "2.05000000",
          "2897.95000000",
        ],
        [
          "2025-04-11 15:00:00",
          "基金账户",
          "1001100900280855",
          "基金",
          "880022",
          "FD",
          "赎回",
          "-",
          "USD",
          "-8.12777900",
          "11.33309000",
          "92.11285091",
          "0",
          "92.11285091",
        ],
      ]),
      { sourceTimezone: "Asia/Shanghai", fileName: "futu-2025.xlsx" },
    );

    expect(result.blocked).toBe(false);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      side: "buy",
      executedAt: "2025-03-12T16:38:57.000Z",
      quantity: "20",
      price: "137.65",
      fee: "2.05",
      accountLabel: "美股孖展账户(0855) · 0855",
      instrument: {
        id: "US:BABA",
        symbol: "BABA",
        market: "US",
        currency: "USD",
      },
      source: {
        platform: "futu",
        sheet: "证券-交易流水",
        row: 2,
        fileName: "futu-2025.xlsx",
        sourceTimestampText: "2025-03-13 00:38:57",
        sourceTimezone: "Asia/Shanghai",
      },
    });
    expect(result.records[1].side).toBe("sell");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unsupported-asset-class",
        row: 4,
      }),
    );
  });

  it("blocks import when the securities trade sheet is missing", () => {
    const result = parseFutuWorkbook(missingTradeSheetBuffer());

    expect(result.blocked).toBe(true);
    expect(result.records).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-trade-sheet" }),
    );
  });

  it("preserves identical fills when they occur on distinct source rows", () => {
    const duplicate = [
      "2025-03-13 00:38:57",
      "美股孖展账户(0855)",
      "1001100200280855",
      "证券",
      "BABA",
      "US",
      "买入开仓",
      "20250313",
      "USD",
      "20",
      "137.65",
      "-2753",
      "2.05",
      "-2755.05",
    ];

    const result = parseFutuWorkbook(workbookBuffer([duplicate, duplicate]));

    expect(result.records).toHaveLength(2);
    expect(result.records[0].id).not.toBe(result.records[1].id);
  });

  it("skips malformed numeric rows with a row-level diagnostic", () => {
    const malformed = [
      "2025-03-13 00:38:57",
      "美股账户",
      "0855",
      "证券",
      "BABA",
      "US",
      "买入开仓",
      "20250313",
      "USD",
      "not-a-number",
      "137.65",
      "-2753",
      "2.05",
      "-2755.05",
    ];

    const result = parseFutuWorkbook(workbookBuffer([malformed]), {
      sourceTimezone: "Asia/Shanghai",
    });

    expect(result.records).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid-numeric-field",
        row: 2,
      }),
    );
  });
});
