import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import {
  EASTMONEY_BLANK_NAME,
  EASTMONEY_HK_700,
  EASTMONEY_NAME_IS_CODE,
  EASTMONEY_NO_DATA,
  EASTMONEY_SH_510300,
  EASTMONEY_SH_600519,
  EASTMONEY_SZ_159915,
  EASTMONEY_US_BABA,
  EASTMONEY_WRONG_MARKET_600519,
  SINA_OTHER_CODE,
  SINA_NAME_IS_CODE,
  SINA_SH_600519,
  SINA_SH_600519_ASCII,
  SINA_SH_600519_GB18030,
  TENCENT_BLANK_NAME,
  TENCENT_HK_700,
  TENCENT_HK_700_GB18030,
  TENCENT_NAME_IS_CODE,
  TENCENT_SZ_159915,
  TENCENT_US_AAPL,
} from "./__fixtures__/provider-responses";
import HKEX_ROWS from "./__fixtures__/hkex-securities.json";
import {
  EastmoneyMetadataProvider,
  parseEastmoneyMetadata,
} from "./eastmoney-metadata";
import {
  HkexDirectoryProvider,
  parseHkexRows,
} from "./hkex-directory";
import { InstrumentMetadataProviderError } from "./metadata-errors";
import {
  type CatalogCache,
  NasdaqDirectoryProvider,
  parseNasdaqDirectories,
} from "./nasdaq-directory";
import {
  parseSecCompanyTickers,
  SecCompanyTickersProvider,
} from "./sec-company-tickers";
import {
  parseSinaMetadata,
  SinaMetadataProvider,
} from "./sina-metadata";
import {
  parseTencentMetadata,
  TencentMetadataProvider,
} from "./tencent-metadata";

const NASDAQ_LISTED = readFileSync(
  resolve(
    process.cwd(),
    "app/lib/instruments/providers/__fixtures__/nasdaqlisted.txt",
  ),
  "utf8",
);
const OTHER_LISTED = readFileSync(
  resolve(
    process.cwd(),
    "app/lib/instruments/providers/__fixtures__/otherlisted.txt",
  ),
  "utf8",
);

