# 单笔更新与旧库刷新能否安全共用局部计算

ID: HOME-PRECOMPUTE-CONTRACT
Parent: [首页数据库优化与一秒首屏](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: closed
Status: accepted
Assignee: /root
集成负责人: /root

## Question

保留现有完整性、人工修正及财务规则时，当前计算链哪个接口能供单笔与批量共同调用？哪些结果可安全局部复用，哪些依赖必须全量验证？用最小真实计算和原件解析案例验证，决定下一模块切口。

## Refs

- [补充设计](../../../docs/superpowers/specs/2026-11-05-homepage-write-precompute-design.md)
- [首项验证计划](../../../docs/superpowers/plans/2026-11-05-homepage-precompute-contract-validation.md)
- [独立设计审查](../precompute-design-review.md)

## Blocked by

None。用户已恢复父问题；沿用同一新阶段最多5轮，不另起计数。

## 验收标准

- [x] [最小买100/卖40与修订案例、分次/批量字段对照可重跑；历史及后台等未验证范围明确](../resume/calculation-root-evidence.json)。
- [x] [实盘/模拟资料身份分级与人工修正保护有证据，未知关联不猜测](../resume/source-review.md)。
- [x] [现有局部接口不能直接复用的原因有代码及全局缺口反例](../resume/contract-review.md#计算边界的定位证据)。
- [x] [两位Luna独立审查及协调者8项重跑完成；不等于产品或一秒目标通过](../resume/contract-review.md#最终接受)。

## Resolution comment

[独立结论记录](../comments/HOME-PRECOMPUTE-CONTRACT/20261105T031144Z-resolution.md)。本票仅接受能力边界已厘清；父目标未通过，暂停范围不变。

## 当前验收进度

恢复第1轮未接受：比较器漏查确定性规则印记，[首轮记录](../resume/ROUND-1.md)保留。第2/5轮修正探针，独立Luna及协调者复验通过，签署本决策门槛；[第二轮简明结果](../resume/ROUND-2.md)。没有开始产品或后台改造，下一张[全库校验与分组复用](07-global-proof-group-results.md)待领取。
