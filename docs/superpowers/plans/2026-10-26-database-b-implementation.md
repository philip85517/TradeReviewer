# 数据库 B 方案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. 当前用户要求独立文件集合并行、Sol 6.1 Ultra 实现、每票独立 Luna 5.6 Max 验收。

**Goal:** 落地按成交提交、来源材料、一致读取及 SQLite 运行支撑划分的 B 方案，修复 DB01–DB04，并将导入确认接到服务器计划与持久凭据。

**Architecture:** 保留现有事实表、14次迁移与性质规则，新增迁移。正式成交和来源变更通过准备、确认、查询凭据；读取交付同版事实与有归属的诊断。旧接口迁移并禁止无保护替换，财务资格和 Bars 仍不开发。

**Tech Stack:** TypeScript、Decimal、Temporal、Node 26.0.0、SQLite 3.53.0、Vitest、现有 React/HTTP。

**Spec:** `docs/backend-design/database-module-design.candidate.md` 第1–11节；原始复现 `docs/backend-design/database-review/REVIEW.md` DB01–DB07。

## Global Constraints

- 用户2026-10-26“启动多个Sol 6.1 Ultra Agent推进开发”作为按已展示B稿实施的授权；不是批准数据库原地升级、远端发布或财务/Bars恢复。
- 实现指定 `gpt-6.1-sol` / `ultra`；每项独立验收指定 `gpt-5.6-luna` / `max`，不得实现者自验代替。
- 同一问题最多5次候选修复尝试，每轮保存根因、改动、测试、独立结论；第5次仍未解决则暂停，不通过改票名重置。旧财务/Bars暂停计数保持。
- 使用现有隔离worktree，保留工作区既有884份源码基线；不提交、推送、合并或发布。
- 不读取/修改受保护业务库。测试创建自己的内存/临时文件SQLite；写入浏览器测试必须显式隔离库。
- 不修改已执行迁移/checksum；不伪造历史指纹、行定位、费用、期初覆盖或性质。Decimal文本精度保留，数量>0、价格>=0，已知费用>=0，日期精度/未知费用合法。
- 所有正式成交/来源改变及新增影响业务版本；展示名称、设置、行情和Recall文档不计入该版本，涉及它们的提交另验依赖。
- 不新增通用账户合并、证券身份纠正或普通修订自动重绑Recall。既有TradingView专项迁移和回滚必须保留。
- 实现先用行为测试复现，再修改；共享文件按票交接，不并写。报告保存命令/结果，协调者集中执行全量检查。
- 完整首屏≤1秒未在本轮保证；财务和Bars保持暂停，不能把数据库修复当作首页全部修复。

## Review Focus

- 同账户同秒两笔与不同账户同值：Task1实际重数与重导反例。
- 零价、日期精度、未知费用及历史坏数据：Task2合法往返、非法无半写、历史只读诊断。
- 仅来源改变、插入新记录、名称刷新、重启/恢复：Task3版本边界及独立连接测试。
- 月结新版缺少旧成交、其他来源与人工修订：Task4/5必须明确处置，不能自动删除。
- 提交成功后丢响应、换请求ID重试、Recall/本金独立变化：Task5/6持久幂等与依赖保护。

## 文件与接口所有权

首批Task1、2、3文件不重叠，可以并行。每票由独立Luna在候选冻结后验收；后续票等待实际前置契约验收。不让两票同时修改Store/schema/workspace。

### Task 1: 成交身份与重数（DB01）

**Files:** 修改 `app/lib/import/execution-reconciliation.ts`；增加/修改同目录 `execution-reconciliation*.test.ts`，可新增专用 `app/lib/storage/sqlite-store.reconciliation-scope.test.ts`（不得修改Store）。
**Refs:** 设计5.1、9.3；原DB01探针。
**Interfaces:** 保留现有 `reconcileExecutions`、`applyExecutionReconciliation`、candidate/core/source helper调用签名；候选隔离账户、性质、模拟运行；sourceTradeId仅在其真正来源语义下使用，订单号不当成成交号。现有月结/日期精度/模拟排序必须兼容。
**Blocked by:** None。
- [ ] 测试跨账户相同时间/价格/数量保留两笔、同文件不同稳定行保留重数、同文件重导不增、跨文件歧义需选择、性质及模拟运行隔离；先记录RED。
- [ ] 根据已复现根因改候选分组与一对一匹配，不做全局集合去重、不更改解析器性质语义。
- [ ] 用现有reconciliation及新真实Store测试验证GREEN。报告中标出无法证明身份的输入。
- [ ] 冻结所改文件hash与相对基线diff，独立Luna规格/质量审查后协调者复验。本票不涉及UI改动。

### Task 2: 正式写入校验与证券身份（DB03/DB04）

