import reference from "../../data/confirmed-prelisting-sessions.json";

/** Confirm absence of a regular-market close only within the researched sessions.
 * Symbol reuse and when-issued trading prevent extrapolation from a listing date.
 * This is reference evidence, never a substitute price or a trading calendar.
 */
export function confirmedPrelistingClose(
  instrumentId: string,
  session: string,
): { listingDate: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session)) return null;
  const record = reference.records.find(
    (item) => item.instrumentId === instrumentId &&
      session >= item.validFrom && session <= item.validThrough &&
      session < item.listingDate && item.sessions.includes(session),
  );
  return record ? { listingDate: record.listingDate } : null;
}
