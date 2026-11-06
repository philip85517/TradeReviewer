
## 2026-10-09 HA07 本轮回归（整体仍 OPEN）

视觉/文案已修复用户配色覆盖、小控件命中高度、图表焦点、市场空态、现金账户范围。独立回归173项中172通过、1项5秒超时且单独复跑仍失败；类型检查和限定lint通过。完整证据、真实截图、未验证清单与启动方式见 [HA07验收记录](evidence/ha07/acceptance.md)。未将worker通过代替集成验收，未关闭全库历史失败。

> **最新状态（2026-10-09，HA06）**：总体（CNY）/ A股 / 港股 / 美股已实现；相关 133 项测试、3 项 metadata 失败/取消测试、最终构建与类型检查通过，真实浏览器与独立多尺寸视觉审查通过。全库回归仍有失败，整体验收保持 OPEN；下方 3189 项通过属于历史版本，不能代表当前源码。详见 [HA06 验收](evidence/ha06/acceptance.md)。

> 2026-10-09 用户复核：持仓“总体CNY → 分市场Tab”存在已确认功能设计缺口。整体状态重开，见 [HA06](issues/06-holdings-overview-market-tabs.md)。既有测试/布局证据保留，不能作为此需求的通过证据。

# 当前整体验收 — 2026-10-09（最终记录）

State: open
Status: implemented-regressions-open
协调者/独立UI验收：root；实现：Luna。此记录是当前状态入口，历史文件里的策略拒绝、NOT VERIFIED与旧进程号只描述当时检查。

范围：完整真实首页的可逆视觉比较样板，结构基准master 7a5d137；现有版本包含工作树早期修复，不冒称纯master截图。生产样式固化仍按用户选定实际候选后进行。

以下表格为 HA06 前的历史验收，当前新增范围和重开项以文件顶部及 [HA06 记录](evidence/ha06/acceptance.md) 为准。

| 门槛 | 历史证据 | 当时状态 |
|---|---|---|
| 类型/范围lint/生产build与5运行检查 | final-20261008/ha05-root-frozen-typecheck.log、lint-ha05-final.log（0错误/13警告）、build-runtime-ha05-final.log（构建及5运行检查通过） | PASS |
| 仓库全量Vitest | unit-final-serial.log/json：327文件通过、3跳过；3189用例通过、6跳过，exit0；此前unit-bounded.log失败保留 | PASS（补充快照测试加入前）；新增测试单独验证，见 strict-receipt、strict-red-4/green-4 与 root-frozen-green 日志。未将单独运行伪报为全量3190测试运行 |
| HA02页面布局 | browser-20261008/review.md；9视口无全页横溢出、图表工具完整 | PASS（所述范围） |
| HA03展开菜单 | final-20261008/menu-bounds.json、notice-final-bounds.json、对应截图；5宽 | PASS（鼠标/键盘范围） |
| HA04跳转滚动 | jump-final-1440、jump-final-390-v2、jump-final-320；documentY=0，仅内容区滚动，鼠标可返回顶部 | PASS（鼠标；另keyboard-scroll-*记录1440/390 Enter与PageUp） |
| 首页导航/持仓/分布/历史 | final-20261008/navigation.json、holdings-pagination.txt、allocation.txt；实际搜索甘李得到1行，清空再翻页6–8，返回1–5；history-controls.txt 验证账户贡献、月胜率、日历前后月 | PASS（所述旅程） |
| 真实保存→返回→重载 | browser-followup-20261008/review.md、persisted-plan.json、database-comparison.json；隔离库写入，正式库保护摘要不变 | PASS（单条计划旅程） |
| 回放补充 | final-20261008/replay-s0/next-bar/next-decision/return-early.png；下一根显露真实K和买入，返回早期恢复OHLC | 部分证据，不代表全回放验收 |
| 整页视觉对照 | final-20261008/pair-*.png；1440改用*-v2与state.txt，同数据同筛选；root直接对比桌面及窄屏画面 | PASS（结构/保留内容范围）；密度取舍待用户选定 |
| 触屏与真实字体 | 无模拟触控/物理触屏/实际中文字形命中证据 | NOT VERIFIED |

浏览器原入口权限已恢复。偶发CDP超时不能作为安全策略仍拒绝的证据；自动补齐进行时较易发生，取消后操作恢复，但原因未证实，见test-diagnosis.md。

## 运行
当前服务与构建证据 final-20261008/start-ha05-final.json、server-ha05-final.log。隔离库 `.scratch/local-review-20261006/review.sqlite`，显式环境覆盖，不使用正式业务库。
预览：http://127.0.0.1:3031/design-preview
启动：已有依赖时先 `npm run build`，3031空闲后 `sh .scratch/homepage-master-alignment-20261007/start-preview.sh`。不自动结束别的会话服务。

## 未完成
实现与桌面/响应式范围验收已完成，HA05同fixture旧实现RED在metadata后丢失快照编辑状态，修复GREEN通过；详见独立review与严格receipt。最终服务fresh browser复核、保存计划读回、上滚及数据库保护检查见 final-browser-review.md。

