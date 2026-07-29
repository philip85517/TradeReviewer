import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PositionPathMetrics } from "../../lib/replay/position-path-metrics";
import { ReviewSidePanel } from "./review-side-panel";

const metrics: PositionPathMetrics = {
  current: { quantity: "0", averageCost: "0", grossCapitalDeployed: "0", realizedPnl: "0", unrealizedPnl: "0", fees: "0", netPnl: "0", returnPercent: "0" },
  holdingMilliseconds: null,
  mfe: null,
  mae: null,
  maximumDrawdown: null,
  profitGiveback: null,
  rMultiple: null,
  unavailableReason: "游标之前尚无成交。",
};

describe("ReviewSidePanel", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("switches accessible tabs and opens one notes form in a focus-restoring drawer", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [activeTab, setActiveTab] = useState<"stats" | "notes">("stats");
      const [drawerOpen, setDrawerOpen] = useState(false);
      return <ReviewSidePanel instrumentLabel="小鹏汽车（XPEV）" currency="HKD" metrics={metrics} episodeId="episode-1" instrumentId="HK:9868" activeTab={activeTab} onActiveTabChange={setActiveTab} onSaveReview={vi.fn().mockResolvedValue(undefined)} drawerOpen={drawerOpen} onDrawerOpenChange={setDrawerOpen} />;
    }
    render(<Harness />);

    const notes = screen.getByRole("tab", { name: "复盘笔记" });
    expect(notes).toHaveAttribute("aria-selected", "false");
    await user.click(notes);
    expect(notes).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("买入理由")).toBeInTheDocument();
    expect(screen.getAllByLabelText("买入理由")).toHaveLength(1);

    const trigger = screen.getByRole("button", { name: "打开复盘面板" });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "复盘面板" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("买入理由")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "关闭复盘面板" }));
    expect(screen.queryByRole("dialog", { name: "复盘面板" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps both labelled tabpanels mounted while only the selected panel is visible", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [activeTab, setActiveTab] = useState<"stats" | "notes">("stats");
      return <ReviewSidePanel instrumentLabel="小鹏汽车（XPEV）" currency="HKD" metrics={metrics} episodeId="episode-1" instrumentId="HK:9868" activeTab={activeTab} onActiveTabChange={setActiveTab} onSaveReview={vi.fn().mockResolvedValue(undefined)} drawerOpen={false} onDrawerOpenChange={vi.fn()} />;
    }
    render(<Harness />);

    const stats = screen.getByRole("tabpanel", { name: "路径统计" });
    const notes = document.getElementById("episode-1-notes");
    expect(notes).not.toBeNull();
    expect(stats).not.toHaveAttribute("hidden");
    expect(notes).toHaveAttribute("hidden");
    expect(screen.getByRole("tab", { name: "路径统计" })).toHaveAttribute("aria-controls", "episode-1-stats");
    expect(screen.getByRole("tab", { name: "复盘笔记" })).toHaveAttribute("aria-controls", "episode-1-notes");

    await user.click(screen.getByRole("tab", { name: "复盘笔记" }));
    expect(stats).toHaveAttribute("hidden");
    expect(notes).not.toHaveAttribute("hidden");
  });

  it("returns an open compact drawer to desktop panel semantics after crossing 1260px", async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = false;
    const desktopQuery = {
      get matches() {
        return matches;
      },
      media: "(min-width: 1260px)",
      onchange: null,
      addEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (type === "change") listeners.add(listener);
      },
      removeEventListener: (
        type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        if (type === "change") listeners.delete(listener);
      },
    } as MediaQueryList;
    const crossDesktopBoundary = (nextMatches: boolean) => {
      matches = nextMatches;
      const event = {
        matches,
        media: desktopQuery.media,
      } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    };
    vi.stubGlobal("matchMedia", vi.fn(() => desktopQuery));
    const onDrawerOpenChange = vi.fn();

    function Harness() {
      const [drawerOpen, setDrawerOpen] = useState(false);
      return <ReviewSidePanel instrumentLabel="小鹏汽车（XPEV）" currency="HKD" metrics={metrics} episodeId="episode-1" instrumentId="HK:9868" activeTab="stats" onActiveTabChange={vi.fn()} onSaveReview={vi.fn().mockResolvedValue(undefined)} drawerOpen={drawerOpen} onDrawerOpenChange={(open) => { onDrawerOpenChange(open); setDrawerOpen(open); }} />;
    }

    const view = render(<Harness />);
    const trigger = screen.getByRole("button", { name: "打开复盘面板" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "复盘面板" })).toBeInTheDocument();

    act(() => crossDesktopBoundary(true));

    expect(screen.queryByRole("dialog", { name: "复盘面板" })).not.toBeInTheDocument();
    const desktopPanel = document.querySelector(".review-side-panel-desktop");
    expect(desktopPanel).toBeInTheDocument();
    expect(desktopPanel).not.toHaveAttribute("role");
    expect(desktopPanel).not.toHaveAttribute("aria-modal");
    expect(document.querySelector(".review-side-panel-backdrop")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "路径统计" })).toHaveFocus();
    expect(onDrawerOpenChange).toHaveBeenLastCalledWith(false);

    const callCountBeforeUnmount = onDrawerOpenChange.mock.calls.length;
    view.unmount();
    act(() => {
      crossDesktopBoundary(false);
      crossDesktopBoundary(true);
    });
    expect(onDrawerOpenChange).toHaveBeenCalledTimes(callCountBeforeUnmount);
  });

  it("preserves a rejected draft through tab and drawer changes, then retries that draft", async () => {
    vi.useFakeTimers();
    const deferred = Promise.withResolvers<void>();
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => deferred.promise)
      .mockResolvedValueOnce(undefined);
    const onDrawerOpenChange = vi.fn();
    function Harness() {
      const [activeTab, setActiveTab] = useState<"stats" | "notes">("notes");
      const [drawerOpen, setDrawerOpen] = useState(false);
      return <ReviewSidePanel instrumentLabel="小鹏汽车（XPEV）" currency="HKD" metrics={metrics} episodeId="episode-1" instrumentId="HK:9868" activeTab={activeTab} onActiveTabChange={setActiveTab} onSaveReview={onSave} drawerOpen={drawerOpen} onDrawerOpenChange={(open) => { onDrawerOpenChange(open); setDrawerOpen(open); }} />;
    }
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("买入理由"), { target: { value: "失败后仍在" } });
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(screen.getByRole("status")).toHaveTextContent("正在自动保存");
    fireEvent.click(screen.getByRole("tab", { name: "路径统计" }));
    fireEvent.click(screen.getByRole("button", { name: "打开复盘面板" }));
    expect(screen.getAllByLabelText("买入理由")).toHaveLength(1);

    deferred.reject(new Error("quota"));
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole("tab", { name: "复盘笔记" }));

    expect(screen.getByLabelText("买入理由")).toHaveValue("失败后仍在");
    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请检查本机存储后重试");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "重试保存" })));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ plan: expect.objectContaining({ thesis: "失败后仍在" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("已自动保存");
    expect(onDrawerOpenChange).toHaveBeenCalledWith(true);
  });
});
