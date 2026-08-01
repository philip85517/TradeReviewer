#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/../.." && pwd -P)"
config_dir="$deploy_root/config"
data_dir="$deploy_root/data"
sqlite_dir="$data_dir/sqlite"
database_path="$sqlite_dir/tradereview.sqlite"
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

compose() {
  docker compose \
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

# A consistent pre-restore backup remains available if the restore or health check fails.
pre_restore_backup="$($script_dir/backup-db.sh)"
printf 'pre-restore backup created:\n%s\n' "$pre_restore_backup"

compose stop app
compose run --rm --no-deps --volume "$backup_path:/tmp/restore.sqlite:ro" app \
  sqlite3 "$database_container_path" ".restore '/tmp/restore.sqlite'"
compose up --detach app
"$script_dir/healthcheck.sh"
printf 'restored: %s\n' "$backup_path"
