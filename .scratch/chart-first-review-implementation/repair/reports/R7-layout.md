# R7 — R6 收尾布局静态复核

日期：2026-09-27  
负责人：Luna 5.6  
集成负责人：root  
状态：`integration-pending`（等待 root 最新实际测量）

## 复核范围

已读取当前流程、任务拆解标准、E01–E22 元素规格、02/05/07 批准画板，以及 R6 的 header/footer、E10 和 More 修复记录。复核范围锁定为：

- `app/components/recall/recall.css` 的 R6 末尾规则和其前置级联；
- `app/components/recall/recall-plan-sidebar.tsx` 与已有 E10 定向测试；
- More disclosure 的 JSX 结构与 CSS 选择器之间的语义对应。

本轮没有修改源码，没有启动 build、full suite、浏览器或真实业务库。

## 静态结论

### 顶栏（E01/E02/E03）

- 901px 以上最终规则将 `.recall-header > .chart-toolbar` 固定为 `flex-wrap: nowrap`、36px 高度；该规则位于旧的全局 `.chart-toolbar` 响应式规则之后，级联生效。
- 1101–1320px 最终规则把 header 明确分为 `36px 36px` 两行：第一行标题与回合/动作，第二行 chart toolbar 与阶段导航；grid 子项的行列声明完整，没有被前置 flex 规则覆盖。
- 1440px 进入 901px 以上的单行 toolbar 规则，不进入 1280 紧凑网格断点。
- 需要 root 用实际 DOM 尺寸确认：1440px/长标的或长 action 文本下，`overflow: hidden` 是否使 chart toolbar 的 `scrollWidth` 大于 `clientWidth`。如果有隐藏的搜索、周期或设置按钮，应按实测回交；静态代码本身没有发现确定性裁剪或断点冲突。

### E10 计划价格组

- 入场字段在独立 `.recall-plan-entry-row` 内，为单列主字段。
- 止损和目标同处 `.recall-plan-price-pair recall-plan-pair`，沿用双列 grid。
- 计划数量在独立 `.recall-plan-size-input` 内，为单列主字段。
- 方向与数量单位同处 `.recall-plan-supplementary-row`，两列宽度为 `minmax(96px, 112px)`，在 320px 侧栏内容宽度内有余量；方向空值仍是 `待选择`，未知方向保留缺项说明，不从成交事实回填。
- 定向测试已锁定上述 DOM 关系、空方向行为、原始输入保留和显式方向变更；没有看到会把 E10 语义改回旧的同一行分栏的后续选择器。
- 窄屏计划侧栏最终规则把 `max-height` 交给 `grid-template-rows: 220px minmax(0, 1fr)` 的轨道拉伸，后续覆盖为 `max-height: none`；这在静态上没有冲突，但 root 仍需测量侧栏的 `scrollHeight/clientHeight`，确认长表单由侧栏自身滚动而不是被 `.recall-chart-and-plan` 的 `overflow:hidden` 截断。

### More / 唯一 body 滚动（E19/E22）

- More 外层由 `data-open="true"` 驱动，summary button 位于 body 外，body 使用 `hidden` 收起；该结构与末尾 CSS 的 `:has(> .recall-replay-more[data-open="true"])` 选择器一致。
- 展开态 body 最终规则为 `grid-auto-rows: max-content`、`align-content: start`、`overflow-y: auto`、`min-height: 0`，因此内容高度可形成真实 `scrollHeight`。
- More 内的两个 `.recall-replay-more__panel` 最终被设为 `max-height: none; overflow: visible`，覆盖旧 snapshot panel 的 `max-height/overflow:auto`，静态上只保留 More body 作为该区域的纵向滚动体。
- 窄屏展开态最终使用三行 `auto auto minmax(0, 1fr)`，隐藏重复的末尾 status 行和无效 replay buttons；收起态恢复三行 footer、状态说明和回到买入前动作。规则顺序与 JSX 直接子节点顺序一致。
- 需要 root 实测 `body.scrollHeight > body.clientHeight`、两张 panel 的 computed `overflow-y` 不为 `auto/scroll`，以及 `.recall-main`/`.recall-replay-bar` 没有通过其他滚动体截断 body；这些属于浏览器布局事实，静态检查不能代替。

