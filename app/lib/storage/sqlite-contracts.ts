import type { TagSuggestionRecord } from "../insights/types";
import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { ResolvedInstrument } from "../instruments/metadata-contracts";
import type { Instrument, TradeExecution } from "../trades/types";
import type { ChartSettings } from "./chart-settings";
import type { ImportHistoryEntry } from "./import-history";
import type { MarketDataJob } from "./market-data-jobs";
import type { EpisodeReviewState } from "./review-storage";

export type CoverageRecord = {
  instrumentId: string;
  adjustmentMode: "raw";
  startDate?: string;
  endDate?: string;
  /** Complete legacy coverage evidence, retained during browser-to-SQLite migration. */
  segments?: CoverageSegment[];
};

export type ProviderSymbolRecord = {
  instrumentId: string;
  provider: string;
  providerSymbol: string;
  metadata?: Record<string, unknown>;
};

export type StorageMigrationStatus = MigrationReport | null;

export type StorageBootstrap = {
  schemaVersion: number;
  migration: StorageMigrationStatus;
  executions: TradeExecution[];
  importHistory: ImportHistoryEntry[];
  instruments: StoredInstrument[];
  reviews: EpisodeReviewRecord[];
  reviewStates: EpisodeReviewState[];
  tagSuggestions: TagSuggestionRecord[];
  marketDataJobs: MarketDataJob[];
  settings: Record<string, unknown>;
};

export type InstrumentMetadataRead = {
  instruments: StoredInstrument[];
};

export type BrowserStatePayload = {
  version: 1;
  sourceClientId: string;
  sourceFingerprint: string;
  executions: TradeExecution[];
  importHistory: ImportHistoryEntry[];
  instruments: StoredInstrument[];
  reviews: EpisodeReviewRecord[];
  reviewStates: EpisodeReviewState[];
  tagSuggestions: TagSuggestionRecord[];
  marketDataJobs: MarketDataJob[];
  settings: ChartSettings | Record<string, unknown>;
  dailyCandles: DailyCandleRecord[];
  marketCandles: MarketCandleRecord[];
  coverage: CoverageRecord[];
  intervalCoverage: Array<IntervalCoverageSegment & {
    instrumentId: string;
    adjustmentMode?: "raw";
  }>;
  providerSymbols: ProviderSymbolRecord[];
};

export type MigrationReport = {
  sourceFingerprint: string;
  inserted: number;
  duplicate: number;
  conflict: number;
  failed: number;
  validationDigest: string;
};

export type ExecutionMergeReport = Pick<MigrationReport, "inserted" | "duplicate" | "conflict">;

export type SqliteStatus = {
  schemaVersion: number;
  migration: StorageMigrationStatus;
  counts: Record<string, number>;
};
export type StoredInstrument = Instrument & {
  metadata?: ResolvedInstrument;
};

// Browser-safe DTOs. Runtime storage modules are deliberately type-only imports here.
import type { BookVersion } from "./trade-book-version";
import type { TradeRevisionRequest, TradeRevision } from "./trade-revisions";
import type { MaterialVersionInput, MissingExecutionDependency, MissingExecutionDecision } from "./source-materials";
import type { ExecutionConflict, ReconciliationDecision } from "../import/execution-reconciliation";
export type StandardTradeChangeIntent = {
  kind: "import";
  candidates: TradeExecution[];
  fileImport?: import("../import/file-fingerprint").FileContentIdentity & { complete: boolean; evidence?: import("../import/import-completion").ImportCompletionEvidence };
  tradingViewImport?: TradingViewImportInput;
  instruments?: StoredInstrument[];
  materials?: MaterialVersionInput[];
  importHistory?: ImportHistoryEntry[];
} | {
  kind: "revision";
  revision: TradeRevisionRequest;
  materials?: MaterialVersionInput[];
  reactivateExecutionIds?: string[];
} | {
  kind: "material";
  materials: MaterialVersionInput[];
  reactivateExecutionIds?: string[];
};
/** Fixed maintenance scopes. Callers cannot supply rows, SQL or application callbacks. */
export type TradingViewMaintenanceIntent = {
  kind: "tradingview-account-migration";
  operationId: string;
} | {
  kind: "tradingview-account-migration-rollback";
  operationId: string;
  rollbackOperationId: string;
  expectedAfterSnapshotDigest?: string;
};
export type TradingViewMaintenanceRequest = import("./tradingview-account-migration-contracts").TradingViewMigrationCommitRequest
  | import("./tradingview-account-migration-contracts").TradingViewMigrationRollbackRequest;
