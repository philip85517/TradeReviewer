# 完整练习实际保存、重读与等价打开

ID: TL20-I10-PERSIST
State: open
Status: acceptance-failed
Assignee: practice_persistence_data_sol + practice_persistence_ui_sol
集成负责人: root
Owner role: DATA / INTEGRATOR
Priority: P0

## Scope / What to build

现有真实 File 入口 → 单一文件名日期及完整原行校验 → 确认 → SQLite 单事务保存独立练习 → GET 读取同一 practiceId 的全部原行与三时间 → 返回 → reload 重开；格式等价重导打开原对象且没有任何新增。先接受这条真实用户旅程，再扩充最终模拟盘列表、配对与复盘。不得只交付未被页面消费的 repository 或 helper。

缺少费用、结束估值或本金不阻止完整练习保存，相应指标保持未知；不显示虚构 0 值或 0 条成交。逐原行存在无法解释的类型或无效必需价格/数量时，整份拒绝、定位所有问题，不导有效子集。重复 occurrence、未配对/残余来源均保留。内容变化在更新/新建合同接受前只读阻塞，不自动覆盖或新增。

## Refs

- [业务规范](../../../docs/design-system/trading-library-design-spec.md) D7–79：完整来源、单练习、等价重导、日期、未知输入。
- [V2.0 原稿](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md) V116–159、315、328、364–369；日期/单账户标的按用户后续确认覆盖。
- [模拟练习身份与层级参考](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-sim-ab.svg)、[详情参考](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-rounds-a.svg)；本票最小原行读取入口不冒充最终画板还原。
- [Task30 候选合同](30-practice-persistence-contract.md)、[root 合同解释审查](../evidence/dispatch/practice-persistence-root-review.md)、[完整导入主票](10-import-practice.md)、[视觉合同](../visual-contract.md)。
- 当前项目 workflow、task-decomposition、frontend-control-audit、ui-task-templates；归档副本不替代现行规则。

## Blocked by

- [冻结独立练习保存与重读的技术接口](30-practice-persistence-contract.md)
- [预览元数据暂存和正常 CSV 选择](29-preview-metadata-safety.md)

## 验收标准与反例

- [x] 一个有效完整 4 行文件（含重复和未配对）经真实入口保存、GET、返回、reload 仍同一 ID 和全部原行；不能用旧 parser 的 2 条接受结果代替 4 条来源。 证据：[实际首旅程](../evidence/I10-practice-persistence/root/r1-06-first-journey-check.json)。
- [ ] 日期/历史/scope/必需字段问题定位全部原行；取消、preview、失败均不写业务表、不占号；新标的 preview 取消不发布 metadata。
- [x] 完整内容等价（格式/列序/行序变化）打开原身份，全部表计数/逻辑摘要不变；重复次数或未配对内容变化不判等；更新未决定时原数据/作品不变。 证据：[等价/只读变化边界](../evidence/I10-practice-persistence/root/final-25-db-boundary-check.json)。
- [x] 同事务保存 byte/不可变 revision、全部 occurrence、practice/date/seq history、import history、receipt；五阶段失败均回滚，双连接竞态只产生一份，响应丢失同命令重试幂等。 证据：[独立DATA审查](../evidence/I10-practice-persistence/data-reviewer/ACCEPTANCE-REPORT.md)及[root真实故障/并发核对](../evidence/I10-practice-persistence/root/final-34-second-client-check.json)。
- [ ] GET list/detail 由现有真实容器消费；URL 持有准确 practiceId；不存在的 ID 显示可恢复错误，不跳首对象。所有错误保留原文件以重试。
- [x] 旧 migrations 字节与 checksum 不变；只新增空结构；旧 executions/reviews/Recall 逻辑摘要不变，不根据文件名或 run 自动迁移旧成果。 证据：[最终全表与归档核验](../evidence/I10-practice-persistence/root/final-43-evidence-check.json)。
- [ ] 自动化、真实持久化往返、同态视觉分别验收；局部受影响控件/选项/动态行按规范登记并实际操作。独立非实现者看渲染与参考，不以 DOM 或 HTTP 成功替代。

## 派发说明

已实际派发 `practice_persistence_data_sol` 与 `practice_persistence_ui_sol`，均为 gpt-6.1-sol / ultra，fork none。具体 DTO 和不重叠白名单以 [DATA 合同](../evidence/dispatch/practice-persistence-data-requirements.md)、[UI 合同](../evidence/dispatch/practice-persistence-ui-requirements.md)为准。每位由新且不同的专属 gpt-5.6-luna / max 审查，root 统一整页视觉和完整持久化流协调；首条真实旅程未经 root 接受不得扩充依赖状态。

UI 审计触发：状态与数据接线开发后；局部范围为文件选择、证券确认、完整练习预览确认/取消、错误重试、等价打开、真实来源读取、返回和 URL/reload。对照 1440×1000、1280×800、现有 760px 断点两侧及 390×844，缩放 100%，DPR 记录实际。沿用现有对话框和容器，不新增双栏或独立业务实体。

本票不修改真实回放/人的动作识别、估值来源、正式 E 页完整几何或旧库归属；它们保留主票必需门。禁止业务库写入、Git 推送/合并/发布及自行再派代理。

## 验收证据

