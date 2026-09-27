# R4 准备报告：通用人工标签、评价指标与冻结导出

日期：2026-09-26  
准备模型：`gpt-5.6-luna / max`  
状态：只读准备，全部 `unverified`；R1 可见回放门槛仍未解除。

本轮已读：

- `repair/R2-R4-INTERFACES.md`、`repair/issues/R4-evaluation.md`、`repair/reports/R4-astra-acceptance-preparation.md`；
- `docs/specs/2026-09-25-chart-first-review-ui-elements.md` §5/§6；主规格 §5/§6；
- `repair/DESIGN-COVERAGE.md`、`reports/iteration-root-cause.md`、`reports/design-conformance-review.md`；
- 设计原图 D02 `02-chart-workspace.png`、D04 `04-holding-stage.png`、D05 `05-final-review.png`。

未修改产品、数据库和测试，未运行测试或浏览器，未派代理，也未解除 R1 门槛。下面的类型名是 R4 解锁后的最小接口建议，不是本轮实现结果。

## 设计边界与当前缺口

D02 把计划与主图同屏，D04 只呈现已揭示的持仓事实，D05 在紧凑的原计划/实际摘要之后直接进入逐次退出评价。对应元素是 E13、E15–E18，用户故事是 US20–28；US37–39 还要求结构化查询、缺失/币种口径和实盘/模拟隔离。§6 要求服务端 SQLite 仍是权威，草稿、正式版、查询投影和留存组合原子一致，导出只读冻结版本。

源码复核确认：

1. `app/lib/recall/exit-evaluations.ts:7-61,93-209` 已有 `RecallExitEvaluationDraft/Version`、`RecallEvaluationEvidence`、`RecallEvaluationTag`、双游标和 `hasSeenFuture`。但 `validateRecallExitEvaluations` 与 `getRecallExitDecisions` 的模型是退出专属；标签只能挂在有实际 closing decision 的评价上。
2. `app/components/recall/recall-exit-evaluations.tsx:88-106` 的选项目前是日期、动作和数量，缺少减仓/清仓语义与均价；它也没有价格。D05/E16 要求日期＋动作＋数量＋真实均价，未知值要明确显示。
3. `app/components/recall/recall-actual-metrics.tsx:31-58` 在 `holding` 显示 `realizedNet/unrealizedGross`，在 `post-review` 固定显示 `netPnl/actualR`。部分退出仍未平仓时，后者必须继续显示已实现净额与浮动毛额，并让最终净额/R 保持 `null` 和 `episode-open`。
4. `app/lib/recall/retained-bundles.ts:59-125` 已冻结计划、风险基准、退出评价 revision、成交证据和 capture context；`RecallRetainedBundle` 当前只有 `evaluationRevisionIds`，没有独立通用标签 revision 集。
5. `app/lib/recall/server-repository.ts:121-189` 已在 `withSqliteTransaction` 内做 CAS、文档校验、冻结校验、actual metrics 留存和 draft/formal 投影。`app/lib/recall/evaluation-projections.ts`、`metric-projections.ts` 是可重建投影，不应成为第二权威。
6. `db/sqlite-schema.ts:190-389` 现有迁移为 7–12，已覆盖 Recall 文档、计划/留存、退出评价、选择和冻结指标。后续只能追加迁移，不能修改既有 SQL 或 checksum；`db/sqlite.ts:42-85` 会对已应用版本校验 checksum。
7. `app/lib/recall-export/pptx-manifest.ts:58-114,117-150` 从 bundle 的冻结计划、评价和指标生成可编辑总结；`app/lib/recall-export/pptx.ts:52-63,93-104` 写入 provenance 和表格。普通 PNG/Markdown 清单 `app/lib/recall-export/manifest.ts:494-600` 当前只包含快照与 Text，若 R4 要求 Markdown 同样显示标签，需要和该导出边界另行确认，不能默认为当前草稿来源。

## 最小 optional 通用标签领域

不要把 `RecallExitEvaluationDraft` 扩成“无退出评价”。退出评价的关联校验、逐次退出数量和历史版本不应被改写。建议在 `app/lib/recall/types.ts` 增加可选的 `RecallManualEvaluationState`，并由 `document.ts` 统一验证。最小记录可按现有退出评价的版本模式定义为：

