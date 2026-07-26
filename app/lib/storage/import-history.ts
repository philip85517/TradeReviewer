const STORAGE_KEY = "trade-reviewer:import-history:v1";

export type ImportHistoryEntry = {
  id: string;
  fileName: string;
  importedAt: string;
  firstTradeAt?: string;
  lastTradeAt?: string;
  tradeCount: number;
  instrumentCount: number;
  excludedInstrumentCount: number;
};

function isEntry(value: unknown): value is ImportHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ImportHistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.importedAt === "string" &&
    typeof candidate.tradeCount === "number" &&
    typeof candidate.instrumentCount === "number" &&
    typeof candidate.excludedInstrumentCount === "number"
  );
}

export function loadImportHistory(): ImportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function saveImportHistoryEntry(entry: ImportHistoryEntry) {
  if (typeof window === "undefined") return;
  const next = [
    entry,
    ...loadImportHistory().filter((item) => item.id !== entry.id),
  ];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
