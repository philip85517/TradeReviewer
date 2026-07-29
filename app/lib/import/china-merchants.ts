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
import { extractPdfPages, type PdfTextPage } from "./pdf-text";

const BROKER_MARKER = "招商证券";
const FLOW_MARKER = "流水明细";
const TABLE_HEADERS = [
  "发生日期",
  "市场",
  "证券代码",
  "证券名称",
  "业务标志",
  "发生数量",
  "成交均价",
] as const;

const EXECUTION_SIDE: Record<string, TradeSide> = {
  证券买入: "buy",
  证券卖出: "sell",
};

type ChinaMerchantsParseOptions = {
  fileName: string;
  fileFingerprint: string;
  accountId?: string;
  accountLabel?: string;
};

type ExtractPages = (input: ArrayBuffer) => Promise<PdfTextPage[]>;

type StatementRow = {
  page: number;
  row: number;
  sourceOrder: number;
  dateText: string;
  marketLabel: string;
  instrumentSymbol?: string;
  instrumentName?: string;
  business: string;
  numericValues: string[];
  currencyLabel?: string;
};

type ParsedIdentity = {
  symbol: string;
  sourceName?: string;
};

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim();
}

function pageText(page: PdfTextPage): string {
  return page.items.map((item) => item.text).join(" ");
}

function rowText(row: PdfTextRow): string {
  return row.items.map((item) => item.text).join(" ");
}

function isSupportedHeader(row: PdfTextRow): boolean {
  const text = compact(rowText(row));
  return TABLE_HEADERS.every((label) => text.includes(label));
}

function normalizedBusiness(value: string): string {
  const text = compact(value);
  const execution = Object.keys(EXECUTION_SIDE).find((label) =>
    text.includes(label),
  );
  return execution ?? text;
}

export function detectChinaMerchantsStatement(
  pages: readonly PdfTextPage[],
): DetectionResult {
  const hasBroker = pages.some((page) =>
    pageText(page).includes(BROKER_MARKER),
  );
  const hasFlowMarker = pages.some((page) =>
    pageText(page).includes(FLOW_MARKER),
  );
  const hasHeader = pages.some((page) =>
    groupItemsIntoRows(page.items, 2).some(isSupportedHeader),
  );
  const matched = hasBroker && hasFlowMarker && hasHeader;

  return {
    matched,
    confidence: matched ? 1 : hasBroker ? 0.35 : 0,
    diagnostics:
      hasBroker && !matched
        ? [
            {
              severity: "error",
              code: "unsupported-china-merchants-layout",
              message: "已识别招商证券对账单，但当前流水表格结构暂不支持",
            },
          ]
        : undefined,
  };
}

function businessItem(row: PdfTextRow) {
  return row.items.find((item) => {
    if (item.x <= 250) return false;
    const text = compact(item.text);
    return (
      Object.keys(EXECUTION_SIDE).some((label) => text.includes(label)) ||
      /回购|购回|拆出|申购|认购|配售|配股|中签|银行|转入|转出|存入|取出|利息|费用|组合费|红利|红股|股息|分红|送股|入账|托管|冻结|解冻|指定|撤销|转换/.test(
        text,
      )
    );
  });
}

function numericTokens(value: string): string[] {
  return (
    value
      .replaceAll(",", "")
      .match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []
  );
}

function rowIdentity(
  row: PdfTextRow,
  dateItem: PdfTextRow["items"][number],
  business: PdfTextRow["items"][number],
  businessLabel: string,
): ParsedIdentity | null {
  const identityItems = row.items
    .filter(
      (item) =>
        item.x > dateItem.x &&
        item.x < business.x &&
        item.text.trim().length > 0,
    )
    .sort((left, right) => left.x - right.x);
  const nameItem = identityItems.at(-1);
  const combined = nameItem?.text
    .trim()
    .match(/^(\d{5,6})\s+(.+?)\s*$/);
  if (combined) {
    return { symbol: combined[1], sourceName: combined[2].trim() };
  }

  const symbols = identityItems.flatMap((item) =>
    [...item.text.matchAll(/(?:^|\s)(\d{5,6})(?=\s|$)/g)].map(
      (match) => match[1],
    ),
  );
  const symbol = symbols.at(-1);
  const businessText = business.text.trim();
  const embeddedName = businessText.endsWith(businessLabel)
    ? businessText.slice(0, -businessLabel.length).trim()
    : "";
  if (symbol && embeddedName) {
    return { symbol, sourceName: embeddedName };
  }
  if (!symbol || !nameItem || /\d{5,6}/.test(nameItem.text)) return null;
  const sourceName = nameItem.text.trim();
  return sourceName ? { symbol, sourceName } : null;
}

