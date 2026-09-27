import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { RECALL_EVALUATION_PROJECTION_SQL, RECALL_EVALUATION_SELECTION_SQL, rebuildRecallEvaluationProjections } from './evaluation-projections';
import type { RecallEvaluationDocument, RecallExitEvaluationDraft } from './exit-evaluations';
const draft: RecallExitEvaluationDraft = {
    id: 'draft', evaluationId: 'evaluation', decisionId: 'exit', earlyExit: 'uncertain', adherence: 'no-plan', reason: 'emotion', reasonDetail: null, comparedPlanVersionId: null, comparedTargetId: null, tags: ['exit', 'analysis'], tagDictionaryVersion: 'manual-v1', evidence: [{
            kind: 'text', drawingId: 'text', textRevision: 2, ownerId: 'exit'
        }], source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-03', knowledgeCutoff: {
        cursor: '2026-01-03', executionCursor: 'fill'
    }, hasSeenFuture: true
};
const document = {
    episodeId: 'episode', revision: 2, decisions: [{
            id: 'exit', executionIds: ['fill']
        }], plans: undefined, exitEvaluations: {
        drafts: [draft], versions: [{
                ...draft, id: 'version', retainedAt: '2026-01-03', executionIds: ['fill']
            }], associations: [{
                evaluationId: 'evaluation', decisionId: 'exit', status: 'linked'
            }]
    }
} as RecallEvaluationDocument;
it('rebuilds typed evaluations/tag/evidence links and preserves formal projections during draft saves', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('pragma foreign_keys=on');
    db.exec(RECALL_EVALUATION_PROJECTION_SQL);
    db.exec(RECALL_EVALUATION_SELECTION_SQL);
    rebuildRecallEvaluationProjections(db, document, 'formal');
    rebuildRecallEvaluationProjections(db, document, 'draft');
    const rows = () => db.prepare('select * from recall_exit_evaluations order by version_kind,entity_id').all();
    const before = rows();
    db.exec("delete from recall_exit_evaluations where version_kind='draft'");
    rebuildRecallEvaluationProjections(db, document, 'draft');
    expect(rows()).toEqual(before);
    expect(db.prepare('select * from recall_evaluation_tags').all()).toHaveLength(8);
    expect(db.prepare('select text_revision from recall_evaluation_evidence limit 1').get()).toMatchObject({
        text_revision: 2
    });
    db.close();
});
it('lets enclosing transaction roll back a failed projection and rejects invalid enum at SQL boundary', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(RECALL_EVALUATION_PROJECTION_SQL);
    db.exec(RECALL_EVALUATION_SELECTION_SQL);
    rebuildRecallEvaluationProjections(db, document, 'draft');
    const before = db.prepare('select * from recall_exit_evaluations').all();
    db.exec("create trigger reject_evaluation before insert on recall_exit_evaluations begin select raise(abort,'failed projection');end;");
    db.exec('begin');
    expect(() => rebuildRecallEvaluationProjections(db, document, 'draft')).toThrow(/failed projection/);
    db.exec('rollback');
    expect(db.prepare('select * from recall_exit_evaluations').all()).toEqual(before);
    db.exec('drop trigger reject_evaluation');
    expect(() => db.prepare("update recall_exit_evaluations set early_exit='maybe'").run()).toThrow();
    db.close();
});
it('projects explicit current evaluation choices separately from preserved histories', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('pragma foreign_keys=on');
    db.exec(RECALL_EVALUATION_PROJECTION_SQL);
    db.exec(RECALL_EVALUATION_SELECTION_SQL);
    const selected = structuredClone(document);
    selected.exitEvaluations!.activeEvaluationByDecision = [{
            decisionId: 'exit', evaluationId: 'evaluation'
        }];
    rebuildRecallEvaluationProjections(db, selected, 'draft');
    expect(db.prepare('select decision_id,evaluation_id from recall_evaluation_selections').get()).toMatchObject({
        decision_id: 'exit', evaluation_id: 'evaluation'
    });
    expect(db.prepare('select * from recall_exit_evaluations').all()).toHaveLength(2);
    db.close();
});
