import { describe, expect, it } from "vitest";

import type { ImportExclusion } from "./contracts";
import {
  completionHasPendingEvidence,
  monthlyHasPendingEvidence,
  validImportCompletionEvidence,
  type ImportCompletionEvidence,
} from "./import-completion";
import type { MonthlyStatement } from "./monthly-statement";

const completeEvidence: ImportCompletionEvidence = {
  broker: "futu",
  blocked: false,
  unresolvedInstrumentCount: 0,
  exclusions: [],
};

function monthly(overrides: Partial<MonthlyStatement> = {}): MonthlyStatement {
  return {
    documentId: "source-document",
    templateIds: [],
    positions: [],
    events: [],
    reviewRequired: false,
    ...overrides,
  };
}

describe("import completion evidence", () => {
  it("allows a complete import with no pending records", () => {
    expect(validImportCompletionEvidence(completeEvidence)).toBe(true);
    expect(completionHasPendingEvidence(completeEvidence)).toBe(false);
    expect(monthlyHasPendingEvidence(monthly({ incompleteInstruments: [], historyIncomplete: false }))).toBe(false);
  });

  it.each([
    { broker: "china-merchants", category: "cash", ruleId: "china-merchants/non-trade/cash@1" },
    { broker: "futu", category: "fx", ruleId: "futu/xlsx/non-security/fx@1" },
    { broker: "futu", category: "unknown-asset", ruleId: "futu/pdf/option-section@1" },
    { broker: "tiger", category: "fund", ruleId: "tiger/pdf/fund-section@1" },
  ] as const)("allows the recognized $broker $category exclusion", ({ broker, category, ruleId }) => {
    const evidence: ImportCompletionEvidence = {
      ...completeEvidence,
      broker,
      exclusions: [{ category, label: "Translated display text", count: 2, disposition: "ignored", ruleId }],
    };

    expect(validImportCompletionEvidence(evidence)).toBe(true);
    expect(completionHasPendingEvidence(evidence)).toBe(false);
  });

  it.each([
    { category: "cash", disposition: "pending", ruleId: "futu/xlsx/non-security/cash@1" },
    { category: "cash", ruleId: "futu/xlsx/non-security/cash@1" },
    { category: "cash", disposition: "ignored" },
    { category: "cash", disposition: "ignored", ruleId: "unrecognized-rule@1" },
    { category: "cash", disposition: "ignored", ruleId: "china-merchants/non-trade/cash@1" },
    { category: "bond", disposition: "ignored", ruleId: "futu/xlsx/non-security/cash@1" },
  ] satisfies Omit<ImportExclusion, "count" | "label">[])("keeps an unproven ignored row pending %#", (exclusion) => {
    expect(completionHasPendingEvidence({
      ...completeEvidence,
      exclusions: [{ ...exclusion, label: "现金", count: 1 }],
    })).toBe(true);
  });

  it("does not let an empty presentation exclusion block an otherwise complete file", () => {
    expect(completionHasPendingEvidence({
      ...completeEvidence,
      exclusions: [{ category: "invalid-row", label: "No rows", count: 0, disposition: "pending" }],
    })).toBe(false);
  });

  it.each([
    { blocked: true },
    { unresolvedInstrumentCount: 1 },
    { monthly: monthly({ historyIncomplete: true }) },
    { monthly: monthly({ incompleteInstruments: [{ market: "US", symbol: "AAPL" }] }) },
    { monthly: monthly({ evidenceScope: { accountId: "acct", instrumentId: "US:AAPL" } }) },
  ])("prevents a strong success receipt while source evidence remains incomplete %#", (pending) => {
    const evidence = { ...completeEvidence, ...pending };

    expect(validImportCompletionEvidence(evidence)).toBe(true);
    expect(completionHasPendingEvidence(evidence)).toBe(true);
  });

  it("accepts a full-document monthly result without inventing a pending state", () => {
    expect(completionHasPendingEvidence({ ...completeEvidence, monthly: monthly() })).toBe(false);
  });

  it.each([
    null,
    [],
    "complete",
    { ...completeEvidence, broker: "unknown" },
    { ...completeEvidence, blocked: "false" },
    { ...completeEvidence, unresolvedInstrumentCount: -1 },
    { ...completeEvidence, unresolvedInstrumentCount: 0.5 },
    { ...completeEvidence, unresolvedInstrumentCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...completeEvidence, exclusions: {} },
    { ...completeEvidence, exclusions: [null] },
    { ...completeEvidence, exclusions: [{ category: "unknown", label: "row", count: 1 }] },
    { ...completeEvidence, exclusions: [{ category: "cash", label: 1, count: 1 }] },
    { ...completeEvidence, exclusions: [{ category: "cash", label: "row", count: -1 }] },
    { ...completeEvidence, exclusions: [{ category: "cash", label: "row", count: 1.5 }] },
    { ...completeEvidence, exclusions: [{ category: "cash", label: "row", count: 1, disposition: "complete" }] },
    { ...completeEvidence, exclusions: [{ category: "cash", label: "row", count: 1, ruleId: 12 }] },
    { ...completeEvidence, monthly: { documentId: "missing-required-monthly-fields" } },
  ])("rejects malformed persisted completion evidence %#", (value) => {
    expect(validImportCompletionEvidence(value)).toBe(false);
  });
});
