# V2.4.1 历史与贡献传播覆盖

更新时间：2026-10-21。任务：V241-08；实施者：`/root/history`；整合与独立验收：`/root`。

## 触发、边界与冻结项

触发来自 `.scratch/homepage-v241-repair/issues/08-history.md`：把已确认的第五轮历史曲线与贡献柱原型传播到当前源图稿，并补齐“历史期间／指标切换 → 唯一底部贡献区 → 市场明细 → 标的详情连接 → 返回”的完整分镜。该工作只修改文档关联图稿，不修改产品、业务数据库或冻结的历史副本。

锁定的依据是 `docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/visual-design.candidate.md` 第 2、4、6、9、10 章，及已确认的 `prototypes/round5/history.html|js|css`、`contribution.html|js|css` 与 `prototypes/round5/evidence/*`。第四轮 `prototypes/round4` 的 D07-A、D10-B 与 D11-B 选择继续保留。原型的候选颜色、纯 hover、物理触屏、完整交易详情和业务持久化边界不升级为已验收事实。

允许变更：`source/images/history*.svg`、`journeys-year.svg`、`contribution*.svg`、`period.svg`、`chart*.svg`，以及本目录下的证据、报告和可应用补丁。禁止直接改 `source/visual-design.candidate.md`、任何 `home*.svg`、`visual-samples-board.svg`、其它源文件和历史冻结副本；整页嵌入历史/贡献的改动只写入 `shared.patch` 或可应用脚本，由 root 串行合入。

## 版本、视口与证据约定

|项目|冻结值|
|---|---|
|版本/工作树|V2.4.1；本工作树 `/Users/zhoulin/.codex/worktrees/12f2/TradeReview`；不启动产品服务、不读写业务库|
|桌面比较|1440×1000（源图整页）、1280×800（源图整页）；原型证据 1440×900、1280×800|
|窄边界|680×900 原型横向阅读；不新增移动端布局；触摸未验收|
|固定布局|历史位于持仓之后、贡献之前；首页只存在一个底部贡献区；局部源图与整页嵌入保持同一坐标层级/间距|
|视觉基线|图标题 16/600；模块标题 18/600；线 2px、点径 6px；零线 `#A8B6CB`、网格 `#283448`；历史共外框 282×36，值 14px、独立 chevron；字段名仅保留于 group `aria-label/title`，不在画布可见；控制命中高 36px|
|状态判定|真实零、无回合、未来、缺失、失败分别记录；缺证据写 `NOT VERIFIED`，不以 XML、链接或旧归档 PASS 替代截图/渲染|

## 逐项覆盖矩阵

表中 `elementID` 与当前覆盖表一致；“准确参考”同时列规范源图和已确认原型，避免旧候选成为新依据。`/root` 负责最终传播/独立视觉比对；本组负责局部源图与可应用整页补丁。