export type TradeChangeIntent = StandardTradeChangeIntent | TradingViewMaintenanceIntent;
export type TradeChangeChoices = {
  conflicts?: {
    conflictId: string;
    decision: ReconciliationDecision;
    reason?: string;
  }[];
  missingExecutions?: MissingExecutionDecision[];
  reactivateExecutions?: {
    executionId: string;
    action: "activate" | "keep-withdrawn";
    reason?: string;
  }[];
};
export type ReviewConflict = ExecutionConflict & {
  allowed: ReconciliationDecision[];
};
/** Critical persisted fact values; an unknown legacy value remains null. */
export type ReviewFactValues = {
  instrumentId: string;
  accountId: string | null;
  side: string;
  quantity: string;
  price: string;
  fee: string | null;
  executedAt: string;
  currency: string | null;
};
export type ReviewChange = {
  kind: "add" | "replace" | "revise" | "withdraw" | "reactivate" | "material-version" | "link";
  executionId?: string;
  materialId?: string;
  versionId?: string;
  observationId?: string;
  previousVersionId?: string | null;
  before?: ReviewFactValues | null;
  after?: ReviewFactValues | null;
  when?: {
    conflictId: string;
    decisions: ReconciliationDecision[];
  } | {
    missingExecutionId: string;
    action: "withdraw";
  } | {
    reactivateExecutionId: string;
    action: "activate";
  };
};
export type TradingViewMaterialHandling =
  | { kind: "reuse-exact-or-propose" } | { kind: "independent" }
  | { kind: "new-version"; materialId: string; expectedCurrentVersionId: string };