function positionedRows(pages: readonly PdfTextPage[]): StatementRow[] {
  const result: StatementRow[] = [];
  let inFlowSection = false;
  let sourceOrder = 0;

  for (const page of pages) {
    const rows = groupItemsIntoRows(page.items, 2);
    for (const row of rows) {
      const text = rowText(row);
      if (text.includes(FLOW_MARKER)) {
        inFlowSection = true;
        continue;
      }
      if (!inFlowSection || isSupportedHeader(row)) continue;

      const dateItem = row.items.find((item) =>
        /^\s*\d{8}\s+\S+/.test(item.text),
      );
      if (!dateItem) continue;
      const dateMatch = dateItem.text
        .trim()
        .match(/^(\d{8})\s+(.+?)\s*$/);
      if (!dateMatch) continue;

      const business = businessItem(row);
      if (!business) continue;
      const businessLabel = normalizedBusiness(business.text);
      const parsedIdentity = rowIdentity(
        row,
        dateItem,
        business,
        businessLabel,
      );
      const numericValues = row.items
        .filter((item) => item.x > business.x)
        .sort((left, right) => left.x - right.x)
        .flatMap((item) => numericTokens(item.text));
      const currencyItem = row.items.find(
        (item) =>
          item.x > dateItem.x &&
          item.x < business.x &&
          /人民币|港币|美元|CNY|HKD|USD/i.test(item.text),
      );

      result.push({
        page: page.pageNumber,
        row: Math.round(row.y),
        sourceOrder,
        dateText: dateMatch[1],
        marketLabel: dateMatch[2].trim(),
        instrumentSymbol: parsedIdentity?.symbol,
        instrumentName: parsedIdentity?.sourceName,
        business: businessLabel,
        numericValues,
        currencyLabel: currencyItem?.text,
      });
      sourceOrder += 1;
    }
  }

  return result;
}

function cmsMarket(
  label: string,
): ParsedInstrumentCandidate["market"] {
  if (/港股通|沪港通|深港通/.test(label)) return "HK";
  if (label.includes("上海") || label.includes("沪A")) return "CN-SH";
  if (label.includes("深圳") || label.includes("深A")) return "CN-SZ";
  throw new Error(`不支持的招商市场：${label}`);
}

function decimal(value: string | undefined): Decimal {
  const normalized = value?.replaceAll(",", "").trim();
  if (!normalized) throw new Error("missing number");
  return new Decimal(normalized);
}

function feeTotal(values: readonly string[]): string {
  return values
    .reduce(
      (total, value) => total.plus(decimal(value).abs()),
      new Decimal(0),
    )
    .toString();
}

function executionDate(dateText: string): string {
  const match = dateText.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) throw new Error("invalid date");
  const date = new Date(
    `${match[1]}-${match[2]}-${match[3]}T15:00:00+08:00`,
  );
  if (Number.isNaN(date.getTime())) throw new Error("invalid date");
  return date.toISOString();
}

