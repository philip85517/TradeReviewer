import { cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  data: [] as { time: number }[],
  range: { from: 0, to: 0 },
  fitCalls: 0,
  options: null as Record<string, unknown> | null,
  resizeCallbacks: [] as ResizeObserverCallback[],
  drawingCommit: vi.fn(),
  screenshotArgs: null as [boolean, boolean] | null,
  screenshotData: [] as { time: number }[][],
  overlayIds: [] as string[],
}));

vi.mock("./drawing-canvas", async () => {
  const React = await import("react");
  const DrawingCanvas = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      captureOverlay: async () => {
        engine.overlayIds = ((props as { drawings?: Array<{ id: string }> }).drawings ?? []).map(
          (drawing) => drawing.id,
        );
        return { width: 800, height: 480 };
      },
      commitText: engine.drawingCommit,
    }));
    return null;
  });
  DrawingCanvas.displayName = "DrawingCanvas";
  return { DrawingCanvas };
});

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: "candle",
  HistogramSeries: "volume",
  ColorType: { Solid: "solid" },
  CrosshairMode: { MagnetOHLC: 1 },
  LineStyle: { Dashed: 1 },
  createSeriesMarkers: () => ({ setMarkers: () => {} }),
  createChart: (_container: Element, options: Record<string, unknown>) => {
    engine.options = options;
    const scale = {
      subscribeVisibleLogicalRangeChange: () => {},
      fitContent: () => {
        engine.fitCalls += 1;
      },
      setVisibleLogicalRange: (range: { from: number; to: number }) => {
        engine.range = { ...range };
      },
      getVisibleLogicalRange: () => ({ ...engine.range }),
      options: () => ({ barSpacing: 8, rightOffset: 4 }),
      applyOptions: () => {},
      timeToCoordinate: () => null,
      logicalToCoordinate: (logical: number) => logical * 10,
      coordinateToTime: () => null,
      coordinateToLogical: () => 0,
    };
    return {
      applyOptions: () => {},
      remove: () => {},
      subscribeCrosshairMove: () => {},
      timeScale: () => scale,
      addSeries: (kind: string) => ({
        setData: (data: { time: number }[]) => {
          if (kind === "candle") engine.data = data;
        },
        applyOptions: () => {},
        priceScale: () => ({ applyOptions: () => {} }),
        createPriceLine: () => ({ applyOptions: () => {} }),
        coordinateToPrice: () => 100,
        priceToCoordinate: () => 100,
      }),
      takeScreenshot: (includeTopLayer: boolean, includeCrosshair: boolean) => {
        engine.screenshotArgs = [includeTopLayer, includeCrosshair];
        engine.screenshotData.push(engine.data.map((item) => ({ ...item })));
        return { width: 400, height: 200 };
      },
    };
  },
}));

import { ReplayChart } from "./replay-chart";

const candle = (time: string) => ({
  time,
  open: 1,
  high: 2,
  low: 1,
  close: 2,
  volume: 10,
});

function props(overrides: Partial<ComponentProps<typeof ReplayChart>> = {}) {
  return {
    candles: [candle("2026-01-01T00:00:00Z"), candle("2026-01-02T00:00:00Z")],
    executions: [],
    cursor: "2026-09-05T00:00:00Z",
    averageCost: 0,
    drawings: [],
    activeTool: "cursor" as const,
    settings: {
      version: 1,
      showGrid: true,
      showVolume: true,
      showExecutions: true,
      showAverageCost: true,
      colorScheme: "teal-red" as const,
    },
    episodeId: "episode-1",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    ...overrides,
  } satisfies ComponentProps<typeof ReplayChart>;
}

function stubResize(width = 640, height = 240) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        engine.resizeCallbacks.push(callback);
      }

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width, height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
    },
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  engine.data = [];
  engine.range = { from: 0, to: 0 };
  engine.fitCalls = 0;
  engine.options = null;
  engine.resizeCallbacks = [];
  engine.drawingCommit.mockClear();
  engine.screenshotArgs = null;
  engine.screenshotData = [];
  engine.overlayIds = [];
});

it("formats daily tick marks compactly while retaining Asia/Shanghai date conversion", async () => {
  stubResize();
  render(<ReplayChart {...props({ viewportKey: "[\"instrument\",\"episode\",\"1D\",\"replay\"]" })} />);

  await waitFor(() => expect(engine.options).not.toBeNull());
  const timeScale = engine.options?.timeScale as {
    tickMarkFormatter: (time: number, tickMarkType?: number) => string;
  };
  const timestamp = Date.parse("2025-09-30T16:00:00.000Z") / 1000;
  const day = timeScale.tickMarkFormatter(timestamp, 2);
  const month = timeScale.tickMarkFormatter(timestamp, 1);
  const year = timeScale.tickMarkFormatter(timestamp, 0);
  const intraday = timeScale.tickMarkFormatter(timestamp, 3);

  expect(day).toBe("10/01");
  expect(Array.from(day).length).toBeLessThanOrEqual(5);
  expect(month).toBe("10月");
  expect(year).toBe("2025年");
  expect(intraday).toBe("00:00");
});

