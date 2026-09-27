import "fake-indexeddb/auto";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import type { ReviewDashboard } from "./dashboard/review-dashboard";
import type { CashBaselinePanel } from "./data-management/cash-baseline-panel";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";

const probe = vi.hoisted(() => ({ dashboard: null as ComponentProps<typeof ReviewDashboard> | null, panel: null as ComponentProps<typeof CashBaselinePanel> | null }));
vi.mock("./dashboard/review-dashboard", () => ({ ReviewDashboard: (props: ComponentProps<typeof ReviewDashboard>) => { probe.dashboard = props; return <output data-testid="cash-probe">{JSON.stringify({ loading: props.cashLoading, error: props.cashError, summary: props.cashSummary })}</output>; } }));
vi.mock("./data-management/data-management", () => ({ DataManagement: ({ cashSlot }: { cashSlot: ReactNode }) => <>{cashSlot}</> }));
vi.mock("./data-management/cash-baseline-panel", () => ({ CashBaselinePanel: (props: ComponentProps<typeof CashBaselinePanel>) => { probe.panel = props; return null; } }));
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const empty = { version: 1, records: [] };
const summary = (value: string) => ({ cashTotal: { converted: value } });
const frame = { cursorIndex: 0, cursor: "2025-01-02T14:30:00.000Z", candles15m: [], executions: [], canGoBack: false, canGoForward: false };
let getCash: (url: string) => Promise<Response>;
let putCash: () => Promise<Response>;
beforeEach(() => {
  window.localStorage.clear(); probe.dashboard = null; probe.panel = null;
  getCash = async () => Response.json(summary("A"));
  putCash = async () => Response.json(empty);
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/cash/baselines")) return init?.method === "PUT" ? putCash() : Promise.resolve(Response.json(empty));
    if (url.includes("/trading-room/cash?")) return getCash(url);
    return Promise.resolve(Response.json({}));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function mount() {
  render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={createLegacySqliteClient()} legacyStateExporter={async () => null} />);
  await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
  await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("A")));
}
function switchAccount(id: string) { act(() => probe.dashboard?.onSharedScopeChange?.({ accountIds: [id] })); }

describe("independent workspace cash race acceptance", () => {
  it("clears the previous amount while the next identity GET waits, and ignores an older successful GET", async () => {
    await mount();
    const b = deferred<Response>(); const c = deferred<Response>();
    getCash = url => url.includes("accountIds=b") ? b.promise : c.promise;
    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();
    switchAccount("c");
    await act(async () => { c.resolve(Response.json(summary("C"))); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("C")));
    await act(async () => { b.resolve(Response.json(summary("B"))); });
    expect(probe.dashboard?.cashSummary).toEqual(summary("C"));
    expect(screen.getByTestId("cash-probe")).not.toHaveTextContent('"B"');
  });
  it("keeps a previously loaded identity pending while its new GET waits after an A-to-B-to-A switch", async () => {
    await mount();
    const b = deferred<Response>(); const returnedA = deferred<Response>();
    getCash = url => url.includes("accountIds=b") ? b.promise : returnedA.promise;

    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();

    act(() => probe.dashboard?.onSharedScopeChange?.({ accountIds: [] }));
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();

    await act(async () => { returnedA.resolve(Response.json(summary("A2"))); });
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("A2")));
    expect(probe.dashboard?.cashLoading).toBe(false);

    await act(async () => { b.resolve(Response.json(summary("B"))); });
    expect(probe.dashboard?.cashSummary).toEqual(summary("A2"));
  });
  it("attributes a failed reload after an A-to-B-to-A switch to the returned identity", async () => {
    await mount();
    const b = deferred<Response>(); const returnedA = deferred<Response>();
    getCash = url => url.includes("accountIds=b") ? b.promise : returnedA.promise;

    switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    act(() => probe.dashboard?.onSharedScopeChange?.({ accountIds: [] }));
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(true));
    expect(probe.dashboard?.cashSummary).toBeNull();

    await act(async () => { returnedA.resolve(Response.json({ error: { message: "A unavailable" } }, { status: 503 })); });
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashError).toBe("A unavailable");

    await act(async () => { b.resolve(Response.json(summary("B"))); });
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashError).toBe("A unavailable");
  });
  it("attributes a failed current GET to the new identity without retaining the old amount", async () => {
    await mount();
    const b = deferred<Response>(); getCash = () => b.promise;
    switchAccount("b");
    await act(async () => { b.resolve(Response.json({ error: { message: "B unavailable" } }, { status: 503 })); });
    await waitFor(() => expect(probe.dashboard?.cashLoading).toBe(false));
    expect(probe.dashboard?.cashSummary).toBeNull();
    expect(probe.dashboard?.cashError).toBe("B unavailable");
  });
  it("does not publish a late PUT rejection from the previous identity into the new identity", async () => {
    await mount();
    await waitFor(() => expect(probe.panel).not.toBeNull());
    const put = deferred<Response>(); putCash = () => put.promise;
    let saved!: Promise<boolean>;
    act(() => { saved = probe.panel!.onSave({ scope: { nature: "live", simulationRunId: null }, accountId: "a", currency: "CNY", balance: "1", asOf: "2026-09-01T00:00:00.000Z" }); });
    getCash = async () => Response.json(summary("B")); switchAccount("b");
    await waitFor(() => expect(probe.dashboard?.cashSummary).toEqual(summary("B")));
    await act(async () => { put.reject(new Error("old account write failed")); expect(await saved).toBe(false); });
    expect(probe.dashboard?.cashError).toBeNull();
    expect(probe.panel?.error).toBeNull();
    expect(probe.dashboard?.cashSummary).toEqual(summary("B"));
  });
});
