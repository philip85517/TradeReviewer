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

  it("R03b retries a failed return with its captured full UI even without an intervening UI callback", async () => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    await fail(current.reads[1]);
    expectStored(source.bytes);
    act(() => current.host.result.current.reload());
    await succeed(current.reads[2], "retry-without-ui-callback");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
    expect(current.accepted).toHaveBeenCalledExactlyOnceWith("retry-without-ui-callback");
  });

  it.each(["resolve", "reject"])("R04 preserves recovery through timeout and ignores a late old %s during retry", async late => {
    vi.useFakeTimers();
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const timedOutToken = current.host.result.current.ui.requests.global!;
    await act(async () => vi.advanceTimersByTime(15_010));
    expect(current.host.result.current.ui.requests.global).toBeNull();
    expect(current.host.result.current.ui.errors.global).toBe("timeout");
    act(() => current.host.result.current.onUi({ scrollTop: 25 }));
    expectStored(source.bytes);
    act(() => current.host.result.current.reload());
    const retry = current.host.result.current.ui.requests.global!;
    expect(retry.generation).toBeGreaterThan(timedOutToken.generation);
    expect(retry).toMatchObject({ purpose: "navigation", target: SOURCE_SCOPE });
    if (late === "resolve") await succeed(current.reads[1], "late-timed-out-bundle");
    else await fail(current.reads[1]);
    expect(current.host.result.current.ui.requests.global).toEqual(retry);
    expect(current.accepted).not.toHaveBeenCalled();
    act(() => current.host.result.current.onUi({ scrollTop: 33 }));
    expectStored(source.bytes);
    await succeed(current.reads[2], "manual-timeout-retry-owned");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
    expect(current.host.result.current.data).toBe("manual-timeout-retry-owned");
    expect(current.accepted).toHaveBeenCalledExactlyOnceWith("manual-timeout-retry-owned");
  });

  it.each(["failure", "timeout"])("R06 leaves %s recovery manual despite focus/visibility and resumes normal refresh after acceptance", async mode => {
    vi.useFakeTimers();
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    if (mode === "failure") await fail(current.reads[1]);
    else await act(async () => vi.advanceTimersByTime(15_010));
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(current.reads).toHaveLength(2);
    expect(current.host.result.current.ui.requests.global).toBeNull();
    expectStored(source.bytes);
    act(() => current.host.result.current.reload());
    expect(current.host.result.current.ui.requests.global).toMatchObject({ purpose: "navigation", target: SOURCE_SCOPE });
    await succeed(current.reads[2], "manual-owned");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
    act(() => current.host.result.current.onUi({ scrollTop: 201 }));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(current.reads).toHaveLength(4);
    expect(current.host.result.current.ui.requests.global).toMatchObject({ purpose: "refresh", target: SOURCE_SCOPE });
    await succeed(current.reads[3], "normal-focus-owned");
    expect(current.host.result.current.ui.snapshot.scrollTop).toBe(201);
    expect(current.host.result.current.ui.snapshot.search).toEqual(source.snapshot.search);
    expect(current.accepted.mock.calls.map(call => call[0])).toEqual(["manual-owned", "normal-focus-owned"]);
  });

  it("R07 protects full source when its scope equals the old committed scope but its search, page and focus differ", async () => {
    const source = seed({ live: true, market: "all", accounts: ["*"], rangeMode: "all" }); const current = mount();
    await fail(current.reads[0]);
    await act(() => current.host.result.current.openHome());
    expect(current.host.result.current.ui.snapshot.scope).toEqual(source.snapshot.scope);
    expect(current.host.result.current.ui.snapshot.search.query).toBe("");
    act(() => current.host.result.current.onUi({ scrollTop: 25, focus: "holdings" }));
    expectStored(source.bytes);
    await succeed(current.reads[1], "same-scope-fresh");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
  });

  it.each(["scoped", "global"])("R08 keeps protected source when an allowed %s departure captures its outgoing entry", async mode => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const commit = vi.fn();
    await act(() => mode === "global" ? current.host.result.current.openGlobalTrades(commit) : current.host.result.current.openTrades(IDENTITY));
    // Target scope still comes from the existing committed snapshot; protecting
    // source bytes does not pre-apply the pending return's target to the URL.
    expect(current.host.result.current.route.collectionOrigin).toBe(mode === "global" ? "global" : "homepage");
    expect(current.host.result.current.route.scope.market).toBe("all");
    if (mode === "global") { expect(location.pathname + location.search).toBe("/trades"); expect(commit).toHaveBeenCalledTimes(1); }
    else expect(new URL(location.href).searchParams.get("symbol")).toBe(IDENTITY);
    expectStored(source.bytes);
    await succeed(current.reads[1], "pending-read-settled-away");
    await act(() => current.host.result.current.openHome());
    await succeed(current.reads[2], "return-after-departure");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
  });

  it.each(["cancel", "throw"])("R08 keeps URL, source and commit unchanged when the outgoing global guard %s", async mode => {
    const guard = vi.fn(async () => true);
    const source = seed(); const current = mount(guard);
    await returnAfterColdFailure(current);
    const entry = history.state; const token = current.host.result.current.ui.requests.global;
    const commit = vi.fn();
    guard.mockImplementationOnce(async () => { if (mode === "throw") throw new Error("save failed"); return false; });
    await act(async () => expect(await current.host.result.current.openGlobalTrades(commit)).toBe(false));
    expect(location.pathname + location.search).toBe("/home");
    expect(history.state).toEqual(entry);
    expect(current.host.result.current.ui.requests.global).toEqual(token);
    expect(commit).not.toHaveBeenCalled();
    expectStored(source.bytes);
    await succeed(current.reads[1], "after-cancel");
    expect(current.host.result.current.ui.snapshot).toEqual(source.snapshot);
  });

  it("R08 commits only the newest allowed departure and never replaces protected source with the old committed UI", async () => {
    let hold = false;
    const approvals: Array<(allowed: boolean) => void> = [];
    const guard = async () => hold ? new Promise<boolean>(resolve => approvals.push(resolve)) : true;
    const source = seed(); const current = mount(guard);
    await returnAfterColdFailure(current);
    hold = true;
    const commit = vi.fn();
    let old!: Promise<boolean>; let latest!: Promise<boolean>;
    act(() => { old = current.host.result.current.openTrades(IDENTITY); latest = current.host.result.current.openGlobalTrades(commit); });
    await act(async () => { approvals[1](true); expect(await latest).toBe(true); });
    const entry = history.state;
    await act(async () => { approvals[0](true); expect(await old).toBe(false); });
    expect(history.state).toEqual(entry);
    expect(location.pathname + location.search).toBe("/trades");
    expect(commit).toHaveBeenCalledTimes(1);
    expectStored(source.bytes);
  });

  it.each(["resolve", "reject"])("R09 lets explicit identity B commit its owned bundle while late A %s cannot release its source protection", async late => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const targetB: HomepageScope = { live: true, market: "hk", accounts: ["one"], rangeMode: "all" };
    act(() => current.host.result.current.onScope(targetB));
    const tokenB = current.host.result.current.ui.requests.global;
    if (late === "resolve") await succeed(current.reads[1], "late-A"); else await fail(current.reads[1]);
    expect(current.host.result.current.ui.requests.global).toEqual(tokenB);
    act(() => current.host.result.current.onUi({ scrollTop: 41 }));
    expectStored(source.bytes);
    expect(current.accepted).not.toHaveBeenCalled();
    await succeed(current.reads[2], "B-owned");
    expect(current.host.result.current.ui.snapshot.scope).toEqual(targetB);
    expect(current.host.result.current.ui.snapshot.search.query).not.toBe("ROKU");
    expect(current.host.result.current.data).toBe("B-owned");
    expect(current.accepted).toHaveBeenCalledExactlyOnceWith("B-owned");
    act(() => current.host.result.current.onUi({ scrollTop: 225 }));
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!);
    expect(stored.scope).toEqual(targetB);
    expect(stored.scrollTop).toBe(225);
    expect(history.state.hpSource).toBe(sessionStorage.getItem(STORAGE_KEY));
  });

  it("R09 retains protected source after explicit identity B failure but retries identity B without restoring source A", async () => {
    const source = seed(); const current = mount();
    await returnAfterColdFailure(current);
    const targetB: HomepageScope = { live: true, market: "hk", accounts: ["one"], rangeMode: "all" };
    act(() => current.host.result.current.onScope(targetB));
    const oldB = current.host.result.current.ui.requests.global!;
    await fail(current.reads[2]);
    act(() => current.host.result.current.onUi({ scrollTop: 42 }));
    expectStored(source.bytes);
    act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(current.reads).toHaveLength(3);
    act(() => current.host.result.current.reload());
    const retry = current.host.result.current.ui.requests.global!;
    expect(retry.generation).toBeGreaterThan(oldB.generation);
    expect(retry).toMatchObject({ purpose: "identity", target: targetB });
    await succeed(current.reads[1], "late-A-after-B-failed");
    expect(current.host.result.current.ui.requests.global).toEqual(retry);
    await succeed(current.reads[3], "B-retry-owned");
    expect(current.host.result.current.ui.snapshot.scope).toEqual(targetB);
    expect(current.host.result.current.ui.snapshot.search.query).not.toBe("ROKU");
    expect(current.host.result.current.data).toBe("B-retry-owned");
    expect(current.accepted).toHaveBeenCalledExactlyOnceWith("B-retry-owned");
  });
});
