import { describe, expect, it } from "vitest";
import { createHomepageState, encodeHomepageSnapshot, updateHomepageUi, editHomepageDraft, beginHomepagePeriodApply, completeHomepageRequest } from "../../lib/reviews/homepage-v25-state";
import { createHomepageSession, startHomepageRead, finishHomepageRead, homepageCollectionState, homepageTradeUrl } from "./session-model";

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
