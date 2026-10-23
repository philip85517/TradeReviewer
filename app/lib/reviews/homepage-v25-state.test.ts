import { describe, expect, it } from "vitest";
import * as homepage from "./homepage-v25-state";
import {
  applyHomepageResult,
  beginHomepageApply,
  cancelHomepageDraft,
  clearHomepageAttachments,
  createHomepageState,
  decodeHomepageSnapshot,
  encodeHomepageSnapshot,
  parseHomepageNavigation,
  serializeHomepageNavigation,
  homepageRequestTimedOut,
  markHomepageRequestTimedOut,
  restoreHomepageFocus,
  ALL_ACCOUNTS,
  resetHomepageDefaults,
  retryHomepageApply,
  type HomepageScope,
} from "./homepage-v25-state";

const scope: HomepageScope = {
  live: true,
  market: "all",
  accounts: ["paper"],
  rangeMode: "custom",
  from: "2026-01-01",
  to: "2026-01-31",
};

describe("homepage v2.5 state contract", () => {
  it("applies a whole desired group only when generation and scope match", () => {
    const initial = createHomepageState(scope);
    const started = beginHomepageApply(initial, { ...initial.draft, market: "hk" });
    const stale = applyHomepageResult(started, {
      generation: started.request!.generation - 1,
      scopeKey: started.request!.scopeKey,
      ok: true,
      applied: { ...started.draft, market: "a" },
    });
    expect(stale.applied.market).toBe("all");
    const accepted = applyHomepageResult(started, {
      generation: started.request!.generation,
      scopeKey: started.request!.scopeKey,
      ok: true,
      applied: { ...started.draft, market: "hk" },
    });
    expect(accepted.applied.market).toBe("hk");
    expect(accepted.applied.accounts).toEqual(["paper"]);
    const mismatchedPayload = applyHomepageResult(started, {
      generation: started.request!.generation,
      scopeKey: started.request!.scopeKey,
      ok: true,
      applied: { ...started.draft, market: "us" },
    });
    expect(mismatchedPayload.applied.market).toBe("all");
  });

  it("keeps old applied scope and draft on failure, then retries with a new generation", () => {
    const started = beginHomepageApply(createHomepageState(scope), { ...createHomepageState(scope).draft, market: "us" });
    const failed = applyHomepageResult(started, {
      generation: started.request!.generation,
      scopeKey: started.request!.scopeKey,
      ok: false,
      error: "timeout",
    });
    expect(failed.applied.market).toBe("all");
    expect(failed.draft.market).toBe("us");
    expect(failed.error).toBe("timeout");
    const retried = retryHomepageApply(failed);
    expect(retried.request!.generation).toBe(started.request!.generation + 1);
    expect(retried.request!.scopeKey).toBe(started.request!.scopeKey);
  });

  it("distinguishes cancel, identity change, clear attachments and reset dates", () => {
    const initial = createHomepageState(scope);
    const edited = beginHomepageApply(initial, { ...initial.draft, market: "us", accounts: ["broker"] });
    expect(cancelHomepageDraft(edited).draft.market).toBe("us");
    expect(cancelHomepageDraft(edited).draft.accounts).toEqual(["broker"]);
    const changed = createHomepageState({ ...scope, market: "hk", accounts: ["hk-account"] }, edited);
    expect(changed.draft.market).toBe("hk");
    expect(changed.draft.accounts).toEqual(["hk-account"]);
    expect(clearHomepageAttachments({ ...initial, draft: { ...initial.draft, attachments: { categories: ["stock"], openOnly: true, pendingReview: [] } } }).draft.attachments).toEqual({ categories: [], openOnly: false, pendingReview: [] });
    const reset = resetHomepageDefaults({ ...initial, draft: { ...initial.draft, market: "us", attachments: { categories: ["stock"], openOnly: true, pendingReview: [] } } });
    expect(reset.draft.market).toBe("all");
    expect(reset.draft.from).toBe(scope.from);
    expect(reset.draft.to).toBe(scope.to);
  });

  it("keeps request numbers monotonic across success, cancel and identity changes", () => {
    const first = beginHomepageApply(createHomepageState(scope), { ...createHomepageState(scope).draft, market: "hk" });
    const applied = applyHomepageResult(first, { generation: 1, scopeKey: first.request!.scopeKey, ok: true, applied: first.request!.target });
    const second = beginHomepageApply(applied, applied.draft);
    expect(second.request!.generation).toBe(2);
    const cancelled = cancelHomepageDraft(second);
    const changed = beginHomepageApply(cancelled, { ...cancelled.draft, market: "us" });
    expect(changed.request!.generation).toBe(4);
  });

  it("round trips only the versioned UI snapshot and recovers malformed input", () => {
    const state = createHomepageState(scope);
    const snapshot = { ...state.snapshot, holdings: { ...state.snapshot.holdings, query: "AAPL", page: 2 }, focus: "holdings" as const };
    expect(decodeHomepageSnapshot(encodeHomepageSnapshot(snapshot))).toEqual(snapshot);
    expect(decodeHomepageSnapshot('{"version":999}')).toBeNull();
    expect(decodeHomepageSnapshot('{"version":1,"scope":{}}')).toBeNull();
    const withUnknown = JSON.parse(encodeHomepageSnapshot(snapshot)) as Record<string, unknown>;
    withUnknown.businessRows = [{ id: "secret" }];
    expect(decodeHomepageSnapshot(JSON.stringify(withUnknown))).toBeNull();
    const scopeWithUnknown = { ...snapshot, scope: { ...snapshot.scope, businessRows: [{ id: "secret" }] } } as unknown as typeof snapshot;
    expect(encodeHomepageSnapshot(scopeWithUnknown)).not.toContain("businessRows");
    expect(restoreHomepageFocus({ ...snapshot, returnState: { ...snapshot.returnState, missingContainerTitle: "Holdings" }, focus: "holdings" }, false)).toEqual({ focus: "title", triggerFocusId: null, fallbackTitle: "Holdings" });
  });

  it("parses explicit navigation without silently broadening invalid accounts or symbols", () => {
    const parsed = parseHomepageNavigation("/trades?scope=live&market=us&accounts=broker&rangeMode=custom&from=2026-01-01&to=2026-01-31&symbol=NASDAQ:AAPL:stock");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.scope).toMatchObject({ live: true, accounts: ["broker"], symbolIdentity: "NASDAQ:AAPL:stock" });
    const emptyAccounts = parseHomepageNavigation("/home?scope=live&accounts=");
    expect(emptyAccounts.ok).toBe(false);
    const invalid = parseHomepageNavigation("/trades?scope=sim&accounts=unknown");
    expect(invalid.ok).toBe(false);
    expect(parseHomepageNavigation("/trades?scope=live&accounts=unknown", { allowedAccounts: ["broker"] }).ok).toBe(false);
    if (!parsed.ok) throw new Error("expected valid URL");
    expect(parsed.query).not.toContain("queue");
    expect(serializeHomepageNavigation(scope, "/trades")).toBe("/trades?scope=live&market=all&accounts=paper&rangeMode=custom&from=2026-01-01&to=2026-01-31");
    expect(parseHomepageNavigation("/trades?scope=live&accounts=paper&date=2026-02-03").ok).toBe(true);
    expect(parseHomepageNavigation("/trades?scope=live&accounts=paper&rangeMode=custom&from=2026-02-31&to=2026-03-01").ok).toBe(false);
    expect(parseHomepageNavigation("/trades?scope=live&accounts=paper&rangeMode=custom&from=2026-03-01&to=2026-02-01").ok).toBe(false);
    const badMarket = parseHomepageNavigation("/trades?scope=live&accounts=paper&market=bad");
    expect(badMarket).toMatchObject({ ok: true, warning: "invalid-market" });
    const all = { ...scope, accounts: [ALL_ACCOUNTS], rangeMode: "all" as const, from: undefined, to: undefined };
    expect(parseHomepageNavigation(serializeHomepageNavigation(all)).ok).toBe(true);
    expect(parseHomepageNavigation("/trades?scope=live&accounts=*&rangeMode=custom&from=2026-01-01&to=2026-01-02&date=2026-01-01").ok).toBe(false);
  });

  it("turns a request into manual recovery after fifteen seconds", () => {
    const started = beginHomepageApply(createHomepageState(scope), createHomepageState(scope).draft, 1000);
    expect(homepageRequestTimedOut(started, 15999)).toBe(false);
    expect(homepageRequestTimedOut(started, 16000)).toBe(true);
    const timedOut = markHomepageRequestTimedOut(started, 16000);
    expect(applyHomepageResult(timedOut, { generation: 1, scopeKey: started.request!.scopeKey, ok: true, applied: started.request!.target }).applied.market).toBe("all");
  });
});

