import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import {
  applyReconciliationDecisions,
  compareExecutions,
  reconcileExecutions,
} from "./execution-reconciliation";

type FillOverrides = {
  id?: string;
  fingerprint?: string;
  fileName?: string;
  platform?: string;
  inputKind?: "statement" | "screenshot";
  accountId?: string;
  accountLabel?: string;
  fee?: string;
  name?: string;
  symbol?: string;
  market?: string;
  executedAt?: string;
  side?: "buy" | "sell";
  quantity?: string;
  price?: string;
  row?: number;
};

let nextId = 0;

function fill(overrides: FillOverrides = {}): TradeExecution {
  nextId += 1;
  const symbol = overrides.symbol ?? "BABA";
  const market = overrides.market ?? "US";
  return {
    id: overrides.id ?? `fill:${nextId}`,
    source: {
      platform: overrides.platform ?? "futu",
      row: overrides.row ?? nextId,
      fileName: overrides.fileName,
      fileFingerprint: overrides.fingerprint,
      inputKind: overrides.inputKind,
    },
    accountId: overrides.accountId ?? "account-a",
    accountLabel: overrides.accountLabel ?? "Futu · account-a",
    instrument: {
      id: `${market}:${symbol}`,
      symbol,
      name: overrides.name ?? symbol,
      market,
      currency: market === "HK" ? "HKD" : "USD",
    },
    side: overrides.side ?? "buy",
    executedAt: overrides.executedAt ?? "2026-07-31T01:02:03.000Z",
    quantity: overrides.quantity ?? "10",
    price: overrides.price ?? "100.00",
    fee: overrides.fee ?? "0",
  };
}

