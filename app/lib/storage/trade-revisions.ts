import type { ImportHistoryEntry } from "./import-history";
import type { TradeExecution } from "../trades/types";
export type TradeChange = { before: TradeExecution | null; after: TradeExecution | null };
export type TradeRevisionRequest = { id: string; instrumentId: string; accountId: string; reason: string; changes: TradeChange[]; expectedScope?: TradeExecution[]; importHistory?: ImportHistoryEntry };
export type TradeRevision = TradeRevisionRequest & { recordedAt: string };
export type TradeRevisionResult = { executions: TradeExecution[]; revision: TradeRevision };

/** Canonical JSON is used for optimistic full-record comparison, not identity. */
export function canonicalRecord(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRecord).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).filter(([, v]) => v !== undefined).map(([k, v]) => `${JSON.stringify(k)}:${canonicalRecord(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
