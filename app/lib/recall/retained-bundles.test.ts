import { describe, expect, it } from 'vitest';
import { buildTradeEpisodes } from '../trades/episodes';
import type { TradeExecution } from '../trades/types';
import { createRecallDocument } from './document';
import { upsertRecallExitEvaluationDraft, type RecallExitEvaluationDraft } from './exit-evaluations';
import { upsertRecallManualEvaluationDraft, type RecallManualEvaluationDraft } from './manual-evaluations';
import { freezeRecallSnapshotBundle } from './retained-bundles';
import type { RecallSnapshot } from './types';

function fixture(phase: RecallSnapshot['phase'] = 'post-review', owner = 'entry') {
    const instrument = { id: 'I', symbol: 'I', name: 'I', market: 'US', currency: 'USD' };
    const fills: TradeExecution[] = [['entry', 'buy', '10'], ['exit-a', 'sell', '3'], ['exit-b', 'sell', '7']].map(([id, side, quantity], i) => ({
        id, side: side as 'buy' | 'sell', quantity, price: '10', fee: '0', accountId: 'a', accountLabel: 'A', instrument,
        executedAt: `2026-01-0${i + 1}T00:00:00Z`, source: { platform: 'test', row: i },
    }));
    const episode = buildTradeEpisodes(fills)[0];
    let document = createRecallDocument(episode);
    for (const decisionId of ['exit-a', 'exit-b']) {
        const draft: RecallExitEvaluationDraft = {
            id: `d-${decisionId}`, evaluationId: `e-${decisionId}`, decisionId, earlyExit: 'yes', adherence: null,
            reason: null, reasonDetail: null, comparedPlanVersionId: null, comparedTargetId: null, tags: [],
            tagDictionaryVersion: 'manual-v1', evidence: [], source: 'manual-retrospective', recordedBy: 'user',
            recordedPhase: 'post-review', recordedAt: '2026-01-04',
            knowledgeCutoff: { cursor: '2026-01-04', executionCursor: 'exit-b' }, hasSeenFuture: true,
        };
        document = upsertRecallExitEvaluationDraft(document, draft);
    }
    document.snapshots = [{
        id: 'snapshot', decisionId: owner, phase, timeframe: '1D', cursor: '2026-01-04', executionCursor: 'exit-b',
        candles: [], drawings: [], viewport: { version: 1, logicalRange: null, barSpacing: 8, rightOffset: 4, width: 800, height: 400 },
        imageDataUrl: 'data:image/png;base64,AAAA', createdAt: '2026-01-04', updatedAt: '2026-01-04',
    }];
    return { document, episode };
}

const capture = (f: ReturnType<typeof fixture>, sourceBundleId?: string | null) => freezeRecallSnapshotBundle(f.document, 'snapshot', {
    bundleId: 'bundle', retainedAt: '2026-01-04', episode: f.episode, ...(sourceBundleId === undefined ? {} : { sourceBundleId }),
});

