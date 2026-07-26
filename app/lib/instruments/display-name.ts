const KNOWN_NAMES: Record<string, string> = {
  "HK:1810": "小米集团-W",
  "HK:700": "腾讯控股",
  "HK:0700": "腾讯控股",
  "HK:268": "金蝶国际",
  "HK:0268": "金蝶国际",
  "US:BABA": "阿里巴巴",
  "US:NVDA": "英伟达",
  "US:XPEV": "小鹏汽车",
  "US:QID": "ProShares 两倍做空纳指",
  "US:UVXY": "ProShares 1.5倍做多短期VIX",
};

export function instrumentDisplayName(
  symbol: string,
  market: string,
  sourceName?: string,
) {
  const canonicalSymbol = canonicalInstrumentSymbol(symbol, market);
  const cleanedSourceName = sourceName?.trim();
  if (
    cleanedSourceName &&
    cleanedSourceName !== symbol &&
    cleanedSourceName !== canonicalSymbol
  ) {
    return cleanedSourceName;
  }
  return (
    KNOWN_NAMES[`${market.toUpperCase()}:${canonicalSymbol}`] ??
    "名称待行情源补充"
  );
}

export function canonicalInstrumentSymbol(
  symbol: string,
  market: string,
) {
  const upper = symbol.trim().toUpperCase();
  if (market.toUpperCase() === "HK" && /^\d+$/.test(upper)) {
    return upper.replace(/^0+(?=\d)/, "");
  }
  return upper;
}

export function canonicalInstrumentId(
  symbol: string,
  market: string,
) {
  return `${market.toUpperCase()}:${canonicalInstrumentSymbol(symbol, market)}`;
}
