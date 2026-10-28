#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/.." && pwd -P)"
config_dir="$deploy_root/config"
data_dir="$deploy_root/data"
source "$script_dir/sqlite-path.sh"
database_container_path="/var/lib/tradereview/tradereview.sqlite"

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
resolve_sqlite_dir
database_path="$sqlite_dir/tradereview.sqlite"
database_wal_path="$database_path-wal"
database_shm_path="$database_path-shm"
assert_safe_directory "$sqlite_dir"
[[ -f "$config_dir/.env" && ! -L "$config_dir/.env" ]] || fail "configuration is missing or unsafe"
verify_checksum_when_present "$backup_path"
check_database_file "$backup_path" /tmp/restore-input.sqlite
[[ -f "$database_path" && ! -L "$database_path" ]] || fail "live database is missing or unsafe"
[[ ! "$backup_path" -ef "$database_path" ]] || fail "backup and live database must not alias each other"

for sidecar_path in "$database_wal_path" "$database_shm_path"; do
  if [[ -e "$sidecar_path" || -L "$sidecar_path" ]]; then
    [[ -f "$sidecar_path" && ! -L "$sidecar_path" ]] || fail "live database sidecar is unsafe: $sidecar_path"
  fi
done


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
restore_lock="$sqlite_dir/.tradereview-restore.lock"
restore_lock_owned=0

for temporary_path in "$restore_temp" "$restore_temp-wal" "$restore_temp-shm" "$original_database" "$original_wal" "$original_shm"; do
  [[ ! -e "$temporary_path" && ! -L "$temporary_path" ]] || fail "temporary restore path already exists: $temporary_path"
done

