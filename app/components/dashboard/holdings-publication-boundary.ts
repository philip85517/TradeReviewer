/**
 * The import/holdings producer owns this permit. A readable cache entry is
 * deliberately not a permit: consumers may only replace their accepted
 * financial bundle after the producer has reached a terminal receipt and its
 * exact financial reread has returned.
 */
export type HoldingsPublicationOwner = "import" | "holdings-refresh" | "fx";

export type HoldingsPublicationStatus =
  | "pending"
  | "complete"
  | "partial"
  | "failed"
  | "cancelled";

export type HoldingsPublicationReceipt = {
  requestedAtByInstrument: Readonly<Record<string, string | undefined>>;
  dailyStatusByInstrument?: Readonly<Record<string, string | undefined>>;
};

export type HoldingsPublicationPermit = {
  /** Monotonic publication generation. A generation can be consumed once. */
  generation: number;
  /** The import or source revision that created this candidate. */
  revision: string;
  owner: HoldingsPublicationOwner;
  affectedInstrumentIds: readonly string[];
  /** IDs for which the producer must have a durable daily receipt. */
  requiredMarketDataIds: readonly string[];
  /** IDs successfully reread after the producer terminal boundary. */
  readbackInstrumentIds: readonly string[];
  status: HoldingsPublicationStatus;
  receipt?: HoldingsPublicationReceipt;
};

export const TERMINAL_HOLDINGS_PUBLICATION_STATUSES = new Set<HoldingsPublicationStatus>([
  "complete",
  "partial",
  "failed",
  "cancelled",
]);

export function isTerminalHoldingsPublication(
  permit: HoldingsPublicationPermit | null | undefined,
): boolean {
  return Boolean(permit && TERMINAL_HOLDINGS_PUBLICATION_STATUSES.has(permit.status));
}

/**
 * A permit is publishable only for a scope it affects and only after every
 * affected instrument has crossed the exact readback boundary. Required
 * producer receipts are checked independently so a stale cache key cannot
 * masquerade as a fresh import result.
 */
export function isPublishableHoldingsPublication(
  permit: HoldingsPublicationPermit | null | undefined,
  scopeInstrumentIds: ReadonlySet<string>,
): boolean {
  if (!permit || !isTerminalHoldingsPublication(permit)) return false;
  if (permit.status !== "complete" && permit.status !== "partial") return false;
  if (!permit.affectedInstrumentIds.some(id => scopeInstrumentIds.has(id))) return false;

  const readbackIds = new Set(permit.readbackInstrumentIds);
  if (!permit.affectedInstrumentIds.every(id => readbackIds.has(id))) return false;
  const receipt = permit.receipt;
  if (!receipt) return false;
  return permit.requiredMarketDataIds.every(id => receipt.requestedAtByInstrument[id] !== undefined);
}

/**
 * A terminal permit that still cannot cross the readback boundary needs a new
 * producer generation when the caller is retrying an affected scope. Pending
 * work and permits for another scope must remain owned by their existing
 * producer and must not be replaced by an unrelated retry.
 */
export function needsHoldingsPublicationRetry(
  permit: HoldingsPublicationPermit | null | undefined,
  scopeInstrumentIds: ReadonlySet<string>,
): boolean {
  if (!permit || !isTerminalHoldingsPublication(permit)) return false;
  if (!permit.affectedInstrumentIds.some(id => scopeInstrumentIds.has(id))) return false;
  return !isPublishableHoldingsPublication(permit, scopeInstrumentIds);
}
