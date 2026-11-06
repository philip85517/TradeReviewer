# 相同文件导入拦截：实现候选与冻结记录

冻结时间：2026-10-28 00:21（Asia/Shanghai）。实现 owner：exact_file_implementation；独立验收 owner：root。本报告只交付候选，**不是整体验收通过**。实现文件已冻结；[TASK-ONLY.diff](TASK-ONLY.diff) 基于本任务开始前的 `before/` 快照，避免将工作区原有大量未提交改动计为本任务；[CANDIDATE-HASHES.json](CANDIDATE-HASHES.json) 固定 14 个变更文件。

原 issue 15/16 的 5/5 失败记录保持原状；本次按照用户新授权恢复同文件问题，未改写历史结论。没有 commit、push、真实业务数据库写入，未修改财务/Bars。

## 根因与成功证据

1. 原 `fingerprintBytes` 是 16 位十六进制旧 hash，用于来源/成交身份；不能证明原字节完全相同。普通旧 `legacy-store-adapter-v1` 来源版本还将 `fileFingerprint` 写成 null；只查来源材料会漏普通富途 XLSX。材料存在也不能证明整份导入成功。
2. 原确认 UI 允许独立保存材料；重复成交审核、材料版本、文件整体成功是不同事实。仅把“有材料”或“成交全重复”视作成功会阻止取消、失败、未解析及用户拒绝候选后的重试。
3. 新普通文件入口在本地读取原字节后用 Web Crypto SHA-256 + byteLength 计算独立 `fileContent`；旧弱 hash 和成交 ID 算法不改。身份从 dispatcher → enrich → preview → import intent 保留。
4. 只有成功提交事务返回的 receipt.result.importedFile 才记录完整成功证据。候选必须非空、没有未解析/排除项目；用户选择保留旧冲突或保持撤回时不记完整成功。服务端还读取 importHistory 及 material.historyProjection 的未完成计数，不能只相信客户端 complete。凭据跟成交/材料、回执、已消费计划同事务提交；事务失败不留下成功记录。
5. prepare 在一致快照查成功回执，commit 在原 begin immediate 写事务内再次查。原 requestId 回执恢复、已消费 plan 别名回放由既有 engine 先返回，优先于新增拦截。这样不破坏网络回执丢失重试；也覆盖不推进 bookVersion 的零成交变化并发计划。

## 新行为和兼容边界

- 已有可信成功原字节身份：返回 FILE_ALREADY_IMPORTED，确认前显示“此文件已成功导入，不能重复导入。文件名变化不会改变此结果。请取消并选择其他文件。”确认禁用，取消可用；提交竞态也阻止。
- 没有强证据的历史文件：**不声称字节完全相同，也不声称曾整份成功**。仅在每笔候选与已有成交一一重复、没有新增/冲突/自动替换/恢复、双方均有同一个受认可 statement 来源的 16 位弱指纹时，返回 FILE_TRADES_ALREADY_EXIST，显示“疑似已导入；本次成交均已存在，无新增”。不依赖 import batch ID。支持富途历史 PDF f0–f4 的实际 formatRuleId 后缀及当前富途 XLSX、Tiger/CMS 月结 statement 来源；manual/verified-ipo-allotment@1 和其他 64 位来源不能进入此兼容证据。
- 旧弱指纹相同但新增或冲突、弱指纹不同、手工来源、多个文件弱指纹混合请求仍走原审核。明确选择已有材料新版本时保留来源修订例外；已有强成功原字节证据仍先阻止同文件。
- 没有新 fileImport 的兼容普通保存仍保留原逐成交对账，受认可旧 statement 全重复保护仍适用；不要求所有旧调用方升级才能保存。
- 未保存、取消、回执插入失败导致事务回滚、显式不完整、排除/未解析、拒绝部分冲突均不记强成功，允许继续审核。不同原字节及部分重叠维持原规则。

### 仍需独立验收 / 明确限制