仍缺能力受限的模拟/物理触屏、实际中文字形命中证据，保持NOT VERIFIED，不称“所有验收已完成”。候选采用24px金额，增强辨认但使首屏图表下移；阅读密度待用户选定后才固化到正式首页。完整复盘改版不在本次首页拉齐交付范围，旧组件样板未被提升为生产方案。未推送、合并、发布。

## 保留的旧样板
H14入口和进入复盘工作区可用，下一K线使 D69→D70、OHLC从64/64.7/62.3/63变为63/63.7/61.61/62.31。component-sample-nextbar-top.png保留实际画面。此旧组件样板存在长批注接近图表右边界和较大纵向空白，不能称其视觉已整体通过，也不将其作为本次首页推荐方案。

## 2026-10-09 HA06 当前迭代

总体CNY与分市场联动已实施并在真实浏览器验证；独立视觉门禁PASS，详见 [HA06验收](evidence/ha06/acceptance.md)。原始交易库保护检查PASS。全量回归仍有失败，最终功能门禁未关闭，整体仍在验收；此前3189通过属于上一轮证据，不代表当前源码通过。预览服务采用 start-preview.sh 和隔离数据库。

## 2026-10-09 最后复核：刷新局部回归已关闭

root 独立复跑 refresh-root-final.log：8/8 PASS，exit 0。只根据测得的 IndexedDB/React 加载门控耗时调整三条旅程的局部查询/测试预算；业务断言、fixture 和全局配置未改变，原始 FAIL 日志保留。详见 evidence/ha06/refresh-first-diagnosis.md 与 refresh-final-local-budgets.md。本轮 HA06 133 项及 metadata 3 项继续有效。其他全库失败尚未逐项关闭，全项目仍 OPEN；不声称全部验收完成。


## HA08 视觉详细检查（2026-10-09）

新鲜1440/760/390截图与DOM测量见 [HA08报告](evidence/ha08/report.md)。发现贡献金额10px、日历8–9px、同级标题不一、断点页头断字及窄窗信息下沉；视觉仍FAIL，功能整体验收保持OPEN。本轮只读审查完成，不包含修复放行，保留HA07历史证据。

## HA09 修复进行中（2026-10-09）
用户授权修复 HA08 V01–V09/D01–D05；任务09–11已建，V10由协调者诊断。功能仍 OPEN，三道验收尚未完成，历史失败记录保留。见 evidence/ha09/plan.md。


## HA09 2026-10-10 修复及复验更新
V01–V09与D01–D05已实施；root独立审查后返工了诊断计数、窄屏菜单、条件状态占位、标题自然流和边距折叠。限定视觉/交互与自动化证据见[evidence/ha09/acceptance.md](evidence/ha09/acceptance.md)，该记录更新本轮初始NOT VERIFIED行；原始FAIL不删除。全项目保持OPEN：外部行情全部终态、更新时交互时延、实际中文字形和物理触屏未全部验证，既有全量回归失败未在本轮关闭。候选尚未正式固化、无推送合并。


### HA09 最终复验新增回归（2026-10-10，处理中）
实际下载取消后，同一范围估值覆盖从7/8降为4/8。布局稳定性测量仍有效，但动态数据保持验收重开。证据：evidence/ha09/delivery-stability.json（acceptance文件相对路径为delivery-stability.json）。正在追踪取消恢复快照与本地缓存加载的时序，不以coverage持久化的可能机制冒充已证实根因；修复及重验前不宣称HA09整体完成。


### HA09 取消报价回退复验结论（2026-10-10 00:55，root）
已修复并独立复验：根因是取消快照在本地缓存水合前从空React状态捕获；改为水合后保存cached。取消仅恢复内存状态和原有任务回执，不新增行情coverage数据库回滚。曾提出的coverage回滚假设已否定，identity helper及无效测试已撤销；历史日志保留但不作为通过证据。

- 独立生产源码执行检查：`checks/cancel-snapshot.mjs`（从仓库根运行node），执行实际worker读取/快照/发布语句与完整restore函数；旧时序报价变null，新时序保留11，读取取消无syncing残留，较新sequence报价12受保护。证据 `evidence/ha09/root-cancel-snapshot.json`。它覆盖取消状态边界，不冒充完整provider端到端。
- 真实浏览器最终构建：1440×1000，自动下载→取消，已知市值小计均222,956.29 CNY，覆盖均7/8，盈亏均-14,117.21；chart y629/h220、actions y38/h44、tabs y128前后相同。证据 `evidence/ha09/cancel-fixed-browser.json`、`cancel-fixed-active.png`、`cancel-fixed-desktop.png`。本次发现的数据回退关闭。
- 最终检查：`typecheck-cancel-final.log`、`build-cancel-final.log`通过；`root-refresh-final.log` 17测试通过；此前94/92等分组含重叠，不累加。临时编辑窗口typecheck-cancel.log失败已由最终检查替代，历史保留。
- 服务会话82227，3031端口，隔离副本启动；预览 http://127.0.0.1:3031/design-preview 。启动脚本start-preview.sh保持服务运行。
- HA09已确认视觉、诊断及取消回退修复通过上述限定验收；全项目HA07仍OPEN。真实字体字形命中、物理触屏、所有外部provider终态/响应时延未验证，候选视觉未替代正式批准版。不宣称所有开发和全部验收完成。
