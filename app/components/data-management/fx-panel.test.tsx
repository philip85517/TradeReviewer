import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FxPanel } from "./fx-panel";

afterEach(cleanup);

const completeState = {
  id: "boc:2026-09-19T03:00:00.000Z",
  baseCurrency: "CNY" as const,
  source: "BOC" as const,
  publishedAt: "2026-09-19T10:30:00+08:00",
  publishedAtByCurrency: {
    USD: "2026-09-19T10:30:00+08:00",
    HKD: "2026-09-19T09:20:00+08:00",
  },
  fetchedAt: "2026-09-19T03:00:00.000Z",
  rates: { USD: "6.7521", HKD: "0.8606" },
  lastAttemptDay: "2026-09-19",
  status: "complete" as const,
  error: null,
};

describe("FxPanel", () => {
  it("shows source, per-currency values, source times, and a manual refresh action", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<FxPanel state={completeState} loading={false} refreshing={false} error={null} onRefresh={onRefresh} />);

    expect(screen.getByText(/中国银行/)).toBeVisible();
    expect(screen.getByText(/中行折算价/)).toBeVisible();
    expect(screen.getByText("USD/CNY")).toBeVisible();
    expect(screen.getByText("6.7521")).toBeVisible();
    expect(screen.getByText("HKD/CNY")).toBeVisible();
    expect(screen.getByText("0.8606")).toBeVisible();
    expect(screen.getAllByText(/源发布时间/)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "刷新汇率" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("explains a partial or stale snapshot and preserves an original-currency warning", () => {
    render(<FxPanel state={{ ...completeState, status: "partial", rates: { USD: "6.7521" }, error: "缺少港币汇率" }} loading={false} refreshing={false} error={null} onRefresh={vi.fn()} />);

    expect(screen.getByText("缺少港币汇率")).toBeVisible();
    expect(screen.getByText(/未能完整汇总/)).toBeVisible();
  });

  it("labels a failed refresh that is still using the last successful date", () => {
    render(<FxPanel state={{ ...completeState, error: "更新失败：汇率源响应 502" }} loading={false} refreshing={false} error={null} onRefresh={vi.fn()} />);

    expect(screen.getByText(/本次更新失败，沿用/)).toBeVisible();
    expect(screen.getByText("更新失败：汇率源响应 502")).toBeVisible();
  });

  it("keeps the refresh action disabled while loading", () => {
    render(<FxPanel state={null} loading={true} refreshing={false} error={null} onRefresh={vi.fn()} />);

    expect(screen.getByText("正在读取汇率…")).toBeVisible();
    expect(screen.getByRole("button", { name: "刷新汇率" })).toBeDisabled();
  });
});
