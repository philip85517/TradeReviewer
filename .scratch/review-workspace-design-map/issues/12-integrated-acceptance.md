# 确定整份规范的整合与独立验收方案

2026-11-05 补充：当前 3091 预览绑定冻结 candidate-45；短高布局、价格视野、回放/场景、输入计算、焦点、部分图标及 Text 圆点居中在限定视口和操作路径内已有修复证据。当前 Text 自由锚点与成交标记的视觉区分仍 **FAIL**，candidate-44 隔离候选也未通过；原生下拉的部分输入方式、设备、真实 TradingView 和业务持久化等仍有 **NOT VERIFIED**。详见[当前版本验收](../evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)与[问题 17](17-review-text-overlay-state.md)。功能、状态与独立视觉门禁须分别完成，用户确认原型后才可回填正式规范；本票仍开放。

2026-11-05：candidate-v37 独立功能、状态链及视觉门槛均 FAIL，另有必需项 NOT VERIFIED；原通过记录只适用于其历史版本。已归档[40 组结果及证据](../evidence/independent-acceptance-20261104/ACCEPTANCE.md)，用户已授权[依次修复](../evidence/systematic-fixes-20261105/PLAN.md)。所有适用门槛完成新版本验证和用户确认前，本票保持开放，正式规范不回填候选。

ID: review-design-12
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:grilling
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

所有决定如何汇成可执行的文档设计包，哪些证据足以接受设计、哪些必须留到业务实现验证？

## Scope / What to build

目标：确定后续全文与画板修订的完整交付边界，防止局部通过掩盖整体缺失。

本票解决文档设计决定；供讨论的产物为：完整交付清单、后续制作顺序、独立审查与最终验收标准。 不实施业务代码，不将候选方案当作用户决定。

元素：E01–E22及新增批次/过程指标/评分卡。预计影响章节：RV01–RV10。

## Refs

- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV01–RV10，本次基线行 346–398。
- [原 E01–E22 元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)：§5及状态约束。
- [来源索引](../evidence/source-index.md)：用户评论、截图与候选建议分列。
- [用户 TradingView 原图](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-reference.png)
- [已记录的用户直接要求](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-contract.md)
- [旧画板 01-entry-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/01-entry-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 02-holding-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/02-holding-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 03-final-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/03-final-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 04-records-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/04-records-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 05-conflict-1440.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/05-conflict-1440.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 06-entry-1280.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/06-entry-1280.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 07-entry-390.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/07-entry-390.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 08-boundaries.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/08-boundaries.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 09-export.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/09-export.svg)（比较旧状态用，不作为新方案已批准证据）。
- [旧画板 10-nav-expanded.svg](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/images/10-nav-expanded.svg)（比较旧状态用，不作为新方案已批准证据）。

## Blocked by

- [确定沉浸式工作区与左右区域职责](04-immersive-layout.md)
- [确定 TradingView 绘图与回放的逐项对齐契约](05-tradingview-contract.md)
- [确定节点计划与持仓标注的协作方式](06-plan-and-notes.md)
- [确定持仓过程指标与可比较的风险口径](07-process-metrics.md)
- [确定退出归因与五星评价卡](08-exit-ratings.md)
- [确定保存、完成、导出与关闭的职责](09-save-export-return.md)
- [确定窄屏、键盘及异常状态的空间规则](10-responsive-and-states.md)
- [确定全文论述结构与图示分工](11-document-argument.md)
- [确定公共视觉样例与参数标注](13-visual-specimens.md)

## 执行的主要思路

把三条核心旅程贯穿全文、图示和元素矩阵，逐项检查来源/对象/时间/状态/保存/视觉；形成后续制作顺序与独立审查合同。

## 验收标准与反例

- [ ] 原4条评论与本次截图约束逐项对应任务、章节、画板、owner及验收证据；E01–E22和新增元素均有去向。
- [ ] 三条完整旅程、必需状态及交易配对反例贯穿全文；旧规则冲突有明确替换决定，不存在互斥描述。
- [ ] 规定非画板作者独立同态视觉对照，工具图标逐项比对，正文与图链/目录/评论锚点/manifest验证；失败与未验证阻止设计包接受。
- [ ] 交付包清楚区分已批准决定、候选、待定项；不把静态设计当真实回放或数据库通过，不把任务地图完成当全文已改写。

必须排除的反例：各组件票通过后直接宣布整页通过；沿用旧manifest及旧截图验收新布局。

## 验收证据

- 本票资产存放：`../evidence/integrated-acceptance/`；决定保存在 `../comments/review-design-12/<时间>-resolution.md`，关闭时更新上方链接。
- 决策状态：HITL 未解决；本轮候选正文制作已完成，见下方 2026-10-24 记录。用户决议与产品验收仍独立保留。
- 文档设计范围：领域规则和静态/原型对照按本票范围检查；业务真实回放、数据库及物理触控 NOT APPLICABLE（没有业务实现），对应后续实施证据要求仍保留。
- 若制作可审查原型：记录版本指纹、视口、参考状态、截图和独立观察结论，不能以原型通过替代产品功能。

## 派发说明

领取后先读本票全部内容及依赖的 Resolution。唯一领取者可写本票证据及决议；共享地图由 coordinator 更新，不并行编辑权威正文、画板或旧任务。外部研究使用独立 research 分支并返回 context pointer；不得修改原始成交、数据库或用户评论状态。

## 历史

2026-10-24：根据当前评论、用户截图与讨论建立决策票；建图会话未作人工决定。

## 2026-10-24 全文候选制作记录

