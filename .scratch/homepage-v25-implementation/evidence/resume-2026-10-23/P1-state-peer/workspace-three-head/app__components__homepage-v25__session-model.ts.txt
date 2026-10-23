import {
  beginHomepageApply, changeHomepageIdentity, completeHomepageRequest, restoreHomepageState,
  serializeHomepageNavigation, type HomepageRequest, type HomepageScope, type HomepageSnapshot, type HomepageState,
} from "../../lib/reviews/homepage-v25-state";
import { normalizeTradeLibraryBrowseState } from "../library/library-browse-state";

export type HomepageSession<T> = { ui: HomepageState; data: T };
export function createHomepageSession<T>(ui: HomepageState, data: T): HomepageSession<T> { return { ui, data }; }
export function startHomepageRead<T>(model: HomepageSession<T>, scope: HomepageScope, now = Date.now()): HomepageSession<T> {
  const identity = changeHomepageIdentity(model.ui, scope);
  return { ...model, ui: beginHomepageApply(identity, identity.draft, now) };
}
export function finishHomepageRead<T>(model: HomepageSession<T>, token: HomepageRequest, data: T, sourceBytes?: string): HomepageSession<T> {
  const completion = completeHomepageRequest(model.ui, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
  if (!completion.accepted) return { ...model, ui: completion.state };
  const restored = sourceBytes ? restoreHomepageState(sourceBytes, completion.state) : null;
  return { ui: restored?.ok ? restored.state : completion.state, data };
}

export function homepageTradeUrl(snapshot: HomepageSnapshot, symbolIdentity?: string): string {
  const { live, market, accounts } = snapshot.scope;
  const period = snapshot.period;
  return serializeHomepageNavigation({ live, market, accounts,
    ...(period.preset === "all" ? { rangeMode: "all" } : { rangeMode: "custom", from: period.from, to: period.to }),
    ...(symbolIdentity ? { symbolIdentity } : {}),
  });
}

export function homepageCollectionState(scope: HomepageScope, instrumentId: string | null) {
  return normalizeTradeLibraryBrowseState({
    mode: "stocks", tradeNature: "live", reviewStatus: "all",
    accounts: scope.accounts.includes("*") ? [] : scope.accounts,
    account: scope.accounts.length === 1 && scope.accounts[0] !== "*" ? scope.accounts[0] : "all",
    market: scope.market === "a" ? "a-share" : scope.market === "all" ? "all" : scope.market.toUpperCase(),
    executionDateFrom: scope.rangeMode === "date" ? scope.date : scope.rangeMode === "custom" ? scope.from : null,
    executionDateTo: scope.rangeMode === "date" ? scope.date : scope.rangeMode === "custom" ? scope.to : null,
    collectionInstrumentId: instrumentId,
    roomFilters: scope.market === "a" ? { assetCategory: "all", assetType: "all", query: "", instrumentIds: [], markets: ["CN-SH", "CN-SZ"], currencies: [], reviewStatuses: [] } : null,
    // Collection identity is a filter, rather than a selected first episode.
    selectedInstrumentId: null, selectedEpisodeId: null,
  });
}
