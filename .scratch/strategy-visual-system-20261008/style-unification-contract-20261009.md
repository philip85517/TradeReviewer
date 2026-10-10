# 完整 Workbench 与首页视觉复用 · 2026-10-09

用户授权：把当前恢复的旧完整策略复盘 Workbench 与“首页控件迭代 ｜ 图表区”可统一的视觉元素尽量统一和复用。属于既有样板的可逆视觉校准，继续当前远端任务分支基础，不改变业务布局、数据或回放契约；不推广正式根页面。

## 准确参考

- 当前首页工作树：`/Users/zhoulin/.codex/worktrees/0ff3/TradeReview`。实际 `/design-preview` 的“视觉调整”，不是已撤回的旧组件样板。参考仍是候选，不能称用户已批准全部参数。
- `docs/design-system/TradeReview-首页拉齐-v0.2.md`：文字与尺寸、颜色状态、例外与固化；`app/components/design-prototype/home-design-preview.module.css`：root token、recommended 规则、focus 及 coarse/narrow。
- 当前实际参考图：`evidence/style-unification-20261009/homepage-reference-1440.jpg`；CSS 1440×900、DPR1。首页数据不同，只比较视觉角色，不比较业务布局或图表数据。首次未固定新标签时为1280×720/DPR2，已重新采集1440，不能把首次测量当1440。
- 同数据修改前：`observe-before-1440.jpg`、`results-before-1440.jpg`、`compare-before-1440.jpg`，固定双策略、各10万、三个月、R/V/M截至2024-09-13。旧规格与阶段表继续 `full-restore-contract.md`，不减少字段。

## 推荐方向与例外

复用首页候选 page #0b1220 / surface #111a2b / raised #182337 / border #263650 / soft #213047 / text #e7edf6 / muted #adbbcf / action #2169cc / link #8cbdff / focus #9ecaff。正文和控件14/22/400–500、说明12/18/400、页标题24/32/600、分区18/26/600、主要指标24/32/500。数值tabular；中文不使用Mono，Geist在显式中文fallback之前且generic最后，不新增字体资源，不声称逐字命中已测。

36px桌面最小控件、44px窄屏/粗指针，保留既有更大命中框；radius6控件/8面板；8–12内距、16–24大分组。蓝色集中于主要动作/当前选择；hover/pressed/focus独立。Lucide操作图标18/stroke1.75，禁止给图表SVG套图标尺寸。保留盈亏设置、策略线色和计划/实际标记语义。Canvas只校准背景、轴文字/分隔和网格，不改价格数据、视野和时间范围。

同一页提供“原版样式 / 首页统一”可逆样式比较，仅class/视觉prop变化，不重挂Running、不重置截止/图表/组合/来源状态。默认统一。导航切面/演示预设仍按既有重开合同；说明区分样式切换与场景切换。整页root/数据root，唯一实现Luna，独立视觉审查另一代理。

观察页仍chart+持仓/事件；结果保留三图和完整账本/贡献/事件；比较保留矩阵、三图、独立本金/共同截止。不可把首页网格/nav尺寸搬到这里。不得为了14px规则截短事件/价格；12px完整事件补充是表内辅助角色。大数字可使摘要高一些，但不缩图抵偿。多行正文/固定判断无删减。

## 验收

1440×900、1280×800观察/结果/比较同数据两样式；390×844检查控件换行/44命中、价格全文可达，窄屏表格可局部横滚。每次记录实际CSS viewport/DPR和截图尺寸。真实Tab焦点/选中；原版→统一后截止、金额、图表范围不变。T0下一日实际bar/首次成交；运行播放暂停；结果三图/比较三图、事件→回看→返回的来源状态。无数据库写，本票持久化NA；已有完整回放/Tooltip/触摸/中文命中未验证不因此宣称通过。

检查scope ESLint、typecheck、diff-check；不写CSS实现镜像测试。root先核对一屏代表画面，再扩展/修正，独立看图接受。原票01总体验收缺口继续保留；本票只接受视觉统一及受影响旅程。
