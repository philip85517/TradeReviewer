# 首页写后后台计算与持久结果接线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax. 本计划沿用已经批准的设计，立即执行，不重复索取授权。

**Goal:** 把真实写入、旧库刷新、独立后台计算和首页读取接通；实际测量原完整页面一秒门槛。

**Architecture:** 同一业务事务以数据库触发器登记持久待办，独立 Node 进程使用自己的连接顺序领取、计算和短事务发布。HTTP 仅读取已发布结果或明确返回处理中；默认页启动补建，其他精确筛选按需登记。普通组原币当前结果使用已验证的保守依赖和有效时间恢复，资格、汇率及其他计算仍走唯一原规则。

**Tech Stack:** Node 26.0.0 / SQLite 3.53.0、现有 Vinext/Vite/Vitest、TypeScript；不安装依赖。

**Spec:** `docs/superpowers/specs/2026-11-05-homepage-write-precompute-design.md` 第三至七章、原问题 `HOME-DB-COLD`、`group-results/MODEL.md` 与 `DEPENDENCIES.md`。

## Global Constraints

- 恢复阶段4/5已用，最终性能候选为5/5；原失败不删，不借子任务重置计数。必需门槛未过则暂停原问题并记录原因。
- 财务公式/资格、Bars 开发、并发专项继续暂停；禁止把 unknown 改实盘、复制公式、跳过全库证明、把处理中计为完整。
- Sol 6.1 Ultra 实施；每项由独立 Luna 6 Max 审查，root 独立接受。两个实现任务仅允许写各自文件；共享接口依下表固定。
- 保留继承的脏工作区。基线内容见 `.scratch/homepage-db-optimization-20261105/write-precompute/product-baseline.json`。不提交、不推送、不合并。
- 不访问/修改原业务库。真实测试仅从既有隔离基线做 WAL-aware backup 到新的显式副本；原始 PDF/CSV 只读，不覆盖 OCR 人工修订。
- 明确保守全局失效仍是局限：精确筛选缓存不是基础模型，不宣称已完成全部局部重算。16秒搬去后台也不等于写后首读达标。
- 改变页面数据/状态接线触发控件、实际持久化、返回刷新及独立视觉验收；1440×900、1280×800。沿用用户桌面范围排除窄屏，不宣称整页100%。

## Review Focus

1. 写入拒绝/回滚及无业务变化不得发布新结果；审计派生写若保守排队须明确记录，不能伪称成交变化。
2. 计算中输入变化、崩溃或过期：可恢复且失败可查；不得发布旧版本为当前，不能无上限重试。
3. 读取快照含全部行情/FX/来源；不能通过外层 BEGIN 造成嵌套事务错误，结果缓存写入不污染输入版本。
4. 同组下一秒复用但成交截止/收盘/换日失效；FX和全库资格重算，复杂组回退，损坏或I/O失败不改金融含义。
5. HTTP 202、失败和取消有明确客户端合同；有界轮询并遵守 AbortSignal，不把旧页面、空数组或请求成功当完整。

## 文件与接口所有权

|对象|文件 / owner|职责与固定接口|
|---|---|---|
|后台闭环|Task 1：`app/lib/storage/homepage-view-store.ts`、`homepage-view-builder.ts`、`homepage-source-snapshot.ts`、新 `homepage-refresh-queue.ts` / `homepage-refresh-worker.ts`；`db/sqlite.ts`；`scripts/start-local.mjs`、新 worker 入口/loader；相关 API、homepage-view-client 和各自测试|安装待办、稳定输入、计算/发布、启动恢复、进度接口和真实读取状态。不得修改 Task 2 文件。|
|当前组结果|Task 2：`app/lib/reviews/homepage-v25-performance.ts`、新 `homepage-current-group-results.ts`；`app/components/homepage-v25/financial-source-model.ts`；新 `app/lib/storage/homepage-current-group-store.ts` 和专属测试|领域类型 `HomepageCurrentGroupStore` 暴露 get(key):string\|null、put({key,json}):boolean；prepare/source owner 的 options 新增 `currentGroups?`，两处 prepare 都贯通。存储工厂 `createHomepageCurrentGroupStore(database: DatabaseSync)` 返回该端口。|
|共享接线|Task 1消费 Task 2产物|builder options增加 `currentGroups?: HomepageCurrentGroupStore` 并透传 source owner；worker创建工厂传入。端口可选，原调用保持未启用行为；默认无进程全局 store。|
|集成与验收|root|计划/任务/覆盖/报告、隔离真实副本、服务和浏览器，不改两实现者拥有的产品文件。|

