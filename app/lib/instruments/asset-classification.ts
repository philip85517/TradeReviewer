import { canonicalInstrumentSymbol } from "./display-name";
import type { InstrumentAssetType, InstrumentLookup } from "./metadata-contracts";

const STOCK_PREFIXES: Record<"CN-SH" | "CN-SZ", readonly string[]> = {
  "CN-SH": ["600", "601", "603", "605", "688"],
  "CN-SZ": ["000", "001", "002", "003", "300", "301"],
};
const ETF_PREFIXES: Record<"CN-SH" | "CN-SZ", readonly string[]> = {
  "CN-SH": [
    "510",
    "511",
    "512",
    "513",
    "515",
    "516",
    "517",
    "518",
    "560",
    "561",
    "562",
    "563",
    "588",
  ],
  "CN-SZ": ["159"],
};
const BOND_OR_REPO_PREFIXES: Record<"CN-SH" | "CN-SZ", readonly string[]> = {
  "CN-SH": ["110", "111", "112", "113", "118", "122", "124", "126", "132", "136", "204"],
  "CN-SZ": ["123", "127", "128", "131"],
};
const BOND_OR_REPO_NAME = /转债|可转债|债券|国债逆回购|质押式回购|回购/u;

function hasPrefix(symbol: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => symbol.startsWith(prefix));
}

export function classifyExchangeTradedAsset(
  lookup: InstrumentLookup,
  sourceName: string,
): InstrumentAssetType | undefined {
  if (lookup.market !== "CN-SH" && lookup.market !== "CN-SZ") {
    return undefined;
  }

  const symbol = canonicalInstrumentSymbol(lookup.symbol, lookup.market);
  if (
    !/^\d{6}$/.test(symbol) ||
    BOND_OR_REPO_NAME.test(sourceName) ||
    hasPrefix(symbol, BOND_OR_REPO_PREFIXES[lookup.market])
  ) {
    return undefined;
  }
  if (hasPrefix(symbol, ETF_PREFIXES[lookup.market])) return "etf";
  if (hasPrefix(symbol, STOCK_PREFIXES[lookup.market])) return "stock";
  return undefined;
}
