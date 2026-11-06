# 01 — 名称变化与重启后复用

ID: display-cache-restart-experiment-01
State: closed（仅本次隔离原型）
Status: accepted（产品接线与完整首屏尚未验收）
Assignee: update_experiment
集成负责人: 协调者

Scope / Refs: DESIGN.md、DESIGN-COVERAGE.md、PLAN.md；协调者2026-10-29授权及设计批准。
Blocked by: None；限定合成离线原型已授权。

- [x] 实现者检查：同bookVersion名称、localizedName和逐笔accountLabel变化不返回旧名称，factDigest不变。
- [x] 实现者检查：缺失/过期凭据、源状态和损坏缓存明确拒绝。
- [x] 实现者检查：独立进程重启未变复用、同连接DML delta=0；关闭期变更拒绝旧缓存。
- [x] 实现者检查：双SQLite连接WAL屏障旧/新快照一致及无事务负例。
- [x] 四组TDD原始失败/成功、最终16/16、10份JSON及17私有库路径；冻结candidate-01，边界见RESULTS。
- [x] 协调者独立签署，见 [验收记录](COORDINATOR-ACCEPTANCE.md)。

UI/视觉不适用：无产品页面、控件、接线；真实产品、财务/Bars/重复导入、完整首页和性能NOT VERIFIED/范围外。

2026-10-29：每次presentationDigest重算成本明确可能昂贵；当前产品fresh read/payload digest未证明存在bug。源更新与refresh分事务；仅实验快照一致。任务账本可续写，冻结代码/报告/证据只能另建版本；此任务最多3候选，当前首次冻结，独立审查由协调者安排。

冻结后只读核验：继承的C.UTF-8在macOS不存在，Perl shasum以exit9在hash前失败；systematic-debugging通过locale -a定位环境，子进程LC_ALL=C LC_CTYPE=C LANG=C覆盖后44/44核验exit0。原失败/修正命令、输出及SNAPSHOT前后相同hash保存于新post-freeze-check-01.json；未修改冻结README或代码。审查命令请使用该locale前缀。不是第二候选或性能运行。
