# R1 首屏框架修复

日期：2026-09-26  
负责人：Luna 5.6 max  置信范围：首屏框架 / Recall 外层接入  
状态：root-browser-pending；CSS 审查项已修复，Recall header slot 已正式声明并接入，等待 root 的真实浏览器验收

## 目标与依据

本票只覆盖 R1 首条真实旅程出现时的首屏框架：E01 紧凑顶栏、E19 紧凑回放底条，以及外层 TradeReviewWorkspace 对 RecallWorkspace 的接入。依据为：

- [02-chart-workspace.png](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)、[04-holding-stage.png](../../../../docs/designs/2026-09-25-chart-first-review/04-holding-stage.png)、[05-final-review.png](../../../../docs/designs/2026-09-25-chart-first-review/05-final-review.png)；三张批准原图已在实现前实际查看。
- [元素规格](../../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：E01 顶栏 48px 起、E19 底条 48px 起；桌面按钮至少 36px、输入 14px、辅助文字至少 12px；主图价格轴预留 84–108px，轴与侧栏间隔 14px，侧栏 300–320px。
- [修复计划](../PLAN.md)、[状态合同](../STATE-CONTRACT.md)、[根因报告](../../reports/iteration-root-cause.md)、[设计一致性复核](../../reports/design-conformance-review.md)。
- 本轮复核依据 [Astra F4 follow-up](R1-astra-frame-followup.md) 与实际中间截图 [R1-frame-intermediate-1440.png](R1-frame-intermediate-1440.png)；截图已在修复前实际查看。

## 实际变更

### `app/components/trade-review-workspace.tsx`

- 识别导入 Recall 已进入首屏的条件 `recallFrameActive`。
- Recall 已挂载时不再渲染外层移动/桌面 `.page-header` 与 `.review-layout-controls`，消除原来在 Recall 自有 header 上方再叠一条 52/48px 的重复框架。
- 将外层已有的返回、导入数据管理、检查/修复动作作为 `headerActions` slot 传给 RecallWorkspace；动作仍调用原处理器，没有删除功能。Recall 自带的专注/标准布局按钮保留为唯一 focus 控件，避免同一动作出现两个常驻入口。
- 直接使用已声明的 `RecallWorkspaceProps.headerActions`，避免临时类型断言掩盖 slot 漏传；Recall 自有 header controls 末尾消费该 slot。

### `app/components/recall/recall.css`

- 新增首屏 frame contract CSS：`.recall-header-actions`、`.recall-header-action`；桌面控件最小 36px，窄屏提升为 44px，保留现有深蓝灰/蓝色 token。
- 新增 `.recall-replay-bar` / `.recall-replay-footer` 及 `__primary` / `__secondary` hooks，供 state owner 把 position、逐根/播放/下一决策和留存/完成动作收进一条约 48px 起、必要换行的底条。保留语义子节点并去掉重复边框，避免原 position strip + control bar + 入口叠加到约 172px。
- 保持 chart/form 使用实际 grid 列：主图、84–108px 轴区域、14px gutter 与 320px sidebar；两列只由基础 grid + `@container recall-work (max-width: 1105px)` 决定，宽度不足时按容器降为上下布局，sidebar 保持文档流参与布局，不覆盖主图。
- 移除两个旧 layout container 中的 `max-height: 96px`，在基础 snapshot rule 统一 collapsed/open 高度；展开的阶段 storyboard/快照使用可读的 `min(58vh, 560px)` 空间。
- 以 `--recall-frame-control-height` 统一控件命中高度，桌面 36px、≤900px 44px；阶段按钮、header actions、summary 与回放按钮共享该变量，避免窄屏阶段按钮被高 specificity 规则降回 36px。
- 针对 B 已接入的真实 DOM 层级，`.recall-replay-bar > .recall-position-strip/.recall-controls` 现在清除 sticky、边框、背景和旧 padding，并分别分配紧凑截止区与可换行操作区；`.recall-replay-more` 默认只占一个 36px/44px 入口，展开后才占整行显示历史、完成、持仓明细与快照内容。
- 回放截止与更多区的长字段使用省略布局；完整信息仍通过更多区保留，未删除动作或状态。
- 统一 Recall 输入/textarea/select 为 14px，辅助文本不低于 12px；不改变回放游标、时间窗或市场/成交状态。

### 直接测试

`app/components/trade-review-workspace.test.tsx` 增加首屏行为测试，并将复用 helper 的旧外层布局断言改为 Recall header action 语义：

- 导入 Recall 首屏没有页面顶栏或 `.review-layout-controls`。
- slot 中的返回、数据管理、检查/修复三个原动作均可点击；数据管理与检查 dialog 可打开并关闭，返回动作按本 fixture 的入口路由回到交易库。
- “更多 / 记录”默认折叠，点击后可见“全部记录与快照”，验证了记录入口仍可达。

## 验证

- RED（TDD）：首轮外层 frame 隐藏后，Recall 尚未消费 `headerActions`，目标测试找不到“检查/修复数据”；Astra 复核随后确认 F1/F2/F3 的层叠根因。
- GREEN：state owner 正式声明并渲染 `headerActions` 后，运行
  `npx vitest run app/components/trade-review-workspace.test.tsx -t "keeps imported replay in one compact frame|keeps Recall header actions wired" --maxWorkers=1 --reporter=verbose`
  得到 2 passed、74 skipped；同时覆盖 “更多 / 记录” 展开入口。中间一次断言假设返回 label 固定为“返回我的交易室”，按 fixture 实际入口为“返回交易库”修正为行为断言后通过。
- `npx eslint app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx`：通过，只有既有 5 条 warning，无新增 error。
- `git diff --check -- app/components/recall/recall.css app/components/trade-review-workspace.tsx app/components/trade-review-workspace.test.tsx .scratch/chart-first-review-implementation/repair/reports/R1-frame.md`：通过。
- `npm run typecheck -- --pretty false`：未通过，失败来自既有 `recall-integration.recall-review.test.tsx:897,915` 的 Testing Library `getByRole({ exact })` 类型错误；本次文件未新增类型错误。
- 尚未运行完整 build/全量套件，按本票范围保留给 root 集成后集中执行。

## 待集成与浏览器项

- 共享工作区已接入 `.recall-replay-bar`、`__primary` 与 `__secondary` hooks；已有 focus icon 保持唯一 focus 动作。
- 三阶段 storyboard/阶段快照必须在展开时脱离 96px scroll box；本票 CSS 已覆盖旧高度，需在 root 的真实浏览器验收中确认展开内容可读。
- root 需在隔离库从新样例以真实浏览器核对 1440×900、1280×800、约 390px：首屏主图优先高度、价格轴与 300–320px sidebar 的 14px 沟槽、长标的/长中文、移动端 44×44 close/summary，以及回放推进后新 K/成交在真实主图可见。当前未宣称浏览器视觉通过。
