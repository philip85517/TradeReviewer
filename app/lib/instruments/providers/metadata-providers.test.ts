import { describe, expect, it, vi } from "vitest";

import {
  EASTMONEY_BLANK_NAME,
  EASTMONEY_NO_DATA,
  EASTMONEY_SH_600519,
  EASTMONEY_SZ_159915,
  EASTMONEY_US_BABA,
  SINA_OTHER_CODE,
  SINA_SH_600519,
  SINA_SH_600519_ASCII,
  TENCENT_BLANK_NAME,
  TENCENT_HK_700,
  TENCENT_SZ_159915,
  TENCENT_US_AAPL,
} from "./__fixtures__/provider-responses";
import {
  EastmoneyMetadataProvider,
  parseEastmoneyMetadata,
} from "./eastmoney-metadata";
import { InstrumentMetadataProviderError } from "./metadata-errors";
import {
  parseSinaMetadata,
  SinaMetadataProvider,
} from "./sina-metadata";
import {
  parseTencentMetadata,
  TencentMetadataProvider,
} from "./tencent-metadata";

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

  it("uses Eastmoney type evidence or the audited A-share classifier", () => {
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

  it("uses the audited A-share classifier for Sina responses", () => {
    expect(
      parseSinaMetadata(SINA_SH_600519, {
        market: "CN-SH",
        symbol: "600519",
      }),
    ).toMatchObject({ name: "贵州茅台", assetType: "stock" });
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

  it("tries the supported Eastmoney US market IDs", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(EASTMONEY_NO_DATA, { status: 200 }))
      .mockResolvedValueOnce(new Response(EASTMONEY_US_BABA, { status: 200 }));

    await expect(
      new EastmoneyMetadataProvider().resolve(
        { market: "US", symbol: "BABA" },
        fetcher,
      ),
    ).resolves.toMatchObject({
      symbol: "BABA",
      name: "Alibaba Group Holding Ltd",
      assetType: "stock",
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("secid=105.BABA"),
      expect.stringContaining("secid=106.BABA"),
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
