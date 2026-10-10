import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { DrawingTool } from "../../lib/chart/drawings";
import { DrawingToolbar } from "./drawing-toolbar";

afterEach(cleanup);

it("selects an advanced drawing tool through the secondary menu", async () => {
  function Harness() {
    const [tool, setTool] = useState<DrawingTool>("cursor");
    return <><output>{tool}</output><DrawingToolbar activeTool={tool} canUndo={false} canRedo={false} allLocked={false} onToolChange={setTool} onUndo={vi.fn()} onRedo={vi.fn()} onClear={vi.fn()} onToggleLock={vi.fn()} /></>;
  }
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getByText("更多绘图工具").closest("details")).not.toHaveAttribute("open");
  await user.click(screen.getByText("更多绘图工具"));
  await user.click(screen.getByRole("menuitem", { name: "文字标注" }));
  expect(screen.getByRole("status")).toHaveTextContent("text");
});

it("keeps the compact priority tools out of the More menu while retaining every legacy tool", async () => {
  const user = userEvent.setup();
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
  await user.click(screen.getByRole("button", { name: "更多绘图工具" }));
  expect(document.querySelectorAll('button[aria-label="垂直线"]')).toHaveLength(1);
  expect(more?.querySelectorAll('button[aria-label="撤销绘图"]')).toHaveLength(0);
  expect(more?.querySelectorAll('button[aria-label="重做绘图"]')).toHaveLength(0);
  expect(more?.querySelectorAll('button[aria-label="锁定全部图形"]')).toHaveLength(0);
  expect(more?.querySelectorAll('button[aria-label="清空绘图"]')).toHaveLength(0);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="撤销绘图"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="重做绘图"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelector('button[aria-label="撤销绘图"]')).toHaveAttribute("data-replay-control", "true");
  expect(more?.parentElement?.querySelector('button[aria-label="重做绘图"]')).toHaveAttribute("data-replay-control", "true");
  expect(more?.parentElement?.querySelectorAll('button[aria-label="锁定全部图形"]')).toHaveLength(1);
  expect(more?.parentElement?.querySelectorAll('button[aria-label="清空绘图"]')).toHaveLength(1);
});

it("renders the compact More tools in body so the toolbar overflow cannot clip them", async () => {
  const user = userEvent.setup();
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

  const toolbar = screen.getByRole("toolbar", { name: "绘图工具" });
  await user.click(screen.getByRole("button", { name: "更多绘图工具" }));

  const menu = screen.getByRole("menu", { name: "更多绘图工具" });
  expect(menu.parentElement).toBe(document.body);
  expect(toolbar.contains(menu)).toBe(false);
  expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(7);
  expect(screen.getByRole("menuitem", { name: "垂直线" })).toHaveFocus();
  for (const label of ["垂直线", "矩形区间", "箭头", "斐波那契回撤", "价格标注", "区间测量", "做空盈亏比"]) {
    expect(screen.getByRole("menuitem", { name: label })).toHaveTextContent(label);
  }
});

