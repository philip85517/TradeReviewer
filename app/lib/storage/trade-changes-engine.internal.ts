/** Internal coordinator. Only Store constructs the closed application port. */
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { ensureImportHistoryAudit } from "./import-history-audit";
import { assertBookVersion, readBookVersion } from "./trade-book-version";
import { TradingViewMigrationTransactionError, normalizeTradingViewMaintenanceRequest } from "./tradingview-account-migration-contracts";
import {
  TradeChangeError,
  TradeChangeRuleError,
  type TradeChangeChoices,
  type TradeChangeCommit,
  type TradeChangeIntent,
  type TradingViewMaintenanceRequest,
  type ReviewPlan,
  type ReviewChange,
  type CommitReceipt,
  type TradeChangeOptions,
} from "./sqlite-contracts";

type Phase = "prepare" | "commit";
export type InternalIntent = TradeChangeIntent | {
  kind: "browser-migration";
  payload: import("./sqlite-contracts").BrowserStatePayload;
};
export type StandardInternalIntent = Exclude<InternalIntent, import("./sqlite-contracts").TradingViewMaintenanceIntent>;
export type VerifiedIdentityReviewParent<P> = Readonly<{ identityReviewSource: Readonly<{ planId: string; bodyDigest: string; review: ReviewPlan; prepared: P }> }>;
type Preparation<P> = {
  body: P;
  review: Pick<ReviewPlan, "conflicts" | "missingExecutions" | "reactivateExecutionIds" | "diagnostics" | "tradingView"> & {
    changes: ReviewChange[];
    status?: "ready" | "review-required";
    identityReviews?: import("./sqlite-contracts").TradingViewIdentityReview[];
    tradingViewImport?: import("./sqlite-contracts").TradingViewImportSummary;
    importDuplicates?: import("./sqlite-contracts").ImportDuplicateSummary;
    tvImportGuard?: { policy: "tv-compat-v1" };
  };
};
/** Fixed operations only: the port never accepts SQL or a caller-supplied callback. */
export type TradeChangePort<S, P> = {
  validate(intent: InternalIntent): number;
  copy(): S;
  prepare(snapshot: S, intent: InternalIntent, context?: VerifiedIdentityReviewParent<P>): Preparation<P>;
  apply(body: P, choices: TradeChangeChoices, auditId: string, recordedAt: string, maintenanceRequest: TradingViewMaintenanceRequest | undefined, review: ReviewPlan): CommitReceipt["result"];
  /** Store's fixed implementation validates its complete closure after all engine writes. */
  assertAfter?(body: P, result: CommitReceipt["result"]): void;
  /** Capture the current closed domain before a consumed-plan alias's sole write. */
  beforeReplay?(body: P): void;
  /** A fixed maintenance operation may have been reversed since its receipt was issued. */
  assertReplay?(receipt: CommitReceipt): void;
};

/** Full input binding uses the engine canonicalizer, not the material exclusions. */
export function canonicalOriginalImport(intent: InternalIntent): string {
  const original = JSON.parse(JSON.stringify(intent)) as InternalIntent;
  if (original.kind === "import" && original.tradingViewImport) delete original.tradingViewImport.identity;
  return canonical(original);
}
export function tradeChangeInputDigest(value: unknown): string { return digest(value); }

