# 复盘工作区原型：系统排查与修复汇总

2026-11-05。当前 3091 预览使用 [candidate-45 冻结版本](../candidate-20261105-45/manifest.json)。本轮只处理复盘工作区原型及支撑其审阅的预览服务，行情为合成数据、草稿在内存中，刷新会重置；正式 V1.0 规范尚未接纳这些候选。

| 已定位的问题 | 原因与本轮处理 | 限定验收证据 |
| --- | --- | --- |
| 短窗口中回放条、日期与固定审阅条冲突 | 工作区最低高度超出可用高度；重新约束布局高度。 | [1200×569 和其他采样](../task-01-coordinator/REPORT.md)、[独立视觉](../task-01-independent/REPORT.md)。 |
| 侧栏开合后价格视野跳变，回放后目标 K 线可能离开视野 | 图表重算尺寸时价格尺度与标记参与自动缩放；保留用户价格视野，回放目标有需要时扩展范围。 | [真实图表实操](../task-02-coordinator-final/REPORT.md)、[独立视觉](../task-02-final-independent-visual/REPORT.md)；新版本回归见 `side-scale/`、`replay/`。 |
| 回放阶段变化后地址不同步 | 阶段更新没有同步到 URL；按现有页面地址替换阶段并保留查询和锚点。 | [阶段、回合与日期回归](../task-03-final/REPORT.md)及 `scene/`；模拟首字符提交三阶段见 `native-typeahead/`。 |
| 计划金额/仓位/数量转换及无效值切换不稳定 | 来源值与派生值混用，切换或修改入场价时使用旧值；保留来源和无效原文并更新计算。 | [候选 31 数值及价格线复测](../task-09-candidate31/REPORT.md)；新版本回归见 `numeric/`、`lines/`。计算口径仍是待用户审阅的原型方案。 |
| 记录、日期和显隐控件的焦点/单选语义不完整 | 弹窗退出时缺少来源焦点，隐藏控制条后焦点可能不可达；补齐局部键盘路径、单选语义和回退焦点。 | [记录与单选](../task-06-candidate17/REPORT.md)、[日期与两条栏](../task-08-candidate20/REPORT.md)；新版本回归见 `focus/`、`date/`、`navigation-extra-v3/`。 |
| 绘图条普通 T 与多节点图标轮廓不协调 | 候选图形与给定截图的局部轮廓有差异；修订两个图标，保留现有未实现工具的禁用状态。 | [局部实操](../task-05-candidate16/REPORT.md)和[独立静态对照](../task-05-candidate16-independent/REPORT.md)。无法据此宣称 TradingView 全部功能或图标 1:1。 |
| Text 锚点圆心偏移约 1px | 8px 圆点使用了 3px 定位偏移；改为按 4px 半径居中。 | [入场与结束坐标诊断](text-coordinate-diagnosis/observations.json)和[独立静态对照](../task-04-candidate45-stage/INDEPENDENT-VISUAL.md)支持限定样本的修正；密集遮挡仍另行处理。 |
| 窄屏阅读入口指向下载型文件 | 链接指向 Markdown；改为可阅读的 HTML 规范页。 | [390×844 限定旅程](../task-07-candidate18/REPORT.md)；这不是完整移动端工作区。 |
| 审阅预览服务会被空闲连接阻塞 | 单线程请求处理等待连接；调整并发处理并保护评论文件写入。 | [服务验收](../task-01a/ACCEPTANCE.md)；29 项服务单元测试通过。 |

## 仍需解决或验证

1. **Text 的视觉共存仍未通过。** 当前预览中，同点文字锚点或长引线会与成交箭头混淆并遮挡行情，[当前版本的非实现者视觉复核](INDEPENDENT-VISUAL.md)为 FAIL。隔离的 [candidate-44](../task-04-candidate44-stage/REPORT.md) 已改善图上 Text 身份与箭头遮挡，限定样本中可创建六条并随回放隐藏/恢复；但单条正文仍遮盖 K 线，密集态的图表与临时列表存在空间取舍，[其独立视觉复核](../task-04-candidate44-stage/INDEPENDENT-VISUAL.md)同样为 FAIL。该候选没有并入 3091，需继续设计及审阅。
2. **原生下拉仍有输入方式边界。** 使用 Tab 和模拟首字符已提交三阶段、三档速度及两回合的符合度/评分；鼠标弹出菜单、方向键、物理键盘与真实输入法尚未验证。三档播放均实际揭示 28→31 根，播放中变速和精确倍率尚未验证。
3. **完整性边界。** 物理触控、真实读屏、原生系统日期选择器、完整键盘/响应式矩阵、真实 TradingView 工具功能和精确 1:1、业务数据保存及重开均未验证。非实现者本轮对候选画面作了静态视觉复核，独立浏览器交互受连接问题限制；协调者在真实 Chrome 进行了限定路径实操。

4. **Text 编辑和坐标边界。** 两条分散标注在 1440×900 的 Tab/Enter 编辑时互不改写、真实鼠标平移和价格轴拖动后日期/价格的一致性已由协调者[限定补测](text-anchor-pan-v7/REPORT.md)。原始 `text-keyboard-anchor-v5/` 中拟平移的起点命中卡片并打开编辑器，不能把该次手势记录当作平移成功；更密集状态、其他手势和持久化仍需验证。

[当前 40 项验收台账](ACCEPTANCE.md)列明每项的状态、证据和适用范围。局部通过不等于整页通过，也不代表用户已确认设计。

预览启动：在项目根目录执行 `PORT=3091 docs/design-system/start-design-preview.sh`，打开 `http://127.0.0.1:3091/design-system/baselines/2026-10-22-review-workspace-v1.0/prototypes/workspace-v0.1/index.html?variant=A&scene=entry`。
