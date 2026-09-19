import { render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildReplayChartMarkers, chartTickLabel, ReplayChart } from "./replay-chart";
import type { ComponentProps } from "react";

const engine = vi.hoisted(() => ({ data: [] as { time: number }[], visible: [] as number[], range: { from: 0, to: 0 }, rangeCalls: [] as Array<{ from: number; to: number }>, setDataCalls: 0, markers: [] as unknown[] }));
vi.mock("./drawing-canvas", () => ({ DrawingCanvas: () => null }));
vi.mock("lightweight-charts", () => ({
  TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
  CandlestickSeries: "candle", HistogramSeries: "volume", ColorType: { Solid: "solid" }, CrosshairMode: { MagnetOHLC: 1 }, LineStyle: { Dashed: 1 },
  createSeriesMarkers: () => ({ setMarkers: (markers: unknown[]) => { engine.markers = markers; } }),
  createChart: () => ({
    applyOptions: () => {}, remove: () => {}, subscribeCrosshairMove: () => {},
    timeScale: () => ({ subscribeVisibleLogicalRangeChange: () => {}, fitContent: () => { engine.visible = engine.data.map(bar => bar.time); }, getVisibleLogicalRange: () => engine.range, getVisibleRange: () => { const from = engine.data[Math.max(0, Math.round(engine.range.from))]?.time; const to = engine.data[Math.min(engine.data.length - 1, Math.round(engine.range.to))]?.time; return from === undefined || to === undefined ? null : { from, to }; }, setVisibleLogicalRange: (range: { from: number; to: number }) => { engine.range = range; engine.rangeCalls.push(range); } }),
    addSeries: (kind: string) => ({
      setData: (data: { time: number }[]) => { if (kind === "candle") { engine.data = data; engine.setDataCalls += 1; } },
      applyOptions: () => {}, priceScale: () => ({ applyOptions: () => {} }), createPriceLine: () => ({ applyOptions: () => {} }),
    }),
  }),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); engine.data = []; engine.visible = []; engine.range = { from: 0, to: 0 }; engine.rangeCalls = []; engine.setDataCalls = 0; engine.markers = []; });

it("keeps axis ticks short while preserving Beijing dates across midnight", () => {
  const time = "2025-12-31T20:30:45Z";
  expect(chartTickLabel(time, "year")).toBe("2026");
  expect(chartTickLabel(time, "date")).toBe("01-01");
  expect(chartTickLabel(time, "time")).toBe("04:30");
  expect(chartTickLabel(time, "seconds")).toBe("04:30:45");
  expect(chartTickLabel({ year: 2026, month: 9, day: 12 }, "date")).toBe("09-12");
});

it("only builds finite markers that point at valid chart candles", () => {
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const execution = {
    id: "fill-1",
    source: { platform: "futu", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account",
    accountLabel: "富途",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const,
    executedAt: "2025-01-02T14:30:00.000Z",
    quantity: "1",
    price: "1",
    fee: "0",
  };

  expect(buildReplayChartMarkers(
    [candle("2025-01-02T00:00:00.000Z"), candle("not-a-date")],
    [execution],
  )).toEqual([
    expect.objectContaining({ time: 1735776000 }),
  ]);
});

it("renders one B/S marker per candle-direction group with a fill count", () => {
  const candle = { time: "2025-01-02T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 };
  const execution = (id: string, side: "buy" | "sell") => ({
    id,
    source: { platform: "futu", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side,
    executedAt: "2025-01-02T10:05:00.000Z",
    quantity: "1",
    price: "1",
    fee: "0",
  });
  const markers = buildReplayChartMarkers(
    [candle],
    [execution("buy-1", "buy"), execution("buy-2", "buy"), execution("sell", "sell")],
  );
  expect(markers).toEqual([
    expect.objectContaining({ text: "B ×2", fillCount: 2, executionIds: ["buy-1", "buy-2"] }),
    expect.objectContaining({ text: "S", fillCount: 1, executionIds: ["sell"] }),
  ]);
});

it("refits the rendered range after changing stock/period, but keeps zoom on ordinary rerenders", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const props: ComponentProps<typeof ReplayChart> & { viewportKey: string } = {
    candles: [candle("2026-01-01T00:00:00Z")], executions: [], cursor: "2026-09-05T00:00:00Z", averageCost: 0,
    drawings: [], activeTool: "cursor", episodeId: "episode", selectedDrawingId: null, plannedRiskAmount: undefined, currency: "USD",
    onSelectDrawing: () => {}, onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" }, viewportKey: "first-stock:1D",
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.visible).toEqual([1767225600]));
  const next = { ...props, viewportKey: "second-stock:1h", candles: [candle("2026-03-01T00:00:00Z"), candle("2026-03-02T00:00:00Z")] };
  rerender(<ReplayChart {...next} />);
  await waitFor(() => expect(engine.visible).toEqual([1772323200, 1772409600]));
  expect(engine.range.from).toBeLessThan(0);
  expect(engine.range.to).toBeGreaterThan(1);
  engine.visible = [1772409600]; // User zooms into the last bar.
  rerender(<ReplayChart {...next} averageCost={1} />);
  expect(engine.visible).toEqual([1772409600]);
});

it("preserves the visible dates when a refresh prepends history", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const props: ComponentProps<typeof ReplayChart> = {
    candles: [
      candle("2026-01-02T00:00:00Z"),
      candle("2026-01-03T00:00:00Z"),
      candle("2026-01-04T00:00:00Z"),
    ],
    executions: [],
    cursor: "2026-01-05T00:00:00Z",
    averageCost: 0,
    drawings: [],
    activeTool: "cursor",
    episodeId: "episode",
    viewportKey: "same-view",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(3));
  engine.range = { from: 1, to: 2 };
  const setDataCalls = engine.setDataCalls;
  rerender(<ReplayChart {...props} candles={[candle("2026-01-01T00:00:00Z"), ...props.candles]} />);
  await waitFor(() => expect(engine.range).toEqual({ from: 2, to: 3 }));
  expect(engine.setDataCalls).toBe(setDataCalls + 1);

  engine.range = { from: 2, to: 3 };
  rerender(<ReplayChart {...props} candles={[candle("2026-01-01T00:00:00Z"), ...props.candles, candle("2026-01-05T00:00:00Z")]} />);
  await waitFor(() => expect(engine.range).toEqual({ from: 2, to: 3 }));
  expect(engine.setDataCalls).toBe(setDataCalls + 2);
});

