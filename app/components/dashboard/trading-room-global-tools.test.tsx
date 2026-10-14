import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { TradingRoomGlobalTools, type TradingRoomGlobalToolsProps } from "./trading-room-global-tools";
import styles from "./trading-room-global-tools.module.css";

afterEach(cleanup);

const instrument: Instrument = {
  id: "HK:0005",
  symbol: "0005",
  name: "汇丰控股",
  market: "HK",
  currency: "HKD",
};

function importedEntries() {
  const execution: TradeExecution = {
    id: "global-tools:buy",
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy",
    executedAt: "2026-01-04T00:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform: "fixture", row: 1, tradeNature: "live" },
  };
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries([execution]), {}, {});
}

function manyImportedEntries(count: number) {
  const executions: TradeExecution[] = Array.from({ length: count }, (_, index) => {
    const symbol = String(1000 + index).padStart(4, "0");
    return {
      id: `global-tools:many-${index}`,
      accountId: "account-1",
      accountLabel: "主账户",
      instrument: {
        id: `HK:${symbol}`,
        symbol,
        name: `测试标的${index + 1}`,
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      quantity: "1",
      price: "10",
      fee: "0",
      source: { platform: "fixture", row: index + 1, tradeNature: "live" },
    };
  });
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
}

function props(overrides: Partial<TradingRoomGlobalToolsProps> = {}): TradingRoomGlobalToolsProps {
  return {
    entries: [],
    scope: { nature: "live", accountIds: [], simulationRunId: null },
    status: "ready",
    onOpenSearchResult: vi.fn(),
    onOpenNotification: vi.fn(),
    onOpenAccountAndCurrency: vi.fn(),
    ...overrides,
  };
}

describe("TradingRoomGlobalTools", () => {
  it("gates search and avoids a fake zero count while identity data is loading or failing", () => {
    const initial = props({ status: "loading" });
    const view = render(<TradingRoomGlobalTools {...initial} />);
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(initial.onOpenSearchResult).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^打开待处理事项/ }));
    const dialog = screen.getByRole("dialog", { name: "待处理事项" });
    expect(dialog).toHaveTextContent("读取中");
    expect(screen.queryByLabelText(/条待处理事项/)).not.toBeInTheDocument();

    view.rerender(<TradingRoomGlobalTools {...initial} status="error" />);
    expect(screen.getByRole("dialog", { name: "待处理事项" })).toHaveTextContent("读取失败");
    expect(screen.queryByLabelText(/条待处理事项/)).not.toBeInTheDocument();
  });

  it("keeps the real zero count in the ready notification trigger name without a badge", () => {
    render(<TradingRoomGlobalTools {...props()} />);

    const trigger = screen.getByRole("button", { name: "打开待处理事项（0）" });
    expect(trigger).toHaveAccessibleName("打开待处理事项（0）");
    expect(screen.queryByLabelText(/条待处理事项/)).not.toBeInTheDocument();
  });

  it("keeps the real count in the trigger name while capping the visible badge at 99+", () => {
    const entries = manyImportedEntries(100);
    const marketDataStatuses = Object.fromEntries(entries.map(entry => [entry.instrument.id, "partial" as const]));
    render(<TradingRoomGlobalTools {...props({ entries, marketDataStatuses })} />);

    const trigger = screen.getByRole("button", { name: "打开待处理事项（100）" });
    expect(trigger).toHaveAccessibleName("打开待处理事项（100）");
    expect(screen.getByLabelText("100 条待处理事项")).toHaveTextContent("99+");
  });

  it("keeps the loading and error trigger names count-free", () => {
    const initial = props({ status: "loading" });
    const view = render(<TradingRoomGlobalTools {...initial} />);

    expect(screen.getByRole("button", { name: "打开待处理事项" })).toHaveAccessibleName("打开待处理事项");
    view.rerender(<TradingRoomGlobalTools {...initial} status="error" />);
    expect(screen.getByRole("button", { name: "打开待处理事项" })).toHaveAccessibleName("打开待处理事项");
  });

  it("revalidates a stale search result and notification against the latest identity", () => {
    const entries = importedEntries();
    const initial = props({ entries, marketDataStatuses: { [instrument.id]: "partial" } });
    const view = render(<TradingRoomGlobalTools {...initial} />);
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    const result = screen.getByRole("option", { name: /汇丰控股/ });
    entries.splice(0);
    view.rerender(<TradingRoomGlobalTools {...initial} />);
    fireEvent.click(result);
    expect(initial.onOpenSearchResult).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("当前身份下的标的已变化");

    entries.push(...importedEntries());
    view.rerender(<TradingRoomGlobalTools {...initial} />);
    fireEvent.click(screen.getByRole("button", { name: /^打开待处理事项/ }));
    const notification = screen.getByRole("button", { name: /行情问题/ });
    entries.splice(0);
    view.rerender(<TradingRoomGlobalTools {...initial} />);
    fireEvent.click(notification);
    expect(initial.onOpenNotification).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("当前范围下的事项已变化");
  });

  it("closes search, notifications, and the user menu with Escape and restores trigger focus", async () => {
    const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
    render(<TradingRoomGlobalTools {...initial} />);
    const user = userEvent.setup();

    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    const result = screen.getByRole("option", { name: /汇丰控股/ });
    result.focus();
    expect(document.activeElement).toBe(result);
    result.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /汇丰控股/ })).not.toBeInTheDocument();
      expect(document.activeElement).toBe(search);
    });

    const notificationTrigger = screen.getByRole("button", { name: /^打开待处理事项/ });
    fireEvent.click(notificationTrigger);
    const notification = screen.getByRole("button", { name: /行情问题/ });
    notification.focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "待处理事项" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(notificationTrigger);

    const userTrigger = screen.getByRole("button", { name: "打开本地用户菜单" });
    fireEvent.click(userTrigger);
    expect(screen.getByRole("menu", { name: "本地用户菜单" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "本地用户菜单" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(userTrigger);
  });

  it("keeps search focus after clearing with the mouse so typing can continue", async () => {
    const initial = props({ entries: importedEntries() });
    render(<TradingRoomGlobalTools {...initial} />);
    const user = userEvent.setup();
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });

    await user.type(search, "汇");
    await user.click(screen.getByRole("button", { name: "清除搜索" }));

    expect(search).toHaveValue("");
    expect(document.activeElement).toBe(search);
    await user.type(search, "港");
    expect(search).toHaveValue("港");
  });

  it("keeps search focus after clearing with Tab and Enter so typing can continue", async () => {
    const initial = props({ entries: importedEntries() });
    render(<TradingRoomGlobalTools {...initial} />);
    const user = userEvent.setup();
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });

    await user.type(search, "汇");
    const clear = screen.getByRole("button", { name: "清除搜索" });
    await user.tab();
    expect(document.activeElement).toBe(clear);
    await user.keyboard("{Enter}");

    expect(search).toHaveValue("");
    expect(document.activeElement).toBe(search);
    await user.type(search, "港");
    expect(search).toHaveValue("港");
  });

  it("returns focus to the notification trigger when its close button is activated", () => {
    const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
    render(<TradingRoomGlobalTools {...initial} />);
    const trigger = screen.getByRole("button", { name: /^打开待处理事项/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "关闭待处理事项" }));
    expect(screen.queryByRole("dialog", { name: "待处理事项" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("repositions the notification panel from its live trigger across layout changes", () => {
    let panelTop = 496.5;
    let observerCallback: ResizeObserverCallback | undefined;
    let mutationCallback: MutationCallback | undefined;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const mutationObserveMock = vi.fn();
    const mutationDisconnectMock = vi.fn();
    const originalViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = {
      offsetTop: 0,
      height: 844,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }

      observe() {
        observeMock();
      }

      disconnect() {
        disconnectMock();
      }
    });
    vi.stubGlobal("MutationObserver", class {
      constructor(callback: MutationCallback) {
        mutationCallback = callback;
      }

      observe() {
        mutationObserveMock();
      }

      disconnect() {
        mutationDisconnectMock();
      }
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    let listScrollHeightRead = false;
    const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains(styles.notificationList)) {
        listScrollHeightRead = true;
        return 426;
      }
      return 0;
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "dialog") {
        return { top: panelTop, bottom: panelTop + 426, left: 54, right: 336, width: 282, height: 426, x: 54, y: panelTop, toJSON: () => ({}) } as DOMRect;
      }
      if (this.getAttribute("aria-label")?.startsWith("打开待处理事项")) {
        const triggerTop = panelTop - 53;
        return { top: triggerTop, bottom: triggerTop + 44, left: 292, right: 336, width: 44, height: 44, x: 292, y: triggerTop, toJSON: () => ({}) } as DOMRect;
      }
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });

    try {
      const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
      const { container } = render(
        <div data-content-layout="medium">
          <div data-header-row="identity">
            <TradingRoomGlobalTools {...initial} />
          </div>
        </div>,
      );
      fireEvent.click(screen.getByRole("button", { name: /^打开待处理事项/ }));

      const dialog = screen.getByRole("dialog", { name: "待处理事项" });
      expect(dialog.querySelector(`.${styles.notificationList}`)).not.toBeNull();
      expect(listScrollHeightRead).toBe(true);
      expect(dialog.style.getPropertyValue("--trading-room-overlay-top")).toBe("8.5px");
      expect(dialog.style.getPropertyValue("--trading-room-overlay-max-height")).toBe("426px");
      expect(observeMock).toHaveBeenCalled();
      expect(observerCallback).toBeDefined();
      expect(mutationObserveMock).toHaveBeenCalled();
      expect(mutationCallback).toBeDefined();

      const layoutRoot = container.querySelector<HTMLElement>("[data-content-layout]");
      if (!layoutRoot) throw new Error("expected layout root");
      layoutRoot.dataset.contentLayout = "compact";
      mutationCallback?.([], {} as MutationObserver);
      expect(dialog.style.getPropertyValue("--trading-room-overlay-top")).toBe("8.5px");
      expect(dialog.style.getPropertyValue("--trading-room-overlay-max-height")).toBe("426px");

      panelTop = 900;
      const resizeListener = viewport.addEventListener.mock.calls.find(([eventName]) => eventName === "resize")?.[1] as (() => void) | undefined;
      resizeListener?.();
      expect(dialog.style.getPropertyValue("--trading-room-overlay-top")).toBe("412px");
      expect(dialog.style.getPropertyValue("--trading-room-overlay-max-height")).toBe("426px");

      layoutRoot.dataset.contentLayout = "wide";
      mutationCallback?.([], {} as MutationObserver);
      expect(dialog.style.getPropertyValue("--trading-room-overlay-top")).toBe("412px");
      expect(dialog.style.getPropertyValue("--trading-room-overlay-max-height")).toBe("426px");

      panelTop = 496.5;
      mutationCallback?.([], {} as MutationObserver);
      expect(dialog.style.getPropertyValue("--trading-room-overlay-top")).toBe("8.5px");
      expect(dialog.style.getPropertyValue("--trading-room-overlay-max-height")).toBe("426px");

      fireEvent.click(screen.getByRole("button", { name: "关闭待处理事项" }));
      expect(disconnectMock).toHaveBeenCalled();
      expect(mutationDisconnectMock).toHaveBeenCalled();
      expect(viewport.removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    } finally {
      rectSpy.mockRestore();
      scrollHeightSpy.mockRestore();
      if (originalViewport) Object.defineProperty(window, "visualViewport", originalViewport);
      else Reflect.deleteProperty(window, "visualViewport");
      vi.unstubAllGlobals();
    }
  });

  it("restores the original trigger when an outside pointer closes a popover", () => {
    const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
    render(<TradingRoomGlobalTools {...initial} />);

    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox", { name: "标的搜索结果" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(search);

    const notificationTrigger = screen.getByRole("button", { name: /^打开待处理事项/ });
    fireEvent.click(notificationTrigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "待处理事项" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(notificationTrigger);

    const userTrigger = screen.getByRole("button", { name: "打开本地用户菜单" });
    fireEvent.click(userTrigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "本地用户菜单" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(userTrigger);
  });
});
