# 首页调整设计覆盖矩阵

日期：2026-10-06。已进入用户授权实施；推荐默认值的裁定见 IMPLEMENTATION-SPEC.md，全部产品证据仍未接受。H01–H09 是本草案新设的追踪标识，不冒充历史批准设计的 elementID。

整页视觉一致性 owner：`/root`。完整数据／持久化旅程 owner：`/root`。下表 owner 是设计与最终接受负责人，实施所有者见下表及 implementation-plan.md；原规划票仍保留历史。后续删改要求须有实际用户决策依据。

## 来源与比较条件

- R1：[评审文字](../homepage-design-report-20261006/report-text.txt)第 93–112 行的 8 项问题；第 113–134 行的顺序、验收和未验证边界。
- R2：[估值修复规格](../holdings-valuation-repair-20261006/IMPLEMENTATION-SPEC.md)第 5–20 行。
- R3：[领域规则](../../docs/specs/2026-09-19-trading-room-domain.md)第 15–25、39–59 行；[词表](../../CONTEXT.md)第 70、73 行。
- R4：[首页修正规格](../../docs/specs/2026-09-22-trading-room-ui-fixes.md)第 62–88 行。
- R5：[布局重组规格](../../docs/specs/2026-09-21-trading-room-layout-reorganization.md)第 16–51 行。
- E1：[用户图 1](refs/user-homepage.png)，全部历史、原币、诊断展开；问题证据，不能作为最终目标画面。
- E2：[桌面首屏](../homepage-design-report-20261006/desktop-overview.jpg)，1440×1000，今年、部分估值、更新中。
- E3：[桌面复盘区](../homepage-design-report-20261006/desktop-review-section.jpg)，1440×1000，统计与待复盘列表。
- E4：[窄屏首屏](../homepage-design-report-20261006/mobile-top.jpg)与 E5：[窄屏趋势](../homepage-design-report-20261006/mobile-chart.jpg)，390×844；仅视口模拟，非物理触摸。

目标比较视口：1440×1000、1280×720、390×844、320px 边界。比较必须固定账户、币种、日期、数据集、完整性、更新阶段与导航开合状态。以 IMPLEMENTATION-SPEC.md 的文字布局/状态及现有视觉规范为目标；用户图为问题证据，当前不是像素复刻任务。

I 为[实施契约](IMPLEMENTATION-SPEC.md)对应元素章节；每行同时保留原评审/批准约束的准确来源。

证据路径以下以 `acceptance/…` 表示后续待生成记录，不是已有文件或通过结论。文档检查记录在 [planning-checks](planning-checks.md)，不能代替产品证据。

## 逐项矩阵

