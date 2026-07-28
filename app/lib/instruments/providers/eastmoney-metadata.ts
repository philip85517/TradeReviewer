import { classifyExchangeTradedAsset } from "../asset-classification";
import { canonicalInstrumentSymbol } from "../display-name";
import {
  validateResolvedInstrument,
  type InstrumentAssetType,
  type InstrumentLookup,
  type ResolvedInstrument,
} from "../metadata-contracts";
import {
  InstrumentMetadataProviderError,
  invalidMetadataResponse,
  noMetadata,
  requestMetadataResponse,
  type InstrumentMetadataProvider,
} from "./metadata-errors";

type EastmoneyMetadataEnvelope = {
  data?: unknown;
};

const EASTMONEY_MARKET_IDS: Record<
  InstrumentLookup["market"],
  readonly string[]
> = {
  "CN-SH": ["1"],
  "CN-SZ": ["0"],
  HK: ["116"],
  US: ["105", "106", "107"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEnvelope(raw: string | unknown): EastmoneyMetadataEnvelope {
  if (typeof raw !== "string") {
    if (!isRecord(raw)) invalidMetadataResponse("东方财富证券元数据无法解析");
    return raw;
  }
  if (!raw.trim() || /^<!?html/iu.test(raw.trim())) {
    invalidMetadataResponse("东方财富证券元数据无法解析");
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      invalidMetadataResponse("东方财富证券元数据无法解析");
    }
    return parsed;
  } catch (error) {
    if (error instanceof InstrumentMetadataProviderError) throw error;
    return invalidMetadataResponse("东方财富证券元数据无法解析");
  }
}

function eastmoneyAssetType(
  explicitType: unknown,
  lookup: InstrumentLookup,
  name: string,
): InstrumentAssetType | undefined {
  if (explicitType === 1 || explicitType === "1") return "stock";
  if (explicitType === 5 || explicitType === "5") return "etf";
  return classifyExchangeTradedAsset(lookup, name);
}

export function parseEastmoneyMetadata(
  raw: string | unknown,
  lookup: InstrumentLookup,
): ResolvedInstrument {
  const envelope = parseEnvelope(raw);
  if (envelope.data === null || envelope.data === undefined) {
    noMetadata("东方财富未返回该证券元数据");
  }
  if (!isRecord(envelope.data)) {
    invalidMetadataResponse("东方财富证券元数据无法解析");
  }

  const responseSymbol =
    typeof envelope.data.f57 === "string" ? envelope.data.f57.trim() : "";
  const name =
    typeof envelope.data.f58 === "string" ? envelope.data.f58.trim() : "";
  if (!name) invalidMetadataResponse("东方财富证券元数据名称为空");
  if (
    !responseSymbol ||
    canonicalInstrumentSymbol(responseSymbol, lookup.market) !==
      canonicalInstrumentSymbol(lookup.symbol, lookup.market)
  ) {
    invalidMetadataResponse("东方财富证券元数据代码不匹配");
  }

  const assetType = eastmoneyAssetType(envelope.data.f107, lookup, name);
  if (!assetType) noMetadata("东方财富证券元数据缺少资产类型证据");

  return validateResolvedInstrument(
    {
      ...lookup,
      name,
      assetType,
      source: "eastmoney",
      confidence: "portal",
      resolvedAt: new Date().toISOString(),
    },
    lookup,
  );
}

export class EastmoneyMetadataProvider implements InstrumentMetadataProvider {
  readonly id = "eastmoney" as const;

  supports(lookup: InstrumentLookup) {
    return ["US", "HK", "CN-SH", "CN-SZ"].includes(lookup.market);
  }

  async resolve(
    lookup: InstrumentLookup,
    fetcher: typeof fetch = fetch,
  ): Promise<ResolvedInstrument> {
    const canonicalSymbol = canonicalInstrumentSymbol(
      lookup.symbol,
      lookup.market,
    );
    const symbol =
      lookup.market === "HK"
        ? canonicalSymbol.padStart(5, "0")
        : canonicalSymbol;
    for (const marketId of EASTMONEY_MARKET_IDS[lookup.market]) {
      const query = new URLSearchParams({
        secid: `${marketId}.${symbol}`,
        fields: "f57,f58,f107",
      });
      const response = await requestMetadataResponse(
        fetcher,
        `https://push2.eastmoney.com/api/qt/stock/get?${query}`,
        undefined,
        "东方财富证券元数据",
      );

      let text: string;
      try {
        text = await response.text();
      } catch {
        throw new InstrumentMetadataProviderError(
          "invalid-response",
          "东方财富证券元数据无法解析",
        );
      }

      try {
        return parseEastmoneyMetadata(text, lookup);
      } catch (error) {
        if (
          error instanceof InstrumentMetadataProviderError &&
          error.code === "no-data"
        ) {
          continue;
        }
        throw error;
      }
    }
    return noMetadata("东方财富未返回该证券元数据");
  }
}
