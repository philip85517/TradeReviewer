import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHomepageState, updateHomepageUi } from "../../lib/reviews/homepage-v25-state";
import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import { buildHomepageCatalog } from "./catalog-model";
import { buildHomepageHoldings } from "./holdings-model";
import { HomeSurface } from "./home-surface";

const scope = { live: true as const, market: "a" as const, accounts: ["one"], rangeMode: "date" as const, date: "2026-10-22" };
const instrument: StoredInstrument = {
  id: "US:META", market: "US", symbol: "META", name: "Meta Platforms", currency: "USD",
  metadata: { market: "US", symbol: "META", name: "Meta Platforms", assetType: "stock", source: "sec", confidence: "official", resolvedAt: "2026-10-22T08:00:00Z", exchange: { code: "NASDAQ", source: "sec", resolvedAt: "2026-10-22T08:00:00Z" } },
};
const catalog = buildHomepageCatalog([], [instrument]);
const holdings = buildHomepageHoldings([], { scope, asOf: "2026-10-23" });
function Harness({ navigate = async () => false }: { navigate?: (identity: string) => Promise<boolean> }) {
  const [ui, setUi] = useState(() => createHomepageState(scope));
  const [target, setTarget] = useState("");
  return <><HomeSurface ui={ui} holdings={holdings} catalog={catalog} ready accountStatus="ready" accounts={[{ id: "one", label: "实盘一" }]} onUi={patch => setUi(current => updateHomepageUi(current, patch))} onScope={vi.fn()} onTrades={vi.fn()} onSymbolTrades={async identity => { const accepted = await navigate(identity); if (accepted) setTarget(identity); return accepted; }} onReload={vi.fn()} onRepair={vi.fn()} onImport={vi.fn()} /><output aria-label="当前范围">{JSON.stringify(ui.snapshot.scope)}</output><output aria-label="交易目标">{target}</output></>;
}
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function query(value: string) {
  const input = screen.getByRole("searchbox", { name: "搜索标的" });
  fireEvent.change(input, { target: { value } });
  await act(() => vi.advanceTimersByTimeAsync(300));
  return input;
}
describe("homepage real known catalog search", () => {
  it("keeps cross-market search independent of the applied scope and waits for IME completion plus 300ms", async () => {
    vi.useFakeTimers(); render(<Harness />);
    const originalScope = screen.getByLabelText("当前范围").textContent;
    fireEvent.click(screen.getByRole("button", { name: "搜索标的" }));
    const input = screen.getByRole("searchbox", { name: "搜索标的" });
    expect(input).toHaveFocus();
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: "META" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.queryByRole("button", { name: /Meta Platforms.*NASDAQ/ })).not.toBeInTheDocument();
    fireEvent.compositionEnd(input);
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(screen.queryByRole("button", { name: /Meta Platforms.*NASDAQ/ })).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ.*USD.*股票/ })).toBeInTheDocument();
    expect(screen.getByLabelText("当前范围").textContent).toBe(originalScope);
  });
  it("opens a metadata-only detail without borrowing holdings, and Escape restores its exact result before closing search", async () => {
    vi.useFakeTimers(); render(<Harness />);
    const trigger = screen.getByRole("button", { name: "搜索标的" });
    fireEvent.click(trigger); await query("META");
    const result = screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ });
    fireEvent.click(result);
    const detail = screen.getByRole("dialog", { name: "Meta Platforms 标的详情" });
    expect(within(detail).getByText(/当前范围暂无该标的持仓/)).toBeInTheDocument();
    expect(within(detail).getByLabelText("核心持仓指标")).not.toHaveTextContent("0.00");
    expect(within(detail).getAllByRole("button", { name: "查看交易" })).toHaveLength(1);
    fireEvent.click(screen.getByTestId("holding-detail-backdrop"));
    expect(detail).toBeInTheDocument();
    fireEvent.keyDown(detail, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /标的详情/ })).not.toBeInTheDocument();
    expect(result).toHaveFocus();
    expect(screen.getByRole("searchbox", { name: "搜索标的" })).toHaveValue("META");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "标的搜索" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole("searchbox", { name: "搜索标的" })).toHaveValue("META");
  });
  it("keeps detail and source intact when navigation is refused, then uses the full unique identity", async () => {
    vi.useFakeTimers();
    let allow = false;
    render(<Harness navigate={async () => allow} />);
    fireEvent.click(screen.getByRole("button", { name: "搜索标的" })); await query("META");
    fireEvent.click(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "查看交易" })));
    expect(screen.getByRole("dialog", { name: "Meta Platforms 标的详情" })).toBeInTheDocument();
    expect(screen.getByLabelText("交易目标")).toBeEmptyDOMElement();
    allow = true;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "查看交易" })));
    expect(screen.getByLabelText("交易目标")).toHaveTextContent("NASDAQ:META:stock");
  });
  it("returns metadata-only detail to its selected search result and scroll through the visible source action", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn(async () => true);
    render(<Harness navigate={navigate} />);
    const originalScope = screen.getByLabelText("当前范围").textContent;
    fireEvent.click(screen.getByRole("button", { name: "搜索标的" })); await query("META");
    const results = screen.getByRole("region", { name: "找到标的" });
    results.scrollTop = 96; fireEvent.scroll(results);
    const result = screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ });
    fireEvent.click(result);
    const detail = screen.getByRole("dialog", { name: "Meta Platforms 标的详情" });
    expect(within(detail).getByText(/当前范围暂无该标的持仓/)).toBeInTheDocument();
    const returnAction = within(detail).getByRole("button", { name: "返回原搜索结果 · 恢复原滚动位置" });
    returnAction.focus(); fireEvent.keyDown(returnAction, { key: "Tab" });
    const close = within(detail).getByRole("button", { name: "关闭标的详情" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(returnAction).toHaveFocus();
    fireEvent.click(returnAction);
    expect(screen.queryByRole("dialog", { name: /标的详情/ })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "标的搜索" })).not.toHaveAttribute("inert");
    expect(result).toHaveFocus();
    expect(result).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("searchbox", { name: "搜索标的" })).toHaveValue("META");
    expect(results.scrollTop).toBe(96);
    expect(screen.getByLabelText("当前范围").textContent).toBe(originalScope);
    expect(navigate).not.toHaveBeenCalled();
  });
});
