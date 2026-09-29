# 05 — 单组合结果：阶段分析、完整结果与事件回看

ID: strategy-desktop-v2-05
State: closed
Status: accepted
Labels: ready-for-agent
Assignee: /root/desktop_workbench_style_01
集成负责人: /root
Source: [策略桌面端视觉与完整交互设计规格](../../strategy-portfolio-backtesting/issues/08-desktop-ux-design-spec.md)

> 用户已授权开发。本票为合成交互原型。实际模型：实现 gpt-6-luna / max，验收 gpt-6-astra / low。

## Scope / What to build

用逐日/播放达到阶段或终点，进入一个组合的结果，查看净值、回撤、仓位和损益明细，从结果点选调仓回到过程，再恢复来源结果区间和位置。结果来自当前合成账本，贯通读取/计算/展示/导航。

范围外：不依赖尚未实现的快速展开；本票可用已验收逐日方式到终点。多组合叠图与可比较性矩阵由第 07 票交付；不实现真实费用引擎或年化扩展。

## Refs

- [桌面设计正文](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD09（220–240 行）、DD12（260–266 行）、DD06（177–200 行）、DD13（268–275 行）；T09（327 行）。
- 需求：UX02、UX03、UX05、UX09、UX10；元素：E01、E03、E07、E08、E12；用户故事：24、38、39、40、42、43、49；验收：T09、T05、T12。
- [拆分与共同契约](../TICKET-PLAN.md)、[逐项覆盖矩阵](../DESIGN-COVERAGE.md)。
- [参考 creation-baseline-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg)。
- [参考 creation-baseline-1280.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg)。
- [参考 running-nav-1280.jpg](../../strategy-portfolio-backtesting/screenshots/running-nav-1280.jpg)。
- [参考 running-year-cash-1280.jpg](../../strategy-portfolio-backtesting/screenshots/running-year-cash-1280.jpg)。
- 参考是现有风格/旧状态，不是新设计批准画板；按正文目标和同状态新渲染对照，不能拿旧 PASS 替代本票。
- [项目拆票标准](../../../docs/agents/task-decomposition.md)、[UI 验收模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

- [01 — 单组合工作台：推进、调仓、回看与重开](01-single-portfolio-observation.md)。

## 输入/输出与最小整理

消费第 01 票账本投影与事件定位动作；提供有截止 R 的结果投影和来源上下文。计算属于合成数据的可核算展示，不扩展为生产回测模块。

## 验收标准与反例

- [x] AC01：T0 解释暂无可分析区间；阶段结果默认截止 V；主动查看更多已展开区间时显示 R，R 不越过可用边界。结果与过程有各自准确标题。
- [x] AC02：逐日到终点后主操作变为“查看回测结果”，能真正进入结果；不再只留失效播放按钮，不把期末未平仓虚构成清仓。
- [x] AC03：显示区间/完整性/数据口径；累计收益、最大回撤、期末总资产、调仓次数与同一账本一致。
- [x] AC04：净值/回撤/仓位三种真实曲线可切，仓位包含现金时间序列；合成结果数值仍可核算，不用固定截图或与账本无关的随机曲线。
- [x] AC05：损益分为已平仓回合净盈亏、持仓浮盈亏，提供标的贡献、费用/滑点与换手说明及成交明细；原型零费用写零，未知/不支持项写原因，不编造非零成本或调仓因果收益。
- [x] AC06：“组合当日收益”采用组合总资产口径，不复用交易室当日盈亏率分母；零回合胜率不可计算，无基准不能伪造超额收益。
- [x] AC07：结果点事件→选中准确组合/事件日/标的，按日投影、不越界；返回来源结果恢复 R、筛选及滚动；普通返回过程恢复进入结果前 V。
- [x] AC08：两档桌面验收指标→主曲线→归因明细层级、空/零交易与未知状态；鼠标与键盘导航均有证据。

核心反例：回看早期却默认展示期末收益；结果回过程跳错日期；净值曲线与总资产不一致；未平仓被当已实现利润。

## 视觉与状态约束

- 1440×900、1280×800 CSS 视口，100%缩放；历史基线DPR1，新验收记录实际DPR。保留TradeReview侧栏/背景/蓝色主动作、6–8px圆角；本票元素遵守DD02尺寸、DD13字体和状态色。
- 先装配一屏代表性状态并独立看图，之后扩展其余状态。每票都完成自己的视觉/键盘检查，第08票只验集成，不补做前票门槛。
- 时间遵守DD06，运行V/M/各组Mᵢ、结果R及曝光来源由同一会话边界协调；字段不适用时按本票范围说明，不删除后续契约。
- 原型使用合成数据，返回重开只保留内存；无真实API/schema/数据库写入。窄屏暂不修改，不新增窄屏专项门槛。

## 验收证据

- 功能/时间状态：NOT VERIFIED；端到端浏览器：NOT VERIFIED；独立视觉：NOT VERIFIED。
- 计划记录于 acceptance/05.md，渲染证据放 screenshots/05/；这些是计划位置，文件未产生前不得当成证据。
- 数据库持久化：NOT APPLICABLE（本票内存原型）；正式产品要求保留在原产品规格。
- 协调者接受：未接受。任一必需FAIL/NOT VERIFIED都不能关闭票。

## 派发说明

- 尚未分派。实现默认使用gpt-6-luna / max的有界任务；同一切片指定唯一会话/接线owner与整页视觉owner，协调者独立接受。不因前后票共享文件增加虚假产品依赖。
- 发布后、实际派发前填实际代理及精确可写文件范围；共享文件唯一writer，必要时串行落地或由接线owner集成。不得同时派发两个代理修改同一文件。
- 本票只触及本切片所需原型模块及证据；不改普通业务数据、不创建新供应商体系、不推送/合并/发布。
- 每次UI交付提供仍运行且新鲜浏览器检查过的预览URL、启动方式与范围说明。自动化通过不能代替视觉或真实图表证据。

## 历史

- 2026-09-29：基于桌面UX v2生成拆分草案，等待用户确认拆分；未更改父票，未发布可领取任务，未实施。


- 2026-09-29：用户指定多个 Luna6 max 开发、Astra Light 验收；正式发布并开始执行；父票不变。

- 2026-09-29：依赖01/02已由root接受；派发 /root/desktop_workbench_style_01（gpt-6-luna/max）。精确可写范围、提供方/消费方及接口见[03–05集成契约](../INTEGRATION-03-05.md)。root整页视觉/状态，Astra/low独立验收。

- 2026-09-29：root已接受本票，全部AC证据见acceptance/05.md及reviewer-05.md；历史NOT VERIFIED仅代表前轮，最新功能/浏览器/独立两档视觉PASS。不代表全功能完成。

## 2026-09-30 最终交互复验缺陷

X07-03/04：root实际Single EMA7/12仓位归属、事件忽略旧quality筛选通过，最终冻结复验待收口。X07-05/P2：root实际比较→6/21部分成交→交易B，抽屉关闭且来源返回入口消失；Astra静态确认DD09违规，同时局部重开05的交易定位后来源返回。唯一runtime owner comparison_runtime_resume修复running TSX/CSS。X07-06/P2：失败Mi/预设/排除原因10–10.5px，小于DD13关键12px；UI owner修复。X07-07/P2：root实测同entryId2、单组EMA7/12、仓位、partial事件筛选，scroll290→事件→返回来源比较后scroll0；UI owner修复hidden后覆盖scroll记录。

准确引用：DD06 177–200、DD09 220–240、DD13 268–276；C19/C20/C26/C28，E04/E07/E08/E12。前序证据保留，05仅上述source-return局部重开，07仍acceptance-failed，08未放行。root负责实际路径与两档视觉，Astra独立对照。

2026-09-30 root：07 AC01–07 ACCEPTED（acceptance/07.md、reviewer-07第十一阶段）。X07-01–08关闭，05来源返回局部回归重新ACCEPTED。01–07均接受；08开始全新冻结版本集成验收，整体尚未接受。