// Each test exercises a public transition/codec chain. Expected values below are
// hand-written: using the normalizer to build expectations would hide drift.
const allScope: HomepageScope = { live: true, market: "all", accounts: ["*"], rangeMode: "all" };
const customPeriod = { preset: "custom" as const, from: "2026-02-02", to: "2026-02-06" };
const years = { mode: "years" as const, fromYear: 2024, toYear: 2026 };
const success = (state: ReturnType<typeof createHomepageState>) => applyHomepageResult(state, {
  generation: state.request!.generation, scopeKey: state.request!.scopeKey, ok: true, applied: state.request!.target,
});

describe("homepage v2.5 canonical state and restoration", () => {
  it("restores the applied filters after the complete apply/capture/codec chain", () => {
    const initial = createHomepageState(allScope);
    const waiting = beginHomepageApply(initial, {
      ...initial.draft, market: "hk", accounts: ["broker-hk"],
      attachments: { categories: ["stock", "etf"], openOnly: true, pendingReview: [true] },
    });
    expect(waiting.snapshot.scope.market).toBe("all");
    const applied = success(waiting);
    expect(applied.snapshot.scope).toEqual({ live: true, market: "hk", accounts: ["broker-hk"], rangeMode: "all" });
    expect(applied.snapshot.attachments).toEqual({ categories: ["etf", "stock"], openOnly: true, pendingReview: [true] });
    expect(decodeHomepageSnapshot(JSON.stringify(applied.snapshot))).not.toBeNull();
    const restored = homepage.restoreHomepageState(encodeHomepageSnapshot(applied.snapshot));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error("restoration rejected valid committed UI");
    expect(restored.state.applied).toMatchObject({ market: "hk", attachments: { categories: ["etf", "stock"], openOnly: true, pendingReview: [true] } });
    expect(restored.state.requests).toEqual({ global: null, period: null, history: null });
  });

  it.each(["holdings", "period", "contribution", "history", "attachments", "search", "returnState", "scope"] as const)("removes nested business objects from %s before persistence", field => {
    const snapshot = createHomepageState(allScope).snapshot;
    const contaminated = { ...snapshot, [field]: { ...snapshot[field], businessRows: [{ marker: "do-not-persist" }] } };
    const encoded = encodeHomepageSnapshot(contaminated);
    expect(encoded).not.toContain("businessRows");
    expect(encoded).not.toContain("do-not-persist");
    expect(decodeHomepageSnapshot(encoded)).not.toBeNull();
  });

  it("projects contribution descendants instead of spreading mode objects", () => {
    const snapshot = createHomepageState(allScope).snapshot;
    const polluted = { ...snapshot, contribution: { ...snapshot.contribution,
      current: { ...snapshot.contribution.current, businessRows: [{ marker: "nested-secret" }] },
      history: { ...snapshot.contribution.history, businessRows: [{ marker: "nested-secret" }] },
    } };
    const encoded = encodeHomepageSnapshot(polluted);
    expect(encoded).not.toContain("nested-secret");
    expect(decodeHomepageSnapshot(encoded)).not.toBeNull();
  });

  it.each(["period-pnl", "cumulative-pnl", "win-rate", "round-count"] as const)("restores history %s without changing current period", chartMode => {
    for (const range of [{ mode: "all" }, { mode: "year", year: 2024 }, { mode: "this-year", year: 2026 }, years] as const) {
      let state = createHomepageState(allScope);
      state = homepage.updateHomepageUi(state, { historyChartMode: chartMode });
      state = homepage.beginHomepageHistoryApply(state, range, 10);
      const token = state.requests.history!;
      state = homepage.completeHomepageRequest(state, { domain: "history", generation: token.generation, scopeKey: token.scopeKey, ok: true, historyRange: range }).state;
      const restored = decodeHomepageSnapshot(encodeHomepageSnapshot(state.snapshot));
      expect(restored?.history).toEqual({ range, chartMode });
      expect(restored?.period).toEqual({ preset: "all", from: null, to: null });
    }
  });

  it.each([
    { mode: "all" as const }, { mode: "year" as const, year: 2024 },
    { mode: "this-year" as const, year: 2026 }, { mode: "years" as const, fromYear: 2023, toYear: 2026 },
  ])("preserves history range selector semantics: $mode", range => {
    const snapshot = createHomepageState(allScope).snapshot;
    expect(decodeHomepageSnapshot(encodeHomepageSnapshot({ ...snapshot, history: { ...snapshot.history, range } }))?.history.range).toEqual(range);
  });

  it("keeps current and history contribution paths and local open-only independent", () => {
    let state = createHomepageState(allScope);
    const contribution = {
      mode: "history" as const,
      current: { category: "short" as const, sort: "loss-asc" as const, page: 3, market: "a" as const, symbol: "SSE:600519:stock", drilldown: "symbols" as const, openOnly: true },
      history: { category: "ipo" as const, sort: "profit-desc" as const, page: 7, market: "hk" as const, symbol: "HKEX:00700:stock", drilldown: "symbols" as const },
    };
    state = homepage.updateHomepageUi(state, { contribution });
    const restored = decodeHomepageSnapshot(encodeHomepageSnapshot(state.snapshot));
    expect(restored?.contribution).toEqual(contribution);
    expect(restored?.attachments.openOnly).toBe(false);
    expect(restored?.scope.market).toBe("all");
    expect(restored?.contribution).not.toHaveProperty("selectedMarket");
    state = homepage.updateHomepageUi(state, { contribution: { ...state.snapshot.contribution, mode: "current" } });
    expect(state.snapshot.contribution.current.openOnly).toBe(true);
  });

  it("restores the exact source trigger, or just its container title if the object disappeared", () => {
    const state = homepage.updateHomepageUi(createHomepageState(allScope), {
      holdings: { query: "600519", sort: "name", page: 2 }, focus: "holdings", scrollTop: 880,
      returnState: { source: "detail", container: "holdings", detailId: "SSE:600519:stock", triggerFocusId: "holding-SSE-600519", missingContainerTitle: "当前持仓" },
      search: { query: "贵州", open: true, resultsScrollTop: 90, selectedSymbol: "SSE:600519:stock", triggerFocusId: "header-search" },
    });
    const restored = decodeHomepageSnapshot(encodeHomepageSnapshot(state.snapshot))!;
    expect(restoreHomepageFocus(restored, true)).toEqual({ focus: "holdings", triggerFocusId: "holding-SSE-600519", fallbackTitle: null });
    expect(restoreHomepageFocus(restored, false)).toEqual({ focus: "title", triggerFocusId: null, fallbackTitle: "当前持仓" });
    expect(restored.holdings).toEqual({ query: "600519", sort: "name", page: 2 });
    expect(restored.search).toEqual({ query: "贵州", open: true, resultsScrollTop: 90, selectedSymbol: "SSE:600519:stock", triggerFocusId: "header-search" });
    expect(restored.scrollTop).toBe(880);
  });

  it("never restores a missing object's trigger or a search trigger from another container", () => {
    const state = homepage.updateHomepageUi(createHomepageState(allScope), {
      focus: "holdings",
      returnState: { source: "detail", container: "holdings", detailId: "SSE:600519:stock", triggerFocusId: null, missingContainerTitle: null },
      search: { query: "苹果", open: false, resultsScrollTop: 9, selectedSymbol: "NASDAQ:AAPL:stock", triggerFocusId: "header-search" },
    });
    expect(restoreHomepageFocus(state.snapshot, true)).toEqual({ focus: "holdings", triggerFocusId: null, fallbackTitle: null });
    expect(restoreHomepageFocus(state.snapshot, false)).toEqual({ focus: "title", triggerFocusId: null, fallbackTitle: null });
  });

  it("rejects obsolete or incomplete snapshots explicitly instead of silently defaulting their conditions", () => {
    expect(homepage.restoreHomepageState('{"version":1}')).toEqual({ ok: false, error: "unsupported-version" });
    expect(homepage.restoreHomepageState("{")).toEqual({ ok: false, error: "invalid-json" });
    const incomplete = JSON.parse(encodeHomepageSnapshot(createHomepageState(allScope).snapshot));
    delete incomplete.contribution.current.openOnly;
    expect(homepage.restoreHomepageState(JSON.stringify(incomplete))).toEqual({ ok: false, error: "invalid-snapshot" });
  });

  it("restores into a live owner without reusing its outstanding request generation", () => {
    const waiting = beginHomepageApply(createHomepageState(allScope), { ...createHomepageState(allScope).draft, market: "us" }, 0);
    const old = waiting.request!;
    const restored = homepage.restoreHomepageState(encodeHomepageSnapshot(waiting.snapshot), waiting);
    if (!restored.ok) throw new Error("valid snapshot rejected");
    expect(restored.state.request).toBeNull();
    const retry = beginHomepageApply(restored.state, old.target, 1);
    expect(retry.request!.generation).toBeGreaterThan(old.generation);
    expect(homepage.completeHomepageRequest(retry, { generation: old.generation, scopeKey: old.scopeKey, ok: true, applied: old.target }).accepted).toBe(false);
  });

  it.each([
    { history: { range: { mode: "years", fromYear: 2026, toYear: 2024 }, chartMode: "period-pnl" } },
    { history: { range: { mode: "year", year: 2026 }, chartMode: "invented" } },
    { period: { preset: "custom", from: "2026-02-31", to: "2026-03-01" } },
    { period: { preset: "all", from: "2026-01-01", to: "2026-02-01" } },
    { scrollTop: -1 },
  ])("rejects malformed UI values rather than producing a default view: %j", patch => {
    const value = { ...createHomepageState(allScope).snapshot, ...patch };
    expect(decodeHomepageSnapshot(JSON.stringify(value))).toBeNull();
  });
});