用户要求“开始推进12 项文档设计任务的改写任务”，本次据此制作完整候选正文；此前单票讨论限制不限制此次制作范围，但未获确认的决定保持候选。

- 本轮成果（RV10）：汇总 12 任务、E01–E22/N01–N04、四条评论、内容/视觉/功能分开的验收门槛。
- 文档覆盖：PASS；证据见[全文验收](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/full-rewrite-20261024/acceptance.md)及[覆盖合同](../rewrite-20261024/DESIGN-COVERAGE.md)。
- 剩余边界：最终产品整合验收仍须独立执行；不关闭其余 HITL 票。
- 本记录是制作进度，不是 HITL Resolution；原 State、依赖与决议门槛不变。

## 2026-10-24 视觉完整性门槛补充

[视觉恢复计划](../visual-recovery-20261024/PLAN.md)登记本次问题，[视觉覆盖](../visual-recovery-20261024/DESIGN-COVERAGE.md)是后续派发与整包审阅的补充合同。完整工作区和公共规范应用样例当前缺失，视觉完整性 FAIL；原型操作、独立新视觉比较、具体方案用户确认均 NOT VERIFIED。历史文字覆盖 PASS 不变，但不得合并成视觉设计包完成。

- [ ] 整页、局部规范、状态故事板三类证据都齐全，逐章能定位批准版本；不用图片数量、预算条或状态表替代视觉判断。
- [ ] 三旅程和 14 类适用状态均对应实际材料；每个重要偏差已解决或获得用户明确接受。
- [ ] 版本/视口/场景/参考/偏差/独立审阅与用户决议完整；保存原失败和旧批准历史。
- [ ] 具体设计经用户确认后再回填正式规范；规划完成与用户确认推进顺序都不使设计票自动关闭。

## 2026-10-29 candidate-v34 / v35 验收状态追加

协调者对 candidate-v34 的真实浏览器复验显示，1280×800 28→29 根时 info-row 高度均为 49px、chart y=154px 不变、play x=540.24→540.57px；然而 replay-actions 与关闭按钮在 1108×800 及 1280×800 右栏展开态重叠，candidate-v34 整体 **FAIL**。v35 间距修正后，1108×800 初始态“下一回放停点”完全裁出，且原生滚动条未滚动时不可见、鼠标水平滚动后才出现，可发现性 **FAIL**。详见[问题14](14-review-responsive-collision.md)与[版本绑定覆盖/验收记录](../evidence/review-fixes-20261028/DESIGN-COVERAGE.md)。问题仍在修复；独立复审与最终验收未完成。旧版任何 PASS 均不迁移，本票仍不接受整体交付。

## 2026-10-29 candidate-v37 后续状态

v36 的 1108px 裁切保留为该版 FAIL。v37 的九个运行文件及快照与[冻结清单](../evidence/review-fixes-20261028/candidate-v37/manifest.json)一致；协调者对回放、日期、Text、弹层和多视口进行了真实浏览器局部操作，详见 [控件登记](../evidence/review-fixes-20261028/CONTROL-INVENTORY-FINAL.md)及[操作记录](../evidence/review-fixes-20261028/coordinator/v37-audit-ax.json)。非实现者的[静态复审](../evidence/review-fixes-20261028/final-review-v37/REPORT.md)在所看画面无新 P1/P2 静态视觉阻断，仍保留三项 P3；两位独立审核者的浏览器连接不可用，独立交互实操为 NOT VERIFIED，见[记录](../evidence/review-fixes-20261028/final-review-v37-interaction-2/REPORT.md)。整体视觉、完整交互、TradingView 逐项 1:1、模拟及物理触控、正式产品持久化和用户确认均不能由局部观察替代；本票继续开放，原型经用户确认后再回填正式规范。

## 2026-11-05 系统排查和版本绑定验收

当时 3091 预览以 [candidate-31 验收台账](../evidence/systematic-fixes-20261105/task-final-candidate31/ACCEPTANCE.md)记录 I01–I40。短高度、价格视野、阶段 URL、规模数值、焦点、图标和阅读入口等修复有不同范围的实操证据；阶段、三档回放与两回合评分又以模拟首字符键盘路径补测。Text 遮挡/语义仍由非实现者判为 **FAIL**；入场/结束的坐标补测还发现锚点圆心约 1px 的几何偏移，已单独修复和验证中。其他设备、真实 TradingView 和业务持久化仍 NOT VERIFIED。

隔离的 [candidate-44](../evidence/systematic-fixes-20261105/task-04-candidate44-stage/REPORT.md)改善了 Text 身份和成交箭头遮挡，但正文与密集态空间仍未通过[独立视觉](../evidence/systematic-fixes-20261105/task-04-candidate44-stage/INDEPENDENT-VISUAL.md)。它未替换当前预览，用户也尚未确认密集态取舍。本票仍开放，不能把若干控件局部 PASS 当作整页及正式视觉规范通过。

## 2026-11-05 candidate-45 当前验收

当前预览已修正 Text 锚点圆点约 1px 的视觉偏移，限定入场/结束样本的圆心坐标与图表对应。重新按冻结版本检查的 [40 项结果](../evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)、[用户汇总](../evidence/systematic-fixes-20261105/task-final-candidate45/USER-SUMMARY.md)及[非实现者静态视觉审阅](../evidence/systematic-fixes-20261105/task-final-candidate45/INDEPENDENT-VISUAL.md)表明：密集 Text 的遮挡和身份仍 FAIL，独立浏览器操作与其他列明的链路仍未验证。此前 candidate-31 记录保留为历史，不代替本版结论。本票继续开放。
