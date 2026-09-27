# R1 状态修复报告

日期：2026-09-26  
负责人：Luna 5.6 max（RecallWorkspace 状态 owner）  
范围：`app/components/recall/recall-workspace.tsx` 与 Recall workspace/integration tests；未提交。

## 已接入的合同

- `ReplayChart` 使用可选 `revealRequest: { id: number; time: string }`。主动加载、阶段切换、直接选决策/全局、快进/逐 K、上一根、历史开关、周期切换、快照编辑/返回和保存草稿恢复会递增请求 id；行情刷新复用草稿时不发请求。
- `RecallWorkspaceProps` 增加 `headerActions?: ReactNode`，slot 渲染在 Recall 自有单 header 的 controls 末尾。工作区根节点、header、回放底栏已接入 frame hooks；底栏把 position summary 与 replay actions 收在 `recall-replay-bar` / `__primary` / `__secondary` 内。

## 行为修复

- 买入前 `下一笔决策` 直接按稳定成交顺序定位首个决策，不恢复旧 holding cursor；回到买入前后保存/重开保留阶段图、Text、计划、快照和 `hasSeenFuture`。
- 阶段切换的来源标记按行情截止与成交截止比较。进入 holding/post-review 时目标图晚于当前图会标记；回到 pre-entry 时按当前/目标双截止比较保留已看后续，即使 holding 停在首笔决策边界也不会恢复成 fresh blind；真正从未揭示成交的 pre-entry 草稿仍保持未看后续。
- pre-entry 与 holding 隐藏回合“已平仓/持仓中”结果标签；只有 post-review 或显式完整历史才显示。底部当前成交摘要要求成交仍在已揭示集合中，选中未来决策后回退不会泄露未来清仓成交；Text 归属仍跟随选中的决策。
- 同 K 多决策按执行时间加源顺序处理；未完成 K 仍遵循 knowledge cutoff。IME、输入控件和编辑快照暂停/阻断推进；普通逐 K 不改 Text owner。
- 播放间隔为 1000ms。末尾播放/快进/下一决策显示原因并禁用，提供非破坏性“回到买入前判断”；末尾 Space 不会短暂启动播放。编辑快照时上一根、下一笔、下一根、播放和完整历史均由按钮与 handler 双重阻断。

## 验证证据

- `npx vitest run app/components/recall/recall-integration.recall-review.test.tsx --maxWorkers=1 --reporter=dot`：**29 passed**。
- `npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot`：**38 passed**。
- `npx vitest run --config .scratch/chart-first-review-implementation/diagnosis/vitest.config.ts .scratch/chart-first-review-implementation/diagnosis/replay.diagnostic.test.tsx --maxWorkers=1 --reporter=dot`：**6 passed**（含根代理已将播放时序更新为 999ms 不推进、1000ms 推进）。
- `git diff --check -- app/components/recall/recall-workspace.tsx app/components/recall/recall-integration.recall-review.test.tsx`：通过。
- `npm run typecheck -- --pretty false`：当前仅剩 A 的 `app/components/chart/replay-chart.tsx:1187` `Time | null` 传给 `Time` 的错误；Recall workspace 与 integration test 的此前类型错误已修复。本报告不修改 chart 文件。

## 待父代理处理

- A 需修复上述 chart 类型错误并继续真实 viewport/主图 reveal 验证。
- frame 集成定向测试仍需父代理处理返回动作文案/fixture：当前实际 slot 按状态显示“返回交易库”，测试期望“返回我的交易室”。
- 真实浏览器 1440×900、1280×800 与窄屏视觉/稳定 HMR 旅程由 root/A 验收；本 worker 未宣称视觉通过。

## R1 frame JSX 与来源边界追加（2026-09-26）

