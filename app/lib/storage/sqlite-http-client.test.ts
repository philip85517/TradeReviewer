import { describe, expect, it, vi } from "vitest";

import type { BrowserStatePayload } from "./sqlite-contracts";
import {
  createSqliteHttpClient,
  StorageHttpError,
} from "./sqlite-http-client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("createSqliteHttpClient", () => {
  it("uses same-origin no-store GET requests and parses storage status", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({ schemaVersion: 4, migration: null, counts: { executions: 2 } }),
    );
    const client = createSqliteHttpClient(fetcher);

    await expect(client.getStatus()).resolves.toEqual({
      schemaVersion: 4,
      migration: null,
      counts: { executions: 2 },
    });
    expect(fetcher).toHaveBeenCalledWith("/api/storage/status", {
      cache: "no-store",
    });
  });

  it("serializes migration and market-data writes to their API contracts", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          sourceFingerprint: "fingerprint",
          inserted: 1,
          duplicate: 0,
          conflict: 0,
          failed: 0,
          validationDigest: "digest",
        }),
      )
      .mockResolvedValueOnce(json({ ok: true }));
    const client = createSqliteHttpClient(fetcher);
    const payload = {
      version: 1,
      sourceClientId: "browser-1",
      sourceFingerprint: "fingerprint",
      executions: [],
      importHistory: [],
      instruments: [],
      reviews: [],
      reviewStates: [],
      tagSuggestions: [],
      marketDataJobs: [],
      settings: {},
      dailyCandles: [],
      marketCandles: [],
      coverage: [],
      intervalCoverage: [],
      providerSymbols: [],
    } satisfies BrowserStatePayload;
    const marketData = {
      kind: "daily" as const,
      result: {
        instrumentId: "HK:700",
        candles: [],
        coverage: [],
        providerSymbol: { provider: "tencent" as const, symbol: "700" },
      },
    };

    await client.migrate(payload);
    await client.putMarketData(marketData);

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/storage/migrate", {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/storage/market-data", {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(marketData),
    });
  });

  it("encodes market-data query parameters without caching the response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({ candles: [], intervalCoverage: [], coverage: [] }),
    );

    await createSqliteHttpClient(fetcher).getMarketData({
      instrumentId: "HK:700 & A",
      interval: "1D",
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-01-31T23:59:59.999Z",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/storage/market-data?instrumentId=HK%3A700+%26+A&interval=1D&start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-31T23%3A59%3A59.999Z",
      { cache: "no-store" },
    );
  });

  it("exposes structured non-success responses as StorageHttpError", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        { error: { code: "storage-unavailable", message: "try later" } },
        503,
      ),
    );

    await expect(createSqliteHttpClient(fetcher).getBootstrap()).rejects.toEqual(
      new StorageHttpError(503, "storage-unavailable", "try later"),
    );
  });
});
