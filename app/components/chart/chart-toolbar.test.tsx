import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartToolbar } from "./chart-toolbar";

afterEach(cleanup);

describe("ChartToolbar", () => {
  it("opens the instrument search from its labelled toolbar control", async () => {
    const user = userEvent.setup();

    render(<ChartToolbar timeframe="1D" onTimeframeChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "搜索标的" }));

    expect(screen.getByRole("searchbox", { name: "搜索标的" })).toBeVisible();
  });

  it("disables intraday periods when an imported stock only has daily data", () => {
    render(
      <ChartToolbar
        timeframe="1D"
        onTimeframeChange={vi.fn()}
        supportedTimeframes={["1D", "1W"]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "切换到 15m" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "切换到 1D" }),
    ).toBeEnabled();
  });

  it("selects local instruments and returns focus after closing the search", async () => {
    const user = userEvent.setup();
    const onSelectInstrument = vi.fn();
    render(
      <ChartToolbar
        timeframe="1D"
        onTimeframeChange={vi.fn()}
        instruments={[{ id: "HK:1357", name: "美图公司", symbol: "1357", market: "HK" }]}
        onSelectInstrument={onSelectInstrument}
      />,
    );

    const trigger = screen.getByRole("button", { name: "搜索标的" });
    await user.click(trigger);
    await user.type(screen.getByRole("searchbox"), "1357");
    await user.click(screen.getByRole("option", { name: "美图公司 1357 HK" }));

    expect(onSelectInstrument).toHaveBeenCalledWith("HK:1357");
    expect(trigger).toHaveFocus();
  });

  it("uses availability reasons for disabled periods and exposes toolbar state", async () => {
    const user = userEvent.setup();
    const onToggleLayers = vi.fn();
    const onFullscreen = vi.fn().mockResolvedValue(undefined);
    render(
      <ChartToolbar
        timeframe="1D"
        onTimeframeChange={vi.fn()}
        timeframeAvailability={{
          "15m": { enabled: false, reason: "尚未获取 15 分钟行情" },
          "1h": { enabled: false, reason: "尚未获取 15 分钟行情" },
          "4h": { enabled: false, reason: "尚未获取 15 分钟行情" },
          "1D": { enabled: true },
          "1W": { enabled: true },
        }}
        layersOpen
        onToggleLayers={onToggleLayers}
        fullscreen={{ supported: true, isFullscreen: false, toggleFullscreen: onFullscreen }}
      />,
    );

    const period = screen.getByRole("button", { name: "切换到 15m" });
    expect(period).toHaveAttribute("title", "尚未获取 15 分钟行情");
    expect(period).toHaveAttribute("aria-description", "尚未获取 15 分钟行情");
    expect(screen.getByRole("button", { name: "图层" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "图层" }));
    await user.click(screen.getByRole("button", { name: "全屏" }));
    expect(onToggleLayers).toHaveBeenCalledTimes(1);
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  it("updates the expanded state when a popover trigger is clicked again", async () => {
    const user = userEvent.setup();
    render(<ChartToolbar timeframe="1D" onTimeframeChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "搜索标的" });
    await user.click(trigger);
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