function currencyCode(label: string | undefined): string {
  const normalized = compact(label).toUpperCase();
  if (normalized.includes("人民币") || normalized.includes("CNY")) return "CNY";
  if (normalized.includes("港币") || normalized.includes("HKD")) return "HKD";
  if (normalized.includes("美元") || normalized.includes("USD")) return "USD";
  return "";
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

function obviousBond(symbol: string, name: string | undefined): boolean {
  if (/转债|轉債|发债|發債/.test(name ?? "")) return true;
  return /^(?:110|111|113|118|123|127|128)\d{3}$/.test(symbol);
}

function obviousFund(symbol: string, name: string | undefined): boolean {
  if (/\bETF\b/i.test(name ?? "")) return false;
  if (/基金|LOF/i.test(name ?? "")) return true;
  return /^(?:16|50)\d{4}$/.test(symbol);
}

function obviousEtf(symbol: string, name: string | undefined): boolean {
  if (/\bETF\b|交易型开放式指数基金/i.test(name ?? "")) return true;
  return /^(?:15|51|56|58)\d{4}$/.test(symbol);
}

function excludedFlowCategory(
  business: string,
): { category: ImportExclusion["category"]; label: string } | null {
  if (/回购|购回|拆出/.test(business)) {
    return { category: "repo", label: "质押式回购" };
  }
  if (/申购|认购|配售|配股|中签/.test(business)) {
    return { category: "subscription", label: "申购及配售" };
  }
  if (/红利|红股|股息|分红|送股|入账|托管|冻结|解冻/.test(business)) {
    return { category: "corporate-action", label: "公司行动" };
  }
  if (/银行|转入|转出|存入|取出|利息|费用|组合费/.test(business)) {
    return { category: "cash", label: "资金流水" };
  }
  return null;
}

export function parseChinaMerchantsPages(
  pages: readonly PdfTextPage[],
  options: ChinaMerchantsParseOptions,
): StatementParseResult {
  const detection = detectChinaMerchantsStatement(pages);
  if (!detection.matched) {
    return {
      broker: "china-merchants",
      records: [],
      candidates: [],
      exclusions: [],
      diagnostics:
        detection.diagnostics ?? [
          {
            severity: "error",
            code: "not-china-merchants-statement",
            message: "文件不是可识别的招商证券成交对账单",
          },
        ],
      blocked: true,
    };
  }

  const records: TradeExecution[] = [];
  const candidates = new Map<string, ParsedInstrumentCandidate>();
  const exclusions: ImportExclusion[] = [];
  const diagnostics: StatementParseResult["diagnostics"] = [];

  for (const layoutRow of positionedRows(pages)) {
    const parsedIdentity =
      layoutRow.instrumentSymbol && layoutRow.instrumentName
        ? {
            symbol: layoutRow.instrumentSymbol,
            sourceName: layoutRow.instrumentName,
          }
        : null;
    const knownFlow = excludedFlowCategory(layoutRow.business);
    if (knownFlow) {
      addExclusion(
        exclusions,
        knownFlow.category,
        knownFlow.label,
        parsedIdentity?.symbol,
      );
      continue;
    }

    const side = EXECUTION_SIDE[layoutRow.business];
    if (!side) {
      addExclusion(exclusions, "invalid-row", "非成交证券流水");
      continue;
    }
    if (!parsedIdentity) {
      addExclusion(exclusions, "invalid-row", "证券代码或名称无法识别");
      diagnostics.push({
        severity: "warning",
        code: "invalid-china-merchants-instrument",
        message: "证券代码或名称无法识别，已跳过该行",
        page: layoutRow.page,
        row: layoutRow.row,
        sourceOrder: layoutRow.sourceOrder,
      });
      continue;
    }

    if (obviousBond(parsedIdentity.symbol, parsedIdentity.sourceName)) {
      addExclusion(
        exclusions,
        "bond",
        "可转换债券",
        parsedIdentity.symbol,
      );
      continue;
    }
    if (obviousFund(parsedIdentity.symbol, parsedIdentity.sourceName)) {
      addExclusion(
        exclusions,
        "fund",
        "非 ETF 基金",
        parsedIdentity.symbol,
      );
      continue;
    }

    try {
      const market = cmsMarket(layoutRow.marketLabel);
      const symbol = canonicalInstrumentSymbol(
        parsedIdentity.symbol,
        market,
      );
      const quantity = decimal(layoutRow.numericValues[0]).abs();
      const price = decimal(layoutRow.numericValues[1]).abs();
      if (quantity.lte(0) || price.lte(0)) {
        throw new Error("invalid execution");
      }
      const sourceAssetType = obviousEtf(
        symbol,
        parsedIdentity.sourceName,
      )
        ? "etf"
        : "stock";
      const candidate: ParsedInstrumentCandidate = {
        market,
        symbol,
        sourceName: parsedIdentity.sourceName,
        sourceAssetType,
      };
      candidates.set(`${market}:${symbol}`, candidate);

      records.push({
        id: `china-merchants:${options.fileFingerprint}:${layoutRow.page}:${layoutRow.sourceOrder}`,
        source: {
          platform: "china-merchants",
          page: layoutRow.page,
          row: layoutRow.row,
          sourceOrder: layoutRow.sourceOrder,
          timePrecision: "date-only",
          fileName: options.fileName,
          fileFingerprint: options.fileFingerprint,
          sourceTimestampText: layoutRow.dateText,
          sourceTimezone: "Asia/Shanghai",
        },
        accountId: options.accountId ?? "china-merchants",
        accountLabel: options.accountLabel ?? "招商证券账户",
        instrument: {
          id: canonicalInstrumentId(symbol, market),
          symbol,
          name: instrumentDisplayName(
            symbol,
            market,
            parsedIdentity.sourceName,
          ),
          market,
          currency: currencyCode(layoutRow.currencyLabel),
        },
        side,
        executedAt: executionDate(layoutRow.dateText),
        quantity: quantity.toString(),
        price: price.toString(),
        fee: feeTotal(layoutRow.numericValues.slice(3, 6)),
      });
    } catch {
      addExclusion(
        exclusions,
        "invalid-row",
        "成交数量、价格、费用、日期或市场无法识别",
        parsedIdentity.symbol,
      );
      diagnostics.push({
        severity: "warning",
        code: "invalid-china-merchants-trade-row",
        message: "成交数量、价格、费用、日期或市场无法识别，已跳过该行",
        page: layoutRow.page,
        row: layoutRow.row,
        sourceOrder: layoutRow.sourceOrder,
        instrumentSymbol: parsedIdentity.symbol,
      });
    }
  }

  return {
    broker: "china-merchants",
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

export class ChinaMerchantsStatementParser
  implements BrokerStatementParser
{
  constructor(private readonly extractPages: ExtractPages = extractPdfPages) {}

  async detect(input: StatementInput): Promise<DetectionResult> {
    return detectChinaMerchantsStatement(
      await this.extractPages(asArrayBuffer(input.bytes)),
    );
  }

  async parse(input: StatementInput): Promise<StatementParseResult> {
    return parseChinaMerchantsPages(
      await this.extractPages(asArrayBuffer(input.bytes)),
      {
        fileName: input.fileName,
        fileFingerprint: input.fileFingerprint,
      },
    );
  }
}
