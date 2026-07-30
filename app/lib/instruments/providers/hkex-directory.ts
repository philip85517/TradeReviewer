import { canonicalInstrumentSymbol } from "../display-name";
import * as XLSX from "xlsx";
import type {
  InstrumentLookup,
  InstrumentAssetType,
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

const HKEX_SECURITIES_URL =
  "https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx";
const HKEX_ETPS_URL =
  "https://www.hkex.com.hk/-/media/HKEX-Market/Products/Securities/ETP/Market-Making-Obligations_List-of-ETPs_csv.csv";

const EQUITY_CATEGORIES = new Set([
  "EQUITY",
  "EQUITIES",
  "EQUITY SECURITY",
  "EQUITY SECURITIES",
  "EQUITY SECURITIES (MAIN BOARD)",
  "EQUITY SECURITIES (GEM)",
]);
const ETF_SUBCATEGORIES = new Set([
  "ETF",
  "EXCHANGE TRADED FUND",
  "EXCHANGE TRADED FUNDS",
  "EXCHANGE-TRADED FUND",
  "EXCHANGE-TRADED FUNDS",
  "LEVERAGED AND INVERSE PRODUCT",
  "LEVERAGED AND INVERSE PRODUCTS",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textField(row: Record<string, unknown>, name: string): string {
  const value = row[name];
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function categoryAssetType(
  category: string,
  subCategory: string,
): InstrumentAssetType | undefined {
  if (ETF_SUBCATEGORIES.has(subCategory.trim().toUpperCase())) return "etf";
  if (EQUITY_CATEGORIES.has(category.trim().toUpperCase())) return "stock";
  return undefined;
}

export function parseHkexRows(
  rows: readonly unknown[],
  resolvedAt = new Date().toISOString(),
): Map<string, ResolvedInstrument> {
  if (
    !rows.some(
      (value) =>
        isRecord(value) &&
        ["Stock Code", "Name of Securities", "Category", "Sub-Category"].every(
          (header) => Object.prototype.hasOwnProperty.call(value, header),
        ),
    )
  ) {
    return invalidMetadataResponse("港交所证券目录文件结构无效");
  }

  const directory = new Map<string, ResolvedInstrument>();
  for (const value of rows) {
    if (!isRecord(value)) continue;

    const rawCode = textField(value, "Stock Code");
    const name = textField(value, "Name of Securities");
    const assetType = categoryAssetType(
      textField(value, "Category"),
      textField(value, "Sub-Category"),
    );
    if (!/^\d{1,5}$/u.test(rawCode) || !name || !assetType) continue;

    const paddedCode = rawCode.padStart(5, "0");
    directory.set(paddedCode, {
      market: "HK",
      symbol: canonicalInstrumentSymbol(rawCode, "HK"),
      name,
      assetType,
      source: "hkex",
      confidence: "official",
      resolvedAt,
    });
  }
  if (directory.size === 0) {
    return invalidMetadataResponse("港交所证券目录文件结构无效");
  }
  return directory;
}

export function parseHkexEtpRows(
  rows: readonly unknown[],
  resolvedAt = new Date().toISOString(),
): Map<string, ResolvedInstrument> {
  const directory = new Map<string, ResolvedInstrument>();
  let hasExpectedHeaders = false;

  for (const value of rows) {
    if (!isRecord(value)) continue;
    const normalizedFields = new Map(
      Object.entries(value).map(([key, fieldValue]) => [
        key.trim().replaceAll(/\s+/gu, " ").toUpperCase(),
        fieldValue,
      ]),
    );
    if (
      normalizedFields.has("STOCK CODE") &&
      normalizedFields.has("NAME OF ETP")
    ) {
      hasExpectedHeaders = true;
    }

    const rawCodeValue = normalizedFields.get("STOCK CODE");
    const nameValue = normalizedFields.get("NAME OF ETP");
    const rawCode =
      typeof rawCodeValue === "string" || typeof rawCodeValue === "number"
        ? String(rawCodeValue).trim()
        : "";
    const name =
      typeof nameValue === "string" || typeof nameValue === "number"
        ? String(nameValue).trim()
        : "";
    if (!/^\d{1,5}$/u.test(rawCode) || !name) continue;

    directory.set(rawCode.padStart(5, "0"), {
      market: "HK",
      symbol: canonicalInstrumentSymbol(rawCode, "HK"),
      name,
      assetType: "etf",
      source: "hkex",
      confidence: "official",
      resolvedAt,
    });
  }

  if (!hasExpectedHeaders || directory.size === 0) {
    return invalidMetadataResponse("港交所 ETP 目录文件结构无效");
  }
  return directory;
}

function rowsFromWorksheet(
  worksheet: XLSX.WorkSheet,
  requiredHeaders: readonly string[],
): unknown[] {
  const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
  });
  const headerIndex = values.findIndex(
    (row) =>
      Array.isArray(row) &&
      requiredHeaders.every((header) =>
        row.some(
          (value) =>
            String(value).trim().replaceAll(/\s+/gu, " ") === header,
        ),
      ),
  );
  if (headerIndex < 0) {
    return invalidMetadataResponse("港交所证券目录文件结构无效");
  }
  return XLSX.utils.sheet_to_json(worksheet, {
    range: headerIndex,
    defval: "",
  });
}

function parseHkexWorkbook(
  bytes: ArrayBuffer,
  resolvedAt = new Date().toISOString(),
): Map<string, ResolvedInstrument> {
  try {
    const workbook = XLSX.read(bytes, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) invalidMetadataResponse("港交所证券目录无法解析");
    const worksheet = workbook.Sheets[firstSheet];
    if (!worksheet) invalidMetadataResponse("港交所证券目录无法解析");
    return parseHkexRows(
      rowsFromWorksheet(worksheet, [
        "Stock Code",
        "Name of Securities",
        "Category",
        "Sub-Category",
      ]),
      resolvedAt,
    );
  } catch {
    return invalidMetadataResponse("港交所证券目录无法解析");
  }
}

function parseHkexEtpWorkbook(
  bytes: ArrayBuffer,
  resolvedAt = new Date().toISOString(),
): Map<string, ResolvedInstrument> {
  try {
    const workbook = XLSX.read(bytes, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) invalidMetadataResponse("港交所 ETP 目录无法解析");
    const worksheet = workbook.Sheets[firstSheet];
    if (!worksheet) invalidMetadataResponse("港交所 ETP 目录无法解析");
    return parseHkexEtpRows(
      rowsFromWorksheet(worksheet, ["Stock Code", "Name of ETP"]),
      resolvedAt,
    );
  } catch {
    return invalidMetadataResponse("港交所 ETP 目录无法解析");
  }
}

type HkexCatalogState = {
  snapshot?: CatalogSnapshot<Map<string, ResolvedInstrument>>;
  inFlight?: Promise<Map<string, ResolvedInstrument>>;
  etpSnapshot?: CatalogSnapshot<Map<string, ResolvedInstrument>>;
  etpInFlight?: Promise<Map<string, ResolvedInstrument>>;
};

const catalogStates = new WeakMap<CatalogCache, HkexCatalogState>();

function catalogState(cache: CatalogCache): HkexCatalogState {
  const existing = catalogStates.get(cache);
  if (existing) return existing;
  const created: HkexCatalogState = {};
  catalogStates.set(cache, created);
  return created;
}

async function loadHkexDirectory(
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
      key: HKEX_SECURITIES_URL,
      now: currentTime,
      providerLabel: "港交所证券目录",
      validate: (bytes) => {
        parseHkexWorkbook(bytes);
      },
    });
    const directory = parseHkexWorkbook(
      file.bytes,
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

async function loadHkexEtpDirectory(
  cache: CatalogCache,
  fetcher: typeof fetch,
  now: () => number,
): Promise<Map<string, ResolvedInstrument>> {
  const state = catalogState(cache);
  const currentTime = now();
  if (
    state.etpSnapshot &&
    state.etpSnapshot.loadedAt <= currentTime &&
    currentTime - state.etpSnapshot.loadedAt < CATALOG_TTL_MS
  ) {
    return state.etpSnapshot.value;
  }
  if (state.etpInFlight) return state.etpInFlight;

  const request = (async () => {
    const file = await loadCatalogFile({
      cache,
      fetcher,
      key: HKEX_ETPS_URL,
      now: currentTime,
      providerLabel: "港交所 ETP 目录",
      validate: (bytes) => {
        parseHkexEtpWorkbook(bytes);
      },
    });
    const directory = parseHkexEtpWorkbook(
      file.bytes,
      new Date(file.loadedAt).toISOString(),
    );
    state.etpSnapshot = { loadedAt: file.loadedAt, value: directory };
    return directory;
  })();
  state.etpInFlight = request;
  try {
    return await request;
  } finally {
    if (state.etpInFlight === request) state.etpInFlight = undefined;
  }
}

export class HkexDirectoryProvider implements InstrumentMetadataProvider {
  readonly id = "hkex" as const;
  private readonly cache: CatalogCache;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;

  constructor(options: CatalogProviderOptions = {}) {
    this.cache = options.cache ?? cloudflareCatalogCache;
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  supports(lookup: InstrumentLookup) {
    return lookup.market === "HK";
  }

  async resolve(
    lookup: InstrumentLookup,
    fetcher: typeof fetch = this.fetcher,
  ): Promise<ResolvedInstrument> {
    if (!this.supports(lookup)) noMetadata("港交所目录不支持该市场");
    const symbol = canonicalInstrumentSymbol(lookup.symbol, "HK").padStart(
      5,
      "0",
    );
    let resolved = (await loadHkexDirectory(
      this.cache,
      fetcher,
      this.now,
    )).get(symbol);
    if (!resolved) {
      resolved = (await loadHkexEtpDirectory(
        this.cache,
        fetcher,
        this.now,
      )).get(symbol);
    }
    if (!resolved) noMetadata("港交所目录未返回该证券");
    return validateProviderMetadataResult(resolved, lookup, "港交所目录");
  }
}
