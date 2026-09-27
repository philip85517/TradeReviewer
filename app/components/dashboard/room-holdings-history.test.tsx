import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHoldingsHistory, type HoldingsHistoryModel } from "../../lib/reviews/trading-room-history";
import { buildRoomMoneyView, createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { RoomHoldingsHistory } from "./room-holdings-history";

afterEach(cleanup);
function model(values: Array<string | null> = ["100", "120", "80"]): HoldingsHistoryModel {
  const scope = createDefaultRoomScope("2026-09-21");
  scope.period = { preset: "custom", startDate: "2026-09-17", endDate: "2026-09-21" };
  const result = buildHoldingsHistory([], { scope, asOf: "2026-09-21" });
  result.points = result.points.slice(0, values.length).map((point, index) => ({ ...point,
    marketValue: buildRoomMoneyView([{ currency: "USD", amount: values[index] }]),
    unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: values[index] === null ? null : String(Number(values[index]) - 100) }]),
    cost: buildRoomMoneyView([{ currency: "USD", amount: "100" }]),
    dailyPnl: buildRoomMoneyView([{ currency: "USD", amount: "3" }]), dailyPnlAvailable: true, dailyPnlReasons: [],
    unrealizedReturnPercent: values[index] === null ? null : String(Number(values[index]) - 100),
    marketValueAvailable: values[index] !== null, unrealizedPnlAvailable: values[index] !== null, available: values[index] !== null,
  }));
  return result;
}
function chart() { return screen.getByRole("img", { name: /持仓.*曲线/ }); }
function hover(x: number) {
  vi.spyOn(chart(), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 720, height: 270, top: 0, left: 0, right: 720, bottom: 270, toJSON: () => ({}) });
  fireEvent.mouseMove(chart(), { clientX: x, clientY: 100 });
}

