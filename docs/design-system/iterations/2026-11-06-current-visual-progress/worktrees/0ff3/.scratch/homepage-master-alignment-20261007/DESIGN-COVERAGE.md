> **最新状态（2026-10-09，HA06）**：总体（CNY）/ A股 / 港股 / 美股已实现；相关 133 项测试、3 项 metadata 失败/取消测试、最终构建与类型检查通过，真实浏览器与独立多尺寸视觉审查通过。全库回归仍有失败，整体验收保持 OPEN；下方 3189 项通过属于历史版本，不能代表当前源码。详见 [HA06 验收](evidence/ha06/acceptance.md)。

> **当前状态（2026-10-09）**：见 [整体验收](FINAL-ACCEPTANCE.md)。浏览器权限已恢复；HA03五宽展开态通过；HA04最终窄屏通过、HA05全量失败处理进行中。下文保留历史过程，旧NOT VERIFIED或进程号不代表最新状态。

# DESIGN-COVERAGE

## 2026-10-08 浏览器恢复后 HA02

用户确认新增权限后，原入口已成功访问。H02/H03/H12 窄屏页头与 H05 图表控件在真实画面发现 FAIL，归属 Luna / issues/02-browser-layout.md；root 独立复核与整页数据流验收。准确参考与失败测量、旅程和视口见该票及 evidence/browser-20261008/。只修推荐 wrapper CSS，其他 H01–H14 保持既有 owner/契约；历史 NOT VERIFIED 记录保留。

原始依据：最新用户要求与 BRIEF.md R1–R5；visual-contract.md H01–H14。准确参考：reference/master-manifest.json 中正式 master 冻结源码，旧图路径详见 visual-contract.md。无本轮 approved 画板；准确渲染截图待浏览器恢复，不使用旧图冒充。非 S0/S1/S2 复盘设计变更；仅 H09 导航涉及既有复盘，原状态契约保留。

| 需求 / 规格锚点 | elementID | 准确参考 | 阶段/状态 | owner / 任务 | 交付组件 | 浏览器操作 | 可观察预期与反例 | 证据路径 | pass/fail/unverified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BRIEF.md R1/R2；visual-contract.md H01 | H01 | master 7a5d137 `app/components/trade-review-workspace.tsx:5664–5782`；`app/globals.css:6239–6264`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 主导航→首页/交易库/分析/数据/设置 | 保持原可达性和选中，不能漏入口 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H02 | H02 | master 7a5d137 `app/components/dashboard/review-dashboard.tsx:1139–1149`；`unified-page-header.tsx:90–122`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 进入首页，读身份/时间/待复盘入口 | 不是旧两卡概念页 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2/R3；visual-contract.md H03 | H03 | master 7a5d137 `review-dashboard.tsx:1075–1185`；`unified-page-header.module.css:76–246`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 选范围/展开筛选/输入搜索 | 全控件保留并能联动，不能重置 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H04 | H04 | master 7a5d137 `app/components/dashboard/room-portfolio-summary.tsx:130–166`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 完整/部分/缺失指标 | 完整小计覆盖，不虚构总额 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2/R3；visual-contract.md H05 | H05 | master 7a5d137 `review-dashboard.tsx:1198–1231`；当前 `room-holdings-history.tsx`，790文件基线；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 切日期/币种/指标/期间/粒度 | 实际历史图保留，范围不因样式重置 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H06 | H06 | master 7a5d137 `app/components/dashboard/room-allocation.tsx:195–272`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 切市场/类型/币种/展开缺口 | 保留全卡缺口与完整原因 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H07 | H07 | master 7a5d137 `app/components/dashboard/room-holdings.tsx:424–455`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 滚动→持仓→搜索排序分页 | 数值列完整，原局部横滚 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H08 | H08 | master 7a5d137 `review-dashboard.tsx:1262–1361`；`room-performance.tsx:670–913`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 历史期间/口径/收益日历贡献 | 全文与图表保留 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H09 | H09 | master 7a5d137 `room-pending-reviews.tsx:98–153`；workspace`:4599–4675`、`:5243–5263`；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 待复盘→打开→交易库返回 | 真实入口，复盘样式不迁移 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R1/R2；visual-contract.md H10 | H10 | 本轮前工作树 `use-holdings-valuation-refresh.ts`、workspace、`review-dashboard.tsx`；evidence/product-baseline-sha256.json；不归因于master；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 异步补齐/手工补齐/取消/错误 | 沿用原机制，不阻断正常流程 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R3；visual-contract.md H11 | H11 | visual-contract.md H11；冻结 master workspace`:5828–5838`；新wrapper一次挂载测试；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 在同范围同导航连续切视觉 | 无卸载重建、数值/范围/状态不变 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R2/R3；visual-contract.md H12 | H12 | master 7a5d137 `app/globals.css:6239–6385`；dashboard CSS`:1585–1591`；visual-contract.md H12；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 窄屏上下滚动/边界/Tab | 顶部到底部可达，不裁切内容焦点 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R4；visual-contract.md H13 | H13 | conf/runtime.json + conf/README.md；visual-contract.md H13；严格当前工作树绝对副本路径；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 正确副本/无标记/路径错/符号链接 | 仅隔离副本启用；错误配置不挂业务工作区 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |
| BRIEF.md R4/R5；visual-contract.md H14 | H14 | 原 `design-system-prototype.tsx` 和 CSS 基线SHA；visual-contract.md H14；旧样板路径说明；历史图见visual-contract.md；非本轮渲染 | 首页现有/推荐，加载/部分/空/选中/焦点按本行适用 | Luna / 01；root集成和整页 | HomeDesignPreview +既有Workspace；H13 runtime guard | 打开历史组件样板入口 | 旧复盘阶段和原Text规则保留 | evidence/implementation.md、evidence/independent-review.md、acceptance.md；截图缺失 | SOURCE PASS（限定源码命题）；UI unverified |

