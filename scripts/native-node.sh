#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
case "$script_dir" in
  */scripts) profile_path="$script_dir/../conf/native-environment.json" ;;
  */ops) profile_path="$script_dir/native-environment.json" ;;
  *) echo "native runtime bootstrap must run from scripts or ops" >&2; exit 1 ;;
esac

profile_values=$(NATIVE_PROFILE_PATH="$profile_path" node --input-type=module -e '
import { readFileSync } from "node:fs";
const profilePath = process.env.NATIVE_PROFILE_PATH;
let profile;
try { profile = JSON.parse(readFileSync(profilePath, "utf8")); }
catch (error) { console.error(`cannot read native environment profile: ${error.message}`); process.exit(1); }
if (!profile || typeof profile !== "object") { console.error("native environment profile must be an object"); process.exit(1); }
for (const key of ["nodeVersion", "sqliteVersion", "nodeExecutable"]) {
  if (typeof profile[key] !== "string" || !profile[key].trim() || /[\r\n\t]/.test(profile[key])) {
    console.error(`native environment profile.${key} is required`);
    process.exit(1);
  }
}
process.stdout.write(`${profile.nodeVersion}\n${profile.sqliteVersion}\n${profile.nodeExecutable}\n`);
')

node_executable=$(printf '%s\n' "$profile_values" | sed -n '3p')

case "$node_executable" in
  /*) ;;
  *) echo "configured native Node executable must be an absolute path" >&2; exit 1 ;;
esac
if [ ! -f "$node_executable" ] || [ ! -x "$node_executable" ]; then
  echo "configured native Node executable is missing or not executable: $node_executable" >&2
  exit 1
fi

exec "$node_executable" "$@"
