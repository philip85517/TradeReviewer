/// <reference types="node" />

import { readFileSync } from "node:fs";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomepagePeriod } from "../../lib/reviews/homepage-v25-state";
import { PeriodSelector, type PeriodSelectorProps } from "./period-selector";

const YEAR: HomepagePeriod = { preset: "ytd", from: "2026-01-01", to: "2026-10-23" };

function props(overrides: Partial<PeriodSelectorProps> = {}): PeriodSelectorProps {
  return {
    applied: YEAR,
    draft: { from: "2026-10-01", to: "2026-10-15" },
    today: "2026-10-23",
    allRange: null,
    open: false,
    pending: false,
    error: null,
    onDraftChange: vi.fn(),
    onOpenChange: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };
}

function Controlled({ initial = {}, onApply = vi.fn() }: {
  initial?: Partial<PeriodSelectorProps>; onApply?: PeriodSelectorProps["onApply"];
}) {
  const [draft, setDraft] = useState(initial.draft ?? { from: "2026-10-01", to: "2026-10-15" });
  const [open, setOpen] = useState(initial.open ?? false);
  return <PeriodSelector {...props(initial)} draft={draft} open={open}
    onDraftChange={setDraft} onOpenChange={setOpen} onApply={onApply} />;
}

function rangeTrigger() {
  return screen.getByRole("button", { name: /^自定义日期，当前期间/ });
}

function mountSelectorStyles() {
  const style = document.createElement("style");
  style.textContent = readFileSync("app/components/homepage-v25/period-selector.css", "utf8");
  document.head.appendChild(style);
  return style;
}

