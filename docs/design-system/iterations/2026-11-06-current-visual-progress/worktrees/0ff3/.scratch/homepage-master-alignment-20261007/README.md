
## 2026-10-09 HA07 本轮回归（整体仍 OPEN）

视觉/文案已修复用户配色覆盖、小控件命中高度、图表焦点、市场空态、现金账户范围。独立回归173项中172通过、1项5秒超时且单独复跑仍失败；类型检查和限定lint通过。完整证据、真实截图、未验证清单与启动方式见 [HA07验收记录](evidence/ha07/acceptance.md)。未将worker通过代替集成验收，未关闭全库历史失败。

> **最新状态（2026-10-09，HA06）**：总体（CNY）/ A股 / 港股 / 美股已实现；相关 133 项测试、3 项 metadata 失败/取消测试、最终构建与类型检查通过，真实浏览器与独立多尺寸视觉审查通过。全库回归仍有失败，整体验收保持 OPEN；下方 3189 项通过属于历史版本，不能代表当前源码。详见 [HA06 验收](evidence/ha06/acceptance.md)。

> 2026-10-09 用户复核：持仓“总体CNY → 分市场Tab”存在已确认功能设计缺口。整体状态重开，见 [HA06](issues/06-holdings-overview-market-tabs.md)。既有测试/布局证据保留，不能作为此需求的通过证据。

> **当前验收入口：[FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)**。实现和可执行桌面验收已收尾；全量 Vitest 与新增快照回归分别通过。触屏/实际中文字形仍 NOT VERIFIED，候选密度待选择。

# 首页按正式 master 拉齐

State: open；Status: implemented-regressions-open。结构基准：origin/master 7a5d137（已 fetch，与本地 master 相同），当前工作树已有修复保留。真实首页样板已实现并启动；九视口布局、五宽菜单、1440/390/320跳转滚动、导航及隔离保存旅程已有证据。历史版本全量 Vitest 曾通过（3189 项通过、6 项按既有配置跳过；当前版本全量未通过）；最后快照编辑回归及最终构建真实浏览器复核已完成；能力受限项目不能声称已验收。

- [需求与范围](BRIEF.md)
- [视觉契约](visual-contract.md)
- [覆盖矩阵](DESIGN-COVERAGE.md)
- [01 在完整首页比较视觉调整](issues/01-master-aligned-homepage.md)
- [验收](acceptance.md)

新版入口 [完整首页视觉比较](http://127.0.0.1:3031/design-preview)；旧合成组件/复盘样板保留 [/design-preview/component-sample](http://127.0.0.1:3031/design-preview/component-sample)。顶部切换只改变同一工作区的 class；“现有首页”包含此前工作树修复，不冒称纯 master 运行画面。仅隔离数据库副本启用新版；正式首页和正式库不改。浏览器权限已恢复。当前逐项结论见 [整体验收](FINAL-ACCEPTANCE.md)，触屏与中文字形命中仍缺少实测。

2026-10-08：独立 [master 首页源码审计](evidence/master-homepage-source-audit.md) 已建立完整装配/状态/控件清单；已取正式与隔离副本只读摘要 evidence/database-before.json。结构源码证据不能替代真实 UI 验收。

早期限定范围 root 独立执行类型检查、scoped ESLint、7 项新预览测试、11 项旧样板安全测试、最终构建及 5 项运行检查，全部通过。3 个页面与 15 项 CSS/JS 的 HTTP 检查通过，最终 CSS 辅助文字规则已进入服务资源。790 个既有产品文件中，仅 design-preview/page.tsx 改动，另新增 6 个许可文件；此前修复均保留。两库各 46 表计数和 6 项受保护表摘要在可重复前后采集中稳定，文件身份不同。具体证据和限制见 [验收记录](acceptance.md)。

启动：项目已有依赖与最终构建时，运行 `sh .scratch/homepage-master-alignment-20261007/start-preview.sh`。脚本固定本工作树、隔离路径、标记和 3031 端口，不改项目默认配置。先确认 3031 空闲；不自动结束其它会话服务。源码修改后先 `npm run build` 再启动。当前进程与日志见 [当前启动回执](evidence/final-20261008/start-ha05-final.json)。

设计规则见 [首页规范候选 v0.2](../../docs/design-system/TradeReview-首页拉齐-v0.2.md)。候选尚未选定；整页公共样式、组件和 AGENTS.md 的固化仍须真实画面选择及相关验收。

2026-10-09：HA03菜单及HA04滚动已修复并由root真实浏览器接受，历史失败截图保留；HA05严格对照已收尾，详见最终验收。桌面最新对照为 evidence/final-20261008/pair-1440-*-v2.png。

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