两个任务有稳定端口但没有共同写文件，按用户明确的多Agent并行开发执行；不是以技术分层票代替最后的贯通验收。

### Task 1: 真实写入到后台发布再到首页读取

**Files:** 仅上表 Task 1 文件及同名测试；如需其他文件先向 root 报告，不修改 Task 2 文件。报告写 `write-precompute/backend-report.md`。

**Interfaces:** 消费原唯一 `buildHomepageViewPayload` 和 Task 2 可选端口。生产默认 read miss 返回可辨识 `HOMEPAGE_PREPARING` 状态/202，不在 HTTP 执行完整 builder；显式 `background:false` 保留测试/对照的同步入口。新刷新 POST 返回202+任务ID/状态地址；GET返回持久进度与失败原因，拒绝任意 SQL/路径输入。默认全范围首页与已请求精确筛选进入同一顺序执行器，最多32个已登记筛选；没有任务不忙转。

- [ ] **1. 写最小失败测试并实际观察业务断言失败。** 覆盖未打开首页前真实写入登记、事务回滚不留待办、连续变化合并、拒绝重复不新增有效版本；读 miss 不调用 build；同一固定时点单次和批量入口的业务结果一致。先在现有公开入口构造断言，不把缺失 import 当 RED 证据。
- [ ] **2. 安装持久登记与状态表。** SQLite连接初始化完成后、业务写入前安装；输入与待办同事务，派生结果表不进入触发依赖。保守全局失效理由、旧/新归属更新、审计派生变化单独说明。输入更新合并，运行中更新不会丢失。刷新任务失败、取消和幂等有可查状态。
- [ ] **3. 接通独立后台进程与统一计算发布。** 使用现有 Vite/Node 能力加载 TS/server-only，不引入新包。服务启动创建受管理子进程，沿用绝对测试DB/原生Node，正常退出一并关闭；测试启动器的无关行为不变。启动恢复处理中任务，默认页和已登记筛选按版本/业务有效期补建。固定输入读取后释放读事务；短事务版本复核、结果/catalog/状态原子发布；候选过时保留最新任务，失败有限尝试且原因可见。单次变化与管理批量同一个执行函数；不是HTTP setTimeout改名。
- [ ] **4. 改首页读取与客户端状态合同。** 缺失/过期/损坏仅持久排队并202；已有正确版本直接读取。客户端有界等待处理状态、尊重取消、区分失败/处理中/空库，不把旧缓存绑定最新版本。catalog启动准备及HTTP是否仍同步遍历需明确测试与报告。原书签/筛选/期间/返回合同保留，不改布局和财务含义。
- [ ] **5. 测异常和真实跨进程闭环。** 临时 SQLite + 两进程证明写事务触发→worker计算→服务重新连接读取。覆盖中断恢复、失败限次、过期/损坏、输入变化不发布、取消批量、超过两批、嵌套读事务安全、HTTP 202重试和 AbortSignal。测试不访问业务库。
- [ ] **6. 定向验证并提交审查材料。** 用 pinned Node 跑新测试及原20项回归、tsc；保留RED/GREEN原始日志。报告实际仍全量的阶段、受测局部边界和剩余一秒风险。不提交代码，不自行写accepted或最终性能通过。

### Task 2: 把已验证的当前组结果接入唯一生产计算

**Files:** 仅上表 Task 2 文件和专属测试。报告写 `write-precompute/native-report.md`。不得改 Task 1 的 builder/worker/store/client。

