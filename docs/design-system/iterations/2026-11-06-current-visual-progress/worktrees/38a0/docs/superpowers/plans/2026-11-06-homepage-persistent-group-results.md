# 可保存的分组计算结果验证（原任务候选4/5）

> 执行方式：Sol 6.1 Ultra实施，fresh Luna 6 Max独立审查，协调者独立复跑。已获用户持续推进授权；不重复请求常规实施许可。

**目标：** 解决“组结果不能保存、时间键每次变化”的卡点，确定后台计算可以使用的真实结果接口。只完成[如何保留全库校验并复用按组计算结果](../../../.scratch/homepage-db-optimization-20261105/issues/07-global-proof-group-results.md)，不把本实验当作整页一秒验收。

**规格：** [写后计算补充设计](../specs/2026-11-05-homepage-write-precompute-design.md)第三、六、七章；原票全部六项验收。原3/5、历史5/5及冻结证据保留。

## Global Constraints

- 原公式、全库完整性和资格规则不变；财务规则、Bars、并发专项继续暂停。不得连接原业务数据库。
- 只写新目录 `.scratch/homepage-db-optimization-20261105/group-results/`；协调者另维护计划、追踪和验收文档。不得改产品文件、旧冻结实验、依赖、服务、提交或远端。
- 候选从当前唯一产品公式源机械生成，逐项声明差异，反向还原后必须与源逐字一致；源锚点漂移应拒绝生成且不改已有输出。
- 比较完整未改builder与候选的业务输出，包括金额、理由、资格、所有业务时钟、有效期、非空series。仅运行身份sourceId/revisions/requestGeneration、阶段计时/diagnostics可排除。
- 所有证据、oracle、缓存数据库的路径必须由本次运行参数指定，拒绝默认覆写旧结果；root、Luna、worker各用独立输出目录。源资料只读，测试只用合成内存业务库与独立临时结果库。
- 不降低或重开原轮次上限；提交此候选记4/5，若有整批反馈仅剩5/5，未解决则暂停原任务。

## 决策与对象

**保存原计算器真正算出的当前行基础结果；合计、汇率换算及全库资格每次重新组合。** `projectedCurrent` 中 native 行是计算结果接口：原币种市场金额、浮盈、持仓费用、eligibility/reasons、数量与成本/费用依据，以及两种既有行情选择各自的输出。Decimal按完整精度string保存，null仍为null。恢复后调用原`fxFor`、`sharedMetric`与全局门，不抄写财务公式。

| 对象 | 数据与版本 | 读写责任 |
| --- | --- | --- |
| 全库校验凭据 | 当前acquisition/selection receipt、universe reasons、bounds、完整来源版本 | 每次原链路读取校验；不得装入组缓存冒充全库 |
| 组事实 | 账户/标的/nature/run、原executions及证据、冲突、metadata/展示依赖 | 确认输入，产生依赖摘要；删除组不再参与当前组合 |
| 当前行基础结果 | schema/code/policy版本、group identity、dependency digest、业务时点证书、完整精度native amounts、去除请求cursor的evidence、quote coverage、payload摘要 | 只有无附加证据、无冲突、ordinary组可保存；真实SQLite保存并跨进程恢复 |
| 页面组合 | 当前scope/revisions/source、当前cursor、原FX/metric汇总、fresh全库资格 | 绑定请求cursor后使用原组合；公开JS行对象可以新建，必须证明其底层计算结果从存储读取且未重算 |

历史端点、持仓canonical facts与准备过程本轮保守继续原链路，不声称全页计算消失。模型必须说明它们的输入/输出与失效关系，非空历史series必须等价。此处是明确性能限制，不是删除原功能。

**时间证书来自实际业务依赖，不使用Date.now作为键。** 对允许保存的普通组，证书至少含Shanghai业务日、`selectedPrepared`的有序成交ID、原calendar给出的completed session及market localDay。知识cursor不参与基础值，读取时绑定当前cursor。附加events/positions/opening、seeds/valuations、冲突、非ordinary全部走原路径。两种quote选择不得互换。FX不属于原币结果，继续每次换算和核验，不复用旧换算资格。未经证明的展示等依赖可保守失效，但必须记录限制。

## Review Focus

