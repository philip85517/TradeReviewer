import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryChart, type HistoryChartData, type HistoryChartPoint, type HistoryMoneyMetric } from "./history-chart";

// Literal caller facts deliberately disagree across modes: the leaf may select, never derive them.
function money(value: string | null, currency = "CNY"): HistoryMoneyMetric {
  return { value, available: value !== null, reasons: value === null ? ["缺少已提交金额"] : [],
    coverage: { total: 7, available: value === null ? 0 : 7 },
    money: { originalByCurrency: value === null ? {} : { [currency]: value }, targetCurrency: currency, conversion: "same-currency", fx: null } };
}
function scalar(value: string | null, reasons: readonly string[] = []) { return { value, available: value !== null, reasons }; }
function point(key: string, label: string, net: string | null, extra: Partial<HistoryChartPoint> = {}): HistoryChartPoint {
  return { key, label, start: `2026-${key}-01`, end: `2026-${key}-28`, state: net === null ? "source-missing" : "value",
    reasons: net === null ? ["该期源文件缺失"] : [], periodNet: money(net), cumulativeNet: money("98765.432100"),
    roundCount: scalar("3"), winningRounds: scalar("2"), winRate: scalar("12.345"), ...extra };
}
function data(points: readonly HistoryChartPoint[] = [point("01", "1月", "0"),
  point("02", "2月", null, { state: "no-rounds", reasons: ["该期间无已关闭回合"] }), point("03", "3月", "-12345.678900")]): HistoryChartData {
  return { sourceId: "literal-history", requestGeneration: "committed-1", grain: "month",
    range: { label: "2026", start: "2026-01-01", end: "2026-12-31", timeZone: "Asia/Shanghai" }, points };
}
const hit = (key: string) => screen.getByTestId(`hp-history-hit-${key}`);
const reading = () => screen.getByRole("tooltip");
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
});

