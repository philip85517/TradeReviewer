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
    combineNameAndBusiness?: boolean;
  },
): PdfTextItem[] {
  const parsedInstrument = values.instrument?.match(/^(\d{5,6})\s+(.+)$/);
  return [
    item(`${values.date} ${values.market}`, 36, y),
    item(
      `人民币 匿名银行 A000000000${
        parsedInstrument ? ` ${parsedInstrument[1]}` : ""
      }`,
      120,
      y,
    ),
    ...(parsedInstrument
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
    item("", 360, y),
    ...(!values.combineNameAndBusiness
      ? [item(values.business, 371, y)]
      : []),
    ...(values.quantity ? [item(values.quantity, 464, y)] : []),
    ...(values.price ? [item(values.price, 514, y)] : []),
    ...(values.amount ? [item(values.amount, 570, y)] : []),
    ...(values.commission ? [item(values.commission, 625, y)] : []),
    ...(values.stampDuty ? [item(values.stampDuty, 652, y)] : []),
    ...(values.otherFee ? [item(values.otherFee, 679, y)] : []),
    item("0.00", 736, y),
    item("100000.00", 794, y),
  ];
}

const headingPage: PdfTextPage = {
  pageNumber: 1,
  width: 900,
  height: 600,
  items: [
    item("招商证券营业部[匿名营业部]普通对账单", 36, 36),
    item("统计日期：20250101 - 20251231", 36, 54),
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
        combineNameAndBusiness: true,
      }),
      ...statementRow(234, {
        date: "20250103",
        market: "上海",
        instrument: "518880 黄金ETF",
        business: "证券买入",
        quantity: "1000",
        price: "6.50",
        amount: "-6500.00",
        commission: "3.00",
        stampDuty: "0.00",
        otherFee: "0.20",
      }),
      ...statementRow(252, {
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
      }),
      ...statementRow(270, {
        date: "20250104",
        market: "上海",
        instrument: "518880 黄金ETF",
        business: "证券卖出",
        quantity: "-1000",
        price: "6.80",
        amount: "6800.00",
        commission: "3.00",
        stampDuty: "1.00",
        otherFee: "0.20",
      }),
      ...statementRow(288, {
        date: "20250104",
        market: "上海",
        instrument: "600938 匿名能源",
        business: "证券卖出",
        quantity: "-500",
        price: "22.00",
        amount: "11000.00",
        commission: "5.00",
        stampDuty: "1.00",
        otherFee: "0.10",
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
      }),
    ],
  },
];
