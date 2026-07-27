import "fake-indexeddb/auto";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import { saveImportedExecutions } from "../lib/storage/import-library";
import type { TradeExecution } from "../lib/trades/types";
import { TradeReviewWorkspace } from "./trade-review-workspace";

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
});
