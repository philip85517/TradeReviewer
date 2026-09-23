import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradingRoomTrendPoint } from "../../lib/reviews/trading-room-calendar";
import { RoomTradingViewChart } from "./room-tradingview-chart";

const engine = vi.hoisted(() => ({
  chart: null as null | { remove: ReturnType<typeof vi.fn> },
  series: [] as Array<{ options: unknown; data: unknown[] }>,
  crosshair: undefined as undefined | ((param: { time: string | { year: number; month: number; day: number }; seriesData?: Map<unknown, unknown> }) => void),
}));

vi.mock("lightweight-charts", () => ({
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Solid: 0 },
  LineSeries: "line",
  createChart: () => {
    const chart = {
      remove: vi.fn(),
      applyOptions: vi.fn(),
      subscribeCrosshairMove: (callback: (param: { time: string | { year: number; month: number; day: number }; seriesData?: Map<unknown, unknown> }) => void) => { engine.crosshair = callback; },
      subscribeClick: (callback: (param: { time: string | { year: number; month: number; day: number }; seriesData?: Map<unknown, unknown> }) => void) => { engine.crosshair = callback; },
      timeScale: () => ({ width: () => 600, timeToCoordinate: () => 100, fitContent: vi.fn(), subscribeVisibleLogicalRangeChange: vi.fn() }),
      addSeries: (_kind: unknown, options: unknown) => {
        const series = { options, data: [] as unknown[], priceToCoordinate: () => 100, setData: (data: unknown[]) => { series.data = data; } };
        engine.series.push(series);
        return series;
      },
    };
    engine.chart = chart;
    return chart;
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  engine.chart = null;
  engine.series = [];
  engine.crosshair = undefined;
});

function point(key: string, value: string | null, rawByCurrency: Record<string, string> = { CNY: value ?? "0" }): TradingRoomTrendPoint {
  return {
    key, label: key, startDate: key, endDate: key,
    periodMoney: { baseCurrency: "CNY", conversion: "same-currency", fxSnapshotId: null, convertedCny: value, originalByCurrency: rawByCurrency, note: "" },
    periodValue: value, money: { baseCurrency: "CNY", conversion: "same-currency", fxSnapshotId: null, convertedCny: value, originalByCurrency: rawByCurrency, note: "" }, value,
    rawByCurrency, trustedClosedCount: value === null ? 0 : 1, wins: 1, losses: 0, breakEven: 0,
    availability: value === null ? "empty" : "available",
  };
}

describe("RoomTradingViewChart", () => {
  it("loads lightweight charts, uses complete dates and whitespace for unavailable points", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    render(<RoomTradingViewChart points={[point("2026-09-01", "10"), point("2026-09-02", null), point("2026-09-03", "30")]} currencies={["CNY"]} aggregate />);
    await waitFor(() => expect(engine.series[0]?.data).toHaveLength(3));
    expect(engine.series[0].data).toEqual([
      { time: "2026-09-01", value: 10 },
      { time: "2026-09-02" },
      { time: "2026-09-03", value: 30 },
    ]);
    expect(screen.getByRole("checkbox", { name: "显示全部金额" })).toBeInTheDocument();
  });

  it("shows every currency at a crosshair date and disposes the chart", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const { unmount } = render(<RoomTradingViewChart points={[point("2026-09-01", "10", { CNY: "10", USD: "2" })]} currencies={["CNY", "USD"]} aggregate={false} />);
    await waitFor(() => expect(engine.series).toHaveLength(2));
    act(() => engine.crosshair?.({ time: "2026-09-01", seriesData: new Map(engine.series.map((series, index) => [series, { value: index ? 2 : 10 }])) }));
    expect(await screen.findByRole("status", { name: "趋势点详情" })).toHaveTextContent("USD");
    unmount();
    expect(engine.chart?.remove).toHaveBeenCalledTimes(1);
  });

  it("keeps negative period and positive cumulative tones separate and toggles overlay", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const value = point("2026-09-01", "20");
    value.periodMoney = { ...value.periodMoney, convertedCny: "-10" };
    render(<RoomTradingViewChart points={[value]} currencies={["CNY"]} aggregate />);
    await waitFor(() => expect(engine.series[0]?.data).toHaveLength(1));
    const status = screen.getByRole("status", { name: "趋势点详情" });
    expect(status).toHaveTextContent("本期 -¥10.00");
    expect(status).toHaveTextContent("累计 +¥20.00");
    expect(screen.getByText("本期 -¥10.00").className).toContain("negative");
    expect(screen.getByText("累计 +¥20.00").className).toContain("positive");
    fireEvent.click(screen.getByRole("checkbox", { name: "显示全部金额" }));
    expect(screen.getByLabelText("全部金额标注")).toBeInTheDocument();
  });

  it("keeps an unconverted single USD series labeled USD", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    render(<RoomTradingViewChart points={[point("2026-09-01", "12", { USD: "12" })]} currencies={["USD"]} aggregate={false} />);
    await waitFor(() => expect(engine.series[0]?.data).toHaveLength(1));
    expect(screen.getByLabelText("趋势币种图例")).toHaveTextContent("USD");
    expect(screen.getByLabelText("趋势币种图例")).not.toHaveTextContent("CNY");
  });
});


describe("chart updates", () => {
  it("replaces currency and granularity data without stale crosshair selection", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const initial = [point("2026-01-31", "10", { USD: "2" }), point("2026-02-28", "20", { USD: "3" })];
    const { rerender } = render(<RoomTradingViewChart points={initial} currencies={["USD"]} aggregate={false} />);
    await waitFor(() => expect(engine.series).toHaveLength(1));
    act(() => engine.crosshair?.({ time: { year: 2026, month: 1, day: 31 } }));
    expect(screen.getByRole("status")).toHaveTextContent("累计 +US$2.00");
    const oldChart = engine.chart;
    const next = [point("2026-03-01", "50"), point("2026-03-02", "60")];
    rerender(<RoomTradingViewChart points={next} currencies={["USD"]} aggregate level="day" />);
    await waitFor(() => expect(engine.series.at(-1)?.data).toEqual([{ time: "2026-03-01", value: 50 }, { time: "2026-03-02", value: 60 }]));
    expect(oldChart?.remove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("累计 +¥60.00");
    act(() => engine.crosshair?.({ time: "2026-03-01" }));
    expect(screen.getByRole("status")).toHaveTextContent("累计 +¥50.00");
  });
});
