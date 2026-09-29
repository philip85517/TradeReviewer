/**
 * S4-M1 DDL is exported for the transaction worker and registered as the
 * versioned S4-M1b schema migration by db/sqlite-schema.ts.
 */
export const TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA = `
create table if not exists account_principal_provisionals (
  account_id text primary key,
  currency text not null,
  amount text not null,
  as_of text,
  status text not null check(status in ('provisional','confirmed')),
  source text not null,
  revision integer not null check(revision >= 0),
  updated_at text not null
);

create table if not exists tradingview_account_migration_operations (
  operation_id text primary key,
  operation_kind text not null check(operation_kind in ('commit','rollback')),
  parent_operation_id text references tradingview_account_migration_operations(operation_id),
  idempotency_key text not null unique,
  plan_digest text not null,
  base_snapshot_digest text not null,
  after_snapshot_digest text,
  status text not null check(status in ('committed','rolled-back')),
  request_json text not null check(json_valid(request_json)),
  result_json text not null check(json_valid(result_json)),
  created_at text not null,
  updated_at text not null
);

create table if not exists tradingview_account_migration_rows (
  operation_id text not null references tradingview_account_migration_operations(operation_id) on delete cascade,
  table_name text not null,
  primary_key text not null,
  before_json text check(before_json is null or json_valid(before_json)),
  after_json text check(after_json is null or json_valid(after_json)),
  before_digest text not null,
  after_digest text not null,
  primary key(operation_id, table_name, primary_key)
);

create table if not exists tradingview_account_migration_aliases (
  operation_id text not null references tradingview_account_migration_operations(operation_id) on delete cascade,
  alias_kind text not null check(alias_kind in ('account','episode','scope')),
  old_id text not null,
  new_id text not null,
  primary key(operation_id, alias_kind, old_id)
);

create table if not exists tradingview_account_migration_dependencies (
  operation_id text not null references tradingview_account_migration_operations(operation_id) on delete cascade,
  table_name text not null,
  row_key text not null,
  row_digest text not null,
  primary key(operation_id, table_name, row_key)
);
`;

export const TRADINGVIEW_ACCOUNT_MIGRATION_DDL = TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA;
export const tradingViewAccountMigrationSchema = TRADINGVIEW_ACCOUNT_MIGRATION_SCHEMA;
