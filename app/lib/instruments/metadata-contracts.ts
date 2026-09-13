import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
} from "./display-name";

export type InstrumentLookup = {
  market: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol: string;
};

export type LocalizedInstrumentName = {
  name: string;
  locale: "zh-CN";
  source: string;
  resolvedAt: string;
};

export type InstrumentAssetType = "stock" | "etf";
export type InstrumentMetadataSource =
  | "statement"
  | "nasdaq"
  | "sec"
  | "hkex"
  | "tencent"
  | "eastmoney"
  | "sina";
export type InstrumentMetadataConfidence =
  | "statement"
  | "official"
  | "portal";

export type ResolvedInstrument = InstrumentLookup & {
  name: string;
  localizedName?: LocalizedInstrumentName;
  assetType: InstrumentAssetType;
  source: InstrumentMetadataSource;
  confidence: InstrumentMetadataConfidence;
  resolvedAt: string;
};

export type InstrumentMetadataFailure = InstrumentLookup & {
  attempts: Array<{
    source: Exclude<InstrumentMetadataSource, "statement">;
    code: string;
    message: string;
  }>;
};

const MARKETS = new Set<InstrumentLookup["market"]>([
  "US",
  "HK",
  "CN-SH",
  "CN-SZ",
]);
const ASSET_TYPES = new Set<InstrumentAssetType>(["stock", "etf"]);
const SOURCES = new Set<InstrumentMetadataSource>([
  "statement",
  "nasdaq",
  "sec",
  "hkex",
  "tencent",
  "eastmoney",
  "sina",
]);
const CONFIDENCES = new Set<InstrumentMetadataConfidence>([
  "statement",
  "official",
  "portal",
]);

function invalidResolvedInstrument(): never {
  throw new Error("证券元数据结果无效");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const HAN_CHARACTER = /\p{Script=Han}/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const MARKUP_CHARACTER = /[<>]/u;

export function validateLocalizedInstrumentName(
  value: unknown,
): LocalizedInstrumentName {
  if (!isRecord(value)) invalidResolvedInstrument();
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const source = typeof value.source === "string" ? value.source.trim() : "";
  const resolvedAt =
    typeof value.resolvedAt === "string" ? value.resolvedAt.trim() : "";
  if (
    value.locale !== "zh-CN" ||
    !name ||
    !HAN_CHARACTER.test(name) ||
    CONTROL_CHARACTER.test(name) ||
    MARKUP_CHARACTER.test(name) ||
    name.length > 200 ||
    !source ||
    CONTROL_CHARACTER.test(source) ||
    source.length > 100 ||
    !resolvedAt ||
    !Number.isFinite(Date.parse(resolvedAt))
  ) {
    invalidResolvedInstrument();
  }
  return {
    name,
    locale: "zh-CN",
    source,
    resolvedAt: new Date(resolvedAt).toISOString(),
  };
}

export function validateResolvedInstrument(
  value: unknown,
  lookup: InstrumentLookup,
): ResolvedInstrument {
  if (!isRecord(value)) invalidResolvedInstrument();

  const market = typeof value.market === "string" ? value.market.toUpperCase() : "";
  const symbol = typeof value.symbol === "string" ? value.symbol : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";

  if (!MARKETS.has(market as InstrumentLookup["market"]) || !symbol || !name) {
    invalidResolvedInstrument();
  }

  const normalizedMarket = market as InstrumentLookup["market"];
  const normalizedSymbol = canonicalInstrumentSymbol(symbol, normalizedMarket);
  if (
    canonicalInstrumentId(symbol, normalizedMarket) !==
      canonicalInstrumentId(lookup.symbol, lookup.market) ||
    canonicalInstrumentSymbol(name, normalizedMarket) === normalizedSymbol
  ) {
    invalidResolvedInstrument();
  }

  const localizedName =
    value.localizedName === undefined
      ? undefined
      : validateLocalizedInstrumentName(value.localizedName);

  if (
    !ASSET_TYPES.has(value.assetType as InstrumentAssetType) ||
    !SOURCES.has(value.source as InstrumentMetadataSource) ||
    !CONFIDENCES.has(value.confidence as InstrumentMetadataConfidence) ||
    typeof value.resolvedAt !== "string"
  ) {
    invalidResolvedInstrument();
  }

  return {
    market: normalizedMarket,
    symbol: normalizedSymbol,
    name,
    ...(localizedName ? { localizedName } : {}),
    assetType: value.assetType as InstrumentAssetType,
    source: value.source as InstrumentMetadataSource,
    confidence: value.confidence as InstrumentMetadataConfidence,
    resolvedAt: value.resolvedAt,
  };
}
