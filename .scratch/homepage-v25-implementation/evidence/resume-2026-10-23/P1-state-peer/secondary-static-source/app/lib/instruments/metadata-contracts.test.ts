import { describe, expect, it } from "vitest";
import {
  mergeInstrumentExchange,
  validateResolvedInstrument,
  type InstrumentLookup,
} from "./metadata-contracts";
import {
  InvalidInstrumentLookup,
  parseInstrumentLookup,
} from "./metadata-request-policy";
import { classifyExchangeTradedAsset } from "./asset-classification";

describe("instrument metadata contracts", () => {
  it("retains only source-backed US exchange evidence and merges it independently of name recency", () => {
    const metadata = { market: "US" as const, symbol: "AAPL", name: "Apple Inc.", assetType: "stock" as const, source: "sec" as const, confidence: "official" as const, resolvedAt: "2026-10-22T00:00:00Z" };
    const exchange = { code: "NASDAQ" as const, source: "sec" as const, resolvedAt: "2026-10-21T00:00:00Z" };
    expect(validateResolvedInstrument({ ...metadata, exchange }, metadata).exchange).toEqual({ ...exchange, resolvedAt: "2026-10-21T00:00:00.000Z" });
    for (const invalid of [{ ...exchange, code: "US" }, { ...exchange, source: "tencent" }, { ...exchange, resolvedAt: "bad" }]) {
      expect(() => validateResolvedInstrument({ ...metadata, exchange: invalid }, metadata)).toThrow();
    }
    expect(mergeInstrumentExchange({ ...metadata, exchange }, metadata).exchange).toEqual(exchange);
    const newer = { code: "NYSE" as const, source: "nasdaq" as const, resolvedAt: "2026-10-23T00:00:00Z" };
    expect(mergeInstrumentExchange({ ...metadata, exchange }, { ...metadata, exchange: newer }).exchange).toEqual(newer);
    expect(mergeInstrumentExchange({ ...metadata, exchange: newer }, { ...metadata, exchange }).exchange).toEqual(newer);
    expect(mergeInstrumentExchange({ ...metadata, exchange: { ...exchange, resolvedAt: newer.resolvedAt } }, { ...metadata, exchange: newer }).exchange?.source).toBe("nasdaq");
  });
  const lookup: InstrumentLookup = { market: "HK", symbol: "700" };

  it("accepts a matching stock or ETF result", () => {
    expect(
      validateResolvedInstrument(
        {
          market: "HK",
          symbol: "700",
          name: "腾讯控股",
          localizedName: {
            name: " 腾讯控股 ",
            locale: "zh-CN",
            source: " tencent ",
            resolvedAt: "2026-07-29T00:00:00.000Z",
          },
          assetType: "stock",
          source: "tencent",
          confidence: "portal",
          resolvedAt: "2026-07-29T00:00:00.000Z",
        },
        lookup,
      ),
    ).toMatchObject({
      name: "腾讯控股",
      localizedName: {
        name: "腾讯控股",
        locale: "zh-CN",
        source: "tencent",
      },
    });
  });

  it("rejects malformed localized metadata without changing the original name", () => {
    for (const localizedName of [
      { name: "Apple", locale: "zh-CN", source: "tencent", resolvedAt: "2026-07-29T00:00:00.000Z" },
      { name: "苹果", locale: "en-US", source: "tencent", resolvedAt: "2026-07-29T00:00:00.000Z" },
      { name: "苹果", locale: "zh-CN", source: "", resolvedAt: "2026-07-29T00:00:00.000Z" },
      { name: "苹果", locale: "zh-CN", source: "tencent", resolvedAt: "not-a-time" },
    ]) {
      expect(() =>
        validateResolvedInstrument(
          {
            market: "US",
            symbol: "AAPL",
            name: "Apple Inc.",
            localizedName,
            assetType: "stock",
            source: "nasdaq",
            confidence: "official",
            resolvedAt: "2026-07-29T00:00:00.000Z",
          },
          { market: "US", symbol: "AAPL" },
        ),
      ).toThrow();
    }
  });

  it("rejects a mismatched code, blank name, or unsupported type", () => {
    expect(() =>
      validateResolvedInstrument(
        {
          market: "HK",
          symbol: "9988",
          name: " ",
          assetType: "bond",
          source: "tencent",
          confidence: "portal",
          resolvedAt: "2026-07-29T00:00:00.000Z",
        },
        lookup,
      ),
    ).toThrow();
  });

  it("rejects an invalid main metadata timestamp", () => {
    expect(() =>
      validateResolvedInstrument(
        {
          market: "US",
          symbol: "AAPL",
          name: "Apple Inc.",
          assetType: "stock",
          source: "nasdaq",
          confidence: "official",
          resolvedAt: "not-a-date",
        },
        { market: "US", symbol: "AAPL" },
      ),
    ).toThrow();
  });

  it("normalizes route input and rejects unsupported markets", () => {
    expect(
      parseInstrumentLookup(
        new URL("https://example.test/api/instruments/resolve?market=HK&symbol=00700"),
      ),
    ).toEqual({ market: "HK", symbol: "700" });
    expect(() =>
      parseInstrumentLookup(
        new URL("https://example.test/api/instruments/resolve?market=JP&symbol=7203"),
      ),
    ).toThrow(InvalidInstrumentLookup);
  });

  it("classifies only audited A-share stock and ETF code families", () => {
    expect(
      classifyExchangeTradedAsset(
        { market: "CN-SH", symbol: "600519" },
        "贵州茅台",
      ),
    ).toBe("stock");
    expect(
      classifyExchangeTradedAsset(
        { market: "CN-SZ", symbol: "159915" },
        "创业板ETF",
      ),
    ).toBe("etf");
    expect(
      classifyExchangeTradedAsset(
        { market: "CN-SH", symbol: "113703" },
        "翔26转债",
      ),
    ).toBeUndefined();
  });
});
