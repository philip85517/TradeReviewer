import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHomepageState, encodeHomepageSnapshot, type HomepageScope } from "../../lib/reviews/homepage-v25-state";
import { useHomepageHost } from "./use-homepage-host";

const START = Date.parse("2026-10-23T01:00:00.000Z");
const STORAGE_KEY = "tradereview:homepage-v25:source-ui:v3";
const SOURCE_SCOPE: HomepageScope = { live: true, market: "a", accounts: ["one"], rangeMode: "date", date: "2026-10-22" };
const accounts = [{ id: "one", label: "实盘一" }];

function mountOwnedRead() {
  const snapshot = createHomepageState(SOURCE_SCOPE).snapshot;
  snapshot.holdings = { query: "来源持仓", sort: "name-desc", page: 2 };
  snapshot.scrollTop = 186;
  const source = encodeHomepageSnapshot(snapshot);
  sessionStorage.setItem(STORAGE_KEY, source);
  history.replaceState({ hpV25: true, hpIndex: 0, hpSource: source }, "", "/home?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22");
  const reads: number[] = [];
  const host = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1,
    data: "seed-only", accounts, identities: {}, catalogFor: () => ({ accounts, identities: {} }),
    // Hold only the external owned read; host, session, S, history and storage are real.
    reload: requestId => { reads.push(requestId); return new Promise<{ requestId: number; data: string }>(() => {}); },
    guard: async () => true,
  }));
  const token = host.result.current.ui.requests.global;
  if (!token) throw new Error("Expected an initial owned navigation request");
  expect(token.purpose).toBe("navigation");
  expect(token.startedAt).toBe(START);
  return { host, token, reads, source };
}

async function advance(ms: number) { await act(async () => vi.advanceTimersByTime(ms)); }

function trace(label: string, current: ReturnType<typeof mountOwnedRead>) {
  const request = current.host.result.current.ui.requests.global;
  console.info("[navigation-deadline]", JSON.stringify({ label, elapsedMs: Date.now() - START,
    request: request && { generation: request.generation, startedAt: request.startedAt, purpose: request.purpose, target: request.target },
    error: current.host.result.current.ui.errors.global, timedOut: current.host.result.current.ui.timeouts.global,
    data: current.host.result.current.data, reads: current.reads,
  }));
}

type SynchronousStage = "catalog" | "extractor";
function mountConfiguredRead(page: "home" | "trades" = "home") {
  const source = encodeHomepageSnapshot(createHomepageState(SOURCE_SCOPE).snapshot);
  sessionStorage.setItem(STORAGE_KEY, source);
  history.replaceState({ hpV25: true, hpIndex: 0, hpSource: source }, "", `/${page}?scope=live&market=a&accounts=one&rangeMode=date&date=2026-10-22`);
  const replies: Array<{ requestId: number; resolve: (result: { requestId: number; data: string; kind?: "collection" }) => void }> = [];
  let block: { stage: SynchronousStage; finishAt: number } | null = null;
  const finishWork = (stage: SynchronousStage) => {
    // Blocking synchronous work consumes wall time without yielding to timers.
    if (block?.stage === stage) vi.setSystemTime(block.finishAt);
  };
  const fromGlobal = vi.fn((data: string) => {
    finishWork("extractor");
    return { period: `${data}:period`, history: `${data}:history` };
  });
  const accepted = vi.fn();
  const publications: string[] = [];
  const host = renderHook(() => {
    const value = useHomepageHost<string, string, string>({ enabled: true, ready: true, readOnInitialize: true, readCollections: true,
      revision: 1, data: "seed", accounts, identities: {},
      catalogFor: () => { finishWork("catalog"); return { accounts, identities: {} }; },
      reload: requestId => new Promise(resolve => { replies.push({ requestId, resolve }); }),
      guard: async () => true, onReadAccepted: accepted,
      domains: { seed: { period: "seed:period", history: "seed:history" }, fromGlobal,
        reloadPeriod: async context => ({ request: context.request, data: "local:period" }),
        reloadHistory: async context => ({ request: context.request, data: "local:history" }),
      },
    });
    publications.push(value.data);
    return value;
  });
  return { host, source, replies, fromGlobal, accepted, publications,
    blockAt: (stage: SynchronousStage, finishAt: number) => { block = { stage, finishAt }; },
    unblock: () => { block = null; },
    resolve: async (index: number, data: string, kind?: "collection") => {
      await act(async () => { const reply = replies[index]; reply.resolve({ requestId: reply.requestId, data, ...(kind ? { kind } : {}) }); });
    },
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(START); });
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home");
});

