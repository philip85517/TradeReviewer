export type ScenarioId = "reference" | "pagination" | "empty" | "slow" | "retry" | "stale" | "not-found" | "version-expired" | "extreme" | "explicit-end-price";
export type Fact<T> = { state: "known"; value: T } | { state: "unknown"; reasonCode: string; reason: string };
export type Money = Fact<{ amount: string; currency: string }>;
export type PracticeKey = { practiceId: string; revisionId: string; practiceVersion: string };
export type Scope = { from: string; to: string; market: string; accountId: string; search: string };
export type PracticeQuery = Scope & { sort: "date-asc" | "date-desc"; pageIndex: number; pageSize: 6 };
export type ReadContext = { signal: AbortSignal; snapshotVersion?: string };
export type LibraryOptions = {
  snapshotVersion: string;
  defaultScope: Scope;
  markets: readonly { id: string; label: string }[];
  accounts: readonly { id: string; label: string }[];
};
export type PracticeRow = {
  key: PracticeKey;
  instrument: { id: string; symbol: string; name: string; market: string };
  account: { id: string; label: string };
  sequence: number;
  practiceDate: string;
  practiceDateSource: string;
  historicalFrom: string;
  historicalTo: string;
  importedAt: string;
  displayTimezone: string;
  executionCount: number;
  pairCount: Fact<number>;
  openQuantity: Fact<string>;
  net: Money;
  returnRate: Fact<string>;
};
export type PracticePage = {
  query: PracticeQuery;
  rows: readonly PracticeRow[];
  pageCount: number;
  totalCount: number;
  calculableCount: number;
  unknownCount: number;
  scopeNet: Money;
  scopeWinRate: Fact<string>;
  snapshotVersion: string;
};
export type PairPage = {
  key: PracticeKey;
  snapshotVersion: string;
  pageIndex: number;
  pageCount: number;
  totalCount: number;
  rows: readonly { pairId: string; key: PracticeKey; openedAt: string; closedAt: string; quantity: string; net: Money }[];
  completeness: Fact<"complete" | "partial">;
};
export type PracticeDetail = {
  practice: PracticeRow;
  snapshotVersion: string;
  source: { name: string; format: string };
  financial: {
    realizedGross: Money;
    unrealizedGross: Money;
    totalFees: Money;
    practiceNet: Money;
    closedNet: Money;
    closedFees: Money;
    retainedOpenFees: Money;
    returnRate: Fact<string>;
  };
  capital: { value: Money; origin: "default" | "custom"; version: string };
  endValuation: Fact<{ price: string; currency: string; barEnd: string }>;
  pairs: PairPage;
  actions: readonly { id: string; label: string; available: boolean; reasonCode: string; reason: string }[];
};
export type PreviewLocation = {
  scenario: ScenarioId;
  query: PracticeQuery;
  detail?: PracticeKey | { practiceId: string };
};
export type LibraryReadErrorCode = "network" | "forbidden" | "contract" | "not-found" | "version-expired";
export class LibraryReadError extends Error {
  constructor(public readonly code: LibraryReadErrorCode, message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "LibraryReadError";
  }
}
export interface LibraryReadPort {
  readOptions(input: { mode: "simulation"; from: string; to: string }, context: ReadContext): Promise<LibraryOptions>;
  readPracticePage(query: PracticeQuery, context: ReadContext): Promise<PracticePage>;
  readPracticeDetail(key: { practiceId: string } & Partial<Omit<PracticeKey, "practiceId">>, context: ReadContext): Promise<PracticeDetail>;
  readPairPage(key: PracticeKey, page: { pageIndex: number; pageSize: 6 }, context: ReadContext): Promise<PairPage>;
}
