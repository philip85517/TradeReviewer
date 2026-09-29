# 07 — 组合比较：共同区间、口径差异与回看

ID: strategy-desktop-v2-07
State: closed
Status: accepted
实施期缺陷：X07-01旧比较事件上下文可能回退M，静态FAIL，root实际反例待修后补验；唯一owner comparison_runtime_07，证据acceptance/07.md及reviewer-07.md。
Labels: ready-for-agent
Assignee: /root
集成负责人: /root
Source: [策略桌面端视觉与完整交互设计规格](../../strategy-portfolio-backtesting/issues/08-desktop-ux-design-spec.md)

> 用户已授权开发。本票为合成交互原型。实际模型：实现 gpt-6-luna / max，验收 gpt-6-astra / low。

## Scope / What to build

从已完成或阶段结果进入至少两组合比较，在共同区间查看曲线/指标和配置差异；包含失败、落后、不可直接比较组合；点选某组合事件回到过程并回到原比较视图。

范围外：不比较跨实验的多个研究配置、不自动推荐最优策略、不新增基准采集或生产指标引擎。不把部分组合静默移除或伪造成完整。

## Refs

- [桌面设计正文](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD09（220–240 行）、DD12（260–266 行）、DD06 各组合截止（177–200 行）；T10（328 行）。
- 需求：UX01、UX03、UX05、UX09、UX10；元素：E02、E03、E07、E08、E12；用户故事：22、23、38、39、40、41、42、43；验收：T10、T09、T05、T12。
- [拆分与共同契约](../TICKET-PLAN.md)、[逐项覆盖矩阵](../DESIGN-COVERAGE.md)。
- [参考 creation-baseline-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg)。
- [参考 creation-baseline-1280.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg)。
- [参考 design-review-running-1440.jpg](../../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg)。
- 参考是现有风格/旧状态，不是新设计批准画板；按正文目标和同状态新渲染对照，不能拿旧 PASS 替代本票。
- [项目拆票标准](../../../docs/agents/task-decomposition.md)、[UI 验收模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

- [06 — 快速展开与异常恢复：取消、失败、重试和继续](06-bulk-reveal-and-recovery.md)。

## 输入/输出与最小整理

第 06 票已经间接包含第 03 票多组合与第 05 票结果契约；因此只声明第 06 票这一直接阻塞。提供共同区间结果投影和比较来源上下文，不建立新的交易时钟。

## 验收标准与反例

- [x] AC01：两组合可从结果入口实际进入比较，稳定名称/身份/曲线颜色相互对应；本金独立且口径矩阵明确起点、区间、数据、预设、费用/币种等。
- [x] AC02：默认共同有效截止=min Mᵢ；部分/失败组合保留可见状态但不参与完整区间排名，不能把短区间仍标一年。
- [x] AC03：净值叠图、回撤、仓位和比较指标来自各自真实合成账本；最多突出4条曲线，其余可访问；颜色/线型/名称共同辨认。
- [x] AC04：口径差异就近解释；未知指标显示不可用，零回合胜率不填0；无可信基准时不捏造比较或超额收益。
- [x] AC05：明确选择更晚单组合区间时展示非同步比较及截止 R，记录已看后续来源；回看早期不泄漏另一组合未来收益。
- [x] AC06：从比较的组合/事件进入过程时定位身份、日期、标的，返回比较恢复组合集合、区间、筛选及滚动位置。
- [x] AC07：数据质量/部分/失败说明可展开而不压倒首屏比较重心；两档桌面与键盘直接对照，长名称、多组合溢出可用。

核心反例：把失败组隐藏后得出赢家；直接比较不同截止的完整期收益；切一组事件却进入另一组持仓；比较返回丢区间。

## 视觉与状态约束

- 1440×900、1280×800 CSS 视口，100%缩放；历史基线DPR1，新验收记录实际DPR。保留TradeReview侧栏/背景/蓝色主动作、6–8px圆角；本票元素遵守DD02尺寸、DD13字体和状态色。
- 先装配一屏代表性状态并独立看图，之后扩展其余状态。每票都完成自己的视觉/键盘检查，第08票只验集成，不补做前票门槛。
- 时间遵守DD06，运行V/M/各组Mᵢ、结果R及曝光来源由同一会话边界协调；字段不适用时按本票范围说明，不删除后续契约。
- 原型使用合成数据，返回重开只保留内存；无真实API/schema/数据库写入。窄屏暂不修改，不新增窄屏专项门槛。

## 验收证据

- 功能/时间状态：NOT VERIFIED；端到端浏览器：NOT VERIFIED；独立视觉：NOT VERIFIED。
- 计划记录于 acceptance/07.md，渲染证据放 screenshots/07/；这些是计划位置，文件未产生前不得当成证据。
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

## 07 派发与责任（06已由root ACCEPTED）

01–06接受，07实施中，08待07依赖；整体未接受。准确批准引用保持C25–27/C28原表及INTEGRATION-07.md。

| 覆盖/元素 | 唯一实现owner/写入 | 旅程与证据 | 状态 |
| --- | --- | --- | --- |
| C25–27，UX01/03/05/09/10 E02/03/07/08/12；DD06 177–200/DD09 220–240/DD12–14 260–281 | /root/comparison_runtime_07，Luna6/max：仅running-prototype.tsx/css、implementation/07-runtime.md | 入口R=min(sourceV/R,共同Mi)→比较→显式更晚单组→准确事件/返回上下文；root实际browser，acceptance/07.md | NOT VERIFIED |
| 相同C25–27的只读呈现，相关C28 | /root/recovery_layout_06新07任务，Luna6/max：仅comparison-prototype.tsx/css、新comparison-model.ts（必要时）、results-prototype.tsx/css比较按钮、implementation/07-ui.md | 同轴归一化净值/回撤/仓位、口径矩阵、最多4线+6组可达；same screenshots/07、reviewer-07.md | NOT VERIFIED |

root为整页视觉及完整会话接线验收owner；/root/acceptance_final Astra/low独立审查。精确图片参考screenshots/reference/tradereview-{1440,1280}.png及05修后结果图，规格不是像素新画板。1440×900/1280×800 DPR1/100%，sidebar/蓝主动作/6–8圆角/12–14关键字体/36控件。无授权新增布局偏差；窄屏/生产DB N/A。先渲染代表性屏经独立审查，再扩展/修复。禁止双方交叉写文件；UI owner不再拥有running CSS，交回runtime07唯一。

## 2026-09-30 续行

中断销毁旧代理后，唯一写入转交 comparison_ui_resume（comparison TSX/CSS）及 comparison_runtime_resume（running TSX/CSS），均 gpt-6-luna/max；独立审查 acceptance_resume 为 gpt-6-astra/low。既有Results按钮暂无写入者。root整页与完整状态链责任不变。

X07-02/P2：代表屏主图top565.57，1440高360/1280高320，日期轴超出900/800首屏；root与Astra直接对照均FAIL。保留 representative-{1440,1280}.png，先压缩重复口径区并修复，再扩展剩余07。X07-01修复静态与实际路径均需复核；07完整交互与08仍NOT VERIFIED。

## 07 第二阶段精确拆分（代表屏门槛已过）

2026-09-30：Astra直接比较representative-fixed-1440/1280与reference，X07-02限定代表屏首屏门槛PASS；root实测plot top434.02，高360/320，bottom794.02/754.02，DPR1。日期轴完整；1280滑块位于首屏底边，后续添加常驻内容必须重验。旧FAIL保留，07整体尚未接受。

- C25–27/DD09/E08曲线：comparison_runtime_resume（Luna6/max）转为仅新增comparison-chart.tsx/css及implementation/07-chart.md的writer，running TSX/CSS冻结。输入公开ResultAnalysis与显式显示的series，不接runtime时钟。真实NAV/DD/标的+现金历史仓位，HTML12px坐标与SVG导线对齐，360/320高度。root测试图与数值，Astra直接看图。
- C25–27/E02/E03/E07/E08/E12整体：comparison_ui_resume（Luna6/max）仍仅comparison-prototype.tsx/css及implementation/07-ui.md；集成chart接口、指标在曲线前、6组最多4线legend、分组/执行事件筛选+事件source-return、local state/scroll按entryId重置且返回保留、数据范围/版本/unknown/无基准。根协调者为整页/完整状态owner。
- Charts frozen接口：export type ComparisonChartMode = 'net-value'|'drawdown'|'allocation'; export type ComparisonChartSeries = {id:PortfolioId;name:string;analysis:ResultAnalysis;color:string;dash:string}; export function ComparisonChart({series,mode,currentDate,empty}: {series:ComparisonChartSeries[];mode:ComparisonChartMode;currentDate:string;empty:boolean})。UI为仓位模式只传一个明确选中的组合series，NAV/DD传最多4条；chart不拥有筛选、游标或其它页面state。
- 无新依赖/生产数据/数据库/窄屏；props主接口不变。精确参考与验收仍为本文件原表、INTEGRATION-07、acceptance/07与screenshots/07，最终08等待07全部接受。

## 07 完整UI接线发现（2026-09-30）

X07-03/P1，root与Astra静态独立确认：仓位图使用持久allocationPortfolioId，Single进入EMA较晚区间后可能仍显示quality；dropdown可直接换其它组合而不改运行owner单组身份。要求单组仓位由selectedPortfolioId决定，显式切换由同一runtime action处理。

X07-04/P2：从同步筛选quality后进入EMA Single，事件仍被旧portfolioFilter滤掉，而disabledselector显示EMA。Single忽略旧同步filter，返回同步保留原filter。两项交唯一comparison_ui_resume修，当前FAIL，browser未复现，最终修后实测关闭。root另要求零曲线选择不能伪标T0、未知partialReduction不可填0，现金权重1位小数；均在本07已授权契约内。

07仍open / acceptance-failed；08等待依赖。图表与runtime已冻结，UI正在修复；历史PASS只适用各自范围。

## 2026-09-30 最终交互复验缺陷

X07-03/04：root实际Single EMA7/12仓位归属、事件忽略旧quality筛选通过，最终冻结复验待收口。X07-05/P2：root实际比较→6/21部分成交→交易B，抽屉关闭且来源返回入口消失；Astra静态确认DD09违规，同时局部重开05的交易定位后来源返回。唯一runtime owner comparison_runtime_resume修复running TSX/CSS。X07-06/P2：失败Mi/预设/排除原因10–10.5px，小于DD13关键12px；UI owner修复。X07-07/P2：root实测同entryId2、单组EMA7/12、仓位、partial事件筛选，scroll290→事件→返回来源比较后scroll0；UI owner修复hidden后覆盖scroll记录。

准确引用：DD06 177–200、DD09 220–240、DD13 268–276；C19/C20/C26/C28，E04/E07/E08/E12。前序证据保留，05仅上述source-return局部重开，07仍acceptance-failed，08未放行。root负责实际路径与两档视觉，Astra独立对照。

## Root最终接受
2026-09-30：AC01–07全通过。真实路径/数值/两档证据见[acceptance/07.md](../acceptance/07.md)，独立Astra见[reviewer-07.md](../acceptance/reviewer-07.md)第十一阶段。X07-01–08修复关闭；旧FAIL保留。数据库/窄屏/触屏N/A；08仍独立验收，不由本票代替。

2026-09-30 X08-01/P2：08新鲜T0-1280时间条回看控件裁切，07仅新增入口布局局部重开；Luna6/max comparison_runtime_resume仅running CSS修复，root实际两档/Astra独立复验。08整体未接受，其余已接受证据保留。

2026-09-30 X08-01修复关闭：root derived-t0-1280实际timebar无横向溢出、date selector全可见；Astra reviewer08第二阶段直接对照两档T0、主图/日期轴PASS。CSS-only无状态变更；07重新ACCEPTED，08继续验收。
