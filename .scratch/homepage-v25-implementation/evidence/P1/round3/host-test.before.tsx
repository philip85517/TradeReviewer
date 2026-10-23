import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHomepageHost } from "./use-homepage-host";

afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home"); });
const catalog = [{ id: "one", label: "实盘一" }];
describe("homepage workspace host", () => {
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
