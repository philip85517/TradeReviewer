export const IMPORT_HISTORY_STORAGE_KEY =
  "trade-reviewer:import-history:v1";

export type ImportHistoryEntry = {
  id: string;
  fileName: string;
  sourceLabel: string;
  importedAt: string;
  firstTradeAt?: string;
  lastTradeAt?: string;
  tradeCount: number;
  instrumentCount: number;
  excludedInstrumentCount: number;
  excludedRecordCount: number;
  duplicateTradeCount: number;
  unresolvedInstrumentCount: number;
};

function count(value: unknown, fallback = 0) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : fallback;
}

function parseEntry(value: unknown): ImportHistoryEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ImportHistoryEntry>;
  if (
    typeof candidate.id === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.importedAt === "string" &&
    typeof candidate.tradeCount === "number" &&
    typeof candidate.instrumentCount === "number" &&
    typeof candidate.excludedInstrumentCount === "number"
  ) {
    return {
      id: candidate.id,
      fileName: candidate.fileName,
      sourceLabel:
        typeof candidate.sourceLabel === "string" &&
        candidate.sourceLabel.trim()
          ? candidate.sourceLabel
          : "历史导入",
      importedAt: candidate.importedAt,
      ...(typeof candidate.firstTradeAt === "string"
        ? { firstTradeAt: candidate.firstTradeAt }
        : {}),
      ...(typeof candidate.lastTradeAt === "string"
        ? { lastTradeAt: candidate.lastTradeAt }
        : {}),
      tradeCount: count(candidate.tradeCount),
      instrumentCount: count(candidate.instrumentCount),
      excludedInstrumentCount: count(
        candidate.excludedInstrumentCount,
      ),
      excludedRecordCount: count(
        candidate.excludedRecordCount,
        count(candidate.excludedInstrumentCount),
      ),
      duplicateTradeCount: count(candidate.duplicateTradeCount),
      unresolvedInstrumentCount: count(
        candidate.unresolvedInstrumentCount,
      ),
    };
  }
  return undefined;
}

export function loadImportHistory(): ImportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const serialized = window.localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed)
      ? parsed.flatMap((value) => {
          const entry = parseEntry(value);
          return entry ? [entry] : [];
        })
      : [];
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
  window.localStorage.setItem(
    IMPORT_HISTORY_STORAGE_KEY,
    JSON.stringify(next),
  );
}
