import Decimal from "decimal.js";

import type { StatementEvent } from "../import/monthly-statement";
import { canonicalInstrumentId } from "../instruments/display-name";

/**
 * A bonus-share event is inventory evidence only when the statement says both
 * what was credited and that no cash moved. A displayed/reference price in the
 * description is intentionally ignored: it is not an acquisition basis.
 */
export function isBonusShareEvidence(event: StatementEvent): boolean {
  if (event.kind !== "corporate-action" || !event.market || !event.symbol || !event.currency) return false;
  if (!/(?:红股|送股|bonus\s+shares?|stock\s+dividend)/iu.test(event.description)) return false;
  if (event.quantity === undefined || event.amount === undefined) return false;
  try {
    return new Decimal(event.quantity).isPositive() && new Decimal(event.amount).isZero();
  } catch {
    return false;
  }
}

function canonicalDecimal(value: string): string {
  try {
    return new Decimal(value).toString();
  } catch {
    return value.trim();
  }
}

function canonicalInstrument(event: StatementEvent): string {
  return event.market && event.symbol
    ? canonicalInstrumentId(event.symbol, event.market)
    : "";
}

/** A semantic key identifies one source row across execution attachments. */
export function bonusShareEvidenceKey(event: StatementEvent): string {
  return JSON.stringify([
    event.accountId,
    canonicalInstrument(event),
    event.date,
    canonicalDecimal(event.quantity ?? ""),
    canonicalDecimal(event.amount ?? ""),
    event.currency?.trim().toUpperCase() ?? "",
  ]);
}

export type BonusShareEvidenceCollection = {
  /** One canonical event per source row; repeated references are removed. */
  events: StatementEvent[];
  /** Semantic keys with distinct source IDs, which must remain unavailable. */
  duplicateKeys: string[];
};

/**
 * Collect bonus evidence without adding quantities for repeated attachments.
 * The same event ID is a repeated reference and is safe to collapse. Distinct
 * IDs for the same source row are retained as a safety signal: the quantity is
 * still applied once, but consumers must fail closed for cost/PnL.
 */
export function collectBonusShareEvidence(
  events: readonly StatementEvent[],
): BonusShareEvidenceCollection {
  const byReference = new Map<string, { event: StatementEvent; key: string }>();
  const canonical = new Map<string, StatementEvent>();
  const duplicateKeys = new Set<string>();

  for (const event of events) {
    if (!isBonusShareEvidence(event)) continue;
    const key = bonusShareEvidenceKey(event);
    const referenceKey = JSON.stringify([event.accountId, canonicalInstrument(event), event.id]);
    const previousByReference = byReference.get(referenceKey);
    if (previousByReference) {
      if (previousByReference.key !== key) {
        duplicateKeys.add(previousByReference.key);
        duplicateKeys.add(key);
      }
      continue;
    }
    byReference.set(referenceKey, { event, key });
    const previous = canonical.get(key);
    if (previous) {
      if (previous.id !== event.id) duplicateKeys.add(key);
      continue;
    }
    canonical.set(key, event);
  }

  return { events: [...canonical.values()], duplicateKeys: [...duplicateKeys] };
}
