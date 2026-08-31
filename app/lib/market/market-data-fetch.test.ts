import { describe, expect, it, vi } from "vitest";

import { createMarketDataFetcher } from "./market-data-fetch";

describe("createMarketDataFetcher", () => {
  it("retries transient provider responses and returns the successful response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const request = createMarketDataFetcher(fetcher, {
      minIntervalMs: 0,
      retryDelayMs: 0,
    });

    const response = await request("/api/market-data/daily");

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent client errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("bad request", { status: 400 }));
    const request = createMarketDataFetcher(fetcher, {
      minIntervalMs: 0,
      retryDelayMs: 0,
    });

    const response = await request("/api/market-data/daily");

    expect(response.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["no-data", "provider-history-limit", "source-unavailable"])(
    "does not retry a market-data route error after provider fallback: %s",
    async (code) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json(
          { error: { code, message: "历史区间没有数据" } },
          { status: 502 },
        ),
      );
      const request = createMarketDataFetcher(fetcher, {
        minIntervalMs: 0,
        retryDelayMs: 0,
      });

      const response = await request("/api/market-data/daily");

      expect(fetcher).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toMatchObject({
        error: { code },
      });
    },
  );
});