**Interfaces:** 导出类型 `HomepageCurrentGroupStore` 的 get/put 与工厂 `createHomepageCurrentGroupStore(database)`；`prepareHomepageV25Source` 和 `ownHomepageFinancialSource` 的 options 新增同名 `currentGroups?`，默认禁用。工厂只保存可重建结果，不推进业务输入版本；容量上限64MiB（实际记录字节，至少可容236组的条数上限，不冒称RSS）。在输入读事务期间新结果暂存内存，计算成功释放读事务后统一短事务刷新；工厂返回端口另带 `flush(): void` / `discard(): void`，Task 1在释放读事务后调用flush；失败日志可见但不改变已算财务结果，过时候选discard。领域get/put端口不依赖这些存储生命周期方法。

- [ ] **1. 最小用例RED。** 公开 prepare/read 端口先证明买100卖40的第二次读取仍真实求值；新增缓存后应真正恢复，并深比较原路径。依据已接受MODEL/DEPENDENCIES，不重写来源资格或计算公式。
- [ ] **2. 实现内部持久结果接口。** 将第4轮的保守组依赖、原精度 Decimal、schema/implementation/policy、业务时间证书、校验、损坏/I/O回退落实为普通生产模块。领域校验靠近唯一求值循环，存储仅负责get/put/有界容量；无实验全局配置、无限观测数组、整个源文件生成副本。唯一原native计算保持单份，可抽小函数以清楚标示恢复/求值分支。两处source prepare贯通。
- [ ] **3. 补关键反例GREEN。** 下一秒同条件命中且cursor更新；成交可见前后、收盘、换日失效；修订60→80失效；B缺口时A命中但合计仍unknown；FX fresh；复杂事件/position/seed/valuation/conflict回退；行情内容/顺序变化失效；损坏、版本、I/O、容量安全回退。新进程/连接实际读取同盘JSON，不比较两个mock调用。
- [ ] **4. 验证与移交。** pinned Node 跑专属测试、原 performance/financial-source-model/series/holding-facts/native-digest 回归；保留RED/GREEN。报告存储条目/字节、真实恢复与仍计算计数，不宣称完整行或页面已缓存；不访问业务库或改旧冻结实验。

### Task 3: 独立审查、真实数据与桌面验收

**Owner:** 每项 fresh Luna 6 Max只读审查与独立重跑，root接受；报告位于 `write-precompute/`。Task 1与2交付后才统一运行全量检查/构建，防资源争抢。

- [ ] **1. 固定候选与审查。** 基线与最终逐文件内容SHA、完整diff和新文件入包，不能用HEAD..HEAD空diff。Luna分别审两项，再最终集成审；发现问题按同一原轮次/尝试记录管理，禁止突破上限。root独立执行定向和全仓适用检查；无覆盖工具则95%标NOT VERIFIED，不安装依赖伪补证。
- [ ] **2. 真实隔离数据。** 从 `.data/homepage-baseline.sqlite` 在线backup新副本，核对成交/人工修订内容逻辑摘要前后不变。真实CSV/PDF导入走独立空白库；原件摘要对账，已有导入拒绝；无法核对不猜测。旧库刷新调用相同worker入口；批量至少超过两批、失败/取消/恢复可查。
- [ ] **3. 原性能门槛。** 从真实写入提交即计时；预热后冷/热、服务重启首读、写后首读和交易库往返分别测量，目标完整页≤1000ms，至少20样本/组；任一样本超标组FAIL。未完整/工具缺失保留NOT VERIFIED，不拿API200、202或缓存命中替代页面。
- [ ] **4. 桌面实际操作及独立视觉。** root真实浏览器1440/1280：加载/失败/重试/取消、范围账户筛选/期间、持仓搜索分页、首页→交易库→返回→刷新、真实导入保存返回重读。未实现者直接比较批准home/account/filter/library-return等对应SVG，版本/状态匹配；局部范围不宣称全控件100%。服务保持运行给预览URL与启动命令。
- [ ] **5. 记录并停止或接受。** 更新原02、README、DESIGN-COVERAGE、FINAL-ACCEPTANCE及本计划ledger。最终候选计5/5；任一必需失败或未验则原问题暂停，保存具体功能/最小样例/预期/实际/尝试/原因。不得把本轮新接线的局部通过改写为首页或交易库已达标。
