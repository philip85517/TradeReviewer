import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import type { EnrichedImportResult } from "./enrich-import";
import { createImportPreview } from "./import-preview";

function execution(
  id: string,
  symbol: string,
  name: string,
  executedAt: string,
): TradeExecution {
  return {
    id,
    source: {
      platform: "tiger",
      row: 2,
      fileFingerprint: "abc",
    },
    accountId: "acct",
    accountLabel: "账户",
    instrument: {
      id: `HK:${symbol}`,
      symbol,
      name,
      market: "HK",
      currency: "HKD",
    },
    side: "buy",
    executedAt,
    quantity: "10",
    price: "20",
    fee: "1",
  };
}

describe("createImportPreview", () => {
  it("summarizes only complete instruments and groups exclusions", () => {
    const result: EnrichedImportResult = {
      broker: "tiger",
      importable: [
        execution(
          "1",
          "700",
          "腾讯控股",
          "2025-03-01T00:00:00.000Z",
        ),
        execution(
          "2",
          "700",
          "腾讯控股",
          "2025-03-10T00:00:00.000Z",
        ),
        execution(
          "3",
          "1810",
          "小米集团-W",
          "2025-04-01T00:00:00.000Z",
        ),
      ],
      unresolved: [
        {
          market: "US",
          symbol: "BROKEN",
          attempts: [
            {
              source: "nasdaq",
              code: "not-found",
              message: "未找到",
            },
          ],
        },
      ],
      exclusions: [
        { category: "bond", label: "可转债", count: 1 },
        { category: "bond", label: "可转债", count: 1 },
        { category: "fund", label: "基金", count: 3 },
      ],
      diagnostics: [
        {
          severity: "info",
          code: "cross-file-duplicate",
          message: "已存在相同成交",
        },
      ],
      cacheHits: 0,
    };

    const preview = createImportPreview("Tiger_2025.pdf", result);

    expect(preview).toMatchObject({
      fileName: "Tiger_2025.pdf",
      sourceLabel: "Tiger 证券",
      tradeCount: 3,
      instrumentCount: 2,
      duplicateTradeCount: 1,
      unresolvedInstrumentCount: 1,
      excludedInstrumentCount: 2,
      firstTradeAt: "2025-03-01T00:00:00.000Z",
      lastTradeAt: "2025-04-01T00:00:00.000Z",
      blocked: false,
    });
    expect(preview.instruments.map((item) => item.instrument.name)).toEqual([
      "小米集团-W",
      "腾讯控股",
    ]);
    expect(preview.exclusionGroups).toEqual([
      { category: "bond", label: "可转债", count: 2 },
      { category: "fund", label: "基金", count: 3 },
    ]);
  });

  it("blocks confirmation only when no complete execution can import", () => {
    const result: EnrichedImportResult = {
      broker: "china-merchants",
      importable: [],
      unresolved: [
        {
          market: "CN-SH",
          symbol: "600000",
          attempts: [],
        },
      ],
      exclusions: [],
      diagnostics: [],
      cacheHits: 0,
    };

    expect(createImportPreview("招商证券.pdf", result).blocked).toBe(true);
  });
});
