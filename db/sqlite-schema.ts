import { createHash } from "node:crypto";

import { IMPORT_HISTORY_AUDIT_SCHEMA } from "./import-history-audit-schema.ts";

import { TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA } from "./tradingview-account-migration-schema.ts";

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

type VersionedJsonColumn = string | Readonly<{ column: string; ignoreRootKeys: readonly string[] }>;

function sqlIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Invalid version trigger identifier");
  return value;
}

function ignoredJsonRootKeys(column: VersionedJsonColumn): string[] {
  if (typeof column === "string") return [];
  return column.ignoreRootKeys.map((key) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new Error("Invalid version trigger JSON key");
    return key;
  });
}

function jsonSemanticsChanged(oldValue: string, newValue: string, ignoredRootKeys: readonly string[]): string {
  const includeBranch = ignoredRootKeys.length === 0 ? "" : `
        where not (p.path = '$' and typeof(n.key) = 'text' and n.key in (${ignoredRootKeys.map((key) => `'${key}'`).join(", ")}))`;
  const ignoredSame = ignoredRootKeys.length === 0 ? "" : `
    when json_remove(${oldValue}, ${ignoredRootKeys.map((key) => `'$.${key}'`).join(", ")})
      is json_remove(${newValue}, ${ignoredRootKeys.map((key) => `'$.${key}'`).join(", ")}) then 0`;
  // JSONB retains numeric token text; atom does not (REAL rounds/overflows).
  // Parse each input tree once, using decoded keys for paths and duplicate
  // detection. Removing ignored branches here never rewrites source numbers.
  // Decimal coefficients stay text. <=15-digit exponents plus SQLite's bounded
  // string-length shift fit INTEGER exactly. Larger exponents retain a textual
  // (exponent, shift) pair: equivalent rewrites may advance, distinct values
  // cannot be lost. No per-digit arithmetic or connection UDF is required.
  // Bound exact comparison to 4096 bytes / 64 nodes per input. Larger changed
  // inputs conservatively invalidate plans, avoiding quadratic path lookups.
  // json_remove's text-equality fast path preserves original numeric tokens.
  return `(case
    when ${oldValue} is ${newValue} then 0
    when coalesce(json_valid(${oldValue}), 0) = 0 or coalesce(json_valid(${newValue}), 0) = 0 then 1
    ${ignoredSame}
    when length(cast(${oldValue} as blob)) > 4096 or length(cast(${newValue} as blob)) > 4096 then 1
    else (with recursive
      inputs(side, document) as materialized (values (0, jsonb(${oldValue})), (1, jsonb(${newValue}))),
      tree as materialized (
        select side, document, j.id, j.parent, j.key, j.type, j.atom, j.fullkey
        from inputs, json_tree(document) j
      ),
      paths(side, id, path) as (
        select side, id, '$' from tree where parent is null
        union all
        select n.side, n.id, p.path || '/' || json_quote(n.key)
        from tree n join paths p on n.side = p.side and n.parent = p.id ${includeBranch}
      ),
      visible as materialized (
        select t.side, p.path, t.type, t.atom, t.document, t.fullkey
        from tree t join paths p on t.side = p.side and t.id = p.id
      ),
      number_tokens as (
        select side, path, lower(document -> fullkey) as token
        from visible where type in ('integer', 'real')
      ),
      unsigned_numbers as (
        select side, path, case when substr(token, 1, 1) = '-' then '-' else '' end as sign,
          ltrim(token, '-') as token from number_tokens
      ),
      number_parts as (
        select side, path, sign,
          case when instr(token, 'e') > 0 then substr(token, 1, instr(token, 'e') - 1) else token end as mantissa,
          case when instr(token, 'e') > 0 then substr(token, instr(token, 'e') + 1) else '0' end as exponent
        from unsigned_numbers
      ),
      decimal_parts as (
        select side, path, sign, replace(mantissa, '.', '') as digits,
          case when instr(mantissa, '.') > 0 then length(mantissa) - instr(mantissa, '.') else 0 end as scale,
          case when substr(exponent, 1, 1) = '-' then '-' else '' end as exponent_sign,
          coalesce(nullif(ltrim(ltrim(exponent, '+-'), '0'), ''), '0') as exponent_digits
        from number_parts
      ),
      normalized_numbers as (
        select side, path, sign, rtrim(ltrim(digits, '0'), '0') as coefficient,
          length(digits) - length(rtrim(digits, '0')) - scale as shift, exponent_sign, exponent_digits
        from decimal_parts
      ),
      canonical_numbers as (
        select side, path, case when coefficient = '' then '0' else sign || coefficient || 'e' ||
          case when length(exponent_digits) <= 15
            then cast(cast(exponent_sign || exponent_digits as integer) + shift as text)
            else exponent_sign || exponent_digits || ':' || cast(shift as text) end end as exact_number
        from normalized_numbers
      ),
      canonical as materialized (
        select v.side, v.path, case when v.type in ('integer', 'real') then 'number' else v.type end as kind,
          case when v.type in ('integer', 'real') then n.exact_number else v.atom end as scalar
        from visible v left join canonical_numbers n on v.side = n.side and v.path = n.path
      )
      select case
        when exists(select 1 from tree group by side having count(*) > 64) then 1
        when exists(select 1 from visible group by side, path having count(*) > 1) then 1
        else exists(select path, kind, scalar from canonical where side = 0 except select path, kind, scalar from canonical where side = 1)
          or exists(select path, kind, scalar from canonical where side = 1 except select path, kind, scalar from canonical where side = 0)
      end)
    end)`;
}

