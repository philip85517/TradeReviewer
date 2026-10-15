import { render, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildReplayChartMarkers, chartTickLabel, createExecutionMarkerPrimitive, ReplayChart } from "./replay-chart";
import type { ComponentProps } from "react";
import type { Time } from "lightweight-charts";

const engine = vi.hoisted(() => ({ priceRange:{from:0,to:0}, data: [] as { time: number }[], visible: [] as number[], range: { from: 0, to: 0 }, rangeCalls: [] as Array<{ from: number; to: number }>, setDataCalls: 0, planLines: [] as {price:number; title:string}[], removedLines: 0, markers: [] as unknown[], clickHandler: null as ((param: { hoveredInfo?: { objectId?: unknown } }) => void) | null, drawingCanvasProps: null as Record<string, unknown> | null }));
vi.mock("./drawing-canvas", () => ({ DrawingCanvas: (props: Record<string, unknown>) => { engine.drawingCanvasProps = props; return null; } }));
vi.mock("lightweight-charts", () => ({
  TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
  CandlestickSeries: "candle", HistogramSeries: "volume", ColorType: { Solid: "solid" }, CrosshairMode: { MagnetOHLC: 1 }, LineStyle: { Dashed: 1 },
  createSeriesMarkers: () => ({ setMarkers: (markers: unknown[]) => { engine.markers = markers; } }),
  createChart: () => ({
    applyOptions: () => {}, remove: () => {}, subscribeCrosshairMove: () => {}, subscribeClick: (handler: (param: { hoveredInfo?: { objectId?: unknown } }) => void) => { engine.clickHandler = handler; }, unsubscribeClick: () => { engine.clickHandler = null; },
    timeScale: () => ({ subscribeVisibleLogicalRangeChange: () => {}, fitContent: () => { engine.visible = engine.data.map(bar => bar.time); }, getVisibleLogicalRange: () => engine.range, getVisibleRange: () => { const from = engine.data[Math.max(0, Math.round(engine.range.from))]?.time; const to = engine.data[Math.min(engine.data.length - 1, Math.round(engine.range.to))]?.time; return from === undefined || to === undefined ? null : { from, to }; }, setVisibleLogicalRange: (range: { from: number; to: number }) => { engine.range = range; engine.rangeCalls.push(range); } }),
    addSeries: (kind: string) => ({
      setData: (data: { time: number }[]) => { if (kind === "candle") { engine.data = data; engine.setDataCalls += 1; } },
      applyOptions: () => {}, priceToCoordinate: (p:number)=>p, coordinateToPrice:(p:number)=>p, priceScale: () => ({ applyOptions: () => {}, setVisibleRange:(r:{from:number;to:number})=>{engine.priceRange=r;} }), createPriceLine: (line: {price:number; title:string}) => { engine.planLines.push(line); return { applyOptions: () => {} }; }, removePriceLine: () => { engine.removedLines++; },
    }),
  }),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); engine.data = []; engine.visible = []; engine.range = { from: 0, to: 0 }; engine.rangeCalls = []; engine.setDataCalls = 0; engine.markers = []; engine.clickHandler = null; engine.drawingCanvasProps = null; });

it("keeps axis ticks short while preserving Beijing dates across midnight", () => {
  const time = "2025-12-31T20:30:45Z";
  expect(chartTickLabel(time, "year")).toBe("2026");
  expect(chartTickLabel(time, "date")).toBe("01-01");
  expect(chartTickLabel(time, "time")).toBe("04:30");
  expect(chartTickLabel(time, "seconds")).toBe("04:30:45");
  expect(chartTickLabel({ year: 2026, month: 9, day: 12 }, "date")).toBe("09-12");
});

it('passes the mounted compact toolbar as a chart-local DrawingCanvas obstacle', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('chart-stage')) return { left: 100, top: 50, right: 900, bottom: 450, width: 800, height: 400 } as DOMRect;
    if (this.classList.contains('replay-chart-compact-controls')) return { left: 300, top: 70, right: 500, bottom: 114, width: 200, height: 44 } as DOMRect;
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
  });
  const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:10,high:12,low:9,close:11,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'toolbar-obstacle',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},compactControls:true,planPriceLines:[{id:'entry',price:10,title:'计划入场'}]};
  render(<ReplayChart {...props}/>);

  await waitFor(() => expect(engine.drawingCanvasProps?.controlObstacles).toEqual([{
    id: 'compact-toolbar', left: 200, top: 20, right: 400, bottom: 64,
  }]));
});

