import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomepageHistoryRange } from "../../lib/reviews/homepage-v25-state";
import { HistoryControls, type HistoryControlsProps, type HistoryRangeOption } from "./history-controls";

afterEach(cleanup);

const options: readonly HistoryRangeOption[] = [
  { id: "year-2026", label: "2026", range: { mode: "year", year: 2026 } },
  { id: "this-year-2026", label: "今年", range: { mode: "this-year", year: 2026 } },
  { id: "years-2024-2026", label: "2024–2026", range: { mode: "years", fromYear: 2024, toYear: 2026 } },
  { id: "all", label: "全部", range: { mode: "all" } },
];
function props(overrides: Partial<HistoryControlsProps> = {}): HistoryControlsProps {
  return { appliedRange: { mode: "year", year: 2026 }, chartMode: "period-pnl", rangeOptions: options,
    onRangeApply: vi.fn(), onChartModeChange: vi.fn(), ...overrides };
}
function rangeTrigger() { return screen.getByRole("button", { name: /^历史范围：/ }); }
function metricTrigger() { return screen.getByRole("button", { name: /^历史指标：/ }); }

// Removing controlled labels or introducing a third selector breaks this contract.
describe("HistoryControls controlled labels", () => {
  it.each([
    [{ mode: "year", year: 2026 }, "2026", "每月净盈亏"],
    [{ mode: "this-year", year: 2026 }, "今年", "每月净盈亏"],
    [{ mode: "years", fromYear: 2024, toYear: 2026 }, "2024–2026", "每年净盈亏"],
    [{ mode: "all" }, "全部", "每年净盈亏"],
  ] as const)("renders applied %j without a separate granularity control", (appliedRange, label, metric) => {
    render(<HistoryControls {...props({ appliedRange })} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(rangeTrigger()).toHaveTextContent(label);
    expect(metricTrigger()).toHaveTextContent(metric);
    expect(screen.queryByText("按平仓时间 · 年份")).not.toBeInTheDocument();
  });

  it("uses caller years instead of constructing prototype years or reading current year", async () => {
    const custom = [{ id: "future", label: "2038", range: { mode: "year", year: 2038 } }] as const;
    render(<HistoryControls {...props({ appliedRange: { mode: "year", year: 2038 }, rangeOptions: custom })} />);
    await userEvent.click(rangeTrigger());
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "2038" })).toHaveFocus();
    expect(screen.queryByText("2026")).not.toBeInTheDocument();
  });

  it("keeps an applied range absent from options rather than selecting the first available range", async () => {
    render(<HistoryControls {...props({ appliedRange: { mode: "year", year: 2031 } })} />);
    expect(rangeTrigger()).toHaveTextContent("2031");
    await userEvent.click(rangeTrigger());
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it.each([
    [{ mode: "year", year: 2038 }, "2038"],
    [{ mode: "this-year", year: 2038 }, "今年"],
    [{ mode: "years", fromYear: 2036, toYear: 2038 }, "2036–2038"],
    [{ mode: "all" }, "全部"],
  ] as const)("keeps %j compact while preserving the full caller label in accessible, title and menu text", async (appliedRange, shortLabel) => {
    const fullLabel = `${shortLabel}：全部已经确认可用、用于核对真实历史范围的详细说明`;
    const custom = [{ id: "descriptive", label: fullLabel, range: appliedRange }];
    render(<HistoryControls {...props({ appliedRange, rangeOptions: custom })} />);
    expect(rangeTrigger().textContent).toBe(shortLabel);
    expect(rangeTrigger()).toHaveAccessibleName(`历史范围：${fullLabel}`);
    expect(rangeTrigger()).toHaveAttribute("title", fullLabel);
    await userEvent.click(rangeTrigger());
    expect(screen.getByRole("option", { name: fullLabel })).toHaveTextContent(fullLabel);
    expect(screen.getByRole("option", { name: fullLabel })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(rangeTrigger()).toHaveFocus();
    expect(rangeTrigger().textContent).toBe(shortLabel);
  });

  it("refreshes caller descriptions without changing the compact applied range or issuing requests", async () => {
    const p = props();
    const { rerender } = render(<HistoryControls {...p} />);
    const fullLabel = "2026：外部更新后的完整年度范围说明，保留给辅助技术和展开选项";
    rerender(<HistoryControls {...p} rangeOptions={[{ ...options[0], label: fullLabel }]} />);
    expect(rangeTrigger().textContent).toBe("2026");
    expect(rangeTrigger()).toHaveAccessibleName(`历史范围：${fullLabel}`);
    expect(rangeTrigger()).toHaveAttribute("title", fullLabel);
    await userEvent.click(rangeTrigger());
    expect(screen.getByRole("option", { name: fullLabel })).toHaveAttribute("aria-selected", "true");
    expect(p.onRangeApply).not.toHaveBeenCalled();
    expect(p.onChartModeChange).not.toHaveBeenCalled();
  });
});

// Immediate arrow submission, optimistic labels, wrong focus restoration or multiple menus fail these tests.
describe("HistoryControls explicit range submission and keyboard", () => {
  it("opens on the current selected option and navigates without applying until Space", async () => {
    const p = props(); const user = userEvent.setup();
    render(<HistoryControls {...p} />);
    rangeTrigger().focus(); await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "2026" })).toHaveFocus();
    await user.keyboard("{End}"); expect(screen.getByRole("option", { name: "全部" })).toHaveFocus();
    await user.keyboard("{Home}{ArrowDown}"); expect(screen.getByRole("option", { name: "今年" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowDown}");
    expect(p.onRangeApply).not.toHaveBeenCalled();
    await user.keyboard(" ");
    expect(p.onRangeApply).toHaveBeenCalledExactlyOnceWith({ mode: "this-year", year: 2026 });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(rangeTrigger()).toHaveFocus();
    expect(rangeTrigger()).toHaveTextContent("2026");
  });

  it("Enter requests the exact range once, closes, and retains applied selection until caller commits", async () => {
    const p = props(); const user = userEvent.setup(); render(<HistoryControls {...p} />);
    await user.click(rangeTrigger()); await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(p.onRangeApply).toHaveBeenCalledExactlyOnceWith({ mode: "years", fromYear: 2024, toYear: 2026 });
    expect(rangeTrigger()).toHaveTextContent("2026");
    expect(metricTrigger()).toHaveTextContent("每月净盈亏");
    await user.click(rangeTrigger());
    expect(screen.getByRole("option", { name: "2026" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "2026" })).toHaveFocus();
  });

  it("Escape discards navigation and restores trigger focus without a request", async () => {
    const p = props(); const user = userEvent.setup(); render(<HistoryControls {...p} />);
    await user.click(rangeTrigger()); await user.keyboard("{End}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(rangeTrigger()).toHaveFocus(); expect(p.onRangeApply).not.toHaveBeenCalled();
  });

  it("outside click closes and restores the original trigger without submitting", async () => {
    const p = props(); render(<><button>外部</button><HistoryControls {...p} /></>);
    await userEvent.click(rangeTrigger()); await userEvent.click(screen.getByRole("button", { name: "外部" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(rangeTrigger()).toHaveFocus(); expect(p.onRangeApply).not.toHaveBeenCalled();
  });

  it("Tab closes without trapping focus and advances from range to the metric trigger", async () => {
    const p = props(); const user = userEvent.setup(); render(<HistoryControls {...p} />);
    await user.click(rangeTrigger()); await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(metricTrigger()).toHaveFocus(); expect(p.onRangeApply).not.toHaveBeenCalled();
  });

  it("Shift+Tab leaves backward and Tab from metric reaches the next outside control", async () => {
    const p = props(); const user = userEvent.setup();
    render(<><button>之前</button><HistoryControls {...p} /><button>之后</button></>);
    await user.click(rangeTrigger()); await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "之前" })).toHaveFocus();
    await user.click(metricTrigger()); await user.tab();
    expect(screen.getByRole("button", { name: "之后" })).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("handles Escape locally without closing another page state", async () => {
    function Page() {
      const [open, setOpen] = useState(true);
      return <div onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
        <p>页面状态：{open ? "保持" : "已关闭"}</p><HistoryControls {...props()} />
      </div>;
    }
    render(<Page />); await userEvent.click(rangeTrigger()); await userEvent.keyboard("{Escape}");
    expect(screen.getByText("页面状态：保持")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("switches or toggles menus without applying and never opens both", async () => {
    const p = props(); render(<HistoryControls {...p} />);
    await userEvent.click(rangeTrigger()); await userEvent.click(metricTrigger());
    expect(screen.getAllByRole("listbox")).toHaveLength(1);
    expect(screen.getByRole("listbox", { name: "历史指标" })).toBeInTheDocument();
    expect(rangeTrigger()).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(metricTrigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(p.onRangeApply).not.toHaveBeenCalled(); expect(p.onChartModeChange).not.toHaveBeenCalled();
  });
});

// Dropping busy guards, replacing committed values early, or coupling chart mode to range fails these tests.
describe("HistoryControls pending, error and external commit", () => {
  it("blocks range resubmission during pending but permits navigation and Escape", async () => {
    const p = props({ pending: true }); const user = userEvent.setup(); render(<HistoryControls {...p} />);
    expect(screen.getByRole("status")).toHaveTextContent(/加载|读取/);
    await user.click(rangeTrigger());
    expect(screen.getByRole("option", { name: "2026" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "2024–2026" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{End}{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "2024–2026" }));
    expect(p.onRangeApply).not.toHaveBeenCalled();
    expect(rangeTrigger()).toHaveTextContent("2026");
    await user.keyboard("{Escape}"); expect(rangeTrigger()).toHaveFocus();
  });

  it("keeps metric interaction independent of pending and reports only chart mode", async () => {
    const p = props({ pending: true }); render(<HistoryControls {...p} />);
    await userEvent.click(metricTrigger()); await userEvent.click(screen.getByRole("option", { name: "各期胜率" }));
    expect(p.onChartModeChange).toHaveBeenCalledExactlyOnceWith("win-rate");
    expect(p.onRangeApply).not.toHaveBeenCalled();
    expect(metricTrigger()).toHaveTextContent("每月净盈亏"); expect(rangeTrigger()).toHaveTextContent("2026");
  });

  it("retains old applied range through request/pending/error, permits retry, and changes only on caller commit", async () => {
    const p = props(); const { rerender } = render(<HistoryControls {...p} />);
    await userEvent.click(rangeTrigger()); await userEvent.click(screen.getByRole("option", { name: "2024–2026" }));
    rerender(<HistoryControls {...p} pending />);
    expect(rangeTrigger()).toHaveTextContent("2026"); expect(metricTrigger()).toHaveTextContent("每月净盈亏");
    rerender(<HistoryControls {...p} error="读取失败：连接中断，请重新选择范围重试" />);
    expect(screen.getByRole("alert")).toHaveTextContent("连接中断");
    expect(rangeTrigger()).toHaveTextContent("2026"); expect(metricTrigger()).toHaveTextContent("每月净盈亏");
    await userEvent.click(rangeTrigger()); await userEvent.click(screen.getByRole("option", { name: "2024–2026" }));
    expect(p.onRangeApply).toHaveBeenCalledTimes(2);
    rerender(<HistoryControls {...p} appliedRange={{ mode: "years", fromYear: 2024, toYear: 2026 }} />);
    expect(rangeTrigger()).toHaveTextContent("2024–2026"); expect(metricTrigger()).toHaveTextContent("每年净盈亏");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("syncs external applied selection while open without callback backflow or unrelated state changes", async () => {
    const p = props(); const { rerender } = render(<><input aria-label="页面其他状态" defaultValue="保持" /><HistoryControls {...p} /></>);
    await userEvent.click(rangeTrigger());
    rerender(<><input aria-label="页面其他状态" defaultValue="保持" /><HistoryControls {...p} appliedRange={{ mode: "all" }} /></>);
    expect(screen.getByRole("option", { name: "全部" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "全部" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "页面其他状态" })).toHaveValue("保持");
    expect(p.onRangeApply).not.toHaveBeenCalled(); expect(p.onChartModeChange).not.toHaveBeenCalled();
  });

  it("retains compact applied text and full long descriptions through pending, error, retry, keyboard exit and caller commit", async () => {
    const longOptions = options.map(option => ({ ...option, label: `${option.label}：全部已经确认可用的很长历史年度范围` }));
    const p = props({ rangeOptions: longOptions }); const user = userEvent.setup();
    const { rerender } = render(<HistoryControls {...p} />);
    expect(rangeTrigger().textContent).toBe("2026");
    await user.click(rangeTrigger()); await user.tab();
    expect(metricTrigger()).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(rangeTrigger()); await user.keyboard("{End}{Escape}");
    expect(rangeTrigger()).toHaveFocus(); expect(p.onRangeApply).not.toHaveBeenCalled();
    await user.click(rangeTrigger()); await user.click(screen.getByRole("option", { name: longOptions[2].label }));
    expect(p.onRangeApply).toHaveBeenCalledExactlyOnceWith(options[2].range);
    rerender(<HistoryControls {...p} pending />);
    expect(rangeTrigger().textContent).toBe("2026");
    expect(rangeTrigger()).toHaveAttribute("title", longOptions[0].label);
    expect(metricTrigger()).toHaveTextContent("每月净盈亏");
    await user.click(rangeTrigger()); await user.click(screen.getByRole("option", { name: longOptions[2].label }));
    expect(p.onRangeApply).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    await user.click(metricTrigger()); await user.click(screen.getByRole("option", { name: "累计净盈亏" }));
    expect(p.onChartModeChange).toHaveBeenCalledExactlyOnceWith("cumulative-pnl");
    expect(p.onRangeApply).toHaveBeenCalledTimes(1);
    rerender(<HistoryControls {...p} error="读取失败：请重新选择历史范围重试" />);
    expect(rangeTrigger().textContent).toBe("2026");
    expect(rangeTrigger()).toHaveAccessibleName(`历史范围：${longOptions[0].label}`);
    expect(screen.getByRole("alert")).toHaveTextContent("请重新选择历史范围重试");
    await user.click(rangeTrigger()); await user.click(screen.getByRole("option", { name: longOptions[2].label }));
    expect(p.onRangeApply).toHaveBeenNthCalledWith(2, options[2].range);
    rerender(<HistoryControls {...p} appliedRange={options[2].range} />);
    expect(rangeTrigger().textContent).toBe("2024–2026");
    expect(rangeTrigger()).toHaveAccessibleName(`历史范围：${longOptions[2].label}`);
    expect(rangeTrigger()).toHaveAttribute("title", longOptions[2].label);
    expect(metricTrigger()).toHaveTextContent("每年净盈亏");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// Incorrect metric order, ignored controlled selection or a range callback in metric handlers fails these tests.
describe("HistoryControls chart modes", () => {
  it.each([
    ["period-pnl", "每月净盈亏"], ["cumulative-pnl", "累计净盈亏"], ["win-rate", "各期胜率"], ["round-count", "各期回合数"],
  ] as const)("reports %s from click while preserving caller-controlled selection", async (mode, label) => {
    const p = props(); const { rerender } = render(<HistoryControls {...p} />);
    await userEvent.click(metricTrigger());
    expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual(["每月净盈亏", "累计净盈亏", "各期胜率", "各期回合数"]);
    await userEvent.click(screen.getByRole("option", { name: label }));
    expect(p.onChartModeChange).toHaveBeenCalledExactlyOnceWith(mode); expect(p.onRangeApply).not.toHaveBeenCalled();
    rerender(<HistoryControls {...p} chartMode={mode} />);
    expect(metricTrigger()).toHaveTextContent(label);
    await userEvent.click(metricTrigger()); expect(screen.getByRole("option", { name: label })).toHaveFocus();
    expect(screen.getByRole("option", { name: label })).toHaveAttribute("aria-selected", "true");
  });

  it("uses the same explicit navigation/submit/close contract for the metric menu", async () => {
    const p = props({ chartMode: "win-rate" }); const user = userEvent.setup(); render(<HistoryControls {...p} />);
    metricTrigger().focus(); await user.keyboard(" ");
    expect(screen.getByRole("option", { name: "各期胜率" })).toHaveFocus();
    await user.keyboard("{Home}{End}{ArrowUp}"); expect(p.onChartModeChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}"); expect(metricTrigger()).toHaveFocus();
    await user.keyboard("{Enter}{End}{Enter}");
    expect(p.onChartModeChange).toHaveBeenCalledExactlyOnceWith("round-count");
    expect(metricTrigger()).toHaveFocus(); expect(p.onRangeApply).not.toHaveBeenCalled();
  });
});

// Fake default options, missing numeric validation or stale option lists fail these tests.
describe("HistoryControls caller option boundaries", () => {
  it("shows a readable empty reason without inventing year options", async () => {
    const p = props({ rangeOptions: [] }); const user = userEvent.setup(); render(<HistoryControls {...p} />);
    await user.click(rangeTrigger());
    expect(within(screen.getByRole("listbox")).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/暂无可选历史范围/)).toBeInTheDocument();
    await user.keyboard("{Home}{End}{ArrowDown}{Enter}{Escape}");
    expect(rangeTrigger()).toHaveFocus(); expect(p.onRangeApply).not.toHaveBeenCalled();
  });

  it.each([
    { mode: "year", year: 2026.5 }, { mode: "year", year: NaN }, { mode: "year", year: 0 },
    { mode: "this-year", year: 10000 }, { mode: "years", fromYear: 2026, toYear: 2024 },
    { mode: "years", fromYear: 2024.5, toYear: 2026 },
  ] satisfies HomepageHistoryRange[])("does not submit malformed range %j", async range => {
    const p = props({ rangeOptions: [{ id: "invalid", label: "无效范围", range }] });
    render(<HistoryControls {...p} />); await userEvent.click(rangeTrigger());
    const option = screen.getByRole("option", { name: /无效范围/ });
    expect(option).toHaveAttribute("aria-disabled", "true"); await userEvent.click(option); fireEvent.keyDown(option, { key: "Enter" });
    expect(p.onRangeApply).not.toHaveBeenCalled(); expect(screen.getByText(/年份.*整数.*起止/)).toBeInTheDocument();
  });

  it("preserves the full long numerical range and caller error text", async () => {
    const custom = [{ id: "full", label: "0001–9999", range: { mode: "years", fromYear: 1, toYear: 9999 } }] as const;
    render(<HistoryControls {...props({ rangeOptions: custom, appliedRange: custom[0].range, error: "读取失败：完整错误原因应保持可读，重新选择范围后重试。" })} />);
    expect(rangeTrigger().textContent).toBe("1–9999");
    expect(rangeTrigger()).toHaveAccessibleName("历史范围：0001–9999");
    expect(rangeTrigger()).toHaveAttribute("title", "0001–9999");
    expect(screen.getByRole("alert")).toHaveTextContent("完整错误原因应保持可读");
    await userEvent.click(rangeTrigger()); await userEvent.click(screen.getByRole("option", { name: "0001–9999" }));
  });

  it("updates a caller-supplied option list while open without stale submit targets", async () => {
    const p = props(); const { rerender } = render(<HistoryControls {...p} />);
    await userEvent.click(rangeTrigger());
    rerender(<HistoryControls {...p} rangeOptions={[{ id: "new-year", label: "2039", range: { mode: "year", year: 2039 } }]} />);
    expect(screen.queryByRole("option", { name: "2024–2026" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "2039" }));
    expect(p.onRangeApply).toHaveBeenCalledExactlyOnceWith({ mode: "year", year: 2039 });
    expect(rangeTrigger()).toHaveTextContent("2026");
  });
});