|需求/规格|elementID|准确参考与目标图稿|状态/视口|用户操作|可观察结果与反例|证据/结论|
|---|---|---|---|---|---|---|
|D03|`history.heading.roles`|`source/images/history.svg`；round5 `history.html`；正文第 6 章|默认历史区；1440×1000、1280×800|进入首页历史区，观察模块顺序与标题层级|历史位于持仓后、贡献前，标题 18/600、图题 16/600；反例：历史挤入当前区或新增贡献区|`evidence/updated/history.png`；局部源图静态渲染 PASS；整页传播由 root 独立验收|
|D04/D05|`history.kpi-axis`|`history.svg`、`history-stats-win.svg`、`history-stats-rounds.svg`；正文第 6 章|净盈亏、胜率、回合；正常；1440/1280|切换指标：每期→累计→胜率→回合|卡片、标题、轴单位、tooltip 同一数据口径；金额/百分比/整数回合不混轴，最多 7 刻度；反例：胜率显示金额刻度或无回合显示 0%|`evidence/updated/history.png`,`history-stats-cumulative.png`,`history-stats-win.png`,`history-stats-rounds.png`; 局部静态渲染 PASS；四张整页金额嵌入保留 9,000/6,500/4,000/1,500/−1,000 五条刻度，并在 1,500 与 −1,000 之间插值真实零线 `y=470`；整页传播/交互由 root 独立验收|
|D06|`history.period-axis`|`history.svg`、`history-stats-cumulative.svg`、`journeys-year.svg`；round4 D07-A|单年/月；跨年/年；1440/1280/680|选择 2026、2025、跨年/全部；切换分期/累计|单年显示 1月…12月，跨年显示 2024/2025/2026；标题分别为“每月净盈亏/累计净盈亏”或“每年…”；绘图区/控件位置不抖动；反例：跨年仍用月份或泄漏未来|`evidence/updated/history.png`,`history-stats-cumulative.png`,`journeys-year.png`; 1–12月/2024–2026 与控件静态渲染 PASS；窄屏/整页传播由 root 验收|
|D07|`history.mode-range`|`history.svg`、`journeys-year.svg`；round5 `history.js/css`|每期/累计；范围成功/加载/失败；1440/1280/680|键盘 Tab/Home/End/Arrow/Enter/Escape；鼠标菜单选择；重试|范围成功同时更新四卡、曲线、历史贡献；加载保留空间；失败保留旧范围/数据，重试后再应用；反例：新增 Apply、卡片与曲线不同步、失败伪清空|局部源图保留四卡/曲线/加载失败空间，`evidence/updated/history.png`,`journeys-year.png`; 静态 PASS；键盘、鼠标、运行时整页 NOT VERIFIED，root 负责|
|D08|`history.zero-empty`|`history-stats-empty.svg`；正文第 6 章|真实零、有已平仓回合；无回合；1440/1280|查看零值点并聚焦无回合区段|真实零保留点和回合数；无回合为低干扰背景、胜率“—”，焦点说明“该期间无已关闭回合”；反例：无回合当作 0% 或画出假趋势|`evidence/updated/history-stats-empty.png`,`history-stats-win.png`,`history-stats-rounds.png`; 真实零/空区背景/胜率“—”静态 PASS；hover/焦点 NOT VERIFIED|
|D09|`history.future-missing-error`|`history-stats-source-missing.svg`、`history-stats-error.svg`、`history-stats-extreme.svg`|未来、缺失、加载、失败；1440/1280/680|选择含未来/缺失的范围；触发失败→重试；键盘聚焦状态|未来区域中性灰、不连线、不出点；缺失断线并给原因，累计缺失向后传播；失败保留旧范围与旧数据；反例：未来补零、缺失连线、错误清空旧图|`evidence/updated/history-stats-source-missing.png`,`history-stats-error.png`,`history-stats-extreme.png`; 状态背景/边界/静态轴 PASS；纯 hover、运行时重试 NOT VERIFIED|
|D14|`history.point-focus`|`history.svg`、`history-stats-extreme.svg`；整页参考 `round5/reference/home-1440.svg`|边缘点/极值；1440/1280/680|键盘 Home/End/相邻箭头/Enter/Escape；单独 pointer hover|点径/线宽/十字线/tooltip 避让一致，读数及状态原因可访问；反例：只改 DOM 状态、tooltip 遮住点、把键盘证据冒充 hover|`evidence/updated/history.png`,`history-stats-extreme.png`; 局部静态线宽 2px/点径 6px PASS；D14 board 的 r3/画布文字删除由 root 已合入；键盘/纯 hover NOT VERIFIED|
|D11|`contribution.shell`|`contribution.svg`、`contribution-states.svg`；正文第 6 章；round5 contribution|唯一底部区；当前/历史；1440/1280/680|在历史区后进入贡献区，切换当前/历史|贡献是首页唯一底部模块，切换只更新该模块；整页 preview 保留单一“盈利最高”下拉、28px 视觉面/36px 命中、独立 SVG chevron、相邻 checkbox 与全局市场选择器；历史模式 checkbox 保留且禁用；反例：在历史卡下新增第二个贡献区或切换影响当前表现|`evidence/updated/contribution.png`,`contribution-states.png`,`contribution-historical-a-share.png`,`evidence/shared-rendered/home-*.png`; 局部状态静态 PASS，四张整页 preview 及守卫 PASS；整页唯一底部/运行时切换由 root 验收|
|D12|`contribution.bar-geometry`|`contribution-states.svg`、`contribution-mixed-sign-demo.svg`、`contribution-extreme.svg`|双正/双负/异号/极小/真零/未知；1440/1280|查看正负及极小值；切换历史模式|已实现实心、浮动中空；两段均 14px 外高，从零线向两侧堆叠；中空柱内部 12px、四边各内缩 1px；极小值不加假最小宽；未知“不可计算”，真零中性 0.00；负柱几何使用 `#EF7F89`，负数文本仍为 `#FF8592`；反例：异号同侧、0.00 有假柱、未知当零|`evidence/updated/contribution-states.png`,`contribution-mixed-sign-demo.png`,`contribution-extreme.png`,`evidence/static-check.json`; 14px 外高/异号/极小静态 PASS；运行时筛选 NOT VERIFIED|
|D13|`contribution.drilldown-return`|`contribution-current-a-share.svg`、`contribution-historical-a-share.svg`、`contribution-states.svg`；正文第 6 章|全部市场→A股→标的→详情连接→返回；当前/历史；1440/1280/680|点击市场汇总条；点击标的；进入详情连接占位；Escape/返回|市场汇总三条→A股标的 8 行分页→详情连接；返回恢复模式/筛选/页码/滚动/焦点；整页 preview 只补选择器面/命中区/箭头，不写产品内动线日志；反例：泛化跳转、总额按页变化、返回丢焦点或新增全局市场|`evidence/updated/contribution-current-a-share.png`,`contribution-historical-a-share.png`,`evidence/shared-rendered/home-*.png`; 详情静态分镜 PASS；完整详情/返回焦点/触屏/运行时 NOT VERIFIED|

