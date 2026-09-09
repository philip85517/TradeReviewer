import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import type { DrawingTool } from "../../lib/chart/drawings";
import { DrawingToolbar } from "./drawing-toolbar";

it("selects an advanced drawing tool through the secondary menu", async () => {
  function Harness() {
    const [tool, setTool] = useState<DrawingTool>("cursor");
    return <><output>{tool}</output><DrawingToolbar activeTool={tool} canUndo={false} canRedo={false} allLocked={false} onToolChange={setTool} onUndo={vi.fn()} onRedo={vi.fn()} onClear={vi.fn()} onToggleLock={vi.fn()} /></>;
  }
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getByText("更多绘图工具").closest("details")).not.toHaveAttribute("open");
  await user.click(screen.getByText("更多绘图工具"));
  await user.click(screen.getByRole("button", { name: "文字标注" }));
  expect(screen.getByRole("status")).toHaveTextContent("text");
});
