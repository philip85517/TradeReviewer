import Decimal from "decimal.js";

/** Parses a reported scalar without changing the original evidence or fee status. */
export function parseNonNegativeFee(raw: unknown, Arithmetic = Decimal): Decimal | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const fee = new Arithmetic(raw);
    return fee.isFinite() && fee.gte(0) ? fee : null;
  } catch {
    return null;
  }
}
