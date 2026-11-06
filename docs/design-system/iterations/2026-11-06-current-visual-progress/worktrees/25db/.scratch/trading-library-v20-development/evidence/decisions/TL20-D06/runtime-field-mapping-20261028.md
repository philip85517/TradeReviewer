# TL20-D06：首条真实图表旅程运行时字段映射（独立只读证据）

- 核查日期：2026-10-28（Asia/Shanghai）。
- 工作树：/Users/zhoulin/.codex/worktrees/25db/TradeReview。
- 代码基线：d95afc37d30f817edbd6daab41e85f485138de0d；工作树包含其他并发任务的未提交修改，本报告只记录现状，不以工作树状态宣称冻结版本。
- 核查方式：静态代码/规范映射 + 既有 replay/Recall 单元测试；没有启动服务、没有打开业务库、没有执行浏览器旅程、没有修改产品或测试代码。

## 结论

|门槛|结论|依据|
|---|---|---|
|D06 最小身份接线|**FAIL**|真实入口和 Recall 保存仍以 episodeId 为唯一键，缺少经批准的 practiceId/revisionId/roundId/pairId 适配结果；不能证明练习、内部配对、实盘回合之间不会串接。|
|Recall 回放双截止/阶段静态骨架|**PASS（仅静态候选）**|RecallReplayCursor、RecallWorkingState、阶段上下文、快照和单元测试分别携带行情/成交截止；这不等于真实图上目标 K 线/成交已可见。|
|Text、未来信息和视口合同|**PARTIAL / NOT VERIFIED**|已有 hasSeenFuture、Text drawing 元数据和 viewport 捕获/恢复；未来暴露来源集合、Text 历史/锚点独立保存、真实 SDK 异步优先级尚未证明。|
|真实图表旅程与保存重开|**NOT VERIFIED**|未运行浏览器、隔离 SQLite、真实图表 SDK、服务器读取和 reload；静态代码、DOM 或游标变化均不能代替这道门槛。|
|D06 是否可接受|**FAIL（阻断）**|身份缺口是契约缺口，且 I12 要求的真实主图证据全部未生成。后续必须先冻结身份、事实定位/重启政策和 SDK 同帧优先级，不能靠猜测继续接线。|

## 范围、依据和排除

