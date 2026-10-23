import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHomepageState, encodeHomepageSnapshot } from "../../lib/reviews/homepage-v25-state";
import { useHomepageHost, type HomepageHostReadContext } from "./use-homepage-host";

const all = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const empty = { categories: [], openOnly: false, pendingReview: [] };
const selected = { categories: ["etf", "stock"], openOnly: true, pendingReview: [true] };
const accounts = [{ id: "one", label: "账户一" }, { id: "two", label: "账户二" }];
const identities = { "HKEX:X": ["HK:X"] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home"); });
function source() {
  const snapshot = createHomepageState({ ...all, market: "hk", accounts: ["one"], rangeMode: "date", date: "2026-10-22" }).snapshot;
  snapshot.attachments = selected; snapshot.holdings = { query: "来源", sort: "name-desc", page: 2 }; snapshot.scrollTop = 180;
  return snapshot;
}
function harness() {
  const reads: Array<{ id: number; context?: HomepageHostReadContext; resolve: (value: { requestId: number; data: string; kind?: "collection" }) => void; reject: (error: Error) => void }> = [];
  const reload = (id: number, context?: HomepageHostReadContext) => new Promise<{ requestId: number; data: string; kind?: "collection" }>((resolve, reject) => reads.push({ id, context, resolve, reject }));
  return { reads, reload };
}

describe("S-owned attachment request and return integration", () => {
  it("keeps draft and committed bundle separate through failed apply and successful retry", async () => {
    const h = harness();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, data: "old", revision: 1, accounts, identities, reload: h.reload, guard: async () => true }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => result.current.onAttachmentDraft(selected));
    expect(result.current.ui.snapshot.attachments).toEqual(empty); expect(result.current.data).toBe("old");
    act(() => result.current.applyAttachments());
    expect(h.reads[0].context?.readTarget.attachments).toEqual(selected);
    expect(h.reads[0].context?.request).toEqual(result.current.ui.requests.global);
    expect(result.current.ui.snapshot.attachments).toEqual(empty); expect(result.current.data).toBe("old");
    await act(async () => h.reads[0].reject(new Error("Recall unavailable")));
    expect(result.current.ui.errors.global).toBe("Recall unavailable");
    expect(result.current.ui.snapshot.attachments).toEqual(empty); expect(result.current.ui.draft.attachments).toEqual(selected); expect(result.current.data).toBe("old");
    act(() => result.current.applyAttachments());
    await act(async () => h.reads[1].resolve({ requestId: h.reads[1].id, data: "fresh-selected" }));
    expect(result.current.ui.snapshot.attachments).toEqual(selected); expect(result.current.data).toBe("fresh-selected");
    expect(JSON.parse(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")!).attachments).toEqual(selected);
  });

  it("cancels pending ownership while retaining draft and rejects its late data before identity clears the draft", async () => {
    const h = harness();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, data: "old", revision: 1, accounts, identities, reload: h.reload, guard: async () => true }));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    act(() => { result.current.onAttachmentDraft(selected); result.current.applyAttachments(); });
    act(() => result.current.cancelAttachmentRead());
    expect(result.current.ui.requests.global).toBeNull(); expect(result.current.ui.draft.attachments).toEqual(selected);
    await act(async () => h.reads[0].resolve({ requestId: h.reads[0].id, data: "late" }));
    expect(result.current.data).toBe("old"); expect(result.current.ui.snapshot.attachments).toEqual(empty);
    act(() => result.current.onScope({ ...all, market: "hk" }));
    expect(result.current.ui.draft.attachments).toEqual(empty);
    expect(h.reads[1].context?.readTarget.attachments).toEqual(empty);
  });

  it("carries compatible source attachments as read provenance through exact symbol collection, return and reload", async () => {
    const snapshot = source(); sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", encodeHomepageSnapshot(snapshot));
    history.replaceState(null, "", "/trades?scope=live&market=hk&accounts=one&rangeMode=date&date=2026-10-22&symbol=HKEX%3AX");
    const h = harness();
    const options = { enabled: true, ready: true, readOnInitialize: true, readCollections: true, data: "old", revision: 1, accounts, identities, reload: h.reload, guard: async () => true };
    let host = renderHook(() => useHomepageHost(options));
    await waitFor(() => expect(h.reads).toHaveLength(1));
    expect(h.reads[0].context?.request.target.attachments).toEqual(empty);
    expect(h.reads[0].context?.readTarget).toMatchObject({ market: "hk", symbolIdentity: "HKEX:X", attachments: selected });
    await act(async () => h.reads[0].resolve({ requestId: h.reads[0].id, data: "fresh-collection", kind: "collection" }));
    expect(host.result.current.collectionTarget?.attachments).toEqual(selected);
    await act(() => host.result.current.openHome());
    expect(h.reads[1].context?.readTarget.attachments).toEqual(selected);
    await act(async () => h.reads[1].resolve({ requestId: h.reads[1].id, data: "fresh-home" }));
    expect(host.result.current.data).toBe("fresh-home"); expect(host.result.current.ui.snapshot.attachments).toEqual(selected);
    expect(host.result.current.ui.snapshot.holdings).toEqual(snapshot.holdings); expect(host.result.current.ui.snapshot.scrollTop).toBe(180);
    host.unmount(); host = renderHook(() => useHomepageHost(options));
    await waitFor(() => expect(h.reads).toHaveLength(3));
    expect(h.reads[2].context?.readTarget.attachments).toEqual(selected);
    await act(async () => h.reads[2].resolve({ requestId: h.reads[2].id, data: "reloaded-home" }));
    expect(host.result.current.data).toBe("reloaded-home"); expect(host.result.current.ui.snapshot.attachments).toEqual(selected);
  });

  it.each(["/trades", "/trades?scope=live&market=us&accounts=one&rangeMode=date&date=2026-10-22", "/trades?scope=live&market=hk&accounts=two&rangeMode=date&date=2026-10-22", "/trades?scope=live&market=hk&accounts=one&rangeMode=date&date=2026-10-21"])("does not inherit attachments into unrelated native destination %s", async url => {
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", encodeHomepageSnapshot(source())); history.replaceState(null, "", url);
    const h = harness();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, readCollections: true, data: "old", revision: 1, accounts, identities, reload: h.reload, guard: async () => true }));
    await waitFor(() => expect(h.reads).toHaveLength(1));
    expect(h.reads[0].context?.readTarget.attachments).toEqual(empty);
    await act(async () => h.reads[0].resolve({ requestId: h.reads[0].id, data: "fresh-collection", kind: "collection" }));
    expect(result.current.collectionTarget?.attachments).toEqual(empty);
  });

  it("retains complete fresh sources and qualifies against the final account fallback rather than the missing source account", async () => {
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", encodeHomepageSnapshot(source()));
    const h = harness();
    const { result } = renderHook(() => useHomepageHost({ enabled: true, ready: true, readOnInitialize: true, data: "old", revision: 1, accounts, identities,
      catalogFor: () => ({ accounts: [{ id: "two", label: "账户二" }], identities }), reload: h.reload, guard: async () => true }));
    await waitFor(() => expect(h.reads).toHaveLength(1));
    await act(async () => h.reads[0].resolve({ requestId: h.reads[0].id, data: "complete-including-account-two" }));
    expect(result.current.ui.snapshot.scope.accounts).toEqual(["*"]);
    expect(result.current.ui.snapshot.attachments).toEqual(selected);
    expect(result.current.data).toBe("complete-including-account-two"); expect(result.current.notice).toContain("来源账户已不存在");
  });
});