/** Migration-time SQL only. New formal source tables must install these in their own migration. */
export function tradeBookVersionTriggersSql(
  table: string,
  scalarColumns: readonly string[],
  jsonColumns: readonly VersionedJsonColumn[] = [],
): string {
  const name = sqlIdentifier(table);
  const differences = [
    ...scalarColumns.map((column) => `old.${sqlIdentifier(column)} is not new.${sqlIdentifier(column)}`),
    ...jsonColumns.map((column) => {
      const name = sqlIdentifier(typeof column === "string" ? column : column.column);
      return jsonSemanticsChanged(`old.${name}`, `new.${name}`, ignoredJsonRootKeys(column));
    }),
  ];
  if (differences.length === 0) throw new Error("Versioned tables must declare their business columns");
  const advance = `
    update trade_book_state set sequence = sequence + 1
      where singleton = 1 and typeof(sequence) = 'integer'
        and sequence >= 0 and sequence < 9007199254740991
        and length(trim(database_id)) > 0 and length(trim(epoch)) > 0;
    select case when changes() != 1 then raise(abort, 'Trade book version state is unavailable or exhausted') end;
  `;
  return `
    create trigger trade_book_${name}_insert after insert on ${name} begin ${advance} end;
    create trigger trade_book_${name}_delete after delete on ${name} begin ${advance} end;
    create trigger trade_book_${name}_update after update on ${name}
      when ${differences.join(" or ")}
      begin ${advance} end;
  `;
}

const tradeBookVersionSql = `
create table trade_book_state (
  singleton integer primary key check(singleton = 1),
  database_id text not null check(length(trim(database_id)) > 0),
  epoch text not null check(length(trim(epoch)) > 0),
  sequence integer not null check(typeof(sequence) = 'integer' and sequence >= 0 and sequence <= 9007199254740991)
);
insert into trade_book_state(singleton, database_id, epoch, sequence)
values (1, lower(hex(randomblob(16))), lower(hex(randomblob(16))), 0);
${tradeBookVersionTriggersSql("instruments", ["id", "symbol", "market", "currency"])}
${tradeBookVersionTriggersSql("executions", [
  "id", "import_batch_id", "instrument_id", "account", "side", "executed_at",
  "quantity", "price", "fee", "currency", "trade_nature", "simulation_run_id",
], [{ column: "evidence_json", ignoreRootKeys: ["accountLabel"] }])}
${tradeBookVersionTriggersSql("import_batches", [
  "id", "source_fingerprint", "source_name", "source_type", "imported_at", "record_count", "trade_nature", "simulation_run_id",
], ["reconciliation_json", "evidence_json"])}
${tradeBookVersionTriggersSql("trade_revisions", ["id", "instrument_id", "account_id", "recorded_at"], ["request_json", "revision_json"])}
${tradeBookVersionTriggersSql("tradingview_account_migration_aliases", ["operation_id", "alias_kind", "old_id", "new_id"])}
`;

