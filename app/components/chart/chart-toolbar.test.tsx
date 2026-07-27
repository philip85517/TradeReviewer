import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartToolbar } from "./chart-toolbar";

afterEach(cleanup);

describe("ChartToolbar", () => {
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
});
