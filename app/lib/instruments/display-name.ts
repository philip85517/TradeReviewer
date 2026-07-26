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
  const cleanedSourceName = sourceName?.trim();
  if (cleanedSourceName && cleanedSourceName !== symbol) {
    return cleanedSourceName;
  }
  return (
    KNOWN_NAMES[`${market.toUpperCase()}:${symbol.toUpperCase()}`] ??
    "名称待行情源补充"
  );
}
