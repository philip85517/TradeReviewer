import { beforeEach, describe, expect, it } from "vitest";

import {
  loadChartSettings,
  saveChartSettings,
} from "./chart-settings";

describe("chart settings storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns the default version-1 chart settings when none are stored", () => {
    expect(loadChartSettings()).toEqual({
      version: 1,
      showGrid: true,
      showVolume: true,
      showExecutions: true,
      showAverageCost: true,
      colorScheme: "teal-red",
    });
  });

  it("round-trips valid persisted settings", () => {
    saveChartSettings({
      version: 1,
      showGrid: false,
      showVolume: false,
      showExecutions: true,
      showAverageCost: false,
      colorScheme: "blue-orange",
    });

    expect(loadChartSettings()).toMatchObject({
      showGrid: false,
      showVolume: false,
      showAverageCost: false,
      colorScheme: "blue-orange",
    });
  });
});
