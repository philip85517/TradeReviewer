import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginHomepageRead, completeHomepageRequest, createHomepageState, updateHomepageUi } from "../../lib/reviews/homepage-v25-state";
import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import { buildHomepageCatalog } from "./catalog-model";
import { homepageHoldingsFixture as buildHomepageHoldings } from "./holdings-test-fixture";
import { HomeSurface } from "./home-surface";

// HP03 / approved P3 contract: search is independent of this applied A-share scope.
const scope = { live: true as const, market: "a" as const, accounts: ["one"], rangeMode: "date" as const, date: "2026-10-22" };
const instrument: StoredInstrument = {
  id: "US:META", market: "US", symbol: "META", name: "Meta Platforms", currency: "USD",
  metadata: { market: "US", symbol: "META", name: "Meta Platforms", assetType: "stock", source: "sec", confidence: "official", resolvedAt: "2026-10-22T08:00:00Z", exchange: { code: "NASDAQ", source: "sec", resolvedAt: "2026-10-22T08:00:00Z" } },
};
const catalog = buildHomepageCatalog([], [instrument]);
const holdings = buildHomepageHoldings([], { scope, asOf: "2026-10-23" });
const blockedPhases = ["not-ready", "global-pending", "global-error", "account-error"] as const;
type Phase = "ready" | typeof blockedPhases[number];
const noSource = '{"source":null,"container":null,"detailId":null,"triggerFocusId":null,"missingContainerTitle":null}';
const appliedScope = '{"live":true,"market":"a","accounts":["one"],"rangeMode":"date","date":"2026-10-22"}';
const noop = () => {};

function Harness({ phase = "ready" }: { phase?: Phase }) {
  const [ui, setUi] = useState(() => createHomepageState(scope));
  const [observedPhase, setObservedPhase] = useState(phase);
  // Exercise the real S request lifecycle without a host, transport, or business cache.
  // Changing phase preserves this mount, its search UI, and the accepted catalog.
  if (observedPhase !== phase) {
    setObservedPhase(phase);
    if (phase !== "not-ready" && phase !== "account-error") {
      setUi(current => {
        const reading = beginHomepageRead(current, { purpose: "refresh" }, 1_000);
        if (phase === "global-pending") return reading;
        const request = reading.requests.global!;
        return completeHomepageRequest(reading, {
          generation: request.generation, scopeKey: request.scopeKey,
          ok: phase === "ready", applied: request.target,
          ...(phase === "global-error" ? { error: "fixture-owned-read-failed" } : {}),
        }).state;
      });
    }
  }
  return <>
    <HomeSurface ui={ui} holdings={holdings} catalog={catalog} restoreKey={17}
      ready={phase !== "not-ready"} accountStatus={phase === "account-error" ? "error" : "ready"}
      accounts={[{ id: "one", label: "实盘一" }]}
      onUi={patch => setUi(current => updateHomepageUi(current, patch))}
      onScope={noop} onTrades={noop} view={holdings.view} onApply={() => true} recovery={{ state: "quiet" }} onRecover={noop} onCatalogRetry={noop} onImport={noop} />
    <output aria-label="已应用范围">{JSON.stringify(ui.snapshot.scope)}</output>
    <output aria-label="已提交搜索词">{ui.snapshot.search.query}</output>
    <output aria-label="已选标的">{ui.snapshot.search.selectedSymbol ?? "(none)"}</output>
    <output aria-label="已保存结果滚动">{ui.snapshot.search.resultsScrollTop}</output>
    <output aria-label="来源状态">{JSON.stringify(ui.snapshot.returnState)}</output>
  </>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openSettledSearch() {
  fireEvent.click(screen.getByRole("button", { name: "搜索标的" }));
  const input = screen.getByRole("searchbox", { name: "搜索标的" });
  fireEvent.change(input, { target: { value: "META" } });
  await act(() => vi.advanceTimersByTimeAsync(300));
  expect(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ.*USD.*股票/ })).toBeInTheDocument();
  return input;
}

function expectBlockedRegion(phase: typeof blockedPhases[number]) {
  const results = screen.getByRole("region", { name: "找到标的" });
  if (phase === "not-ready" || phase === "global-pending") {
    expect(within(results).getByRole("status")).toHaveTextContent("正在读取已知证券目录");
    expect(results).toHaveAttribute("aria-busy", "true");
  } else {
    expect(within(results).getByRole("alert")).toHaveTextContent("证券目录读取失败");
    expect(within(results).getByRole("button", { name: "重试" })).toBeInTheDocument();
  }
  expect(within(results).queryByRole("button", { name: /Meta Platforms/ })).not.toBeInTheDocument();
}

