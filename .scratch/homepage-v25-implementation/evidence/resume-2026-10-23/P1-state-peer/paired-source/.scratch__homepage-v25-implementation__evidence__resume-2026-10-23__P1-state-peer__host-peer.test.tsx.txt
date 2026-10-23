import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useHomepageHost } from "../../../../../app/components/homepage-v25/use-homepage-host";
import { createHomepageState, encodeHomepageSnapshot } from "../../../../../app/lib/reviews/homepage-v25-state";

const account = { id: "one", label: "实盘一" };
const all = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const storageKey = "tradereview:homepage-v25:source-ui:v2";

afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
  sessionStorage.clear(); history.replaceState(null, "", "/home");
});

describe("P1 independent state seam probes (not browser acceptance)", () => {
  it("explicit URL target remains authoritative over a different valid source snapshot", () => {
    const old = createHomepageState({ ...all, market: "a" });
    sessionStorage.setItem(storageKey, encodeHomepageSnapshot(old.snapshot));
    history.replaceState(null, "", "/home?scope=live&market=hk&accounts=*&rangeMode=all");
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: "initial", accounts: [account], identities: {}, reload: vi.fn(), guard: async () => true }));
    expect(result.current.initialized).toBe(true);
    expect(result.current.route.scope.market).toBe("hk");
    expect(result.current.ui.snapshot.scope.market).toBe("hk");
  });

  it("a timed-out request cannot publish its late owned result", async () => {
    vi.useFakeTimers();
    let reply!: (value: { requestId: number; data: string }) => void;
    const accepted = vi.fn();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: "initial", accounts: [account], identities: {}, guard: async () => true, onReadAccepted: accepted,
      reload: requestId => new Promise(resolve => { reply = data => resolve({ ...data, requestId }); }),
    }));
    act(() => result.current.onScope({ ...all, market: "hk" }));
    act(() => vi.advanceTimersByTime(15_020));
    expect(result.current.ui.errors.global).toBe("timeout");
    await act(async () => reply({ requestId: 1, data: "late" }));
    expect(result.current.data).toBe("initial");
    expect(result.current.ui.snapshot.scope.market).toBe("all");
    expect(accepted).not.toHaveBeenCalled();
  });

  it("must explain a saved account removed by the fresh return bootstrap", async () => {
    const source = createHomepageState({ ...all, accounts: [account.id] });
    sessionStorage.setItem(storageKey, encodeHomepageSnapshot(source.snapshot));
    history.replaceState(null, "", "/trades?scope=live&market=all&accounts=*&rangeMode=all");
    let reply!: (value: { requestId: number; data: string }) => void;
    const reload = (requestId: number) => new Promise<{ requestId: number; data: string }>(resolve => { reply = data => resolve({ ...data, requestId }); });
    const { result, rerender } = renderHook(({ accounts }) => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: "initial", accounts, identities: {}, reload, guard: async () => true }), { initialProps: { accounts: [account] } });
    await act(() => result.current.openHome());
    await act(async () => reply({ requestId: 1, data: "fresh-account-deleted" }));
    rerender({ accounts: [] });
    expect(result.current.notice ?? result.current.route.error ?? "").toContain("账户");
  });

  it("must pass an untagged same-document back/forward entry through the leave guard", () => {
    const guard = vi.fn(async () => false);
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: "initial", accounts: [account], identities: {}, reload: vi.fn(), guard }));
    expect(result.current.initialized).toBe(true);
    history.replaceState(null, "", "/trades?scope=live&market=all&accounts=*&rangeMode=all");
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(guard).toHaveBeenCalledWith("trades");
  });

  it("must preserve the accepted fresh FX when workspace publishes its rebuilt options.data", async () => {
    type Bundle = { entries: string; fxSnapshot: string };
    const initial: Bundle = { entries: "old-entries", fxSnapshot: "old-fx" };
    let reply!: (value: { requestId: number; data: Bundle }) => void;
    const reload = (requestId: number) => new Promise<{ requestId: number; data: Bundle }>(resolve => { reply = data => resolve({ ...data, requestId }); });
    const { result } = renderHook(() => {
      const [externalData, setExternalData] = useState(initial);
      return useHomepageHost({ enabled: true, ready: true, revision: 1,
        data: externalData, accounts: [account], identities: {}, reload, guard: async () => true,
        // Matches workspace's onReadAccepted path: it updates entries/market states,
        // while homepageData still derives FX from the separate useFxRates state.
        onReadAccepted: fresh => setExternalData({ entries: fresh.entries, fxSnapshot: initial.fxSnapshot }),
      });
    });
    act(() => result.current.onScope({ ...all, market: "hk" }));
    await act(async () => reply({ requestId: 1, data: { entries: "fresh-entries", fxSnapshot: "fresh-fx" } }));
    expect(result.current.ui.snapshot.scope.market).toBe("hk");
    expect(result.current.data.entries).toBe("fresh-entries");
    expect(result.current.data.fxSnapshot).toBe("fresh-fx");
  });

  it("must clear an invalid direct-home route error after a valid account correction succeeds", async () => {
    history.replaceState(null, "", "/home?scope=live&market=all&accounts=gone&rangeMode=all");
    let reply!: (value: { requestId: number; data: string }) => void;
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, revision: 1,
      data: "initial", accounts: [account], identities: {}, guard: async () => true,
      reload: requestId => new Promise(resolve => { reply = data => resolve({ ...data, requestId }); }),
    }));
    expect(result.current.route.error).toContain("账户");
    act(() => result.current.onScope({ ...all, accounts: [account.id] }));
    await act(async () => reply({ requestId: 1, data: "corrected" }));
    expect(result.current.ui.snapshot.scope.accounts).toEqual([account.id]);
    expect(location.search).toContain("accounts=one");
    expect(result.current.route.error).toBeNull();
    expect(result.current.route.scope.accounts).toEqual([account.id]);
  });
});
