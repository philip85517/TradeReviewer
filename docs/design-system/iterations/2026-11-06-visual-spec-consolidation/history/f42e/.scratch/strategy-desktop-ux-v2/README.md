# 策略桌面 UX v2

2026-09-30：**桌面交互原型已完成原范围技术验收，01–08均ACCEPTED。** 多位Luna6/max实施，Astra/low独立审查，root真实浏览器完成整条旅程。后续用户设计反馈见下文，技术验收不等同用户认可。

2026-09-30 第一轮用户反馈已收到：缺少独立策略库，需三类包组装、已有策略选择/就地新建与复制历史策略。已发布[增补规格](../../docs/specs/2026-09-30-strategy-library-and-experiments.md)及 [09 交互模型](../strategy-portfolio-backtesting/issues/09-strategy-library-interaction-model.md) → [10 原型](../strategy-portfolio-backtesting/issues/10-strategy-library-creation-prototype.md)。该新增范围未实现/NOT VERIFIED；本目录旧 01–08 的技术接受按原范围保留，不代表新设计通过。

同轮工作台反馈要求吸收 TradingView 的按钮风格，简化并固定布局。已发布[差异比较与设计方案](../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)及 [11 稳定工作台模型](../strategy-portfolio-backtesting/issues/11-stable-workbench-interaction-model.md)。当前先 09/11 模型对齐，再 10 创建、05 工作台、06 比较和07交接；新布局/控件/位移全部 NOT VERIFIED。本次仅文档，原技术证据和历史 FAIL 保留；后文阶段性状态为历史，不代表新的模型已接受。

