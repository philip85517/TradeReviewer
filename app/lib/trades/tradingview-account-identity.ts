import { tradeNatureOf, type TradeEpisode, type TradeExecution } from "./types";

export const TRADINGVIEW_CANONICAL_ACCOUNT_ID = "tradingview:simulation:default" as const;
export const TRADINGVIEW_CANONICAL_ACCOUNT_LABEL = "TradingView · 模拟盘" as const;

export type TradingViewAccountIdentity = Readonly<{
  canonicalAccountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  canonicalAccountLabel: typeof TRADINGVIEW_CANONICAL_ACCOUNT_LABEL;
  tradeNature: "simulation";
}>;

export type TradingViewBusinessScope = Readonly<{
  accountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  tradeNature: "simulation";
  /** Canonical account scope is whole-account; source runs are provenance. */
  simulationRunId: null;
}>;

export type TradingViewExecutionIdentityBlockerCode =
  | "missing-account-id"
  | "platform-mismatch"
  | "live-execution"
  | "unknown-nature"
  | "nature-conflict"
  | "missing-source-run"
  | "source-run-conflict";

export type TradingViewExecutionIdentityResult =
  | Readonly<{
      eligible: true;
      identity: TradingViewAccountIdentity;
      originalAccountId: string;
      sourceRunId: string;
    }>
  | Readonly<{
      eligible: false;
      code: TradingViewExecutionIdentityBlockerCode;
      executionId: string;
    }>;

type SourceWithLegacyRun = TradeExecution["source"] & { run?: unknown };

function sourceRunCandidates(execution: TradeExecution): { simulationRunId: string; legacyRun: string } {
  const source = execution.source as SourceWithLegacyRun;
  const simulationRunId = typeof source.simulationRunId === "string" ? source.simulationRunId : "";
  const legacyRun = typeof source.run === "string" ? source.run : "";
  return { simulationRunId, legacyRun };
}

/** Returns the original source run without treating it as a business account. */
export function tradingViewSourceRun(execution: TradeExecution): string | null {
  const { simulationRunId, legacyRun } = sourceRunCandidates(execution);
  if (simulationRunId.trim() && legacyRun.trim() && simulationRunId.trim() !== legacyRun.trim()) return null;
  return simulationRunId.trim() ? simulationRunId : legacyRun.trim() ? legacyRun : null;
}

/**
 * Classifies one execution for the canonical-account preview.
 *
 * The classification intentionally uses the explicit nature fields from the
 * record. A TradingView platform by itself is not enough evidence to turn a
 * row into simulated data.
 */
export function classifyTradingViewExecution(execution: TradeExecution): TradingViewExecutionIdentityResult {
  const source = execution.source;
  const explicitNature = source.tradeNature;
  const legacyNature = source.tradingNature;
  const natureConflict = Boolean(
    (explicitNature === "simulation" && legacyNature && legacyNature !== "simulated") ||
      (explicitNature && explicitNature !== "simulation" && legacyNature === "simulated"),
  );
  const nature = tradeNatureOf(execution);

  if (!execution.accountId.trim()) return { eligible: false, code: "missing-account-id", executionId: execution.id };
  if (natureConflict) return { eligible: false, code: "nature-conflict", executionId: execution.id };
  if (nature === "live") return { eligible: false, code: "live-execution", executionId: execution.id };
  if (nature === "unknown") return { eligible: false, code: "unknown-nature", executionId: execution.id };
  if (source.platform.trim().toLowerCase() !== "tradingview") return { eligible: false, code: "platform-mismatch", executionId: execution.id };

  const { simulationRunId, legacyRun } = sourceRunCandidates(execution);
  if (simulationRunId.trim() && legacyRun.trim() && simulationRunId.trim() !== legacyRun.trim()) return { eligible: false, code: "source-run-conflict", executionId: execution.id };
  if (!simulationRunId.trim() && !legacyRun.trim()) return { eligible: false, code: "missing-source-run", executionId: execution.id };
  const sourceRunId = simulationRunId.trim() ? simulationRunId : legacyRun;

  return {
    eligible: true,
    identity: {
      canonicalAccountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      canonicalAccountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
      tradeNature: "simulation",
    },
    originalAccountId: execution.accountId,
    sourceRunId,
  };
}

/** True when the execution is eligible for the canonical TradingView account. */
export function isCanonicalTradingViewExecution(execution: TradeExecution): boolean {
  return classifyTradingViewExecution(execution).eligible;
}

/**
 * True only for an execution already projected into the canonical business
 * account. The broader helper above keeps its historical meaning (eligible
 * for migration) for old accounts.
 */
export function isCanonicalTradingViewAccountExecution(execution: TradeExecution): boolean {
  return execution.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID &&
    classifyTradingViewExecution(execution).eligible;
}

/**
 * Build the pure domain shadow used to preview the account migration. Only
 * the business account fields change; source run, IDs, financial evidence,
 * and the original execution remain intact for audit and persistence.
 */
export function canonicalizeTradingViewExecution(execution: TradeExecution): TradeExecution | null {
  const result = classifyTradingViewExecution(execution);
  if (!result.eligible) return null;
  return {
    ...execution,
    accountId: result.identity.canonicalAccountId,
    accountLabel: result.identity.canonicalAccountLabel,
    source: { ...execution.source },
    instrument: { ...execution.instrument },
  };
}

/**
 * Identifies a domain episode that is already in the canonical TradingView
 * account scope. Every execution must carry the same strict identity proof;
 * checking only accountId would allow a conflicting live/platform row to
 * inherit the whole-account grouping.
 */
export function isCanonicalTradingViewEpisode(
  episode: Pick<TradeEpisode, "accountId" | "tradeNature" | "executions">,
): boolean {
  return episode.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID &&
    episode.tradeNature === "simulation" &&
    episode.executions.length > 0 &&
    episode.executions.every(isCanonicalTradingViewAccountExecution);
}

/**
 * Return the business scope for a canonical episode. `null` is deliberate:
 * callers must not fall back to `executions[0].source.simulationRunId` for a
 * canonical whole-account episode. Legacy/non-canonical episodes return null
 * so their existing run-scoped handling remains unchanged.
 */
export function tradingViewEpisodeBusinessScope(
  episode: Pick<TradeEpisode, "accountId" | "tradeNature" | "executions">,
): TradingViewBusinessScope | null {
  if (!isCanonicalTradingViewEpisode(episode)) return null;
  return {
    accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    tradeNature: "simulation",
    simulationRunId: null,
  };
}
