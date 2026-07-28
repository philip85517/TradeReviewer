import Decimal from "decimal.js";

import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
  instrumentDisplayName,
} from "../instruments/display-name";
import type { TradeExecution, TradeSide } from "../trades/types";
import type {
  BrokerStatementParser,
  DetectionResult,
  ImportExclusion,
  ParsedInstrumentCandidate,
  StatementInput,
  StatementParseResult,
} from "./contracts";
import { groupItemsIntoRows, type PdfTextRow } from "./pdf-layout";
import {
  extractPdfPages,
  type PdfTextPage,
} from "./pdf-text";

const TIGER_HEADING = "Tiger Brokers (NZ) Limited";
const REQUIRED_HEADER_FIELDS = [
  "code",
  "direction",
  "quantity",
  "price",
  "executedAt",
] as const;

const SIDE_BY_LABEL: Record<string, TradeSide> = {
  买入: "buy",
  开仓做多: "buy",
  平仓空头: "buy",
  卖出: "sell",
  平仓多头: "sell",
  开仓做空: "sell",
};

type HeaderField =
  | "code"
  | "name"
  | "market"
  | "assetType"
  | "direction"
  | "quantity"
  | "price"
  | "fee"
  | "currency"
  | "executedAt"
  | "settlementDate";

type HeaderColumn = {
  field: HeaderField;
  x: number;
};

type TigerParseOptions = {
  fileName: string;
  fileFingerprint: string;
  accountId?: string;
  accountLabel?: string;
};

type ExtractPages = (input: ArrayBuffer) => Promise<PdfTextPage[]>;

type ParsedLayoutRow = {
  page: number;
  row: number;
  sourceOrder: number;
  cells: Partial<Record<HeaderField, string>>;
  section: "stock" | "fund";
};

type ParsedIdentity = {
  market: ParsedInstrumentCandidate["market"];
  symbol: string;
  name?: string;
};

const HEADER_ALIASES: Record<HeaderField, readonly string[]> = {
  code: ["证券代码", "股票代码", "代码"],
  name: ["证券名称", "股票名称", "名称"],
  market: ["市场", "交易市场"],
  assetType: ["证券类型", "产品类型", "资产类型"],
  direction: ["交易类型", "买卖方向", "方向", "买卖"],
  quantity: ["成交数量", "数量"],
  price: ["成交价格", "价格"],
  fee: ["佣金及费用", "总费用", "费用", "手续费"],
  currency: ["币种", "货币"],
  executedAt: ["成交时间", "执行时间", "交易时间"],
  settlementDate: ["交收日期", "结算日期"],
};

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim();
}

function pageText(page: PdfTextPage): string {
  return page.items.map((item) => item.text).join(" ");
}

function fieldForHeader(text: string): HeaderField | undefined {
  const normalized = compact(text);
  return (Object.entries(HEADER_ALIASES) as Array<
    [HeaderField, readonly string[]]
  >).find(([, aliases]) =>
    aliases.some(
      (alias) => normalized === alias || normalized.includes(alias),
    ),
  )?.[0];
}

function headerColumns(row: PdfTextRow): HeaderColumn[] | null {
  const columns = row.items.flatMap((item) => {
    const field = fieldForHeader(item.text);
    return field ? [{ field, x: item.x }] : [];
  });
  const fields = new Set(columns.map((column) => column.field));

  return REQUIRED_HEADER_FIELDS.every((field) => fields.has(field))
    ? columns.sort((left, right) => left.x - right.x)
    : null;
}

function isStockSection(text: string): boolean {
  const normalized = compact(text).toLowerCase();
  return (
    normalized.includes("股票交易") ||
    normalized.includes("证券交易") ||
    normalized === "stocks" ||
    normalized.includes("stocktransactions")
  );
}

function isFundSection(text: string): boolean {
  const normalized = compact(text).toLowerCase();
  return (
    normalized.includes("基金交易") ||
    normalized === "funds" ||
    normalized.includes("fundtransactions")
  );
}

export function detectTigerStatement(
  pages: readonly PdfTextPage[],
): DetectionResult {
  const hasHeading = pages.some((page) =>
    pageText(page).includes(TIGER_HEADING),
  );
  let stockSection = false;
  let hasStockTable = false;
  for (const page of pages) {
    for (const row of groupItemsIntoRows(page.items, 2)) {
      const text = row.items.map((item) => item.text).join(" ");
      if (isStockSection(text)) stockSection = true;
      if (isFundSection(text)) stockSection = false;
      if (stockSection && headerColumns(row)) {
        hasStockTable = true;
        break;
      }
    }
    if (hasStockTable) break;
  }

  return {
    matched: hasHeading && hasStockTable,
    confidence: hasHeading && hasStockTable ? 1 : hasHeading ? 0.35 : 0,
  };
}

