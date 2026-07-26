import { beforeEach, describe, expect, it } from "vitest";

import {
  loadImportHistory,
  saveImportHistoryEntry,
  type ImportHistoryEntry,
} from "./import-history";

const entry: ImportHistoryEntry = {
  id: "batch-1",
  fileName: "交易记录.xlsx",
  importedAt: "2026-07-26T00:00:00.000Z",
  firstTradeAt: "2025-01-01T00:00:00.000Z",
  lastTradeAt: "2025-03-01T00:00:00.000Z",
  tradeCount: 20,
  instrumentCount: 3,
  excludedInstrumentCount: 1,
};

describe("import history", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores newest batches first without duplicating batch ids", () => {
    saveImportHistoryEntry(entry);
    saveImportHistoryEntry({ ...entry, tradeCount: 21 });

    expect(loadImportHistory()).toEqual([{ ...entry, tradeCount: 21 }]);
  });
});
