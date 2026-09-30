import { createHash } from "node:crypto";

import { TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA } from "./tradingview-account-migration-schema";

export interface SqliteMigration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

const unifiedSchemaSql = `
create table if not exists data_migrations (
  source_fingerprint text primary key,
  source_client_id text not null,
  version integer not null,
  status text not null,
  counts_json text not null check (json_valid(counts_json)),
  validation_digest text,
  created_at text not null default current_timestamp,
  completed_at text
);

create table if not exists instruments (
  id text primary key,
  symbol text not null,
  name text not null,
  market text not null,
  currency text not null,
  metadata_json text check (metadata_json is null or json_valid(metadata_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists import_batches (
  id text primary key,
  source_fingerprint text unique,
  source_name text,
  source_type text,
  imported_at text not null,
  record_count integer not null default 0,
  reconciliation_json text check (reconciliation_json is null or json_valid(reconciliation_json)),
  evidence_json text check (evidence_json is null or json_valid(evidence_json)),
  created_at text not null default current_timestamp
);

create table if not exists executions (
  id text primary key,
  import_batch_id text references import_batches(id) on delete set null,
  instrument_id text not null references instruments(id) on delete restrict,
  account text,
  side text not null,
  executed_at text not null,
  quantity text not null,
  price text not null,
  fee text,
  currency text,
  evidence_json text check (evidence_json is null or json_valid(evidence_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create index if not exists executions_instrument_executed_at on executions(instrument_id, executed_at);

create table if not exists reviews (
  episode_id text primary key,
  instrument_id text references instruments(id) on delete set null,
  cursor_json text check (cursor_json is null or json_valid(cursor_json)),
  plan_json text check (plan_json is null or json_valid(plan_json)),
  review_json text check (review_json is null or json_valid(review_json)),
  drawings_json text check (drawings_json is null or json_valid(drawings_json)),
  revisions_json text check (revisions_json is null or json_valid(revisions_json)),
  confirmed_tags_json text check (confirmed_tags_json is null or json_valid(confirmed_tags_json)),
  created_at text not null default current_timestamp,
  updated_at text not null
);

create table if not exists daily_candles (
  instrument_id text not null references instruments(id) on delete cascade,
  date text not null,
  adjustment_mode text not null default 'raw',
  open text not null,
  high text not null,
  low text not null,
  close text not null,
  volume text,
  primary key (instrument_id, date, adjustment_mode)
);

create table if not exists market_candles (
  instrument_id text not null references instruments(id) on delete cascade,
  interval text not null,
  timestamp text not null,
  adjustment_mode text not null default 'raw',
  open text not null,
  high text not null,
  low text not null,
  close text not null,
  volume text,
  primary key (instrument_id, interval, timestamp, adjustment_mode)
);

create table if not exists coverage (
  instrument_id text not null references instruments(id) on delete cascade,
  adjustment_mode text not null default 'raw',
  start_date text,
  end_date text,
  updated_at text not null default current_timestamp,
  primary key (instrument_id, adjustment_mode)
);

create table if not exists interval_coverage (
  instrument_id text not null references instruments(id) on delete cascade,
  interval text not null,
  adjustment_mode text not null default 'raw',
  start_timestamp text,
  end_timestamp text,
  updated_at text not null default current_timestamp,
  primary key (instrument_id, interval, adjustment_mode)
);

create table if not exists provider_symbols (
  instrument_id text not null references instruments(id) on delete cascade,
  provider text not null,
  provider_symbol text not null,
  metadata_json text check (metadata_json is null or json_valid(metadata_json)),
  updated_at text not null default current_timestamp,
  primary key (instrument_id, provider),
  unique (provider, provider_symbol)
);

create table if not exists tag_suggestions (
  id text primary key,
  episode_id text references reviews(episode_id) on delete cascade,
  instrument_id text references instruments(id) on delete set null,
  tag text not null,
  status text not null,
  evidence_json text check (evidence_json is null or json_valid(evidence_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists market_data_jobs (
  id text primary key,
  instrument_id text references instruments(id) on delete cascade,
  provider text not null,
  interval text,
  status text not null,
  progress_json text check (progress_json is null or json_valid(progress_json)),
  error_json text check (error_json is null or json_valid(error_json)),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists app_settings (
  key text primary key,
  value_json text not null check (json_valid(value_json)),
  updated_at text not null default current_timestamp
);
`;

const repositoryCompletenessSql = `
alter table daily_candles add column provider text;
alter table daily_candles add column provider_symbol text;
alter table daily_candles add column currency text;
alter table daily_candles add column fetched_at text;

alter table market_candles add column provider text;
alter table market_candles add column provider_symbol text;
alter table market_candles add column currency text;
alter table market_candles add column fetched_at text;
alter table market_candles add column knowledge_at text;

alter table interval_coverage add column details_json text check (details_json is null or json_valid(details_json));
`;

const apiCompletenessSql = `
alter table coverage add column details_json text check (details_json is null or json_valid(details_json));
`;