## 本轮阶段结论（2026-10-08）

独立报告逐一核对 H01–H14 的源码装配、选择器、范围、守卫和保留条件，最终 SHA 锁定；表中的 SOURCE PASS 仅表示报告中列出的源码命题，不表示该行全部浏览器验收通过。root 独立类型/lint、7 项新预览测试、11 项旧安全测试、最终 build+5 项运行测试通过；三页面和15项CSS/JS HTTP通过。见 [独立源码报告](evidence/independent-review.md)、[最终验收记录](acceptance.md)。

H11 的单个 wrapper 测试不覆盖真实工作区日期/导航/图表范围/焦点/滚动；H12 滚动声明不等于实际滚动。H13 运行配置与只读 DB 摘要有独立证据，但完整业务写入/返回/重载未执行。所有行的真实截图/字体/交互/视觉仍 unverified，任务维持 open / acceptance-failed。用户待选择实际画面感受，候选不固化进正式全局样式或项目指令。

## 2026-10-08 HA02复验
H02/H03/H05/H11/H12本轮布局子项PASS，参见evidence/browser-20261008/review.md；其他未验证门槛保留。

## HA03 窄屏展开状态追加
|需求/规格|元素|参考|状态|owner|组件|旅程|预期/反例|证据|结论|
|---|---|---|---|---|---|---|---|---|---|
|visual-contract H03/H12|全局菜单|evidence/browser-followup-20261008/user-menu-narrow.jpg|390展开|Luna实现/root整页及数据|preview CSS|打开用户/待处理→滚动→关闭|菜单完整处于视口，不得左裁|同目录复验|FAIL 待修复|

2026-10-08补充：H03/H12 HA03由Luna实现、root审查；第一次修复浏览器FAIL，最终修正已构建，最终展开态NOT VERIFIED。日期输入和真实复盘保存返回重载的限定旅程PASS，证据 evidence/browser-followup-20261008/review.md。

## 2026-10-09 收尾验收
H09/H12新增HA04：待复盘跳转导致document scrollY479、比较栏消失及窗口下半空白。参考 final-20261008/pending-jump.png，Luna唯一CSS实现、root整页与数据负责人/独立验收。旅程顶部→待复盘→顶部；预期仅工作区滚动、文档scrollY=0、比较栏保留、目标标题可见。HA03新增关闭命中区与面板下缘缺陷亦保留原始测量。适用输入方式只按实际能力记录，不把桌面窄屏当物理触屏。

