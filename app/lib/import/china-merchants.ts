import { STATEMENT_FORMATS } from "./statement-formats";
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
import { fingerprintBytes } from "./file-fingerprint";
import { groupItemsIntoRows } from "./pdf-layout";
import { extractPdfPages, type PdfTextPage } from "./pdf-text";

import {
  readChinaMerchantsTable,
  hasChinaMerchantsTable,
} from "./china-merchants-table";

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
function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim();
}
export function detectChinaMerchantsStatement(
  pages: readonly PdfTextPage[],
): DetectionResult {
  const text = pages
    .flatMap((page) => page.items.map((item) => item.text))
    .join("")
    .replace(/\s/g, "");
  const hasBroker = text.includes("招商证券");
  const matched =
    hasBroker && text.includes("流水明细") && hasChinaMerchantsTable(pages);
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

function cmsMarket(label: string): ParsedInstrumentCandidate["market"] {
  if (/港股通|沪港通|深港通/.test(label)) return "HK";
  if (label.includes("上海") || label.includes("沪A")) return "CN-SH";
  if (label.includes("深圳") || label.includes("深A")) return "CN-SZ";
  throw new Error(`不支持的招商市场：${label}`);
}

function decimal(value: string | undefined): Decimal {
  const normalized = value?.replaceAll(",", "").trim();
  if (!normalized) throw new Error("missing number");
  const parsed = new Decimal(normalized);
  if (!parsed.isFinite()) throw new Error("non-finite number");
  return parsed;
}

function feeTotal(values: readonly string[]): string {
  return values
    .reduce((total, value) => total.plus(decimal(value).abs()), new Decimal(0))
    .toString();
}

function executionDate(dateText: string): string {
  const match = dateText.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) throw new Error("invalid date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new Error("invalid date");
  }
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T15:00:00+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error("invalid date");
  return date.toISOString();
}

function statementAccountReference(
  pages: readonly PdfTextPage[],
): string | undefined {
  const references = pages
    .flatMap((page) => groupItemsIntoRows(page.items, 2))
    .flatMap((row) => {
      const text = row.items
        .map((item) => item.text)
        .join("")
        .replace(/\s/g, "");
      const match = text.match(/资产账号\s*[:：]\s*([A-Z0-9-]{6,})/i);
      return match ? [match[1]] : [];
    });
  return new Set(references).size === 1 ? references[0] : undefined;
}

function maskedAccountId(
  pages: readonly PdfTextPage[],
  fileFingerprint: string,
): string {
  const reference =
    statementAccountReference(pages) ?? `file:${fileFingerprint}`;
  const masked = fingerprintBytes(
    new TextEncoder().encode(`china-merchants-account-v1:${reference}`),
  );
  return `china-merchants:${masked}`;
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
  if (obviousEtf(symbol, name)) return false;
  if (/基金|LOF/i.test(name ?? "")) return true;
  return /^(?:16|50)\d{4}$/.test(symbol);
}

function obviousEtf(symbol: string, name: string | undefined): boolean {
  if (/\bETF\b|交易型开放式指数基金/i.test(name ?? "")) return true;
  return /^(?:159\d{3}|(?:51|56|58)\d{4})$/.test(symbol);
}

function sourceAssetType(
  market: ParsedInstrumentCandidate["market"],
  symbol: string,
  name: string | undefined,
): NonNullable<ParsedInstrumentCandidate["sourceAssetType"]> {
  if (obviousEtf(symbol, name)) return "etf";
  if (market === "CN-SH" && /^(?:600|601|603|605|688|689)\d{3}$/.test(symbol)) {
    return "stock";
  }
  if (market === "CN-SZ" && /^(?:000|001|002|003|300|301)\d{3}$/.test(symbol)) {
    return "stock";
  }
  return "unknown";
}

