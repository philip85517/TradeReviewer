import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginHomepagePeriodApply, beginHomepageRead, createHomepageState } from "../../lib/reviews/homepage-v25-state";
import { homepageHoldingsFixture } from "./holdings-test-fixture";
import { PeriodSurface } from "./period-surface";

const scope = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const model = homepageHoldingsFixture([], { scope, asOf: "2026-10-24T16:01:00Z", universe: "unknown" });
const props = { view: model.view, ui: createHomepageState(scope), ready: true, active: true, statusId: "header-status", onApply: vi.fn(() => true) };
const trigger = () => screen.getByRole("button", { name: /自定义日期，当前期间/ });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("PeriodSurface owns editing, not the committed financial view", () => {
  it("uses the source Shanghai day for shortcuts, never the machine day", () => {
    render(<PeriodSurface {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "本周" }));
    expect(props.onApply).toHaveBeenCalledExactlyOnceWith({ preset: "week", from: "2026-10-19", to: "2026-10-25" });
    expect(trigger()).toHaveTextContent("2026-10-24");
  });
  it("leaves unknown all bounds unknown and accepts no invented inception", () => {
    render(<PeriodSurface {...props} view={{ ...model.view, range: { preset: "all", from: null, to: null }, bounds: { state: "unknown", start: null, end: null, reasons: ["inception unknown"] } }} />);
    expect(trigger()).toHaveTextContent("全部期间 · 日期暂不可用");
    fireEvent.click(trigger());
    expect(screen.getByLabelText("开始日期")).toHaveValue("");
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
  });
  it("keeps incomplete text and cancellation local, with no apply or retry action", () => {
    render(<PeriodSurface {...props} />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(trigger()).toHaveFocus();
    fireEvent.click(trigger());
    expect(screen.getByLabelText("开始日期")).toHaveValue("2026-");
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
    expect(props.onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /重试/ })).not.toBeInTheDocument();
  });
  it("keeps local Cancel usable while pending, then blocks reopening without a body feedback row", () => {
    const { rerender } = render(<PeriodSurface {...props} />);
    fireEvent.click(trigger());
    const pending = beginHomepagePeriodApply(props.ui, { preset: "custom", from: "2026-10-01", to: "2026-10-02" }, 1);
    rerender(<PeriodSurface {...props} ui={pending} />);
    expect(screen.getByLabelText("开始日期")).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(trigger()).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".hp-period-selector__feedback")).toBeNull();
    expect(screen.getByRole("group", { name: "期间选择" })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "本周" }));
    expect(props.onApply).not.toHaveBeenCalled();
  });
  it("closes on a global read and focuses the stable heading rather than the disabled trigger", () => {
    const { rerender } = render(<PeriodSurface {...props} />);
    fireEvent.click(trigger());
    expect(screen.getByLabelText("开始日期")).toHaveFocus();
    rerender(<PeriodSurface {...props} ui={beginHomepageRead(props.ui, { purpose: "refresh" }, 1)} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "当前表现" })).toHaveFocus();
    expect(trigger()).toBeDisabled();
    rerender(<PeriodSurface {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps all four old card values and old curve on request error; only a committed view changes the applied label", () => {
    const { rerender } = render(<PeriodSurface {...props} />);
    const values = screen.getAllByTestId("hp-metric-value").map(node => node.textContent);
    const chart = screen.getByRole("region", { name: "当前表现日曲线" });
    const oldText = chart.textContent;
    rerender(<PeriodSurface {...props} ui={{ ...props.ui, errors: { ...props.ui.errors, period: "B failed" } }} />);
    expect(screen.getAllByTestId("hp-metric-value").map(node => node.textContent)).toEqual(values);
    expect(chart.textContent).toBe(oldText);
    expect(within(chart).queryByText("B failed")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("2026-10-24");
  });
  it("reserves the final four cards and chart while no source has been accepted", () => {
    render(<PeriodSurface {...props} view={null} ready={false} />);
    expect(screen.getAllByTestId("hp-metric-skeleton")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "期间数据读取中" })).toBeDisabled();
    expect(screen.queryByText(/上海日期不可用/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前表现日曲线" })).toBeInTheDocument();
  });
  it("retains an unsubmitted draft through a local commit but resets it when the global source identity changes", () => {
    const { rerender } = render(<PeriodSurface {...props} />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-09-" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    const local = { ...model.view, stamp: { ...model.view.stamp, requestGeneration: "local-next" }, range: { preset: "custom" as const, from: "2026-10-01", to: "2026-10-02" } };
    rerender(<PeriodSurface {...props} view={local} />);
    fireEvent.click(trigger());
    expect(screen.getByLabelText("开始日期")).toHaveValue("2026-09-");
    const global = { ...local, stamp: { ...local.stamp, selectionKey: "different-account" } };
    rerender(<PeriodSurface {...props} view={global} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger());
    expect(screen.getByLabelText("开始日期")).toHaveValue("2026-10-01");
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