[打开运行中的预览](http://127.0.0.1:3047/?prototype=strategy-create&variant=A) · [最终验收与启动方式](FINAL-ACCEPTANCE.md) · [完整旅程](acceptance/08.md) · [独立审查](acceptance/reviewer-08.md) · [需求覆盖](DESIGN-COVERAGE.md)

范围：1440×900/1280×800桌面，合成数据与会话内存，刷新重置；真实数据/回测引擎/API/DB持久化/插件和窄屏尚未实现。类型/构建通过，限定lint0错误2警告；全量单测存在已在未修改HEAD复现的基线失败，详见最终记录。服务3047仍运行；未提交、推送、合并或发布。

## 历史执行记录（原样保留，当前结论见上方）

2026-09-30续行：07代表屏X07-02/P2修后两档已由root与独立Astra直接看图PASS（历史FAIL保留）；完整比较UI与08未接受。中断销毁旧代理，改派comparison_ui_resume（Luna6/max）为comparison-prototype.tsx/css唯一writer；comparison_runtime_resume（Luna6/max）仅running-prototype.tsx/css；acceptance_resume（Astra/low）独立审查。root整页与状态链责任不变。

07实施期缺陷X07-01：旧比较事件返回可能回退M，静态修复成立；共同/非同步/普通返回/列表重开已实测，最终事件反例待完整UI后补。见acceptance/07.md。整体未接受。

状态：实施中，未接受。用户授权多个 Luna6 max 开发、Astra Light 验收。实际模型 `gpt-6-luna/max`、`gpt-6-astra/low`。

范围：桌面交互原型，1440×900、1280×800；合成数据、会话内存。窄屏与真实引擎/持久化排除。

- [执行方案](TICKET-PLAN.md)
- [覆盖及责任矩阵](DESIGN-COVERAGE.md)
- [进度账本](PROGRESS.md)
- 预览：http://127.0.0.1:3047/?prototype=strategy-create&variant=A

当前：01–06已由协调者接受；07实施中；08等待依赖。整体未接受。

## 阶段历史（最新结论见末条）

01/02已接受（真实图表与两档桌面/独立Astra均有证据）；03/04/05正在并行实施，06/07/08等待依赖。整体尚未接受。详见PROGRESS.md。

- X01-03 scoped regression：01初始净值日期在盘中/休市起点误用行情截止日；01局部reopened，历史接受保留，03–05已在实施但最终接受须等此项复验。仅修初始Snapshot为实际T0日期，不扩展已知行情；目标证据为盘中/周末净值与K线分界及结果起始区间。当前 NOT VERIFIED。

- 当前：04/05 root ACCEPTED（acceptance/04/05+reviewer）。03剩X03-02长名称active tab横向可见性P2，owner修复；06待03接受。01 X01-03模型/浏览器已修，最终记录随03收口；整体未完成。

- 最新状态：01–05均由root ACCEPTED（含回归修复，见各acceptance与独立reviewer），06实施中，07/08等待依赖。06使用多个Luna6/max互斥写入；INTEGRATION-06.md为共同契约，Astra/low继续独立验收。整体未完成。

## 06 续行与范围内验收失败（2026-09-29）

01–05接受保持；06当前acceptance-failed、07/08待依赖。X06-01排除Mi=T0组合批量无结果已局部修代码，待首日故障真实路径闭环。新增X06-02：root直接查看execution-failure-1280.png与lagging-1440.png，确认常驻恢复/演示入口加两张重复反馈卡，把主图与日期轴推到首屏之外；属于DD02/DD11/DD13、C22–23/C28范围内视觉FAIL。

续行所有权：/root/recovery_layout_06（gpt-6-luna/max）仅recovery-prototype.tsx/css及implementation/06-layout-repair.md；不写runtime/model/results/creation。修复时保留所有原因、日期、归属、retry/exclude/最后完整日与列表动作，合并相同组合的重复反馈、降低常驻区占高，不缩小关键字或主图。root仍负责整页/完整状态，/root/acceptance_final（gpt-6-astra/low）独立直接对照。准确参考：screenshots/06/{confirm,execution-failure,lagging}-{1440,1280}.png与screenshots/reference/tradereview-{1440,1280}.png；图为修前事实，不能覆盖删除。修后截图使用fixed后缀。验收证据acceptance/06.md、reviewer-06.md。

## 06 X06-03 独立视觉回归

X06-02主图修复两档已由Astra直接看图通过（failure-fixed/lagging-fixed）；新X06-03/P2：failure-fixed-1280右侧“已看后续”覆盖调仓事件标题/导航。06继续acceptance-failed。唯一修复owner /root/recovery_layout_06（Luna6/max）新增授权仅running-prototype.css与implementation/06-layout-repair.md；不改父状态或账本。root整页责任，Astra独立检查fixed2图及事件可达性，原失败图保留。

## 07 派发与责任（06已由root ACCEPTED）

01–06接受，07实施中，08待07依赖；整体未接受。准确批准引用保持C25–27/C28原表及INTEGRATION-07.md。

| 覆盖/元素 | 唯一实现owner/写入 | 旅程与证据 | 状态 |
| --- | --- | --- | --- |
| C25–27，UX01/03/05/09/10 E02/03/07/08/12；DD06 177–200/DD09 220–240/DD12–14 260–281 | /root/comparison_runtime_07，Luna6/max：仅running-prototype.tsx/css、implementation/07-runtime.md | 入口R=min(sourceV/R,共同Mi)→比较→显式更晚单组→准确事件/返回上下文；root实际browser，acceptance/07.md | NOT VERIFIED |
| 相同C25–27的只读呈现，相关C28 | /root/recovery_layout_06新07任务，Luna6/max：仅comparison-prototype.tsx/css、新comparison-model.ts（必要时）、results-prototype.tsx/css比较按钮、implementation/07-ui.md | 同轴归一化净值/回撤/仓位、口径矩阵、最多4线+6组可达；same screenshots/07、reviewer-07.md | NOT VERIFIED |

root为整页视觉及完整会话接线验收owner；/root/acceptance_final Astra/low独立审查。精确图片参考screenshots/reference/tradereview-{1440,1280}.png及05修后结果图，规格不是像素新画板。1440×900/1280×800 DPR1/100%，sidebar/蓝主动作/6–8圆角/12–14关键字体/36控件。无授权新增布局偏差；窄屏/生产DB N/A。先渲染代表性屏经独立审查，再扩展/修复。禁止双方交叉写文件；UI owner不再拥有running CSS，交回runtime07唯一。

## 07 完整UI接线发现（2026-09-30）

X07-03/P1，root与Astra静态独立确认：仓位图使用持久allocationPortfolioId，Single进入EMA较晚区间后可能仍显示quality；dropdown可直接换其它组合而不改运行owner单组身份。要求单组仓位由selectedPortfolioId决定，显式切换由同一runtime action处理。

X07-04/P2：从同步筛选quality后进入EMA Single，事件仍被旧portfolioFilter滤掉，而disabledselector显示EMA。Single忽略旧同步filter，返回同步保留原filter。两项交唯一comparison_ui_resume修，当前FAIL，browser未复现，最终修后实测关闭。root另要求零曲线选择不能伪标T0、未知partialReduction不可填0，现金权重1位小数；均在本07已授权契约内。

07仍open / acceptance-failed；08等待依赖。图表与runtime已冻结，UI正在修复；历史PASS只适用各自范围。

## 2026-09-30 最终交互复验缺陷

X07-03/04：root实际Single EMA7/12仓位归属、事件忽略旧quality筛选通过，最终冻结复验待收口。X07-05/P2：root实际比较→6/21部分成交→交易B，抽屉关闭且来源返回入口消失；Astra静态确认DD09违规，同时局部重开05的交易定位后来源返回。唯一runtime owner comparison_runtime_resume修复running TSX/CSS。X07-06/P2：失败Mi/预设/排除原因10–10.5px，小于DD13关键12px；UI owner修复。X07-07/P2：root实测同entryId2、单组EMA7/12、仓位、partial事件筛选，scroll290→事件→返回来源比较后scroll0；UI owner修复hidden后覆盖scroll记录。

准确引用：DD06 177–200、DD09 220–240、DD13 268–276；C19/C20/C26/C28，E04/E07/E08/E12。前序证据保留，05仅上述source-return局部重开，07仍acceptance-failed，08未放行。root负责实际路径与两档视觉，Astra独立对照。

2026-09-30 root：07 AC01–07 ACCEPTED（acceptance/07.md、reviewer-07第十一阶段）。X07-01–08关闭，05来源返回局部回归重新ACCEPTED。01–07均接受；08开始全新冻结版本集成验收，整体尚未接受。

2026-09-30 X08-01/P2：08新鲜T0-1280时间条回看控件裁切，07仅新增入口布局局部重开；Luna6/max comparison_runtime_resume仅running CSS修复，root实际两档/Astra独立复验。08整体未接受，其余已接受证据保留。

2026-09-30 X08-01修复关闭：root derived-t0-1280实际timebar无横向溢出、date selector全可见；Astra reviewer08第二阶段直接对照两档T0、主图/日期轴PASS。CSS-only无状态变更；07重新ACCEPTED，08继续验收。

## 2026-09-30 远端整合

用户授权推任务分支并合并 master；[PR #35](https://github.com/philip85517/TradeReviewer/pull/35)。整合后生产构建、5 项回归、类型与桌面浏览器/独立视觉检查通过。完整单测仍 NOT PASS：2720 PASS / 1 FAIL / 6 SKIP，唯一失败在未修改最新 master 同样复现。详 [REMOTE-INTEGRATION.md](REMOTE-INTEGRATION.md) 与 [test-verification](acceptance/test-verification.md)；原始验收与失败证据保留。
