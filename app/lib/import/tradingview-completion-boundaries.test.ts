import { describe, expect, it } from "vitest";

import type { DecodedCell, TradingViewDecodedEvidence } from "./contracts";
import { completionHasPendingEvidence } from "./import-completion";
import {
  detectTradingViewSimulationCsv,
  parseTradingViewSimulationCsv,
  replayTradingViewDecodedEvidence,
  tagTradingViewDecodedCell,
} from "./tradingview-simulation";

const headers = [
  "交易编号", "类型", "日期和时间", "信号", "价格 CNY", "大小（数量）", "大小（价值）",
  "净损益 CNY", "回报 %", "手续费 CNY", "有利波动 CNY", "有利波动 %", "不利波动 CNY",
  "不利波动 %", "累计损益 CNY", "累计损益 %", "持续时间（K线）",
];

function pair(id = "1", entryDate = "2023-01-02", exitDate = "2023-01-05") {
  return [
    [id, "多头进场", entryDate, "entry", "10", "100", "1000", "100", "10", "2", "150", "15", "-50", "-5", "100", "1", "3"],
    [id, "多头出场", exitDate, "exit", "11", "100", "1000", "100", "10", "2", "150", "15", "-50", "-5", "100", "1", "3"],
  ];
}

function csv(rows: string[][], columns = headers) {
  return new TextEncoder().encode([columns, ...rows].map(row => row.join(",")).join("\n"));
}

function parse(rows: string[][]) {
  return parseTradingViewSimulationCsv(csv(rows), { fileName: "strategy_SSE_600330.csv", sourceFileId: "boundary-source" });
}

function pending(result: ReturnType<typeof parse>) {
  return completionHasPendingEvidence({ ...result, unresolvedInstrumentCount: 0 });
}

function replaceDecodedColumn(evidence: TradingViewDecodedEvidence, column: string, cell: DecodedCell) {
  for (const row of evidence.rows) {
    const entry = row.entries.find(entry => entry.key === column);
    if (!entry) throw new Error(`Missing fixture column: ${column}`);
    entry.cell = cell;
  }
}

