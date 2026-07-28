import { canonicalInstrumentSymbol } from "../display-name";
import type {
  InstrumentLookup,
  ResolvedInstrument,
} from "../metadata-contracts";
import {
  type CatalogCache,
  type CatalogProviderOptions,
  type CatalogSnapshot,
  CATALOG_TTL_MS,
  cloudflareCatalogCache,
  loadCatalogFile,
} from "./nasdaq-directory";
import {
  invalidMetadataResponse,
  noMetadata,
  validateProviderMetadataResult,
  type InstrumentMetadataProvider,
} from "./metadata-errors";

const SEC_COMPANY_TICKERS_URL =
  "https://www.sec.gov/files/company_tickers_exchange.json";
const SEC_USER_AGENT = "TradeReviewer/0.1 instrument-metadata";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSecCompanyTickers(
  value: unknown,
  resolvedAt = new Date().toISOString(),
): Map<string, ResolvedInstrument> {
  const directory = new Map<string, ResolvedInstrument>();
  if (!isRecord(value) || !Array.isArray(value.fields) || !Array.isArray(value.data)) {
    return directory;
  }

  const fields = value.fields.map((field) =>
    typeof field === "string" ? field.trim().toLowerCase() : "",
  );
  const tickerIndex = fields.indexOf("ticker");
  const nameIndex = fields.indexOf("name");
  const exchangeIndex = fields.indexOf("exchange");
  if (tickerIndex < 0 || nameIndex < 0 || exchangeIndex < 0) return directory;

  for (const rawRow of value.data) {
    if (!Array.isArray(rawRow)) continue;
    const ticker = rawRow[tickerIndex];
    const name = rawRow[nameIndex];
    const exchange = rawRow[exchangeIndex];
    if (
      typeof ticker !== "string" ||
      typeof name !== "string" ||
      typeof exchange !== "string" ||
      !ticker.trim() ||
      !name.trim() ||
      !exchange.trim()
    ) {
      continue;
    }
    const symbol = canonicalInstrumentSymbol(ticker, "US");
    directory.set(symbol, {
      market: "US",
      symbol,
      name: name.trim(),
      assetType: "stock",
      source: "sec",
      confidence: "official",
      resolvedAt,
    });
  }
  return directory;
}

type SecCatalogState = {
  snapshot?: CatalogSnapshot<Map<string, ResolvedInstrument>>;
  inFlight?: Promise<Map<string, ResolvedInstrument>>;
};

const catalogStates = new WeakMap<CatalogCache, SecCatalogState>();

function catalogState(cache: CatalogCache): SecCatalogState {
  const existing = catalogStates.get(cache);
  if (existing) return existing;
  const created: SecCatalogState = {};
  catalogStates.set(cache, created);
  return created;
}

async function loadSecDirectory(
  cache: CatalogCache,
  fetcher: typeof fetch,
  now: () => number,
): Promise<Map<string, ResolvedInstrument>> {
  const state = catalogState(cache);
  const currentTime = now();
  if (
    state.snapshot &&
    state.snapshot.loadedAt <= currentTime &&
    currentTime - state.snapshot.loadedAt < CATALOG_TTL_MS
  ) {
    return state.snapshot.value;
  }
  if (state.inFlight) return state.inFlight;

  const request = (async () => {
    const file = await loadCatalogFile({
      cache,
      fetcher,
      init: { headers: { "User-Agent": SEC_USER_AGENT } },
      key: SEC_COMPANY_TICKERS_URL,
      now: currentTime,
      providerLabel: "SEC 公司代码目录",
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(file.bytes));
    } catch {
      return invalidMetadataResponse("SEC 公司代码目录无法解析");
    }
    const directory = parseSecCompanyTickers(
      parsed,
      new Date(file.loadedAt).toISOString(),
    );
    state.snapshot = { loadedAt: file.loadedAt, value: directory };
    return directory;
  })();
  state.inFlight = request;
  try {
    return await request;
  } finally {
    if (state.inFlight === request) state.inFlight = undefined;
  }
}

export class SecCompanyTickersProvider implements InstrumentMetadataProvider {
  readonly id = "sec" as const;
  private readonly cache: CatalogCache;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;

  constructor(options: CatalogProviderOptions = {}) {
    this.cache = options.cache ?? cloudflareCatalogCache;
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  supports(lookup: InstrumentLookup) {
    return lookup.market === "US";
  }

  async resolve(
    lookup: InstrumentLookup,
    fetcher: typeof fetch = this.fetcher,
  ): Promise<ResolvedInstrument> {
    if (!this.supports(lookup)) noMetadata("SEC 公司代码目录不支持该市场");
    const symbol = canonicalInstrumentSymbol(lookup.symbol, "US");
    const resolved = (await loadSecDirectory(
      this.cache,
      fetcher,
      this.now,
    )).get(symbol);
    if (!resolved) noMetadata("SEC 公司代码目录未返回该证券");
    return validateProviderMetadataResult(resolved, lookup, "SEC 公司代码目录");
  }
}