本次按 D06 issue 的事实映射要求，覆盖 D06 [问题与验收](../../../issues/06-replay-adapter.md#L13-L52)、I12 [首条真实图表旅程](../../../issues/12-first-chart-journey.md#L11-L84)、[REPLAY-STATE-CONTRACT](../../../REPLAY-STATE-CONTRACT.md#L1-L29)、[DESIGN-COVERAGE 回放行](../../../DESIGN-COVERAGE.md#L135-L149)，并对照 V2 原规范 [身份/配对](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md#L144-L169)、[入口与返回身份](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md#L254-L275)、[样例数值边界](../../../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md#L294-L300)，以及 [Chart-first 回放语义](../../../../../docs/specs/2026-09-25-chart-first-review-ui.md#L112-L120)。

排除项：I13/I14 后续功能、设计稿视觉独立比对、业务数据库读写、产品/测试修改、将 mock chart 或 React DOM 断言当作浏览器通过。V2 原规范中的 1900/23/4677 等只是明确假设的设计样例，不是当前练习的财务结果；本报告不把它们写入运行态，也不宣称任何实际 P&L 已通过。

## 字段映射

“静态候选”表示源码的字段和调用关系存在；“真实未证实”表示尚未在真实图表、服务端读取和 reload 中观察到合同成立。

|D06/REPLAY 字段|声明、写入者、读取者|当前结论|
|---|---|---|
|稳定身份：practice/revision/round/pair|RecallDocument 只有 episodeId、文档 revision、decisions/snapshots/working：[app/lib/recall/types.ts:105-124](../../../../../app/lib/recall/types.ts#L105)。createRecallDocument 以 episode.id 建档：[app/lib/recall/document.ts:469-500](../../../../../app/lib/recall/document.ts#L469)。真实入口将 episode 传给 RecallWorkspace：[app/components/trade-review-workspace.tsx:6303-6378](../../../../../app/components/trade-review-workspace.tsx#L6303)。TradeEpisode 也没有 practice/revision/round/pair/human-action 字段：[app/lib/trades/types.ts:181-215](../../../../../app/lib/trades/types.ts#L181)。V2 Practice/Revision 的身份虽在 [app/lib/trades/practice-contracts.ts:37-90](../../../../../app/lib/trades/practice-contracts.ts#L37) 声明，但没有进入图表接线。|**FAIL**。episodeId 是成交回合锚点，不是 V2 练习/版本/回合/内部配对身份；只能把旧路径当执行数据来源，不能当 D06 适配完成。|
|phase 与阶段上下文|RecallPhase、working.phase、phaseContexts 在 [app/lib/recall/types.ts:28-70](../../../../../app/lib/recall/types.ts#L28) 声明；switchPhase 保存离开阶段上下文并恢复目标阶段：[app/components/recall/recall-workspace.tsx:1863-2029](../../../../../app/components/recall/recall-workspace.tsx#L1863)。新 episode 会显式设为 pre-entry 且首次成交前使用 sentinel：[app/components/recall/recall-workspace.tsx:1551-1558](../../../../../app/components/recall/recall-workspace.tsx#L1551)。旧文档缺 phase 时回退 holding：[app/components/recall/recall-workspace.tsx:1499-1505](../../../../../app/components/recall/recall-workspace.tsx#L1499)。|**PARTIAL**。新建路径的静态起点清楚；旧文档恢复需要明确迁移/HITL 政策，不能把默认 holding 视为首条旅程的证明。阶段切换原子性与真实图还 **NOT VERIFIED**。|
|行情可知截止|RecallReplayCursor 同时有 cursor 和可选 revealedCandleCursor：[app/lib/replay/recall-replay.ts:9-25](../../../../../app/lib/replay/recall-replay.ts#L9)；工作上下文、快照和绘图保存 cursor/revealedCandleCursor：[app/lib/recall/types.ts:30-83](../../../../../app/lib/recall/types.ts#L30)。nextBar 使用 revealRecallBar，切周期只重映射已知行情：[app/components/recall/recall-workspace.tsx:701-743](../../../../../app/components/recall/recall-workspace.tsx#L701)。|**PASS（静态候选） / NOT VERIFIED（真实图）**。不能用单元测试通过或数字 cursor 变化证明目标 K 线已经绘制、跨初始窗口可见或未完成 K 未被伪装。|
|成交可知截止|RecallWorkingState、RecallWorkingContext、RecallSnapshot 均有 executionCursor：[app/lib/recall/types.ts:30-58](../../../../../app/lib/recall/types.ts#L30)；visibleRecallExecutions 按该边界过滤，revealRecallBar 只在实际时间边界消费成交：[app/lib/replay/recall-replay.ts:120-158](../../../../../app/lib/replay/recall-replay.ts#L120)。Recall workspace 将它与行情 cursor 分开保存/恢复：[app/components/recall/recall-workspace.tsx:1371-1523](../../../../../app/components/recall/recall-workspace.tsx#L1371)。|**PASS（静态候选） / NOT VERIFIED（真实图）**。同 K 多成交、成交早于收盘、保存后 reload 的真实可见性尚未观察。|
|selected decision 与 Text owner|决策以 RecallDecision.id/executionIds 表达：[app/lib/recall/types.ts:23-26](../../../../../app/lib/recall/types.ts#L23)。Text 绘图命令写入 recallOwnerId、textRevision、stage、recallHasSeenFuture：[app/components/recall/recall-workspace.tsx:818-853](../../../../../app/components/recall/recall-workspace.tsx#L818)。nextDecision 和 execution click 改变选中决策：[app/components/recall/recall-workspace.tsx:1735-1861](../../../../../app/components/recall/recall-workspace.tsx#L1735)。|**PARTIAL**。有绘图级 owner 元数据，但没有独立 Text 原文/锚点/历史事件集合；executionIds 也不等于 V2 的人工动作/内部配对身份。D06 未冻结“事实定位是否改变恢复进度”，因此不能验收。|
|未来信息保护/来源|hasSeenFuture 在工作态、快照和阶段切换中保存：[app/lib/recall/types.ts:30-53](../../../../../app/lib/recall/types.ts#L30)、[app/components/recall/recall-workspace.tsx:1863-1909](../../../../../app/components/recall/recall-workspace.tsx#L1863)。全历史/事后阶段会设为 true：[app/components/recall/recall-workspace.tsx:2084-2101](../../../../../app/components/recall/recall-workspace.tsx#L2084)。|**PARTIAL**。布尔值和每条绘图标记无法构成契约要求的“来源、时间、范围追加集合”；尚未证明回到早期、重新开始或失败重载不会清除来源。|
|viewport 与异步图表|RecallViewport 保存 logicalRange、barSpacing、rightOffset、尺寸：[app/lib/recall/types.ts:5-14](../../../../../app/lib/recall/types.ts#L5)。Recall 在 chart onReady 后用 rAF 恢复：[app/components/recall/recall-workspace.tsx:1009-1032](../../../../../app/components/recall/recall-workspace.tsx#L1009)。ReplayChart 使用 LightWeight Charts 的 setData、pending logical range、ResizeObserver、reveal effect 和恢复 viewport：[app/components/chart/replay-chart.tsx:905-913](../../../../../app/components/chart/replay-chart.tsx#L905)、[...:1263-1454](../../../../../app/components/chart/replay-chart.tsx#L1263)、[...:1469-1497](../../../../../app/components/chart/replay-chart.tsx#L1469)、[...:1659-1676](../../../../../app/components/chart/replay-chart.tsx#L1659)。|**PARTIAL / NOT VERIFIED**。源码有防止 setData 瞬时 getter 失真的 pending 机制，但尚未冻结并实测“身份/阶段恢复 → 数据 → 主动 reveal/目标导航 → 保存视野 → resize/fit”的同帧优先级。|
|回放图表 props|Recall 入口使用 ReplayChartWithHandle；图表 props 是 candles、预过滤 executions、单个 cursor、revealRequest、viewportKey：[app/components/recall/recall-workspace.tsx:3049-3073](../../../../../app/components/recall/recall-workspace.tsx#L3049)、[app/components/chart/replay-chart.tsx:86-115](../../../../../app/components/chart/replay-chart.tsx#L86)。成交截止没有独立 chart prop，而是由 workspace 预过滤后传入。|**PARTIAL**。逻辑上可保持双截止，SDK 端没有独立边界输入；真实 marker、目标 bar/trade 和 resize 竞态仍未验证。|
|旧 Review/Imported 路径|ReviewChartViewModel 与 ImportedReplay 只有一个 cursor：[app/components/review/review-chart-workspace.tsx:56-79](../../../../../app/components/review/review-chart-workspace.tsx#L56)、[app/lib/replay/imported-replay.ts:5-13](../../../../../app/lib/replay/imported-replay.ts#L5)。旧本地存储也仅保存 episodeId/replayCursor/timeframe/...：[app/lib/storage/review-storage-parser.ts:8-15](../../../../../app/lib/storage/review-storage-parser.ts#L8)。|**FAIL（若作为 D06 入口）**。当前真实 imported 分支已经进入 Recall，但 fallback/旧分支不能承接 V2 首条旅程；不得把它的单游标当作 D06 完成。|
|服务器保存、revision、HTTP 冲突|服务端按 episode_id GET/PUT，事务内用 revision CAS：[app/lib/recall/server-repository.ts:102-196](../../../../../app/lib/recall/server-repository.ts#L102)。客户端保存完整 document/expectedRevision，并在 409 保留草稿：[app/lib/recall/repository.ts:49-101](../../../../../app/lib/recall/repository.ts#L49)、[app/components/recall/recall-workspace.tsx:1605-1664](../../../../../app/components/recall/recall-workspace.tsx#L1605)。|**PARTIAL / NOT VERIFIED**。CAS 静态存在，但 payload 没有 D06 稳定身份、来源集合或 Text 独立历史；没有真实 HTTP 失败、冲突、服务器重读和 reload 证据。|

## 明确反例

1. **身份碰撞/错接**：同账户、同标的、同日有两个练习，或一次练习有多个内部配对。当前入口只以 episodeId 选择 Recall，Practice/Revision 不能通过 RecallDocument 或保存 payload 复核；用日期、名称、成交顺序或文件名补全会把“无法匹配的人工成果”静默迁移。规范要求内容变化先展示差异、歧义走人工处理，不能自动转移（V2 原规范 144–146）。这是 D06 的 **FAIL**，不是测试数据不足。
2. **100+50 买、卖 80**：V2 明确是两个内部配对但一次人工卖出和一个实盘回合，余量 70；现有 TradeEpisode.executions/RecallDecision.executionIds 没有 human_action_id、roundId 或 pairId。把三笔执行逐笔当回合，或从时间/价格相近推断，都会违反规范 148–159。需等待动作识别和配对政策，不可在 adapter 中猜。
3. **旧文档阶段泄漏**：没有 phase 的旧 Recall 文档在恢复时默认 holding；这与首条旅程要求的首次成交前 pre-entry 不同。必须有显式 migration/version 或 HITL，不可把 fallback 当作恢复通过。
4. **事实点击改变恢复进度**：handleExecutionSelect 只处理当前已见成交，但选择路径还可能切换历史/回放状态。D06 尚未决定“点事实是定位还是推进恢复”；在政策冻结前无法声称 Text owner、双截止和曝光来源原子一致。
5. **SDK 竞态**：setData、reveal 定位、通用 fit、ResizeObserver 和阶段 viewport restore 都是异步/延后操作。若 generic fit 在保存视野后覆盖主动定位，单元测试仍会通过而真实目标 K 线不在初始视野；必须实图观察前/中/后状态。

## 不依赖猜测的最小接线步骤

1. 先冻结 adapter 的输入/输出：服务端提供并校验 practiceId、revisionId，以及实盘 roundId 或模拟 pairId；保留 episodeId 作为执行数据锚点。身份来源、版本和冲突状态要随 payload 返回。旧引用多义时返回 HITL/冲突，不以名称、日期、排序、时间或价格推断。
2. 在 Recall 文档边界增加身份元数据和 schema/version（字段命名由决策者定稿），并把“selected identity + phase + market cutoff + execution cutoff + Text owner”作为一次原子状态。迁移旧文档时只读取可证明字段；无法证明的文档停在冲突/重新选择。
3. 将 adapter 结果从 trade-review-workspace 传入 RecallWorkspace；不要由 TradeEpisode 或旧 localStorage 反推练习配对。保留原始成交数量、来源和余量，禁止把内部配对计数当人工回合。
4. 把未来暴露改为追加的来源集合（至少动作、时间、范围/边界和来源版本），把 Text 的目标锚点、owner、原文/修订历史与绘图位置分开保存；显式“全历史/重新开始/失败重载”均不得清除已见来源。
5. 冻结并实现图表同帧顺序：身份/阶段恢复 → 已知数据 setData → 主动 reveal/目标导航 → 保存 viewport restore → 仅在无 pending restore 时的 resize/fit。Chart handle 仍可预过滤成交，但真实目标 bar/trade 必须经 SDK 画出并跨初始视野可见。
6. 明确“选择事实”“重新开始”两个动作的政策后，分别保存事实锚点与回放进度；Text/数字/IME 输入先暂停，输入期间快捷键不推进。服务器 GET/reload 和 409/5xx 后显式重载都要复原同一 identity、双截止、阶段、Text 和来源集合。
7. 只有上述字段/政策落定后，才执行下面的真实旅程；测试写入必须使用独立 TRADEREVIEW_DB_PATH，不能使用 conf/runtime.json 的业务库。

## 可执行真实旅程（本次未执行，全部 NOT VERIFIED）

准备：创建调用方专属临时目录和隔离 SQLite，使用文档规定的 TRADEREVIEW_DB_PATH="$PWD/.scratch/<task>/acceptance.sqlite" node scripts/start-local.mjs --dev --hostname 127.0.0.1 --port 3031；通过真实交易库入口打开一个有明确 practice/revision/round 或 pair 身份的样本。记录服务端原始摘要、数据库逻辑 counts 和浏览器视口，避免业务库。

|步骤|浏览器/服务端应观察到的证据|本次状态|
|---|---|---|
|进入真实图表|身份栏/请求 payload 同时可回查 practice、revision、round/pair 和 episode；同标的另一练习不混入|**NOT VERIFIED**|
|打开入场前|阶段 pre-entry；行情截止为首次入场前完成 K；成交截止在首次实际成交前；买入/退出/终值/未来定轴不可见；初始 viewport 恢复|**NOT VERIFIED**|
|下一根、播放/暂停|每次只推进可用完成 K；缺口不造 K；默认每秒；实际成交按时间揭示；目标 bar/trade 在真实 SDK 中可见；暂停冻结|**NOT VERIFIED**|
|同 K 下一决策/点击事实|同 K 多决策稳定可达；目标决策、阶段、双截止、Text owner 一致；点击事实按已批准的 locate policy 工作，不偷偷揭示全量|**NOT VERIFIED**|
|Text/数字/IME|进入编辑暂停；输入和 IME 不响应快捷键；Text 保存目标锚点、owner、原文/修订；已看后续的后补文字有来源标记|**NOT VERIFIED**|
|切周期、缺口、未收盘 K|周期/平移不推进成交截止；未完成 K 不补 OHLC；成交事实可按真实时间显示；只用已揭示行情缩放|**NOT VERIFIED**|
|全历史→重新开始/阶段切换|显式全历史记录来源；重新开始回初始双截止/viewport 但不删来源、草稿和旧快照；各阶段不带其他阶段终值|**NOT VERIFIED**|
|resize/侧栏/返回|侧栏和 resize 不推进事实；保存视野、主动导航和阶段恢复按冻结优先级；返回恢复原练习/回合/配对焦点和筛选|**NOT VERIFIED**|
|保存→关闭→GET→reload|服务端读取与浏览器重开精确恢复 identity、phase、双截止、Text、来源、draft/snapshot、revision、derived metrics 和 viewport|**NOT VERIFIED**|
|注入保存失败/409|本地输入保留；显式 reload/merge 后服务器 identity/截止/来源不被清除；重试可保存，迟到 SDK 或请求不覆盖主动导航|**NOT VERIFIED**|

阻断依赖：D06 issue 已列出的旧数据映射、人工动作/内部配对、稳定排序；I12 还依赖练习来源导入和真实 chart adapter。另需决策者冻结身份冲突、事实定位、重新开始和同帧 viewport 优先级。没有这些依赖，任何“回放已接通”都只能是静态推断。

## 针对性命令与结果

在不启动服务、不接触业务库的前提下执行了下列纯代码测试：

~~~text
./scripts/native-node.sh node_modules/vitest/vitest.mjs run \
  app/lib/replay/recall-replay.test.ts \
  app/lib/replay/imported-replay.test.ts \
  app/lib/replay/replay-engine.test.ts
~~~

结果：**PASS**，3 files，31 tests，3.61s。它验证 replay 纯函数的边界和顺序，不验证 LightWeight Charts、入口身份、HTTP 或保存重开。

~~~text
./scripts/native-node.sh node_modules/vitest/vitest.mjs run \
  app/components/recall/recall-workspace.test.tsx \
  app/components/recall/recall-integration.recall-review.test.tsx
~~~

结果：**PASS**，2 files，101 tests，41.09s。它验证 React/Recall 测试替身，不验证真实 SDK 绘图、浏览器操作、隔离数据库或服务器 reload。

未执行且因此保持 **NOT VERIFIED**：npm run dev/scripts/start-local.mjs、浏览器点击/截图、真实 LightWeight Charts marker/resize、SQLite 保存和 GET/reload、HTTP 409/5xx、视觉独立比对。没有修改产品或测试代码；未运行任何业务库写入。

## 核查文件 SHA-256

以下为本次静态核查时的工作树内容，供复核；并发任务可能继续改变未提交文件。

~~~text
7b50db1611f95f4b449f7e8ab4b217d19d85ef046b97359b4728a569316f5750  .scratch/trading-library-v20-development/issues/06-replay-adapter.md
d023868c082dab28be4d4b1ab04da591dbb776f01f709e622db0a3e219fdd7c6  .scratch/trading-library-v20-development/issues/12-first-chart-journey.md
479165e76455a06d256d315c1c8cf8dc7dff8530946eb7672077aa8eca357d82  .scratch/trading-library-v20-development/REPLAY-STATE-CONTRACT.md
19083677aee14e614855f8869c5ccb98e749304c2ea91f20bb22883a25d89b78  .scratch/trading-library-v20-development/DESIGN-COVERAGE.md
dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43  docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md
4b215909e326d24bb1a28b2ff24667578ec0f48238711d09c109edaa9542a839  docs/specs/2026-09-25-chart-first-review-ui.md
e2be4ac79b53cc2544adf737198a70b9c4bbcb2b639644ac13d02e8ab292f3e8  app/lib/recall/types.ts
3d0aadf339c7ab02df35f7a89cd4a6c44fe3861d0ead72a1ac7af69f5395019f  app/lib/recall/document.ts
bfd9cdf1a417d82bb7750199295e6c9d0ae4fae6528b67c2529b217ca776446b  app/lib/recall/server-repository.ts
8a03c525bb4b700b495d2f269e65b61dce47e28bdfa116db2c1e057aa0acff6c  app/lib/recall/repository.ts
c8828f1c7992774f25237afe2a4ef44eafe778b4c53fe1cf0b44a197459528ca  app/lib/replay/recall-replay.ts
5e7e64e6e200c42865ba76ff1762100cafbfef004ede1e1b0d56ed52a443b57f  app/components/recall/recall-workspace.tsx
2b24280ebf4d2c914ca8cc7d1866883ab6d41c4c27e203859b10431972ceb6a4  app/components/chart/replay-chart.tsx
64fbf15727f6b2dfc291b50aeab975e83b794f6cd251792de07d706b69ef5890  app/components/review/review-chart-workspace.tsx
85c461a6a02280298636f6b267ef8b9f78d68d1c17613e4ea107b116178798cb  app/components/trade-review-workspace.tsx
91693d4f42f59e57bbfc65f89d5ea34e3ffde99e92f89f13778edb476d663bd0  app/lib/replay/imported-replay.ts
b70df161edb4c918165b3bda63aa18870a87e408d06d7bf6f3ac4f73a50b3ea8  app/lib/replay/replay-engine.ts
aa5647e2978e365164629ac2f7d2046000ace40db70fec23075debc2c6ec9dbd  app/lib/storage/review-storage-parser.ts
532f74f317d05834473c156ce58460bd0f2c1a9dcb645836bf312238a4023dcd  app/lib/storage/review-storage.ts
70c98015dfa2971d2f32323c6b022c69663b98aeeab398a9ba1afeb628d90d0e  app/lib/reviews/episode-viewport.ts
a7c7ba341a5f566c4e851dfe2a033c35cc4f7584205f3ab86cb82269546470a1  app/lib/trades/types.ts
f0c9fbc8b928ba81bb7b357e3fc6293a0d739df3691238788ff516dbe652a1c3  app/lib/trades/episodes.ts
cf87a81cb8c5b6f53c61a18fe90e1f30cc5cd645b591f82230fe4a1aa598b94a  app/lib/trades/practice-contracts.ts
26fbb7c142a0fbc198a29e47c128f48d835e546752831a7dc266ad7e9e16cf4c  app/lib/storage/practice-store.ts
~~~

