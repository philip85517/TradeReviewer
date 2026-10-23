import { act, cleanup, renderHook } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { useHomepageHost } from "@/app/components/homepage-v25/use-homepage-host";
import { createHomepageState, encodeHomepageSnapshot, restoreHomepageState } from "@/app/lib/reviews/homepage-v25-state";

// Evidence-only: actual host, deferred synthetic bundles, no network or database.
const KEY = "tradereview:homepage-v25:source-ui:v3";
const IDENTITY = "NASDAQ:ROKU:stock";
const SOURCE_URL = "/home?scope=live&market=a&accounts=*&rangeMode=all";
const TARGET_URL = `/trades?scope=live&market=a&accounts=*&rangeMode=all&symbol=${encodeURIComponent(IDENTITY)}`;
const traces: Record<string, unknown[]> = {};
const accounts = [{ id: "one", label: "Synthetic account" }];
const identities = { [IDENTITY]: ["synthetic-roku"] };
type Read = { id: number; resolve: (result: { requestId: number; data: string }) => void; reject: (error: Error) => void };

function seed(url: string) {
  const state = createHomepageState({ live: true, market: "a", accounts: ["*"], rangeMode: "all" });
  state.snapshot.search = { query: "ROKU", open: true, resultsScrollTop: 73, selectedSymbol: IDENTITY, triggerFocusId: "hp-symbol-search" };
  state.snapshot.scrollTop = 186;
  const bytes = encodeHomepageSnapshot(state.snapshot);
  sessionStorage.setItem(KEY, bytes);
  history.replaceState({ hpV25: true, hpIndex: 7, hpSource: bytes }, "", url);
}

function mount() {
  const reads: Read[] = [];
  const host = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, revision: 1,
    data: "seed-only", accounts, identities, catalogFor: () => ({ accounts, identities }),
    reload: requestId => new Promise((resolve, reject) => reads.push({ id: requestId, resolve, reject })),
    guard: async () => true,
  }));
  return { host, reads };
}
async function succeed(read: Read, data: string) { await act(async () => read.resolve({ requestId: read.id, data })); }
async function fail(read: Read) { await act(async () => read.reject(new Error("synthetic-owned-read-failure"))); }
function decoded(bytes: string | null) {
  const result = restoreHomepageState(bytes);
  return result.ok ? { scope: result.state.snapshot.scope, query: result.state.snapshot.search.query } : null;
}
function record(label: string, stage: string, mounted: ReturnType<typeof mount>) {
  const state = mounted.host.result.current;
  (traces[label] ??= []).push({ stage, url: location.pathname + location.search, initialized: state.initialized,
    route: state.route, committed: { scope: state.ui.snapshot.scope, query: state.ui.snapshot.search.query },
    request: state.ui.requests.global, data: state.data,
    historySource: decoded(history.state?.hpSource ?? null), storageSource: decoded(sessionStorage.getItem(KEY)),
  });
}
function expectSourceA(mounted: ReturnType<typeof mount>) {
  expect(mounted.host.result.current.ui.snapshot.scope.market).toBe("a");
  expect(mounted.host.result.current.ui.snapshot.search.query).toBe("ROKU");
}
afterEach(() => { cleanup(); sessionStorage.clear(); history.replaceState(null, "", "/home"); });
afterAll(() => writeFileSync(process.cwd() + "/.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/navigation-reload-race/traces-2.json", JSON.stringify(traces, null, 2) + "\n", { flag: "wx" }));

