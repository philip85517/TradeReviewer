/** MIGRATION-ONLY: legacy transactional browser writes retained for isolated tests. */
import type { TradeExecution } from "../trades/types";
import {
  IMPORT_HISTORY_STORAGE_KEY,
  saveImportHistoryEntry,
  type ImportHistoryEntry,
} from "./import-history";
import {
  IMPORTED_EXECUTIONS_STORAGE_KEY,
  saveImportedExecutions,
} from "./import-library";

function restoreStorageValue(key: string, value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Preserve the original persistence error. A later reload still uses
    // defensive parsing if the browser storage itself is unavailable.
  }
}

export function persistImportBatch(
  previousExecutions: TradeExecution[],
  nextExecutions: TradeExecution[],
  historyEntry: ImportHistoryEntry,
) {
  if (typeof window === "undefined") return;
  const previousExecutionStorage = window.localStorage.getItem(
    IMPORTED_EXECUTIONS_STORAGE_KEY,
  );
  const previousHistoryStorage = window.localStorage.getItem(
    IMPORT_HISTORY_STORAGE_KEY,
  );

  try {
    saveImportedExecutions(nextExecutions);
    saveImportHistoryEntry(historyEntry);
  } catch (error) {
    restoreStorageValue(
      IMPORTED_EXECUTIONS_STORAGE_KEY,
      previousExecutionStorage,
    );
    restoreStorageValue(
      IMPORT_HISTORY_STORAGE_KEY,
      previousHistoryStorage,
    );
    // Ensure an empty previous collection is restored even when this is the
    // first import and no serialized value existed.
    if (
      previousExecutionStorage === null &&
      previousExecutions.length > 0
    ) {
      try {
        saveImportedExecutions(previousExecutions);
      } catch {
        // Keep the original error.
      }
    }
    throw error;
  }
}
