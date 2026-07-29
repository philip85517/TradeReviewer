import { describe, expect, it, vi } from "vitest";

import type {
  InstrumentMetadataFailure,
  ResolvedInstrument,
} from "../instruments/metadata-contracts";
import type { ResolveBatchResult } from "../instruments/resolve-service";
import type { TradeExecution } from "../trades/types";
import type { StatementParseResult } from "./contracts";
import { enrichStatementImport } from "./enrich-import";

function execution(
  market: "US" | "HK" | "CN-SH",
  symbol: string,
  name = "名称待行情源补充",
  id = `${market}:${symbol}:1`,
): TradeExecution {
  return {
    id,
    source: { platform: "test", row: 1, fileFingerprint: "local-only" },
    accountId: "account",
    accountLabel: "账户",
    instrument: {
      id: `${market}:${symbol}`,
      market,
      symbol,
      name,
      currency: market === "US" ? "USD" : "HKD",
    },
    side: "buy",
    executedAt: "2025-01-01T00:00:00.000Z",
    quantity: "1",
    price: "1",
    fee: "0",
  };
}

function resolution(
  resolved: ResolvedInstrument[],
  unresolved: InstrumentMetadataFailure[] = [],
  cacheHits = 0,
): ResolveBatchResult {
  return {
    resolved: new Map(
      resolved.map((item) => [`${item.market}:${item.symbol}`, item]),
    ),
    unresolved: new Map(
      unresolved.map((item) => [`${item.market}:${item.symbol}`, item]),
    ),
    cacheHits,
    backgroundRefresh: Promise.resolve(),
  };
}

const resolvedAt = "2026-07-29T00:00:00.000Z";

describe("enrichStatementImport", () => {
  it("trusts typed statement names, resolves code-only names, and excludes unresolved types", async () => {
    const parsed: StatementParseResult = {
      broker: "tiger",
      records: [
        execution("HK", "700", "腾讯控股"),
        execution("US", "SPY", undefined),
        execution("US", "BROKEN", undefined),
      ],
      candidates: [
        {
          market: "HK",
          symbol: "700",
          sourceName: "腾讯控股",
          sourceAssetType: "stock",
        },
        {
          market: "US",
          symbol: "SPY",
          sourceAssetType: "unknown",
        },
        {
          market: "US",
          symbol: "BROKEN",
          sourceAssetType: "unknown",
        },
      ],
      exclusions: [
        {
          category: "bond",
          label: "可转债",
          count: 1,
          instrumentSymbol: "113001",
        },
      ],
      diagnostics: [],
      blocked: false,
    };
    const unresolved: InstrumentMetadataFailure = {
      market: "US",
      symbol: "BROKEN",
      attempts: [
        {
          source: "nasdaq",
          code: "not-found",
          message: "未找到",
        },
      ],
    };
    const resolver = vi.fn(async () =>
      resolution(
        [
          {
            market: "US",
            symbol: "SPY",
            name: "SPDR S&P 500 ETF Trust",
            assetType: "etf",
            source: "nasdaq",
            confidence: "official",
            resolvedAt,
          },
        ],
        [unresolved],
        1,
      ),
    );

    const result = await enrichStatementImport(parsed, { resolver });

    expect(resolver).toHaveBeenCalledWith([
      { market: "US", symbol: "SPY" },
      { market: "US", symbol: "BROKEN" },
    ]);
    expect(result.importable.map((item) => item.instrument.name)).toEqual([
      "腾讯控股",
      "SPDR S&P 500 ETF Trust",
    ]);
    expect(result.unresolved).toContainEqual(
      expect.objectContaining({ symbol: "BROKEN" }),
    );
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "bond" }),
        expect.objectContaining({
          category: "unknown-asset",
          instrumentSymbol: "BROKEN",
        }),
      ]),
    );
    expect(result.cacheHits).toBe(1);
  });

  it("applies one resolved name to every matching execution without collapsing legitimate fills", async () => {
    const parsed: StatementParseResult = {
      broker: "futu",
      records: [
        execution("US", "BABA", undefined, "fill-1"),
        execution("US", "BABA", undefined, "fill-2"),
      ],
      candidates: [
        {
          market: "US",
          symbol: "BABA",
          sourceAssetType: "unknown",
        },
      ],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    };
    const resolver = vi.fn(async () =>
      resolution([
        {
          market: "US",
          symbol: "BABA",
          name: "Alibaba Group Holding Limited",
          assetType: "stock",
          source: "nasdaq",
          confidence: "official",
          resolvedAt,
        },
      ]),
    );

    const result = await enrichStatementImport(parsed, { resolver });

    expect(result.importable).toHaveLength(2);
    expect(result.importable.map((item) => item.id)).toEqual([
      "fill-1",
      "fill-2",
    ]);
    expect(
      result.importable.every(
        (item) => item.instrument.name === "Alibaba Group Holding Limited",
      ),
    ).toBe(true);
  });

  it("can retry only selected unresolved instruments", async () => {
    const parsed: StatementParseResult = {
      broker: "tiger",
      records: [
        execution("US", "ONE", undefined),
        execution("US", "TWO", undefined),
      ],
      candidates: [
        { market: "US", symbol: "ONE", sourceAssetType: "unknown" },
        { market: "US", symbol: "TWO", sourceAssetType: "unknown" },
      ],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    };
    const resolver = vi.fn(async () => resolution([]));

    await enrichStatementImport(parsed, {
      resolver,
      onlyInstrumentIds: ["US:TWO"],
      forceRefresh: true,
    });

    expect(resolver).toHaveBeenCalledWith([
      { market: "US", symbol: "TWO" },
    ]);
  });
});
