import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import type { EnrichedImportResult } from "./enrich-import";
import type { StatementParseResult } from "./contracts";
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
        {
          category: "unknown-asset",
          label: "无法确认属于股票或 ETF",
          count: 1,
          instrumentSymbol: "BROKEN",
        },
        {
          category: "unknown-asset",
          label: "其他未支持品类",
          count: 2,
          instrumentSymbol: "MYSTERY",
        },
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
      sourceKind: "statement",
      tradeCount: 3,
      instrumentCount: 2,
      duplicateTradeCount: 1,
      unresolvedInstrumentCount: 1,
      excludedInstrumentCount: 3,
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
      {
        category: "unknown-asset",
        label: "其他未支持品类",
        count: 2,
      },
    ]);
    expect(preview.unresolved).toHaveLength(1);
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

  it("fails closed for raw parser records without verified metadata", () => {
    const parsed: StatementParseResult = {
      broker: "futu",
      records: [
        execution(
          "raw-1",
          "99999",
          "名称待行情源补充",
          "2025-03-01T00:00:00.000Z",
        ),
      ],
      candidates: [
        {
          market: "HK",
          symbol: "99999",
          sourceAssetType: "unknown",
        },
      ],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    };

    const preview = createImportPreview("raw.xlsx", parsed);

    expect(preview.records).toEqual([]);
    expect(preview.instruments).toEqual([]);
    expect(preview.unresolved).toEqual([
      expect.objectContaining({ market: "HK", symbol: "99999" }),
    ]);
    expect(preview.blocked).toBe(true);
  });

  it("labels screenshot previews and preserves explicit reconciliation counts", () => {
    const result: EnrichedImportResult = {
      broker: "futu",
      importable: [
        execution(
          "screenshot-1",
          "700",
          "腾讯控股",
          "2025-03-01T00:00:00.000Z",
        ),
      ],
      unresolved: [],
      exclusions: [],
      diagnostics: [],
      cacheHits: 0,
    };

    expect(
      createImportPreview("3 张交易截图", result, {
        sourceKind: "screenshot",
        captureCount: 3,
        duplicateTradeCount: 4,
        conflictTradeCount: 2,
      }),
    ).toMatchObject({
      fileName: "3 张交易截图",
      sourceKind: "screenshot",
      sourceLabel: "富途截图",
      captureCount: 3,
      duplicateTradeCount: 4,
      conflictTradeCount: 2,
    });
  });
});
