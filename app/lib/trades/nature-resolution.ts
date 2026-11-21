import Decimal from "decimal.js";
import {isExecutionBackedIpoAllocation} from "../import/statement-evidence";
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

/** Compatibility for a provenance-audited manual import contract, not a broker whitelist. */
export function hasVerifiedIpoImportEvidence(execution: TradeExecution): boolean {
  const s=execution.source;
  if(s.platform!=='futu'||s.inputKind!=='statement'||s.formatRuleId!=='manual/verified-ipo-allotment@1'||!s.fileFingerprint||!/^[a-f0-9]{64}$/i.test(s.fileFingerprint)||execution.side!=='buy'||s.positionEffect!=='open-long'||s.displayTimePolicy!=='session-open')return false;
  try {
    const quantity=new Decimal(execution.quantity);
    if(!quantity.isFinite()||!quantity.isPositive())return false;
    const day=s.tradingDate??s.marketCalendarDate??execution.executedAt.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||!Number.isFinite(Date.parse(execution.executedAt)))return false;
    // The amount-only allocation match deduplicates inventory, but cannot prove
    // source identity. Force the reference/trusted-row branch for classification.
    const matches=(s.positionEvents??[]).filter(e=>e.kind==='ipo'&&e.quantity!==undefined&&e.date===day&&new Decimal(e.quantity).eq(quantity)&&isExecutionBackedIpoAllocation({...e,amount:undefined},[execution]));
    return new Set(matches.map(e=>e.id)).size===1;
  } catch {return false;}
}

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
  if(hasVerifiedIpoImportEvidence(execution))return 'live';
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
