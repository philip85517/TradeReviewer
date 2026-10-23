import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { buildHomepageHoldings } from "./holdings-model";
import { HomeSurface } from "./home-surface";
import { useHomepageHost } from "./use-homepage-host";

const fills: TradeExecution[] = ["stock", "etf"].map((kind, index) => ({ id: kind, accountId: "one", accountLabel: "账户一", source: { platform: "futu", row: index + 1, tradeNature: "live" }, instrument: { id: `HK:${kind}`, symbol: kind, name: kind === "stock" ? "股票样本" : "ETF样本", market: "HK", currency: "HKD" }, side: "buy", executedAt: "2026-10-22T01:00:00Z", quantity: "2", price: "100", fee: "1" }));
const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
const metadata = new Map([ ["HK:stock", { market: "HK" as const, symbol: "stock", assetType: "stock" as const }], ["HK:etf", { market: "HK" as const, symbol: "etf", assetType: "etf" as const }] ]);
function harness() {
  const reads: Array<{ id: number; resolve: (value: { requestId: number; data: typeof entries }) => void; reject: (error: Error) => void }> = [];
  const reload = (id: number) => new Promise<{ requestId: number; data: typeof entries }>((resolve, reject) => reads.push({ id, resolve, reject }));
  function App() {
    const host = useHomepageHost({ enabled: true, ready: true, data: entries, accounts: [{ id: "one", label: "账户一" }], identities: {}, revision: 1, reload, guard: async () => true });
    const holdings = buildHomepageHoldings(host.data, { scope: host.ui.snapshot.scope, attachments: host.ui.snapshot.attachments, asOf: "2026-10-23", instrumentMetadata: metadata, reviewSummariesComplete: true });
    return <HomeSurface ui={host.ui} holdings={holdings} ready={host.initialized} accountStatus="ready" accounts={[{ id: "one", label: "账户一" }]} onUi={host.onUi} onScope={host.onScope} onTrades={vi.fn()} onReload={host.reload} onRepair={vi.fn()} onImport={vi.fn()} attachmentActions={{ onDraft: host.onAttachmentDraft, onApply: host.applyAttachments, onClear: host.clearAttachments, onReset: host.resetDefaults, onCancel: host.cancelAttachmentRead, onRemove: host.removeAttachment }} />;
  }
  render(<App />);
  return reads;
}
afterEach(() => { cleanup(); sessionStorage.clear(); history.replaceState(null, "", "/home"); });

describe("production Surface attachment editor with S host", () => {
  it("opens the real trigger, preserves draft on Escape, retains old rows pending/failure and commits tokens with rows", async () => {
    const reads = harness();
    await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());
    const trigger = screen.getByRole("button", { name: "附加筛选" });
    fireEvent.click(trigger);
    const editor = screen.getByRole("dialog", { name: "附加筛选" });
    fireEvent.click(within(editor).getByRole("checkbox", { name: "股票" }));
    expect(screen.getByRole("table", { name: "当前持仓" })).toHaveTextContent("ETF样本");
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
    fireEvent.click(trigger); expect(screen.getByRole("checkbox", { name: "股票" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.getByRole("table", { name: "当前持仓" })).toHaveTextContent("ETF样本");
    expect(screen.queryByRole("button", { name: "移除股票条件" })).not.toBeInTheDocument();
    await act(async () => reads[0].reject(new Error("summary unavailable")));
    expect(screen.getByRole("checkbox", { name: "股票" })).toBeChecked();
    expect(screen.getByRole("table", { name: "当前持仓" })).toHaveTextContent("ETF样本");
    fireEvent.click(screen.getByRole("button", { name: "应用" }));
    await act(async () => reads[1].resolve({ requestId: reads[1].id, data: entries }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "附加筛选，1 个已生效条件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除股票条件" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "当前持仓" })).not.toHaveTextContent("ETF样本");
    fireEvent.click(screen.getByRole("button", { name: "移除股票条件" }));
    expect(screen.getByRole("table", { name: "当前持仓" })).not.toHaveTextContent("ETF样本");
    await act(async () => reads[2].resolve({ requestId: reads[2].id, data: entries }));
    expect(screen.getByRole("table", { name: "当前持仓" })).toHaveTextContent("ETF样本");
  });

  it("keeps clear/reset in draft and cancels pending ownership on outside dismissal", async () => {
    const reads = harness(); await waitFor(() => expect(screen.getByRole("button", { name: "进入交易库" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "ETF" }));
    fireEvent.click(screen.getByRole("button", { name: "清除附加条件" }));
    expect(screen.getByRole("checkbox", { name: "ETF" })).not.toBeChecked(); expect(reads).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "仅看未平仓持仓" }));
    fireEvent.click(screen.getByRole("button", { name: "恢复全部默认" }));
    expect(screen.getByRole("checkbox", { name: "仅看未平仓持仓" })).not.toBeChecked(); expect(reads).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "ETF" })); fireEvent.click(screen.getByRole("button", { name: "应用" }));
    fireEvent.pointerDown(screen.getByRole("heading", { name: "首页", level: 1 }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => reads[0].resolve({ requestId: reads[0].id, data: entries }));
    expect(screen.getByRole("table", { name: "当前持仓" })).toHaveTextContent("股票样本");
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" }));
    expect(screen.getByRole("checkbox", { name: "ETF" })).toBeChecked();
    fireEvent.click(within(screen.getByRole("group", { name: "市场" })).getByRole("button", { name: "港股" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => reads[1].resolve({ requestId: reads[1].id, data: entries }));
    fireEvent.click(screen.getByRole("button", { name: "附加筛选" })); expect(screen.getByRole("checkbox", { name: "ETF" })).not.toBeChecked();
  });
});