| 需求 / 规格与行号 | elementID | 准确图片与区域 | 阶段与状态 | owner / 决策任务 | 交付映射 | 浏览器操作 | 可观察预期与反例 | 后续证据路径 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 · R1:93–95 / R2:5–7 / I:H03 | H03 | E2 顶部金额卡 | 完整 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 摘要 | 查看完整样本 | 币种、金额、覆盖、时点相邻；不会把全组合与本币覆盖混用 | acceptance/value-complete.md | NOT VERIFIED |
| P1-01 · R1:93–95 / 词表:70、73 / I:H03 | H03 | E2 顶部金额卡 | 部分 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 摘要 | 切部分样本 | 已知小计明确；市值与盈亏各自覆盖，缺成本不使有效市值消失 | acceptance/value-partial.md | NOT VERIFIED |
| P1-01 · R2:5–7 / I:H03 | H03 | E2 金额区；全缺失待原型 | 全缺失 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 摘要 | 切全缺失样本 | 暂不可用 + 0/n 与原因，不把未知画成 0.00 | acceptance/value-missing.md | NOT VERIFIED |
| P1-01 · R3:47–53 / R4:70–71 / I:H03 | H03 | E2 当日卡 | 率不可用、单位价格 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 指标与价格详情 | 查看当日／收益率／ETF | 当日盈亏不等于浮盈差；率遵守分母，单位价不一概两位小数 | acceptance/metric-rules.md | NOT VERIFIED |
| P1-02 · R1:97–98 / I:H04/H08 | H04/H08 | E1 左图与 E3 业绩图 | 原币单币／跨币 | /root/homepage_trend · [趋势与日期](issues/11-trend.md) | 两类图表 | 今年→全部→业绩图 | 固定币种文字／颜色／形状；不按序号漂移，不混原币轴 | acceptance/currency-identity.md | NOT VERIFIED |
| P1-02 · R3:23–25 / R4:75 / I:H03/H04/H05 | H03/H04/H05 | E2 计价控件与图 | 折算完整／FX 缺失 | /root · [跨币种集成接受](issues/13-acceptance.md) | 计价展示 | 切报告计价 | 同一 FX 口径，缺 FX 回退原币；不称历史真实汇率、不伪造完整合计 | acceptance/fx-scope.md | NOT VERIFIED |
| P1-03 · R1:99–101 / I:H06 | H06 | E1 右栏原因 | 多原因重叠 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 问题摘要 | 打开分组／受影响对象 | 分类与去重范围明确，不加总重叠仓位；主区不长篇罗列 ID | acceptance/diagnostic-groups.md | NOT VERIFIED |
| P1-03 · R4:74 / R5:48 / I:H06 | H06 | E1 右栏展开；容器待原型 | 打开／关闭、原始证据 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 问题详情 | 查看原始记录→关闭 | 数据可追溯、焦点与位置恢复；不叠加多层页内滚动 | acceptance/diagnostic-details.md | NOT VERIFIED |
| P1-03 · R2:21 / R3:59 / I:H06 | H06 | E1 现金原因区 | 行情、数量／成本、记录属性 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 分类动作 | 分别进入对应动作 | 行情重试与数据核对分开；原始数据不被改写，现金不冒充券商余额 | acceptance/problem-actions.md | NOT VERIFIED |
| P2-04 · R1:103–104 / R2:7 / I:H04 | H04 | E1 全历史 | 密集、日／周／月 | /root/homepage_trend · [趋势与日期](issues/11-trend.md) | 曲线采样 | 今年→全部→手动粒度 | 清楚实际采样与快照日期，不将市值求和，不悄悄改区间 | acceptance/trend-density.md | NOT VERIFIED |
| P2-04 · R2:7 / I:H04 | H04 | E1 左图；边界待原型 | 完整／部分／缺失、成员变动、单点 | /root/homepage_trend · [趋势与日期](issues/11-trend.md) | 曲线语义 | 逐段点选 | 实线／虚线／断点保真；孤立点可见，采样不补假桥 | acceptance/trend-boundaries.md | NOT VERIFIED |
| P2-04 · R2:17–19 / I:H09 | H09 | E2 顶部／局部状态、E4 | 等待／下载／重算 | /root/homepage_shell · [首页与任务](issues/12-shell.md) | 更新状态 | 进入缺行情范围并继续筛选 | 自动后台更新，真实阶段一致；已处理≠成功，未知总量无百分比 | acceptance/update-progress.md | NOT VERIFIED |
| P2-04 · R2:18–21 / I:H09 | H09 | E2 更新入口；异常待原型 | 完成／部分／失败／取消／中断 | /root/homepage_shell · [首页与任务](issues/12-shell.md) | 更新动作 | 手工更新→取消／失败→重试→重载 | 共用锁且无重复任务，缓存保留，中断可识别；不无限自动重试 | acceptance/update-recovery.md | NOT VERIFIED |
| P2-04 · R2:20 / I:H04/H09 | H04/H09 | E1 曲线；安全状态待原型 | 同范围向前 | /root/homepage_shell · [首页与任务](issues/12-shell.md) | 旧快照提示 | 同范围、目标币种、FX 快照且时点不回退更新 | 安全旧图有实际时点，不能当成新任务完成回执 | acceptance/safe-snapshot.md | NOT VERIFIED |
| P2-04 · R2:20 / I:H04/H09 | H04/H09 | E1 曲线；反例待原型 | 范围／币种／FX 快照改变、时间回退 | /root/homepage_shell · [首页与任务](issues/12-shell.md) | 快照隔离 | 改范围或回退日期 | 不沿用不兼容金额／曲线，不把旧数据标成新结果 | acceptance/snapshot-isolation.md | NOT VERIFIED |
| P2-05 · R1:105–106 / R3:55–57 / I:H05 | H05 | E1 右侧分布区 | 完整多头、可信空头 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 分布 | 查看两种完整样本 | 合法空头仍可分布，分母为总敞口，净市值独立 | acceptance/allocation-valid.md | NOT VERIFIED |
| P2-05 · R1:105–106 / I:H05 | H05 | E1 灰环 | 部分、全缺失、零分母、方向未知 | /root/homepage_values · [可信金额与缺口](issues/10-values.md) | 替代视图 | 切四类样本 | 金额、覆盖、原因可读；无虚假整组合占比，覆盖条不冒充分布 | acceptance/allocation-fallback.md | NOT VERIFIED |
| P2-06 · R1:107–108 / R4:64、67 / I:H04/H07 | H04/H07 | E1 区间与日期控件 | 应用／取消／无效 | /root/homepage_trend · [趋势与日期](issues/11-trend.md) | 日期选择 | 编辑起止日期 | 显式应用；取消与错误不动旧范围；当前持仓／复盘期间不被联动 | acceptance/date-editor.md | NOT VERIFIED |
| P2-06 · R2:5–7 / R4:66–67 / I:H04/H07 | H04/H07 | E1 图形与历史日期 | 点选／退出／返回当前 | /root/homepage_trend · [趋势与日期](issues/11-trend.md) | 日期详情 | 点图→查某日→返回当前 | 同一日期详情与明细一致，观察期间仍保持 | acceptance/date-selection.md | NOT VERIFIED |
| P2-06 · R4:66、76 / I:H04/V01 | H04/V01 | E1 坐标、E2 辅助字 | 键盘与可读性 | /root/homepage_trend · [趋势与日期](issues/11-trend.md) | 文字与图表焦点 | 左右／Home／End／Esc | 可见焦点、可读详情；字体≥14/12，控件≥44；End 旧超时不能当通过 | acceptance/keyboard-typography.md | NOT VERIFIED |
| P2-07 · R1:109–110 / R4:63 / I:H01 | H01 | E4 页头筛选 | 默认／展开／带筛选收起 | /root/homepage_shell · [首页与任务](issues/12-shell.md) | 页头筛选 | 展开→筛选→收起→移除 | 活跃标签可见，范围可恢复；清附加筛选不等于重置性质与账户 | acceptance/mobile-filters.md | NOT VERIFIED |
| P2-07 · R4:69、76、87 / I:V02 | V02 | E4/E5 全页 | 390×844、320px | /root · [整体验收](issues/13-acceptance.md) | 响应式 | 滚动、开关筛选与详情 | 无整页横溢、金额与币种成组；不压缩点击区，窄屏月历用列表 | acceptance/responsive-mobile.md | NOT VERIFIED |
| P2-07 · R4:62、87 / R5:48 / I:V03 | V03 | E2 全页 | 1440×1000、1280×720 | /root · [整体验收](issues/13-acceptance.md) | 首屏与列布局 | 默认进入、导航切换 | 1280×720 摘要与≥120px实际图可见；单主滚动，不能用空框算绘图区 | acceptance/responsive-desktop.md | NOT VERIFIED |
| P2-08 · R1:111–112 / R5:40 / I:H02/H08 | H02/H08 | E3 待复盘区 | 有任务／零任务／有草稿 | /root/homepage_shell · [首页与任务](issues/12-shell.md) | 入口与分页 | 上部入口→选任务→前后页 | 数量实时、回合准确，零仅代表当前范围；加载／未知不当零；通知99+不是任务数；分页不铺满页码 | acceptance/review-entry.md | NOT VERIFIED |
| P2-08 · R5:38–42 / I:J03 | J03 | E3 复盘入口；返回待原型 | 保存／返回／刷新 | /root · [整体验收](issues/13-acceptance.md) | 导航与持久化 | 准确回合→保存→返回→刷新 | 隔离库验证实际写入、列表更新、原范围／页／滚动恢复 | acceptance/review-persistence.md | NOT VERIFIED |
| 用户异步偏好 / R1:124–134 / I:V04/H09 | V04/H09 | E2 状态；动态待原型 | 减少动态效果、读屏、缩放、触摸 | /root · [整体验收](issues/13-acceptance.md) | 可访问性 | 动态偏好切换、读屏、缩放、真实触摸 | 动效有静态替代与低打扰播报；物理触摸不能用模拟证据代替 | acceptance/accessibility.md | NOT VERIFIED |
| R1:121–134 / R4:76 / I:V01 | V01 | E1–E5 对应状态 | 颜色与视觉对照 | /root · [整体验收](issues/13-acceptance.md) | 目标状态板 | 固定数据逐态比较 | 非实现者直接比对批准目标；实测对比度，不能以总分消除重大差异 | acceptance/visual-comparison.md | NOT VERIFIED |
| R2:17–21 / I:J01 | J01 | E2 更新与金额 | 缺口→补齐→新值 | /root · [整体验收](issues/13-acceptance.md) | 第一条整合旅程 | 看小计→查看缺口→自动／手工更新 | 真实数据结果与覆盖一起变化，正常浏览不中断；不只验按钮存在 | acceptance/valuation-journey.md | NOT VERIFIED |
| R2:5–7 / R4:64–67 / I:J02 | J02 | E1 历史图与日期 | 切期间／币种→选日→持仓→返回 | /root · [整体验收](issues/13-acceptance.md) | 历史整合旅程 | 执行全路径 | 数字、图、详情与日期一致；不越范围、不断开状态链 | acceptance/history-journey.md | NOT VERIFIED |
| R3:15–25 / R2:26 / I:J01/J02/J03 | J01/J02/J03 | 状态安全，图片不适用 | 实盘／模拟账户与隔离数据库 | /root · [整体验收](issues/13-acceptance.md) | 范围与安全 | 切账户；显式隔离库跑写入旅程 | 不把同模拟账户按文件拆运行；原始业务库不被验收写入，自动缓存写入也隔离 | acceptance/state-safety.md | NOT VERIFIED |

