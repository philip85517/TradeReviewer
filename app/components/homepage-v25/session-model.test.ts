import { describe, expect, it } from "vitest";
import { createHomepageState, encodeHomepageSnapshot, updateHomepageUi, editHomepageDraft, beginHomepagePeriodApply, beginHomepageHistoryApply, completeHomepageRequest } from "../../lib/reviews/homepage-v25-state";
import { createHomepageSession, startHomepageRead, finishHomepageRead, homepageCollectionState, homepageTradeUrl,
  completeHomepageGlobalRead, completeHomepagePeriodRead, completeHomepageHistoryRead } from "./session-model";

const all = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
describe("homepage integrated session", () => {
  it("commits matching business rows and applied labels atomically, ignoring an older completion", () => {
    const original = createHomepageSession(createHomepageState(all), ["old"]);
    const first = startHomepageRead(original, { purpose: "identity", scope: { ...all, market: "a" } }, 10);
    const firstToken = first.ui.request!;
    const second = startHomepageRead(first, { purpose: "identity", scope: { ...all, market: "hk" } }, 20);
    expect(second.ui.snapshot.scope.market).toBe("all");
    expect(second.data).toEqual(["old"]);
    const stale = finishHomepageRead(second, firstToken, ["stale"]);
    expect(stale.data).toEqual(["old"]);
    expect(stale.ui.snapshot.scope.market).toBe("all");
    const current = finishHomepageRead(stale, second.ui.request!, ["new"]);
    expect(current.ui.snapshot.scope.market).toBe("hk");
    expect(current.data).toEqual(["new"]);
  });
  it("restores UI only alongside a fresh data result and uses period dates for the ordinary collection", () => {
    const sourceUi = updateHomepageUi(createHomepageState(all), { holdings: { query: "茅台", sort: "name-desc", page: 3 }, scrollTop: 321 });
    const bytes = encodeHomepageSnapshot(sourceUi.snapshot);
    const loading = startHomepageRead(createHomepageSession(createHomepageState(all), ["outdated"]), { purpose: "navigation", scope: all }, 10);
    const restored = finishHomepageRead(loading, loading.ui.request!, ["fresh"], bytes);
    expect(restored.data).toEqual(["fresh"]);
    expect(restored.ui.snapshot.holdings).toEqual({ query: "茅台", sort: "name-desc", page: 3 });
    expect(restored.ui.snapshot.scrollTop).toBe(321);
    const period = { preset: "custom" as const, from: "2026-10-01", to: "2026-10-23" };
    const periodRead = beginHomepagePeriodApply(sourceUi, period, 20);
    const periodToken = periodRead.requests.period!;
    const applied = completeHomepageRequest(periodRead, { domain: "period", generation: periodToken.generation, scopeKey: periodToken.scopeKey, ok: true, period });
    const url = homepageTradeUrl(applied.state.snapshot, "SSE:600519");
    expect(url).toContain("rangeMode=custom");
    expect(url).toContain("from=2026-10-01");
    expect(url).not.toContain("queue");
    const browse = homepageCollectionState({ ...all, rangeMode: "date", date: "2026-10-22", symbolIdentity: "SSE:600519" }, "CN-SH:600519");
    expect(browse).toMatchObject({ mode: "stocks", selectedInstrumentId: null, selectedEpisodeId: null, executionDateFrom: "2026-10-22", executionDateTo: "2026-10-22", collectionInstrumentId: "CN-SH:600519", reviewStatus: "all" });
  });
  it("refreshes committed attachments while preserving a separately edited draft, then hands off the native date", () => {
    const scope = { ...all, rangeMode: "date" as const, date: "2026-10-22" };
    const ui = editHomepageDraft(createHomepageState(scope), { ...scope, attachments: { categories: ["long"], openOnly: true, pendingReview: [false] } });
    const started = startHomepageRead(createHomepageSession(ui, "old"), { purpose: "refresh" }, 10);
    expect(started.ui.request!.purpose).toBe("refresh");
    expect(started.ui.request!.target.attachments).toEqual({ categories: [], openOnly: false, pendingReview: [] });
    const fresh = finishHomepageRead(started, started.ui.request!, "new");
    expect(fresh.data).toBe("new");
    expect(fresh.ui.draft.attachments).toEqual({ categories: ["long"], openOnly: true, pendingReview: [false] });
    expect(fresh.ui.snapshot.attachments).toEqual({ categories: [], openOnly: false, pendingReview: [] });
    expect(homepageTradeUrl(fresh.ui.snapshot)).toContain("rangeMode=date&date=2026-10-22");
  });

  it("keeps every instrument of one directory identity in the ordinary collection without selecting a first record", () => {
    const browse = homepageCollectionState({ ...all, market: "us", rangeMode: "date", date: "2026-10-22", symbolIdentity: "NASDAQ:META:stock" }, ["one", "two"]);
    expect(browse.collectionInstrumentId).toBeNull();
    expect(browse.roomFilters?.instrumentIds).toEqual(["one", "two"]);
    expect(browse).toMatchObject({ selectedInstrumentId: null, selectedEpisodeId: null, mode: "stocks", tradeNature: "live", market: "US", executionDateFrom: "2026-10-22", executionDateTo: "2026-10-22" });
  });

});