## 验证

- PostCSS 解析 `app/components/recall/recall.css`：通过（331 个顶层节点）。
- 目标规则静态命中检查：通过（901px toolbar nowrap、1280 双行、E10 单列/双列/补充双列、More body `max-content` 与 `overflow-y:auto`、panel `overflow:visible`）。
- `git diff --check -- app/components/recall/recall.css`：通过。
- 未运行 build、full suite、浏览器或真实业务数据库验收；R6 报告中的这些限制仍然有效。

## R7 状态

当前源码冻结，无确定性级联或语义漏项需要我先行返修。保留以上两项实际测量作为 root 的集成门槛；若测量暴露裁剪、整体溢出或第二滚动盒，再由 root 明确返修点后仅改 `recall.css` / `recall-plan-sidebar.tsx` 及对应测试。

## Root 390px 实测后的根因与待批准方案

Root 反馈 post-review + More 展开（390×844）：header 145px，chart 220px（231–451），计划表单仅 60.5px（465–525.5），replaybar 304.5px（531.5–836），More body 120.5px（710.5–831），body 内容高度约 1624px。该结果与当前 flex 链一致：More 打开后 replaybar 和仍展开的 `chart-and-plan.plan-open` 都是 `flex: 1 1 0`；后者同时保留 220px 趋势区、14px 间隔和表单，因此 body 只能得到约 120px client height。`grid-auto-rows: max-content` 只使内容进入 body 的 `scrollHeight`，不会增加可视高度。

待 root 批准的最小空间方案：在窄布局点击 More 时由 React 记录当前 `planOpen` 并显式设为 `false`，让现有 `hidden` 与计划按钮 `aria-expanded` 反映计划侧栏暂时收起；More 关闭时恢复记录的值。More 控制行仍保留 44px 的“计划侧栏”入口，用户可显式返回计划；桌面宽布局保持计划侧栏与 More 并存。预计回收约 60–75px 给 More body，保留 220px 趋势区、44px 命中区和 body 单一纵向滚动上下文。此方案若采用需要 `recall-workspace.tsx` 的 More toggle 与一个恢复 ref，CSS/计划侧栏文件无需重构；当前仍未修改源码。

## 已授权实现与定向验证

Root 已授权按上述方案实施，随后补充了以下边界：

- `RecallPanelState` 与 `transitionRecallPanelState` 将 More/计划的开合、窄布局记忆、宽→窄 resize 和 episode 切换建模为纯状态转换；episode 切换清除旧恢复值。
- 窄容器判断读取 `.recall-chart-and-plan` 的实际宽度，与 `@container recall-work (max-width: 1105px)` 使用同一内容宽度边界；ResizeObserver 处理宽屏 More 打开后再缩窄的情况。
- footer 的“计划侧栏”保留原 toggle 语义：已开时收起；宽布局 More 打开时可并存；窄布局 More 暂让位后，点击该按钮会关闭 More 并重新打开计划。图上计划价格入口仍明确关闭 More 并打开计划。
- 窄容器 More 展开时，CSS 将 `chart-and-plan` 约束为 220px（含 chart shell/tool/chart-stage），把剩余高度交给 replaybar；计划本身通过 React `hidden`/`aria-expanded` 状态显式收起，没有用 CSS 隐藏展开表单。
- 新增 `app/components/recall/recall-panel-state.test.ts`，定向测试 10 项全部通过：`npx vitest run app/components/recall/recall-panel-state.test.ts --maxWorkers=1 --reporter=dot`。覆盖 1105px 边界、footer toggle 与图上显式打开的区别、宽窄 resize 恢复/清除记忆、原本关闭的计划保持关闭，以及 episode 切换隔离。
- `git diff --check -- app/components/recall/recall-workspace.tsx app/components/recall/recall.css` 通过。未运行 build、full suite 或浏览器；root 将集中执行 type/lint/build 与真实浏览器测量。Astra 独立审查待 root 协调。

当前源码可交 root 冻结检查；浏览器仍需确认 More body 的新 client height、唯一滚动体、计划按钮 aria 状态、宽→窄 resize 和 1440/1280 header 未回归。