describe("homepage independent request domains", () => {
  it("edits date drafts without applying them and cancels only the selected draft domain", () => {
    let state = createHomepageState(allScope);
    state = homepage.editHomepagePeriodDraft(state, customPeriod);
    state = homepage.editHomepageHistoryDraft(state, years);
    expect(state.snapshot.period).toEqual({ preset: "all", from: null, to: null });
    expect(state.snapshot.history.range).toEqual({ mode: "all" });
    state = homepage.cancelHomepageRequest(state, "period");
    expect(state.periodDraft).toEqual({ preset: "all", from: null, to: null });
    expect(state.historyDraft).toEqual(years);
    state = homepage.cancelHomepageRequest(state, "history");
    expect(state.historyDraft).toEqual({ mode: "all" });
  });

  it("retains the latest local date draft on failure, then commits only a fresh retry", () => {
    let state = homepage.beginHomepagePeriodApply(createHomepageState(allScope), customPeriod, 0);
    const first = state.requests.period!;
    state = homepage.completeHomepageRequest(state, { domain: "period", generation: first.generation, scopeKey: first.scopeKey, ok: false, error: "network" }).state;
    expect(state.snapshot.period).toEqual({ preset: "all", from: null, to: null });
    expect(state.periodDraft).toEqual(customPeriod);
    expect(state.requests.period).toBeNull();
    state = homepage.retryHomepageRequest(state, "period", 1);
    const retry = state.requests.period!;
    expect(retry.generation).toBeGreaterThan(first.generation);
    expect(homepage.completeHomepageRequest(state, { domain: "period", generation: first.generation, scopeKey: first.scopeKey, ok: true, period: customPeriod }).accepted).toBe(false);
    expect(homepage.completeHomepageRequest(state, { domain: "period", generation: retry.generation, scopeKey: retry.scopeKey, ok: true, period: customPeriod }).state.snapshot.period).toEqual(customPeriod);
  });

  it("rejects a wrong same-token target and preserves newer unsubmitted filter edits", () => {
    let state = beginHomepageApply(createHomepageState(allScope), { ...createHomepageState(allScope).draft, market: "us" }, 0);
    const first = state.request!;
    const rejected = applyHomepageResult(state, { generation: first.generation, scopeKey: first.scopeKey, ok: true, applied: { ...first.target, attachments: { categories: [], openOnly: true, pendingReview: [] } } });
    expect(rejected.request).toBeNull();
    expect(rejected.applied.market).toBe("all");
    state = homepage.editHomepageDraft(state, { ...state.draft, market: "hk" });
    state = success(state);
    expect(state.applied.market).toBe("us");
    expect(state.draft.market).toBe("hk");
  });

  it("matches semantic scope and set values irrespective of property insertion order", () => {
    const state = createHomepageState({ ...allScope, accounts: ["b", "a"] });
    const waiting = beginHomepageApply(state, { ...state.draft, attachments: { categories: ["stock", "etf"], openOnly: true, pendingReview: [] } });
    const result = applyHomepageResult(waiting, { generation: waiting.request!.generation, scopeKey: waiting.request!.scopeKey, ok: true,
      applied: { attachments: { pendingReview: [], openOnly: true, categories: ["etf", "stock"] }, rangeMode: "all", accounts: ["a", "b"], market: "all", live: true },
    });
    expect(result.request).toBeNull();
    expect(result.error).toBeNull();
    expect(result.applied.attachments.openOnly).toBe(true);
  });

  it("makes failure terminal until an explicit retry, even if a same-generation success arrives", () => {
    const waiting = beginHomepageApply(createHomepageState(allScope), { ...createHomepageState(allScope).draft, market: "us" });
    const token = waiting.request!;
    const failed = applyHomepageResult(waiting, { generation: token.generation, scopeKey: token.scopeKey, ok: false, error: "network-error" });
    expect(failed.request).toBeNull();
    const late = applyHomepageResult(failed, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
    expect(late.applied.market).toBe("all");
    const retry = retryHomepageApply(failed);
    expect(retry.request!.generation).toBeGreaterThan(token.generation);
    expect(success(retry).applied.market).toBe("us");
  });

  it("ignores a cancelled or timed-out token even after the next request begins", () => {
    const waiting = beginHomepageApply(createHomepageState(allScope), { ...createHomepageState(allScope).draft, market: "us" }, 0);
    const token = waiting.request!;
    for (const terminal of [cancelHomepageDraft(waiting), markHomepageRequestTimedOut(waiting, 15000)]) {
      const retry = retryHomepageApply(terminal, 16000);
      const late = applyHomepageResult(retry, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target });
      expect(late.applied.market).toBe("all");
      expect(late.request!.generation).toBeGreaterThan(token.generation);
    }
  });

  it("commits period and history independently in either response order without resetting browse state", () => {
    for (const first of ["period", "history"] as const) {
      let state = homepage.updateHomepageUi(createHomepageState(allScope), { holdings: { query: "AAPL", sort: "name", page: 2 }, historyChartMode: "win-rate" });
      state = homepage.beginHomepagePeriodApply(state, customPeriod, 0);
      state = homepage.beginHomepageHistoryApply(state, years, 1);
      const period = state.requests.period!;
      const history = state.requests.history!;
      expect(period.generation).not.toBe(history.generation);
      const results = {
        period: { domain: "period" as const, generation: period.generation, scopeKey: period.scopeKey, ok: true, period: customPeriod },
        history: { domain: "history" as const, generation: history.generation, scopeKey: history.scopeKey, ok: true, historyRange: years },
      };
      for (const domain of first === "period" ? ["period", "history"] as const : ["history", "period"] as const) {
        const completion = homepage.completeHomepageRequest(state, results[domain]);
        expect(completion.accepted).toBe(true);
        state = completion.state;
      }
      expect(state.snapshot.period).toEqual(customPeriod);
      expect(state.snapshot.history).toEqual({ range: years, chartMode: "win-rate" });
      expect(state.snapshot.holdings).toEqual({ query: "AAPL", sort: "name", page: 2 });
      expect(state.snapshot.contribution.mode).toBe("current");
    }
  });

  it("invalidates dependent period/history tokens after global identity commits", () => {
    let state = createHomepageState(allScope);
    state = homepage.beginHomepagePeriodApply(state, customPeriod, 0);
    state = homepage.beginHomepageHistoryApply(state, years, 1);
    const period = state.requests.period!;
    const history = state.requests.history!;
    state = beginHomepageApply(state, { ...state.draft, market: "hk", accounts: ["broker-hk"] }, 2);
    state = success(state);
    expect(state.snapshot.scope.market).toBe("hk");
    expect(homepage.completeHomepageRequest(state, { domain: "period", generation: period.generation, scopeKey: period.scopeKey, ok: true, period: customPeriod }).accepted).toBe(false);
    expect(homepage.completeHomepageRequest(state, { domain: "history", generation: history.generation, scopeKey: history.scopeKey, ok: true, historyRange: years }).accepted).toBe(false);
    expect(state.snapshot.period).toEqual({ preset: "all", from: null, to: null });
  });

  it("does not accept a global response whose period dependency changed during its load", () => {
    let state = createHomepageState(allScope);
    state = beginHomepageApply(state, { ...state.draft, market: "us" }, 0);
    const global = state.request!;
    state = homepage.beginHomepagePeriodApply(state, customPeriod, 1);
    const period = state.requests.period!;
    state = homepage.completeHomepageRequest(state, { domain: "period", generation: period.generation, scopeKey: period.scopeKey, ok: true, period: customPeriod }).state;
    const completion = homepage.completeHomepageRequest(state, { generation: global.generation, scopeKey: global.scopeKey, ok: true, applied: global.target });
    expect(completion.accepted).toBe(false);
    expect(completion.state.snapshot.scope.market).toBe("all");
    expect(completion.state.snapshot.period).toEqual(customPeriod);
  });

  it("keeps edited filters on close, discards old identity drafts, and preserves dates on clear/reset", () => {
    const initial = createHomepageState(scope);
    const edited = homepage.editHomepageDraft(initial, { ...initial.draft, attachments: { categories: ["stock"], openOnly: true, pendingReview: [true] } });
    const closed = cancelHomepageDraft(edited);
    expect(closed.draft.attachments.openOnly).toBe(true);
    expect(closed.applied.attachments.openOnly).toBe(false);
    const identity = homepage.changeHomepageIdentity(closed, { ...scope, market: "hk", accounts: ["hk"] });
    expect(identity.draft.attachments).toEqual({ categories: [], openOnly: false, pendingReview: [] });
    expect(identity.applied.market).toBe("all");
    const cleared = clearHomepageAttachments(edited);
    expect(cleared.draft.from).toBe("2026-01-01");
    expect(cleared.draft.accounts).toEqual(["paper"]);
    const reset = resetHomepageDefaults(edited);
    expect(reset.draft).toMatchObject({ market: "all", accounts: ["*"], from: "2026-01-01", to: "2026-01-31" });
    expect(reset.snapshot.scope.accounts).toEqual(["paper"]);
  });
});

