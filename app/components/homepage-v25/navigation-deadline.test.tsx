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