| 入口/边界 | 候选证据 | 状态 |
| --- | --- | --- |
| 普通 TradingView CSV：原字节 → 解析 → metadata → preview → HTTP → reopen | 真实解析/API 测试；首次保存、改名阻止；组件 TV 与普通 statement 两条确认旅程 | 自动化 PASS；真实桌面浏览器与视觉 NOT VERIFIED |
| 富途 XLSX、富途 PDF、Tiger PDF、CMS PDF 指纹传递 | dispatcher 真实 workbook 与 PDF fixture 对照 Node createHash；统一 API 成功守卫 | 自动化 PASS；各格式完整真实浏览器旅程 NOT VERIFIED |
| 旧业务文件 | 公共 API 模拟实际旧 formatRuleId，逐笔全重复、重命名、不同来源、新成交、手工例外；未读写真实库 | API PASS；现有真实旧文件实际重新上传 NOT VERIFIED |
| 未完成行与排除项目 | RED-04、RED-05b 后 UI 和服务端保守判断 | 自动化 PASS；目前**任何 exclusion 都不记录强成功**，包括合法非成交排除；因此此类文件不会获得整份字节强拦截。这是保留重试的保守边界，需要 root 在最终范围中明确，不应宣称所有普通文件已覆盖 |
| 多文件 | 页面原有按文件逐份预览队列未改变；API 混合多个旧来源不误作同文件全重复 | API 反例 PASS；真实多文件队列 NOT VERIFIED |
| screenshot / 图片组 | 没有原整组 byte 成功身份，本次不制造证明；不附 fileImport | NOT VERIFIED，未实现可靠整组成功拦截 |
| 补录/范围修订入口 | 走原 revision 语义，不伪造普通完整文件成功 | NOT VERIFIED，未实现整份补录来源重复阻止 |
| 日期精度/账户脱敏 | 原计划/UI/API 回归组保留；最终组件选中相关既有公开旅程之一 | 自动化相关回归 PASS；独立视觉和真实 reload NOT VERIFIED |

不能将以上 screenshot、补录、保守 exclusions 和浏览器/视觉缺口标成整体完成。用户要求的返回导航、真实刷新后持久化、1440×900 / 1280×800 同状态视觉及受影响控件最终覆盖表由 root 独立验收补齐。

## 修改文件

生产代码（10）：

- `app/lib/import/file-fingerprint.ts`：原字节 SHA-256 身份及校验，保留旧 hash。
- `app/lib/import/dispatcher.ts`、`contracts.ts`、`enrich-import.ts`、`import-preview.ts`：普通 CSV/XLSX/PDF 身份传递。
- `app/components/import/trade-import-plan.tsx`：完整性声明；旧材料文案明确弱证据含义。
- `app/components/trade-review-workspace.tsx`：prepare/commit 重复错误提示、禁用/重新准备状态。
- `app/lib/storage/sqlite-contracts.ts`：可选文件身份、回执成功证明及两种错误码。
- `app/lib/storage/sqlite-store.ts`：成功回执查询、prepare/事务守卫、严格旧 statement 全重复兼容、完整性/用户选择条件。
- `app/lib/storage/trade-change-response.ts`：可选成功身份响应校验。

测试（4）：

- 新 `app/api/storage/trades/exact-file-import.test.ts`：9 个公开 HTTP/API、真实隔离 SQLite 旅程。
- `app/lib/import/dispatcher.test.ts`：原字节指纹与改名，以及富途 f4 fixture。
- `app/api/storage/trades/conditional-inputs.test.ts`：新同文件规则替代旧独立材料断言；不同字节独立材料及明确修订保留。
- `app/components/trade-review-workspace.import-flow.test.tsx`：新阻止确认/取消/持久读回旅程；更新被新规则替代的 TV 重导断言；既有 response.json unknown 类型收窄一处。

## TDD 与验证证据（全部保留，未覆盖旧日志）

运行环境：Node v26.0.0。数据库测试均 mkdtemp 独立 SQLite / 原有 owned SQLite workspace harness；不使用 conf/runtime.json 真实业务库。

