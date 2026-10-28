import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHomepageState, encodeHomepageSnapshot, type HomepageSnapshot } from "../../lib/reviews/homepage-v25-state";
import { useHomepageHost, type HomepageHostReadContext, type HomepageHostPeriodReadContext, type HomepageHostHistoryReadContext,
  type HomepageHostPeriodReadResult, type HomepageHostHistoryReadResult } from "./use-homepage-host";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home"); });
const catalog = [{ id: "one", label: "实盘一" }];
describe("homepage workspace host", () => {
  it("accepts a fresh collection independently of finance and rereads the complete bundle on home return", async () => {
    history.replaceState(null, "", "/trades");
    const reads: Array<{ requestId: number; destination: string; resolve: (result: { requestId: number; data: string; kind?: "collection" }) => void }> = [];
    const reload = vi.fn((requestId: number, context?: { destination: "home" | "trades" }) => new Promise<{ requestId: number; data: string; kind?: "collection" }>(resolve => {
      reads.push({ requestId, destination: context?.destination ?? "missing", resolve });
    }));
    const accepted = vi.fn();
    const { result, rerender } = renderHook(({ data }) => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, readCollections: true,
      revision: 1, data, accounts: catalog, identities: {}, reload, onReadAccepted: accepted, guard: async () => true,
    }), { initialProps: { data: "financial-seed" } });
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(reads[0].destination).toBe("trades");
    expect(result.current.collectionReady).toBe(false);
    rerender({ data: "unowned-external-catalog" });
    await act(async () => reads[0].resolve({ requestId: reads[0].requestId, data: "fresh-collection", kind: "collection" }));
    expect(result.current.collectionReady).toBe(true);
    expect(result.current.collectionData).toBe("fresh-collection");
    expect(result.current.data).toBe("financial-seed");
    await act(() => result.current.openHome());
    expect(reads[1].destination).toBe("home");
    expect(result.current.data).toBe("financial-seed");
    await act(async () => reads[1].resolve({ requestId: reads[1].requestId, data: "complete-financial-bundle" }));
    expect(result.current.data).toBe("complete-financial-bundle");
    expect(accepted.mock.calls.map(call => call[0])).toEqual(["fresh-collection", "complete-financial-bundle"]);
  });

  it("does not expose a previous collection while a newer destination owns the generation", async () => {
    history.replaceState(null, "", "/trades");
    const reads: Array<{ requestId: number; resolve: (result: { requestId: number; data: string; kind?: "collection" }) => void }> = [];
    const reload = vi.fn((requestId: number) => new Promise<{ requestId: number; data: string; kind?: "collection" }>(resolve => reads.push({ requestId, resolve })));
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, readCollections: true,
      revision: 1, data: "seed", accounts: catalog, identities: {}, reload, guard: async () => true,
    }));
    await waitFor(() => expect(reads).toHaveLength(1));
    await act(async () => reads[0].resolve({ requestId: reads[0].requestId, data: "first-catalog", kind: "collection" }));
    await act(() => result.current.openHome());
    await act(() => result.current.openGlobalTrades());
    expect(reads).toHaveLength(3);
    expect(result.current.collectionReady).toBe(false);
    expect(result.current.collectionData).toBeNull();
    await act(async () => reads[1].resolve({ requestId: reads[1].requestId, data: "late-home" }));
    expect(result.current.data).toBe("seed");
    expect(result.current.collectionReady).toBe(false);
    await act(async () => reads[2].resolve({ requestId: reads[2].requestId, data: "current-catalog", kind: "collection" }));
    expect(result.current.collectionData).toBe("current-catalog");
    expect(result.current.collectionReady).toBe(true);
  });
  it.each([
    ["/trades", "global"],
    ["/trades?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22&symbol=SSE%3A600519", "homepage"],
  ])("owns the cold %s bundle before opening its collection after delayed readiness", async (url, origin) => {
    history.replaceState(null, "", url);
    let complete!: (data: string) => void;
    const reload = vi.fn((requestId: number) => new Promise<{ requestId: number; data: string }>(resolve => { complete = data => resolve({ requestId, data }); }));
    const accepted = vi.fn();
    const { result, rerender } = renderHook(({ ready, data }) => useHomepageHost({ enabled: true, ready, readOnInitialize: true,
      revision: ready ? 1 : 0, data, accounts: ready ? catalog : [], identities: ready ? { "SSE:600519": "CN-SH:600519" } : {},
      catalogFor: () => ({ accounts: catalog, identities: { "SSE:600519": ["CN-SH:600519"] } }), reload, onReadAccepted: accepted, guard: async () => true,
    }), { initialProps: { ready: false, data: "empty-before-bootstrap" } });
    expect(reload).not.toHaveBeenCalled();
    rerender({ ready: true, data: "legacy-ready-must-not-own" });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(result.current.initialized).toBe(false);
    expect(result.current.data).toBe("empty-before-bootstrap");
    expect(result.current.route).toMatchObject({ page: "trades", collectionOrigin: origin, error: null });
    expect(accepted).not.toHaveBeenCalled();
    await act(async () => complete("owned-bootstrap-market-fx"));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.data).toBe("owned-bootstrap-market-fx");
    expect(result.current.ui.requests.global).toBeNull();
    expect(accepted).toHaveBeenCalledExactlyOnceWith("owned-bootstrap-market-fx");
    expect(location.pathname + location.search).toBe(url);
    rerender({ ready: true, data: "later-external-stale-fx" });
    expect(result.current.data).toBe("owned-bootstrap-market-fx");
  });
  it("keeps a direct collection read failure recoverable and retries its URL without replacing its readonly home source", async () => {
    const source = createHomepageState({ live: true, market: "hk", accounts: ["one"], rangeMode: "date", date: "2026-10-21" }).snapshot;
    source.holdings = { query: "来源条件", sort: "name-desc", page: 2 };
    source.search = { query: "茅台", open: true, resultsScrollTop: 143, selectedSymbol: null, triggerFocusId: "hp-symbol-trigger" };
    source.scrollTop = 287;
    const bytes = JSON.stringify(source);
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", bytes);
    const url = "/trades?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22&symbol=SSE%3A600519";
    history.replaceState(null, "", url);
    let attempt = 0;
    const reload = vi.fn(async (requestId: number) => {
      attempt += 1;
      if (attempt === 1) throw new Error("bootstrap unavailable");
      return { requestId, data: `owned-${attempt}` };
    });
    const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1, data: "empty",
      accounts: catalog, identities: { "SSE:600519": "CN-SH:600519" }, catalogFor: () => ({ accounts: catalog, identities: { "SSE:600519": ["CN-SH:600519"] } }), reload, onReadAccepted: accepted, guard: async () => true,
    }));
    await waitFor(() => expect(result.current.route.error).toBe("bootstrap unavailable"));
    expect(result.current.initialized).toBe(true);
    expect(result.current.data).toBe("empty"); expect(accepted).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")).toBe(bytes);
    expect(location.pathname + location.search).toBe(url);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.route.error).toBeNull());
    expect(result.current.route.scope).toMatchObject({ market: "a", accounts: ["one"], rangeMode: "date", date: "2026-10-22", symbolIdentity: "SSE:600519" });
    expect(result.current.data).toBe("owned-2");
    expect(result.current.ui.snapshot.scope).toEqual(source.scope);
    expect(result.current.ui.snapshot.search).toEqual(source.search);
    expect(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")).toBe(bytes);
    await act(() => result.current.openHome());
    await waitFor(() => expect(result.current.data).toBe("owned-3"));
    expect(result.current.ui.snapshot.holdings).toEqual(source.holdings);
    expect(result.current.ui.snapshot.scrollTop).toBe(287);
    expect(result.current.ui.snapshot.scope).toEqual(source.scope);
    expect(accepted.mock.calls.map(call => call[0])).toEqual(["owned-2", "owned-3"]);
  });
  it.each([
    ["rangeMode=date&date=2026-10-22", null],
    ["rangeMode=date&date=2026-10-22", "SSE:600519"],
    ["rangeMode=custom&from=2026-10-01&to=2026-10-22", null],
    ["rangeMode=custom&from=2026-10-01&to=2026-10-22", "SSE:600519"],
  ])("retains the direct homepage date scope %s through %s, reload and guarded return", async (range, identity) => {
    history.replaceState(null, "", `/home?scope=live&market=a&accounts=one&${range}`);
    const options = { enabled: true, ready: true, revision: 1, data: "fresh", accounts: catalog, identities: { "SSE:600519": "CN-SH:600519" }, reload: vi.fn(async (requestId: number) => ({ requestId, data: "reread" })), guard: async () => true };
    let host = renderHook(() => useHomepageHost(options));
    await waitFor(() => expect(host.result.current.initialized).toBe(true));
    await act(() => host.result.current.openTrades(identity));
    expect(location.search).toContain(range);
    if (identity) expect(new URL(location.href).searchParams.get("symbol")).toBe(identity);
    host.unmount();
    host = renderHook(() => useHomepageHost(options));
    await waitFor(() => expect(host.result.current.initialized).toBe(true));
    expect(host.result.current.route.collectionOrigin).toBe("homepage");
    expect(location.search).toContain(range);
    await act(() => host.result.current.openHome());
    await waitFor(() => expect(host.result.current.data).toBe("reread"));
    await act(() => host.result.current.openTrades(identity));
    expect(location.search).toContain(range);
  });
  it("keeps the homepage navigation's applied scope and source UI while global addresses and indexed pops derive their own origin", async () => {
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22");
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: "fresh", accounts: catalog, identities: {}, reload: vi.fn(async requestId => ({ requestId, data: "read" })), guard: async () => true }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.onUi({ holdings: { query: "来源搜索", sort: "name-desc", page: 2 } }));
    await act(() => result.current.openTrades(null));
    const strictEntry = history.state; const strictUrl = location.href;
    expect(result.current.route.collectionOrigin).toBe("homepage");
    expect(result.current.route.scope).toMatchObject({ market: "a", accounts: ["one"], rangeMode: "date", date: "2026-10-22" });
    await act(() => result.current.openGlobalTrades());
    const globalEntry = history.state;
    expect(location.pathname + location.search).toBe("/trades");
    expect(result.current.route.collectionOrigin).toBe("global");
    expect(result.current.ui.snapshot.holdings.query).toBe("来源搜索");
    const go = vi.spyOn(history, "go").mockImplementation(() => {});
    act(() => { history.replaceState(strictEntry, "", strictUrl); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(go).toHaveBeenLastCalledWith(1);
    await act(async () => { history.replaceState(globalEntry, "", "/trades"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(go).toHaveBeenLastCalledWith(-1);
    act(() => { history.replaceState(strictEntry, "", strictUrl); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(result.current.route.collectionOrigin).toBe("homepage");
    expect(result.current.route.scope.accounts).toEqual(["one"]);
    act(() => { history.replaceState(globalEntry, "", "/trades"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(go).toHaveBeenLastCalledWith(-1);
    await act(async () => { history.replaceState(strictEntry, "", strictUrl); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(go).toHaveBeenLastCalledWith(1);
    act(() => { history.replaceState(globalEntry, "", "/trades"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(result.current.route.collectionOrigin).toBe("global");
  });
  it.each([
    ["/trades", "global"],
    ["/trades?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22", "homepage"],
  ])("derives collection origin from the direct address %s", async (url, origin) => {
    history.replaceState(null, "", url);
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: "fresh", accounts: catalog, identities: {}, reload: vi.fn(), guard: async () => true }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.route).toMatchObject({ page: "trades", collectionOrigin: origin, error: null });
  });
  it.each(["cancel", "throw"])("does not commit a global collection scope when its guard %s", async mode => {
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=one&rangeMode=all");
    const guard = vi.fn(async () => { if (mode === "throw") throw new Error("save unavailable"); return false; });
    const commit = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: "owned", accounts: catalog, identities: {}, reload: vi.fn(), guard }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.onUi({ holdings: { query: "来源条件", sort: "name-desc", page: 2 } }));
    const entry = history.state; const bytes = sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3");
    let accepted: unknown;
    await act(async () => { accepted = await result.current.openGlobalTrades(commit); });
    expect(accepted).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(location.pathname + location.search).toBe("/home?scope=live&market=a&accounts=one&rangeMode=all");
    expect(history.state).toEqual(entry);
    expect(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")).toBe(bytes);
    expect(result.current.ui.snapshot.holdings.query).toBe("来源条件");
  });
  it("commits only the latest guarded global transition and preserves the homepage source for return", async () => {
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=one&rangeMode=all");
    const approvals: Array<(allowed: boolean) => void> = [];
    const guard = vi.fn(() => new Promise<boolean>(resolve => approvals.push(resolve)));
    const first = vi.fn(); const second = vi.fn();
    const reload = vi.fn(async (requestId: number) => ({ requestId, data: "fresh-return" }));
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: "owned", accounts: catalog, identities: {}, reload, guard }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.onUi({ holdings: { query: "来源条件", sort: "name-desc", page: 2 }, scrollTop: 287 }));
    let old!: Promise<unknown>; let current!: Promise<unknown>;
    act(() => { old = result.current.openGlobalTrades(first); current = result.current.openGlobalTrades(second); });
    await act(async () => { approvals[1](true); await current; });
    const entry = history.state;
    expect(second).toHaveBeenCalledOnce(); expect(first).not.toHaveBeenCalled();
    expect(location.pathname + location.search).toBe("/trades");
    expect(result.current.route.collectionOrigin).toBe("global");
    await act(async () => { approvals[0](true); expect(await old).toBe(false); });
    expect(first).not.toHaveBeenCalled(); expect(history.state).toEqual(entry);
    let returning!: Promise<unknown>;
    act(() => { returning = result.current.openHome(); });
    await act(async () => { approvals[2](true); await returning; });
    await waitFor(() => expect(result.current.data).toBe("fresh-return"));
    expect(result.current.ui.snapshot.scope).toMatchObject({ market: "a", accounts: ["one"] });
    expect(result.current.ui.snapshot.holdings).toEqual({ query: "来源条件", sort: "name-desc", page: 2 });
    expect(result.current.ui.snapshot.scrollTop).toBe(287);
  });
  it("waits for the actual compensating pop before invoking a guarded back, and cancellation retains the current entry", async () => {
    const guard = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: "fresh", accounts: catalog, identities: {}, reload: vi.fn(), guard }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    const homeEntry = history.state;
    await act(() => result.current.openTrades(null));
    const tradesEntry = history.state; const tradesUrl = location.href;
    const go = vi.spyOn(history, "go").mockImplementation(() => {});
    act(() => { history.replaceState(homeEntry, "", "/home"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await act(() => new Promise(resolve => setTimeout(resolve, 10)));
    expect(go).toHaveBeenCalledWith(1);
    expect(guard).toHaveBeenCalledTimes(1);
    act(() => { history.replaceState(tradesEntry, "", tradesUrl); window.dispatchEvent(new PopStateEvent("popstate")); });
    await waitFor(() => expect(guard).toHaveBeenCalledTimes(2));
    expect(location.pathname).toBe("/trades");
    expect(result.current.route.page).toBe("trades");
    expect(go).toHaveBeenCalledTimes(1);
  });
  it("reads a complete legacy v2 source only when v3 is absent, then persists a UI-only v3 snapshot", async () => {
    history.replaceState(null, "", "/home");
    const current = createHomepageState({ live: true, market: "all", accounts: ["*"], rangeMode: "all" }).snapshot;
    const bytes = JSON.stringify({ ...current, version: 2, attachments: { categories: ["long"], openOnly: true, pendingReview: true }, holdings: { query: "旧条件", sort: "name-desc", page: 2 } });
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v2", bytes);
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: { secretBusinessPrice: "123" }, accounts: catalog, identities: {}, reload: vi.fn(), guard: async () => true }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.ui.snapshot.holdings.query).toBe("旧条件");
    expect(result.current.ui.snapshot.attachments.pendingReview).toEqual([true]);
    act(() => result.current.onUi({ scrollTop: 247 }));
    const saved = JSON.parse(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")!);
    expect(saved).toMatchObject({ version: 3, scrollTop: 247, holdings: { query: "旧条件" }, attachments: { pendingReview: [true] } });
    expect(saved).not.toHaveProperty("secretBusinessPrice");
    expect(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v2")).toBe(bytes);
  });
  it("performs a first owned read after catalog readiness instead of freezing the pre-market initial bundle", async () => {
    const reload = vi.fn(async (requestId: number) => ({ requestId, data: "persisted-market-ready" }));
    const { result, rerender } = renderHook(({ ready }) => useHomepageHost({ enabled: true, ready, readOnInitialize: true,
      revision: 1, data: "pre-market", accounts: catalog, identities: {}, reload, guard: async () => true,
    }), { initialProps: { ready: false } });
    expect(reload).not.toHaveBeenCalled();
    rerender({ ready: true });
    await waitFor(() => expect(result.current.data).toBe("persisted-market-ready"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("settles the initial non-default URL and restored source with its own accepted bundle and callback", async () => {
    const scope = { live: true as const, market: "a" as const, accounts: ["one"], rangeMode: "date" as const, date: "2026-10-22" };
    const source = createHomepageState(scope).snapshot;
    source.holdings = { query: "来源持仓", sort: "name-desc", page: 2 };
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", JSON.stringify(source));
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22");
    let complete!: (value: { requestId: number; data: string }) => void;
    const reload = vi.fn((requestId: number) => new Promise<{ requestId: number; data: string }>(resolve => { complete = value => resolve({ ...value, requestId }); }));
    const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1,
      data: "before-owned-read", accounts: catalog, identities: {}, catalogFor: () => ({ accounts: catalog, identities: {} }), reload, onReadAccepted: accepted, guard: async () => true,
    }));
    await waitFor(() => expect(result.current.ui.requests.global?.purpose).toBe("navigation"));
    expect(result.current.data).toBe("before-owned-read"); expect(accepted).not.toHaveBeenCalled();
    await act(async () => complete({ requestId: 1, data: "owned-complete" }));
    await waitFor(() => expect(result.current.ui.requests.global).toBeNull());
    expect(result.current.ui.errors.global).toBeNull(); expect(result.current.data).toBe("owned-complete");
    expect(result.current.ui.snapshot.scope).toEqual(scope);
    expect(result.current.ui.snapshot.holdings).toEqual(source.holdings);
    expect(result.current.route).toMatchObject({ page: "home", scope, error: null });
    expect(accepted).toHaveBeenCalledExactlyOnceWith("owned-complete");
    expect(location.search).toContain("rangeMode=date&date=2026-10-22");
  });
  it("waits for catalogs before rejecting a target account and never silently widens it", async () => {
    history.replaceState(null, "", "/trades?scope=live&market=all&accounts=gone&rangeMode=all");
    const { result, rerender } = renderHook(({ ready }) => useHomepageHost({ enabled: true, ready, revision: ready ? 1 : 0, data: "fresh", accounts: catalog, identities: {}, reload: vi.fn(), guard: async () => true }), { initialProps: { ready: false } });
    expect(result.current.route.error).toBeNull();
    rerender({ ready: true });
    await waitFor(() => expect(result.current.route.error).toContain("账户"));
    expect(location.search).toContain("accounts=gone");
  });
  it("does not commit route or source UI if the existing review guard cancels", async () => {
    const guard = vi.fn(async () => false);
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1, data: "fresh", accounts: catalog, identities: {}, reload: vi.fn(), guard }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    await act(() => result.current.openTrades(null));
    expect(guard).toHaveBeenCalledWith("trades");
    expect(location.pathname).toBe("/home");
    expect(result.current.route.page).toBe("home");
  });
  it("keeps labels and data together until a new bootstrap revision, then restores source UI with fresh data", async () => {
    let finish: ((value: { requestId: number; data: string }) => void) | undefined;
    const reload = vi.fn((requestId: number) => new Promise<{ requestId: number; data: string }>(resolve => { finish = value => resolve({ ...value, requestId }); }));
    const { result, rerender } = renderHook(({ revision, data }) => useHomepageHost({ enabled: true, ready: true, revision, data, accounts: catalog, identities: {}, reload, guard: async () => true }), { initialProps: { revision: 1, data: "old" } });
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.onUi({ holdings: { query: "茅台", sort: "name-desc", page: 2 }, scrollTop: 321 }));
    await act(() => result.current.openTrades(null));
    expect(location.pathname).toBe("/trades");
    await act(() => result.current.openHome());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("old");
    await act(async () => { finish?.({ requestId: 1, data: "new" }); });
    rerender({ revision: 2, data: "new" });
    await waitFor(() => expect(result.current.ui.requests.global).toBeNull());
    expect(result.current.data).toBe("new");
    expect(result.current.ui.snapshot.holdings.query).toBe("茅台");
    expect(result.current.ui.snapshot.scrollTop).toBe(321);
    expect(location.pathname).toBe("/home");
  });
  it("does not publish an earlier reader's bundle under a later scope token", async () => {
    const replies: Array<(value: { requestId: number; data: string }) => void> = [];
    const reload = vi.fn((requestId: number) => new Promise<{ requestId: number; data: string }>(resolve => replies.push(value => resolve({ ...value, requestId }))));
    const { result, rerender } = renderHook(({ revision, data }) => useHomepageHost({ enabled: true, ready: true, revision, data, accounts: catalog, identities: {}, reload, guard: async () => true }), { initialProps: { revision: 1, data: "initial" } });
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.onScope({ live: true, market: "a", accounts: ["*"], rangeMode: "all" }));
    act(() => result.current.onScope({ live: true, market: "hk", accounts: ["*"], rangeMode: "all" }));
    await act(async () => { replies[0]({ requestId: 1, data: "A" }); });
    rerender({ revision: 2, data: "A-global" });
    expect(result.current.ui.snapshot.scope.market).toBe("all");
    expect(result.current.data).toBe("initial");
    await act(async () => { replies[1]({ requestId: 2, data: "B-owned" }); });
    expect(result.current.ui.snapshot.scope.market).toBe("hk");
    expect(result.current.data).toBe("B-owned");
  });
  it("validates a returning source against its own fresh catalog and keeps non-scope UI on explicit fallback", async () => {
    type Bundle = { accounts: typeof catalog; value: string };
    const initial = { accounts: catalog, value: "old" };
    let reply!: (value: { requestId: number; data: Bundle }) => void;
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: initial, accounts: catalog, identities: {}, catalogFor: data => ({ accounts: data.accounts, identities: {} }), guard: async () => true,
      reload: requestId => new Promise(resolve => { reply = data => resolve({ ...data, requestId }); }),
    }));
    act(() => result.current.onScope({ live: true, market: "all", accounts: ["one"], rangeMode: "all" }));
    await act(async () => reply({ requestId: 1, data: initial }));
    act(() => result.current.onUi({ holdings: { query: "保留搜索", sort: "name-desc", page: 2 }, scrollTop: 312 }));
    await act(() => result.current.openTrades(null));
    await act(() => result.current.openHome());
    await act(async () => reply({ requestId: 2, data: { accounts: [], value: "fresh-deleted" } }));
    expect(result.current.data.value).toBe("fresh-deleted");
    expect(result.current.ui.snapshot.scope.accounts).toEqual(["*"]);
    expect(result.current.ui.snapshot.holdings.query).toBe("保留搜索");
    expect(result.current.ui.snapshot.scrollTop).toBe(312);
    expect(result.current.notice).toContain("来源账户已不存在");
    expect(result.current.route.error).toBeNull();
  });
});

type CurrentPackage = { revision: string; currentMarketValue: string; holdings: string[] };
type PeriodPackage = { revision: string; cards: string[]; series: string[]; contribution: string[] };
type HistoryPackage = { revision: string; cards: string[]; series: string[]; contribution: string[] };
function currentPackage(revision: string): CurrentPackage { return { revision, currentMarketValue: `${revision}:MV`, holdings: [`${revision}:holding`] }; }
function periodPackage(revision: string): PeriodPackage { return { revision, cards: ["income", "return", "realized"].map(key => `${revision}:${key}`), series: [`${revision}:point`], contribution: [`${revision}:bucket`] }; }
function historyPackage(revision: string): HistoryPackage { return { revision, cards: ["rounds", "win-rate", "ratio", "holding-days"].map(key => `${revision}:${key}`), series: [`${revision}:point`], contribution: [`${revision}:bucket`] }; }
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function domainHarness() {
  const globals: Array<{ id: number; context: HomepageHostReadContext; reply: ReturnType<typeof deferred<{ requestId: number; data: CurrentPackage; kind?: "collection" }>> }> = [];
  const periods: Array<{ context: HomepageHostPeriodReadContext<CurrentPackage, PeriodPackage>; reply: ReturnType<typeof deferred<HomepageHostPeriodReadResult<PeriodPackage>>> }> = [];
  const histories: Array<{ context: HomepageHostHistoryReadContext<CurrentPackage, HistoryPackage>; reply: ReturnType<typeof deferred<HomepageHostHistoryReadResult<HistoryPackage>>> }> = [];
  const data = currentPackage("old-global"); const seed = { period: periodPackage("old-period"), history: historyPackage("old-history") };
  const reload = vi.fn((id: number, context?: HomepageHostReadContext) => {
    if (!context) throw new Error("missing read context");
    const reply = deferred<{ requestId: number; data: CurrentPackage; kind?: "collection" }>(); globals.push({ id, context, reply }); return reply.promise;
  });
  const reloadPeriod = vi.fn((context: HomepageHostPeriodReadContext<CurrentPackage, PeriodPackage>) => {
    const reply = deferred<HomepageHostPeriodReadResult<PeriodPackage>>(); periods.push({ context, reply }); return reply.promise;
  });
  const reloadHistory = vi.fn((context: HomepageHostHistoryReadContext<CurrentPackage, HistoryPackage>) => {
    const reply = deferred<HomepageHostHistoryReadResult<HistoryPackage>>(); histories.push({ context, reply }); return reply.promise;
  });
  const fromGlobal = vi.fn((fresh: CurrentPackage, context: HomepageHostReadContext, accepted: HomepageSnapshot) => {
    void context; void accepted;
    return { period: periodPackage(`${fresh.revision}:period`), history: historyPackage(`${fresh.revision}:history`) };
  });
  const globalAccepted = vi.fn(); const domainAccepted = vi.fn();
  const options = { enabled: true, ready: true, revision: 1, data, accounts: catalog, identities: {}, reload, onReadAccepted: globalAccepted, guard: vi.fn(async () => true),
    domains: { seed, fromGlobal, reloadPeriod, reloadHistory, onReadAccepted: domainAccepted } };
  return { data, seed, globals, periods, histories, reload, reloadPeriod, reloadHistory, fromGlobal, globalAccepted, domainAccepted, options };
}
const selectedPeriod = { preset: "custom" as const, from: "2026-10-01", to: "2026-10-23" };
const selectedHistory = { mode: "year" as const, year: 2025 };

describe("configured homepage domain host", () => {
  it.each(["history-first", "period-first"])("publishes complete independent slots with their labels in %s order", async order => {
    const h = domainHarness(); const renders: Array<{ period: unknown; range: unknown; p: PeriodPackage | undefined; history: HistoryPackage | undefined; current: CurrentPackage }> = [];
    const { result } = renderHook(() => {
      const host = useHomepageHost(h.options);
      renders.push({ period: host.ui.snapshot.period, range: host.ui.snapshot.history.range, p: host.domainData?.period, history: host.domainData?.history, current: host.data });
      return host;
    });
    const initial = result.current.ui.snapshot;
    act(() => {
      result.current.onUi({ contribution: { ...initial.contribution, mode: "history", history: { ...initial.contribution.history, page: 2, category: "short", drilldown: "symbols", market: "us", symbol: "NASDAQ:META" } }, historyChartMode: "win-rate" });
      result.current.onPeriodDraft(selectedPeriod); expect(result.current.applyPeriod(selectedPeriod)).toBe(true);
      result.current.onHistoryDraft(selectedHistory); expect(result.current.applyHistory(selectedHistory)).toBe(true);
    });
    expect(h.reload).not.toHaveBeenCalled(); expect(h.periods).toHaveLength(1); expect(h.histories).toHaveLength(1);
    expect(h.periods[0].context.source).toEqual({ data: h.data, applied: { live: true, market: "all", accounts: ["*"], attachments: initial.attachments } });
    expect(h.histories[0].context.destination).toBe("home");
    const p = periodPackage("new-period"); const historyData = historyPackage("new-history");
    const finishP = () => h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: p });
    const finishH = () => h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyData });
    await act(async () => { if (order === "history-first") finishH(); else finishP(); });
    expect(result.current.data).toBe(h.data);
    expect(result.current.domainData).toEqual(order === "history-first" ? { period: h.seed.period, history: historyData } : { period: p, history: h.seed.history });
    await act(async () => { if (order === "history-first") finishP(); else finishH(); });
    expect(result.current.domainData).toEqual({ period: p, history: historyData });
    expect(result.current.ui.snapshot.period).toEqual(selectedPeriod); expect(result.current.ui.snapshot.history.range).toEqual(selectedHistory);
    expect(result.current.ui.snapshot.contribution.mode).toBe("history"); expect(result.current.ui.snapshot.contribution.history).toMatchObject({ page: 2, category: "short", market: "us", symbol: "NASDAQ:META" });
    expect(result.current.ui.snapshot.history.chartMode).toBe("win-rate");
    expect(h.globalAccepted).not.toHaveBeenCalled(); expect(h.domainAccepted.mock.calls.map(call => call[0].domain)).toEqual(order === "history-first" ? ["history", "period"] : ["period", "history"]);
    for (const render of renders) {
      expect(render.current).toBe(h.data);
      expect(render.p).toBe(JSON.stringify(render.period) === JSON.stringify(selectedPeriod) ? p : h.seed.period);
      expect(render.history).toBe(JSON.stringify(render.range) === JSON.stringify(selectedHistory) ? historyData : h.seed.history);
    }
    const saved = sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")!;
    expect(saved).not.toContain("new-period"); expect(saved).not.toContain("new-history"); expect(saved).not.toContain("old-global");
    expect(location.search).toContain("rangeMode=custom&from=2026-10-01&to=2026-10-23");
  });
  it("supersedes a prior request only in the same domain and ignores its late response", async () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options));
    act(() => { result.current.applyPeriod(selectedPeriod); result.current.applyHistory(selectedHistory); result.current.applyPeriod({ preset: "all", from: null, to: null }); });
    const historyOwner = result.current.ui.requests.history;
    await act(async () => h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("late") }));
    expect(result.current.domainData).toEqual(h.seed); expect(result.current.ui.requests.history).toEqual(historyOwner);
    const fresh = periodPackage("all-period");
    await act(async () => h.periods[1].reply.resolve({ request: h.periods[1].context.request, data: fresh }));
    expect(result.current.domainData?.period).toBe(fresh); expect(result.current.domainData?.history).toBe(h.seed.history);
    expect(h.domainAccepted).toHaveBeenCalledOnce();
  });
  it.each(["identity", "refresh", "apply"])("cancels both local owners at global %s start before the new global finishes", async purpose => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options));
    act(() => { result.current.applyPeriod(selectedPeriod); result.current.applyHistory(selectedHistory); });
    act(() => {
      if (purpose === "identity") result.current.onScope({ live: true, market: "hk", accounts: ["*"], rangeMode: "all" });
      else if (purpose === "refresh") result.current.reload();
      else result.current.applyAttachments();
    });
    expect(result.current.ui.requests.period).toBeNull(); expect(result.current.ui.requests.history).toBeNull();
    expect(result.current.applyPeriod(selectedPeriod)).toBe(false); expect(result.current.applyHistory(selectedHistory)).toBe(false);
    await act(async () => {
      h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("late-p") });
      h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyPackage("late-h") });
    });
    expect(result.current.domainData).toEqual(h.seed); expect(h.domainAccepted).not.toHaveBeenCalled(); expect(h.globalAccepted).not.toHaveBeenCalled();
    const fresh = currentPackage("new-global");
    await act(async () => h.globals[0].reply.resolve({ requestId: h.globals[0].id, data: fresh }));
    expect(result.current.data).toBe(fresh); expect(result.current.domainData).toEqual({ period: periodPackage("new-global:period"), history: historyPackage("new-global:history") });
    expect(h.globalAccepted).toHaveBeenCalledExactlyOnceWith(fresh);
  });
  it("leaves the old complete label and data after a period failure, retries the same draft, and cancels history independently", async () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options)); const initial = result.current.ui.snapshot;
    act(() => { result.current.applyPeriod(selectedPeriod); result.current.applyHistory(selectedHistory); });
    await act(async () => h.periods[0].reply.reject(new Error("period unavailable")));
    expect(result.current.ui.errors.period).toBe("period unavailable"); expect(result.current.ui.snapshot.period).toEqual(initial.period); expect(result.current.domainData).toEqual(h.seed);
    act(() => { result.current.cancelHistoryRead(); expect(result.current.retryPeriodRead()).toBe(true); });
    expect(result.current.ui.historyDraft).toEqual(initial.history.range); expect(result.current.ui.requests.history).toBeNull();
    expect(h.periods[1].context.request.target).toEqual(selectedPeriod); expect(h.periods[1].context.request.generation).toBeGreaterThan(h.periods[0].context.request.generation);
    await act(async () => h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyPackage("cancelled") }));
    const fresh = periodPackage("retried"); await act(async () => h.periods[1].reply.resolve({ request: h.periods[1].context.request, data: fresh }));
    expect(result.current.domainData).toEqual({ period: fresh, history: h.seed.history }); expect(result.current.ui.errors.period).toBeNull();
    expect(h.domainAccepted).toHaveBeenCalledOnce(); expect(h.reload).not.toHaveBeenCalled();
  });
  it("leaves history failure independent of period success and supports explicit history retry then period cancel", async () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options)); const initial = result.current.ui.snapshot;
    act(() => { result.current.applyHistory(selectedHistory); result.current.applyPeriod(selectedPeriod); });
    await act(async () => h.histories[0].reply.reject(new Error("history unavailable")));
    expect(result.current.ui.errors.history).toBe("history unavailable"); expect(result.current.ui.snapshot.history.range).toEqual(initial.history.range);
    const p = periodPackage("period-ok"); await act(async () => h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: p }));
    act(() => { expect(result.current.retryHistoryRead()).toBe(true); result.current.applyPeriod({ preset: "all", from: null, to: null }); result.current.cancelPeriodRead(); });
    expect(result.current.ui.periodDraft).toEqual(selectedPeriod); expect(h.histories[1].context.request.target).toEqual(selectedHistory);
    const fresh = historyPackage("history-retry"); await act(async () => h.histories[1].reply.resolve({ request: h.histories[1].context.request, data: fresh }));
    expect(result.current.domainData).toEqual({ period: p, history: fresh }); expect(result.current.ui.errors.history).toBeNull();
  });
  it.each(["generation", "scopeKey", "startedAt", "target", "domain"] as const)("never accepts an echoed history token with a mismatched %s", async field => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options)); const oldRange = result.current.ui.snapshot.history.range;
    act(() => result.current.applyHistory(selectedHistory)); const token = h.histories[0].context.request;
    const changes = { generation: { generation: token.generation + 1 }, scopeKey: { scopeKey: "wrong-key" }, startedAt: { startedAt: token.startedAt + 1 }, target: { target: { mode: "year", year: 2024 } }, domain: { domain: "period" } };
    const request = { ...token, ...changes[field] } as typeof token;
    await act(async () => h.histories[0].reply.resolve({ request, data: historyPackage("wrong") }));
    expect(result.current.domainData?.history).toBe(h.seed.history); expect(result.current.ui.snapshot.history.range).toEqual(oldRange); expect(h.domainAccepted).not.toHaveBeenCalled();
    if (field === "target") expect(result.current.ui.errors.history).toBe("update-failed");
  });
  it("keeps separate absolute deadlines through UI-only mode, filter, sort, drill and page changes", async () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options));
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
    act(() => result.current.applyPeriod(selectedPeriod)); const pStarted = result.current.ui.requests.period!.startedAt;
    act(() => vi.advanceTimersByTime(5000)); act(() => result.current.applyHistory(selectedHistory));
    act(() => vi.advanceTimersByTime(9999));
    act(() => { const ui = result.current.ui.snapshot; result.current.onUi({ historyChartMode: "round-count", holdings: { query: "changed", sort: "name-desc", page: 3 }, contribution: { ...ui.contribution, mode: "history", current: { ...ui.contribution.current, page: 2 }, history: { ...ui.contribution.history, drilldown: "symbols", market: "us", symbol: "NASDAQ:META" } } }); });
    expect(result.current.ui.requests.period?.startedAt).toBe(pStarted); expect(h.reload).not.toHaveBeenCalled(); expect(h.periods).toHaveLength(1); expect(h.histories).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.ui.timeouts.period).toBe(true); expect(result.current.ui.requests.history).not.toBeNull(); expect(result.current.domainData).toEqual(h.seed);
    await act(async () => h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("too-late") }));
    act(() => vi.advanceTimersByTime(4999)); expect(result.current.ui.timeouts.history).toBe(false);
    act(() => vi.advanceTimersByTime(1)); expect(result.current.ui.timeouts.history).toBe(true);
    await act(async () => h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyPackage("too-late") }));
    expect(result.current.domainData).toEqual(h.seed); expect(h.domainAccepted).not.toHaveBeenCalled();
    act(() => expect(result.current.retryHistoryRead()).toBe(true));
    expect(h.histories[1].context.request.startedAt).toBe(Date.now()); expect(h.histories[1].context.request.target).toEqual(selectedHistory);
  });
  it.each(["period", "history", "global"] as const)("checks the %s response deadline even when its scheduled timer has not run", async domain => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options));
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
    act(() => { if (domain === "period") result.current.applyPeriod(selectedPeriod); else if (domain === "history") result.current.applyHistory(selectedHistory); else result.current.reload(); });
    vi.setSystemTime(Date.now() + 15_000);
    await act(async () => {
      if (domain === "period") h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("late") });
      else if (domain === "history") h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyPackage("late") });
      else h.globals[0].reply.resolve({ requestId: h.globals[0].id, data: currentPackage("late") });
    });
    expect(result.current.ui.timeouts[domain]).toBe(true); expect(result.current.domainData).toEqual(h.seed); expect(result.current.data).toBe(h.data);
    expect(h.domainAccepted).not.toHaveBeenCalled(); expect(h.globalAccepted).not.toHaveBeenCalled(); expect(h.fromGlobal).not.toHaveBeenCalled();
  });
  it("uses the configured global 15000ms deadline without resetting it on UI updates", () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options));
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T00:00:00Z")); act(() => result.current.reload());
    act(() => vi.advanceTimersByTime(14999)); act(() => result.current.onUi({ scrollTop: 47 }));
    expect(result.current.ui.requests.global).not.toBeNull(); act(() => vi.advanceTimersByTime(1));
    expect(result.current.ui.timeouts.global).toBe(true); expect(h.globals).toHaveLength(1);
  });
  it("does not publish a partial global package or new label when fromGlobal throws", async () => {
    const h = domainHarness(); h.fromGlobal.mockImplementation(() => { throw new Error("all domain data unavailable"); });
    const { result } = renderHook(() => useHomepageHost(h.options)); const previous = result.current.ui.snapshot;
    act(() => result.current.onScope({ live: true, market: "hk", accounts: ["*"], rangeMode: "all" }));
    await act(async () => h.globals[0].reply.resolve({ requestId: h.globals[0].id, data: currentPackage("new") }));
    expect(result.current.ui.snapshot).toEqual(previous); expect(result.current.data).toBe(h.data); expect(result.current.domainData).toEqual(h.seed);
    expect(result.current.ui.requests.global).toBeNull(); expect(result.current.ui.errors.global).toBe("all domain data unavailable"); expect(h.globalAccepted).not.toHaveBeenCalled();
  });
  it.each(["period", "history"] as const)("keeps accepted %s state committed if its notification throws", async domain => {
    const h = domainHarness(); h.domainAccepted.mockImplementation(() => { throw new Error("observer unavailable"); });
    const { result } = renderHook(() => useHomepageHost(h.options));
    act(() => { if (domain === "period") result.current.applyPeriod(selectedPeriod); else result.current.applyHistory(selectedHistory); });
    const p = periodPackage("accepted"); const historyData = historyPackage("accepted");
    await act(async () => { if (domain === "period") h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: p }); else h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyData }); });
    expect(result.current.ui.errors[domain]).toBeNull(); expect(result.current.ui.requests[domain]).toBeNull();
    expect(result.current.domainData?.[domain]).toBe(domain === "period" ? p : historyData); expect(h.domainAccepted).toHaveBeenCalledOnce(); expect(h.globalAccepted).not.toHaveBeenCalled();
  });
  it("keeps both home slots through collection-only acceptance and uses the legacy callback only for that global read", async () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost({ ...h.options, readCollections: true }));
    await act(() => result.current.openTrades(null));
    await act(async () => h.globals[0].reply.resolve({ requestId: h.globals[0].id, data: currentPackage("catalog"), kind: "collection" }));
    expect(result.current.collectionReady).toBe(true); expect(result.current.collectionData?.revision).toBe("catalog");
    expect(result.current.data).toBe(h.data); expect(result.current.domainData).toEqual(h.seed); expect(h.fromGlobal).not.toHaveBeenCalled(); expect(h.domainAccepted).not.toHaveBeenCalled(); expect(h.globalAccepted).toHaveBeenCalledOnce();
  });
  it("passes restored source ranges identical to the actually committed snapshot after fresh account fallback", async () => {
    const h = domainHarness(); const source = createHomepageState({ live: true, market: "a", accounts: ["one"], rangeMode: "custom", from: selectedPeriod.from, to: selectedPeriod.to }).snapshot;
    source.period = selectedPeriod; source.history = { range: selectedHistory, chartMode: "win-rate" };
    source.holdings = { query: "source", sort: "name-desc", page: 2 }; sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", encodeHomepageSnapshot(source));
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=one&rangeMode=custom&from=2026-10-01&to=2026-10-23");
    const { result } = renderHook(() => useHomepageHost({ ...h.options, readOnInitialize: true, catalogFor: () => ({ accounts: [], identities: {} }) }));
    const read = h.globals[0]; expect(read.context.ranges).toEqual({ period: selectedPeriod, historyRange: selectedHistory });
    expect(result.current.data).toBe(h.data); const fresh = currentPackage("source-owned");
    await act(async () => read.reply.resolve({ requestId: read.id, data: fresh }));
    expect(result.current.ui.snapshot.scope.accounts).toEqual(["*"]);
    expect(read.context.ranges).toEqual({ period: result.current.ui.snapshot.period, historyRange: result.current.ui.snapshot.history.range });
    expect(h.fromGlobal.mock.calls[0][2]).toEqual(result.current.ui.snapshot); expect(result.current.ui.snapshot.holdings).toEqual(source.holdings);
    expect(result.current.domainData).toEqual({ period: periodPackage("source-owned:period"), history: historyPackage("source-owned:history") });
    expect(result.current.notice).toContain("来源账户已不存在");
  });
  it("treats ambient global and domain data as mount seeds rather than accepted updates", async () => {
    const h = domainHarness(); const { result, rerender } = renderHook(({ data, seed }) => useHomepageHost({ ...h.options, data, domains: { ...h.options.domains, seed } }), { initialProps: { data: h.data, seed: h.seed } });
    act(() => result.current.applyPeriod(selectedPeriod)); const fresh = periodPackage("owned"); await act(async () => h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: fresh }));
    rerender({ data: currentPackage("ambient"), seed: { period: periodPackage("ambient"), history: historyPackage("ambient") } });
    expect(result.current.data).toBe(h.data); expect(result.current.domainData).toEqual({ period: fresh, history: h.seed.history });
  });
  it.each(["unmount", "disable", "route"])("invalidates local owners on accepted %s lifecycle exit", async mode => {
    const h = domainHarness(); const { result, rerender, unmount } = renderHook(({ enabled }) => useHomepageHost({ ...h.options, enabled }), { initialProps: { enabled: true } });
    act(() => { result.current.applyPeriod(selectedPeriod); result.current.applyHistory(selectedHistory); });
    if (mode === "unmount") unmount(); else if (mode === "disable") rerender({ enabled: false }); else await act(() => result.current.openTrades(null));
    await act(async () => {
      h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("orphan") });
      h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyPackage("orphan") });
    });
    expect(h.domainAccepted).not.toHaveBeenCalled(); if (mode !== "unmount") expect(result.current.domainData).toEqual(h.seed);
  });
  it("cancels both local owners when a guarded pop accepts an invalid collection address", async () => {
    const h = domainHarness(); const { result } = renderHook(() => useHomepageHost(h.options));
    act(() => { result.current.applyPeriod(selectedPeriod); result.current.applyHistory(selectedHistory); });
    await act(async () => {
      history.replaceState(null, "", "/trades?scope=live&market=all&accounts=gone&rangeMode=all");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.route).toMatchObject({ page: "trades", error: expect.stringContaining("账户") });
    expect(result.current.ui.requests.period).toBeNull(); expect(result.current.ui.requests.history).toBeNull();
    await act(async () => {
      h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("orphan") });
      h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: historyPackage("orphan") });
    });
    expect(result.current.domainData).toEqual(h.seed); expect(h.domainAccepted).not.toHaveBeenCalled();
  });
  it("keeps a local owner live when its route guard cancels", async () => {
    const h = domainHarness(); h.options.guard.mockResolvedValue(false); const { result } = renderHook(() => useHomepageHost(h.options));
    act(() => result.current.applyHistory(selectedHistory)); await act(() => result.current.openTrades(null));
    const fresh = historyPackage("still-home"); await act(async () => h.histories[0].reply.resolve({ request: h.histories[0].context.request, data: fresh }));
    expect(result.current.route.page).toBe("home"); expect(result.current.domainData?.history).toBe(fresh); expect(h.domainAccepted).toHaveBeenCalledOnce();
  });
  it("exposes inert local actions without domain configuration and performs no new IO", () => {
    const h = domainHarness(); const { domains, ...legacy } = h.options; void domains; const { result } = renderHook(() => useHomepageHost(legacy));
    act(() => {
      result.current.onPeriodDraft(selectedPeriod); result.current.onHistoryDraft(selectedHistory);
      expect(result.current.applyPeriod(selectedPeriod)).toBe(false); expect(result.current.applyHistory(selectedHistory)).toBe(false);
      expect(result.current.retryPeriodRead()).toBe(false); expect(result.current.retryHistoryRead()).toBe(false);
      result.current.cancelPeriodRead(); result.current.cancelHistoryRead();
    });
    expect(result.current.domainData).toBeNull(); expect(h.reload).not.toHaveBeenCalled(); expect(h.reloadPeriod).not.toHaveBeenCalled(); expect(h.reloadHistory).not.toHaveBeenCalled();
  });
});


