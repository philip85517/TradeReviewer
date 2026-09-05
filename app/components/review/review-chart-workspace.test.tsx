import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  applyDrawingCommand,
  createDrawingHistory,
} from "../../lib/chart/drawing-commands";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import {
  executionTimestampLabel,
  ReviewChartWorkspace,
  type ReviewChartViewModel,
} from "./review-chart-workspace";

const trend: NormalizedDrawing = {
  version: 2,
  id: "trend-1",
  episodeId: "episode-1",
  name: "突破趋势",
  tool: "trend-line",
  anchors: [
    { time: "2025-01-02T02:00:00.000Z", price: 34 },
    { time: "2025-01-02T02:15:00.000Z", price: 35 },
  ],
  style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
  zIndex: 0,
  hidden: false,
  locked: false,
  visibleOn: "all",
  stage: "during-replay",
  createdAtCursor: "2025-01-02T02:15:00.000Z",
};

const futureTrend: NormalizedDrawing = {
  ...trend,
  id: "future-trend",
  name: "未来趋势",
  createdAtCursor: "2025-01-02T02:45:00.000Z",
};

const model: ReviewChartViewModel = {
  source: "imported",
  episodeId: "episode-1",
  instrument: {
    id: "HK:1810",
    symbol: "1810",
    name: "小米集团-W",
    market: "HK",
    currency: "HKD",
  },
  timeframe: "15m",
  timeframeAvailability: {
    "15m": { enabled: true },
    "1h": { enabled: true },
    "4h": { enabled: true },
    "1D": { enabled: true },
    "1W": { enabled: true },
  },
  cursor: "2025-01-02T02:15:00.000Z",
  candles: [
    {
      time: "2025-01-02T02:00:00.000Z",
      open: 34.5,
      high: 35,
      low: 34,
      close: 34.8,
      volume: 1000,
    },
    {
      time: "2025-01-02T02:15:00.000Z",
      open: 34.8,
      high: 36,
      low: 34.7,
      close: 35.8,
      volume: 1200,
    },
  ],
  executions: [
    {
      id: "open",
      source: {
        platform: "futu",
        row: 2,
        sourceTimestampText: "开仓成交",
        sourceTimezone: "Asia/Shanghai",
      },
      accountId: "acct",
      accountLabel: "富途",
      instrument: {
        id: "HK:1810",
        symbol: "1810",
        name: "小米集团-W",
        market: "HK",
        currency: "HKD",
      },
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "8",
    },
  ],
  position: {
    quantity: "100",
    averageCost: "34.5",
    realizedPnl: "0",
    unrealizedPnl: "130",
    netPnl: "130",
    fees: "0",
    grossCapitalDeployed: "3450",
    returnPercent: "3.76811594",
  },
  pathMetrics: {
    current: {
      quantity: "100",
      averageCost: "34.5",
      realizedPnl: "0",
      unrealizedPnl: "130",
      netPnl: "130",
      fees: "0",
      grossCapitalDeployed: "3450",
      returnPercent: "3.76811594",
    },
    holdingMilliseconds: 15 * 60 * 1000,
    mfe: { amount: "150", percent: "4.34782609" },
    mae: { amount: "-50", percent: "-1.44927536" },
    maximumDrawdown: { amount: "0", percent: "0" },
    profitGiveback: { amount: "20", percent: "0.57971014" },
    rMultiple: "1.3",
  },
  canGoBack: true,
  canGoForward: true,
  canGoToNextExecution: true,
  replayError: null,
  refreshDisabledReason: undefined,
  dataDetails: [
    {
      providerLabel: "腾讯行情",
      nativeInterval: "15m",
      coverageStart: "2025-01-02T02:00:00.000Z",
      coverageEnd: "2025-01-02T02:45:00.000Z",
      fetchedAt: "2025-01-03T00:00:00.000Z",
      status: "complete",
      availableTimeframes: ["15m", "1h", "4h"],
    },
  ],
};

