import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { RecallDocument } from './types';
import { validateRecallManualEvaluations, type RecallManualEvaluationVersion } from './manual-evaluations';

/** Added by schema migration 13; JSON remains the only source of truth. */
export const RECALL_MANUAL_EVALUATION_PROJECTION_SQL = `
create table recall_manual_evaluations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 entity_id text not null, state text not null check(state in ('draft','retained')), evaluation_id text not null,
 target_scope text not null check(target_scope='episode'), target_decision_id text check(target_decision_id is null),
 dictionary_version text not null check(dictionary_version='manual-v1'), source text not null check(source='manual-retrospective'),
 recorded_by text not null check(recorded_by='user'), recorded_phase text not null check(recorded_phase='post-review'), recorded_at text not null,
 knowledge_cursor text not null, execution_cursor text not null, has_seen_future integer not null check(has_seen_future in (0,1)), retained_at text,
 primary key(episode_id,version_kind,entity_id)
);
create table recall_manual_evaluation_tags (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null,
 tag_id text not null check(tag_id in ('position','entry','analysis')), dictionary_version text not null check(dictionary_version='manual-v1'),
 primary key(episode_id,version_kind,evaluation_entity_id,tag_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_manual_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
create table recall_manual_evaluation_evidence (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, ordinal integer not null,
 kind text not null check(kind in ('text','snapshot')), drawing_id text, text_revision integer, owner_id text, snapshot_id text,
 primary key(episode_id,version_kind,evaluation_entity_id,ordinal),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_manual_evaluations(episode_id,version_kind,entity_id) on delete cascade,
 check((kind='text' and drawing_id is not null and text_revision>0 and owner_id is not null and snapshot_id is null) or (kind='snapshot' and snapshot_id is not null and drawing_id is null and text_revision is null and owner_id is null))
);
create table recall_manual_evaluation_executions (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_entity_id text not null, execution_id text not null,
 primary key(episode_id,version_kind,evaluation_entity_id,execution_id),
 foreign key(episode_id,version_kind,evaluation_entity_id) references recall_manual_evaluations(episode_id,version_kind,entity_id) on delete cascade
);
create table recall_manual_evaluation_associations (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_id text not null,
 decision_id text check(decision_id is null), status text not null check(status in ('linked','needs-confirmation')),
 primary key(episode_id,version_kind,evaluation_id)
);
create table recall_manual_evaluation_association_executions (
 episode_id text not null, version_kind text not null, document_revision integer not null, evaluation_id text not null, execution_id text not null,
 primary key(episode_id,version_kind,evaluation_id,execution_id),
 foreign key(episode_id,version_kind,evaluation_id) references recall_manual_evaluation_associations(episode_id,version_kind,evaluation_id) on delete cascade
);
create table recall_bundle_manual_evaluations (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, manual_evaluation_revision_id text not null,
 primary key(episode_id,version_kind,bundle_id,manual_evaluation_revision_id)
);
`;

export function rebuildRecallManualEvaluationProjections(database: DatabaseSync, document: RecallDocument, versionKind: 'draft' | 'formal'): void {
  validateRecallManualEvaluations(document);
  for (const table of [
    'recall_bundle_manual_evaluations', 'recall_manual_evaluation_association_executions', 'recall_manual_evaluation_associations',
    'recall_manual_evaluation_executions', 'recall_manual_evaluation_evidence', 'recall_manual_evaluation_tags', 'recall_manual_evaluations',
  ]) database.prepare(`delete from ${table} where episode_id=? and version_kind=?`).run(document.episodeId, versionKind);
  const base = [document.episodeId, versionKind, document.revision] as SQLInputValue[];
  const insert = (table: string, columns: string[], values: SQLInputValue[]) => database.prepare(`insert into ${table} (${columns.join(',')}) values (${columns.map(() => '?').join(',')})`).run(...values);
  const state = document.manualEvaluations;
  for (const [kind, items] of [['draft', state?.drafts ?? []], ['retained', state?.versions ?? []]] as const) {
    for (const item of items) {
      const retained = kind === 'retained' ? item as RecallManualEvaluationVersion : undefined;
      insert('recall_manual_evaluations', ['episode_id','version_kind','document_revision','entity_id','state','evaluation_id','target_scope','target_decision_id','dictionary_version','source','recorded_by','recorded_phase','recorded_at','knowledge_cursor','execution_cursor','has_seen_future','retained_at'],
        [...base, item.id, kind, item.evaluationId, item.target.scope, item.target.decisionId, item.tagDictionaryVersion, item.source, item.recordedBy, item.recordedPhase, item.recordedAt, item.knowledgeCutoff.cursor, item.knowledgeCutoff.executionCursor, item.hasSeenFuture ? 1 : 0, retained?.retainedAt ?? null]);
      for (const tag of item.tags) insert('recall_manual_evaluation_tags', ['episode_id','version_kind','document_revision','evaluation_entity_id','tag_id','dictionary_version'], [...base, item.id, tag, item.tagDictionaryVersion]);
      for (const [ordinal, evidence] of item.evidence.entries()) insert('recall_manual_evaluation_evidence', ['episode_id','version_kind','document_revision','evaluation_entity_id','ordinal','kind','drawing_id','text_revision','owner_id','snapshot_id'], [...base, item.id, ordinal, evidence.kind, evidence.kind === 'text' ? evidence.drawingId : null, evidence.kind === 'text' ? evidence.textRevision : null, evidence.kind === 'text' ? evidence.ownerId : null, evidence.kind === 'snapshot' ? evidence.snapshotId : null]);
      for (const executionId of retained?.executionIds ?? []) insert('recall_manual_evaluation_executions', ['episode_id','version_kind','document_revision','evaluation_entity_id','execution_id'], [...base, item.id, executionId]);
    }
  }
  for (const association of state?.associations ?? []) {
    insert('recall_manual_evaluation_associations', ['episode_id','version_kind','document_revision','evaluation_id','decision_id','status'], [...base, association.evaluationId, association.decisionId, association.status]);
    for (const executionId of association.executionIds ?? []) insert('recall_manual_evaluation_association_executions', ['episode_id','version_kind','document_revision','evaluation_id','execution_id'], [...base, association.evaluationId, executionId]);
  }
  for (const bundle of document.retainedBundles ?? []) for (const revisionId of bundle.manualEvaluationRevisionIds ?? [])
    insert('recall_bundle_manual_evaluations', ['episode_id','version_kind','document_revision','bundle_id','manual_evaluation_revision_id'], [...base, bundle.id, revisionId]);
}
