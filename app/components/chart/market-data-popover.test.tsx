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
        details={[
          {
            providerLabel: "腾讯行情",
            nativeInterval: "15m",
            coverageStart: "2025-01-02",
            coverageEnd: "2025-01-31",
            fetchedAt: "2025-02-01 09:30",
            status: "partial",
            limitationReason: "公开行情源未覆盖更早日期",
          },
        ]}
      />,
    );

    expect(screen.getByText("腾讯行情")).toBeVisible();
    expect(screen.getByText("2025-01-02 至 2025-01-31")).toBeVisible();
    expect(screen.getByText("2025-02-01 09:30")).toBeVisible();
    expect(screen.getByText("公开行情源未覆盖更早日期")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("explains that no request has been made when coverage is absent", () => {
    render(
      <MarketDataPopover
        open
        onClose={vi.fn()}
        details={[
          {
            providerLabel: null,
            nativeInterval: "1D",
            status: "not-requested",
          },
        ]}
      />,
    );

    expect(screen.getByText("尚未请求行情，暂无实际覆盖区间")).toBeVisible();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