describe("homepage URL target boundary", () => {
  it("accepts an applied structural subtype without putting attachments into the target URL", () => {
    const state = createHomepageState(allScope);
    const url = serializeHomepageNavigation(state.applied);
    expect(url).not.toContain("attachments");
    expect(parseHomepageNavigation(url, { allowedAccounts: ["real-account"] })).toMatchObject({ ok: true, scope: allScope });
  });

  it("round trips all accounts against a real account catalog without requiring a fake account", () => {
    const parsed = parseHomepageNavigation(serializeHomepageNavigation(allScope), { allowedAccounts: ["real-account"] });
    expect(parsed).toMatchObject({ ok: true, scope: { accounts: ["*"], rangeMode: "all" } });
    expect(parseHomepageNavigation(serializeHomepageNavigation(allScope), { allowedAccounts: [] }).ok).toBe(true);
  });

  it.each(["", ",", "real-account,", ",real-account", "*,real-account", "unknown", "real-account,,other"])("rejects explicit malformed or unknown accounts: %s", accounts => {
    expect(parseHomepageNavigation(`/trades?scope=live&accounts=${encodeURIComponent(accounts)}`, { allowedAccounts: ["real-account", "other"] }).ok).toBe(false);
  });

  it.each(["NASDAQ:AAPL:stock:extra", "NASDAQ:", ":AAPL", "NASDAQ: AAPL:stock", "NASDAQ:AAPL:stock%00"])("rejects invalid symbol identity: %s", symbol => {
    expect(parseHomepageNavigation(`/trades?scope=live&accounts=real-account&symbol=${symbol}`).ok).toBe(false);
  });

  it("keeps target URL independent from a conflicting source snapshot", () => {
    const source = createHomepageState({ ...allScope, market: "hk", accounts: ["hk"] }).snapshot;
    const target = parseHomepageNavigation("/trades?scope=live&market=us&accounts=us&date=2026-10-21&symbol=NASDAQ:AAPL:stock", { allowedAccounts: ["hk", "us"], allowedSymbols: ["NASDAQ:AAPL:stock"] });
    expect(target).toMatchObject({ ok: true, scope: { market: "us", accounts: ["us"], rangeMode: "date", date: "2026-10-21", symbolIdentity: "NASDAQ:AAPL:stock" } });
    expect(source.scope).toMatchObject({ market: "hk", accounts: ["hk"] });
    expect(target.query).not.toContain("queue");
  });

  it.each([
    "scope=live&accounts=*&rangeMode=all&date=2026-02-01",
    "scope=live&accounts=*&rangeMode=date&date=2026-02-31",
    "scope=live&accounts=*&rangeMode=custom&from=2026-03-01&to=2026-02-01",
    "scope=live&accounts=*&date=",
    "scope=live&accounts=*&symbol=",
    "scope=live&accounts=*&queue=",
    "scope=live&accounts=*&accounts=real-account",
  ])("does not broaden invalid or ambiguous URL input: %s", query => {
    expect(parseHomepageNavigation(`/trades?${query}`).ok).toBe(false);
  });
});

