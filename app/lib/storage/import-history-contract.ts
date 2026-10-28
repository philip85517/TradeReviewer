import { isMonthlyStatement, type MonthlyStatement } from "../import/monthly-statement";
import type { TradeNature } from "../trades/types";
import type { BookVersion } from "./trade-book-version";

export type ImportHistoryCommitRead = {
  batchId: string;
  bookVersion: BookVersion;
  committedDuplicateTradeCount?: number;
};

export type ImportHistoryEntry = {
  monthly?: MonthlyStatement;
  id: string;
  fileName: string;
  sourceLabel: string;
  tradingNature?: "simulated" | "live" | "unknown";
  importedAt: string;
  firstTradeAt?: string;
  lastTradeAt?: string;
  tradeCount: number;
  instrumentCount: number;
  excludedInstrumentCount: number;
  excludedRecordCount: number;
  duplicateTradeCount: number;
  /** Read-only formal result; duplicateTradeCount retains the original preview estimate. */
  committedDuplicateTradeCount?: number;
  unresolvedInstrumentCount: number;
  sourceKind?: "statement" | "screenshot" | "tradingview";
  tradeNature?: TradeNature;
  simulationRunId?: string;
  captureCount?: number;
  conflictTradeCount?: number;
};

const COUNT_FIELDS = [
  "tradeCount", "instrumentCount", "excludedInstrumentCount", "excludedRecordCount",
  "duplicateTradeCount", "unresolvedInstrumentCount", "captureCount", "conflictTradeCount",
] as const;

/** Strict legacy boundary check; unlike loadImportHistory it never defaults malformed fields. */
export function isLegacyImportHistoryEntry(value: unknown): value is ImportHistoryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.monthly !== undefined && !isMonthlyStatement(candidate.monthly)) return false;
  if (typeof candidate.id !== "string" || typeof candidate.fileName !== "string" || typeof candidate.importedAt !== "string" || typeof candidate.tradeCount !== "number" || !Number.isFinite(candidate.tradeCount) || candidate.tradeCount < 0 || typeof candidate.instrumentCount !== "number" || !Number.isFinite(candidate.instrumentCount) || candidate.instrumentCount < 0 || typeof candidate.excludedInstrumentCount !== "number" || !Number.isFinite(candidate.excludedInstrumentCount) || candidate.excludedInstrumentCount < 0) return false;
  if (candidate.sourceLabel !== undefined && typeof candidate.sourceLabel !== "string") return false;
  if (candidate.firstTradeAt !== undefined && typeof candidate.firstTradeAt !== "string") return false;
  if (candidate.lastTradeAt !== undefined && typeof candidate.lastTradeAt !== "string") return false;
  if (candidate.sourceKind !== undefined && candidate.sourceKind !== "statement" && candidate.sourceKind !== "screenshot" && candidate.sourceKind !== "tradingview") return false;
  if (candidate.tradeNature !== undefined && candidate.tradeNature !== "live" && candidate.tradeNature !== "simulation" && candidate.tradeNature !== "unknown") return false;
  if (candidate.simulationRunId !== undefined && typeof candidate.simulationRunId !== "string") return false;
  return COUNT_FIELDS.every((field) => candidate[field] === undefined || (typeof candidate[field] === "number" && Number.isFinite(candidate[field]) && candidate[field] >= 0));
}

