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

function tencentSymbol(lookup: InstrumentLookup): string {
  const symbol = canonicalInstrumentSymbol(lookup.symbol, lookup.market);
  switch (lookup.market) {
    case "CN-SH":
      return `sh${symbol}`;
    case "CN-SZ":
      return `sz${symbol}`;
    case "HK":
      return `hk${symbol.padStart(5, "0")}`;
    case "US":
      return `us${symbol}`;
  }
}

function normalizedTencentResponseSymbol(
  symbol: string,
  lookup: InstrumentLookup,
): string {
  const normalized =
    lookup.market === "US"
      ? symbol.replace(/\.(?:N|OQ|AM)$/iu, "")
      : symbol;
  return canonicalInstrumentSymbol(normalized, lookup.market);
}

function assetTypeFromTencentFields(
  fields: readonly string[],
): InstrumentAssetType | undefined {
  const typeEvidence = fields
    .map((field) => field.trim().toUpperCase())
    .find((field) => field === "GP" || field === "ETF");
  if (typeEvidence === "GP") return "stock";
  if (typeEvidence === "ETF") return "etf";
  return undefined;
}

export function parseTencentMetadata(
  raw: string,
  lookup: InstrumentLookup,
): ResolvedInstrument {
  const text = raw.trim();
  if (!text || /^<!?html/iu.test(text)) {
    invalidMetadataResponse("腾讯证券元数据无法解析");
  }

  const match = /^v_([a-z0-9_]+)="([^"]*)";?$/iu.exec(text);
  if (!match) invalidMetadataResponse("腾讯证券元数据无法解析");

  const [, responseVariable = "", payload = ""] = match;
  if (
    responseVariable.toUpperCase() !== tencentSymbol(lookup).toUpperCase()
  ) {
    invalidMetadataResponse("腾讯证券元数据代码不匹配");
  }

  const fields = payload.split("~");
  const name = fields[1]?.trim() ?? "";
  const responseSymbol = fields[2]?.trim() ?? "";
  if (!name) invalidMetadataResponse("腾讯证券元数据名称为空");
  if (
    !responseSymbol ||
    normalizedTencentResponseSymbol(responseSymbol, lookup) !==
      canonicalInstrumentSymbol(lookup.symbol, lookup.market)
  ) {
    invalidMetadataResponse("腾讯证券元数据代码不匹配");
  }

  const assetType = assetTypeFromTencentFields(fields);
  if (!assetType) noMetadata("腾讯证券元数据缺少资产类型证据");

  return validateResolvedInstrument(
    {
      ...lookup,
      name,
      assetType,
      source: "tencent",
      confidence: "portal",
      resolvedAt: new Date().toISOString(),
    },
    lookup,
  );
}

export class TencentMetadataProvider implements InstrumentMetadataProvider {
  readonly id = "tencent" as const;

  supports(lookup: InstrumentLookup) {
    return ["US", "HK", "CN-SH", "CN-SZ"].includes(lookup.market);
  }

  async resolve(
    lookup: InstrumentLookup,
    fetcher: typeof fetch = fetch,
  ): Promise<ResolvedInstrument> {
    const response = await requestMetadataResponse(
      fetcher,
      `https://qt.gtimg.cn/q=${encodeURIComponent(tencentSymbol(lookup))}`,
      undefined,
      "腾讯证券元数据",
    );

    let text: string;
    try {
      const charset =
        /charset\s*=\s*["']?([^;"'\s]+)/iu.exec(
          response.headers.get("content-type") ?? "",
        )?.[1] ?? "gbk";
      text = new TextDecoder(charset).decode(await response.arrayBuffer());
    } catch {
      throw new InstrumentMetadataProviderError(
        "invalid-response",
        "腾讯证券元数据无法解析",
      );
    }

    return parseTencentMetadata(text, lookup);
  }
}