describe("RoomHoldingsHistory B2", () => {
  it("starts clean, snaps to the nearest x and links five-field tooltip/crosshair/highlight, then clears on leave", () => {
    render(<RoomHoldingsHistory model={model()} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(document.querySelector("[data-history-crosshair]")).toBeNull();
    hover(390);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("2026-09-18");
    expect(within(tooltip).getByText("总市值")).toBeInTheDocument();
    expect(within(tooltip).getByText("未实现盈亏")).toBeInTheDocument();
    expect(within(tooltip).getByText("未实现盈亏率")).toBeInTheDocument();
    expect(within(tooltip).getByText(/当日盈亏/)).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("+20.00");
    expect(document.querySelector("[data-history-crosshair]")).not.toBeNull();
    expect(document.querySelector("[data-history-highlight]")).not.toBeNull();
    fireEvent.mouseLeave(chart());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(document.querySelector("[data-history-highlight]")).toBeNull();
  });
  it("clears selection on metric, granularity, scope, currency and data changes", () => {
    const original = model();
    const view = render(<RoomHoldingsHistory model={original} />);
    hover(66);
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByText("单位：%")).toBeInTheDocument();
    hover(66);
    fireEvent.click(screen.getByRole("button", { name: "周" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    hover(66);
    view.rerender(<RoomHoldingsHistory model={{ ...original, fxSnapshotId: "new-fx" }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    hover(66);
    view.rerender(<RoomHoldingsHistory model={original} reportCurrency="CNY" />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    hover(66);
    view.rerender(<RoomHoldingsHistory model={{ ...original, scope: { ...original.scope, accountIds: ["changed"] } }} reportCurrency="CNY" />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("supports keyboard first/last points and Escape plus explicit date selection/close", () => {
    render(<RoomHoldingsHistory model={model()} />);
    const interaction = screen.getByRole("group", { name: "持仓曲线交互" });
    fireEvent.keyDown(interaction, { key: "Home" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-17");
    fireEvent.keyDown(interaction, { key: "End" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-19");
    fireEvent.keyDown(interaction, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-18" } });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭持仓详情" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("preserves a chart gap and explains missing values while single/empty series are safe", () => {
    const view = render(<RoomHoldingsHistory model={model(["100", null, "80"])} />);
    expect(document.querySelector("[data-history-series]")?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("不可用");
    expect(document.querySelector("[data-history-highlight]")).toBeNull();
    view.rerender(<RoomHoldingsHistory model={model(["-10"])} />);
    hover(390);
    expect(screen.getByRole("tooltip")).toHaveTextContent("-10.00");
    view.rerender(<RoomHoldingsHistory model={model([])} />);
    hover(390);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByText(/没有可查看日期/)).toBeInTheDocument();
  });
  it("keeps touch details open until explicitly closed and displays original currency groups separately", () => {
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      marketValue: buildRoomMoneyView([{ currency: "USD", amount: "120" }, { currency: "CNY", amount: "700" }]),
      unrealizedPnl: buildRoomMoneyView([{ currency: "USD", amount: "20" }, { currency: "CNY", amount: "-10" }]),
    }));
    render(<RoomHoldingsHistory model={input} />);
    vi.spyOn(chart(), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 720, height: 270, top: 0, left: 0, right: 720, bottom: 270, toJSON: () => ({}) });
    fireEvent.touchStart(chart(), { touches: [{ clientX: 700, clientY: 100 }] });
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-09-19");
    expect(screen.getByRole("tooltip")).toHaveTextContent("USD +20.00");
    expect(screen.getByRole("tooltip")).toHaveTextContent("CNY -10.00");
    fireEvent.mouseLeave(chart());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭持仓详情" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps a three-currency mouse tooltip open while the pointer enters its scrollable content", () => {
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      marketValue: buildRoomMoneyView(["USD", "CNY", "HKD"].map(currency => ({ currency, amount: "120" }))),
      unrealizedPnl: buildRoomMoneyView(["USD", "CNY", "HKD"].map(currency => ({ currency, amount: "20" }))),
      dailyPnl: buildRoomMoneyView(["USD", "CNY", "HKD"].map(currency => ({ currency, amount: "3" }))),
      reasons: ["未知成本与缺失行情需要进一步核对".repeat(20)],
    }));
    render(<RoomHoldingsHistory model={input} />);
    hover(390);
    const tooltip = screen.getByRole("tooltip");
    fireEvent.mouseOut(chart(), { relatedTarget: tooltip });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("HKD +3.00");
    fireEvent.mouseLeave(screen.getByRole("group", { name: "持仓曲线交互" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("explains wholly incomplete valuation without a numeric axis while retaining known subtotal details", () => {
    const input = model(["100", "120"]);
    input.points = input.points.map(point => ({ ...point,
      marketValueAvailable: false, unrealizedPnlAvailable: false, available: false,
      reasons: ["部分持仓数量未知"],
    }));
    render(<RoomHoldingsHistory model={input} />);
    expect(screen.getByText("所选期间暂无完整估值；可选日期查看已知小计与缺失原因")).toBeInTheDocument();
    expect(chart().querySelectorAll("line:not([data-history-crosshair])")).toHaveLength(0);
    expect(document.querySelector("[data-history-series]")?.getAttribute("d")).toBe("");
    fireEvent.change(screen.getByLabelText("历史持仓日期"), { target: { value: "2026-09-17" } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("USD 100.00（已知小计）");
    expect(screen.getByRole("tooltip")).toHaveTextContent("部分持仓数量未知");
    fireEvent.click(screen.getByRole("button", { name: "未实现收益率" }));
    expect(screen.getByText("所选期间暂无完整收益率；可选日期查看已知小计与缺失原因")).toBeInTheDocument();
    hover(66);
    expect(screen.getByRole("tooltip")).toHaveTextContent("部分持仓数量未知");
  });

  it("keeps valid partial-period points drawable without declaring the entire period unavailable", () => {
    render(<RoomHoldingsHistory model={model([null, "120", "80"])} />);
    expect(screen.queryByText(/所选期间暂无完整/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-history-series]")?.getAttribute("d")).toContain("L");
    expect(chart().querySelectorAll("line:not([data-history-crosshair])").length).toBeGreaterThan(0);
  });

  it("renders the shell-owned period controls in the chart card slot", () => {
    render(<RoomHoldingsHistory model={model()} periodLabel="持仓历史观察期间" periodControls={<button type="button">今年</button>} />);
    expect(screen.getByRole("group", { name: "持仓历史观察期间" })).toContainElement(screen.getByRole("button", { name: "今年" }));
  });

  it("uses the selected HKD target and keeps original subtotals discoverable when FX is missing", () => {
    const target = buildRoomMoneyView([{ currency: "USD", amount: "120" }], undefined, "HKD");
    const input = model();
    input.points = input.points.map(point => ({ ...point,
      marketValue: target,
      unrealizedPnl: target,
      dailyPnl: target,
    }));
    render(<RoomHoldingsHistory model={input} reportCurrency="HKD" />);
    hover(390);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("目标 HKD 不可用");
    expect(tooltip).toHaveTextContent("USD +120.00");
    expect(tooltip).not.toHaveTextContent("CNY +120.00");
  });

  it("uses positive and negative tones for the primary floating PnL", () => {
    render(<RoomHoldingsHistory model={model(["100", "120", "80"])} />);
    hover(390);
    expect(screen.getByText(/\+20\.00/).className).toContain("gain");
    cleanup();
    render(<RoomHoldingsHistory model={model(["100", "80", "80"])} />);
    hover(390);
    expect(screen.getByText(/-20\.00/).className).toContain("loss");
  });

});
