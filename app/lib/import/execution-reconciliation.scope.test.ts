import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import { applyReconciliationDecisions, compareExecutions, reconcileExecutions } from "./execution-reconciliation";

function fill(id: string, source: Partial<TradeExecution["source"]> = {}, overrides: Partial<TradeExecution> = {}): TradeExecution {
  return {
    id, accountId: "account-a", accountLabel: "Account A",
    instrument: { id: "US:ABC", symbol: "ABC", market: "US", name: "ABC", currency: "USD" },
    side: "buy", executedAt: "2026-01-02T03:04:05Z", quantity: "10", price: "100", fee: "0",
    ...overrides,
    source: { platform: "futu", fileFingerprint: "file-a", row: 1, tradeNature: "live", ...source },
  };
}

describe("execution identity scope and multiplicity", () => {
  it("retains equal timestamped fills in different accounts", () => {
    const existing = fill("a");
    const incoming = fill("b", { fileFingerprint: "file-b" }, { accountId: "account-b" });
    expect(reconcileExecutions([existing], [incoming])).toMatchObject({ acceptedIncoming: [incoming], duplicates: [], conflicts: [] });
  });

  it("retains equal fills on two stable rows in the same file", () => {
    const rows = [fill("a"), fill("b", { row: 2 })];
    expect(reconcileExecutions([], rows)).toMatchObject({ acceptedIncoming: rows, duplicates: [], conflicts: [] });
  });

  it("matches each stable file row once when reimport changes generated IDs", () => {
    const current = [fill("a"), fill("b", { row: 2 })];
    const incoming = [fill("retry-b", { row: 2 }), fill("retry-a")];
    const result = reconcileExecutions(current, incoming);
    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
    expect(result.duplicates.map(({ kept }) => kept.id).sort()).toEqual(["a", "b"]);
  });

  it("recognizes a stable zero-based source row without inventing a locator", () => {
    const existing = fill("a", { row: 0 });
    const incoming = fill("retry", { row: 0 });
    expect(reconcileExecutions([existing], [incoming])).toMatchObject({ acceptedIncoming: [], duplicates: [{ kept: existing, skipped: incoming }], conflicts: [] });
  });

  it("retains a new valid stable row alongside an existing row in the same file", () => {
    const incoming = fill("b", { row: 2 });
    expect(reconcileExecutions([fill("a")], [incoming])).toMatchObject({ acceptedIncoming: [incoming], duplicates: [], conflicts: [] });
  });

  it.each([
    { label: "missing", row: undefined },
    { label: "negative", row: -1 },
    { label: "fractional", row: 1.5 },
    { label: "positive infinity", row: Infinity },
    { label: "negative infinity", row: -Infinity },
    { label: "NaN", row: NaN },
  ])("requires a choice when a same-file row locator is $label", ({ row }) => {
    for (const [currentRow, incomingRow] of [[row, row], [1, row], [row, 1]]) {
      const existing = fill("a", { row: currentRow });
      const incoming = fill("retry", { row: incomingRow });
      const result = reconcileExecutions([existing], [incoming]);
      expect(result).toMatchObject({ acceptedIncoming: [], duplicates: [], conflicts: [{ existing: [existing], incoming: [incoming] }] });
      expect(() => applyReconciliationDecisions([existing], result, new Map())).toThrow(/decision.*required/i);
    }
  });

  it("requires a choice for equal fills in different file versions", () => {
    const existing = fill("a");
    const incoming = fill("b", { fileFingerprint: "file-b" });
    const result = reconcileExecutions([existing], [incoming]);
    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toMatchObject([{ existing: [existing], incoming: [incoming] }]);
    expect(() => applyReconciliationDecisions([existing], result, new Map())).toThrow(/decision.*required/i);
    const retained = applyReconciliationDecisions([existing], result, new Map([[result.conflicts[0].id, "keep-both"]]));
    expect(reconcileExecutions([], [...retained.currentAfterReplacements, ...retained.incomingToMerge]).acceptedIncoming).toHaveLength(2);
  });

  it("pairs cross-file ambiguity one to one without replacing an extra real fill", () => {
    const current = [fill("a"), fill("b", { row: 2 })];
    const incoming = fill("c", { fileFingerprint: "file-b" });
    const result = reconcileExecutions(current, [incoming]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].existing).toHaveLength(1);
    const resolved = applyReconciliationDecisions(current, result, new Map([[result.conflicts[0].id, "use-incoming"]]));
    expect(resolved.currentAfterReplacements).toHaveLength(1);
    expect(resolved.incomingToMerge).toEqual([incoming]);
  });

  it.each([
    { tradeNature: "unknown" as const },
    { tradeNature: "simulation" as const, simulationRunId: "run-a" },
    { tradeNature: "live" as const, tradingNature: "simulated" as const },
  ])("isolates live from unresolved or simulation nature: %j", source => {
    const incoming = fill("b", { fileFingerprint: "file-b", ...source });
    expect(reconcileExecutions([fill("a")], [incoming])).toMatchObject({ acceptedIncoming: [incoming], duplicates: [], conflicts: [] });
  });

  it("does not infer live nature from a broker name", () => {
    const unresolved = fill("b", { tradeNature: undefined, fileFingerprint: "file-b" });
    expect(reconcileExecutions([fill("a")], [unresolved]).acceptedIncoming).toEqual([unresolved]);
  });

  it("isolates simulation runs and distinguishes entry/exit source trade roles", () => {
    const entry = fill("a", { platform: "tradingview", tradeNature: "simulation", simulationRunId: "run-a", sourceTradeId: "1", simulationRole: "entry" });
    const exit = fill("b", { ...entry.source, row: 2, simulationRole: "exit" });
    const other = fill("c", { ...entry.source, simulationRunId: "run-b", fileFingerprint: "file-b" });
    expect(reconcileExecutions([entry], [exit, other])).toMatchObject({ acceptedIncoming: [other, exit], duplicates: [], conflicts: [] });
  });

  it("retains a missing simulation role as unknown instead of inferring entry or exit", () => {
    const entry = fill("a", { platform: "tradingview", tradeNature: "simulation", simulationRunId: "run-a", simulationTradeId: "1", simulationRole: "entry" });
    const unknownRole = fill("b", { ...entry.source, fileFingerprint: "file-b", simulationRole: undefined });
    expect(reconcileExecutions([entry], [unknownRole])).toMatchObject({ acceptedIncoming: [unknownRole], duplicates: [], conflicts: [] });
    expect(unknownRole.source.simulationRole).toBeUndefined();
  });

  it("does not trust an unqualified broker sourceTradeId or order reference across files", () => {
    const existing = fill("a", { sourceTradeId: "order-1" });
    const incoming = fill("b", { sourceTradeId: "order-1", fileFingerprint: "file-b" });
    expect(reconcileExecutions([existing], [incoming]).conflicts).toHaveLength(1);
  });

  it("does not use a filename as proof of the same file version", () => {
    const existing = fill("a", { fileFingerprint: undefined, fileName: "trades.csv" });
    const incoming = fill("b", { fileFingerprint: undefined, fileName: "trades.csv" });
    expect(reconcileExecutions([existing], [incoming]).conflicts).toHaveLength(1);
  });

  it("requires review when a stable row changes core values or execution time", () => {
    for (const override of [{ price: "101" }, { executedAt: "2026-01-02T03:05:05Z" }]) {
      const existing = fill("a");
      const incoming = fill("retry", {}, override);
      expect(reconcileExecutions([existing], [incoming])).toMatchObject({ acceptedIncoming: [], duplicates: [], conflicts: [{ existing: [existing], incoming: [incoming] }] });
    }
  });

  it("keeps real zero-price rows eligible for stable-row reimport", () => {
    const existing = fill("a", {}, { price: "0" });
    const incoming = fill("retry", {}, { price: "0.00" });
    expect(reconcileExecutions([existing], [incoming])).toMatchObject({ acceptedIncoming: [], duplicates: [{ kept: existing, skipped: incoming }], conflicts: [] });
  });

  it("preserves valid date-only rows and deduplicates their stable row reimport", () => {
    const existing = fill("a", { timePrecision: "date-only", sourceOrder: 2 }, { executedAt: "2026-01-02" });
    const incoming = fill("retry", { ...existing.source }, { executedAt: "2026-01-02" });
    expect(reconcileExecutions([existing], [incoming])).toMatchObject({ acceptedIncoming: [], duplicates: [{ kept: existing, skipped: incoming }], conflicts: [] });
  });

  it("orders date-only rows transitively alongside instants with different offsets", () => {
    const earlier = fill("earlier", {}, { executedAt: "2026-01-02T00:00:00+14:00" });
    const date = fill("date", { timePrecision: "date-only" }, { executedAt: "2026-01-02" });
    const later = fill("later", {}, { executedAt: "2026-01-01T23:00:00-12:00" });
    for (const rows of [[earlier, date, later], [date, later, earlier], [later, earlier, date]]) {
      expect([...rows].sort(compareExecutions)).toEqual([earlier, date, later]);
    }
    expect(date.executedAt).toBe("2026-01-02");
  });
});
