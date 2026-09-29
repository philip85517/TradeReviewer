import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultRoomScope } from "./trading-room-scope";
import {
  applyDashboardBrowsePreferences,
  DASHBOARD_BROWSE_PREFERENCES_STORAGE_KEY,
  parseDashboardBrowsePreferences,
  readDashboardBrowsePreferences,
  saveDashboardBrowsePreferences,
} from "./dashboard-browse-preferences";

const today = "2026-10-15";

function preferences(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    assetCategory: "all",
    assetType: "stock",
    query: "600000",
    instrumentIds: ["CN-SH:600000"],
    markets: ["CN-SH"],
    currencies: ["CNY"],
    reviewStatuses: ["pending"],
    period: { preset: "custom", startDate: "2026-04-01", endDate: "2026-04-30" },
    ...overrides,
  };
}

describe("dashboard browse preferences", () => {
  beforeEach(() => localStorage.removeItem(DASHBOARD_BROWSE_PREFERENCES_STORAGE_KEY));
  afterEach(() => vi.restoreAllMocks());

  it("round-trips only applied page-local filters and a custom statistics period", () => {
    const scope = {
      ...createDefaultRoomScope(today),
      nature: "simulation" as const,
      accountIds: ["canonical-account"],
      simulationRunId: "source-run",
      assetType: "stock" as const,
      query: "600000",
      instrumentIds: ["CN-SH:600000"],
      markets: ["CN-SH"],
      currencies: ["CNY"],
      reviewStatuses: ["pending" as const],
      period: { preset: "custom" as const, startDate: "2026-04-01", endDate: "2026-04-30" },
    };
    saveDashboardBrowsePreferences(scope, today);

    const serialized = localStorage.getItem(DASHBOARD_BROWSE_PREFERENCES_STORAGE_KEY)!;
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed).toEqual(preferences());
    expect(parsed).not.toHaveProperty("nature");
    expect(parsed).not.toHaveProperty("accountIds");
    expect(parsed).not.toHaveProperty("simulationRunId");
    expect(parsed).not.toHaveProperty("reportCurrency");
  });

  it("reinterprets date presets against today and records all as a derived-history marker", () => {
    const ytd = parseDashboardBrowsePreferences(JSON.stringify(preferences({ period: { preset: "ytd" } })), today)!;
    const base = createDefaultRoomScope("2025-12-31");
    expect(applyDashboardBrowsePreferences(base, ytd, today).period).toEqual({ preset: "ytd", startDate: "2026-01-01", endDate: today });

    const all = parseDashboardBrowsePreferences(JSON.stringify(preferences({ period: { preset: "all" } })), today)!;
    expect(applyDashboardBrowsePreferences(base, all, today).period).toEqual({ preset: "all", startDate: "1900-01-01", endDate: today });
  });

  it("rejects unknown versions, invalid enums, impossible or reversed dates, and future custom ranges", () => {
    const invalidValues = [
      preferences({ version: 2 }),
      preferences({ assetCategory: "crypto" }),
      preferences({ assetType: "bond" }),
      preferences({ reviewStatuses: ["pending", "unknown"] }),
      preferences({ period: { preset: "custom", startDate: "2026-02-30", endDate: "2026-03-01" } }),
      preferences({ period: { preset: "custom", startDate: "2026-05-01", endDate: "2026-04-30" } }),
      preferences({ period: { preset: "custom", startDate: "2026-10-01", endDate: "2026-10-16" } }),
    ];
    for (const value of invalidValues) expect(parseDashboardBrowsePreferences(JSON.stringify(value), today)).toBeNull();
    expect(parseDashboardBrowsePreferences("{bad json", today)).toBeNull();
    expect(parseDashboardBrowsePreferences(null, today)).toBeNull();
  });

  it("keeps the shared business scope while applying validated page-local preferences", () => {
    const base = {
      ...createDefaultRoomScope(today),
      nature: "simulation" as const,
      accountIds: ["canonical-account"],
      simulationRunId: null,
    };
    const parsed = parseDashboardBrowsePreferences(JSON.stringify(preferences()), today)!;
    const next = applyDashboardBrowsePreferences(base, parsed, today);
    expect(next).toMatchObject({
      nature: "simulation",
      accountIds: ["canonical-account"],
      simulationRunId: null,
      assetType: "stock",
      query: "600000",
      period: { preset: "custom", startDate: "2026-04-01", endDate: "2026-04-30" },
    });
  });

  it("does not throw when the storage getter or read/write methods fail", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    try {
      Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("storage unavailable"); } });
      expect(readDashboardBrowsePreferences(today)).toEqual({ available: false, preferences: null });
      expect(() => saveDashboardBrowsePreferences(createDefaultRoomScope(today), today)).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => { throw new Error("read denied"); });
    expect(readDashboardBrowsePreferences(today)).toEqual({ available: false, preferences: null });
    vi.restoreAllMocks();
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("write denied"); });
    expect(() => saveDashboardBrowsePreferences(createDefaultRoomScope(today), today)).not.toThrow();
  });
});
