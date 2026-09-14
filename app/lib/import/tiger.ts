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
import type { StatementFragment, StatementTimeOptions } from "./monthly-statement";
import { resolveStatementTime, STATEMENT_TIME_RULE_VERSION } from "./statement-time";

const TIGER_HEADING = /Tiger\s+Brokers\s+(?:\(NZ\)\s*)?Limited/i;
const REQUIRED_HEADER_FIELDS = [
  "code",
  "direction",
  "quantity",
  "price",
  "executedAt",
] as const;

const SIDE_BY_LABEL: Record<string, TradeSide> = {
  买入: "buy",
  買入: "buy",
  开仓做多: "buy",
  開倉做多: "buy",
  平仓空头: "buy",
  平倉空頭: "buy",
  卖出: "sell",
  賣出: "sell",
  平仓多头: "sell",
  平倉多頭: "sell",
  开仓做空: "sell",
  開倉做空: "sell",
};

type HeaderField =
  | "code"
  | "name"
  | "market"
  | "exchange"
  | "assetType"
  | "direction"
  | "quantity"
  | "multiplier"
  | "price"
  | "amount"
  | "interest"
  | "fee"
  | "realized"
  | "description"
  | "currency"
  | "executedAt"
  | "settlementDate";

type HeaderColumn = {
  field: HeaderField;
  x: number;
};

export type TigerParseOptions = StatementTimeOptions & {
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
  fragments: StatementFragment[];
};

type ParsedIdentity = {
  market: ParsedInstrumentCandidate["market"];
  symbol: string;
  name?: string;
};

type FeeBlock = {
  firstPage: number;
  lastPage: number;
  firstY: number;
  lastY: number;
  lines: string[];
};

type PrintedFeeTotal = {
  page: number;
  row: number;
  currency: string;
  value?: string;
};

type PositionEffect = NonNullable<TradeExecution["source"]["positionEffect"]>;

type TigerPositionEffectEvidence = {
  kind: "explicit" | "inferred";
  confidence: "high" | "medium";
  reason: string;
  sourceLabel?: string;
  realizedPnl?: string;
  fragments?: Array<{ page: number; row: number; role?: string }>;
};

type TigerTradeSource = TradeExecution["source"] & {
  positionEffectEvidence?: TigerPositionEffectEvidence;
  statementRealizedPnl?: string;
};

const HEADER_ALIASES: Record<HeaderField, readonly string[]> = {
  code: ["代碼", "证券代码", "股票代码", "代码"],
  name: ["证券名称", "股票名称", "名称"],
  market: ["市場", "市场", "交易市场"],
  exchange: ["交易所"],
  assetType: ["證券類型", "证券类型", "产品类型", "资产类型"],
  direction: ["交易類型", "交易类型", "买卖方向", "方向", "买卖"],
  quantity: ["數量", "成交数量", "数量"],
  multiplier: ["乘数", "乘數"],
  price: ["交易價格", "交易价格", "成交價格", "成交价格", "价格"],
  amount: ["成交額", "成交额"],
  interest: ["成交應計利息", "成交应计利息"],
  fee: ["佣金/稅", "佣金/税", "佣金及费用", "总费用", "费用", "手续费"],
  realized: ["已實現的損益", "已实现的损益"],
  description: ["說明", "说明"],
  currency: ["幣種", "币种", "货币"],
  executedAt: ["成交時間", "成交时间", "执行时间", "交易时间"],
  settlementDate: ["交收日期", "結算日期", "结算日期"],
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
    return field ? [{ field, x: item.x + item.width / 2 }] : [];
  });
  const fields = new Set(columns.map((column) => column.field));

  return REQUIRED_HEADER_FIELDS.every((field) => fields.has(field))
    ? columns.sort((left, right) => left.x - right.x)
    : null;
}

function isStockSection(text: string): boolean {
  const normalized = compact(text).toLowerCase();
  return (
    normalized === "股票" ||
    normalized.includes("股票交易") ||
    normalized.includes("证券交易") ||
    normalized === "stocks" ||
    normalized.includes("stocktransactions")
  );
}

function isFundSection(text: string): boolean {
  const normalized = compact(text).toLowerCase();
  return (
    normalized === "基金" ||
    normalized.includes("基金交易") ||
    normalized === "funds" ||
    normalized.includes("fundtransactions")
  );
}

export function detectTigerStatement(
  pages: readonly PdfTextPage[],
): DetectionResult {
  const hasHeading = pages.some((page) =>
    TIGER_HEADING.test(pageText(page)),
  );
  let stockSection = false;
  let hasStockTable = false;
  let hasTradeSchemaHint = false;
  for (const page of pages) {
    for (const row of groupItemsIntoRows(page.items, 2)) {
      const text = row.items.map((item) => item.text).join(" ");
      if (isStockSection(text)) stockSection = true;
      const fields = new Set(
        row.items.map(item => fieldForHeader(item.text)).filter(Boolean),
      );
      if (stockSection && (fields.has("direction") || fields.has("executedAt")) && fields.size >= 3) {
        hasTradeSchemaHint = true;
      }
      if (/股票交易|证券交易|stocktransactions/i.test(compact(text))) {
        hasTradeSchemaHint = true;
      }
      if (isFundSection(text)) stockSection = false;
      if (stockSection && headerColumns(row)) {
        hasStockTable = true;
        break;
      }
    }
    if (hasStockTable) break;
  }

  const documentedEmpty = !hasTradeSchemaHint && Boolean(statementMonth(pages)) &&
    pages.some(page => /账户总览|賬戶總覽|帳戶總覽/.test(pageText(page)));
  return {
    matched: hasHeading && (hasStockTable || documentedEmpty),
    confidence: hasHeading && (hasStockTable || documentedEmpty) ? 1 : hasHeading ? 0.35 : 0,
    diagnostics:
      hasHeading && !hasStockTable && !documentedEmpty
        ? [
            {
              severity: "error",
              code: "unsupported-tiger-layout",
              message: "已识别 Tiger 对账单，但当前表格结构暂不支持",
            },
          ]
        : undefined,
  };
}

