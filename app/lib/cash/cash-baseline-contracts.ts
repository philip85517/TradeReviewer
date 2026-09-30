import type {
  CashBaselineRecord,
  CashBaselineState,
  CashCurrency,
  CashScope,
} from "./cash-model";

/**
 * The JSON envelope intentionally keeps the v1 `version` and `records` shape
 * so old readers can still calculate cash.  `history` is append-only metadata
 * consumed by the revision API and audit views.
 */
export type CashBaselineHistoryRecord = {
  id: string;
  accountId: string;
  currency: CashCurrency;
  scope: CashScope;
  balance: string;
  asOf: string;
  source: string;
  revision: number;
  recordedAt: string;
};

export type CashBaselineStorageState = CashBaselineState & {
  history: CashBaselineHistoryRecord[];
};

export type CashBaselineFilter = {
  accountId?: string;
  nature?: CashScope["nature"];
  simulationRunId?: string | null;
};

export type CashBaselineMutation = {
  /** Canonical account/currency/scope key is resolved by the store. */
  id?: string;
  scope: CashScope;
  accountId: string;
  currency: CashCurrency;
  balance: string;
  asOf: string;
  source: string;
  /** null is required when creating; a number is required when revising. */
  expectedRevision: number | null;
};

export type CashBaselineMutationResult = {
  state: CashBaselineStorageState;
  record: CashBaselineRecord;
  previous: CashBaselineRecord | null;
};

export function emptyCashBaselineStorageState(): CashBaselineStorageState {
  return { version: 1, records: [], history: [] };
}
