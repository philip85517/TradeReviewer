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

const heading: PdfTextPage = {
  pageNumber: 1,
  width: 900,
  height: 600,
  items: [
    item("招商证券营业部[匿名营业部]普通对账单", 36, 36),
    item("统计日期：20250101 - 20261231", 36, 54),
    item("资产账号：0000000001", 36, 72),
  ],
};

const tableHeader: PdfTextItem[] = [
  item("流水明细", 36, 144),
  item("对账日期： 20250101 ---- 20261231", 36, 162),
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

type Row = {
  y: number;
  date: string;
  market: string;
  symbol: string;
  name: string;
  business: string;
  quantity: string;
  price: string;
  amount: string;
  commission: string;
  stampDuty: string;
  otherFee: string;
  cashChange: string;
  cashBalance: string;
  securityBalance: string;
};

function legacyRow(row: Row): PdfTextItem[] {
  return [
    item(`${row.date} ${row.market}`, 36, row.y),
    item(`人民币 测试银行 A000000001 ${row.symbol}`, 120, row.y),
    item(row.name, 260, row.y),
    item("", 360, row.y),
    item(row.business, 371, row.y),
    item(`${row.quantity} ${row.price}`, 464, row.y),
    item(row.amount, 552, row.y),
    item(row.commission, 600, row.y),
    item(row.stampDuty, 627, row.y),
    item(row.otherFee, 654, row.y),
    item(row.cashChange, 684, row.y),
    item(row.cashBalance, 736, row.y),
    item(row.securityBalance, 794, row.y),
  ];
}

/** Masked regression fixture for the real 20-page legacy-layout failure. */
export const CHINA_MERCHANTS_S3A_LEGACY: PdfTextPage[] = [
  heading,
  {
    pageNumber: 2,
    width: 900,
    height: 600,
    items: [
      ...tableHeader,
      ...legacyRow({
        y: 216,
        date: "20260309",
        market: "深圳",
        symbol: "000893",
        name: "匿名钾",
        business: "证券卖出",
        quantity: "-500.00",
        price: "65.0800",
        amount: "32540.00",
        commission: "7.66",
        stampDuty: "16.27",
        otherFee: "0.00",
        cashChange: "32516.07",
        cashBalance: "32793.33",
        securityBalance: "0.00",
      }),
      ...legacyRow({
        y: 234,
        date: "20260522",
        market: "上海",
        symbol: "516780",
        name: "稀土ETF",
        business: "红股入账",
        quantity: "10000.00",
        price: "1.8900",
        amount: "0.00",
        commission: "0.00",
        stampDuty: "0.00",
        otherFee: "0.00",
        cashChange: "0.00",
        cashBalance: "641445.07",
        securityBalance: "20000.00",
      }),
    ],
  },
];