const simulationScopeSql = `
alter table import_batches add column trade_nature text;
alter table import_batches add column simulation_run_id text;
alter table executions add column trade_nature text;
alter table executions add column simulation_run_id text;
`;

const localizedInstrumentNameSql = `
alter table instruments add column localized_name_json text check (localized_name_json is null or json_valid(localized_name_json));
`;

const recallWorkspaceSql = `
create table if not exists recall_documents (
  episode_id text primary key,
  draft_json text not null check (json_valid(draft_json)),
  finalized_json text check (finalized_json is null or json_valid(finalized_json)),
  revision integer not null default 0 check (revision >= 0),
  updated_at text not null
);
`;

const recallPlanSql = `
create table recall_plan_versions (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null check(document_revision>=0),
 entity_id text not null, state text not null check(state in ('draft','retained')), plan_id text not null, decision_id text not null, parent_version_id text,
 kind text not null check(kind in ('initial','adjustment','correction')), direction text check(direction in ('long','short')), currency text,
 price_basis text check(price_basis in ('raw','adjusted')), entry text, initial_stop text, size_input_mode text not null check(size_input_mode in ('quantity','amount','ratio')),
 size_input_value text, resolved_quantity text, quantity_unit text not null check(quantity_unit in ('share','unit')),
 capital_amount text, capital_currency text, capital_as_of text, capital_source text, capital_snapshot_ref text,
 recorded_phase text not null check(recorded_phase in ('pre-entry','holding','post-review')), source text not null check(source='retrospective'), recorded_at text not null,
 knowledge_cursor text not null, execution_cursor text not null, has_seen_future integer not null check(has_seen_future in (0,1)), retained_at text,
 primary key(episode_id,version_kind,entity_id)
);
create table recall_plan_targets (
 episode_id text not null, version_kind text not null, document_revision integer not null, plan_entity_id text not null, entity_id text not null, ordinal integer not null,
 price text, quantity text, ratio text, primary key(episode_id,version_kind,plan_entity_id,entity_id),
 foreign key(episode_id,version_kind,plan_entity_id) references recall_plan_versions(episode_id,version_kind,entity_id) on delete cascade
);
create table recall_risk_baselines (
 episode_id text not null, version_kind text not null, document_revision integer not null, entity_id text not null, scope text not null check(scope in ('decision','episode')),
 decision_id text, plan_version_id text not null, amount text not null, currency text not null, method text not null check(method in ('planned-price-risk','fixed-budget')),
 method_version text not null check(method_version='risk-v1'), frozen_at text not null, corrects_baseline_id text,
 primary key(episode_id,version_kind,entity_id),foreign key(episode_id,version_kind,plan_version_id) references recall_plan_versions(episode_id,version_kind,entity_id) on delete cascade,
 check(scope!='decision' or decision_id is not null)
);
create table recall_retained_bundles (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null, entity_id text not null,
 snapshot_id text not null, capture_revision integer not null, retained_at text not null, evidence_digest text not null,
 evidence_json text not null check(json_valid(evidence_json)), decisions_json text not null check(json_valid(decisions_json)), primary key(episode_id,version_kind,entity_id)
);
create table recall_bundle_plans (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, plan_version_id text not null,
 primary key(episode_id,version_kind,bundle_id,plan_version_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_retained_bundles(episode_id,version_kind,entity_id) on delete cascade,
 foreign key(episode_id,version_kind,plan_version_id) references recall_plan_versions(episode_id,version_kind,entity_id) on delete cascade
);
create table recall_bundle_baselines (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null, baseline_id text not null,
 primary key(episode_id,version_kind,bundle_id,baseline_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_retained_bundles(episode_id,version_kind,entity_id) on delete cascade,
 foreign key(episode_id,version_kind,baseline_id) references recall_risk_baselines(episode_id,version_kind,entity_id) on delete cascade
);
`;

const recallPlanCaptureContextSql = `
create table recall_plan_associations (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 plan_id text not null, decision_id text, status text not null check(status in ('linked','needs-confirmation')),
 primary key(episode_id,version_kind,plan_id), check((status='linked' and decision_id is not null) or (status='needs-confirmation' and decision_id is null))
);
alter table recall_retained_bundles add column capture_phase text check(capture_phase in ('pre-entry','holding','post-review'));
alter table recall_retained_bundles add column capture_cursor text;
alter table recall_retained_bundles add column capture_execution_cursor text;
alter table recall_retained_bundles add column capture_timeframe text;
alter table recall_retained_bundles add column capture_viewport_json text check(capture_viewport_json is null or json_valid(capture_viewport_json));
alter table recall_retained_bundles add column capture_has_seen_future integer check(capture_has_seen_future in (0,1));
`;