function fail(code: string, phase: Phase, message: string): never {
  throw new TradeChangeError(code, phase, message, randomUUID());
}
function boundary<T>(phase: Phase, work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof TradeChangeError) throw error;
    if (error instanceof TradingViewMigrationTransactionError) throw error;
    if (error instanceof TradeChangeRuleError) {
      throw new TradeChangeError(error.category === "input" ? "INVALID_INPUT" : "TRADE_RULE_REJECTED",
        phase, error.message, randomUUID(), [], { category: error.category, cause: error });
    }
    const native = error instanceof Error ? error as Error & { code?: string; errcode?: number } : null;
    const sqliteCode = native?.code === "ERR_SQLITE_ERROR" && typeof native.errcode === "number"
      ? native.errcode & 0xff : null;
    // Extended SQLite result codes retain the same primary failure family.
    // BUSY/LOCKED are safe to retry. Read-only/closed/corrupt/IO failures require
    // operational recovery, so a blind retry is not promised.
    let code = "UNEXPECTED_FAILURE";
    if (native?.code === "BOOK_VERSION_CHANGED" || native?.code === "BOOK_VERSION_UNAVAILABLE") {
      code = native.code;
    } else if (sqliteCode === 5 || sqliteCode === 6) {
      code = "STORAGE_BUSY";
    } else if ((sqliteCode !== null && [8, 10, 11, 13, 14, 15, 26].includes(sqliteCode))
      || native?.code === "ERR_INVALID_STATE") {
      code = "STORAGE_UNAVAILABLE";
    }
    throw new TradeChangeError(code, phase, "Trade change failed", randomUUID(), [], { cause: error });
  }
}

