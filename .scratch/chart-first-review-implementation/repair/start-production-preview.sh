#!/bin/zsh
set -eu

task_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
repo_dir="$(cd -- "$task_dir/../../.." && pwd)"
runtime_bin="/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"

if [[ ! -f "$task_dir/acceptance.sqlite" ]]; then
  print -u2 "合成验收数据库不存在：$task_dir/acceptance.sqlite"
  exit 1
fi
if [[ ! -d "$repo_dir/dist" ]]; then
  print -u2 "请先构建当前产品，再启动生产预览。"
  exit 1
fi

export PATH="$runtime_bin:$PATH"
export TRADEREVIEW_DB_PATH="$task_dir/acceptance.sqlite"
cd -- "$repo_dir"
exec npm run start -- --hostname 127.0.0.1 --port 3049