// jsdom has no layout. Supply only browser geometry; the real component must place the overlay.
function mockSelectorLayout(initial: { viewport: number; left: number; top?: number; rowHeight?: number; extraHeight?: number }) {
  const layout = { top: 120, rowHeight: 36, extraHeight: 0, ...initial };
  vi.spyOn(document.documentElement, "clientWidth", "get").mockImplementation(() => layout.viewport);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const rowWidth = Math.min(456, layout.viewport - 48);
    if (this.classList.contains("hp-period-selector")) {
      return new DOMRect(layout.left, layout.top, rowWidth, layout.rowHeight + layout.extraHeight);
    }
    if (this.classList.contains("hp-period-selector__toolbar")) {
      return new DOMRect(layout.left, layout.top, rowWidth, layout.rowHeight);
    }
    if (this.classList.contains("hp-period-selector__popover")) {
      return new DOMRect(
        layout.left + (Number.parseFloat(this.style.left) || 0),
        layout.top + (Number.parseFloat(this.style.top) || layout.rowHeight + layout.extraHeight + 24),
        Math.min(480, layout.viewport - 48),
        220,
      );
    }
    return new DOMRect();
  });
  return layout;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("controlled homepage period selector", () => {
  it("PS01 keeps applied label and selected shortcut when the draft differs", () => {
    render(<PeriodSelector {...props()} />);
    expect(screen.getByRole("button", { name: "本年" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "本月" })).toHaveAttribute("aria-pressed", "false");
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("PS02 reports opening directly and waits for controlled open before showing fields", async () => {
    const user = userEvent.setup();
    const current = props();
    const mounted = render(<PeriodSelector {...current} />);
    await user.click(rangeTrigger());
    expect(current.onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(current.onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    mounted.rerender(<PeriodSelector {...current} open />);
    expect(screen.getByRole("dialog", { name: "自定义日期" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "开始日期" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "结束日期" })).toHaveValue("2026-10-15");
  });

  it("PS03 edits only draft and requests custom once without committing a new label", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<Controlled initial={{ open: true }} onApply={onApply} />);
    fireEvent.change(screen.getByRole("textbox", { name: "开始日期" }), { target: { value: "2026-10-02" } });
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
    expect(onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ preset: "custom", from: "2026-10-02", to: "2026-10-15" });
    expect(screen.getByRole("button", { name: "本年" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("PS04 associates reversed range errors with both fields and blocks pointer and Enter submission", async () => {
    const user = userEvent.setup();
    const current = props({ open: true, draft: { from: "2026-10-16", to: "2026-10-15" } });
    render(<PeriodSelector {...current} />);
    const start = screen.getByRole("textbox", { name: "开始日期" });
    const end = screen.getByRole("textbox", { name: "结束日期" });
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(start).toHaveAccessibleDescription(/开始日期不能晚于结束日期/);
    expect(end).toHaveAccessibleDescription(/开始日期不能晚于结束日期/);
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "应用" }));
    await user.click(end);
    await user.keyboard("{Enter}");
    expect(current.onApply).not.toHaveBeenCalled();
  });

  it.each([
    ["empty start", "", "2026-10-15", "开始日期"],
    ["empty end", "2026-10-01", "", "结束日期"],
    ["impossible day", "2026-02-30", "2026-10-15", "开始日期"],
    ["non-leap century", "1900-02-29", "1900-03-01", "开始日期"],
    ["wrong format", "2026-2-01", "2026-10-15", "开始日期"],
    ["invalid end", "2026-10-01", "2026-13-01", "结束日期"],
  ])("PS05 blocks %s and identifies its field", (_case, from, to, field) => {
    const current = props({ open: true, draft: { from, to } });
    render(<PeriodSelector {...current} />);
    const input = screen.getByRole("textbox", { name: field });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/请输入|日期有效/);
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "应用" }).closest("form")!);
    expect(current.onApply).not.toHaveBeenCalled();
  });

  it("PS06 allows valid future dates and Gregorian leap-century dates", async () => {
    const user = userEvent.setup();
    const current = props({ open: true, draft: { from: "2028-02-29", to: "2028-03-01" } });
    const mounted = render(<PeriodSelector {...current} />);
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(current.onApply).toHaveBeenLastCalledWith({ preset: "custom", from: "2028-02-29", to: "2028-03-01" });
    mounted.rerender(<PeriodSelector {...current} draft={{ from: "2000-02-29", to: "2000-03-01" }} />);
    expect(screen.getByRole("button", { name: "应用" })).toBeEnabled();
  });

  it("PS07 keeps applied and draft through pending/failure/retry until controlled success", async () => {
    const user = userEvent.setup();
    const current = props({ open: true });
    const mounted = render(<PeriodSelector {...current} />);
    const target = { preset: "custom", from: "2026-10-01", to: "2026-10-15" } satisfies HomepagePeriod;
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(current.onApply).toHaveBeenCalledExactlyOnceWith(target);
    mounted.rerender(<PeriodSelector {...current} pending />);
    expect(screen.getByRole("status")).toHaveTextContent(/正在应用.*保留/);
    expect(screen.getByRole("button", { name: /应用中/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "开始日期" })).toHaveValue("2026-10-01");
    await user.click(screen.getByRole("button", { name: "本周" }));
    await user.click(screen.getByRole("textbox", { name: "结束日期" }));
    await user.keyboard("{Enter}");
    expect(current.onApply).toHaveBeenCalledTimes(1);
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
    mounted.rerender(<PeriodSelector {...current} error="网络连接失败" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/新选择未应用.*网络连接失败/);
    expect(screen.getByRole("textbox", { name: "结束日期" })).toHaveValue("2026-10-15");
    expect(screen.getByRole("button", { name: "本年" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(current.onApply).toHaveBeenCalledTimes(2);
    expect(current.onApply).toHaveBeenLastCalledWith(target);
    mounted.rerender(<PeriodSelector {...current} applied={target} open={false} />);
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-10-01 至 2026-10-15");
    expect(screen.getByRole("button", { name: "本年" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rangeTrigger()).toHaveFocus();
  });

  it.each(["cancel", "escape", "outside"])("PS08 %s closes, preserves draft/applied and restores trigger focus", async action => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<><Controlled initial={{ open: true }} onApply={onApply} /><button>外部操作</button></>);
    fireEvent.change(screen.getByRole("textbox", { name: "开始日期" }), { target: { value: "2026-09-28" } });
    if (action === "cancel") await user.click(screen.getByRole("button", { name: "取消" }));
    if (action === "escape") await user.keyboard("{Escape}");
    if (action === "outside") await user.click(screen.getByRole("button", { name: "外部操作" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rangeTrigger()).toHaveFocus();
    expect(onApply).not.toHaveBeenCalled();
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
    await user.click(rangeTrigger());
    expect(screen.getByRole("textbox", { name: "开始日期" })).toHaveValue("2026-09-28");
  });

  it("PS09 keeps a clear keyboard boundary and never submits Escape", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<Controlled initial={{ open: true }} onApply={onApply} />);
    const start = screen.getByRole("textbox", { name: "开始日期" });
    const end = screen.getByRole("textbox", { name: "结束日期" });
    expect(start).toHaveFocus();
    await user.tab();
    expect(end).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "应用" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
    await user.tab();
    expect(start).toHaveFocus();
    await user.tab({ shift: true });
    expect(rangeTrigger()).toHaveFocus();
    await user.tab();
    expect(start).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onApply).not.toHaveBeenCalled();
    expect(rangeTrigger()).toHaveFocus();
  });

  it("PS10 arrows/Home/End move focus only; Enter and Space request the focused shortcut", async () => {
    const user = userEvent.setup();
    const current = props();
    render(<PeriodSelector {...current} />);
    const year = screen.getByRole("button", { name: "本年" });
    const month = screen.getByRole("button", { name: "本月" });
    const week = screen.getByRole("button", { name: "本周" });
    await user.tab();
    expect(year).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(month).toHaveFocus();
    await user.keyboard("{End}");
    expect(week).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(year).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(week).toHaveFocus();
    await user.keyboard("{Home}");
    expect(year).toHaveFocus();
    expect(current.onApply).not.toHaveBeenCalled();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(current.onApply).toHaveBeenCalledExactlyOnceWith({ preset: "month", from: "2026-10-01", to: "2026-10-23" });
    await user.keyboard("{End} ");
    expect(current.onApply).toHaveBeenCalledTimes(2);
    expect(current.onApply).toHaveBeenLastCalledWith({ preset: "week", from: "2026-10-19", to: "2026-10-23" });
    expect(year).toHaveAttribute("aria-pressed", "true");
  });

  it.each([
    ["2026-10-19", "本周", { preset: "week", from: "2026-10-19", to: "2026-10-19" }],
    ["2026-10-25", "本周", { preset: "week", from: "2026-10-19", to: "2026-10-25" }],
    ["2027-01-01", "本周", { preset: "week", from: "2026-12-28", to: "2027-01-01" }],
    ["2024-03-01", "本周", { preset: "week", from: "2024-02-26", to: "2024-03-01" }],
    ["2024-02-29", "本月", { preset: "month", from: "2024-02-01", to: "2024-02-29" }],
    ["2024-02-29", "本年", { preset: "ytd", from: "2024-01-01", to: "2024-02-29" }],
  ])("PS11 derives %s %s from Shanghai civil today with inclusive literal endpoints", async (today, label, target) => {
    const user = userEvent.setup();
    const current = props({ today });
    render(<PeriodSelector {...current} />);
    await user.click(screen.getByRole("button", { name: label }));
    expect(current.onApply).toHaveBeenCalledExactlyOnceWith(target);
  });

  it("PS12 uses caller Shanghai date across UTC midnight and ignores ambient clock changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T16:01:00Z")); // Shanghai already Oct24.
    const current = props({ today: "2026-10-24" });
    const mounted = render(<PeriodSelector {...current} />);
    fireEvent.click(screen.getByRole("button", { name: "本月" }));
    expect(current.onApply).toHaveBeenLastCalledWith({ preset: "month", from: "2026-10-01", to: "2026-10-24" });
    vi.setSystemTime(new Date("2032-01-01T00:00:00Z"));
    mounted.rerender(<PeriodSelector {...current} />);
    fireEvent.click(screen.getByRole("button", { name: "本周" }));
    expect(current.onApply).toHaveBeenLastCalledWith({ preset: "week", from: "2026-10-19", to: "2026-10-24" });
  });

  it("PS13 renders supplied all boundaries and never guesses them from draft or today", () => {
    const current = props({ applied: { preset: "all", from: null, to: null }, allRange: { from: "2018-03-02", to: "2026-10-22" } });
    const mounted = render(<PeriodSelector {...current} />);
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2018-03-02 至 2026-10-22");
    for (const button of within(screen.getByRole("group", { name: "快捷期间" })).getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
    mounted.rerender(<PeriodSelector {...current} allRange={null} />);
    expect(rangeTrigger()).toHaveAccessibleName(/全部期间，起止日期暂不可用/);
    expect(rangeTrigger()).not.toHaveAccessibleName(/2026-10-01/);
  });

  it("PS14 invalid today disables shortcuts with a readable reason without blocking custom editing", async () => {
    const user = userEvent.setup();
    const current = props({ today: "2026-02-30", open: true });
    render(<PeriodSelector {...current} />);
    for (const label of ["本年", "本月", "本周"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
      expect(screen.getByRole("button", { name: label })).toHaveAccessibleDescription(/上海日期不可用/);
    }
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(current.onApply).toHaveBeenCalledExactlyOnceWith({ preset: "custom", from: "2026-10-01", to: "2026-10-15" });
  });

  it("PS15 pending suppresses shortcut Enter/Space while arrows and failure feedback stay readable", async () => {
    const user = userEvent.setup();
    const current = props({ pending: true });
    render(<PeriodSelector {...current} />);
    await user.tab();
    await user.keyboard("{ArrowRight}{Enter} ");
    expect(screen.getByRole("button", { name: "本月" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "本月" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "本月" })).toHaveAccessibleDescription(/正在应用/);
    expect(current.onApply).not.toHaveBeenCalled();
  });

  it("PS16 form Enter submits a valid draft once rather than navigating or applying a shortcut", async () => {
    const user = userEvent.setup();
    const current = props({ open: true });
    render(<PeriodSelector {...current} />);
    await user.keyboard("{Enter}");
    expect(current.onApply).toHaveBeenCalledExactlyOnceWith({ preset: "custom", from: "2026-10-01", to: "2026-10-15" });
    expect(current.onOpenChange).not.toHaveBeenCalled();
  });

  it("PS17 closing the pending editor only dismisses it; the caller still publishes its result", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const initial: Partial<PeriodSelectorProps> = { open: true, pending: true };
    const mounted = render(<Controlled initial={initial} onApply={onApply} />);
    await user.click(rangeTrigger());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rangeTrigger()).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(/正在应用/);
    expect(screen.getByRole("button", { name: "本年" })).toHaveAttribute("aria-pressed", "true");
    expect(onApply).not.toHaveBeenCalled();
    await user.click(rangeTrigger());
    expect(screen.getByRole("textbox", { name: "开始日期" })).toHaveValue("2026-10-01");
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.getByRole("status")).toHaveTextContent(/正在应用/);
    const applied: HomepagePeriod = { preset: "custom", from: "2026-10-01", to: "2026-10-15" };
    mounted.rerender(<Controlled initial={{ ...initial, pending: false, applied }} onApply={onApply} />);
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-10-01 至 2026-10-15");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("PS18 reports a complete draft without mutating caller input or committing the end-date edit", () => {
    const draft = Object.freeze({ from: "2026-10-01", to: "2026-10-15" });
    const current = props({ open: true, draft });
    render(<PeriodSelector {...current} />);
    fireEvent.change(screen.getByRole("textbox", { name: "结束日期" }), { target: { value: "2026-10-20" } });
    expect(current.onDraftChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-10-01", to: "2026-10-20" });
    expect(draft.to).toBe("2026-10-15");
    expect(screen.getByRole("textbox", { name: "结束日期" })).toHaveValue("2026-10-15");
    expect(current.onApply).not.toHaveBeenCalled();
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
  });

  it.each(["本年", "本月", "本周"])("PS19 outside %s click cancels only; its next click requests normally", async label => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<Controlled initial={{ open: true }} onApply={onApply} />);
    fireEvent.change(screen.getByRole("textbox", { name: "开始日期" }), { target: { value: "2026-09-28" } });
    const shortcut = screen.getByRole("button", { name: label });
    await user.click(shortcut);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    expect(rangeTrigger()).toHaveFocus();
    expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
    await user.click(shortcut);
    expect(onApply).toHaveBeenCalledTimes(1);
    await user.click(rangeTrigger());
    expect(screen.getByRole("textbox", { name: "开始日期" })).toHaveValue("2026-09-28");
  });

  it.each(["cancel", "escape"])("PS20 %s leaves the next pointer and keyboard shortcut activation available", async action => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<Controlled initial={{ open: true }} onApply={onApply} />);
    if (action === "cancel") await user.click(screen.getByRole("button", { name: "取消" }));
    else await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "本月" }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ preset: "month", from: "2026-10-01", to: "2026-10-23" });
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(onApply).toHaveBeenLastCalledWith({ preset: "week", from: "2026-10-19", to: "2026-10-23" });
  });

  it.each([
    { name: "left", viewport: 1440, left: 24, expectedLeft: 24, expectedRight: 504, rowHeight: 36 },
    { name: "right 1440", viewport: 1440, left: 960, expectedLeft: 936, expectedRight: 1416, rowHeight: 36 },
    { name: "right 1280", viewport: 1280, left: 800, expectedLeft: 776, expectedRight: 1256, rowHeight: 36 },
    { name: "outside left gutter", viewport: 1440, left: 8, expectedLeft: 24, expectedRight: 504, rowHeight: 36 },
    { name: "390 wrapped row", viewport: 390, left: 24, expectedLeft: 24, expectedRight: 366, rowHeight: 84 },
  ])("PS21 $name keeps the default/responsive width inside 24px gutters below the toolbar", fixture => {
    const layout = mockSelectorLayout(fixture);
    const style = mountSelectorStyles();
    try {
      const mounted = render(<PeriodSelector {...props({ open: true })} />);
      const panel = screen.getByRole("dialog");
      const beforeRoot = mounted.container.firstElementChild!.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      expect(bounds.left).toBe(fixture.expectedLeft);
      expect(bounds.right).toBe(fixture.expectedRight);
      expect(bounds.top).toBe(layout.top + fixture.rowHeight + 24);
      expect(getComputedStyle(panel).position).toBe("absolute");
      mounted.rerender(<PeriodSelector {...props()} />);
      expect(mounted.container.firstElementChild!.getBoundingClientRect()).toEqual(beforeRoot);
    } finally { style.remove(); }
  });

  it("PS22 follows resize and scrollable ancestors, using the toolbar rather than extra feedback height", () => {
    const layout = mockSelectorLayout({ viewport: 1440, left: 960, extraHeight: 60 });
    render(<div data-testid="scroll-container"><PeriodSelector {...props({ open: true, today: "invalid" })} /></div>);
    const panel = screen.getByRole("dialog");
    expect(panel.getBoundingClientRect().top).toBe(180);
    expect(panel.getBoundingClientRect().right).toBe(1416);
    layout.viewport = 1280;
    layout.left = 800;
    fireEvent(window, new Event("resize"));
    expect(panel.getBoundingClientRect().left).toBe(776);
    expect(panel.getBoundingClientRect().right).toBe(1256);
    layout.left = 4;
    layout.top = 80;
    fireEvent.scroll(screen.getByTestId("scroll-container"));
    expect(panel.getBoundingClientRect().left).toBe(24);
    expect(panel.getBoundingClientRect().top).toBe(140);
  });

  it("PS23 renders server failure in the error token with the real stylesheet cascade", () => {
    const style = mountSelectorStyles();
    try {
      const current = props({ open: true, error: "网络连接失败" });
      const mounted = render(<PeriodSelector {...current} />);
      expect(getComputedStyle(screen.getByRole("alert")).color).toBe("rgb(255, 133, 146)");
      mounted.rerender(<PeriodSelector {...current} open={false} />);
      expect(getComputedStyle(screen.getByRole("alert")).color).toBe("rgb(255, 133, 146)");
      expect(rangeTrigger()).toHaveAccessibleName("自定义日期，当前期间 2026-01-01 至 2026-10-23");
    } finally { style.remove(); }
  });
});