1. B来源缺口变化：A基础行从持久存储命中，合计仍null/unknown且保留CNY720。
2. 秒钟推进：同一证书内命中且完整业务输出等于当时原builder；成交截止、市场收盘、业务日变化必须失效，不能伪造旧cursor。
3. 文件跨进程恢复：必须终止第一个进程，在另一个进程读取相同结果库，不能用内存Map冒充恢复。
4. 变更安全：A卖40改20→80/960/160、删除B无残留，sim run互隔离；账户费、冲突及复杂证据回原链路；FX转换fresh。
5. 缓存不可用：损坏JSON/摘要、错误schema/code/policy、读取/写入失败和容量拒绝不得产生错误金额；以原计算回退并报告命中/拒绝/重算原因。

### Task 1: 实现并验证可保存的当前行基础结果

**Owner:** gpt-6.1-sol / ultra；禁止再派代理。

**Files:** 只创建/修改 `.scratch/homepage-db-optimization-20261105/group-results/worker-*`、`candidate/`、`prototype-*`、`MODEL.md`、`DEPENDENCIES.md`、`REPORT.md`、`NEXT.md`、`worker-runs/`。协调者的`root-*`、`luna-*`不属于worker。

**Interfaces:**
- Consumes：当前`prepareHomepageV25Source`、`projectHomepageV25Boundaries`与完整`buildHomepageViewPayload`；只在生成候选中插入可注入结果store。
- Produces：小接口`get(key)`/`put(record)`（明确类型、失败与容量约束），版本化JSON基础结果、SQLite adapter及时间证书；生成manifest/完整schema和依赖说明；独立参数化复跑入口。
- 实际调用者：候选`projectedCurrent`的native行计算；未来后台只可复用同一求值路径，不另造公式。当前默认产品调用方不接线。

- [x] 写最小失败用例：A买100@10、卖40@11、quote12→60/720/120；新增B或B来源gap时A结果应从store恢复，禁用存储实现时该断言失败。保留真实RED日志，fixture/环境错误单独记录。
- [x] 最小实现后重跑：逐项深比未改完整builder。增加A修订、B删除、4点series、秒钟推进、截止/收盘/换日、FX换算、模拟运行、附加证据/冲突、版本/损坏/I/O与容量边界。
- [x] 独立Node进程填充、关闭、恢复同一结果库；报告真实磁盘命中、实际求值次数、缓存字节与仍执行的canonical/历史工作，不用小样本耗时证明一秒。
- [x] 用pinned Node运行聚焦测试、候选类型检查、机械还原/漂移拒绝、975产品文件及旧冻结文件完整性。只跑受影响实验检查；不安装coverage provider，不跑会起服务/访问业务库的全项目命令。
- [x] 自审并冻结worker文件SHA；在REPORT给出精确命令、证据参数、预期/实际、限制与后续接口。无提交。

### Task 2: 独立审查与协调者接受

**Owner:** fresh gpt-6-luna / max，之后/root；只写各自`luna-*`、`root-*`输出及由root维护的父文档。

**Interfaces:** consumes Task1实际新增文件与机械生成差异的完整review package、同一brief/report；produces spec/quality双结论和独立fresh运行证据。

- [x] fresh Luna直接审查真实差异及接口，不接受空HEAD..HEAD包；用独立路径重跑baseline/candidate/跨进程恢复/类型及保护验证。
- [x] root检查全部业务对照和反例，独立运行并核对SHA；保留FAIL/NOT VERIFIED。任何必要项不满足则原票不得关闭。
- [x] 更新原票/地图、README、DESIGN-COVERAGE、FINAL-ACCEPTANCE与简明结果，统一区分“接口验证”和“整页目标”；若通过，记录后续后台接线票，不在本session解第二票。

## 验收范围

无产品页面、路由或数据状态接线改变，视觉与浏览器验收对本隔离实验不适用；原桌面首页及交易库完整一秒门槛继续保留为未通过。95%分支覆盖若无可用provider则明确NOT VERIFIED，不能以case数量替代。


## 实际接受记录

2026-11-06，以上两项任务均已完成。独立Luna审查与协调者复跑均通过，只接受本隔离实验的持久结果接口；[协调者签署](../../../.scratch/homepage-db-optimization-20261105/group-results/root-acceptance.md)、[独立审查](../../../.scratch/homepage-db-optimization-20261105/group-results/luna-review.md)、[本轮简报](../../../.scratch/homepage-db-optimization-20261105/group-results/ROUND-4.md)保存实际证据。原性能FAIL和覆盖率NOT VERIFIED不变；后续沿用原写后计算任务，未在本轮启动。