```ts
type RecallManualEvaluationTarget =
  | { scope: "episode"; decisionId: null }
  | { scope: "decision"; decisionId: string };

type RecallManualEvaluationDraft = {
  id: string;
  evaluationId: string;
  target: RecallManualEvaluationTarget;
  tags: ("position" | "entry" | "analysis")[];
  tagDictionaryVersion: "manual-v1";
  evidence: RecallEvaluationEvidence[];
  source: "manual-retrospective";
  recordedBy: "user";
  recordedPhase: "post-review";
  recordedAt: string;
  knowledgeCutoff: { cursor: string; executionCursor: string };
  hasSeenFuture: boolean;
};

type RecallManualEvaluationVersion = RecallManualEvaluationDraft & {
  retainedAt: string;
  executionIds: string[];
};

type RecallManualEvaluationAssociation = {
  evaluationId: string;
  decisionId: string | null;
  executionIds?: string[];
  status: "linked" | "needs-confirmation";
};

type RecallManualEvaluationState = {
  drafts: RecallManualEvaluationDraft[];
  versions: RecallManualEvaluationVersion[];
  associations: RecallManualEvaluationAssociation[];
};
```

领域约束：

- `RecallDocument.manualEvaluations?`、`RecallRetainedBundle.manualEvaluationRevisionIds?` 都是 optional。旧文档没有该字段时保持缺失；不得自动填 `[]`、`false`、`0` 来冒充“没有标签”。
- `scope: "episode"` 表示回合层；`scope: "decision"` 表示已有稳定 `decisionId` 的建仓/决策层。它们分别满足“回合或建仓”的无退出场景。不能用退出数量、数组位置或新造的 execution/order/earlyExit 代替目标。
- 标签只表示用户的人工归因，当前无退出场景只暴露仓位、入场、判断三类；退出标签仍由旧 `RecallExitEvaluation*` 管理。不能依据盈亏自动选择标签。
- 标签、目标和证据必须有稳定身份；Text 证据沿用 `drawingId + textRevision + ownerId`，快照证据沿用 `snapshotId`。证据暂时缺失时保留原指针并报告原因，不静默删除。
- `target.decisionId` 必须存在且属于当前文档；跨回合/错误证据、重复 tag、未知 dictionary/version、时间戳或双截止非法时，在请求层拒绝。决策拆分/合并时按 captured `executionIds` 重关联，不能按数组索引覆盖；不能确认时设为 `needs-confirmation` 并保留原版。
- `recordedPhase`、`knowledgeCutoff`、`hasSeenFuture` 只描述人工记录当时的观察边界。R4 不创建新的回放游标，也不改变 R1 的 phase/dual-cursor owner。
- `versions` 是不可变的正式评价版本，`drafts` 可继续编辑；formal 版本和 bundle 只引用已冻结 revision。修改草稿不改旧 revision。

数据库投影建议沿用已有 `version_kind/document_revision` 分区，在追加迁移（候选 version 13）中增加独立表，不改 7–12：

- `recall_manual_evaluations`：目标 scope/current decision、状态、词典、来源、记录时间、双截止、`has_seen_future`、`retained_at`；
- `recall_manual_evaluation_tags`：一个 revision 的 tag id 及 dictionary version；
- `recall_manual_evaluation_evidence`：有序 Text/快照指针；
- `recall_manual_evaluation_associations`：decision/execution boundary 与 `linked/needs-confirmation`；
- `recall_bundle_manual_evaluations`：bundle 到 immutable manual revision 的引用。

这些表只由 JSON 文档重建，不能独立编辑。若实现选择将上述 state 与现有 `recall_evaluation_*` 合并，必须仍保留 `scope`、独立 target、无退出合法性和冻结 revision；不能让已有退出表的 closing-decision foreign-key 约束吞掉无退出记录。

## 原保存、投影、冻结和导出改动

### 文档与保存

1. `app/lib/recall/types.ts`：声明上述 optional state、bundle revision refs 和只读 projection 类型；由 `app/lib/recall/index.ts` 导出公共类型。
2. `app/lib/recall/document.ts`：在 `validateBaseDocument` 中验证 optional state；增加 upsert/选择当前 manual revision 的纯函数；把 merge/split/reconcile 的 target association 改为稳定 execution boundary 重算，歧义转待确认；completion 需要处理待确认关联，但不能要求无退出必须存在退出评价。
3. `app/lib/recall/exit-evaluations.ts`：只修正退出事实展示/退出评价所需的数据读取与 immutability 边界，保留已有 `earlyExit`、`adherence`、reason 和历史 lineage。不要把 generic target 合并进旧退出评价的 `decisionId` 必填语义。
4. `app/lib/recall/server-repository.ts`：沿用当前 `expectedRevision` CAS 和单一 `withSqliteTransaction`。一次成功保存必须同时写 `draft_json`/formal JSON、重建 manual/evaluation/metric/plan projections；冲突或任意投影失败全部回滚，保留客户端本地草稿。API 的 request envelope 目前已能传整个 `RecallDocument`，除非契约变化，不需要另造 route。
5. `app/api/storage/recall/route.ts`：当前只负责 parse `document/expectedRevision/finalize` 和错误映射；只有新增请求字段超出文档 JSON 时才改，默认保持 route 冻结并用 route test 验证旧 envelope 兼容。

