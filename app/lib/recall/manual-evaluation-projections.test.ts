import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { RECALL_MANUAL_EVALUATION_PROJECTION_SQL, rebuildRecallManualEvaluationProjections } from './manual-evaluation-projections';
import type { RecallDocument } from './types';

const manual = {
  drafts: [{
    id: 'draft', evaluationId: 'evaluation', target: { scope: 'episode', decisionId: null }, tags: ['position', 'analysis'],
    tagDictionaryVersion: 'manual-v1', evidence: [{ kind: 'snapshot', snapshotId: 'snapshot' }], source: 'manual-retrospective',
    recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-03',
    knowledgeCutoff: { cursor: '2026-01-03', executionCursor: 'fill' }, hasSeenFuture: true,
  }],
  versions: [{
    id: 'version', evaluationId: 'evaluation', target: { scope: 'episode', decisionId: null }, tags: ['position', 'analysis'],
    tagDictionaryVersion: 'manual-v1', evidence: [{ kind: 'snapshot', snapshotId: 'snapshot' }], source: 'manual-retrospective',
    recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-03',
    knowledgeCutoff: { cursor: '2026-01-03', executionCursor: 'fill' }, hasSeenFuture: true,
    retainedAt: '2026-01-03', executionIds: ['fill'],
  }],
  associations: [{ evaluationId: 'evaluation', decisionId: null, status: 'linked' }],
} as const;

const document = {
  version: 1, episodeId: 'episode', revision: 2, decisions: [{ id: 'entry', executionIds: ['fill'] }], snapshots: [],
  working: { drawings: [], timeframe: '1D', cursor: '2026-01-03', executionCursor: 'fill', selectedDecisionId: 'entry' },
  status: 'in-progress', updatedAt: '2026-01-03', manualEvaluations: manual,
  retainedBundles: [{
    id: 'bundle', snapshotId: 'snapshot', documentRevision: 2, retainedAt: '2026-01-03', executionEvidence: { version: 1, executionIds: ['fill'], digest: 'digest', payload: { episode: {}, executions: [] } },
    decisions: [], captureContext: { cursor: '2026-01-03', executionCursor: 'fill', timeframe: '1D' }, planVersionIds: [], riskBaselineIds: [], manualEvaluationRevisionIds: ['version'],
  }],
} as unknown as RecallDocument;

it('projects manual drafts, immutable versions, evidence, associations, and bundle refs', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('pragma foreign_keys=on');
  db.exec(RECALL_MANUAL_EVALUATION_PROJECTION_SQL);
  rebuildRecallManualEvaluationProjections(db, document, 'draft');
  expect(db.prepare('select state,target_scope,target_decision_id from recall_manual_evaluations order by state').all()).toEqual([
    { state: 'draft', target_scope: 'episode', target_decision_id: null },
    { state: 'retained', target_scope: 'episode', target_decision_id: null },
  ]);
  expect(db.prepare('select tag_id from recall_manual_evaluation_tags order by tag_id, evaluation_entity_id').all()).toEqual([{ tag_id: 'analysis' }, { tag_id: 'analysis' }, { tag_id: 'position' }, { tag_id: 'position' }]);
  expect(db.prepare('select snapshot_id from recall_manual_evaluation_evidence').get()).toEqual({ snapshot_id: 'snapshot' });
  expect(db.prepare('select manual_evaluation_revision_id from recall_bundle_manual_evaluations').get()).toEqual({ manual_evaluation_revision_id: 'version' });
  db.close();
});
