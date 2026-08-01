#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/.." && pwd -P)"
config_dir="$deploy_root/config"
data_dir="$deploy_root/data"
sqlite_dir="$data_dir/sqlite"
database_path="$sqlite_dir/tradereview.sqlite"
database_container_path="/var/lib/tradereview/tradereview.sqlite"
database_wal_path="$database_path-wal"
database_shm_path="$database_path-shm"

fail() {
  printf 'restore-db: %s\n' "$*" >&2
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

verify_checksum_when_present() {
  local backup_path="$1"
  local checksum_path="${backup_path}.sha256"
  if [[ -e "$checksum_path" || -L "$checksum_path" ]]; then
    [[ -f "$checksum_path" && ! -L "$checksum_path" ]] || fail "backup checksum sidecar is unsafe"
  else
    return 0
  fi
  local expected actual
  expected="$(awk 'NR == 1 { print $1 }' "$checksum_path")"
  actual="$(checksum_file "$backup_path" | awk '{ print $1 }')"
  [[ -n "$expected" && "$expected" == "$actual" ]] || fail "backup checksum verification failed"
}

check_database_file() {
  local host_path="$1"
  local container_path="$2"
  local result
  result="$(
    compose run --rm --no-deps --user "$(id -u):$(id -g)" \
      --volume "$host_path:$container_path:ro" app \
      sqlite3 "$container_path" "PRAGMA quick_check;"
  )"
  [[ "${result//$'\r'/}" == "ok" ]] || fail "SQLite integrity check failed for $host_path"
}

compose() {
  node "$script_dir/run-command.mjs" "${COMPOSE_COMMAND_TIMEOUT_MS:-600000}" docker compose \
    --project-directory "$deploy_root" \
    --file "$deploy_root/compose.yaml" \
    --env-file "$config_dir/.env" \
    "$@"
}

[[ $# -eq 1 ]] || fail "usage: restore-db.sh /absolute/path/to/backup.sqlite"
backup_path="$1"
[[ "$backup_path" == /* ]] || fail "backup path must be absolute"
[[ -f "$backup_path" && ! -L "$backup_path" ]] || fail "backup path must be a regular file"

assert_safe_directory "$deploy_root"
assert_safe_directory "$config_dir"
assert_safe_directory "$data_dir"
assert_safe_directory "$sqlite_dir"
[[ -f "$config_dir/.env" && ! -L "$config_dir/.env" ]] || fail "configuration is missing or unsafe"
verify_checksum_when_present "$backup_path"
check_database_file "$backup_path" /tmp/restore-input.sqlite
[[ -f "$database_path" && ! -L "$database_path" ]] || fail "live database is missing or unsafe"

for sidecar_path in "$database_wal_path" "$database_shm_path"; do
  if [[ -e "$sidecar_path" || -L "$sidecar_path" ]]; then
    [[ -f "$sidecar_path" && ! -L "$sidecar_path" ]] || fail "live database sidecar is unsafe: $sidecar_path"
  fi
done

# A consistent pre-restore backup remains available if the restore or health check fails.
pre_restore_backup="$("$script_dir/backup-db.sh")"
printf 'pre-restore backup created:\n%s\n' "$pre_restore_backup"

umask 077
restore_temp="$sqlite_dir/.tradereview-restore-$$.sqlite.partial"
restore_container_temp="/var/lib/tradereview/$(basename "$restore_temp")"
original_database="$sqlite_dir/.tradereview-pre-restore-$$.sqlite"
original_wal="$sqlite_dir/.tradereview-pre-restore-$$.sqlite-wal"
original_shm="$sqlite_dir/.tradereview-pre-restore-$$.sqlite-shm"
app_stopped=0
swap_started=0
had_wal=0
had_shm=0
restore_complete=0

for temporary_path in "$restore_temp" "$original_database" "$original_wal" "$original_shm"; do
  [[ ! -e "$temporary_path" && ! -L "$temporary_path" ]] || fail "temporary restore path already exists: $temporary_path"
done

recover_on_failure() {
  local status=$?
  local recovery_failed=0
  trap - EXIT
  set +e

  if [[ $status -ne 0 && $app_stopped -eq 1 ]]; then
    if ! compose stop app; then
      printf 'restore-db: recovery could not stop the failed candidate app\n' >&2
      recovery_failed=1
    fi
    if [[ $swap_started -eq 1 ]]; then
      rm -f "$database_path" "$database_wal_path" "$database_shm_path"
      if [[ -f "$original_database" && ! -L "$original_database" ]]; then
        mv "$original_database" "$database_path" || recovery_failed=1
      else
        printf 'restore-db: recovery copy of the live database is missing\n' >&2
        recovery_failed=1
      fi
      if [[ $had_wal -eq 1 ]]; then
        mv "$original_wal" "$database_wal_path" || recovery_failed=1
      fi
      if [[ $had_shm -eq 1 ]]; then
        mv "$original_shm" "$database_shm_path" || recovery_failed=1
      fi
    fi
    if ! compose up --detach app; then
      printf 'restore-db: recovery could not restart the original app\n' >&2
      recovery_failed=1
    elif ! "$script_dir/healthcheck.sh"; then
      printf 'restore-db: recovery health check failed for the original app\n' >&2
      recovery_failed=1
    fi
  fi

  rm -f "$restore_temp"
  if [[ $restore_complete -eq 1 ]]; then
    rm -f "$original_database" "$original_wal" "$original_shm"
  fi

  if [[ $recovery_failed -ne 0 ]]; then
    printf 'restore-db: restore failed and recovery was incomplete\n' >&2
    exit 70
  fi
  exit "$status"
}
trap recover_on_failure EXIT

# Restore and validate in a sibling file while the live application remains available.
compose run --rm --no-deps --user "$(id -u):$(id -g)" \
  --volume "$backup_path:/tmp/restore.sqlite:ro" app \
  sqlite3 "$restore_container_temp" ".restore '/tmp/restore.sqlite'"
[[ -f "$restore_temp" && ! -L "$restore_temp" ]] || fail "temporary restored database was not created safely"
chmod 600 "$restore_temp"
check_database_file "$restore_temp" /tmp/restored-database.sqlite

compose stop app
app_stopped=1
mv "$database_path" "$original_database"
swap_started=1
if [[ -f "$database_wal_path" ]]; then
  mv "$database_wal_path" "$original_wal"
  had_wal=1
fi
if [[ -f "$database_shm_path" ]]; then
  mv "$database_shm_path" "$original_shm"
  had_shm=1
fi
mv "$restore_temp" "$database_path"
chmod 600 "$database_path"

compose up --detach app
"$script_dir/healthcheck.sh"
restore_complete=1
rm -f "$original_database" "$original_wal" "$original_shm"
printf 'restored: %s\n' "$backup_path"
