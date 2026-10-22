# 第五轮独立复核记录

复核者：round5_acceptance（未实现这两组页面）；日期：2026-10-21。

**结论：本轮静态设计合同与独立截图比较通过。未发现仍未关闭的重大重叠、表头/数值列错位或贡献正负分段错误。此结论是独立复核的一道验收门，不替代 root 的真实浏览器动作验收。**

## 范围与证据边界

复核历史图表 D05–D09、D14，以及贡献 D12–D13；检查既有 D07 A、D10 正常 A / 窄 B、D11 B 的保留。先读 `DESIGN-COVERAGE.md`、正式 `visual-design.candidate.md` 相关章节和参考图，再检查源码与渲染，未以 worker NOTES 代替正式规范。未修改实现，没有操作浏览器，未接触数据库。root 负责鼠标和键盘实测；本复核者直接用图像工具打开截图，独立比较参考与成品。

本轮是两个局部静态原型，不是全首页落地：当前表现曲线仅线条样式参考，其完整读数交互排除；贡献详情仅连接占位与返回状态，完整既有交易详情容器/回合集合排除，不宣称已验收。新颜色/点径等候选仍由用户评审，不替换冻结规范。窄屏维持可横滚的画布，不引入新的移动端布局。

## 直接查看的视觉证据

- 参考：`reference-history-1440.png`、`reference-contribution-1440.png`。
- 历史：`history-initial-fail.png`（保留初稿失败证据）、`history-normal-1440.png`、`history-normal-1280.png`、`history-future.png`、`history-missing.png`、`history-annual.png`、`history-extreme.png`、`history-narrow-680.png`。
- 贡献：`contribution-all-1440.png`、`contribution-historical.png`、`contribution-detail-stub.png`、`contribution-legacy.png`、`contribution-edge.png`（12:07 真零修正后）、`contribution-extreme.png`、`contribution-1280.png`、`contribution-680.png`。

比较按同宽模块区域进行；参考整页和局部裁切的外部文档说明区不属于产品布局。1440/1280 的模块密度、层级、列边界和控制区比较；680 仅检查保持画布后可阅读，横向滚动可达性由 root 实际验证。

## 独立检查结果

|范围|结果|证据|
|---|---|---|
|历史布局|PASS：保留标题/范围、四个等宽统计卡、下方单图；局部裁切有标注，未冒充重排首页|normal 1440/1280 与 reference-history|
|历史 D10|PASS：正常 A 数量与“盈利回合”同排，窄 B 上说明下数量，数量与胜率主值基线对应|最新 normal 1440/1280、extreme|
|历史数据与轴|PASS（源码+截图）：年度由月数据派生；卡片独立于图表指标；金额万/亿，数量整数，完整刻度含零线|history.js；normal/annual/extreme|
|历史状态|PASS（源码+截图）：未来不连假曲线，缺失后累计停止，独立背景，无假零；保留旧范围和数据的失败路径存在|future/missing；history.js|
|历史焦点结构|PASS（源码）：读数覆盖层和 SVG 结构分离，不在 hover/focus 时重建主图；真实键盘动作由 root 验收|history.js render/show/status|
|贡献布局与对齐|PASS：1440/1280 未见控制区/表头/数值重叠；数字列共用右边界；单一底部贡献模块|all/1280/historical/detail-stub|
|贡献几何|PASS：同号实心/中空相接，异号零线两侧；外高度相同；中空改内阴影，不以边框撑大极小宽度；零无假长度|legacy/extreme/edge + segment()|
|贡献语义|PASS：旧配色图例与蓝色中空相符；新配色按每段正负；历史无浮盈段；未知中性不可计算，真零中性0.00|legacy/historical/edge最新图|
|贡献过滤和恢复|PASS（源码）：分类/排序应用到数据；全局市场与局部下钻区分；当前/历史状态独立；固定8行；分页聚焦首行；详情按market+name匹配|sourceRows/modeRows/syncControls/handlers|
|D11复用|PASS（源码+外观）：复用 round4 ui-select.js；合法14px字体，28px视觉面/36px命中区；mode恢复同步可见label/aria-selected|HTML/CSS/syncSelectLabels，all/1280|
|详情边界|PASS（本轮范围）：截图明确“详情连接占位”“仅验证返回”，不再冒充真实回合集合；非模态Tab trap已移除|detail-stub最新图；openDetail/keydown|

下钻总量口径：root 明确为本市场全量符合条件标的之和，非当前页之和。源码符合该口径，局部下钻图已注明“市场全量合计”；不将它误解为全部市场总量。

## 复核中发现并关闭的问题

|编号|发现|修正及关闭证据|
|---|---|---|
|R1|D10 所有宽度都变成两行说明，正常宽未保留 A|容器条件恢复正常A/窄B；最新两宽截图关闭|
|R2|D11 原生28px select，命中区、统一箭头和字体不符|复用 round4 helper和28/36结构；源码与新图关闭|
|R3|头部总量固定绿色，未知/负值语义错误|按正负未知赋类；edge中性图与源码关闭|
|R4|旧配色浮盈柱蓝色，图例仍绿色|图例随palette更新；legacy图关闭|
|R5|2px border可能将极小中空段撑到4px|无外边框，内阴影限制在真实宽度；源码/edge图关闭|
|R6|新内联金额表冒充既有交易详情，非模态仍锁Tab|明确仅连接占位，显示说明，去除Tab trap；新图/源码关闭；完整详情仍排除|
|R7|自制select只同步native change，mode恢复可见文案滞后，键盘/外部关闭不完整|复用round4 helper，syncControls补label和aria同步；源码关闭，root负责真实动作回归|
|R8|边界合计浮点误差使真零显示绿色+0.00|按分归一化后判符号和格式；12:07 edge图显示中性0.00|

## 尚不属于本独立结论的声明

- 鼠标、键盘、重试、模式记忆、下钻、分页、返回与窄屏横滚：root 真实浏览器验收记录负责；本复核者不冒领直接操作证据。
- 数据库/持久化为 NOT APPLICABLE：明确的静态fixture原型，无业务数据写入。
- 物理触屏、实际当前曲线读数、完整交易详情容器：NOT VERIFIED/本轮排除，不作为通过项。
- worker NOTES 与最终实现同步、coverage最终状态、预览服务和启动说明由root完成；初稿失败记录保留。

## 复核版本

以下源码 SHA-256 固定本结论对应的实现；若修改影响布局或交互，应补做受影响复核。

|文件|SHA-256|
|---|---|
|`history.html`|`e1d1b29a6bacf9efdc0dc5b9e0cd47d73b4bfb27cb28d05a3e98a18acca3817e`|
|`history.css`|`e8dd7485f216c95aa4fce2ceb7e21ed1fb004796125a1b14e4593c1c090eb0b0`|
|`history.js`|`ae567ca67aff8e8409d1f3710e9c97631d37e7e5b2c3385548aeb4e285f9fd61`|
|`contribution.html`|`30ab51e0d130a9285be9a127f2f14d36849c07dc0fbf7e73e9191628b082a2fd`|
|`contribution.css`|`cee73ab85fb7d439b1894c3affb97b326651a942a03eeee0d3e8fc3b034c4f25`|
|`contribution.js`|`983ac51b412eab5e9505a002b3ac207f4c609edfa6ea49a8dfde93f784a83af0`|
