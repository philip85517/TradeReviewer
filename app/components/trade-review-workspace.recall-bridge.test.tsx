import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
import { saveImportedExecutions } from "../lib/storage/import-library";
import { createRecallDocument } from "../lib/recall/document";
import { summarizeRecallDocument } from "../lib/recall/summary";
import type { TradeExecution } from "../lib/trades/types";
import type { ReviewDashboardProps } from "./dashboard/review-dashboard";
import type { RecallWorkspaceProps } from "./recall/recall-workspace";
import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import { reviewState } from "../lib/reviews/review-queue";
import { TradeReviewWorkspace } from "./trade-review-workspace";

const harness = vi.hoisted(() => ({ fetch: vi.fn(), props: null as RecallWorkspaceProps | null, dashboard: null as ReviewDashboardProps | null }));
vi.mock("../lib/recall/summary-client", () => ({ fetchRecallReviewSummaries: () => harness.fetch() }));
vi.mock("./dashboard/review-dashboard", () => ({ ReviewDashboard: (props: ReviewDashboardProps) => {
  harness.dashboard = props;
  const rows = props.entries.flatMap(entry => entry.episodes);
  return <div><output data-testid="pending-count">{rows.filter(row => reviewState(row) === "pending").length}</output><button onClick={() => { const item = rows[0]; props.onOpenInReview(item.episode.instrument.id, item.episode.id); }}>open pending</button></div>;
} }));
vi.mock("./recall/recall-workspace", () => ({ RecallWorkspace: (props: RecallWorkspaceProps) => { harness.props = props; return <div>recall editor</div>; } }));
vi.mock("../lib/instruments/resolve-service", async original => ({ ...await original<typeof import("../lib/instruments/resolve-service")>(), refreshInstrumentMetadata: vi.fn().mockResolvedValue(undefined) }));
const frame: DemoReplayFrame = { cursorIndex: 0, cursor: "2026-09-18T14:30:00Z", candles15m: [{ time: "2026-09-18T14:30:00Z", open: 10, high: 11, low: 9, close: 10, volume: 100 }], executions: [], canGoBack: false, canGoForward: false };
const executions: TradeExecution[] = ["A", "B"].flatMap(symbol => ["buy", "sell"].map((side, index): TradeExecution => ({ id: `${symbol}-${side}`, source: { platform: "futu", row: index }, accountId: "account", accountLabel: "account", instrument: { id: `US:${symbol}`, symbol, name: symbol, market: "US", currency: "USD" }, side: side as "buy" | "sell", executedAt: `2026-09-18T${index ? "15" : "14"}:30:00Z`, quantity: "1", price: index ? "11" : "10", fee: "0" })));
async function mount() {
  render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={createLegacySqliteClient()} />);
  await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent(/^[12]$/));
  await waitFor(() => expect(harness.fetch).toHaveBeenCalled());
}
beforeEach(async () => {
  cleanup(); vi.clearAllMocks(); harness.props = null;
  await new Promise<void>((resolve,reject) => { const req = indexedDB.deleteDatabase("trade-reviewer"); req.onsuccess=()=>resolve(); req.onerror=()=>reject(req.error); });
  saveImportedExecutions(executions);
  harness.fetch.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Recall summary homepage bridge", () => {
  it("uses only successful saved status, keeps drafts pending and restores persisted completion on remount", async () => {
    await mount();
    expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByText("open pending"));
    await screen.findByText("recall editor");
    const doc = createRecallDocument(harness.props!.episode, "2026-09-25T12:00:00Z");
    fireEvent.click(screen.getByRole("button", { name: "我的交易室" }));
    // Failed saves never emit onSaved; returning alone must not manufacture completion.
    await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent("2"));
    for (const status of ["in-progress", "needs-confirmation"] as const) {
      harness.props!.onSaved?.({ ...doc, status });
      await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent("2"));
    }
    const saved = { ...doc, status: "completed" as const, completedAt: doc.updatedAt };
    harness.props!.onSaved?.(saved);
    await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent("1"));
    cleanup(); harness.fetch.mockResolvedValue([summarizeRecallDocument(saved)]);
    await mount();
    await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent("1"));
  });
  it("quietly tolerates unavailable summaries and preserves saved state on failed dashboard refresh", async () => {
    harness.fetch.mockRejectedValue(new Error("offline"));
    await mount();
    expect(screen.getByTestId("pending-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByText("open pending")); await screen.findByText("recall editor");
    const saved = { ...createRecallDocument(harness.props!.episode, "2026-09-25T12:00:00Z"), status: "completed" as const };
    harness.props!.onSaved?.(saved);
    fireEvent.click(screen.getByRole("button", { name: "我的交易室" }));
    await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent("1"));
    expect(screen.queryByText("offline")).not.toBeInTheDocument();
  });
  it("does not let a slow dashboard refresh overwrite a newly saved completion", async () => {
    await mount();
    fireEvent.click(screen.getByText("open pending"));
    await screen.findByText("recall editor");
    const draft = createRecallDocument(harness.props!.episode, "2026-09-25T12:00:00Z");
    let resolve!: (summaries: ReturnType<typeof summarizeRecallDocument>[]) => void;
    harness.fetch.mockImplementation(() => new Promise(done => { resolve = done; }));
    fireEvent.click(screen.getByRole("button", { name: "我的交易室" }));
    await waitFor(() => expect(resolve).toBeDefined());
    await act(async () => {
      harness.props!.onSaved?.({ ...draft, status: "completed", completedAt: draft.updatedAt });
      resolve([summarizeRecallDocument(draft)]);
    });
    await waitFor(() => expect(screen.getByTestId("pending-count")).toHaveTextContent("1"));
  });

});
