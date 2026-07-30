import { canonicalInstrumentSymbol } from "./display-name";
import type { InstrumentLookup } from "./metadata-contracts";

const MARKETS = new Set<InstrumentLookup["market"]>([
  "US",
  "HK",
  "CN-SH",
  "CN-SZ",
]);
const US_SYMBOL = /^[A-Z][A-Z0-9.-]{0,9}$/;

export class InvalidInstrumentLookup extends Error {
  constructor(message = "证券查询参数无效") {
    super(message);
    this.name = "InvalidInstrumentLookup";
  }
}

export function parseInstrumentLookup(url: URL): InstrumentLookup {
  const market = (url.searchParams.get("market") ?? "").trim().toUpperCase();
  const symbol = url.searchParams.get("symbol") ?? "";

  if (!MARKETS.has(market as InstrumentLookup["market"])) {
    throw new InvalidInstrumentLookup("不支持的证券市场");
  }

  const normalizedMarket = market as InstrumentLookup["market"];
  const normalizedSymbol = canonicalInstrumentSymbol(symbol, normalizedMarket);
  if (
    (normalizedMarket === "US" && !US_SYMBOL.test(normalizedSymbol)) ||
    (normalizedMarket === "HK" && !/^\d{1,5}$/.test(symbol.trim())) ||
    ((normalizedMarket === "CN-SH" || normalizedMarket === "CN-SZ") &&
      !/^\d{6}$/.test(normalizedSymbol))
  ) {
    throw new InvalidInstrumentLookup();
  }

  return { market: normalizedMarket, symbol: normalizedSymbol };
}
