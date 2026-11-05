# 策略台设计规范与原生复盘样板 · 2026-10-07

State: closed
Status: accepted

用户授权：主动诊断、实测、一个推荐的可逆样板；不要求用户先规定设计参数。沿用此前“优先原型，不实现真实业务代码”的边界。本轮增加 development-only 原生组件样板，不推出正式功能、不写业务库、不提交远端。

当前分支 codex/strategy-workbench-v1-design；保留旧修改，见 reports/pre-existing-status.txt。规范是供评审的草案，未获视觉选定之前不修改公共规范和生产样式。

## 来源与范围

- 当前静态策略台：`http://127.0.0.1:3063/workbench-design/?variant=A`；读取最新页面，旧截图只作历史参考。
- 正式组件：RecallWorkspace / DrawingToolbar / ChartToolbar / ReplayChart / RecallPlanSidebar。
- 现有批准参考：docs/designs/2026-09-25-chart-first-review/{02-chart-workspace,04-holding-stage,05-final-review,07-interaction-states}.png；已直接打开原图，独立视觉审查者也直接读取参考。
- 当前规格：docs/specs/2026-09-25-chart-first-review-ui.md、同名 elements.md；docs/specs/2026-10-06-strategy-workbench-review-functional-design.md。
- 用户本轮明确不预设复盘列数/比例；宽度依据图表可用空间、完整内容和窄屏校准。保留阶段行为和价格语义，不能直接移植首页 B。
- 本次“设计规范启动包”位置未找到，已询问；历史 handoff zip 不冒充新启动包。其专项符合性仍 NOT VERIFIED。
- TradingView 官方 Supercharts 布局说明用于工具分组和主次关系的参考，不机械复制品牌或功能。

## 负责人和边界

root：整页体验、视觉契约、完整数据/状态链、实测、独立验收和报告。
design_sample（gpt-5.6-luna）：唯一新增样板/fixture/CSS及 app/page.tsx 接入 owner；不得修改业务状态契约、共享主题或真实库。
theme_audit：独立只读源码审计和最终视觉审查，未实现 UI。

原生样板 repository 是独立会话存储，必须明确“样板内存保存，刷新重置”。数据库持久化不属于本次视觉样板，不以此关闭任何正式功能门槛。原生应用检查已使用 SQLite backup 的隔离库和 3064 端口。

## 分步门槛

1. 先接入原生图表与完整 fixture；root 亲自验证下一根可见、Text及原判断回看、双截止。
2. 该链接受后才应用推荐 scoped CSS。只提供现状/推荐对照，不制造多余方案。
3. 同数据、阶段、1440×900/DPR1 比较；1280×800、390×844 和断点两侧检查完整内容/焦点/溢出。
4. 未实现 UI 的审查者直接打开前后截图；功能、状态、视觉分别记录。
5. 当前服务运行、最终浏览器检查、规范路径和结果在聊天交付。

## 状态转移

|动作|行情/成交截止|可见/隐藏|原判断与来源|视野|
|---|---|---|---|---|
|初入 S0|首笔前1ms / 未揭示|已知K、计划与原判断；无成交/最终盈亏|复盘补记真实来源|固定合成窗口，后续空白|
|下一根/播放/下一决策|使用真实 revealRecallBar/决策边界|新增K和对应成交可见|保留早期 Text 和快照；新内容属当前阶段|主动推进使新增bar可见|
|切 S1|恢复S1已知进度|原计划只读，新观察可区分|不覆盖原文|恢复该阶段视野|
|主动 S2|完整历史 / 完整执行|允许最终事实/结论|永久 hasSeenFuture|完整历史合理窗口|
|回 S0|恢复早期双截止|Tooltip、列表、摘要、轴不带未来|“已看后续”的补记来源不抹除|早期视野|
|面板开合/resize|不变|同已知投影|不变|保留用户范围|
|样板内存保存/重开|本会话快照|恢复同fixture状态|不冒充数据库持久化|恢复保存范围|

最终分项状态和证据见 [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)。本轮可评审视觉样板已通过适用门槛，规范仍是0.1草案，未代签正式策略功能或数据库持久化。

## 预览与重启

- 推荐：[原生组件推荐样板](http://127.0.0.1:3064/?prototype=review-design&mode=recommended)。
- 对照：[同数据现状基线](http://127.0.0.1:3064/?prototype=review-design&mode=baseline)。
- 样板仅development模式、内存repository，刷新重置；三个阶段可在同一页实际切换。合成日K含日历日，不能当真实交易日历。

在本worktree启动（保留显式隔离库覆盖）：

```sh
cd /Users/zhoulin/.codex/worktrees/f42e/TradeReview
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f42e/TradeReview/.scratch/strategy-design-system-2026-10-07/PROTOTYPE-isolated.sqlite npm run dev -- --port 3064
```

3064本轮服务：node PID37559 / exec会话49925。最终确认LISTEN，并在真实浏览器冷刷新、恢复正常1280×720窗口检查图表/阶段/双截止/内存说明；`reports/final-live-browser.json`与截图为证据，预览tab已保留。依赖已安装，未更改lockfile。静态旧策略台另由3063提供，不与本次样板服务混同。

## 评审材料

- [规范草案](../../docs/designs/2026-10-07-strategy-design-system/README.md)：方向、文字/颜色/间距/图标、公共状态、复盘契约、例外与公共固化范围。
- [八字段诊断](reports/diagnosis-source.md)、[实际状态补充诊断](reports/diagnosis-addendum.md)。
- [独立视觉比较](reports/visual-review.md)、[独立默认路径源码审查](reports/preview-seam-review.md)。
- [root实际浏览器旅程](reports/browser-journeys.md)、[测试与数据保护](reports/verification.md)。
- [最终验收](FINAL-ACCEPTANCE.md)：仅本轮视觉样板的分项结果，不代替正式策略/数据库功能验收。

本轮仅一个推荐设计，baseline是同数据对照而非第二个候选。用户需要选择的审美取舍是：阶段/截止扫读、完整中文阅读所增加的纵向高度是否合适；桌面是否值得换回更多首屏图表空间。常规细节和可逆制作不新增审批。
