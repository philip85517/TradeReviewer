import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_GLOBAL_MARKET_REFRESH,
  GlobalMarketRefresh,
} from "./global-market-refresh";

afterEach(cleanup);

describe("GlobalMarketRefresh", () => {
  it("exposes one update action with the snapshot scope in every idle view", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();

    render(
      <GlobalMarketRefresh
        instrumentCount={4}
        state={EMPTY_GLOBAL_MARKET_REFRESH}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByRole("button", { name: "更新全部数据" })).toBeEnabled();
    expect(screen.getByText("全部已导入 · 4 只")).toBeVisible();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更新全部数据" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("keeps the action disabled while showing progress and allows cancellation", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <GlobalMarketRefresh
        instrumentCount={5}
        state={{
          ...EMPTY_GLOBAL_MARKET_REFRESH,
          running: true,
          total: 5,
          completed: 2,
          processed: 2,
          active: 2,
          current: "腾讯控股",
        }}
        onRefresh={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "正在更新全部行情" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByText(/正在更新：腾讯控股/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "取消全部行情更新" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("offers retry only for failed items and reports cancelled work and new imports", async () => {
    const onRetryFailed = vi.fn();
    const user = userEvent.setup();

    render(
      <GlobalMarketRefresh
        instrumentCount={6}
        state={{
          ...EMPTY_GLOBAL_MARKET_REFRESH,
          total: 5,
          completed: 2,
          processed: 5,
          failed: 1,
          cancelled: 2,
          newlyImported: 1,
        }}
        onRefresh={vi.fn()}
        onRetryFailed={onRetryFailed}
      />,
    );

    expect(screen.getByText(/已取消/)).toBeVisible();
    expect(screen.getByText(/成功 2\/5；已处理 5\/5/)).toBeVisible();
    expect(screen.getByText(/新增 1 只股票/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重试失败的行情更新" }));
    expect(onRetryFailed).toHaveBeenCalledOnce();
  });

  it("keeps the result categories mutually exclusive when partial items are retryable", () => {
    render(
      <GlobalMarketRefresh
        instrumentCount={236}
        state={{
          ...EMPTY_GLOBAL_MARKET_REFRESH,
          total: 236,
          completed: 81,
          processed: 236,
          partial: 151,
          failed: 155,
        }}
        onRefresh={vi.fn()}
        onRetryFailed={vi.fn()}
      />,
    );

    // A partial result can be retryable, but it must remain in the usable
    // category. The failed category is the remaining four instruments; the
    // retry count is an independent action count and may overlap partial.
    expect(screen.getByText("更新完成 81 个标的")).toBeVisible();
    expect(screen.getByText("部分可用 151 个标的")).toBeVisible();
    expect(screen.getByText("更新失败 4 个标的")).toBeVisible();
    expect(screen.getByText("待重试 155 个标的")).toBeVisible();
  });

  it("keeps unfinished items separate and exposes explicit recovery", async () => {
    const onRecoverUnfinished = vi.fn();
    const user = userEvent.setup();
    render(
      <GlobalMarketRefresh
        instrumentCount={3}
        state={{
          ...EMPTY_GLOBAL_MARKET_REFRESH,
          total: 3,
          processed: 1,
          completed: 1,
          partial: 0,
          failed: 0,
          unfinishedInstrumentIds: ["US:PENDING1", "US:PENDING2"],
          unfinishedDetails: [
            {
              instrumentId: "US:PENDING1",
              symbol: "PENDING1",
              market: "US",
              requestedAt: "2026-09-15T00:00:00.000Z",
              status: "syncing",
              reason: "上次未结束，可重新尝试",
            },
            {
              instrumentId: "US:PENDING2",
              symbol: "PENDING2",
              market: "US",
              requestedAt: "",
              status: "not-requested",
              reason: "尚未记录行情更新任务",
            },
          ],
        }}
        onRefresh={vi.fn()}
        onRecoverUnfinished={onRecoverUnfinished}
      />,
    );

    expect(screen.getByText("未完成 2 个标的")).toBeVisible();
    const unfinishedSummary = screen.getByText("查看未完成明细（2 个标的）");
    expect(unfinishedSummary.parentElement).not.toHaveAttribute("open");
    await user.click(unfinishedSummary);
    expect(unfinishedSummary.parentElement).toHaveAttribute("open");
    expect(screen.getByText("PENDING1")).toBeVisible();
    expect(screen.getAllByText("上次未结束，可重新尝试")[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: "恢复未完成行情" }));
    expect(onRecoverUnfinished).toHaveBeenCalledOnce();
  });
});
