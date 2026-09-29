import Decimal from 'decimal.js';
import { calculateRecallPlan } from './plans';
import { replayPositionAtPrice } from '../replay/position-ledger';
import { executionBoundaryForCursor, orderedRecallExecutions, visibleRecallExecutions } from '../replay/recall-replay';
import { replayExecutionAt, replayCursorAt } from '../import/statement-evidence';
import { hasSettlementCurrencyMismatch, tradeNatureOf, type TradeEpisode } from '../trades/types';
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID, tradingViewEpisodeBusinessScope } from '../trades/tradingview-account-identity';
import type { RecallDecision, RecallPhase, RecallPlanVersion, RecallRiskBaseline } from './types';
export type RecallActualMetricKey = 'remainingQuantity' | 'averageEntryPrice' | 'weightedExitPrice' | 'realizedGross' | 'realizedNet' | 'unrealizedGross' | 'remainingEntryFee' | 'totalFees' | 'netPnl' | 'actualR' | 'entryPriceDeviation' | 'quantityDeviation' | 'targetRealization';
export type RecallActualMetric = {
    value: string | null;
    reason: string | null;
    currency: string | null;
    unit: string;
    methodVersion: 'actual-v1';
};
export type RecallActualExitAllocation = {
    executionId: string;
    decisionId: string | null;
    quantity: string;
    entryFee: RecallActualMetric;
    exitFee: RecallActualMetric;
    grossPnl: RecallActualMetric;
    netPnl: RecallActualMetric;
};
export type RecallActualMetricsInput = {
    episode: TradeEpisode;
    decisions: readonly RecallDecision[];
    planVersions: readonly RecallPlanVersion[];
    riskBaselines: readonly RecallRiskBaseline[];
    context: {
        phase: RecallPhase;
        cursor: string;
        executionCursor: string;
    };
    mark?: {
        price: string;
        time: string;
        priceBasis: 'raw' | 'adjusted';
    };
    source: {
        documentRevision: number;
        evidenceDigest: string;
        bundleId?: string;
        computedAt: string;
    };
};
export type RecallActualMetrics = {
    methodVersion: 'actual-v1';
    source: RecallActualMetricsInput['source'];
    metrics: Record<RecallActualMetricKey, RecallActualMetric>;
    exitAllocations: RecallActualExitAllocation[];
    denominator: {
        riskBaselineId: string;
        planVersionId: string;
        amount: string;
        currency: string;
        scope: 'decision' | 'episode';
        method: 'planned-price-risk' | 'fixed-budget';
    } | null;
    executionIds: string[];
    planVersionIds: string[];
    riskBaselineIds: string[];
};
// Supported settlement currencies only. Partial allocation truncates toward zero at
// the currency minor unit; the final close absorbs the exact remaining fee pool.
const MINOR_UNITS: Readonly<Record<string, number>> = { CNY: 2, HKD: 2, USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, SGD: 2, CHF: 2, JPY: 0, KRW: 0, KWD: 3, BHD: 3 };
const keys: RecallActualMetricKey[] = ['remainingQuantity', 'averageEntryPrice', 'weightedExitPrice', 'realizedGross', 'realizedNet', 'unrealizedGross', 'remainingEntryFee', 'totalFees', 'netPnl', 'actualR', 'entryPriceDeviation', 'quantityDeviation', 'targetRealization'];
function parseDecimal(value: string | null | undefined, Constructor = Decimal): Decimal | null {
    try {
        if (!value?.trim())
            return null;
        const d = new Constructor(value);
        return d.isFinite() ? d : null;
    }
    catch {
        return null;
    }
}
export function calculateRecallActualMetrics(input: RecallActualMetricsInput): RecallActualMetrics {
    const { episode, context } = input;
    const Arithmetic = Decimal.clone({ precision: 40 + episode.executions.reduce((sum, e) => sum + [e.quantity, e.price, e.fee, e.source.settlement?.grossAmount, e.source.settlement?.quantity].reduce((n, v) => n + (v?.length ?? 0), 0), 0) });
    const number = (value: string | null | undefined) => parseDecimal(value, Arithmetic);
    const currency = episode.instrument.currency.trim().toUpperCase() || null;
    const metric = (value: Decimal | string | null, reason: string | null = null, unit = 'money'): RecallActualMetric => ({ value: value === null ? null : (unit === 'ratio' || unit === 'R' ? new Arithmetic(value).toDecimalPlaces(40).toString() : value.toString()), reason: value === null ? reason : null, currency: unit === 'quantity' || unit === 'ratio' || unit === 'R' ? null : currency, unit, methodVersion: 'actual-v1' });
    const metrics = Object.fromEntries(keys.map(k => [k, metric(null, 'no-visible-executions')])) as Record<RecallActualMetricKey, RecallActualMetric>;
    const result: RecallActualMetrics = { methodVersion: 'actual-v1', source: { ...input.source }, metrics, exitAllocations: [], denominator: null, executionIds: [], planVersionIds: input.planVersions.map(v => v.id), riskBaselineIds: input.riskBaselines.map(b => b.id) };
    const fail = (reason: string) => {
        for (const k of keys)
            metrics[k] = metric(null, reason);
        return result;
    };
    if (context.phase === 'pre-entry')
        return fail('pre-entry');
    const ordered = orderedRecallExecutions(episode.executions);
    const boundary = executionBoundaryForCursor(ordered, context.executionCursor);
    const cutoff = Date.parse(replayCursorAt(context.cursor));
    const planVersions = input.planVersions.filter(v => Date.parse(replayCursorAt(v.knowledgeCutoff.cursor)) <= cutoff && executionBoundaryForCursor(ordered, v.knowledgeCutoff.executionCursor) <= boundary);
    const riskBaselines = input.riskBaselines.filter(b => planVersions.some(v => v.id === b.planVersionId));
    result.planVersionIds = planVersions.map(v => v.id);
    result.riskBaselineIds = riskBaselines.map(b => b.id);
    const visible = visibleRecallExecutions(episode.executions, context.executionCursor, context.cursor);
    result.executionIds = visible.map(e => e.id);
    if (!visible.length)
        return result;
    const episodeNature = episode.tradeNature ?? tradeNatureOf(ordered[0]);
    const visibleBusinessScope = tradingViewEpisodeBusinessScope({
        accountId: episode.accountId,
        tradeNature: episodeNature,
        executions: visible,
    });
    if (episode.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID && !visibleBusinessScope)
        return fail('execution-scope-mismatch');
    if (visible.some(e => {
        if (e.accountId !== episode.accountId || e.instrument.id !== episode.instrument.id || tradeNatureOf(e) !== episodeNature)
            return true;
        if (episodeNature !== 'simulation')
            return false;
        if (visibleBusinessScope) {
            const executionBusinessScope = tradingViewEpisodeBusinessScope({
                accountId: e.accountId,
                tradeNature: tradeNatureOf(e),
                executions: [e],
            });
            return executionBusinessScope?.accountId !== visibleBusinessScope.accountId ||
                executionBusinessScope.tradeNature !== visibleBusinessScope.tradeNature ||
                executionBusinessScope.simulationRunId !== visibleBusinessScope.simulationRunId;
        }
        return e.source.simulationRunId !== episode.simulationRunId;
    }))
        return fail('execution-scope-mismatch');
    if (!currency || MINOR_UNITS[currency] === undefined)
        return fail('unsupported-currency-precision');
    if (visible.some(e => e.instrument.currency.trim().toUpperCase() !== currency || hasSettlementCurrencyMismatch(e)))
        return fail('currency-mismatch');
    if (episode.directionKnown === false)
        return fail('unknown-direction');
    if (visible.some(e => !number(e.quantity)?.gt(0)))
        return fail('unknown-quantity');
    if (visible.some(e => !number(e.price)?.gt(0) || e.source.settlement && (!number(e.source.settlement.quantity)?.gt(0) || !number(e.source.settlement.grossAmount)?.gte(0))))
        return fail('unknown-cost');
    // The existing ledger is the evidence authority. Strip only fee incompleteness
    // for its gross-cost check; missing fees must not hide otherwise known gross PnL.
    const grossExecutions = visible.map(e => ({ ...e, fee: '0', source: { ...e.source, feeStatus: 'reported' as const } }));
    const ledger = replayPositionAtPrice({ executions: grossExecutions, markPrice: '0', cursor: context.cursor, visibleExecutionIds: visible.map(e => e.id) });
    if (ledger.quantityKnown === false)
        return fail('unknown-quantity');
    const reason = ledger.accuracy?.reasons[0] ?? (ledger.costKnown === false ? 'unknown-cost' : null) ?? (visible.length === ordered.length ? episode.accuracy?.reasons.find(r => r !== 'unknown-fees') : undefined);
    if (reason)
        return fail(reason);
    // Non-fill inventory requires a fee/cost allocation model beyond execution pools.
    if (episode.initialPosition || episode.positionEvents?.some(e => e.quantity !== undefined))
        return fail('inventory-allocation-unavailable');
    let qty = new Arithmetic(0), cost = new Arithmetic(0), costPool = new Arithmetic(0), pool = new Arithmetic(0), gross = new Arithmetic(0), net = new Arithmetic(0), fees = new Arithmetic(0), exitQty = new Arithmetic(0), exitAmount = new Arithmetic(0), entryQty = new Arithmetic(0), entryAmount = new Arithmetic(0);
    let feesKnown = true;
    const openingSide = episode.direction === 'long' ? 'buy' : 'sell';
    const openingIds: string[] = [];
    for (const e of visible) {
        const q = number(e.quantity)!;
        const s = e.source.settlement;
        const p = s ? number(s.grossAmount)!.div(number(s.quantity)!) : number(e.price)!;
        const fee = number(e.fee);
        const known = fee !== null && e.source.feeStatus !== 'unknown';
        feesKnown &&= known;
        if (known)
            fees = fees.plus(fee!);
        if (e.side === openingSide) {
            openingIds.push(e.id);
            costPool = costPool.plus(p.mul(q));
            cost = costPool.div(qty.plus(q));
            qty = qty.plus(q);
            entryQty = entryQty.plus(q);
            entryAmount = entryAmount.plus(p.mul(q));
            if (known)
                pool = pool.plus(fee!);
            continue;
        }
        if (q.gt(qty))
            return fail('unknown-cost');
        const allocation = q.eq(qty) ? pool : pool.mul(q).div(qty).toDecimalPlaces(MINOR_UNITS[currency], Decimal.ROUND_DOWN);
        pool = pool.minus(allocation);
        const allocatedCost = q.eq(qty) ? costPool : costPool.mul(q).div(qty);
        costPool = costPool.minus(allocatedCost);
        const gain = episode.direction === 'long' ? p.mul(q).minus(allocatedCost) : allocatedCost.minus(p.mul(q));
        gross = gross.plus(gain);
        const exitNet = gain.minus(allocation).minus(fee ?? 0);
        net = net.plus(exitNet);
        qty = qty.minus(q);
        exitQty = exitQty.plus(q);
        exitAmount = exitAmount.plus(p.mul(q));
        result.exitAllocations.push({ executionId: e.id, decisionId: input.decisions.find(d => d.executionIds.includes(e.id))?.id ?? null, quantity: q.toString(), entryFee: metric(feesKnown ? allocation : null, 'unknown-fees'), exitFee: metric(known ? fee : null, 'unknown-fees'), grossPnl: metric(gain), netPnl: metric(feesKnown ? exitNet : null, 'unknown-fees') });
    }
    metrics.remainingQuantity = metric(qty, null, 'quantity');
    metrics.averageEntryPrice = metric(entryQty.gt(0) ? entryAmount.div(entryQty) : null, 'unknown-cost', 'price');
    metrics.weightedExitPrice = metric(exitQty.gt(0) ? exitAmount.div(exitQty) : null, 'no-exits', 'price');
    metrics.realizedGross = metric(gross);
    metrics.realizedNet = metric(feesKnown ? net : null, 'unknown-fees');
    metrics.remainingEntryFee = metric(feesKnown ? pool : null, 'unknown-fees');
    metrics.totalFees = metric(feesKnown ? fees : null, 'unknown-fees');
    const closed = qty.isZero();
    metrics.netPnl = metric(closed && feesKnown ? net : null, closed ? 'unknown-fees' : 'episode-open');
    const mark = input.mark;
    const markPrice = number(mark?.price);
    metrics.unrealizedGross = metric(closed ? new Arithmetic(0) : mark?.priceBasis === 'raw' && markPrice?.gt(0) && Date.parse(mark.time) <= cutoff ? (episode.direction === 'long' ? markPrice.minus(cost) : cost.minus(markPrice)).mul(qty) : null, mark?.priceBasis === 'adjusted' ? 'price-basis-mismatch' : 'missing-visible-raw-mark');
    const owners = openingIds.map(id => input.decisions.filter(d => d.executionIds.includes(id)));
    const openingDecisions = [...new Set(owners.flat().map(d => d.id))];
    let riskReason = owners.some(o => o.length !== 1) ? 'missing-opening-decision' : openingDecisions.length > 1 ? 'multiple-opening-decisions-require-prior-episode-budget' : 'missing-initial-risk-baseline';
    const secondIndex = ordered.findIndex(e => input.decisions.find(d => d.id === openingDecisions[1])?.executionIds.includes(e.id) && e.side === openingSide);
    const superseded = new Set<string>();
    for (const correction of planVersions.filter(v => v.kind === 'correction')) {
        let parent = correction.parentVersionId;
        while (parent && !superseded.has(parent)) {
            superseded.add(parent);
            parent = planVersions.find(v => v.id === parent)?.parentVersionId;
        }
    }
    const candidates = riskBaselines.filter(b => !superseded.has(b.planVersionId) && !riskBaselines.some(next => next.correctsBaselineId === b.id));
    const baseline = candidates.find(b => {
        const v = planVersions.find(v => v.id === b.planVersionId);
        if (!v || !number(b.amount)?.gt(0) || b.currency !== currency || owners.some(o => o.length !== 1))
            return false;
        if (b.method === 'planned-price-risk' && (v.input.priceBasis !== 'raw' || v.input.direction !== episode.direction || v.input.currency !== currency))
            return false;
        if (b.scope === 'decision')
            return openingDecisions.length === 1 && b.decisionId === openingDecisions[0] && v.decisionId === b.decisionId;
        const budget = v.riskBudget;
        if (!budget || b.method !== 'fixed-budget' || budget.scope !== 'episode' || budget.currency !== currency || !number(budget.amount)?.eq(b.amount))
            return false;
        const budgetCursor = budget.effectiveKnowledgeCutoff.executionCursor;
        if (budgetCursor !== '__recall_before_first_execution__' && !ordered.some(e => e.id === budgetCursor) && !Number.isFinite(Date.parse(budgetCursor)))
            return false;
        return secondIndex < 0 || (executionBoundaryForCursor(ordered, budget.effectiveKnowledgeCutoff.executionCursor) < secondIndex && Date.parse(budget.effectiveKnowledgeCutoff.cursor) < Date.parse(replayExecutionAt(ordered[secondIndex])));
    });
    if (baseline) {
        result.denominator = { riskBaselineId: baseline.id, planVersionId: baseline.planVersionId, amount: baseline.amount, currency: baseline.currency, scope: baseline.scope, method: baseline.method };
        riskReason = '';
    }
    metrics.actualR = metric(closed && feesKnown && baseline ? net.div(baseline.amount) : null, !closed ? 'episode-open' : !feesKnown ? 'unknown-fees' : riskReason, 'R');
    // Initial execution comparisons follow the surviving initial/correction
    // lineage independently of whether that version can establish a risk.
    const plan = [...planVersions].reverse().find(v => !superseded.has(v.id) &&
        (v.kind === 'initial' || v.kind === 'correction') && v.decisionId === openingDecisions[0]);
    const comparable = plan?.input.priceBasis === 'raw' && plan.input.currency === currency && plan.input.direction === episode.direction;
    const firstIds = input.decisions.find(d => d.id === openingDecisions[0])?.executionIds ?? [];
    const initial = visible.filter(e => e.side === openingSide && firstIds.includes(e.id));
    let initialQ = new Arithmetic(0), initialAmount = new Arithmetic(0);
    for (const e of initial) {
        const q = number(e.quantity)!;
        initialQ = initialQ.plus(q);
        initialAmount = initialAmount.plus(e.source.settlement ? number(e.source.settlement.grossAmount)!.div(number(e.source.settlement.quantity)!).mul(q) : number(e.price)!.mul(q));
    }
    const plannedPrice = number(plan?.input.entry), plannedQ = number(plan?.input.resolvedQuantity);
    metrics.entryPriceDeviation = metric(comparable && plannedPrice && initialQ.gt(0) ? (episode.direction === 'long' ? initialAmount.div(initialQ).minus(plannedPrice) : plannedPrice.minus(initialAmount.div(initialQ))) : null, 'incomparable-plan', 'price');
    metrics.quantityDeviation = metric(comparable && plannedQ?.gt(0) && initialQ.gt(0) ? initialQ.div(plannedQ).minus(1) : null, 'incomparable-plan', 'ratio');
    const reward = plan && comparable ? number(calculateRecallPlan(plan.input).targetReward.value) : null;
    metrics.targetRealization = metric(closed && feesKnown && reward?.gt(0) ? net.div(reward) : null, !closed ? 'episode-open' : !feesKnown ? 'unknown-fees' : 'incomparable-plan', 'ratio');
    return result;
}