- 回放底栏现以 direct-child hooks 组成紧凑主条：`.recall-position-strip`、`.recall-controls`、`.recall-replay-more`；主条保留上一根、播放、下一根、短截止、下一笔决策、留存和计划侧栏。保存并完成、完整历史、三阶段代表图、全部快照与完整持仓摘要统一收在默认折叠的“更多 / 记录”入口；选中成交来源说明随详情展开。`recall-replay-more__summary`、`recall-replay-more__body`、`recall-replay-more__panel` 保留给 frame CSS 使用。
- 主条按阶段只显示可信紧凑摘要：holding 使用当前已揭示成交计算的持仓数量，pre-entry 使用计划计算得到的预期 R / 初始风险或短空态，post-review 显示完整历史与当前已知持仓；完整净额仍在详情中。
- 纠正阶段来源边界：holding 即使停在首笔买入边界，回到 pre-entry 也按当前/目标双截止比较保留 `hasSeenFuture`，不会再显示成 fresh blind。只有真正从未揭示成交的 pre-entry 草稿保留 `false`。同步调整原先把 legacy holding 首买当作 fresh blind 的测试，并新增首买回退覆盖。
- 测试通过：`npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot`（39 passed）；`npx vitest run app/components/recall/recall-integration.recall-review.test.tsx --maxWorkers=1 --reporter=dot`（30 passed）。
- `npm run typecheck` 与三份 touched 文件的 `npx eslint` 均通过；`git diff --check` 通过。

### 共享接口与未决

- 已向 root / frame agent 共享 `recall-replay-bar`、`recall-position-strip`、`recall-controls`、`recall-replay-more` 及 `__summary` / `__body` / `__panel` hooks；未编辑 CSS、chart 或父工作区。
- 状态与 JSX 工作区改动已冻结，等待 root/A 在稳定 HMR 窗口做真实 viewport 与首屏视觉验收；本报告不宣称视觉验收已通过。

## 阶段返回视口返修（2026-09-26）

- 根因链已与 A 对齐：`switchPhase` 原本读取目标 `phaseContexts[nextPhase].viewport`，但只在状态更新后直接排一个 workspace rAF；ReplayChart 在同一稳定 `viewportIdentity` 下更新较短的早期 candle 集时，会先把旧晚期 logical range 用 nearest 映射，边界压到早期末端，形成两根巨宽 K。随后 phase-context effect 可能把这个中间窗口再次写回目标阶段。
- Workspace 现在把目标阶段 viewport 作为带 token 的待恢复请求，在新 phase/replay 提交后再排 rAF 恢复；待恢复期间 phase-context effect 仍保存最新 drawings/replay，但强制沿用目标阶段 viewport，不会以中间 collapsed range 覆盖保存值。`pendingViewportRestoreRef` 继续只负责快照编辑返回，两条路径不混用。
- 新增 workspace 回归：模拟早期目标 viewport 与中间 collapsed viewport，验证阶段切换最终调用目标 viewport 且 autosave 保留目标 `phaseContexts.pre-entry.viewport`。
- 定向证据：workspace 42/42、integration 30/30、`npm run typecheck`、Recall workspace/test ESLint、`git diff --check` 均通过；phase/viewport 子集分别为 workspace 2/2、integration 4/4。
- A 的 chart 侧继续负责 nearest 映射防止 span 坍缩；Workspace 与 A 之间无需新增 chart prop，现有 `revealRequest:{id,time}` 与 `RecallChartHandle.restoreViewport(viewport)` 足够。真实回到买入前、Text/canonical capture 与保存重开仍由 root/A 浏览器复验。

## 阶段 restore 竞态与无保存目标返修（2026-09-26）

