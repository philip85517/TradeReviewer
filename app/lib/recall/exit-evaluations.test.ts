import { describe, expect, it } from 'vitest';
import { createRecallDocument, mergeRecallDecisions, splitRecallDecision } from './document';
import { buildTradeEpisodes } from '../trades/episodes';
import type { TradeExecution } from '../trades/types';
import * as evaluations from './exit-evaluations';
function fixture() {
    const instrument = {
        id: 'I', symbol: 'I', name: 'I', market: 'US', currency: 'USD'
    };
    const fills: TradeExecution[] = [['entry', 'buy', '10'], ['exit-a', 'sell', '3'], ['exit-b', 'sell', '7']].map(([id, side, quantity], i) => ({
        id, side: side as 'buy' | 'sell', quantity, price: '10', fee: '0', accountId: 'a', accountLabel: 'A', instrument, executedAt: `2026-01-0${i + 1}T00:00:00Z`, source: {
            platform: 'test', row: i
        }
    }));
    const episode = buildTradeEpisodes(fills)[0];
    return {
        episode, document: createRecallDocument(episode)
    };
}
function draft(decisionId: string): evaluations.RecallExitEvaluationDraft {
    return {
        id: `d-${decisionId}`, evaluationId: `e-${decisionId}`, decisionId, earlyExit: null, adherence: null, reason: null, reasonDetail: null, comparedPlanVersionId: null, comparedTargetId: null, tags: [], tagDictionaryVersion: 'manual-v1', evidence: [], source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-04', knowledgeCutoff: {
            cursor: '2026-01-04', executionCursor: 'exit-b'
        }, hasSeenFuture: true
    };
}
describe('manual exit evaluations', () => {
    it('keeps exits independent and distinguishes null uncertain and explicit decision/quantity denominators', () => {
        const f = fixture();
        let d = evaluations.upsertRecallExitEvaluationDraft(f.document, {
            ...draft('exit-a'), earlyExit: 'yes'
        });
        d = evaluations.upsertRecallExitEvaluationDraft(d, {
            ...draft('exit-b'), earlyExit: 'no'
        });
        expect(evaluations.calculateRecallExitEvaluationCoverage(d, f.episode)).toMatchObject({
            totalExitDecisions: 2, evaluatedDecisions: 2, yes: 1, no: 1, uncertain: 0, unevaluated: 0, decisionEarlyRate: '0.5', quantityEarlyRate: '0.3'
        });
        d = evaluations.upsertRecallExitEvaluationDraft(d, {
            ...draft('exit-b'), earlyExit: 'uncertain'
        });
        expect(evaluations.calculateRecallExitEvaluationCoverage(d, f.episode)).toMatchObject({
            uncertain: 1, decisionEarlyRate: '1', quantityEarlyRate: '1'
        });
        expect(d.exitEvaluations!.drafts[0].earlyExit).toBe('yes');
    });
    it('requires detail for other without inferring early status or a plan', () => {
        const f = fixture();
        expect(() => evaluations.upsertRecallExitEvaluationDraft(f.document, {
            ...draft('exit-a'), reason: 'other'
        })).toThrow(/reasonDetail/);
        const d = evaluations.upsertRecallExitEvaluationDraft(f.document, {
            ...draft('exit-a'), reason: 'other', reasonDetail: '主动降低敞口', adherence: 'no-plan'
        });
        expect(d.exitEvaluations!.drafts[0].earlyExit).toBeNull();
    });
    it('freezes immutable revisions while later draft edits stay outside old bundles', () => {
        const f = fixture();
        const d = evaluations.upsertRecallExitEvaluationDraft(f.document, {
            ...draft('exit-a'), earlyExit: 'yes'
        });
        const frozen = evaluations.freezeRecallExitEvaluations(d, {
            bundleId: 'b', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode
        });
        const edited = evaluations.upsertRecallExitEvaluationDraft(frozen.document, {
            ...draft('exit-a'), earlyExit: 'no'
        });
        expect(edited.exitEvaluations!.versions[0].earlyExit).toBe('yes');
        expect(frozen.revisionIds).toHaveLength(1);
        const forged = structuredClone(edited);
        forged.exitEvaluations!.versions[0].earlyExit = 'no';
        expect(() => evaluations.assertRecallExitEvaluationImmutability(edited, forged)).toThrow(/immutable/);
    });
    it('aggregates same-decision closing fills and flags ambiguous split evaluation ownership', () => {
        const f = fixture();
        let d = mergeRecallDecisions(f.document, ['exit-a', 'exit-b'], 'exit-a');
        expect(evaluations.getRecallExitDecisions(d, f.episode)[0].quantity).toBe('10');
        d = evaluations.upsertRecallExitEvaluationDraft(d, {
            ...draft('exit-a'), earlyExit: 'yes'
        });
        d = evaluations.freezeRecallExitEvaluations(d, {
            bundleId: 'b', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode
        }).document;
        d = splitRecallDecision(d, 'exit-a', [{
                id: 'exit-a', executionIds: ['exit-a']
            }, {
                id: 'exit-b', executionIds: ['exit-b']
            }]);
        const reconciled = evaluations.reconcileRecallExitEvaluationAssociations(d);
        expect(reconciled.exitEvaluations!.associations[0]).toMatchObject({
            decisionId: null, status: 'needs-confirmation'
        });
        expect(reconciled.exitEvaluations!.versions[0].decisionId).toBe('exit-a');
    });
});
it('preserves explicit orphan resolution on subsequent reconciliation', () => {
    const f = fixture();
    let d = mergeRecallDecisions(f.document, ['exit-a', 'exit-b'], 'exit-a');
    d = evaluations.upsertRecallExitEvaluationDraft(d, draft('exit-a'));
    d = evaluations.freezeRecallExitEvaluations(d, {
        bundleId: 'b', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode
    }).document;
    d = splitRecallDecision(d, 'exit-a', [{
            id: 'exit-a', executionIds: ['exit-a']
        }, {
            id: 'exit-b', executionIds: ['exit-b']
        }]);
    d = evaluations.reconcileRecallExitEvaluationAssociations(d);
    d = evaluations.resolveRecallExitEvaluationAssociation(d, 'e-exit-a', 'exit-b');
    expect(evaluations.reconcileRecallExitEvaluationAssociations(d).exitEvaluations!.associations[0]).toMatchObject({
        decisionId: 'exit-b', status: 'linked'
    });
});
it('rejects authoritative opening-decision evaluation and flags unknown quantity without zero substitution', () => {
    const f = fixture();
    const invalid = evaluations.upsertRecallExitEvaluationDraft(f.document, draft('entry'));
    expect(() => evaluations.validateRecallExitEvaluations(invalid, f.episode)).toThrow(/closing/);
    let d = evaluations.upsertRecallExitEvaluationDraft(f.document, {
        ...draft('exit-a'), earlyExit: 'yes'
    });
    d = evaluations.upsertRecallExitEvaluationDraft(d, {
        ...draft('exit-b'), earlyExit: 'no'
    });
    const unknown = structuredClone(f.episode);
    unknown.executions.find(e => e.id === 'exit-a')!.quantity = 'unknown';
    expect(evaluations.calculateRecallExitEvaluationCoverage(d, unknown)).toMatchObject({
        decisionEarlyRate: '0.5', quantityEarlyRate: '0', missingQuantityDecisions: 1, quantityRateReason: 'partial-quantity-coverage'
    });
});
it('preserves missing evidence pointers and explicit historical absence', () => {
    const f = fixture();
    const d = evaluations.upsertRecallExitEvaluationDraft(f.document, {
        ...draft('exit-a'), evidence: [{
                kind: 'text', drawingId: 'missing', textRevision: 2, ownerId: 'exit-a'
            }]
    });
    expect(evaluations.getRecallEvaluationEvidenceStatus(d, d.exitEvaluations!.drafts[0].evidence[0])).toMatchObject({
        available: false, reason: 'text-revision-or-owner-missing'
    });
    expect(evaluations.freezeRecallExitEvaluations(d, {
        bundleId: 'b', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode, sourceRevisionIds: null
    }).revisionIds).toBeUndefined();
    expect(evaluations.calculateRecallExitEvaluationCoverage(f.document, f.episode)).toMatchObject({
        unevaluated: 2, decisionEarlyRate: null, quantityEarlyRate: null
    });
});
it('resolves merged rated exits by an explicit current winner and preserves all history', () => {
    const f = fixture();
    let d = evaluations.upsertRecallExitEvaluationDraft(f.document, {
        ...draft('exit-a'), earlyExit: 'yes'
    });
    d = evaluations.upsertRecallExitEvaluationDraft(d, {
        ...draft('exit-b'), earlyExit: 'no'
    });
    d = evaluations.freezeRecallExitEvaluations(d, {
        bundleId: 'before', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode
    }).document;
    const history = structuredClone(d.exitEvaluations!.versions);
    d = mergeRecallDecisions(d, ['exit-a', 'exit-b'], 'exit-a');
    d = evaluations.reconcileRecallExitEvaluationAssociations(d);
    expect(evaluations.getRecallExitEvaluationConflicts(d)).toEqual(['exit-a']);
    expect(() => evaluations.freezeRecallExitEvaluations(d, {
        bundleId: 'ambiguous', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode
    })).toThrow(/current evaluation/);
    d = evaluations.selectRecallExitEvaluation(d, 'exit-a', 'e-exit-b');
    expect(evaluations.getRecallExitEvaluationConflicts(d)).toEqual([]);
    expect(evaluations.calculateRecallExitEvaluationCoverage(d, f.episode)).toMatchObject({
        evaluatedDecisions: 1, no: 1, decisionEarlyRate: '0'
    });
    const captured = evaluations.freezeRecallExitEvaluations(d, {
        bundleId: 'after', retainedAt: '2026-01-05', decisionId: 'global', episode: f.episode
    });
    expect(captured.revisionIds).toHaveLength(1);
    expect(captured.document.exitEvaluations!.versions.filter(v => history.some(h => h.id === v.id))).toEqual(history);
    expect(captured.document.exitEvaluations!.drafts).toHaveLength(2);
    const reloaded = JSON.parse(JSON.stringify(captured.document));
    expect(evaluations.getCurrentRecallExitEvaluation(reloaded, 'exit-a')?.evaluationId).toBe('e-exit-b');
});
it('rejects duplicate historical source evaluation revisions before projection', () => {
    const f = fixture();
    const d = evaluations.upsertRecallExitEvaluationDraft(f.document, draft('exit-a'));
    const frozen = evaluations.freezeRecallExitEvaluations(d, {
        bundleId: 'b', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode
    });
    expect(() => evaluations.freezeRecallExitEvaluations(frozen.document, {
        bundleId: 'next', retainedAt: '2026-01-04', decisionId: 'global', episode: f.episode, sourceRevisionIds: [frozen.revisionIds![0], frozen.revisionIds![0]]
    })).toThrow(/duplicate/);
});
