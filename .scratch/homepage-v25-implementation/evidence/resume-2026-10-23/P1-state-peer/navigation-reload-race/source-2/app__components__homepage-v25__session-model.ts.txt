import {
  beginHomepageRead, completeHomepageRequest, homepageNavigationScope, restoreHomepageState,
  serializeHomepageNavigation, type HomepageReadIntent, type HomepageRequest, type HomepageScope, type HomepageSnapshot, type HomepageState,
} from "../../lib/reviews/homepage-v25-state";
import { normalizeTradeLibraryBrowseState } from "../library/library-browse-state";

export type HomepageSession<T> = { ui: HomepageState; data: T };
export function createHomepageSession<T>(ui: HomepageState, data: T): HomepageSession<T> { return { ui, data }; }
export function startHomepageRead<T>(model: HomepageSession<T>, intent: HomepageReadIntent, now = Date.now()): HomepageSession<T> {
  return { ...model, ui: beginHomepageRead(model.ui, intent, now) };
}
export function finishHomepageRead<T>(model: HomepageSession<T>, token: HomepageRequest, data: T, sourceBytes?: string): HomepageSession<T> {
  const completion = completeHomepageRequest(model.ui, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
  if (!completion.accepted) return { ...model, ui: completion.state };
  const restored = sourceBytes ? restoreHomepageState(sourceBytes, completion.state) : null;
  return { ui: restored?.ok ? restored.state : completion.state, data };
}

export function homepageTradeUrl(snapshot: HomepageSnapshot, symbolIdentity?: string): string {
  return serializeHomepageNavigation(homepageNavigationScope(snapshot, symbolIdentity ?? null));
}

export function homepageCollectionState(scope: HomepageScope, identityInstruments: string | readonly string[] | null) {
  const instrumentIds = typeof identityInstruments === "string" ? [identityInstruments] : [...identityInstruments ?? []];
  const marketFilters = scope.market === "a" ? ["CN-SH", "CN-SZ"] : [];
  return normalizeTradeLibraryBrowseState({
    mode: "stocks", tradeNature: "live", reviewStatus: "all",
    accounts: scope.accounts.includes("*") ? [] : scope.accounts,
    account: scope.accounts.length === 1 && scope.accounts[0] !== "*" ? scope.accounts[0] : "all",
    market: scope.market === "a" ? "a-share" : scope.market === "all" ? "all" : scope.market.toUpperCase(),
    executionDateFrom: scope.rangeMode === "date" ? scope.date : scope.rangeMode === "custom" ? scope.from : null,
    executionDateTo: scope.rangeMode === "date" ? scope.date : scope.rangeMode === "custom" ? scope.to : null,
    collectionInstrumentId: instrumentIds.length === 1 ? instrumentIds[0] : null,
    roomFilters: marketFilters.length || instrumentIds.length > 1 ? { assetCategory: "all", assetType: "all", query: "", instrumentIds: instrumentIds.length > 1 ? instrumentIds : [], markets: marketFilters, currencies: [], reviewStatuses: [] } : null,
    // Collection identity is a filter, rather than a selected first episode.
    selectedInstrumentId: null, selectedEpisodeId: null,
  });
}