## 未验证与范围说明

本轮已进入实施，已落地部分源码；自动采样与依赖布局仍待真实图门槛。验证按实施票推进，真实浏览器当前受安全策略阻断。所有表内产品项保留 NOT VERIFIED，不因草案齐全而改为 PASS。设计决策接受也不自动代表功能完成。回放主图内部阶段改造不在范围内，因此无需重新设计其双游标；复盘入口仍必须准确传递既有回合上下文并验证返回和持久化。

未来每次改变范围、状态或目标画面，先更新矩阵和对应决策记录。已记录 FAIL／NOT VERIFIED 保留历史；回归重开相关票并同步 README 和最终接受记录。

## 第一轮审查与新增接口归属

静态 Task 1/2/3 均 FAIL，问题证据分别见 acceptance/task1-review.md、task2-review.md、task3-review.md，交原所有者 fix1。H03 当日数值覆盖接口限制与 H09 中断证据的精确裁定见实施契约末节。H09 hook/input 新增单一实施 owner /root/homepage_shell；/root 继续拥有完整持久化与整页接受。没有新增调度器、存储或财务算法。所有浏览器／视觉行仍 NOT VERIFIED。

## 最终审查集中修正映射（2026-10-06）

以下是原需求反例的补充，并未新增或降低设计约束。唯一实现 owner `/root/homepage_final_fixes`，整页视觉与完整持久化 owner `/root`；任务[14](issues/14-final-findings.md)。依据 [最终审查](acceptance/final-review.md) Important 1–5及[最后范围复核](acceptance/final-fixes-re-review.md)：1/2/5源反例PASS，3/4残留Important FAIL。root最终验证见[阶段记录](acceptance/FINAL-ACCEPTANCE.md)；全部产品项仍NOT VERIFIED。

