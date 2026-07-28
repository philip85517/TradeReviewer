import { describe, expect, it, vi } from "vitest";

import type { ResolvedInstrument } from "./metadata-contracts";
import { canonicalInstrumentId } from "./display-name";
import {
  refreshInstrumentMetadata,
  resolveInstrumentMetadataBatch,
} from "./resolve-service";

function memoryRepository(seed: ResolvedInstrument[] = []) {
  const records = new Map(
    seed.map((record) => [
      canonicalInstrumentId(record.symbol, record.market),
      record,
    ]),
  );
  return {
    get: vi.fn(async (instrumentId: string) => records.get(instrumentId)),
    getMany: vi.fn(async (instrumentIds: string[]) =>
      new Map(
        instrumentIds.flatMap((instrumentId) => {
          const record = records.get(instrumentId);
          return record ? [[instrumentId, record] as const] : [];
        }),
      ),
    ),
    put: vi.fn(async (record: ResolvedInstrument) => {
      records.set(
        canonicalInstrumentId(record.symbol, record.market),
        record,
      );
    }),
  };
}

describe("resolveInstrumentMetadataBatch", () => {
  it("returns fresh cached portal records without network requests", async () => {
    const fetcher = vi.fn();
    const seededRepository = memoryRepository([
      {
        market: "HK",
        symbol: "700",
        name: "腾讯控股",
        assetType: "stock",
        source: "tencent",
        confidence: "portal",
        resolvedAt: "2026-07-10T00:00:00.000Z",
      },
    ]);

    const result = await resolveInstrumentMetadataBatch(
      [
        { market: "HK", symbol: "700" },
        { market: "HK", symbol: "00700" },
      ],
      {
        repository: seededRepository,
        fetcher,
        concurrency: 3,
        clock: () => Date.parse("2026-07-29T12:00:00.000Z"),
      },
    );

    expect(result.resolved.size).toBe(1);
    expect(result.cacheHits).toBe(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes stale portal metadata and replaces the cached result", async () => {
    const repository = memoryRepository([
      {
        market: "HK",
        symbol: "700",
        name: "旧名称",
        assetType: "stock",
        source: "tencent",
        confidence: "portal",
        resolvedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
    const fetcher = vi.fn(async () =>
      Response.json({
        market: "HK",
        symbol: "700",
        name: "腾讯控股",
        assetType: "stock",
        source: "hkex",
        confidence: "official",
        resolvedAt: "2026-07-29T12:00:00.000Z",
      }),
    );

    const result = await resolveInstrumentMetadataBatch(
      [{ market: "HK", symbol: "00700" }],
      {
        repository,
        fetcher,
        clock: () => Date.parse("2026-07-29T12:00:00.000Z"),
      },
    );

    expect(result.resolved.get("HK:700")?.name).toBe("腾讯控股");
    expect(result.cacheHits).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(repository.put).toHaveBeenCalledWith(
      expect.objectContaining({ name: "腾讯控股" }),
    );
    expect(result.unresolved.size).toBe(0);
  });

  it("retains stale metadata when its bounded refresh fails", async () => {
    const repository = memoryRepository([
      {
        market: "US",
        symbol: "AAPL",
        name: "Cached Apple",
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-20T00:00:00.000Z",
      },
    ]);
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "unresolved",
            attempts: [
              {
                source: "nasdaq",
                code: "no-data",
                message: "未找到证券",
              },
            ],
          },
        },
        { status: 404 },
      ),
    );

    const result = await resolveInstrumentMetadataBatch(
      [{ market: "US", symbol: "AAPL" }],
      {
        repository,
        fetcher,
        concurrency: 1,
        clock: () => Date.parse("2026-07-29T12:00:00.000Z"),
      },
    );

    expect(result.resolved.get("US:AAPL")?.name).toBe("Cached Apple");
    expect(result.cacheHits).toBe(1);
    expect(result.unresolved.size).toBe(0);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("deduplicates lookups, caps concurrency, and caches successes", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      const url = new URL(String(input), "http://localhost");
      const symbol = url.searchParams.get("symbol") ?? "";
      return Response.json({
        market: "US",
        symbol,
        name: `${symbol} Incorporated`,
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      });
    });
    const repository = memoryRepository();

    const result = await resolveInstrumentMetadataBatch(
      ["AAPL", "MSFT", "NVDA", "META", "AAPL"].map((symbol) => ({
        market: "US" as const,
        symbol,
      })),
      { repository, fetcher, concurrency: 3 },
    );

    expect(result.resolved.size).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(repository.put).toHaveBeenCalledTimes(4);
    expect(maximumActive).toBeLessThanOrEqual(3);
  });

  it("preserves attempts for unresolved instruments", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "unresolved",
            attempts: [
              {
                source: "nasdaq",
                code: "no-data",
                message: "未找到证券",
              },
            ],
          },
        },
        { status: 404 },
      ),
    );

    const result = await resolveInstrumentMetadataBatch(
      [{ market: "US", symbol: "BROKEN" }],
      { repository: memoryRepository(), fetcher },
    );

    expect(result.unresolved.get("US:BROKEN")).toMatchObject({
      symbol: "BROKEN",
      attempts: [{ source: "nasdaq", code: "no-data" }],
    });
  });

  it("falls back to isolated requests when the batch cache read fails", async () => {
    const repository = memoryRepository();
    repository.getMany.mockRejectedValueOnce(new Error("cache unavailable"));
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const symbol = new URL(
        String(input),
        "http://localhost",
      ).searchParams.get("symbol");
      return Response.json({
        market: "US",
        symbol,
        name: `${symbol} Incorporated`,
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      });
    });

    const result = await resolveInstrumentMetadataBatch(
      [
        { market: "US", symbol: "AAPL" },
        { market: "US", symbol: "MSFT" },
      ],
      { repository, fetcher },
    );

    expect(result.resolved.size).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("isolates request, validation, and persistence failures", async () => {
    const repository = memoryRepository();
    repository.put.mockRejectedValueOnce(new Error("storage full"));
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const symbol = new URL(
        String(input),
        "http://localhost",
      ).searchParams.get("symbol");
      if (symbol === "OFFLINE") throw new Error("offline");
      if (symbol === "INVALID") {
        return Response.json({
          market: "US",
          symbol,
          name: symbol,
          assetType: "stock",
          source: "nasdaq",
          confidence: "official",
          resolvedAt: "2026-07-29T00:00:00.000Z",
        });
      }
      return Response.json({
        market: "US",
        symbol,
        name: `${symbol} Incorporated`,
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      });
    });

    const result = await resolveInstrumentMetadataBatch(
      ["PERSIST", "OFFLINE", "INVALID", "AAPL"].map((symbol) => ({
        market: "US" as const,
        symbol,
      })),
      { repository, fetcher, concurrency: 2 },
    );

    expect(result.resolved.has("US:AAPL")).toBe(true);
    expect(result.unresolved.get("US:OFFLINE")?.attempts[0]?.code).toBe(
      "request-failed",
    );
    expect(result.unresolved.get("US:INVALID")?.attempts[0]?.code).toBe(
      "invalid-response",
    );
    expect(result.unresolved.get("US:PERSIST")?.attempts[0]?.code).toBe(
      "cache-write-failed",
    );
  });

  it("force-refreshes one lookup and overwrites a validated success", async () => {
    const repository = memoryRepository([
      {
        market: "US",
        symbol: "AAPL",
        name: "Old Apple",
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-28T00:00:00.000Z",
      },
    ]);
    const fetcher = vi.fn(async () =>
      Response.json({
        market: "US",
        symbol: "AAPL",
        name: "Apple Inc.",
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      }),
    );

    const result = await refreshInstrumentMetadata(
      { market: "US", symbol: "aapl" },
      { repository, fetcher },
    );

    expect(result?.name).toBe("Apple Inc.");
    expect(repository.getMany).not.toHaveBeenCalled();
    expect(repository.put).toHaveBeenCalledOnce();
  });

  it("does not persist a response after its request is cancelled", async () => {
    const repository = memoryRepository();
    const controller = new AbortController();
    let releaseResponse: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const responseReady = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const fetcher = vi.fn(async () => {
      markStarted?.();
      await responseReady;
      return Response.json({
        market: "US",
        symbol: "AAPL",
        name: "Apple Inc.",
        assetType: "stock",
        source: "nasdaq",
        confidence: "official",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      });
    });

    const resolution = resolveInstrumentMetadataBatch(
      [{ market: "US", symbol: "AAPL" }],
      { repository, fetcher, signal: controller.signal },
    );
    await requestStarted;
    controller.abort();
    releaseResponse?.();
    const result = await resolution;

    expect(repository.put).not.toHaveBeenCalled();
    expect(result.unresolved.get("US:AAPL")?.attempts[0]?.code).toBe(
      "aborted",
    );
  });
});
