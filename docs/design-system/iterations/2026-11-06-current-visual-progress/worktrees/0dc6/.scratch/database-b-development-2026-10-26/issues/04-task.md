# 04 - 来源材料沿革与范围证据

ID: DBB-04
State: closed
Status: accepted
Assignee: /root/dbb_materials
Coordinator: /root


**Files:** 新增 `app/lib/storage/source-materials.ts`、`source-materials.test.ts`；在Task3交接后新增migration16；新增 `stored-trade-snapshot.ts` 及测试。Store此时只读。
**Refs:** 设计4.2/4.3、5.3、7、8。
**Interfaces:** `prepareMaterialChanges` 返回不可变变更描述，不自行事务；`projectEvidence`、`explainMaterial` 接受同一读取上下文。`readStoredTradeSnapshot(database, selection)` 返回BookVersion、事实、材料、诊断、读取范围和凭据。选择轴已知/未知分别保留；期间读取包含前序依赖，不虚构期初基准。
**Blocked by:** Task3。
- [x] 测试历史import_batches迁移保留原JSON、缺指纹/定位明确未知、零成交材料、重复升级稳定身份；禁止按币种/首笔/文件名推定归属。
- [x] 加最小材料、不可变版本、观察与关联表；普通写只能由协调提交的内部应用函数使用，不自行begin/commit。
- [x] 新版缺E2输出必选处置：保留或撤回；存在其他来源/人工修订不得自动撤回，旧观察保留。读取能排除已证明无关缺口，未知轴仍保留诊断，且不批准财务金额。
- [x] 真SQLite往返、迁移与范围测试通过后冻结；独立Luna验收。


## Acceptance

Attempts: 2/5. Candidate1 independent FAIL; candidate2 ACCEPTED: dedicated Luna spec/quality/fix PASS, root133PASS/hash exact. Evidence: ../evidence/task-4/

## Dependency issue links

- [Task3](./03-task.md) must be accepted and closed.

## 协调者派发前补充（仅细化原设计，不改变要求）
- 设计6.3明确支持`version?: {exact: BookVersion} | {atLeast: BookVersion}`；exact要求全部字段相等，atLeast仅同databaseId/epoch且当前sequence>=要求。世代不同、当前落后、分页跨版必须显式拒绝，不能伪造历史结果。Task7将以提交凭据调用atLeast读取。
- 读取事务复制事实、材料、原始诊断及版本后立即结束，摘要/复杂物化在结束后进行；读取失败不得吞错为空数组。调用方已在事务中时不能回滚其事务。
- 期间选集返回所需前序事实，区分可展示事实与可证明覆盖；没有已证明基准时不能只返回期间成交后声称持仓充分。不能因为缺月结隐藏合法成交列表。
- 对旧import_batches升级须保留原JSON及独立来源身份；历史交易若无法证明某材料内的稳定观察位置，标记未解析，不制造row/fileFingerprint。零成交材料不能依赖第一笔成交求归属。
- migration16使用Task3已验收的tradeBookVersionTriggersSql覆盖正式来源/关联/映射语义变化；计划/凭据管理变化不推进版本。migration1–15及校验不可重写。
- Task5需要可序列化、不可变的材料变更描述，以及只在调用者已有唯一写事务中应用的内部函数；不可把可随意调用的公共增删改查变成第二写入口。prepareMaterialChanges本身不写正式材料。
- 材料换版的缺失成交处置既需计划中明确选择，也需提交中重验依赖、审计和保留原观察；本票输出必要描述和数据能力，最终整条提交由Task5集成验证，不能预称完成。

## Candidate1 FAIL / candidate2修复
- Luna独立发现：保留content字段可绕过来源投影/映射审计；非法日期被Date.parse改月；合法历史NULL账户导致整次读取失败。
- 原123 PASS日志保留，不代表验收通过。原实现者统一修复并补聚焦反例；Task5继续阻塞。

## Candidate2 ACCEPTED
- 三条Important逐项关闭，原FAIL保留。独立审查task-4-luna-review-2.md，root-verification-2.log 133PASS。
- 四个来源/快照文件及schema16哈希一致。Task5已按真实契约放行；Task5/6/7端到端仍NOT VERIFIED。
