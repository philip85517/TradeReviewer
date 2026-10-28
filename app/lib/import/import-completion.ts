import type { ImportExclusion, StatementBroker } from "./contracts";
import { isMonthlyStatement, type MonthlyStatement } from "./monthly-statement";

/** Stable parser decisions, independent of translated display labels. */
const rules: Record<string, { broker: StatementBroker; category: ImportExclusion["category"] }> = {
  ...Object.fromEntries((["fund", "repo", "subscription", "corporate-action", "cash", "market", "bond"] as const).map(category => [`china-merchants/non-trade/${category}@1`, { broker: "china-merchants", category }])),
  ...Object.fromEntries((["fund", "fx", "bond", "cash"] as const).map(category => [`futu/xlsx/non-security/${category}@1`, { broker: "futu", category }])),
  "futu/pdf/fund-section@1": { broker: "futu", category: "fund" },
  "futu/pdf/option-section@1": { broker: "futu", category: "unknown-asset" },
  "futu/pdf/explicit-derivative@1": { broker: "futu", category: "unknown-asset" },
  "tiger/pdf/fund-section@1": { broker: "tiger", category: "fund" },
};

export type ImportCompletionEvidence = {
  broker: StatementBroker;
  blocked: boolean;
  unresolvedInstrumentCount: number;
  /** Ungrouped enrichment output; presentation summaries cannot erase pending rows. */
  exclusions: ImportExclusion[];
  monthly?: MonthlyStatement;
};

export function monthlyHasPendingEvidence(monthly: Pick<MonthlyStatement, "historyIncomplete" | "incompleteInstruments" | "evidenceScope">) {
  return monthly.historyIncomplete === true || !!monthly.incompleteInstruments?.length || monthly.evidenceScope !== undefined;
}

export function completionHasPendingEvidence(evidence: ImportCompletionEvidence) {
  return evidence.blocked || evidence.unresolvedInstrumentCount > 0 || !!evidence.monthly && monthlyHasPendingEvidence(evidence.monthly)
    || evidence.exclusions.some(exclusion => {
      const rule = exclusion.ruleId ? rules[exclusion.ruleId] : undefined;
      return exclusion.count > 0 && (exclusion.disposition !== "ignored" || !rule || rule.broker !== evidence.broker || rule.category !== exclusion.category);
    });
}

export function validImportCompletionEvidence(value: unknown): value is ImportCompletionEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return ["futu", "tiger", "china-merchants", "tradingview"].includes(String(item.broker))
    && typeof item.blocked === "boolean" && Number.isSafeInteger(item.unresolvedInstrumentCount) && Number(item.unresolvedInstrumentCount) >= 0
    && Array.isArray(item.exclusions) && item.exclusions.every(exclusion => !!exclusion && typeof exclusion === "object"
      && ["market", "fund", "fx", "bond", "repo", "cash", "corporate-action", "subscription", "unknown-asset", "invalid-row"].includes(exclusion.category)
      && typeof exclusion.label === "string" && Number.isSafeInteger(exclusion.count) && exclusion.count >= 0
      && (exclusion.disposition === undefined || ["ignored", "pending"].includes(exclusion.disposition))
      && (exclusion.ruleId === undefined || typeof exclusion.ruleId === "string"))
    && (item.monthly === undefined || isMonthlyStatement(item.monthly));
}