**Files:** 唯一修改 `app/lib/storage/sqlite-store.ts`；可新增 `app/lib/storage/trade-fact-validation.ts` 与同名测试；新增 `sqlite-store.fact-invariants.test.ts`。其他Store测试只读，发现旧断言冲突向协调者报告。
**Refs:** 设计5.2、8、9.3；DB03/04探针。
**Interfaces:** 所有现有正式Store入口共用相同语义检查；建议导出 `assertTradeExecutionSemantics(execution: TradeExecution): void` 供提交模块复用。身份保护统一放在putInstrument，普通更新只能更改名称/展示元数据。保留现有公共签名，不在本票实现业务版本或prepare/commit。
**Blocked by:** None。
- [ ] 先复现同ID市场/代码/币种改写以及坏时间、非数字/非有限、负价、零/负数量、坏费用被接受；另加零价、date-only、高精度、未知费用正例。
- [ ] 提取并接入共用语义检查，保留simulation、settlement和审计检查，不转浮点，不扫描并删除历史坏数据。
- [ ] merge/migration/revision/metadata等受影响入口用真实SQLite证明拒绝后无半写，旧成交JOIN不变，名称更新仍生效；修订也允许合法零价与日期精度。
- [ ] 运行相关Store/修订/账户纠正回归并报告；冻结候选，由独立Luna审查。本票无UI修改，后续接线须单独验证。

### Task 3: 业务版本与一致读取基础

**Files:** 唯一修改 `db/sqlite-schema.ts`、按需 `db/sqlite.ts`；新增 `app/lib/storage/trade-book-version.ts`、`trade-book-version.test.ts`；修改 `homepage-source-snapshot.ts` 及其测试。不得改HTTP合同，版本字段先在新独立读取接口输出，旧receipt结构兼容。
**Refs:** 设计4.3/4.4、6业务版本、8、9.2/9.3。
**Interfaces:** 新增 `BookVersion = { databaseId: string; epoch: string; sequence: number }`；导出 `readBookVersion(database: DatabaseSync): BookVersion`、`assertBookVersion(database, expected): void`、`rotateBookEpoch(database): BookVersion`。版本持久保存，普通重启不变。确切错误类型与模块位置在报告中供Task5消费。业务变化用事务内触发器覆盖现有入口（兼容期防漏），与后续唯一提交协调并不构成第二写权威。
**Blocked by:** None。
- [ ] 内存及双连接文件库先写版本不存在/不递增/重启验证测试；覆盖新成交、修改、删除、材料JSON语义变化、身份映射变化、仅名称变化、Recall/设置/行情不变。
- [ ] 新增migration15，已发布14次迁移不变；持久DB身份/epoch/counter，业务语义改变递增，事务回滚也回滚版本。恢复入口必须能显式换epoch且不可静默认旧库。
- [ ] 首页读取先同事务复制输入，再提交，随后进行摘要/形状验证；错误不得回滚已提交/调用者事务；不访问网络。
- [ ] 验证既有迁移升级、重启与并发读取；冻结候选并独立Luna审查。不改变财务资格。

### Task 4: 来源材料沿革与范围证据

**Files:** 新增 `app/lib/storage/source-materials.ts`、`source-materials.test.ts`；在Task3交接后新增migration16；新增 `stored-trade-snapshot.ts` 及测试。Store此时只读。
**Refs:** 设计4.2/4.3、5.3、7、8。
**Interfaces:** `prepareMaterialChanges` 返回不可变变更描述，不自行事务；`projectEvidence`、`explainMaterial` 接受同一读取上下文。`readStoredTradeSnapshot(database, selection)` 返回BookVersion、事实、材料、诊断、读取范围和凭据。选择轴已知/未知分别保留；期间读取包含前序依赖，不虚构期初基准。
**Blocked by:** Task3。
- [ ] 测试历史import_batches迁移保留原JSON、缺指纹/定位明确未知、零成交材料、重复升级稳定身份；禁止按币种/首笔/文件名推定归属。
- [ ] 加最小材料、不可变版本、观察与关联表；普通写只能由协调提交的内部应用函数使用，不自行begin/commit。
- [ ] 新版缺E2输出必选处置：保留或撤回；存在其他来源/人工修订不得自动撤回，旧观察保留。读取能排除已证明无关缺口，未知轴仍保留诊断，且不批准财务金额。
- [ ] 真SQLite往返、迁移与范围测试通过后冻结；独立Luna验收。

### Task 5: 持久计划、提交凭据与唯一写事务

**Files:** 新增 `app/lib/storage/trade-changes.ts`、`trade-changes.test.ts`；修改 `sqlite-store.ts`（Task2交接后唯一owner）及按需新增migration17；修改 `sqlite-contracts.ts`。
**Refs:** 设计4.1、5、6、8、9；DB02。
**Interfaces:** `createTradeChanges(database, options?).prepare(intent): ReviewPlan`、`.commit({requestId,planId,choices}): CommitReceipt`、`.getCommit(requestId): CommitReceipt|null`。意图为导入候选/明确修订/只有材料三种；专项维护由Task6适配。服务器持久计划，默认TTL15分钟、最多10000候选、每份计划JSON最多16MiB，可显式配置且有限；超限明确拒绝。旧无版本替换明确拒绝，不能绕过新规则；只追加兼容入口也应委托同一规则。
**Blocked by:** Task1、2、3、4。
- [ ] 测试预览后修订/新增/仅关联变化拒绝；复现123.45→130→旧输入不会改回；输入校验无半写。
- [ ] 准备在短读事务复制基线，事务外匹配，持久化时复验版本；不可变计划，所有选择服务端验证。
- [ ] commit先查幂等，匹配规范摘要；同计划同选择不同请求ID回原凭据并登记别名，异选择409；消费后即使过期仍可查原结果。事实/来源/审计/业务版本/凭据同事务。
- [ ] 文件SQLite重启、两连接并发、故障注入、返回丢失及同ID恢复；TTL清理保留消费键与正式凭据。所有旧Store/脚本写入口登记归一，不能建立第二数据库权威。
- [ ] 独立Luna规格/质量验收，协调者复验。

