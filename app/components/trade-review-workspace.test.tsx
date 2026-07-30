import "fake-indexeddb/auto";

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type AtRule, type Node } from "postcss";

import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import type { EpisodeReviewRecord } from "../lib/reviews/types";
import { IndexedDbEpisodeReviewRepository } from "../lib/storage/indexeddb-episode-review-repository";
import { saveImportedExecutions } from "../lib/storage/import-library";
import { IndexedDbMarketDataRepository } from "../lib/storage/indexeddb-market-data-repository";
import { saveReviewState } from "../lib/storage/review-storage";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import type { TradeExecution } from "../lib/trades/types";
import { TradeReviewWorkspace } from "./trade-review-workspace";

const globalStyles = postcss.parse(
  readFileSync(join(process.cwd(), "app/globals.css"), "utf8"),
);

function mediaMatches(parent: Node["parent"], viewportWidth: number) {
  let current: Node["parent"] = parent;
  while (current) {
    const atRule = current as AtRule;
    if (current.type === "atrule" && atRule.name === "media") {
      const query = atRule.params;
      const maximum = query.match(/max-width:\s*(\d+)px/);
      const minimum = query.match(/min-width:\s*(\d+)px/);
      if (maximum && viewportWidth > Number(maximum[1])) return false;
      if (minimum && viewportWidth < Number(minimum[1])) return false;
      if (/prefers-reduced-motion/.test(query)) return false;
    }
    current = current.parent;
  }
  return true;
}

function declarationsAt(
  selector: string | string[],
  viewportWidth: number,
) {
  const selectors = Array.isArray(selector) ? selector : [selector];
  const declarations = new Map<string, string>();
  globalStyles.walkRules((rule) => {
    if (
      rule.selectors.some((item) => selectors.includes(item)) &&
      mediaMatches(rule.parent, viewportWidth)
    ) {
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
    }
  });
  return declarations;
}

function reducedMotionDeclarations(selector: string) {
  const declarations = new Map<string, string>();
  globalStyles.walkAtRules("media", (media) => {
    if (!/prefers-reduced-motion:\s*reduce/.test(media.params)) return;
    media.walkRules((rule) => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value);
      });
    });
  });
  return declarations;
}

const initialFrame: DemoReplayFrame = {
  cursorIndex: 0,
  cursor: "2025-01-02T14:30:00.000Z",
  candles15m: [
    {
      time: "2025-01-02T14:30:00.000Z",
      open: 10,
      high: 10.2,
      low: 9.9,
      close: 10.1,
      volume: 1_000,
    },
  ],
  executions: [],
  canGoBack: false,
  canGoForward: true,
};

const nextFrame: DemoReplayFrame = {
  ...initialFrame,
  cursorIndex: 1,
  cursor: "2025-01-02T14:45:00.000Z",
  candles15m: [
    ...initialFrame.candles15m,
    {
      time: "2025-01-02T14:45:00.000Z",
      open: 10.1,
      high: 10.5,
      low: 10,
      close: 10.4,
      volume: 1_200,
    },
  ],
  canGoBack: true,
};

function defaultEpisodeRecord(
  episodeId: string,
  instrumentId: string,
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt: "2025-01-07T00:00:00.000Z",
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "",
      confidence: null,
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
  };
}

const availabilityInstrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};

function availabilityExecution(input: {
  id: string;
  row: number;
  side: "buy" | "sell";
  executedAt: string;
}): TradeExecution {
  return {
    id: input.id,
    source: { platform: "futu", row: input.row },
    accountId: "acct",
    accountLabel: "富途",
    instrument: availabilityInstrument,
    side: input.side,
    executedAt: input.executedAt,
    quantity: "10",
    price: input.side === "buy" ? "10" : "11",
    fee: "0",
  };
}

async function cacheAvailabilityCandles(timestamps: string[]) {
  const repository = new IndexedDbMarketDataRepository();
  await repository.commitIntervalSyncResult({
    instrumentId: availabilityInstrument.id,
    interval: "15m",
    candles: timestamps.map((timestamp) => ({
      instrumentId: availabilityInstrument.id,
      interval: "15m" as const,
      timestamp,
      open: "10",
      high: "11",
      low: "9",
      close: "10.5",
      volume: "1000",
      currency: "USD",
      provider: "yahoo" as const,
      providerSymbol: "XPEV",
      adjustmentMode: "raw" as const,
      fetchedAt: "2025-01-07T00:00:00.000Z",
    })),
    coverage: timestamps.length === 0
      ? []
      : [{
          interval: "15m",
          requestedStart: timestamps[0],
          requestedEnd: timestamps.at(-1) ?? timestamps[0],
          actualStart: timestamps[0],
          actualEnd: timestamps.at(-1) ?? timestamps[0],
          status: "complete",
          provider: "yahoo",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        }],
    providerSymbol: { provider: "yahoo", symbol: "XPEV" },
  });
}

