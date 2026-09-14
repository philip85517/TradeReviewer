// Compatibility adapter for the previously supported combined-column export.
import type { TradeSide } from "../trades/types";
import { groupItemsIntoRows, type PdfTextRow } from "./pdf-layout";
import type { PdfTextItem, PdfTextPage } from "./pdf-text";

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

export type StatementRow = {
  page: number;
  row: number;
  sourceOrder: number;
  dateText: string;
  marketLabel: string;
  instrumentSymbol?: string;
  instrumentName?: string;
  business: string;
  quantity?: string;
  price?: string;
  amount?: string;
  commission?: string;
  stampDuty?: string;
  otherFee?: string;
  currencyLabel?: string;
};

type ParsedIdentity = {
  symbol: string;
  sourceName?: string;
};

type NumericField =
  | "quantity"
  | "price"
  | "amount"
  | "commission"
  | "stampDuty"
  | "otherFee";

type TableLayout = {
  instrumentStart: number;
  numericStart: number;
  quantitySpan: number;
  amountSpan: number;
  feeSpan: number;
};

type PositionedNumber = {
  value: string;
  centerX: number;
};

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim();
}

function rowText(row: PdfTextRow): string {
  return row.items.map((item) => item.text).join(" ");
}

function tableLayout(row: PdfTextRow): TableLayout | null {
  const text = compact(rowText(row));
  if (!TABLE_HEADERS.every((label) => text.includes(label))) return null;

  const instrument = row.items.find((item) =>
    compact(item.text).includes("证券代码证券名称"),
  );
  const business = row.items.find((item) =>
    compact(item.text).includes("业务标志"),
  );
  const quantityPrice = row.items.find((item) =>
    compact(item.text).includes("发生数量成交均价"),
  );
  const amount = row.items.find((item) =>
    compact(item.text).includes("成交金额"),
  );
  const fees = row.items.find((item) =>
    compact(item.text).includes("佣金印花税其他费"),
  );
  const change = row.items.find((item) =>
    compact(item.text).includes("变动金额"),
  );
  if (
    !instrument ||
    !business ||
    !quantityPrice ||
    !amount ||
    !fees ||
    !change
  ) {
    return null;
  }

  const quantitySpan = amount.x - quantityPrice.x;
  const amountSpan = fees.x - amount.x;
  const feeSpan = change.x - fees.x;
  if (quantitySpan <= 0 || amountSpan <= 0 || feeSpan <= 0) return null;

  return {
    instrumentStart: instrument.x,
    numericStart: quantityPrice.x,
    quantitySpan,
    amountSpan,
    feeSpan,
  };
}

export function hasLegacyChinaMerchantsTable(
  pages: readonly PdfTextPage[],
): boolean {
  return pages.some((page) =>
    groupItemsIntoRows(page.items, 2).some((row) => tableLayout(row) !== null),
  );
}

function normalizedBusiness(value: string): string {
  const text = compact(value);
  const execution = Object.keys(EXECUTION_SIDE).find((label) =>
    text.includes(label),
  );
  return execution ?? text;
}

const EXCLUDED_BUSINESS_PATTERN =
  /回购|购回|拆出|申购|认购|配售|配股|中签|银行|转入|转出|存入|取出|利息|费用|组合费|红利|红股|股息|分红|送股|入账|托管|冻结|解冻|指定|撤销|转换/;

function businessItem(row: PdfTextRow, layout: TableLayout) {
  const execution = row.items.find((item) =>
    Object.keys(EXECUTION_SIDE).some((label) =>
      compact(item.text).includes(label),
    ),
  );
  if (execution) return execution;

  return row.items
    .filter(
      (item) =>
        item.x >= layout.instrumentStart &&
        item.x < layout.numericStart &&
        EXCLUDED_BUSINESS_PATTERN.test(compact(item.text)),
    )
    .sort((left, right) => right.x - left.x)[0];
}

