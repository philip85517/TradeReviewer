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

  it("updates displayed source timestamps when a newer snapshot is rendered", () => {
    const view = render(<FxPanel state={completeState} loading={false} refreshing={false} error={null} onRefresh={vi.fn()} />);

    expect(screen.getByText("最近源数据：2026/09/19 10:30")).toBeVisible();
    expect(screen.getByText("源发布时间：2026/09/19 10:30")).toBeVisible();

    view.rerender(
      <FxPanel
        state={{
          ...completeState,
          publishedAt: "2026-09-20T08:15:00+08:00",
          publishedAtByCurrency: {
            USD: "2026-09-20T08:15:00+08:00",
            HKD: "2026-09-20T07:05:00+08:00",
          },
          fetchedAt: "2026-09-20T00:15:00.000Z",
        }}
        loading={false}
        refreshing={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("最近源数据：2026/09/20 08:15")).toBeVisible();
    expect(screen.queryByText("最近源数据：2026/09/19 10:30")).not.toBeInTheDocument();
    expect(screen.getByText("源发布时间：2026/09/20 08:15")).toBeVisible();
  });

  it("keeps invalid timestamp text and omits missing timestamps", () => {
    render(
      <FxPanel
        state={{
          ...completeState,
          publishedAt: "源日期待人工核对",
          publishedAtByCurrency: { USD: "源时间未知" },
        }}
        loading={false}
        refreshing={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("源日期原文（待核对）：源日期待人工核对")).toBeVisible();
    expect(screen.getByText("源日期原文（待核对）：源时间未知")).toBeVisible();
    expect(screen.queryByText(/源发布时间/)).not.toBeInTheDocument();
  });

  it("marks an invalid per-currency publication as raw source date pending verification", () => {
    const invalidPublication = "provider-publication:unparsed";

    render(
      <FxPanel
        state={{
          ...completeState,
          publishedAtByCurrency: {
            USD: invalidPublication,
            HKD: "2026-09-19T09:20:00+08:00",
          },
        }}
        loading={false}
        refreshing={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText(`源日期原文（待核对）：${invalidPublication}`),
    ).toBeVisible();
    expect(
      screen.queryByText(`源发布时间：${invalidPublication}`),
    ).not.toBeInTheDocument();
    expect(screen.getByText("源发布时间：2026/09/19 09:20")).toBeVisible();
  });

  it("labels fetched-only state as publication date unavailable and keeps fetch time separate", () => {
    render(
      <FxPanel
        state={{
          ...completeState,
          publishedAt: null,
          publishedAtByCurrency: {},
          fetchedAt: "2026-09-19T03:00:00.000Z",
        }}
        loading={false}
        refreshing={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/发布日期未提供/).length).toBeGreaterThan(0);
    expect(screen.getByText("最近获取：2026/09/19 11:00")).toBeVisible();
    expect(screen.queryByText(/源发布时间/)).not.toBeInTheDocument();
  });

  it("keeps the refresh action disabled while loading", () => {
    render(<FxPanel state={null} loading={true} refreshing={false} error={null} onRefresh={vi.fn()} />);

    expect(screen.getByText("正在读取汇率…")).toBeVisible();
    expect(screen.getByRole("button", { name: "刷新汇率" })).toBeDisabled();
  });
});
