# Workspace refresh test navigation

日期：2026-09-19

范围：仅 `app/components/trade-review-workspace.refresh.test.tsx`。

## 调整

将三个行情刷新场景中的旧“交易库 → 开始复盘”入口改为当前默认流程：进入“交易库”、展开股票回合列表、打开第 1 个交易回合。行情刷新断言、provider mock、保存状态和失败明细断言均保留。全局批次与单标的刷新并发场景继续先启动全局批次，再从默认股票回合打开行情详情。

## 验证

```text
npx vitest run app/components/trade-review-workspace.refresh.test.tsx --reporter=dot --maxWorkers=1
1 file, 7 tests passed

npx eslint app/components/trade-review-workspace.refresh.test.tsx
exit 0

git diff --check -- app/components/trade-review-workspace.refresh.test.tsx
exit 0
```

未修改 `trade-review-workspace.tsx`、存储实现或其他 workspace 测试；未运行全量套件、浏览器或数据库写入验证。
