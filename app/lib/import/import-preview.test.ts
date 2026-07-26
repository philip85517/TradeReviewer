import { describe, expect, it } from "vitest";

import { createImportPreview } from "./import-preview";
import type { ImportResult } from "./import-result";
import type { TradeExecution } from "../trades/types";

function execution(
  id: string,
  symbol: string,
  executedAt: string,
): TradeExecution {
  return {
    id,
    source: {
      platform: "futu",
      row: 2,
      fileFingerprint: "abc",
    },
    accountId: "acct",
    accountLabel: "账户",
    instrument: {
      id: `US:${symbol}`,
      symbol,
      name: symbol,
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt,
    quantity: "10",
    price: "20",
    fee: "1",
  };
}

describe("createImportPreview", () => {
  it("summarizes range, trades, included stocks, and excluded symbols", () => {
    const result: ImportResult<TradeExecution> = {
      records: [
        execution("1", "NVDA", "2025-03-01T00:00:00.000Z"),
        execution("2", "NVDA", "2025-03-10T00:00:00.000Z"),
        execution("3", "BABA", "2025-04-01T00:00:00.000Z"),
      ],
      diagnostics: [
        {
          severity: "info",
          code: "unsupported-asset-class",
          message: "已跳过基金记录",
          instrumentSymbol: "FUND-1",
        },
        {
          severity: "warning",
          code: "invalid-numeric-field",
          message: "价格错误",
          instrumentSymbol: "BROKEN",
        },
        {
          severity: "warning",
          code: "missing-instrument-symbol",
          message: "代码为空",
        },
      ],
      blocked: false,
    };

    const preview = createImportPreview("交易记录.xlsx", result);

    expect(preview).toMatchObject({
      fileName: "交易记录.xlsx",
      tradeCount: 3,
      instrumentCount: 2,
      excludedInstrumentCount: 3,
      firstTradeAt: "2025-03-01T00:00:00.000Z",
      lastTradeAt: "2025-04-01T00:00:00.000Z",
      blocked: false,
    });
    expect(preview.instruments.map((item) => item.instrument.name)).toEqual([
      "阿里巴巴",
      "英伟达",
    ]);
    expect(preview.excludedSymbols).toEqual([
      "FUND-1",
      "BROKEN",
      "未识别标的",
    ]);
  });
});