describe("ReviewChartWorkspace", () => {
  it("labels date-only broker rows without exposing a synthetic time", () => {
    const execution = {
      ...model.executions[0],
      executedAt: "2099-12-31T23:59:59.000Z",
      source: {
        ...model.executions[0].source,
        timePrecision: "date-only" as const,
        sourceTimestampText: "20250102",
      },
    };

    expect(executionTimestampLabel(execution)).toBe(
      "20250102 · 对账单未提供成交时间",
    );
    expect(executionTimestampLabel(execution)).not.toMatch(/2099|23:59:59/);
  });

  it("formats exact execution timestamps in Beijing time with seconds", () => {
    expect(
      executionTimestampLabel({
        ...model.executions[0],
        executedAt: "2025-01-21T20:00:00.000Z",
        source: {
          ...model.executions[0].source,
          sourceTimestampText: "2025/01/22 04:00:00",
          timePrecision: "second",
        },
      }),
    ).toBe("2025年01月22日 04:00:00");
  });

  it("renders the controlled replay, drawing, layer, execution, and review surfaces", async () => {
    const user = userEvent.setup();
    const onTimeframeChange = vi.fn();
    const onToolChange = vi.fn();
    const onToggleLayers = vi.fn();
    const onNext = vi.fn();
    let drawingHistory = createDrawingHistory();
    drawingHistory = applyDrawingCommand(drawingHistory, {
      type: "add",
      drawing: trend,
    });
    drawingHistory = applyDrawingCommand(drawingHistory, {
      type: "add",
      drawing: futureTrend,
    });
    const props = {
        model,
        episodeOptions: [
          {
            id: "episode-1",
            label: "第 1 次交易",
            startedAt: "2025-01-02T02:00:00.000Z",
            endedAt: "2025-01-02T02:45:00.000Z",
            status: "closed",
          },
        ],
        playing: false,
        speed: 700,
        activeTool: "cursor" as const,
        drawingHistory,
        selectedDrawingId: null,
        layersOpen: true,
        settings: {
          version: 1,
          showGrid: true,
          showVolume: true,
          showExecutions: true,
          showAverageCost: true,
          colorScheme: "teal-red",
        },
        instruments: [
          {
            id: "HK:1810",
            name: "小米集团-W",
            symbol: "1810",
            market: "HK",
          },
        ],
        review: {
          version: 1,
          episodeId: "episode-1",
          instrumentId: "HK:1810",
          updatedAt: "2025-01-03T00:00:00.000Z",
          plan: {
            thesis: "回踩后承接",
            expectedPath: "",
            invalidationCondition: "",
            targetRange: "",
            plannedRiskAmount: "100",
            confidence: 4,
          },
          review: {
            decisionQuality: null,
            executionQuality: null,
            riskManagement: "",
            psychology: "",
            reusableRule: "",
            completed: false,
          },
          confirmedTagIds: [],
        },
        visiblePlan: {
          thesis: "游标可见计划",
          expectedPath: "",
          invalidationCondition: "游标止损",
          targetRange: "37–38",
          plannedRiskAmount: "25",
          confidence: 3,
        },
        activePanelTab: "stats" as const,
        drawerOpen: false,
        onEpisodeChange: vi.fn(),
        onTimeframeChange,
        onSelectInstrument: vi.fn(),
        onRefreshMarketData: vi.fn(),
        onToggleLayers,
        onSettingsChange: vi.fn(),
        onToolChange,
        onDrawingCommand: vi.fn(),
        onSelectDrawing: vi.fn(),
        onUndoDrawing: vi.fn(),
        onRedoDrawing: vi.fn(),
        onClearDrawings: vi.fn(),
        onToggleAllDrawings: vi.fn(),
        onPrevious: vi.fn(),
        onNext,
        onNextExecution: vi.fn(),
        onTogglePlay: vi.fn(),
        onSpeedChange: vi.fn(),
        onActivePanelTabChange: vi.fn(),
        onDrawerOpenChange: vi.fn(),
        onSaveReview: vi.fn().mockResolvedValue(undefined),
      } satisfies ComponentProps<typeof ReviewChartWorkspace>;
    const { rerender } = render(<ReviewChartWorkspace {...props} />);

    expect(
      screen.getByRole("heading", { name: "小米集团-W（1810）" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "交易回合" })).toHaveValue(
      "episode-1",
    );
    expect(screen.getByText("最大盈利（MFE）")).toBeInTheDocument();
    expect(
      screen.getByText("计划风险").parentElement,
    ).toHaveTextContent("HK$25.00");
    expect(
      screen.getByRole("heading", { name: "计划对比" }).parentElement,
    ).toHaveTextContent("失效条件游标止损");
    expect(screen.getByText("开仓成交")).toBeInTheDocument();
    expect(screen.getByText("费用 HK$8.00")).toBeInTheDocument();
    expect(screen.getByText("来源 futu · 第 2 行")).toBeInTheDocument();
    expect(screen.getByText("时区 Asia/Shanghai")).toBeInTheDocument();
    expect(screen.getByDisplayValue("突破趋势")).toBeInTheDocument();
    expect(screen.queryByText("未来趋势")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图层" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "撤销绘图" }),
    ).toBeDisabled();
    expect(document.querySelector(".chart-stage")).toHaveAttribute(
      "data-show-volume",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "趋势线" }));
    expect(onToolChange).toHaveBeenCalledWith("trend-line");
    await user.click(screen.getByRole("button", { name: "切换到 1h" }));
    expect(onTimeframeChange).toHaveBeenCalledWith("1h");
    await user.click(screen.getByRole("button", { name: "图层" }));
    expect(onToggleLayers).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "下一根 K 线" }));
    expect(onNext).toHaveBeenCalledTimes(1);

    rerender(
      <ReviewChartWorkspace
        {...props}
        model={{ ...model, cursor: "2025-01-02T02:45:00.000Z" }}
      />,
    );
    expect(screen.getByDisplayValue("未来趋势")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "撤销绘图" }),
    ).toBeEnabled();

    rerender(
      <ReviewChartWorkspace
        {...props}
        model={{ ...model, cursor: "2025-01-02T01:45:00.000Z" }}
      />,
    );
    const layers = screen.getByRole("button", { name: "图层" });
    expect(layers).toBeDisabled();
    expect(layers).toHaveAttribute(
      "title",
      "当前游标和周期暂无绘图",
    );
    expect(screen.queryByDisplayValue("突破趋势")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("未来趋势")).not.toBeInTheDocument();
    const grey = { ...model.executions[0], source: { ...model.executions[0].source, tradingSession: "grey-market" as const } };
    rerender(<ReviewChartWorkspace {...props} model={{ ...model, executions: [grey] }} />);
    expect(screen.getByText("暗盘成交，暂无对应暗盘行情")).toBeVisible();
    expect(screen.queryByText(/成交所在区间缺少行情/)).not.toBeInTheDocument();
    expect(screen.getByText("开仓成交")).toBeVisible();
    const missing = { ...model.executions[0], id: "missing", executedAt: "2024-01-01T02:00:00Z" };
    rerender(<ReviewChartWorkspace {...props} model={{ ...model, executions: [grey, missing] }} />);
    expect(screen.getByText(/1 笔成交无对应 K 线：成交所在区间缺少行情/)).toBeVisible();
    expect(screen.getByText("暗盘成交，暂无对应暗盘行情")).toBeVisible();
  });
});
