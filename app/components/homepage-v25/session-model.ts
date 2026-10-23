import {
  beginHomepageRead, cancelHomepageRequest, completeHomepageRequest, homepageNavigationScope, homepageScopeKey, restoreHomepageState, updateHomepageUi,
  serializeHomepageNavigation, type HomepageDraft, type HomepageHistoryRange, type HomepagePeriod, type HomepageReadIntent, type HomepageRequest,
  type HomepageRequestDomain, type HomepageScope, type HomepageSnapshot, type HomepageState,
} from "../../lib/reviews/homepage-v25-state";
import { normalizeTradeLibraryBrowseState } from "../library/library-browse-state";

export type HomepageDomainData<TP, TH> = { period: TP; history: TH };
export type HomepageSession<T, TP = never, TH = never> = { ui: HomepageState; data: T; domainData: HomepageDomainData<TP, TH> | null };
export type HomepageSessionCompletion<T, TP = never, TH = never> = { session: HomepageSession<T, TP, TH>; accepted: boolean };
export function createHomepageSession<T, TP = never, TH = never>(ui: HomepageState, data: T, domainData?: HomepageDomainData<TP, TH>): HomepageSession<T, TP, TH> {
  return { ui, data, domainData: domainData ?? null };
}
export function cancelHomepageLocalReads(ui: HomepageState): HomepageState {
  let next = ui;
  for (const domain of ["period", "history"] as const) if (next.requests[domain]) next = cancelHomepageRequest(next, domain);
  return next;
}
export function startHomepageRead<T, TP = never, TH = never>(model: HomepageSession<T, TP, TH>, intent: HomepageReadIntent, now = Date.now()): HomepageSession<T, TP, TH> {
  return { ...model, ui: beginHomepageRead(cancelHomepageLocalReads(model.ui), intent, now) };
}
type RequestOwner = Pick<HomepageRequest<unknown, HomepageRequestDomain>, "domain" | "generation" | "scopeKey" | "startedAt">;
export function homepageRequestMatches(active: RequestOwner | null, echoed: RequestOwner): boolean {
  return Boolean(active && active.domain === echoed.domain && active.generation === echoed.generation && active.scopeKey === echoed.scopeKey && active.startedAt === echoed.startedAt);
}
/** Pure S/source projection shared by loader context and actual publication. */
export function homepageGlobalReadState(state: HomepageState, token: HomepageRequest, sourceBytes?: string): { state: HomepageState; accepted: boolean } {
  if (!homepageRequestMatches(state.requests.global, token)) return { state, accepted: false };
  const completion = completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
  if (!completion.accepted) return completion;
  const restored = sourceBytes ? restoreHomepageState(sourceBytes, completion.state) : null;
  const ui = restored?.ok ? restored.state : completion.state;
  return { state: token.purpose === "apply" ? updateHomepageUi(ui, { holdings: { ...ui.snapshot.holdings, page: 1 } }) : ui, accepted: true };
}
export function completeHomepageGlobalRead<T, TP = never, TH = never>(model: HomepageSession<T, TP, TH>, token: HomepageRequest, data: T,
  options?: { sourceBytes?: string; domainData?: (accepted: HomepageSnapshot) => HomepageDomainData<TP, TH> }): HomepageSessionCompletion<T, TP, TH> {
  const completion = homepageGlobalReadState(model.ui, token, options?.sourceBytes);
  if (!completion.accepted) return { session: { ...model, ui: completion.state }, accepted: false };
  try {
    const extract = options?.domainData;
    if (model.domainData && !extract) throw new Error("complete-domain-data-required");
    const domainData = model.domainData && extract ? extract(completion.state.snapshot) : null;
    return { session: { ui: completion.state, data, domainData }, accepted: true };
  } catch (error) {
    const failed = completeHomepageRequest(model.ui, { generation: token.generation, scopeKey: token.scopeKey, ok: false, error: error instanceof Error ? error.message : "domain-data-failed" });
    return { session: { ...model, ui: failed.state }, accepted: false };
  }
}
export function completeHomepagePeriodRead<T, TP, TH>(model: HomepageSession<T, TP, TH>, token: HomepageRequest<HomepagePeriod, "period">, data: TP): HomepageSessionCompletion<T, TP, TH> {
  if (!model.domainData || !homepageRequestMatches(model.ui.requests.period, token)) return { session: model, accepted: false };
  const completion = completeHomepageRequest(model.ui, { domain: "period", generation: token.generation, scopeKey: token.scopeKey, ok: true, period: token.target });
  return { session: { ...model, ui: completion.state, domainData: completion.accepted ? { ...model.domainData, period: data } : model.domainData }, accepted: completion.accepted };
}
export function completeHomepageHistoryRead<T, TP, TH>(model: HomepageSession<T, TP, TH>, token: HomepageRequest<HomepageHistoryRange, "history">, data: TH): HomepageSessionCompletion<T, TP, TH> {
  if (!model.domainData || !homepageRequestMatches(model.ui.requests.history, token)) return { session: model, accepted: false };
  const completion = completeHomepageRequest(model.ui, { domain: "history", generation: token.generation, scopeKey: token.scopeKey, ok: true, historyRange: token.target });
  return { session: { ...model, ui: completion.state, domainData: completion.accepted ? { ...model.domainData, history: data } : model.domainData }, accepted: completion.accepted };
}
export function finishHomepageRead<T>(model: HomepageSession<T>, token: HomepageRequest, data: T, sourceBytes?: string): HomepageSession<T> {
  return completeHomepageGlobalRead(model, token, data, { sourceBytes }).session;
}

/** Read provenance only: S navigation tokens still retain their original target. */
export function homepageReadTarget(token: HomepageRequest, sourceBytes?: string, inheritSource = true): HomepageDraft {
  const restored = inheritSource && token.purpose === "navigation" && sourceBytes ? restoreHomepageState(sourceBytes) : null;
  const withoutSymbol = (scope: HomepageScope) => homepageScopeKey({ live: scope.live, market: scope.market, accounts: scope.accounts,
    rangeMode: scope.rangeMode, ...(scope.from ? { from: scope.from } : {}), ...(scope.to ? { to: scope.to } : {}), ...(scope.date ? { date: scope.date } : {}) });
  const source = restored?.ok && withoutSymbol(restored.state.snapshot.scope) === withoutSymbol(token.target) ? restored.state.snapshot : null;
  const attachments = source?.attachments ?? token.target.attachments;
  return { ...token.target, attachments: { ...attachments, categories: [...attachments.categories], pendingReview: [...attachments.pendingReview] } };
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