## 本轮静态复验记录（2026-10-21）

局部源图通过 `node .scratch/homepage-v241-repair/work/history/render-evidence.mjs` 由 SVG 实际栅格化到 `evidence/updated/*.png`，并对历史、年度、贡献状态逐张目视检查。关键几何与状态如下：

|图组|本轮确认|
|---|---|
|历史正常/累计|范围与展示方式合并为一个 282×36 控件；月份为 1月…12月；KPI `+3.00万`，金额轴对 ≥1万值按 `万/亿` 保留两位；原始系列保留；四张整页嵌入使用原五条金额刻度并将 0 线插值到 y470|
|胜率/回合|局部胜率 0% 与回合 0 的零线分别在绘图区底部 `y=490`；局部金额普通图/极值图按各自轴计算零线；无回合 2/5/8 月保留低干扰背景；四张整页金额嵌入的五条原刻度保持不变，1,500@440 与 −1,000@490 之间的真实零线为 `y=470`|
|空/缺失/失败/未来|空状态覆盖 `data-state=empty`；缺失覆盖 `data-state=missing`；未来使用 `data-state=future-zone` 且不连线不出点；产品画布中的“无回合/未来未覆盖”说明已移除，图外规范说明保留|
|年度|轴标签为 2024/2025/2026；年度范围值与箭头不重叠（第一箭头 x=1192，分隔线 x=1216，第二箭头 x=1306，均在 1102..1384 shell 内）|
|贡献|局部明细保留 14px 实心/浮盈中空柱；中空柱四边内缩后外高仍为 14px；异号从零线两侧绘制；缺少估值为“不可计算”；当前/历史 A股静态明细保留 8 行分镜，不再把市场→标的→详情→返回路径写进产品画布|

历史曲线 token 为 `stroke-width=2`、点 `r=3`（直径 6）；这与 round5 `history.js` 及正文约定一致。D14 公共 sample board 的点径与画布文字清理已由 root 合入，本组没有重复修改该文件。

## 状态与传播验收记录

|阶段|通过条件|当前记录|
|---|---|---|
|局部原型|round5 已确认的历史与贡献状态、键盘/详情返回证据保留身份|原型范围 PASS；纯 pointer hover、物理触屏、完整交易详情和完整下拉重测仍 `NOT VERIFIED`（见 round5/evidence/ACCEPTANCE.md）|
|局部源图|允许清单内图稿与 round5 参考在同状态、同视口渲染一致；状态标签/轴/几何可见|静态栅格渲染 PASS：`evidence/updated/*.png`；浏览器 hover/键盘交互未验|
|整页嵌入|四个 `home*.svg` 的历史/贡献片段与局部源图同步，顺序、外层间距和 1440/1280 比例不变|`apply-shared-embedded.mjs --preview` 已输出四张可复核整页 preview 与 PNG；未直接修改 home 源文件，root 需 `--apply` 后进行独立浏览器/截图验收|
|独立验收|实施者之外的 root 以实际渲染/浏览器截图逐状态比较；各门分别记 PASS/FAIL/NOT VERIFIED|root 负责；本报告不把局部证据升级为整页 PASS|

## 排除项

业务接口、数据库、保存/刷新持久化、产品运行时、完整交易详情布局、当前表现曲线完整交互、物理触屏与未执行的纯鼠标 hover 均不属于本次静态图稿交付。它们在报告中保留 `NOT VERIFIED` 或 `NOT APPLICABLE` 的理由，不用旧任务归档结论覆盖。

## 整页补丁与独立验收边界

`work/history/apply-shared-embedded.mjs` 只在 `--apply` 时写四个整页 SVG；默认 `--check` 不写文件，`--preview` 写 `evidence/shared/*.svg`。脚本使用平衡 `svg` 深度定位历史与贡献子图，保留原始 series、轴标签、host 子图顺序和 viewBox；它不会把详情路径说明写回产品画布。root 应先执行 `--check` 与 `--preview`，浏览四张 `evidence/shared-rendered/*.png`，再决定是否 `--apply`。

本环境没有可用的真实浏览器 tab：`cua.getState()` 返回空 tab，`file://` 被禁用，临时 HTTP 服务受 socket 权限限制。因此浏览器截图、鼠标 hover、键盘/物理触摸、整页市场→A股→标的详情连接占位→返回焦点恢复，以及产品运行时数据同步均记录为 `NOT VERIFIED`，不能由 sharp 栅格证据替代。root 的独立验收必须复查 1440×1000 与 1280×800，并保留失败截图/重开 issue。