describe("source return navigation / immediate reload diagnostic", () => {
  it("NR01 settled A search -> ordinary -> bare-home hard remount preserves A and ROKU before return read finishes", async () => {
    const label = "NR01"; seed(SOURCE_URL); const current = mount();
    await succeed(current.reads[0], "home-ready");
    await act(() => current.host.result.current.openTrades(IDENTITY));
    expect(current.host.result.current.route.scope).toMatchObject({ market: "a", symbolIdentity: IDENTITY });
    await act(() => current.host.result.current.openHome());
    expect(location.pathname + location.search).toBe("/home");
    record(label, "return-read-pending", current);
    current.host.unmount(); const reloaded = mount();
    record(label, "hard-remount-before-owned-read", reloaded); expectSourceA(reloaded);
    await succeed(reloaded.reads[0], "fresh-after-hard-reload");
    record(label, "hard-remount-read-accepted", reloaded); expectSourceA(reloaded);
    expect(new URL(location.href).searchParams.get("market")).toBe("a");
  });

  it("NR02 settled A + pending-home UI callback + hard remount still preserves A and ROKU", async () => {
    const label = "NR02"; seed(SOURCE_URL); const current = mount(); await succeed(current.reads[0], "home-ready");
    await act(() => current.host.result.current.openTrades(IDENTITY)); await act(() => current.host.result.current.openHome());
    act(() => current.host.result.current.onUi({ scrollTop: 25 })); record(label, "pending-ui-callback", current);
    current.host.unmount(); const reloaded = mount(); await succeed(reloaded.reads[0], "fresh");
    record(label, "hard-remount-accepted", reloaded); expectSourceA(reloaded);
  });

  it("NR03 cold ordinary bootstrap failure + pending return without UI callback + hard remount preserves source", async () => {
    const label = "NR03"; seed(TARGET_URL); const current = mount(); await fail(current.reads[0]);
    expect(current.host.result.current.initialized).toBe(true);
    expect(current.host.result.current.ui.snapshot.scope.market).toBe("all");
    await act(() => current.host.result.current.openHome()); record(label, "return-read-pending-no-ui", current);
    current.host.unmount(); const reloaded = mount(); await succeed(reloaded.reads[0], "fresh");
    record(label, "hard-remount-accepted", reloaded); expectSourceA(reloaded);
  });

  it("NR04 cold ordinary bootstrap failure + pending return UI callback must retain source across hard remount [candidate RED]", async () => {
    const label = "NR04"; seed(TARGET_URL); const current = mount(); await fail(current.reads[0]);
    record(label, "bootstrap-failed", current); await act(() => current.host.result.current.openHome());
    record(label, "return-read-pending", current);
    // The visible search trigger and main scroll container both call onUi while pending.
    act(() => current.host.result.current.onUi({ scrollTop: 25 })); record(label, "pending-ui-callback", current);
    current.host.unmount(); const reloaded = mount(); await succeed(reloaded.reads[0], "fresh");
    record(label, "hard-remount-accepted", reloaded); expectSourceA(reloaded);
  });

  it("NR05 cold ordinary failure + return read accepted before UI callback has no source loss", async () => {
    const label = "NR05"; seed(TARGET_URL); const current = mount(); await fail(current.reads[0]);
    await act(() => current.host.result.current.openHome()); await succeed(current.reads[1], "return-ready");
    act(() => current.host.result.current.onUi({ scrollTop: 25 })); record(label, "accepted-before-ui", current);
    current.host.unmount(); const reloaded = mount(); await succeed(reloaded.reads[0], "fresh");
    record(label, "hard-remount-accepted", reloaded); expectSourceA(reloaded);
  });

  it("NR06 host.reload during cold-failed pending return must not replace navigation A with committed all [API-only candidate RED]", async () => {
    const label = "NR06"; seed(TARGET_URL); const current = mount(); await fail(current.reads[0]);
    await act(() => current.host.result.current.openHome()); record(label, "return-read-pending", current);
    act(() => current.host.result.current.reload()); record(label, "refresh-supersedes-navigation", current);
    await succeed(current.reads[2], "newer-refresh"); record(label, "refresh-accepted", current);
    await succeed(current.reads[1], "late-navigation"); record(label, "late-navigation-ignored", current);
    expect(current.host.result.current.data).toBe("newer-refresh"); expectSourceA(current);
  });
});
