# 全库校验与分组准备复用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用隔离原型证明：不改变全库完整性和财务规则，也能复用未变化分组的真实计算准备工作。

**Architecture:** 原型由脚本从当前真实 performance 模块生成机械变体，只替换 prepare 中的分组准备段，不复制或改写公式。每次仍用完整 builder 读取同一内存数据库，重新收集完整来源、费用、行情、汇率、资格及页面结果；候选路径只复用相同依赖的 ordinary canonical/fee preparation。原产品文件保持不变。

**Tech Stack:** pinned Node 26.0.0 / SQLite 3.53.0, TypeScript, Vitest, memory SQLite.

**Spec:** [用户已批准的写后计算设计](../specs/2026-11-05-homepage-write-precompute-design.md)，第三、六、七章；[本次决策票](../../../.scratch/homepage-db-optimization-20261105/issues/07-global-proof-group-results.md)；[前置证据](../../../.scratch/homepage-db-optimization-20261105/resume/contract-review.md)。

## Global Constraints

- “不添加第二套财务公式”；不改变完整性、金额、unknown、来源资格、行情或历史区间语义。
- “原始文件用于验证导入，人工修正后的数据库用于核对已有事实”；本票只用内存合成事实，不打开原业务数据库，不重解析原件。
- “没有证明的范围保守失效并标明性能限制”。复用只能减少明确相同的计算，不缓存全局资格或最终合计。
- 不修改 app/db/conf/scripts/package、旧 resume 证据或原始资料；不启动/停止既有服务，不提交、推送或合并。
- 用户模型：gpt-6.1-sol / ultra 实施；fresh gpt-6-luna / max 独立验收；root 再独立验证。
- 沿用原问题恢复阶段；现2/5，本候选进入第3/5轮。原5/5失败记录保留；达到5/5仍不通过时暂停，不另起计数。
- 财务规则、Bars及并发专项暂停。无产品接线、控件、布局变化，本原型UI/视觉/浏览器写入不适用；原完整页面FAIL保持。

## Review Focus

1. 无关账户的来源缺口：行基础准备可以命中，合计必须由新全库凭据降为不可用。
2. 原成交相同但账户级费用或冲突来源变化：重新应用全部归集依据，不能复用旧合计。
3. 组身份含模拟运行；不能把同账户同标的的不同模拟盘串用。
4. 名称/复盘、行情、汇率或时间变化：声明每层依赖，未证明的变化保守重算；跨到期边界不能返回旧报价/时间。
5. evidence fallback、修订/移除/重复冲突及缓存容量：不安全的状态不得作为可复用ordinary结果；记录实算工作而非虚构命中。

## File ownership

Sol唯一写入 `.scratch/homepage-db-optimization-20261105/group-reuse/` 中的 `prototype-*`、`candidate/`、`worker-*`、`DEPENDENCIES.md`、`MODEL.md`、`NEXT.md`、`REPORT.md`。root拥有本计划、ledger、父级状态/覆盖、root-*证据和review package；Luna只写本轮 `luna-*` 报告/测试证据。候选生成物必须可重建、绑定源文件摘要、导入正确重定位；生成步骤遇到源段落不匹配必须失败，不静默改错位置。禁止添加另一套手抄公式。

---

### Task 1: 验证分组准备复用且全局资格仍正确

**Files:**
- Create `.scratch/homepage-db-optimization-20261105/group-reuse/prototype-generate.mjs`: 从既有模块生成隔离变体，机械差异与源SHA记录在candidate manifest。
- Create `group-reuse/prototype.config.ts`, `prototype.test.ts`, 必要小型fixture/adapter文件均以前缀prototype-命名。
- Create `group-reuse/candidate/` 生成物；仅测试入口可引用。
- Create `group-reuse/MODEL.md`, `DEPENDENCIES.md`, `NEXT.md`, `REPORT.md`, `worker-*` 日志及结构化结果。

**Interfaces:**
- Consumes real `buildHomepageViewPayload(DatabaseSync, HomepageSnapshot)` and current `prepareHomepageV25Source(input, options)`; memory `SqliteStore` public writes and reviseTrades; original unchanged financial implementation as oracle.
- Produces a bounded candidate group-preparation cache scoped to one experiment/session, exact dependency keys and measured `reusedGroups/recomputedGroups/reusedTransitions` alongside existing actual canonicalSweeps/canonicalTransitions/feeSteps. Expose only a narrow prototype control/observation seam; default product never imports it.
- Public value comparisons retain all deterministic business fields, reasons, policies, scopes, bounds, selected clock, validUntil and complete series if present. Exclude only documented runtime identities (`sourceId`, `revisions`, `requestGeneration`) and stage durations/diagnostics. Compare baseline through the unchanged real module, not candidate-off vs candidate-on alone.