it('re-measures a moved compact toolbar through ResizeObserver without changing its chart-local contract', async () => {
  const callbacks: Array<() => void> = [];
  let toolbarLeft = 300;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { callbacks.push(callback); }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('chart-stage')) return { left: 100, top: 50, right: 900, bottom: 450, width: 800, height: 400 } as DOMRect;
    if (this.classList.contains('replay-chart-compact-controls')) return { left: toolbarLeft, top: 70, right: toolbarLeft + 200, bottom: 114, width: 200, height: 44 } as DOMRect;
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
  });
  const props: ComponentProps<typeof ReplayChart> = { candles:[{time:'2026-01-01T00:00:00Z',open:10,high:12,low:9,close:11,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'toolbar-obstacle-move',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},compactControls:true,planPriceLines:[{id:'entry',price:10,title:'计划入场'}]};
  render(<ReplayChart {...props}/>);

  await waitFor(() => expect(engine.drawingCanvasProps?.controlObstacles).toEqual([{
    id: 'compact-toolbar', left: 200, top: 20, right: 400, bottom: 64,
  }]));
  toolbarLeft = 420;
  callbacks.forEach(callback => callback());
  await waitFor(() => expect(engine.drawingCanvasProps?.controlObstacles).toEqual([{
    id: 'compact-toolbar', left: 320, top: 20, right: 520, bottom: 64,
  }]));
});