it("keeps the selected hidden tool visible through the More trigger", () => {
  render(
    <DrawingToolbar
      compact
      activeTool="arrow"
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

  const trigger = screen.getByRole("button", { name: "更多绘图工具" });
  expect(trigger).toHaveAttribute("title", "更多绘图工具（当前：箭头）");
  expect(trigger.querySelector("svg.lucide-arrow-up-right")).not.toBeNull();
});

it("opens More tools with selected focus and supports menu keyboard navigation", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [activeTool, setActiveTool] = useState<DrawingTool>("fibonacci");
    return <><output role="status">{activeTool}</output><DrawingToolbar compact activeTool={activeTool} canUndo={false} canRedo={false} allLocked={false} onToolChange={setActiveTool} onUndo={vi.fn()} onRedo={vi.fn()} onClear={vi.fn()} onToggleLock={vi.fn()} /></>;
  }
  render(<Harness />);

  await user.click(screen.getByRole("button", { name: "更多绘图工具" }));
  const items = screen.getAllByRole("menuitem");
  expect(screen.getByRole("menuitem", { name: "斐波那契回撤" })).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(items[4]).toHaveFocus();
  await user.keyboard("{ArrowUp}");
  expect(items[3]).toHaveFocus();
  await user.keyboard("{Home}");
  expect(items[0]).toHaveFocus();
  await user.keyboard("{End}");
  expect(items.at(-1)).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.queryByRole("menu", { name: "更多绘图工具" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("short-risk-reward");
  expect(screen.getByRole("button", { name: "更多绘图工具" })).toHaveFocus();
});

it("selects every compact More tool with the mouse and closes the floating menu", async () => {
  const tools: Array<[string, DrawingTool]> = [
    ["垂直线", "vertical-line"],
    ["矩形区间", "rectangle"],
    ["箭头", "arrow"],
    ["斐波那契回撤", "fibonacci"],
    ["价格标注", "price-label"],
    ["区间测量", "measure"],
    ["做空盈亏比", "short-risk-reward"],
  ];
  const user = userEvent.setup();
  function Harness() {
    const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
    return <><output role="status">{activeTool}</output><DrawingToolbar compact activeTool={activeTool} canUndo={false} canRedo={false} allLocked={false} onToolChange={setActiveTool} onUndo={vi.fn()} onRedo={vi.fn()} onClear={vi.fn()} onToggleLock={vi.fn()} /></>;
  }
  render(<Harness />);

  for (const [label, value] of tools) {
    await user.click(screen.getByRole("button", { name: "更多绘图工具" }));
    await user.click(screen.getByRole("menuitem", { name: label }));
    expect(screen.queryByRole("menu", { name: "更多绘图工具" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(value);
  }
});

it("closes More tools with Escape and restores focus to its trigger", async () => {
  const user = userEvent.setup();
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
  const trigger = screen.getByRole("button", { name: "更多绘图工具" });
  await user.click(trigger);
  const menu = screen.getByRole("menu", { name: "更多绘图工具" });
  await user.keyboard("{Escape}");
  expect(menu).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes More tools on an outside pointer interaction without activating a canvas", async () => {
  const user = userEvent.setup();
  const canvasClick = vi.fn();
  const stagePointerDown = vi.fn();
  const stageClick = vi.fn();
  render(
    <>
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
      />
      <div className="chart-stage" onPointerDown={stagePointerDown} onClick={stageClick}>
        <canvas aria-label="主图" onClick={canvasClick} />
      </div>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "更多绘图工具" });
  await user.click(trigger);
  await user.click(screen.getByLabelText("主图"));
  expect(screen.queryByRole("menu", { name: "更多绘图工具" })).not.toBeInTheDocument();
  expect(stagePointerDown).not.toHaveBeenCalled();
  expect(stageClick).not.toHaveBeenCalled();
  expect(canvasClick).not.toHaveBeenCalled();
  await user.click(trigger);
  expect(screen.getByRole("menu", { name: "更多绘图工具" })).toBeInTheDocument();
});

it("keeps the floating menu inside the viewport near a right-edge trigger", async () => {
  const user = userEvent.setup();
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
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });
  const trigger = screen.getByRole("button", { name: "更多绘图工具" });
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ x: 300, y: 180, top: 180, right: 332, bottom: 214, left: 300, width: 32, height: 34, toJSON: () => ({}) });
  await user.click(trigger);
  const menu = screen.getByRole("menu", { name: "更多绘图工具" });
  vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, right: 216, bottom: 216, left: 0, width: 216, height: 216, toJSON: () => ({}) });
  fireEvent(window, new Event("resize"));
  expect(Number.parseFloat(menu.style.left)).toBeLessThanOrEqual(320 - 216 - 8);
  expect(Number.parseFloat(menu.style.top)).toBeLessThanOrEqual(240 - 216 - 8);
});