function rowCells(
  row: PdfTextRow,
  columns: readonly HeaderColumn[],
): Partial<Record<HeaderField, string>> {
  const parts = new Map<HeaderField, string[]>();

  for (const item of row.items) {
    let closest: HeaderColumn | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const column of columns) {
      const distance = Math.abs(item.x - column.x);
      if (distance < closestDistance) {
        closest = column;
        closestDistance = distance;
      }
    }
    const value = item.text.trim();
    if (!closest || !value) continue;
    const existing = parts.get(closest.field) ?? [];
    existing.push(value);
    parts.set(closest.field, existing);
  }

  return Object.fromEntries(
    [...parts].map(([field, values]) => [field, values.join(" ")]),
  );
}

function positionedRows(pages: readonly PdfTextPage[]): ParsedLayoutRow[] {
  const result: ParsedLayoutRow[] = [];
  let sourceOrder = 0;
  let section: "stock" | "fund" | null = null;

  for (const page of pages) {
    const rows = groupItemsIntoRows(page.items, 2);
    let columns: HeaderColumn[] | null = null;

    rows.forEach((row, rowIndex) => {
      const text = row.items.map((item) => item.text).join(" ");
      if (isStockSection(text)) {
        section = "stock";
        columns = null;
        return;
      }
      if (isFundSection(text)) {
        section = "fund";
        columns = null;
        return;
      }

      const possibleHeader = headerColumns(row);
      if (possibleHeader && section) {
        columns = possibleHeader;
        return;
      }
      if (!section || !columns) return;
      if (/第\s*\d+\s*页|Page\s+\d+/i.test(text)) return;

      const cells = rowCells(row, columns);
      if (!Object.values(cells).some(Boolean)) return;
      sourceOrder += 1;
      result.push({
        page: page.pageNumber,
        row: rowIndex + 1,
        sourceOrder,
        cells,
        section,
      });
    });
  }

  return result;
}

function decimal(value: string | undefined): Decimal {
  const normalized = (value ?? "")
    .replaceAll(",", "")
    .replace(/[()]/g, "")
    .trim();
  if (!normalized) throw new Error("missing number");
  return new Decimal(normalized);
}

function totalFee(value: string | undefined): string {
  if (!value?.trim()) return "0";
  const matches = value.replaceAll(",", "").match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g);
  if (!matches) throw new Error("invalid fee");
  return matches
    .reduce((total, part) => total.plus(new Decimal(part).abs()), new Decimal(0))
    .toString();
}

function sideFor(
  labelValue: string | undefined,
  signedQuantity: Decimal,
): TradeSide | null {
  const label = compact(labelValue);
  for (const [knownLabel, side] of Object.entries(SIDE_BY_LABEL)) {
    if (label === knownLabel || label.includes(knownLabel)) return side;
  }
  if (label.includes("开仓") || label.includes("平仓")) {
    if (signedQuantity.isPositive()) return "buy";
    if (signedQuantity.isNegative()) return "sell";
  }
  return null;
}

