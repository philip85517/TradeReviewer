import { describe, expect, it } from 'vitest';
import { createRecallDocument, validateRecallDocument } from './document';
import {
  confirmRecallManualEvaluationAssociation,
  freezeRecallManualEvaluations,
  getCurrentRecallManualEvaluation,
  reconcileRecallManualEvaluationAssociations,
  upsertRecallManualEvaluationDraft,
  type RecallManualEvaluationDraft,
} from './manual-evaluations';
import type { TradeEpisode, TradeExecution } from '../trades/types';

function episode(): TradeEpisode {
  const instrument = { id: 'I', symbol: 'I', name: 'I', market: 'US', currency: 'USD' };
  const execution: TradeExecution = {
    id: 'entry',
    side: 'buy',
    quantity: '10',
    price: '10',
    fee: '0',
    accountId: 'a',
    accountLabel: 'A',
    instrument,
    executedAt: '2026-01-01T00:00:00Z',
    source: { platform: 'test', row: 0 },
  };
  return {
    id: 'episode', accountId: 'a', accountLabel: 'A', instrument, direction: 'long',
    status: 'open', startedAt: execution.executedAt, openingQuantity: '10', remainingQuantity: '10',
    executions: [execution],
  };
}

function draft(): RecallManualEvaluationDraft {
  return {
    id: 'manual-draft-1',
    evaluationId: 'manual-evaluation-1',
    target: { scope: 'episode', decisionId: null },
    tags: ['position', 'entry', 'analysis'],
    tagDictionaryVersion: 'manual-v1',
    evidence: [{ kind: 'text', drawingId: 'text-1', textRevision: 2, ownerId: 'episode' }],
    source: 'manual-retrospective',
    recordedBy: 'user',
    recordedPhase: 'post-review',
    recordedAt: '2026-01-02T00:00:00Z',
    knowledgeCutoff: { cursor: '2026-01-02T00:00:00Z', executionCursor: 'entry' },
    hasSeenFuture: true,
  };
}

describe('manual episode evaluations', () => {
  it('records position, entry, and analysis tags with stable evidence without creating an exit', () => {
    const document = createRecallDocument(episode());
    document.working.drawings = [{
      version: 2, episodeId: 'episode', id: 'text-1', name: 'text', tool: 'text',
      anchors: [{ time: '2026-01-01T00:00:00Z', price: 10 }], style: { color: '#fff', lineWidth: 1, opacity: 1 },
      text: '判断', zIndex: 0, hidden: false, locked: false, visibleOn: 'all', stage: 'post-review',
      createdAtCursor: '2026-01-01T00:00:00Z', textRevision: 2, recallOwnerId: 'episode',
    }];
    const next = upsertRecallManualEvaluationDraft(document, draft());

    expect(next.manualEvaluations?.drafts).toHaveLength(1);
    expect(getCurrentRecallManualEvaluation(next)).toMatchObject({
      evaluationId: 'manual-evaluation-1',
      target: { scope: 'episode', decisionId: null },
      tags: ['position', 'entry', 'analysis'],
    });
    expect(next.manualEvaluations?.associations).toEqual([
      { evaluationId: 'manual-evaluation-1', decisionId: null, status: 'linked', executionIds: ['entry'] },
    ]);
    expect(() => validateRecallDocument(next)).not.toThrow();
    expect(next.exitEvaluations).toBeUndefined();
  });

  it('rejects exit tags and duplicate evidence while keeping legacy absence valid', () => {
    const document = createRecallDocument(episode());
    expect(() => upsertRecallManualEvaluationDraft(document, { ...draft(), tags: ['exit' as never] })).toThrow(/tag/);
    expect(() => upsertRecallManualEvaluationDraft(document, {
      ...draft(),
      evidence: [draft().evidence[0], draft().evidence[0]],
    })).toThrow(/evidence/);
    expect(() => validateRecallDocument(document)).not.toThrow();
    expect(document).not.toHaveProperty('manualEvaluations');
  });

  it('freezes a review recorded after the market cutoff when its knowledge cutoff is historical', () => {
    const base = createRecallDocument(episode());
    const historical = { ...draft(), evidence: [], recordedAt: '2026-09-26T12:00:00Z', knowledgeCutoff: { cursor: '2026-01-02T00:00:00Z', executionCursor: 'entry' } };
    const saved = upsertRecallManualEvaluationDraft(base, historical);
    const frozen = freezeRecallManualEvaluations(saved, {
      bundleId: 'bundle-historical', retainedAt: '2026-09-26T12:01:00Z', episode: episode(),
      knowledgeCutoff: { cursor: '2026-01-02T00:00:00Z', executionCursor: 'entry' },
    });
    expect(frozen.revisionIds).toEqual(['bundle-historical:manual:manual-draft-1']);
    expect(frozen.document.manualEvaluations?.versions).toHaveLength(1);
  });

  it('does not freeze a manual draft whose knowledge cutoff is beyond the captured history', () => {
    const base = createRecallDocument(episode());
    const future = { ...draft(), evidence: [], recordedAt: '2026-09-26T12:00:00Z', knowledgeCutoff: { cursor: '2026-01-03T00:00:00Z', executionCursor: 'entry' } };
    const saved = upsertRecallManualEvaluationDraft(base, future);
    const frozen = freezeRecallManualEvaluations(saved, {
      bundleId: 'bundle-future', retainedAt: '2026-09-26T12:01:00Z', episode: episode(),
      knowledgeCutoff: { cursor: '2026-01-02T00:00:00Z', executionCursor: 'entry' },
    });
    expect(frozen.revisionIds).toEqual([]);
    expect(frozen.document.manualEvaluations?.versions).toHaveLength(0);
  });

  it('requires explicit confirmation after the episode execution set changes', () => {
    const saved = upsertRecallManualEvaluationDraft(createRecallDocument(episode()), { ...draft(), evidence: [] });
    const changed = structuredClone(saved);
    changed.decisions[0].executionIds = [];
    changed.decisions.push({ id: 'new-entry', executionIds: ['new-entry'] });
    const pending = reconcileRecallManualEvaluationAssociations(changed);
    expect(pending.manualEvaluations?.associations[0]).toMatchObject({ status: 'needs-confirmation', decisionId: null, executionIds: ['entry'] });
    const frozen = freezeRecallManualEvaluations(pending, {
      bundleId: 'bundle-pending', retainedAt: '2026-01-04', episode: episode(),
      knowledgeCutoff: { cursor: '2026-01-04', executionCursor: 'entry' },
    });
    expect(frozen.revisionIds).toEqual([]);
    const confirmed = confirmRecallManualEvaluationAssociation(pending, 'manual-evaluation-1');
    expect(confirmed.manualEvaluations?.associations[0]).toMatchObject({ status: 'linked', decisionId: null, executionIds: ['new-entry'] });
  });
});