| 原需求 / 精确规格 | elementID | 原图与阶段 | owner / 旅程与反例 | 验收证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| P1-03 / I:H05/H06 | H05/H06 | E1右栏原因，打开→清空→再出现 | final_fixes；J01后台补齐清空诊断，监听撤销/焦点恢复，不意外重开 | acceptance/final-fixes-report.md；真实焦点仍待diagnostic-details.md | 源反例 PASS / 产品 NOT VERIFIED |
| P1-02、P2-06 / I:H04/H07 | H04/H07 | E1左图原币与日期，USD消失/回归 | final_fixes；J02选USD→CNY-only→选新日→USD回归，不复活旧偏好 | acceptance/final-fixes-report.md；history-journey.md待真实图 | 源反例 PASS / 产品 NOT VERIFIED |
| P2-06、R4:76 / I:V01 | H03/H04/H05/V01 | E1/E2金额、分布、轴、详情；细指针桌面和窄屏 | final_fixes；正文/控件14px、辅助/轴12px、主要点击区44px在实际本地模块生效；密度与长金额不溢出 | acceptance/final-fixes-re-review.md；visual-comparison.md待截图 | 残留 Important FAIL / 产品 NOT VERIFIED |
| P1-03 / I:H06 | H06 | E1右栏现金/持仓原因，无ID和重叠类别 | final_fixes；J01无ID只说明原因/影响对象数未知，识别对象去重，不跨组加总 | acceptance/final-fixes-report.md；diagnostic-groups.md待浏览器 | 源反例 PASS / 产品 NOT VERIFIED |

自动采样、桶内部边界与依赖的2:1/首屏/窄屏布局保持第一条真实图表旅程门槛；字号与点击区不属于此延期豁免。

2026-10-06 最后协调验证：所有30行产品门槛仍NOT VERIFIED；部分源反例的局部PASS仅见上表，不抵消CSS残留FAIL。预览/HTTP、单测、原始数据与真实UI三类证据分开，完整结果见acceptance/final-verification.md。

## 用户授权的完整修复阶段（2026-10-06）

用户“先推动整体的完整修复与验收”覆盖前一阶段单次最终修正波次限制；不是设计或门槛豁免。历史FAIL/NOT VERIFIED不删除。root继续独立整页/数据流接受。

| 原需求/规格 | elementID | 参考/状态/旅程 | 精确owner与任务 | 证据与预期 | 结果 |
| --- | --- | --- | --- | --- | --- |
| I:H03/H04/H05/V01、R4:76 | H03/H04/H05/V01 | E1/E2交互summary、日周月；J01/J02；细/粗指针1440/1280/390/320 | /root/homepage_complete_controls · issue15 | 14px控件、44×44主要目标；complete-controls-report.md + 独立源复核 + 后续实际渲染 | FAIL待修 / 产品NOT VERIFIED |
| I:H02/H08/H09/J03、安全状态 | H02/H08/H09/J01/J03 | E3队列→准确回合→保存→返回→reload，更新来源/草稿；已有workspace失败 | /root/workspace_complete_diagnosis · issue16（先只读） | complete-workspace-diagnosis.md逐个根因；后续root划定修复范围；实际隔离持久化仍必需 | FAIL待诊断 / 产品NOT VERIFIED |

采样/边界及依赖布局仍等最小真实图旅程，未降低该门槛。浏览器恢复请求具体依据已找到：2026-10-06T08:59:46Z CUA getTab(local3031) URL协议拒绝；禁止绕过。

H01/H02/H08/J03 preferences restore/save lifecycle implementation owner /root/homepage_shell (issue17), exact IMPLEMENTATION-SPEC.md scope/history-return and E2/E3/E4; source lint correction/real storage exception and explicit-return behavior evidence complete-preferences-report.md, product pending real J03. No visual deviation or DB writes.

Issue18 independent source reviewer /root/homepage_final_fixes_review maps the exact issue15 V01 and issue17 H01/H02/H08/J03 rows above to acceptance/complete-source-review.md. Source scope only; matching-state rendered visual and real persistence remain NOT VERIFIED under /root.

Issue19 maps I:H03/H04/H05/H06/V01, exact P2 consumer table in complete-source-review.md, to owner /root/homepage_complete_controls, three local CSS modules, complete-body-type-report.md and independent re-review. Default/expanded/full/partial/missing/empty/failure states at the same approved references/viewports. Source FAIL reopened, product NOT VERIFIED. No authorized visual deviation.

Issue20 maps I:H02/H08/H09/J03 to owner /root/workspace_complete_diagnosis, the exact seven preserved workspace titles in complete-workspace-diagnosis.md, complete-workspace-stability-report.md and root final integrated tests. Entire original journeys/assertions retained; no production or database change. Unit FAIL/unstable retained; actual isolated save→return→reload remains NOT VERIFIED under /root.

Issue21 maps H05/V01 and the exact SVG consumer at room-allocation.tsx Donut viewBox=152 with current width140–150 to /root/homepage_complete_controls; refs E1/E2 right allocation, complete positive-exposure state, J01 readable money/auxiliary caption. Source floor correction only; acceptance/complete-svg-type-report.md + independent review, rendered visual still NOT VERIFIED. No geometry or approved visual deviation.

Issue22 independent nonimplementer /root/homepage_final_fixes_review reviews Issue20 exact two-test diff and shared helper consumers against H02/H08/H09/J03, E3 queue/return and E1 diagnostics; seven full mock journeys and original assertions/timeout preserved. acceptance/complete-workspace-test-review.md is scoped source evidence only, root actual DB/real chart/visual gates remain NOT VERIFIED. Dispatch waits Issue20 stable source.

Issue23 read-only production readiness audit owner /root/market_readiness_audit maps H02/H08/H09/J03 to exact E3 queue→round→return and E1 update state. acceptance/complete-market-readiness-audit.md checks existing daily/intraday key/cancel/merge/publication consumers without implementation, tests, DB or browser. Proven source counterexamples and unmeasured candidates remain distinct; whole chart/persistence/visual acceptance stays NOT VERIFIED under /root.

