import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NormalizedDrawing } from "../../lib/chart/drawings";
import { DrawingLayersPanel } from "./drawing-layers-panel";

afterEach(cleanup);

const drawings: NormalizedDrawing[] = [
  {
    version: 2, episodeId: "episode-1", createdAtCursor: "2026-01-02T00:00:00.000Z",
    id: "trend-1", name: "趋势线", tool: "trend-line", zIndex: 2,
    anchors: [{ time: "2026-01-01T00:00:00.000Z", price: 100 }, { time: "2026-01-02T00:00:00.000Z", price: 110 }],
    style: { color: "#2f80ed", lineWidth: 2, opacity: 1 }, hidden: false, locked: false, visibleOn: "all", stage: "during-replay",
  },
  {
    version: 2, episodeId: "episode-1", createdAtCursor: "2026-01-02T00:00:00.000Z",
    id: "line-2", name: "水平线", tool: "horizontal-line", zIndex: 1,
    anchors: [{ time: "2026-01-01T00:00:00.000Z", price: 99 }],
    style: { color: "#2f80ed", lineWidth: 2, opacity: 1 }, hidden: false, locked: false, visibleOn: "all", stage: "during-replay",
  },
];

describe("DrawingLayersPanel", () => {
  it("renames a drawing and sends layer commands from accessible controls", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<DrawingLayersPanel drawings={drawings} onCommand={onCommand} onSelectDrawing={vi.fn()} selectedDrawingId={null} />);

    await user.clear(screen.getByLabelText("重命名趋势线"));
    await user.type(screen.getByLabelText("重命名趋势线"), "突破趋势");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "隐藏趋势线" }));
    await user.click(screen.getByRole("button", { name: "锁定趋势线" }));
    await user.click(screen.getByRole("button", { name: "上移水平线" }));
    await user.click(screen.getByRole("button", { name: "删除趋势线" }));

    expect(onCommand).toHaveBeenCalledWith({ type: "rename", id: "trend-1", name: "突破趋势" });
    expect(onCommand).toHaveBeenCalledWith({ type: "toggle-hidden", id: "trend-1" });
    expect(onCommand).toHaveBeenCalledWith({ type: "toggle-locked", id: "trend-1" });
    expect(onCommand).toHaveBeenCalledWith({ type: "move", id: "line-2", direction: "up" });
    expect(onCommand).toHaveBeenCalledWith({ type: "delete", id: "trend-1" });
    expect(screen.getByRole("button", { name: "上移趋势线" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下移水平线" })).toBeDisabled();
  });

  it("announces an empty layer list", () => {
    render(<DrawingLayersPanel drawings={[]} onCommand={vi.fn()} onSelectDrawing={vi.fn()} selectedDrawingId={null} />);
    expect(screen.getByText("暂无绘图图层")).toBeInTheDocument();
  });
});