describe("homepage absolute owned-read deadline", () => {
  // Regression: scheduling a fresh 15s timer for a UI-only state update extends an existing request.
  it("D01 times out at the original deadline after a UI patch at ten seconds", async () => {
    const current = mountOwnedRead();
    trace("D01-start", current);
    await advance(10_000);
    act(() => current.host.result.current.onUi({ scrollTop: 25 }));
    expect(current.host.result.current.ui.requests.global).toEqual(current.token);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(current.source);
    trace("D01-after-ui", current);
    await advance(5_010);
    trace("D01-original-deadline", current);
    expect(current.host.result.current.ui.requests.global).toBeNull();
    expect(current.host.result.current.ui.errors.global).toBe("timeout");
    expect(current.host.result.current.ui.timeouts.global).toBe(true);
    expect(current.host.result.current.data).toBe("seed-only");
    expect(history.state.hpSource).toBe(current.source);
  });

  it("D02 repeated UI patches cannot prolong one request beyond its original deadline", async () => {
    const current = mountOwnedRead();
    for (const [elapsed, scrollTop] of [[3_000, 25], [6_000, 33], [9_000, 41], [12_000, 49], [14_900, 57]]) {
      await advance(elapsed - (Date.now() - START));
      act(() => current.host.result.current.onUi({ scrollTop }));
      expect(current.host.result.current.ui.requests.global).toEqual(current.token);
      expect(current.host.result.current.data).toBe("seed-only");
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe(current.source);
      trace(`D02-ui-${elapsed}`, current);
    }
    await advance(110);
    trace("D02-original-deadline", current);
    expect(current.host.result.current.ui.requests.global).toBeNull();
    expect(current.host.result.current.ui.errors.global).toBe("timeout");
    expect(current.host.result.current.ui.timeouts.global).toBe(true);
    expect(history.state.hpSource).toBe(current.source);
  });

  it("D03 a UI patch retains the same logical request and its original start time", async () => {
    const current = mountOwnedRead();
    await advance(10_000);
    act(() => current.host.result.current.onUi({ scrollTop: 25 }));
    const request = current.host.result.current.ui.requests.global;
    expect(request).toEqual(current.token);
    expect(request?.generation).toBe(current.token.generation);
    expect(request?.scopeKey).toBe(current.token.scopeKey);
    expect(request?.startedAt).toBe(START);
    expect(current.host.result.current.ui.requestCounter).toBe(current.token.generation);
    expect(current.host.result.current.ui.errors.global).toBeNull();
    trace("D03-same-logical-request", current);
  });

  it("D04 an untouched owned request reaches timeout at fifteen seconds", async () => {
    const current = mountOwnedRead();
    await advance(14_999);
    expect(current.host.result.current.ui.requests.global).toEqual(current.token);
    expect(current.host.result.current.ui.errors.global).toBeNull();
    await advance(11);
    trace("D04-untouched-deadline", current);
    expect(current.host.result.current.ui.requests.global).toBeNull();
    expect(current.host.result.current.ui.errors.global).toBe("timeout");
    expect(current.host.result.current.ui.timeouts.global).toBe(true);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(current.source);
  });

  it("D05 a newer identity generation receives its own full fifteen-second window", async () => {
    const current = mountOwnedRead();
    await advance(10_000);
    const targetB: HomepageScope = { live: true, market: "hk", accounts: ["one"], rangeMode: "all" };
    act(() => current.host.result.current.onScope(targetB));
    const requestB = current.host.result.current.ui.requests.global;
    expect(requestB?.generation).toBeGreaterThan(current.token.generation);
    expect(requestB?.purpose).toBe("identity");
    expect(requestB?.startedAt).toBe(START + 10_000);
    expect(current.host.result.current.ui.draft.market).toBe("hk");
    await advance(5_010);
    expect(current.host.result.current.ui.requests.global).toEqual(requestB);
    expect(current.host.result.current.ui.errors.global).toBeNull();
    trace("D05-old-generation-deadline", current);
    await advance(9_989);
    expect(Date.now() - START).toBe(24_999);
    expect(current.host.result.current.ui.requests.global).toEqual(requestB);
    expect(current.host.result.current.ui.errors.global).toBeNull();
    await advance(11);
    trace("D05-new-generation-deadline", current);
    expect(current.host.result.current.ui.requests.global).toBeNull();
    expect(current.host.result.current.ui.errors.global).toBe("timeout");
    expect(current.host.result.current.ui.timeouts.global).toBe(true);
    expect(current.host.result.current.data).toBe("seed-only");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(current.source);
  });
});