function parseIdentity(
  codeValue: string | undefined,
  nameValue: string | undefined,
  marketValue: string | undefined,
  currencyValue: string | undefined,
): ParsedIdentity | null {
  const sourceCode = codeValue?.trim() ?? "";
  let inferredName = nameValue?.trim() || undefined;
  let rawCode = compact(sourceCode).toUpperCase();
  if (!rawCode) return null;
  let marketText = compact(marketValue).toUpperCase();
  let symbol = rawCode;

  const combinedSuffix = sourceCode.match(
    /^(.+?)\s+[（(]?((?:HK|US|SH|SZ)[.: -]?[A-Z0-9.-]+|[A-Z0-9.-]+(?:[.:-](?:HK|US|SH|SZ))?|[A-Z]{1,8}|\d{4,6})[）)]?$/i,
  );
  const combinedPrefix = sourceCode.match(
    /^[（(]?((?:HK|US|SH|SZ)[.: -]?[A-Z0-9.-]+|[A-Z0-9.-]+(?:[.:-](?:HK|US|SH|SZ))?|[A-Z]{1,8}|\d{4,6})[）)]?\s+(.+)$/i,
  );
  if (combinedSuffix) {
    inferredName ||= combinedSuffix[1].trim();
    rawCode = compact(combinedSuffix[2]).toUpperCase();
    symbol = rawCode;
  } else if (combinedPrefix) {
    rawCode = compact(combinedPrefix[1]).toUpperCase();
    symbol = rawCode;
    inferredName ||= combinedPrefix[2].trim();
  }

  const prefixed = rawCode.match(/^(HK|US|SH|SZ)[.: -]?([A-Z0-9.-]+)$/);
  const suffixed = rawCode.match(/^([A-Z0-9.-]+)[.:-](HK|US|SH|SZ)$/);
  if (prefixed) {
    marketText ||= prefixed[1];
    symbol = prefixed[2];
  } else if (suffixed) {
    symbol = suffixed[1];
    marketText ||= suffixed[2];
  }

  let market: ParsedIdentity["market"];
  if (marketText.includes("HK") || marketText.includes("港")) market = "HK";
  else if (marketText.includes("US") || marketText.includes("美")) market = "US";
  else if (marketText.includes("SH") || marketText.includes("沪")) market = "CN-SH";
  else if (marketText.includes("SZ") || marketText.includes("深")) market = "CN-SZ";
  else {
    const currency = compact(currencyValue).toUpperCase();
    if (currency === "HKD" || /^\d{4,6}$/.test(symbol)) market = "HK";
    else if (currency === "USD" || /^[A-Z][A-Z0-9.-]*$/.test(symbol)) market = "US";
    else return null;
  }

  return {
    market,
    symbol: canonicalInstrumentSymbol(symbol, market),
    name: inferredName,
  };
}

function timestamp(
  value: string | undefined,
): { iso: string; timezone: string } | null {
  const source = value?.trim() ?? "";
  const match = source.match(
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2})[ T](\d{1,2}:\d{2}:\d{2})\s*(.+)$/,
  );
  if (!match) return null;
  const zoneText = match[3].trim();
  let offset: string;
  const numericZone = zoneText.match(/^(?:GMT|UTC)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (numericZone) {
    offset = `${numericZone[1]}${numericZone[2].padStart(2, "0")}:${numericZone[3] ?? "00"}`;
  } else if (/^(?:GMT|UTC|Z)$/i.test(zoneText)) {
    offset = "Z";
  } else if (/^(?:HKT|Asia\/(?:Hong_Kong|Shanghai))$/i.test(zoneText)) {
    offset = "+08:00";
  } else {
    return null;
  }
  const isoLike = `${match[1].replaceAll("/", "-")}T${match[2]}${offset}`;
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime())
    ? null
    : { iso: parsed.toISOString(), timezone: zoneText };
}

function addExclusion(
  exclusions: ImportExclusion[],
  category: ImportExclusion["category"],
  label: string,
  instrumentSymbol?: string,
) {
  const existing = exclusions.find(
    (item) =>
      item.category === category &&
      item.label === label &&
      item.instrumentSymbol === instrumentSymbol,
  );
  if (existing) existing.count += 1;
  else exclusions.push({ category, label, count: 1, instrumentSymbol });
}

function duplicateLayoutKey(cells: ParsedLayoutRow["cells"]): string {
  return JSON.stringify([
    compact(cells.direction),
    compact(cells.quantity),
    compact(cells.price),
    compact(cells.fee),
    compact(cells.executedAt),
    compact(cells.settlementDate),
    compact(cells.currency),
  ]);
}

