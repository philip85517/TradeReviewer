#!/bin/zsh

# Control toolkit launcher: resolve the target root from this installed script.
set -e
target_root="${0:A:h:h}"
release_root="$target_root/app/current"
runtime_config="$target_root/config/runtime.json"
node_executable="/usr/local/Cellar/node/26.0.0/bin/node"
native_module="$target_root/ops/native-environment.mjs"
npm_cli="${node_executable:A:h:h}/libexec/lib/node_modules/npm/bin/npm-cli.js"

[[ -x "$node_executable" ]] || { print -u2 "pinned Node executable is missing: $node_executable"; exit 1; }
[[ -f "$native_module" ]] || { print -u2 "native environment module is missing: $native_module"; exit 1; }
"$node_executable" --input-type=module -e 'import { pathToFileURL } from "node:url"; const modulePath = process.argv[1]; const { assertNativeEnvironment } = await import(pathToFileURL(modulePath)); assertNativeEnvironment();' "$native_module"
[[ -n "$npm_cli" && -f "$npm_cli" ]] || { print -u2 "npm CLI for pinned Node is missing"; exit 1; }
export PATH="${node_executable:A:h}:$PATH"

[[ -d "$release_root" ]] || { print -u2 "native release is missing: $release_root"; exit 1; }
[[ -f "$runtime_config" && ! -L "$runtime_config" ]] || { print -u2 "runtime config is missing or unsafe: $runtime_config"; exit 1; }

cd "$release_root"
export NODE_ENV=production
export TRADEREVIEW_RUNTIME_CONFIG="$runtime_config"
unset TRADEREVIEW_DB_PATH TRADEREVIEW_PORT PORT HOST HOSTNAME
exec "$node_executable" "$npm_cli" run start