it("preserves logical padding and fractional offsets when history is prepended", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const initialCandles = [
    candle("2026-01-02T00:00:00Z"),
    candle("2026-01-03T00:00:00Z"),
    candle("2026-01-04T00:00:00Z"),
  ];
  const props: ComponentProps<typeof ReplayChart> = {
    candles: initialCandles,
    executions: [],
    cursor: "2026-01-05T00:00:00Z",
    averageCost: 0,
    drawings: [],
    activeTool: "cursor",
    episodeId: "episode",
    viewportKey: "same-view",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(3));
  engine.range = { from: -2.25, to: 4.5 };
  const oldSpan = engine.range.to - engine.range.from;
  rerender(<ReplayChart {...props} candles={[candle("2026-01-01T00:00:00Z"), ...initialCandles]} />);
  await waitFor(() => expect(engine.range).toEqual({ from: -1.25, to: 5.5 }));
  expect(engine.range.to - engine.range.from).toBe(oldSpan);
});

it("retries an unresolved location after daily data arrives, then keeps it one-shot", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string, tradingDates?: string[]) => ({ time, ...(tradingDates ? { tradingDates } : {}), open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const execution = {
    id: "date-only-fill",
    source: { platform: "fixture", row: 1, timePrecision: "date-only" as const, tradingDate: "2025-01-02" },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const,
    executedAt: "2025-01-02",
    quantity: "1",
    price: "1",
    fee: "0",
  };
  const request = { requestId: "locate-1", instrumentId: "US:TEST", episodeId: "episode", executionId: execution.id };
  const onLocateResult = vi.fn();
  const onLocateTimeframeChange = vi.fn();
  const baseProps: ComponentProps<typeof ReplayChart> = {
    candles: [candle("2025-01-02T14:30:00Z"), candle("2025-01-02T15:30:00Z")],
    executions: [execution],
    cursor: "2025-01-02T16:00:00Z",
    averageCost: 0,
    drawings: [],
    activeTool: "cursor",
    episodeId: "episode",
    timeframe: "1h",
    viewportKey: "US:TEST:episode:1h",
    locateRequest: request,
    onLocateResult,
    onLocateTimeframeChange,
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
  const { rerender } = render(<ReplayChart {...baseProps} />);
  await waitFor(() => expect(onLocateResult).toHaveBeenCalledWith(expect.objectContaining({ requestId: request.requestId, status: "needs-daily", timeframe: "1h" })));
  expect(onLocateTimeframeChange).toHaveBeenCalledTimes(1);

  const dailyTime = "2025-01-02T00:00:00.000Z";
  rerender(<ReplayChart {...baseProps} timeframe="1D" viewportKey="US:TEST:episode:1D" candles={[candle(dailyTime, ["2025-01-02"])]} />);
  await waitFor(() => expect(onLocateResult).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: request.requestId, status: "located", timeframe: "1D", candleTime: dailyTime })));
  expect(onLocateResult).toHaveBeenCalledTimes(2);

  engine.range = { from: 0, to: 0 };
  rerender(<ReplayChart {...baseProps} timeframe="1D" viewportKey="US:TEST:episode:1D" candles={[candle(dailyTime, ["2025-01-02"])]} averageCost={1} />);
  expect(engine.range).toEqual({ from: 0, to: 0 });
  expect(onLocateResult).toHaveBeenCalledTimes(2);
});

it("does not reload or move the chart for equal candle values in new arrays", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const props: ComponentProps<typeof ReplayChart> = {
    candles: [candle("2026-01-01T00:00:00Z"), candle("2026-01-02T00:00:00Z"), candle("2026-01-03T00:00:00Z")],
    executions: [],
    cursor: "2026-01-04T00:00:00Z",
    averageCost: 0,
    drawings: [],
    activeTool: "cursor",
    episodeId: "episode",
    viewportKey: "same-view",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(3));
  engine.range = { from: 1, to: 2 };
  const setDataCalls = engine.setDataCalls;
  rerender(<ReplayChart {...props} candles={props.candles.map(candle => ({ ...candle }))} executions={props.executions.map(execution => ({ ...execution }))} />);
  expect(engine.setDataCalls).toBe(setDataCalls);
  expect(engine.range).toEqual({ from: 1, to: 2 });
});
