import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { ReviewDashboard } from "./review-dashboard";

const instrument: Instrument = {
  id: "HK:0005",
  symbol: "0005",
  name: "汇丰控股",
  market: "HK",
  currency: "HKD",
};

function compactSearchEntries() {
  const executions: TradeExecution[] = [
    {
      id: "compact-search:buy",
      accountId: "account-1",
      accountLabel: "主账户",
      instrument,
      side: "buy",
      executedAt: "2026-10-02T01:00:00.000Z",
      quantity: "1",
      price: "10",
      fee: "0",
      source: { platform: "futu", row: 1 },
    },
    {
      id: "compact-search:sell",
      accountId: "account-1",
      accountLabel: "主账户",
      instrument,
      side: "sell",
      executedAt: "2026-10-02T02:00:00.000Z",
      quantity: "1",
      price: "11",
      fee: "0",
      source: { platform: "futu", row: 2 },
    },
  ];
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
}

class CompactResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    Object.defineProperty(target, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ width: 320, height: 0, top: 0, right: 320, bottom: 0, left: 0, x: 0, y: 0, toJSON: () => ({}) }),
    });
    this.callback([], this as unknown as ResizeObserver);
  }

  disconnect() {}
  unobserve() {}
}

describe("ReviewDashboard compact global search", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", CompactResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reveals the existing search after filters open and preserves clear focus", async () => {
    const user = userEvent.setup();
    render(<ReviewDashboard entries={compactSearchEntries()} onOpenInReview={() => undefined} />);

    await waitFor(() => {
      expect(document.querySelector('[data-content-layout="compact"]')).toBeInTheDocument();
    });
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    const searchSlot = search.closest("[data-compact-search]");
    expect(searchSlot).toHaveAttribute("data-compact-search", "closed");
    expect(screen.getAllByRole("searchbox", { name: "搜索已导入标的" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /^筛选/ }));

    expect(searchSlot).toHaveAttribute("data-compact-search", "open");
    expect(screen.getByRole("searchbox", { name: "搜索已导入标的" })).toBe(search);
    await user.type(search, "汇");
    expect(screen.getByRole("option", { name: /汇丰控股/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除搜索" }));
    expect(search).toHaveValue("");
    expect(document.activeElement).toBe(search);
    await user.type(search, "港");
    expect(search).toHaveValue("港");
  });
});
