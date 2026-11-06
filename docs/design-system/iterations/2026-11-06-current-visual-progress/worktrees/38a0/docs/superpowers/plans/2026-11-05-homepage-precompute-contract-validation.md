# 共用后台计算的首项契约验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Only implement the bounded task assigned to you.

**Goal:** 用可执行的小案例与真实资料证明共用计算的安全接入位置，明确局部重算是否成立，作为后台更新实施的第一道门槛。

**Architecture:** 本轮先验证现有公开计算接口和来源合同，不改写财务规则。单笔与批量复用同一计算；若当前接口无法支持局部复用，先用证据明确需要补充的模块，不能假装已支持。

**Tech Stack:** 项目固定 Node 26.0.0 / SQLite 3.53.0，TypeScript、Vitest，现有解析器与首页计算器。

**Spec:** [写后计算与旧库刷新设计](../specs/2026-11-05-homepage-write-precompute-design.md)，尤其第三、六、七章。

## Global Constraints

- 用户于2026-11-05回复“按照上述建议推进迭代”，批准补充设计并恢复原问题；保留旧5轮，新授权最多5轮，共用父问题计数，不因拆票重置。
- 保留人工修正、市场、实盘/模拟性质、来源完整性与缺失状态；不猜值、不补零、不跳过校验。
- 财务公式和资格规则、Bars开发及并发专项继续暂停。
- 实盘原件 `/Users/zhoulin/Documents/交易` 和模拟原件 `/Users/zhoulin/Documents/模拟交易复盘` 只读；不要执行其中脚本或打开其中未知业务库写入。
- 本轮允许新建 `.scratch/homepage-db-optimization-20261105/resume/` 下的独立测试、报告与专用配置；禁止产品代码、原始数据库、预览服务、依赖、配置默认值和已有证据修改。
- 数据库案例使用内存库或显式隔离库；读取旧库必须 `readOnly: true`。不得用普通文件复制代替SQLite一致性备份。
- 使用 Sol 6.1 Ultra 执行；Luna 6 Max 独立审查，协调者独立接受。实施者不再派代理、不提交、不推送、不合并。

## Review Focus

1. 一条卖出必须读取此前买入，不能靠新成交孤立算余额；由Task1最小买卖案例验证。
2. 原始文件对应记录已人工修正；由Task2明确文件身份与解析/修正对账边界，禁止以重解析替代旧库事实。
3. 模拟CSV原始行不一定是一条成交；由Task2调用现有真实解析器，报告实际成交数与性质。
4. 账户/标的/性质筛选可能受全库完整性合同影响；由Task1跨组对照及代码证据明确支持范围，不把“看上去相同”当成可组合证明。
5. 同步构建和缓存命中不可混淆；由Task1分别记录实际构建阶段，未实现后台或局部更新必须明确写出。

## Task 1: 共用计算与局部重算契约探测

**Owner:** Sol计算验证 Agent。**Files:** 只创建 `resume/calculation-probe.test.ts`、`resume/calculation-probe.config.ts`、`resume/calculation-report.md` 及同前缀证据；禁止改app/db。

**Interfaces:** 消费现有 `buildHomepageViewPayload(database: DatabaseSync, selection: HomepageSnapshot)`、`createHomepageState` 与 `SqliteStore`。产出一个可重跑Vitest入口及证据，说明单笔/批量的相同输入能否通过同一个真实计算入口得到相同业务字段；不声称不存在的后台入口已实现。

- [x] 阅读设计与 `homepage-view-builder.ts`、`homepage-view-store.ts`、来源获取与资格校验调用链；定位哪个步骤必须读取全量依据、哪个结果可以按对象复用，提供path:line。
- [x] 先写最小可观察案例：同账户同标的买100股、卖40股，配齐必要本地行情；应余60股。逐次落库/重算与一次批量落库/重算在固定时点的业务字段一致；固定时间使用既有Date测试方式。
- [x] 增加最小隔离反例：第二账户/标的、模拟记录不污染目标实盘范围；修订案例是否可沿现有公共操作构造，由真实合同决定，无法构造就明确记录。
- [x] 运行测试并保存原始结果。既有行为若通过，诚实写“特征验证”，不能伪造红灯；若发现规则或程序缺陷，只复现并报告，不修暂停领域。
- [x] 在报告区分已证实的语义等价、未实现的后台调度、尚未证明的局部来源复用；给出下一实现接口建议与依赖表。
- [x] 报告固定输入、实际运行命令/结果、构建阶段时间；不得从小样本速度承诺真实全库≤1秒。