export function parseTigerPages(
  pages: readonly PdfTextPage[],
  options: TigerParseOptions,
): StatementParseResult {
  const detection = detectTigerStatement(pages);
  if (!detection.matched) {
    return {
      broker: "tiger",
      records: [],
      candidates: [],
      exclusions: [],
      diagnostics: [
        {
          severity: "error",
          code: "not-tiger-statement",
          message: "文件不是可识别的 Tiger 股票成交对账单",
        },
      ],
      blocked: true,
    };
  }

  const records: TradeExecution[] = [];
  const candidates = new Map<string, ParsedInstrumentCandidate>();
  const exclusions: ImportExclusion[] = [];
  const diagnostics: StatementParseResult["diagnostics"] = [];
  let previous:
    | {
        page: number;
        sourceOrder: number;
        identity: ParsedIdentity;
        layoutKey: string;
      }
    | undefined;

  for (const layoutRow of positionedRows(pages)) {
    const { cells } = layoutRow;
    const identityBlank = !compact(cells.code) && !compact(cells.name);
    const immediatelyAdjacent =
      previous &&
      previous.page === layoutRow.page &&
      previous.sourceOrder + 1 === layoutRow.sourceOrder;
    if (
      identityBlank &&
      immediatelyAdjacent &&
      previous?.layoutKey === duplicateLayoutKey(cells)
    ) {
      previous = undefined;
      continue;
    }

    if (layoutRow.section === "fund") {
      addExclusion(
        exclusions,
        "fund",
        cells.name?.trim() || "基金交易",
        cells.code?.trim(),
      );
      previous = undefined;
      continue;
    }

    const identity = parseIdentity(
      cells.code,
      cells.name,
      cells.market,
      cells.currency,
    );
    if (!identity) {
      addExclusion(exclusions, "invalid-row", "证券代码或市场无法识别");
      diagnostics.push({
        severity: "warning",
        code: "invalid-tiger-instrument",
        message: "证券代码或市场无法识别，已跳过该行",
        page: layoutRow.page,
        row: layoutRow.row,
        sourceOrder: layoutRow.sourceOrder,
      });
      previous = undefined;
      continue;
    }

    try {
      const signedQuantity = decimal(cells.quantity);
      const quantity = signedQuantity.abs();
      const price = decimal(cells.price).abs();
      const side = sideFor(cells.direction, signedQuantity);
      const executionTime = timestamp(cells.executedAt);
      if (quantity.lte(0) || price.lte(0) || !side || !executionTime) {
        throw new Error("invalid execution");
      }

      const assetLabel = `${cells.assetType ?? ""} ${identity.name ?? ""}`;
      const sourceAssetType = /\bETF\b|交易所交易基金/i.test(assetLabel)
        ? "etf"
        : "stock";
      const candidate: ParsedInstrumentCandidate = {
        market: identity.market,
        symbol: identity.symbol,
        sourceName: identity.name,
        sourceAssetType,
      };
      candidates.set(`${candidate.market}:${candidate.symbol}`, candidate);

      records.push({
        id: `tiger:${options.fileFingerprint}:${layoutRow.page}:${layoutRow.sourceOrder}`,
        source: {
          platform: "tiger",
          page: layoutRow.page,
          row: layoutRow.row,
          sourceOrder: layoutRow.sourceOrder,
          timePrecision: "second",
          fileName: options.fileName,
          fileFingerprint: options.fileFingerprint,
          sourceTimestampText: cells.executedAt?.trim(),
          sourceTimezone: executionTime.timezone,
        },
        accountId: options.accountId ?? "tiger",
        accountLabel: options.accountLabel ?? "Tiger 账户",
        instrument: {
          id: canonicalInstrumentId(identity.symbol, identity.market),
          symbol: identity.symbol,
          name: instrumentDisplayName(
            identity.symbol,
            identity.market,
            identity.name,
          ),
          market: identity.market,
          currency: compact(cells.currency).toUpperCase(),
        },
        side,
        executedAt: executionTime.iso,
        quantity: quantity.toString(),
        price: price.toString(),
        fee: totalFee(cells.fee),
      });
      previous = {
        page: layoutRow.page,
        sourceOrder: layoutRow.sourceOrder,
        identity,
        layoutKey: duplicateLayoutKey(cells),
      };
    } catch {
      addExclusion(
        exclusions,
        "invalid-row",
        "成交方向、数量、价格、费用或时间无法识别",
        identity.symbol,
      );
      diagnostics.push({
        severity: "warning",
        code: "invalid-tiger-trade-row",
        message: "成交方向、数量、价格、费用或时间无法识别，已跳过该行",
        page: layoutRow.page,
        row: layoutRow.row,
        sourceOrder: layoutRow.sourceOrder,
        instrumentSymbol: identity.symbol,
      });
      previous = undefined;
    }
  }

  return {
    broker: "tiger",
    records,
    candidates: [...candidates.values()],
    exclusions,
    diagnostics,
    blocked: false,
  };
}

function asArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.slice().buffer;
}

export class TigerStatementParser implements BrokerStatementParser {
  constructor(private readonly extractPages: ExtractPages = extractPdfPages) {}

  async detect(input: StatementInput): Promise<DetectionResult> {
    return detectTigerStatement(
      await this.extractPages(asArrayBuffer(input.bytes)),
    );
  }

  async parse(input: StatementInput): Promise<StatementParseResult> {
    return parseTigerPages(
      await this.extractPages(asArrayBuffer(input.bytes)),
      {
        fileName: input.fileName,
        fileFingerprint: input.fileFingerprint,
      },
    );
  }
}
