import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImportHistoryDialog } from "../../components/import/import-history-dialog";

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
  sourceKind: "statement",
  captureCount: 0,
  conflictTradeCount: 0,
};

describe("import history", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

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
        sourceKind: "statement",
        captureCount: 0,
        conflictTradeCount: 0,
      },
    ]);
  });

  it("round-trips screenshot batch metadata without raw review evidence", () => {
    const screenshotEntry: ImportHistoryEntry = {
      ...entry,
      id: "screenshot-batch",
      fileName: "3 张交易截图",
      sourceLabel: "富途截图",
      sourceKind: "screenshot",
      captureCount: 3,
      conflictTradeCount: 2,
    };

    saveImportHistoryEntry(screenshotEntry);

    expect(loadImportHistory()).toEqual([screenshotEntry]);
    const serialized = window.localStorage.getItem(
      "trade-reviewer:import-history:v1",
    );
    expect(serialized).not.toContain("blob:");
    expect(serialized).not.toContain("sourceBounds");
    expect(serialized).not.toContain("rawText");
  });

  it("shows screenshot capture and handled-conflict counts only for screenshot entries", async () => {
    const user = userEvent.setup();
    render(
      createElement(ImportHistoryDialog, {
        entries: [
          entry,
          {
            ...entry,
            id: "screenshot-batch",
            fileName: "3 张交易截图",
            sourceLabel: "富途截图",
            sourceKind: "screenshot",
            captureCount: 3,
            conflictTradeCount: 2,
          },
        ],
        onClose: vi.fn(),
      }),
    );

    expect(screen.getByText("3 张截图")).toBeInTheDocument();
    expect(screen.getByText("已处理 2 笔冲突")).toBeInTheDocument();
    expect(screen.getAllByText(/截图/)).toHaveLength(2);
    expect(screen.getAllByText(/冲突/)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "关闭导入记录" }));
  });
});
