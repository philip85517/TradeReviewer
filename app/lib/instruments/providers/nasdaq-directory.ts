import { canonicalInstrumentSymbol } from "../display-name";
import type {
  InstrumentLookup,
  InstrumentAssetType,
  ResolvedInstrument,
} from "../metadata-contracts";
import {
  invalidMetadataResponse,
  noMetadata,
  requestMetadataResponse,
  validateProviderMetadataResult,
  type InstrumentMetadataProvider,
} from "./metadata-errors";

const NASDAQ_LISTED_URL =
  "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_LISTED_URL =
  "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
export const CATALOG_TTL_MS = 86_400_000;
const LOADED_AT_HEADER = "x-trade-reviewer-catalog-loaded-at";

export interface CatalogCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

export type CatalogProviderOptions = {
  cache?: CatalogCache;
  fetcher?: typeof fetch;
  now?: () => number;
};

export type LoadedCatalogFile = {
  bytes: ArrayBuffer;
  loadedAt: number;
};

export type CatalogSnapshot<T> = {
  loadedAt: number;
  value: T;
};

export const cloudflareCatalogCache: CatalogCache = {
  async match(key) {
    const defaultCache = (caches as CacheStorage & { default: Cache }).default;
    return (await defaultCache.match(key)) ?? undefined;
  },
  async put(key, response) {
    const defaultCache = (caches as CacheStorage & { default: Cache }).default;
    await defaultCache.put(key, response);
  },
};

function isFresh(loadedAt: number, now: number) {
  return loadedAt <= now && now - loadedAt < CATALOG_TTL_MS;
}

export async function loadCatalogFile({
  cache,
  fetcher,
  init,
  key,
  now,
  providerLabel,
  validate,
}: {
  cache: CatalogCache;
  fetcher: typeof fetch;
  init?: RequestInit;
  key: string;
  now: number;
  providerLabel: string;
  validate: (bytes: ArrayBuffer) => void;
}): Promise<LoadedCatalogFile> {
  try {
    const cached = await cache.match(key);
    const loadedAt = Number(cached?.headers.get(LOADED_AT_HEADER));
    if (cached && Number.isFinite(loadedAt) && isFresh(loadedAt, now)) {
      const bytes = await cached.arrayBuffer();
      validate(bytes);
      return { bytes, loadedAt };
    }
  } catch {
    // A cache outage must not prevent a fresh official catalog request.
  }

  const response = await requestMetadataResponse(
    fetcher,
    key,
    init,
    providerLabel,
  );
  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    return invalidMetadataResponse(`${providerLabel}无法解析`);
  }

  validate(bytes);
  const headers = new Headers(response.headers);
  headers.set(LOADED_AT_HEADER, String(now));
  headers.set("Cache-Control", "public, max-age=86400");
  try {
    await cache.put(key, new Response(bytes.slice(0), { headers }));
  } catch {
    // The resolved catalog remains usable even when the shared cache is down.
  }
  return { bytes, loadedAt: now };
}

type DirectoryRow = Record<string, string>;

function parsePipeRows(raw: string): DirectoryRow[] {
  const [headerLine, ...lines] = raw.split(/\r?\n/u);
  if (!headerLine) return [];

  const headers = headerLine.split("|").map((header) => header.trim());
  return lines.map((line) =>
    Object.fromEntries(
      line
        .split("|")
        .map((value, index) => [headers[index] ?? "", value.trim()]),
    ),
  );
}

function validatedPipeRows(
  raw: string,
  symbolHeader: "Symbol" | "ACT Symbol",
): DirectoryRow[] {
  const [headerLine, ...lines] = raw.split(/\r?\n/u);
  const headers = new Set(
    (headerLine ?? "").split("|").map((header) => header.trim()),
  );
  const requiredHeaders = [
    symbolHeader,
    "Security Name",
    "Test Issue",
    "ETF",
  ];
  if (
    requiredHeaders.some((header) => !headers.has(header)) ||
    !lines.some((line) => line.startsWith("File Creation Time:"))
  ) {
    return invalidMetadataResponse("Nasdaq 目录文件结构无效");
  }
  const rows = parsePipeRows(raw);
  if (
    !rows.some(
      (row) =>
        row[symbolHeader]?.trim() &&
        row["Security Name"]?.trim() &&
        row["Test Issue"]?.trim().toUpperCase() === "N" &&
        ["Y", "N"].includes(row.ETF?.trim().toUpperCase()),
    )
  ) {
    return invalidMetadataResponse("Nasdaq 目录文件结构无效");
  }
  return rows;
}

