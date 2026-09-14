import { describe, expect, it } from "vitest";

import type { Instrument } from "../trades/types";
import { instrumentPresentation } from "./instrument-presentation";

function instrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: "US:AAPL",
    symbol: "AAPL",
    name: "Apple Inc.",
    market: "US",
    currency: "USD",
    ...overrides,
  };
}

describe("instrumentPresentation", () => {
  it("uses a verified Chinese name as primary while retaining original and identity search text", () => {
    const result = instrumentPresentation(instrument({
      localizedName: {
        name: "苹果公司",
        locale: "zh-CN",
        source: "tencent",
        resolvedAt: "2026-07-29T00:00:00.000Z",
      },
    } as Instrument));

    expect(result).toEqual({
      primaryName: "苹果公司",
      originalName: "Apple Inc.",
      secondaryName: "AAPL · US",
      searchText: "苹果公司 Apple Inc. AAPL US",
      hasChineseName: true,
    });
  });

  it("falls back safely for old records and keeps long historical names searchable", () => {
    const result = instrumentPresentation(instrument({
      name: "Formerly Very Long Apple Computer Holdings International Limited",
    }));

    expect(result.primaryName).toBe(
      "Formerly Very Long Apple Computer Holdings International Limited",
    );
    expect(result.originalName).toBe(result.primaryName);
    expect(result.secondaryName).toBe("AAPL · US");
    expect(result.searchText).toContain("Formerly Very Long Apple Computer Holdings International Limited");
    expect(result.searchText).toContain("AAPL");
    expect(result.hasChineseName).toBe(false);
  });

  it("treats a legacy Chinese original name as an available localized name", () => {
    const result = instrumentPresentation(instrument({ name: "腾讯控股" }));

    expect(result.primaryName).toBe("腾讯控股");
    expect(result.originalName).toBe("腾讯控股");
    expect(result.hasChineseName).toBe(true);
  });

  it("ignores malformed runtime metadata rather than exposing it as a display name", () => {
    const result = instrumentPresentation(instrument({
      localizedName: {
        name: "<script>alert(1)</script>",
        locale: "zh-CN",
        source: "untrusted",
        resolvedAt: "never",
      },
    } as Instrument));

    expect(result.primaryName).toBe("Apple Inc.");
    expect(result.hasChineseName).toBe(false);
    expect(result.searchText).not.toContain("<script>");
  });
});
