import { describe, expect, it } from "vitest";
import {
  validateResolvedInstrument,
  type InstrumentLookup,
} from "./metadata-contracts";
import {
  InvalidInstrumentLookup,
  parseInstrumentLookup,
} from "./metadata-request-policy";
import { classifyExchangeTradedAsset } from "./asset-classification";

describe("instrument metadata contracts", () => {
  const lookup: InstrumentLookup = { market: "HK", symbol: "700" };

  it("accepts a matching stock or ETF result", () => {
    expect(
      validateResolvedInstrument(
        {
          market: "HK",
          symbol: "700",
          name: "腾讯控股",
          assetType: "stock",
          source: "tencent",
          confidence: "portal",
          resolvedAt: "2026-07-29T00:00:00.000Z",
        },
        lookup,
      ).name,
    ).toBe("腾讯控股");
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
