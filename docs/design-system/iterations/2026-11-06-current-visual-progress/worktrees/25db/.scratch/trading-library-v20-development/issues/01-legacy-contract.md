# 旧数据怎样映射为独立练习并保留复盘引用？

ID: TL20-D01
Labels: wayfinder:task
Parent: [交易库 V2.0 完整产品落地决策地图](00-map.md)
Mode: AFK
State: closed
Status: accepted
Assignee: root
集成负责人: root
Resolution comment: [事实准备结果与未决边界](../comments/TL20-D01/2026-10-26-resolution.md)

## Question

在不写业务库的前提下，现有成交、导入历史、simulationRunId、持仓 episode 和 Recall 文档如何建立练习/版本/主动回合/内部配对的稳定引用？哪些存量信息足够，哪些必须回到日期或行为识别票让用户决定？

## Scope

只解决本问题或为其准备事实，不实施产品。已确认合同不重新投票；未决业务规则不能由实现者推定。AFK仅核对当前工作目录内事实并产出可审查契约；涉及用户政策另回HITL票。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L9–61
- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L65–79
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L136–159
- [开发计划](../IMPLEMENTATION-PLAN.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[当前代码证据](../evidence/code-baseline.md)。
- 代码入口：app/lib/trades/{types,episodes,library,tradingview-account-identity}.ts；app/lib/storage/{sqlite-contracts,sqlite-store,sqlite-repositories,sqlite-http-client,import-history,trade-revisions}.ts；app/api/storage/{bootstrap,trades,trade-revisions}/route.ts；app/lib/recall/。

## Blocked by

None.

## 验收标准与反例

- [x] 用合成的完整、缺日期、仅有旧 run、已有人工作品四类记录给出逐字段映射和兼容矩阵；不得用文件名或净额相等充当身份。[报告与合成](../evidence/decisions/TL20-D01/report.md)
- [x] 读取当前 SQLite/bootstrap/HTTP client/import history/revision/Recall 调用链，提出新增契约的精确类型、事务边界、提供方和实际消费者；列明现有方法复用和需要适配之处。[候选声明](../evidence/decisions/TL20-D01/candidate-contracts.ts)、[独立审查](../evidence/decisions/TL20-D01/review.md)
- [x] 输出可审查的迁移 dry-run、回滚、旧引用保持方案；不能确定的业务政策链接已有日期/行为票，不能以技术选择代替用户决定。[方案与边界](../evidence/decisions/TL20-D01/report.md)
- [x] 不读取或修改真实交易内容；如决策确实需要存量样本，另开范围明确的数据核查票，保护原数据。[root内存复验](../evidence/root-D01/acceptance.md)
- [x] 独立Resolution记载事实/用户原话、理由、影响边界和待同步位置；协调者接受证据后才可closed。[Resolution](../comments/TL20-D01/2026-10-26-resolution.md)、[root签署](../evidence/root-D01/acceptance.md)

## 验收证据

ACCEPTED（仅原票AFK技术事实准备）。[Sol报告](../evidence/decisions/TL20-D01/report.md)、[专属Luna规格/质量双PASS](../evidence/decisions/TL20-D01/review.md)、[root独立接受](../evidence/root-D01/acceptance.md)。root合成10/10及候选Bundler strict tsc通过。完整业务/迁移合同和运行时实现仍未冻结或NOT VERIFIED；不由此接受产品或解除其他未结依赖。UI/真实数据库验收NOT APPLICABLE，原因是只读代码及合成内存核查，不改运行产品。

## 历史

- 2026-10-26 建图：open / ready-for-agent / unassigned；待真实依赖关闭后领取。

- 2026-10-26 用户授权执行；root领取本AFK决策并委派独立技术事实核查，尚未接受/关闭。
- 2026-10-26 专属Luna完成SPEC/QUALITY双PASS；root核对16项冻结hash、亲读源码及独立复验后签署事实准备并关闭。本票没有代答日期、动作、多范围或冲突政策，没有实施迁移或生产CAS。
