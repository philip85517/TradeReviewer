import { describe, expect, it } from 'vitest';
import { calculateRecallActualMetrics, type RecallActualMetricsInput } from './actual-metrics';
import type { TradeEpisode } from '../trades/types';
function fixture(): RecallActualMetricsInput & {
    decisions: import('./types').RecallDecision[];
    planVersions: import('./types').RecallPlanVersion[];
    riskBaselines: import('./types').RecallRiskBaseline[];
} {
    const instrument = { id: 'X', symbol: 'X', name: 'X', market: 'CN', currency: 'CNY' };
    const executions = [['entry', 'buy', '1000', '56', '20'], ['exit-a', 'sell', '600', '64', '12'], ['exit-b', 'sell', '400', '61', '8']].map(([id, side, quantity, price, fee], i) => ({ id, side: side as 'buy' | 'sell', quantity, price, fee, executedAt: `2026-01-0${i + 1}T10:00:00Z`, accountId: 'a', accountLabel: 'a', instrument, source: { platform: 'test', row: i } }));
    const episode: TradeEpisode = { id: 'ep', accountId: 'a', accountLabel: 'a', instrument, direction: 'long', status: 'closed', startedAt: executions[0].executedAt, openingQuantity: '1000', remainingQuantity: '0', executions };
    return { episode, decisions: [{ id: 'd', executionIds: ['entry'] }, { id: 'x', executionIds: ['exit-a', 'exit-b'] }], planVersions: [{ id: 'v', planId: 'p', decisionId: 'd', kind: 'initial', recordedPhase: 'pre-entry', source: 'retrospective', recordedAt: '2026-01-01', retainedAt: '2026-01-01', knowledgeCutoff: { cursor: '2026-01-01', executionCursor: '__recall_before_first_execution__' }, hasSeenFuture: false, input: { direction: 'long', currency: 'CNY', priceBasis: 'raw', entry: '56', initialStop: '52', targets: [{ id: 't', price: '68', quantity: '1000', ratio: null }], sizeInputMode: 'quantity', sizeInputValue: '1000', resolvedQuantity: '1000', quantityUnit: 'share', capital: null } }], riskBaselines: [{ id: 'r', scope: 'decision', decisionId: 'd', planVersionId: 'v', amount: '4000', currency: 'CNY', method: 'planned-price-risk', methodVersion: 'risk-v1', frozenAt: '2026-01-01' }], context: { phase: 'post-review', cursor: '2026-01-04', executionCursor: 'exit-b' }, source: { documentRevision: 3, evidenceDigest: 'digest', computedAt: '2026-01-04' } };
}

function setSimulationScope(f: RecallActualMetricsInput, simulationRunId: string) {
    f.episode.tradeNature = 'simulation';
    f.episode.simulationRunId = simulationRunId;
    f.episode.executions.forEach(execution => {
        execution.source = { ...execution.source, tradeNature: 'simulation', simulationRunId };
    });
}

