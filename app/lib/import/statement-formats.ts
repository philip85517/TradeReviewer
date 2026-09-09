import type { StatementBroker } from "./contracts";

/** User-facing document formats; broker IDs continue to identify the real source. */
export const STATEMENT_FORMATS: Record<
  StatementBroker,
  { label: string; description: string }
> = {
  futu: { label: "富途证券", description: "富途 XLSX 对账单" },
  tiger: { label: "Tiger 证券", description: "Tiger PDF 对账单" },
  "china-merchants": {
    label: "A股招商银行",
    description: "招商证券普通对账单 PDF，仅导入 A股和 ETF",
  },
  tradingview: {
    label: "TradingView · 模拟盘",
    description: "TradingView 模拟交易 CSV",
  },
};