function rowCells(
  row: PdfTextRow,
  columns: readonly HeaderColumn[],
): Partial<Record<HeaderField, string>> {
  const parts = new Map<HeaderField, string[]>();

  for (const item of row.items) {
    const closest = closestColumn(item, columns);
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

function closestColumn(
  item: PdfTextPage["items"][number],
  columns: readonly HeaderColumn[],
): HeaderColumn | undefined {
  let closest: HeaderColumn | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  const itemCenter = item.x + item.width / 2;
  for (const column of columns) {
    const distance = Math.abs(itemCenter - column.x);
    if (distance < closestDistance) {
      closest = column;
      closestDistance = distance;
    }
  }
  return closest;
}

function isExecutionAnchor(
  row: PdfTextRow,
  columns: readonly HeaderColumn[],
): boolean {
  const cells = rowCells(row, columns);
  if (/^(?:合计|合計|总计|總計|小计|小計|total)/i.test(compact(cells.code))) return false;
  const numeric = (value: string | undefined) => /^[+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)$/.test(compact(value));
  return Boolean(
      (numeric(cells.quantity) || numeric(cells.price)) &&
      (compact(cells.market) ||
        compact(cells.code) ||
        compact(cells.currency)),
  );
}

function logicalRowsForSegment(
  page: PdfTextPage,
  items: readonly PdfTextPage["items"][number][],
  columns: readonly HeaderColumn[],
  section: "stock" | "fund",
  headerY: number,
  endY: number,
  sourceOrderStart: number,
): ParsedLayoutRow[] {
  const usableEnd = Math.min(endY, page.height - 35);
  const segmentItems = items.filter(
    (item) => item.y > headerY + 2 && item.y < usableEnd,
  );
  const anchors = groupItemsIntoRows(segmentItems, 2)
    .filter((row) => isExecutionAnchor(row, columns))
    .map((row) => row.y);

  return anchors.map((anchorY, index) => {
    const lower =
      index === 0 ? headerY + 2 : (anchors[index - 1] + anchorY) / 2;
    const upper =
      index === anchors.length - 1
        ? usableEnd
        : (anchorY + anchors[index + 1]) / 2;
    const logicalItems = segmentItems.filter(
      (item) => {
        if (item.y < lower || item.y >= upper) return false;
        const field = closestColumn(item, columns)?.field;
        const distance = item.y - anchorY;
        if (field === "code" || field === "name" || field === "executedAt") {
          return Math.abs(distance) <= 14;
        }
        if (field === "fee") {
          return false;
        }
        return Math.abs(distance) <= 3;
      },
    );

    return {
      page: page.pageNumber,
      row: Math.round(anchorY),
      sourceOrder: sourceOrderStart + index + 1,
      cells: rowCells({ y: anchorY, items: logicalItems }, columns),
      section,
      fragments: [...new Set(logicalItems.map(item => Math.round(item.y)))].map(
        row => ({ page: page.pageNumber, row, role: "execution" }),
      ),
    };
  });
}

function isFeeLine(text: string): boolean {
  return startsFeeList(text) || /(?:佣金|費|费|稅|税|小计|小計|合计|合計|Commission|Fee|Subtotal|Total)/i.test(text);
}

function startsFeeList(text: string): boolean {
  return /^(?:結算費|结算费|其[他它]代收|Other\s+(?:Charges|Fees)\b|Commission\b)/i.test(text.trim());
}

function feeLabel(line: string): string {
  return line
    .split(/[:：]/, 1)[0]
    .replace(/\s+/g, "")
    .toLowerCase();
}

function mergeFeeContinuation(pending: FeeBlock, current: FeeBlock) {
  const pendingLabels = pending.lines.map(feeLabel);
  const currentLabels = current.lines.map(feeLabel);
  let overlap = Math.min(pendingLabels.length, currentLabels.length);
  while (
    overlap > 0 &&
    pendingLabels
      .slice(-overlap)
      .some((label, index) => label !== currentLabels[index])
  ) {
    overlap -= 1;
  }

  if (
    overlap === 0 &&
    pendingLabels[0] &&
    pendingLabels[0] === currentLabels[0]
  ) {
    pending.lines = [...current.lines];
  } else {
    pending.lines.push(...current.lines.slice(overlap));
  }
  pending.lastPage = current.lastPage;
  pending.lastY = current.lastY;
}

function feeBlocksForSegment(
  page: PdfTextPage,
  columns: readonly HeaderColumn[],
  headerY: number,
  endY: number,
  logicalRows: readonly ParsedLayoutRow[],
): FeeBlock[] {
  const anchorYs = logicalRows.map((row) => row.row);
  const lines = groupItemsIntoRows(
    page.items.filter((item) => {
      if (item.y <= headerY + 2 || item.y >= Math.min(endY, page.height - 35)) {
        return false;
      }
      return closestColumn(item, columns)?.field === "fee";
    }),
    2,
  )
    .map((row) => ({
      y: row.y,
      text: row.items
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join(" "),
    }))
    .filter(
      (line) =>
        line.text &&
        (isFeeLine(line.text) ||
          (anchorYs.some((anchorY) => Math.abs(anchorY - line.y) <= 3) &&
            /^[()\d.,+\-\s]+$/.test(line.text))),
    );

  const blocks: FeeBlock[] = [];
  for (const line of lines) {
    const prior = blocks.at(-1);
    const beginsNewList =
      !prior ||
      startsFeeList(line.text) ||
      line.y - prior.lastY > 14;
    if (beginsNewList) {
      blocks.push({
        firstPage: page.pageNumber,
        lastPage: page.pageNumber,
        firstY: line.y,
        lastY: line.y,
        lines: [line.text],
      });
    } else {
      prior.lines.push(line.text);
      prior.lastY = line.y;
    }
  }

  return blocks;
}

function assignFeeBlocks(
  rows: ParsedLayoutRow[],
  incoming: FeeBlock[],
  pending: FeeBlock | undefined,
): FeeBlock | undefined {
  const candidates = [...incoming];
  if (pending) {
    const first = candidates[0];
    const firstAnchor = rows[0]?.row;
    const secondAnchor = rows[1]?.row;
    const firstCenter = first
      ? (first.firstY + first.lastY) / 2
      : Number.POSITIVE_INFINITY;
    const firstBelongsToFirstAnchor =
      first &&
      firstAnchor !== undefined &&
      (secondAnchor === undefined ||
        Math.abs(firstCenter - firstAnchor) <
          Math.abs(firstCenter - secondAnchor));
    const continuesAcrossPage =
      first &&
      pending.lastPage + 1 === first.firstPage &&
      firstBelongsToFirstAnchor;
    if (continuesAcrossPage) {
      mergeFeeContinuation(pending, first);
      candidates.shift();
    }
    candidates.unshift(pending);
  }

  rows.forEach((row, rowIndex) => {
    if (candidates.length === 0) return;
    const remainingRows = rows.length - rowIndex;
    const skippable = Math.max(0, candidates.length - remainingRows);
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index <= skippable; index += 1) {
      const block = candidates[index];
      const representativeY =
        block.firstPage < row.page
          ? row.row
          : (block.firstY + block.lastY) / 2;
      const distance = Math.abs(representativeY - row.row);
      if (distance < selectedDistance) {
        selectedIndex = index;
        selectedDistance = distance;
      }
    }
    const selected = candidates[selectedIndex];
    candidates.splice(0, selectedIndex + 1);
    row.cells.fee = selected.lines.join("\n");
    row.fragments.push({ page: selected.firstPage, row: Math.round(selected.firstY), role: "fee" });
    if (selected.lastPage !== selected.firstPage || selected.lastY !== selected.firstY) {
      row.fragments.push({ page: selected.lastPage, row: Math.round(selected.lastY), role: "fee" });
    }
  });

  return candidates.at(-1);
}

function positionedRows(
  pages: readonly PdfTextPage[],
  feeTotals: PrintedFeeTotal[],
): ParsedLayoutRow[] {
  const result: ParsedLayoutRow[] = [];
  let pendingFeeBlock: FeeBlock | undefined;
  let sourceOrder = 0;
  let section: "stock" | "fund" | null = null;
  let pendingTimestampDate: { text: string; fragment: StatementFragment } | undefined;

  for (const page of pages) {
    const rows = groupItemsIntoRows(page.items, 2);
    let active:
      | {
          section: "stock" | "fund";
          columns: HeaderColumn[];
          headerY: number;
        }
      | undefined;

    const flush = (endY: number) => {
      if (!active) return;
      const logical = logicalRowsForSegment(
        page,
        page.items,
        active.columns,
        active.section,
        active.headerY,
        endY,
        sourceOrder,
      );
      if (active.section === "stock") {
        for (const row of rows) {
          if (row.y <= active.headerY + 2 || row.y >= Math.min(endY, page.height - 35)) continue;
          const cells = rowCells(row, active.columns);
          // Only the plain currency total closes a group. Symbol subtotals and
          // base-currency conversions are overlapping summaries, not extra fees.
          if (!/^(?:合计|合計|总计|總計|Total)$/i.test(compact(cells.code))) continue;
          feeTotals.push({
            page: page.pageNumber, row: Math.round(row.y),
            currency: compact(cells.currency).toUpperCase(), value: cells.fee,
          });
        }
        const pageFeeBlocks = feeBlocksForSegment(
          page,
          active.columns,
          active.headerY,
          endY,
          logical,
        );
        pendingFeeBlock = assignFeeBlocks(
          logical,
          pageFeeBlocks,
          pendingFeeBlock,
        );
      }
      const firstLogicalRow = logical[0];
      if (pendingTimestampDate && firstLogicalRow) {
        if (
          !/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(
            firstLogicalRow.cells.executedAt ?? "",
          )
        ) {
          firstLogicalRow.cells.executedAt =
            `${pendingTimestampDate.text} ${
              firstLogicalRow.cells.executedAt ?? ""
            }`.trim();
          firstLogicalRow.fragments.push(pendingTimestampDate.fragment);
        }
        pendingTimestampDate = undefined;
      }
      result.push(...logical);
      sourceOrder += logical.length;
      const lastAnchor = logical.at(-1)?.row ?? active.headerY;
      const trailingDate = page.items
        .filter((item) => item.y > lastAnchor + 14 && item.y < Math.min(endY, page.height - 35))
        .filter(
          (item) =>
            closestColumn(item, active?.columns ?? [])?.field === "executedAt",
        )
        .findLast((item) => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(item.text.trim()));
      if (trailingDate) {
        pendingTimestampDate = {
          text: trailingDate.text.trim(),
          fragment: { page: page.pageNumber, row: Math.round(trailingDate.y), role: "execution-date" },
        };
      }
      active = undefined;
    };

    rows.forEach((row) => {
      const text = row.items.map((item) => item.text).join(" ");
      if (isStockSection(text)) {
        flush(row.y);
        if (section !== "stock") {
          pendingFeeBlock = undefined;
          pendingTimestampDate = undefined;
        }
        section = "stock";
        return;
      }
      if (isFundSection(text)) {
        flush(row.y);
        if (section !== "fund") {
          pendingFeeBlock = undefined;
          pendingTimestampDate = undefined;
        }
        section = "fund";
        return;
      }
      if (/^(?:期[初末]持[仓倉]|持[仓倉](?:明细|明細)?|头寸转账|頭寸轉賬|现金(?:报告|变动|报告汇总)|現金報告|股息|分红|分紅|利息|公司行动|公司行動|IPO|费用|費用|应计股息|應計股息)$/.test(compact(text))) {
        flush(row.y);
        section = null;
        pendingFeeBlock = undefined;
        pendingTimestampDate = undefined;
        return;
      }

      const possibleHeader = headerColumns(row);
      if (possibleHeader && section) {
        flush(row.y);
        active = { section, columns: possibleHeader, headerY: row.y };
      } else if (active && row.items.filter(item => fieldForHeader(item.text)).length >= 3) {
        // A different table (IPO/positions/cash) closes the execution-column context.
        flush(row.y);
        section = null;
        pendingFeeBlock = undefined;
        pendingTimestampDate = undefined;
      }
    });
    flush(page.height);
  }

  return result;
}

function reconcileFeeTotals(
  totals: readonly PrintedFeeTotal[],
  records: readonly TradeExecution[],
  diagnostics: StatementParseResult["diagnostics"],
) {
  const priorByCurrency = new Map<string, PrintedFeeTotal>();
  const before = (page: number, row: number, limit: PrintedFeeTotal) =>
    page < limit.page || (page === limit.page && row < limit.row);
  for (const total of totals) {
    const prior = priorByCurrency.get(total.currency);
    priorByCurrency.set(total.currency, total);
    let printed: Decimal;
    try {
      if (!/^[A-Z]{3}$/.test(total.currency)) throw new Error("missing currency");
      printed = decimal(total.value).abs();
      if (!printed.isFinite()) throw new Error("invalid total");
    } catch {
      diagnostics.push({
        severity: "error", code: "invalid-tiger-fee-total",
        message: "股票交易的币种费用合计无法读取，不能确认费用完整性",
        page: total.page, row: total.row,
      });
      continue;
    }
    const group = records.filter(record =>
      record.instrument.currency === total.currency &&
      before(record.source.page ?? 0, record.source.row, total) &&
      (!prior || !before(record.source.page ?? 0, record.source.row, prior)),
    );
    const parsed = group.reduce((sum, record) => sum.plus(record.fee), new Decimal(0));
    if (!parsed.eq(printed) || group.some(record => record.source.feeStatus === "unknown")) {
      diagnostics.push({
        severity: "error", code: "tiger-fee-total-mismatch",
        message: `${total.currency} 股票费用合计不一致：原件 ${printed.toString()}，已解析 ${parsed.toString()}；存在缺失或未解释的费用，已阻止导入`,
        page: total.page, row: total.row,
      });
    }
  }
}

function decimal(value: string | undefined): Decimal {
  const normalized = (value ?? "")
    .replaceAll(",", "")
    .replace(/[()]/g, "")
    .trim();
  if (!normalized) throw new Error("missing number");
  return new Decimal(normalized);
}

class FeeEvidenceError extends Error {}

function totalFee(value: string | undefined): string {
  if (!value?.trim()) return "0";
  let details = new Decimal(0);
  let subtotal: Decimal | undefined;
  let hasDetails = false;
  for (const line of value.split("\n")) {
    const matches = line.replaceAll(",", "").match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g);
    if (!matches) throw new FeeEvidenceError("invalid fee");
    const sum = matches.reduce((total, part) => total.plus(new Decimal(part).abs()), new Decimal(0));
    if (/^(?:小计|小計|合计|合計|Subtotal|Total)/i.test(line.trim())) {
      if (subtotal && !subtotal.eq(sum)) throw new FeeEvidenceError("inconsistent fee totals");
      subtotal = sum;
    } else {
      hasDetails = true;
      details = details.plus(sum);
    }
  }
  if (subtotal && hasDetails && !subtotal.eq(details)) throw new FeeEvidenceError("inconsistent fee total");
  return (subtotal ?? details).toString();
}

