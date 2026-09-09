import { groupItemsIntoRows } from "./pdf-layout";
import type { PdfTextPage } from "./pdf-text";
import {
  locatePdfColumns,
  readPdfCells,
  type PdfColumn,
  type PdfTableLayout,
} from "./pdf-table";
import {
  hasLegacyChinaMerchantsTable,
  readLegacyChinaMerchantsRows,
  type StatementRow,
} from "./china-merchants-legacy-layout";

const columns: readonly PdfColumn[] = [
  ["dateText", "发生日期"],
  ["marketLabel", "市场"],
  ["currencyLabel", "币种"],
  ["bank", "银行代码"],
  ["securityAccount", "证券账号"],
  ["instrumentSymbol", "证券代码"],
  ["instrumentName", "证券名称"],
  ["business", "业务标志"],
].map(([key, label]) => ({
  key,
  labels: [label],
  kind: "text",
  joinWith: key === "instrumentName" ? " " : "",
}));
const schema: readonly PdfColumn[] = [
  ...columns,
  ...[
    ["quantity", "发生数量"],
    ["price", "成交均价"],
    ["amount", "成交金额"],
    ["commission", "佣金"],
    ["stampDuty", "印花税"],
    ["otherFee", "其他费"],
    ["cashChange", "变动金额"],
    ["cashBalance", "资金余额"],
    ["securityBalance", "证券余额"],
  ].map(
    ([key, label]): PdfColumn => ({ key, labels: [label], kind: "number" }),
  ),
];
export type ChinaMerchantsRow = StatementRow & {
  cells?: Record<string, string>;
};

export function hasChinaMerchantsTable(pages: readonly PdfTextPage[]): boolean {
  return (
    hasLegacyChinaMerchantsTable(pages) ||
    pages.some((page) =>
      groupItemsIntoRows(page.items, 2).some((row) =>
        locatePdfColumns(row, schema),
      ),
    )
  );
}
export function readChinaMerchantsTable(
  pages: readonly PdfTextPage[],
): ChinaMerchantsRow[] {
  if (hasLegacyChinaMerchantsTable(pages))
    return readLegacyChinaMerchantsRows(pages);
  let layout: PdfTableLayout | null = null;
  let active = false;
  const result: ChinaMerchantsRow[] = [];
  for (const page of pages) {
    for (const row of groupItemsIntoRows(page.items, 2)) {
      const text = row.items
        .map((item) => item.text)
        .join("")
        .replace(/\s/g, "");
      if (text.includes("流水明细")) {
        active = true;
        continue;
      }
      if (
        /^(新股配号|配号信息|配号明细|证券配号|重要提示|温馨提示|特别提示|说明)/.test(
          text,
        )
      ) {
        active = false;
        layout = null;
        continue;
      }
      if (!active) continue;
      const header = locatePdfColumns(row, schema);
      if (header) {
        layout = header;
        continue;
      }
      if (!layout) continue;
      const cells = readPdfCells(row, layout);
      if (!/^\d{8}$/.test(cells.dateText)) continue;
      result.push({
        page: page.pageNumber,
        row: Math.round(row.y),
        sourceOrder: result.length,
        dateText: cells.dateText,
        marketLabel: cells.marketLabel,
        business: cells.business.replace(/\s/g, ""),
        instrumentSymbol: cells.instrumentSymbol || undefined,
        instrumentName: cells.instrumentName || undefined,
        quantity: cells.quantity,
        price: cells.price,
        amount: cells.amount,
        commission: cells.commission,
        stampDuty: cells.stampDuty,
        otherFee: cells.otherFee,
        currencyLabel: cells.currencyLabel,
        cells,
      });
    }
  }
  return result;
}
