#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
deploy_root="$(cd -- "$script_dir/../.." && pwd -P)"
config_dir="$deploy_root/config"

fail() {
  printf 'healthcheck: %s\n' "$*" >&2
  exit 1
}

assert_safe_directory() {
  local path="$1"
  [[ "$path" != "/" && -d "$path" && ! -L "$path" ]] || fail "unsafe directory: $path"
}

compose() {
  docker compose \
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

assert_safe_directory "$deploy_root"
assert_safe_directory "$config_dir"
[[ -f "$config_dir/.env" && ! -L "$config_dir/.env" ]] || fail "configuration is missing or unsafe"

services="$(compose ps --format json)"
node -e '
  const output = process.argv[1] || "";
  let list;
  try {
    const parsed = JSON.parse(output || "[]");
    list = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    list = output.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  }
  if (list.length === 0 || list.some((service) => String(service.Health ?? service.State ?? "").toLowerCase() !== "healthy")) {
    process.exit(1);
  }
' "$services" || fail "Compose service health check failed"

bind="$(env_value APP_BIND)"
port="$(env_value APP_PORT)"
[[ -n "$bind" && "$port" =~ ^[0-9]+$ ]] || fail "APP_BIND and APP_PORT must be configured"
[[ "$bind" == "0.0.0.0" ]] && bind="127.0.0.1"
endpoint="http://$bind:$port/"
node -e 'fetch(process.argv[1]).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' "$endpoint" \
  || fail "HTTP health check failed for $endpoint"
printf 'healthy: %s\n' "$endpoint"
