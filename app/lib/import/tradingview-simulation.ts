import Decimal from "decimal.js";
import * as XLSX from "xlsx";

import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
  instrumentDisplayName,
} from "../instruments/display-name";
import type {
  TradeExecution,
  TradeSide,
  TradingViewSourceReport,
} from "../trades/types";
import type { ImportDiagnostic } from "./import-result";
import type {
  DetectionResult,
  ImportExclusion,
  ParsedInstrumentCandidate,
  StatementParseResult,
  TradingViewSimulationContext,
} from "./contracts";

const REQUIRED_HEADERS = [
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
] as const;

type TradingViewRow = Record<string, string | number | null | undefined>;
type RowWithNumber = { row: TradingViewRow; sourceRow: number };
type PairedRows = { id: string; entry?: RowWithNumber; exit?: RowWithNumber };

function csvWorkbook(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const source = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  return XLSX.read(source, {
    type: "string",
    cellDates: false,
    raw: false,
  });
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function parseNumber(value: unknown, allowBlank = false) {
  const normalized = text(value).replaceAll(",", "");
  if (!normalized && allowBlank) return "0";
  if (!normalized) throw new Error("missing numeric value");
  return new Decimal(normalized).toString();
}

function positiveNumber(value: unknown) {
  const parsed = new Decimal(parseNumber(value));
  if (!parsed.isFinite() || parsed.lte(0)) throw new Error("value must be positive");
  return parsed.toString();
}

function nonNegativeNumber(value: unknown) {
  const parsed = new Decimal(parseNumber(value, true));
  if (!parsed.isFinite() || parsed.isNegative()) throw new Error("value must be non-negative");
  return parsed.toString();
}

function integer(value: unknown) {
  const parsed = new Decimal(parseNumber(value));
  if (!parsed.isInteger() || parsed.isNegative()) throw new Error("value must be a non-negative integer");
  return parsed.toNumber();
}

function parseDate(value: unknown) {
  const source = text(value);
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("date must use YYYY-MM-DD");
  const iso = `${source}T00:00:00.000+08:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) throw new Error("invalid date");
  return parsed.toISOString();
}

function csvRows(input: ArrayBuffer | Uint8Array): TradingViewRow[] {
  const workbook = csvWorkbook(input);
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<TradingViewRow>(sheet, {
    defval: "",
    raw: false,
  });
}

function headerValues(input: ArrayBuffer | Uint8Array) {
  const workbook = csvWorkbook(input);
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return (rows[0] ?? []).map(text);
}

export function detectTradingViewSimulationCsv(
  input: ArrayBuffer | Uint8Array,
): DetectionResult {
  try {
    const headers = new Set(headerValues(input));
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.has(header));
    if (missingHeaders.length > 0) {
      return {
        matched: false,
        confidence: headers.size > 0 ? 0.25 : 0,
        diagnostics:
          headers.size > 0
            ? [{
                severity: "error",
                code: "invalid-tradingview-csv",
                message: `TradingView 模拟交易 CSV 缺少必要列：${missingHeaders.join("、")}`,
              }]
            : undefined,
      };
    }
    return { matched: true, confidence: 1 };
  } catch {
    return { matched: false, confidence: 0 };
  }
}

function contextFromFileName(fileName: string): TradingViewSimulationContext | undefined {
  const match = fileName.toUpperCase().match(/(?:^|[_-])(SSE|SHSE|SZSE|SZE|SZ)[_-](\d{6})(?:[_-]|\.|$)/);
  if (!match) return undefined;
  return {
    market: match[1] === "SSE" || match[1] === "SHSE" ? "CN-SH" : "CN-SZ",
    symbol: match[2],
  };
}

function sourceTradeId(row: TradingViewRow) {
  const id = text(row["交易编号"]);
  if (!id) throw new Error("trade ID is empty");
  return id;
}

function role(row: TradingViewRow): "entry" | "exit" {
  const type = text(row["类型"]);
  if (type.includes("进场")) return "entry";
  if (type.includes("出场")) return "exit";
  throw new Error("row type is neither entry nor exit");
}

function side(row: TradingViewRow): TradeSide {
  const type = text(row["类型"]);
  if (type.includes("多头进场") || type.includes("空头出场")) return "buy";
  if (type.includes("多头出场") || type.includes("空头进场")) return "sell";
  throw new Error("row direction is not supported");
}

function report(row: TradingViewRow): TradingViewSourceReport {
  return {
    netPnl: parseNumber(row["净损益 CNY"]),
    returnPercent: parseNumber(row["回报 %"]),
    favorableExcursion: parseNumber(row["有利波动 CNY"]),
    favorableExcursionPercent: parseNumber(row["有利波动 %"]),
    adverseExcursion: parseNumber(row["不利波动 CNY"]),
    adverseExcursionPercent: parseNumber(row["不利波动 %"]),
    cumulativePnl: parseNumber(row["累计损益 CNY"]),
    cumulativeReturnPercent: parseNumber(row["累计损益 %"]),
    durationBars: integer(row["持续时间（K线）"]),
  };
}

function sameReport(left: TradingViewSourceReport, right: TradingViewSourceReport) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function candidate(context: TradingViewSimulationContext): ParsedInstrumentCandidate {
  const symbol = canonicalInstrumentSymbol(context.symbol, context.market);
  return {
    market: context.market,
    symbol,
    sourceName: instrumentDisplayName(symbol, context.market),
    sourceAssetType: "unknown",
  };
}

function diagnostic(
  code: string,
  message: string,
  sourceRow?: number,
  sourceTradeId?: string,
): ImportDiagnostic {
  return {
    severity: "warning",
    code,
    message,
    ...(sourceRow !== undefined ? { row: sourceRow } : {}),
    ...(sourceTradeId ? { instrumentSymbol: sourceTradeId } : {}),
  };
}

function exclusion(sourceTradeId: string): ImportExclusion {
  return {
    category: "invalid-row",
    label: `TradingView 交易编号 ${sourceTradeId} 配对无效`,
    count: 1,
  };
}

function execution(
  paired: PairedRows,
  row: RowWithNumber,
  context: TradingViewSimulationContext,
  fileName: string,
  sourceFileId: string,
  sourceReport: TradingViewSourceReport | undefined,
  fee: string,
): TradeExecution {
  const symbol = canonicalInstrumentSymbol(context.symbol, context.market);
  const instrumentId = canonicalInstrumentId(symbol, context.market);
  const sourceId = `${sourceFileId}:${context.market}:${symbol}:${paired.id}:${row.sourceRow}`;
  return {
    id: `tradingview:${sourceId}`,
    source: {
      platform: "tradingview",
      row: row.sourceRow,
      fileName,
      fileFingerprint: sourceFileId,
      sourceTimestampText: text(row.row["日期和时间"]),
      sourceTimezone: "Asia/Shanghai",
      timePrecision: "date-only",
      inputKind: "tradingview",
      tradeNature: "simulation",
      simulationRunId: `tradingview:${sourceFileId}:${context.market}:${symbol}`,
      sourceTradeId: paired.id,
      ...(sourceReport ? { sourceReport } : {}),
    },
    accountId: `tradingview:${sourceFileId}`,
    accountLabel: "TradingView 模拟盘",
    instrument: {
      id: instrumentId,
      symbol,
      name: instrumentDisplayName(symbol, context.market),
      market: context.market,
      currency: "CNY",
    },
    side: side(row.row),
    executedAt: parseDate(row.row["日期和时间"]),
    quantity: positiveNumber(row.row["大小（数量）"]),
    price: positiveNumber(row.row["价格 CNY"]),
    fee,
  };
}

export function parseTradingViewSimulationCsv(
  input: ArrayBuffer | Uint8Array,
  options: {
    fileName: string;
    sourceFileId: string;
    context?: TradingViewSimulationContext;
  },
): StatementParseResult {
  const detection = detectTradingViewSimulationCsv(input);
  if (!detection.matched) {
    return {
      broker: "tradingview",
      records: [],
      candidates: [],
      exclusions: [],
      diagnostics: detection.diagnostics ?? [],
      blocked: true,
      tradeNature: "simulation",
    };
  }

  const context = options.context ?? contextFromFileName(options.fileName);
  if (!context) {
    return {
      broker: "tradingview",
      records: [],
      candidates: [],
      exclusions: [],
      diagnostics: [
        {
          severity: "error",
          code: "tradingview-missing-instrument-context",
          message: "文件名未包含 SSE/SZSE 与六位证券代码，请选择证券后重试",
        },
      ],
      blocked: true,
      tradeNature: "simulation",
    };
  }

  const rows = csvRows(input).map((row, index) => ({
    row,
    sourceRow: index + 2,
  }));
  const groups = new Map<string, PairedRows>();
  const diagnostics: ImportDiagnostic[] = [];
  const exclusions: ImportExclusion[] = [];

  for (const current of rows) {
    let id: string;
    let currentRole: "entry" | "exit";
    try {
      id = sourceTradeId(current.row);
      currentRole = role(current.row);
      parseDate(current.row["日期和时间"]);
      positiveNumber(current.row["大小（数量）"]);
      positiveNumber(current.row["价格 CNY"]);
      nonNegativeNumber(current.row["手续费 CNY"]);
      report(current.row);
      side(current.row);
    } catch (error) {
      const message = error instanceof Error ? error.message : "字段无法识别";
      diagnostics.push(diagnostic("invalid-tradingview-row", `第 ${current.sourceRow} 行无法导入：${message}`, current.sourceRow));
      continue;
    }
    const pair = groups.get(id) ?? { id };
    if (pair[currentRole]) {
      diagnostics.push(diagnostic("duplicate-tradingview-role", `交易编号 ${id} 存在重复${currentRole === "entry" ? "进场" : "出场"}行`, current.sourceRow, id));
      continue;
    }
    pair[currentRole] = current;
    groups.set(id, pair);
  }

  const records: TradeExecution[] = [];
  for (const pair of groups.values()) {
    if (!pair.entry || !pair.exit) {
      const row = pair.entry ?? pair.exit;
      diagnostics.push(diagnostic("incomplete-tradingview-trade", `交易编号 ${pair.id} 缺少${pair.entry ? "出场" : "进场"}行`, row?.sourceRow, pair.id));
      exclusions.push(exclusion(pair.id));
      continue;
    }
    try {
      const entryDate = parseDate(pair.entry.row["日期和时间"]);
      const exitDate = parseDate(pair.exit.row["日期和时间"]);
      if (exitDate < entryDate) throw new Error("出场日期早于进场日期");
      const entryReport = report(pair.entry.row);
      const exitReport = report(pair.exit.row);
      if (!sameReport(entryReport, exitReport)) throw new Error("配对报告指标不一致");
      const fee = nonNegativeNumber(pair.entry.row["手续费 CNY"] ?? 0);
      records.push(
        execution(pair, pair.entry, context, options.fileName, options.sourceFileId, undefined, "0"),
        execution(pair, pair.exit, context, options.fileName, options.sourceFileId, exitReport, fee),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "配对字段无法识别";
      diagnostics.push(diagnostic("invalid-tradingview-pair", `交易编号 ${pair.id} 无法导入：${message}`, pair.entry.sourceRow, pair.id));
      exclusions.push(exclusion(pair.id));
    }
  }

  records.sort((left, right) =>
    left.executedAt.localeCompare(right.executedAt) ||
    (left.source.sourceTradeId ?? "").localeCompare(right.source.sourceTradeId ?? "") ||
    left.source.row - right.source.row,
  );

  const parsedCandidate = candidate(context);
  return {
    broker: "tradingview",
    records,
    candidates: [parsedCandidate],
    exclusions,
    diagnostics,
    blocked: records.length === 0,
    tradeNature: "simulation",
    simulationRunId: records[0]?.source.simulationRunId,
  };
}
