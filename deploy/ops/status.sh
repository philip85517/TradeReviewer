#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/.." && pwd -P)"
config_dir="$deploy_root/config"
data_dir="$deploy_root/data"
sqlite_dir="$data_dir/sqlite"
backups_dir="$data_dir/backups"
database_path="$sqlite_dir/tradereview.sqlite"
database_container_path="/var/lib/tradereview/tradereview.sqlite"
current_link="$deploy_root/app/current"
releases_dir="$deploy_root/app/releases"

fail() {
  printf 'status: %s\n' "$*" >&2
  exit 1
}

assert_safe_directory() {
  local path="$1"
  [[ "$path" != "/" && -d "$path" && ! -L "$path" ]] || fail "unsafe directory: $path"
}

checksum_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1"
  else
    shasum -a 256 "$1"
  fi
}

compose() {
  node "$script_dir/run-command.mjs" "${COMPOSE_COMMAND_TIMEOUT_MS:-30000}" docker compose \
    --project-directory "$deploy_root" \
    --file "$deploy_root/compose.yaml" \
    --env-file "$config_dir/.env" \
    "$@"
}

env_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      gsub(/\r$/, "", value)
      gsub(/^"|"$/, "", value)
      print value
      exit
    }
  ' "$config_dir/.env"
}

file_size() {
  if stat -f %z "$1" >/dev/null 2>&1; then
    stat -f %z "$1"
  else
    stat -c %s "$1"
  fi
}

verify_checksum_when_present() {
  local backup_path="$1"
  local checksum_path="${backup_path}.sha256"
  [[ -f "$checksum_path" && ! -L "$checksum_path" ]] || {
    printf 'not available'
    return
  }
  local expected actual
  expected="$(awk 'NR == 1 { print $1 }' "$checksum_path")"
  actual="$(checksum_file "$backup_path" | awk '{ print $1 }')"
  [[ -n "$expected" && "$expected" == "$actual" ]] && printf 'valid' || printf 'invalid'
}

sqlite_query() {
  local query="$1"
  compose run --rm --no-deps --user "$(id -u):$(id -g)" app \
    sqlite3 "$database_container_path" "$query"
}

sqlite_table_names() {
  sqlite_query "select group_concat(name, '|') from sqlite_master where type = 'table';"
}

sqlite_table_is_present() {
  local table_names="|$1|"
  local table_name="$2"
  [[ "$table_names" == *"|$table_name|"* ]]
}

sqlite_scalar_or_unavailable() {
  local query="$1"
  local result
  if result="$(sqlite_query "$query")"; then
    printf '%s' "${result//$'\r'/}"
  else
    printf 'unavailable'
  fi
}

report_sqlite_business_state() {
  local schema_version migration_status migration_counts migration_digest table_name count table_names
  local -a record_counts=()
  local -a business_tables=(
    instruments import_batches executions reviews daily_candles market_candles coverage
    interval_coverage provider_symbols tag_suggestions market_data_jobs app_settings
  )

  table_names="$(sqlite_table_names 2>/dev/null || true)"
  schema_version=0
  if sqlite_table_is_present "$table_names" schema_migrations; then
    schema_version="$(sqlite_scalar_or_unavailable 'select coalesce(max(version), 0) from schema_migrations;')"
  fi
  printf 'schema version: %s\n' "$schema_version"

  migration_status='not migrated'
  migration_counts='unavailable'
  migration_digest='unavailable'
  if sqlite_table_is_present "$table_names" data_migrations; then
    migration_status="$(sqlite_scalar_or_unavailable "select coalesce((select status || ' (' || version || ')' from data_migrations order by completed_at desc, source_fingerprint desc limit 1), 'none');")"
    migration_counts="$(sqlite_scalar_or_unavailable "select coalesce((select counts_json from data_migrations order by completed_at desc, source_fingerprint desc limit 1), '{}');")"
    migration_digest="$(sqlite_scalar_or_unavailable "select coalesce((select validation_digest from data_migrations order by completed_at desc, source_fingerprint desc limit 1), '');")"
  fi
  printf 'data migration status: %s\n' "$migration_status"
  printf 'data migration counts: %s\n' "$migration_counts"
  printf 'data migration validation digest: %s\n' "$migration_digest"

  for table_name in "${business_tables[@]}"; do
    count=0
    if sqlite_table_is_present "$table_names" "$table_name"; then
      count="$(sqlite_scalar_or_unavailable "select count(*) from $table_name;")"
    fi
    record_counts+=("$table_name=$count")
  done
  printf 'business records: %s\n' "$(IFS=', '; printf '%s' "${record_counts[*]}")"
}

assert_safe_directory "$deploy_root"
assert_safe_directory "$config_dir"
assert_safe_directory "$data_dir"
[[ -f "$config_dir/.env" && ! -L "$config_dir/.env" ]] || fail "configuration is missing or unsafe"

active_release="none"
if [[ -L "$current_link" ]]; then
  active_release="$(readlink "$current_link")"
fi
printf 'active release: %s\n' "$active_release"
printf 'retained releases:\n'
if [[ -d "$releases_dir" && ! -L "$releases_dir" ]]; then
  find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
fi

printf 'compose service state:\n'
compose ps --format 'table {{.Name}}\t{{.State}}\t{{.Health}}'
printf 'configured bind: %s:%s\n' "$(env_value APP_BIND)" "$(env_value APP_PORT)"

if [[ ! -e "$sqlite_dir" && ! -L "$sqlite_dir" ]]; then
  printf 'database: missing (SQLite directory is absent)\n'
elif [[ ! -d "$sqlite_dir" || -L "$sqlite_dir" ]]; then
  printf 'database: unavailable (SQLite directory is unsafe)\n'
elif [[ -f "$database_path" && ! -L "$database_path" ]]; then
  printf 'database: present (%s bytes)\n' "$(file_size "$database_path")"
  report_sqlite_business_state
elif [[ -e "$database_path" || -L "$database_path" ]]; then
  printf 'database: unavailable (database path is unsafe)\n'
else
  printf 'database: missing\n'
fi

if [[ -d "$backups_dir" && ! -L "$backups_dir" ]]; then
  latest_backup="$(find "$backups_dir" -maxdepth 1 -type f -name 'tradereview-*.sqlite' -print | sort | tail -n 1)"
  if [[ -n "$latest_backup" ]]; then
    printf 'latest backup checksum: %s\n' "$(verify_checksum_when_present "$latest_backup")"
  else
    printf 'latest backup checksum: not available\n'
  fi
else
  printf 'latest backup checksum: not available\n'
fi
