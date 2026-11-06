# 首页读模型与新鲜度的对外合同如何确定

ID: homepage-one-second-read-contract
Labels: wayfinder:grilling
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

首页用紧凑读模型替代浏览器全量来源时，什么输出及版本证据才足以表示同一真实财务状态？导入提交、版本发布和缺失/失效投影的等待由哪一步承担？先确定可观察合同，不先选数据表或缓存框架。

## Scope

- 指标、持仓、当前/历史所需曲线、scope/selection、币种、coverage/unknown及来源时间证据各有明确职责；复用已批准公式与正确领域算法，不另造金额逻辑。
- 列出实际变更依赖：成交增删改/回滚、instrument/别名、费用/月结证据、行情及coverage、FX、日历/时区、asOf/knownAt和算法/政策、账户/期间/附件等实际筛选。receipt随机值、条数、TTL均不充当完整revision。
- 讨论一致快照与原子发布、构建中写入、旧请求迟到、服务重启及投影缺失/损坏/版本不符；旧版可显式标识，不能宣称当前最新或完整成功。
- 用户决定提交完成与投影发布的关系及可接受写入等待；报告写入＋预计算＋首开总体验。不能自行把超时成本藏进导入。
- 任意子集、期初状态、跨账户费用和非加性指标不能靠预计算所有组合或简单求和跳过；缩小来源须证明等价，保留64MiB既有memo合同。

## Refs

- [推荐合同与六项约束](../../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:60)。
- [现有来源合同](../../../app/lib/storage/homepage-source-contract.ts)、[财务模型](../../../app/lib/reviews/homepage-v25-performance.ts)。
- [期间公式及持仓时间独立](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:191)。
- [已接受的局部金额与性能证据](../../homepage-v25-implementation/FINAL-ACCEPTANCE.md:8)。

## Blocked by

- [验收数据、首屏完成判据与采样矩阵如何冻结](01-acceptance-matrix.md)

## 验收标准

- [ ] 用户真实决策形成首读/写入/恢复状态机；一秒硬门槛及外部补数边界保持清楚。
- [ ] 保存输入→revision/失效→输出字段/来源证据矩阵，含原子发布及裁剪等价的反例。
- [ ] 明确业务金样、已有正确领域样本差分和独立核算三者的分工，不以错误旧输出为唯一oracle。
- [ ] 由协调者独立审查金额、缺失值与时点合同，独立Resolution后才能关闭；尚未实测之处保留NOT VERIFIED。

## 反例与证据

同数量修订或删后重建未失效、未来成交改变历史FX资格、readAt把旧行情变新、完整收据贴到裁剪payload、unknown补零或失败缓存当新鲜，均阻止合同接受。
