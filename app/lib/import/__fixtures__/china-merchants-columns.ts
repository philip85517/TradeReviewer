import type { PdfTextItem, PdfTextPage } from "../pdf-text";

// Independent columns and right-aligned values, as emitted by PDF.js.
export const cmsHeaders = [
  "发生日期",
  "市场",
  "币种",
  "银行代码",
  "证券账号",
  "证券代码",
  "证券名称",
  "业务标志",
  "发生数量",
  "成交均价",
  "成交金额",
  "佣金",
  "印花税",
  "其他费",
  "变动金额",
  "资金余额",
  "证券余额",
];
const positions = [
  20, 62, 135, 179, 249, 295, 336, 378, 468, 509, 554, 605, 642, 684, 721, 764,
  805,
];
function textItem(
  text: string,
  x: number,
  y: number,
  numeric = false,
): PdfTextItem {
  const width = text.length * (numeric ? 3 : 5);
  return { text, x, y, width, height: 5 };
}
export function columnStatement(
  options: {
    account?: string;
    scale?: number;
    shift?: number;
    rows?: string[][];
    blankFee?: boolean;
    continuation?: boolean;
    stop?: boolean;
  } = {},
): PdfTextPage[] {
  const header = cmsHeaders.map((text, index) =>
    textItem(text, positions[index], 150),
  );
  const rows = options.rows ?? [
    [
      "20250103",
      "上海",
      "人民币",
      "测试银行",
      "A000000001",
      "600036",
      "招商银行",
      "证券买入",
      "100.00",
      "40.0000",
      "4000.00",
      "5.00",
      "0.00",
      "0.04",
      "-4005.04",
      "5994.96",
      "100.00",
    ],
    [
      "20250106",
      "深圳",
      "人民币",
      "测试银行",
      "0000000002",
      "159813",
      "芯片",
      "证券卖出",
      "-200.00",
      "1.1000",
      "220.00",
      "5.00",
      "0.00",
      "0.00",
      "215.00",
      "6209.96",
      "0.00",
    ],
  ];
  const values = rows.flatMap((row, r) =>
    row.flatMap((text, index) => {
      if (!text || (options.blankFee && index === 11)) return [];
      const token = textItem(text, positions[index], 170 + r * 12, index >= 8);
      if (index >= 8) token.x += header[index].width - token.width;
      return [token];
    }),
  );
  const pages: PdfTextPage[] = [
    {
      pageNumber: 1,
      width: 850,
      height: 600,
      items: [
        textItem("招商证券普通对账单", 20, 30),
        textItem("统计日期：20250101 - 20251231", 20, 50),
        textItem("资产账号：", 20, 70),
        textItem(options.account ?? "0000000001", 90, 70),
        textItem("流水明细", 20, 130),
        ...header,
        ...(options.stop ? [textItem("新股配号", 20, 160)] : []),
        ...(options.continuation ? [] : values),
      ],
    },
  ];
  if (options.continuation)
    pages.push({ pageNumber: 2, width: 850, height: 600, items: values });
  return pages.map((page) => ({
    ...page,
    width: page.width * (options.scale ?? 1),
    items: page.items.map((item) => ({
      ...item,
      x: item.x * (options.scale ?? 1) + (options.shift ?? 0),
      y: item.y * (options.scale ?? 1),
      width: item.width * (options.scale ?? 1),
      height: item.height * (options.scale ?? 1),
    })),
  }));
}
