import type { HomepageV25PrepareInput, HomepageV25PreparedSource, SourceRevisions } from "../../lib/reviews/homepage-v25-performance";
import type { HomepageAttachments, HomepageRequest, HomepageRequestDomain, HomepageScope } from "../../lib/reviews/homepage-v25-state";
import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import type { TradeLibraryEntry } from "../../lib/trades/library";

export type HomepageUniverseCoverage = Readonly<{
  state: "complete" | "partial" | "unknown";
  knownAt: string | null;
  evidenceIds: readonly string[];
  reasons: readonly string[];
}>;

/** Raw authority fields use F's existing types; a current FX stamp is not history evidence. */
export type HomepageFinancialRawSource = Readonly<Pick<HomepageV25PrepareInput,
  "entries" | "instrumentMetadata" | "candlesByInstrument" | "fxObservations" |
  "currentFxSnapshot" | "lifetimeSourceCoverage" | "revisions"
> & {
  asOf: string;
  reviewSummariesComplete: boolean;
  marketDataStatuses: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  universeCoverage: HomepageUniverseCoverage;
}>;

export type HomepageFinancialSelection = Readonly<{
  scope: HomepageScope;
  attachments: HomepageAttachments;
  symbolInstrumentIds?: readonly string[];
}>;

/** These are source coverage bounds, not proof that all history rounds closed. */
export type HomepageSourceAllBounds =
  | Readonly<{ state: "known"; start: string; end: string; reasons: readonly string[] }>
  | Readonly<{ state: "unknown" | "empty"; start: null; end: null; reasons: readonly string[] }>;

export type HomepageFinancialSelectionReceipt = Readonly<{
  sourceId: string;
  selectionKey: string;
  eligibleGroupKeys: readonly string[];
  universeComplete: boolean;
  reasons: readonly string[];
}>;

export type HomepageOwnedFinancialSource = Readonly<{
  prepared: HomepageV25PreparedSource;
  asOf: string;
  reportCurrency: "CNY" | "HKD" | "USD";
  selection: HomepageFinancialSelection;
  receipt: HomepageFinancialSelectionReceipt;
  periodAllBounds: HomepageSourceAllBounds;
  historyAllBounds: HomepageSourceAllBounds;
  selectedEntries: readonly TradeLibraryEntry[];
  coverage: Readonly<{
    universe: HomepageUniverseCoverage;
    lifetime: HomepageV25PrepareInput["lifetimeSourceCoverage"];
  }>;
  revisions: SourceRevisions;
}>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** Producer stamp only; S keeps its numeric generation and remains the request authority. */
export function homepageProducerRequestKey<T, D extends HomepageRequestDomain>(request: HomepageRequest<T, D>): string {
  return `homepage-request-v1:${stableJson(request)}`;
}