describe("execution reconciliation", () => {
  it("auto-deduplicates across sources when symbol, second, side, quantity, and price match", () => {
    const existing = fill({
      fingerprint: "xlsx-a",
      accountId: "account-a",
      fee: "2.05",
    });
    const screenshot = fill({
      fingerprint: "image-b",
      accountId: "account-b",
      fee: "0",
    });

    const result = reconcileExecutions([existing], [screenshot]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.automaticReplacementIds).toEqual([]);
    expect(result.duplicates).toEqual([
      { kept: existing, skipped: screenshot },
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it.each([
    ["side", "sell"],
    ["quantity", "11"],
    ["price", "101"],
  ] as const)("reports a conflict when %s differs", (field, value) => {
    const result = reconcileExecutions(
      [fill({ fingerprint: "pdf" })],
      [fill({ fingerprint: "image", [field]: value })],
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.duplicates).toHaveLength(0);
  });

  it("preserves identical rows from the same source instance", () => {
    const existing = fill({ fingerprint: "same-file" });
    const incoming = fill({ fingerprint: "same-file" });

    const result = reconcileExecutions([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([incoming]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("retains the larger source multiplicity when current has two identical fills", () => {
    const current = [
      fill({ fingerprint: "source-a", row: 1 }),
      fill({ fingerprint: "source-a", row: 2 }),
    ];
    const incoming = fill({ fingerprint: "source-b", row: 1 });

    const result = reconcileExecutions(current, [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toHaveLength(1);
    expect(current).toHaveLength(2);
  });

  it("retains the larger incoming source as the equal-evidence representative set", () => {
    const current = fill({ fingerprint: "source-a", row: 1 });
    const incoming = [
      fill({ fingerprint: "source-b", row: 1 }),
      fill({ fingerprint: "source-b", row: 2 }),
    ];

    const result = reconcileExecutions([current], incoming);

    expect(result.acceptedIncoming).toEqual(incoming);
    expect(result.automaticReplacementIds).toEqual([current.id]);
    expect(result.duplicates).toEqual([
      { kept: incoming[0], skipped: current },
    ]);
  });

  it("uses an incoming statement when it has richer account, fee, and name evidence", () => {
    const screenshot = fill({
      fingerprint: "image-a",
      inputKind: "screenshot",
      accountId: "unknown",
      accountLabel: "Unknown",
      fee: "0",
      name: "名称待行情源补充",
    });
    const statement = fill({
      fingerprint: "xlsx-b",
      inputKind: "statement",
      accountId: "account-0855",
      accountLabel: "Futu · 0855",
      fee: "2.05",
      name: "Alibaba",
    });

    const result = reconcileExecutions([screenshot], [statement]);

    expect(result.acceptedIncoming).toEqual([statement]);
    expect(result.automaticReplacementIds).toEqual([screenshot.id]);
    expect(result.duplicates).toEqual([
      { kept: statement, skipped: screenshot },
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("matches canonical HK symbols with and without leading zeroes", () => {
    const existing = fill({
      fingerprint: "source-a",
      symbol: "06969",
      market: "HK",
    });
    const incoming = fill({
      fingerprint: "source-b",
      symbol: "6969",
      market: "HK",
    });

    expect(reconcileExecutions([existing], [incoming]).duplicates).toEqual([
      { kept: existing, skipped: incoming },
    ]);
  });

  it("normalizes equivalent ISO spellings without rounding milliseconds", () => {
    const existing = fill({
      fingerprint: "source-a",
      executedAt: "2026-07-31T01:02:03.123Z",
    });
    const sameInstant = fill({
      fingerprint: "source-b",
      executedAt: "2026-07-30T21:02:03.123-04:00",
    });
    const differentMillisecond = fill({
      fingerprint: "source-c",
      executedAt: "2026-07-31T01:02:03.124Z",
    });

    expect(reconcileExecutions([existing], [sameInstant]).duplicates).toEqual([
      { kept: existing, skipped: sameInstant },
    ]);
    const different = reconcileExecutions([existing], [differentMillisecond]);
    expect(different.acceptedIncoming).toEqual([differentMillisecond]);
    expect(different.duplicates).toEqual([]);
    expect(different.conflicts).toEqual([]);
  });

  it.each(["not-an-instant", "2026-07-31T01:02:03"])(
    "does not automatically match records without a valid instant: %s",
    (executedAt) => {
      const existing = fill({
        fingerprint: "source-a",
        executedAt,
      });
      const incoming = fill({
        fingerprint: "source-b",
        executedAt,
      });

      const result = reconcileExecutions([existing], [incoming]);

      expect(result.acceptedIncoming).toEqual([incoming]);
      expect(result.duplicates).toEqual([]);
      expect(result.conflicts).toEqual([]);
    },
  );

  it("pairs exact matches before reporting remaining candidate conflicts", () => {
    const exactExisting = fill({
      fingerprint: "source-a",
      side: "buy",
      row: 1,
    });
    const conflictingExisting = fill({
      fingerprint: "source-a",
      side: "sell",
      quantity: "5",
      row: 2,
    });
    const exactIncoming = fill({
      fingerprint: "source-b",
      side: "buy",
      row: 1,
    });
    const conflictingIncoming = fill({
      fingerprint: "source-b",
      side: "sell",
      quantity: "6",
      row: 2,
    });

    const result = reconcileExecutions(
      [conflictingExisting, exactExisting],
      [conflictingIncoming, exactIncoming],
    );

    expect(result.duplicates).toEqual([
      { kept: exactExisting, skipped: exactIncoming },
    ]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      existing: [conflictingExisting],
      incoming: [conflictingIncoming],
    });
  });

  it("normalizes decimal quantity and price before exact matching", () => {
    const existing = fill({
      fingerprint: "source-a",
      quantity: "10.00",
      price: "100.0",
    });
    const incoming = fill({
      fingerprint: "source-b",
      quantity: "10",
      price: "100.000",
    });

    expect(reconcileExecutions([existing], [incoming]).duplicates).toEqual([
      { kept: existing, skipped: incoming },
    ]);
  });

  it.each([
    ["quantity", "not-a-decimal"],
    ["quantity", "NaN"],
    ["quantity", "0"],
    ["quantity", "-1"],
    ["price", "not-a-decimal"],
    ["price", "NaN"],
    ["price", "0"],
    ["price", "-1"],
  ] as const)(
    "does not auto-match executions with non-positive or invalid %s %s",
    (field, value) => {
      const existing = fill({ fingerprint: "source-a", [field]: value });
      const incoming = fill({ fingerprint: "source-b", [field]: value });

      const result = reconcileExecutions([existing], [incoming]);

      expect(result.acceptedIncoming).toEqual([incoming]);
      expect(result.automaticReplacementIds).toEqual([]);
      expect(result.duplicates).toEqual([]);
      expect(result.conflicts).toEqual([]);
    },
  );

  it("orders valid and invalid instants transitively for every input permutation", () => {
    const validFirst = fill({
      id: "valid-first",
      executedAt: "2026-01-01T00:00:00+14:00",
    });
    const validSecond = fill({
      id: "valid-second",
      executedAt: "2025-12-31T23:00:00-12:00",
    });
    const invalid = fill({ id: "invalid", executedAt: "2025z" });

    expect(compareExecutions(validFirst, validSecond)).toBeLessThan(0);
    expect(compareExecutions(validSecond, invalid)).toBeLessThan(0);
    expect(compareExecutions(validFirst, invalid)).toBeLessThan(0);

    const permutations = [
      [validFirst, validSecond, invalid],
      [validFirst, invalid, validSecond],
      [validSecond, validFirst, invalid],
      [validSecond, invalid, validFirst],
      [invalid, validFirst, validSecond],
      [invalid, validSecond, validFirst],
    ];
    for (const permutation of permutations) {
      expect(
        [...permutation].sort(compareExecutions).map(({ id }) => id),
      ).toEqual(["valid-first", "valid-second", "invalid"]);
    }
  });

  it("keeps a richer current record when the incoming execution ID is the same", () => {
    const current = fill({
      id: "same-id",
      fingerprint: "same-source",
      inputKind: "statement",
      fee: "2.05",
      name: "Alibaba",
      quantity: "not-a-decimal",
    });
    const incoming = fill({
      id: "same-id",
      fingerprint: "same-source",
      inputKind: "screenshot",
      fee: "0",
      name: "名称待行情源补充",
      quantity: "not-a-decimal",
    });

    const result = reconcileExecutions([current], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.automaticReplacementIds).toEqual([]);
    expect(result.duplicates).toEqual([{ kept: current, skipped: incoming }]);
    expect(result.conflicts).toEqual([]);
  });

  it("replaces a current record when the same-ID incoming record is richer", () => {
    const current = fill({
      id: "same-id",
      fingerprint: "same-source",
      inputKind: "screenshot",
      accountId: "unknown",
      accountLabel: "Unknown",
      fee: "0",
      name: "名称待行情源补充",
      price: "0",
    });
    const incoming = fill({
      id: "same-id",
      fingerprint: "same-source",
      inputKind: "statement",
      accountId: "account-0855",
      accountLabel: "Futu · 0855",
      fee: "2.05",
      name: "Alibaba",
      price: "0",
    });

    const result = reconcileExecutions([current], [incoming]);

    expect(result.acceptedIncoming).toEqual([incoming]);
    expect(result.automaticReplacementIds).toEqual([current.id]);
    expect(result.duplicates).toEqual([{ kept: incoming, skipped: current }]);
    expect(result.conflicts).toEqual([]);
  });

  it("does not auto-match a legacy execution without verified source evidence", () => {
    const legacy = fill({ id: "legacy:1" });
    const screenshot = fill({
      id: "image:1",
      fingerprint: "image-source",
      inputKind: "screenshot",
    });

    const result = reconcileExecutions([legacy], [screenshot]);

    expect(result.acceptedIncoming).toEqual([screenshot]);
    expect(result.automaticReplacementIds).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("does not collapse either of two legacy fills when a screenshot overlaps", () => {
    const legacy = [
      fill({ id: "legacy:1", row: 1 }),
      fill({ id: "legacy:2", row: 2 }),
    ];
    const screenshot = fill({
      id: "image:1",
      fingerprint: "image-source",
      inputKind: "screenshot",
    });

    const reconciliation = reconcileExecutions(legacy, [screenshot]);
    const applied = applyReconciliationDecisions(
      legacy,
      reconciliation,
      new Map(),
    );

    expect(applied.currentAfterReplacements).toEqual(legacy);
    expect(applied.incomingToMerge).toEqual([screenshot]);
  });

  it("keep-existing skips only the incoming rows in a conflict", () => {
    const existing = fill({ fingerprint: "statement", quantity: "10" });
    const conflicting = fill({ fingerprint: "image", quantity: "11" });
    const unrelated = fill({
      fingerprint: "image",
      executedAt: "2026-07-31T01:03:03.000Z",
    });
    const reconciliation = reconcileExecutions(
      [existing],
      [conflicting, unrelated],
    );
    const conflictId = reconciliation.conflicts[0].id;

    expect(
      applyReconciliationDecisions(
        [existing],
        reconciliation,
        new Map([[conflictId, "keep-existing"]]),
      ),
    ).toEqual({
      currentAfterReplacements: [existing],
      incomingToMerge: [unrelated],
    });
  });

  it("use-incoming removes only the exact conflicting existing IDs", () => {
    const conflictingExisting = fill({
      fingerprint: "statement",
      quantity: "10",
    });
    const unaffectedExisting = fill({
      fingerprint: "statement",
      executedAt: "2026-07-31T01:03:03.000Z",
    });
    const conflictingIncoming = fill({
      fingerprint: "image",
      quantity: "11",
    });
    const reconciliation = reconcileExecutions(
      [conflictingExisting, unaffectedExisting],
      [conflictingIncoming],
    );
    const conflictId = reconciliation.conflicts[0].id;

    expect(
      applyReconciliationDecisions(
        [conflictingExisting, unaffectedExisting],
        reconciliation,
        new Map([[conflictId, "use-incoming"]]),
      ),
    ).toEqual({
      currentAfterReplacements: [unaffectedExisting],
      incomingToMerge: [conflictingIncoming],
    });
  });

  it("keep-both retains existing and incoming conflict rows", () => {
    const existing = fill({ fingerprint: "statement", quantity: "10" });
    const incoming = fill({ fingerprint: "image", quantity: "11" });
    const reconciliation = reconcileExecutions([existing], [incoming]);
    const conflictId = reconciliation.conflicts[0].id;

    expect(
      applyReconciliationDecisions(
        [existing],
        reconciliation,
        new Map([[conflictId, "keep-both"]]),
      ),
    ).toEqual({
      currentAfterReplacements: [existing],
      incomingToMerge: [incoming],
    });
  });

  it("applies automatic richer-source replacements without a decision", () => {
    const screenshot = fill({
      fingerprint: "image",
      inputKind: "screenshot",
      accountId: "unknown",
      accountLabel: "Unknown",
      fee: "0",
      name: "名称待行情源补充",
    });
    const statement = fill({
      fingerprint: "statement",
      inputKind: "statement",
      accountId: "account-0855",
      accountLabel: "Futu · 0855",
      fee: "2.05",
      name: "Alibaba",
    });
    const reconciliation = reconcileExecutions([screenshot], [statement]);

    expect(
      applyReconciliationDecisions(
        [screenshot],
        reconciliation,
        new Map(),
      ),
    ).toEqual({
      currentAfterReplacements: [],
      incomingToMerge: [statement],
    });
  });

  it("throws when a conflict decision is missing", () => {
    const existing = fill({ fingerprint: "statement", quantity: "10" });
    const incoming = fill({ fingerprint: "image", quantity: "11" });
    const reconciliation = reconcileExecutions([existing], [incoming]);

    expect(() =>
      applyReconciliationDecisions(
        [existing],
        reconciliation,
        new Map(),
      ),
    ).toThrow(/decision.*required/i);
  });

  it("does not mutate input arrays or execution objects", () => {
    const existing = fill({ fingerprint: "statement", quantity: "10" });
    const incoming = fill({ fingerprint: "image", quantity: "11" });
    const current = Object.freeze([Object.freeze(existing)]);
    const additions = Object.freeze([Object.freeze(incoming)]);
    const reconciliation = reconcileExecutions(current, additions);
    const conflictId = reconciliation.conflicts[0].id;

    expect(() =>
      applyReconciliationDecisions(
        current,
        reconciliation,
        new Map([[conflictId, "keep-both"]]),
      ),
    ).not.toThrow();
    expect(current).toEqual([existing]);
    expect(additions).toEqual([incoming]);
  });
});