Issue24 bounded test owner /root/workspace_complete_diagnosis maps H02/H08/H09/J03 to exact E3 queue/return and E1 update states, four preserved full journeys in issues/24-workspace-query-budget.md. Root unlocked the bounded query edit; independent final source review is scoped PASS, validation 1PASS3FAIL and final corrected parent execution still pending. Original actions/assertions/default budget/mocks remain; actual DB/render/visual NOT VERIFIED. Evidence complete-workspace-query-plan.md/report and independent review; no authorized visual deviation.

Issue25 production/readiness owner /root/market_publication_fix maps H02/H08/H09/J03 and existing state safety to E3 desktop-review-section.jpg queue→accurate round→return and E1 refs/user-homepage.png async update. Exact field ownership/cancellation/restore contract and consumer RED→GREEN acceptance are in issues/25-market-publication.md; evidence complete-market-publication-report.md and independent review. New consumer RED tests are now unlocked; production still waits root review of measured RED. Whole-page visual and actual persistence remain /root and NOT VERIFIED; no visual deviation, sampler or layout expansion. Issue23 partial-read source FAIL and unrelated test-timeout evidence remain separately preserved.

2026-10-06 14:46 UTC：Issue25 受控消费者 RED 已由root直接阅读并接受，当前test SHA925cf27c…9e6e。日志 issue25-market-readiness-2026-10-07T0030Z.log 实际执行22:44:47Shanghai，1/1→2/0，失败前read范围/数量、D1/I1信号和job0均通过。最小daily success/catch通道修复解锁；samebatch/J-cancel仍逐项RED门槛。idle hook fixture边界和撤回bootstrap建议见issue25-fixture-isolation-coordinator.md。历史FAIL保留，产品与真实chart/持久化/视觉仍NOT VERIFIED。

2026-10-06 14:20 UTC：Issue25 trace及test边界见acceptance/issue25-trace-coordinator-review.md；不是late-daily RED。所有映射/owner/规格保持。Issue24追加受控计时待结果，未改变原门槛；产品条目仍NOT VERIFIED。

## Issue24 测量后的局部预算裁定（2026-10-06 14:25 UTC）

root独立复读issue24-boundary-probe-run.log及恢复hash。第一条绘图的实际 autosave notice、visible 已保存、repository drawing断言均通过后仍需返回、重开和completion gate；已测入口/toolbar合计2384.2ms，saved等待1130.1ms，其他真实typing/click/重开不含在这两项内。其5000ms整个测试截止是总旅程预算不足的证据，不是保存失败证据；第二条短旅程本次PASS，原历史FAIL保留。

授权Issue24 owner仅为第一条 `retains a Recall drawing draft per episode and gates completion until a snapshot exists` 添加显式10000ms总测试预算及原因注释。项目默认5000ms、所有单步find/wait限制（包括已保存2500ms）、全部mouse/pointer/type/rename/保存/返回/重开/拒绝完成动作和断言均保留。禁止其他测试timeout/globalconfig或fixture变化。此裁定替代此前该owner任务中的“所有测试维持默认预算”仅这一条，不改变产品性能指标；后续root affected fresh运行才可记结果。

对应H02/H08/H09/J03、E3队列回合返回；整页/实际持久化/视觉owner仍root，产品NOT VERIFIED。测量日志不是浏览器性能或实际SQLite保存证据。

2026-10-06 15:00 UTC：Issue25最小daily源码root+非实现者SCOPED PASS，独立报告`acceptance/issue25-actual-channel-review.md`；3项GREEN仅late-D/cold/ordinaryIerror已测路径。samebatch受控RED后解锁同文件selected-I functional projection。restore完整实际consumer链由原独立审查owner只读追踪，证据计划`acceptance/issue25-restore-consumer-audit.md`；沿用H02/H08/H09/J03、E3准确回合/E1异步反馈及root整页/持久化owner。无架构或视觉偏离；功能票和产品30项未接受。

2026-10-06 15:34 UTC：Issue25最终生产23cb3376…a3e/新测试1fedb5a6…b2ab，root亲读12项PASS/无unhandled并完成限定源码复核；九套直接workspace消费者正在统一执行。新增[Issue26](issues/26-library-return-regression.md)映射 H02/H08/J03、E3队列→准确回合→返回原搜索范围及E1异步失败可继续浏览，owner /root/workspace_complete_diagnosis 仅只读失败计划，root整页/持久化owner。91项workspace暂报一项confirmed-import/library-return失败，完整stack待unit结束，不假定生产或timeout根因；证据publication-root-final-affected-unit.log与issue26-library-return-readonly-plan.md。所有产品门槛仍NOT VERIFIED，无视觉偏离或范围删减。

2026-10-06 15:38 UTC：九套最新结果176PASS/1FAIL，type2个新test字面量类型error、lint1个现金effect error/15warnings；diff/build/runtime PASS且无source drift。Issue25原owner仅修新test provider typing和unused fixture；新增[Issue27](issues/27-cash-lifecycle-lint.md)仅只读cash scope lifecycle，H03/H06/J01/J03、E1现金说明/E2 desktop-overview.jpg今年/部分/更新，owner /root/market_readiness_audit 审查计划，root整页视觉/完整持久化与集成。原cash范围切换、重复scope pending、旧请求不可发布和A→B→A不复活提示必须保留，未授权lint抑制/视觉偏离。Issue26准确stack为确认导入merge3后toolbar未重新出现，返回前失败，不是已有四项5秒超时。源局部PASS不能覆盖本次FAIL。

