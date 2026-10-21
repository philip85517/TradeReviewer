# 需求、参考与验收归属

基线 commit fcb30097；原稿保留 V2.4。root 负责整页视觉、阅读器与评论链路、独立验收。静态规范修订不读写业务数据库。

|问题/元素|准确参考（V2.4 source/images 下）|范围/旅程|Owner|验收证据/状态|
|---|---|---|---|---|
|D02 holdings.summary|holding-option-C-normal-1280.svg、holding-option-C-normal-1440.svg、holding-option-C-large-1280.svg、holding-option-C-large-1440.svg|所有正文持仓图及整页，正常/大额/空/加载/返回；C并列，搜索导出不挤压|holdings_c；root集成|待逐图比较 NOT VERIFIED|
|D01 table.header|`docs/design-system/baselines/2026-10-19-homepage-v2.4/source/images/home-1440.svg`|现有全角/建议半角；x=791.52/933.2/1126.4/1306.72；表头12px、数值14px、end anchor；viewBox=670 638 655 130；636.85/688.67/12.53万/+9,431.24|visual_options初稿；root原SVG集成；independent_review复核|候选；等待选择|
|D03 heading.roles|`source/images/home-1440.svg` nested current/history fragments|当前表现与当前持仓18/600，期间净盈亏16/600，历史已平仓18/700；候选调整历史标题字重，并将历史图表文字18px降为16px|visual_options初稿；root原SVG集成；independent_review复核|候选；等待选择|
|D07 chart.mode|`source/images/home-1440.svg` nested history y=1130|现有 `分期` / `净盈亏 · 分期`，2026按月与01–12轴；候选月度图稿：按月/每月净盈亏，年度命名以文字说明；保留原始坐标和完整图表|visual_options初稿；root原SVG集成；independent_review复核|候选；等待选择|
|D10 kpi.winrate|`source/images/home-1440.svg` nested history fragment|实际 `60.0%` 与 `6 / 10 盈利回合`，321x88 默认卡、278x88 窄卡（明确合成100.0%/1,000/1,000数据），候选并列与整句换行|visual_options初稿；root原SVG集成；independent_review复核|候选；等待选择|
|D11 contribution.labels|`source/images/home-1440.svg` nested contribution controls|分类/全局市场/排序标签；原色 #71829B，按钮36px/14px；候选14px标签|visual_options初稿；root原SVG集成；independent_review复核|候选；等待选择|

原诊断 D01–D17 的详细范围继续以 ../homepage-v24-ch12-diagnosis/LOCATIONS.md、locations.csv 为准。未在本表派发的条目仍未实施，不能视为通过。

## 对照原型证据

本轮触发为用户要求先看五项视觉取舍，不授权合并候选到正式规范。22个直接SVG裁切及源坐标、哈希记录于 visual-options/manifest.json；截图位于 visual-options/evidence/。浏览器1280×720，五项导航、图表展开与横向滚动均已实际操作。排除产品业务逻辑和数据库：本轮是静态设计对照。五项仍待用户选择，V2.4.1整体验收未完成。

## 第二轮视觉对照（用户最新反馈）
D03 标题层级和 D07「每月净盈亏」已确认；其余候选重新开放，首轮证据保留。

|元素|精确参考|本轮授权变化/旅程|Owner|验收|
|---|---|---|---|---|
|D01 表头|home-1440.svg root y660 与金额列|继续校准可见右边缘，原始单行与两行单位候选对照|root|浏览器截图，待验|
|D07/D09 期间与状态|同图 nested y1130，选择器 y14–68，图表 y214–534|独立矢量箭头、内容宽度；状态区不常驻文字，背景分色，hover/focus 原因|root|展开/选择/关闭/区域提示，待验|
|D10 胜率|同图 nested y1130，卡 x666 y82 w321 h88|主值与分母空间重分配，两种布局，不新增指标|visual_options|root 对照/独立复核|
|D11 贡献筛选|同图 nested y1712，x16 y110 w830 h72|更瘦的视觉边框、保留36px命中区；全局市场为只读上下文|visual_options|root 操作/视觉/独立复核|

产物限定 visual-options/round2，正式规范暂不合并未确认候选。root 负责整体视觉和原型状态接线；无业务持久化，数据库不适用。桌面 1280 对照，附 390 窄宽检查；触屏真机不在此次桌面视觉讨论范围。

## 第三轮：2026-10-21 用户选择与局部精修

准确参考为 `visual-options/round2/index.html`、`cards.html` 和 `evidence/d01-desktop.jpg`、`cards-desktop.jpg`、`cards-390.jpg`。沿用其源 SVG 与坐标；第三轮独立保存，不覆盖前两轮证据。

|ID / element|用户决定与本轮契约|Owner|旅程 / 空间预算 / 反例|证据与状态|
|---|---|---|---|---|
|D01.header|已选 A：单行表头与可见边缘校准|visual_options；root验收|查看已确认稿/辅助线；不移动数据列|round3/evidence，NOT VERIFIED|
|D03.roles|再次确认18/600功能区、16/600图标题|visual_options；root验收|查看确认说明；不改模块顺序|round3/evidence，NOT VERIFIED|
|D07.group|不同宽度独立按钮不协调；提供紧凑组合容器与等宽列两个明确候选，尚不设默认|visual_options；root验收|3字段展开/选择/Esc/外部关闭；独立SVG箭头，文字不截断，菜单不推动下游；1280/390及新增断点两侧|round3/evidence，NOT VERIFIED|
|D10.winrate|常规选 A，窄卡选 B；左主值与右计数共享文字基线，上方说明共享一行|visual_options；root验收|321px实际数据与278px长计数压力例；保留字号，不能数字/说明相撞|round3/evidence，NOT VERIFIED|
|D11.filters|已选 B 文本下划线；下拉视觉高度匹配周边28px，交互命中仍36px|visual_options；root验收|分类/排序/独立未平仓复选可组合；整行中心及文字对齐，展开不移位|round3/evidence，NOT VERIFIED|

root 负责整体验收、控件状态链与版本指纹；independent_review 负责未参与实现的截图复核。触发依据：用户指出控件宽高/文字对齐问题。范围为上述原型；业务计算、评论持久化、正式全篇图稿迁移不在本轮局部交付中。D09 沿用第二轮图稿与限制，纯 hover 仍 NOT VERIFIED，不能被本轮下拉测试抵消。
# 第四轮局部原型（2026-10-21）

触发：用户要求审查 D07/D10 两处修复后的原型。范围仅 `visual-options/round4`；前三轮与冻结 V2.4 保留。实现 visual_options，整体视觉及状态闭环负责人/独立验收 root；不连接业务数据库。

| 元素 | 准确参考与决定 | 修订/动线 | 验收证据计划 |
| --- | --- | --- | --- |
| D07-A | round3/index.html 的 #d07 A；本轮用户认可上轮文案建议；正式候选正文“历史已平仓” | 年份 2026/2025；每月净盈亏/累计净盈亏，保留 A 组合容器；展开、选择、Esc、外部关闭 | round4/evidence：1280/390 截图、菜单前后几何、实际点击与键盘 |
| D10-B | round3/index.html #d10；用户最新截图及“只需底部对齐”确认 | 窄卡百分比与计数同视觉底线；盈利回合与计数固定紧凑间距；常规 A 不变 | round4/evidence：常规/压力例截图，实际字体与文字边界 |

空/加载/错误、业务保存、触屏写入不适用：本轮为静态局部排版原型，无业务 API。其它模块不改动；导航及 D11 作相邻回归。交付仅表示本轮原型可审查，不关闭完整 V2.4.1 修复。