describe("S recovery round2 v3 attachments", () => {
  // Catches loss of an explicit No selection or collapsing a deliberate dual
  // selection to the same UI as no selection. No business facts enter here.
  it.each([
    { choice: [], want: [] }, { choice: [true], want: [true] },
    { choice: [false], want: [false] }, { choice: [true, false, true], want: [false, true] },
  ])("preserves pending review choices through apply and UI-only restore: $choice", ({ choice, want }) => {
    let state = createHomepageState(allScope);
    state = beginHomepageApply(state, { ...state.draft, attachments: { categories: ["etf"], openOnly: true, pendingReview: choice } });
    state = success(state);
    const restored = homepage.restoreHomepageState(encodeHomepageSnapshot(state.snapshot));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error("valid v3 rejected");
    expect(restored.state.snapshot.version).toBe(3);
    expect(restored.state.applied.attachments).toEqual({ categories: ["etf"], openOnly: true, pendingReview: want });
    expect(restored.state.snapshot.contribution.current.openOnly).toBe(false);
    expect(restored.state.requests).toEqual({ global: null, period: null, history: null });
  });

  it.each([{ old: true, want: [true] }, { old: false, want: [] }])("migrates genuine v2 pending=$old without turning unrestricted into No", ({ old, want }) => {
    const legacy = { ...createHomepageState(allScope).snapshot, version: 2,
      attachments: { categories: ["stock"], openOnly: true, pendingReview: old },
      holdings: { query: "贵州", sort: "name", page: 4 },
      history: { range: { mode: "year", year: 2024 }, chartMode: "round-count" },
    };
    const restored = homepage.restoreHomepageState(JSON.stringify(legacy));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error("complete v2 rejected");
    expect(restored.state.snapshot.version).toBe(3);
    expect(restored.state.applied.attachments.pendingReview).toEqual(want);
    expect(restored.state.snapshot.holdings).toEqual({ query: "贵州", sort: "name", page: 4 });
    expect(restored.state.snapshot.history).toEqual({ range: { mode: "year", year: 2024 }, chartMode: "round-count" });
    expect(JSON.parse(encodeHomepageSnapshot(restored.state.snapshot)).version).toBe(3);
  });

  it.each([true, false, ["false"], [null], [0]])("rejects non-array or invalid v3 choices rather than broadening: %j", pendingReview => {
    const snapshot = { ...createHomepageState(allScope).snapshot, version: 3,
      attachments: { categories: [], openOnly: false, pendingReview } };
    expect(homepage.readHomepageSnapshot(JSON.stringify(snapshot))).toEqual({ ok: false, error: "invalid-snapshot" });
  });

  it.each(["nested-business", "missing-field", "wrong-choice-type"])("strictly validates v2 before migration: %s", bad => {
    const legacy = { ...createHomepageState(allScope).snapshot, version: 2,
      attachments: { categories: [], openOnly: false, pendingReview: false } };
    const value = JSON.parse(JSON.stringify(legacy));
    if (bad === "nested-business") value.attachments.businessRows = [{ id: "secret" }];
    if (bad === "missing-field") delete value.contribution.history.page;
    if (bad === "wrong-choice-type") value.attachments.pendingReview = [true];
    expect(homepage.readHomepageSnapshot(JSON.stringify(value))).toEqual({ ok: false, error: "invalid-snapshot" });
  });

  it("uses choice set semantics in request keys without merging No, both and unrestricted", () => {
    const state = createHomepageState(allScope);
    const key = (pendingReview: boolean[]) => beginHomepageApply(state, { ...state.draft,
      attachments: { categories: [], openOnly: false, pendingReview } }).request!.scopeKey;
    expect(key([true, false, true])).toBe(key([false, true]));
    expect(key([false])).not.toBe(key([]));
    expect(key([false, true])).not.toBe(key([]));
  });

  it("strips injected business descendants but preserves the exact legitimate v3 choice", () => {
    const snapshot = createHomepageState(allScope).snapshot;
    const value = { ...snapshot, attachments: { categories: ["stock"], openOnly: false,
      pendingReview: [false], businessRows: [{ id: "secret" }] } };
    const bytes = encodeHomepageSnapshot(value);
    expect(bytes).not.toContain("secret");
    expect(decodeHomepageSnapshot(bytes)?.attachments.pendingReview).toEqual([false]);
    expect(decodeHomepageSnapshot(JSON.stringify(value))).toBeNull();
  });
});