### 查询投影与迁移

- `app/lib/recall/evaluation-projections.ts` 继续负责退出评价及其 evidence/tag；通用标签应有独立 rebuild 函数/表，或者明确兼容扩展。每次 draft/formal partition rebuild 都要可读回并与文档相等。
- `app/lib/recall/metric-projections.ts` 和 `metric-retention.ts` 继续只处理冻结 actual-v1 指标。指标 projection 不能从最新交易、最新 plan 或最新 tag draft 回填旧 bundle；它仍要保留 `legacy-absent`、missing reason、evidence digest 和 method version。
- `app/lib/recall/plan-projections.ts` 不应接受 manual tag 直接写入；它只投影计划、风险基准、bundle 计划/基准引用。
- `db/sqlite-schema.ts` 只追加 migration，旧 schema/checksum 保持不变；用显式隔离 SQLite 验证旧库升级、重复启动幂等、原成交行数/内容摘要不变。`db/sqlite.ts` 的 checksum 检查不可绕过。

### 留存与冻结

- `app/lib/recall/retained-bundles.ts` 的 `freezeRecallSnapshotBundle` 在同一个 bundle 中捕获当前、且在 snapshot 双截止内可知的 manual revisions；`sourceBundleId` 替换沿用旧 revision IDs，`sourceBundleId: null` 明确表示不带旧评价/标签。没有符合 cutoff 的标签时写明确缺失/空历史语义，而不是从当前草稿补造。
- `confirmRecallRetainedState`、`validateRecallRetainedState` 和 exit/plan immutability 检查必须同时覆盖 manual revisions、bundle refs、snapshot binding 与 execution evidence。接受 bundle A 后，草稿 B 的保存只能形成新 revision；A 的图、成交证据、指标、评价和标签都保持不变。
- `app/lib/recall/metric-retention.ts` 继续在 CAS 锁内只为新 bundle 计算 metrics。未平仓 bundle 的 `realizedGross/realizedNet/unrealizedGross`、`netPnl/actualR` 缺失原因需分别保留；标签冻结不能改变指标分母。

### 导出

- `app/lib/recall-export/pptx-manifest.ts` 的 `summaryRows`/`details` 只读取选定 bundle 的 `manualEvaluationRevisionIds` 及 corresponding immutable versions，输出可读标签、target scope、Text/快照指针和缺失说明；不得从 `document.manualEvaluations.drafts` 填补旧 bundle。
- `app/lib/recall-export/pptx.ts` 的 provenance notes 应带 manual revision refs、dictionary version、capture/document revision；不减少现有表格字号来塞长标签，需按现有分页规则附页。
- `app/lib/recall-export/manifest.ts`/`types.ts` 的 PNG/Markdown 导出目前没有结构化评价字段。若 R4 验收要求普通 Markdown 也导出 manual tags，必须显式扩展 manifest contract 并补其直接 tests；若仍由 R5 负责，则 R4 只交 `pptx-manifest.ts`/`pptx.ts` 接口，不从草稿偷偷添加 Markdown 内容。两条路径都必须兼容旧文档和旧 PPTX。

## R3 接入的 UI props

现有退出组件的接口在 `app/components/recall/recall-exit-evaluations.tsx:14-26`：

```ts
{
  document: RecallEvaluationDocument;
  episode: TradeEpisode;
  phase: RecallPhase;
  knowledgeCutoff: { cursor: string; executionCursor: string };
  hasSeenFuture: boolean;
  onChangeDocument: (document: RecallEvaluationDocument) => void;
  onValidityChange?: (valid: boolean) => void;
  onValidationChange?: (error: string | null) => void;
  readOnly?: boolean;
  evaluationRevisionIds?: string[];
}
```

新增 generic manual evaluation 组件应保持同一边界，建议 props 为：

