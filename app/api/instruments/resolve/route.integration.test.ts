import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const NASDAQ_LISTED = [
  "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF",
  "AAPL|Apple Inc. - Common Stock|Q|N|N|100|N",
  "File Creation Time: 20260912",
].join("\n");

const OTHER_LISTED = [
  "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue",
  "QQQ|Invesco QQQ Trust|Q|QQQ|Y|100|N",
  "File Creation Time: 20260912",
].join("\n");

describe("GET /api/instruments/resolve integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns a late valid primary before the outer deadline while cancelling hanging Chinese lookup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T05:00:00.000Z"));
    let chineseStarted = false;
    let chineseAborted = false;
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      const url = String(input);
      if (url.includes("nasdaqlisted.txt")) {
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(
            () => resolve(new Response(NASDAQ_LISTED)),
            11_200,
          );
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }
      if (url.includes("otherlisted.txt")) {
        return Promise.resolve(new Response(OTHER_LISTED));
      }
      if (url.includes("qt.gtimg.cn")) {
        chineseStarted = true;
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            chineseAborted = true;
            reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });
      }
      throw new Error(`Unexpected metadata URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);

    const responsePromise = GET(
      new Request(
        "http://localhost/api/instruments/resolve?market=US&symbol=AAPL",
        { headers: { "x-forwarded-for": "198.51.100.50" } },
      ),
    );
    await vi.advanceTimersByTimeAsync(11_200);
    await vi.advanceTimersByTimeAsync(900);

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      market: "US",
      symbol: "AAPL",
      name: "Apple Inc. - Common Stock",
    });
    expect(chineseStarted).toBe(true);
    expect(chineseAborted).toBe(true);
  });
});
