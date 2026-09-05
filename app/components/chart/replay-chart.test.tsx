import { render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReplayChart } from "./replay-chart";
import type { ComponentProps } from "react";

const engine = vi.hoisted(() => ({ data: [] as { time: number }[], visible: [] as number[], range: { from: 0, to: 0 } }));
vi.mock("./drawing-canvas", () => ({ DrawingCanvas: () => null }));
vi.mock("lightweight-charts", () => ({
  CandlestickSeries: "candle", HistogramSeries: "volume", ColorType: { Solid: "solid" }, CrosshairMode: { MagnetOHLC: 1 }, LineStyle: { Dashed: 1 },
  createSeriesMarkers: () => ({ setMarkers: () => {} }),
  createChart: () => ({
    applyOptions: () => {}, remove: () => {}, subscribeCrosshairMove: () => {},
    timeScale: () => ({ subscribeVisibleLogicalRangeChange: () => {}, fitContent: () => { engine.visible = engine.data.map(bar => bar.time); }, setVisibleLogicalRange: (range: { from: number; to: number }) => { engine.range = range; } }),
    addSeries: (kind: string) => ({
      setData: (data: { time: number }[]) => { if (kind === "candle") engine.data = data; },
      applyOptions: () => {}, priceScale: () => ({ applyOptions: () => {} }), createPriceLine: () => ({ applyOptions: () => {} }),
    }),
  }),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
