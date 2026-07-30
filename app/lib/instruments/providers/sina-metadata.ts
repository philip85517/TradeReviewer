import { classifyExchangeTradedAsset } from "../asset-classification";
import { canonicalInstrumentSymbol } from "../display-name";
import {
  type InstrumentLookup,
  type ResolvedInstrument,
} from "../metadata-contracts";
import {
  InstrumentMetadataProviderError,
  invalidMetadataResponse,
  noMetadata,
  requestMetadataResponse,
  validateProviderMetadataResult,
  type InstrumentMetadataProvider,
} from "./metadata-errors";

function sinaSymbol(lookup: InstrumentLookup): string {
  const symbol = canonicalInstrumentSymbol(lookup.symbol, lookup.market);
  switch (lookup.market) {
    case "CN-SH":
      return `sh${symbol}`;
    case "CN-SZ":
      return `sz${symbol}`;
    case "HK":
      return `rt_hk${symbol.padStart(5, "0")}`;
    case "US":
      return `gb_${symbol.toLowerCase()}`;
  }
}

export function parseSinaMetadata(
  raw: string,
  lookup: InstrumentLookup,
): ResolvedInstrument {
  const text = raw.trim();
  if (!text || /^<!?html/iu.test(text)) {
    invalidMetadataResponse("新浪证券元数据无法解析");
  }

  const match = /^var\s+hq_str_([a-z0-9_]+)="([^"]*)";?$/iu.exec(text);
  if (!match) invalidMetadataResponse("新浪证券元数据无法解析");

  const [, responseVariable = "", payload = ""] = match;
  if (responseVariable.toLowerCase() !== sinaSymbol(lookup).toLowerCase()) {
    invalidMetadataResponse("新浪证券元数据代码不匹配");
  }

  const name = payload.split(",")[0]?.trim() ?? "";
  if (!name) invalidMetadataResponse("新浪证券元数据名称为空");

  const assetType = classifyExchangeTradedAsset(lookup, name);
  if (!assetType) noMetadata("新浪证券元数据缺少资产类型证据");

  return validateProviderMetadataResult(
    {
      ...lookup,
      name,
      assetType,
      source: "sina",
      confidence: "portal",
      resolvedAt: new Date().toISOString(),
    },
    lookup,
    "新浪证券元数据",
  );
}

export class SinaMetadataProvider implements InstrumentMetadataProvider {
  readonly id = "sina" as const;

  supports(lookup: InstrumentLookup) {
    return ["US", "HK", "CN-SH", "CN-SZ"].includes(lookup.market);
  }

  async resolve(
    lookup: InstrumentLookup,
    fetcher: typeof fetch = fetch,
  ): Promise<ResolvedInstrument> {
    const response = await requestMetadataResponse(
      fetcher,
      `https://hq.sinajs.cn/list=${encodeURIComponent(sinaSymbol(lookup))}`,
      {
        headers: { Referer: "https://finance.sina.com.cn/" },
      },
      "新浪证券元数据",
    );

    let text: string;
    try {
      const charset =
        /charset\s*=\s*["']?([^;"'\s]+)/iu.exec(
          response.headers.get("content-type") ?? "",
        )?.[1] ?? "gb18030";
      text = new TextDecoder(charset).decode(await response.arrayBuffer());
    } catch {
      throw new InstrumentMetadataProviderError(
        "invalid-response",
        "新浪证券元数据无法解析",
      );
    }
    return parseSinaMetadata(text, lookup);
  }
}
