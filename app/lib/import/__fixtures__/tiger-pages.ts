import type { PdfTextItem, PdfTextPage } from "../pdf-text";

const COLUMNS = [24, 116, 252, 342, 420, 496, 566, 642, 812] as const;

function item(text: string, x: number, y: number): PdfTextItem {
  return { text, x, y, width: Math.max(text.length * 6, 12), height: 10 };
}

function row(y: number, cells: readonly string[]): PdfTextItem[] {
  return cells.flatMap((text, index) =>
    text ? [item(text, COLUMNS[index] ?? 24, y)] : [],
  );
}

function page(
  pageNumber: number,
  body: readonly (readonly string[])[],
  section = "股票交易",
): PdfTextPage {
  return {
    pageNumber,
    width: 980,
    height: 840,
    items: [
      item("Tiger Brokers (NZ) Limited", 24, 24),
      item(section, 24, 70),
      ...row(92, [
        "证券代码",
        "证券名称",
        "交易类型",
        "数量",
        "价格",
        "费用",
        "币种",
        "成交时间",
        "交收日期",
      ]),
      ...body.flatMap((cells, index) => row(118 + index * 24, cells)),
      item(`第 ${pageNumber} 页 / 共 2 页`, 430, 810),
    ],
  };
}

export const TIGER_PAGES: PdfTextPage[] = [
  page(1, [
    [
      "HK.01810",
      "小米集团-W",
      "买入",
      "800",
      "48.2",
      "佣金 -4.5 平台费 -1.0",
      "HKD",
      "2025-02-03 10:15:20 GMT+8",
      "2025-02-05",
    ],
    [
      "HK.01810",
      "小米集团-W",
      "卖出",
      "-800",
      "51.8",
      "佣金 -4.8 平台费 -1.0",
      "HKD",
      "2025-02-10 14:05:01 GMT+8",
      "2025-02-12",
    ],
    [
      "",
      "",
      "卖出",
      "-800",
      "51.8",
      "佣金 -4.8 平台费 -1.0",
      "HKD",
      "2025-02-10 14:05:01 GMT+8",
      "2025-02-12",
    ],
  ]),
  page(2, [
    [
      "HK.00700",
      "腾讯控股",
      "开仓做空",
      "-800",
      "410",
      "佣金 -6",
      "HKD",
      "2025-03-03 10:00:00 GMT+8",
      "2025-03-05",
    ],
    [
      "HK.00700",
      "腾讯控股",
      "平仓空头",
      "800",
      "400",
      "佣金 -6",
      "HKD",
      "2025-03-04 10:00:00 GMT+8",
      "2025-03-06",
    ],
    [
      "US.SPY",
      "SPDR S&P 500 ETF",
      "开仓",
      "2",
      "600.25",
      "Commission -0.35 Fee -0.02",
      "USD",
      "2025-03-05 09:30:00 GMT-5",
      "2025-03-06",
    ],
  ]),
  page(
    3,
    [
      [
        "FUND.90001",
        "Tiger Money Market Fund",
        "买入",
        "100",
        "1",
        "0",
        "USD",
        "2025-03-06 09:30:00 GMT-5",
        "2025-03-07",
      ],
    ],
    "基金交易",
  ),
];

export const TIGER_SHORT_PAGES: PdfTextPage[] = [
  page(1, [
    [
      "HK.00700",
      "腾讯控股",
      "开仓做空",
      "-800",
      "410",
      "-6",
      "HKD",
      "2025-03-03 10:00:00 GMT+8",
      "2025-03-05",
    ],
    [
      "HK.00700",
      "腾讯控股",
      "平仓空头",
      "800",
      "400",
      "-6",
      "HKD",
      "2025-03-04 10:00:00 GMT+8",
      "2025-03-06",
    ],
  ]),
];

export const TIGER_IDENTICAL_FILL_PAGES: PdfTextPage[] = [
  page(1, [
    [
      "US.SPY",
      "SPDR S&P 500 ETF",
      "买入",
      "2",
      "600.25",
      "-0.35",
      "USD",
      "2025-03-05 09:30:00 GMT-5",
      "2025-03-06",
    ],
    [
      "US.SPY",
      "SPDR S&P 500 ETF",
      "买入",
      "2",
      "600.25",
      "-0.35",
      "USD",
      "2025-03-05 09:30:00 GMT-5",
      "2025-03-06",
    ],
  ]),
];

export const NON_TIGER_PAGES: PdfTextPage[] = [
  {
    pageNumber: 1,
    width: 980,
    height: 840,
    items: [
      item("Tiger Brokers (NZ) Limited", 24, 24),
      item("Monthly account summary", 24, 70),
    ],
  },
];
