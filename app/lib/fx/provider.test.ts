import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FX_PROVIDER_ENDPOINT,
  fetchLatestFxSnapshot,
} from "./provider";

afterEach(() => {
  vi.useRealTimers();
});

describe("Frankfurter ECB FX provider", () => {
  it("requests only CNY base quotes and normalizes all required rates", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(FX_PROVIDER_ENDPOINT);
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();
      return Response.json([
        { date: "2026-09-18", base: "CNY", quote: "HKD", rate: 1.1713 },
        { date: "2026-09-18", base: "CNY", quote: "USD", rate: 0.14931 },
      ]);
    });

    await expect(
      fetchLatestFxSnapshot({
        fetcher,
        now: () => new Date("2026-09-19T10:00:00.000Z"),
      }),
    ).resolves.toEqual({
      version: 1,
      baseCurrency: "CNY",
      rates: { CNY: 1, HKD: 1 / 1.1713, USD: 1 / 0.14931 },
      source: expect.objectContaining({ id: "frankfurter-ecb" }),
      rateDate: "2026-09-18",
      fetchedAt: "2026-09-19T10:00:00.000Z",
      lastAttemptedAt: "2026-09-19T10:00:00.000Z",
      cacheStatus: "fresh",
    });
  });

  it("rejects missing or non-positive rates as an invalid full snapshot", async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        { date: "2026-09-18", base: "CNY", quote: "HKD", rate: 0 },
      ]),
    );

    await expect(fetchLatestFxSnapshot({ fetcher })).rejects.toMatchObject({
      code: "invalid-response",
    });
  });

  it("rejects calendar-invalid provider dates", async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        { date: "2026-02-31", base: "CNY", quote: "HKD", rate: 1.17 },
        { date: "2026-02-31", base: "CNY", quote: "USD", rate: 0.15 },
      ]),
    );

    await expect(fetchLatestFxSnapshot({ fetcher })).rejects.toMatchObject({
      code: "invalid-response",
    });
  });

  it("aborts a provider request after the bounded timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );
    const promise = fetchLatestFxSnapshot({ fetcher, timeoutMs: 25 });
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it("keeps the timeout active while reading a response body", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: () => new Promise<unknown>(() => undefined),
    } as Response));
    const promise = fetchLatestFxSnapshot({ fetcher, timeoutMs: 25 });
    const assertion = expect(promise).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it("rejects null rows and duplicate currency rows as invalid responses", async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        { date: "2026-09-18", base: "CNY", quote: "HKD", rate: 1.17 },
        { date: "2026-09-18", base: "CNY", quote: "HKD", rate: 1.18 },
        null,
      ]),
    );

    await expect(fetchLatestFxSnapshot({ fetcher })).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
});
