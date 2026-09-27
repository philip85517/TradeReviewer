import { calculateRecallActualMetrics } from './actual-metrics';
import type { TradeEpisode } from '../trades/types';
import type { RecallDocument } from './types';
import { revealableCandlesThroughCursor } from '../replay/recall-replay';
import { candleKnowledgeAt } from '../market/types';

/** Called after retained-state confirmation, while the save CAS transaction is held. */
export function retainRecallActualMetrics(previous: RecallDocument | undefined, next: RecallDocument): void {
    const acceptedIds = new Set(previous?.retainedBundles?.map(bundle => bundle.id));
    for (const bundle of next.retainedBundles ?? []) {
        // Absence on an accepted legacy bundle is history, not a request to backfill.
        if (acceptedIds.has(bundle.id)) continue;
        const payload = bundle.executionEvidence.payload;
        const episode: TradeEpisode = {
            ...payload.episode,
            accountLabel: '',
            instrument: { ...payload.episode.instrument, name: payload.episode.instrument.symbol },
            executions: payload.executions.map(execution => ({
                ...execution,
                accountLabel: '',
                instrument: { ...execution.instrument, name: execution.instrument.symbol },
            })),
        };
        const snapshot = next.snapshots.find(item => item.id === bundle.snapshotId && item.retainedBundleId === bundle.id);
        // Only new captures from the raw-only market pipeline attest a price basis.
        // Legacy captures stay unknown, and a forming/future candle cannot be a mark.
        const candle = snapshot && bundle.captureContext.priceBasis === 'raw'
            ? revealableCandlesThroughCursor(snapshot.candles, bundle.captureContext.cursor).at(-1)
            : undefined;
        bundle.actualMetrics = calculateRecallActualMetrics({
            episode,
            decisions: bundle.decisions,
            planVersions: (next.plans?.versions ?? []).filter(plan => bundle.planVersionIds.includes(plan.id)),
            riskBaselines: (next.plans?.riskBaselines ?? []).filter(baseline => bundle.riskBaselineIds.includes(baseline.id)),
            context: {
                phase: bundle.captureContext.phase ?? 'holding',
                cursor: bundle.captureContext.cursor,
                executionCursor: bundle.captureContext.executionCursor,
            },
            ...(candle ? { mark: { price: String(candle.close), time: candleKnowledgeAt(candle), priceBasis: 'raw' as const } } : {}),
            source: {
                documentRevision: bundle.documentRevision,
                evidenceDigest: bundle.executionEvidence.digest,
                bundleId: bundle.id,
                computedAt: new Date().toISOString(),
            },
        });
    }
}
