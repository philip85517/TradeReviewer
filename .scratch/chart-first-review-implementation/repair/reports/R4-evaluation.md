# R4 实施与定向验证

日期：2026-09-26；实现模型：gpt-5.6-luna / max；owner：luna_frame_contract。

本轮完成 R4 的最小回合级人工标签、实际指标与退出信息契约。`RecallDocument` 的 `manualEvaluations` 保持 optional；标签范围只有 `position`、`entry`、`analysis`，目标固定为 episode，退出评价仍沿用原有领域。人工草稿有稳定 draft/evaluation identity、`manual-v1` 结构化词典、人工来源/记录阶段、双截止与 `hasSeenFuture`，证据只能指向稳定 Text ID+revision+owner 或 snapshot。新证据缺失、跨回合目标、重复当前草稿会被拒绝；历史版本已保存但当前指针缺失时保留原引用并在只读 UI 中显示来源指针。编辑标签不会隐式把 `needs-confirmation` 关联改成 `linked`。

后续边界修正已纳入：freeze 只比较人工知识截止的市场/成交边界，不把真实录入时间与历史行情截止比较；server save 重新检查新增证据的当前可达性，允许上一份已保存文档中的旧指针在当前内容缺失时保留；重导后 episode 执行集合变化会把人工标签置为 `needs-confirmation`，只有明确“确认使用当前回合成交”才更新边界并允许新的留存；退出评价的提前退出/执行符合度改为 D05 横向 segmented radio choices。

## 实际变更

- `app/lib/recall/manual-evaluations.ts`：验证、单 episode 当前草稿、证据选择/缺失状态、冻结版本、immutability 检查；无状态旧文档冻结时继续保持字段与 bundle revision ref 缺失。
- `app/lib/recall/manual-evaluation-projections.ts`、`app/lib/recall/server-repository.ts`、`app/lib/recall/document.ts`：权威 document 验证、draft/formal 同事务投影、旧文档 optional 兼容。
- `db/sqlite-schema.ts`：只追加 migration 13 及人工评价投影表；migration 7–12 SQL 未改。schemaVersion 消费者同步为 13。
- `app/lib/recall/retained-bundles.ts`：留存 bundle 只引用冻结人工评价版本；保留来源 bundle 的 refs，旧快照不从当前草稿补造。
- `app/lib/recall/exit-evaluations.ts`、`app/components/recall/recall-exit-evaluations.tsx`：每个退出选项补充日期、减仓/清仓、数量和真实加权均价，保持同日 600/400 独立。
- `app/components/recall/recall-actual-metrics.tsx`、`.css`：未平仓保留 `realizedNet` 与 `unrealizedGross`，`netPnl`/`actualR` 继续带 `episode-open` 缺失原因；增加可选 `compact` props 与 `formatRecallActualMetricValue`，完整指标仍在 details。
- `app/components/recall/recall-manual-evaluations.tsx`、`.css`：post-review 才显示回合标签，`target`/双截止/校验回调/readOnly/bundle revision props 已固定；界面不展示实现词典版本号，历史缺失证据显示稳定来源指针；执行集合变化有明确确认按钮。
- `app/components/recall/recall-exit-evaluations.tsx`、`.css`：提前退出与执行符合度使用可键盘操作的 radio segmented choices；select/textarea 为 14px，辅助说明至少 12px，桌面控件至少 36px，粗指针或 390px 以下控件至少 44px。
- `app/lib/recall-export/pptx-manifest.ts`、`pptx.ts`：PPTX 仅读取 bundle 的冻结人工版本和证据指针，并在 provenance 中输出人工 revision refs。

## RED → GREEN / 定向证据

曾先以缺少模块、缺少冻结 refs、缺少投影行、缺少 actual/退出展示、缺少导出明细的断言得到 RED，再补实现后得到：

- `npx vitest run app/lib/recall/manual-evaluations.test.ts app/lib/recall/manual-evaluation-projections.test.ts app/lib/recall/retained-bundles.test.ts app/lib/recall/server-repository.test.ts app/components/recall/recall-manual-evaluations.test.tsx app/components/recall/recall-actual-metrics.test.tsx app/components/recall/recall-exit-evaluations.test.tsx app/lib/recall-export/pptx.test.ts`：8 files，62 tests passed。
- `npx vitest run app/lib/storage/sqlite-store.test.ts -t 'complete bootstrap'`：schemaVersion 13 passed。
- `node --test tests/local-dev-storage.test.mjs`：1 test passed；该次测试需允许本机开发端口监听。
- `npx eslint` 对本轮领域、组件、导出文件：0 errors / 0 warnings。
- `npx vitest run app/components/recall/recall-actual-metrics.test.tsx -t 'partial exit|compact'`：2 tests passed，确认 `6 USD`、`7 USD`、`尚未平仓` 以及 compact formatter。

最新共享工作区 `npx tsc --noEmit --pretty false` 已通过；本轮 R4 文件的 scoped eslint 也为 0 errors / 0 warnings。

## 待集成验收

R3 workspace 仍由唯一 owner 接入 `RecallManualEvaluations`，使用固定 props：`document`、episode 级 `target`、`phase`、`knowledgeCutoff`、`hasSeenFuture`、`onChangeDocument`、可选 `onValidityChange`/`onValidationChange`、`readOnly`、`manualEvaluationRevisionIds`。R3 自有 compact summary 应复用 `formatRecallActualMetricValue` 并在 episode-open 选择 `realizedNet`/`unrealizedGross`，保留 null reason 的中文说明；当前未进行浏览器或全量验收。R4 领域、投影、留存与导出仍需 root 的集成检查和 Astra 最终验收后关闭。
