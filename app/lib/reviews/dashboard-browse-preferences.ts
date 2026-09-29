import {
  buildRoomDateRange,
  type RoomAssetCategory,
  type RoomAssetTypeFilter,
  type RoomDateRange,
  type RoomPeriodPreset,
  type RoomReviewStatus,
  type RoomScope,
} from "./trading-room-scope";

export const DASHBOARD_BROWSE_PREFERENCES_STORAGE_KEY = "trade-reviewer:dashboard-browse-preferences:v1";

export type DashboardBrowsePeriodPreference =
  | { preset: Exclude<RoomPeriodPreset, "custom" | "all"> | "all" }
  | { preset: "custom"; startDate: string; endDate: string };

export type DashboardBrowsePreferences = {
  version: 1;
  assetCategory: RoomAssetCategory;
  assetType: RoomAssetTypeFilter;
  query?: string;
  instrumentIds: string[];
  markets: string[];
  currencies: string[];
  reviewStatuses: RoomReviewStatus[];
  period: DashboardBrowsePeriodPreference;
};

export type DashboardBrowsePreferenceRead = {
  available: boolean;
  preferences: DashboardBrowsePreferences | null;
};

const ASSET_CATEGORIES: readonly RoomAssetCategory[] = ["all", "a-share-stock", "us-stock", "hk-stock", "etf", "unknown"];
const ASSET_TYPES: readonly RoomAssetTypeFilter[] = ["all", "stock", "etf"];
const PERIOD_PRESETS: readonly RoomPeriodPreset[] = ["month", "last-3-months", "ytd", "all", "custom"];
const REVIEW_STATUSES: readonly RoomReviewStatus[] = ["pending", "completed", "deferred"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string" && item.trim().length > 0);
}

function isReviewStatusArray(value: unknown): value is RoomReviewStatus[] {
  return Array.isArray(value) && value.every(item => REVIEW_STATUSES.includes(item as RoomReviewStatus));
}

function normalizePreferences(value: unknown, today: string): DashboardBrowsePreferences | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (!ASSET_CATEGORIES.includes(value.assetCategory as RoomAssetCategory)) return null;
  if (!ASSET_TYPES.includes(value.assetType as RoomAssetTypeFilter)) return null;
  if (value.query !== undefined && typeof value.query !== "string") return null;
  if (!isStringArray(value.instrumentIds) || !isStringArray(value.markets) || !isStringArray(value.currencies)) return null;
  if (!isReviewStatusArray(value.reviewStatuses) || !isRecord(value.period)) return null;

  const preset = value.period.preset;
  if (!PERIOD_PRESETS.includes(preset as RoomPeriodPreset)) return null;

  let period: DashboardBrowsePeriodPreference;
  if (preset === "custom") {
    const startDate = value.period.startDate;
    const endDate = value.period.endDate;
    if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate || endDate > today) return null;
    period = { preset, startDate, endDate };
  } else {
    period = { preset: preset as Exclude<RoomPeriodPreset, "custom"> };
  }

  return {
    version: 1,
    assetCategory: value.assetCategory as RoomAssetCategory,
    assetType: value.assetType as RoomAssetTypeFilter,
    ...(typeof value.query === "string" && value.query.trim() ? { query: value.query } : {}),
    instrumentIds: [...value.instrumentIds],
    markets: [...value.markets],
    currencies: [...value.currencies],
    reviewStatuses: [...value.reviewStatuses],
    period,
  };
}

export function parseDashboardBrowsePreferences(serialized: string | null, today: string): DashboardBrowsePreferences | null {
  if (!serialized) return null;
  try {
    return normalizePreferences(JSON.parse(serialized) as unknown, today);
  } catch {
    return null;
  }
}

export function readDashboardBrowsePreferences(today: string): DashboardBrowsePreferenceRead {
  if (typeof window === "undefined") return { available: false, preferences: null };
  try {
    const serialized = window.localStorage.getItem(DASHBOARD_BROWSE_PREFERENCES_STORAGE_KEY);
    return { available: true, preferences: parseDashboardBrowsePreferences(serialized, today) };
  } catch {
    return { available: false, preferences: null };
  }
}

export function saveDashboardBrowsePreferences(scope: RoomScope, today: string): void {
  if (typeof window === "undefined") return;
  const period: DashboardBrowsePeriodPreference = scope.period.preset === "custom"
    ? { preset: "custom", startDate: scope.period.startDate, endDate: scope.period.endDate }
    : { preset: scope.period.preset };
  const preferences = normalizePreferences({
    version: 1,
    assetCategory: scope.assetCategory,
    assetType: scope.assetType ?? "all",
    query: scope.query,
    instrumentIds: [...scope.instrumentIds],
    markets: [...scope.markets],
    currencies: [...scope.currencies],
    reviewStatuses: [...scope.reviewStatuses],
    period,
  }, today);
  if (!preferences) return;
  try {
    window.localStorage.setItem(DASHBOARD_BROWSE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Page-local browsing preferences are best effort and never block the dashboard.
  }
}

export function applyDashboardBrowsePreferences(
  scope: RoomScope,
  preferences: DashboardBrowsePreferences,
  today: string,
): RoomScope {
  let period: RoomDateRange;
  if (preferences.period.preset === "custom") {
    period = buildRoomDateRange("custom", today, preferences.period.startDate, preferences.period.endDate);
  } else if (preferences.period.preset === "all") {
    // The dashboard derives its all-history bounds from the current filtered rows.
    period = buildRoomDateRange("all", today, { startDate: "1900-01-01", endDate: today });
  } else {
    period = buildRoomDateRange(preferences.period.preset, today);
  }

  return {
    ...scope,
    assetCategory: preferences.assetCategory,
    assetType: preferences.assetType,
    query: preferences.query,
    instrumentIds: [...preferences.instrumentIds],
    markets: [...preferences.markets],
    currencies: [...preferences.currencies],
    reviewStatuses: [...preferences.reviewStatuses],
    period,
  };
}
