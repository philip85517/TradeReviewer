env_value() {
  local key="$1"
  awk -v key="$key" '
    {
      line = $0
      sub(/\r$/, "", line)
      sub(/^[[:space:]]+/, "", line)
      if (line ~ ("^" key "[[:space:]]*=")) {
        sub("^[^=]*=[[:space:]]*", "", line)
        sub(/[[:space:]]+$/, "", line)
        if (line ~ /^".*"$/ || line ~ /^'"'"'.*'"'"'$/) line = substr(line, 2, length(line) - 2)
        print line
        exit
      }
    }
  ' "$config_dir/.env"
}

resolve_sqlite_dir() {
  local configured candidate deploy_path sqlite_path
  configured="$(env_value SQLITE_HOST_DIR || true)"
  candidate="${configured:-$deploy_root/data/sqlite}"
  if [[ "$candidate" != /* ]]; then candidate="$deploy_root/$candidate"; fi
  [[ "$candidate" != *$'\n'* && "$candidate" != *$'\r'* ]] || fail "SQLITE_HOST_DIR contains a newline"
  if [[ ! -e "$candidate" ]]; then
    [[ "${1:-}" == "allow-missing" ]] || fail "SQLITE_HOST_DIR must be a non-symlink directory"
  else
    [[ "$candidate" != "/" && -d "$candidate" && ! -L "$candidate" ]] || fail "SQLITE_HOST_DIR must be a non-symlink directory"
  fi
  deploy_path="$(cd -- "$deploy_root" && pwd -P)"
  if [[ -d "$candidate" ]]; then sqlite_path="$(cd -- "$candidate" && pwd -P)"; else sqlite_path="$(cd -- "$(dirname -- "$candidate")" && pwd -P)/$(basename -- "$candidate")"; fi
  [[ -z "$configured" || ("$sqlite_path" != "$deploy_path" && "$sqlite_path" != "$deploy_path"/* && "$deploy_path" != "$sqlite_path"/*) ]] ||
    fail "SQLITE_HOST_DIR must not be inside or contain the deployment target"
  sqlite_dir="$sqlite_path"
  export SQLITE_HOST_DIR="$sqlite_path"
}