it('measures the noncompact plan-price action and clears its obstacle when the action unmounts', async () => {
  let disconnects = 0;
  vi.stubGlobal('ResizeObserver', class {
    constructor() {}
    observe() {}
    disconnect() { disconnects += 1; }
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('chart-stage')) return { left: 40, top: 30, right: 840, bottom: 430, width: 800, height: 400 } as DOMRect;
    if (this.classList.contains('recall-plan-price-action')) return { left: 116, top: 334, right: 276, bottom: 370, width: 160, height: 36 } as DOMRect;
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
  });
  const props: ComponentProps<typeof ReplayChart> = { candles:[{time:'2026-01-01T00:00:00Z',open:10,high:12,low:9,close:11,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'toolbar-obstacle-action',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},compactControls:false,planPriceLines:[{id:'entry',price:10,title:'计划入场'}]};
  const view = render(<ReplayChart {...props}/>);

  await waitFor(() => expect(engine.drawingCanvasProps?.controlObstacles).toEqual([{
    id: 'plan-price-action', left: 76, top: 304, right: 236, bottom: 340,
  }]));
  view.rerender(<ReplayChart {...props} planPriceLines={[]}/>);
  await waitFor(() => expect(engine.drawingCanvasProps?.controlObstacles).toEqual([]));
  view.unmount();
  expect(disconnects).toBeGreaterThan(0);
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

it("renders a filled diamond and real action text for each execution", () => {
  const candle = { time: "2025-01-02T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 };
  const execution = (id: string, side: "buy" | "sell", positionEffect?: "open-long" | "close-long", quantity = "1") => ({
    id,
    source: { platform: "futu", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side,
    executedAt: "2025-01-02T10:05:00.000Z",
    quantity,
    price: "1",
    fee: "0",
    ...(positionEffect ? { source: { platform: "futu", row: 1, displayTimePolicy: "execution-time" as const, positionEffect } } : {}),
  });
  const markers = buildReplayChartMarkers(
    [candle],
    [execution("buy-1", "buy", "open-long"), execution("buy-2", "buy", "open-long"), execution("sell", "sell", "close-long", "2")],
  );
  expect(markers).toEqual([
    expect.objectContaining({ shape: "diamond", text: "买入", actionLabel: "买入", price: 1, fillCount: 1, executionIds: ["buy-1"] }),
    expect.objectContaining({ shape: "diamond", text: "加仓", actionLabel: "加仓", price: 1, fillCount: 1, executionIds: ["buy-2"] }),
    expect.objectContaining({ shape: "diamond", text: "清仓", actionLabel: "清仓", price: 2, fillCount: 1, executionIds: ["sell"] }),
  ]);
});

it("does not call an exit a liquidation when an earlier fill leaves inventory unknown", () => {
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const execution = (id: string, executedAt: string, quantity: string, positionEffect: "open-long" | "close-long") => ({
    id,
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const, positionEffect },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: positionEffect === "close-long" ? "sell" as const : "buy" as const,
    executedAt,
    quantity,
    price: "1",
    fee: "0",
  });
  const markers = buildReplayChartMarkers(
    [candle("2025-01-01T10:00:00Z"), candle("2025-01-02T10:00:00Z"), candle("2025-01-03T10:00:00Z")],
    [
      execution("known-open", "2025-01-01T10:05:00Z", "10", "open-long"),
      execution("unknown-open", "2025-01-02T10:05:00Z", "not-recorded", "open-long"),
      execution("known-close", "2025-01-03T10:05:00Z", "10", "close-long"),
    ],
  );
  expect(markers.at(-1)).toEqual(expect.objectContaining({ actionLabel: "减仓", text: "减仓" }));
  expect(markers.at(-1)?.text).not.toContain("清仓");
});

it("does not call a direction-unknown sell a liquidation", () => {
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const execution = (id: string, side: "buy" | "sell", executedAt: string, quantity: string, positionEffect?: "open-long") => ({
    id,
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const, ...(positionEffect ? { positionEffect } : {}) },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side,
    executedAt,
    quantity,
    price: "1",
    fee: "0",
  });
  const markers = buildReplayChartMarkers(
    [candle("2025-01-01T10:00:00Z"), candle("2025-01-02T10:00:00Z")],
    [
      execution("open", "buy", "2025-01-01T10:05:00Z", "1000", "open-long"),
      execution("unknown-direction-close", "sell", "2025-01-02T10:05:00Z", "1000"),
    ],
  );
  expect(markers.at(-1)).toEqual(expect.objectContaining({ actionLabel: "减仓", text: "减仓" }));
});

it("keeps same-candle fills in authoritative execution order with one selectable marker per fill", () => {
  const candle = { time: "2025-01-02T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 };
  const execution = (
    id: string,
    side: "buy" | "sell",
    executedAt: string,
    quantity: string,
    positionEffect: "open-long" | "close-long",
  ) => ({
    id,
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const, positionEffect },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side,
    executedAt,
    quantity,
    price: "1",
    fee: "0",
  });

  const markers = buildReplayChartMarkers([candle], [
    execution("buy", "buy", "2025-01-02T10:01:00.000Z", "1000", "open-long"),
    execution("partial", "sell", "2025-01-02T10:02:00.000Z", "600", "close-long"),
    execution("final", "sell", "2025-01-02T10:03:00.000Z", "400", "close-long"),
  ]);

  expect(markers.filter((marker) => marker.executionIds)).toEqual([
    expect.objectContaining({ executionIds: ["buy"], actionLabel: "买入", text: "买入" }),
    expect.objectContaining({ executionIds: ["partial"], actionLabel: "减仓", text: "减仓" }),
    expect.objectContaining({ executionIds: ["final"], actionLabel: "清仓", text: "清仓" }),
  ]);
  expect(markers.filter((marker) => marker.executionIds).map((marker) => marker.offsetX)).toEqual([-18, 0, 18]);
  expect(markers.filter((marker) => marker.executionIds).map((marker) => marker.offsetY)).toEqual([0, 0, -22]);
});

it("uses the authoritative opening ledger to distinguish partial and full long exits", () => {
  const candles = [
    { time: "2025-01-02T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 },
    { time: "2025-01-03T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 },
  ];
  const execution = (id: string, executedAt: string, quantity: string) => ({
    id,
    source: {
      platform: "fixture",
      row: 1,
      displayTimePolicy: "execution-time" as const,
      positionEffect: "close-long" as const,
      openingPosition: { accountId: "account", market: "US", symbol: "TEST", phase: "opening" as const, date: "2025-01-01", quantity: "1000", source: [] },
      statementPositions: [{ accountId: "account", market: "US", symbol: "TEST", phase: "closing" as const, date: "2025-01-04", quantity: "0", source: [] }],
    },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "sell" as const,
    executedAt,
    quantity,
    price: "1",
    fee: "0",
  });

  const markers = buildReplayChartMarkers(candles, [
    execution("partial", "2025-01-02T10:05:00Z", "400"),
    { ...execution("final", "2025-01-03T10:05:00Z", "600"), source: { ...execution("final-source", "2025-01-03T10:05:00Z", "600").source, openingPosition: undefined, statementPositions: undefined } },
  ]);

  expect(markers.filter((marker) => marker.executionIds).map((marker) => marker.actionLabel)).toEqual(["减仓", "清仓"]);
});

it("uses a negative authoritative opening ledger to distinguish partial and full short exits", () => {
  const candles = [
    { time: "2025-01-02T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 },
    { time: "2025-01-03T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 },
  ];
  const execution = (id: string, executedAt: string, quantity: string) => ({
    id,
    source: {
      platform: "fixture",
      row: 1,
      displayTimePolicy: "execution-time" as const,
      positionEffect: "close-short" as const,
      openingPosition: { accountId: "account", market: "US", symbol: "TEST", phase: "opening" as const, date: "2025-01-01", quantity: "-1000", source: [] },
    },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const,
    executedAt,
    quantity,
    price: "1",
    fee: "0",
  });

  const markers = buildReplayChartMarkers(candles, [
    execution("partial-short", "2025-01-02T10:05:00Z", "400"),
    execution("final-short", "2025-01-03T10:05:00Z", "600"),
  ]);

  expect(markers.filter((marker) => marker.executionIds).map((marker) => marker.actionLabel)).toEqual(["减空", "买入平仓"]);
});

it("keeps authoritative opening inventories separate for accounts and instruments", () => {
  const candle = { time: "2025-01-02T10:00:00.000Z", open: 1, high: 2, low: 1, close: 2, volume: 10 };
  const execution = (id: string, accountId: string, symbol: string) => ({
    id,
    source: {
      platform: "fixture",
      row: 1,
      displayTimePolicy: "execution-time" as const,
      positionEffect: "close-long" as const,
      openingPosition: { accountId, market: "US", symbol, phase: "opening" as const, date: "2025-01-01", quantity: "1000", source: [] },
    },
    accountId,
    accountLabel: accountId,
    instrument: { id: `US:${symbol}`, symbol, name: symbol, market: "US", currency: "USD" },
    side: "sell" as const,
    executedAt: "2025-01-02T10:05:00Z",
    quantity: "1000",
    price: "1",
    fee: "0",
  });

  const markers = buildReplayChartMarkers([candle], [
    execution("account-a-test", "account-a", "TEST"),
    execution("account-b-other", "account-b", "OTHER"),
  ]);

  expect(markers.filter((marker) => marker.executionIds).map((marker) => marker.actionLabel)).toEqual(["清仓", "清仓"]);
});

it("offers marker prices to lightweight-charts autoscale", () => {
  const primitive = createExecutionMarkerPrimitive(() => [{ time: 1 as Time, open: 1, high: 2, low: 1, close: 2, volume: 10 }]);
  primitive.setMarkers([{
    time: 1 as Time,
    price: 61.5,
    position: "belowBar",
    color: "#26a69a",
    shape: "diamond",
    actionLabel: "买入",
    text: "买入",
  }]);

  expect(primitive.autoscaleInfo?.(0 as never, 2 as never)).toEqual(expect.objectContaining({
    priceRange: expect.objectContaining({ minValue: expect.any(Number), maxValue: expect.any(Number) }),
  }));
  const range = primitive.autoscaleInfo?.(0 as never, 2 as never)?.priceRange;
  expect(range?.minValue).toBeLessThan(61.5);
  expect(range?.maxValue).toBeGreaterThan(61.5);
});

it("hit-tests the clamped diamond position at the pane boundary", () => {
  const primitive = createExecutionMarkerPrimitive(() => [{ time: 1 as Time, open: 1, high: 2, low: 1, close: 2, volume: 10 }]);
  const chart = {
    timeScale: () => ({
      width: () => 110,
      timeToCoordinate: () => 100,
      logicalToCoordinate: () => 100,
    }),
  };
  const series = { priceToCoordinate: () => 200 };
  primitive.attached?.({ chart, series, requestUpdate: () => {} } as never);
  primitive.setMarkers([{
    time: 1 as Time,
    price: 61.5,
    position: "aboveBar",
    color: "#ef5350",
    shape: "diamond",
    actionLabel: "清仓",
    text: "清仓",
    executionIds: ["fill-final"],
    offsetX: 18,
  }]);

  expect(primitive.hitTest?.(104, 190)).toEqual(expect.objectContaining({ externalId: "fill-final" }));
  expect(primitive.hitTest?.(120, 190)).toBeNull();
});

it("projects a between-candle execution through integer SDK coordinates", () => {
  const primitive = createExecutionMarkerPrimitive(() => [
    { time: 0 as Time, open: 1, high: 2, low: 1, close: 2, volume: 10 },
    { time: 10 as Time, open: 1, high: 2, low: 1, close: 2, volume: 10 },
  ]);
  const chart = {
    timeScale: () => ({
      width: () => 210,
      timeToCoordinate: () => null,
      // Installed lightweight-charts returns 0 for a fractional logical.
      logicalToCoordinate: (logical: number) => Number.isInteger(logical) ? logical * 100 : 0,
    }),
  };
  const series = { priceToCoordinate: () => 200 };
  primitive.attached?.({ chart, series, requestUpdate: () => {} } as never);
  primitive.setMarkers([{
    time: 5 as Time,
    price: 61.5,
    position: "aboveBar",
    color: "#ef5350",
    shape: "diamond",
    actionLabel: "买入",
    text: "买入",
    executionIds: ["fractional-fill"],
  }]);

  expect(primitive.hitTest?.(50, 190)).toEqual(expect.objectContaining({ externalId: "fractional-fill" }));
  expect(primitive.hitTest?.(0, 190)).toBeNull();
});

it("anchors a revealed execution in its actual whitespace time when the candle OHLC is still withheld", () => {
  const candle = (time: string, knowledgeAt: string) => ({ time, knowledgeAt, open: 55, high: 56, low: 54, close: 55, volume: 10 });
  const execution = {
    id: "aug-10-buy",
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account", accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const, executedAt: "2026-08-10T14:30:00Z", quantity: "1", price: "61.5", fee: "0",
  };
  const markers = buildReplayChartMarkers(
    [
      candle("2026-08-06T00:00:00Z", "2026-08-07T00:00:00Z"),
      candle("2026-08-07T00:00:00Z", "2026-08-08T00:00:00Z"),
    ],
    [execution],
  );
  expect(markers).toEqual([
    expect.objectContaining({
      time: Date.parse(execution.executedAt) / 1000,
      price: 61.5,
      text: "买入",
      executionIds: ["aug-10-buy"],
    }),
  ]);
});

it("moves the replay view to a revealed whitespace execution without adding its withheld candle", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string, knowledgeAt: string) => ({ time, knowledgeAt, open: 55, high: 56, low: 54, close: 55, volume: 10 });
  const candles = [
    candle("2026-08-06T00:00:00Z", "2026-08-07T00:00:00Z"),
    candle("2026-08-07T00:00:00Z", "2026-08-08T00:00:00Z"),
  ];
  const execution = {
    id: "aug-10-buy",
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account", accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const, executedAt: "2026-08-10T14:30:00Z", quantity: "1", price: "61.5", fee: "0",
  };
  const props: ComponentProps<typeof ReplayChart> = {
    candles, executions: [], cursor: candles.at(-1)!.time, averageCost: 0, drawings: [], activeTool: "cursor",
    episodeId: "episode", selectedDrawingId: null, plannedRiskAmount: undefined, currency: "USD",
    onSelectDrawing: () => {}, onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
    viewportKey: "whitespace-replay-view",
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(2));
  engine.range = { from: -0.5, to: 1.5 };
  const span = engine.range.to - engine.range.from;
  rerender(<ReplayChart {...props} executions={[execution]} revealRequest={{ id: 1, time: execution.executedAt }} />);
  await waitFor(() => expect(engine.range.to).toBeGreaterThan(1.5));
  expect(engine.range.to - engine.range.from).toBeCloseTo(span);
  expect(engine.data).toHaveLength(3);
});

it("follows a requested replay target once while preserving the current time span", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (time: string) => ({ time, open: 1, high: 2, low: 1, close: 2, volume: 10 });
  const props: ComponentProps<typeof ReplayChart> = {
    candles: [candle("2026-01-01T00:00:00Z"), candle("2026-01-02T00:00:00Z")],
    executions: [], cursor: "2026-01-02T00:00:00Z", averageCost: 0, drawings: [], activeTool: "cursor",
    episodeId: "episode", selectedDrawingId: null, plannedRiskAmount: undefined, currency: "USD",
    onSelectDrawing: () => {}, onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
    viewportKey: "same-replay-view",
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(2));
  engine.range = { from: -0.5, to: 1.5 };
  const span = engine.range.to - engine.range.from;
  const beforeRequest = engine.rangeCalls.length;
  const candles = [...props.candles, candle("2026-01-03T00:00:00Z"), candle("2026-01-04T00:00:00Z")];
  rerender(<ReplayChart {...props} candles={candles} revealRequest={{ id: 1, time: "2026-01-04T00:00:00Z" }} />);
  await waitFor(() => expect(engine.range.to).toBeGreaterThanOrEqual(3));
  expect(engine.range.to - engine.range.from).toBeCloseTo(span);
  expect(engine.range.from).toBeLessThanOrEqual(3);
  expect(engine.range.to).toBeGreaterThanOrEqual(3);
  const afterRequest = engine.rangeCalls.length;

  // A data refresh with the same request must not move the user's view again.
  rerender(<ReplayChart {...props} candles={candles.map(item => ({ ...item }))} revealRequest={{ id: 1, time: "2026-01-04T00:00:00Z" }} />);
  expect(engine.rangeCalls.length).toBe(afterRequest);
  expect(engine.range.to - engine.range.from).toBeCloseTo(span);
  expect(afterRequest).toBeGreaterThan(beforeRequest);
});

it("advances through sequential replay cutoffs after each candle open without losing the viewport", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (day: number) => {
    const time = new Date(Date.UTC(2026, 0, day)).toISOString();
    return {
      time,
      knowledgeAt: time.replace("T00:00:00.000Z", "T16:00:00.000Z"),
      open: 1,
      high: 2,
      low: 1,
      close: 2,
      volume: 10,
    };
  };
  const initialCandles = [candle(1), candle(2)];
  const lastExecution = {
    id: "last-fill",
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account",
    accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const,
    executedAt: "2026-01-03T12:00:00Z",
    quantity: "1",
    price: "1",
    fee: "0",
  };
  const props: ComponentProps<typeof ReplayChart> = {
    candles: initialCandles,
    executions: [],
    cursor: initialCandles.at(-1)!.knowledgeAt!,
    averageCost: 0,
    drawings: [],
    activeTool: "cursor",
    episodeId: "episode",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
    viewportKey: "continuous-replay-view",
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(2));
  engine.range = { from: -0.5, to: 1.5 };
  const span = engine.range.to - engine.range.from;

  for (let day = 3; day <= 15; day += 1) {
    const candles = Array.from({ length: day }, (_, index) => candle(index + 1));
    rerender(
      <ReplayChart
        {...props}
        candles={candles}
        executions={day >= 3 ? [lastExecution] : []}
        revealRequest={{ id: day - 2, time: candles.at(-1)!.knowledgeAt! }}
      />,
    );
    await waitFor(() => expect(engine.range.to).toBeGreaterThanOrEqual(day - 1));
    expect(engine.range.to - engine.range.from).toBeCloseTo(span);
  }
});

it("routes a click on a revealed execution marker to its source execution", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const execution = {
    id: "fill-1",
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account", accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const, executedAt: "2026-01-01T00:30:00Z", quantity: "1", price: "1", fee: "0",
  };
  const onExecutionSelect = vi.fn();
  const candle = { time: "2026-01-01T00:00:00Z", open: 1, high: 2, low: 1, close: 2, volume: 10 };
  render(<ReplayChart
    candles={[candle]}
    executions={[execution]}
    cursor={candle.time}
    averageCost={0}
    drawings={[]}
    activeTool="cursor"
    episodeId="episode"
    selectedDrawingId={null}
    plannedRiskAmount={undefined}
    currency="USD"
    onSelectDrawing={() => {}}
    onCommand={() => {}}
    onExecutionSelect={onExecutionSelect}
    settings={{ version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" }}
  />);
  await waitFor(() => expect(engine.clickHandler).not.toBeNull());
  await waitFor(() => {
    engine.clickHandler?.({ hoveredInfo: { objectId: "fill-1" } });
    expect(onExecutionSelect).toHaveBeenCalledWith("fill-1");
  });
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

it("keeps the logical span through replay rewind and forward reveal", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candle = (day: number) => ({
    time: new Date(Date.UTC(2026, 0, day)).toISOString(),
    open: 1,
    high: 2,
    low: 1,
    close: 2,
    volume: 10,
  });
  const allCandles = Array.from({ length: 10 }, (_, index) => candle(index + 1));
  const props: ComponentProps<typeof ReplayChart> = {
    candles: allCandles,
    executions: [],
    cursor: allCandles.at(-1)!.time,
    averageCost: 0,
    drawings: [],
    activeTool: "cursor",
    episodeId: "episode",
    viewportKey: "replay-shrink-view",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(allCandles.length));
  engine.range = { from: 6.25, to: 9.25 };
  const span = engine.range.to - engine.range.from;

  const earlyCandles = allCandles.slice(0, 4);
  rerender(<ReplayChart {...props} candles={earlyCandles} revealRequest={{ id: 1, time: earlyCandles.at(-1)!.time }} />);
  await waitFor(() => expect(engine.range.to - engine.range.from).toBeCloseTo(span));
  // Keep the fractional right anchor from the old viewport while the known
  // candle set shrinks; only the unavailable future bars are removed.
  expect(engine.range).toEqual({ from: 0.25, to: 3.25 });

  rerender(<ReplayChart {...props} candles={allCandles} revealRequest={{ id: 2, time: allCandles.at(-1)!.time }} />);
  await waitFor(() => expect(engine.range.to).toBeGreaterThanOrEqual(9));
  expect(engine.range.to - engine.range.from).toBeCloseTo(span);
  expect(engine.range).toEqual({ from: 6, to: 9 });
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

it("adds optional plan price lines without refitting and removes replaced lines", async () => {
 vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
 const props: ComponentProps<typeof ReplayChart> = { candles:[{time:"2026-01-01T00:00:00Z",open:10,high:12,low:9,close:11,volume:1}], executions:[], cursor:"2026-01-01T00:00:00Z",averageCost:0,drawings:[],activeTool:"cursor",episodeId:"plan",plannedRiskAmount:undefined,selectedDrawingId:null,currency:"USD",onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:"blue-orange"},planPriceLines:[{id:"entry",price:10,title:"计划入场"}] };
 const {rerender}=render(<ReplayChart {...props}/>);
 await waitFor(()=>expect(engine.planLines).toContainEqual(expect.objectContaining({price:10,title:"",color:"#adbbcf",axisLabelVisible:false,lineStyle:2})));
 const count=engine.rangeCalls.length;
 rerender(<ReplayChart {...props} planPriceLines={[{id:"entry",price:11,title:"计划入场"}]}/>);
 await waitFor(()=>expect(engine.planLines).toContainEqual(expect.objectContaining({price:11,title:"",color:"#adbbcf",axisLabelVisible:false,lineStyle:2})));
 expect(engine.rangeCalls).toHaveLength(count);
 expect(engine.removedLines).toBeGreaterThan(0);
});

it('fits plan prices explicitly without changing time window or reading future candles', async () => {
 vi.stubGlobal('ResizeObserver', class {observe(){} disconnect(){}});
 const props: ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:56,volume:1},{time:'2026-02-01T00:00:00Z',open:900,high:999,low:800,close:900,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'fit-plan',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'entry',price:68,title:'计划入场'}]};
 const {getByRole}=render(<ReplayChart {...props}/>);
 const planPriceButton = await waitFor(()=>getByRole('button',{name:'显示计划价格'}));
 expect(planPriceButton).toHaveClass('recall-plan-price-action');
 expect(planPriceButton.style.left).toBe('76px');
 expect(planPriceButton.style.bottom).toBe('48px');
 const range={...engine.range};
 fireEvent.click(planPriceButton);
 expect(engine.priceRange.to).toBeLessThan(100);expect(engine.priceRange.to).toBeGreaterThan(68);expect(engine.range).toEqual(range);
});
it('drag shares plan callback, pauses interaction and cancellation restores original price', async()=>{
 vi.stubGlobal('ResizeObserver',class{constructor(private callback:()=>void){}observe(){this.callback();}disconnect(){}});
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
 vi.stubGlobal('PointerEvent',MouseEvent);
 const change=vi.fn(),pause=vi.fn(),select=vi.fn();
 const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:56,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'drag-plan',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'entry',price:68,title:'计划入场',displayPrice:'68.0000000000001'}],planLinesEditable:true,onPlanPriceChange:change,onPlanInteractionStart:pause,onPlanPriceSelect:select};
 const {getByRole}=render(<ReplayChart {...props}/>);
 const button=await waitFor(()=>getByRole('button',{name:'计划入场 68.0000000000001，精确编辑'}));
 fireEvent.pointerDown(button,{clientY:68});fireEvent.pointerMove(button,{clientY:72});
 expect(pause).toHaveBeenCalledOnce();expect(change).toHaveBeenLastCalledWith('entry','72');
 fireEvent.pointerCancel(button);expect(change).toHaveBeenLastCalledWith('entry','68.0000000000001');
 fireEvent.pointerDown(button,{clientY:68});fireEvent.keyDown(button,{key:'Escape'});
 expect(change).toHaveBeenLastCalledWith('entry','68.0000000000001');
 fireEvent.click(button);expect(select).toHaveBeenCalledWith('entry');
 vi.restoreAllMocks();
});
it('renders plan axis labels as transparent semantic name and lexical-value columns', async () => {
 vi.stubGlobal('ResizeObserver', class { constructor(private callback:()=>void){} observe(){this.callback();} disconnect() {} });
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
 const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:56,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'axis-columns',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'target',price:68,title:'止盈目标',displayPrice:'68.0000000000001'}]};
 const {getByRole}=render(<ReplayChart {...props}/>);
 const label=await waitFor(()=>getByRole('button',{name:'止盈目标 68.0000000000001，精确编辑'}));
 expect(label).toHaveAttribute('data-plan-source-ids','target');
 expect(label.querySelector('[data-plan-axis-name]')).toHaveTextContent('止盈目标');
 expect(label.querySelector('[data-plan-axis-value]')).toHaveTextContent('68.0000000000001');
 expect(label.style.background).toBe('transparent');
 expect(label.style.border).toBe('0px');
});