## HA05 集成回归门槛
H01/H09/H10/H11：真实公共入口→复盘→刷新→返回数据页；来源 visual-contract 与既有workspace行为测试。Luna acceptance_scope_audit 唯一workspace/test owner，root集成数据流/视觉复核。7文件62失败证据 final-20261008/unit-bounded.log；issues/05-regression-gate.md，当前FAIL。

HA06: 仓库全量门槛 deploy 三失败，无新增UI元素/视觉偏离；依据 final-20261008/unit-bounded.log、test-diagnosis.md；owner narrow_overlay_fix；journey 临时目录部署/备份恢复；evidence final-20261008/deploy-regression.md。当前只读诊断。

2026-10-09最新：HA03展开菜单5宽PASS，HA04跳转1440/390/320仅内容滚动PASS；旧FAIL与首次未验结论保留为历史，当前以FINAL-ACCEPTANCE.md为准。HA06 root默认预算独立3/3 PASS（deploy-independent.log），局部票关闭；全量门槛尚未解除。

## 2026-10-09 最终证据补充
HA05 raw/display依赖分离已修复；同fixture metadata回归与独立审核见 final-20261008/ha05-metadata-only-strict-receipt.md、ha05-independent-source-review.md。最终构建、重入已保存计划、首页上滚与库保护见 final-browser-review.md。全部触屏/实际中文字形证据仍NOT VERIFIED；设计密度选择与正式公共样式固化仍待用户选定候选。

## 2026-10-09 用户功能复核：重开H03/H04/H05/H06/H07
HA06明确总体CNY与常驻市场Tab为持仓主流程。既有“保持现状”合同不足，旧结构PASS仅保留历史证据；该功能当前FAIL/未实施。参考issues/06-holdings-overview-market-tabs.md；实施前需补全具体状态与独立验收映射。

## HA06 approved implementation coverage — 2026-10-09
User confirms implementation of overall CNY then market tabs. Exact element/requirement/owner/journey/evidence mapping is [ha06-plan.md](ha06-plan.md), rows HA06-01–08. Implementer Luna; whole-page visual/data integration/acceptance root; independent visual reviewer assigned after screenshots. All new rows NOT VERIFIED until acceptance. Earlier currency-first preservation is superseded only within holdings scope.

## 2026-10-09 HA06 当前迭代

总体CNY与分市场联动已实施并在真实浏览器验证；独立视觉门禁PASS，详见 [HA06验收](evidence/ha06/acceptance.md)。原始交易库保护检查PASS。全量回归仍有失败，最终功能门禁未关闭，整体仍在验收；此前3189通过属于上一轮证据，不代表当前源码通过。预览服务采用 start-preview.sh 和隔离数据库。

## 2026-10-09 最后复核：刷新局部回归已关闭

root 独立复跑 refresh-root-final.log：8/8 PASS，exit 0。只根据测得的 IndexedDB/React 加载门控耗时调整三条旅程的局部查询/测试预算；业务断言、fixture 和全局配置未改变，原始 FAIL 日志保留。详见 evidence/ha06/refresh-first-diagnosis.md 与 refresh-final-local-budgets.md。本轮 HA06 133 项及 metadata 3 项继续有效。其他全库失败尚未逐项关闭，全项目仍 OPEN；不声称全部验收完成。

## HA07 视觉与文案回归（2026-10-09）
| ID/规格 | 元素 | 参考 | 状态 | owner | 组件 | 浏览器旅程/反例 | 证据 | 状态 |
|---|---|---|---|---|---|---|---|---|
| HA07-01 v0.2文字角色/visual H02,H04–H09 | 标题、数值、辅助信息 | evidence/ha06/after-1440.png，after-390-cards.png | 完整/部分/空市场 | root审核，Luna待派修复 | dashboard/preview | 同角色测font/line/color，不能缩所有文字 | evidence/ha07/ | unverified |
| HA07-02 v0.2尺寸与状态/H03,H05,H07,H08 | 按钮/折叠/日历/表格 | 同上+after-320-cards.png | 选中/焦点/禁用/长数值 | root审核 | preview/public控件 | 鼠标键盘使用；桌面36/窄屏44；不能隐藏价格 | evidence/ha07/ | unverified |
| HA07-03 v0.2总体/市场契约,H04,H06,H10 | 小计/原因/更新时间 | evidence/ha06/after-overall-chart.png | 部分估值/更新/未知 | copy_audit只读，root确认 | summary/history/allocation | 读全文对照数据；未知不作0，币种不作市场 | evidence/ha07/ | unverified |
| HA07-04 v0.2验收与例外/H11,H12 | 整页密度与滚动 | evidence/ha06/after-1440.png/390/320 | 相同数据和范围 | root，独立reviewer | preview | 全部指定宽度与边界，无裁切且主次清楚 | evidence/ha07/ | unverified |