describe("homepage opaque domain sessions", () => {
  const period = { preset: "custom" as const, from: "2026-10-01", to: "2026-10-23" };
  const range = { mode: "year" as const, year: 2025 };
  const globalData = { current: "old market value", holdings: ["old holding"] };
  const oldPeriod = { cards: ["old p1", "old p2", "old p3"], series: ["old period point"], contribution: ["old current bucket"] };
  const oldHistory = { cards: ["old h1", "old h2", "old h3", "old h4"], series: ["old history point"], contribution: ["old historical bucket"] };
  const freshPeriod = { cards: ["p1", "p2", "p3"], series: ["period point"], contribution: ["current bucket"] };
  const freshHistory = { cards: ["h1", "h2", "h3", "h4"], series: ["history point"], contribution: ["historical bucket"] };
  const seed = () => createHomepageSession(createHomepageState(all), globalData, { period: oldPeriod, history: oldHistory });

  it("retains explicit opaque complete slots and leaves legacy sessions unconfigured", () => {
    expect(seed().domainData).toEqual({ period: oldPeriod, history: oldHistory });
    expect(createHomepageSession(createHomepageState(all), globalData).domainData).toBeNull();
  });
  it.each(["history-first", "period-first"])("atomically accepts independent packages in %s order", order => {
    const initial = seed();
    const ui = beginHomepageHistoryApply(beginHomepagePeriodApply(initial.ui, period, 10), range, 20);
    const loading = { ...initial, ui };
    const p = ui.requests.period!; const h = ui.requests.history!;
    const first = order === "history-first" ? completeHomepageHistoryRead(loading, h, freshHistory) : completeHomepagePeriodRead(loading, p, freshPeriod);
    expect(first.accepted).toBe(true);
    expect(first.session.data).toBe(globalData);
    expect(first.session.ui.snapshot.period).toEqual(order === "history-first" ? initial.ui.snapshot.period : period);
    expect(first.session.ui.snapshot.history.range).toEqual(order === "history-first" ? range : initial.ui.snapshot.history.range);
    expect(first.session.domainData).toEqual(order === "history-first" ? { period: oldPeriod, history: freshHistory } : { period: freshPeriod, history: oldHistory });
    const second = order === "history-first" ? completeHomepagePeriodRead(first.session, p, freshPeriod) : completeHomepageHistoryRead(first.session, h, freshHistory);
    expect(second.accepted).toBe(true);
    expect(second.session.domainData).toEqual({ period: freshPeriod, history: freshHistory });
    expect(second.session.ui.snapshot.period).toEqual(period);
    expect(second.session.ui.snapshot.history.range).toEqual(range);
    expect(second.session.data).toBe(globalData);
  });
  it.each(["refresh", "apply"] as const)("invalidates both local owners before a global %s begins", purpose => {
    const initial = seed();
    const ui = beginHomepageHistoryApply(beginHomepagePeriodApply(initial.ui, period, 10), range, 20);
    const next = startHomepageRead({ ...initial, ui }, { purpose }, 30);
    expect(next.ui.requests.period).toBeNull(); expect(next.ui.requests.history).toBeNull();
    expect(completeHomepagePeriodRead(next, ui.requests.period!, freshPeriod).accepted).toBe(false);
    expect(completeHomepageHistoryRead(next, ui.requests.history!, freshHistory).session.domainData).toBe(initial.domainData);
    expect(next.ui.snapshot).toEqual(initial.ui.snapshot);
  });
  it.each(["generation", "scopeKey", "startedAt", "domain"])("rejects an echoed period token with a mismatched %s", field => {
    const initial = seed(); const loading = { ...initial, ui: beginHomepagePeriodApply(initial.ui, period, 10) };
    const token = loading.ui.requests.period!;
    const wrong = { ...token, ...({ generation: { generation: token.generation + 1 }, scopeKey: { scopeKey: "other" }, startedAt: { startedAt: 11 }, domain: { domain: "history" } }[field]) };
    // Runtime transport boundary: assert the deliberately malformed echoed token.
    const result = completeHomepagePeriodRead(loading, wrong as typeof token, freshPeriod);
    expect(result.accepted).toBe(false); expect(result.session.domainData).toBe(initial.domainData);
    expect(result.session.ui.snapshot.period).toEqual(initial.ui.snapshot.period);
  });
  it("lets S reject a same-owner different target without publishing the payload", () => {
    const initial = seed(); const loading = { ...initial, ui: beginHomepagePeriodApply(initial.ui, period, 10) };
    const result = completeHomepagePeriodRead(loading, { ...loading.ui.requests.period!, target: { ...period, to: "2026-10-22" } }, freshPeriod);
    expect(result.accepted).toBe(false); expect(result.session.ui.errors.period).toBe("update-failed");
    expect(result.session.domainData).toBe(initial.domainData); expect(result.session.ui.snapshot.period).toEqual(initial.ui.snapshot.period);
  });
  it("publishes fresh global and both local packages beside the restored actual snapshot", () => {
    const initial = seed();
    const source = { ...initial.ui.snapshot, period, scope: { ...all, rangeMode: "custom" as const, from: period.from, to: period.to }, history: { range, chartMode: "win-rate" as const } };
    const loading = startHomepageRead(initial, { purpose: "navigation", scope: source.scope }, 10);
    const result = completeHomepageGlobalRead(loading, loading.ui.requests.global!, { current: "fresh MV", holdings: ["fresh holding"] }, {
      sourceBytes: encodeHomepageSnapshot(source), domainData: accepted => {
        expect(accepted.period).toEqual(period); expect(accepted.history.range).toEqual(range);
        return { period: freshPeriod, history: freshHistory };
      },
    });
    expect(result.accepted).toBe(true); expect(result.session.ui.snapshot).toEqual(source);
    expect(result.session.data.current).toBe("fresh MV"); expect(result.session.domainData).toEqual({ period: freshPeriod, history: freshHistory });
  });
  it.each(["missing", "throw"])("keeps all old labels and packages when the global extractor is %s", mode => {
    const initial = seed(); const loading = startHomepageRead(initial, { purpose: "identity", scope: { ...all, market: "hk" } }, 10);
    const options = mode === "missing" ? undefined : { domainData: () => { throw new Error("complete domain bundle unavailable"); } };
    const result = completeHomepageGlobalRead(loading, loading.ui.requests.global!, { current: "new", holdings: ["new"] }, options);
    expect(result.accepted).toBe(false); expect(result.session.ui.errors.global).toBeTruthy();
    expect(result.session.ui.snapshot).toEqual(initial.ui.snapshot); expect(result.session.data).toBe(globalData); expect(result.session.domainData).toBe(initial.domainData);
  });
});