2026-10-06 15:44 UTC 更新：九套统一回归完成，176PASS/1FAIL、零源漂移。唯一失败精确位于确认导入后再次等待图表工具栏（workspace.test:3664），返回步骤尚未执行；Issue26仅解锁一次保持动作/断言/期限的test-only计时诊断。Issue24原四项在本轮全部通过，但只证明受控mock旅程。Typecheck发现新readiness测试两处provider类型扩大，已作静态修正待复验；lint仍1error15warnings，Issue27只读最小scope guard修复计划已核定、等待诊断释放源后实施。diff/build/runtime（5项）PASS不覆盖unit/type/lint失败与真实图/持久化/视觉门槛。


2026-10-06 15:46 UTC — Issue26一次原5000ms诊断在5267ms总预算耗尽；初次toolbar3225ms、确认3694→5273ms、本地D/I读取5052/5245ms才启动，未到post-toolbar原查询。root核定只再做一次临时10000ms总预算诊断，单步1s期限、全部动作/断言/502fixture不变，测终态后恢复b32源；尚未批准永久预算或生产修复，不能把总时限问题冒充原3664查询失败原因。

## Issue26 bounded budget mapping (2026-10-06 16:08 UTC)

| Requirement / element | Approved reference and journey | Exact owner and change | Acceptance evidence | Result |
| --- | --- | --- | --- | --- |
| H02/H08/J03 | E3 `../homepage-design-report-20261006/desktop-review-section.jpg`: library queue → accurate episode → Recall → confirmed import → return to original search scope; E1 `refs/user-homepage.png`: failed async refresh remains browseable | `/root/market_publication_fix` owns the bounded test-only edit; `/root` owns whole-page visual and persistence acceptance | `issues/26-library-return-regression.md`; `acceptance/issue26-probe-20261006T154409Z.log`; preserved historical FAIL | NOT VERIFIED pending root affected-suite run |
| H02/H08/J03 timing boundary | Same public journey, with initial toolbar measured at 2.4–3.2s and confirmation/post-read work at 1.6–1.8s | Only the named test gets `10_000`ms total; only post-confirm `findByLabelText("图表工具栏")` gets `2_500`ms. All actions, assertions, fixtures, other query budgets, and default 5,000ms remain unchanged | `app/components/trade-review-workspace.test.tsx`; measurement comment immediately above the test; probe and historical logs above | Scoped test-budget decision; product, browser, visual, and isolated persistence gates remain NOT VERIFIED |


## Issue25 postimplementation coverage correction (2026-10-07)

The following rows complete the missing Issue25 native/coverage mapping after
implementation and fresh execution. They are explicitly postimplementation
records, not retroactive predispatch evidence. Existing rows and historical
FAIL/NOT VERIFIED records remain unchanged.

| Requirement / element | Approved references and exact journey | Owner and bounded scope | Acceptance evidence | Result |
| --- | --- | --- | --- | --- |
| H02/H08/H09/J03 — native 15m publication | E3 `../homepage-design-report-20261006/desktop-review-section.jpg` (1440×1000 queue → accurate episode → Recall → return); E1 `refs/user-homepage.png` (async update state). Public import/merge/library/XPEV/accurate episode → empty 1h → native 15m → actual Recall period/detail → visible StockDataDialog → late D1 → close/reopen/reselect. | `/root/workspace_complete_diagnosis`, `gpt-5.6-luna/high`, test-only. Root owns whole-page visual consistency, complete data/persistence flow, and final acceptance. | 14-case readiness file: 12 original cases preserved plus 2 new cases. Fresh command record `integrated-repair-five-controls-20261006T161042Z.json` SHA-256 `e6ead489afdda4cb153c8e07b61c027a3b6050318582aa93f2b46cd4bff9b652`; log SHA-256 `db872d040d807b24e2e5299a671f8f40d24f83ea9dedddbec1cdc59001788aef`. | Native case PASS, 3315 ms; visual, browser, durable SQLite, save→return→reload, chart/replay, and final product gates remain NOT VERIFIED. |
| H02/H08/H09/J03 — coverage-only 1h status | Same E1/E3 references and public journey. 1h source-unavailable coverage is consumed by the real toolbar/popover/dialog; no 15m request; disabled controls and requested-range diagnostics survive late D1 and reopen. | Same test-only owner/model; root retains integrated UX and persistence acceptance. | Same fresh JSON/log above; readiness test SHA-256 `0436649be72e6038732201a6bcfe22219c222d1e0f718ebd370aaa2954ec3bcc`; implementation report SHA-256 `ffb62cee879a4248627f41c04d9af7b3f52250b9ad232867ab1b65c8454991ed`. | Coverage-only case PASS, 2842 ms; remaining product gates NOT VERIFIED. |
| H02/H08/H09/J03 — scope and source state | Same original 12 market-readiness journeys/actions/assertions/mocks/5s limits; new cases use only typed fixture builders and an opt-in deferred native 15m response. | No production/workspace.test/config/DB mutation in this bounded implementation. Root owns final integration. | Fresh JSON source_before/source_after: production `ce6fad9c52225efb3f63c217064f735a8d1f35893e850f8b2821c1a60823279f`; workspace test `a1c29ac718f3310b14492b8b549f8be9634f6417d265599ce577860c5bde593d`; readiness test `0436649be72e6038732201a6bcfe22219c222d1e0f718ebd370aaa2954ec3bcc`. | Scoped controls PASS; entire feature remains NOT VERIFIED until root closes independent gates. |