### Task 6: TradingView专项迁移和回滚兼容

**Files:** `tradingview-account-migration-store.ts` 及专项测试；Task5交接后 `trade-changes.ts`。不得新增一般账户合并。
**Refs:** 设计8.1。
**Interfaces:** 专项prepare/commit/rollback公开语义保留，内部应用接受已有事务上下文，统一提交所有权；专用意图纳入持久计划。普通Recall保存不改变。
**Blocked by:** Task4、5。
- [ ] 先写专项操作改变新材料账户投影、原观察不变、回滚继续增版本的测试。
- [ ] 保留旧摘要、守恒、行审计、别名、Recall和本金依赖保护；额外检查独立领域并发及新关联，禁止嵌套事务。
- [ ] 历史操作保留查询及可证明回滚；不能证明时列具体阻塞，不全部停用。
- [ ] 跑完整原专项测试及新增反例，由单独Luna验收。

### Task 7: HTTP与桌面导入确认接线

**Files:** `app/api/storage/trades/`路由/测试，`sqlite-http-client.ts`及测试，`trade-review-workspace.tsx`及其导入测试；允许新增专用导入计划展示文件。首页只接一致事实读取，不改暂停财务与Bars实现。
**Refs:** 设计6、8现有调用迁移、9.1/9.3；项目当前导入视觉与控件规范。
**Interfaces:** prepare/commit/getCommit实际HTTP，typed错误；前端只传本次候选与选择，使用凭据权威刷新，不上传全库。确认失败保留本地输入，冲突重新准备；断线同requestId查证/重试。
**Blocked by:** Task5、6。
- [ ] 实施前读取frontend-control-audit及ui-task-templates，登记实际受影响桌面控件、视觉参考和状态，补齐DESIGN-COVERAGE。
- [ ] HTTP非法/冲突/忙/内部错误代码稳定，不能以异常消息前缀分类；真实路由合同测试。
- [ ] 实际客户端和页面接线；月结缺失、冲突选择明确，不暗自确认删除；提交后按至少凭据版本刷新，返回/重载一致。
- [ ] 实际隔离库桌面浏览器验证导入→预览→确认→返回→重载、失败/冲突/断线恢复及相关视觉；独立Luna验证截图与规格，协调者独立实际验收。

### Task 8: 集成回归与交付

**Files:** 仅必要集成修复（回给各owner），任务证据及文档。
**Refs:** 全设计、任务矩阵、项目开发流程。
**Interfaces:** 上述所有真实调用方，保留旧数据/审计。
**Blocked by:** Task1–7、Task9。
- [ ] 协调者集中运行类型检查、构建、全量单元与适用运行时测试，分离既有失败和新增失败。
- [ ] 独立Luna全变更审查、协调者确认每票已验收，必需项FAIL/NOT VERIFIED阻止整体完成。
- [ ] 桌面实际预览服务保持运行，交付可点击链接、启动命令和验证结果；财务/Bars/1秒完整首屏未验证继续明示。
- [ ] 同问题第5轮仍失败则停止并记录原因、已试方法、证据与影响，依赖票保持阻塞；不把暂停标为通过。

### Task 9: 恢复、克隆与运行切换

**Files:** `deploy/ops/restore-db.sh`、`scripts/debug-local.mjs` 及对应测试；必要的新离线世代轮换工具；Task3交接后的数据库初始化兼容检查。不得读写真实业务库。
**Refs:** 设计6、8；本地问题 `09-runtime-activation.md`。
**Interfaces:** 使用Task3的持久版本约定；受控恢复和测试克隆在候选库上线前换世代，普通重启不换。轮换失败阻止候选启动；恢复失败保留原有回退能力。未知未来版本拒绝启动。
**Blocked by:** Task3。
- [ ] 先用自建临时库复现恢复/克隆沿用旧身份；恢复后旧计划失效，普通重启身份稳定。
- [ ] 接入受控恢复与克隆入口，验证不改原库、路径防护及失败回退。不得用读取受保护业务库来做本任务演练。
- [ ] 记录激活必须停旧写进程、备份、迁移、校验、启动的次序；明确任意绕过入口的文件替换无法仅从库内识别的边界。
- [ ] Sol实现、独立Luna验收，协调者验证；整体交付前必须通过。