describe("S recovery round2 period authority", () => {
  it.each([
    { scope: { ...allScope, rangeMode: "date" as const, date: "2026-09-18" }, want: { preset: "custom", from: "2026-09-18", to: "2026-09-18" } },
    { scope: { ...allScope, rangeMode: "custom" as const, from: "2026-09-01", to: "2026-09-30" }, want: { preset: "custom", from: "2026-09-01", to: "2026-09-30" } },
  ])("initializes native $scope.rangeMode URL and round trips its applied period", ({ scope: nativeScope, want }) => {
    const parsed = parseHomepageNavigation(serializeHomepageNavigation(nativeScope));
    if (!parsed.ok) throw new Error("valid address rejected");
    const state = createHomepageState(parsed.scope);
    expect(state.snapshot.period).toEqual(want);
    expect(state.periodDraft).toEqual(want);
    expect(decodeHomepageSnapshot(encodeHomepageSnapshot(state.snapshot))?.period).toEqual(want);
  });

  it("clears native date fields only after a successful explicit All and preserves unrelated UI/draft", () => {
    let state = createHomepageState({ ...allScope, market: "hk", accounts: ["hk"], rangeMode: "date", date: "2026-09-18" });
    state = homepage.editHomepageDraft(state, { ...state.draft, attachments: { categories: ["etf"], openOnly: true, pendingReview: [false] } });
    state = homepage.updateHomepageUi(state, { historyChartMode: "round-count", holdings: { query: "腾讯", sort: "name", page: 3 } });
    state = homepage.beginHomepagePeriodApply(state, { preset: "all", from: null, to: null }, 0);
    const token = state.requests.period!;
    expect(state.snapshot.scope).toMatchObject({ rangeMode: "date", date: "2026-09-18" });
    const completion = homepage.completeHomepageRequest(state, { domain: "period", generation: token.generation, scopeKey: token.scopeKey, ok: true, period: token.target });
    expect(completion.accepted).toBe(true);
    state = completion.state;
    expect(state.snapshot.scope).toEqual({ live: true, market: "hk", accounts: ["hk"], rangeMode: "all" });
    expect(state.snapshot.period).toEqual({ preset: "all", from: null, to: null });
    expect(state.draft).toEqual({ live: true, market: "hk", accounts: ["hk"], rangeMode: "all",
      attachments: { categories: ["etf"], openOnly: true, pendingReview: [false] } });
    expect(state.snapshot.history.chartMode).toBe("round-count");
    expect(state.snapshot.holdings).toEqual({ query: "腾讯", sort: "name", page: 3 });
    const restored = homepage.restoreHomepageState(encodeHomepageSnapshot(state.snapshot));
    if (!restored.ok) throw new Error("valid cleared UI rejected");
    expect(serializeHomepageNavigation(restored.state.applied)).toBe("/trades?scope=live&market=hk&accounts=hk&rangeMode=all");
  });

  it("keeps native date and committed period on failed All, rejecting its late success", () => {
    const state = homepage.beginHomepagePeriodApply(createHomepageState(scope), { preset: "all", from: null, to: null }, 0);
    const token = state.requests.period!;
    const failed = homepage.completeHomepageRequest(state, { domain: "period", generation: token.generation, scopeKey: token.scopeKey, ok: false, error: "network" }).state;
    expect(failed.snapshot.period).toEqual({ preset: "custom", from: "2026-01-01", to: "2026-01-31" });
    expect(failed.snapshot.scope).toEqual(scope);
    expect(homepage.completeHomepageRequest(failed, { domain: "period", generation: token.generation, scopeKey: token.scopeKey, ok: true, period: token.target }).accepted).toBe(false);
  });

  it("projects the applied period to navigation without leaking attachments or unsubmitted dates", () => {
    let state = createHomepageState(scope);
    state = homepage.editHomepagePeriodDraft(state, customPeriod);
    const target = homepage.homepageNavigationScope(state.snapshot, "HKEX:00700:stock");
    expect(target).toEqual({ ...scope, symbolIdentity: "HKEX:00700:stock" });
    expect(serializeHomepageNavigation(target)).toBe("/trades?scope=live&market=all&accounts=paper&rangeMode=custom&from=2026-01-01&to=2026-01-31&symbol=HKEX%3A00700%3Astock");
    expect(target).not.toHaveProperty("attachments");
  });

  it("preserves period semantics during an attachment apply despite stale compatibility fields", () => {
    const state = createHomepageState(scope);
    const waiting = beginHomepageApply(state, { ...allScope, accounts: ["paper"],
      attachments: { categories: [], openOnly: true, pendingReview: [false] } });
    expect(waiting.request!.target).toMatchObject({ rangeMode: "custom", from: "2026-01-01", to: "2026-01-31" });
    const applied = success(waiting);
    expect(applied.snapshot.scope).toEqual(scope);
    expect(applied.snapshot.period).toEqual({ preset: "custom", from: "2026-01-01", to: "2026-01-31" });
  });

  it("migrates v2 native ranges into period and preserves already applied non-All period precedence", () => {
    const legacy = { ...createHomepageState(scope).snapshot, version: 2,
      attachments: { categories: [], openOnly: false, pendingReview: false },
      period: { preset: "all", from: null, to: null } };
    const initialized = homepage.readHomepageSnapshot(JSON.stringify(legacy));
    expect(initialized).toMatchObject({ ok: true, snapshot: { version: 3,
      period: { preset: "custom", from: "2026-01-01", to: "2026-01-31" }, scope } });
    const selected = homepage.readHomepageSnapshot(JSON.stringify({ ...legacy, period: customPeriod }));
    expect(selected).toMatchObject({ ok: true, snapshot: { period: customPeriod,
      scope: { rangeMode: "custom", from: "2026-02-02", to: "2026-02-06" } } });
  });

  it("rejects a conflicting v3 period/scope instead of restoring a misleading All label", () => {
    const state = createHomepageState(scope);
    const conflict = { ...state.snapshot, period: { preset: "all", from: null, to: null } };
    expect(homepage.readHomepageSnapshot(JSON.stringify(conflict))).toEqual({ ok: false, error: "invalid-snapshot" });
  });

  it("keeps history in flight when period projects its new date fields into scope", () => {
    let state = homepage.beginHomepageHistoryApply(createHomepageState(allScope), years, 0);
    state = homepage.beginHomepagePeriodApply(state, customPeriod, 1);
    const history = state.requests.history!;
    const period = state.requests.period!;
    state = homepage.completeHomepageRequest(state, { domain: "period", generation: period.generation, scopeKey: period.scopeKey, ok: true, period: customPeriod }).state;
    expect(state.snapshot.scope).toEqual({ ...allScope, rangeMode: "custom", from: "2026-02-02", to: "2026-02-06" });
    const completion = homepage.completeHomepageRequest(state, { domain: "history", generation: history.generation, scopeKey: history.scopeKey, ok: true, historyRange: years });
    expect(completion.accepted).toBe(true);
    expect(completion.state.snapshot.history.range).toEqual(years);
    expect(completion.state.snapshot.period).toEqual(customPeriod);
  });
});

