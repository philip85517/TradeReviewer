import type { TradeEpisode, TradeExecution, TradeNature } from "./types";

// Exact contracts emitted by supported import adapters. A broker name alone
// cannot establish the nature of a historical execution.
const legacyLiveRules: Readonly<Record<string, ReadonlySet<string>>> = {
  futu: new Set([
    "futu/pdf/f0-contract-date@1",
    "futu/pdf/f1-execution@1",
    "futu/pdf/f2-order-time@1",
    "futu/pdf/f3-order-total@1",
    "futu/pdf/f4-cash-detail@1",
    "futu/xlsx/trades-v1",
  ]),
  tiger: new Set(["tiger/pdf/monthly-v1"]),
  "china-merchants": new Set(["china-merchants/pdf/monthly-v1"]),
};

/** Read-only business nature. Never use this result to rewrite persisted identity. */
export function resolvedTradeNatureOf(execution: TradeExecution): TradeNature {
  const source = execution.source;
  const declared = source.tradeNature;
  const legacy = source.tradingNature === "simulated" ? "simulation" : source.tradingNature;
  if (declared === "unknown" || legacy === "unknown") return "unknown";
  if (declared !== undefined && legacy !== undefined && declared !== legacy) return "unknown";
  const explicit = declared ?? legacy;
  const simulationEvidence = source.platform === "tradingview" || source.inputKind === "tradingview" ||
    source.simulationRunId !== undefined || source.simulationTradeId !== undefined ||
    source.simulationRole !== undefined || source.simulationSignal !== undefined ||
    source.simulationReport !== undefined || source.sourceReport !== undefined;
  if (explicit !== undefined) return explicit === "live" && simulationEvidence ? "unknown" : explicit;
  // Preserve the established display of legacy TradingView imports, without
  // changing their declared identity or simulation ordering semantics.
  if (source.platform === "tradingview" && source.inputKind !== "screenshot") return "simulation";
  if (simulationEvidence || (source.inputKind !== undefined && source.inputKind !== "statement")) return "unknown";
  return source.fileFingerprint?.trim() && source.formatRuleId && Object.hasOwn(legacyLiveRules, source.platform) && legacyLiveRules[source.platform].has(source.formatRuleId)
    ? "live" : "unknown";
}

/** An unknown or contradictory member prevents an aggregate from claiming live. */
export function resolvedTradeNatureOfExecutions(executions: readonly TradeExecution[]): TradeNature {
  if (!executions.length) return "unknown";
  const nature = resolvedTradeNatureOf(executions[0]);
  return executions.every(execution => resolvedTradeNatureOf(execution) === nature) ? nature : "unknown";
}

export function resolvedEpisodeTradeNatureOf(
  episode: Pick<TradeEpisode, "executions" | "tradeNature">,
): TradeNature {
  // Empty display projections may retain their own declared metadata, but
  // cannot acquire a nature from an enclosing entry without member evidence.
  return episode.executions.length ? resolvedTradeNatureOfExecutions(episode.executions) : episode.tradeNature ?? "unknown";
}
