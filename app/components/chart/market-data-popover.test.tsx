import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketDataPopover } from "./market-data-popover";

afterEach(cleanup);

describe("MarketDataPopover", () => {
  it("shows actual coverage, source, fetch time, limitation reason, and refreshes", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <MarketDataPopover
        open
        onClose={vi.fn()}
        onRefresh={onRefresh}
        refreshDisabledReason={undefined}
        details={[
          {
            providerLabel: "腾讯行情",
            nativeInterval: "15m",
            coverageStart: "2025-01-02",
            coverageEnd: "2025-01-31",
            fetchedAt: "2025-02-01T01:30:00.000Z",
            status: "partial",
            limitationReason: "公开行情源未覆盖更早日期",
            availableTimeframes: ["15m", "1h", "4h"],
          },
        ]}
      />,
    );

    expect(screen.getByText("腾讯行情")).toBeVisible();
    expect(screen.getByText("2025-01-02 至 2025-01-31")).toBeVisible();
    expect(screen.getByText("2025年02月01日 09:30:00")).toBeVisible();
    expect(screen.getByText("公开行情源未覆盖更早日期")).toBeVisible();
    expect(screen.getByText("15m、1h、4h")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("explains that no request has been made when coverage is absent", () => {
    render(
      <MarketDataPopover
        open
        onClose={vi.fn()}
        refreshDisabledReason={undefined}
        details={[
          {
            providerLabel: null,
            nativeInterval: "1D",
            status: "not-requested",
            availableTimeframes: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("尚未请求行情，暂无实际覆盖区间")).toBeVisible();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });

  it.each([
    ["partial", "请求已完成，但没有可用的实际覆盖区间"],
    ["complete", "请求已完成，但没有可用的行情数据"],
    ["syncing", "正在请求行情，暂无实际覆盖区间"],
    ["source-unavailable", "行情请求未能完成，暂无实际覆盖区间"],
  ] as const)("uses honest no-coverage copy for %s data", (status, coverage) => {
    render(
      <MarketDataPopover
        open
        onClose={vi.fn()}
        refreshDisabledReason={undefined}
        details={[{
          providerLabel: "腾讯行情",
          nativeInterval: "15m",
          status,
          limitationReason: "公开行情源未覆盖该日期",
          availableTimeframes: [],
        }]}
      />,
    );

    expect(screen.getByText(coverage)).toBeVisible();
    expect(screen.getByText("公开行情源未覆盖该日期")).toBeVisible();
    expect(screen.queryByText("尚未请求行情，暂无实际覆盖区间")).not.toBeInTheDocument();
  });
});