| 阶段 | 命令/日志 | 实际结果 |
| --- | --- | --- |
| 初始 RED | `npx vitest run app/api/storage/trades/exact-file-import.test.ts`；[RED-01.log](RED-01.log) | 真失败：成功原文件重导应拒绝，实际返回计划 |
| 首次 GREEN | 同文件；[GREEN-01.log](GREEN-01.log) | 1 pass |
| 历史兼容 RED/GREEN | [RED-02.log](RED-02.log)、[GREEN-02.log](GREEN-02.log) | 真失败后修复；API+dispatcher 12 pass |
| 实际 formatRuleId RED/GREEN | [RED-03.log](RED-03.log)、[GREEN-03.log](GREEN-03.log) | 旧 f0-contract-date@1 漏检后修复；14 pass |
| 部分排除 RED/GREEN | [RED-04.log](RED-04.log)、[GREEN-04.log](GREEN-04.log) | 真失败：有 invalid-row 排除仍 complete=true；修复后 API/conditional 10 pass |
| 旧材料未解析 RED | `npx vitest run app/api/storage/trades/exact-file-import.test.ts -t 'incomplete legacy material'`；[RED-05b.log](RED-05b.log) | 真失败：FILE_TRADES_ALREADY_EXIST 阻止待补材料。先前 [RED-05.log](RED-05.log) 为 fixture historyProjection 缺必填字段，不作为生产缺陷证据 |
| 最终 GREEN | `npx vitest run app/api/storage/trades/exact-file-import.test.ts app/api/storage/trades/conditional-inputs.test.ts app/lib/import/dispatcher.test.ts app/components/import/trade-import-plan.test.tsx app/lib/storage/trade-change-response.test.ts app/api/storage/trades/protocol.test.ts app/lib/storage/import-duplicate-summary.test.ts`；[GREEN-05.log](GREEN-05.log) | **7 文件，56 tests pass，exit 0** |
| 最终 UI 组件 | `npx vitest run app/components/trade-review-workspace.import-flow.test.tsx -t 'successful original\|first TV evidence\|date-only\|account\|literal\|precision\|privacy'`；[UI-GREEN-01.log](UI-GREEN-01.log)（命令正则实际 shell 参数为无反斜杠的 `|`） | **3 pass，44 skipped，exit 0**；不是整份组件测试通过，也不是浏览器验收 |
| 最终类型 | `npx tsc --noEmit`；[TYPECHECK-03.log](TYPECHECK-03.log) | **exit 0**（空输出）；TYPECHECK-02 也 exit 0；首次 TYPECHECK-01 的测试 response.json unknown 已收窄 |

其他回归日志不删除：[REGRESSION-01.log](REGRESSION-01.log) 是 58/59 pass（旧同文件独立材料预期失败）；[REGRESSION-02.log](REGRESSION-02.log) 是 59/64 pass，5 fail。其中条件材料 fixture 未选择既有冲突和被新规则替代的 TV 重导预期已修复，并由最终 GREEN-05 / UI-GREEN-01 验证。

**仍 FAIL 的范围外既有组件测试**：名称刷新三项保持原状，没有为追求全绿修改 Bars/名称逻辑：

1. applies a refreshed canonical name to every execution and keeps it after candle failure and reload
2. merges a deferred metadata name with an overlapping import confirmation without losing either
3. keeps UI and durable executions unchanged when refreshed-name persistence fails

它们与既有[只读基线诊断](../database-b-development-2026-10-26/evidence/tdd-failure-triage-2026-10-27/READ-ONLY-TRIAGE.md)第 97–99 行 #07/#08/#09 对应；#09 的旧 mergeExecutions spy 与实际 putInstrumentName 不符，#07/#08 原因未定。本次没有重跑并宣称整份 47 项 UI 套件全绿，也没有把既有 FAIL 擦除。

## 交给 root 的审查点

- 先比对 TASK-ONLY.diff / CANDIDATE-HASHES，不能用巨大 git diff 代替本任务增量。
- 成功依据必须是原字节强身份绑定成功事务回执；prepare / commit 均拦，request/plan 恢复优先。
- 检验旧真实富途文件显示“疑似…本次成交均已存在”，不冒称原字节一致；不同字节、部分重叠和显式新版本允许原审核。
- 重点验收未解析/排除、拒绝冲突、取消/失败后的再次审核，和零 bookVersion 变化下两计划竞态。
- screenshot、补录、保守排除、多文件真实队列及浏览器视觉仍明确 NOT VERIFIED；由协调者决定后续覆盖，当前不作整体完成声明。
