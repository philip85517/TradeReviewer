import type { PdfTextItem, PdfTextPage } from "../pdf-text";

function item(text: string, x: number, y: number): PdfTextItem {
  return {
    text,
    x,
    y,
    width: Math.max(text.length * 5.5, 12),
    height: 9,
  };
}

function statementRow(
  y: number,
  values: {
    date: string;
    market: string;
    instrument?: string;
    business: string;
    quantity?: string;
    price?: string;
    amount?: string;
    commission?: string;
    stampDuty?: string;
    otherFee?: string;
    change?: string;
    securityBalance?: string;
    omitSecurityBalance?: boolean;
    modern?: boolean;
    combineNameAndBusiness?: boolean;
  },
): PdfTextItem[] {
  const parsedInstrument = values.instrument?.match(
    /^(\d{5,6})(?:\s+(.+))?$/,
  );
  const numericShift = values.combineNameAndBusiness ? 14 : 0;
  const numeric = values.modern
    ? { quantity: 464, price: 514, amount: 570, commission: 625, stampDuty: 670, otherFee: 715, change: 760, cash: 820, security: 875 }
    : { quantity: 464 + numericShift, price: 514 + numericShift, amount: 552 + numericShift, commission: 600 + numericShift, stampDuty: 627 + numericShift, otherFee: 654 + numericShift, change: 684 + numericShift, cash: 736 + numericShift, security: 794 + numericShift };
  return [
    ...(values.modern
      ? [
          item(values.date, 36, y),
          item(values.market, 80, y),
          item("人民币", 123, y),
          item("匿名银行", 154, y),
          item("A000000000", 210, y),
          ...(parsedInstrument ? [item(parsedInstrument[1], 260, y)] : []),
        ]
      : [
          item(`${values.date} ${values.market}`, 36, y),
          item(
            `人民币 匿名银行 A000000000${
              parsedInstrument ? ` ${parsedInstrument[1]}` : ""
            }`,
            120,
            y,
          ),
        ]),
    ...(parsedInstrument?.[2] && !values.modern
      ? [
          item(
            values.combineNameAndBusiness
              ? `${parsedInstrument[2]} ${values.business}`
              : parsedInstrument[2],
            260,
            y,
          ),
        ]
      : []),
    ...(parsedInstrument?.[2] && values.modern ? [item(parsedInstrument[2], 315, y)] : []),
    item("", 360, y),
    ...(!values.combineNameAndBusiness
      ? [item(values.business, 371, y)]
      : []),
    ...(values.quantity
      ? [item(values.quantity, numeric.quantity, y)]
      : []),
    ...(values.price ? [item(values.price, numeric.price, y)] : []),
    ...(values.amount ? [item(values.amount, numeric.amount, y)] : []),
    ...(values.commission
      ? [item(values.commission, numeric.commission, y)]
      : []),
    ...(values.stampDuty
      ? [item(values.stampDuty, numeric.stampDuty, y)]
      : []),
    ...(values.otherFee
      ? [item(values.otherFee, numeric.otherFee, y)]
      : []),
    item(values.change ?? "9000.00", numeric.change, y),
    item("100000.00", numeric.cash, y),
    ...(values.omitSecurityBalance || values.securityBalance === undefined
      ? []
      : [item(values.securityBalance, numeric.security, y)]),
  ];
}

const headingPage: PdfTextPage = {
  pageNumber: 1,
  width: 900,
  height: 600,
  items: [
    item("招商证券营业部[匿名营业部]普通对账单", 36, 36),
    item("统计日期：20250101 - 20251231", 36, 54),
    item("资产账号：0000000001", 36, 72),
  ],
};

const tableHeader = [
  item("流水明细", 36, 144),
  item("对账日期： 20250101 ---- 20251231", 36, 162),
  item("发生日期 市场", 36, 180),
  item("币种", 123, 180),
  item("银行代码 证券账号", 154, 180),
  item("证券代码 证券名称", 260, 180),
  item("业务标志", 371, 180),
  item("发生数量 成交均价", 464, 180),
  item("成交金额", 570, 180),
  item("佣金 印花税 其他费", 625, 180),
  item("变动金额", 736, 180),
  item("资金余额 证券余额", 794, 180),
];

const modernTableHeader = [
  item("流水明细", 36, 144),
  item("对账日期： 20250101 ---- 20251231", 36, 162),
  item("发生日期", 36, 180),
  item("市场", 80, 180),
  item("币种", 123, 180),
  item("银行代码", 154, 180),
  item("证券账号", 210, 180),
  item("证券代码", 260, 180),
  item("证券名称", 315, 180),
  item("业务标志", 371, 180),
  item("发生数量", 464, 180),
  item("成交均价", 514, 180),
  item("成交金额", 592, 180),
  item("佣金", 636, 180),
  item("印花税", 675, 180),
  item("其他费", 720, 180),
  item("变动金额", 782, 180),
  item("资金余额", 853, 180),
  item("证券余额", 897, 180),
];

