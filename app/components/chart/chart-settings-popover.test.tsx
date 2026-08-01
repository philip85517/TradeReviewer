import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChartSettings } from "../../lib/storage/chart-settings";
import { ChartSettingsPopover } from "./chart-settings-popover";

afterEach(cleanup);

const settings: ChartSettings = {
  version: 1,
  showGrid: true,
  showVolume: true,
  showExecutions: true,
  showAverageCost: true,
  colorScheme: "teal-red",
};

describe("ChartSettingsPopover", () => {
  it("emits a complete settings value when volume is toggled", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(
      <ChartSettingsPopover
        open
        settings={settings}
        onClose={vi.fn()}
        onSettingsChange={onSettingsChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "显示成交量" }));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ showVolume: false }),
    );
    expect(onSettingsChange).toHaveBeenCalledWith({ ...settings, showVolume: false });
  });
});
