import type { PdfTextItem, PdfTextPage } from "../pdf-text";

// Synthetic values with the column and split-time structure of historical PDFs.
const xs = [30, 170, 230, 290, 370, 440, 520, 610, 710, 800, 870, 1010, 1090, 1150];
export function legacyItem(text: string, x: number, y: number): PdfTextItem {
  return { text, x, y, width: 0, height: 10 };
}
export function legacyRow(y: number, cells: string[]): PdfTextItem[] {
  return cells.flatMap((text, i) => text ? [legacyItem(text, xs[i], y)] : []);
}
export function legacyPages({ time = "2020-12-08 10:20:30, US/Eastern", fee = "-2", account = "SYNTH001", empty = false, quantity = "3" } = {}): PdfTextPage[] {
  return [{ pageNumber: 1, width: 1200, height: 840, items: [
    legacyItem("Tiger Brokers Limited", 30, 25),
    legacyItem("报告期间：2020-12-01 - 2020-12-31", 30, 50),
    legacyItem("账户资料", 30, 75),
    legacyItem("账户", 30, 100), legacyItem("账户类型", 900, 100),
    legacyItem(account, 30, 125), legacyItem("保证金账户", 900, 125),
    legacyItem("账户总览", 30, 150),
    ...(empty ? [] : [
      legacyItem("股票", 30, 180),
      ...legacyRow(210, ["代码", "市场", "交易所", "交易类型", "数量", "交易价格", "成交额", "成交应计利息", "佣金/税", "已实现的损益", "说明", "成交时间", "交收日期", "币种"]),
      ...legacyRow(250, ["SYNX", "US", "NASDAQ", "", quantity, "10", "-30", "0", fee, "0", "", time, "2020-12-10", "USD"]),
      ...legacyRow(290, ["合计 SYNX", "", "", "", "3", "10", "-30", "0", "-2", "0", "", "", "", "USD"]),
    ]),
  ] }];
}
