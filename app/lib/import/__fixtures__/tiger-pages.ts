import type { PdfTextItem, PdfTextPage } from "../pdf-text";

const COLUMNS = [24, 116, 252, 342, 420, 450, 566, 642, 812] as const;

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

const TRADITIONAL_COLUMNS = {
  code: 29,
  market: 251,
  exchange: 291,
  direction: 343,
  quantity: 415,
  price: 457,
  amount: 539,
  fee: 761,
  realized: 819,
  description: 904,
  executedAt: 1006,
  settlementDate: 1076,
  currency: 1139,
} as const;

function traditionalHeader(y = 117): PdfTextItem[] {
  return [
    item("代碼", TRADITIONAL_COLUMNS.code, y),
    item("市場", TRADITIONAL_COLUMNS.market, y),
    item("交易所", TRADITIONAL_COLUMNS.exchange, y),
    item("交易類型", TRADITIONAL_COLUMNS.direction, y),
    item("數量", TRADITIONAL_COLUMNS.quantity, y),
    item("交易價格", TRADITIONAL_COLUMNS.price, y),
    item("成交額", TRADITIONAL_COLUMNS.amount, y),
    item("佣金/稅", TRADITIONAL_COLUMNS.fee, y),
    item("已實現的損益", TRADITIONAL_COLUMNS.realized, y),
    item("說明", TRADITIONAL_COLUMNS.description, y),
    item("成交時間", TRADITIONAL_COLUMNS.executedAt, y),
    item("交收日期", TRADITIONAL_COLUMNS.settlementDate, y),
    item("幣種", TRADITIONAL_COLUMNS.currency, y),
  ];
}

type TraditionalRow = {
  y: number;
  name?: string;
  code?: string;
  market: "HK" | "US";
  direction: string;
  quantity: string;
  price: string;
  feeParts?: string[];
  date: string;
  timeZone: string;
  settlement?: string;
  currency: "HKD" | "USD";
};

function traditionalRow(input: TraditionalRow): PdfTextItem[] {
  const settlement = input.settlement ?? input.date;
  return [
    ...(input.name
      ? [item(input.name, TRADITIONAL_COLUMNS.code, input.y - 6)]
      : []),
    ...(input.code
      ? [item(`(${input.code})`, TRADITIONAL_COLUMNS.code, input.y + 6)]
      : []),
    item(input.market, TRADITIONAL_COLUMNS.market + 12, input.y),
    item("SMART", TRADITIONAL_COLUMNS.exchange + 13, input.y),
    item(input.direction, TRADITIONAL_COLUMNS.direction + 3, input.y),
    item(input.quantity, TRADITIONAL_COLUMNS.quantity + 1, input.y),
    item(input.price, TRADITIONAL_COLUMNS.price + 3, input.y),
    ...(input.feeParts ?? ["佣金 -1.20", "平台費 -0.30"]).map(
      (fee, index, all) =>
        item(
          fee,
          TRADITIONAL_COLUMNS.fee - 28,
          input.y + (index - (all.length - 1) / 2) * 9,
        ),
    ),
    item(input.date, TRADITIONAL_COLUMNS.executedAt - 8, input.y - 6),
    item(
      `10:00:00, ${input.timeZone}`,
      TRADITIONAL_COLUMNS.executedAt - 34,
      input.y + 6,
    ),
    item(settlement, TRADITIONAL_COLUMNS.settlementDate - 7, input.y),
    item(input.currency, TRADITIONAL_COLUMNS.currency + 7, input.y),
  ];
}

function traditionalPage(
  pageNumber: number,
  rows: TraditionalRow[],
  includeSection: boolean,
): PdfTextPage {
  return {
    pageNumber,
    width: 1190,
    height: 840,
    items: [
      item("Tiger Brokers (NZ) Limited", 23, 40),
      ...(includeSection ? [item("股票", 34, 82)] : []),
      ...traditionalHeader(),
      ...rows.flatMap(traditionalRow),
      item(`${pageNumber} / 2`, 1146, 828),
    ],
  };
}

export const TIGER_TRADITIONAL_PAGES: PdfTextPage[] = [
  traditionalPage(
    1,
    [
      {
        y: 200,
        name: "匿名港股",
        code: "01810",
        market: "HK",
        direction: "開倉",
        quantity: "100",
        price: "40.5",
        date: "2025-09-18",
        timeZone: "Asia/Hong_Kong",
        currency: "HKD",
      },
      {
        y: 300,
        name: "Anonymous ETF",
        code: "SPY",
        market: "US",
        direction: "平倉",
        quantity: "-2",
        price: "600.25",
        date: "2025-09-18",
        timeZone: "US/Eastern",
        currency: "USD",
      },
    ],
    true,
  ),
  traditionalPage(
    2,
    [
      {
        y: 200,
        name: "Anonymous Security",
        code: "MYST",
        market: "US",
        direction: "賣出",
        quantity: "-1",
        price: "10",
        date: "2025-12-18",
        timeZone: "US/Eastern",
        currency: "USD",
      },
    ],
    false,
  ),
];

export const TIGER_TRADITIONAL_CROSS_PAGE_DUPLICATE: PdfTextPage[] = [
  traditionalPage(
    1,
    [
      {
        y: 700,
        name: "匿名港股",
        code: "01810",
        market: "HK",
        direction: "開倉做空",
        quantity: "-800",
        price: "22.5",
        date: "2025-06-01",
        timeZone: "Asia/Hong_Kong",
        currency: "HKD",
      },
    ],
    true,
  ),
  traditionalPage(
    2,
    [
      {
        y: 145,
        market: "HK",
        direction: "開倉做空",
        quantity: "-800",
        price: "22.5",
        date: "2025-06-01",
        timeZone: "Asia/Hong_Kong",
        currency: "HKD",
      },
    ],
    false,
  ),
];

export const TIGER_TRADITIONAL_MISSING_KEY_FIELD: PdfTextPage[] = [
  traditionalPage(
    1,
    [
      {
        y: 200,
        name: "Anonymous ETF",
        code: "SPY",
        market: "US",
        direction: "開倉",
        quantity: "2",
        price: "600.25",
        date: "2025-09-18",
        timeZone: "US/Eastern",
        currency: "USD",
      },
      {
        y: 300,
        code: "SPY",
        market: "US",
        direction: "開倉",
        quantity: "2",
        price: "600.25",
        date: "2025-09-18",
        timeZone: "US/Eastern",
        settlement: "",
        currency: "USD",
      },
    ],
    true,
  ),
];

export const TIGER_TRADITIONAL_DIFFERENT_MARKET: PdfTextPage[] = [
  traditionalPage(
    1,
    [
      {
        y: 200,
        name: "Anonymous Security",
        code: "ABCD",
        market: "HK",
        direction: "開倉",
        quantity: "2",
        price: "10",
        date: "2025-09-18",
        timeZone: "Asia/Hong_Kong",
        currency: "USD",
      },
      {
        y: 300,
        code: "ABCD",
        market: "US",
        direction: "開倉",
        quantity: "2",
        price: "10",
        date: "2025-09-18",
        timeZone: "Asia/Hong_Kong",
        currency: "USD",
      },
    ],
    true,
  ),
];