it('uses a shared 12px axis metric and separates visual rows from pointer hit targets', async()=>{
 vi.stubGlobal('ResizeObserver', class { constructor(private callback:()=>void){} observe(){this.callback();} disconnect(){} });
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
 const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:55.94,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'axis-metric',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'entry',price:56,title:'计划入场',displayPrice:'56.0000'},{id:'target',price:56.01,title:'止盈目标',displayPrice:'56.0100'}]};
 const {getAllByRole}=render(<ReplayChart {...props}/>);
 const labels=await waitFor(()=>{
  const found=getAllByRole('button').filter(button=>button.hasAttribute('data-plan-source-ids'));
  expect(found).toHaveLength(2);
  return found;
 });
 expect(labels).toHaveLength(2);
 expect(labels.map(label=>label.style.left)).toEqual([labels[0].style.left,labels[0].style.left]);
 expect(labels.map(label=>label.style.minHeight)).toEqual(['36px','36px']);
 const bounds=labels.map(label=>({top:Number.parseFloat(label.style.top),bottom:Number.parseFloat(label.style.top)+Number.parseFloat(label.style.height)})).sort((first,second)=>first.top-second.top);
 expect(bounds[1].top).toBeGreaterThanOrEqual(bounds[0].bottom);
 expect(labels[0].style.fontSize).toBe('12px');
 expect(labels[0].style.fontWeight).toBe('400');
 expect(labels[0].style.lineHeight).toBe('18px');
 expect(labels[0].querySelector<HTMLElement>('[data-plan-axis-value]')?.style.textAlign).toBe('right');
 vi.restoreAllMocks();
});

