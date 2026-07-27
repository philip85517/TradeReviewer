import { describe, expect, it } from "vitest";

import {
  normalizeMarketSymbol,
  providerSymbolCandidates,
} from "./symbol-map";

describe("normalizeMarketSymbol", () => {
  it.each([
    ["HK", "01810", "1810"],
    ["CN-SH", "600519", "600519"],
    ["CN-SZ", "000001", "000001"],
    ["US", " xpev ", "XPEV"],
  ] as const)("normalizes %s symbol %s", (market, symbol, expected) => {
    expect(normalizeMarketSymbol(market, symbol)).toBe(expected);
  });

  it("rejects a symbol whose shape does not match its market", () => {
    expect(() => normalizeMarketSymbol("HK", "XPEV")).toThrow(
      "港股代码必须是 1–5 位数字",
    );
  });
});

describe("providerSymbolCandidates", () => {
  it.each([
    ["HK", "1810", ["hk01810"]],
    ["CN-SH", "600519", ["sh600519"]],
    ["CN-SZ", "000001", ["sz000001"]],
    ["US", "XPEV", ["usXPEV.N", "usXPEV.OQ", "usXPEV.A"]],
  ] as const)("maps %s %s to Tencent candidates", (market, symbol, expected) => {
    expect(providerSymbolCandidates("tencent", market, symbol)).toEqual(
      expected,
    );
  });

  it("maps A-share symbols to Eastmoney secids", () => {
    expect(providerSymbolCandidates("eastmoney", "CN-SH", "600519")).toEqual([
      "1.600519",
    ]);
    expect(providerSymbolCandidates("eastmoney", "CN-SZ", "000001")).toEqual([
      "0.000001",
    ]);
  });
});
