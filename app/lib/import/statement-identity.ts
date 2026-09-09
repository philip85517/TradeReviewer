import type { TradeExecution } from "../trades/types";
import type { MonthlyStatement } from "./monthly-statement";

/** Document IDs are broker-qualified; legacy fixtures may use a bare fingerprint. */
export function belongsToMonthlyDocument(execution: TradeExecution, monthly: MonthlyStatement): boolean {
  const fingerprint = execution.source.fileFingerprint;
  return Boolean(fingerprint && (monthly.documentId === fingerprint || monthly.documentId === `${execution.source.platform}:${fingerprint}`));
}
