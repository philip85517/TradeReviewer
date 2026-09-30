# 04 — 配置派生：保留原实验并重开多个实验

ID: strategy-desktop-v2-04
State: closed
Status: accepted
Labels: ready-for-agent
Assignee: /root/desktop_creation_02
集成负责人: /root
Source: [策略桌面端视觉与完整交互设计规格](../../strategy-portfolio-backtesting/issues/08-desktop-ux-design-spec.md)

> 用户已授权开发。本票为合成交互原型。实际模型：实现 gpt-6-luna / max，验收 gpt-6-astra / low。

## Scope / What to build

运行中的配置只读；用户基于它新建草稿、修改、取消或生成另一实验，原实验可从列表重新打开并保持原进度。两个实验在同一内存会话并存，列表按状态提供准确入口。

范围外：不引入数据库/localStorage或宣称刷新持久化，不支持覆盖已运行实验。普通跨实验比较不属于本票；第 07 票仅比较同一实验中的策略组合。

## Refs

- [桌面设计正文](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD10（242–250 行）、DD07 暴露来源（202–210 行）、DD06（177–200 行）；T08（326 行）。
- 需求：UX01、UX04、UX06、UX09、UX10；元素：E01、E02、E09、E12；用户故事：2、33、44、45、46、49；验收：T08、T03、T12。
- [拆分与共同契约](../TICKET-PLAN.md)、[逐项覆盖矩阵](../DESIGN-COVERAGE.md)。
- [参考 creation-baseline-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg)。
- [参考 creation-baseline-1280.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg)。
- [参考 creation-ready-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg)。
- [参考 running-review-t0-1440.jpg](../../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg)。
- 参考是现有风格/旧状态，不是新设计批准画板；按正文目标和同状态新渲染对照，不能拿旧 PASS 替代本票。
- [项目拆票标准](../../../docs/agents/task-decomposition.md)、[UI 验收模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

- [01 — 单组合工作台：推进、调仓、回看与重开](01-single-portfolio-observation.md)。
- [02 — 四步创建：策略包选择、候选解释与确认进入](02-guided-creation.md)。

## 输入/输出与最小整理

依赖第 01 票稳定运行恢复，以及第 02 票新草稿确认/失效规则。将单实验内存槽替换为有稳定实验身份的会话集合，统一保存/恢复界面投影；只做本票需要的内存结构调整。

## 验收标准与反例

- [x] AC01：查看运行配置先暂停，不改账本；没有会无提示清空运行的编辑入口；展示选项改变不使运行失效。
- [x] AC02：“基于此配置新建实验”复制配置形成有来源的新草稿；不复制旧成交、旧候选或无效覆盖确认；首次打开即可区分原/派生实验。
- [x] AC03：取消新草稿→回到原实验时 V/M、组合、图表、视野及原事件仍在；创建新实验后两者可分别进入和重开。
- [x] AC04：派生设置经第 02 票四步流程重新预览/确认，原实验金额、配置和结果不随新草稿变化。
- [x] AC05：新实验保留来源已查看至的提示，不能把复制已看过后续的实验标成从未暴露；新运行仍从自己的 T0 开始，来源提示不带入未来数值。
- [x] AC06：列表展示起点、组合数、来源、状态、已展开日期；草稿/待开始/暂停/已完成入口准确，切实验前停止当前播放。
- [x] AC07：同会话切换恢复各自图表状态与曝光来源；刷新重置标识诚实；未配置真实存储时无“保存成功”。
- [x] AC08：两档桌面与键盘完成查看配置→派生→取消/创建→原实验重开；来源名称过长仍可辨识。

核心反例：修改一个日期就销毁原运行；派生实验继承旧持仓；切列表后播放仍在后台推进；内存写入称为保存。

## 视觉与状态约束

- 1440×900、1280×800 CSS 视口，100%缩放；历史基线DPR1，新验收记录实际DPR。保留TradeReview侧栏/背景/蓝色主动作、6–8px圆角；本票元素遵守DD02尺寸、DD13字体和状态色。
- 先装配一屏代表性状态并独立看图，之后扩展其余状态。每票都完成自己的视觉/键盘检查，第08票只验集成，不补做前票门槛。
- 时间遵守DD06，运行V/M/各组Mᵢ、结果R及曝光来源由同一会话边界协调；字段不适用时按本票范围说明，不删除后续契约。
- 原型使用合成数据，返回重开只保留内存；无真实API/schema/数据库写入。窄屏暂不修改，不新增窄屏专项门槛。

## 验收证据

- 功能/时间状态：NOT VERIFIED；端到端浏览器：NOT VERIFIED；独立视觉：NOT VERIFIED。
- 计划记录于 acceptance/04.md，渲染证据放 screenshots/04/；这些是计划位置，文件未产生前不得当成证据。
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

- 2026-09-29：依赖01/02已由root接受；派发 /root/desktop_creation_02（gpt-6-luna/max）。精确可写范围、提供方/消费方及接口见[03–05集成契约](../INTEGRATION-03-05.md)。root整页视觉/状态，Astra/low独立验收。

- 2026-09-29：root已接受本票，全部AC证据见acceptance/04.md及reviewer-04.md；历史NOT VERIFIED仅代表前轮，最新功能/浏览器/独立两档视觉PASS。不代表全功能完成。