function excludedFlowCategory(
  business: string,
): { category: ImportExclusion["category"]; label: string } | null {
  if (/产品|基金赎回/.test(business))
    return { category: "fund", label: "非交易所产品流水" };
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
      diagnostics: detection.diagnostics ?? [
        {
          severity: "error",
          code: "not-china-merchants-statement",
          message: "文件不是可识别的招商证券成交对账单",
        },
      ],
      blocked: true,
    };
  }

  if (!options.accountId && !statementAccountReference(pages)) {
    return {
      broker: "china-merchants",
      records: [],
      candidates: [],
      exclusions: [],
      blocked: true,
      diagnostics: [
        {
          severity: "error",
          code: "missing-china-merchants-account",
          message: "资产账号缺失或存在多个账号，无法安全归属交易",
        },
      ],
    };
  }
  const records: TradeExecution[] = [];
  const candidates = new Map<string, ParsedInstrumentCandidate>();
  const exclusions: ImportExclusion[] = [];
  const diagnostics: StatementParseResult["diagnostics"] = [];
  const statementAccountId =
    options.accountId ?? maskedAccountId(pages, options.fileFingerprint);

  for (const layoutRow of readChinaMerchantsTable(pages)) {
    const parsedIdentity = layoutRow.instrumentSymbol
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
      diagnostics.push({
        severity: "warning",
        code: "unknown-china-merchants-business",
        message: `未识别的业务「${layoutRow.business || "空白"}」，该行未导入`,
        page: layoutRow.page,
        row: layoutRow.row,
      });
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

    if (!/^(上海|深圳|沪A|深A)$/.test(layoutRow.marketLabel)) {
      addExclusion(
        exclusions,
        "market",
        "非境内 A股/ETF 市场",
        parsedIdentity.symbol,
      );
      continue;
    }
    if (obviousBond(parsedIdentity.symbol, parsedIdentity.sourceName)) {
      addExclusion(exclusions, "bond", "可转换债券", parsedIdentity.symbol);
      continue;
    }
    if (obviousFund(parsedIdentity.symbol, parsedIdentity.sourceName)) {
      addExclusion(exclusions, "fund", "非 ETF 基金", parsedIdentity.symbol);
      continue;
    }

    try {
      const market = cmsMarket(layoutRow.marketLabel);
      if (layoutRow.cells) {
        const cells = layoutRow.cells;
        const signedQuantity = decimal(cells.quantity);
        if (
          (side === "buy" && signedQuantity.lte(0)) ||
          (side === "sell" && signedQuantity.gte(0))
        )
          throw new Error("invalid quantity direction");
        if (
          [cells.commission, cells.stampDuty, cells.otherFee].some((value) =>
            decimal(value).lt(0),
          )
        )
          throw new Error("invalid negative fee");
        const fees = decimal(cells.commission)
          .plus(decimal(cells.stampDuty))
          .plus(decimal(cells.otherFee));
        const expected =
          side === "buy"
            ? decimal(cells.amount).abs().plus(fees).negated()
            : decimal(cells.amount).abs().minus(fees);
        if (decimal(cells.cashChange).minus(expected).abs().gt("0.01"))
          throw new Error("cash mismatch");
      }
      const symbol = canonicalInstrumentSymbol(parsedIdentity.symbol, market);
      const quantity = decimal(layoutRow.quantity).abs();
      const price = decimal(layoutRow.price).abs();
      const amount = decimal(layoutRow.amount).abs();
      if (quantity.lte(0) || price.lte(0) || amount.lte(0)) {
        throw new Error("invalid execution");
      }
      const assetType = sourceAssetType(
        market,
        symbol,
        parsedIdentity.sourceName,
      );
      if (assetType === "unknown") {
        addExclusion(
          exclusions,
          "unknown-asset",
          "无法确认是 A股或 ETF",
          symbol,
        );
        continue;
      }
      if (currencyCode(layoutRow.currencyLabel) !== "CNY")
        throw new Error("unsupported settlement currency");
      if (decimal(layoutRow.price).lte(0)) throw new Error("invalid price");
      const candidate: ParsedInstrumentCandidate = {
        market,
        symbol,
        sourceName: parsedIdentity.sourceName,
        sourceAssetType: assetType,
      };
      candidates.set(`${market}:${symbol}`, candidate);

      records.push({
        id: `china-merchants:${options.fileFingerprint}:${layoutRow.page}:${layoutRow.sourceOrder}`,
        source: {
          platform: "china-merchants",
          formatLabel: STATEMENT_FORMATS["china-merchants"].label,
          ...(layoutRow.cells
            ? {
                statementRowFingerprint: fingerprintBytes(
                  new TextEncoder().encode(
                    JSON.stringify([
                      layoutRow.cells.securityAccount,
                      layoutRow.dateText,
                      market,
                      symbol,
                      side,
                      ...[
                        layoutRow.quantity,
                        layoutRow.price,
                        layoutRow.amount,
                        layoutRow.commission,
                        layoutRow.stampDuty,
                        layoutRow.otherFee,
                        layoutRow.cells.cashChange,
                        layoutRow.cells.cashBalance,
                        layoutRow.cells.securityBalance,
                      ].map((value) => decimal(value).toString()),
                    ]),
                  ),
                ),
                settlement: {
                  currency: "CNY",
                  quantity: quantity.toString(),
                  grossAmount: amount.toString(),
                  netAmount: decimal(layoutRow.cells.cashChange).toString(),
                  fees: {
                    commission: decimal(layoutRow.commission).toString(),
                    stampDuty: decimal(layoutRow.stampDuty).toString(),
                    otherFee: decimal(layoutRow.otherFee).toString(),
                  },
                },
              }
            : {}),
          page: layoutRow.page,
          row: layoutRow.row,
          sourceOrder: layoutRow.sourceOrder,
          timePrecision: "date-only",
          fileName: options.fileName,
          fileFingerprint: options.fileFingerprint,
          sourceTimestampText: layoutRow.dateText,
          sourceTimezone: "Asia/Shanghai",
        },
        accountId: statementAccountId,
        accountLabel:
          options.accountLabel ??
          `招商证券 · 尾号${statementAccountReference(pages)?.slice(-4) ?? "未知"}`,
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
        fee: feeTotal([
          layoutRow.commission ?? "0",
          layoutRow.stampDuty ?? "0",
          layoutRow.otherFee ?? "0",
        ]),
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
        message: "交易字段缺失、格式错误或资金金额不平，已跳过该行",
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

export class ChinaMerchantsStatementParser implements BrokerStatementParser {
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
