#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/../.." && pwd -P)"
config_dir="$deploy_root/config"
data_dir="$deploy_root/data"
sqlite_dir="$data_dir/sqlite"
# Backups are always kept under the protected deployment path data/backups.
backups_dir="$deploy_root/data/backups"
database_path="$sqlite_dir/tradereview.sqlite"
database_container_path="/var/lib/tradereview/tradereview.sqlite"

fail() {
  printf 'backup-db: %s\n' "$*" >&2
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
  docker compose \
    --project-directory "$deploy_root" \
    --file "$deploy_root/compose.yaml" \
    --env-file "$config_dir/.env" \
    "$@"
}

retention_days="${BACKUP_RETENTION_DAYS:-30}"
if [[ "${1:-}" == "--retention-days" ]]; then
  [[ $# -eq 2 ]] || fail "usage: backup-db.sh [--retention-days N]"
  retention_days="$2"
elif [[ $# -ne 0 ]]; then
  fail "usage: backup-db.sh [--retention-days N]"
fi
[[ "$retention_days" =~ ^[0-9]+$ ]] || fail "retention days must be a non-negative integer"

assert_safe_directory "$deploy_root"
assert_safe_directory "$config_dir"
assert_safe_directory "$data_dir"
assert_safe_directory "$sqlite_dir"
[[ -f "$config_dir/.env" && ! -L "$config_dir/.env" ]] || fail "configuration is missing or unsafe"
[[ -f "$database_path" && ! -L "$database_path" ]] || fail "database is missing or unsafe"

umask 077
mkdir -p -- "$backups_dir"
assert_safe_directory "$backups_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="tradereview-${timestamp}-$$.sqlite"
backup_path="$backups_dir/$backup_name"
container_backup_path="/var/lib/tradereview-backups/$backup_name"

# SQLite performs a consistent online backup; never copy a live database or WAL file.
compose run --rm --no-deps --volume "$backups_dir:/var/lib/tradereview-backups" app \
  sqlite3 "$database_container_path" ".backup '$container_backup_path'"
[[ -f "$backup_path" && ! -L "$backup_path" ]] || fail "SQLite backup was not created"
checksum_file "$backup_path" > "$backup_path.sha256"
printf 'backup: %s\nchecksum: %s\n' "$backup_path" "$backup_path.sha256"

find "$backups_dir" -type f -name 'tradereview-*.sqlite' -mtime "+$retention_days" -delete
find "$backups_dir" -type f -name 'tradereview-*.sqlite.sha256' -mtime "+$retention_days" -delete
