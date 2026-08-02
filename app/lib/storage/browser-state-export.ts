import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "../market/contracts";
import { loadChartSettings } from "./chart-settings";
import { loadImportHistory } from "./import-history";
import { deserializeImportedExecutions, IMPORTED_EXECUTIONS_STORAGE_KEY } from "./import-library";
import {
  COVERAGE,
  DAILY_CANDLES,
  INSTRUMENT_METADATA,
  INTERVAL_COVERAGE,
  MARKET_CANDLES,
  PROVIDER_SYMBOLS,
  readAllTradeReviewStores,
  REVIEWS,
  TAG_SUGGESTIONS,
} from "./indexeddb-schema";
import { loadMarketDataJobs } from "./market-data-jobs";
import { loadReviewState } from "./review-storage";
import type { BrowserStatePayload, CoverageRecord, ProviderSymbolRecord, StoredInstrument } from "./sqlite-contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { TagSuggestionRecord } from "../insights/types";
import type { TradeExecution } from "../trades/types";
import { validateResolvedInstrument } from "../instruments/metadata-contracts";

const DATABASE_NAME = "trade-reviewer";
const CLIENT_ID_KEY = "trade-reviewer:sqlite-migration:client-id:v1";
const REVIEW_PREFIXES = ["trade-reviewer:review:v2:", "trade-reviewer:review:v1:"] as const;

function records<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function currencyForMarket(market: string) {
  if (market === "HK") return "HKD";
  if (market === "US") return "USD";
  return "CNY";
}

function instrumentsFrom(
  executions: readonly TradeExecution[],
  metadata: readonly Record<string, unknown>[],
): StoredInstrument[] {
  const result = new Map<string, StoredInstrument>();
  for (const execution of executions) result.set(execution.instrument.id, { ...execution.instrument });
  for (const record of metadata) {
    const instrumentId = typeof record.instrumentId === "string" ? record.instrumentId : "";
    const market = typeof record.market === "string" ? record.market : "";
    const symbol = typeof record.symbol === "string" ? record.symbol : "";
    const name = typeof record.name === "string" ? record.name : "";
    if (!instrumentId || !market || !symbol || !name || !["US", "HK", "CN-SH", "CN-SZ"].includes(market)) continue;
    let resolved;
    try {
      resolved = validateResolvedInstrument(record, {
        market: market as "US" | "HK" | "CN-SH" | "CN-SZ",
        symbol,
      });
    } catch {
      continue;
    }
    const existing = result.get(instrumentId);
    result.set(instrumentId, {
      id: instrumentId,
      symbol: resolved.symbol,
      name: resolved.name,
      market: resolved.market,
      currency: existing?.currency ?? currencyForMarket(market),
      metadata: resolved,
    });
  }
  return [...result.values()];
}

function reviewStates(): BrowserStatePayload["reviewStates"] {
  const episodeIds = new Set<string>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    for (const prefix of REVIEW_PREFIXES) {
      if (key.startsWith(prefix)) episodeIds.add(key.slice(prefix.length));
    }
  }
  return [...episodeIds].flatMap((episodeId) => {
    const state = loadReviewState(episodeId);
    return state ? [state] : [];
  });
}

function coverageRecords(value: unknown): CoverageRecord[] {
  return records<{ instrumentId?: unknown; segments?: unknown }>(value).flatMap((record) => {
    const instrumentId = record.instrumentId;
    if (typeof instrumentId !== "string" || !Array.isArray(record.segments)) return [];
    const segments = record.segments.map((segment) => segment as CoverageSegment);
    return [{
      instrumentId,
      adjustmentMode: "raw" as const,
      ...(segments[0] ? { startDate: segments[0].startDate } : {}),
      ...(segments.at(-1) ? { endDate: segments.at(-1)?.endDate } : {}),
      segments,
    }];
  });
}

function intervalCoverageRecords(value: unknown): BrowserStatePayload["intervalCoverage"] {
  return records<{ instrumentId?: unknown; interval?: unknown; segments?: unknown }>(value).flatMap((record) => {
    const instrumentId = record.instrumentId;
    const interval = record.interval;
    if (typeof instrumentId !== "string" || (interval !== "15m" && interval !== "1D") || !Array.isArray(record.segments)) return [];
    return record.segments.map((segment) => ({
      instrumentId,
      adjustmentMode: "raw" as const,
      ...(segment as IntervalCoverageSegment),
      interval,
    }));
  });
}