describe("controlled HistoryChart minimal real journey", () => {
  it("draws supplied values, reads an actual point and gap, exits with Esc, and selects all four modes in one fixed plot", () => {
    const committed = data();
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.getByRole("heading", { name: "每月净盈亏" })).toBeVisible();
    expect(screen.getByText("1月", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByTestId("hp-history-point-01")).toHaveAttribute("r", "3");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const bounds = screen.getByTestId("hp-history-plot").getAttribute("data-bounds");
    fireEvent.mouseEnter(hit("03"));
    expect(reading()).toHaveTextContent("-12345.678900 CNY");
    expect(reading()).toHaveTextContent("Asia/Shanghai");
    expect(screen.getByTestId("hp-history-crosshair")).toBeInTheDocument();
    fireEvent.mouseLeave(hit("03"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.focus(hit("02"));
    expect(reading()).toHaveTextContent("该期间无已关闭回合");
    expect(screen.queryByTestId("hp-history-point-02")).not.toBeInTheDocument();
    fireEvent.keyDown(hit("02"), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    for (const [mode, title, value] of [
      ["cumulative-pnl", "累计净盈亏", "98765.432100 CNY"], ["win-rate", "各期胜率", "12.345%"], ["round-count", "各期回合数", "3 回合"],
    ] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      expect(screen.getByTestId("hp-history-plot")).toHaveAttribute("data-bounds", bounds);
      fireEvent.focus(hit("01"));
      expect(within(reading()).getByTestId("hp-history-primary-reading")).toHaveTextContent(value);
      fireEvent.keyDown(hit("01"), { key: "Escape" });
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /修复|重试|详情/ })).not.toBeInTheDocument();
  });
});

describe("HistoryChart supplied facts and state boundaries", () => {
  it("validates each full-reading scalar independently and retains its own unavailable reason", () => {
    const committed = data([point("01", "1月", "7", {
      roundCount: { value: null, available: true, reasons: ["回合计数来源未提交"] },
      winningRounds: scalar("-2.5"), winRate: scalar("101", ["百分比来源超出范围"]),
    })]);
    render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    fireEvent.focus(hit("01"));
    for (const label of ["回合数", "盈利回合数", "各期胜率"]) {
      const value = within(reading()).getByText(label, { selector: "dt" }).nextElementSibling;
      expect(value).toHaveTextContent("—");
    }
    expect(reading()).toHaveTextContent("回合计数来源未提交");
    expect(reading()).toHaveTextContent("盈利回合数必须是非负整数");
    expect(reading()).toHaveTextContent("百分比来源超出范围");
    expect(reading()).not.toHaveTextContent("-2.5"); expect(reading()).not.toHaveTextContent("101%");
  });

  it("uses semantic annual labels and selects literal rates rather than dividing supplied counts", () => {
    const committed: HistoryChartData = { ...data([point("2024", "2024", "1"), point("2025", "2025", "2")]), grain: "year" };
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.getByRole("heading", { name: "每年净盈亏" })).toBeVisible();
    expect(screen.getByText("2024", { selector: "text" })).toBeInTheDocument();
    for (const [mode, heading, exact] of [["cumulative-pnl", "累计净盈亏", "98765.432100 CNY"],
      ["win-rate", "各期胜率", "12.345%"], ["round-count", "各期回合数", "3 回合"]] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      fireEvent.focus(hit("2024")); expect(screen.getByTestId("hp-history-primary-reading")).toHaveTextContent(exact);
      expect(reading()).not.toHaveTextContent("66.7%");
    }
  });

  it("plots an independently known count and rate when only monetary source data is missing", () => {
    const committed = data([point("01", "1月", null)]);
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.queryByTestId("hp-history-point-01")).not.toBeInTheDocument();
    for (const [mode, expected] of [["round-count", "3 回合"], ["win-rate", "12.345%"]] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.getByTestId("hp-history-point-01")).toBeInTheDocument();
      fireEvent.focus(hit("01")); expect(within(reading()).getByTestId("hp-history-primary-reading")).toHaveTextContent(expected);
      expect(reading()).toHaveTextContent("该期源文件缺失");
    }
  });

  it("only draws explicitly available no-round cumulative values and never carries or fills a gap", () => {
    const committed = data([point("01", "1月", "100"), point("02", "2月", null, { state: "no-rounds", reasons: ["没有关闭回合"], cumulativeNet: money("123.456") }),
      point("03", "3月", null, { state: "no-rounds", cumulativeNet: money(null) })]);
    const { rerender } = render(<HistoryChart data={committed} mode="cumulative-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.getByTestId("hp-history-point-02")).toBeInTheDocument(); expect(screen.queryByTestId("hp-history-point-03")).not.toBeInTheDocument();
    fireEvent.focus(hit("02")); expect(reading()).toHaveTextContent("123.456 CNY"); expect(reading()).toHaveTextContent("没有关闭回合");
    for (const mode of ["period-pnl", "win-rate", "round-count"] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.queryByTestId("hp-history-point-02")).not.toBeInTheDocument();
    }
  });

  it.each(["future", "loading", "error"] as const)("never leaks any supplied numeric fact from a %s point", state => {
    const forbidden = "987654321.123456789";
    const committed = data([point("01", "1月", forbidden, { state, reasons: [`${state}精确原因`], cumulativeNet: money(forbidden),
      roundCount: scalar(forbidden), winningRounds: scalar(forbidden), winRate: scalar(forbidden) })]);
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    for (const mode of ["period-pnl", "cumulative-pnl", "win-rate", "round-count"] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.queryByTestId("hp-history-point-01")).not.toBeInTheDocument();
      fireEvent.focus(hit("01")); expect(reading()).toHaveTextContent(`${state}精确原因`);
      expect(reading()).not.toHaveTextContent(forbidden); expect(reading()).not.toHaveTextContent("7 / 7");
      expect(hit("01").getAttribute("aria-label")).not.toContain(forbidden);
    }
  });

  it("separates adjacent gap semantics and never connects across unavailable endpoints", () => {
    const committed = data([point("01", "1月", "10"), point("02", "2月", null, { state: "no-rounds" }), point("03", "3月", null),
      point("04", "4月", "20"), point("05", "5月", "30"), point("06", "6月", "99999999", { state: "future" })]);
    render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.getAllByTestId("hp-history-segment")).toHaveLength(2);
    const noRounds = screen.getByTestId("hp-history-region-02"); const missing = screen.getByTestId("hp-history-region-03");
    expect(noRounds).toHaveAttribute("data-state", "no-rounds"); expect(missing).toHaveAttribute("data-state", "source-missing");
    expect(screen.getByTestId("hp-history-region-06")).toHaveAttribute("data-state", "future");
    expect(screen.getAllByTestId("hp-history-segment")[0].getAttribute("points")?.split(" ")).toHaveLength(1);
  });

  it("retains real zero at the zero axis while missing values remain unavailable", () => {
    render(<HistoryChart data={data([point("01", "1月", "0"), point("02", "2月", null)])} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const zero = screen.getByTestId("hp-history-point-01");
    expect(zero.getAttribute("cy")).toBe(screen.getByTestId("hp-history-zero-line").getAttribute("y1"));
    fireEvent.focus(hit("01")); expect(within(reading()).getByTestId("hp-history-primary-reading")).toHaveTextContent(/^0 CNY$/);
    fireEvent.focus(hit("02")); expect(within(reading()).getByTestId("hp-history-primary-reading")).toHaveTextContent(/^—$/);
  });

  it("keeps sub-unit monetary ticks distinct instead of rounding an entire nonzero range to zero", () => {
    render(<HistoryChart data={data([point("01", "1月", "-0.0125"), point("02", "2月", "0.0250")])} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const ticks = screen.getAllByTestId("hp-history-y-tick").map(tick => tick.textContent);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks).toContain("0"); expect(ticks.some(tick => tick?.startsWith("-0."))).toBe(true);
    fireEvent.focus(hit("02")); expect(screen.getByTestId("hp-history-primary-reading")).toHaveTextContent("0.0250 CNY");
  });

  it("fixes rate endpoints at0/100 and count ticks are integers covering actual known counts", () => {
    const committed = data([point("01", "1月", "1", { winRate: scalar("0"), roundCount: scalar("0") }),
      point("02", "2月", "1", { winRate: scalar("100"), roundCount: scalar("137") })]);
    const { rerender } = render(<HistoryChart data={committed} mode="win-rate" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.getAllByTestId("hp-history-y-tick").map(node => node.textContent)).toEqual(["0%", "25%", "50%", "75%", "100%"]);
    expect(Number(screen.getByTestId("hp-history-point-01").getAttribute("cy"))).toBe(276);
    expect(Number(screen.getByTestId("hp-history-point-02").getAttribute("cy"))).toBe(76);
    rerender(<HistoryChart data={committed} mode="round-count" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const ticks = screen.getAllByTestId("hp-history-y-tick").map(node => Number(node.textContent));
    expect(ticks.every(Number.isInteger)).toBe(true); expect(Math.min(...ticks)).toBe(0); expect(Math.max(...ticks)).toBeGreaterThanOrEqual(137);
  });

  it("keeps an extreme caller integer count exact in readings without exhausting the narrow plot width", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 342, 320));
    const exact = "123456789012345678901234567890";
    render(<HistoryChart data={data([point("01", "1月", "1", { roundCount: scalar(exact) })])} mode="round-count" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const [left, , right] = screen.getByTestId("hp-history-plot").getAttribute("data-bounds")!.split(",").map(Number);
    expect(right - left).toBeGreaterThan(180);
    expect(screen.getAllByTestId("hp-history-y-tick").every(tick => Number.isInteger(Number(tick.textContent)))).toBe(true);
    fireEvent.focus(hit("01")); expect(screen.getByTestId("hp-history-primary-reading")).toHaveTextContent(`${exact} 回合`);
  });

  it.each([
    ["win-rate", "101", "胜率必须在0%至100%之间"], ["win-rate", "-0.1", "胜率必须在0%至100%之间"],
    ["round-count", "1.5", "回合数必须是非负整数"], ["round-count", "-1", "回合数必须是非负整数"],
    ["period-pnl", "NaN", "读数格式无效"], ["period-pnl", "Infinity", "读数格式无效"],
  ] as const)("fails closed on invalid %s=%s with an explanation", (mode, value, reason) => {
    const committed = data([point("01", "1月", value, { winRate: scalar(value), roundCount: scalar(value) })]);
    render(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.queryByTestId("hp-history-point-01")).not.toBeInTheDocument();
    fireEvent.focus(hit("01")); expect(within(reading()).getByTestId("hp-history-primary-reading")).toHaveTextContent(/^—$/);
    expect(reading()).toHaveTextContent(reason);
  });

  it("fails closed on currency mismatch and preserves source currency without relabeling it", () => {
    const committed = data([point("01", "1月", "1", { periodNet: money("123.4500", "USD") })]);
    render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.queryByTestId("hp-history-point-01")).not.toBeInTheDocument(); fireEvent.focus(hit("01"));
    expect(within(reading()).getByTestId("hp-history-primary-reading")).toHaveTextContent(/^—$/);
    expect(reading()).toHaveTextContent("币种与报表不一致"); expect(reading()).toHaveTextContent("123.4500 USD");
    expect(reading()).not.toHaveTextContent("123.4500 CNY");
  });

  it("preserves exact huge signed monetary strings, original currencies, FX and coverage for a single thin point", () => {
    const exact = "-123456789012345678901234567890.12345678901234567890";
    const metric: HistoryMoneyMetric = { ...money(exact), coverage: { total: 10001, available: 10001 },
      money: { originalByCurrency: { USD: "-987654321.1234567800", HKD: "-1.00000000000000000001" }, targetCurrency: "CNY", conversion: "complete",
        fx: { id: "literal-fx", source: "独立来源".repeat(60), asOf: "2026-01-31T15:59:59Z", status: "complete" } } };
    render(<HistoryChart data={data([point("01", "1月", exact, { periodNet: metric })])} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const single = screen.getByTestId("hp-history-point-01"); expect(single).toHaveAttribute("r", "3");
    expect(Number.isFinite(Number(single.getAttribute("cy")))).toBe(true);
    expect(screen.getAllByTestId("hp-history-y-tick").some(tick => tick.textContent?.includes("亿"))).toBe(true);
    fireEvent.focus(hit("01")); expect(reading()).toHaveTextContent(exact); expect(reading()).toHaveTextContent("-987654321.1234567800 USD");
    expect(reading()).toHaveTextContent("-1.00000000000000000001 HKD"); expect(reading()).toHaveTextContent("10001 / 10001");
    expect(reading()).toHaveTextContent("literal-fx"); expect(reading()).toHaveTextContent("2026-01-31T15:59:59Z");
  });
});

