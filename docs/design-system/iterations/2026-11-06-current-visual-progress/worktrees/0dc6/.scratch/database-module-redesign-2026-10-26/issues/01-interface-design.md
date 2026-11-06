# 01 — 比较数据库模块的设计方案

ID: DB-REDESIGN-01
State: open
Status: implementation-ready
Assignee: /root
集成负责人: /root

## Scope / What to build

**先比较不同 Interface 如何承接相同业务规则，再形成可审查的数据库模块设计。** 本票只有研究、设计及文档，不含开发、数据库迁移、数据修复、页面修改或暂停任务恢复。

深入成交事实、来源材料、预览确认、修订、一致读取的模块职责和数据对象；保留 SQLite、十进制精度、日期精度、未知费用及实盘/模拟隔离。已有 Recall 的版本控制和行情模块不整体重写。

## Refs

- [用户引用的 codebase-design](/Users/zhoulin/.codex/skills/codebase-design/SKILL.md)。
- [综合审查 DB01–DB07](../../../docs/backend-design/database-review/REVIEW.md)。
- [现有对象与生命周期](../../../docs/backend-design/database-review/current-model.md)。
- [原后端目标候选 M01–M08](../../../docs/backend-design/target-design.candidate.md)。
- [项目任务规范](../../../docs/agents/issue-tracker.md)。

## Blocked by

None。用户已选择B方向，正式设计具体约定仍待审；不能把协调者建议记为用户已批准。

## 验收标准与反例

- [x] 三名 Agent 分别完成极小命令 Interface、按业务职责的多个深 Module、围绕导入确认路径的 Interface 探索；协调者在当前会话核验取舍，不以方法数量代替 Depth。
- [x] 三份会话报告说明输入输出、不变量、调用顺序、错误、性能约定、依赖与测试 Seam；不是完整正式设计。
- [x] [正式设计第4–5、7、11节](../../../docs/backend-design/database-module-design.candidate.md)逐项给出DB01–04唯一规则所有者；DB05范围与历史财务供数分开；未经批准规则标为建议。
- [x] [正式设计第2、6–7节](../../../docs/backend-design/database-module-design.candidate.md)区分列表、持仓、财务资格；读取凭据不冒充历史覆盖或可重放持久快照。
- [x] [用户真实答复“B”](../README.md)确认方向；正式设计审批不等于产品验收或暂停任务恢复。
- [x] [独立检查2/3轮PASS及协调者裁定](../FINAL-ACCEPTANCE.md)；第1轮FAIL和两项处理保留。

## 派发说明

三名 Agent 均只读，无文件写入权，不启动服务，不打开业务库，不派生 Agent。

- `/root/db_minimal_interface`：1–3个入口，评价是否隐藏复杂度或转移到命令参数。
- `/root/db_domain_interfaces`：按业务职责分工，审清唯一写事务与规则权威。
- `/root/db_import_journey_interface`：默认导入路径，重点计划、确认、并发、幂等与权威读取。

## 验收证据

第一轮探索已返回，协调者核对真实导入调用和存储代码后接受其作为方案比较输入。用户随后选择B，正式候选通过[独立检查2/3轮及协调者复核](../FINAL-ACCEPTANCE.md)。本票保持 open / implementation-ready，等待用户审定完整候选；此状态只表示设计文档可审，不表示已经实现产品。浏览器、视觉、真实库写入与一秒性能：不适用，本票不改变产品行为。

协调者在会话中明确两项修正：确认命令必须绑定服务器不可变计划，不能信任可任意改写的预览对象；数据库模块不承接首页金额计算与发布。三份探索报告接受只说明其可用于比较，不是任何产品修复验收。

## 历史

- 2026-10-26：用户要求依据当前排查文档重新设计数据库模块；协调者读取排查文档和源码，派出三个 GPT 6.1 Sol Ultra 只读探索 Agent。未开始产品实施。
- 2026-10-26：三份探索完成，协调者完成第1轮比较核验；接下来先呈现可行方向，待用户选择后形成正式设计。没有额外修复轮次，也没有重置原暂停任务的轮数。
- 2026-10-26：用户答复“B”。形成[正式设计候选](../../../docs/backend-design/database-module-design.candidate.md)，并派出新的 GPT 6.1 Sol Ultra Agent `/root/db_b_builder_check` 进行第1轮只读可实施性检查。此轮尚未判定通过。
- 2026-10-26：正式检查第1轮FAIL，缺少材料换版后旧成交处置、既有TradingView专项迁移/回滚兼容约定。补齐并核对真实代码后，第2轮PASS；协调者接受为候选交付。完整设计仍待用户审定，未进入实施规划或产品开发。