export type TradingViewIdentitySelection = { kind: "keep-independent"; reviewPlanId: string; inputDigest: string; candidateIds: string[] };
export type TradingViewImportInput = { policy: "tv-import-v1"; evidence?: import("../import/contracts").TradingViewDecodedEvidence; material: TradingViewMaterialHandling; identity?: TradingViewIdentitySelection };
export type TradingViewRawRun = { kind: "absent" } | { kind: "present"; raw: string };
export type TradingViewIdentityScope = { accountId: string; instrumentId: string; market: string; currency: string; nature: "simulation" | "live" | "unknown"; rawRun: TradingViewRawRun };
export type TradingViewIdentityReview = {
  id: string; kind: "unproven-source-declaration" | "same-id-scope-conflict";
  incomingIds: string[]; existingIds: string[];
  incomingScopes: TradingViewIdentityScope[]; existingScopes: TradingViewIdentityScope[];
  locator: { kind: "tv-source-slot-v1"; fileFingerprint: string; market: string; symbol: string; sourceTradeId: string; role: "entry" | "exit" } | { kind: "execution-id"; executionId: string };
  reasons: ("account" | "instrument" | "nature" | "run" | "locator-ambiguous" | "proof-unavailable")[];
  allowed: ["keep-independent"];
};
export type TradingViewImportSummary = {
  policy: "tv-import-v1";
  facts: { accepted: number; duplicate: number; conflict: number };
  identity: { kind: "unchanged" } | { kind: "kept-independent"; bindings: { candidateId: string; factId: string }[]; resolvedFrom: Omit<TradingViewIdentitySelection, "kind"> };
  material: { kind: "normalized-only"; reason: "legacy-no-decoded-observations" }
    | { kind: "reuse-exact"; materialId: string; versionId: string; semanticDigest: string }
    | { kind: "save-evidence"; materialId: string; versionId: string; semanticDigest: string; reason: "first-evidence" | "independent" | "explicit-new-version"; observations: number; links: number };
};
/** Only display facts from server reconciliation; no arbitrary source metadata. */
export type ImportDuplicateFact = {
  accountId: string; accountLabel: string;
  instrument: { id: string; symbol: string; name: string; market: string; currency: string };
  executedAt: string; side: "buy" | "sell"; quantity: string; price: string; fee: string | null;
  source: { platform: string; fileName: string | null; page: number | null; row: number };
};
export type ImportDuplicateSummary = {
  policy: "import-duplicate-review-v1"; count: number;
  pairs: { kept: ImportDuplicateFact; skipped: ImportDuplicateFact }[];
};
export type ReviewSummary = {
  importDuplicates?: ImportDuplicateSummary;
  tradingViewImport?: TradingViewImportSummary;
  candidateCount: number;
  inputDigest: string;
  changes: ReviewChange[];
};
export type TradeChangeDiagnostic = {
  code: string;
  locator: string;
  detail: string;
};
type ReviewPlanBase = {
  planId: string;
  policy: "trade-changes-v1";
  baseVersion: BookVersion;
  createdAt: string;
  expiresAt: string;
  kind: TradeChangeIntent["kind"] | "browser-migration";
  summary: ReviewSummary;
  diagnostics: TradeChangeDiagnostic[];
  conflicts: ReviewConflict[];
  missingExecutions: MissingExecutionDependency[];
  reactivateExecutionIds: string[];
  tradingView?: import("./tradingview-account-migration-contracts").TradingViewMigrationPreview
    | import("./tradingview-account-migration-contracts").TradingViewMigrationRollbackPreview;
};
/** Legacy DTOs remain readable; any v2 marker requires the complete v2 branch. */
export type ReviewPlan = ReviewPlanBase & (
  | { reviewContract?: never; status?: never; identityReviews?: never; tvImportGuard?: never }
  | { reviewContract: "trade-review-v2"; status: "ready" | "review-required"; identityReviews: TradingViewIdentityReview[]; tvImportGuard?: { policy: "tv-compat-v1" } }
);
export type CommitReceipt = {
  receiptId: string;
  planId: string;
  policy: "trade-changes-v1";
  committedAt: string;
  bookVersion: BookVersion;
  result: {
    report: ExecutionMergeReport;
    appliedChanges: ReviewChange[];
    importedFile?: import("../import/file-fingerprint").FileContentIdentity;
    tradingViewImport?: TradingViewImportSummary;
    revision?: TradeRevision;
    migration?: MigrationReport;
    tradingView?: import("./tradingview-account-migration-contracts").TradingViewMigrationCommitResult
      | import("./tradingview-account-migration-contracts").TradingViewMigrationRollbackResult;
  };
};
export type TradeChangeCommit = {
  requestId: string;
  planId: string;
  choices: TradeChangeChoices;
  maintenanceRequest?: TradingViewMaintenanceRequest;
};
export type TradeChanges = {
  prepare(intent: TradeChangeIntent): ReviewPlan;
  commit(input: TradeChangeCommit): CommitReceipt;
  getCommit(requestId: string): CommitReceipt | null;
  cleanupExpired(): number;
};
export type TradeChangeOptions = {
  ttlMs?: number;
  maxCandidates?: number;
  maxPlanBytes?: number;
  now?: () => number;
};
export type TradeChangeErrorCategory =
  | "input" | "domain" | "conflict"
  | "storage-busy" | "storage-unavailable" | "unexpected";

/** Explicit origin for Store's validation/rule authority. Never inferred from text. */
export class TradeChangeRuleError extends Error {
  readonly category: "input" | "domain";
  constructor(
    category: "input" | "domain",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TradeChangeRuleError";
    this.category = category;
  }
}