export const CHINA_MERCHANTS_POSITION_EVIDENCE: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...modernTableHeader,
      ...statementRow(216, {
        date: "20250102",
        market: "上海",
        instrument: "510300 沪深300ETF",
        business: "证券买入",
        quantity: "1000",
        price: "4.00",
        amount: "-4000.00",
        commission: "4.00",
        stampDuty: "0.00",
        otherFee: "0.00",
        change: "-4004.00",
        securityBalance: "1000.00",
        modern: true,
      }),
      ...statementRow(234, {
        date: "20250103",
        market: "上海",
        instrument: "510300 沪深300ETF",
        business: "证券卖出",
        quantity: "-1000",
        price: "4.20",
        amount: "4200.00",
        commission: "4.00",
        stampDuty: "4.20",
        otherFee: "0.00",
        change: "4191.80",
        securityBalance: "0.00",
        modern: true,
      }),
    ],
  },
];

export const CHINA_MERCHANTS_MISSING_SECURITY_BALANCE: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...modernTableHeader,
      ...statementRow(216, {
        date: "20250102",
        market: "上海",
        instrument: "510300 沪深300ETF",
        business: "证券卖出",
        quantity: "-1000",
        price: "4.00",
        amount: "4000.00",
        commission: "4.00",
        stampDuty: "4.00",
        otherFee: "0.00",
        change: "3992.00",
        omitSecurityBalance: true,
        modern: true,
      }),
    ],
  },
];

export const CHINA_MERCHANTS_FIRST_SELL: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...modernTableHeader,
      ...statementRow(216, {
        date: "20230105",
        market: "上海",
        instrument: "513010 港股科技ETF",
        business: "证券卖出",
        quantity: "-92400",
        price: "0.60",
        amount: "55440.00",
        commission: "20.00",
        stampDuty: "55.44",
        otherFee: "0.00",
        change: "55364.56",
        securityBalance: "0.00",
        modern: true,
      }),
    ],
  },
];

export const CHINA_MERCHANTS_INCONSISTENT_SECURITY_BALANCE: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...modernTableHeader,
      ...statementRow(216, {
        date: "20250102",
        market: "上海",
        instrument: "510300 沪深300ETF",
        business: "证券买入",
        quantity: "100",
        price: "4.00",
        amount: "-400.00",
        commission: "1.00",
        stampDuty: "0.00",
        otherFee: "0.00",
        change: "-401.00",
        securityBalance: "50.00",
        modern: true,
      }),
    ],
  },
];

export const CHINA_MERCHANTS_PAGES: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(216, {
        date: "20250102",
        market: "沪港通",
        instrument: "00700 匿名港股",
        business: "证券买入",
        quantity: "100",
        price: "300.00",
        amount: "-30000.00",
        commission: "5.00",
        stampDuty: "0.00",
        otherFee: "1.00",
        securityBalance: "100.00",
        combineNameAndBusiness: true,
      }),
      ...statementRow(234, {
        date: "20250103",
        market: "上海",
        instrument: "518880 红利ETF",
        business: "证券买入",
        quantity: "1000",
        price: "6.50",
        amount: "-6500.00",
        commission: "3.00",
        stampDuty: "0.00",
        otherFee: "0.20",
        securityBalance: "1000.00",
      }),
      ...statementRow(252, {
        date: "20250103",
        market: "上海",
        instrument: "600938 招商银行",
        business: "证券买入",
        quantity: "500",
        price: "20.00",
        amount: "-10000.00",
        commission: "5.00",
        stampDuty: "0.00",
        otherFee: "0.10",
        securityBalance: "500.00",
      }),
      ...statementRow(270, {
        date: "20250104",
        market: "上海",
        instrument: "518880 红利ETF",
        business: "证券卖出",
        quantity: "-1000",
        price: "6.80",
        amount: "6800.00",
        commission: "3.00",
        stampDuty: "1.00",
        otherFee: "0.20",
        securityBalance: "0.00",
      }),
      ...statementRow(288, {
        date: "20250104",
        market: "上海",
        instrument: "600938 招商银行",
        business: "证券卖出",
        quantity: "-500",
        price: "22.00",
        amount: "11000.00",
        commission: "5.00",
        stampDuty: "1.00",
        otherFee: "0.10",
        securityBalance: "0.00",
      }),
      ...statementRow(306, {
        date: "20250105",
        market: "上海",
        instrument: "113001 匿名转债",
        business: "证券卖出",
        quantity: "-10",
        price: "120.00",
      }),
      ...statementRow(324, {
        date: "20250106",
        market: "上海",
        instrument: "204001 GC001",
        business: "质押回购拆出",
      }),
      ...statementRow(342, {
        date: "20250107",
        market: "上海",
        instrument: "204001 GC001",
        business: "拆出质押购回",
      }),
      ...statementRow(360, {
        date: "20250108",
        market: "上海",
        business: "利息归本",
      }),
      ...statementRow(378, {
        date: "20250109",
        market: "深圳",
        instrument: "160001 匿名基金",
        business: "基金申购",
      }),
      ...statementRow(396, {
        date: "20250110",
        market: "深圳",
        instrument: "160001 匿名基金",
        business: "证券卖出",
        quantity: "-100",
        price: "1.20",
      }),
      ...statementRow(414, {
        date: "20250111",
        market: "上海",
        business: "银行转存",
      }),
      ...statementRow(432, {
        date: "20250112",
        market: "上海",
        instrument: "600999 匿名新股",
        business: "新股入账",
      }),
    ],
  },
];

