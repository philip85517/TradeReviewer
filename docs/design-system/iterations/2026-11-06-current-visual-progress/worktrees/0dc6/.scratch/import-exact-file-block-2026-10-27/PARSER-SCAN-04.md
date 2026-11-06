# 候选 4：校验前静默丢成交扫描

扫描实施：finish_candidate；额外只读扫描：completion_review（未修改文件、未写数据库）；独立接受：root 待执行。扫描直接使用当前 parser、合成定位 fixtures、真实 enrich/preview/intent；不是按 diagnostics 数量推断丢失。RED-08/09 保留原始失败。

| 入口 | 最小反例与失败 | 本轮处理与边界 |
| --- | --- | --- |
| TradingView CSV | 完整交易对后追加坏日期单行或重复进场行；保留 2 条记录但 exclusions 空，2 路 HTTP commit 错写 importedFile | 字段校验失败和重复 role 各记 pending invalid-row；完整配对仍可导入 |
| 招商现代独立列 | POSITION_EVIDENCE 最后一笔 sell 日期改 2025-01-03；2→1，零诊断/排除，HTTP 错写 importedFile | 非空业务行交主 parser 校验坏日期；合法 cash 先按版本规则忽略，不要求交易日期 |
| 招商旧 combined 列 | S3A 的 y216 日期改 2026-03-09 深圳；真实 sell 消失。另 unknown/空 business 也静默消失。HTTP fixture 保留另一有效成交后误写 importedFile | 按列收集日期原文及未知业务；由主 parser 留 pending。非交易现金先识别，正常 red-share 证据保留 |
| Tiger PDF | SHORT_PAGES y142 的 quantity/price 均 bad，2→1，零诊断/排除；HTTP 错写 importedFile | 补带方向/身份的异常主行；日期/名称距主行14px内保留为续行，原数值行、费用和跨页关联不切断。覆盖全空数值及繁体多行坏数字 |
| Futu PDF | F1 复制第二子成交；有效版 quantity280/fillCount2，4个金额坏值版只剩140且 complete=true；HTTP 错写 importedFile | 时间/方向行有原始数值区字段时必须进数值校验；纯日期/时钟续行及费用继续单独识别 |
| Futu XLSX | 已进入行的代码、方向、时间、数字、市场异常均有 pending exclusion；识别的非证券有规则 | 本轮未发现相同静默漏成交；现有 parser 回归验证 |
| TradingView 旧兼容 parser | 坏配对已有 exclusion，CSV 结构异常阻断 | 本轮未发现同类缺陷；现有回归验证 |
| screenshot Futu/Tiger | 转换前有 review blockers；当前 screenshot 路径不附强文件成功 identity | 本轮未改，不能声称实际 screenshot UI 已验收 |

额外观察：Futu PDF `unknown-futu-fee` 仍保留交易、feeStatus=unknown 和月结 reviewRequired；原测试明确允许此状态，本轮不把所有 warning 改为阻断，也不将缺费误称为“静默漏真实成交”。此语义由 root 另行判断，未作范围外财务修改。

首次 Tiger 修复的 GREEN-11 有 7 项既有多行布局回归失败：把证券名+日期拆行误作独立 anchor。该失败保留；后续以主行优先、14px续行关联修复，GREEN-12 为 162/162 通过。不能将第一次失败日志改写为成功。


## 第4轮失败与第5轮最终候选

上述第4轮放宽规则被独立审查证伪，不能视作接受。现代单列/拆列页码被误收，日期与业务同时损坏会漏行；Tiger合计带方向被误收，空方向且时间/数值一起损坏会漏行；富途时间与数值同时损坏也会漏行。额外只读扫描确认旧招商拆分页码及新股配号下一节误收。RED-10–14 均保存。

第5轮统一按“先合法表格边界、后原始正文证据、再字段校验”处理，详见 [最终报告](CANDIDATE-05-IMPLEMENTATION.md)。GREEN-15最终6文件188通过，TYPECHECK-09 exit0。正常现金、表头、页码、合计、时钟/费用续行及受损正文分别有回归。仅代码候选冻结，root/round3_review独立接受待执行；第5轮失败后不得继续第6轮。