function sideFor(
  labelValue: string | undefined,
  signedQuantity: Decimal,
): TradeSide | null {
  const label = compact(labelValue);
  for (const [knownLabel, side] of Object.entries(SIDE_BY_LABEL)) {
    if (label === knownLabel || label.includes(knownLabel)) return side;
  }
  if (
    !label ||
    label.includes("开仓") ||
    label.includes("平仓") ||
    label.includes("開倉") ||
    label.includes("平倉")
  ) {
    if (signedQuantity.isPositive()) return "buy";
    if (signedQuantity.isNegative()) return "sell";
  }
  return null;
}

function positionEffectForLabel(
  labelValue: string | undefined,
  signedQuantity?: Decimal,
): PositionEffect | undefined {
  const label = compact(labelValue);
  if (label.includes("开仓做空") || label.includes("開倉做空")) return "open-short";
  if (label.includes("平仓空头") || label.includes("平倉空頭")) return "close-short";
  if (label.includes("开仓做多") || label.includes("開倉做多")) return "open-long";
  if (label.includes("平仓多头") || label.includes("平倉多頭")) return "close-long";
  if (label === "平仓" || label === "平倉") {
    if (signedQuantity?.isPositive()) return "close-short";
    if (signedQuantity?.isNegative()) return "close-long";
  }
  return undefined;
}

