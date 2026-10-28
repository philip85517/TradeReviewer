import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";

import {
  tagTradingViewDecodedCell,
  detectTradingViewSimulationCsv,
  parseTradingViewSimulationCsv,
} from "./tradingview-simulation";
import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
  TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
} from "../trades/tradingview-account-identity";

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
  it.each([
    { name: "an invalid source row", extra: ["9", "多头进场", "not-a-date", ...sampleRows[1].slice(3)], code: "invalid-tradingview-row" },
    { name: "a duplicate entry or exit", extra: [...sampleRows[0]], code: "duplicate-tradingview-role" },
  ])("keeps $name pending while retaining an otherwise complete pair", ({ extra, code }) => {
    const result = parseTradingViewSimulationCsv(new TextEncoder().encode(csv([...sampleRows.slice(0, 2), extra])), {
      fileName: "回放交易_SSE_600330.csv", sourceFileId: "partial",
    });

    expect(result.records).toHaveLength(2);
    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, row: 4 }));
    expect(result.exclusions).toEqual([expect.objectContaining({ category: "invalid-row", count: 1, disposition: "pending" })]);
  });

  it("captures decoded headers and all logical record entries before financial normalization", () => {
    const input = csv([...sampleRows.slice(0, 2), [...sampleRows[0]], ["9", "多头进场", "not-a-date", ...sampleRows[1].slice(3)]]).replace("持续时间（K线）", "持续时间（K线）,额外来源列").split("\n").map((line, i) => i ? `${line},  原值 ${i}  ` : line).join("\n");
    const result = parseTradingViewSimulationCsv(new TextEncoder().encode(input), { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: "observed" });
    const evidence = result.tradingViewEvidence!;
    expect(evidence).toMatchObject({ fidelity: "xlsx-decoded-records-raw-false", fileFingerprint: "observed", derived: { accountOrigin: "parser-canonical-constant", natureOrigin: "parser-format-contract", runOrigin: "parser-fingerprint-market-symbol" } });
    expect(evidence.headers).toContainEqual({ kind: "string", value: "额外来源列" });
    expect(evidence.rows.map(row => row.logicalRow)).toEqual([2, 3, 4, 5]);
    expect(evidence.rows.every(row => row.entries.some(e => e.key === "额外来源列" && e.cell.kind === "string"))).toBe(true);
    expect(evidence.rows.find(row => row.logicalRow === 4)?.outcome).toBe("duplicate-role");
    expect(evidence.rows.find(row => row.logicalRow === 5)?.outcome).toBe("invalid");
    expect(evidence.rows.flatMap(row => row.candidateIds).sort()).toEqual(result.records.map(row => row.id).sort());
    expect(evidence.rows[0].entries.find(e => e.key === "价格 CNY")?.cell).toEqual({ kind: "string", value: "8.75" });
    expect(result.records[0].price).toBe("9.55");
  });
  it("tags every decoded cell domain and retains unsupported values as located diagnostics", () => {
    const values = [" raw ", 1.25, -0, true, null, undefined, new Error("decoded failure"), NaN, Infinity, -Infinity, BigInt("9007199254740993"), {}, Symbol("cell"), () => undefined];
    expect(values.map((v, i) => tagTradingViewDecodedCell(v, `d:${i}`).kind)).toEqual(["string", "number", "number", "boolean", "null", "undefined", "error", "non-finite", "non-finite", "non-finite", "bigint", "unsupported", "unsupported", "unsupported"]);
    expect(tagTradingViewDecodedCell(-0, "negative-zero")).toEqual({ kind: "number", value: 0, negativeZero: true });
    const original = XLSX.utils.sheet_to_json;
    const spy = vi.spyOn(XLSX.utils, "sheet_to_json").mockImplementation(function decoded<T>(sheet: XLSX.WorkSheet, options?: XLSX.Sheet2JSONOpts): T[] {
      const rows = original<T>(sheet, options);
      if (options?.header !== 1) for (const row of rows) Object.assign(row as object, { objectExtra: {}, symbolExtra: Symbol("raw"), functionExtra: () => 1 });
      return rows;
    });
    try {
      const result = parseTradingViewSimulationCsv(new TextEncoder().encode(csv(sampleRows.slice(0, 2))), { fileName: "回放交易_SSE_600330_2026-09-03.csv", sourceFileId: "tagged" });
      expect(result.records).toHaveLength(2);
      const evidence = result.tradingViewEvidence!;
      expect(evidence.rows).toHaveLength(2);
      expect(evidence.cellDiagnostics).toHaveLength(6);
      for (const row of evidence.rows) for (const column of ["objectExtra", "symbolExtra", "functionExtra"]) {
        const entry = row.entries.find(e => e.key === column)!;
        expect(entry.cell).toMatchObject({ kind: "unsupported", diagnosticId: `decoded:${row.logicalRow}:${column}` });
        expect(evidence.cellDiagnostics).toContainEqual({ id: `decoded:${row.logicalRow}:${column}`, sheet: evidence.sheet.name, logicalRow: row.logicalRow, column });
      }
      expect(() => JSON.stringify(evidence)).not.toThrow();
    } finally { spy.mockRestore(); }
  });

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
        simulationRole: "entry",
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

  it("uses one canonical account while retaining the source run and stable IDs", () => {
    const input = new TextEncoder().encode(csv(sampleRows));
    const result = parseTradingViewSimulationCsv(input, {
      fileName: "回放交易_SSE_600330_2026-09-03.csv",
      sourceFileId: "fingerprint",
    });
    const repeated = parseTradingViewSimulationCsv(input, {
      fileName: "回放交易_SSE_600330_2026-09-03.csv",
      sourceFileId: "fingerprint",
    });

    expect(new Set(result.records.map(record => record.accountId))).toEqual(
      new Set([TRADINGVIEW_CANONICAL_ACCOUNT_ID]),
    );
    expect(new Set(result.records.map(record => record.accountLabel))).toEqual(
      new Set([TRADINGVIEW_CANONICAL_ACCOUNT_LABEL]),
    );
    expect(new Set(result.records.map(record => record.source.simulationRunId))).toEqual(
      new Set(["tradingview:fingerprint:CN-SH:600330"]),
    );
    expect(result.records).toEqual(repeated.records);
    expect(result.records.map(record => record.id)).toEqual([
      "tradingview:fingerprint:CN-SH:600330:1:3",
      "tradingview:fingerprint:CN-SH:600330:1:2",
      "tradingview:fingerprint:CN-SH:600330:2:5",
      "tradingview:fingerprint:CN-SH:600330:2:4",
    ]);
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
