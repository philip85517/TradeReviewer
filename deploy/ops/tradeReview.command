#!/bin/zsh
set -eu

app_root='/Users/zhoulin/projects/交易空间/TradingReview'
start_script="$app_root/ops/start-native.command"
release_link="$app_root/app/current"
url='http://127.0.0.1:3022/'
health_url='http://127.0.0.1:3022/api/storage/status'
port=3022
startup_timeout=60

fail() {
  print -u2 -- "TradeReview 启动失败：$1"
}

for utility in lsof curl open python3; do
  if ! command -v "$utility" >/dev/null 2>&1; then
    fail "找不到系统命令 $utility。"
    exit 1
  fi
done

if [[ ! -x "$start_script" ]]; then
  fail "正式启动脚本不存在或不可执行：$start_script"
  exit 1
fi

if [[ ! -d "$release_link" ]]; then
  fail "正式应用目录不存在：$release_link"
  exit 1
fi

current_release="$(cd "$release_link" && pwd -P)"
# lsof renders non-ASCII path bytes as \xNN; normalize the expected path to match.
current_release_lsof="$(python3 -c 'import sys; print(sys.argv[1].encode().decode("ascii", "backslashreplace"))' "$current_release")"
if listener_pids="$(lsof -nP -t -iTCP:$port -sTCP:LISTEN 2>&1)"; then
  :
elif [[ -n "$listener_pids" ]]; then
  fail "无法检查端口 $port：$listener_pids"
  exit 1
fi

if [[ -n "$listener_pids" ]]; then
  all_listeners_match=1
  for pid in ${(f)listener_pids}; do
    process_cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"
    if [[ "$process_cwd" != "$current_release_lsof" ]]; then
      all_listeners_match=0
    fi
  done

  if (( all_listeners_match == 1 )) \
    && curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null 2>&1; then
    print -- "TradeReview 已在运行，正在打开 $url"
    open "$url"
    exit 0
  fi

  fail "端口 $port 已被占用，但无法确认它属于正式 TradeReview 服务。未停止该进程。"
  exit 1
fi

print -- "正在启动 TradeReview，服务就绪后会自动打开 $url"
(
  attempt=0
  while (( attempt < startup_timeout )); do
    if curl --fail --silent --max-time 3 "$health_url" >/dev/null 2>&1; then
      if open "$url"; then
        print -- "TradeReview 已就绪：$url"
      else
        fail "服务已就绪，但无法自动打开浏览器。请手动访问 $url"
      fi
      exit 0
    fi
    (( attempt += 1 ))
    sleep 1
  done

  fail "等待 ${startup_timeout} 秒后仍未通过健康检查。请查看正式部署日志。"
) &
readiness_pid=$!

if "$start_script"; then
  startup_status=0
else
  startup_status=$?
fi

kill "$readiness_pid" 2>/dev/null || true
wait "$readiness_pid" 2>/dev/null || true

if (( startup_status != 0 )); then
  fail "正式服务进程已退出（状态码 $startup_status）。"
fi

exit "$startup_status"