it('uses a 44px hit target for coarse pointers without changing the 18px visual row', async()=>{
 vi.stubGlobal('ResizeObserver', class { constructor(private callback:()=>void){} observe(){this.callback();} disconnect(){} });
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
 vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:55.94,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:0,drawings:[],activeTool:'cursor',episodeId:'axis-coarse',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'entry',price:56,title:'计划入场',displayPrice:'56.0000'},{id:'target',price:56.01,title:'止盈目标',displayPrice:'56.0100'}]};
 const {getAllByRole}=render(<ReplayChart {...props}/>);
 const labels=await waitFor(()=>{
  const found=getAllByRole('button').filter(button=>button.hasAttribute('data-plan-source-ids'));
  expect(found).toHaveLength(2);
  return found;
 });
 expect(labels.map(label=>label.style.minHeight)).toEqual(['44px','44px']);
 expect(labels.map(label=>label.style.height)).toEqual(['44px','44px']);
 const bounds=labels.map(label=>({top:Number.parseFloat(label.style.top),bottom:Number.parseFloat(label.style.top)+Number.parseFloat(label.style.height)})).sort((first,second)=>first.top-second.top);
 expect(bounds[1].top).toBeGreaterThanOrEqual(bounds[0].bottom);
 expect(labels[0].style.lineHeight).toBe('18px');
 vi.restoreAllMocks();
});

