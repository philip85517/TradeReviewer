import type { InstrumentExchange } from "../../lib/instruments/metadata-contracts";
import type { TradingRoomHoldingsOptions } from "../../lib/reviews/trading-room-holdings";
import type { RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";
import { beginHomepagePeriodApply, createHomepageState, editHomepageDraft, type HomepageAttachments, type HomepageScope } from "../../lib/reviews/homepage-v25-state";
import { readHomepageV25FinancialFacts } from "../../lib/reviews/homepage-v25-performance";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { ownHomepageFinancialSource } from "./financial-source-model";
import { projectHomepageFinancialView } from "./financial-view-model";
import { buildHomepageHoldings } from "./holdings-model";

/** Test-only composition of the real accepted modules. Coverage is explicit fixture evidence. */
export function homepageHoldingsFixture(entries: readonly TradeLibraryEntry[], options: Omit<TradingRoomHoldingsOptions, "scope"> & {
  scope: HomepageScope; attachments?: HomepageAttachments; reviewSummariesComplete?: boolean;
  symbolInstrumentIds?: readonly string[]; exchangeByInstrument?: Readonly<Record<string, InstrumentExchange | undefined>>;
  fxSnapshot?: RoomFxSnapshot; universe?: "complete" | "unknown";
}) {
  const asOf = options.asOf?.length === 10 ? `${options.asOf}T15:59:59.999Z` : options.asOf ?? "2026-10-23T12:00:00Z";
  const attachments = options.attachments ?? { categories: [], openOnly: false, pendingReview: [] };
  const snapshot = options.fxSnapshot;
  const source = ownHomepageFinancialSource({ entries, asOf, instrumentMetadata: options.instrumentMetadata,
    candlesByInstrument: options.candlesByInstrument ?? {}, marketDataStatuses: options.marketDataStatuses ?? {},
    reviewSummariesComplete: options.reviewSummariesComplete ?? false, fxObservations: [], lifetimeSourceCoverage: [],
    currentFxSnapshot: snapshot ? { snapshot: { ...snapshot, asOf: snapshot.asOf.length === 10 ? `${snapshot.asOf}T00:00:00Z` : snapshot.asOf }, fetchedAt: asOf,
      publishedAtByPair: Object.fromEntries(Object.keys(snapshot.rates).map(pair => [pair, snapshot.asOf.length === 10 ? `${snapshot.asOf}T00:00:00Z` : snapshot.asOf])), sourceRevision: "fixture-fx", evidenceIds: ["fixture-fx"] } : null,
    revisions: { trades: "fixture-t", metadata: "fixture-m", quotes: "fixture-q", fx: "fixture-f" },
    universeCoverage: options.universe === "unknown" ? { state: "unknown", knownAt: null, evidenceIds: [], reasons: ["fixture-unproven"] }
      : { state: "complete", knownAt: "2026-01-01T00:00:00Z", evidenceIds: ["fixture-enumeration"], reasons: [] },
  }, { scope: options.scope, attachments, symbolInstrumentIds: options.symbolInstrumentIds });
  const state = createHomepageState(source.selection.scope); state.snapshot.attachments = editHomepageDraft(state, { ...source.selection.scope, attachments: source.selection.attachments }).draft.attachments;
  const request = beginHomepagePeriodApply(state, { preset: "custom", from: asOf.slice(0, 10), to: asOf.slice(0, 10) }, 1).requests.period!;
  const view = projectHomepageFinancialView(source, { domain: "period", request });
  const facts = readHomepageV25FinancialFacts(source.prepared, { asOf: view.current.asOf, targetCurrency: source.reportCurrency });
  const model = buildHomepageHoldings(source, view, facts, options);
  return { ...model, source, view, facts };
}