describe("homepage search recovery — CR01 / CR02", () => {
  it("CR01 restores nonzero result scroll, query, selection and input focus after close/reopen on the same mount and restoreKey", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "搜索标的" });
    await openSettledSearch();
    const results = screen.getByRole("region", { name: "找到标的" });
    // jsdom has no layout; root's independent browser RED used this real offset.
    results.scrollTop = 816;
    fireEvent.scroll(results);
    expect(screen.getByLabelText("已保存结果滚动")).toHaveTextContent("816");
    fireEvent.click(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ }));
    fireEvent.click(screen.getByRole("button", { name: "返回原搜索结果 · 恢复原滚动位置" }));
    expect(results.scrollTop).toBe(816);
    expect(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "关闭标的搜索" }));
    expect(screen.queryByRole("dialog", { name: "标的搜索" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(screen.getByLabelText("已保存结果滚动")).toHaveTextContent("816");
    fireEvent.click(trigger);
    const reopenedInput = screen.getByRole("searchbox", { name: "搜索标的" });
    expect(reopenedInput).toHaveValue("META");
    expect(reopenedInput).toHaveFocus();
    expect(screen.getByLabelText("已选标的")).toHaveTextContent("NASDAQ:META:stock");
    expect(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("已应用范围")).toHaveTextContent(appliedScope);
    expect(screen.getByRole("region", { name: "找到标的" }).scrollTop).toBe(816);
  });

  it.each(blockedPhases)("CR02 %s: Enter cannot open a hidden old result or mutate selection/source", async phase => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness />);
    const input = await openSettledSearch();
    expect(screen.getByLabelText("已选标的")).toHaveTextContent("(none)");
    expect(screen.getByLabelText("来源状态")).toHaveTextContent(noSource);
    rerender(<Harness phase={phase} />);
    expectBlockedRegion(phase);
    expect(input).toHaveValue("META");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect.soft(input).toHaveFocus();
    // Isolate each input action if the preceding wrong branch stole focus.
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect.soft(input).toHaveFocus();
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });
    // Keep the complete causal evidence if one wrong Enter mutates all three.
    expect.soft(screen.queryByRole("dialog", { name: /标的详情/ })).not.toBeInTheDocument();
    expect.soft(screen.getByLabelText("已选标的")).toHaveTextContent("(none)");
    expect.soft(screen.getByLabelText("来源状态")).toHaveTextContent(noSource);
    expect.soft(screen.getByLabelText("已应用范围")).toHaveTextContent(appliedScope);
    expect.soft(screen.getByLabelText("已提交搜索词")).toHaveTextContent("META");
  });

  it.each(blockedPhases)("CR02 %s: becoming ready on the same mount permits Enter again", async phase => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness />);
    const input = await openSettledSearch();
    rerender(<Harness phase={phase} />);
    expectBlockedRegion(phase);
    rerender(<Harness phase="ready" />);
    expect(screen.getByRole("button", { name: /Meta Platforms.*NASDAQ/ })).toBeInTheDocument();
    expect(input).toHaveValue("META");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "Meta Platforms 标的详情" })).toBeInTheDocument();
    expect(screen.getByLabelText("已选标的")).toHaveTextContent("NASDAQ:META:stock");
    expect(screen.getByLabelText("来源状态")).toHaveTextContent('"source":"detail","container":"search","detailId":"NASDAQ:META:stock"');
    expect(screen.getByLabelText("已应用范围")).toHaveTextContent(appliedScope);
  });

  it("keeps settled old candidates inert to Enter during IME and commits the completed word only after 300ms", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    const input = await openSettledSearch();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "Meta Platforms" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.queryByRole("dialog", { name: /标的详情/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("已选标的")).toHaveTextContent("(none)");
    expect(screen.getByLabelText("来源状态")).toHaveTextContent(noSource);
    expect(screen.getByLabelText("已提交搜索词")).toHaveTextContent("META");
    fireEvent.compositionEnd(input);
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(screen.getByLabelText("已提交搜索词")).toHaveTextContent("META");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("dialog", { name: /标的详情/ })).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByLabelText("已提交搜索词")).toHaveTextContent("Meta Platforms");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "Meta Platforms 标的详情" })).toBeInTheDocument();
    expect(screen.getByLabelText("已应用范围")).toHaveTextContent(appliedScope);
  });
});