### HA07 已证实缺陷修复分工（2026-10-09）
- HA07-F1：H04/H09 用户盈亏颜色契约；owner ha07_ui_audit（限定 CSS 实现），root 全页视觉验收。实测 inline #26a69a/#ef5350 被 #00d5b6/#ff6b78 覆盖，证据 desktop-measurements.json。验收两组用户颜色不被覆盖；不变更领域颜色含义。
- HA07-F2：H03/H05/H08 控件尺寸及焦点；owner ha07_ui_audit；推荐预览所有可交互 button/summary 桌面至少36px，窄屏/粗指针至少44px；图表交互容器焦点2px #9ecaff offset2px。保留图标本体尺寸、七列日历和完整文字，不迁移布局。before-1440-stable.png 为同视口基线，root 验收1440/390/320。
- HA07-F3：H04/H06 市场空态和账户现金；owner ha07_copy_audit（限定 TSX及关联测试）。市场无仓使用“当前市场暂无持仓”，总体保留“当前空仓”；现金全视图固定账户范围。验收总体有仓/所选市场无仓及总体现金说明反例。root负责跨模块数据语义验收。
- 其他审查项先核实并保留 OPEN，不将静态推测当成浏览器 FAIL。

HA07 集成状态：F1/F3实机复核通过；F2经整页审查纠正了缩小原44px控件及窄屏43px回归，最终复验记录见 evidence/ha07/acceptance.md。整体OPEN，独立测试1项超时未消除。


## HA08 视觉详细检查（2026-10-09）

新鲜1440/760/390截图与DOM测量见 [HA08报告](evidence/ha08/report.md)。发现贡献金额10px、日历8–9px、同级标题不一、断点页头断字及窄窗信息下沉；视觉仍FAIL，功能整体验收保持OPEN。本轮只读审查完成，不包含修复放行，保留HA07历史证据。