export const NON_CHINA_MERCHANTS_PAGES: PdfTextPage[] = [
  {
    ...headingPage,
    items: [item("招商证券营业部[匿名营业部]普通对账单", 36, 36)],
  },
];

export const CHINA_MERCHANTS_IDENTICAL_FILLS: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(216, {
        date: "20250103",
        market: "上海",
        instrument: "600938 匿名能源",
        business: "证券买入",
        quantity: "500",
        price: "20.00",
        amount: "-10000.00",
        commission: "5.00",
        stampDuty: "0.00",
        otherFee: "0.10",
        securityBalance: "500.00",
      }),
      ...statementRow(234, {
        date: "20250103",
        market: "上海",
        instrument: "600938 匿名能源",
        business: "证券买入",
        quantity: "500",
        price: "20.00",
        amount: "-10000.00",
        commission: "5.00",
        stampDuty: "0.00",
        otherFee: "0.10",
        securityBalance: "1000.00",
      }),
    ],
  },
];

export const CHINA_MERCHANTS_CODE_ONLY: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(216, {
        date: "20250103",
        market: "上海",
        instrument: "600036",
        business: "证券买入",
        quantity: "100",
        price: "40.00",
        amount: "-4000.00",
        commission: "5.00",
        securityBalance: "100.00",
      }),
    ],
  },
];

export const CHINA_MERCHANTS_SHENZHEN_TYPE_BOUNDARY: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(216, {
        date: "20250103",
        market: "深圳",
        instrument: "150001",
        business: "证券买入",
        quantity: "100",
        price: "1.00",
        amount: "-100.00",
        commission: "1.00",
        securityBalance: "100.00",
      }),
      ...statementRow(234, {
        date: "20250104",
        market: "深圳",
        instrument: "159001",
        business: "证券买入",
        quantity: "100",
        price: "2.00",
        amount: "-200.00",
        commission: "1.00",
        securityBalance: "100.00",
      }),
    ],
  },
];

export const CHINA_MERCHANTS_EMPTY_FEES: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(216, {
        date: "20250103",
        market: "上海",
        instrument: "600938 匿名股票",
        business: "证券买入",
        quantity: "100",
        price: "20.00",
        amount: "-2000.00",
        stampDuty: "1.00",
        otherFee: "2.00",
        securityBalance: "100.00",
      }),
      ...statementRow(234, {
        date: "20250104",
        market: "上海",
        instrument: "600938 匿名股票",
        business: "证券卖出",
        quantity: "-100",
        price: "21.00",
        amount: "2100.00",
        commission: "3.00",
        otherFee: "2.00",
        securityBalance: "0.00",
      }),
      ...statementRow(252, {
        date: "20250105",
        market: "上海",
        instrument: "600938 匿名股票",
        business: "证券买入",
        quantity: "100",
        price: "20.50",
        amount: "-2050.00",
        commission: "3.00",
        stampDuty: "1.00",
        securityBalance: "100.00",
      }),
    ],
  },
];

export const CHINA_MERCHANTS_CROSS_PAGE: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(522, {
        date: "20250103",
        market: "上海",
        instrument: "600938 匿名股票",
        business: "证券买入",
        quantity: "100",
        price: "20.00",
        amount: "-2000.00",
        commission: "5.00",
        stampDuty: "1.00",
        otherFee: "0.20",
        securityBalance: "100.00",
      }),
    ],
  },
  {
    pageNumber: 3,
    width: 900,
    height: 600,
    items: [
      ...statementRow(54, {
        date: "20250104",
        market: "上海",
        instrument: "600938 匿名股票",
        business: "证券卖出",
        quantity: "-100",
        price: "21.00",
        amount: "2100.00",
        commission: "5.00",
        securityBalance: "0.00",
      }),
    ],
  },
];

export const CHINA_MERCHANTS_INVALID_DATE: PdfTextPage[] = [
  headingPage,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...statementRow(216, {
        date: "20250230",
        market: "上海",
        instrument: "600938 匿名股票",
        business: "证券买入",
        quantity: "100",
        price: "20.00",
        amount: "-2000.00",
        commission: "5.00",
        securityBalance: "100.00",
      }),
    ],
  },
];

export const CHINA_MERCHANTS_OTHER_ACCOUNT: PdfTextPage[] = [
  {
    ...headingPage,
    items: headingPage.items.map((sourceItem) =>
      sourceItem.text.startsWith("资产账号")
        ? { ...sourceItem, text: "资产账号：0000000002" }
        : sourceItem,
    ),
  },
  CHINA_MERCHANTS_PAGES[1],
];
