# 候选 3：完成性证据、合法非成交排除与旧 XLSX

冻结：2026-10-28 00:50:49 +08:00；基线 HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`。State: open；Status: implementation-ready。实现接续 owner：finish_candidate；集成和独立验收：root。此记录交付候选，不能代替功能接受。

冻结文件：[CANDIDATE-03-CANDIDATE-HASHES.json](CANDIDATE-03-CANDIDATE-HASHES.json) 固定 22 文件；[CANDIDATE-03-TASK-ONLY.diff](CANDIDATE-03-TASK-ONLY.diff) 只包含相对任务开始前 `before/` 快照的本任务增量；原始文件副本保存于 `CANDIDATE-03-files/`。[CANDIDATE-03-METADATA.json](CANDIDATE-03-METADATA.json) 记录时间与基线。最新别名 `CANDIDATE-HASHES.json` / `TASK-ONLY.diff` 已更新为本候选，候选 1/2 的独立冻结文件未覆盖。冻结后核对 22 个 SHA-256 全部一致。

## 根因与修复

- 先前把任意 exclusion 当作导入未完成，导致现金、基金等明确非成交项目存在时永远不留下强成功凭证。本候选由解析器提供稳定 `disposition` / `ruleId`，在 `import-completion.ts` 按券商、类别和版本化规则白名单认可明确排除。没有规则、未知类别、待核对行仍是 pending；不按翻译后的 label 猜测成功。
- 展示分组会合并或过滤 exclusion，聚合计数不足以证明完整性。preview 保留未分组 `completionEvidence`，HTTP intent 带到服务端；服务端核验 blocked、unresolved、原始 exclusions、报告汇总的一致性以及 retained monthly 证据。即使调用方乐观设置 complete 或清零历史汇总，未知项目仍不记强成功。
- `monthly.incompleteInstruments`、`historyIncomplete` 与局部 `evidenceScope` 各自阻止强成功；它们不再依赖乐观的成交/排除汇总。未完成文件可重新审核，新 material version/时间表达一次新的尝试。
- 完整的零成交月结只有真正保存匹配原始 monthly 的 statement material 才可记录强成功；空的 material-free 请求不会记录。已完成后同字节改名重试由强成功回执阻止。
- 旧普通 XLSX 的自动 `legacy-store-adapter-v1` history 投影会创建材料新版本，先前被误视为用户明确选择修订而绕过弱证据全重复保护。prepare 与 commit 都仅将 `intent.materials` 中明确提供、且更新已有材料的版本视为 revision 例外；自动适配不再绕过。明确来源修订仍保留原行为。
- 月结预审核提示改为“成功完整导入的同一文件会在确认前阻止重复导入；未完成的项目仍可重试”，消除旧“重新导入会更新”与新契约的冲突。沿用现有布局、样式和操作顺序。

恢复后新增修改仅为 `exact-file-import.test.ts` 旧 XLSX fixture 补必填 `duplicateTradeCount`，并将输入类型收窄到 import variant，解决 TYPECHECK-05 的两个错误；没有借类型修复改变生产逻辑。

## TDD 与验证

既有原始日志全部保留。RED-06 中合法排除 fixture 自身含 monthly 缺口，修正 fixture 后 RED-06b 明确观察到六项预期失败；RED-07 又证明清零展示计数后未知 exclusion 会被错误记成成功。GREEN-07 的两项 monthly 重试失败来自重复使用固定 material version 的 fixture，当前测试使用新的 versionId/时间重试；GREEN-08 只有运行头且中断，**不能视作通过**。

恢复验证均使用固定 Node 26.0.0（`./scripts/native-node.sh`），SQLite 测试使用 mkdtemp 隔离库。没有业务库写入、提交、推送或财务/Bars 改动。

| 证据 | 完整命令 | 结果 |
| --- | --- | --- |
| [RESUME-03-BASELINE.log](RESUME-03-BASELINE.log) | `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/api/storage/trades/exact-file-import.test.ts app/components/import/monthly-statement-review.test.tsx` | 2 文件，20 pass，exit 0；恢复时先验证现有候选 |
| [GREEN-09.log](GREEN-09.log) | `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/api/storage/trades/exact-file-import.test.ts app/api/storage/trades/conditional-inputs.test.ts app/api/storage/trades/protocol.test.ts app/lib/import/dispatcher.test.ts app/components/import/import-confirm-dialog.test.tsx app/components/import/trade-import-plan.test.tsx app/components/import/monthly-statement-review.test.tsx app/lib/storage/trade-change-response.test.ts app/lib/storage/import-duplicate-summary.test.ts` | 9 文件，74 pass，exit 0 |
| [PARSER-REGRESSION-03.log](PARSER-REGRESSION-03.log) | `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/lib/import/futu.test.ts app/lib/import/futu-pdf.test.ts app/lib/import/tiger.test.ts app/lib/import/china-merchants.test.ts app/lib/import/china-merchants-corpus.test.ts app/lib/import/china-merchants-columns.test.ts app/lib/import/china-merchants-s3a.test.ts app/lib/import/monthly-corpus.test.ts app/lib/import/monthly-reimport.test.ts app/lib/import/enrich-import.test.ts app/lib/import/import-preview.test.ts app/lib/storage/source-materials.test.ts app/lib/storage/source-material-account-correction.test.ts` | 11 文件 pass、2 skipped；257 pass、2 skipped；exit 0 |
| [UI-GREEN-03.log](UI-GREEN-03.log) | `./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/trade-review-workspace.import-flow.test.tsx -t 'successful original\|first TV evidence\|ordinary .*prepare unknown\|date-only\|account\|literal\|precision\|privacy'`（实际 shell 参数中 `\|` 为无反斜杠的 `|`） | 5 pass、42 skipped，exit 0；不是整个组件套件通过 |
| [TYPECHECK-06.log](TYPECHECK-06.log) | `./scripts/native-node.sh node_modules/typescript/bin/tsc --noEmit` | exit 0，空输出 |

只读协作审查 `completion_review` 未参与修改、未写数据库，核对规则白名单、blocked 经 enrichment 传递、服务端原始完成性证据、prepare/commit 的显式 revision 条件，未发现已证实需阻止冻结的缺陷。这是局部审查，不是独立功能/浏览器/视觉接受。

## 未完成项与边界

- 本候选真实浏览器上传→保存→返回→reload、月结警告同态视觉、1440×900 / 1280×800 和受影响控件最终覆盖：**NOT VERIFIED**，root 负责。root 报告当前本地 URL 浏览器访问遭安全策略拒绝；不能用组件测试代替这些门槛。
- screenshot 整组、补录整份来源、多文件真实队列、历史真实文件实际上传：保留候选 1/2 的 **NOT VERIFIED**。本候选没有扩大为所有导入入口已完成。
- 全仓测试/构建未在实现代理中运行，按项目“协调者集中运行全量”要求交 root 执行。旧名称刷新三项历史 FAIL 及原 issue 15/16 的五轮记录未改写；不能以本轮定向全绿掩盖。
- 95% 分支覆盖率没有新证据，不由通过测试数推导。物理触控、模拟触控和完整键盘路径未验证。
- 合法排除仅认可表内 parser rule；其他缺少稳定规则的排除仍保守保留重试，不冒称完整成功。

本轮为用户新授权后的候选 3，不重置候选 1/2 的独立失败历史。若后续发现本范围反例，应保留此冻结，继续记录候选/验收轮次；最多五轮约束不变。