## Task 2: 两组真实资料与旧库修正的测试接入

**Owner:** Sol资料验证 Agent。**Files:** 只创建 `resume/source-probe.test.ts`、`resume/source-probe.config.ts`、`resume/source-report.md`、`resume/source-manifest.json` 及同前缀证据；不修改Task1文件。

**Interfaces:** 消费现有TradingView解析器公开入口与只读旧库。产出原件摘要/来源对应情况、可用的最小模拟样本和真实解析证据，供之后导入→计算闭环使用；本轮不执行原件导入或OCR修正。

- [x] 枚举指定目录下PDF/CSV，不读取/执行混杂脚本；选定最小CSV，并调用真实解析器确认实际成交数、市场与模拟性质，报告130原始行与实际成交关系。
- [x] 使用SHA-256文件身份及旧库来源批次/内容身份字段只读核对少量代表PDF、全部6个CSV。无摘要或无法唯一匹配即报告未核验，不能按文件名直接判相同。
- [x] 用独立测试描述实际解析输出，保留最少断言：非空成交、模拟性质、合法市场；保存测试原始结果。不得为测试修改原件、解析规则或旧库。
- [x] 报告首次导入测试使用独立未导入库、旧库批量使用保留修正副本的具体安排；识别OCR工具或资料依赖，但不擅自启动外部调用。

## Task 3: 独立审查、协调者接受与下一步决策

**Owner:** 每个Sol任务分别由全新的Luna独立审查，协调者最终接受。**Files:** `resume/calculation-review.md`、`resume/calculation-review-round2.md`、`resume/source-review.md`、`resume/contract-review.md`、`resume/ROUND-1.md`、`resume/ROUND-2.md`、原任务索引及独立Resolution。

**Interfaces:** 消费Task1/Task2报告与测试差异，输出两项范围化结论以及“可直接复用／需要先补深模块”的决策。不把测试工具验证接受成后台功能交付。

- [x] 两个Luna分别读取对应任务的实际新增文件与报告，给规格符合性和质量结论，指出缺失/失败/未验证；协调者汇集结论。
- [x] 协调者独立重跑两个探测入口，检查原库读写方式、字段对照、测试真实计算和数据性质。
- [x] 记录本轮计数和结论，保留旧5轮及所有FAIL；只解决本次共用计算接入的决策票，不关闭一秒目标。
- [x] 根据证据明确下一实现切口及阻塞；若改变已批准业务规则才可继续，保持该部分暂停并记录原因。

## 自查及执行方式

两条探测任务没有共享写文件，只读现有产品接口；各自专用Vitest配置不改变默认测试集。协调者不重复实现工作；实际可并行的是只读调查与测试资料准备。采用用户已确认的多Agent执行方式，工程步骤无需重复审批；原开发工作与未提交文件均保留。

## 执行结果（仅本计划的前置验证）

恢复第1轮因比较器漏比规则印记而未接受；第2/5轮补齐探针后，两位独立Luna范围审查及协调者8项重跑均通过。上述勾选仅表示本计划调查与验证步骤完成，不表示局部复用、后台发布或完整首页一秒目标通过。具体结论、未验证范围及原始证据见[协调者验收](../../../.scratch/homepage-db-optimization-20261105/resume/contract-review.md)与[第二轮简明结果](../../../.scratch/homepage-db-optimization-20261105/resume/ROUND-2.md)。下一张全库校验与分组复用票仍待领取，父目标开放，旧失败记录及暂停范围保留。