## Issue27 pending 生命周期重开与派发前映射（2026-10-06 16:18 UTC）

此记录在后续响应式源码修复和新增保护测试前建立，root 独立只读计划核定后才解锁。原 ce6/a1c29 的 4PASS1FAIL 运行和旧 lint guard 静态记录保留。整页视觉、完整 API/持久化接线及最终接受 owner 均 `/root`；唯一实现 owner `/root/market_publication_fix`（明确 `gpt-5.6-luna/high`），独立审查 `/root/market_readiness_audit`。当前浏览器门槛不解除，无视觉偏离。

| Requirement / element / exact spec | 准确参考、状态与用户旅程 | 唯一 owner / 交付映射 | 可观察预期与反例 | 验收证据计划 / 当前结论 |
| --- | --- | --- | --- | --- |
| H03/H06/H09 · IMPLEMENTATION-SPEC 金额可信范围/诊断/更新反馈；J01/J03 对应现金读写与正常浏览 | E1 `refs/user-homepage.png` 右侧参考现金及原因；E2 `../homepage-design-report-20261006/desktop-overview.jpg` 1440×1000，部分值/更新中。实际数据→账户与计价→编辑保存→摘要失败→original 切 CNY，相同现金 key 的新 GET deferred | `/root/market_publication_fix`；workspace 完成请求身份状态和 CashBaselinePanel/cashSlot 实际消费者 | 新请求立即呈现 loading，合法同 scope 已保存事实保留，retry disabled；失败终态是本次准确错误，retry恢复可用。不能用旧错误/新 GET 计数替代 pending UI | `acceptance/issue27-cash-pending-readonly-plan.md` 核定后实施；原始 RED 为 `integrated-repair-five-controls-20261006T161042Z.json/.log`、test1662。当前 FAIL/reopened；修复后 root fresh cash/9套/type/lint，浏览器/视觉仍 NOT VERIFIED |
| H03/H06/H09/J01/J03 · 同 scope 保存事实与后台读取衔接 | 同 E1/E2、固定账户/现金 CNY target。编辑并发出 PUT（Q0），PUT 未返回时 original→CNY 形成当前订阅 Q1，再完成 PUT→自动只读摘要刷新→释放晚到旧 Q1 | 同 Luna 唯一 owner；只新增一条公开 caller guard test，保存 callback→最新同 scope 请求→准确面板终态 | 当前同 key 保存仍成功，刷新终态必须退出 loading；当前 baseline/summary和保存/错误事实正确；晚到旧 read 不覆盖本次终态；PUT恰一次。不得通过捕获旧 Q0 身份造成永久 pending | 这是独立审查提出的源码候选保护，尚未实测，不能称新增 runtime RED。新 test 总预算/查询默认不变；root fresh isolated unit，实际 SQLite/返回/reload/视觉 NOT VERIFIED |
| H03/H06/J01/J03 · 跨范围失效与只读重试保护 | 同 E1/E2。完成保存→A→B→A；旧 GET/PUT晚到；同 key 重读/手工 retry；execution/metadata/FX revision 变动仍属于 cash key | 同实现 owner；原 read/write sequence、scope gate、现金计算/客户端/存储接口保留 | 不复活旧 A 保存标记，不跨 scope 发布旧请求；当前手工读取仍可成功/准确失败；原现金 tests动作/断言/期限原样。不得改金融算法、数据库、全局配置或新增 PUT | 根已验证完成 PUT 的 A→B→A PASS2594ms；其余原现金/工作区回归必须 fresh 9套覆盖。最终实库/视觉 NOT VERIFIED |



## 2026-10-06T16:34:33.903397+00:00 — root 现金三个控制的准确边界

冻结 7fbe13cb…cb1e / 594d4ef8…0180 运行 `integrated-repair-cash-controls-20261006T163026Z.json/.log`：exit1，15.89s，2PASS1FAIL，零源漂移。原 same-key 强 pending/保存事实/禁用重试/准确新错误 1919ms PASS；完成保存 A→B→A 2700ms PASS。原 measured same-key 生产缺口有 matching-version GREEN，旧 ce6 RED 和 whole-run FAIL 均保留。

新增 newest-post-save 控制在初始现金基准100000等待失败（1723），未到PUT，不构成 closure 生产RED。已交唯一Luna仅修新增传输fixture的公开阶段；保存完成前只能返回初始基准，公开切CNY才延迟Q1，PUT成功才开启R2。所有旧a1c29字节逆向保留、生产7fbe不改、期限/断言不降级。该新增closure旅程仍NOT VERIFIED直到实际运行。独立源码限定PASS见 `issue27-cash-pending-independent-review.md`；不是完整产品接受。


## 2026-10-06 16:46 UTC — Issue28/29 派发前边界与新鲜回归

root final 7fbe/fd889/043 的九套 **181 PASS / 1 FAIL**，唯一 alias canonical V2 即时读 null；typecheck 唯一 coverage-only act 闭包 string narrowing 错误；lint exit0（15warnings），diff/build/runtime5 exit0，零源漂移。此轮完整 FAIL 保留，不以现金修复/构建通过解除。新 cash deferred-PUT 控制已单项 PASS2489ms，并在九套 workspace94项中通过；独立 56d0fb82 报告限定签署。

