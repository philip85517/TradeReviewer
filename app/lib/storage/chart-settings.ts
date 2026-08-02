/** MIGRATION-ONLY: load/save access the retired browser rollback copy. */
export type ChartSettings = {
  version: 1;
  showGrid: boolean;
  showVolume: boolean;
  showExecutions: boolean;
  showAverageCost: boolean;
  colorScheme: "teal-red" | "green-red" | "blue-orange";
};

const STORAGE_KEY = "trade-reviewer:chart-settings:v1";

const defaults: ChartSettings = {
  version: 1,
  showGrid: true,
  showVolume: true,
  showExecutions: true,
  showAverageCost: true,
  colorScheme: "teal-red",
};

function isChartSettings(value: unknown): value is ChartSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    typeof candidate.showGrid === "boolean" &&
    typeof candidate.showVolume === "boolean" &&
    typeof candidate.showExecutions === "boolean" &&
    typeof candidate.showAverageCost === "boolean" &&
    (candidate.colorScheme === "teal-red" ||
      candidate.colorScheme === "green-red" ||
      candidate.colorScheme === "blue-orange")
  );
}

export function loadChartSettings(): ChartSettings {
  if (typeof window === "undefined") return { ...defaults };
  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (!serialized) return { ...defaults };
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isChartSettings(parsed) ? { ...parsed } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function saveChartSettings(settings: ChartSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
