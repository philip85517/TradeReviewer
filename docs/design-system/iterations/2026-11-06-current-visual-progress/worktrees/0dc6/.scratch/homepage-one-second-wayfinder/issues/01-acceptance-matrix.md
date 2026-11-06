# 验收数据、首屏完成判据与采样矩阵如何冻结

ID: homepage-one-second-acceptance-matrix
Labels: wayfinder:grilling
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

在用户已确认的一秒边界下，采用哪份数据规模、独立非零业务金样及可观察完成判据，才能公平比较当前路径和候选？冻结的是测量条件，不重新询问或降低一秒门槛。

## Scope

- 一次一问，先解决验收数据代表性，再冻结场景与探针。由仓库可查的事实不交给用户猜。
- 记录真实副本的证券/成交/回合/账户/日线数量、历史跨度、市场、FX覆盖；至少有真实非零金额及持仓/期间曲线。敏感原始记录留在本地，证据优先计数与校验值。
- 对关键金额另设可逐笔核算的业务金样，定义独立核算责任；已有正确领域样本可复用，当前存在已知失败的实现不能成为唯一 oracle。
- 冻结导航起点和真实数据paint/可交互终点的观测方法、缓存维度、重复次数、硬失败规则；明确首屏在两个批准桌面视口的内容。设计不因不同折叠位置缩水。
- 本地业务输入完整而投影缺失、失效或算法升级，不得自动排除；外部数据缺失另列状态正确性，不能计完整数据成功。

## Refs

- [用户确认目标与范围](00-map.md)；[验证路线草案](../VALIDATION-ROUTE.md)。
- [旧样本边界、设计预算和反例](../../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:104)。
- [V2.5 首屏布局与桌面视口](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:40)。

## Blocked by

无。

## 验收标准

- [ ] 保存用户实际取舍及数据/场景清单；用户已确认的一秒边界不重复变成未决项。
- [ ] 版本、数据规模、oracle及完整财务成功/正确缺失状态的区分可执行，不依赖零group或骨架探针。
- [ ] 明确每个必测状态的原始样本记录与≤1000ms逐次判定；采样数和设备边界有依据，分位不覆盖硬失败。
- [ ] 主协调者独立核对规范与矩阵，保存独立Resolution后才可关闭。

## 反例与证据

只测热访问、把effect当paint、用当前旧trace检查脚本充当实时回归、把合法空仓当唯一业务样本，均不能接受。答案和矩阵作为链接资产附于独立Resolution，不在建图时预填。
