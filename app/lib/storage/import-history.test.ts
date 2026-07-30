import { beforeEach, describe, expect, it } from "vitest";

import {
  loadImportHistory,
  saveImportHistoryEntry,
  type ImportHistoryEntry,
} from "./import-history";

const entry: ImportHistoryEntry = {
  id: "batch-1",
  fileName: "交易记录.xlsx",
  sourceLabel: "富途证券",
  importedAt: "2026-07-26T00:00:00.000Z",
  firstTradeAt: "2025-01-01T00:00:00.000Z",
  lastTradeAt: "2025-03-01T00:00:00.000Z",
  tradeCount: 20,
  instrumentCount: 3,
  excludedInstrumentCount: 1,
  excludedRecordCount: 4,
  duplicateTradeCount: 2,
  unresolvedInstrumentCount: 1,
};

describe("import history", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores newest batches first without duplicating batch ids", () => {
    saveImportHistoryEntry(entry);
    saveImportHistoryEntry({ ...entry, tradeCount: 21 });

    expect(loadImportHistory()).toEqual([{ ...entry, tradeCount: 21 }]);
  });

  it("normalizes legacy history entries with categorized count defaults", () => {
    window.localStorage.setItem(
      "trade-reviewer:import-history:v1",
      JSON.stringify([
        {
          id: "legacy",
          fileName: "旧交易记录.xlsx",
          importedAt: "2025-01-01T00:00:00.000Z",
          tradeCount: 8,
          instrumentCount: 2,
          excludedInstrumentCount: 1,
        },
      ]),
    );

    expect(loadImportHistory()).toEqual([
      {
        id: "legacy",
        fileName: "旧交易记录.xlsx",
        sourceLabel: "历史导入",
        importedAt: "2025-01-01T00:00:00.000Z",
        tradeCount: 8,
        instrumentCount: 2,
        excludedInstrumentCount: 1,
        excludedRecordCount: 1,
        duplicateTradeCount: 0,
        unresolvedInstrumentCount: 0,
      },
    ]);
  });
});
