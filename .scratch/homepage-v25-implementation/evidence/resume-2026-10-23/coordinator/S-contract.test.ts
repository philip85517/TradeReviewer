import { describe, expect, it } from "vitest";
import * as s from "../../../../../app/lib/reviews/homepage-v25-state";

const scope: s.HomepageScope = { live: true, market: "all", accounts: ["broker-a"], rangeMode: "custom", from: "2026-01-01", to: "2026-01-31" };
const initial = () => s.createHomepageState(scope);
const succeed = (state: s.HomepageState) => {
  const token = state.requests.global!;
  return s.completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
};

describe("coordinator independent v2 source journey", () => {
  it("applied filters survive save, return and a subsequent identity change", () => {
    let state = initial();
    state = s.beginHomepageApply(state, { ...state.draft, attachments: { categories: ["stock"], openOnly: true, pendingReview: true } });
    const result = succeed(state);
    expect(result.accepted).toBe(true);
    const restored = s.restoreHomepageState(s.encodeHomepageSnapshot(result.state.snapshot));
    if (!restored.ok) throw new Error(restored.error);
    expect(restored.state.applied.attachments).toEqual({ categories: ["stock"], openOnly: true, pendingReview: true });
    expect(Object.keys(restored.state.snapshot.scope)).not.toContain("attachments");
    const changed = s.changeHomepageIdentity(restored.state, { ...scope, market: "hk" });
    expect(changed.snapshot.scope.market).toBe("all");
    expect(changed.draft.attachments.categories).toEqual([]);
    expect(changed.draft.from).toBe("2026-01-01");
  });

  it("roundtrips complete history and both contribution memories without business objects", () => {
    let state = initial();
    state = s.beginHomepageHistoryApply(state, { mode: "years", fromYear: 2024, toYear: 2026 });
    const t = state.requests.history!;
    state = s.completeHomepageRequest(state, { domain: "history", generation: t.generation, scopeKey: t.scopeKey, ok: true, historyRange: t.target }).state;
    state = s.updateHomepageUi(state, {
      historyChartMode: "win-rate",
      holdings: { query: "微软", sort: "market-value-desc", page: 3 },
      contribution: { mode: "history", current: { category: "short", sort: "loss-asc", page: 2, market: "us", symbol: "NASDAQ:MSFT", drilldown: "symbols", openOnly: true }, history: { category: "ipo", sort: "profit-desc", page: 4, market: "hk", symbol: null, drilldown: "symbols" } },
      search: { query: "msft", open: true, resultsScrollTop: 185, selectedSymbol: "NASDAQ:MSFT", triggerFocusId: "home-search" },
      returnState: { source: "home", container: "holdings", detailId: "account:episode:MSFT", triggerFocusId: "holding:account:episode", missingContainerTitle: "当前持仓（最新）" },
      scrollTop: 720,
    });
    const dirty = structuredClone(state.snapshot) as any;
    dirty.businessRows = [{ price: "999" }];
    for (const target of [dirty.scope, dirty.attachments, dirty.holdings, dirty.history, dirty.history.range, dirty.contribution, dirty.contribution.current, dirty.contribution.history, dirty.search, dirty.returnState]) target.businessRows = [{ price: "999" }];
    const serialized = s.encodeHomepageSnapshot(dirty);
    expect(serialized).not.toContain("businessRows");
    expect(serialized).not.toContain("999");
    expect(s.decodeHomepageSnapshot(serialized)).toEqual(state.snapshot);
    expect(s.restoreHomepageFocus(state.snapshot, false)).toEqual({ focus: "title", triggerFocusId: null, fallbackTitle: "当前持仓（最新）" });
  });

  it("failure, timeout and cancel all reject the same late success", () => {
    for (const terminal of ["failure", "timeout", "cancel"]) {
      const pending = s.beginHomepageApply(initial(), { ...initial().draft, market: "us" }, 0);
      const token = pending.requests.global!;
      const ended = terminal === "failure" ? s.completeHomepageRequest(pending, { ...token, ok: false, error: "network" }).state
        : terminal === "timeout" ? s.markHomepageRequestTimedOut(pending, 15000) : s.cancelHomepageDraft(pending);
      const late = s.completeHomepageRequest(ended, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
      expect(late.accepted, terminal).toBe(false);
      expect(late.state.snapshot.scope.market, terminal).toBe("all");
      const retry = s.retryHomepageApply(ended, 16000);
      expect(retry.requests.global!.generation).toBeGreaterThan(token.generation);
    }
  });

  it("independent period/history completions each preserve the other committed domain", () => {
    let state = s.beginHomepagePeriodApply(initial(), { preset: "month", from: "2026-01-01", to: "2026-01-23" });
    state = s.beginHomepageHistoryApply(state, { mode: "year", year: 2025 });
    const p = state.requests.period!, h = state.requests.history!;
    state = s.completeHomepageRequest(state, { domain: "period", generation: p.generation, scopeKey: p.scopeKey, ok: true, period: p.target }).state;
    expect(state.requests.history).not.toBeNull();
    state = s.completeHomepageRequest(state, { domain: "history", generation: h.generation, scopeKey: h.scopeKey, ok: true, historyRange: h.target }).state;
    expect(state.snapshot.period).toEqual(p.target);
    expect(state.snapshot.history.range).toEqual(h.target);
  });

  it("global identity success invalidates an older local result", () => {
    let state = s.beginHomepagePeriodApply(initial(), { preset: "month", from: "2026-01-01", to: "2026-01-23" });
    const p = state.requests.period!;
    state = s.beginHomepageApply(state, { ...state.draft, market: "hk" });
    state = succeed(state).state;
    const late = s.completeHomepageRequest(state, { domain: "period", generation: p.generation, scopeKey: p.scopeKey, ok: true, period: p.target });
    expect(late.accepted).toBe(false);
    expect(late.state.snapshot.scope.market).toBe("hk");
    expect(late.state.snapshot.period.preset).toBe("all");
  });

  it("scope keys are semantic and invalid persisted UI is explicit", () => {
    expect(s.homepageScopeKey({ ...scope, accounts: ["b", "a"] })).toBe(s.homepageScopeKey({ to: scope.to, from: scope.from, rangeMode: "custom", accounts: ["a", "b", "a"], market: "all", live: true }));
    expect(s.readHomepageSnapshot(JSON.stringify({ ...initial().snapshot, version: 1 }))).toMatchObject({ ok: false, error: "unsupported-version" });
    expect(s.decodeHomepageSnapshot(JSON.stringify({ ...initial().snapshot, scrollTop: -1 }))).toBeNull();
    expect(s.decodeHomepageSnapshot(JSON.stringify({ ...initial().snapshot, history: { range: { mode: "years", fromYear: 2026, toYear: 2025 }, chartMode: "win-rate" } }))).toBeNull();
  });

  it("valid wildcard and exact symbol work with catalogs, malformed URLs never widen", () => {
    const options = { allowedAccounts: ["broker-a"], allowedSymbols: ["NASDAQ:MSFT"] };
    const valid = s.serializeHomepageNavigation({ live: true, market: "us", accounts: ["*"], rangeMode: "date", date: "2026-01-15", symbolIdentity: "NASDAQ:MSFT" });
    expect(s.parseHomepageNavigation(valid, options)).toMatchObject({ ok: true, scope: { accounts: ["*"], symbolIdentity: "NASDAQ:MSFT" } });
    for (const query of ["accounts=unknown", "accounts=*,broker-a", "accounts=", "accounts=broker-a&accounts=broker-a", "accounts=broker-a&symbol=US:UNKNOWN", "accounts=broker-a&rangeMode=custom&from=2026-02-30&to=2026-03-01", "accounts=broker-a&queue=pending-review", "accounts=broker-a&date=2026-01-01&from=2026-01-01"]) {
      expect(s.parseHomepageNavigation(`/trades?scope=live&${query}`, options).ok, query).toBe(false);
    }
    expect(s.parseHomepageNavigation("/trades?scope=live&accounts=broker-a&market=bad", options)).toMatchObject({ ok: true, warning: "invalid-market", scope: { market: "all" } });
  });
});
