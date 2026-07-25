import Decimal from "decimal.js";
import * as XLSX from "xlsx";

import type { TradeExecution, TradeSide } from "../trades/types";
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

function text(value: unknown) {
  return String(value ?? "").trim();
}

function decimal(value: unknown) {
  const normalized = text(value).replaceAll(",", "");
  return new Decimal(normalized || 0).abs().toString();
}

function normalizeTime(value: unknown) {
  const source = text(value);
  const isoLike = source.includes("T") ? source : source.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike)
    ? isoLike
    : `${isoLike}Z`;
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

function fingerprint(row: FutuRow) {
  return [
    text(row["账户号码"]),
    text(row["成交时间"]),
    text(row["代码名称"]),
    text(row["方向"]),
    decimal(row["数量/面值"]),
    decimal(row["价格"]),
  ].join("|");
}

export function parseFutuWorkbook(
  input: ArrayBuffer | Uint8Array,
): ImportResult<TradeExecution> {
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
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const sourceRow = index + 2;

    if (text(row["品类"]) !== "证券") {
      diagnostics.push({
        severity: "info",
        code: "unsupported-asset-class",
        message: `已跳过${text(row["品类"]) || "未知"}记录`,
        sheet: TRADE_SHEET,
        row: sourceRow,
      });
      return;
    }

    const side = sideFor(row["方向"]);
    const executedAt = normalizeTime(row["成交时间"]);
    if (!side || !executedAt) {
      diagnostics.push({
        severity: "warning",
        code: "invalid-trade-row",
        message: "成交方向或成交时间无法识别",
        sheet: TRADE_SHEET,
        row: sourceRow,
      });
      return;
    }

    const rowFingerprint = fingerprint(row);
    if (seen.has(rowFingerprint)) {
      diagnostics.push({
        severity: "warning",
        code: "duplicate-trade",
        message: "已跳过重复成交",
        sheet: TRADE_SHEET,
        row: sourceRow,
      });
      return;
    }
    seen.add(rowFingerprint);

    const accountId = text(row["账户号码"]);
    const symbol = text(row["代码名称"]).toUpperCase();
    const market = marketFor(row["交易所/市场"]);

    records.push({
      id: `futu:${accountId}:${symbol}:${executedAt}:${sourceRow}`,
      source: {
        platform: "futu",
        sheet: TRADE_SHEET,
        row: sourceRow,
      },
      accountId,
      accountLabel: accountLabel(row["账户名称"], accountId),
      instrument: {
        id: `${market}:${symbol}`,
        symbol,
        name: symbol,
        market,
        currency: text(row["币种"]).toUpperCase(),
      },
      side,
      executedAt,
      quantity: decimal(row["数量/面值"]),
      price: decimal(row["价格"]),
      fee: decimal(row["总费用"]),
    });
  });

  return { records, diagnostics, blocked: false };
}