2026-10-27 范围纠偏：用户要求将内部资料/harness 检查与产品功能分开，`ROOT-AUDIT-002` 不再作为本票的产品验收或关闭条件，其 STOPPED 5/5 原记录保留。以下历史中“归档门阻止关闭”已被纠正；本票仍因上方未完成的真实产品验收项保持 open / acceptance-failed。

2026-10-27 当前：**NOT ACCEPTED**，见[root阶段验收](../evidence/I10-practice-persistence/root/acceptance.md)。DATA专属Luna规格/质量PASS；UI原FAIL保留，Task32布局round1已修并独立20图通过。root638/638、tsc、最终build通过，lint基线失败保留。4份实际合成练习、原命令失败重试返回/reload、读取恢复与第二客户端先保存后等价同ID已验证；[53表最终核对](../evidence/I10-practice-persistence/root/final-43-evidence-check.json)PASS。局部57登记44PASS/13NV；ROOT-AUDIT-002第5轮STOP。必需未验证及归档门阻止关闭，不扩充依赖真实主图/未决业务契约的实现。

以下记录为历史，不再代表当前“待构建/三份/审查中”状态。

2026-10-27 冻结最终检查：[root 638项集成回归、53表边界/原字节与DATA独立正式接受检查点](../evidence/I10-practice-persistence/root/final-progress-checkpoint.md)。DATA 专属 Luna SPEC/QUALITY 双PASS、finding0；UI 专属不同 Luna 正在独立五视口验收，root生产模式读取恢复/最终构建/控件视觉仍待。本票保持open，不以局部通过关闭。

2026-10-27 首旅程局部PASS：[root第1轮真实链路/全表/bytes检查](../evidence/I10-practice-persistence/root/r1-06-first-journey-check.json)。初次发现旧reviews启动自动保存时间改写，原FAIL保留；UI第1轮修复后home/preview53表无写，真实保存→返回→同IDreload后46既有表含时间字段和Recall草稿/正式副本不变。四完整原行/1187bytes保留，新七表各1。DATA冻结205/205及tsc/lint0，独立专属DATA Luna正式验收中；UI边界开发中，后续独立不同UI Luna与root真实边界/视觉尚待，不能关闭本票。

后续边界、整票功能、SQLite/API完整验收、完整控件和独立视觉仍 NOT VERIFIED；不是完整 I10 或 V2.0 完成。

## 历史

- 2026-10-27 root 建立后续真实纵切；前置候选待接受，未派发产品实现。

2026-10-28 前置 Task29/30 已按有限范围由专属 Luna 与 root 接受，派发[DATA](../evidence/dispatch/practice-persistence-data-requirements.md)和[UI](../evidence/dispatch/practice-persistence-ui-requirements.md)。两位实际 gpt-6.1-sol / ultra，无重叠文件；每位将有不同专属 gpt-5.6-luna / max。root先实际接受最小真实首屏，再扩边界。F-01字段诊断是生产必需门，全部产品检查仍 NOT VERIFIED。

2026-10-28 新增回归，保持 open / acceptance-failed：组件故障注入显示 File.arrayBuffer 首次失败时原文件与重试入口丢失；scope 冲突与错误源行并存时真实预览 API 仅返回冲突，隐藏可定位行错误。前者由 practice_ui_diagnosis 基于现有错误态与完整文件保留合同实施局部修复，root 统筹、独立非实现者复核；触屏和窄屏依用户要求本轮排除。后者需要统一 scope 阻断、逐行诊断、严格客户端合同及显示，尚未修复。自动化、真实桌面操作、隔离数据和独立视觉分别 NOT VERIFIED，旧验收证据保留。

2026-10-28 更新：scope 冲突并存原行错误的后端诊断已修复并通过独立定向审查，真实浏览器仍 NOT VERIFIED。读取失败重试的首版独立验收 FAIL，发现通用 CSV 在解析器二次读取失败及解析器挂起时仍有恢复缺口，现第 2 轮修复中；旧结果和反例保留在主票 10。

2026-10-28 读取重试第 2 轮独立组件验收 PASS：此前二次读取失败保留文件重试，挂起取消后迟到的成功和失败不覆盖新预览；独立反例 3/3、导入组件回归 79/79。证据 `../evidence/I10-practice-persistence/independent-retry-review/round2-reproduction.test.tsx`。真实浏览器交互、同态视觉、隔离数据库实际往返仍 NOT VERIFIED，不能据此接受整票。

2026-10-28 协调者重新以桌面浏览器及隔离数据库验证合成文件的正常入口：选择文件、预览 4 条、保存、刷新、返回列表并以相同 practiceId 重开，4 条原记录保留。版本及截图见 [本轮记录](../evidence/I10-practice-persistence/root/isolated-import-reopen-20261028.md)。此结果仅覆盖正常路径；失败注入的真实浏览器验证、完整控件覆盖及独立同态视觉仍 NOT VERIFIED。触屏和窄屏按用户要求排除。

2026-10-28 协调者真实浏览器发现未接通链路：隔离库中已保存可重开的 4 行合成练习，从数据页面进入交易库并将性质选为模拟盘，页面仍显示“还没有导入交易”。截图见 [模拟盘列表](../evidence/I10-practice-persistence/root/simulation-library-empty-20261028.png)。这只证明当前样本及状态未显示，完整 V2 模拟列表接线由 I14 承接；不得以数据页面内的保存与重开宣称交易库已接通。