const sourceMaterialsSql = `
create table source_materials (
  id text primary key,
  current_version_id text references source_material_versions(id) deferrable initially deferred,
  created_at text not null
);
create table source_material_versions (
  id text primary key,
  material_id text not null references source_materials(id) on delete restrict,
  supersedes_version_id text references source_material_versions(id) on delete restrict,
  parser_version text not null,
  source_kind text not null,
  locator_json text not null check(json_valid(locator_json)),
  file_fingerprint text,
  scope_json text not null check(json_valid(scope_json)),
  diagnostics_json text not null check(json_valid(diagnostics_json)),
  content_json text not null check(json_valid(content_json)),
  legacy_batch_id text unique,
  legacy_batch_json text check(legacy_batch_json is null or json_valid(legacy_batch_json)),
  raw_reconciliation_json text,
  raw_evidence_json text,
  legacy_revision_request_json text,
  recorded_at text not null,
  unique(material_id,id)
);
create table source_observations (
  id text primary key,
  version_id text not null references source_material_versions(id) on delete restrict,
  observation_key text,
  identity_status text not null check(identity_status in ('located','unresolved')),
  locator_json text not null check(json_valid(locator_json)),
  raw_json text check(raw_json is null or json_valid(raw_json)),
  original_account_id text,
  check((identity_status='located' and observation_key is not null) or (identity_status='unresolved' and observation_key is null))
);
create index source_observations_version on source_observations(version_id,id);
create table source_execution_links (
  observation_id text not null references source_observations(id) on delete restrict,
  execution_id text not null references executions(id) on delete restrict,
  reason text not null,
  recorded_at text not null,
  primary key(observation_id,execution_id)
);
create index source_execution_links_execution on source_execution_links(execution_id,observation_id);
create table source_material_account_mappings (
  material_id text not null references source_materials(id) on delete restrict,
  original_account_id text not null,
  canonical_account_id text not null,
  reason text not null,
  audit_reference text not null,
  recorded_at text not null,
  primary key(material_id,original_account_id)
);
-- Only the coordinated fact writer changes this state. Absence means active.
create table execution_fact_states (
  execution_id text primary key references executions(id) on delete restrict,
  state text not null check(state in ('active','withdrawn')),
  revision_id text not null references trade_revisions(id) on delete restrict,
  reason text not null,
  recorded_at text not null,
  check(state <> 'withdrawn' or length(trim(reason)) > 0)
);

-- Every historical batch keeps its own identity; names and amounts are not identity.
insert into source_materials(id,created_at)
select 'legacy:material:'||id,imported_at from import_batches;
insert into source_material_versions (
  id,material_id,parser_version,source_kind,locator_json,file_fingerprint,
  scope_json,diagnostics_json,content_json,legacy_batch_id,legacy_batch_json,
  raw_reconciliation_json,raw_evidence_json,legacy_revision_request_json,recorded_at
)
select 'legacy:version:'||b.id,'legacy:material:'||b.id,'legacy-unrecorded',
  coalesce(b.source_type,'unknown'),json_object('legacyBatchId',b.id),b.source_fingerprint,
  '{"accounts":{"values":[],"unknown":true},"markets":{"values":[],"unknown":true},"instruments":{"values":[],"unknown":true},"periods":{"values":[],"unknown":true}}',
  case when b.source_fingerprint is null then '[{"code":"FILE_FINGERPRINT_UNKNOWN"}]' else '[]' end,
  '{}',b.id,
  json_object('id',b.id,'source_fingerprint',b.source_fingerprint,'source_name',b.source_name,
    'source_type',b.source_type,'imported_at',b.imported_at,'record_count',b.record_count,
    'reconciliation_json',b.reconciliation_json,'evidence_json',b.evidence_json,
    'created_at',b.created_at,'trade_nature',b.trade_nature,'simulation_run_id',b.simulation_run_id),
  b.reconciliation_json,b.evidence_json,r.request_json,b.imported_at
from import_batches b left join trade_revisions r on r.id=b.id;
update source_materials set current_version_id='legacy:version:'||substr(id,length('legacy:material:')+1);

-- Raw evidence alone may prove a file-local position. Never use Store's row:0 fallback.
with candidates as (
  select e.*,
    case when json_type(evidence_json,'$.source.fileFingerprint')='text'
      and length(trim(json_extract(evidence_json,'$.source.fileFingerprint')))>0
      and json_type(evidence_json,'$.source.row')='integer' and json_extract(evidence_json,'$.source.row')>0
    then json_array(json_extract(evidence_json,'$.source.fileFingerprint'),
      json_extract(evidence_json,'$.source.page'),json_extract(evidence_json,'$.source.sheet'),json_extract(evidence_json,'$.source.row')) end as position_key
  from executions e where import_batch_id is not null
), positions as (
  select *,count(*) over(partition by import_batch_id,position_key) as multiplicity from candidates
)
insert into source_observations(id,version_id,observation_key,identity_status,locator_json,raw_json,original_account_id)
select 'legacy:observation:'||length(import_batch_id)||':'||import_batch_id||':'||id,
  'legacy:version:'||import_batch_id,
  case when multiplicity=1 then position_key end,
  case when multiplicity=1 and position_key is not null then 'located' else 'unresolved' end,
  case when position_key is not null then json_object('fileFingerprint',json_extract(evidence_json,'$.source.fileFingerprint'),
    'page',json_extract(evidence_json,'$.source.page'),'sheet',json_extract(evidence_json,'$.source.sheet'),'row',json_extract(evidence_json,'$.source.row')) else '{}' end,
  evidence_json,
  case when json_type(evidence_json,'$.accountCorrection.originalAccountId')='text'
    then json_extract(evidence_json,'$.accountCorrection.originalAccountId') else account end
from positions;
insert into source_execution_links(observation_id,execution_id,reason,recorded_at)
select 'legacy:observation:'||length(import_batch_id)||':'||import_batch_id||':'||id,id,'legacy-batch-reference',created_at
from executions where import_batch_id is not null;

create trigger source_material_head_owner before update of current_version_id on source_materials
when new.current_version_id is not null and not exists(
  select 1 from source_material_versions where id=new.current_version_id and material_id=new.id
) begin select raise(abort,'Material version belongs to another material'); end;
create trigger source_material_head_insert_owner after insert on source_materials
when new.current_version_id is not null and not exists(
  select 1 from source_material_versions where id=new.current_version_id and material_id=new.id
) begin select raise(abort,'Material version belongs to another material'); end;
create trigger source_version_parent_owner before insert on source_material_versions
when new.supersedes_version_id is not null and not exists(
  select 1 from source_material_versions where id=new.supersedes_version_id and material_id=new.material_id
) begin select raise(abort,'Superseded version belongs to another material'); end;
${["source_material_versions", "source_observations", "source_execution_links"].map(table => `
create trigger ${table}_immutable_update before update on ${table} begin select raise(abort,'Source evidence is immutable'); end;
create trigger ${table}_immutable_delete before delete on ${table} begin select raise(abort,'Source evidence is immutable'); end;`).join("\n")}
${tradeBookVersionTriggersSql("source_materials", ["id", "current_version_id"])}
${tradeBookVersionTriggersSql("source_material_versions", ["id", "material_id", "supersedes_version_id", "parser_version", "source_kind", "file_fingerprint", "legacy_batch_id", "recorded_at", "raw_reconciliation_json", "raw_evidence_json", "legacy_revision_request_json"], ["locator_json", "scope_json", "diagnostics_json", "content_json", "legacy_batch_json"])}
${tradeBookVersionTriggersSql("source_observations", ["id", "version_id", "observation_key", "identity_status", "original_account_id"], ["locator_json", "raw_json"])}
${tradeBookVersionTriggersSql("source_execution_links", ["observation_id", "execution_id", "reason", "recorded_at"])}
${tradeBookVersionTriggersSql("source_material_account_mappings", ["material_id", "original_account_id", "canonical_account_id", "reason", "audit_reference", "recorded_at"])}
${tradeBookVersionTriggersSql("execution_fact_states", ["execution_id", "state", "revision_id", "reason", "recorded_at"])}
`;

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
  migration(15, "persist-trade-book-version-and-legacy-write-coverage", tradeBookVersionSql),
  migration(16, "preserve-source-material-lineage-and-scope", sourceMaterialsSql),
  migration(17, "persist-trade-change-plans-and-receipts", `
    alter table trade_revisions add column scope_account_unknown integer not null default 0 check(scope_account_unknown in (0,1));
    -- This discriminator is an encoding boundary, never an editable account identity.
    create trigger trade_revision_scope_immutable before update of scope_account_unknown on trade_revisions
    when new.scope_account_unknown is not old.scope_account_unknown
    begin select raise(abort,'Audit account scope is immutable'); end;
    create trigger trade_revision_scope_insert before insert on trade_revisions
    when (new.scope_account_unknown=1 and (new.account_id<>''
        or json_extract(new.request_json,'$.kind') is not 'fact-state-audit-v1'
        or json_type(new.request_json,'$.accountId') is not 'null'))
      or (new.scope_account_unknown=0 and length(trim(new.account_id))=0)
    begin select raise(abort,'Invalid audit account encoding'); end;
    create trigger trade_revision_scope_update before update of account_id,request_json,revision_json on trade_revisions
    when (new.scope_account_unknown=1 and (new.account_id<>''
        or json_extract(new.request_json,'$.kind') is not 'fact-state-audit-v1'
        or json_type(new.request_json,'$.accountId') is not 'null'))
      or (new.scope_account_unknown=0 and length(trim(new.account_id))=0)
    begin select raise(abort,'Invalid audit account encoding'); end;
    create trigger fact_state_audit_validate before insert on trade_revisions
    when json_extract(new.request_json,'$.kind')='fact-state-audit-v1'
      or json_extract(new.revision_json,'$.kind')='fact-state-audit-v1'
    begin
      select case when new.request_json is not new.revision_json
        or json_extract(new.request_json,'$.kind') is not 'fact-state-audit-v1'
        or json_extract(new.request_json,'$.id') is not new.id
        or json_extract(new.request_json,'$.instrumentId') is not new.instrument_id
        or json_extract(new.request_json,'$.recordedAt') is not new.recorded_at
        or json_type(new.request_json,'$.reason') is not 'text'
        or length(trim(json_extract(new.request_json,'$.reason')))=0
        or json_extract(new.request_json,'$.action') not in ('withdraw','activate')
        or json_type(new.request_json,'$.action') is not 'text'
        or json_type(new.request_json,'$.changes') is not 'array'
        or json_array_length(new.request_json,'$.changes')<>1
        or json_extract(new.request_json,'$.changes[0].before') is not json_extract(new.request_json,'$.before')
        or (json_extract(new.request_json,'$.action')='withdraw' and json_type(new.request_json,'$.changes[0].after') is not 'null')
        or (json_extract(new.request_json,'$.action')='activate' and json_extract(new.request_json,'$.changes[0].after') is not json_extract(new.request_json,'$.before'))
        or not exists(
          select 1 from executions e where e.id=json_extract(new.request_json,'$.executionId')
            and e.instrument_id=new.instrument_id
            and ((new.scope_account_unknown=1 and e.account is null)
              or (new.scope_account_unknown=0 and e.account=new.account_id
                and json_extract(new.request_json,'$.accountId') is e.account))
            and json_type(new.request_json,'$.before')='object'
            and json_type(new.request_json,'$.before.accountId')=case when e.account is null then 'null' else 'text' end
            ${Object.entries({
              id: "id",
              instrumentId: "instrument_id",
              accountId: "account",
              side: "side",
              executedAt: "executed_at",
              quantity: "quantity",
              price: "price",
              fee: "fee",
              currency: "currency",
              tradeNature: "trade_nature",
              simulationRunId: "simulation_run_id",
              importBatchId: "import_batch_id",
              rawEvidenceJson: "evidence_json",
            }).map(([field, column]) =>
              `and json_type(new.request_json,'$.before.${field}') = case when e.${column} is null then 'null' else 'text' end and json_extract(new.request_json,'$.before.${field}') is e.${column}`
            ).join("\n            ")}
        ) then raise(abort,'Invalid fact state audit') end;
    end;
    create trigger fact_state_audit_immutable_update before update on trade_revisions
    when json_extract(old.request_json,'$.kind')='fact-state-audit-v1'
      or json_extract(new.request_json,'$.kind')='fact-state-audit-v1'
    begin select raise(abort,'Fact state audit is immutable'); end;
    create trigger fact_state_audit_immutable_delete before delete on trade_revisions
    when json_extract(old.request_json,'$.kind')='fact-state-audit-v1'
    begin select raise(abort,'Fact state audit is retained'); end;
    create table trade_change_plans (
      id text primary key, policy text not null, created_at text not null, expires_at text not null,
      body_json text check(body_json is null or json_valid(body_json)), body_digest text not null,
      receipt_id text references trade_change_receipts(id), choices_digest text,
      check((receipt_id is null) = (choices_digest is null))
    );
    create table trade_change_receipts (
      id text primary key, plan_id text not null unique references trade_change_plans(id),
      receipt_json text not null check(json_valid(receipt_json))
    );
    create table trade_change_requests (
      request_id text primary key, request_digest text not null,
      receipt_id text not null references trade_change_receipts(id)
    );
    create trigger trade_change_plan_immutable before update on trade_change_plans
    when new.id is not old.id or new.policy is not old.policy or new.created_at is not old.created_at
      or new.expires_at is not old.expires_at or new.body_digest is not old.body_digest
      or (new.body_json is not old.body_json and (new.body_json is not null or old.receipt_id is not null))
      or (old.receipt_id is not null and (new.receipt_id is not old.receipt_id or new.choices_digest is not old.choices_digest))
      or (new.receipt_id is not null and not exists(select 1 from trade_change_receipts r where r.id=new.receipt_id and r.plan_id=new.id))
    begin select raise(abort,'Review plans are immutable'); end;
    create trigger trade_change_plan_no_delete before delete on trade_change_plans begin select raise(abort,'Plan consumption keys are retained'); end;
    create trigger trade_change_receipt_immutable_update before update on trade_change_receipts begin select raise(abort,'Commit receipts are immutable'); end;
    create trigger trade_change_receipt_immutable_delete before delete on trade_change_receipts begin select raise(abort,'Commit receipts are retained'); end;
    create trigger trade_change_request_immutable_update before update on trade_change_requests begin select raise(abort,'Commit aliases are immutable'); end;
    create trigger trade_change_request_immutable_delete before delete on trade_change_requests begin select raise(abort,'Commit aliases are retained'); end;
  `),
  migration(18, "persist-import-history-evidence-audit", IMPORT_HISTORY_AUDIT_SCHEMA),
];