assert_database_not_in_use() {
  local path open_files lsof_status lsof_error_file
  local -a database_paths=()
  for path in "$@"; do
    if [[ -e "$path" || -L "$path" ]]; then
      if [[ ! -f "$path" || -L "$path" ]]; then
        printf 'restore-db: cannot verify database consumers: unsafe file %s\n' "$path" >&2
        return 1
      fi
      database_paths+=("$path")
    fi
  done
  [[ ${#database_paths[@]} -gt 0 ]] || return 0
  if ! command -v lsof >/dev/null 2>&1; then
    printf 'restore-db: cannot verify database consumers: lsof is unavailable; stop all consumers before restore\n' >&2
    return 1
  fi
  if ! lsof_error_file="$(mktemp "${TMPDIR:-/tmp}/tradereview-lsof.XXXXXX")"; then
    printf 'restore-db: cannot verify database consumers: unable to create lsof diagnostic\n' >&2
    return 1
  fi
  if open_files="$(lsof -t -- "${database_paths[@]}" 2>"$lsof_error_file")"; then
    lsof_status=0
  else
    lsof_status=$?
  fi
  if [[ "$lsof_status" -ne 0 && "$lsof_status" -ne 1 ]]; then
    rm -f -- "$lsof_error_file"
    printf 'restore-db: cannot verify database consumers: lsof failed with status %s\n' "$lsof_status" >&2
    return 1
  fi
  if [[ -s "$lsof_error_file" ]]; then
    rm -f -- "$lsof_error_file"
    printf 'restore-db: cannot verify database consumers: lsof reported an error\n' >&2
    return 1
  fi
  rm -f -- "$lsof_error_file"
  if [[ -n "$open_files" ]]; then
    printf 'restore-db: database is still in use; stop all consumers before restore: %s\n' "$open_files" >&2
    return 1
  fi
}

restore_original_files() {
  local index candidate_published=0
  local -a live_sidecars=("$database_wal_path" "$database_shm_path")
  local -a original_sidecars=("$original_wal" "$original_shm")
  local -a had_sidecars=("$had_wal" "$had_shm")
  [[ -f "$restore_temp" ]] || candidate_published=1

  # A signal may arrive before or after any mv, before the shell can record it.
  # Inspect the files themselves and validate the entire original set first.
  if [[ ! -f "$original_database" ]]; then
    if [[ $candidate_published -eq 1 || ! -f "$database_path" || -e "$original_wal" || -e "$original_shm" ]]; then
      printf 'restore-db: recovery copy of the live database is missing\n' >&2
      return 1
    fi
  fi
  for index in 0 1; do
    if [[ ${had_sidecars[$index]} -eq 1 ]]; then
      if [[ ! -f "${original_sidecars[$index]}" ]] &&
        [[ $candidate_published -eq 1 || ! -f "${live_sidecars[$index]}" ]]; then
        printf 'restore-db: recovery copy of an original sidecar is missing: %s\n' "${live_sidecars[$index]}" >&2
        return 1
      fi
    elif [[ -e "${original_sidecars[$index]}" ]] ||
      [[ $candidate_published -eq 0 && -e "${live_sidecars[$index]}" ]]; then
      printf 'restore-db: recovery found an unexpected sidecar: %s\n' "${live_sidecars[$index]}" >&2
      return 1
    fi
  done

  # No main-file rename occurred. All originals are still at their live paths.
  [[ -f "$original_database" ]] || return 0
  mv "$original_database" "$database_path" || return 1
  for index in 0 1; do
    if [[ -f "${original_sidecars[$index]}" ]]; then
      mv "${original_sidecars[$index]}" "${live_sidecars[$index]}" || return 1
    elif [[ ${had_sidecars[$index]} -eq 0 && $candidate_published -eq 1 ]]; then
      # Only a published candidate's sidecar can be removed without an original.
      rm -f -- "${live_sidecars[$index]}" || return 1
    fi
  done
}

recover_on_failure() {
  local status=$?
  local recovery_failed=0
  trap - EXIT
  trap '' INT TERM HUP
  set +e

  if [[ $status -ne 0 && $app_stopped -eq 1 ]]; then
    if ! compose stop app; then
      printf 'restore-db: recovery could not stop the failed candidate app\n' >&2
      recovery_failed=1
    elif ! assert_database_not_in_use \
      "$database_path" "$database_wal_path" "$database_shm_path" \
      "$original_database" "$original_wal" "$original_shm" \
      "$restore_temp" "$restore_temp-wal" "$restore_temp-shm"; then
      recovery_failed=1
    elif [[ $swap_started -eq 1 ]] && ! restore_original_files; then
      recovery_failed=1
    fi
    if [[ $recovery_failed -eq 0 ]]; then
      if ! compose up --detach app; then
        printf 'restore-db: recovery could not restart the original app\n' >&2
        recovery_failed=1
      elif ! "$script_dir/healthcheck.sh"; then
        printf 'restore-db: recovery health check failed for the original app\n' >&2
        recovery_failed=1
      fi
    fi
  fi

  if [[ $recovery_failed -eq 0 ]]; then
    rm -f "$restore_temp" "$restore_temp-wal" "$restore_temp-shm"
  fi
  if [[ $restore_complete -eq 1 && $recovery_failed -eq 0 ]]; then
    rm -f "$original_database" "$original_wal" "$original_shm"
  fi
  if [[ $restore_lock_owned -eq 1 && $recovery_failed -eq 0 ]]; then
    rmdir -- "$restore_lock" || recovery_failed=1
  fi

  if [[ $recovery_failed -ne 0 ]]; then
    printf 'restore-db: restore failed and recovery was incomplete\n' >&2
    exit 70
  fi
  exit "$status"
}
trap recover_on_failure EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# A separate lock also covers direct script calls without nesting .deploy-lock.
mkdir -m 700 -- "$restore_lock" 2>/dev/null || fail "restore maintenance lock is held or unsafe: $restore_lock"
restore_lock_owned=1
# A failed stop may already have stopped part of the service; recovery still runs.
app_stopped=1
compose stop app
assert_database_not_in_use "$database_path" "$database_wal_path" "$database_shm_path"
# Stop every old writer before backup, migration, validation, and activation.
pre_restore_backup="$("$script_dir/backup-db.sh")"
printf 'pre-restore backup created:\n%s\n' "$pre_restore_backup"

# Restore in an unpublished sibling file; the source backup is mounted read-only.
compose run --rm --no-deps --user "$(id -u):$(id -g)" \
  --volume "$backup_path:/tmp/restore.sqlite:ro" app \
  sqlite3 "$restore_container_temp" ".restore '/tmp/restore.sqlite'"
[[ -f "$restore_temp" && ! -L "$restore_temp" ]] || fail "temporary restored database was not created safely"
chmod 600 "$restore_temp"
check_database_file "$restore_temp" /tmp/restored-database.sqlite

# The fixed Node runtime uses the application's one migration implementation and
# Task3 epoch helper. A failed migration/rotation/check must never start a candidate.
compose run --rm --no-deps --user "$(id -u):$(id -g)" \
  --volume "$backup_path:/tmp/restore-source.sqlite:ro" app \
  node /app/scripts/activate-database-candidate.mjs \
  --candidate "$restore_container_temp" --source /tmp/restore-source.sqlite
check_database_file "$restore_temp" /tmp/restored-database.sqlite
assert_database_not_in_use "$database_path" "$database_wal_path" "$database_shm_path"
# Record the complete original set before the first rename. Recovery uses actual
# quarantine paths, so a signal between mv and the next command is safe too.
if [[ -f "$database_wal_path" ]]; then
  had_wal=1
fi
if [[ -f "$database_shm_path" ]]; then
  had_shm=1
fi
swap_started=1
mv "$database_path" "$original_database"
if [[ $had_wal -eq 1 ]]; then
  mv "$database_wal_path" "$original_wal"
fi
if [[ $had_shm -eq 1 ]]; then
  mv "$database_shm_path" "$original_shm"
fi
mv "$restore_temp" "$database_path"
chmod 600 "$database_path"

compose up --detach app
"$script_dir/healthcheck.sh"
restore_complete=1
rm -f "$original_database" "$original_wal" "$original_shm"
printf 'restored: %s\n' "$backup_path"