describe("configured homepage checks its deadline after synchronous work", () => {
  it.each([
    { stage: "catalog" as const, finished: 15_000 }, { stage: "catalog" as const, finished: 15_001 },
    { stage: "extractor" as const, finished: 15_000 }, { stage: "extractor" as const, finished: 15_001 },
  ])("D06 keeps the accepted bundle when $stage returns at $finished ms", async ({ stage, finished }) => {
    const h = mountConfiguredRead();
    await h.resolve(0, "old-accepted");
    const old = h.host.result.current;
    const oldAddress = location.href; const oldSource = history.state.hpSource;
    act(() => h.host.result.current.onScope({ live: true, market: "hk", accounts: ["one"], rangeMode: "all" }));
    expect(h.host.result.current.ui.requests.global?.startedAt).toBe(START);
    vi.setSystemTime(START + 14_999); h.blockAt(stage, START + finished);
    await h.resolve(1, "expired-new");
    expect(h.host.result.current.ui.errors.global).toBe("timeout");
    expect(h.host.result.current.ui.timeouts.global).toBe(true);
    expect(h.host.result.current.ui.requests.global).toBeNull();
    expect(h.host.result.current.data).toBe("old-accepted");
    expect(h.host.result.current.domainData).toEqual({ period: "old-accepted:period", history: "old-accepted:history" });
    expect(h.host.result.current.ui.snapshot).toEqual(old.ui.snapshot);
    expect(h.host.result.current.route).toEqual(old.route);
    expect(h.host.result.current.restoreKey).toBe(old.restoreKey);
    expect(location.href).toBe(oldAddress);
    expect(history.state.hpSource).toBe(oldSource);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(oldSource);
    expect(h.accepted.mock.calls).toEqual([["old-accepted"]]);
    expect(h.publications).not.toContain("expired-new");

    const expiredGeneration = h.replies[1].requestId;
    h.unblock(); act(() => h.host.result.current.reload());
    const retry = h.host.result.current.ui.requests.global;
    expect(retry?.generation).toBeGreaterThan(expiredGeneration);
    expect(retry?.startedAt).toBe(START + finished);
    await h.resolve(2, "retry-accepted");
    expect(h.host.result.current.data).toBe("retry-accepted");
    expect(h.host.result.current.domainData).toEqual({ period: "retry-accepted:period", history: "retry-accepted:history" });
    expect(h.host.result.current.ui.snapshot.scope.market).toBe("hk");
    expect(h.host.result.current.ui.errors.global).toBeNull();
    expect(h.accepted.mock.calls).toEqual([["old-accepted"], ["retry-accepted"]]);
  });

  it.each<SynchronousStage>(["catalog", "extractor"])("D07 accepts %s work completed at 14999 ms", async stage => {
    const h = mountConfiguredRead();
    vi.setSystemTime(START + 14_998); h.blockAt(stage, START + 14_999);
    await h.resolve(0, "within-deadline");
    expect(h.host.result.current.data).toBe("within-deadline");
    expect(h.host.result.current.domainData).toEqual({ period: "within-deadline:period", history: "within-deadline:history" });
    expect(h.host.result.current.ui.errors.global).toBeNull();
    expect(h.host.result.current.ui.requests.global).toBeNull();
    expect(h.host.result.current.initialized).toBe(true);
    expect(h.accepted.mock.calls).toEqual([["within-deadline"]]);
  });

  it.each<SynchronousStage>(["catalog", "extractor"])("D08 ends initial home loading when %s crosses the deadline", async stage => {
    const h = mountConfiguredRead();
    expect(h.host.result.current.initialized).toBe(false);
    const snapshot = h.host.result.current.ui.snapshot;
    const oldAddress = location.href;
    vi.setSystemTime(START + 14_999); h.blockAt(stage, START + 15_001);
    await h.resolve(0, "expired-initial");
    expect(h.host.result.current.initialized).toBe(true);
    expect(h.host.result.current.ui.errors.global).toBe("timeout");
    expect(h.host.result.current.ui.requests.global).toBeNull();
    expect(h.host.result.current.data).toBe("seed");
    expect(h.host.result.current.domainData).toEqual({ period: "seed:period", history: "seed:history" });
    expect(h.host.result.current.ui.snapshot).toEqual(snapshot);
    expect(location.href).toBe(oldAddress);
    expect(history.state.hpSource).toBe(h.source);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(h.source);
    expect(h.accepted).not.toHaveBeenCalled();
    expect(h.publications).not.toContain("expired-initial");
  });

  it.each([15_000, 15_001])("D09 rejects initial collection catalog work ending at %i ms", async finished => {
    const h = mountConfiguredRead("trades");
    const snapshot = h.host.result.current.ui.snapshot;
    const oldAddress = location.href;
    expect(h.host.result.current.initialized).toBe(false);
    vi.setSystemTime(START + 14_999); h.blockAt("catalog", START + finished);
    await h.resolve(0, "expired-collection", "collection");
    expect(h.host.result.current.initialized).toBe(true);
    expect(h.host.result.current.ui.errors.global).toBe("timeout");
    expect(h.host.result.current.ui.requests.global).toBeNull();
    expect(h.host.result.current.route.error).toBe("目标交易集合读取超时，请重试。");
    expect(h.host.result.current.collectionReady).toBe(false);
    expect(h.host.result.current.collectionData).toBeNull();
    expect(h.host.result.current.collectionTarget).toBeNull();
    expect(h.host.result.current.data).toBe("seed");
    expect(h.host.result.current.domainData).toEqual({ period: "seed:period", history: "seed:history" });
    expect(h.host.result.current.ui.snapshot).toEqual(snapshot);
    expect(location.href).toBe(oldAddress);
    expect(history.state.hpSource).toBe(h.source);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(h.source);
    expect(h.fromGlobal).not.toHaveBeenCalled();
    expect(h.accepted).not.toHaveBeenCalled();

    h.unblock(); act(() => h.host.result.current.reload());
    expect(h.host.result.current.ui.requests.global?.startedAt).toBe(START + finished);
    await h.resolve(1, "retry-collection", "collection");
    expect(h.host.result.current.collectionReady).toBe(true);
    expect(h.host.result.current.collectionData).toBe("retry-collection");
    expect(h.host.result.current.route.error).toBeNull();
    expect(h.host.result.current.data).toBe("seed");
    expect(h.host.result.current.domainData).toEqual({ period: "seed:period", history: "seed:history" });
    expect(h.accepted.mock.calls).toEqual([["retry-collection"]]);
  });
});