| Requirement / exact spec / element | 参考、状态与完整旅程 | 唯一 owner 与允许文件 | 验收证据 / 当前状态 |
| --- | --- | --- | --- |
| Issue29 H02/H08/H09/J03，IMPLEMENTATION-SPEC 范围/更新/完整流程 | E1 refs/user-homepage.png 更新状态；E3 ../homepage-design-report-20261006/desktop-review-section.jpg，1440×1000队列→准确回合→真实 toolbar/dialog。coverage-only小时响应仍须从实际观测 start/end 构造，未拿到实际区间即失败，不替换虚拟范围。 | Luna `/root/workspace_complete_diagnosis`，只改 market-readiness.test.tsx 该新case guard后两const及响应构造参数；原12+native15m动作/断言/mock/期限保持。root负责整页/实际持久化，独立审查不实施。 | 先有 integrated-repair-root-final-typecheck.log TS2345；root解锁后 fresh typecheck、14case和准确diff独立复核。无UI偏离；实图/SQLite/视觉仍NOT VERIFIED。 |
| Issue28 H01/H02/H08/J01/J03，IMPLEMENTATION-SPEC 范围/准确返回/完整流程 | 同 E1/E3，别名未决时旧V1及V2 null→实际alias返回→public范围控件→规范scope完整持久化→旧V1不变；不是仅UI变更证明持久化。 | 当前独立 `/root/market_readiness_audit` 只读诊断；后续唯一Luna实现owner/文件范围须根明确解锁，未解锁生产/测试。 | 新fresh fail alias-recovery:147在 raw九套记录；先查真实passive effect/存储writer及原fixture，再裁定可证伪最小边界。原完整canonical断言/default deadline保留；组件不冒充SQLite/browser。 |

### Issue28 派发前候选边界 — 16:49 UTC

H01/H02/H08/J01/J03 与同一 E1/E3 精确参考和旅程保持。独立只读审查发现等待条件没有包含规范键实际持久化，生产 restore/writer 与历史基线相同；没有写入轨迹，历史失败成因不扩大为生产回归结论。唯一 Luna owner `/root/market_publication_fix` 仅在 alias-recovery.test.tsx SHA530febcae4368471f38f4fe03329ff9a8db480d33000091c39c6de369fb170f5 上，将原完整 canonical 对象断言移入同一 waitFor；其余源码/操作/字段/fixture/默认期限不改。独立 source reviewer `/root/market_readiness_audit`，root整页/实库/集成 owner。root 运行该全4case及typecheck作为组件候选证伪；原九套FAIL及产品NOT VERIFIED保留，无视觉偏离。

## 2026-10-07 01:04:26 Shanghai — root 冻结版本关联复验与剩余范围

九套182/182 PASS、完整typecheck PASS、scoped lint exit0（0errors15warnings）、diff PASS。准确source与raw证据：[当前验证](acceptance/complete-current-verification-report.md)。该段只更新组件证据，不把任何产品行升级成PASS；全部产品行保留原三道门槛。

| 需求 / 元素 / 准确参考 | 当前owner与旅程 | 当前限定证据 | 未完成 / 必需产品接受 |
| --- | --- | --- | --- |
| H01/H02/H08/J01/J03；E1 refs/user-homepage.png，E3 ../homepage-design-report-20261006/desktop-review-section.jpg | 28 Luna market_publication_fix；root整页/持久化；旧偏好→别名→准确范围→规范V2 | 四alias例包含于182；exact inverse与独立review；28仅test-only accepted/closed | 历史该次写入调度未知，browser/SQLite仍NV |
| H02/H08/H09/J03；同E1/E3 | 29 Luna workspace_complete_diagnosis；root整页/持久化；coverage-only实际请求→公开控制/诊断→lateD1→重开 | readiness14包含于182、完整tsc通过；29仅test-only accepted/closed | 实际plot/供应商/持久化与未覆盖restore仍NV |
| H02/H08/H09/J03；E3准确回合/返回，E1异步状态 | 24/26测试owner Luna；root完整流；原四旅程及merge3确认导入返回 | workspace94包含于182，原动作/断言与测量局部预算保留 | 实际保存→返回→reload仍NV，两票open |
| H03/H06/J01/J03；E1现金说明，E2 ../homepage-design-report-20261006/desktop-overview.jpg | 27生产owner Luna market_publication_fix；root完整流；same-key pending/ABA/PUT→新读→晚旧读 | strong consumer matching-version GREEN，独立exact source review，lint0error15warning | 实际API/SQLite/真实页与视觉仍NV，27open |
| H04/H07/P2-04；E1/E2桌面、E4 mobile-top.jpg与E5 mobile-chart.jpg | 11原trend owner冻结；root首图/整页；选币→真实曲线→历史点→同日表格→当前 | 单币/日期有历史限定证据；当前自动≤92/730与桶内边界明确未实现 | root首条真实图尚未接受，依赖实现不解锁；11open |
| V01/V02/V03/V04；同E2/E4/E5，1440×1000/1280×720/390×844/320 | 11/12依赖布局原owner冻结；root整体，非实现者视觉 | 2:1与单列CSS存在；当前顺序/密度尚有源码差异，字号/44px局部source PASS | 目标信息顺序/间距与内容宽断点、首屏实际plot/视觉/设备NV，不删范围 |

派发权威、最小真实图门槛和30产品行完整保留。源码缺口与已实现但缺浏览器/SQLite/视觉证据明确区分，见[当前独立产品审计](acceptance/current-product-gaps-readonly-audit.md)。最新预览仍运行但没有真实浏览器检查，自动安全审核拒绝不得绕过；本功能open/acceptance-failed。