describe("committed source composition seams", () => {
  it("captures each local previous domain from committed data despite ambient seed changes", async () => {
    const h = domainHarness();
    const { result, rerender } = renderHook(({ seed }) => useHomepageHost({ ...h.options, domains: { ...h.options.domains, seed } }), { initialProps: { seed: h.seed } });
    await waitFor(() => expect(result.current.initialized).toBe(true));
    rerender({ seed: { period: periodPackage("ambient"), history: historyPackage("ambient") } });
    act(() => result.current.applyPeriod(selectedPeriod));
    act(() => result.current.applyHistory(selectedHistory));
    expect(h.periods[0].context.previous).toBe(h.seed.period);
    expect(h.histories[0].context.previous).toBe(h.seed.history);
    await act(async () => h.periods[0].reply.resolve({ request: h.periods[0].context.request, data: periodPackage("accepted-local") }));
    act(() => result.current.applyPeriod({ preset: "custom", from: "2026-09-01", to: "2026-09-30" }));
    expect(h.periods[1].context.previous).toBe(result.current.domainData?.period);
    expect(h.periods[1].context.previous.revision).toBe("accepted-local");
    expect(h.histories[0].context.previous).toBe(h.seed.history);
  });

  it("extracts collection selection after fresh account fallback without publishing homepage finance", async () => {
    const old = createHomepageState({ live: true, market: "all", accounts: ["one"], rangeMode: "all" }).snapshot;
    old.attachments = { categories: ["stock"], openOnly: true, pendingReview: [] };
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", encodeHomepageSnapshot(old));
    history.replaceState(null, "", "/trades?scope=live&market=all&accounts=one&rangeMode=all");
    const h = domainHarness();
    const fromCollection = vi.fn((data: CurrentPackage, _context: HomepageHostReadContext, target: { accounts: string[] }) => ({ ...data, holdings: target.accounts.map(id => `selected:${id}`) }));
    const { result } = renderHook(() => useHomepageHost({ ...h.options, readOnInitialize: true, readCollections: true,
      catalogFor: () => ({ accounts: [{ id: "two", label: "two" }], identities: {} }), fromCollection }));
    await waitFor(() => expect(h.globals).toHaveLength(1));
    await act(async () => h.globals[0].reply.resolve({ requestId: h.globals[0].id, data: currentPackage("collection"), kind: "collection" }));
    expect(result.current.collectionData?.holdings).toEqual(["selected:*"]);
    expect(fromCollection.mock.calls[0][2]).toMatchObject({ accounts: ["*"], attachments: old.attachments });
    expect(result.current.domainData?.period).toBe(h.seed.period);
    expect(result.current.data).toBe(h.data);
    expect(h.globalAccepted.mock.calls[0][0]).toBe(result.current.collectionData);
  });

  it("rejects failed collection extraction before any data or acceptance notification", async () => {
    history.replaceState(null, "", "/trades");
    const h = domainHarness();
    const { result } = renderHook(() => useHomepageHost({ ...h.options, readOnInitialize: true, readCollections: true,
      fromCollection: () => { throw new Error("selection-source-invalid"); } }));
    await waitFor(() => expect(h.globals).toHaveLength(1));
    await act(async () => h.globals[0].reply.resolve({ requestId: h.globals[0].id, data: currentPackage("rejected"), kind: "collection" }));
    expect(result.current.route.error).toBe("selection-source-invalid");
    expect(result.current.collectionData).toBeNull();
    expect(result.current.data).toBe(h.data); expect(result.current.domainData).toBe(h.seed);
    expect(h.globalAccepted).not.toHaveBeenCalled();
  });
});
