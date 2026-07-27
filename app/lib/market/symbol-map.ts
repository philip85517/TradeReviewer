import type {
  MarketDataProviderId,
  SupportedMarket,
} from "./contracts";

const US_SYMBOL = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function normalizeMarketSymbol(
  market: SupportedMarket,
  symbol: string,
) {
  const value = symbol.trim().toUpperCase();

  if (market === "US") {
    if (!US_SYMBOL.test(value)) {
      throw new Error("美股代码格式无效");
    }
    return value;
  }

  if (market === "HK") {
    if (!/^\d{1,5}$/.test(value)) {
      throw new Error("港股代码必须是 1–5 位数字");
    }
    return value.replace(/^0+(?=\d)/, "");
  }

  if (!/^\d{6}$/.test(value)) {
    throw new Error("A 股代码必须是 6 位数字");
  }
  return value;
}

export function providerSymbolCandidates(
  provider: MarketDataProviderId,
  market: SupportedMarket,
  symbol: string,
): string[] {
  const normalized = normalizeMarketSymbol(market, symbol);

  if (provider === "tencent") {
    if (market === "HK") return [`hk${normalized.padStart(5, "0")}`];
    if (market === "CN-SH") return [`sh${normalized}`];
    if (market === "CN-SZ") return [`sz${normalized}`];
    return [
      `us${normalized}.N`,
      `us${normalized}.OQ`,
      `us${normalized}.A`,
    ];
  }

  if (provider === "eastmoney") {
    if (market === "CN-SH") return [`1.${normalized}`];
    if (market === "CN-SZ") return [`0.${normalized}`];
    return [];
  }

  return market === "US" || market === "HK" ? [normalized] : [];
}