function explicitPositionEffectEvidence(
  labelValue: string | undefined,
  signedQuantity?: Decimal,
): TigerPositionEffectEvidence | undefined {
  const effect = positionEffectForLabel(labelValue, signedQuantity);
  if (!effect) return undefined;
  const sourceLabel = labelValue?.trim();
  return {
    kind: "explicit",
    confidence: "high",
    sourceLabel,
    reason:
      sourceLabel === "平仓" || sourceLabel === "平倉"
        ? `原件交易类型明确标记为${sourceLabel}，按原始数量符号识别为${effect}`
        : `原件交易类型明确标记为${sourceLabel ?? effect}`,
  };
}

function positionColumns(row: PdfTextRow): HeaderColumn[] | null {
  const columns = row.items.flatMap((item) => {
    const field = fieldForHeader(item.text);
    return field ? [{ field, x: item.x + item.width / 2 }] : [];
  });
  const fields = new Set(columns.map((column) => column.field));
  return fields.has("code") && fields.has("quantity")
    ? columns.sort((left, right) => left.x - right.x)
    : null;
}

type PositionSnapshot = {
  quantity: Decimal;
  rawQuantity: string;
  fragments: Array<{ page: number; row: number; role?: string }>;
};

type PositionSnapshotEvidence = {
  snapshots: Map<string, PositionSnapshot>;
  hasUnknownInventoryAdjustments: boolean;
};

