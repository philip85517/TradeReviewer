# R6 More / 窄屏布局修复

日期：2026-09-26  
负责人：Luna 5.6  事件：`/root` 复现后交回  
状态：`implementation-ready`，等待 root 真实浏览器复验

## 复现根因

R5 在 1440×900 展开 More、打开三阶段代表图后，`recall-replay-more__body` 按内容自身高度增长（约 1133px）。More 父级 replaybar 没有确定高度，`max-height: 100%` 因此不能建立有效的可用高度；body 随后被 `recall-workspace` / `recall-layout` 的 `overflow: clip` 截断，浏览器滚轮没有可滚动的真实容器。Playwright 通过强制滚动隐藏父级到达记录不代表用户路径通过。

R6-mobile-before 还暴露了相同的约束缺口：垂直 chart/form 区按内容高度排版，220px 主图、侧栏和 replaybar 把工作区撑出 390×844 视口，replaybar 核心动作落在屏外。原有 `@container` 规则只限制子项的 `min-height/max-height`，没有把主区和 footer 串成有限高度链。

## 修改范围

只修改 `app/components/recall/recall.css`、`app/components/recall/recall-workspace.tsx` 及 More 展开行为的最小测试；没有改完成、保存、回放或数据库逻辑，也没有改交易数据。

末尾 R6 覆盖规则完成以下约束：

- `.recall-main` 形成 `height: 100%`、`min-height: 0` 的纵向 flex 容器；图表/计划区占剩余空间并保持 `min-height: 220px`。
- More 展开时 replaybar 通过 `:has(> .recall-replay-more[data-open="true"])` 获得剩余 flex 高度；位置摘要和回放控制在首行，More 在中间行，末尾状态单独占行。
- More 外层改为普通 `div`，由单一 `moreOpen` React state 驱动 `data-open`；按钮提供 `aria-expanded`/`aria-controls`，body 保留在 DOM 中并在收起时使用 `hidden`。这样绕过 native `details` 的 anonymous content box，summary 位于 body 外，body 使用 `flex: 1 1 auto`、`min-height: 0`、`overflow-y: auto`，收起入口始终可见，鼠标滚轮应作用于 body。三阶段代表图和全部记录内部的 nested `details` 保持不变。
- `.recall-replay-more__body[hidden] { display: none; }` 明确覆盖 body 的 `display: grid`，确保收起状态不显示且不产生可聚焦内容。
- `max-width: 1105px` 的 chart/form 采用 `220px minmax(0, 1fr)` 两行；计划侧栏自身滚动，避免表单内容抬高页面。窄屏闭合 footer 压为状态、控制、More 三行，保留既有 44px 触控命中区和字体尺寸。
- 窄屏 chart shell 保持 `position: relative`，使“适应全部”按钮继续相对主图定位。
- More body 的 grid 使用 `grid-auto-rows: max-content` 与 `align-content: start`，More 内部的 nested snapshot panels 覆盖旧的 `max-height/overflow:auto`，由 body 统一滚动，避免三阶段代表图被压成第二个内部滚动盒。

## Native details 复现后的最小修复

Root 的真实浏览器复现显示，R6 的有限 replaybar 已建立，但 native `details` 的匿名内容盒仍阻止 More body 成为可伸缩 flex child：More 与 body 的 `scrollTop` 在鼠标滚轮后都保持 `0`，全部记录仍被裁剪。该证据对应 `repair/reports/R6-more-native-details-fail.png`。

因此本轮只替换 More 外层 disclosure 的布局语义为显式 button/state，保留 class、可访问名称、收起入口和内部 stage details；CSS 的 `[open]` 判断同步改为 `[data-open="true"]`，没有继续追加无效的 flex 规则。

Root 后续真实构建发现另一层级联：body 的 grid 自动行把打开的三阶段 panel 压到约 73px，而 panel 自身旧的 `max-height/overflow:auto` 形成第二个滚动盒。R6 末尾 CSS 已将 More body 的行改为内容高度并取消 More 内 panel 的独立裁剪；需重新构建后确认 body `scrollHeight > clientHeight`、panel `overflow` 不再为 auto。

## 代码验证

执行结果：

- native details 替换前的 CSS-only 基线：`npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot`，1 file / 52 tests passed。
- 本轮 More 展开行为：`npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot -t "keeps the replay bar compact"`，1 passed / 51 skipped。
- More 收起→展开→再收起及宿主工作区旧断言：`npx vitest run app/components/recall/recall-workspace.test.tsx app/components/trade-review-workspace.test.tsx --maxWorkers=1 --reporter=dot -t "keeps the replay bar compact|keeps Recall header actions wired"`，2 files / 2 passed / 126 skipped；断言已改为 `data-open`、`aria-expanded` 和 body `hidden`。
- `npm run typecheck -- --pretty false`：通过。
- `npx eslint app/components/recall/recall-workspace.tsx app/components/recall/recall-workspace.test.tsx`：通过。
- CSS 花括号静态检查：平衡；`git diff --check`：通过。

以上检查没有启动浏览器、没有运行 build、没有写业务数据库，也不能证明真实布局尺寸或滚轮行为。

## Root 验收要求

在当前 build 使用隔离库按以下状态复验：

1. 1440×900：展开 More → 三阶段代表图 → 全部记录与快照（6）；确认 summary、More body 和末条均可见/可滚动，replaybar 不越出视口，主图不少于 220px。
2. 390×844、侧栏打开、post/global：确认主图保持 220px，计划表单在自身容器内滚动，More、回放核心控制和完成入口均可触达，页面 `scrollHeight` 不因工作区内容整体增长。
3. 1280×800 与导航展开态：复验同一约束链及 36px 桌面控件，不缩小文字或命中区。

若浏览器测量仍显示 More body 自身不滚动，或主区出现整体溢出，应保留截图和 DOM 测量并回交本票；本报告不把静态规则或 jsdom 结果当作 E19/E22 通过。