/** TS optional object fields are omitted; arrays and persisted values must be JSON. */
function plain(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!value || typeof value !== "object" || seen.has(value)) {
    fail("INVALID_INPUT", "prepare", "Expected finite, acyclic JSON");
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    fail("INVALID_INPUT", "prepare", "Expected plain JSON");
  }
  seen.add(value);
  for (const entry of Object.values(value)) {
    if (entry === undefined && !Array.isArray(value)) continue;
    plain(entry, seen);
  }
  seen.delete(value);
}
function canonical(value: unknown): string {
  plain(value);
  const sorted = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(sorted);
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(Object.entries(entry)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sorted(item)]));
    }
    return entry;
  };
  return JSON.stringify(sorted(value));
}
function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
/** Shared persistence proof; callers supply values, never executable application work. */
export function tradeChangeChoicesDigest(choices: TradeChangeChoices, maintenanceRequest?: Readonly<Record<string, unknown>>): string {
  return digest(maintenanceRequest === undefined ? choices : { choices, maintenanceRequest });
}
function detached<T>(value: T): T {
  plain(value);
  return JSON.parse(JSON.stringify(value));
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function normalizeChoices(value: TradeChangeChoices): TradeChangeChoices {
  try { plain(value); } catch {
    fail("INVALID_CHOICES", "commit", "Review choices must be finite, acyclic JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["conflicts", "missingExecutions", "reactivateExecutions"].includes(key))) {
    fail("INVALID_CHOICES", "commit", "Invalid review choices");
  }
  for (const field of ["conflicts", "missingExecutions", "reactivateExecutions"] as const) {
    if (value[field] !== undefined && !Array.isArray(value[field])) {
      fail("INVALID_CHOICES", "commit", "Invalid choice collection");
    }
  }
  return {
    conflicts: (value.conflicts ?? []).map(choice => {
      if (!choice || Object.keys(choice).some(key => !["conflictId", "decision", "reason"].includes(key))
        || typeof choice.conflictId !== "string"
        || !["keep-existing", "use-incoming", "keep-both"].includes(choice.decision)
        || choice.reason !== undefined && typeof choice.reason !== "string") {
        fail("INVALID_CHOICES", "commit", "Invalid conflict choice");
      }
      return {...choice, reason: choice.reason?.trim() ?? ""};
    }).sort((left, right) => left.conflictId.localeCompare(right.conflictId)),
    missingExecutions: (value.missingExecutions ?? []).map(choice => {
      if (!choice || Object.keys(choice).some(key => !["executionId", "action", "reason"].includes(key))
        || typeof choice.executionId !== "string" || !["keep", "withdraw"].includes(choice.action)
        || choice.reason !== undefined && typeof choice.reason !== "string") {
        fail("INVALID_CHOICES", "commit", "Invalid missing execution choice");
      }
      return {...choice, reason: choice.reason?.trim() ?? ""};
    }).sort((left, right) => left.executionId.localeCompare(right.executionId)),
    reactivateExecutions: (value.reactivateExecutions ?? []).map(choice => {
      if (!choice || Object.keys(choice).some(key => !["executionId", "action", "reason"].includes(key))
        || typeof choice.executionId !== "string" || !["activate", "keep-withdrawn"].includes(choice.action)
        || choice.reason !== undefined && typeof choice.reason !== "string") {
        fail("INVALID_CHOICES", "commit", "Invalid activation choice");
      }
      return {...choice, reason: choice.reason?.trim() ?? ""};
    }).sort((left, right) => left.executionId.localeCompare(right.executionId)),
  };
}
function validateChoices(review: ReviewPlan, choices: TradeChangeChoices): void {
  const exact = (actual: string[], expected: string[]) => actual.length === new Set(actual).size
    && canonical([...actual].sort()) === canonical([...expected].sort());
  if (!exact((choices.conflicts ?? []).map(choice => choice.conflictId), review.conflicts.map(conflict => conflict.id))
    || !exact((choices.missingExecutions ?? []).map(choice => choice.executionId), review.missingExecutions.map(item => item.executionId))
    || !exact((choices.reactivateExecutions ?? []).map(choice => choice.executionId), review.reactivateExecutionIds)) {
    fail("INVALID_CHOICES", "commit", "Every required choice must be supplied exactly once");
  }
  for (const choice of choices.conflicts ?? []) {
    const conflict = review.conflicts.find(item => item.id === choice.conflictId)!;
    if (!conflict.allowed.includes(choice.decision) || choice.decision === "use-incoming" && !choice.reason) {
      fail("INVALID_CHOICES", "commit", "Choice is not allowed or lacks a replacement reason");
    }
  }
  for (const choice of choices.missingExecutions ?? []) {
    if (choice.action === "withdraw" && !choice.reason) fail("INVALID_CHOICES", "commit", "Withdrawal requires a reason");
  }
  for (const choice of choices.reactivateExecutions ?? []) {
    if (choice.action === "activate" && !choice.reason) fail("INVALID_CHOICES", "commit", "Activation requires a reason");
  }
}

export function createTradeChangeEngine<S, P>(database: DatabaseSync, port: TradeChangePort<S, P>, options: TradeChangeOptions = {}) {
  const ttl = options.ttlMs ?? 900000;
  const maxCandidates = options.maxCandidates ?? 10000;
  const maxBytes = options.maxPlanBytes ?? 16777216;
  const now = options.now ?? Date.now;
  for (const limit of [ttl, maxCandidates, maxBytes]) {
    if (!Number.isSafeInteger(limit) || limit < 1) fail("INVALID_OPTIONS", "prepare", "Plan limits must be finite positive integers");
  }
  const clock = () => {
    const timestamp = now();
    if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) fail("INVALID_OPTIONS", "prepare", "Invalid clock");
    return timestamp;
  };
  const transaction = <T>(work: () => T): T => {
    database.exec("begin immediate");
    try {
      const result = work();
      ensureImportHistoryAudit(database);
      database.exec("commit");
      return result;
    } catch (error) {
      if (database.isTransaction) {
        try { database.exec("rollback"); } catch { /* Preserve the original failure and its origin. */ }
      }
      throw error;
    }
  };
  const receipt = (id: string): CommitReceipt => JSON.parse(String(database
    .prepare("select receipt_json from trade_change_receipts where id = ?").get(id)!.receipt_json));
  const getCommit = (requestId: string): CommitReceipt | null => boundary("commit", () => {
    const row = database.prepare("select receipt_id from trade_change_requests where request_id = ?").get(requestId);
    return row ? freeze(receipt(String(row.receipt_id))) : null;
  });

  return {
    prepare(intent: InternalIntent): ReviewPlan {
      return boundary("prepare", () => {
        plain(intent);
        if (!intent || typeof intent !== "object" || Array.isArray(intent)
          || !["import", "revision", "material", "browser-migration", "tradingview-account-migration", "tradingview-account-migration-rollback"].includes(intent.kind)) {
          fail("INVALID_INPUT", "prepare", "Invalid trade intent");
        }
        const selection = intent.kind === "import" ? intent.tradingViewImport?.identity : undefined;
        let parent: VerifiedIdentityReviewParent<P> | undefined;
        const readParent = () => {
          if (!selection) return;
          if (selection.kind !== "keep-independent" || typeof selection.reviewPlanId !== "string" || typeof selection.inputDigest !== "string"
            || !Array.isArray(selection.candidateIds) || !selection.candidateIds.length || selection.candidateIds.some(id => typeof id !== "string" || !id.trim())
            || new Set(selection.candidateIds).size !== selection.candidateIds.length) fail("INVALID_IDENTITY_REVIEW", "prepare", "Invalid identity review selection");
          const row = database.prepare("select * from trade_change_plans where id=?").get(selection.reviewPlanId);
          if (!row || row.receipt_id || row.policy !== "trade-changes-v1" || typeof row.body_json !== "string" || Date.parse(String(row.expires_at)) <= clock()) fail("IDENTITY_REVIEW_STALE", "prepare", "Identity review expired or changed; prepare again");
          const bodyDigest = createHash("sha256").update(String(row.body_json)).digest("hex");
          if (bodyDigest !== row.body_digest) fail("PLAN_CORRUPT", "prepare", "Stored identity review checksum failed");
          const stored = JSON.parse(String(row.body_json)) as { review: ReviewPlan; prepared: P };
          if (stored.review.planId !== selection.reviewPlanId || stored.review.reviewContract !== "trade-review-v2" || stored.review.status !== "review-required"
            || stored.review.tvImportGuard?.policy !== "tv-compat-v1" || stored.review.summary.inputDigest !== selection.inputDigest) fail("INVALID_IDENTITY_REVIEW", "prepare", "Selection does not reference an unresolved TV review");
          assertBookVersion(database, stored.review.baseVersion);
          if (parent && parent.identityReviewSource.bodyDigest !== bodyDigest) fail("IDENTITY_REVIEW_STALE", "prepare", "Parent review changed");
          parent = freeze(detached({ identityReviewSource: { planId: selection.reviewPlanId, bodyDigest, ...stored } }));
        };
        let count = 0;
        if (!selection) count = port.validate(intent);
        // Only raw copying occurs under the read lock. Matching and hashing run after COMMIT.
        database.exec("begin");
        let snapshot: S;
        let baseVersion: ReturnType<typeof readBookVersion>;
        try {
          readParent();
          if (selection) count = port.validate(intent);
          if (count > maxCandidates) fail("PLAN_CAPACITY", "prepare", "Too many import candidates");
          baseVersion = readBookVersion(database);
          snapshot = port.copy();
          database.exec("commit");
        } catch (error) {
          if (database.isTransaction) {
            try { database.exec("rollback"); } catch { /* Preserve the original read failure. */ }
          }
          throw error;
        }
        const prepared = port.prepare(snapshot, detached(intent), parent);
        const stamp = clock();
        if (!Number.isFinite(stamp + ttl) || Math.abs(stamp + ttl) > 8.64e15) {
          fail("INVALID_OPTIONS", "prepare", "Plan expiration is outside the supported clock range");
        }
        const {changes, tradingViewImport, importDuplicates, status = "ready", identityReviews = [], ...reviewFields} = prepared.review;
        const review: ReviewPlan = {
          planId: randomUUID(), policy: "trade-changes-v1", baseVersion, kind: intent.kind,
          createdAt: new Date(stamp).toISOString(), expiresAt: new Date(Math.min(stamp + ttl, parent ? Date.parse(parent.identityReviewSource.review.expiresAt) : Infinity)).toISOString(),
          reviewContract: "trade-review-v2", status, identityReviews,
          summary: {candidateCount: count, inputDigest: digest(intent), changes, ...(importDuplicates ? { importDuplicates } : {}), ...(tradingViewImport ? { tradingViewImport } : {})}, ...reviewFields,
        };
        const body = JSON.stringify({review, prepared: prepared.body});
        if (Buffer.byteLength(body) > maxBytes) fail("PLAN_CAPACITY", "prepare", "Review plan exceeds storage limit");
        const persisted = transaction(() => {
          assertBookVersion(database, baseVersion);
          readParent();
          if (intent.kind === "tradingview-account-migration" || intent.kind === "tradingview-account-migration-rollback") {
            const prior = database.prepare(`select body_json,body_digest from trade_change_plans
              where body_json is not null and json_extract(body_json,'$.review.kind')=?
              and json_extract(body_json,'$.prepared.tradingView.intent.operationId')=?
              and (? is null or json_extract(body_json,'$.prepared.tradingView.intent.rollbackOperationId')=?)
              order by rowid limit 1`).get(intent.kind,intent.operationId,
                intent.kind === "tradingview-account-migration-rollback" ? intent.rollbackOperationId : null,
                intent.kind === "tradingview-account-migration-rollback" ? intent.rollbackOperationId : null);
            if (prior) {
              if (createHash("sha256").update(String(prior.body_json)).digest("hex") !== prior.body_digest) fail("PLAN_CORRUPT","prepare","Stored plan checksum failed");
              const stored = JSON.parse(String(prior.body_json)) as {review:ReviewPlan};
              if (stored.review.summary.inputDigest !== digest(intent)) fail("REQUEST_CONFLICT","prepare","Operation is bound to a different maintenance scope");
              return stored.review;
            }
          }
          database.prepare(`
            insert into trade_change_plans(id,policy,created_at,expires_at,body_json,body_digest)
            values(?,?,?,?,?,?)
          `).run(review.planId, review.policy, review.createdAt, review.expiresAt, body,
            createHash("sha256").update(body).digest("hex"));
          return review;
        });
        return freeze(detached(persisted));
      });
    },
    commit(input: TradeChangeCommit): CommitReceipt {
      return boundary("commit", () => {
        if (!input || typeof input.requestId !== "string" || !input.requestId.trim() || input.requestId.length > 200
          || typeof input.planId !== "string" || !input.planId.trim()
          || Object.keys(input).some(key => !["requestId", "planId", "choices", "maintenanceRequest"].includes(key))) {
          fail("INVALID_INPUT", "commit", "Invalid commit request");
        }
        const normalized = normalizeChoices(input.choices);
        const maintenanceRequest = input.maintenanceRequest === undefined ? undefined : normalizeTradingViewMaintenanceRequest(input.maintenanceRequest);
        const requestDigest = digest({planId: input.planId, choices: normalized, maintenanceRequest});
        const choiceDigest = tradeChangeChoicesDigest(normalized, maintenanceRequest);
        return transaction(() => {
          // Request identity and consumed-plan aliases are resolved before policy, TTL or version checks.
          const prior = database.prepare("select request_digest,receipt_id from trade_change_requests where request_id=?").get(input.requestId);
          if (prior) {
            if (prior.request_digest !== requestDigest) fail("REQUEST_CONFLICT", "commit", "Request ID was used for different content");
            const result = receipt(String(prior.receipt_id));
            port.assertReplay?.(result);
            return freeze(result);
          }
          const row = database.prepare("select * from trade_change_plans where id=?").get(input.planId);
          if (!row) fail("PLAN_NOT_FOUND", "commit", "Review plan does not exist");
          // The engine owns this table. Capture before any application/receipt write;
          // the sole allowed delta comes from its inputs, never a post-trigger readback.
          const requestAliases = () => database.prepare("select * from trade_change_requests").all();
          const aliasesBefore = requestAliases();
          const assertAlias = (receiptId: string) => {
            const expected = [...aliasesBefore, {
              request_id: input.requestId, request_digest: requestDigest, receipt_id: receiptId,
            }];
            if (digest(requestAliases().map(value => digest(value)).sort()) !== digest(expected.map(value => digest(value)).sort())) {
              fail("COMMIT_ALIAS_CHANGED", "commit", "Commit request aliases changed beyond the expected request binding");
            }
          };
          const alias = (id: string) => database.prepare(`
            insert into trade_change_requests(request_id,request_digest,receipt_id) values(?,?,?)
          `).run(input.requestId, requestDigest, id);
          if (row.receipt_id) {
            if (row.choices_digest !== choiceDigest) fail("PLAN_CONSUMED", "commit", "Plan was consumed with different choices");
            const body = String(row.body_json);
            if (createHash("sha256").update(body).digest("hex") !== row.body_digest) fail("PLAN_CORRUPT", "commit", "Stored plan checksum failed");
            const stored = JSON.parse(body) as {prepared: P};
            const version = readBookVersion(database);
            const result = receipt(String(row.receipt_id));
            port.assertReplay?.(result);
            port.beforeReplay?.(stored.prepared);
            alias(String(row.receipt_id));
            port.assertAfter?.(stored.prepared, result.result);
            assertAlias(String(row.receipt_id));
            assertBookVersion(database, version);
            return freeze(result);
          }
          if (!row.body_json || Date.parse(String(row.expires_at)) <= clock()) fail("PLAN_EXPIRED", "commit", "Review plan expired; prepare again");
          if (row.policy !== "trade-changes-v1") fail("POLICY_CHANGED", "commit", "Plan policy is unsupported");
          const body = String(row.body_json);
          if (createHash("sha256").update(body).digest("hex") !== row.body_digest) fail("PLAN_CORRUPT", "commit", "Stored plan checksum failed");
          const stored = JSON.parse(body) as {review: ReviewPlan; prepared: P};
          if (stored.review.status === "review-required") fail("TRADINGVIEW_SOURCE_REVIEW_REQUIRED", "commit", "Resolve source identity with a new prepare before committing");
          if ((stored.review.reviewContract !== undefined || stored.review.tvImportGuard !== undefined || stored.review.summary.tradingViewImport !== undefined) && (stored.review.reviewContract !== "trade-review-v2" || stored.review.status !== "ready" || !Array.isArray(stored.review.identityReviews) || stored.review.identityReviews.length)) fail("POLICY_CHANGED", "commit", "Plan readiness is unsupported; prepare again");
          validateChoices(stored.review, normalized);
          assertBookVersion(database, stored.review.baseVersion);
          const stamp = new Date(clock()).toISOString();
          const id = randomUUID();
          const result = port.apply(stored.prepared, normalized, `trade-change:${id}`, stamp, input.maintenanceRequest, stored.review);
          const resultReceipt: CommitReceipt = {
            receiptId: id, planId: input.planId, policy: "trade-changes-v1", committedAt: stamp,
            bookVersion: readBookVersion(database), result,
          };
          database.prepare("insert into trade_change_receipts(id,plan_id,receipt_json) values(?,?,?)")
            .run(id, input.planId, canonical(resultReceipt));
          database.prepare("update trade_change_plans set receipt_id=?,choices_digest=? where id=?")
            .run(id, choiceDigest, input.planId);
          alias(id);
          port.assertAfter?.(stored.prepared, result);
          assertAlias(id);
          assertBookVersion(database, resultReceipt.bookVersion);
          return freeze(detached(resultReceipt));
        });
      });
    },
    getCommit,
    cleanupExpired(): number {
      return boundary("commit", () => transaction(() => Number(database.prepare(`
        update trade_change_plans set body_json=null
        where receipt_id is null and body_json is not null and expires_at <= ?
      `).run(new Date(clock()).toISOString()).changes)));
    },
  };
}
