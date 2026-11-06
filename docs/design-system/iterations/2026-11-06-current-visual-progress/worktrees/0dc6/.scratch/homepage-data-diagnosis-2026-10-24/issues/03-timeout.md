# 03 — 首页金融读取超出整体截止

ID: homepage-data-finding-03
State: open
Status: diagnosis-confirmed / original-task-paused
Assignee: unassigned
集成负责人: root

## Scope / What to build

记录当前生产预览的重现与已定位链路，不创建新性能修复候选。

## Refs

- [D03](../DESIGN-COVERAGE.md)、[诊断第3节](../DIAGNOSIS.md)
- app/components/trade-review-workspace.tsx:2232；use-homepage-host.ts:134、174、295；app/lib/reviews/homepage-v25-state.ts:362。
- [原超时问题](../../homepage-v25-implementation/issues/16-p1-homepage-timeout-finding.md)

## Blocked by

原P1/F07暂停3/3；保留原记录，不能由本票自动恢复。

## 验收标准与反例（尚未修复）

- [ ] 当前完整非零首页在批准的冷/热/重启首读/写后首读达到≤1秒；进程启动和外部补齐单独计时。
- [ ] 分阶段profiling对应同一运行版本和数据，区分IO与CPU；不靠延长截止或只验骨架。
- [ ] 超时/取消不接受晚到结果，且底层无无界继续工作；不损失来源与金额合同。

## 当前证据/状态

真实桌面两次timeout；[接口实测](../PROBE.json)首页body约540ms、6.33MB，不能解释为同一SQLite读取一直卡住。当前代码全量236证券行情+源重复处理；历史完整profiling只作佐证，当前逐阶段浏览器轨迹NOT VERIFIED。整体目标FAIL，不改原轮次。
