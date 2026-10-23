import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHomepageHost } from "../../../../../app/components/homepage-v25/use-homepage-host";
import { createHomepageState, encodeHomepageSnapshot } from "../../../../../app/lib/reviews/homepage-v25-state";

const one = { id: "one", label: "实盘一" };
const two = { id: "two", label: "实盘二" };
const all = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const storageKey = "tradereview:homepage-v25:source-ui:v2";
type Bundle = { rows: string; fx: { asOf: string; rate: number; missingPairs: string[] }; accounts: typeof one[]; identities: Record<string, string> };
const old: Bundle = { rows: "old", fx: { asOf: "A", rate: 1, missingPairs: ["USD/CNY"] }, accounts: [one, two], identities: { "SSE:600000": "instrument-one" } };
const fresh: Bundle = { rows: "fresh", fx: { asOf: "B", rate: 7, missingPairs: [] }, accounts: [one, two], identities: { "SSE:600000": "instrument-one" } };
const catalogFor = (data: Bundle) => ({ accounts: data.accounts, identities: data.identities });

function deferredReads() {
  const pending: Array<{ requestId: number; resolve: (data: Bundle, responseId?: number) => void; reject: (error: Error) => void }> = [];
  const reload = vi.fn((requestId: number) => new Promise<{ requestId: number; data: Bundle }>((resolve, reject) => {
    pending.push({ requestId, resolve: (data, responseId = requestId) => resolve({ requestId: responseId, data }), reject });
  }));
  return { pending, reload };
}

afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home");
});

