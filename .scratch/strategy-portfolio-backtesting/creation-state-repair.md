# Creation state repair

本轮将历史创建原型完整重写为单一 `Draft` 内存状态和显式事件更新，移除重复 PreviewStep、字符串补丁与依赖 stage 的重置 effect。

已覆盖：历史时点 Asia/Shanghai 校验与盘中/周末截止、正数本金、五档期限、盲看、复盘/自选集合、完整/缺数据/部分覆盖/无候选场景、两个独立策略包与命名预设、多策略组合预览、目标与实际持仓分离、规则值/披露时间、准备运行摘要、返回列表/重开/刷新重置、移动导航 Escape 关闭。

验证：`npm run typecheck`（通过，2026-09-29）。

范围：仅修改 `app/components/strategy-prototype/creation-prototype.tsx` 与本记录；不接 API、数据库、图表或业务持久化。