function addNasdaqRows(
  directory: Map<string, ResolvedInstrument>,
  rows: DirectoryRow[],
  symbolHeader: "Symbol" | "ACT Symbol",
  resolvedAt: string,
) {
  for (const row of rows) {
    const symbol = canonicalInstrumentSymbol(row[symbolHeader] ?? "", "US");
    const name = row["Security Name"]?.trim() ?? "";
    const testIssue = row["Test Issue"]?.trim().toUpperCase();
    const etf = row.ETF?.trim().toUpperCase();
    if (!symbol || !name || testIssue !== "N" || !["Y", "N"].includes(etf)) {
      continue;
    }

    const assetType: InstrumentAssetType = etf === "Y" ? "etf" : "stock";
    directory.set(symbol, {
      market: "US",
      symbol,
      name,
      assetType,
      source: "nasdaq",
      confidence: "official",
      resolvedAt,
    });
  }
}

export function parseNasdaqDirectories(
  nasdaqListed: string,
  otherListed: string,
  resolvedAt = new Date().toISOString(),
): Map<string, ResolvedInstrument> {
  const directory = new Map<string, ResolvedInstrument>();
  addNasdaqRows(
    directory,
    validatedPipeRows(nasdaqListed, "Symbol"),
    "Symbol",
    resolvedAt,
  );
  addNasdaqRows(
    directory,
    validatedPipeRows(otherListed, "ACT Symbol"),
    "ACT Symbol",
    resolvedAt,
  );
  return directory;
}

type NasdaqCatalogState = {
  snapshot?: CatalogSnapshot<Map<string, ResolvedInstrument>>;
  inFlight?: Promise<Map<string, ResolvedInstrument>>;
};

const catalogStates = new WeakMap<CatalogCache, NasdaqCatalogState>();

function catalogState(cache: CatalogCache): NasdaqCatalogState {
  const existing = catalogStates.get(cache);
  if (existing) return existing;
  const created: NasdaqCatalogState = {};
  catalogStates.set(cache, created);
  return created;
}

async function loadNasdaqDirectory(
  cache: CatalogCache,
  fetcher: typeof fetch,
  now: () => number,
): Promise<Map<string, ResolvedInstrument>> {
  const state = catalogState(cache);
  const currentTime = now();
  if (
    state.snapshot &&
    isFresh(state.snapshot.loadedAt, currentTime)
  ) {
    return state.snapshot.value;
  }
  if (state.inFlight) return state.inFlight;

  const request = (async () => {
    const [nasdaqListed, otherListed] = await Promise.all([
      loadCatalogFile({
        cache,
        fetcher,
        key: NASDAQ_LISTED_URL,
        now: currentTime,
        providerLabel: "Nasdaq 上市证券目录",
        validate: (bytes) => {
          validatedPipeRows(new TextDecoder().decode(bytes), "Symbol");
        },
      }),
      loadCatalogFile({
        cache,
        fetcher,
        key: OTHER_LISTED_URL,
        now: currentTime,
        providerLabel: "Nasdaq 其他上市证券目录",
        validate: (bytes) => {
          validatedPipeRows(new TextDecoder().decode(bytes), "ACT Symbol");
        },
      }),
    ]);
    const loadedAt = Math.min(nasdaqListed.loadedAt, otherListed.loadedAt);
    const directory = parseNasdaqDirectories(
      new TextDecoder().decode(nasdaqListed.bytes),
      new TextDecoder().decode(otherListed.bytes),
      new Date(loadedAt).toISOString(),
    );
    state.snapshot = { loadedAt, value: directory };
    return directory;
  })();
  state.inFlight = request;
  try {
    return await request;
  } finally {
    if (state.inFlight === request) state.inFlight = undefined;
  }
}

export class NasdaqDirectoryProvider implements InstrumentMetadataProvider {
  readonly id = "nasdaq" as const;
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
    if (!this.supports(lookup)) noMetadata("Nasdaq 目录不支持该市场");
    const symbol = canonicalInstrumentSymbol(lookup.symbol, "US");
    const resolved = (await loadNasdaqDirectory(
      this.cache,
      fetcher,
      this.now,
    )).get(symbol);
    if (!resolved) noMetadata("Nasdaq 目录未返回该证券");
    return validateProviderMetadataResult(resolved, lookup, "Nasdaq 目录");
  }
}