describe("S recovery round2 read intents", () => {
  const committed = () => {
    const state = createHomepageState(scope);
    return success(beginHomepageApply(state, { ...state.draft,
      attachments: { categories: ["stock"], openOnly: true, pendingReview: [true] } }));
  };
  const withUnsubmitted = () => {
    const state = committed();
    return homepage.editHomepageDraft(state, { ...state.draft,
      attachments: { categories: ["etf"], openOnly: false, pendingReview: [false] } });
  };

  it("refreshes committed conditions and preserves newer unsubmitted attachment edits through success", () => {
    const initial = withUnsubmitted();
    let state = homepage.beginHomepageRead(initial, { purpose: "refresh" }, 0);
    expect(state.request!.purpose).toBe("refresh");
    expect(state.request!.target.attachments).toEqual({ categories: ["stock"], openOnly: true, pendingReview: [true] });
    expect(state.draft.attachments).toEqual({ categories: ["etf"], openOnly: false, pendingReview: [false] });
    state = homepage.editHomepageDraft(state, { ...state.draft, attachments: { categories: [], openOnly: false, pendingReview: [false, true] } });
    state = success(state);
    expect(state.snapshot.attachments).toEqual({ categories: ["stock"], openOnly: true, pendingReview: [true] });
    expect(state.draft.attachments).toEqual({ categories: [], openOnly: false, pendingReview: [false, true] });
  });

  it.each(["failure", "timeout", "cancel"] as const)("retries a terminal refresh as refresh, retaining D and rejecting late data: %s", terminal => {
    let state = homepage.beginHomepageRead(withUnsubmitted(), { purpose: "refresh" }, 0);
    const first = state.request!;
    state = terminal === "timeout" ? markHomepageRequestTimedOut(state, 15000)
      : terminal === "cancel" ? cancelHomepageDraft(state)
      : homepage.completeHomepageRequest(state, { generation: first.generation, scopeKey: first.scopeKey, ok: false, error: "network" }).state;
    state = retryHomepageApply(state, 16000);
    const retry = state.request!;
    expect(retry.purpose).toBe("refresh");
    expect(retry.generation).toBeGreaterThan(first.generation);
    expect(retry.target.attachments).toEqual({ categories: ["stock"], openOnly: true, pendingReview: [true] });
    expect(state.draft.attachments).toEqual({ categories: ["etf"], openOnly: false, pendingReview: [false] });
    expect(homepage.completeHomepageRequest(state, { generation: first.generation, scopeKey: first.scopeKey, ok: true, applied: first.target }).accepted).toBe(false);
    expect(success(state).draft.attachments.pendingReview).toEqual([false]);
  });

  it("applies the chosen draft through the same read entry without clearing its attachments", () => {
    const state = homepage.beginHomepageRead(withUnsubmitted(), { purpose: "apply" }, 0);
    expect(state.request!.purpose).toBe("apply");
    expect(success(state).snapshot.attachments).toEqual({ categories: ["etf"], openOnly: false, pendingReview: [false] });
  });

  it("changes identity while retaining period/history, clearing old filter drafts and invalidating every old token", () => {
    let state = homepage.beginHomepagePeriodApply(withUnsubmitted(), customPeriod, 0);
    state = homepage.beginHomepageHistoryApply(state, years, 1);
    const period = state.requests.period!;
    const history = state.requests.history!;
    state = homepage.beginHomepageRead(state, { purpose: "identity", scope: { ...allScope, market: "hk", accounts: ["hk"] } }, 2);
    expect(state.snapshot.scope).toEqual(scope);
    expect(state.draft.attachments).toEqual({ categories: [], openOnly: false, pendingReview: [] });
    expect(state.request!.target).toMatchObject({ market: "hk", accounts: ["hk"], rangeMode: "custom", from: "2026-01-01", to: "2026-01-31" });
    expect(state.requests.period).toBeNull();
    expect(state.requests.history).toBeNull();
    expect(homepage.completeHomepageRequest(state, { domain: "period", generation: period.generation, scopeKey: period.scopeKey, ok: true, period: customPeriod }).accepted).toBe(false);
    expect(homepage.completeHomepageRequest(state, { domain: "history", generation: history.generation, scopeKey: history.scopeKey, ok: true, historyRange: years }).accepted).toBe(false);
    const accepted = success(state);
    expect(accepted.snapshot.period).toEqual({ preset: "custom", from: "2026-01-01", to: "2026-01-31" });
    expect(accepted.snapshot.history.range).toEqual({ mode: "all" });
    expect(accepted.snapshot.scope).toEqual({ ...scope, market: "hk", accounts: ["hk"] });
  });

  it.each([
    { rangeMode: "date" as const, date: "2026-09-18", want: { preset: "custom", from: "2026-09-18", to: "2026-09-18" } },
    { rangeMode: "custom" as const, from: "2026-09-01", to: "2026-09-30", want: { preset: "custom", from: "2026-09-01", to: "2026-09-30" } },
    { rangeMode: "all" as const, want: { preset: "all", from: null, to: null } },
  ])("treats native navigation $rangeMode as authoritative only after its owned read succeeds", ({ want, ...range }) => {
    const target = { ...allScope, market: "us" as const, accounts: ["us"], ...range };
    const initial = committed();
    const state = homepage.beginHomepageRead(initial, { purpose: "navigation", scope: target }, 0);
    expect(state.snapshot.scope).toEqual(scope);
    expect(state.snapshot.period).toEqual({ preset: "custom", from: "2026-01-01", to: "2026-01-31" });
    expect(state.request!.purpose).toBe("navigation");
    expect(state.request!.target).toEqual({ ...target, attachments: { categories: [], openOnly: false, pendingReview: [] } });
    const accepted = success(state);
    expect(accepted.snapshot.period).toEqual(want);
    expect(accepted.snapshot.scope).toEqual(target);
    expect(accepted.snapshot.history).toEqual(initial.snapshot.history);
    expect(decodeHomepageSnapshot(encodeHomepageSnapshot(accepted.snapshot))?.scope).toEqual(target);
  });

  it.each(["failure", "timeout", "cancel"] as const)("keeps old committed scope/period when navigation terminates and rejects late response: %s", terminal => {
    const target: HomepageScope = { ...allScope, rangeMode: "date", date: "2026-10-22" };
    let state = homepage.beginHomepageRead(committed(), { purpose: "navigation", scope: target }, 0);
    const token = state.request!;
    state = terminal === "timeout" ? markHomepageRequestTimedOut(state, 15000)
      : terminal === "cancel" ? cancelHomepageDraft(state)
      : homepage.completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey, ok: false, error: "network" }).state;
    expect(state.snapshot.scope).toEqual(scope);
    expect(state.snapshot.period).toEqual({ preset: "custom", from: "2026-01-01", to: "2026-01-31" });
    expect(homepage.completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target }).accepted).toBe(false);
    const retried = retryHomepageApply(state, 16000);
    expect(retried.request!.purpose).toBe("navigation");
    expect(retried.request!.target).toEqual({ ...target, attachments: { categories: [], openOnly: false, pendingReview: [] } });
    expect(success(retried).snapshot.period).toEqual({ preset: "custom", from: "2026-10-22", to: "2026-10-22" });
  });

  it("does not accept a navigation response after an independent period change succeeds", () => {
    let state = homepage.beginHomepageRead(committed(), { purpose: "navigation", scope: { ...allScope, rangeMode: "date", date: "2026-10-22" } }, 0);
    const navigation = state.request!;
    state = homepage.beginHomepagePeriodApply(state, customPeriod, 1);
    const period = state.requests.period!;
    state = homepage.completeHomepageRequest(state, { domain: "period", generation: period.generation, scopeKey: period.scopeKey, ok: true, period: customPeriod }).state;
    expect(homepage.completeHomepageRequest(state, { generation: navigation.generation, scopeKey: navigation.scopeKey, ok: true, applied: navigation.target }).accepted).toBe(false);
    expect(state.snapshot.period).toEqual(customPeriod);
    expect(state.snapshot.scope).toMatchObject({ market: "all", accounts: ["paper"], from: "2026-02-02", to: "2026-02-06" });
  });

  it("rejects a same-token navigation payload with different dates and preserves the committed title on retry", () => {
    let state = homepage.beginHomepageRead(committed(), { purpose: "navigation", scope: { ...allScope, rangeMode: "date", date: "2026-10-22" } }, 0);
    const token = state.request!;
    const mismatch = homepage.completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey,
      ok: true, applied: { ...token.target, date: "2026-10-23" } });
    expect(mismatch.accepted).toBe(false);
    expect(mismatch.state.snapshot.scope).toEqual(scope);
    expect(mismatch.state.snapshot.attachments.pendingReview).toEqual([true]);
    state = retryHomepageApply(mismatch.state, 1);
    expect(state.request!.target.date).toBe("2026-10-22");
    expect(homepage.completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target }).accepted).toBe(false);
    expect(success(state).snapshot.scope).toEqual({ ...allScope, rangeMode: "date", date: "2026-10-22" });
  });

  it("binds navigation to history while leaving a successful history selection independent", () => {
    let state = homepage.beginHomepageRead(committed(), { purpose: "navigation", scope: allScope }, 0);
    const token = state.request!;
    state = homepage.beginHomepageHistoryApply(state, years, 1);
    const history = state.requests.history!;
    state = homepage.completeHomepageRequest(state, { domain: "history", generation: history.generation,
      scopeKey: history.scopeKey, ok: true, historyRange: years }).state;
    expect(state.request).toBeNull();
    expect(state.error).toBe("superseded");
    expect(homepage.completeHomepageRequest(state, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target }).accepted).toBe(false);
    expect(state.snapshot.history.range).toEqual(years);
    expect(state.snapshot.scope).toEqual(scope);
  });

  it("normalizes navigation scope sets and binds purpose into the owned request key", () => {
    const original = createHomepageState(allScope);
    const first = homepage.beginHomepageRead(original, { purpose: "navigation", scope: { live: true, market: "all", accounts: ["z", "a"], rangeMode: "all" } }, 0);
    const reordered = homepage.beginHomepageRead(original, { purpose: "navigation", scope: { accounts: ["a", "z", "a"], rangeMode: "all", market: "all", live: true } }, 0);
    expect(first.request!.scopeKey).toBe(reordered.request!.scopeKey);
    const apply = homepage.beginHomepageRead(original, { purpose: "apply" }, 0);
    const refresh = homepage.beginHomepageRead(original, { purpose: "refresh" }, 0);
    expect(apply.request!.target).toEqual(refresh.request!.target);
    expect(apply.request!.scopeKey).not.toBe(refresh.request!.scopeKey);
  });

  it("restores v3 as UI only without request or retry intent and rejects pre-restore responses", () => {
    const loading = homepage.beginHomepageRead(committed(), { purpose: "navigation", scope: allScope }, 0);
    const token = loading.request!;
    const bytes = encodeHomepageSnapshot(loading.snapshot);
    expect(bytes).not.toContain("lastGlobalRead");
    expect(bytes).not.toContain("generation");
    const restored = homepage.restoreHomepageState(bytes, loading);
    if (!restored.ok) throw new Error("expected committed v3 UI to restore");
    expect(restored.state.lastGlobalRead).toBeNull();
    expect(restored.state.requests).toEqual({ global: null, period: null, history: null });
    expect(restored.state.snapshot.scope).toEqual(scope);
    expect(homepage.completeHomepageRequest(restored.state, { generation: token.generation, scopeKey: token.scopeKey, ok: true, applied: token.target }).accepted).toBe(false);
    expect(homepage.beginHomepageRead(restored.state, { purpose: "refresh" }, 1).request!.generation).toBeGreaterThan(token.generation);
  });
});
