#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/.." && pwd -P)"
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
  node "$script_dir/run-command.mjs" "${COMPOSE_COMMAND_TIMEOUT_MS:-600000}" docker compose \
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

retention_days=""
if [[ "${1:-}" == "--retention-days" ]]; then
  [[ $# -eq 2 ]] || fail "usage: backup-db.sh [--retention-days N]"
  retention_days="$2"
elif [[ $# -ne 0 ]]; then
  fail "usage: backup-db.sh [--retention-days N]"
fi

assert_safe_directory "$deploy_root"
assert_safe_directory "$config_dir"
assert_safe_directory "$data_dir"
assert_safe_directory "$sqlite_dir"
[[ -f "$config_dir/.env" && ! -L "$config_dir/.env" ]] || fail "configuration is missing or unsafe"
[[ -f "$database_path" && ! -L "$database_path" ]] || fail "database is missing or unsafe"

if [[ -z "$retention_days" ]]; then
  retention_days="$(env_value BACKUP_RETENTION_DAYS)"
fi
retention_days="${retention_days:-30}"
[[ "$retention_days" =~ ^[0-9]+$ ]] || fail "retention days must be a non-negative integer"

umask 077
mkdir -p -- "$backups_dir"
assert_safe_directory "$backups_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="tradereview-${timestamp}-$$.sqlite"
backup_path="$backups_dir/$backup_name"
checksum_path="$backup_path.sha256"
temporary_backup="$backups_dir/.${backup_name}.partial"
temporary_checksum="$backups_dir/.${backup_name}.sha256.partial"
container_backup_path="/var/lib/tradereview-backups/$(basename "$temporary_backup")"

cleanup() {
  local status=$?
  trap - EXIT
  rm -f -- "$temporary_backup" "$temporary_checksum"
  if [[ $status -ne 0 && ! -e "$backup_path" ]]; then
    rm -f -- "$checksum_path"
  fi
  exit "$status"
}
trap cleanup EXIT

# SQLite performs a consistent online backup; never copy a live database or WAL file.
compose run --rm --no-deps --user "$(id -u):$(id -g)" \
  --volume "$backups_dir:/var/lib/tradereview-backups" app \
  sqlite3 "$database_container_path" ".backup '$container_backup_path'"
[[ -f "$temporary_backup" && ! -L "$temporary_backup" ]] || fail "SQLite backup was not created safely"
chmod 600 "$temporary_backup"

integrity_result="$(
  compose run --rm --no-deps --user "$(id -u):$(id -g)" \
    --volume "$temporary_backup:/tmp/backup.sqlite:ro" app \
    sqlite3 /tmp/backup.sqlite "PRAGMA quick_check;"
)"
[[ "${integrity_result//$'\r'/}" == "ok" ]] || fail "SQLite backup integrity check failed"

backup_digest="$(checksum_file "$temporary_backup" | awk 'NR == 1 { print $1 }')"
[[ "$backup_digest" =~ ^[0-9a-fA-F]{64}$ ]] || fail "SQLite backup checksum could not be calculated"
printf '%s  %s\n' "$backup_digest" "$backup_name" > "$temporary_checksum"
chmod 600 "$temporary_checksum"

# Publish the sidecar first so a visible backup is never momentarily unchecksummed.
mv -- "$temporary_checksum" "$checksum_path"
mv -- "$temporary_backup" "$backup_path"

while IFS= read -r -d '' expired_backup; do
  expired_name="$(basename "$expired_backup")"
  [[ "$expired_name" =~ ^tradereview-[0-9]{8}T[0-9]{6}Z-[0-9]+\.sqlite$ ]] || continue
  [[ -f "$expired_backup" && ! -L "$expired_backup" ]] || continue
  expired_checksum="$expired_backup.sha256"
  rm -- "$expired_backup"
  if [[ -f "$expired_checksum" && ! -L "$expired_checksum" ]]; then
    rm -- "$expired_checksum"
  fi
done < <(
  find "$backups_dir" -mindepth 1 -maxdepth 1 -type f \
    -name 'tradereview-????????T??????Z-*.sqlite' -mtime "+$retention_days" -print0
)

printf 'backup: %s\nchecksum: %s\n' "$backup_path" "$checksum_path"
