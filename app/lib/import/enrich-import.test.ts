import { describe, expect, it, vi } from "vitest";

import type {
  InstrumentMetadataFailure,
  ResolvedInstrument,
} from "../instruments/metadata-contracts";
import type { ResolveBatchResult } from "../instruments/resolve-service";
import type { InstrumentMetadataRepository } from "../storage/instrument-metadata-repository";
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

  it("returns the complete import after a targeted unresolved retry succeeds", async () => {
    const parsed: StatementParseResult = {
      broker: "tiger",
      records: [
        execution("US", "ONE", "Already Known"),
        execution("US", "TWO", undefined),
      ],
      candidates: [
        {
          market: "US",
          symbol: "ONE",
          sourceName: "Already Known",
          sourceAssetType: "stock",
        },
        { market: "US", symbol: "TWO", sourceAssetType: "unknown" },
      ],
      exclusions: [
        {
          category: "bond",
          label: "可转债",
          count: 2,
          instrumentSymbol: "113001",
        },
      ],
      diagnostics: [],
      blocked: false,
    };
    const resolver = vi.fn(async () =>
      resolution([
        {
          market: "US",
          symbol: "TWO",
          name: "Newly Resolved",
          assetType: "stock",
          source: "nasdaq",
          confidence: "official",
          resolvedAt,
        },
      ]),
    );

    const result = await enrichStatementImport(parsed, {
      resolver,
      onlyInstrumentIds: ["US:TWO"],
      forceRefresh: true,
    });

    expect(resolver).toHaveBeenCalledWith([
      { market: "US", symbol: "TWO" },
    ], expect.objectContaining({ forceRefresh: true }));
    expect(result.importable.map((item) => item.instrument.name)).toEqual([
      "Already Known",
      "Newly Resolved",
    ]);
    expect(result.unresolved).toEqual([]);
    expect(result.exclusions).toContainEqual(
      expect.objectContaining({
        category: "bond",
        count: 2,
      }),
    );
  });

  it("stores trusted statement metadata and later resolves code-only imports from cache", async () => {
    const stored = new Map<string, ResolvedInstrument>();
    const repository: InstrumentMetadataRepository = {
      get: async (instrumentId) => stored.get(instrumentId),
      getMany: async (instrumentIds) =>
        new Map(
          instrumentIds.flatMap((instrumentId) => {
            const item = stored.get(instrumentId);
            return item ? [[instrumentId, item] as const] : [];
          }),
        ),
      put: async (record) => {
        stored.set(`${record.market}:${record.symbol}`, record);
      },
    };
    const trusted: StatementParseResult = {
      broker: "tiger",
      records: [execution("HK", "700", "腾讯控股")],
      candidates: [
        {
          market: "HK",
          symbol: "700",
          sourceName: "腾讯控股",
          sourceAssetType: "stock",
        },
      ],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    };

    await enrichStatementImport(trusted, {
      repository,
      clock: () => Date.parse(resolvedAt),
    });

    expect(stored.get("HK:700")).toEqual({
      market: "HK",
      symbol: "700",
      name: "腾讯控股",
      assetType: "stock",
      source: "statement",
      confidence: "statement",
      resolvedAt,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const codeOnly: StatementParseResult = {
        ...trusted,
        records: [execution("HK", "700", undefined)],
        candidates: [
          {
            market: "HK",
            symbol: "700",
            sourceAssetType: "unknown",
          },
        ],
      };
      const result = await enrichStatementImport(codeOnly, {
        repository,
        clock: () => Date.parse(resolvedAt),
      });

      expect(result.importable[0].instrument.name).toBe("腾讯控股");
      expect(result.cacheHits).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not discard trusted statement trades when metadata cache writes fail", async () => {
    const repository: InstrumentMetadataRepository = {
      get: async () => undefined,
      getMany: async () => new Map(),
      put: async () => {
        throw new Error("quota exceeded");
      },
    };
    const parsed: StatementParseResult = {
      broker: "tiger",
      records: [execution("HK", "700", "腾讯控股")],
      candidates: [
        {
          market: "HK",
          symbol: "700",
          sourceName: "腾讯控股",
          sourceAssetType: "stock",
        },
      ],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    };

    const result = await enrichStatementImport(parsed, { repository });

    expect(result.importable).toHaveLength(1);
    expect(result.importable[0].instrument.name).toBe("腾讯控股");
  });

  it.each([
    [
      {
        market: "US" as const,
        symbol: "SPY",
        sourceName: "SPDR S&P 500 ETF Trust",
        sourceAssetType: "etf" as const,
      },
      {
        market: "US" as const,
        symbol: "SPY",
        sourceAssetType: "unknown" as const,
      },
    ],
    [
      {
        market: "US" as const,
        symbol: "SPY",
        sourceAssetType: "unknown" as const,
      },
      {
        market: "US" as const,
        symbol: "SPY",
        sourceName: "SPDR S&P 500 ETF Trust",
        sourceAssetType: "etf" as const,
      },
    ],
  ])("merges canonical candidate evidence independently of row order", async (
    first,
    second,
  ) => {
    const resolver = vi.fn(async () => resolution([]));
    const parsed: StatementParseResult = {
      broker: "futu",
      records: [
        execution("US", "SPY", undefined, "fill-1"),
        execution("US", "SPY", undefined, "fill-2"),
      ],
      candidates: [first, second],
      exclusions: [],
      diagnostics: [],
      blocked: false,
    };

    const result = await enrichStatementImport(parsed, { resolver });

    expect(resolver).not.toHaveBeenCalled();
    expect(result.importable).toHaveLength(2);
    expect(
      result.importable.every(
        (item) =>
          item.instrument.name === "SPDR S&P 500 ETF Trust",
      ),
    ).toBe(true);
  });
});