function positionSnapshots(
  pages: readonly PdfTextPage[],
): PositionSnapshotEvidence {
  const snapshots = new Map<string, PositionSnapshot>();
  let hasUnknownInventoryAdjustments = false;
  for (const page of pages) {
    let inPositionSection = false;
    let columns: HeaderColumn[] | undefined;
    for (const row of groupItemsIntoRows(page.items, 2)) {
      const text = compact(row.items.map((item) => item.text).join(" "));
      if (/(?:头寸转账|頭寸轉賬|公司行动|公司行動)/.test(text)) {
        hasUnknownInventoryAdjustments = true;
        inPositionSection = false;
        columns = undefined;
        continue;
      }
      if (/^期末持[仓倉]|^持[仓倉](?:明细|明細)?$/.test(text)) {
        inPositionSection = true;
        columns = undefined;
        continue;
      }
      if (!inPositionSection) continue;
      const isPositionStockSubsection = text === "股票" || text.toLowerCase() === "stocks";
      if (
        (isStockSection(text) && !isPositionStockSubsection) ||
        isFundSection(text) ||
        /^(?:头寸转账|頭寸轉賬|现金|現金|股息|分红|分紅|利息|公司行动|公司行動|IPO|费用|費用)$/.test(text)
      ) {
        inPositionSection = false;
        columns = undefined;
        continue;
      }
      const possibleColumns = positionColumns(row);
      if (possibleColumns) {
        columns = possibleColumns;
        continue;
      }
      if (!columns) continue;
      const cells = rowCells(row, columns);
      let quantity: Decimal;
      try {
        quantity = decimal(cells.quantity);
      } catch {
        continue;
      }
      const identity = parseIdentity(
        cells.code,
        cells.name,
        cells.market,
        cells.currency,
      );
      if (identity) {
        snapshots.set(`${identity.market}:${identity.symbol}`, {
          quantity,
          rawQuantity: cells.quantity?.trim() ?? quantity.toString(),
          fragments: [{ page: page.pageNumber, row: Math.round(row.y), role: "position" }],
        });
      }
    }
  }
  return { snapshots, hasUnknownInventoryAdjustments };
}

function numericRealized(value: string | undefined): Decimal | undefined {
  if (!compact(value)) return undefined;
  try {
    const result = decimal(value);
    return result.isFinite() ? result : undefined;
  } catch {
    return undefined;
  }
}

