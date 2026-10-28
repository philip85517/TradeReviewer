import { describe, expect, it, vi } from "vitest";

import { isLegacyImportHistoryEntry } from "./import-history-contract";
import { isLegacyImportHistoryEntry as migrationValidator } from "./import-history";

const minimal = {
  id: "batch-1",
  fileName: "statement.xlsx",
  importedAt: "2026-01-01T00:00:00.000Z",
  tradeCount: 2,
  instrumentCount: 1,
  excludedInstrumentCount: 0,
};
const monthly = {
  documentId: "document-1",
  templateIds: ["statement-v1"],
  reviewRequired: false,
  positions: [],
  events: [],
};

describe("import history strict contract", () => {
  it("preserves the migration facade's public validator", () => {
    expect(migrationValidator).toBe(isLegacyImportHistoryEntry);
  });

  it("accepts historical omissions and unchecked metadata without normalization", () => {
    for (const value of [
      minimal,
      { ...minimal, id: "", fileName: "", importedAt: "not-a-date" },
      { ...minimal, sourceLabel: "", firstTradeAt: "", lastTradeAt: "" },
      { ...minimal, tradingNature: { historical: "unchecked" }, extra: true },
      { ...minimal, simulationRunId: "", monthly },
      { ...minimal, tradeCount: 0.5, instrumentCount: 0, excludedInstrumentCount: -0 },
    ]) {
      expect(isLegacyImportHistoryEntry(value)).toBe(true);
    }
    expect(minimal).not.toHaveProperty("sourceLabel");
    expect(minimal).not.toHaveProperty("excludedRecordCount");
  });

  it.each(["statement", "screenshot", "tradingview"])("accepts source kind %s", (sourceKind) => {
    expect(isLegacyImportHistoryEntry({ ...minimal, sourceKind })).toBe(true);
  });

  it.each(["live", "simulation", "unknown"])("accepts trade nature %s", (tradeNature) => {
    expect(isLegacyImportHistoryEntry({ ...minimal, tradeNature })).toBe(true);
  });

  it("rejects nonrecords and arrays even when they carry entry fields", () => {
    for (const value of [undefined, null, false, 0, "entry", [], Object.assign([], minimal)]) {
      expect(isLegacyImportHistoryEntry(value)).toBe(false);
    }
  });

  it.each(["id", "fileName", "importedAt"])("requires string %s", (field) => {
    for (const invalid of [undefined, null, 0, false, {}]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, [field]: invalid })).toBe(false);
    }
  });

  it.each(["sourceLabel", "firstTradeAt", "lastTradeAt", "simulationRunId"])("keeps %s optional but string shaped", (field) => {
    expect(isLegacyImportHistoryEntry({ ...minimal, [field]: undefined })).toBe(true);
    expect(isLegacyImportHistoryEntry({ ...minimal, [field]: "" })).toBe(true);
    for (const invalid of [null, 0, false, {}]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, [field]: invalid })).toBe(false);
    }
  });

  it.each(["tradeCount", "instrumentCount", "excludedInstrumentCount"])("requires finite nonnegative %s", (field) => {
    for (const invalid of [undefined, null, "1", -1, NaN, Infinity, -Infinity]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, [field]: invalid })).toBe(false);
    }
  });

  it.each(["excludedRecordCount", "duplicateTradeCount", "unresolvedInstrumentCount", "captureCount", "conflictTradeCount"])("checks optional count %s without defaults", (field) => {
    for (const valid of [undefined, 0, 0.5]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, [field]: valid })).toBe(true);
    }
    for (const invalid of [null, "1", -1, NaN, Infinity, -Infinity]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, [field]: invalid })).toBe(false);
    }
  });

  it("rejects unsupported enums and malformed monthly evidence", () => {
    for (const sourceKind of [null, "csv", 1]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, sourceKind })).toBe(false);
    }
    for (const tradeNature of [null, "simulated", 1]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, tradeNature })).toBe(false);
    }
    for (const invalid of [null, [], {}, { ...monthly, reviewRequired: "false" }, { ...monthly, templateIds: [1] }, { ...monthly, positions: [{}] }, { ...monthly, events: [{}] }, { ...monthly, evidenceScope: { accountId: "", instrumentId: "US:NVDA" } }]) {
      expect(isLegacyImportHistoryEntry({ ...minimal, monthly: invalid })).toBe(false);
    }
    expect(isLegacyImportHistoryEntry({ ...minimal, monthly: { ...monthly, evidenceScope: { accountId: "account-1", instrumentId: "US:NVDA" } } })).toBe(true);
  });

  it("loads and validates with browser storage access forbidden", async () => {
    vi.resetModules();
    const originals = [...new Set([globalThis, window])].flatMap((target) =>
      ["localStorage", "indexedDB"].map((name) => ({ target, name, descriptor: Object.getOwnPropertyDescriptor(target, name) })),
    );
    try {
      for (const { target, name } of originals) {
        Object.defineProperty(target, name, { configurable: true, get() { throw new Error(`Forbidden browser storage: ${name}`); } });
      }
      const contract = await import("./import-history-contract");
      expect(contract.isLegacyImportHistoryEntry(minimal)).toBe(true);
      expect(contract.isLegacyImportHistoryEntry({ ...minimal, monthly })).toBe(true);
      expect(contract.isLegacyImportHistoryEntry({ ...minimal, tradeCount: NaN })).toBe(false);
    } finally {
      for (const { target, name, descriptor } of originals) {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else Reflect.deleteProperty(target, name);
      }
    }
  });
});