describe("HistoryChart controlled global states", () => {
  it.each(["pending", "error"] as const)("keeps initial %s space with no fake curve", kind => {
    render(<HistoryChart data={null} mode="period-pnl" reportCurrency="CNY" readState={{ kind, reason: `初始${kind}原因` }} />);
    expect(screen.getByRole("status")).toHaveTextContent(`初始${kind}原因`);
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", kind === "pending" ? "loading" : "error");
    expect(screen.queryByTestId("hp-history-segment")).not.toBeInTheDocument();
    expect(screen.getByTestId("hp-history-card")).toHaveAttribute("data-height", "320");
  });
  it.each(["pending", "error"] as const)("keeps complete old props and range on %s without caching facts", kind => {
    const old = data(); const { rerender } = render(<HistoryChart data={old} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const oldLines = screen.getAllByTestId("hp-history-segment").map(node => node.getAttribute("points"));
    rerender(<HistoryChart data={old} mode="period-pnl" reportCurrency="CNY" readState={{ kind, reason: "2025未应用，仍显示2026完整数据" }} />);
    expect(screen.getAllByTestId("hp-history-segment").map(node => node.getAttribute("points"))).toEqual(oldLines);
    expect(screen.getByRole("status")).toHaveTextContent("2025未应用，仍显示2026完整数据");
    expect(screen.getByTestId("hp-history-card")).toContainElement(screen.getByRole("status"));
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", kind === "pending" ? "updating" : "error");
    expect(screen.getByRole("group", { name: "每月净盈亏，2026" })).toBeInTheDocument();
    rerender(<HistoryChart data={null} mode="period-pnl" reportCurrency="CNY" readState={{ kind, reason: "旧提交已由caller移除" }} />);
    expect(screen.queryByTestId("hp-history-segment")).not.toBeInTheDocument();
  });
  it("keeps a long old-data failure reason complete for assistive reading and native title within the fixed card", () => {
    const reason = "新年份未应用，继续显示原完整范围；".repeat(30);
    render(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "error", reason }} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("title", reason); expect(status).toHaveAccessibleName(reason);
    expect(status).toHaveTextContent(reason); expect(screen.getByTestId("hp-history-card")).toContainElement(status);
    expect(screen.getByTestId("hp-history-plot")).toHaveAttribute("data-bounds", "84,66,1312,276");
  });
  it("honors successful empty range without plotting contradictory supplied values or adding repair entry", () => {
    render(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "范围无已平仓回合" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("范围无已平仓回合");
    expect(screen.queryByTestId("hp-history-segment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hp-history-hit-01")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /重试|修复|详情/ })).not.toBeInTheDocument();
  });
});