function positionedNumbers(item: PdfTextItem): PositionedNumber[] {
  const matches = [...item.text.matchAll(/[+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)/g)];
  const sourceLength = Math.max(item.text.length, 1);
  return matches.map((match) => {
    const start = match.index;
    const centerCharacter = start + match[0].length / 2;
    return {
      value: match[0].replaceAll(",", ""),
      centerX: item.x + (centerCharacter / sourceLength) * item.width,
    };
  });
}

function numericCells(
  row: PdfTextRow,
  layout: TableLayout,
): Partial<Record<NumericField, string>> {
  const cells: Partial<Record<NumericField, string>> = {};
  const tokens = row.items
    .filter((item) => item.x >= layout.numericStart - 40)
    .sort((left, right) => left.x - right.x)
    .flatMap(positionedNumbers)
    .sort((left, right) => left.centerX - right.centerX);
  const quantityEnd = layout.numericStart + layout.quantitySpan * 0.4;
  const priceEnd = layout.numericStart + layout.quantitySpan * 0.77;
  const amountEnd =
    layout.numericStart + layout.quantitySpan + layout.amountSpan * 0.4;
  for (const token of tokens) {
    if (token.centerX < quantityEnd && cells.quantity === undefined) {
      cells.quantity = token.value;
    } else if (token.centerX < priceEnd && cells.price === undefined) {
      cells.price = token.value;
    } else if (token.centerX < amountEnd && cells.amount === undefined) {
      cells.amount = token.value;
    }
  }

  const amountToken = tokens.find(
    (token) => token.centerX >= priceEnd && token.centerX < amountEnd,
  );
  if (!amountToken) return cells;
  const remaining = tokens.filter((token) => token.centerX >= amountEnd);
  const commissionEnd = amountToken.centerX + layout.amountSpan;
  const stampDutyEnd = commissionEnd + layout.feeSpan * 0.27;
  const otherFeeEnd = commissionEnd + layout.feeSpan * 0.58;
  for (const token of remaining) {
    if (token.centerX < commissionEnd && cells.commission === undefined) {
      cells.commission = token.value;
    } else if (token.centerX < stampDutyEnd && cells.stampDuty === undefined) {
      cells.stampDuty = token.value;
    } else if (token.centerX < otherFeeEnd && cells.otherFee === undefined) {
      cells.otherFee = token.value;
    }
  }
  return cells;
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
  const combined = nameItem?.text.trim().match(/^(\d{5,6})\s+(.+?)\s*$/);
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
  if (!symbol) return null;
  if (!nameItem || /\d{5,6}/.test(nameItem.text)) return { symbol };
  const sourceName = nameItem.text.trim();
  return sourceName ? { symbol, sourceName } : { symbol };
}

export function readLegacyChinaMerchantsRows(
  pages: readonly PdfTextPage[],
): StatementRow[] {
  const result: StatementRow[] = [];
  let inFlowSection = false;
  let sourceOrder = 0;
  let activeLayout: TableLayout | null = null;

  for (const page of pages) {
    const rows = groupItemsIntoRows(page.items, 2);
    for (const row of rows) {
      const text = rowText(row);
      if (text.includes(FLOW_MARKER)) {
        inFlowSection = true;
        continue;
      }
      const detectedLayout = tableLayout(row);
      if (detectedLayout) {
        if (inFlowSection) activeLayout = detectedLayout;
        continue;
      }
      if (!inFlowSection || !activeLayout) continue;

      const dateItem = row.items.find((item) =>
        /^\s*\d{8}\s+\S+/.test(item.text),
      );
      if (!dateItem) continue;
      const dateMatch = dateItem.text.trim().match(/^(\d{8})\s+(.+?)\s*$/);
      if (!dateMatch) continue;

      const business = businessItem(row, activeLayout);
      if (!business) continue;
      const businessLabel = normalizedBusiness(business.text);
      const parsedIdentity = rowIdentity(
        row,
        dateItem,
        business,
        businessLabel,
      );
      const cells = numericCells(row, activeLayout);
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
        ...cells,
        currencyLabel: currencyItem?.text,
      });
      sourceOrder += 1;
    }
  }

  return result;
}
