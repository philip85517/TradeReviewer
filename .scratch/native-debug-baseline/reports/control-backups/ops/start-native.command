#!/bin/zsh
set -eu
app_root='/Users/zhoulin/projects/交易空间/TradingReview'
cd "$app_root/app/current"
export NODE_ENV=production
export TRADEREVIEW_RUNTIME_CONFIG="$app_root/config/runtime.json"
unset TRADEREVIEW_DB_PATH
exec /usr/local/bin/npm run start
