import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoReplayFrame } from "../../lib/demo/replay-frame";
import { createHomepageState, encodeHomepageSnapshot } from "../../lib/reviews/homepage-v25-state";
import type { StorageBootstrap } from "../../lib/storage/sqlite-contracts";
import { buildTradeEpisodes } from "../../lib/trades/episodes";
import type { TradeExecution } from "../../lib/trades/types";
import { createLegacySqliteClient } from "../test-support/legacy-sqlite-client";
import { TradeReviewWorkspace } from "../trade-review-workspace";

// Recall's default repository captures fetch at module initialization. Install
// this transport before imports; it still exercises the real document parser.
const fetcher = vi.hoisted(() => {
  const value = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", value);
  return value;
});

const frame: DemoReplayFrame = { cursorIndex: 0, cursor: "2026-10-22T01:00:00Z", candles15m: [], executions: [], canGoBack: false, canGoForward: false };
const fills: TradeExecution[] = ["A", "B"].flatMap((account, i) => ["X", "Y"].map((symbol, j) => ({ id: `${account}${symbol}`, accountId: account, accountLabel: `账户${account}`, source: { platform: "futu", row: i * 2 + j + 1, tradeNature: "live" }, instrument: { id: `HK:${symbol}`, symbol, name: `证券${symbol}`, market: "HK", currency: "HKD" }, side: "buy", executedAt: "2026-10-22T01:00:00Z", quantity: "2", price: "100", fee: "1" })));
const instruments: StorageBootstrap["instruments"] = ["X", "Y"].map(symbol => ({ id: `HK:${symbol}`, market: "HK", symbol, name: `证券${symbol}`, currency: "HKD", metadata: { market: "HK", symbol, name: `证券${symbol}`, assetType: symbol === "X" ? "stock" : "etf", source: "hkex", confidence: "official", resolvedAt: "2026-10-22T08:00:00Z" } }));
const episodes = buildTradeEpisodes(fills);
const summaries = episodes.filter(episode => `${episode.accountId}${episode.instrument.symbol}` === "AY" || `${episode.accountId}${episode.instrument.symbol}` === "BX").map(episode => ({ episodeId: episode.id, status: "completed", updatedAt: "2026-10-22T09:00:00Z", completedAt: "2026-10-22T09:00:00Z", text: "已完成", snapshotCount: 0 }));
function client() {
  const storage = createLegacySqliteClient();
  storage.getBootstrap = vi.fn().mockResolvedValue({ schemaVersion: 1, migration: null, executions: fills, importHistory: [], instruments, reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" } } satisfies StorageBootstrap);
  storage.getMarketData = vi.fn().mockResolvedValue({ candles: [], dailyCandles: [], intervalCoverage: [], coverage: [] });
  return storage;
}
let summaryFailure = false;
let summaryPayload: Promise<{ summaries: typeof summaries }> | undefined;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); history.replaceState(null, "", "/home"); summaryFailure = false; summaryPayload = undefined;
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset().mockImplementation(async input => {
    const path = new URL(String(input), "http://localhost").pathname;
    if (path.includes("tradingview-account-migration/aliases")) return Response.json({ aliases: [] });
    if (path === "/api/storage/recall/summaries") return summaryFailure ? Response.json({ error: "unavailable" }, { status: 503 }) : Response.json(summaryPayload ? await summaryPayload : { summaries });
    if (path === "/api/storage/recall") return Response.json({ error: { code: "not-found" } }, { status: 404 });
    if (path === "/api/trading-room/fx") return Response.json({ status: "unavailable" });
    return Response.json(frame);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("owned production Workspace attachment sources", () => {
  it("does not require a strict summary read when no pending predicate or both pending values are selected", async () => {
    summaryFailure = true;
    render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={client()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(4);
    const summaryCalls = () => fetcher.mock.calls.filter(([input]) => String(input).includes("/api/storage/recall/summaries"));
    // One pre-existing ambient refresh may fail; it grants no owned coverage.
    expect(summaryCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：是" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：否" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "附加筛选" })).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(4);
    expect(summaryCalls()).toHaveLength(1);
  });

  it("requires fresh Recall for pending predicate, rejects failure, and carries exact composite groups through ordinary return and reload", async () => {
    const user = userEvent.setup();
    const storage = client();
    const app = () => <TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={storage} />;
    let mounted = render(app());
    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled(), { timeout: 5000 });
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "股票" })); fireEvent.click(screen.getByRole("checkbox", { name: "ETF" })); fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：是" }));
    summaryFailure = true; fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await screen.findAllByText(/Recall summary request failed/);
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(4);
    expect(screen.getByRole("checkbox", { name: "待复盘：是" })).toBeChecked();
    summaryFailure = false; fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "附加筛选" })).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "附加筛选，3 个已生效条件" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "查看持仓详情" })[0]);
    const detail = screen.getByRole("dialog"); expect(detail).toHaveTextContent("账户A");
    fireEvent.click(within(detail).getByRole("button", { name: "查看交易" }));
    await screen.findByRole("region", { name: "交易库" }, { timeout: 5000 });
    expect(location.search).toContain("symbol=HKEX%3AX");
    expect(screen.queryByRole("button", { name: "返回本股交易" })).not.toBeInTheDocument();
    // The guard reveals the library before the owned route read completes.
    // Query the live page after that transition, never its detached old region.
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "交易库" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "展开证券X交易回合" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "展开证券Y交易回合" })).not.toBeInTheDocument();
    });
    const library = screen.getByRole("region", { name: "交易库" });
    await user.click(within(library).getByRole("button", { name: "展开证券X交易回合" }));
    expect(within(library).getAllByRole("button", { name: /^打开证券X第/ })).toHaveLength(1);
    expect(within(library).getByRole("button", { name: /^打开证券X第.*账户A$/ })).toBeInTheDocument();
    await user.click(within(library).getByRole("button", { name: /^打开证券X第.*账户A$/ }));
    await waitFor(() => expect(document.querySelector(".review-content")?.textContent).toContain("返回交易库"), { timeout: 5000 });
    const returnToCollection = await screen.findByRole("button", { name: "返回交易库" }, { timeout: 5000 });
    await user.click(returnToCollection);
    const returnedCollection = await screen.findByRole("region", { name: "交易库" });
    expect(within(returnedCollection).getByRole("button", { name: /^打开证券X第.*账户A$/ })).toBeInTheDocument();
    expect(within(returnedCollection).queryByRole("button", { name: /^打开证券X第.*账户B$/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回首页" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "附加筛选，3 个已生效条件" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(2);
    mounted.unmount(); mounted = render(app());
    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(2);
    expect(JSON.parse(sessionStorage.getItem("tradereview:homepage-v25:source-ui:v3")!).attachments.pendingReview).toEqual([true]);
  }, 15000);

  it("cold compatible source uses fresh summaries while keeping the ordinary read free of FX and market reads", async () => {
    const snapshot = createHomepageState({ live: true, market: "hk", accounts: ["*"], rangeMode: "all" }).snapshot;
    snapshot.attachments = { categories: ["stock", "etf"], openOnly: false, pendingReview: [false] };
    sessionStorage.setItem("tradereview:homepage-v25:source-ui:v3", encodeHomepageSnapshot(snapshot));
    history.replaceState(null, "", "/trades?scope=live&market=hk&accounts=*&rangeMode=all&symbol=HKEX%3AX");
    const storage = client(); const market = vi.spyOn(storage, "getMarketData");
    const pending = deferred<{ summaries: typeof summaries }>(); summaryPayload = pending.promise;
    render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={storage} />);
    // Existing workspace cache hydration runs independently of the owned
    // collection. Settle its two instrument reads before releasing Recall.
    await waitFor(() => expect(market).toHaveBeenCalledTimes(2));
    market.mockClear();
    await act(async () => pending.resolve({ summaries }));
    const library = await screen.findByRole("region", { name: "交易库" }, { timeout: 5000 });
    fireEvent.click(within(library).getByRole("button", { name: "展开证券X交易回合" }));
    expect(within(library).getAllByRole("button", { name: /^打开证券X第/ })).toHaveLength(1);
    expect(within(library).getByRole("button", { name: /^打开证券X第.*账户B$/ })).toBeInTheDocument();
    // The existing workspace FX hook issues one GET independently of this
    // collection read. Owned home reads omit method; none may occur here.
    const fxCalls = vi.mocked(fetch).mock.calls.filter(([input]) => String(input).includes("/api/trading-room/fx"));
    expect(fxCalls).toHaveLength(1);
    expect(fxCalls[0][1]).toMatchObject({ method: "GET" });
    expect(market).not.toHaveBeenCalled();
  }, 15000);

  it("cancels a real pending summary read and rejects its late bundle after a newer predicate succeeds", async () => {
    const storage = client();
    render(<TradeReviewWorkspace initialFrame={frame} showDemo={false} storageClient={storage} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：是" }));
    const late = deferred<{ summaries: typeof summaries }>(); summaryPayload = late.promise;
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "附加筛选" }), { key: "Escape" });
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(4);
    summaryPayload = undefined;
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" }));
    expect(screen.getByRole("checkbox", { name: "待复盘：是" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：是" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "待复盘：否" }));
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "附加筛选" })).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "移除待复盘：否条件" })).toBeInTheDocument();
    await act(async () => late.resolve({ summaries: [] }));
    expect(screen.getAllByRole("button", { name: "查看持仓详情" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "移除待复盘：否条件" })).toBeInTheDocument();
  }, 15000);
});