- `switchPhase` 只有目标阶段存在保存的 `viewport` 时才创建显式 restore 请求。没有目标阶段上下文时，fallback graph 不再复制当前 chart viewport；阶段 context effect 在本次 reveal 提交期间也不把旧窗口写成新阶段的 viewport，避免回到买入前继承未来视野。
- 阶段 restore 请求带 `generation/phase/timeframe/cursor`。所有主动 `requestReveal`（包括逐 K、下一笔、周期/历史/选择等调用路径）会取消旧请求并递增 generation；rAF 回调会再次核对请求身份和当前 replay，旧回调不能覆盖更新后的 reveal。
- 新增 workspace 覆盖：无保存目标不持久化当前未来 viewport；新 replay reveal 后手动执行旧 phase restore callback 不得恢复旧 viewport。integration 同步覆盖无保存目标的持久化边界。
- 定向证据：`npx vitest run app/components/recall/recall-workspace.test.tsx --reporter=dot` **44 passed**；`npx vitest run app/components/recall/recall-integration.recall-review.test.tsx --reporter=dot` **31 passed**；`npx tsc --noEmit --pretty false` 通过；三个 Recall touched 文件 ESLint 通过；`git diff --check` 通过。
- 仍由 root/A 负责真实浏览器 HMR 窗口、chart nearest mapping 与 1440/1280 首帧验收；本 patch 未编辑 chart/CSS/父 workspace，也未宣称浏览器通过。

## 图表成交选择接口补接（2026-09-26）

- `ReplayChartWithHandle` 现在传入 `onExecutionSelect`。Workspace 只接受当前 `chartExecutions` 已揭示集合中的 execution id，再通过既有 `selectDecision` 选择对应决策并暂停播放；未来成交 id 或无归属 id 会被忽略，双截止与来源边界继续由现有选择逻辑负责。
- integration 覆盖了未揭示 `fill-2` 点击被拒绝，以及在当前截止揭示 `fill-2` 后点击菱形切换到第二决策。
- 定向证据：integration `selects a chart execution only after it is visible at the current cutoff` 通过；完整 integration 当前 **32 passed**（含无保存 viewport）；workspace 当前 **44 passed**。

## 成交标记边界与快照编辑返修（2026-09-26）

- 成交菱形回调现在把 `boundaryExecutionId` 传给既有决策选择路径。目标决策仍复用已保存的 drawings/Text，但 replay 强制定位到被点击成交的截止，不恢复该决策曾保存的更晚游标；回调只接受当前 `chartExecutions` 中已揭示的成交。
- 快照编辑期间 execution 选择直接忽略，避免快照图上的菱形切换 live phase/replay；从显式完整历史点击成交会退出 history，并定位到该成交边界，`hasSeenFuture` 继续保留。
- 新增 integration 回归：晚期 `fill-3` 草稿点击 `fill-2` 回到 `fill-2` 且保留晚期 Text；快照编辑点击成交不改变快照游标；完整历史点击成交退出 history 并定位边界。
- 定向证据：`npx vitest run app/components/recall/recall-workspace.test.tsx app/components/recall/recall-integration.recall-review.test.tsx --reporter=dot` **79 passed**；`npx tsc --noEmit --pretty false` 通过；workspace 与 integration touched files ESLint 通过；`git diff --check` 通过。

本轮 workspace 状态改动至此冻结，等待 root 在真实图表点击 999997/999992 成交菱形复验。

## capture/save 回归的测试时序修正（2026-09-26）

- coordinator 的 78/79 失败只出现在 `keeps a server-stamped capture when Text changes during its save`：测试在初始 load/replay chart 尚未稳定、`retain` 的异步 capture 尚未完成时就展开折叠记录并查找编辑按钮；这会让快照尚未提交，或触发 capture generation guard，因而没有“编辑决策 1 快照”按钮。单测原有 retain/save 产品路径未复现错误。
- 仅调整测试同步：先等待 mock chart 的初始 `fill-1` execution cursor，再用可控 pending capture，在 `act` 内显式 resolve/await capture，之后展开记录。未改产品代码。
- 定向证据：该 case `--retry=5` 通过；相关 autosave 三测通过；workspace test ESLint 与 `git diff --check` 通过。
