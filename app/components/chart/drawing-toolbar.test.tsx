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

it("keeps the compact priority tools out of the More menu while retaining every legacy tool", () => {
  render(
    <DrawingToolbar
      compact
      activeTool="cursor"
      canUndo={false}
      canRedo={false}
      allLocked={false}
      onToolChange={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onClear={vi.fn()}
      onToggleLock={vi.fn()}
    />,
  );

  const more = screen.getAllByText("更多绘图工具").at(-1)?.closest("details");
  expect(more).not.toBeNull();
  expect(more?.querySelectorAll('button[aria-label="趋势线"]')).toHaveLength(0);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="趋势线"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="垂直线"]')).toHaveLength(1);
  expect(more?.querySelectorAll('button[aria-label="撤销绘图"]')).toHaveLength(0);
  expect(more?.querySelectorAll('button[aria-label="重做绘图"]')).toHaveLength(0);
  expect(more?.querySelectorAll('button[aria-label="锁定全部图形"]')).toHaveLength(0);
  expect(more?.querySelectorAll('button[aria-label="清空绘图"]')).toHaveLength(0);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="撤销绘图"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="重做绘图"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="锁定全部图形"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="清空绘图"]')).toHaveLength(1);
});