describe("portal metadata providers", () => {
  it("parses Tencent stock and ETF responses with matching codes", () => {
    expect(
      parseTencentMetadata(TENCENT_HK_700, {
        market: "HK",
        symbol: "700",
      }),
    ).toMatchObject({ name: "腾讯控股", assetType: "stock" });
    expect(
      parseTencentMetadata(TENCENT_SZ_159915, {
        market: "CN-SZ",
        symbol: "159915",
      }),
    ).toMatchObject({ name: "创业板ETF易方达", assetType: "etf" });
  });

  it("uses the audited A-share classifier for Eastmoney responses", () => {
    expect(
      parseEastmoneyMetadata(EASTMONEY_SH_600519, {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toMatchObject({ name: "贵州茅台", assetType: "stock" });
    expect(
      parseEastmoneyMetadata(EASTMONEY_SZ_159915, {
        market: "CN-SZ",
        symbol: "159915",
      }),
    ).toMatchObject({ name: "创业板ETF易方达", assetType: "etf" });
  });

  it("classifies Shanghai ETFs from the audited A-share classifier", () => {
    expect(
      parseEastmoneyMetadata(EASTMONEY_SH_510300, {
        market: "CN-SH",
        symbol: "510300",
      }),
    ).toMatchObject({ name: "沪深300ETF", assetType: "etf" });
  });

  it("rejects an Eastmoney response from the wrong market", () => {
    expect(() =>
      parseEastmoneyMetadata(
        EASTMONEY_WRONG_MARKET_600519,
        { market: "CN-SH", symbol: "600519" },
        "1",
      ),
    ).toThrowError(
      expect.objectContaining<Partial<InstrumentMetadataProviderError>>({
        code: "invalid-response",
      }),
    );
  });

  it("returns no-data for Eastmoney HK and US responses without type evidence", () => {
    expect(() =>
      parseEastmoneyMetadata(
        EASTMONEY_HK_700,
        { market: "HK", symbol: "700" },
        "116",
      ),
    ).toThrowError(
      expect.objectContaining<Partial<InstrumentMetadataProviderError>>({
        code: "no-data",
      }),
    );
    expect(() =>
      parseEastmoneyMetadata(
        EASTMONEY_US_BABA,
        { market: "US", symbol: "BABA" },
        "106",
      ),
    ).toThrowError(
      expect.objectContaining<Partial<InstrumentMetadataProviderError>>({
        code: "no-data",
      }),
    );
  });

  it("uses the audited A-share classifier for Sina responses", () => {
    expect(
      parseSinaMetadata(SINA_SH_600519, {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toMatchObject({ name: "贵州茅台", assetType: "stock" });
  });

  it("decodes Sina response bytes as GB18030 by default", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(SINA_SH_600519_GB18030));

    await expect(
      new SinaMetadataProvider().resolve(
        { market: "CN-SH", symbol: "600519" },
        fetcher,
      ),
    ).resolves.toMatchObject({ name: "㐀科技", assetType: "stock" });
  });

  it("rejects HTML, blank names, and code mismatches", () => {
    expect(() =>
      parseEastmoneyMetadata("<html>blocked</html>", {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toThrow("无法解析");
    expect(() =>
      parseTencentMetadata(TENCENT_BLANK_NAME, {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toThrow("名称为空");
    expect(() =>
      parseEastmoneyMetadata(EASTMONEY_BLANK_NAME, {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toThrow("名称为空");
    expect(() =>
      parseSinaMetadata(SINA_OTHER_CODE, {
        market: "US",
        symbol: "AAPL",
      }),
    ).toThrow("代码不匹配");
  });

  it("maps final result validation failures to invalid-response", () => {
    const invalidResults = [
      () =>
        parseTencentMetadata(TENCENT_NAME_IS_CODE, {
          market: "HK",
          symbol: "700",
        }),
      () =>
        parseEastmoneyMetadata(
          EASTMONEY_NAME_IS_CODE,
          { market: "CN-SH", symbol: "600519" },
          "1",
        ),
      () =>
        parseSinaMetadata(SINA_NAME_IS_CODE, {
          market: "CN-SH",
          symbol: "600519",
        }),
    ];

    for (const parse of invalidResults) {
      expect(parse).toThrowError(
        expect.objectContaining<Partial<InstrumentMetadataProviderError>>({
          code: "invalid-response",
        }),
      );
    }
  });

  it("rejects no data and responses without asset-type evidence", () => {
    expect(() =>
      parseEastmoneyMetadata(EASTMONEY_NO_DATA, {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<InstrumentMetadataProviderError>>({
        code: "no-data",
      }),
    );
    expect(() =>
      parseSinaMetadata(
        'var hq_str_gb_aapl="Apple Inc.,214.05,212.41";',
        { market: "US", symbol: "AAPL" },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<InstrumentMetadataProviderError>>({
        code: "no-data",
      }),
    );
  });

  it("maps portal symbols and returns validated metadata", async () => {
    const tencentFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(TENCENT_US_AAPL, {
        status: 200,
        headers: { "content-type": "text/plain; charset=gbk" },
      }),
    );
    const eastmoneyFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(EASTMONEY_SH_600519, { status: 200 }),
    );
    const sinaFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(SINA_SH_600519_ASCII, { status: 200 }),
    );

    await expect(
      new TencentMetadataProvider().resolve(
        { market: "US", symbol: "aapl" },
        tencentFetch,
      ),
    ).resolves.toMatchObject({
      market: "US",
      symbol: "AAPL",
      name: "Apple Inc.",
      assetType: "stock",
      source: "tencent",
      confidence: "portal",
    });
    await expect(
      new EastmoneyMetadataProvider().resolve(
        { market: "CN-SH", symbol: "600519" },
        eastmoneyFetch,
      ),
    ).resolves.toMatchObject({
      name: "贵州茅台",
      assetType: "stock",
      source: "eastmoney",
    });
    await expect(
      new SinaMetadataProvider().resolve(
        { market: "CN-SH", symbol: "600519" },
        sinaFetch,
      ),
    ).resolves.toMatchObject({
      name: "Kweichow Moutai",
      assetType: "stock",
      source: "sina",
    });

    expect(tencentFetch.mock.calls[0]?.[0]).toContain("q=usAAPL");
    expect(eastmoneyFetch.mock.calls[0]?.[0]).toContain("secid=1.600519");
    expect(eastmoneyFetch.mock.calls[0]?.[0]).toContain(
      "fields=f57%2Cf58%2Cf107",
    );
    expect(sinaFetch.mock.calls[0]?.[0]).toContain("list=sh600519");
    expect(sinaFetch.mock.calls[0]?.[1]).toMatchObject({
      headers: { Referer: "https://finance.sina.com.cn/" },
    });
  });

  it("decodes Tencent response bytes using the declared charset", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(TENCENT_HK_700, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );

    await expect(
      new TencentMetadataProvider().resolve(
        { market: "HK", symbol: "700" },
        fetcher,
      ),
    ).resolves.toMatchObject({ name: "腾讯控股", assetType: "stock" });
  });

  it("decodes Tencent response bytes as GB18030 by default", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(TENCENT_HK_700_GB18030));

    await expect(
      new TencentMetadataProvider().resolve(
        { market: "HK", symbol: "700" },
        fetcher,
      ),
    ).resolves.toMatchObject({ name: "㐀科技", assetType: "stock" });
  });

  it("tries the supported Eastmoney US market IDs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(EASTMONEY_NO_DATA, { status: 200 }))
      .mockResolvedValueOnce(new Response(EASTMONEY_US_BABA, { status: 200 }))
      .mockResolvedValueOnce(new Response(EASTMONEY_NO_DATA, { status: 200 }));

    await expect(
      new EastmoneyMetadataProvider().resolve(
        { market: "US", symbol: "BABA" },
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "no-data" });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("secid=105.BABA"),
      expect.stringContaining("secid=106.BABA"),
      expect.stringContaining("secid=107.BABA"),
    ]);
  });

  it("pads the Eastmoney HK symbol to five digits", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(EASTMONEY_NO_DATA, { status: 200 }));

    await expect(
      new EastmoneyMetadataProvider().resolve(
        { market: "HK", symbol: "700" },
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "no-data" });
    expect(fetcher.mock.calls[0]?.[0]).toContain("secid=116.00700");
  });

  it.each([
    [403, "source-forbidden"],
    [429, "source-rate-limited"],
    [503, "source-unavailable"],
  ] as const)("maps HTTP %s to %s", async (status, code) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status }));

    await expect(
      new TencentMetadataProvider().resolve(
        { market: "US", symbol: "AAPL" },
        fetcher,
      ),
    ).rejects.toMatchObject({ code, status });
  });

  it("maps timeouts and malformed provider responses", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    const timeoutFetcher = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    const invalidFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html>blocked</html>", { status: 200 }));

    await expect(
      new SinaMetadataProvider().resolve(
        { market: "CN-SH", symbol: "600519" },
        timeoutFetcher,
      ),
    ).rejects.toMatchObject({ code: "source-timeout" });
    await expect(
      new EastmoneyMetadataProvider().resolve(
        { market: "CN-SH", symbol: "600519" },
        invalidFetcher,
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("declares market support without making network requests", () => {
    const lookups = [
      { market: "US", symbol: "AAPL" },
      { market: "HK", symbol: "700" },
      { market: "CN-SH", symbol: "600519" },
      { market: "CN-SZ", symbol: "159915" },
    ] as const;

    for (const lookup of lookups) {
      expect(new TencentMetadataProvider().supports(lookup)).toBe(true);
      expect(new EastmoneyMetadataProvider().supports(lookup)).toBe(true);
      expect(new SinaMetadataProvider().supports(lookup)).toBe(true);
    }
  });
});

describe("official catalog providers", () => {
  const SEC_COMPANY_TICKERS = {
    fields: ["cik", "name", "ticker", "exchange"],
    data: [
      [320193, "Apple Inc.", "AAPL", "Nasdaq"],
      [1067983, "Berkshire Hathaway Inc.", "BRK-B", "NYSE"],
    ],
  };

  class MemoryCatalogCache implements CatalogCache {
    readonly entries = new Map<string, Response>();

    async match(key: string) {
      return this.entries.get(key)?.clone();
    }

    async put(key: string, response: Response) {
      this.entries.set(key, response.clone());
    }
  }

  function hkexWorkbookBytes() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(HKEX_ROWS),
      "List of Securities",
    );
    return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  }

  it("merges Nasdaq-listed and other-listed stock/ETF rows", () => {
    const directory = parseNasdaqDirectories(NASDAQ_LISTED, OTHER_LISTED);
    expect(directory.get("AAPL")).toMatchObject({
      assetType: "stock",
      source: "nasdaq",
    });
    expect(directory.get("SPY")).toMatchObject({
      assetType: "etf",
      source: "nasdaq",
    });
    expect(directory.has("ZVZZT")).toBe(false);
  });

  it("accepts only HK equities and ETFs from the official list", () => {
    const directory = parseHkexRows(HKEX_ROWS);
    expect(directory.get("00700")?.assetType).toBe("stock");
    expect(directory.get("02800")?.assetType).toBe("etf");
    expect(directory.has("convertible-bond-row")).toBe(false);
  });

  it("parses SEC company tickers only as stock identities", () => {
    const directory = parseSecCompanyTickers(SEC_COMPANY_TICKERS);
    expect(directory.get("AAPL")).toMatchObject({
      name: "Apple Inc.",
      assetType: "stock",
      source: "sec",
    });
    expect(
      [...directory.values()].every(({ assetType }) => assetType === "stock"),
    ).toBe(true);
  });

  it("coalesces concurrent Nasdaq downloads and reuses the daily raw cache", async () => {
    const cache = new MemoryCatalogCache();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/nasdaqlisted.txt")) {
        return new Response(NASDAQ_LISTED);
      }
      if (url.endsWith("/otherlisted.txt")) {
        return new Response(OTHER_LISTED);
      }
      return new Response("", { status: 404 });
    });
    const now = () => Date.UTC(2026, 6, 29);
    const first = new NasdaqDirectoryProvider({ cache, fetcher, now });
    const second = new NasdaqDirectoryProvider({ cache, fetcher, now });

    await expect(
      Promise.all([
        first.resolve({ market: "US", symbol: "AAPL" }),
        second.resolve({ market: "US", symbol: "SPY" }),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ symbol: "AAPL", assetType: "stock" }),
      expect.objectContaining({ symbol: "SPY", assetType: "etf" }),
    ]);
    await expect(
      new NasdaqDirectoryProvider({ cache, fetcher, now }).resolve({
        market: "US",
        symbol: "QQQ",
      }),
    ).resolves.toMatchObject({ symbol: "QQQ", assetType: "etf" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(2);
  });

  it("reads HKEX xlsx bytes once for concurrent same-day lookups", async () => {
    const cache = new MemoryCatalogCache();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(hkexWorkbookBytes()));
    const now = () => Date.UTC(2026, 6, 29);

    await expect(
      Promise.all([
        new HkexDirectoryProvider({ cache, fetcher, now }).resolve({
          market: "HK",
          symbol: "700",
        }),
        new HkexDirectoryProvider({ cache, fetcher, now }).resolve({
          market: "HK",
          symbol: "02800",
        }),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ symbol: "700", assetType: "stock" }),
      expect.objectContaining({ symbol: "2800", assetType: "etf" }),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.entries.size).toBe(1);
  });

  it("identifies SEC requests and refreshes the raw cache after 86400 seconds", async () => {
    const cache = new MemoryCatalogCache();
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(SEC_COMPANY_TICKERS), {
          headers: { "content-type": "application/json" },
      }),
    );
    let currentTime = Date.UTC(2026, 6, 29);
    const provider = new SecCompanyTickersProvider({
      cache,
      fetcher,
      now: () => currentTime,
    });

    await expect(
      provider.resolve({ market: "US", symbol: "AAPL" }),
    ).resolves.toMatchObject({ symbol: "AAPL", assetType: "stock" });
    await expect(
      provider.resolve({ market: "US", symbol: "BRK-B" }),
    ).resolves.toMatchObject({ symbol: "BRK-B", assetType: "stock" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "User-Agent": expect.any(String) }),
    });

    currentTime += 86_400_000;
    await provider.resolve({ market: "US", symbol: "AAPL" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
