import { createHash } from "node:crypto";

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
];