describe("TradingView source completion boundaries", () => {
  it.each([
    { column: 0, value: "", breakName: "missing source trade ID" },
    { column: 1, value: "调整", breakName: "unknown row role" },
    { column: 1, value: "进场", breakName: "unsupported trade direction" },
    { column: 2, value: "2023-13-01", breakName: "invalid date" },
    { column: 4, value: "", breakName: "missing execution price" },
    { column: 4, value: "0", breakName: "zero execution price" },
    { column: 5, value: "NaN", breakName: "non-finite execution quantity" },
    { column: 9, value: "-1", breakName: "negative commission" },
    { column: 9, value: "Infinity", breakName: "non-finite commission" },
    { column: 16, value: "-1", breakName: "negative duration" },
    { column: 16, value: "1.5", breakName: "fractional duration" },
  ])("retains retry eligibility for a $breakName alongside a valid pair", ({ column, value }) => {
    const invalid = pair("9", "2023-02-01", "2023-02-03")[0];
    invalid[column] = value;

    const result = parse([...pair(), invalid]);

    expect(result.records).toHaveLength(2);
    expect(result.records.every(record => record.source.sourceTradeId === "1")).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-tradingview-row", row: 4 }));
    expect(result.exclusions).toEqual([expect.objectContaining({ category: "invalid-row", count: 1, disposition: "pending" })]);
    expect(result.tradingViewEvidence?.rows.find(row => row.logicalRow === 4)).toMatchObject({ outcome: "invalid", candidateIds: [], diagnosticCodes: ["invalid-tradingview-row"] });
    expect(pending(result)).toBe(true);
  });

  it.each([
    { column: 2, value: "2023-01-31", breakName: "exit before entry" },
    { column: 7, value: "99", breakName: "inconsistent source reports" },
    { column: 9, value: "3", breakName: "inconsistent commission" },
    { column: 1, value: "空头出场", breakName: "same execution side" },
    { column: 5, value: "99", breakName: "inconsistent quantity" },
  ])("does not mark a file complete after dropping a pair with $breakName", ({ column, value }) => {
    const invalid = pair("9", "2023-02-01", "2023-02-03");
    invalid[1][column] = value;

    const result = parse([...pair(), ...invalid]);

    expect(result.records).toHaveLength(2);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid-tradingview-pair", row: 4, instrumentSymbol: "9" }));
    expect(result.exclusions).toEqual([expect.objectContaining({ category: "invalid-row", count: 1 })]);
    expect(pending(result)).toBe(true);
  });

  it("keeps a repeated entry pending without replacing the accepted source row", () => {
    const original = pair();
    const repeated = [...original[0]];
    repeated[4] = "99";

    const result = parse([...original, repeated]);

    expect(result.records.map(record => record.price)).toEqual(["10", "11"]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "duplicate-tradingview-role", row: 4 }));
    expect(result.tradingViewEvidence?.rows[2]).toMatchObject({ outcome: "duplicate-role", candidateIds: [] });
    expect(pending(result)).toBe(true);
  });

  it("keeps an exit-only group pending with a located missing-entry diagnostic", () => {
    const result = parse([pair()[1]]);

    expect(result).toMatchObject({ blocked: true, records: [], exclusions: [{ category: "invalid-row", count: 1 }] });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "incomplete-tradingview-trade", row: 2, instrumentSymbol: "1" }));
    expect(result.tradingViewEvidence?.rows[0]).toMatchObject({ outcome: "unpaired", candidateIds: [] });
    expect(pending(result)).toBe(true);
  });

  it.each(["same-day-boundary", "opposing-overlap"])("keeps %s pairs pending while retaining independent valid trades", ambiguity => {
    const first = pair("9", "2023-02-01", "2023-02-05");
    const second = pair("10", ambiguity === "same-day-boundary" ? "2023-02-05" : "2023-02-03", "2023-02-08");
    if (ambiguity === "opposing-overlap") {
      second[0][1] = "空头进场";
      second[1][1] = "空头出场";
    }

    const result = parse([...pair(), ...first, ...second]);

    expect(result.records.map(record => record.source.sourceTradeId)).toEqual(["1", "1"]);
    expect(result.diagnostics.filter(item => item.code === "ambiguous-tradingview-order").map(item => item.instrumentSymbol)).toEqual(["9", "10"]);
    expect(result.exclusions).toHaveLength(2);
    expect(pending(result)).toBe(true);
  });

  it("accepts overlapping same-direction trades and assigns deterministic numeric trade order", () => {
    const result = parse([...pair("10"), ...pair("9")]);

    expect(result.blocked).toBe(false);
    expect(result.exclusions).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.records.map(record => record.source.sourceTradeId)).toEqual(["9", "10", "9", "10"]);
    expect(result.records.map(record => record.source.sourceOrder)).toEqual([0, 1, 2, 3]);
    expect(pending(result)).toBe(false);
  });

  it("orders a same-day short entry before its exit even when the export lists exit first", () => {
    const rows = pair("1", "2023-01-02", "2023-01-02");
    rows[0][1] = "空头进场";
    rows[1][1] = "空头出场";

    const result = parse(rows.reverse());

    expect(result.records.map(record => [record.side, record.source.simulationRole, record.source.row])).toEqual([
      ["sell", "entry", 3], ["buy", "exit", 2],
    ]);
    expect(result.records.map(record => record.fee)).toEqual(["0", "2"]);
    expect(pending(result)).toBe(false);
  });

  it("blocks missing format or instrument context before creating an import candidate", () => {
    const missingHeader = csv(pair(), headers.filter(header => header !== "手续费 CNY"));
    expect(detectTradingViewSimulationCsv(missingHeader)).toMatchObject({ matched: false, confidence: 0.25 });
    expect(parseTradingViewSimulationCsv(missingHeader, { fileName: "strategy.csv", sourceFileId: "missing-header" })).toMatchObject({
      blocked: true, records: [], candidates: [], diagnostics: [expect.objectContaining({ code: "invalid-tradingview-csv" })],
    });
    expect(parseTradingViewSimulationCsv(csv(pair()), { fileName: "strategy.csv", sourceFileId: "missing-context" })).toMatchObject({
      blocked: true, records: [], candidates: [], diagnostics: [expect.objectContaining({ code: "tradingview-missing-instrument-context" })],
    });
    expect(detectTradingViewSimulationCsv(new Uint8Array())).toMatchObject({ matched: false });
    expect(parseTradingViewSimulationCsv(new Uint8Array(), { fileName: "empty.csv", sourceFileId: "empty" })).toMatchObject({ blocked: true, records: [], candidates: [] });
  });

  it("allows explicit context to recover an otherwise anonymous file", () => {
    const result = parseTradingViewSimulationCsv(csv(pair()), {
      fileName: "anonymous.csv", sourceFileId: "explicit-context", context: { market: "CN-SZ", symbol: "000001" },
    });

    expect(result.records).toHaveLength(2);
    expect(result.records[0].instrument).toMatchObject({ id: "CN-SZ:000001", market: "CN-SZ", symbol: "000001", currency: "CNY" });
    expect(result.simulationRunId).toBe("tradingview:explicit-context:CN-SZ:000001");
    expect(pending(result)).toBe(false);
  });

  it.each(["SHSE", "SZSE", "SZE", "SZ"])("derives the security context from a %s filename alias", exchange => {
    const result = parseTradingViewSimulationCsv(csv(pair()), {
      fileName: `strategy_${exchange}_000001.csv`, sourceFileId: "filename-context",
    });

    expect(result.records).toHaveLength(2);
    expect(result.records[0].instrument).toMatchObject({ market: exchange === "SHSE" ? "CN-SH" : "CN-SZ", symbol: "000001" });
  });

  it("treats blank exported commissions as zero without losing completion", () => {
    const rows = pair();
    rows.forEach(row => { row[9] = ""; });

    const result = parse(rows);

    expect(result.records.map(record => record.fee)).toEqual(["0", "0"]);
    expect(pending(result)).toBe(false);
  });

  it.each([{ kind: "null" }, { kind: "undefined" }] satisfies DecodedCell[])("replays $kind blank commissions as zero", cell => {
    const evidence = structuredClone(parse(pair()).tradingViewEvidence!);
    replaceDecodedColumn(evidence, "手续费 CNY", cell);

    const result = replayTradingViewDecodedEvidence(evidence);

    expect(result.records.map(record => record.fee)).toEqual(["0", "0"]);
    expect(pending(result)).toBe(false);
  });

  it("replays exact bigint quantities without routing through a lossy JavaScript number", () => {
    const evidence = structuredClone(parse(pair()).tradingViewEvidence!);
    replaceDecodedColumn(evidence, "大小（数量）", { kind: "bigint", decimal: "9007199254740993" });

    const result = replayTradingViewDecodedEvidence(evidence);

    expect(result.records.map(record => record.quantity)).toEqual(["9007199254740993", "9007199254740993"]);
    expect(pending(result)).toBe(false);
  });

  it.each([
    { kind: "boolean", value: true },
    { kind: "non-finite", value: "NaN" },
    { kind: "non-finite", value: "+Infinity" },
    { kind: "non-finite", value: "-Infinity" },
    { kind: "null" },
    { kind: "undefined" },
    { kind: "error", code: "CELL_ERROR", message: "price could not be decoded" },
    { kind: "unsupported", jsType: "object", diagnosticId: "price-object" },
  ] satisfies DecodedCell[])("keeps a persisted $kind execution price pending on replay %#", cell => {
    const evidence = structuredClone(parse(pair()).tradingViewEvidence!);
    replaceDecodedColumn(evidence, "价格 CNY", cell);

    const result = replayTradingViewDecodedEvidence(evidence);

    expect(result.records).toEqual([]);
    expect(result.blocked).toBe(true);
    expect(result.diagnostics.filter(item => item.code === "invalid-tradingview-row").map(item => item.row)).toEqual([2, 3]);
    expect(result.exclusions).toEqual([
      expect.objectContaining({ category: "invalid-row", count: 1, disposition: "pending" }),
      expect.objectContaining({ category: "invalid-row", count: 1, disposition: "pending" }),
    ]);
    expect(pending(result)).toBe(true);
  });

  it("retains an error code without evaluating an unsafe error message getter", () => {
    const failure = Object.assign(new Error(), { code: "CELL_ERROR" });
    Object.defineProperty(failure, "message", { get() { throw new Error("must not be read"); } });

    expect(tagTradingViewDecodedCell(failure, "source-price")).toEqual({ kind: "error", code: "CELL_ERROR", message: null });
  });

  it("replays persisted decoded evidence with the same accepted trades and pending source rows", () => {
    const invalid = pair("9")[0];
    invalid[4] = "0";
    const original = parse([...pair(), invalid]);

    const replayed = replayTradingViewDecodedEvidence(JSON.parse(JSON.stringify(original.tradingViewEvidence)));

    expect(replayed.records.map(record => ({ id: record.id, side: record.side, quantity: record.quantity, price: record.price, fee: record.fee }))).toEqual([
      { id: "tradingview:boundary-source:CN-SH:600330:1:2", side: "buy", quantity: "100", price: "10", fee: "0" },
      { id: "tradingview:boundary-source:CN-SH:600330:1:3", side: "sell", quantity: "100", price: "11", fee: "2" },
    ]);
    expect(replayed.tradingViewEvidence?.rows[2]).toMatchObject({ logicalRow: 4, outcome: "invalid", candidateIds: [] });
    expect(pending(replayed)).toBe(true);
  });
});
