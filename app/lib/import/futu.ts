import Decimal from "decimal.js";
import * as XLSX from "xlsx";

import type { TradeExecution, TradeSide } from "../trades/types";
import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
  instrumentDisplayName,
} from "../instruments/display-name";
import type { ImportDiagnostic, ImportResult } from "./import-result";

const TRADE_SHEET = "证券-交易流水";
const REQUIRED_HEADERS = [
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
] as const;

type FutuRow = Record<string, string | number | null | undefined>;
export type FutuSourceTimezone =
  | "Asia/Shanghai"
  | "Asia/Hong_Kong"
  | "UTC";

type ParseFutuOptions = {
  sourceTimezone?: FutuSourceTimezone;
  fileName?: string;
  sourceFileId?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function decimal(value: unknown, allowBlank = false) {
  const normalized = text(value).replaceAll(",", "");
  if (!normalized && allowBlank) return "0";
  if (!normalized) throw new Error("missing numeric value");
  return new Decimal(normalized).abs().toString();
}

function normalizeTime(value: unknown, timezone: FutuSourceTimezone) {
  const source = text(value);
  const isoLike = source.includes("T") ? source : source.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike)
    ? isoLike
    : `${isoLike}${timezone === "UTC" ? "Z" : "+08:00"}`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sideFor(value: unknown): TradeSide | null {
  const direction = text(value);
  if (direction.includes("买入")) return "buy";
  if (direction.includes("卖出")) return "sell";
  return null;
}

function marketFor(value: unknown) {
  const market = text(value).toUpperCase();
  if (market === "SEHK" || market.includes("港")) return "HK";
  if (market === "US") return "US";
  if (market.includes("SH") || market.includes("沪")) return "CN-SH";
  if (market.includes("SZ") || market.includes("深")) return "CN-SZ";
  return market || "UNKNOWN";
}

function accountLabel(name: unknown, id: string) {
  const lastFour = id.slice(-4);
  return `${text(name) || "券商账户"} · ${lastFour || "----"}`;
}

function instrumentDescriptor(value: unknown) {
  const raw = text(value);
  const parenthesized = raw.match(/^(.+?)\s*[（(]([A-Za-z0-9.-]+)[）)]$/);
  if (parenthesized) {
    return { symbol: parenthesized[2], name: parenthesized[1].trim() };
  }
  const prefixed = raw.match(/^([A-Za-z0-9.]+)\s+(.+)$/);
  if (prefixed) {
    return { symbol: prefixed[1], name: prefixed[2].trim() };
  }
  return { symbol: raw, name: undefined };
}

function workbookFingerprint(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193);
    second = Math.imul(second ^ (byte + first), 0x85ebca6b);
  }
  return [first, second]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

export function parseFutuWorkbook(
  input: ArrayBuffer | Uint8Array,
  options: ParseFutuOptions = {},
): ImportResult<TradeExecution> {
  const sourceTimezone = options.sourceTimezone ?? "Asia/Shanghai";
  const sourceFileName = options.fileName ?? "futu-workbook.xlsx";
  const sourceFileId =
    options.sourceFileId ?? workbookFingerprint(input);
  const workbook = XLSX.read(input, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[TRADE_SHEET];
  const diagnostics: ImportDiagnostic[] = [];

  if (!sheet) {
    return {
      records: [],
      diagnostics: [
        {
          severity: "error",
          code: "missing-trade-sheet",
          message: `缺少“${TRADE_SHEET}”工作表`,
        },
      ],
      blocked: true,
    };
  }

  const rows = XLSX.utils.sheet_to_json<FutuRow>(sheet, {
    defval: "",
    raw: false,
  });
  const firstRow = rows[0] ?? {};
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !(header in firstRow),
  );

  if (missingHeaders.length > 0) {
    return {
      records: [],
      diagnostics: [
        {
          severity: "error",
          code: "missing-required-columns",
          message: `缺少必要列：${missingHeaders.join("、")}`,
          sheet: TRADE_SHEET,
          row: 1,
        },
      ],
      blocked: true,
    };
  }

  const records: TradeExecution[] = [];
  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const descriptor = instrumentDescriptor(row["代码名称"]);
    const rawInstrumentSymbol = descriptor.symbol.toUpperCase();

    if (text(row["品类"]) !== "证券") {
      diagnostics.push({
        severity: "info",
        code: "unsupported-asset-class",
        message: `已跳过${text(row["品类"]) || "未知"}记录`,
        sheet: TRADE_SHEET,
        row: sourceRow,
        instrumentSymbol: rawInstrumentSymbol || undefined,
        assetClass: text(row["品类"]),
      });
      return;
    }

    if (!rawInstrumentSymbol) {
      diagnostics.push({
        severity: "warning",
        code: "missing-instrument-symbol",
        message: "股票代码为空，已跳过该行",
        sheet: TRADE_SHEET,
        row: sourceRow,
        assetClass: text(row["品类"]),
      });
      return;
    }

    const side = sideFor(row["方向"]);
    const sourceTimestampText = text(row["成交时间"]);
    const executedAt = normalizeTime(
      row["成交时间"],
      sourceTimezone,
    );
    if (!side || !executedAt) {
      diagnostics.push({
        severity: "warning",
        code: "invalid-trade-row",
        message: "成交方向或成交时间无法识别",
        sheet: TRADE_SHEET,
        row: sourceRow,
        instrumentSymbol: rawInstrumentSymbol,
        assetClass: text(row["品类"]),
      });
      return;
    }

    let quantity: string;
    let price: string;
    let fee: string;
    try {
      quantity = decimal(row["数量/面值"]);
      price = decimal(row["价格"]);
      fee = decimal(row["总费用"], true);
      if (new Decimal(quantity).lte(0) || new Decimal(price).lte(0)) {
        throw new Error("quantity and price must be positive");
      }
    } catch {
      diagnostics.push({
        severity: "warning",
        code: "invalid-numeric-field",
        message: "数量、价格或费用无法识别，已跳过该行",
        sheet: TRADE_SHEET,
        row: sourceRow,
        instrumentSymbol: rawInstrumentSymbol,
        assetClass: text(row["品类"]),
      });
      return;
    }

    const accountId = text(row["账户号码"]);
    const market = marketFor(row["交易所/市场"]);
    const symbol = canonicalInstrumentSymbol(rawInstrumentSymbol, market);

    records.push({
      id: `futu:${sourceFileId}:${TRADE_SHEET}:${sourceRow}`,
      source: {
        platform: "futu",
        sheet: TRADE_SHEET,
        row: sourceRow,
        fileName: sourceFileName,
        fileFingerprint: sourceFileId,
        sourceTimestampText,
        sourceTimezone,
      },
      accountId,
      accountLabel: accountLabel(row["账户名称"], accountId),
      instrument: {
        id: canonicalInstrumentId(symbol, market),
        symbol,
        name: instrumentDisplayName(symbol, market, descriptor.name),
        market,
        currency: text(row["币种"]).toUpperCase(),
      },
      side,
      executedAt,
      quantity,
      price,
      fee,
    });
  });

  return { records, diagnostics, blocked: false };
}