const recallRevisionsSizingEvaluationsSql = `
alter table recall_plan_versions add column revision_reason text;
alter table recall_plan_versions add column quantity_step text;
alter table recall_plan_versions add column step_source text;
alter table recall_plan_versions add column rounding text;
alter table recall_plan_versions add column derived_unrounded_quantity text;
alter table recall_plan_versions add column rounding_delta text;
alter table recall_plan_versions add column budget_amount text;
alter table recall_plan_versions add column budget_currency text;
alter table recall_plan_versions add column budget_scope text;
alter table recall_plan_versions add column budget_source_description text;
alter table recall_plan_versions add column budget_evidence_reference text;
alter table recall_plan_versions add column budget_provenance text;
alter table recall_plan_versions add column budget_knowledge_cursor text;
alter table recall_plan_versions add column budget_execution_cursor text;

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

const recallEvaluationSelectionSql = `
create table recall_evaluation_selections (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 decision_id text not null, evaluation_id text not null,
 primary key(episode_id,version_kind,decision_id),
 foreign key(episode_id,version_kind,evaluation_id) references recall_evaluation_associations(episode_id,version_kind,evaluation_id) on delete cascade
);
`;

const recallActualMetricsSql = `
create table recall_actual_metric_sources (
 episode_id text not null, version_kind text not null check(version_kind in ('draft','formal')), document_revision integer not null,
 bundle_id text not null, status text not null check(status in ('available','legacy-absent')), missing_reason text,
 method_version text check(method_version='actual-v1'), capture_revision integer not null, evidence_digest text not null, computed_at text, source_bundle_id text,
 risk_baseline_id text, risk_plan_version_id text, risk_amount text, risk_currency text, risk_scope text check(risk_scope in ('decision','episode')), risk_method text check(risk_method in ('planned-price-risk','fixed-budget')),
 primary key(episode_id,version_kind,bundle_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_retained_bundles(episode_id,version_kind,entity_id) on delete cascade,
 check((status='available' and method_version is not null and computed_at is not null and missing_reason is null) or (status='legacy-absent' and method_version is null and missing_reason is not null))
);
create table recall_actual_metrics (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null,
 scope text not null check(scope in ('bundle','exit')), scope_id text not null, metric_key text not null,
 value text, reason text, currency text, unit text not null, method_version text not null check(method_version='actual-v1'),
 primary key(episode_id,version_kind,bundle_id,scope,scope_id,metric_key),
 foreign key(episode_id,version_kind,bundle_id) references recall_actual_metric_sources(episode_id,version_kind,bundle_id) on delete cascade,
 check((value is null and reason is not null) or (value is not null and reason is null)),
 check((scope='bundle' and scope_id='') or (scope='exit' and length(scope_id)>0))
);
create table recall_actual_metric_refs (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null,
 ref_kind text not null check(ref_kind in ('execution','plan','risk')), ref_id text not null,
 primary key(episode_id,version_kind,bundle_id,ref_kind,ref_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_actual_metric_sources(episode_id,version_kind,bundle_id) on delete cascade
);
create table recall_actual_metric_exits (
 episode_id text not null, version_kind text not null, document_revision integer not null, bundle_id text not null,
 execution_id text not null, decision_id text, quantity text not null,
 primary key(episode_id,version_kind,bundle_id,execution_id),
 foreign key(episode_id,version_kind,bundle_id) references recall_actual_metric_sources(episode_id,version_kind,bundle_id) on delete cascade
);
`;

const recallManualEvaluationsSql = `
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

function migration(version: number, name: string, sql: string): SqliteMigration {
  return {
    version,
    name,
    sql,
    checksum: createHash("sha256").update(sql).digest("hex"),
  };
}

export const SQLITE_MIGRATIONS: readonly SqliteMigration[] = [
  migration(1, "unified-storage-schema", unifiedSchemaSql),
  migration(2, "preserve-repository-provenance", repositoryCompletenessSql),
  migration(3, "preserve-api-coverage-details", apiCompletenessSql),
  migration(4, "audited-trade-revisions", `
    create table trade_revisions (
      id text primary key,
      instrument_id text not null references instruments(id),
      account_id text not null,
      request_json text not null check(json_valid(request_json)),
      revision_json text not null check(json_valid(revision_json)),
      recorded_at text not null
    );
    create index trade_revisions_instrument on trade_revisions(instrument_id, recorded_at);
  `),
  migration(5, "persist-trade-nature-and-simulation-scope", simulationScopeSql),
  migration(6, "persist-localized-instrument-names", localizedInstrumentNameSql),
  migration(7, "persist-recall-workspace-drafts-and-finalized-versions", recallWorkspaceSql),
  migration(8, "project-recall-plans-and-retained-evidence", recallPlanSql),
  migration(9, "project-current-plan-associations-and-capture-context", recallPlanCaptureContextSql),
  migration(10, "project-plan-revisions-sizing-and-exit-evaluations", recallRevisionsSizingEvaluationsSql),
  migration(11, "project-explicit-current-evaluation-selection", recallEvaluationSelectionSql),
  migration(12, "project-frozen-recall-actual-metrics", recallActualMetricsSql),
  migration(13, "project-frozen-recall-manual-evaluations", recallManualEvaluationsSql),
  migration(14, "tradingview-account-migration", TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA),
];