function legacyPositionEffects(
  rows: readonly ParsedLayoutRow[],
  pages: readonly PdfTextPage[],
): Map<number, { effect: PositionEffect; evidence: TigerPositionEffectEvidence }> {
  const effects = new Map<number, { effect: PositionEffect; evidence: TigerPositionEffectEvidence }>();
  const { snapshots, hasUnknownInventoryAdjustments } = positionSnapshots(pages);
  const facts = rows.flatMap((row) => {
    const identity = parseIdentity(
      row.cells.code,
      row.cells.name,
      row.cells.market,
      row.cells.currency,
    );
    if (!identity) return [];
    let signedQuantity: Decimal;
    try {
      signedQuantity = decimal(row.cells.quantity);
    } catch {
      return [];
    }
    if (positionEffectForLabel(row.cells.direction, signedQuantity)) return [];
    return [{
      row,
      identityKey: `${identity.market}:${identity.symbol}`,
      signedQuantity,
      realized: numericRealized(row.cells.realized),
      rawRealized: row.cells.realized?.trim(),
      fragments: row.fragments,
    }];
  });

  for (const [identityKey, snapshot] of hasUnknownInventoryAdjustments ? [] : snapshots) {
    if (!snapshot.quantity.isNegative()) continue;
    const identityFacts = facts.filter((fact) => fact.identityKey === identityKey);
    const snapshotFragment = snapshot.fragments[0];
    const lastFact = identityFacts.at(-1)?.row;
    const snapshotIsAfterAllTargetTrades = Boolean(
      snapshotFragment &&
      lastFact &&
      (snapshotFragment.page > lastFact.page ||
        (snapshotFragment.page === lastFact.page && snapshotFragment.row >= lastFact.row)),
    );
    if (!snapshotIsAfterAllTargetTrades) continue;
    const net = identityFacts.reduce(
      (total, fact) => total.plus(fact.signedQuantity),
      new Decimal(0),
    );
    let position = snapshot.quantity.minus(net);
    for (const fact of identityFacts) {
      const nextPosition = position.plus(fact.signedQuantity);
      const isPureShortOpen =
        fact.signedQuantity.isNegative() &&
        position.lte(0) &&
        nextPosition.lt(position);
      const isPureShortClose =
        fact.signedQuantity.isPositive() &&
        position.lt(0) &&
        nextPosition.lte(0);
      if (isPureShortOpen) {
        if (fact.realized && !fact.realized.isZero()) {
          position = nextPosition;
          continue;
        }
        effects.set(fact.row.sourceOrder, {
          effect: "open-short",
          evidence: {
            kind: "inferred",
            confidence: "high",
            realizedPnl: fact.rawRealized,
            fragments: [...fact.fragments, ...snapshot.fragments],
            reason: `按成交时间模拟本月全部目标成交净流：期初库存为${position.toString()}，该卖出使空头库存增加；无卖出行long-closing信号，期末原件持仓为${snapshot.rawQuantity}`,
          },
        });
      } else if (isPureShortClose) {
        effects.set(fact.row.sourceOrder, {
          effect: "close-short",
          evidence: {
            kind: "inferred",
            confidence: "high",
            realizedPnl: fact.rawRealized,
            fragments: [...fact.fragments, ...snapshot.fragments],
            reason: `按成交时间模拟：该买入从负库存${position.toString()}回补且未越过零；期末原件持仓为${snapshot.rawQuantity}`,
          },
        });
      }
      position = nextPosition;
    }
  }

  for (const close of facts) {
    if (!close.signedQuantity.isPositive() || !close.realized || close.realized.isZero()) {
      continue;
    }
    if (effects.has(close.row.sourceOrder)) continue;
    effects.set(close.row.sourceOrder, {
      effect: "close-short",
      evidence: {
        kind: "inferred",
        confidence: "high",
        realizedPnl: close.rawRealized,
        fragments: close.fragments,
        reason: "原件买入行给出非零已实现盈亏，支持其为回补空头；未把普通卖出转换为做空开仓",
      },
    });
    const prior = facts.filter((candidate) => candidate.row.sourceOrder < close.row.sourceOrder);
    const openingCandidates = prior.filter(
      (candidate) =>
        candidate.identityKey === close.identityKey &&
        candidate.signedQuantity.isNegative() &&
        candidate.signedQuantity.abs().eq(close.signedQuantity),
    );
    const priorSameIdentity = prior.filter((candidate) => candidate.identityKey === close.identityKey);
    const hasConflictingInventory = priorSameIdentity.some((candidate) => candidate.signedQuantity.isPositive());
    const hasLongClosingSignal = priorSameIdentity.some(
      (candidate) =>
        candidate.signedQuantity.isNegative() &&
        candidate.realized &&
        !candidate.realized.isZero(),
    );
    if (openingCandidates.length === 1 && !hasConflictingInventory && !hasLongClosingSignal) {
      const opening = openingCandidates[0];
      effects.set(opening.row.sourceOrder, {
        effect: "open-short",
        evidence: {
          kind: "inferred",
          confidence: "medium",
          realizedPnl: close.rawRealized,
          fragments: [...opening.row.fragments, ...close.fragments],
          reason: "唯一的同证券负数量卖出与原件非零已实现盈亏买入按时间和数量唯一配对；存在其他候选时保持unknown",
        },
      });
    }
  }

  return effects;
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
  const standaloneParenthesized = rawCode.match(/^\(([A-Z0-9.-]+)\)$/);
  if (standaloneParenthesized) rawCode = standaloneParenthesized[1];
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

function duplicateLayoutKey(
  cells: ParsedLayoutRow["cells"],
  market: string | undefined,
): string | null {
  let normalizedFee: string;
  try {
    if (!compact(cells.fee)) return null;
    normalizedFee = totalFee(cells.fee);
  } catch {
    return null;
  }
  const values = [
    compact(market),
    compact(cells.direction),
    compact(cells.quantity),
    compact(cells.price),
    normalizedFee,
    compact(cells.executedAt),
    compact(cells.settlementDate),
    compact(cells.currency),
  ];
  if (values.some((value) => !value)) return null;
  return JSON.stringify([
    ...values,
  ]);
}

export function parseTigerPages(
  pages: readonly PdfTextPage[],
  options: TigerParseOptions,
): StatementParseResult {
  const detection = detectTigerStatement(pages);
  if (!detection.matched) {
    const layoutDiagnostics = detection.diagnostics ?? [];
    return {
      broker: "tiger",
      records: [],
      candidates: [],
      exclusions: [],
      diagnostics:
        layoutDiagnostics.length > 0
          ? layoutDiagnostics
          : [
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
  const month = statementMonth(pages);
  const documentAccount = statementAccount(pages);
  const accountId = options.accountId ?? (documentAccount
    ? `tiger:${documentAccount}`
    : `tiger:unresolved:${options.fileFingerprint}`);
  const templateId = pages.some(page => /Tiger\s+Brokers\s+Limited/i.test(pageText(page)))
    ? "tiger-legacy" : "tiger-nz";
  if (!documentAccount && !options.accountId) {
    diagnostics.push({
      severity: "warning",
      code: "missing-tiger-account",
      message: "未找到可确认的原件账户标识，暂按文件隔离；请复核账户映射",
    });
  }
  let previous:
    | {
        page: number;
        sourceOrder: number;
        identity: ParsedIdentity;
        layoutKey: string | null;
        section: "stock" | "fund";
      }
    | undefined;

  const feeTotals: PrintedFeeTotal[] = [];
  const layoutRows = positionedRows(pages, feeTotals);
  const legacyEffects = legacyPositionEffects(layoutRows, pages);
  for (const layoutRow of layoutRows) {
    const { cells } = layoutRow;
    const parsedIdentity = parseIdentity(
      cells.code,
      cells.name,
      cells.market,
      cells.currency,
    );
    const currentMarket =
      parsedIdentity?.market ??
      (compact(cells.market).toUpperCase() === "HK"
        ? "HK"
        : compact(cells.market).toUpperCase() === "US"
          ? "US"
          : compact(cells.currency).toUpperCase() === "HKD"
            ? "HK"
            : compact(cells.currency).toUpperCase() === "USD"
              ? "US"
          : undefined);
    const incompleteIdentity = !compact(cells.code) && !compact(cells.name);
    const layoutKey = duplicateLayoutKey(cells, currentMarket);
    const immediatelyAdjacent = Boolean(
      previous &&
      previous.sourceOrder + 1 === layoutRow.sourceOrder &&
      previous.section === layoutRow.section,
    );
    if (
      incompleteIdentity &&
      immediatelyAdjacent &&
      layoutKey !== null &&
      previous?.layoutKey === layoutKey
    ) {
      records.at(-1)?.source.fragments?.push(...layoutRow.fragments);
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

    const identity =
      parsedIdentity ??
      (immediatelyAdjacent ? previous?.identity : undefined);
    if (!identity) {
      addExclusion(exclusions, "invalid-row", "证券代码或市场无法识别");
      diagnostics.push({
        severity: "error",
        code: "invalid-tiger-instrument",
        message: "证券代码或市场无法识别，已阻止导入不完整成交",
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
      const explicitEffect = positionEffectForLabel(cells.direction, signedQuantity);
      const inferredEffect = legacyEffects.get(layoutRow.sourceOrder);
      const positionEffect = explicitEffect ?? inferredEffect?.effect;
      const explicitEvidence = explicitPositionEffectEvidence(cells.direction, signedQuantity);
      const positionEffectEvidence = explicitEvidence
        ? { ...explicitEvidence, fragments: layoutRow.fragments }
        : inferredEffect?.evidence;
      if (identity.market !== "US" && identity.market !== "HK") throw new Error("unsupported market");
      const executionTime = resolveStatementTime({
        text: cells.executedAt?.trim() ?? "",
        market: identity.market,
        options,
      });
      if (!executionTime.ok) {
        diagnostics.push({
          severity: "error", code: executionTime.code, message: executionTime.message,
          page: layoutRow.page, row: layoutRow.row, sourceOrder: layoutRow.sourceOrder,
          instrumentSymbol: identity.symbol,
        });
        addExclusion(exclusions, "invalid-row", executionTime.message, identity.symbol);
        previous = undefined;
        continue;
      }
      if (quantity.lte(0) || price.lte(0) || !side) {
        throw new Error("invalid execution");
      }
      if (!compact(cells.fee)) {
        diagnostics.push({
          severity: "error", code: "missing-tiger-fee",
          message: "未找到该笔费用，零值仅为兼容占位，费用仍未知",
          page: layoutRow.page, row: layoutRow.row, sourceOrder: layoutRow.sourceOrder,
        });
      }

      const assetLabel = `${cells.assetType ?? ""} ${identity.name ?? ""}`;
      const sourceAssetType = /\bETF\b|交易所交易基金/i.test(assetLabel)
        ? "etf"
        : /股票|stock/i.test(cells.assetType ?? "")
          ? "stock"
          : "unknown";
      const candidate: ParsedInstrumentCandidate = {
        market: identity.market,
        symbol: identity.symbol,
        sourceName: identity.name,
        sourceAssetType,
      };
      candidates.set(`${candidate.market}:${candidate.symbol}`, candidate);

      const recordId = `tiger:${options.fileFingerprint}:${layoutRow.page}:${layoutRow.sourceOrder}`;
      const source: TigerTradeSource = {
        platform: "tiger",
        page: layoutRow.page,
        row: layoutRow.row,
        sourceOrder: layoutRow.sourceOrder,
        timePrecision: executionTime.timePrecision,
        fileName: options.fileName,
        fileFingerprint: options.fileFingerprint,
        sourceTimestampText: cells.executedAt?.trim(),
        // Preserve the printed zone spelling for existing consumers; UTC conversion uses the shared resolver.
        sourceTimezone: cells.executedAt?.match(/\d{1,2}:\d{2}:\d{2}\s*,?\s*(.+)$/)?.[1]?.trim() || executionTime.sourceTimezone,
        sourceTimeKind: executionTime.sourceTimeKind,
        timeEvidence: executionTime.timeEvidence,
        timeRuleVersion: executionTime.timeRuleVersion,
        marketCalendarDate: executionTime.marketCalendarDate,
        tradingDate: executionTime.tradingDate,
        templateId,
        statementMonth: month,
        settlementDate: cells.settlementDate?.trim(),
        grossAmount: cells.amount ? decimal(cells.amount).toString() : undefined,
        feeStatus: compact(cells.fee) ? "reported" : "unknown",
        statementRealizedPnl: cells.realized?.trim() || undefined,
        ...(positionEffect ? { positionEffect } : {}),
        ...(positionEffectEvidence ? { positionEffectEvidence } : {}),
        fragments: layoutRow.fragments,
      };
      records.push({
        id: recordId,
        source,
        accountId,
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
        executedAt: executionTime.timePrecision === "second"
          ? new Date(executionTime.executedAt).toISOString() : executionTime.executedAt,
        quantity: quantity.toString(),
        price: price.toString(),
        fee: totalFee(cells.fee),
      });
      previous = {
        page: layoutRow.page,
        sourceOrder: layoutRow.sourceOrder,
        identity,
        layoutKey,
        section: layoutRow.section,
      };
    } catch (error) {
      addExclusion(
        exclusions,
        "invalid-row",
        "成交方向、数量、价格、费用或时间无法识别",
        identity.symbol,
      );
      diagnostics.push({
        severity: "error",
        code: error instanceof FeeEvidenceError ? "invalid-tiger-fee" : "invalid-tiger-trade-row",
        message: error instanceof FeeEvidenceError
          ? "该笔费用无法读取或与费用小计不一致，已阻止导入"
          : "成交方向、数量、价格、费用或时间无法识别，已阻止导入不完整成交",
        page: layoutRow.page,
        row: layoutRow.row,
        sourceOrder: layoutRow.sourceOrder,
        instrumentSymbol: identity.symbol,
      });
      previous = undefined;
    }
  }

  reconcileFeeTotals(feeTotals, records, diagnostics);
  return {
    broker: "tiger",
    records,
    candidates: [...candidates.values()],
    exclusions,
    diagnostics,
    blocked: diagnostics.some(diagnostic => diagnostic.severity === "error"),
    monthly: {
      documentId: options.fileFingerprint, templateIds: [templateId], month, accountId,
      timePolicy: STATEMENT_TIME_RULE_VERSION,
      positions: [], events: [], reviewRequired: diagnostics.length > 0,
    },
  };
}

function statementMonth(pages: readonly PdfTextPage[]): string | undefined {
  const text = pages.map(pageText).join(" ");
  return /(?:报告期间|報告期間|报告期|報告期)\s*[:：]?\s*(\d{4}-\d{2})-\d{2}/.exec(text)?.[1];
}

function statementAccount(pages: readonly PdfTextPage[]): string | undefined {
  for (const page of pages) {
    const rows = groupItemsIntoRows(page.items, 2);
    for (const row of rows) {
      const label = row.items.find(item => /^(?:账户|帳戶|賬戶|账号|賬號|Account(?:\s*(?:ID|Number|No\.?))?)\s*[:：]?$/i.test(item.text.trim()));
      if (!label) continue;
      const below = rows.find(next => next.y > row.y + 2 && next.y <= row.y + 40);
      const value = below?.items.find(item => Math.abs(item.x - label.x) < 20 && /^[A-Z0-9][A-Z0-9*-]{3,}$/i.test(item.text.trim()));
      if (value) return value.text.trim();
    }
  }
  return undefined;
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
