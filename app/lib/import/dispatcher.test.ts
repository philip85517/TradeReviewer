import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";

import { CHINA_MERCHANTS_PAGES } from "./__fixtures__/china-merchants-pages";
import { TIGER_PAGES } from "./__fixtures__/tiger-pages";
import { parseBrokerStatement } from "./dispatcher";

const FUTU_HEADERS = [
  "成交时间",
  "账户名称",
  "账户号码",
  "品类",
  "代码名称",
  "交易所/市场",
  "方向",
  "币种",
  "数量/面值",
  "价格",
  "总费用",
];

const TRADINGVIEW_CSV = [
  [
    "交易编号", "类型", "日期和时间", "信号", "价格 CNY", "大小（数量）", "大小（价值）",
    "净损益 CNY", "回报 %", "手续费 CNY", "有利波动 CNY", "有利波动 %", "不利波动 CNY",
    "不利波动 %", "累计损益 CNY", "累计损益 %", "持续时间（K线）",
  ].join(","),
  ["1", "多头出场", "2021-03-31", "Close", "8.75", "10000", "95500", "-8000", "-8.38", "0", "6300", "6.60", "-8000", "-8.38", "-8000", "-0.80", "28"].join(","),
  ["1", "多头进场", "2021-02-19", "Buy", "9.55", "10000", "95500", "-8000", "-8.38", "0", "6300", "6.60", "-8000", "-8.38", "-8000", "-0.80", "28"].join(","),
].join("\n");

function futuBytes() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      FUTU_HEADERS,
      [
        "2025-03-13 00:38:57",
        "美股账户",
        "0855",
        "证券",
        "BABA",
        "US",
        "买入开仓",
        "USD",
        "20",
        "137.65",
        "2.05",
      ],
    ]),
    "证券-交易流水",
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

function pdfBytes() {
  return new TextEncoder().encode("%PDF-1.7\nlocal fixture");
}

describe("parseBrokerStatement", () => {
  it("dispatches a TradingView simulation CSV by its headers", async () => {
    const result = await parseBrokerStatement(
      new File([new TextEncoder().encode(TRADINGVIEW_CSV)], "回放交易_SSE_600330_2026-09-03.csv"),
    );

    expect(result).toMatchObject({
      broker: "tradingview",
      tradeNature: "simulation",
      blocked: false,
    });
    expect(result.records).toHaveLength(2);
  });

  it("detects a Futu workbook from its worksheet structure", async () => {
    const result = await parseBrokerStatement(
      new File([futuBytes()], "renamed.bin"),
    );

    expect(result).toMatchObject({
      broker: "futu",
      blocked: false,
    });
  });

  it.each([
    ["tiger.data", TIGER_PAGES, "tiger"],
    ["cms.data", CHINA_MERCHANTS_PAGES, "china-merchants"],
  ])(
    "detects %s by extracted PDF content",
    async (fileName, pages, broker) => {
      const extractPdfPages = vi.fn(async () => pages);
      const result = await parseBrokerStatement(
        new File([pdfBytes()], fileName),
        { extractPdfPages },
      );

      expect(result.broker).toBe(broker);
      expect(extractPdfPages).toHaveBeenCalledOnce();
    },
  );

  it("returns a format diagnostic when no supported parser matches", async () => {
    const result = await parseBrokerStatement(
      new File([pdfBytes()], "unknown.pdf"),
      { extractPdfPages: async () => [] },
    );

    expect(result).toMatchObject({
      broker: "unknown",
      blocked: true,
      diagnostics: [
        expect.objectContaining({ code: "unsupported-statement-format" }),
      ],
    });
  });

  it("returns an ambiguity diagnostic instead of guessing a broker", async () => {
    const result = await parseBrokerStatement(
      new File([pdfBytes()], "combined.pdf"),
      {
        extractPdfPages: async () => [
          ...TIGER_PAGES,
          ...CHINA_MERCHANTS_PAGES,
        ],
      },
    );

    expect(result).toMatchObject({
      broker: "unknown",
      blocked: true,
      diagnostics: [
        expect.objectContaining({ code: "ambiguous-statement-format" }),
      ],
    });
  });
});
