import { describe, expect, it } from 'vitest';
import { buildTradeEpisodes } from '../trades/episodes';
import type { TradeExecution } from '../trades/types';
import { createRecallDocument, retainRecallSnapshot } from './document';
import { upsertRecallPlanDraft } from './plans';
import { confirmRecallRetainedState, freezeRecallSnapshotBundle } from './retained-bundles';
import { retainRecallActualMetrics } from './metric-retention';

function capture(options: { partial?: boolean; raw?: boolean } = {}) {
    const fills: TradeExecution[] = [
        ['buy', 'buy', '1000', '56', '20', '2026-01-01'],
        ['exit-1', 'sell', '600', '64', '12', '2026-01-02'],
        ['exit-2', 'sell', '400', '61', '8', '2026-01-03'],
    ].map(([id, side, quantity, price, fee, executedAt]) => ({
        id, side: side as 'buy' | 'sell', quantity, price, fee, executedAt,
        accountId: 'account', accountLabel: 'Test', source: { platform: 'test', row: 0 },
        instrument: { id: 'US:TEST', symbol: 'TEST', name: 'Test', market: 'US', currency: 'USD' },
    }));
    const episode = buildTradeEpisodes(fills)[0];
    let document = createRecallDocument(episode);
    document = upsertRecallPlanDraft(document, {
        id: 'draft', planId: 'plan', decisionId: document.decisions[0].id, kind: 'initial',
        input: { direction: 'long', currency: 'USD', priceBasis: 'raw', entry: '56', initialStop: '52',
            targets: [{ id: 'target', price: '68', quantity: null, ratio: null }],
            sizeInputMode: 'quantity', sizeInputValue: '1000', resolvedQuantity: '1000', quantityUnit: 'share', capital: null },
        recordedPhase: 'pre-entry', source: 'retrospective', recordedAt: '2026-01-01',
        knowledgeCutoff: { cursor: '2026-01-01', executionCursor: 'buy' }, hasSeenFuture: false,
    });
    document = retainRecallSnapshot(document, {
        id: 'snapshot', decisionId: 'global', phase: options.partial ? 'holding' : 'post-review',
        timeframe: '1D', cursor: options.partial ? '2026-01-02' : '2026-01-04',
        executionCursor: options.partial ? 'exit-1' : 'exit-2',
        ...(options.raw ? { priceBasis: 'raw' as const } : {}),
        candles: [
            { time: '2026-01-02', open: 56, high: 65, low: 55, close: 64, volume: 1 },
            { time: '2026-01-05', open: 100, high: 101, low: 99, close: 100, volume: 1 },
        ],
        drawings: [], imageDataUrl: 'data:image/png;base64,AAAA', createdAt: '2026-01-04', updatedAt: '2026-01-04',
    });
    document = freezeRecallSnapshotBundle(document, 'snapshot', { bundleId: 'bundle', retainedAt: '2026-01-04', episode });
    confirmRecallRetainedState(undefined, document, episode, 7);
    return document;
}

describe('server metric retention', () => {
    it('uses frozen selected plans and execution evidence rather than later working drafts', () => {
        const document = capture();
        document.plans!.drafts[0].input.initialStop = '55';
        retainRecallActualMetrics(undefined, document);
        const result = document.retainedBundles![0].actualMetrics!;
        expect(result.source.documentRevision).toBe(7);
        expect(result.metrics.netPnl.value).toBe('6760');
        expect(result.metrics.actualR.value).toBe('1.69');
        expect(result.denominator?.amount).toBe('4000');
        expect(result.exitAllocations.map(exit => exit.netPnl.value)).toEqual(['4776', '1984']);
    });

    it('respects dual capture cutoffs and uses only known raw candles for the open mark', () => {
        const document = capture({ partial: true, raw: true });
        retainRecallActualMetrics(undefined, document);
        const result = document.retainedBundles![0].actualMetrics!;
        expect(result.executionIds).toEqual(['buy', 'exit-1']);
        expect(result.metrics.realizedNet.value).toBe('4776');
        expect(result.metrics.unrealizedGross.value).toBe('3200');
        expect(result.metrics.actualR.value).toBeNull();
    });

    it('does not infer a price basis for historical candle captures', () => {
        const document = capture({ partial: true });
        retainRecallActualMetrics(undefined, document);
        expect(document.retainedBundles![0].actualMetrics!.metrics.unrealizedGross.value).toBeNull();
        expect(document.retainedBundles![0].actualMetrics!.metrics.unrealizedGross.reason).toBeTruthy();
    });

    it('never recomputes accepted metrics or retrofills an accepted legacy bundle', () => {
        const legacy = capture();
        const nextLegacy = structuredClone(legacy);
        retainRecallActualMetrics(legacy, nextLegacy);
        expect(nextLegacy.retainedBundles![0].actualMetrics).toBeUndefined();
        retainRecallActualMetrics(undefined, legacy);
        const next = structuredClone(legacy);
        next.plans!.drafts[0].input.initialStop = '55';
        retainRecallActualMetrics(legacy, next);
        expect(next.retainedBundles![0].actualMetrics).toEqual(legacy.retainedBundles![0].actualMetrics);
    });
});
