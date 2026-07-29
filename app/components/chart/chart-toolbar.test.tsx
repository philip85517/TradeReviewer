import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartToolbar } from "./chart-toolbar";

afterEach(cleanup);

function controlledProps() {
  return {
    timeframe: "1D" as const,
    timeframeAvailability: {
      "15m": { enabled: true },
      "1h": { enabled: true },
      "4h": { enabled: true },
      "1D": { enabled: true },
      "1W": { enabled: true },
    },
    onTimeframeChange: vi.fn(),
    instruments: [],
    onSelectInstrument: vi.fn(),
    dataDetails: [],
    onRefreshMarketData: undefined,
    layersOpen: false,
    layersDisabledReason: undefined,
    onToggleLayers: vi.fn(),
    fullscreen: {
      supported: false,
      isFullscreen: false,
      error: null,
      toggleFullscreen: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
      version: 1 as const,
      showGrid: true,
      showVolume: true,
      showExecutions: true,
      showAverageCost: true,
      colorScheme: "teal-red" as const,
    },
    onSettingsChange: vi.fn(),
    symbol: "XPEV",
    instrumentName: "小鹏汽车",
    market: "US",
  };
}

describe("ChartToolbar", () => {
  it("opens the instrument search from its labelled toolbar control", async () => {
    const user = userEvent.setup();

    render(<ChartToolbar {...controlledProps()} />);

    await user.click(screen.getByRole("button", { name: "搜索标的" }));

    expect(screen.getByRole("searchbox", { name: "搜索标的" })).toBeVisible();
  });

  it("disables intraday periods when an imported stock only has daily data", () => {
    render(
      <ChartToolbar
        {...controlledProps()}
        timeframeAvailability={{
          "15m": { enabled: false, reason: "只有日线" },
          "1h": { enabled: false, reason: "只有日线" },
          "4h": { enabled: false, reason: "只有日线" },
          "1D": { enabled: true },
          "1W": { enabled: true },
        }}
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
        {...controlledProps()}
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
        {...controlledProps()}
        timeframeAvailability={{
          "15m": { enabled: false, reason: "尚未获取 15 分钟行情" },
          "1h": { enabled: false, reason: "尚未获取 15 分钟行情" },
          "4h": { enabled: false, reason: "尚未获取 15 分钟行情" },
          "1D": { enabled: true },
          "1W": { enabled: true },
        }}
        layersOpen
        onToggleLayers={onToggleLayers}
        fullscreen={{ supported: true, isFullscreen: false, error: null, toggleFullscreen: onFullscreen }}
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
    render(<ChartToolbar {...controlledProps()} />);

    const trigger = screen.getByRole("button", { name: "搜索标的" });
    await user.click(trigger);
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("explains unsupported fullscreen and exposes a recovered fullscreen error", () => {
    render(
      <ChartToolbar
        {...controlledProps()}
        fullscreen={{ supported: true, isFullscreen: false, error: "无法进入全屏", toggleFullscreen: vi.fn() }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("无法进入全屏");

    cleanup();
    render(<ChartToolbar {...controlledProps()} />);
    const fullscreen = screen.getByRole("button", { name: "全屏" });
    expect(fullscreen).toBeDisabled();
    expect(fullscreen).toHaveAttribute("title", "浏览器不支持全屏");
    expect(fullscreen).toHaveAttribute("aria-description", "浏览器不支持全屏");
  });

  it("catches an injected fullscreen toggle rejection and announces it", async () => {
    const user = userEvent.setup();
    render(
      <ChartToolbar
        {...controlledProps()}
        fullscreen={{
          supported: true,
          isFullscreen: false,
          error: null,
          toggleFullscreen: vi.fn().mockRejectedValue(new Error("denied")),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "全屏" }));

    expect(screen.getByRole("status")).toHaveTextContent("无法切换全屏");
  });
});