it('keeps live labels clear of both revealed close and visible actual cost', async () => {
 vi.stubGlobal('ResizeObserver', class { constructor(private callback:()=>void){} observe(){this.callback();} disconnect(){} });
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
 const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:55.94,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:56,drawings:[],activeTool:'cursor',episodeId:'axis-native-obstacles',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'entry',price:56,title:'计划入场',displayPrice:'56.0000'},{id:'target',price:55.95,title:'止盈目标',displayPrice:'55.9500'}]};
 const {getAllByRole}=render(<ReplayChart {...props}/>);
 const labels=await waitFor(()=>{
  const found=getAllByRole('button').filter(button=>button.hasAttribute('data-plan-source-ids'));
  expect(found).toHaveLength(2);
  return found;
 });
 const centers=labels.map(label=>Number.parseFloat(label.style.top)+18);
 expect(centers[1]-centers[0]).toBeGreaterThanOrEqual(36);
 for (const center of centers) {
  expect(Math.abs(center-55.94)).toBeGreaterThanOrEqual(22);
  expect(Math.abs(center-56)).toBeGreaterThanOrEqual(22);
 }
 vi.restoreAllMocks();
});

it('shows complete accessible axis metadata without connectors or hit targets when live layout is infeasible', async () => {
 vi.stubGlobal('ResizeObserver', class { constructor(private callback:()=>void){} observe(){this.callback();} disconnect(){} });
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(40);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
 const props:ComponentProps<typeof ReplayChart>={candles:[{time:'2026-01-01T00:00:00Z',open:56,high:57,low:55,close:56,volume:1}],executions:[],cursor:'2026-01-01T00:00:00Z',averageCost:56,drawings:[],activeTool:'cursor',episodeId:'axis-infeasible',plannedRiskAmount:undefined,selectedDrawingId:null,currency:'USD',onSelectDrawing:()=>{},onCommand:()=>{},settings:{version:1,showGrid:true,showVolume:true,showExecutions:true,showAverageCost:true,colorScheme:'blue-orange'},planPriceLines:[{id:'entry',price:56,title:'计划入场',displayPrice:'56.0000'},{id:'cost',price:56.01,title:'实际成本',displayPrice:'56.0100'},{id:'stop',price:56.02,title:'初始止损',displayPrice:'56.0200'}]};
 const {container,getByRole}=render(<ReplayChart {...props}/>);
 const status=await waitFor(()=>getByRole('alert'));
 expect(status).toHaveAttribute('data-plan-axis-status','infeasible');
 expect(status.querySelectorAll('[data-plan-axis-name]')).toHaveLength(3);
 expect(status).toHaveTextContent('计划入场');
 expect(status).toHaveTextContent('56.0000');
 expect(status).toHaveTextContent('实际成本');
 expect(status).toHaveTextContent('56.0100');
 expect(status).toHaveTextContent('初始止损');
 expect(status).toHaveTextContent('56.0200');
 expect(container.querySelectorAll('[data-plan-source-ids]').length).toBe(3);
 expect(container.querySelector('[data-plan-axis-connectors]')).toBeNull();
 expect(container.querySelectorAll('button[data-plan-source-ids]')).toHaveLength(0);
 vi.restoreAllMocks();
});
