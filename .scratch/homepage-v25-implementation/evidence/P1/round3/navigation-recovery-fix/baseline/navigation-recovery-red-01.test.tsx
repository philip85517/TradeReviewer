import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHomepageState, encodeHomepageSnapshot, type HomepageScope } from "../../lib/reviews/homepage-v25-state";
import { useHomepageHost } from "./use-homepage-host";

const STORAGE_KEY = "tradereview:homepage-v25:source-ui:v3";
const IDENTITY = "NASDAQ:ROKU:stock";
const SOURCE_SCOPE: HomepageScope = { live: true, market: "a", accounts: ["one"], rangeMode: "date", date: "2026-10-22" };
const TARGET_URL = `/trades?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22&symbol=${encodeURIComponent(IDENTITY)}`;
const accounts = [{ id: "one", label: "实盘一" }];
const identities = { [IDENTITY]: ["US:ROKU"] };
type Read = { id: number; resolve: (result: { requestId: number; data: string }) => void; reject: (error: Error) => void };

function seed(scope: HomepageScope = SOURCE_SCOPE) {
  const snapshot = createHomepageState(scope).snapshot;
  snapshot.holdings = { query: "来源持仓", sort: "name-desc", page: 2 };
  snapshot.search = { query: "ROKU", open: true, resultsScrollTop: 73, selectedSymbol: IDENTITY, triggerFocusId: "hp-symbol-search" };
  snapshot.returnState = { source: "detail", container: "search", detailId: IDENTITY, triggerFocusId: "hp-symbol-search", missingContainerTitle: "证券搜索" };
  snapshot.scrollTop = 186;
  snapshot.focus = "search";
  const bytes = encodeHomepageSnapshot(snapshot);
  sessionStorage.setItem(STORAGE_KEY, bytes);
  history.replaceState({ hpV25: true, hpIndex: 7, hpSource: bytes }, "", TARGET_URL);
  return { snapshot, bytes };
}

function mount(guard: (page: "home" | "trades") => Promise<boolean> = async () => true) {
  const reads: Read[] = [];
  const accepted = vi.fn();
  const host = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1,
    data: "seed-only", accounts, identities, catalogFor: () => ({ accounts, identities }),
    reload: requestId => new Promise((resolve, reject) => reads.push({ id: requestId, resolve, reject })),
    onReadAccepted: accepted, guard,
  }));
  return { host, reads, accepted };
}
async function succeed(read: Read, data: string) { await act(async () => read.resolve({ requestId: read.id, data })); }
async function fail(read: Read) { await act(async () => read.reject(new Error("owned-FX-read-failed"))); }
function expectStored(bytes: string) {
  expect(history.state.hpSource).toBe(bytes);
  expect(sessionStorage.getItem(STORAGE_KEY)).toBe(bytes);
}
async function returnAfterColdFailure(current: ReturnType<typeof mount>) {
  await fail(current.reads[0]);
  expect(current.host.result.current.initialized).toBe(true);
  expect(current.host.result.current.data).toBe("seed-only");
  expect(current.host.result.current.ui.snapshot.scope.market).toBe("all");
  await act(() => current.host.result.current.openHome());
  expect(location.pathname + location.search).toBe("/home");
  expect(current.host.result.current.ui.requests.global).toMatchObject({ purpose: "navigation", target: SOURCE_SCOPE });
}

afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home");
});

describe("homepage source recovery ownership", () => {
  it("R01 preserves source bytes through a pending UI callback and hard remount, then accepts fresh owned data", async () => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const token = current.host.result.current.ui.requests.global;
    act(() => current.host.result.current.onUi({ scrollTop: 25, search: { ...current.host.result.current.ui.snapshot.search, open: true } }));
    expect(current.host.result.current.ui.snapshot.scope.market).toBe("all");
    expect(current.host.result.current.data).toBe("seed-only");
    expect(current.host.result.current.ui.requests.global).toEqual(token);
    expectStored(source.bytes);
    current.host.unmount();
    const reloaded = mount();
    expect(reloaded.host.result.current.ui.snapshot).toEqual(source.snapshot);
    await succeed(reloaded.reads[0], "fresh-after-hard-remount");
    expect(reloaded.host.result.current.ui.snapshot).toEqual(source.snapshot);
    expect(reloaded.host.result.current.data).toBe("fresh-after-hard-remount");
    expect(reloaded.accepted).toHaveBeenCalledExactlyOnceWith("fresh-after-hard-remount");
    expect(new URL(location.href).searchParams.get("date")).toBe("2026-10-22");
    expectStored(source.bytes);
  });

  it("R03 retains full source after return failure and retries the same navigation with a new generation", async () => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const oldToken = current.host.result.current.ui.requests.global!;
    await fail(current.reads[1]);
    act(() => current.host.result.current.onUi({ scrollTop: 25 }));
    expectStored(source.bytes);
    act(() => current.host.result.current.reload());
    const retry = current.host.result.current.ui.requests.global!;
    expect(retry.generation).toBeGreaterThan(oldToken.generation);
    expect(retry).toMatchObject({ purpose: "navigation", target: SOURCE_SCOPE, scopeKey: oldToken.scopeKey });
    expect(current.host.result.current.ui.snapshot.scope.market).toBe("all");
    await succeed(current.reads[2], "retry-owned-FX-and-entries");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
    expect(current.host.result.current.data).toBe("retry-owned-FX-and-entries");
    expect(current.accepted).toHaveBeenCalledExactlyOnceWith("retry-owned-FX-and-entries");
    expectStored(source.bytes);
  });

  it("R05 deduplicates reload during source navigation instead of refreshing the old committed scope", async () => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const token = current.host.result.current.ui.requests.global;
    act(() => current.host.result.current.reload());
    expect(current.reads).toHaveLength(2);
    expect(current.host.result.current.ui.requests.global).toEqual(token);
    expect(current.host.result.current.ui.snapshot.scope.market).toBe("all");
    expectStored(source.bytes);
    await succeed(current.reads[1], "original-navigation-owned");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
    expect(current.host.result.current.data).toBe("original-navigation-owned");
    expect(current.accepted).toHaveBeenCalledExactlyOnceWith("original-navigation-owned");
  });
});
