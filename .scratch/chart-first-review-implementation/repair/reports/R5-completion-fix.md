# R5 completion and More-scroll repair

日期：2026-09-26  
负责人：Luna 5.6  
状态：产品冻结；等待 root 的真实 UI、production build 与隔离库验收

## 修复范围

本轮针对 `R5-astra-completion.md`、`R5-data-audit.md` 与 `R5-astra-final.md` 中的完成入口、恢复边界和 E22 可达性缺口，改动了：

- `app/components/recall/recall-workspace.tsx`
- `app/components/recall/recall-workspace.test.tsx`
- `app/components/recall/recall-plan-sidebar.tsx`
- `app/components/recall/recall-plan-sidebar.test.tsx`
- `app/components/recall/recall.css`（root 新分配的 E22 最小滚动修复）

原始成交与业务数据库没有改动；本轮没有启动浏览器，也没有写 `3022` 业务库。

## 完成边界与恢复契约

完成操作现在把全局图作为最终总结的唯一 owner，并从该图的周期重建完整回放：所有成交和截至最后行情的 K 线都进入最终 `globalSnapshot`、`captureContext` 与 `working`。决策阶段入口会先捕获一次当前决策图以提交焦点 Text，然后切回保存的 global graph；这张中间图不会被标成全局总结。直接从全局入口完成时走同一条 global-history 路径。

正式候选和保存后的 React 状态都写入 `working.phase = post-review`、`selectedDecisionId = global`，并把 `phaseContexts["post-review"]` 写成 global context。这样重开时不会从旧的 holding/decision context 恢复早期边界。原决策 Text 保存在对应 `decisionDrafts`，全局 Text 保留在 global working graph；两者不会互相覆盖。

同周期且当前视野仍覆盖最新 K 线时保留 viewport。切换到不同周期或当前视野没有覆盖最新 K 线时清掉旧 logical range、调用 `fitAll`，并以最终 `capture()` 返回的 viewport 作为快照和 post-review context 的权威值，避免跨周期混入旧视野。

同周期的保留条件现在同时检查 logical range 上下界：只有 `from <= 最后一根索引 <= to` 才保留；用户平移到最后一根右侧的全留白窗口也会清掉旧范围并 `fitAll`。完成工作区测试覆盖了该边界，并确认最终保存使用 capture 返回的 fitted viewport。

两次 capture 之间以 draft generation 为边界：第一次决策 capture 完成后重新取 generation；在正式 capture 前若草稿已变化则拒绝完成。正式 capture 自身也核对 generation、drawing history 和 episode，防止 PNG、结构化快照及手工证据来自不同草稿。

计划派生指标第三行显示 `3R · 3:1`，完整预期金额保留在 `title` 与 `aria-label`；holding secondary details 继续默认折叠。

E22 的 expanded More 区现在是受限的纵向 flex 区，`recall-replay-more__body` 使用真实 `overflow-y: auto` 和 `min-height: 0`，在主图保持至少 220px 的剩余空间内滚动，三阶段代表图和全部记录入口都保留在 DOM 与可访问路径中。窄屏回放控制行保持 44px 命中区并横向滚动，逐 K、播放、下一决策、留存和计划侧栏入口仍全部可达，More 继续折叠。

## 定向证据

执行：

```text
npm exec vitest run app/components/recall/recall-workspace.test.tsx app/components/recall/recall-plan-sidebar.test.tsx --reporter=dot
```

结果：2 files passed，61 tests passed。

新增/加强的实际工作区旅程覆盖：

- 从 post-review decision context 完成时重建完整 global history、post-review phase 和 global phase context；
- 直接从全局总结入口完成时使用同一完整边界；
- decision Text 与 global Text 分属各自 owner；保存后的 bundle 具备完整 execution ids、非空实际净盈亏和 manual evaluation revision；
- 不同周期（decision `15m`、global `1D`）触发 `fitAll`，并保存 global post-review viewport；
- 重新挂载保存结果后恢复 `事后复盘`、global selection 和最后成交 cursor；
- 第三行计划指标显示短证据，完整金额只在 tooltip/accessible label 中出现。

补充的受控竞态回归单独执行：

```text
npx vitest run app/components/recall/recall-workspace.test.tsx -t 'rejects completion when a Text edit lands while the global flush is pending' --reporter=verbose
```

结果：1 test passed，51 skipped。该用例让首次 decision capture 完成后暂停 global 转场 flush，通过真实图表 `add Text` 消费者修改草稿；释放 flush 后确认没有 finalize 混合快照，自动草稿保存了新 drawing，随后重试完成成功。

另行执行：

```text
git diff --check -- app/components/recall/recall-workspace.tsx app/components/recall/recall-workspace.test.tsx app/components/recall/recall-plan-sidebar.tsx app/components/recall/recall-plan-sidebar.test.tsx app/components/recall/recall.css
```

结果：通过。

另行执行四个交付文件的 ESLint：通过，无 error 或 warning。

`npm run typecheck -- --pretty false`：通过。

## 交接边界

worker 没有运行全量测试、生产 build 或浏览器验收。root 需要在 `repair/acceptance.sqlite` 上重新启动当前 build，至少复验完成入口（decision/global）、保存后重开、代表图选择、E22 两个记录入口和 PPTX 导出；这些检查完成前不把本报告升级为全局 acceptance。
