# 01 — 单组合工作台：推进、调仓、回看与重开

ID: strategy-desktop-v2-01
State: closed
Status: accepted
Labels: ready-for-agent
Assignee: /root/desktop_workbench_01
集成负责人: /root
Source: [策略桌面端视觉与完整交互设计规格](../../strategy-portfolio-backtesting/issues/08-desktop-ux-design-spec.md)

> 用户已授权开发。本票为合成交互原型。实际模型：实现 gpt-6-luna / max，验收 gpt-6-astra / low。

## Scope / What to build

从现有创建入口进入一个合成组合，使用新的桌面布局从 T0 推进到首次建仓与一次再平衡，检查事件并回看早期，再返回列表重开原位置。完整验证单组合状态、真实图表和新信息层级；沿用已有双策略输入接口，不删除当前多组合能力，但多组合新联动由第 03 票验收。

范围外：不实现结果页、快速批量展开、多实验派生、数据异常恢复或比较页。这些已有入口保留当前行为/明确标记演示版本，不能伪称本票完成其新契约。

## Refs

- [桌面设计正文](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD02（125–144 行）、DD05–DD06（169–200 行）、DD08（212–218 行）、DD12–DD15（260–289 行）；T03/T05/T06/T12（321–330 行）。
- 需求：UX02、UX03、UX04、UX09、UX10；元素：E01、E02、E03、E04、E05、E06、E07、E12；用户故事：1、9、24、25、26、27、28、29、30、31、32、33、35、36、46、48、49、50；验收：T03、T05、T06、T12。
- [拆分与共同契约](../TICKET-PLAN.md)、[逐项覆盖矩阵](../DESIGN-COVERAGE.md)。
- [参考 creation-baseline-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg)。
- [参考 creation-baseline-1280.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg)。
- [参考 running-t0-1440.jpg](../../strategy-portfolio-backtesting/screenshots/running-t0-1440.jpg)。
- [参考 running-day1-1440.jpg](../../strategy-portfolio-backtesting/screenshots/running-day1-1440.jpg)。
- [参考 running-day5-1440.jpg](../../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg)。
- [参考 running-review-t0-1440.jpg](../../strategy-portfolio-backtesting/screenshots/running-review-t0-1440.jpg)。
- 参考是现有风格/旧状态，不是新设计批准画板；按正文目标和同状态新渲染对照，不能拿旧 PASS 替代本票。
- [项目拆票标准](../../../docs/agents/task-decomposition.md)、[UI 验收模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

None — 可立即开始。

## 输入/输出与最小整理

输入现有已创建组合配置；输出可重开的单实验会话投影、公开推进/回看动作及事件选择。保留现有创建到运行接口。必要会话整理作为本票开头的小范围前置步骤，先保住旧路径，再装配一屏验证；不新建通用引擎或大规模重构。

## 验收标准与反例

- [x] AC01：T0 默认净值起点为 1、总资产等于本金、累计收益 0、组合当日收益为“尚未开始”、实际持仓和成交为零；净值无虚构预热收益，K 线保留已知历史背景。
- [x] AC02：主图上方统一当前组合、四项资产摘要和时间控制；净值与 K 线切换、持仓定位、事件详情联动准确。两档桌面首屏可见当前日期、主要操作、主图和持仓摘要。
- [x] AC03：下一交易日和播放真实揭示新增 bar/净值点及同日持仓；不同速度不改变合成账本；超过初始图表视窗仍可见新 bar。暂停与离开停止推进。
- [x] AC04：至少经历首次建仓和周期调仓；事件用中性底，原因→旧/目标/实际→成交明细可读；抽屉关闭和键盘焦点恢复正确，不自动续播。
- [x] AC05：统一回看入口维护 V/M；回看 T0、已知事件和恢复最新不重复交易。事件列表/数量/图上标记截止 V；下一已知事件只可提示已展开日期/类型，不预显成交细节。
- [x] AC06：回看时行情、轴极值、tooltip、统计和持仓均不过 V；最远已看记录仍在。输入日期、查看配置暂停播放；速度切换可保持播放，快捷键不干扰输入/IME。
- [x] AC07：图上标 T0 和最新揭示点；手动平移与 resize 不推进、不丢用户视野；显式推进/跳事件把目标点带入视野。
- [x] AC08：返回列表并同会话重开恢复 V/M、组合、图表模式/标的、事件选择、暴露来源和视野；刷新清空标识真实，无数据库保存声称。
- [x] AC09：协调者独立完成真实图表最小旅程及 1440×900、1280×800 匹配状态视觉对照，接受后才放行依赖票。

核心反例：只改日期不展开真实图形；T0 显示假净值历史；回看泄露未来轴范围；打开详情拉长主图；重开重新建仓。

## 视觉与状态约束

- 1440×900、1280×800 CSS 视口，100%缩放；历史基线DPR1，新验收记录实际DPR。保留TradeReview侧栏/背景/蓝色主动作、6–8px圆角；本票元素遵守DD02尺寸、DD13字体和状态色。
- 先装配一屏代表性状态并独立看图，之后扩展其余状态。每票都完成自己的视觉/键盘检查，第08票只验集成，不补做前票门槛。
- 时间遵守DD06，运行V/M/各组Mᵢ、结果R及曝光来源由同一会话边界协调；字段不适用时按本票范围说明，不删除后续契约。
- 原型使用合成数据，返回重开只保留内存；无真实API/schema/数据库写入。窄屏暂不修改，不新增窄屏专项门槛。

## 验收证据

- 功能/时间状态：NOT VERIFIED；端到端浏览器：NOT VERIFIED；独立视觉：NOT VERIFIED。
- 计划记录于 acceptance/01.md，渲染证据放 screenshots/01/；这些是计划位置，文件未产生前不得当成证据。
- 数据库持久化：NOT APPLICABLE（本票内存原型）；正式产品要求保留在原产品规格。
- 协调者接受：未接受。任一必需FAIL/NOT VERIFIED都不能关闭票。

## 派发说明

- 实现/接线 owner: /root/desktop_workbench_01，gpt-6-luna/max。允许写入 app/components/strategy-prototype/ 下的 running-prototype.tsx / running-prototype.css 及运行专用新增模块 及 implementation/01.md。整页视觉/会话集成 /root，独立验收 /root/desktop_acceptance（gpt-6-astra/low）。
- 冻结现有 RunningDraft 和 RunningPrototype 的 draft/visible/onList/onReady/onStatus 兼容。不得改并行票文件，不操作浏览器；root取得首段真实图表及视觉证据后再扩大依赖实施。
- 本票只触及本切片所需原型模块及证据；不改普通业务数据、不创建新供应商体系、不推送/合并/发布。
- 每次UI交付提供仍运行且新鲜浏览器检查过的预览URL、启动方式与范围说明。自动化通过不能代替视觉或真实图表证据。

## 历史

- 2026-09-29：基于桌面UX v2生成拆分草案，等待用户确认拆分；未更改父票，未发布可领取任务，未实施。


- 2026-09-29：用户指定多个 Luna6 max 开发、Astra Light 验收；正式发布并开始执行；父票不变。

- 2026-09-29：root接受；每个AC的对应动作/截图/复验结论见[协调者验收](../acceptance/01.md)，独立静态代码/视觉见 reviewer-01.md。以上早期NOT VERIFIED是历史，最新状态以此接受记录为准。

- 2026-09-29：X01-03 盘中/休市T0的初始净值快照日期错误地使用最后完整行情日，可能令结果起点早于实际T0。范围内遗漏，局部重新打开；此前已通过证据保留。运行owner仅修正初始Snapshot日期，行情cutoff不变；等待盘中/休市模型及浏览器复验。

- 2026-09-29：root复核接受；X01-03盘中/周末NAV及T0 M日期修复、X03-01结果键盘隔离、X03-02active长名滚入均真实浏览器复验，Astra两档直接视觉通过；详见acceptance/01、03和reviewer03。历史FAIL保留。