describe("P1 frozen-version additional owned-read probes; not real-browser acceptance", () => {
  it("PS07 waits for ready, then replaces the initial seed through exactly one owned complete bundle", async () => {
    const reads = deferredReads(); const accepted = vi.fn();
    const { result, rerender } = renderHook(({ ready }) => useHomepageHost({ enabled: true, ready, readOnInitialize: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, onReadAccepted: accepted, guard: async () => true,
    }), { initialProps: { ready: false } });
    expect(result.current.initialized).toBe(false); expect(reads.reload).not.toHaveBeenCalled();
    rerender({ ready: true });
    expect(reads.reload).toHaveBeenCalledTimes(1); expect(result.current.data).toBe(old);
    expect(result.current.ui.requests.global).not.toBeNull();
    await act(async () => reads.pending[0].resolve(fresh));
    expect(result.current.data).toBe(fresh); expect(result.current.ui.requests.global).toBeNull();
    expect(accepted).toHaveBeenCalledExactlyOnceWith(fresh);
    rerender({ ready: true }); expect(reads.reload).toHaveBeenCalledTimes(1);
  });

  it("PS08 commits all FX facts with B while superseded A and external seed changes cannot overwrite it", async () => {
    const reads = deferredReads(); const accepted = vi.fn();
    const { result, rerender } = renderHook(({ data }) => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, onReadAccepted: accepted, guard: async () => true,
    }), { initialProps: { data: old } });
    act(() => result.current.onScope({ ...all, market: "a" }));
    act(() => result.current.onScope({ ...all, market: "hk" }));
    rerender({ data: { ...old, rows: "unowned-workspace-publication" } });
    expect(result.current.data).toBe(old); expect(result.current.ui.snapshot.scope.market).toBe("all");
    await act(async () => reads.pending[1].resolve(fresh));
    await act(async () => reads.pending[0].resolve({ ...old, rows: "late-A" }));
    rerender({ data: { ...old, rows: "workspace-rows-B-fx-A" } });
    expect(result.current.ui.snapshot.scope.market).toBe("hk");
    expect(result.current.data).toBe(fresh);
    expect(result.current.data.fx).toEqual({ asOf: "B", rate: 7, missingPairs: [] });
    expect(accepted).toHaveBeenCalledExactlyOnceWith(fresh);
  });

  it("PS09 focus asks for a new owned read and retains B atomically until C succeeds", async () => {
    const reads = deferredReads();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, guard: async () => true,
    }));
    await act(async () => reads.pending[0].resolve(fresh));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(reads.reload).toHaveBeenCalledTimes(2); expect(result.current.data).toBe(fresh);
    const newer: Bundle = { ...fresh, rows: "newer", fx: { asOf: "C", rate: 8, missingPairs: ["HKD/CNY"] } };
    await act(async () => reads.pending[1].resolve(newer));
    expect(result.current.data).toBe(newer); expect(result.current.ui.requests.global).toBeNull();
  });

  it("PS10 cancelled leave keeps the address, source snapshot and accepted bundle unchanged", async () => {
    const reads = deferredReads(); const guard = vi.fn(async () => false);
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, guard,
    }));
    act(() => result.current.onUi({ holdings: { query: "原搜索", sort: "name-desc", page: 2 }, scrollTop: 290 }));
    const bytes = sessionStorage.getItem(storageKey); const address = location.href; const historyBytes = JSON.stringify(history.state);
    await act(() => result.current.openTrades("SSE:600000"));
    expect(guard).toHaveBeenCalledExactlyOnceWith("trades"); expect(reads.reload).not.toHaveBeenCalled();
    expect(location.href).toBe(address); expect(JSON.stringify(history.state)).toBe(historyBytes);
    expect(sessionStorage.getItem(storageKey)).toBe(bytes); expect(result.current.data).toBe(old);
    expect(result.current.route.page).toBe("home"); expect(result.current.ui.snapshot.holdings.query).toBe("原搜索");
  });

  it("PS11 an obsolete rejection cannot cancel B or replace its pending state", async () => {
    const reads = deferredReads(); const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, onReadAccepted: accepted, guard: async () => true,
    }));
    act(() => result.current.onScope({ ...all, market: "a" }));
    act(() => result.current.onScope({ ...all, market: "hk" }));
    const requestB = result.current.ui.requests.global;
    await act(async () => reads.pending[0].reject(new Error("obsolete-abort")));
    expect(result.current.ui.requests.global).toEqual(requestB); expect(result.current.ui.errors.global).toBeNull();
    expect(result.current.data).toBe(old); expect(accepted).not.toHaveBeenCalled();
    await act(async () => reads.pending[1].resolve(fresh));
    expect(result.current.data).toBe(fresh); expect(result.current.ui.snapshot.scope.market).toBe("hk");
  });

  it("PS12 a wrong response owner cannot satisfy the current request", async () => {
    const reads = deferredReads(); const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, onReadAccepted: accepted, guard: async () => true,
    }));
    act(() => result.current.onScope({ ...all, market: "hk" }));
    await act(async () => reads.pending[0].resolve(fresh, reads.pending[0].requestId + 1));
    expect(result.current.data).toBe(old); expect(result.current.ui.snapshot.scope.market).toBe("all");
    expect(result.current.ui.requests.global).not.toBeNull(); expect(accepted).not.toHaveBeenCalled();
  });

  it("PS13 fresh return account deletion preserves remaining valid accounts and non-scope UI", async () => {
    const reads = deferredReads();
    const source = createHomepageState({ ...all, accounts: [one.id, two.id] });
    source.snapshot.holdings = { query: "保留搜索", sort: "name-desc", page: 2 }; source.snapshot.scrollTop = 777;
    sessionStorage.setItem(storageKey, encodeHomepageSnapshot(source.snapshot));
    history.replaceState(null, "", "/trades?scope=live&market=all&accounts=*&rangeMode=all");
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, guard: async () => true,
    }));
    await act(() => result.current.openHome());
    const deleted = { ...fresh, accounts: [two] };
    await act(async () => reads.pending[0].resolve(deleted));
    expect(result.current.data).toBe(deleted); expect(result.current.ui.snapshot.scope.accounts).toEqual([two.id]);
    expect(result.current.ui.snapshot.holdings).toEqual(source.snapshot.holdings); expect(result.current.ui.snapshot.scrollTop).toBe(777);
    expect(result.current.notice).toContain("账户"); expect(result.current.route.error).toBeNull();
  });

  it("PS14 a directly requested account removed by its own fresh catalog fails without widening or publishing data", async () => {
    const reads = deferredReads(); const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, onReadAccepted: accepted, guard: async () => true,
    }));
    act(() => result.current.onScope({ ...all, accounts: [one.id] }));
    await act(async () => reads.pending[0].resolve({ ...fresh, accounts: [two] }));
    expect(result.current.data).toBe(old); expect(result.current.ui.snapshot.scope.accounts).toEqual(["*"]);
    expect(result.current.ui.errors.global).toContain("账户"); expect(accepted).not.toHaveBeenCalled();
  });

  it("PS15 a direct symbol removed by the first owned catalog cannot silently become an unfiltered accepted read", async () => {
    history.replaceState(null, "", "/home?scope=live&market=all&accounts=*&rangeMode=all&symbol=SSE%3A600000");
    const reads = deferredReads(); const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1,
      data: old, accounts: old.accounts, identities: old.identities, catalogFor, reload: reads.reload, onReadAccepted: accepted, guard: async () => true,
    }));
    expect(result.current.route.error).toBeNull(); expect(reads.reload).toHaveBeenCalledTimes(1);
    await act(async () => reads.pending[0].resolve({ ...fresh, identities: {} }));
    expect(result.current.data).toBe(old); expect(accepted).not.toHaveBeenCalled();
    expect(result.current.ui.errors.global ?? result.current.route.error ?? "").toMatch(/证券|标的/);
    expect(location.search).toContain("symbol=SSE%3A600000");
  });
});