it("preserves the logical view when the replay/history mode changes", async () => {
  stubResize();
  const firstKey = JSON.stringify(["instrument", "episode", "1D", "replay"]);
  const { rerender } = render(<ReplayChart {...props({ viewportKey: firstKey })} />);

  await waitFor(() => expect(engine.fitCalls).toBeGreaterThan(0));
  engine.range = { from: 0.25, to: 1.25 };
  const historyKey = JSON.stringify(["instrument", "episode", "1D", "history"]);
  rerender(<ReplayChart {...props({ viewportKey: historyKey, candles: [
    candle("2026-01-01T00:00:00Z"),
    candle("2026-01-02T00:00:00Z"),
    candle("2026-01-03T00:00:00Z"),
  ] })} />);

  await waitFor(() => expect(engine.data).toHaveLength(3));
  expect(engine.range).toEqual({ from: 0.25, to: 1.25 });
  expect(engine.fitCalls).toBe(1);
});

it("fits once after a zero-sized mount becomes usable", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element) {
        this.callback([{ target, contentRect: { width: 0, height: 0 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        this.callback([{ target, contentRect: { width: 640, height: 240 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }

      disconnect() {}
    },
  );
  render(<ReplayChart {...props()} />);

  await waitFor(() => expect(engine.fitCalls).toBe(1));
});

it("captures the real chart plus a 2x drawing overlay after committing focused Text", async () => {
  stubResize(400, 200);
  const drawImage = vi.fn();
  const toDataURL = vi.fn(() => "data:image/png;base64,review");
  const context = { drawImage, toDataURL } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
  const onReady = vi.fn();
  const { container } = render(
    <ReplayChart
      {...props({
        onReady,
        drawings: [],
      })}
    />,
  );
  const stage = container.querySelector(".chart-stage");
  expect(stage).not.toBeNull();
  vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    top: 0,
    left: 0,
    right: 400,
    bottom: 200,
    toJSON: () => ({}),
  });

  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ capture: expect.any(Function) })));
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.capture === "function")?.[0] as { capture: () => Promise<{ imageDataUrl: string; viewport: unknown }> };
  const capture = await handle.capture();

  expect(engine.drawingCommit).toHaveBeenCalledTimes(1);
  expect(engine.screenshotArgs).toEqual([true, false]);
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(toDataURL).toHaveBeenCalledWith("image/png");
  expect(capture.imageDataUrl).toBe("data:image/png;base64,review");
});

it("captures current data and overlays even when requestAnimationFrame never runs", async () => {
  stubResize(400, 200);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    toDataURL: vi.fn(() => "data:image/png;base64:stalled-rAF"),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64:stalled-rAF",
  );
  const onReady = vi.fn();
  const latestCandles = [
    candle("2026-01-03T00:00:00Z"),
    candle("2026-01-04T00:00:00Z"),
    candle("2026-01-05T00:00:00Z"),
  ];
  const latestDrawing = {
    id: "latest-overlay",
    version: 2 as const,
    episodeId: "episode-1",
    name: "latest-overlay",
    tool: "text" as const,
    anchors: [{ time: latestCandles[1].time, price: 2 }],
    style: { color: "#fff", lineWidth: 1, opacity: 1 },
    text: "latest",
    hidden: false,
    locked: false,
    visibleOn: "all" as const,
    stage: "during-replay" as const,
    zIndex: 0,
    createdAtCursor: latestCandles[1].time,
  };
  const { container, rerender } = render(
    <ReplayChart {...props({ onReady })} />,
  );
  const stage = container.querySelector(".chart-stage");
  expect(stage).not.toBeNull();
  vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    top: 0,
    left: 0,
    right: 400,
    bottom: 200,
    toJSON: () => ({}),
  });

  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ capture: expect.any(Function) })));
  rerender(
    <ReplayChart
      {...props({
        onReady,
        candles: latestCandles,
        drawings: [latestDrawing],
      })}
    />,
  );
  await waitFor(() => expect(engine.data).toHaveLength(latestCandles.length));
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.capture === "function")?.[0] as {
    capture: () => Promise<{ imageDataUrl: string }>;
  };
  const capture = handle.capture();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("capture timed out while rAF was stalled")), 50);
  });

  await expect(Promise.race([capture, timeout])).resolves.toEqual(
    expect.objectContaining({ imageDataUrl: "data:image/png;base64:stalled-rAF" }),
  );
  expect(engine.screenshotData.at(-1)).toEqual(
    latestCandles.map((item) => ({
      time: Math.floor(Date.parse(item.time) / 1000),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    })),
  );
  expect(engine.overlayIds).toEqual(["latest-overlay"]);
});