describe("TradeReviewWorkspace", () => {
  afterEach(() => cleanup());

  beforeEach(async () => {
    window.localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => nextFrame,
      }),
    );
  });

  it("advances one candle without revealing the future and preserves the cursor across periods", async () => {
    const user = userEvent.setup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    const cursorBefore = screen.getByTestId("replay-cursor").textContent;

    expect(screen.queryByText("未来成交")).not.toBeInTheDocument();
    expect(screen.queryByText(/共 \d+ 根/)).not.toBeInTheDocument();
    expect(screen.getByText("尚未成交")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );

    expect(screen.getByTestId("replay-cursor").textContent).not.toBe(
      cursorBefore,
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("mode=next"),
      { cache: "no-store" },
    );

    const cursorAfterAdvance =
      screen.getByTestId("replay-cursor").textContent;
    await user.click(screen.getByRole("button", { name: "切换到 1W" }));

    expect(screen.getByTestId("replay-cursor")).toHaveTextContent(
      cursorAfterAdvance ?? "",
    );
  });

  it("stops replay and reports a recoverable message when a step fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("回放数据暂时无法读取");
  });

  it("switches from the desktop review panel to an operable narrow drawer", async () => {
    const user = userEvent.setup();

    expect(
      declarationsAt(".workspace", 1260).get("grid-template-columns"),
    ).toBe("244px minmax(620px, 1fr) 290px");
    expect(
      declarationsAt(".review-side-panel-trigger", 1260).get("display"),
    ).toBe("none");
    expect(
      declarationsAt(".workspace", 1259).get("grid-template-columns"),
    ).toBe("220px minmax(600px, 1fr)");
    expect(
      declarationsAt(".review-side-panel-desktop", 1259).get("display"),
    ).toBe("none");
    expect(
      declarationsAt(".review-side-panel-trigger", 1259).get("display"),
    ).toBe("grid");
    expect(
      declarationsAt(".workspace", 1060).get("grid-template-columns"),
    ).toBe("220px minmax(600px, 1fr)");
    expect(
      declarationsAt(".workspace", 1059).get("grid-template-columns"),
    ).toBe("minmax(0, 1fr)");
    expect(
      declarationsAt(".episode-sidebar", 1059).get("display"),
    ).toBe("none");
    expect(
      declarationsAt(".instrument-search-popover", 1059).get("left"),
    ).toBe("9px");
    expect(
      declarationsAt(".instrument-search-popover", 1059).get("right"),
    ).toBe("9px");
    expect(
      declarationsAt(".instrument-search-popover", 1059).get("width"),
    ).toBe("auto");
    expect(
      declarationsAt(".review-side-panel-drawer", 1259).get("animation"),
    ).toContain("review-drawer-in");
    expect(
      reducedMotionDeclarations(".review-side-panel-drawer").get("animation"),
    ).toBe("none");
    expect(
      reducedMotionDeclarations(".spinning").get("animation"),
    ).toBe("none");
    expect(
      reducedMotionDeclarations(".live-dot.playing").get("animation"),
    ).toBe("none");
    expect(
      declarationsAt(".timeframe-group button:disabled", 1260).get("cursor"),
    ).toBe("not-allowed");
    expect(
      declarationsAt(".icon-button:disabled", 1260).get("opacity"),
    ).toBe("0.35");
    expect(
      declarationsAt(".icon-button:hover:not(:disabled)", 1260).get(
        "background",
      ),
    ).toBe("var(--surface-soft)");
    expect(
      declarationsAt(
        '.episode-notes-status [role="status"]',
        1260,
      ).get("background"),
    ).toBe("rgba(47, 128, 237, 0.1)");
    expect(
      declarationsAt(".market-data-state.stale", 1260).get("color"),
    ).toBe("#e7c76f");
    expect(
      declarationsAt(".replay-error", 1260).get("background"),
    ).toBe("rgba(239, 83, 80, 0.1)");
    expect(
      declarationsAt('[role="button"]:focus-visible', 1260).get("outline"),
    ).toBe("2px solid var(--blue)");

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    expect(
      screen.getByRole("heading", { name: "持仓统计" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector(".review-side-panel-desktop"),
    ).toBeInTheDocument();

    const trigger = screen.getByRole("button", {
      name: "打开复盘面板",
    });
    expect(trigger).toHaveClass("review-side-panel-trigger");
    await user.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "复盘面板" }),
    ).toHaveClass("review-side-panel-drawer");
    expect(
      document.querySelector(".review-side-panel-desktop"),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "复盘面板" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(".review-side-panel-desktop"),
    ).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("contains the toolbar and every chart popover within a 390px viewport", () => {
    expect(
      declarationsAt(".trade-review-app", 390).get("min-width"),
    ).toBe("0");
    expect(
      declarationsAt(".chart-toolbar", 390).get("flex-wrap"),
    ).toBe("wrap");

    const genericPopover = declarationsAt(".chart-popover", 390);
    expect(genericPopover.get("position")).toBe("fixed");
    expect(genericPopover.get("top")).toBe("70px");
    expect(genericPopover.get("right")).toBe("12px");
    expect(genericPopover.get("left")).toBe("12px");
    expect(genericPopover.get("width")).toBe("auto");
    expect(genericPopover.get("max-width")).toBe("none");
    expect(genericPopover.get("max-height")).toBe("calc(100vh - 82px)");
    expect(genericPopover.get("overflow-y")).toBe("auto");

    const searchPopover = declarationsAt(
      [".chart-popover", ".instrument-search-popover"],
      390,
    );
    expect(searchPopover.get("position")).toBe("fixed");
    expect(searchPopover.get("right")).toBe("12px");
    expect(searchPopover.get("left")).toBe("12px");
    expect(searchPopover.get("width")).toBe("auto");
    expect(searchPopover.get("max-width")).toBe("none");
  });

  it("loads imported stocks after a page reload without starting a market request", async () => {
    const imported: TradeExecution = {
      id: "futu:2",
      source: { platform: "futu", row: 2 },
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
      fee: "10",
    };
    saveImportedExecutions([imported]);
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    expect(
      await screen.findByRole("heading", { name: "小米集团-W（1810）" }),
    ).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps demo reachable with imports and restores its saved server frame and UI state", async () => {
    const user = userEvent.setup();
    saveImportedExecutions([
      {
        id: "imported-open",
        source: { platform: "futu", row: 2 },
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
        fee: "0",
      },
    ]);
    saveReviewState("demo-xpev-2025", {
      version: 2,
      episodeId: "demo-xpev-2025",
      replayCursor: nextFrame.cursor,
      timeframe: "1W",
      activePanelTab: "stats",
      drawings: [
        {
          version: 2,
          id: "demo-saved-drawing",
          episodeId: "demo-xpev-2025",
          name: "演示保存趋势",
          tool: "trend-line",
          anchors: [
            { time: initialFrame.cursor, price: 10 },
            { time: nextFrame.cursor, price: 10.4 },
          ],
          style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
          zIndex: 0,
          hidden: false,
          locked: false,
          visibleOn: "all",
          stage: "during-replay",
          createdAtCursor: initialFrame.cursor,
        },
      ],
    });

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByRole("heading", {
      name: "小米集团-W（1810）",
    });
    expect(
      screen.getByRole("button", { name: /小鹏汽车.*演示交易/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "搜索标的" }));
    await user.type(screen.getByRole("searchbox"), "XPEV");
    await user.click(
      screen.getByRole("option", { name: "小鹏汽车 XPEV US" }),
    );

    expect(
      await screen.findByRole("heading", { name: "小鹏汽车（XPEV）" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `cursor=${encodeURIComponent(nextFrame.cursor)}&mode=restore`,
        ),
        { cache: "no-store" },
      ),
    );
    expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
      "data-cursor",
      nextFrame.cursor,
    );
    expect(
      screen.getByRole("button", { name: "切换到 1W" }),
    ).toHaveClass("active");
    await user.click(screen.getByRole("button", { name: "图层" }));
    expect(
      screen.getByDisplayValue("演示保存趋势"),
    ).toBeInTheDocument();
  });

  it("refreshes the selected demo frame from the existing replay backend", async () => {
    const user = userEvent.setup();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.click(
      screen.getByRole("button", { name: "行情数据详情" }),
    );
    await user.click(
      screen.getByRole("button", { name: "刷新行情数据" }),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("mode=restore"),
        { cache: "no-store" },
      ),
    );
    expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
      "data-cursor",
      nextFrame.cursor,
    );
  });

  it("disables demo refresh accessibly while a replay request is active", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );
    await user.click(
      screen.getByRole("button", { name: "行情数据详情" }),
    );

    const refresh = screen.getByRole("button", {
      name: "刷新行情数据",
    });
    expect(refresh).toBeDisabled();
    expect(refresh).toHaveAttribute(
      "title",
      "正在读取演示回放数据",
    );
    expect(refresh).toHaveAccessibleDescription(
      "正在读取演示回放数据",
    );
    await user.click(refresh);
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      ok: true,
      json: async () => nextFrame,
    } as Response);
    await waitFor(() =>
      expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
        "data-cursor",
        nextFrame.cursor,
      ),
    );
  });

  it("uses the containing 15 minute bar for non-aligned closed fills", async () => {
    saveImportedExecutions([
      availabilityExecution({
        id: "non-aligned-open",
        row: 2,
        side: "buy",
        executedAt: "2025-01-02T10:07:00.000Z",
      }),
      availabilityExecution({
        id: "non-aligned-close",
        row: 3,
        side: "sell",
        executedAt: "2025-01-02T10:07:00.000Z",
      }),
    ]);
    await cacheAvailabilityCandles([
      "2025-01-02T10:00:00.000Z",
    ]);

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByText("本地导入");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "切换到 15m" }),
      ).toBeEnabled(),
    );
  });

  it("accepts bounded pre-entry candles as episode chart context", async () => {
    saveImportedExecutions([
      availabilityExecution({
        id: "context-open",
        row: 2,
        side: "buy",
        executedAt: "2025-01-02T10:07:00.000Z",
      }),
      availabilityExecution({
        id: "context-close",
        row: 3,
        side: "sell",
        executedAt: "2025-01-02T10:22:00.000Z",
      }),
    ]);
    await cacheAvailabilityCandles([
      "2025-01-01T10:00:00.000Z",
    ]);

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByText("本地导入");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "切换到 15m" }),
      ).toBeEnabled(),
    );
  });

  it("does not use candles before the bounded pre-entry context", async () => {
    saveImportedExecutions([
      availabilityExecution({
        id: "bounded-open",
        row: 2,
        side: "buy",
        executedAt: "2025-01-02T10:07:00.000Z",
      }),
      availabilityExecution({
        id: "bounded-close",
        row: 3,
        side: "sell",
        executedAt: "2025-01-02T10:22:00.000Z",
      }),
    ]);
    await cacheAvailabilityCandles([
      "2024-12-25T10:00:00.000Z",
    ]);

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByText("本地导入");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "切换到 15m" }),
      ).toBeDisabled(),
    );
  });

  it("extends an open episode through cached data after its latest fill", async () => {
    saveImportedExecutions([
      availabilityExecution({
        id: "open-position",
        row: 2,
        side: "buy",
        executedAt: "2025-01-02T10:07:00.000Z",
      }),
    ]);
    await cacheAvailabilityCandles([
      "2025-01-03T10:00:00.000Z",
    ]);

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByText("本地导入");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "切换到 15m" }),
      ).toBeEnabled(),
    );
  });

  it("bounds intraday refresh to the selected episode and changes bounds after an episode switch", async () => {
    const user = userEvent.setup();
    const executions = [
      availabilityExecution({
        id: "old-open",
        row: 2,
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
      }),
      availabilityExecution({
        id: "old-close",
        row: 3,
        side: "sell",
        executedAt: "2025-01-02T15:00:00.000Z",
      }),
      availabilityExecution({
        id: "new-open",
        row: 4,
        side: "buy",
        executedAt: "2025-01-06T14:30:00.000Z",
      }),
      availabilityExecution({
        id: "new-close",
        row: 5,
        side: "sell",
        executedAt: "2025-01-06T15:00:00.000Z",
      }),
    ];
    saveImportedExecutions(executions);
    const [oldEpisode] = buildTradeEpisodes(executions);
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json(
        { error: { code: "source-unavailable" } },
        { status: 502 },
      ),
    );

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("combobox", { name: "交易回合" });
    await user.click(
      await screen.findByRole("button", { name: "行情数据详情" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "刷新行情数据" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const newestIntraday = new URL(
      String(
        vi.mocked(fetch).mock.calls.find(([input]) =>
          String(input).includes("/api/market-data/intraday"),
        )?.[0],
      ),
      "http://localhost",
    );
    expect(newestIntraday.searchParams.get("start")).toBe(
      "2024-12-30T14:30:00.000Z",
    );
    expect(newestIntraday.searchParams.get("end")).toBe(
      "2025-01-06T15:14:59.999Z",
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "交易回合" }),
      oldEpisode.id,
    );
    vi.mocked(fetch).mockClear();
    await user.click(
      screen.getByRole("button", { name: "行情数据详情" }),
    );
    await user.click(
      screen.getByRole("button", { name: "刷新行情数据" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const oldIntraday = new URL(
      String(
        vi.mocked(fetch).mock.calls.find(([input]) =>
          String(input).includes("/api/market-data/intraday"),
        )?.[0],
      ),
      "http://localhost",
    );
    expect(oldIntraday.searchParams.get("start")).toBe(
      "2024-12-26T14:30:00.000Z",
    );
    expect(oldIntraday.searchParams.get("end")).toBe(
      "2025-01-02T15:14:59.999Z",
    );
  });

  it("uses the unified replay workspace for a cached imported episode", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "HK:1810",
      symbol: "1810",
      name: "小米集团-W",
      market: "HK",
      currency: "HKD",
    };
    const executions: TradeExecution[] = [
      {
        id: "xiaomi-open",
        source: {
          platform: "futu",
          row: 2,
          sourceTimestampText: "开仓成交",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T02:00:00.000Z",
        quantity: "100",
        price: "34.5",
        fee: "0",
      },
      {
        id: "xiaomi-close",
        source: {
          platform: "futu",
          row: 3,
          sourceTimestampText: "平仓成交",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-02T02:45:00.000Z",
        quantity: "100",
        price: "36.5",
        fee: "0",
      },
    ];
    saveImportedExecutions(executions);
    const [episode] = buildTradeEpisodes(executions);
    const repository = new IndexedDbMarketDataRepository();
    await repository.commitSyncResult({
      instrumentId: instrument.id,
      candles: [
        {
          instrumentId: instrument.id,
          tradingDate: "2025-01-02",
          open: "34.5",
          high: "36.8",
          low: "34",
          close: "36.5",
          volume: "10000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          startDate: "2024-01-01",
          endDate: "2025-02-01",
          status: "complete",
          provider: "tencent",
          fetchedAt: "2025-01-03T00:00:00.000Z",
          missingTradingDates: [],
        },
      ],
      providerSymbol: {
        provider: "tencent",
        symbol: "hk01810",
      },
    });
    await repository.commitIntervalSyncResult({
      instrumentId: instrument.id,
      interval: "15m",
      candles: [
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-02T02:00:00.000Z",
          open: "34.5",
          high: "35",
          low: "34",
          close: "34.8",
          volume: "1000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-02T02:15:00.000Z",
          open: "34.8",
          high: "36",
          low: "34.7",
          close: "35.8",
          volume: "1200",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-02T02:30:00.000Z",
          open: "35.8",
          high: "36.2",
          low: "35.5",
          close: "36",
          volume: "900",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-02T02:45:00.000Z",
          open: "36",
          high: "36.8",
          low: "35.9",
          close: "36.5",
          volume: "1500",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-02T00:00:00.000Z",
          requestedEnd: "2025-01-02T23:59:59.999Z",
          actualStart: "2025-01-02T02:00:00.000Z",
          actualEnd: "2025-01-02T02:45:00.000Z",
          status: "complete",
          provider: "tencent",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      providerSymbol: {
        provider: "tencent",
        symbol: "hk01810",
      },
    });
    await new IndexedDbEpisodeReviewRepository().put({
      version: 1,
      episodeId: episode.id,
      instrumentId: instrument.id,
      updatedAt: "2025-01-03T00:00:00.000Z",
      plan: {
        thesis: "未来修订计划",
        expectedPath: "",
        invalidationCondition: "未来失效条件",
        targetRange: "未来目标",
        plannedRiskAmount: "50",
        confidence: 4,
      },
      planRevisions: [
        {
          knowledgeAt: "2025-01-02T02:00:00.000Z",
          plan: {
            thesis: "入场计划",
            expectedPath: "",
            invalidationCondition: "入场失效条件",
            targetRange: "入场目标",
            plannedRiskAmount: "100",
            confidence: 4,
          },
        },
        {
          knowledgeAt: "2025-01-02T02:30:00.000Z",
          plan: {
            thesis: "未来修订计划",
            expectedPath: "",
            invalidationCondition: "未来失效条件",
            targetRange: "未来目标",
            plannedRiskAmount: "50",
            confidence: 4,
          },
        },
      ],
      review: {
        decisionQuality: null,
        executionQuality: null,
        riskManagement: "",
        psychology: "",
        reusableRule: "",
        completed: false,
      },
      confirmedTagIds: [],
    });
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    expect(
      await screen.findByRole("heading", { name: "小米集团-W（1810）" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "切换到 15m" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "趋势线" })).toBeEnabled();
    expect(screen.getByText("最大盈利（MFE）")).toBeInTheDocument();
    expect(screen.getByText("计划风险").parentElement).toHaveTextContent(
      "HK$100.00",
    );
    expect(screen.queryByText("未来失效条件")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "下一根 K 线" }),
    ).toBeEnabled();
    expect(
      screen.queryByLabelText("导入股票成交详情"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("高 36.80")).not.toBeInTheDocument();

    const cursorBefore = screen.getByTestId("replay-cursor").textContent;
    const mfeBefore =
      screen.getByText("最大盈利（MFE）").parentElement?.textContent;
    expect(screen.queryByText("平仓成交")).not.toBeInTheDocument();
    expect(screen.getByText("计划风险").parentElement).toHaveTextContent(
      "HK$100.00",
    );

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );

    expect(screen.getByTestId("replay-cursor").textContent).not.toBe(
      cursorBefore,
    );
    expect(
      screen.getByText("最大盈利（MFE）").parentElement?.textContent,
    ).not.toBe(mfeBefore);
    expect(screen.queryByText("平仓成交")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );
    expect(screen.getByText("计划风险").parentElement).toHaveTextContent(
      "HK$50.00",
    );
    expect(screen.getByText("未来失效条件")).toBeInTheDocument();
    expect(screen.queryByText("平仓成交")).not.toBeInTheDocument();
    expect(screen.queryByText("+HK$200.00")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );
    expect(screen.getByText("平仓成交")).toBeInTheDocument();
    expect(screen.getAllByText("+HK$200.00").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "下一根 K 线" }),
    );
    expect(screen.getByText("高 36.80")).toBeInTheDocument();

    const cursorBeforePeriodChange =
      screen.getByTestId("replay-cursor").textContent;
    await user.click(screen.getByRole("button", { name: "切换到 1h" }));
    expect(screen.getByTestId("replay-cursor").textContent).not.toBe(
      "2025/1/2 10:45",
    );
    expect(screen.getByTestId("replay-cursor").textContent).toBe(
      cursorBeforePeriodChange,
    );
    await user.click(screen.getByRole("button", { name: "搜索标的" }));
    await user.type(screen.getByRole("searchbox"), "1810");
    await user.click(
      screen.getByRole("option", {
        name: "小米集团-W 1810 HK",
      }),
    );
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    expect(
      screen.getByRole("region", { name: "15m 行情详情" }),
    ).toHaveTextContent("腾讯行情");
    expect(
      screen.getByRole("region", { name: "15m 行情详情" }),
    ).toHaveTextContent("15m、1h、4h");
    await user.click(screen.getByRole("button", { name: "图表设置" }));
    await user.click(screen.getByRole("checkbox", { name: "显示成交量" }));
    expect(document.querySelector(".chart-stage")).toHaveAttribute(
      "data-show-volume",
      "false",
    );
    expect(screen.getByRole("button", { name: "图层" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "图层" })).toHaveAttribute(
      "title",
      "当前游标和周期暂无绘图",
    );
    expect(
      screen.getByRole("button", { name: "进入全屏" }),
    ).toHaveAttribute("title", "浏览器不支持全屏");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps notes available and explains provider-limited intraday periods for daily-only data", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "HK:1357",
      symbol: "1357",
      name: "美图公司",
      market: "HK",
      currency: "HKD",
    };
    const execution: TradeExecution = {
      id: "meitu-open",
      source: { platform: "futu", row: 2 },
      accountId: "acct",
      accountLabel: "富途",
      instrument,
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "3",
      fee: "0",
    };
    saveImportedExecutions([execution]);
    const repository = new IndexedDbMarketDataRepository();
    await repository.commitSyncResult({
      instrumentId: instrument.id,
      candles: [
        {
          instrumentId: instrument.id,
          tradingDate: "2025-01-02",
          open: "3",
          high: "3.2",
          low: "2.9",
          close: "3.1",
          volume: "10000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01357",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          startDate: "2024-01-01",
          endDate: "2025-02-01",
          status: "complete",
          provider: "tencent",
          fetchedAt: "2025-01-03T00:00:00.000Z",
          missingTradingDates: [],
        },
      ],
      providerSymbol: { provider: "tencent", symbol: "hk01357" },
    });
    await repository.commitIntervalSyncResult({
      instrumentId: instrument.id,
      interval: "15m",
      candles: [],
      coverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-01T00:00:00.000Z",
          requestedEnd: "2025-01-03T23:59:59.999Z",
          status: "partial",
          reason: "provider-history-limit",
        },
      ],
    });
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "美图公司（1357）" });

    for (const period of ["15m", "1h", "4h"]) {
      const button = screen.getByRole("button", {
        name: `切换到 ${period}`,
      });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute(
        "title",
        "公开行情源未覆盖该交易日期的 15 分钟行情",
      );
    }
    await user.click(screen.getByRole("tab", { name: "复盘笔记" }));
    expect(screen.getByLabelText("买入理由")).toBeEnabled();
    await user.type(screen.getByLabelText("买入理由"), "只有日线也能记录");
    expect(screen.getByLabelText("买入理由")).toHaveValue(
      "只有日线也能记录",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("derives intraday availability from the selected episode window", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    };
    const executions: TradeExecution[] = [
      {
        id: "old-open",
        source: { platform: "futu", row: 2 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "10",
        price: "10",
        fee: "0",
      },
      {
        id: "old-close",
        source: { platform: "futu", row: 3 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-02T15:00:00.000Z",
        quantity: "10",
        price: "11",
        fee: "0",
      },
      {
        id: "new-open",
        source: { platform: "futu", row: 4 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-06T14:30:00.000Z",
        quantity: "10",
        price: "12",
        fee: "0",
      },
      {
        id: "new-close",
        source: { platform: "futu", row: 5 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-06T15:00:00.000Z",
        quantity: "10",
        price: "13",
        fee: "0",
      },
    ];
    saveImportedExecutions(executions);
    const [oldEpisode] = buildTradeEpisodes(executions);
    const repository = new IndexedDbMarketDataRepository();
    await repository.commitSyncResult({
      instrumentId: instrument.id,
      candles: [
        {
          instrumentId: instrument.id,
          tradingDate: "2025-01-02",
          open: "10",
          high: "11",
          low: "9",
          close: "11",
          volume: "1000",
          currency: "USD",
          provider: "yahoo",
          providerSymbol: "XPEV",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        },
        {
          instrumentId: instrument.id,
          tradingDate: "2025-01-06",
          open: "12",
          high: "13",
          low: "11",
          close: "13",
          volume: "1000",
          currency: "USD",
          provider: "yahoo",
          providerSymbol: "XPEV",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          startDate: "2025-01-02",
          endDate: "2025-01-06",
          status: "complete",
          provider: "yahoo",
          fetchedAt: "2025-01-07T00:00:00.000Z",
          missingTradingDates: [],
        },
      ],
      providerSymbol: { provider: "yahoo", symbol: "XPEV" },
    });
    await repository.commitIntervalSyncResult({
      instrumentId: instrument.id,
      interval: "15m",
      candles: [
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-06T14:30:00.000Z",
          open: "12",
          high: "12.5",
          low: "11.8",
          close: "12.4",
          volume: "1000",
          currency: "USD",
          provider: "yahoo",
          providerSymbol: "XPEV",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-06T14:30:00.000Z",
          requestedEnd: "2025-01-06T15:00:00.000Z",
          actualStart: "2025-01-06T14:30:00.000Z",
          actualEnd: "2025-01-06T14:30:00.000Z",
          status: "complete",
          provider: "yahoo",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        },
      ],
      providerSymbol: { provider: "yahoo", symbol: "XPEV" },
    });

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("option", { name: /第 2 次交易/ });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "切换到 15m" }),
      ).toBeEnabled(),
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "交易回合" }),
      oldEpisode.id,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "切换到 15m" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "切换到 15m" }),
    ).toHaveAttribute(
      "title",
      "该交易回合没有可用的 15 分钟行情",
    );
    expect(
      screen.getByRole("button", { name: "切换到 1D" }),
    ).toBeEnabled();
  });

  it.each([
    { label: "after the final cached candle", withCandle: true },
    { label: "without cached candles", withCandle: false },
  ])(
    "reveals the next execution $label without enabling next-candle navigation",
    async ({ withCandle }) => {
      const user = userEvent.setup();
      const instrument = {
        id: "HK:1810",
        symbol: "1810",
        name: "小米集团-W",
        market: "HK",
        currency: "HKD",
      };
      const executions: TradeExecution[] = [
        {
          id: "boundary-open",
          source: {
            platform: "futu",
            row: 2,
            sourceTimestampText: "开仓成交",
            sourceTimezone: "Asia/Shanghai",
          },
          accountId: "acct",
          accountLabel: "富途",
          instrument,
          side: "buy",
          executedAt: "2025-01-02T02:00:00.000Z",
          quantity: "100",
          price: "34.5",
          fee: "0",
        },
        {
          id: "boundary-close",
          source: {
            platform: "futu",
            row: 3,
            sourceTimestampText: "平仓成交",
            sourceTimezone: "Asia/Shanghai",
          },
          accountId: "acct",
          accountLabel: "富途",
          instrument,
          side: "sell",
          executedAt: "2025-01-02T02:45:00.000Z",
          quantity: "100",
          price: "36.5",
          fee: "0",
        },
      ];
      saveImportedExecutions(executions);
      if (withCandle) {
        await new IndexedDbMarketDataRepository()
          .commitIntervalSyncResult({
            instrumentId: instrument.id,
            interval: "15m",
            candles: [
              {
                instrumentId: instrument.id,
                interval: "15m",
                timestamp: "2025-01-02T02:00:00.000Z",
                open: "34.5",
                high: "35",
                low: "34",
                close: "34.8",
                volume: "1000",
                currency: "HKD",
                provider: "tencent",
                providerSymbol: "hk01810",
                adjustmentMode: "raw",
                fetchedAt: "2025-01-03T00:00:00.000Z",
              },
            ],
            coverage: [
              {
                interval: "15m",
                requestedStart: "2025-01-02T02:00:00.000Z",
                requestedEnd: "2025-01-02T02:00:00.000Z",
                actualStart: "2025-01-02T02:00:00.000Z",
                actualEnd: "2025-01-02T02:00:00.000Z",
                status: "complete",
                provider: "tencent",
                fetchedAt: "2025-01-03T00:00:00.000Z",
              },
            ],
            providerSymbol: {
              provider: "tencent",
              symbol: "hk01810",
            },
          });
      }

      render(<TradeReviewWorkspace initialFrame={initialFrame} />);
      await screen.findByRole("heading", {
        name: "小米集团-W（1810）",
      });

      const nextCandle = screen.getByRole("button", {
        name: "下一根 K 线",
      });
      if (withCandle) {
        expect(nextCandle).toBeEnabled();
        await user.click(nextCandle);
      }
      expect(nextCandle).toBeDisabled();
      const nextExecution = screen.getByRole("button", {
        name: "跳至下一笔成交",
      });
      expect(nextExecution).toBeEnabled();

      await user.click(nextExecution);

      expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
        "data-cursor",
        "2025-01-02T02:45:00.000Z",
      );
      expect(screen.getByText("平仓成交")).toBeInTheDocument();
      expect(
        screen.getAllByText("+HK$200.00").length,
      ).toBeGreaterThan(0);
    },
  );

  it("preserves cached intervals and reports each failed refresh independently", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "HK:1810",
      symbol: "1810",
      name: "小米集团-W",
      market: "HK",
      currency: "HKD",
    };
    const execution: TradeExecution = {
      id: "refresh-open",
      source: { platform: "futu", row: 2 },
      accountId: "acct",
      accountLabel: "富途",
      instrument,
      side: "buy",
      executedAt: "2025-01-02T02:00:00.000Z",
      quantity: "100",
      price: "34.5",
      fee: "0",
    };
    saveImportedExecutions([execution]);
    const repository = new IndexedDbMarketDataRepository();
    await repository.commitSyncResult({
      instrumentId: instrument.id,
      candles: [
        {
          instrumentId: instrument.id,
          tradingDate: "2025-01-02",
          open: "34.5",
          high: "35",
          low: "34",
          close: "34.8",
          volume: "1000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          startDate: "2024-01-01",
          endDate: "2025-02-01",
          status: "partial",
          provider: "tencent",
          fetchedAt: "2025-01-03T00:00:00.000Z",
          missingTradingDates: ["2025-01-06"],
        },
      ],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    await repository.commitIntervalSyncResult({
      instrumentId: instrument.id,
      interval: "15m",
      candles: [
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-02T02:00:00.000Z",
          open: "34.5",
          high: "35",
          low: "34",
          close: "34.8",
          volume: "1000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
        {
          instrumentId: instrument.id,
          interval: "15m",
          timestamp: "2025-01-02T02:15:00.000Z",
          open: "34.8",
          high: "35.2",
          low: "34.7",
          close: "35",
          volume: "1000",
          currency: "HKD",
          provider: "tencent",
          providerSymbol: "hk01810",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-02T00:00:00.000Z",
          requestedEnd: "2025-01-02T03:00:00.000Z",
          actualStart: "2025-01-02T02:00:00.000Z",
          actualEnd: "2025-01-02T02:15:00.000Z",
          status: "partial",
          provider: "tencent",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", {
      name: "小米集团-W（1810）",
    });
    const cursor = screen.getByTestId("replay-cursor").textContent;
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(
      screen.getByRole("button", { name: "刷新行情数据" }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "15m 行情详情" }),
      ).toHaveTextContent("15 分钟：offline"),
    );
    expect(
      screen.getByRole("region", { name: "1D 行情详情" }),
    ).toHaveTextContent("日线：offline");
    expect(
      screen.getByRole("button", { name: "切换到 15m" }),
    ).toBeEnabled();
    expect(screen.getByTestId("replay-cursor")).toHaveTextContent(
      cursor ?? "",
    );
  });

  it("reveals an imported provider candle only at its completed-bar knowledge boundary", async () => {
    const user = userEvent.setup();
    const execution = availabilityExecution({
      id: "completed-bar-entry",
      row: 1,
      side: "buy",
      executedAt: "2025-01-02T10:07:00.000Z",
    });
    saveImportedExecutions([execution]);
    const [episode] = buildTradeEpisodes([execution]);
    await new IndexedDbMarketDataRepository().commitIntervalSyncResult({
      instrumentId: availabilityInstrument.id,
      interval: "15m",
      candles: [
        {
          instrumentId: availabilityInstrument.id,
          interval: "15m",
          timestamp: "2025-01-02T10:00:00.000Z",
          knowledgeAt: "2025-01-02T10:15:00.000Z",
          open: "10",
          high: "12",
          low: "9",
          close: "11",
          volume: "1000",
          currency: "USD",
          provider: "yahoo",
          providerSymbol: "XPEV",
          adjustmentMode: "raw",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      coverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-02T10:00:00.000Z",
          requestedEnd: "2025-01-02T10:15:00.000Z",
          actualStart: "2025-01-02T10:00:00.000Z",
          actualEnd: "2025-01-02T10:00:00.000Z",
          status: "complete",
          provider: "yahoo",
          fetchedAt: "2025-01-03T00:00:00.000Z",
        },
      ],
      providerSymbol: { provider: "yahoo", symbol: "XPEV" },
    });
    saveReviewState(episode.id, {
      version: 2,
      episodeId: episode.id,
      replayCursor: execution.executedAt,
      timeframe: "15m",
      activePanelTab: "stats",
      drawings: [],
    });

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小鹏汽车（XPEV）" });

    await waitFor(() =>
      expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
        "data-cursor",
        "2025-01-02T10:07:00.000Z",
      ),
    );
    expect(
      screen.getAllByText(
        "No candle is available at or before the replay cursor.",
      ).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "下一根 K 线" }));

    expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
      "data-cursor",
      "2025-01-02T10:15:00.000Z",
    );
    expect(screen.getAllByText("+US$20.00").length).toBeGreaterThan(0);
  });

  it("restores cursor, drawings, panel tab, and notes independently for each episode", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    };
    const executions: TradeExecution[] = [
      {
        id: "old-open",
        source: { platform: "futu", row: 2 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "10",
        price: "10",
        fee: "0",
      },
      {
        id: "old-close",
        source: { platform: "futu", row: 3 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-02T15:00:00.000Z",
        quantity: "10",
        price: "11",
        fee: "0",
      },
      {
        id: "new-open",
        source: { platform: "futu", row: 4 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-06T14:30:00.000Z",
        quantity: "10",
        price: "12",
        fee: "0",
      },
      {
        id: "new-close",
        source: { platform: "futu", row: 5 },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-06T15:00:00.000Z",
        quantity: "10",
        price: "13",
        fee: "0",
      },
    ];
    saveImportedExecutions(executions);
    const [oldEpisode, newEpisode] = buildTradeEpisodes(executions);
    const repository = new IndexedDbMarketDataRepository();
    const candleTimes = [
      "2025-01-02T14:30:00.000Z",
      "2025-01-02T14:45:00.000Z",
      "2025-01-02T15:00:00.000Z",
      "2025-01-06T14:30:00.000Z",
      "2025-01-06T14:45:00.000Z",
      "2025-01-06T15:00:00.000Z",
    ];
    await repository.commitIntervalSyncResult({
      instrumentId: instrument.id,
      interval: "15m",
      candles: candleTimes.map((timestamp, index) => ({
        instrumentId: instrument.id,
        interval: "15m" as const,
        timestamp,
        open: String(10 + index * 0.5),
        high: String(11 + index * 0.5),
        low: String(9 + index * 0.5),
        close: String(10.5 + index * 0.5),
        volume: "1000",
        currency: "USD",
        provider: "yahoo" as const,
        providerSymbol: "XPEV",
        adjustmentMode: "raw" as const,
        fetchedAt: "2025-01-07T00:00:00.000Z",
      })),
      coverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-02T00:00:00.000Z",
          requestedEnd: "2025-01-06T23:59:59.999Z",
          actualStart: candleTimes[0],
          actualEnd: candleTimes.at(-1),
          status: "complete",
          provider: "yahoo",
          fetchedAt: "2025-01-07T00:00:00.000Z",
        },
      ],
      providerSymbol: { provider: "yahoo", symbol: "XPEV" },
    });
    saveReviewState(oldEpisode.id, {
      version: 2,
      episodeId: oldEpisode.id,
      replayCursor: "2025-01-02T14:45:00.000Z",
      timeframe: "15m",
      activePanelTab: "notes",
      drawings: [
        {
          version: 2,
          id: "old-drawing",
          episodeId: oldEpisode.id,
          name: "旧回合趋势",
          tool: "trend-line",
          anchors: [
            { time: "2025-01-02T14:30:00.000Z", price: 10 },
            { time: "2025-01-02T14:45:00.000Z", price: 11 },
          ],
          style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
          zIndex: 0,
          hidden: false,
          locked: false,
          visibleOn: "all",
          stage: "during-replay",
          createdAtCursor: "2025-01-02T14:45:00.000Z",
        },
      ],
    });
    saveReviewState(newEpisode.id, {
      version: 2,
      episodeId: newEpisode.id,
      replayCursor: "2025-01-06T14:45:00.000Z",
      timeframe: "15m",
      activePanelTab: "stats",
      drawings: [
        {
          version: 2,
          id: "new-drawing",
          episodeId: newEpisode.id,
          name: "新回合趋势",
          tool: "trend-line",
          anchors: [
            { time: "2025-01-06T14:30:00.000Z", price: 12 },
            { time: "2025-01-06T14:45:00.000Z", price: 13 },
          ],
          style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
          zIndex: 0,
          hidden: false,
          locked: false,
          visibleOn: "all",
          stage: "during-replay",
          createdAtCursor: "2025-01-06T14:45:00.000Z",
        },
      ],
    });
    const reviewRepository = new IndexedDbEpisodeReviewRepository();
    await reviewRepository.put({
      ...defaultEpisodeRecord(newEpisode.id, instrument.id),
      plan: {
        ...defaultEpisodeRecord(newEpisode.id, instrument.id).plan,
        thesis: "新回合笔记",
      },
    });
    await reviewRepository.put({
      ...defaultEpisodeRecord(oldEpisode.id, instrument.id),
      plan: {
        ...defaultEpisodeRecord(oldEpisode.id, instrument.id).plan,
        thesis: "旧回合笔记",
      },
    });
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小鹏汽车（XPEV）" });
    await waitFor(() =>
      expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
        "data-cursor",
        "2025-01-06T14:45:00.000Z",
      ),
    );
    await user.click(screen.getByRole("button", { name: "图层" }));
    expect(screen.getByDisplayValue("新回合趋势")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("旧回合趋势")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "复盘笔记" }));
    expect(screen.getByLabelText("买入理由")).toHaveValue("新回合笔记");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "交易回合" }),
      oldEpisode.id,
    );

    expect(screen.getByTestId("replay-cursor")).toHaveAttribute(
      "data-cursor",
      "2025-01-02T14:45:00.000Z",
    );
    expect(screen.getByRole("tab", { name: "复盘笔记" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("买入理由")).toHaveValue("旧回合笔记");
    await user.click(screen.getByRole("button", { name: "图层" }));
    expect(screen.getByDisplayValue("旧回合趋势")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("新回合趋势")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("navigates through stock and episode library levels without requesting market data", async () => {
    const user = userEvent.setup();
    const instrument = {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    };
    const imported: TradeExecution[] = [
      {
        id: "old-buy",
        source: {
          platform: "futu",
          row: 2,
          sourceTimestampText: "旧回合买入",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "100",
        price: "10",
        fee: "1",
      },
      {
        id: "old-sell",
        source: {
          platform: "futu",
          row: 3,
          sourceTimestampText: "旧回合卖出",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "sell",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "100",
        price: "12",
        fee: "1",
      },
      {
        id: "new-buy",
        source: {
          platform: "futu",
          row: 4,
          sourceTimestampText: "新回合买入",
        },
        accountId: "acct",
        accountLabel: "富途",
        instrument,
        side: "buy",
        executedAt: "2025-01-05T14:30:00.000Z",
        quantity: "100",
        price: "11",
        fee: "1",
      },
    ];
    saveImportedExecutions(imported);
    vi.mocked(fetch).mockClear();
    render(<TradeReviewWorkspace initialFrame={initialFrame} />);

    await screen.findByRole("heading", {
      name: "小鹏汽车（XPEV）",
    });
    await user.click(screen.getByRole("button", { name: "交易库" }));

    expect(
      await screen.findByRole("heading", { name: "股票交易库" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );
    expect(
      screen.getByRole("button", { name: /第 2 次交易/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("新回合买入")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "进入逐笔复盘" }),
    );
    expect(
      screen.getByRole("heading", { name: "小鹏汽车（XPEV）" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hydrates cached candles for library stocks that are not selected in replay", async () => {
    const user = userEvent.setup();
    const executions: TradeExecution[] = [
      {
        id: "xiaomi-buy",
        source: { platform: "futu", row: 2 },
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
        fee: "1",
      },
      {
        id: "xpev-buy",
        source: { platform: "futu", row: 3 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "US:XPEV",
          symbol: "XPEV",
          name: "小鹏汽车",
          market: "US",
          currency: "USD",
        },
        side: "buy",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "10",
        price: "10",
        fee: "1",
      },
    ];
    saveImportedExecutions(executions);
    const repository = new IndexedDbMarketDataRepository();
    for (const item of [
      {
        instrumentId: "HK:1810",
        tradingDate: "2025-01-03",
        currency: "HKD",
        close: "35",
      },
      {
        instrumentId: "US:XPEV",
        tradingDate: "2025-01-06",
        currency: "USD",
        close: "11",
      },
    ]) {
      await repository.commitSyncResult({
        instrumentId: item.instrumentId,
        candles: [
          {
            ...item,
            open: item.close,
            high: item.close,
            low: item.close,
            volume: "1000",
            provider: "tencent",
            providerSymbol: item.instrumentId,
            adjustmentMode: "raw",
            fetchedAt: "2025-01-07T00:00:00Z",
          },
        ],
        coverage: [
          {
            startDate: "2024-01-01",
            endDate: "2025-02-01",
            status: "complete",
            provider: "tencent",
            fetchedAt: "2025-01-07T00:00:00Z",
            missingTradingDates: [],
          },
        ],
        providerSymbol: {
          provider: "tencent",
          symbol: item.instrumentId,
        },
      });
    }
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小米集团-W（1810）" });
    await user.click(screen.getByRole("button", { name: "交易库" }));
    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );

    expect(
      await screen.findByText("日线 · 本地缓存 · 买卖点"),
    ).toBeInTheDocument();
    expect(screen.queryByText("本地尚无行情")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hydrates and updates the review record for the exact position episode", async () => {
    const user = userEvent.setup();
    const executions: TradeExecution[] = [
      {
        id: "xpev-review-buy",
        source: { platform: "futu", row: 2 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "US:XPEV",
          symbol: "XPEV",
          name: "小鹏汽车",
          market: "US",
          currency: "USD",
        },
        side: "buy",
        executedAt: "2025-01-02T14:30:00.000Z",
        quantity: "100",
        price: "10",
        fee: "0",
      },
      {
        id: "xpev-review-sell",
        source: { platform: "futu", row: 3 },
        accountId: "acct",
        accountLabel: "富途",
        instrument: {
          id: "US:XPEV",
          symbol: "XPEV",
          name: "小鹏汽车",
          market: "US",
          currency: "USD",
        },
        side: "sell",
        executedAt: "2025-01-03T14:30:00.000Z",
        quantity: "100",
        price: "12",
        fee: "0",
      },
    ];
    saveImportedExecutions(executions);
    const [episode] = buildTradeEpisodes(executions);
    const record: EpisodeReviewRecord = {
      version: 1,
      episodeId: episode.id,
      instrumentId: "US:XPEV",
      updatedAt: "2025-01-04T00:00:00.000Z",
      plan: {
        thesis: "等待突破",
        expectedPath: "",
        invalidationCondition: "",
        targetRange: "",
        plannedRiskAmount: "100",
        confidence: 4,
      },
      review: {
        decisionQuality: 4,
        executionQuality: 4,
        riskManagement: "",
        psychology: "",
        reusableRule: "",
        completed: true,
      },
      confirmedTagIds: ["breakout"],
    };
    const reviews = new IndexedDbEpisodeReviewRepository();
    await reviews.put(record);
    vi.mocked(fetch).mockClear();

    render(<TradeReviewWorkspace initialFrame={initialFrame} />);
    await screen.findByRole("heading", { name: "小鹏汽车（XPEV）" });
    await user.click(screen.getByRole("button", { name: "交易库" }));
    await user.click(
      await screen.findByRole("button", {
        name: "打开小鹏汽车交易回合",
      }),
    );

    expect(await screen.findByLabelText("买入理由")).toHaveValue(
      "等待突破",
    );
    expect(screen.getAllByText("已复盘").length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("买入理由"));
    await user.type(screen.getByLabelText("买入理由"), "等待回踩");
    await user.click(
      screen.getByRole("button", { name: "保存当前回合复盘" }),
    );

    expect(await screen.findByText("已保存在本机")).toBeInTheDocument();
    expect((await reviews.get(episode.id))?.plan.thesis).toBe("等待回踩");
    expect(fetch).not.toHaveBeenCalled();
  });
});