describe("HistoryChart reading interaction and invalidation", () => {
  it.each([342, 430, 520, 1168, 1328])("keeps every semantic label, staggering only when adjacent labels cannot fit at card width%s", width => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, 320));
    const committed = data(Array.from({ length: 12 }, (_, index) => point(String(index + 1).padStart(2, "0"), `${index + 1}月`, String(index))));
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const labels = committed.points.map(point => screen.getByText(point.label, { selector: "text" }));
    const rows = labels.map(label => label.getAttribute("y"));
    expect(new Set(rows).size).toBe(width === 342 ? 2 : 1);
    if (width === 342) expect(rows).toEqual(Array.from({ length: 12 }, (_, index) => index % 2 ? "312" : "298"));
    expect(labels).toHaveLength(12);
    const bounds = screen.getByTestId("hp-history-plot").getAttribute("data-bounds");
    for (const mode of ["cumulative-pnl", "win-rate", "round-count"] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.getByTestId("hp-history-plot")).toHaveAttribute("data-bounds", bounds);
      expect(committed.points.map(point => screen.getByText(point.label, { selector: "text" }).getAttribute("y"))).toEqual(rows);
    }
  });
  it("uses measured annual label widths to stagger at the actual spacing boundary and keeps short narrow ranges in one row", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 430, 320));
    const measure = vi.fn(() => 32);
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", { configurable: true, value: measure });
    try {
      const years = data(Array.from({ length: 12 }, (_, index) => point(String(index + 1).padStart(2, "0"), String(2014 + index), "1")));
      const { rerender } = render(<HistoryChart data={{ ...years, grain: "year" }} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(new Set(years.points.map(point => screen.getByText(point.label, { selector: "text" }).getAttribute("y"))).size).toBe(2);
      expect(measure).toHaveBeenCalled();
      const short = data([point("01", "1月", "1"), point("02", "2月", "2"), point("03", "3月", "3")]);
      rerender(<HistoryChart data={short} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(new Set(short.points.map(point => screen.getByText(point.label, { selector: "text" }).getAttribute("y"))).size).toBe(1);
    } finally { Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength"); }
  });

  it.each([30, 40])("thins only crowded visual year ticks across%s years while retaining every point and keyboard reading", async count => {
    let width = 342;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, 0, width, 320));
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", { configurable: true, value: () => 26 });
    try {
      const years = Array.from({ length: count }, (_, index) => String(1980 + index));
      const committed: HistoryChartData = { ...data(years.map((year, index) => point(year, year, `${index}.0001`, {
        start: `${year}-01-01`, end: `${year}-12-31`,
      }))), grain: "year" };
      const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
      const visibleLabels = () => Array.from(screen.getByTestId("hp-history-card").querySelectorAll("svg > text:not([visibility='hidden'])"));
      const labels = visibleLabels(); const chosen = labels.map(label => label.textContent);
      expect(labels.length).toBeLessThan(count); expect(chosen[0]).toBe(years[0]); expect(chosen.at(-1)).toBe(years.at(-1));
      for (const row of new Set(labels.map(label => label.getAttribute("y")))) {
        const sameRow = labels.filter(label => label.getAttribute("y") === row);
        for (let index = 1; index < sameRow.length; index++) {
          expect(Number(sameRow[index].getAttribute("x")) - Number(sameRow[index - 1].getAttribute("x"))).toBeGreaterThanOrEqual(30);
        }
      }
      expect(screen.getAllByRole("button")).toHaveLength(count);
      const bounds = screen.getByTestId("hp-history-plot").getAttribute("data-bounds");
      for (const mode of ["cumulative-pnl", "win-rate", "round-count"] as const) {
        rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
        expect(visibleLabels().map(label => label.textContent)).toEqual(chosen);
        expect(screen.getByTestId("hp-history-plot")).toHaveAttribute("data-bounds", bounds);
      }
      rerender(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
      const omitted = years.findIndex(year => !chosen.includes(year)); expect(omitted).toBeGreaterThan(0);
      const user = userEvent.setup(); await user.tab(); await user.keyboard("{ArrowRight}".repeat(omitted));
      expect(hit(years[omitted])).toHaveFocus(); expect(hit(years[omitted])).toHaveAccessibleName(new RegExp(years[omitted]));
      expect(screen.getByTestId("hp-history-primary-reading")).toHaveTextContent(`${omitted}.0001 CNY`);
      await user.keyboard("{End}"); expect(hit(years.at(-1)!)).toHaveFocus();
      await user.keyboard("{Home}"); expect(hit(years[0])).toHaveFocus();
      width = 1328; act(() => { window.dispatchEvent(new Event("resize")); });
      expect(visibleLabels().map(label => label.textContent)).toEqual(years);
      expect(new Set(visibleLabels().map(label => label.getAttribute("y"))).size).toBe(1);
      expect(screen.getByTestId("hp-history-card")).toHaveAttribute("data-height", "320");
    } finally { Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength"); }
  });

  it.each([759, 760, 761])("keeps annual labels readable around the former760px breakpoint at width%s using measured spacing", width => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, 320));
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", { configurable: true, value: () => 26 });
    try {
      const years = Array.from({ length: 40 }, (_, index) => String(1980 + index));
      const committed: HistoryChartData = { ...data(years.map(year => point(year, year, "1"))), grain: "year" };
      render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
      const labels = Array.from(screen.getByTestId("hp-history-card").querySelectorAll("svg > text:not([visibility='hidden'])"));
      expect(labels).toHaveLength(40); expect(new Set(labels.map(label => label.getAttribute("y"))).size).toBe(2);
      for (const row of ["298", "312"]) {
        const sameRow = labels.filter(label => label.getAttribute("y") === row);
        for (let index = 1; index < sameRow.length; index++) {
          expect(Number(sameRow[index].getAttribute("x")) - Number(sameRow[index - 1].getAttribute("x"))).toBeGreaterThanOrEqual(30);
        }
      }
    } finally { Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength"); }
  });

  it("uses real Tab focus, arrows, Home and End to reach all periods including gaps then allows downstream focus", async () => {
    const user = userEvent.setup(); const committed = data([point("01", "1月", "1"), point("02", "2月", null), point("03", "3月", "3")]);
    render(<><HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} /><button>下方模块</button></>);
    await user.tab(); expect(hit("01")).toHaveFocus(); expect(reading()).toHaveTextContent("1月");
    await user.keyboard("{ArrowRight}"); expect(hit("02")).toHaveFocus(); expect(reading()).toHaveTextContent("该期源文件缺失");
    await user.keyboard("{End}"); expect(hit("03")).toHaveFocus(); await user.keyboard("{Home}"); expect(hit("01")).toHaveFocus();
    await user.keyboard("{ArrowLeft}"); expect(hit("01")).toHaveFocus();
    await user.keyboard("{End}{Escape}"); expect(hit("03")).toHaveFocus(); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.tab(); expect(screen.getByRole("button", { name: "下方模块" })).toHaveFocus(); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it("gives mouse and keyboard identical reading facts and clears on blur or leave", () => {
    render(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    fireEvent.mouseEnter(hit("03")); const mouse = reading().textContent; fireEvent.mouseLeave(hit("03"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(); fireEvent.focus(hit("03")); expect(reading().textContent).toBe(mouse);
    fireEvent.blur(hit("03")); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
  it.each(["data", "source", "generation", "mode", "currency"] as const)("permanently clears reading through %s A→B→A", change => {
    const committed = data(); const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    fireEvent.focus(hit("01")); expect(reading()).toBeInTheDocument();
    const next = change === "source" ? { ...committed, sourceId: "different" } : change === "generation" ? { ...committed, requestGeneration: "next" } : change === "data" ? data() : committed;
    rerender(<HistoryChart data={next} mode={change === "mode" ? "win-rate" : "period-pnl"} reportCurrency={change === "currency" ? "USD" : "CNY"} readState={{ kind: "ready" }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    rerender(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(); expect(screen.queryByTestId("hp-history-crosshair")).not.toBeInTheDocument();
  });
  it.each([3, 12])("contains endpoint focus rectangles and all-mode plot bounds after a390px resize with%s periods", count => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 342, 320));
    const committed = data(Array.from({ length: count }, (_, index) => point(String(index + 1).padStart(2, "0"), `${index + 1}月`, String(index))));
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    const bounds = screen.getByTestId("hp-history-plot").getAttribute("data-bounds");
    for (const key of ["01", String(count).padStart(2, "0")]) { const rect = hit(key).querySelector("rect")!;
      expect(Number(rect.getAttribute("x"))).toBeGreaterThanOrEqual(2);
      expect(Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"))).toBeLessThanOrEqual(340);
    }
    for (const mode of ["cumulative-pnl", "win-rate", "round-count"] as const) {
      rerender(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "ready" }} />);
      expect(screen.getByTestId("hp-history-plot")).toHaveAttribute("data-bounds", bounds);
    }
  });
});

function animationHarness(reduced = false) {
  const cancel = vi.fn(); const animate = vi.fn(() => ({ cancel }));
  let change: (() => void) | undefined;
  const media = { matches: reduced, addEventListener: vi.fn((_event: string, callback: () => void) => { change = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  return { animate, cancel, preference(next: boolean) { media.matches = next; act(() => change?.()); } };
}
describe("HistoryChart replacement motion lifecycle", () => {
  it("fades one atomic surface150ms for a replacement, never morphs units, and cancels obsolete animation", () => {
    const motion = animationHarness(); const committed = data();
    const { rerender, unmount } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(motion.animate).not.toHaveBeenCalled();
    rerender(<HistoryChart data={data([point("01", "1月", "42")])} mode="win-rate" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(motion.animate).toHaveBeenCalledTimes(1);
    expect(motion.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    expect(screen.getByRole("heading", { name: "各期胜率" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(); unmount(); expect(motion.cancel).toHaveBeenCalled();
  });
  it("shows reduced-motion replacement directly and cancels a running fade when preference changes", () => {
    const motion = animationHarness(true); const { rerender } = render(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    rerender(<HistoryChart data={data()} mode="round-count" reportCurrency="CNY" readState={{ kind: "ready" }} />); expect(motion.animate).not.toHaveBeenCalled();
    motion.preference(false); rerender(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(motion.animate).toHaveBeenCalledTimes(1); motion.preference(true); expect(motion.cancel).toHaveBeenCalled();
  });
});

describe("HistoryChart candidate2 successful empty plot and caller metadata", () => {
  it.each(["period-pnl", "cumulative-pnl", "win-rate", "round-count"] as const)("covers the whole successful empty %s plot behind its grid without financial targets", mode => {
    render(<HistoryChart data={data()} mode={mode} reportCurrency="CNY" readState={{ kind: "empty", reason: "所选范围无已平仓回合" }} />);
    const region = screen.getByTestId("hp-history-empty-region");
    expect(region).toHaveAttribute("data-state", "empty");
    expect(region).toHaveAttribute("x", "84"); expect(region).toHaveAttribute("y", "66");
    expect(region).toHaveAttribute("width", "1228"); expect(region).toHaveAttribute("height", "210");
    expect(region).toHaveAttribute("aria-hidden", "true"); expect(region).toHaveAttribute("pointer-events", "none");
    expect(screen.getByTestId("hp-history-plot").firstElementChild).toBe(region);
    expect(screen.getByTestId("hp-history-zero-line")).toBeInTheDocument();
    expect(screen.getAllByTestId("hp-history-y-tick")).toHaveLength(5);
    expect(screen.getByTestId("hp-history-card")).toHaveAttribute("data-height", "320");
    expect(screen.queryByTestId("hp-history-segment")).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^hp-history-point-/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it.each([
    ["period-pnl", ["0", "1", "2", "3", "4"]],
    ["cumulative-pnl", ["0", "1", "2", "3", "4"]],
    ["win-rate", ["0%", "25%", "50%", "75%", "100%"]],
    ["round-count", ["0", "1", "2", "3", "4"]],
  ] as const)("retains twelve caller month labels for empty %s while ignoring contradictory financial axis extents", (mode, ticks) => {
    const committed = data(Array.from({ length: 12 }, (_, index) => point(String(index + 1).padStart(2, "0"), `${index + 1}月`, "-999999999999999999999999999999", {
      cumulativeNet: money("888888888888888888888888888888"), roundCount: scalar("777777777777777777777777777777"), winRate: scalar("99.999999"),
    })));
    render(<HistoryChart data={committed} mode={mode} reportCurrency="CNY" readState={{ kind: "empty", reason: "范围读取成功，无回合" }} />);
    const labels = Array.from(screen.getByTestId("hp-history-card").querySelectorAll("svg > text"));
    expect(labels.map(label => label.textContent)).toEqual(["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]);
    expect(labels[0]).toHaveAttribute("x", "84"); expect(labels[11]).toHaveAttribute("x", "1312");
    expect(screen.getAllByTestId("hp-history-y-tick").map(tick => tick.textContent)).toEqual(ticks);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("hp-history-card")).not.toHaveTextContent("999999999999");
    expect(screen.getByTestId("hp-history-card")).not.toHaveTextContent("888888888888");
  });

  it("keeps only explicitly supplied irregular annual metadata and describes it without creating hits", () => {
    const committed: HistoryChartData = { ...data([
      point("2021", "2021", "900", { start: "2021-01-01", end: "2021-12-31" }),
      point("2024", "2024", "-800", { start: "2024-01-01", end: "2024-12-31" }),
      point("2027", "2027", "700", { start: "2027-01-01", end: "2027-12-31" }),
    ]), grain: "year", range: { label: "2021—2027", start: "2021-01-01", end: "2027-12-31", timeZone: "Asia/Shanghai" } };
    render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "明确年度空范围" }} />);
    const labels = Array.from(screen.getByTestId("hp-history-card").querySelectorAll("svg > text"));
    expect(labels.map(label => label.textContent)).toEqual(["2021", "2024", "2027"]);
    expect(labels.map(label => label.getAttribute("x"))).toEqual(["84", "698", "1312"]);
    expect(screen.getByRole("group", { name: "每年净盈亏，2021—2027" })).toHaveAccessibleDescription("期间：2021、2024、2027");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not infer period metadata when a successful empty caller provides no data", () => {
    const { rerender } = render(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "有明确月份" }} />);
    rerender(<HistoryChart data={null} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "未提交期间元数据" }} />);
    expect(screen.getByTestId("hp-history-empty-region")).toBeInTheDocument();
    expect(screen.getByTestId("hp-history-card").querySelectorAll("svg > text")).toHaveLength(0);
    expect(screen.getByRole("group", { name: "每月净盈亏，尚无已提交范围" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("status")).toHaveTextContent("未提交期间元数据");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([342, 1168, 1328])("lays out explicit empty month metadata at card width%s without inventing targets", width => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, 320));
    const committed = data(Array.from({ length: 12 }, (_, index) => point(String(index + 1).padStart(2, "0"), `${index + 1}月`, "100")));
    render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "月份空范围" }} />);
    const labels = Array.from(screen.getByTestId("hp-history-card").querySelectorAll("svg > text"));
    expect(labels).toHaveLength(12);
    expect(new Set(labels.map(label => label.getAttribute("y"))).size).toBe(width === 342 ? 2 : 1);
    expect(screen.getByTestId("hp-history-empty-region")).toHaveAttribute("width", String(width - 100));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([342, 759, 760, 761, 1328])("uses measured empty annual labels at width%s, retaining all metadata without financial hits", width => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, width, 320));
    Object.defineProperty(SVGElement.prototype, "getComputedTextLength", { configurable: true, value: () => 32 });
    try {
      const years = Array.from({ length: 40 }, (_, index) => String(1980 + index));
      const committed: HistoryChartData = { ...data(years.map(year => point(year, year, "999999999", { start: `${year}-01-01`, end: `${year}-12-31` }))), grain: "year",
        range: { label: "1980—2019", start: "1980-01-01", end: "2019-12-31", timeZone: "Asia/Shanghai" } };
      render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "40年空范围" }} />);
      const all = Array.from(screen.getByTestId("hp-history-card").querySelectorAll("svg > text"));
      const visible = all.filter(label => label.getAttribute("visibility") !== "hidden");
      expect(all).toHaveLength(40); expect(visible[0]).toHaveTextContent("1980"); expect(visible.at(-1)).toHaveTextContent("2019");
      expect(new Set(visible.map(label => label.getAttribute("y"))).size).toBe(2);
      if (width === 1328) expect(visible).toHaveLength(40);
      for (const row of ["298", "312"]) {
        const sameRow = visible.filter(label => label.getAttribute("y") === row);
        for (let index = 1; index < sameRow.length; index++) {
          expect(Number(sameRow[index].getAttribute("x")) - Number(sameRow[index - 1].getAttribute("x"))).toBeGreaterThanOrEqual(36);
        }
      }
      expect(screen.getByRole("group", { name: "每年净盈亏，1980—2019" })).toHaveAccessibleDescription(/期间：1980、1981、1982/);
      expect(screen.getByRole("group", { name: "每年净盈亏，1980—2019" })).toHaveAccessibleDescription(/2018、2019$/);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    } finally { Reflect.deleteProperty(SVGElement.prototype, "getComputedTextLength"); }
  });

  it.each(["ready", "pending", "error"] as const)("does not overlay an empty region on %s caller data", kind => {
    render(<HistoryChart data={data()} mode="period-pnl" reportCurrency="CNY" readState={kind === "ready" ? { kind } : { kind, reason: "保留旧完整数据" }} />);
    expect(screen.queryByTestId("hp-history-empty-region")).not.toBeInTheDocument();
    expect(screen.getByTestId("hp-history-point-01")).toBeInTheDocument();
    expect(screen.getByTestId("hp-history-region-02")).toHaveAttribute("data-state", "no-rounds");
  });

  it("clears the prior reading through ready→empty→ready with identical caller identity", () => {
    const committed = data();
    const { rerender } = render(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    fireEvent.focus(hit("01")); expect(reading()).toBeInTheDocument();
    rerender(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "empty", reason: "范围成功为空" }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(); expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<HistoryChart data={committed} mode="period-pnl" reportCurrency="CNY" readState={{ kind: "ready" }} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(); expect(screen.queryByTestId("hp-history-crosshair")).not.toBeInTheDocument();
    expect(hit("01")).toBeInTheDocument();
  });
});