describe('actual metrics', () => {
    it('requires a comparable source plan for price risk only', () => {
        for (const patch of [{ priceBasis: 'adjusted' as const }, { priceBasis: null }, { direction: 'short' as const }, { currency: 'USD' }]) {
            const f = fixture();
            Object.assign(f.planVersions[0].input, patch);
            const r = calculateRecallActualMetrics(f);
            expect(r.metrics.actualR.value).toBeNull();
            expect(r.denominator).toBeNull();
        }
        const f = fixture();
        f.planVersions[0].input.priceBasis = 'adjusted';
        f.riskBaselines[0].method = 'fixed-budget';
        expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBe('1.69');
    });
    it('uses corrected initial comparison prices even without a new risk', () => {
        const f = fixture();
        f.planVersions.push({ ...structuredClone(f.planVersions[0]), id: 'correction', kind: 'correction', parentVersionId: 'v', input: { ...f.planVersions[0].input, entry: '60', initialStop: null } });
        const r = calculateRecallActualMetrics(f);
        expect(r.metrics.actualR.value).toBeNull();
        expect(r.metrics.entryPriceDeviation.value).toBe('-4');
        expect(r.metrics.targetRealization.value).toBeNull();
    });
    it('labels target realization net over gross and risk method', () => { const r = calculateRecallActualMetrics(fixture()); expect(r.metrics.targetRealization.value?.startsWith('0.56333333333333333333')).toBe(true); expect(r.denominator?.method).toBe('planned-price-risk'); });
    it('conserves the final minor-unit fee remainder', () => { const f = fixture(); f.episode.executions[0].fee = '0.01'; const r = calculateRecallActualMetrics(f); expect(r.exitAllocations.map(x => x.entryFee.value)).toEqual(['0', '0.01']); expect(r.metrics.remainingEntryFee.value).toBe('0'); });
    it('rejects cross currency and unknown cost or quantity', () => {
        for (const mutate of [(f: RecallActualMetricsInput) => { f.episode.executions[0].source.settlement = { currency: 'USD', quantity: '1000', grossAmount: '56000', netAmount: '56020', fees: {} }; }, (f: RecallActualMetricsInput) => { f.episode.executions[0].source.historyIncomplete = ['missing']; }, (f: RecallActualMetricsInput) => { f.episode.executions[0].quantity = ''; }]) {
            const f = fixture();
            mutate(f);
            expect(calculateRecallActualMetrics(f).metrics.netPnl.value).toBeNull();
        }
    });
    it('uses settlement gross exactly and never subtracts settlement fees twice', () => { const f = fixture(); f.episode.executions[0].price = '57'; f.episode.executions[0].source.settlement = { currency: 'CNY', quantity: '1000', grossAmount: '56000', netAmount: '56020', fees: { commission: '20' } }; expect(calculateRecallActualMetrics(f).metrics.netPnl.value).toBe('6760'); });
    it('requires episode budget before second opening decision but permits split fills', () => { const f = fixture(); const first = f.episode.executions[0]; first.quantity = '500'; first.fee = '10'; f.episode.executions.splice(1, 0, { ...structuredClone(first), id: 'add', executedAt: '2026-01-01T11:00:00Z' }); f.decisions[0].executionIds.push('add'); expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBe('1.69'); f.decisions[0].executionIds.pop(); f.decisions.push({ id: 'add-d', executionIds: ['add'] }); expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBeNull(); const b = f.riskBaselines[0]; b.scope = 'episode'; b.method = 'fixed-budget'; f.planVersions[0].riskBudget = { amount: '4000', currency: 'CNY', scope: 'episode', sourceDescription: 'budget', evidenceReference: null, provenance: 'retrospective', effectiveKnowledgeCutoff: { cursor: '2026-01-01T10:00:00Z', executionCursor: 'entry' } }; expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBe('1.69'); f.planVersions[0].riskBudget.effectiveKnowledgeCutoff.executionCursor = 'add'; expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBeNull(); });
    it('rejects adjusted marks and incompatible plan prices', () => { const f = fixture(); f.context.executionCursor = 'exit-a'; f.mark = { price: '64', time: '2026-01-02', priceBasis: 'adjusted' }; f.planVersions[0].input.priceBasis = 'adjusted'; const r = calculateRecallActualMetrics(f); expect(r.metrics.unrealizedGross.value).toBeNull(); expect(r.metrics.entryPriceDeviation.value).toBeNull(); });
    it('conserves gross cost through additions after partial exits', () => {
        const f = fixture();
        const add = { ...structuredClone(f.episode.executions[0]), id: 'add', quantity: '200', price: '60', fee: '4', executedAt: '2026-01-02T11:00:00Z' };
        f.episode.executions.splice(2, 0, add);
        f.episode.executions[3].quantity = '600';
        f.episode.executions[3].fee = '12';
        f.decisions.push({ id: 'add-d', executionIds: ['add'] });
        expect(calculateRecallActualMetrics(f).metrics.netPnl.value).toBe('6952');
    });
    it('does not fall back past a retained correction missing risk', () => {
        const f = fixture();
        f.planVersions.push({ ...structuredClone(f.planVersions[0]), id: 'correction', kind: 'correction', parentVersionId: 'v', input: { ...f.planVersions[0].input, initialStop: null } });
        expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBeNull();
    });
    it('ignores a future correction beyond either cutoff', () => {
        const f = fixture();
        f.planVersions.push({ ...structuredClone(f.planVersions[0]), id: 'correction', kind: 'correction', parentVersionId: 'v', knowledgeCutoff: { cursor: '2026-01-05', executionCursor: 'exit-b' } });
        f.riskBaselines.push({ ...f.riskBaselines[0], id: 'r2', planVersionId: 'correction', amount: '2000', correctsBaselineId: 'r' });
        expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBe('1.69');
    });
    it('conserves exact golden partial fees and frozen R', () => { const r = calculateRecallActualMetrics(fixture()); expect(r.metrics.netPnl.value).toBe('6760'); expect(r.metrics.actualR.value).toBe('1.69'); expect(r.metrics.weightedExitPrice.value).toBe('62.8'); expect(r.exitAllocations.map(x => [x.entryFee.value, x.netPnl.value])).toEqual([['12', '4776'], ['8', '1984']]); });
    it('does not reveal later fills from complete captured payload', () => { const f = fixture(); f.context = { phase: 'holding', cursor: '2026-01-02T12:00:00Z', executionCursor: 'exit-a' }; f.mark = { price: '64', time: '2026-01-02T11:00:00Z', priceBasis: 'raw' }; const r = calculateRecallActualMetrics(f); expect(r.executionIds).toEqual(['entry', 'exit-a']); expect(r.metrics.remainingQuantity.value).toBe('400'); expect(r.metrics.unrealizedGross.value).toBe('3200'); expect(r.metrics.remainingEntryFee.value).toBe('8'); expect(r.metrics.actualR.value).toBeNull(); });
    it('keeps gross known when fees missing', () => { const f = fixture(); f.episode.executions[0].fee = ''; const r = calculateRecallActualMetrics(f); expect(r.metrics.realizedGross.value).toBe('6800'); expect(r.metrics.netPnl.value).toBeNull(); expect(r.metrics.actualR.value).toBeNull(); });
    it('does not let future episode accuracy contaminate an early visible ledger', () => { const f = fixture(); f.context.executionCursor = 'entry'; f.context.cursor = '2026-01-01T12:00:00Z'; f.episode.accuracy = { pnl: 'unavailable', reasons: ['history-incomplete'] }; f.episode.executions[2].source.historyIncomplete = ['later']; expect(calculateRecallActualMetrics(f).metrics.averageEntryPrice.value).toBe('56'); });
    it('rejects unknown episode budget execution cutoff', () => { const f = fixture(); f.riskBaselines[0].scope = 'episode'; f.riskBaselines[0].method = 'fixed-budget'; f.planVersions[0].riskBudget = { amount: '4000', currency: 'CNY', scope: 'episode', sourceDescription: 'budget', evidenceReference: null, provenance: 'retrospective', effectiveKnowledgeCutoff: { cursor: '2026-01-01', executionCursor: 'typo' } }; expect(calculateRecallActualMetrics(f).metrics.actualR.value).toBeNull(); });
    it('handles short mirror', () => { const f = fixture(); f.episode.direction = 'short'; f.episode.executions.forEach(e => { e.side = e.side === 'buy' ? 'sell' : 'buy'; e.price = String(112 - Number(e.price)); }); f.planVersions[0].input.direction = 'short'; expect(calculateRecallActualMetrics(f).metrics.netPnl.value).toBe('6760'); });
    it('hides all actual facts before entry', () => { const f = fixture(); f.context.phase = 'pre-entry'; expect(Object.values(calculateRecallActualMetrics(f).metrics).every(m => m.value === null)).toBe(true); });
    it('calculates a simulation episode when every visible execution belongs to the same run', () => {
        const f = fixture();
        setSimulationScope(f, 'run-a');
        const r = calculateRecallActualMetrics(f);
        expect(r.executionIds).toEqual(['entry', 'exit-a', 'exit-b']);
        expect(r.metrics.netPnl).toMatchObject({ value: '6760', reason: null });
        expect(r.metrics.actualR).toMatchObject({ value: '1.69', reason: null });
    });
    it('rejects a visible execution from a different simulation run without returning zero metrics', () => {
        const f = fixture();
        setSimulationScope(f, 'run-a');
        f.episode.executions[2].source = { ...f.episode.executions[2].source, simulationRunId: 'run-b' };
        const r = calculateRecallActualMetrics(f);
        expect(r.executionIds).toEqual(['entry', 'exit-a', 'exit-b']);
        expect(r.metrics.realizedGross).toMatchObject({ value: null, reason: 'execution-scope-mismatch' });
        expect(r.metrics.netPnl).toMatchObject({ value: null, reason: 'execution-scope-mismatch' });
        expect(r.metrics.actualR).toMatchObject({ value: null, reason: 'execution-scope-mismatch' });
    });
    it('rejects a visible live and simulation execution mixed in one episode without pseudo-zero output', () => {
        const f = fixture();
        f.episode.tradeNature = 'live';
        f.episode.simulationRunId = undefined;
        f.episode.executions.forEach(execution => {
            execution.source = { ...execution.source, tradeNature: 'live' };
            delete execution.source.simulationRunId;
        });
        f.episode.executions[2].source = { ...f.episode.executions[2].source, tradeNature: 'simulation', simulationRunId: 'run-a' };
        const r = calculateRecallActualMetrics(f);
        expect(r.executionIds).toEqual(['entry', 'exit-a', 'exit-b']);
        expect(r.metrics.realizedGross).toMatchObject({ value: null, reason: 'execution-scope-mismatch' });
        expect(r.metrics.netPnl).toMatchObject({ value: null, reason: 'execution-scope-mismatch' });
        expect(r.metrics.actualR).toMatchObject({ value: null, reason: 'execution-scope-mismatch' });
    });
    it('ignores a future execution from a different run until that execution is revealed', () => {
        const f = fixture();
        setSimulationScope(f, 'run-a');
        f.episode.executions[2].source = { ...f.episode.executions[2].source, simulationRunId: 'run-b' };
        f.context = { phase: 'holding', cursor: '2026-01-02T12:00:00Z', executionCursor: 'exit-a' };
        const r = calculateRecallActualMetrics(f);
        expect(r.executionIds).toEqual(['entry', 'exit-a']);
        expect(r.metrics.realizedGross).toMatchObject({ value: '4800', reason: null });
        expect(r.metrics.netPnl).toMatchObject({ value: null, reason: 'episode-open' });
        expect(r.metrics.actualR).toMatchObject({ value: null, reason: 'episode-open' });
    });
});