describe('phase-aware retained exit evaluations', () => {
    it('keeps manual evaluation fields absent for legacy captures without labels', () => {
        const saved = capture(fixture('holding', 'global'));
        expect(saved.retainedBundles![0]).not.toHaveProperty('manualEvaluationRevisionIds');
        expect(saved).not.toHaveProperty('manualEvaluations');
    });

    it('freezes episode manual labels and keeps later drafts out of the accepted bundle', () => {
        const f = fixture();
        const manual: RecallManualEvaluationDraft = {
            id: 'manual-draft', evaluationId: 'manual-evaluation', target: { scope: 'episode', decisionId: null },
            tags: ['position', 'entry', 'analysis'], tagDictionaryVersion: 'manual-v1', evidence: [{ kind: 'snapshot', snapshotId: 'snapshot' }],
            source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-04',
            knowledgeCutoff: { cursor: '2026-01-04', executionCursor: 'exit-b' }, hasSeenFuture: true,
        };
        f.document = upsertRecallManualEvaluationDraft(f.document, manual);
        const saved = capture(f);
        expect(saved.retainedBundles![0].manualEvaluationRevisionIds).toHaveLength(1);
        expect(saved.manualEvaluations!.versions[0]).toMatchObject({ tags: manual.tags, target: manual.target });
        const edited = upsertRecallManualEvaluationDraft(saved, { ...manual, tags: ['analysis'] });
        expect(edited.manualEvaluations!.versions[0].tags).toEqual(manual.tags);
        expect(edited.retainedBundles![0].manualEvaluationRevisionIds).toEqual(saved.retainedBundles![0].manualEvaluationRevisionIds);
    });

    it('captures all visible exit evaluations in post-review even when the snapshot belongs to entry', () => {
        const f = fixture();
        const saved = capture(f);
        expect(saved.retainedBundles![0].evaluationRevisionIds).toHaveLength(2);
        expect(saved.exitEvaluations!.versions.map(v => v.decisionId)).toEqual(['exit-a', 'exit-b']);
        expect(saved.exitEvaluations!.drafts).toEqual(f.document.exitEvaluations!.drafts);
        expect(saved.exitEvaluations!.associations).toEqual(f.document.exitEvaluations!.associations);
    });
    it.each(['pre-entry', 'holding'] as const)('does not freeze post-review drafts into fresh %s snapshots', phase => {
        const saved = capture(fixture(phase, 'global'));
        expect(saved.retainedBundles![0].evaluationRevisionIds).toEqual([]);
        expect(saved.exitEvaluations!.versions).toEqual([]);
    });
    it('excludes evaluations whose knowledge was unavailable at the captured cutoff', () => {
        const f = fixture();
        f.document.snapshots[0].cursor = '2026-01-02';
        f.document.snapshots[0].executionCursor = 'exit-a';
        f.document.exitEvaluations!.drafts[0].knowledgeCutoff = { cursor: '2026-01-02', executionCursor: 'exit-a' };
        const saved = capture(f);
        expect(saved.exitEvaluations!.versions.map(v => v.decisionId)).toEqual(['exit-a']);
    });
    it('checks time and execution knowledge boundaries independently', () => {
        for (const cutoff of [{ cursor: '2026-01-05', executionCursor: 'exit-a' }, { cursor: '2026-01-02', executionCursor: 'exit-b' }]) {
            const f = fixture();
            f.document.snapshots[0].executionCursor = 'exit-a';
            f.document.exitEvaluations!.drafts[0].knowledgeCutoff = cutoff;
            expect(capture(f).retainedBundles![0].evaluationRevisionIds).toEqual([]);
        }
    });
    it('requires a current choice for any visible conflicting exit while ignoring unavailable future choices', () => {
        const f = fixture();
        f.document.exitEvaluations!.drafts.push({...f.document.exitEvaluations!.drafts[0], id: 'alternative', evaluationId: 'alternative'});
        f.document.exitEvaluations!.associations.push({evaluationId: 'alternative', decisionId: 'exit-a', status: 'linked'});
        expect(() => capture(f)).toThrow(/choose the current evaluation/);
        f.document.snapshots[0].cursor = '2026-01-01';
        f.document.snapshots[0].executionCursor = 'entry';
        expect(capture(f).retainedBundles![0].evaluationRevisionIds).toEqual([]);
    });
    it('preserves an explicitly absent historical evaluation selection', () => {
        const saved = capture(fixture(), null);
        expect(saved.retainedBundles![0].evaluationRevisionIds).toBeUndefined();
        expect(saved.exitEvaluations!.versions).toEqual([]);
    });
    it('preserves legacy decision scope and explicitly selected historical revisions', () => {
        const legacy = fixture('post-review', 'exit-a');
        delete legacy.document.snapshots[0].phase;
        const saved = capture(legacy);
        expect(saved.retainedBundles![0].evaluationRevisionIds).toHaveLength(1);
        saved.retainedBundles![0].documentRevision = 1;
        saved.snapshots.push({ ...saved.snapshots[0], id: 'historical-copy', phase: 'holding', retainedBundleId: undefined });
        const copied = freezeRecallSnapshotBundle(saved, 'historical-copy', { bundleId: 'copy', retainedAt: '2026-01-05', episode: legacy.episode, sourceBundleId: 'bundle' });
        expect(copied.retainedBundles![1].evaluationRevisionIds).toEqual(saved.retainedBundles![0].evaluationRevisionIds);
        expect(copied.exitEvaluations!.versions).toHaveLength(1);
    });
});
