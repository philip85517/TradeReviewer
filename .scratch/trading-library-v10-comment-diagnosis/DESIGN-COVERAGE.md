# 当前评论与修复覆盖矩阵

最终状态见 [FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)：PASS。下方原诊断映射保留历史，最终40图覆盖在文末。准确源码路径均相对仓库根目录；BT=交易库正文，HP=V2.5公共规范。

共同来源：

- BT：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md`
- HP：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`
- 图稿根：`docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/`
- 公共参考：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg`；只参考公共框架，不复制首页业务模块。

| 需求/精确依据 | elementID / 准确画板 | 状态与旅程 | owner / 任务 / 后续交付 | 浏览器动作、预期及反例 | 当前证据 / 结果 |
| --- | --- | --- | --- | --- | --- |
| C03；BT38–59；HP62–79 | `journeys-date@state-demo-1-1` / `journeys-date.svg` | 日期入口→实盘普通到达 | root诊断；[01](issues/01-page-shell.md)待分配；整页母版和到达图 | 完整打开后看到导航、当前位置、来源与返回；反例：局部卡片不标宿主 | `evidence/journeys-date.jpg` / FAIL |
| C04；BT50–59；HP93–107 | `hcr06-final-sim-ab@state-demo-2-1` / `hcr06-final-sim-ab.svg` | 模拟盘列表正常态工具区 | root诊断；[02](issues/02-toolbar.md)待分配；工具栏与尺寸表 | 原尺寸看控件中心一致；输入值不误改居中；长名称不压缩命中区 | `evidence/sim-toolbar-geometry.json` / FAIL |
| C05前半；BT44、71–73 | `journeys-date@state-demo-1-1`、`hcr06-final-sim-ab@state-demo-2-1`、`01-live-normal@state-demo-3-1` | 列表↔统计；实盘↔模拟盘 | root诊断；[03](issues/03-view-switch.md)待分配；统一顶栏和切换状态组 | 比较相同位置和选中态；分别恢复条件，不新增模拟盘账户模型 | `evidence/version-source.json`、列表/统计截图 / FAIL |
| C05后半；BT110–119、133–158 | `02-simulation-normal@state-demo-3-2` / `02-simulation-normal.svg`；关联模拟盘列表图 | 普通多日期趋势；练习A的回合与统计 | root诊断；[04](issues/04-trend-data.md)待分配；跨图样例与趋势状态 | 下一步可见模拟盘；多点趋势可读、数据可对账；单点/缺失不伪装连续曲线 | `evidence/simulation-stats.jpg`、browser-checks / FAIL |
| C06；BT165–195；HP71 | `handoff@state-demo-4-1` / `handoff.svg`；下一帧`hcr06-final-pending-library.svg` | 首页→普通列表→回合集→复盘→返回；待复盘分支 | root诊断；[05](issues/05-journey.md)待分配；完整连续分镜 | 下一步应解释用户动作及目的地；普通入口不得被呈现为默认待复盘队列 | `evidence/handoff.jpg`、`reader-handoff-next.jpg` / FAIL |
| 旧C01；BT20–36 | `HOME-TLIB-GOAL`、`HOME-TLIB-ACCURACY`、`HOME-TLIB-TRADEOFF`；无图 | 第一章总分结构 | root核对；此前行文任务 | 当前总述→三个目标→取舍→边界；不代替用户接受 | 当前正文 / 结构已落实，评论pending-review |
| 旧C02；BT4–15 | `HOME-TLIB-INTRO`、`HOME-TLIB-REFERENCES`；无图 | 开篇与引用 | root核对；此前行文任务 | 当前用途总述与规范引用表分开 | 当前正文 / 结构已落实，评论pending-review |

后续实施前必须按实际修复范围补充完整状态稿、分镜和适用状态矩阵，指定整页视觉一致性及跨图样例数据的唯一负责人。此表不将尚未形成的状态稿假装为已批准参考。

## 修复阶段分派（2026-10-24）

所有五项映射的实施 owner 变为 `/root/visual_repair`（Task 1），集成 owner 为 `/root`。引用版本按 `evidence/before-repair/manifest.json` 冻结。精确状态范围为权威正文当前20张图片及 Task 1报告中列出的必要新增状态；详见计划与 visual-contract.md。完整页在1440×1000检查，日期普通到达与待复盘在1280×800检查；统计边界局部图须说明所在面板。整页与样例一致性均由同一实施人负责，不跨文件拆票重复设计。修复前结果保留 FAIL；修复后结果当前 NOT VERIFIED。

| 范围/元素 | 动作与状态 | 交付与验收依据 |
|---|---|---|
| BT03 journeys-date + 新1280 | 日期入口→普通列表 | 全局导航/返回/条件已应用；同状态宽窄对照 |
| BT04 hcr06-final-sim-ab / rounds-a / replay-a1 / replay-a2 / replay-b1 | 练习列表→2回合→具体回合 | 公共控件、A样例与选中/返回一致 |
| BT05 01-live-normal / 02-simulation-normal / 03-distribution-selected / 04-return +必要粒度边界图 | 各视角趋势→分布展开→返回 | 可见多日期曲线、样例对账、独立视角恢复 |
| BT06 handoff / pending-library / pending1280 / library-return / final-return +必要普通主线图 | 首页→普通列表→回合集→复盘→逐层返回；待复盘独立 | 连续动作、所在位置、来源、焦点及范围可核对 |
| BT07 05-loading / 06-empty / 07-error / 08-extreme / 09-missing-input | 加载/空样本/失败/极值/缺失 | 公共框架保持，缺失不补0，不伪连续 |
| 原6条评论及文档读者控件 | 目录/分镜/原尺寸/评论定位 | 文本/状态不变、迁移目标语义准确、实际浏览器验证 |

## 独立验收后的整合修复

35图整体验收 FAIL，完整 R01–R13 及逐图证据见 `evidence/independent/REVIEW.md`，协调者补充 R201–R208 见 `ROOT-REVIEW-02.md`。当前同表全部实现 owner 交接给新整合实现 Agent（gpt-6-astra / high）；其唯一写入范围和逐项要求见 `INTEGRATION-REPAIR-BRIEF.md`。独立审查者 `/root/independent_acceptance` 不参与实现。跨图状态/数据及整页视觉仍由同一实现者负责；根协调者负责生成文档、评论保真和最终阅读器操作。上轮 FAIL 保留，下一轮结果未验证。

## 最终40图与阅读器覆盖（2026-10-24，PASS）

source `8aca7949a1b05d56d27a7472115d45b9c25a07013fe3961a03883a2dd3bd1c58`；content `7584f36adeab139fc67a50b5894e7bc9afaf894a73aeb1a10716f6a04f198182`。以下每个occurrence唯一对应最终源图与正文位置。统一图稿/样例owner `/root/integration_repair`，整页集成与阅读器owner `/root`，独立视觉owner `/root/final_independent_review`。准确参考为上文BT/HP正文及公共 `home-1440.svg`；交易库框架沿用HP11，完整首页保留公共完整合同，不把首页业务模块强加到交易库列表。

每行视觉接受均见 [独立报告40图覆盖表](evidence/independent-round-3/REVIEW.md)，真实阅读动作/原尺寸查看见 [frames.json](evidence/reader-final/frames.json)中同occurrence。sha绑定见 [冻结包](evidence/repair-round-3/review-package.json)。历史改前图与现图分离，不把它们混为同一批准版本。

| 最终elementID | 精确正文 / 源图 | 用户状态与旅程 | 独立视觉 / 阅读器 |
|---|---|---|---|
| `journeys-date@state-demo-1-1` | BT `BT03` 第96行；`source/images/journeys-date.svg` | 按日期进入 | PASS / PASS |
| `journeys-date-1280@state-demo-1-2` | BT `BT03` 第96行；`source/images/journeys-date-1280.svg` | 按日期进入 · 1280px | PASS / PASS |
| `journeys-date-month@state-demo-1-3` | BT `BT03` 第96行；`source/images/journeys-date-month.svg` | 普通月份范围 | PASS / PASS |
| `hcr06-final-sim-ab@state-demo-2-1` | BT `BT04` 第131行；`source/images/hcr06-final-sim-ab.svg` | 练习列表 | PASS / PASS |
| `hcr06-final-rounds-a@state-demo-2-2` | BT `BT04` 第131行；`source/images/hcr06-final-rounds-a.svg` | 练习回合集 | PASS / PASS |
| `hcr06-final-replay-a1@state-demo-2-3` | BT `BT04` 第131行；`source/images/hcr06-final-replay-a1.svg` | 第一个回合 | PASS / PASS |
| `hcr06-final-replay-a2@state-demo-2-4` | BT `BT04` 第131行；`source/images/hcr06-final-replay-a2.svg` | 第二个回合 | PASS / PASS |
| `journeys-rounds-a-return@state-demo-2-5` | BT `BT04` 第131行；`source/images/journeys-rounds-a-return.svg` | 返回练习 A 回合集 | PASS / PASS |
| `journeys-simulation-return@state-demo-2-6` | BT `BT04` 第131行；`source/images/journeys-simulation-return.svg` | 返回模拟盘列表 | PASS / PASS |
| `journeys-rounds-b@state-demo-2-7` | BT `BT04` 第131行；`source/images/journeys-rounds-b.svg` | 选择练习 B | PASS / PASS |
| `hcr06-final-replay-b1@state-demo-2-8` | BT `BT04` 第131行；`source/images/hcr06-final-replay-b1.svg` | 另一练习 | PASS / PASS |
| `01-live-normal@state-demo-3-1` | BT `BT05` 第169行；`source/images/01-live-normal.svg` | 实盘统计 · 回合平仓日 | PASS / PASS |
| `02-simulation-normal@state-demo-4-1` | BT `BT05` 第175行；`source/images/02-simulation-normal.svg` | 模拟盘统计 · 练习保存日 | PASS / PASS |
| `distribution-amount@state-demo-5-1` | BT `BT05` 第181行；`source/images/distribution-amount.svg` | 切换金额 | PASS / PASS |
| `03-distribution-selected@state-demo-5-2` | BT `BT05` 第181行；`source/images/03-distribution-selected.svg` | 分布下钻 | PASS / PASS |
| `04-return@state-demo-5-3` | BT `BT05` 第181行；`source/images/04-return.svg` | 统计视角返回 | PASS / PASS |
| `journeys-trend-gap@state-demo-6-1` | BT `BT05` 第189行；`source/images/journeys-trend-gap.svg` | 缺失与无成交日 | PASS / PASS |
| `journeys-trend-single@state-demo-6-2` | BT `BT05` 第189行；`source/images/journeys-trend-single.svg` | 单点趋势 | PASS / PASS |
| `journeys-trend-empty@state-demo-6-3` | BT `BT05` 第189行；`source/images/journeys-trend-empty.svg` | 空样本趋势 | PASS / PASS |
| `journeys-trend-month@state-demo-6-4` | BT `BT05` 第189行；`source/images/journeys-trend-month.svg` | 月粒度趋势 | PASS / PASS |
| `journeys-trend-year@state-demo-6-5` | BT `BT05` 第189行；`source/images/journeys-trend-year.svg` | 年粒度趋势 | PASS / PASS |
| `handoff@state-demo-7-1` | BT `BT06` 第223行；`source/images/handoff.svg` | 首页到交易库的条件交接 | PASS / PASS |
| `journeys-home-entry@state-demo-7-2` | BT `BT06` 第223行；`source/images/journeys-home-entry.svg` | 完整首页交易库入口 | PASS / PASS |
| `journeys-library-list@state-demo-7-3` | BT `BT06` 第223行；`source/images/journeys-library-list.svg` | 普通实盘列表 | PASS / PASS |
| `journeys-live-rounds@state-demo-7-4` | BT `BT06` 第223行；`source/images/journeys-live-rounds.svg` | 实盘对象回合集 | PASS / PASS |
| `journeys-library-replay@state-demo-7-5` | BT `BT06` 第223行；`source/images/journeys-library-replay.svg` | 实盘回合复盘 | PASS / PASS |
| `journeys-live-rounds-return@state-demo-7-6` | BT `BT06` 第223行；`source/images/journeys-live-rounds-return.svg` | 回合集返回 | PASS / PASS |
| `journeys-library-list-return@state-demo-7-7` | BT `BT06` 第223行；`source/images/journeys-library-list-return.svg` | 列表返回 | PASS / PASS |
| `journeys-view-simulation@state-demo-7-8` | BT `BT06` 第223行；`source/images/journeys-view-simulation.svg` | 切换到模拟盘 | PASS / PASS |
| `journeys-view-restore@state-demo-7-9` | BT `BT06` 第223行；`source/images/journeys-view-restore.svg` | 切回实盘 | PASS / PASS |
| `hcr06-final-pending-library@state-demo-7-10` | BT `BT06` 第223行；`source/images/hcr06-final-pending-library.svg` | 交易库内待复盘筛选 | PASS / PASS |
| `hcr06-final-pending-library-1280@state-demo-7-11` | BT `BT06` 第223行；`source/images/hcr06-final-pending-library-1280.svg` | 交易库内待复盘筛选 · 1280px | PASS / PASS |
| `library-return@state-demo-7-12` | BT `BT06` 第223行；`source/images/library-return.svg` | 交易库返回首页 | PASS / PASS |
| `journeys-library-return@state-demo-7-13` | BT `BT06` 第223行；`source/images/journeys-library-return.svg` | 返回同一首页位置 | PASS / PASS |
| `hcr06-final-return@state-demo-7-14` | BT `BT06` 第223行；`source/images/hcr06-final-return.svg` | 统计视角返回 | PASS / PASS |
| `05-loading@state-demo-8-1` | BT `BT07` 第268行；`source/images/05-loading.svg` | 切换范围时等待 | PASS / PASS |
| `06-empty@state-demo-8-2` | BT `BT07` 第268行；`source/images/06-empty.svg` | 范围没有已平仓回合 | PASS / PASS |
| `07-error@state-demo-8-3` | BT `BT07` 第268行；`source/images/07-error.svg` | 读取失败与重试 | PASS / PASS |
| `08-extreme@state-demo-8-4` | BT `BT07` 第268行；`source/images/08-extreme.svg` | 极端分布 | PASS / PASS |
| `09-missing-input@state-demo-8-5` | BT `BT07` 第268行；`source/images/09-missing-input.svg` | 计算输入缺失 | PASS / PASS |

6评论元素：C01→HOME-TLIB-GOAL/ACCURACY/TRADEOFF；C02→HOME-TLIB-INTRO/REFERENCES；C03→journeys-date@state-demo-1-1；C04→hcr06-final-sim-ab@state-demo-2-1；C05→01-live-normal@state-demo-3-1；C06原handoff@state-demo-4-1→现handoff@state-demo-7-1。6项定位、4旧图链接与原状态保真均PASS，见 comments.json 与 integrity.json。

动态阅读控件的完整登记边界：33目录、8组分镜控制、40原尺寸入口及模态关闭、键盘前后与停止、长图焦点/滚动、评论读路径；逐项证据见 [阅读器验收](evidence/reader-final/REVIEW.md)。产品画面内部控件、业务持久化、评论写入、物理触摸等范围排除已显式记录，不计入通过率。

## 评论revision 10：诊断时待处理矩阵（2026-10-24，历史）

源图、评论ID、文件SHA及浏览器证据见[本轮复核](REVIEW-REVISION-10.md)。静态审查无产品数据库；不能用历史PASS替代本轮新目标。

| 需求 | 元素/图稿 | 旅程/状态 | owner / 任务 | 接受证据目标 | 当前状态 |
|---|---|---|---|---|---|
| C07 模式和页面层级 | 02-simulation-normal@state-demo-4-1页头，common_chrome所有调用 | 实盘/模拟×列表/统计，切换/空/错误/长文 | unassigned / 06；集成/root | 3套同态比较稿、选择记录、原型切换 | NOT VERIFIED |
| C08 指标 | 同图指标卡；BT05口径 | 多/空/持平/无样本/缺失输入/部分平仓 | unassigned / 07；集成/root | 公式、输入契约、独立核算、选定卡片方案 | NOT VERIFIED |
| C09 分布 | distribution-amount@state-demo-5-1及相邻下钻图 | 金额/收益率/零/集中/极值/下钻返回 | unassigned / 08；集成/root | 同尺度横条、分母不变、独立视觉比较 | NOT VERIFIED |
| C10 首页一致性 | handoff@state-demo-7-1、journeys-home-entry、library-return、journeys-library-return；参考V2.5 home-1440.svg | 首页进入/返回；相同日期、筛选、样例 | unassigned / 05重开；集成/root | 唯一首页来源、4帧同态图与独立验收 | FAIL；修复复验NOT VERIFIED |

## Revision 10 implementation ownership — 2026-10-24

| Requirement / element | Exact reference | Owner / journey | Acceptance | Status |
|---|---|---|---|---|
| C07 mode slider/title/tabs/filter hierarchy | comments-revision-10/comments.json comment-bba9761d36c2404895c938e721a55668; source/images/02-simulation-normal.svg; REVIEW-REVISION-10.md layout section | navigation_impl; root integrates; A/B/C × live/sim × list/stats; per-mode range restore | browser 1440/1280, mouse+keyboard, loading/empty/error/long date, before/after geometry; independent comparison | PASS candidate; final selection OPEN |
| C08 risk/directional/fee cards | comment-904e25db335b473e8ebe20c11e015203; same simulation reference | design_impl; root metric contract; all stats/rounds views | hand-calculated multi/short/breakeven/missing inputs; browser labels | PASS direction/fee/missing-data handling; drawdown choice OPEN |
| C09 distribution scale and interval navigation | comment-00e4bfc2361e4a23bce06c2e28ce232d; source/images/distribution-amount.svg | design_impl; amount/rate→interval→round→return | equal scale, true zero, unchanged denominator/selection; independent screenshot | PASS current chart; chosen-layout adoption OPEN |
| C10 home source/return | comment-84e05dc859b04d748c646cf4b0f1ac77; homepage-v2.5/source/images/home-1440.svg | home_impl; root whole-page consistency/data; home→library→home | canonical-source geometry and matched-fixture visual comparison; entry/return focus | PASS after repair; 05 accepted |

Scope: static SVG document + disposable HTML prototype; excludes business application, DB and physical touch (desktop comparison). Existing comments immutable. No user requirements excluded. Independent visual reviewer owns final scope audit, root owns content/data integration.

Current integration: full reader build and 10-comment migration complete; 57 frozen files match d959551e33d9a455775a98bf4fb515b8ea098a9c2a4392d8f6b56be7fbf7da35. Automated source/data gates PASS; independent rendered gate ongoing. Candidate selection and drawdown semantic question remain open. See evidence/revision-10-repair/review-package.json and root-version-prose-check.json.

最终source/content及对应参考截图、状态范围和独立结论见 evidence/revision-10-repair/INDEPENDENT-ACCEPTANCE.md；阅读器集成与评论保真见 ROOT-READER-ACCEPTANCE.md。较早NOT VERIFIED/FAIL均保留其记录版本。

## 已确认决定的最终同步（2026-10-24）

用户直接选择 B 紧凑排列与最差练习回撤，撤销此前两项待决状态；以当前轮验收替代候选阶段结论。

| 需求/元素 | 精确参考 | 所有者 | 旅程/状态 | 验收证据 |
|---|---|---|---|---|
| C07 common_chrome /模式/标题/摘要/页Tab | navigation-options.html scheme-b；evidence/revision-10-repair/root-final-nav-B-1440.png；BT02 | final_design_impl；root全页一致性 | 两模式×列表统计，回合集/复盘及返回，1440/1280 | 先3代表帧视觉门槛再全量受影响图，独立同态对照 |
| C08 risk_band /最差练习回撤 | 本轮用户回答；BT05；02-simulation-normal@state-demo-4-1 | final_design_impl；root数据语义 | 完整/部分缺失/全缺失/无练习/真实零 | 明确公式和练习全集；真实fixture缺失保留—；独立检查文案与数字 |
| C09分布及下钻返回 | 原分布合同与已选B | final_design_impl | 金额/收益率/选中/返回与边界 | 标度不变，与B布局整合视觉 |
| 已选B原型默认/比较入口/风险说明 | 现navigation-options.html | final_prototype_impl | 默认B→模拟统计→切mode/tab→恢复条件 | 实际点击/键盘，1440/1280截图 |
| 10评论及原图/reader | comment-migration/权威rev10 | root | C07–C10定位、B图打开、历史图保留 | 字节保真/链接/真实browser |

本轮证据目录evidence/revision-10-final-decisions；before保存前一完整候选包。首页4图无修改要求，SHA对照；原FAIL历史保留。业务数据库与产品运行N/A，实体触控NOT VERIFIED。本轮无全站/所有历史控件覆盖声明。

## 用户决策最终闭环（2026-10-24）

版本与逐帧元素清单：[冻结包](evidence/revision-10-final-decisions/review-package.json)、[独立37帧表](evidence/revision-10-final-decisions/INDEPENDENT-ACCEPTANCE.md)。本节覆盖此前Tasks5/6映射，历史状态不覆盖最终结果。

| 需求 | Owner | 最终结果与证据 |
|---|---|---|
| C07 所有共享模式/标题/条件/tabs | final_design_impl；root整页一致性 | PASS，37帧真实浏览器截图；1440/1280自然字宽，B紧凑布局 |
| C08 风险标签/定义/覆盖及费用 | final_design_impl、final_prototype_impl | PASS，独立公式核算及两宽完整原型；缺失继续— |
| C09 横条/单位/选中/返回 | final_design_impl | PASS，分布帧与金额切换、返回焦点 |
| 原型默认B及受影响控制 | final_prototype_impl | PASS，prototype-operations、keyboard-page-proof |
| 阅读器及评论 | root | PASS，BT02两表、C07/C08/C09整图定位、历史入口；原评论保真 |
| fixture/4首页/BT01 | root、revision10_acceptance | PASS，version-after与独立字节比较 |

业务持久化N/A；触控NOT VERIFIED。功能与视觉证据分开；root操作，独立reviewer直接看图审查。历史FAIL保留。

## Revision 11：C11复开

C11 → BT02/BT03/BT06，journeys-date、common_chrome、根列表table标题、c07-mode-slider/c07-page-tabs；问题与新方案建议见 [分析报告](REVIEW-REVISION-11.md)。当前owner：未派发，协调者root诊断；原06验收重开。所提布局与跨模式页面策略未批准、未实施；将以四组合稳定位置、准确日期口径、来源恢复及新独立验收为目标。