## HA09 用户授权修复（2026-10-09）
原审计仍保留；本轮每项初始 NOT VERIFIED。整体视觉/数据接线及独立看图负责人 root。
| ID / spec | elementID | reference | states | owner/task | component | journey | expected / counterexample | evidence | result |
|---|---|---|---|---|---|---|---|---|---|
| V01: evidence/ha08/report.md:15–24 / v0.2 | HA08-V01 (audit IDs, no new design element) | evidence/ha08/desktop-lower.png | desktop/narrow; partial/updating/terminal | ha09_static / issues/09-readable-charts.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_static-report.md + root browser | NOT VERIFIED |
| V02: evidence/ha08/report.md:15–24 / v0.2 | HA08-V02 (audit IDs, no new design element) | evidence/ha08/desktop-lower.png | desktop/narrow; partial/updating/terminal | ha09_static / issues/09-readable-charts.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_static-report.md + root browser | NOT VERIFIED |
| V03: evidence/ha08/report.md:15–24 / v0.2 | HA08-V03 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_static / issues/09-readable-charts.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_static-report.md + root browser | NOT VERIFIED |
| V06: evidence/ha08/report.md:15–24 / v0.2 | HA08-V06 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_static / issues/09-readable-charts.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_static-report.md + root browser | NOT VERIFIED |
| V07: evidence/ha08/report.md:15–24 / v0.2 | HA08-V07 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_static / issues/09-readable-charts.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_static-report.md + root browser | NOT VERIFIED |
| V08-number: evidence/ha08/report.md:15–24 / v0.2 | HA08-V08-number (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_static / issues/09-readable-charts.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_static-report.md + root browser | NOT VERIFIED |
| V04: evidence/ha08/report.md:15–24 / v0.2 | HA08-V04 (audit IDs, no new design element) | evidence/ha08/mobile-390.png | desktop/narrow; partial/updating/terminal | ha09_dynamic / issues/10-stable-refresh.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_dynamic-report.md + root browser | NOT VERIFIED |
| V05: evidence/ha08/report.md:15–24 / v0.2 | HA08-V05 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_dynamic / issues/10-stable-refresh.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_dynamic-report.md + root browser | NOT VERIFIED |
| V09: evidence/ha08/report.md:15–24 / v0.2 | HA08-V09 (audit IDs, no new design element) | evidence/ha08/mobile-390.png | desktop/narrow; partial/updating/terminal | ha09_dynamic / issues/10-stable-refresh.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_dynamic-report.md + root browser | NOT VERIFIED |
| D01: evidence/ha08/report.md:46–50 / v0.2 | HA08-D01 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_dynamic / issues/10-stable-refresh.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_dynamic-report.md + root browser | NOT VERIFIED |
| D02: evidence/ha08/report.md:46–50 / v0.2 | HA08-D02 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_dynamic / issues/10-stable-refresh.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_dynamic-report.md + root browser | NOT VERIFIED |
| D03: evidence/ha08/report.md:46–50 / v0.2 | HA08-D03 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_dynamic / issues/10-stable-refresh.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_dynamic-report.md + root browser | NOT VERIFIED |
| V08-time: evidence/ha08/report.md:15–24 / v0.2 | HA08-V08-time (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_diagnostics / issues/11-actionable-diagnostics.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_diagnostics-report.md + root browser | NOT VERIFIED |
| D04: evidence/ha08/report.md:46–50 / v0.2 | HA08-D04 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_diagnostics / issues/11-actionable-diagnostics.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_diagnostics-report.md + root browser | NOT VERIFIED |
| D05: evidence/ha08/report.md:46–50 / v0.2 | HA08-D05 (audit IDs, no new design element) | evidence/ha08/desktop-top.png | desktop/narrow; partial/updating/terminal | ha09_diagnostics / issues/11-actionable-diagnostics.md | see ticket exact ownership | see ticket journey | report exact rule; no data loss or layout jump | evidence/ha09/ha09_diagnostics-report.md + root browser | NOT VERIFIED |
| V10 / HA08:24 | font diagnostic | evidence/ha08/mobile-390.png | Chinese rendered font | root | inherited fonts | inspect browser capability | do not invent glyph evidence or replace fonts speculatively | evidence/ha09/acceptance.md | NOT VERIFIED |


## HA09 2026-10-10 修复及复验更新
V01–V09与D01–D05已实施；root独立审查后返工了诊断计数、窄屏菜单、条件状态占位、标题自然流和边距折叠。限定视觉/交互与自动化证据见[evidence/ha09/acceptance.md](evidence/ha09/acceptance.md)，该记录更新本轮初始NOT VERIFIED行；原始FAIL不删除。全项目保持OPEN：外部行情全部终态、更新时交互时延、实际中文字形和物理触屏未全部验证，既有全量回归失败未在本轮关闭。候选尚未正式固化、无推送合并。

## HA09 data safety follow-up (2026-10-10)

| Requirement | element / journey | source contract | owner | evidence | status |
|---|---|---|---|---|---|
| Cancel/provider failure preserves valid cached prices and coverage while exposing truthful freshness/gaps; never roll back another instrument's successful write | HA08-D01/D02/D03; automatic update → provider failure/cancel → settled valuation | issues/10-stable-refresh.md data-safety clauses; `trade-review-workspace.tsx` market-state publication; `sync-service.ts` durable coverage commits | ha09_dynamic data-sync follow-up; root integrated acceptance | evidence/ha09/delivery-data-diagnosis.log; ha09_dynamic-report.md; new regression log | IN PROGRESS |

HA09取消缓存数据安全：root最终通过上述源码边界与真实浏览器双重验收，证据evidence/ha09/root-cancel-snapshot.json及cancel-fixed-browser.json；不新增持久化回滚。旧OPEN记录保留，具体取消回退已关闭。外部provider穷举/时延仍未验证。