```ts
type RecallManualEvaluationsProps = {
  document: RecallEvaluationDocument;
  episode: TradeEpisode;
  phase: RecallPhase;
  target: RecallManualEvaluationTarget;
  knowledgeCutoff: { cursor: string; executionCursor: string };
  hasSeenFuture: boolean;
  onChangeDocument: (document: RecallEvaluationDocument) => void;
  onValidityChange?: (valid: boolean) => void;
  onValidationChange?: (error: string | null) => void;
  readOnly?: boolean;
  manualEvaluationRevisionIds?: string[];
};
```

接入规则：

- 只在 `post-review` 渲染；无退出时 `target` 可以是回合或已有建仓 decision，组件只提供仓位/入场/判断标签，不渲染退出选择，也不制造订单、退出或 `earlyExit`。
- 编辑状态写回 `onChangeDocument`；无效“其他说明”仍通过 `onValidationChange` 阻止留存但保留本地输入。父级的留存按钮必须同时读取该 callback 和退出评价 callback。
- 浏览已留存 bundle 时 `readOnly=true`，使用 bundle 的 `manualEvaluationRevisionIds`；组件不能从当前 draft/association/latest plan 反查旧快照。缺失 revision 显示缺失说明。
- `RecallActualMetricsPanel` 当前 props 是 `{ metrics, phase, retained? }`（`recall-actual-metrics.tsx:31-33`）。R3 传入同一 bundle/当前 cutoff 计算出的 metrics；未平仓 post-review 要选择包含 `realizedNet/unrealizedGross` 的视图，不能在 UI 层把 `position.netPnl` 改名为净额。
- R3 仍是 `recall-workspace.tsx`、`recall.css`、plan sidebar/revision/storyboard 的唯一 owner。R4 只交 typed component/domain props；不通过 workspace cast、不直接修改 workspace 状态或 frame CSS。

## 必须先写的 RED→GREEN 反例

以下只列有意义的定向红测，不要求当前门槛解除前执行：

| 场景 | RED 应暴露什么 | GREEN 证据与建议测试文件 |
| --- | --- | --- |
| 部分退出仍持仓，进入 post-review | 当前 panel 只给 `netPnl/actualR` | `actual-metrics.test.ts` + `recall-actual-metrics.test.tsx`：`realizedNet` 和 `unrealizedGross` 可见；`netPnl/actualR` 为 `null`，reason=`episode-open`；底栏/详情/侧栏使用同一 metric basis。 |
| 费用、成本、数量或估值缺失 | 兼容数字被显示为 0，或净额冒充已知 | `actual-metrics.test.ts`：毛盈亏可知时保留 gross；unknown fees/cost/quantity/mark 各保留缺失 reason；不跨币种、不把 missing 变成零。 |
| 6760/1.69R 基准与两次退出 | 平均退出价、费用分摊或冻结 R 被改写 | `actual-metrics.test.ts`：均价 `62.8`、净额 `6760`、实际 R `1.69`、目标净/毛 `0.563…`，完整费用只扣一次，末笔吸收舍入。 |
| 同日同 K 的 600/400 两次退出 | 选择器无法区分，或切换后 yes/no/reason 串值 | `exit-evaluations.test.ts` + component test：每项显示日期、减仓/清仓、数量、真实加权均价；价格/数量未知明确显示；切换独立恢复 `yes/no/uncertain/null` 和 reason。 |
| 仅买入、没有任何退出 | 只能创建 exit draft，或 UI/JSON 造出虚构退出 | `document.test.ts`/generic evaluation test：回合或真实 decision 可写 position/entry/analysis tag + Text/快照 evidence；`getRecallExitDecisions` 仍为空，`exitEvaluations` 不产生伪造 closing decision/earlyExit。 |
| 无原计划、做空、多次建仓/加仓 | no-plan 被当作 as-planned，或 R 用第一笔风险硬算 | `actual-metrics.test.ts`：做空方向镜像正确；无计划不造止损；没有事前覆盖全回合预算时 actual R 为 null；有固定 episode budget 且 cutoff 合法时才可算。 |
| 旧文档和缺证据历史 | 读取旧 JSON 失败，或缺失证据被丢掉/补当前证据 | `document.test.ts`/`exit-evaluations.test.ts`：optional fields 缺失仍可读；旧 evidence pointer 保留并显示 missing reason；不默认 false/0、不按 PnL 自动标签。 |
| merge/split/reimport | 标签按数组索引转给错误建仓，或静默覆盖 | `document.test.ts`/`retained-bundles.test.ts`：按 captured execution boundary 维持原 owner；无法唯一映射为 `needs-confirmation`；A bundle 的 revision 不被新 draft B 改写。 |
| 保存、重开、正式版、投影 | JSON 保存成功但 projection 半写，或 formal 被 draft 污染 | `server-repository.test.ts`、generic projection test：同一事务内 CAS+JSON+draft/formal projection 相等；触发器失败全部 rollback；stale revision 保留 local draft；formal partition 在后续 autosave 不变。 |
| migration | 修改 7–12 checksum 或重复启动重建旧数据 | `db/sqlite.test.ts`/隔离 DB：只新增 version 13；旧 schema 升级幂等，成交行数/摘要不变，原 SQL checksum 不变。 |
| bundle/export | A bundle 导出读到 B 草稿或当前 association；没有 frozen summary 却填最新数据 | `retained-bundles.test.ts` + `pptx.test.ts`：A/B 留存明确隔离；PPTX 只输出 frozen manual revisions/evidence/metrics；无 bundle 输出缺失说明，旧 PPTX/Markdown 仍可打开。 |
| 交易范围隔离 | live 与 simulation、不同 simulationRunId 的标签/指标混在一起 | `actual-metrics.test.ts`、server/repository test：account/instrument/tradeNature/simulationRunId 不匹配时拒绝或标记 scope mismatch；统计分母、样本数、缺失量和币种清楚。 |

