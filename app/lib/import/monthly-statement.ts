/** Evidence retained with an imported monthly statement, independent of executions. */
export type StatementFragment = { page: number; row: number; role?: string };
export type StatementPosition = {
  /** Originating statement, retained when this snapshot is attached to another document's fill. */
  documentId?: string;
  accountId: string;
  market: string;
  symbol: string;
  phase: "opening" | "closing";
  date: string;
  quantity: string;
  /** A closing/mark price is never an acquisition cost. */
  cost?: string;
  source: StatementFragment[];
};
export type StatementEvent = {
  /** Originating statement; enables replacement when the same document is reparsed. */
  documentId?: string;
  id: string;
  accountId: string;
  market?: string;
  symbol?: string;
  date: string;
  kind: "transfer-in" | "transfer-out" | "distribution" | "fee" | "ipo" | "corporate-action" | "other";
  quantity?: string;
  amount?: string;
  currency?: string;
  /** IPO allotments are displayed on the first candle of the trading session. */
  displayTimePolicy?: "session-open";
  description: string;
  source: StatementFragment[];
};
export type MonthlyStatement = {
  documentId: string;
  templateIds: string[];
  month?: string;
  accountId?: string;
  timePolicy?: string;
  positions: StatementPosition[];
  events: StatementEvent[];
  reviewRequired: boolean;
  /** An unresolved position row without a trustworthy instrument identity. */
  historyIncomplete?: boolean;
  /** Unresolved position rows whose instrument can be identified reliably. */
  incompleteInstruments?: { market: string; symbol: string }[];
};
export type StatementTimeOptions = {
  /** Explicit user choice for a statement without trustworthy source-zone evidence. */
  sourceTimezone?: string;
  /** Override document legend only after an explicit source-time review. */
  overrideDocumentTimezone?: boolean;
};

export function isMonthlyStatement(value: unknown): value is MonthlyStatement {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const optionalString = (object: Record<string, unknown>, key: string) => object[key] === undefined || typeof object[key] === "string";
  const fragments = (value: unknown) => Array.isArray(value) && value.every(f => f && typeof f === "object" && Number.isInteger(f.page) && f.page > 0 && Number.isFinite(f.row) && f.row >= 0);
  if (item.historyIncomplete !== undefined && typeof item.historyIncomplete !== "boolean") return false;
  if (item.incompleteInstruments !== undefined && (!Array.isArray(item.incompleteInstruments) || !item.incompleteInstruments.every(i => i && typeof i === "object" && typeof i.market === "string" && typeof i.symbol === "string"))) return false;
  if (typeof item.documentId !== "string" || !Array.isArray(item.templateIds) || !item.templateIds.every(t => typeof t === "string") || typeof item.reviewRequired !== "boolean" || !["month", "accountId", "timePolicy"].every(k => optionalString(item, k))) return false;
  if (!Array.isArray(item.positions) || !item.positions.every(p => p && typeof p === "object" && ["accountId", "market", "symbol", "date", "quantity"].every(k => typeof p[k] === "string") && (p.phase === "opening" || p.phase === "closing") && ["cost", "documentId"].every(k => optionalString(p, k)) && fragments(p.source))) return false;
  return Array.isArray(item.events) && item.events.every(e => e && typeof e === "object" && ["id", "accountId", "date", "description"].every(k => typeof e[k] === "string") && ["transfer-in", "transfer-out", "distribution", "fee", "ipo", "corporate-action", "other"].includes(e.kind) && ["market", "symbol", "quantity", "amount", "currency", "documentId"].every(k => optionalString(e, k)) && (e.displayTimePolicy === undefined || e.displayTimePolicy === "session-open") && fragments(e.source));
}