- [x] **Step 1: 建立最小失败用例。** 在A买100/卖40的真实完整builder结果中断言余60、720市值、120浮盈；第二次输入仅增加B组时，预期A准备复用，B重算。先保存未实现复用时的真实断言失败及退出码；缺模块导入错误不算RED。
- [x] **Step 2: 实施机械复用。** 只在prepare的normalized→canonical→ordinary段复用；依赖键绑定当前collect后完整组、规则与必要外部依赖。仅ordinary-sweep可入缓存；fallback不复用。全局收集与费用索引重新建立，新的handle/source version、memo与页面投影不复用旧资格。可保守包含全部账户依赖；容量/生命周期显式有限并测试。先报告计数，再谈耗时。
- [x] **Step 3: 最小用例逐项对照。** A卖出40→20应变为80/960/160；同时B unchanged可命中。B补入前置探针同样的缺口来源，A准备仍命中，但current totals为null，理由保留universe gap，CNY部分金额保留；与真实未改builder逐项相等。另覆盖账户费用、模拟运行隔离、名称/复盘纯展示、行情/FX变化、业务时间到期；未支持的范围明确保守失效。至少一项non-ordinary/fallback确保不被误缓存。分支覆盖率目标95%仅针对新增复用逻辑；工具不可用时明确NOT VERIFIED，不宣称覆盖达标。
- [x] **Step 4: 验证与报告。** native node运行候选配置，保存RED/GREEN完整退出码、每case实测阶段耗时/工作计数、基线/候选业务对照摘要及输入输出SHA。文档说明全库凭据、组事实、组准备、页面组合四层的数据字段/版本/依赖；区分“复用了内存计算准备”和“持久页面结果”。给出下一持久后台实现边界，不能以小例耗时宣称真实页面≤1秒。仅运行适当范围的相关回归；整个产品构建/浏览器不在本次交付。
- [x] **Step 5: 自审及冻结。** 提交root报告路径、所改新文件、命令和结果、各条件未证明的限制、source和candidate摘要。不提交git，不更新父任务状态或擅自扩大开发。等待独立验收。

### Task 2: 独立验收与单票收尾（root协调）

- [x] 生成实际工作区新增文件diff与SHA清单；不得以HEAD..HEAD空diff冒充审查包。fresh Luna读取本任务、机械差异、候选和证据并独立运行核心case，报告spec及quality两个结论。
- [x] root独立重跑同一版本，复核原975产品文件未变、全局缺口反例/真实计算计数/失效规则及版本，记录本轮3/5结论；有缺陷则统一反馈原Sol，下一候选沿用4/5、5/5上限。
- [x] 本票全部条件有证据才关闭；保存独立Resolution、更新地图命名指针和README/DESIGN-COVERAGE/FINAL-ACCEPTANCE，保留产品FAIL及所有暂停范围。若必要依赖不可证明则保留open并写具体未通过用例。

## Self-review / rulings

覆盖决策票六项标准；Task1为单个独立可验收计算切片，Task2是必须顺序的独立审核。既有设计和用户“继续”已授权本有界原型，执行方式已确定，不重复询问。模型及轮次遵循用户要求。无新增产品接口、UI或服务，故没有图片/elementID冒用；后续产品接线另需完整桌面和真实持久化验收。generated candidate为临时受控实验变体，生产公式仍只有一个源，避免长期影子实现。


## Execution result — 2026-11-06

Task1窄准备原型由Sol冻结，fresh Luna和root各独立baseline7/7、candidate7/7，34对业务字段全部相同；975产品、44冻结worker文件未变。计划Task1/Task2的实验与审查动作完成；条件性收尾按未满足处理：原07保持open / acceptance-failed，不生成关闭Resolution。持久schema/组合、严格行对象复用、真实跨请求命中率和95%覆盖仍未证明，父目标FAIL保留。恢复阶段3/5已用，下一候选仍原07第4/5轮。详见group-reuse/root-acceptance.md及luna-review.md。

Review ruling: plan explicitly restricts reuse toprepare seam, so原07严格结果对象与持久接口未满足是本计划范围不足，不是可忽略的规范要求；保留未通过状态，不通过原型PASS关闭票。精确毫秒guard是有意保守失效而非已接受的最终架构。未进行产品接线，UI/视觉验收不适用本轮。验收入口硬编码证据路径列Minor/deferred；root/Luna安全副本仅更换输出与oracle路径，未修候选或覆盖实施者证据。