原有定向测试可复用的入口已核对：

- `app/lib/recall/exit-evaluations.test.ts`：退出独立性、null/uncertain 分母、immutable revision、证据缺失和 merge 冲突；
- `app/lib/recall/actual-metrics.test.ts`：6760/1.69R、费用舍入、部分退出、做空、unknown fee/cost、双截止和模拟隔离；
- `app/lib/recall/retained-bundles.test.ts`：knowledge cutoff、历史 absence、source bundle 与冻结 revision；
- `app/lib/recall/evaluation-projections.test.ts`、`metric-projections.test.ts`、`server-repository.test.ts`：投影和事务回滚；
- `app/lib/recall-export/pptx.test.ts`：冻结 evaluation tags/evidence、旧 bundle、正式版和不可替代的 summary；
- UI 的 `app/components/recall/recall-exit-evaluations.test.tsx`、`recall-actual-metrics.test.tsx`：操作切换、invalid local text、read-only absence 和 missing metric。

## 文件 ownership 与启动条件

| 层 | R4 可写/负责 | 明确不可写或需交接 |
| --- | --- | --- |
| 类型/领域 | `app/lib/recall/types.ts`、`document.ts`、`exit-evaluations.ts`、`actual-metrics.ts`、`retained-bundles.ts`、`metric-retention.ts` 及其直接 tests | `recall-workspace.tsx` 的阶段/回放状态归 R3；R2 的 Text geometry/drawing/capture 归 R2。 |
| SQLite/服务端 | `app/lib/recall/server-repository.ts`、`evaluation-projections.ts`、`metric-projections.ts`、追加 `db/sqlite-schema.ts` migration，及 `server-repository.test.ts`/投影测试 | 不改既有 migration SQL/checksum；`app/api/storage/recall/route.ts` 仅在 request contract 必需时协调修改。 |
| 评价/指标 UI | `app/components/recall/recall-exit-evaluations.tsx/.css/.test.tsx`、`recall-actual-metrics.tsx/.css/.test.tsx`、必要时新增 `recall-manual-evaluations.*` | `app/components/recall/recall-workspace.tsx`、`recall.css`、plan sidebar/revision/storyboard 由 R3 唯一写入；不把标签 UI 直接塞进 R3 workspace。 |
| 导出 | `app/lib/recall-export/pptx-manifest.ts`、`pptx.ts` 及直接 PPTX tests；`manifest.ts/types.ts` 需普通 Markdown 扩展时先和 root/R5 明确 | 不从当前 draft 补历史 bundle；不改变图片、Text、窗口和旧导出兼容语义。 |
| 集成/验收 | root 负责解除 R1 后的集成、隔离 DB、真实浏览器、完整 acceptance；Astra 做独立领域/状态/视觉审查 | 本报告不解除 R1，不声称 R4 或整体设计通过。 |

解锁顺序：root 正式接受 R1 真实旅程后，R4 先以这些 red scenes 建最小领域/保存/投影测试，再实现 generic manual state 与组件，最后交给 R3 接入上述 typed props；任何组件通过都不能替代 R1、R3 的真实页面和浏览器验收。
