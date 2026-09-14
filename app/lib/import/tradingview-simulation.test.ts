import { describe, expect, it } from "vitest";

import {
  detectTradingViewSimulationCsv,
  parseTradingViewSimulationCsv,
} from "./tradingview-simulation";

const HEADERS = [
  "交易编号",
  "类型",
  "日期和时间",
  "信号",
  "价格 CNY",
  "大小（数量）",
  "大小（价值）",
  "净损益 CNY",
  "回报 %",
  "手续费 CNY",
  "有利波动 CNY",
  "有利波动 %",
  "不利波动 CNY",
  "不利波动 %",
  "累计损益 CNY",
  "累计损益 %",
  "持续时间（K线）",
];

function csv(rows: string[][], options: { bom?: boolean; crlf?: boolean } = {}) {
  const body = [HEADERS, ...rows]
    .map((row) =>
      row
        .map((value) =>
          value.includes(",") || value.includes('"')
            ? `"${value.replaceAll('"', '""')}"`
            : value,
        )
        .join(","),
    )
    .join(options.crlf ? "\r\n" : "\n");
  return `${options.bom ? "\uFEFF" : ""}${body}`;
}

const sampleRows = [
  [
    "1", "多头出场", "2021-03-31", "Bracket Stop Loss", "8.75", "10000", "95500",
    "-8000", "-8.38", "0", "6300", "6.60", "-8000", "-8.38", "-8000", "-0.80", "28",
  ],
  [
    "1", "多头进场", "2021-02-19", "Buy market order", "9.55", "10000", "95500",
    "-8000", "-8.38", "0", "6300", "6.60", "-8000", "-8.38", "-8000", "-0.80", "28",
  ],
  [
    "2", "空头出场", "2021-04-28", "Close position (partial)", "8.22", "7000", "59920",
    "2380", "3.97", "0", "3500", "5.84", "-1400", "-2.34", "-5620", "-0.56", "14",
  ],
  [
    "2", "空头进场", "2021-04-08", "Sell market order", "8.56", "7000", "59920",
    "2380", "3.97", "0", "3500", "5.84", "-1400", "-2.34", "-5620", "-0.56", "14",
  ],
];

describe("TradingView simulation CSV", () => {
  it("detects the supported Chinese export headers", () => {
    const input = new TextEncoder().encode(csv(sampleRows));

    expect(detectTradingViewSimulationCsv(input)).toEqual({
      matched: true,
      confidence: 1,
    });
  });

  it("normalizes paired long and short rows without using the filename date", () => {
    const input = new TextEncoder().encode(csv(sampleRows, { bom: true, crlf: true }));
    const result = parseTradingViewSimulationCsv(input, {
      fileName: "回放交易_SSE_600330_2026-09-03.csv",
      sourceFileId: "fingerprint",
    });

    expect(result).toMatchObject({
      broker: "tradingview",
      blocked: false,
      tradeNature: "simulation",
      simulationRunId: expect.stringContaining("tradingview:"),
    });
    expect(result.records).toHaveLength(4);
    expect(result.records.map(({ side }) => side)).toEqual([
      "buy",
      "sell",
      "sell",
      "buy",
    ]);
    expect(result.records[0]).toMatchObject({
      executedAt: "2021-02-18T16:00:00.000Z",
      quantity: "10000",
      price: "9.55",
      fee: "0",
      instrument: {
        id: "CN-SH:600330",
        symbol: "600330",
        market: "CN-SH",
        currency: "CNY",
      },
      source: {
        inputKind: "tradingview",
        timePrecision: "date-only",
        sourceTimezone: "Asia/Shanghai",
        sourceTradeId: "1",
        row: 3,
      },
    });
    expect(result.records[1].source.sourceReport).toMatchObject({
      netPnl: "-8000",
      returnPercent: "-8.38",
      durationBars: 28,
    });
    expect(result.records[1].executedAt).toBe("2021-03-30T16:00:00.000Z");
    expect(result.records[2].side).toBe("sell");
    expect(result.records[3].side).toBe("buy");
  });

  it("reports incomplete source trade groups with their row locations", () => {
    const input = new TextEncoder().encode(csv([
      [
        "9", "多头进场", "2023-02-07", "Buy market order", "13.81", "5000", "69050",
        "-7250", "-10.50", "0", "1600", "2.32", "-7350", "-10.64", "16530", "1.65", "8",
      ],
    ]));

    const result = parseTradingViewSimulationCsv(input, {
      fileName: "回放交易_SSE_600330_2026-09-03.csv",
      sourceFileId: "fingerprint",
    });

    expect(result).toMatchObject({ blocked: true, records: [] });
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "incomplete-tradingview-trade",
        message: expect.stringContaining("交易编号 9"),
        row: 2,
      }),
    ]);
  });
});
