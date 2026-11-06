# 相同文件导入拦截：需求和验收

用户 2026-10-27 明确决定：成功导入过的完全相同文件应在确认前识别、提示并阻止再次导入；未成功导入的文件应允许重试；保存仍需防重。此决定变更以往同文件可独立保存材料的规则，保留既有失败与记录。不同文件重叠成交维持现有审核，不改历史及财务/Bars。

原规格：[多券商导入](../../docs/superpowers/specs/2026-07-29-multi-broker-import-metadata-design.md#数值标识与去重)、[A股审核](../../docs/specs/2026-09-13-a-share-page-import-reconciliation.md)；没有专属画板及 element ID，沿用现有桌面导入弹窗布局与交互标准。范围为导入有关控件，非整页审计；参考当前导入弹窗视觉、1440×900 和 1280×800。owner：实现代理；跨文件数据流、整体验收 root；视觉独立审查由非实现者执行。

| ID/规范 | 控件/状态 | 旅程及反例 | owner | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| EXACT-1 / 用户新规则 | 文件选择、解析、审核及重复提示 | 首次成功导入同文件，再选择同内容（包括改文件名）；审核提示已导入、禁止确认，不增加交易或材料 | worker/root | 实现报告、真实浏览器 | NOT VERIFIED |
| EXACT-2 / 用户新规则 | 取消/失败、重新选择、首次导入 | 未成功保存或取消时重试可完成；新文件正常导入 | worker/root | 红绿测试、真实浏览器 | NOT VERIFIED |
| EXACT-3 / 用户新规则 | 服务端提交、重试/并发 | 不能绕过前端造成二次写入，数据库原交易不变；有明确语义的同请求重试维持安全 | worker/root | 隔离数据库/API 测试 | NOT VERIFIED |
| EXACT-4 / 原对账规范 | 不同文件、部分重叠/冲突 | 现有逐成交核对保留，不因文件名相同误拦；不静默丢弃合法新成交 | worker/root | 测试 | NOT VERIFIED |
| EXACT-5 / 前端审计 | 确认、取消、返回、刷新、加载/失败状态 | 明确反馈、状态一致、保存后 reload；桌面匹配视口视觉对照 | root + 独立审查 | 浏览器截图与记录 | NOT VERIFIED |
| EXACT-6 / 数据保护 | 数据和来源 | 写入测试只用隔离 DB；未成功证明时不得误称拦截/无写入 | root | 数据对照 | NOT VERIFIED |

阶段记录：保留 `.scratch/database-b-development-2026-10-26/issues/15-import-history-duplicate-count.md` 和 `16-import-confirm-duplicate-preview.md` 的 5/5 失败，新用户明确授权恢复本问题；不能视旧缺陷自动修复。旧日期精度、接口脱敏、类型检查和历史数据真实性问题在受影响范围内必须复核，不得扩展财务/Bars。

## 候选 3 补充范围（2026-10-28）

版本绑定：[22 文件内容哈希](CANDIDATE-03-CANDIDATE-HASHES.json)；[实现和验证命令](CANDIDATE-03-IMPLEMENTATION.md)。原上表要求继续有效；下列条目细化 EXACT-1/2/3/5，不把自动化 PASS 当作浏览器或视觉 PASS。element ID / 专属原稿均不适用：本任务修复现有导入规则与提示，没有新画板，沿用现有月结预审核和导入确认弹窗。实现/证据 owner 为 finish_candidate，跨层接线与最终独立验收 owner 为 root。

| ID / 规范依据 | 控件/阶段与用户旅程 | 反例与可观察预期 | 证据 | 当前结论 |
| --- | --- | --- | --- | --- |
| EXACT-7 / 用户成功同文件规则、EXACT-1 | 正常月结含受认可非成交项目→确认→重开→同字节改名重选 | 现金/基金等明确忽略项不阻止强成功；再次准备拒绝；label 不能代替 parser rule | GREEN-09，exact-file 测试 recognized non-trade exclusions | API/持久化 PASS；真实 UI NOT VERIFIED |
| EXACT-8 / 用户未成功可重试、EXACT-2 | monthly 缺口或未知项目→保留已能导入部分→新 material version 重试 | incompleteInstruments/historyIncomplete/evidenceScope 与未知 exclusions 不得因乐观 complete/清零聚合而记强成功 | RED-06b/07、GREEN-09 | API PASS；真实 UI NOT VERIFIED |
| EXACT-9 / 用户成功定义、EXACT-3 | 零成交完整月结→保存真实材料→重开→再次准备 | material-free 空请求不记强成功；持久化匹配完整 monthly 的 statement material 后可阻止同文件 | GREEN-09 no-trade monthly | API/持久化 PASS；真实 UI NOT VERIFIED |
| EXACT-10 / 原显式来源修订及 EXACT-4 | 历史 XLSX 全重复→自动 history adapter；明确选择已有材料修订 | 自动适配不能绕过 FILE_TRADES_ALREADY_EXIST；显式 revision 保留原审核 | GREEN-09 exact-file/conditional | API PASS；历史真实文件 UI NOT VERIFIED |
| EXACT-11 / EXACT-5 提示一致性 | 月结预审核→继续核对与导入→导入确认 | 提示说明成功同文件阻止与未完成可重试，不再承诺同文件更新 | monthly-statement-review.test.tsx、UI-GREEN-03 | 组件 PASS；同态视觉 NOT VERIFIED |

前端控件审计触发：修改月结预审核提示及完整性状态接线，局部范围包含文件选择、月结来源时区/重新解析/警告确认/继续/取消、材料选择、最终确认/取消、重复阻止和返回刷新。没有全页或 100% 审计声明。候选 3 未在浏览器实际操作，故执行覆盖不能从测试数换算；最终控件分母、几何 before/during/after 和独立视觉证据由 root 在可访问浏览器时补齐。既有候选 2 浏览器结果是历史证据，不能无条件标为本版本通过。

## 候选 4 补充范围（2026-10-28）

独立审查重开 EXACT-8：TradingView CSV 单行字段校验失败及重复进/出场行只有 diagnostics，仍保留其他配对时会错误地产生完整文件成功凭据。规格仍为用户“未成功导入的文件应允许重试”；本轮不改变已接受交易、金融计算或图表行为。实现与最小红绿回归 owner：finish_candidate；跨层验收 owner：root；其他 parser 同类静默丢行路径由独立只读代理 completion_review 扫描。

| ID / 原要求 | 范围、阶段与旅程 | 可观察预期与反例 | owner / 证据计划 | 状态 |
| --- | --- | --- | --- | --- |
| EXACT-12 / EXACT-2/8 | 一组完整 TV 配对 + 单独无效行，或完整配对 + 重复角色行；解析→补全→预览→HTTP 保存→重开重选 | 完整配对可保留；每个未处理源行明确计入 pending exclusions；不得产生 importedFile，乐观 complete=true 也不能绕过原始完成证据；同文件可重试 | finish_candidate；RED-08/GREEN-10（待生成）；root 独立复验 | unverified |
| EXACT-13 / EXACT-8 | 其他 parser 的校验失败/continue/筛选路径 | 不遗漏失败来源记录；正常页眉、非成交等受认可忽略路径与未知项目分别检查 | completion_review 只读扫描；候选 4 parser 审查记录（待生成） | unverified |

本轮没有新控件或画板；前端状态链局部受影响范围为已有文件选择、解析警告、确认、保存后重试与重复拦截提示。真实浏览器/视觉仍由 root 验收，自动化不能代替；schema 17/18 全量测试失败只定位，不改范围外代码。候选 3 冻结保留，不能更新其历史通过结果以掩盖本次缺口。


## 第5轮最终版本绑定

第4轮接受FAIL并保留 [独立记录](ACCEPTANCE-ROUND-4.md)。第5轮于01:21:42冻结，[30文件清单](CANDIDATE-05-CANDIDATE-HASHES.json) / [实施与命令](CANDIDATE-05-IMPLEMENTATION.md)。本轮无新控件或视觉设计；原参考、视口、旅程和root整体owner不变。

| ID | 最终自动化证据 | 独立接受与UI门槛 |
| --- | --- | --- |
| EXACT-12 | TV字段错误/重复role：parser保留pending，prepare/commit不记成功，重开仍可重试；GREEN-15 PASS | round3_review/root待执行；真实UI NOT VERIFIED |
| EXACT-13 | CMS新旧、Tiger、Futu真实受损正文与正常现金/分页/表头/汇总/续行分别验证；GREEN-15 PASS，188例 | 独立既有反例复验待执行；真实UI/视觉 NOT VERIFIED |

最终API测试每例自建mkdtemp隔离SQLite，未写业务库。不以自动化PASS、历史截图或Worker报告代替功能、持久化、控件和视觉的独立接受；95%分支覆盖未证明。第五轮不通过则停止，不继续第六轮。


## 第五轮最终验收状态（2026-10-28）

冻结版本 [30 文件 SHA 清单](CANDIDATE-05-CANDIDATE-HASHES.json)；结果与限制见 [第五轮验收](ACCEPTANCE-ROUND-5.md)。前述 EXACT-1、2、5 的真实桌面控件及视觉状态继续 **NOT VERIFIED**。EXACT-3、4、7–10、12–13 的部分 API/解析器/临时库反例通过，但不能推广到未测入口或用作整体验收。10 个所选相关源码文件整体分支覆盖 64.64%，未达到 95%。五轮上限已到，任务保持 open / acceptance-failed，后续用户需要先处理浏览器策略并决定未达标部分如何继续。财务与 Bars 不恢复。


## 用户确认后的测试和桌面验收（2026-10-28）

沿用 EXACT-1–13 用户旅程与既定 95% 覆盖目标，root 协调整体、受影响控件审计与视觉，三个测试代理分别负责解析、组件与 API 隔离测试，不修改共享业务库。写入只使用每个代理专属 `TRADEREVIEW_DB_PATH`。第五轮旧版本证据保留，新测试后重新绑定文件指纹。浏览器策略未解除时 EXACT-1/2/5 保持 NOT VERIFIED，不使用其他方式绕过。

结果：版本绑定 [39 文件指纹](RESUME-TEST-HASHES.json)，18 文件 412 个定向案例通过；改名重复拒绝前后及只读重开全表快照一致。完整相关文件分支 69.32%，低于 95%。EXACT-1/2/5 的真实桌面操作、返回刷新及独立视觉保持 NOT VERIFIED。具体证据与未决项见 [本次验收记录](ACCEPTANCE-RESUME-2026-10-28.md)。
