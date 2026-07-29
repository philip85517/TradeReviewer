import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

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
});
