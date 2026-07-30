import { afterEach, describe, expect, it, vi } from "vitest";

import {
  InstrumentMetadataResolutionError,
  createMetadataRouter,
} from "../../../lib/instruments/providers/metadata-router";

const { resolve } = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

vi.mock("../../../lib/instruments/providers/metadata-router", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../../../lib/instruments/providers/metadata-router")
    >();
  return {
    ...original,
    createMetadataRouter: vi.fn(() => ({ resolve })),
  };
});

import { GET } from "./route";

const SUCCESS = {
  market: "HK" as const,
  symbol: "700",
  name: "腾讯控股",
  assetType: "stock" as const,
  source: "hkex" as const,
  confidence: "official" as const,
  resolvedAt: "2026-07-29T00:00:00.000Z",
};

afterEach(() => {
  resolve.mockReset();
  vi.mocked(createMetadataRouter).mockClear();
  vi.useRealTimers();
});

describe("GET /api/instruments/resolve", () => {
  it("parses only the canonical instrument lookup", async () => {
    resolve.mockResolvedValue(SUCCESS);

    const response = await GET(
      new Request(
        "http://localhost/api/instruments/resolve?market=HK&symbol=00700&account=secret&statement=private",
        { headers: { "x-forwarded-for": "198.51.100.1" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUCCESS);
    expect(resolve).toHaveBeenCalledWith(
      { market: "HK", symbol: "700" },
      expect.any(AbortSignal),
    );
  });

  it("rejects invalid requests before resolving metadata", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/instruments/resolve?market=JP&symbol=7203",
        { headers: { "x-forwarded-for": "198.51.100.2" } },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid-request" },
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns a sanitized 404 with all attempts when no provider has data", async () => {
    resolve.mockRejectedValue(
      new InstrumentMetadataResolutionError("no-data", {
        market: "US",
        symbol: "BROKEN",
        attempts: [
          {
            source: "nasdaq",
            code: "no-data",
            message: "nasdaq 未找到证券",
          },
          {
            source: "tencent",
            code: "no-data",
            message: "tencent 未找到证券",
          },
        ],
      }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/instruments/resolve?market=US&symbol=BROKEN",
        { headers: { "x-forwarded-for": "198.51.100.3" } },
      ),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "unresolved",
        message: "未找到该股票或 ETF",
        attempts: [
          {
            source: "nasdaq",
            code: "no-data",
            message: "nasdaq 未找到证券",
          },
          {
            source: "tencent",
            code: "no-data",
            message: "tencent 未找到证券",
          },
        ],
      },
    });
  });

  it("rate limits repeated requests from one client", async () => {
    resolve.mockResolvedValue(SUCCESS);
    const request = () =>
      GET(
        new Request(
          "http://localhost/api/instruments/resolve?market=HK&symbol=700",
          { headers: { "x-forwarded-for": "198.51.100.4" } },
        ),
      );

    for (let index = 0; index < 30; index += 1) {
      expect((await request()).status).toBe(200);
    }
    const response = await request();

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "rate-limited" },
    });
    expect(resolve).toHaveBeenCalledTimes(30);
  });

  it("does not let sustained rejected requests consume the next rate-limit window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
    resolve.mockResolvedValue(SUCCESS);
    const request = () =>
      GET(
        new Request(
          "http://localhost/api/instruments/resolve?market=HK&symbol=700",
          { headers: { "x-forwarded-for": "198.51.100.7" } },
        ),
      );

    for (let index = 0; index < 30; index += 1) {
      expect((await request()).status).toBe(200);
    }
    vi.setSystemTime(new Date("2026-07-29T00:00:30.000Z"));
    for (let index = 0; index < 100; index += 1) {
      expect((await request()).status).toBe(429);
    }
    vi.setSystemTime(new Date("2026-07-29T00:01:00.001Z"));

    expect((await request()).status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(31);
  });

  it("aborts the full provider chain after twelve seconds", async () => {
    vi.useFakeTimers();
    let chainSignal: AbortSignal | undefined;
    resolve.mockImplementation((_lookup, signal: AbortSignal) => {
      chainSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    });

    const responsePromise = GET(
      new Request(
        "http://localhost/api/instruments/resolve?market=HK&symbol=700",
        { headers: { "x-forwarded-for": "198.51.100.5" } },
      ),
    );
    await vi.advanceTimersByTimeAsync(12_000);
    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      error: { code: "source-timeout" },
    });
    expect(chainSignal?.aborted).toBe(true);
  });

  it("adds public transient caching only to successful responses", async () => {
    resolve.mockResolvedValue(SUCCESS);

    const response = await GET(
      new Request(
        "http://localhost/api/instruments/resolve?market=HK&symbol=700",
        { headers: { "x-forwarded-for": "198.51.100.6" } },
      ),
    );

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=21600, stale-while-revalidate=86400",
    );
  });
});
