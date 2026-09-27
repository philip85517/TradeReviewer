import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { validateRecallExitEvaluations, type RecallEvaluationDocument, type RecallExitEvaluationVersion } from './exit-evaluations';
/** Append as a new migration; never amend an already applied migration. */
export const RECALL_EVALUATION_PROJECTION_SQL = `
create table recall_exit_evaluations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 entity_id text not null, state text not null check(state in ('draft','retained')), evaluation_id text not null, captured_decision_id text not null,
 early_exit text check(early_exit in ('yes','no','uncertain')), adherence text check(adherence in ('as-planned','deviated','no-plan')),
 reason text check(reason in ('planned-partial','structure-invalid','risk-reduction','emotion','capital-need','other')), reason_detail text,
 compared_plan_version_id text, compared_target_id text, dictionary_version text not null check(dictionary_version='manual-v1'),
 source text not null check(source='manual-retrospective'), recorded_by text not null check(recorded_by='user'),
 recorded_phase text not null check(recorded_phase='post-review'), recorded_at text not null, knowledge_cursor text not null,
 execution_cursor text not null, has_seen_future integer not null check(has_seen_future in (0,1)), retained_at text,
 primary key(episode_id,version_kind,entity_id), check(reason!='other' or (reason_detail is not null and length(trim(reason_detail))>0)),
 check(compared_target_id is null or compared_plan_version_id is not null)
);
create table recall_evaluation_associations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 evaluation_id text not null, decision_id text, status text not null check(status in ('linked','needs-confirmation')),
 primary key(episode_id,version_kind,evaluation_id),check((status='linked' and decision_id is not null) or (status='needs-confirmation' and decision_id is null))
);
create table recall_evaluation_tags (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null,
 tag_id text not null check(tag_id in ('position','entry','exit','analysis')), dictionary_version text not null check(dictionary_version='manual-v1'),
 primary key(episode_id,version_kind,evaluation_entity_id,tag_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
create table recall_evaluation_evidence (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, ordinal integer not null,
 kind text not null check(kind in ('text','snapshot')), drawing_id text, text_revision integer, owner_id text, snapshot_id text,
 primary key(episode_id,version_kind,evaluation_entity_id,ordinal),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade,
 check((kind='text' and drawing_id is not null and text_revision>0 and owner_id is not null and snapshot_id is null) or (kind='snapshot' and snapshot_id is not null and drawing_id is null and text_revision is null and owner_id is null))
);
create table recall_evaluation_executions (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, execution_id text not null,
 primary key(episode_id,version_kind,evaluation_entity_id,execution_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
create table recall_bundle_evaluations (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, evaluation_revision_id text not null,
 primary key(episode_id,version_kind,bundle_id,evaluation_revision_id),
 foreign key(episode_id,version_kind,evaluation_revision_id) references recall_exit_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
`;
/** Caller owns CAS transaction; rebuild only the requested draft/formal partition. */
export function rebuildRecallEvaluationProjections(database: DatabaseSync, document: RecallEvaluationDocument, versionKind: 'draft' | 'formal'): void {
    validateRecallExitEvaluations(document);
    const base = ['episode_id', 'version_kind', 'document_revision'];
    const prefix = [document.episodeId, versionKind, document.revision];
    for (const table of ['recall_evaluation_selections', 'recall_bundle_evaluations', 'recall_evaluation_executions', 'recall_evaluation_evidence', 'recall_evaluation_tags', 'recall_evaluation_associations', 'recall_exit_evaluations'])
        database.prepare(`delete from ${table} where episode_id=? and version_kind=?`).run(document.episodeId, versionKind);
    const insert = (table: string, columns: string[], values: SQLInputValue[]) => database.prepare(`insert into ${table} (${columns.join(',')}) values (${columns.map(() => '?').join(',')})`).run(...values);
    for (const [state, items] of [['draft', document.exitEvaluations?.drafts ?? []], ['retained', document.exitEvaluations?.versions ?? []]] as const)
        for (const item of items) {
            const version = item as RecallExitEvaluationVersion;
            insert('recall_exit_evaluations', [...base, 'entity_id', 'state', 'evaluation_id', 'captured_decision_id', 'early_exit', 'adherence', 'reason', 'reason_detail', 'compared_plan_version_id', 'compared_target_id', 'dictionary_version', 'source', 'recorded_by', 'recorded_phase', 'recorded_at', 'knowledge_cursor', 'execution_cursor', 'has_seen_future', 'retained_at'], [...prefix, item.id, state, item.evaluationId, item.decisionId, item.earlyExit, item.adherence, item.reason, item.reasonDetail, item.comparedPlanVersionId, item.comparedTargetId, item.tagDictionaryVersion, item.source, item.recordedBy, item.recordedPhase, item.recordedAt, item.knowledgeCutoff.cursor, item.knowledgeCutoff.executionCursor, item.hasSeenFuture ? 1 : 0, version.retainedAt ?? null]);
            for (const tag of item.tags)
                insert('recall_evaluation_tags', [...base, 'evaluation_entity_id', 'tag_id', 'dictionary_version'], [...prefix, item.id, tag, item.tagDictionaryVersion]);
            for (const [ordinal, e] of item.evidence.entries())
                insert('recall_evaluation_evidence', [...base, 'evaluation_entity_id', 'ordinal', 'kind', 'drawing_id', 'text_revision', 'owner_id', 'snapshot_id'], [...prefix, item.id, ordinal, e.kind, e.kind === 'text' ? e.drawingId : null, e.kind === 'text' ? e.textRevision : null, e.kind === 'text' ? e.ownerId : null, e.kind === 'snapshot' ? e.snapshotId : null]);
            for (const id of version.executionIds ?? [])
                insert('recall_evaluation_executions', [...base, 'evaluation_entity_id', 'execution_id'], [...prefix, item.id, id]);
        }
    for (const a of document.exitEvaluations?.associations ?? [])
        insert('recall_evaluation_associations', [...base, 'evaluation_id', 'decision_id', 'status'], [...prefix, a.evaluationId, a.decisionId, a.status]);
    for (const selection of document.exitEvaluations?.activeEvaluationByDecision ?? [])
        insert('recall_evaluation_selections', [...base, 'decision_id', 'evaluation_id'], [...prefix, selection.decisionId, selection.evaluationId]);
    for (const bundle of document.retainedBundles ?? [])
        for (const id of (bundle as typeof bundle & {
            evaluationRevisionIds?: string[];
        }).evaluationRevisionIds ?? [])
            insert('recall_bundle_evaluations', [...base, 'bundle_id', 'evaluation_revision_id'], [...prefix, bundle.id, id]);
}
/** Separate append-only migration after the original evaluation projection migration. */
export const RECALL_EVALUATION_SELECTION_SQL = `
create table recall_evaluation_selections (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 decision_id text not null, evaluation_id text not null,
 primary key(episode_id,version_kind,decision_id),
 foreign key(episode_id,version_kind,evaluation_id) references recall_evaluation_associations(episode_id,version_kind,evaluation_id) on delete cascade
);
`;