function providerSymbols(value: unknown): ProviderSymbolRecord[] {
  return records<{ instrumentId?: unknown; provider?: unknown; symbol?: unknown }>(value).flatMap((record) =>
    typeof record.instrumentId === "string" && typeof record.provider === "string" && typeof record.symbol === "string"
      ? [{ instrumentId: record.instrumentId, provider: record.provider, providerSymbol: record.symbol }]
      : [],
  );
}

function clientId() {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
}

export async function exportLegacyBrowserState(): Promise<BrowserStatePayload | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  const rawExecutions = localStorage.getItem(IMPORTED_EXECUTIONS_STORAGE_KEY);
  const stores = await readAllTradeReviewStores(DATABASE_NAME);
  const hasLegacyData = rawExecutions !== null || localStorage.getItem("trade-reviewer:import-history:v1") !== null || localStorage.getItem("trade-reviewer:market-data-jobs:v1") !== null || localStorage.getItem("trade-reviewer:chart-settings:v1") !== null || Object.values(stores).some((items) => items.length > 0) || [...Array(localStorage.length)].some((_, index) => REVIEW_PREFIXES.some((prefix) => localStorage.key(index)?.startsWith(prefix)));
  if (!hasLegacyData) return null;
  const executions = rawExecutions ? deserializeImportedExecutions(rawExecutions) : [];
  const payload = {
    version: 1 as const,
    sourceClientId: clientId(),
    sourceFingerprint: "",
    executions,
    importHistory: loadImportHistory(),
    instruments: instrumentsFrom(executions, records<Record<string, unknown>>(stores[INSTRUMENT_METADATA])),
    reviews: records<EpisodeReviewRecord>(stores[REVIEWS]),
    reviewStates: reviewStates(),
    tagSuggestions: records<TagSuggestionRecord>(stores[TAG_SUGGESTIONS]),
    marketDataJobs: loadMarketDataJobs(),
    settings: loadChartSettings(),
    dailyCandles: records<DailyCandleRecord>(stores[DAILY_CANDLES]),
    marketCandles: records<MarketCandleRecord>(stores[MARKET_CANDLES]),
    coverage: coverageRecords(stores[COVERAGE]),
    intervalCoverage: intervalCoverageRecords(stores[INTERVAL_COVERAGE]),
    providerSymbols: providerSymbols(stores[PROVIDER_SYMBOLS]),
  } satisfies BrowserStatePayload;
  return { ...payload, sourceFingerprint: calculateBrowserStateFingerprint(payload) };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).sort().join(",")}]`;
  if (!value || typeof value !== "object") throw new Error("Browser migration payload is not JSON-safe");
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

// Compact synchronous SHA-256 implementation: Web Crypto is asynchronous, while
// the migration contract requires the exact fingerprint before posting JSON.
function sha256(message: string) {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const words = Array<number>(((bitLength + 64 >> 9) << 4) + 16).fill(0);
  for (let index = 0; index < bytes.length; index += 1) words[index >> 2] |= bytes[index] << (24 - (index % 4) * 8);
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[((bitLength + 64 >> 9) << 4) + 15] = bitLength;
  const hash = [1779033703, -1150833019, 1013904242, -1521486534, 1359893119, -1694144372, 528734635, 1541459225];
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  for (let offset = 0; offset < words.length; offset += 16) {
    const schedule = words.slice(offset, offset + 16);
    for (let index = 16; index < 64; index += 1) { const a = schedule[index - 15]; const b = schedule[index - 2]; schedule[index] = (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + schedule[index - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)) + schedule[index - 16] | 0; }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index += 1) { const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)); const choose = (e & f) ^ (~e & g); const temp1 = (h + s1 + choose + constants[index] + schedule[index]) | 0; const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)); const majority = (a & b) ^ (a & c) ^ (b & c); h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + s0 + majority) | 0; }
    hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0; hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0; hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0; hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
  }
  return hash.map((word) => (word >>> 0).toString(16).padStart(8, "0")).join("");
}

export function calculateBrowserStateFingerprint(payload: BrowserStatePayload) {
  const { sourceFingerprint, ...state } = payload;
  void sourceFingerprint;
  return sha256(canonicalize(state));
}