const TRADE_CHANGE_INPUT_CODES = new Set([
  "INVALID_INPUT", "INVALID_CHOICES", "INVALID_OPTIONS", "PLAN_CAPACITY", "INVALID_INSTRUMENT_NAME",
]);
const TRADE_CHANGE_CONFLICT_CODES = new Set([
  "BOOK_VERSION_CHANGED", "VERSION_REQUIRED", "REQUEST_CONFLICT", "PLAN_CONSUMED", "PLAN_EXPIRED",
  "FILE_ALREADY_IMPORTED", "FILE_TRADES_ALREADY_EXIST", "POLICY_CHANGED", "DEPENDENCIES_CHANGED", "REVISION_CONFLICT", "MATERIAL_BRANCH_CHANGED",
]);
const TRADE_CHANGE_SAFE_MESSAGES: Record<TradeChangeErrorCategory, string> = {
  input: "Trade change input is invalid.",
  domain: "Trade change requires domain review.",
  conflict: "Trade change prerequisites changed; prepare again.",
  "storage-busy": "Trade storage is busy; retry this request.",
  "storage-unavailable": "Trade storage is unavailable.",
  unexpected: "Trade change could not be completed.",
};
function tradeChangeErrorCategory(code: string): TradeChangeErrorCategory {
  if (TRADE_CHANGE_INPUT_CODES.has(code)) return "input";
  if (TRADE_CHANGE_CONFLICT_CODES.has(code)) return "conflict";
  if (code === "STORAGE_BUSY") return "storage-busy";
  if (code === "STORAGE_UNAVAILABLE" || code === "BOOK_VERSION_UNAVAILABLE") return "storage-unavailable";
  if (code === "UNEXPECTED_FAILURE" || code === "PLAN_CORRUPT" || code === "INSTRUMENT_NAME_SAVE_FAILED") return "unexpected";
  return "domain";
}
export class TradeChangeError extends Error {
  readonly retryable: boolean;
  readonly savedState = "Previous saved data is unchanged.";
  readonly code: string;
  readonly category: TradeChangeErrorCategory;
  readonly phase: "prepare" | "commit" | "compatibility" | "name";
  readonly correlationId: string;
  readonly locators: string[];
  constructor(
    code: string,
    phase: "prepare" | "commit" | "compatibility" | "name",
    message: string,
    correlationId: string,
    locators: string[] = [],
    options: ErrorOptions & { category?: TradeChangeErrorCategory; retryable?: boolean } = {},
  ) {
    const category = options.category ?? tradeChangeErrorCategory(code);
    // Storage/internal exceptions can include SQL, paths or account values. Only
    // their internal cause retains those details; public messages are fixed.
    super(category === "storage-busy" || category === "storage-unavailable" || category === "unexpected"
      ? TRADE_CHANGE_SAFE_MESSAGES[category] : message, options);
    this.name = "TradeChangeError";
    this.code = code;
    this.category = category;
    this.phase = phase;
    this.correlationId = correlationId;
    this.locators = locators;
    this.retryable = options.retryable ?? category === "storage-busy";
  }
  /** Safe HTTP payload. The original cause is deliberately absent. */
  toJSON() {
    return {
      code: this.code, category: this.category, phase: this.phase,
      message: TRADE_CHANGE_SAFE_MESSAGES[this.category], retryable: this.retryable,
      correlationId: this.correlationId, locators: this.locators, savedState: this.savedState,
    };
  }
}
/** A state decision preserves the exact stored fact, including an unknown account.
 * Empty account strings never leave the SQLite encoding boundary.
 */
export type FactStateAudit = {
  kind: "fact-state-audit-v1";
  id: string;
  executionId: string;
  instrumentId: string;
  accountId: string | null;
  action: "withdraw" | "activate";
  reason: string;
  recordedAt: string;
  before: import("./stored-trade-snapshot").StoredTradeFact;
  changes: {
    before: import("./stored-trade-snapshot").StoredTradeFact;
    after: import("./stored-trade-snapshot").StoredTradeFact | null;
  }[];
};
