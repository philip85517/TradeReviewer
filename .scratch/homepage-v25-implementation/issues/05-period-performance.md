# 05 — 切换期间并读取真实每日表现

ID: P2
State: open
Status: in-progress
Assignee: /root/integration_g61
实现模型: gpt-6.1-sol / ultra
数据准备与领域接口候选负责人: /root/financial_g61
整页视觉、完整数据流与独立接受负责人: /root
验收: 0/3；内部数据切片不重置本票轮数。P2-A纯领域切片已于02:29依有限门授权；页面仍blocked。

## Scope / What to build

真实数据下的四张88px KPI、上海业务日快捷期间/自定义草稿、单条每日净盈亏曲线与完整日期读数。前三张卡、范围标签、日曲线及当前期间贡献采用同一原子提交；第四张当前市值与最新持仓不随期间移动。P1首条真实旅程及首张完整页面视觉接受前不得实施本票。

## Refs

- 原规格 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP02:193–252、HP06:436–448、HP08/HP10；公共手册 Metric:611–698、ChartTooltip:872–959及1135–1138边界说明。必须读原文，摘要不替代设计。
- [逐项矩阵](../DESIGN-COVERAGE.md) HV25-14..22及跨任务HV25-15/16/39/44..49/53..55；原稿没有elementID，沿用矩阵manifest文本定位，不能将HV25当原稿ID。
- 准确图稿位于上述baseline的 `source/images/`：`home-1440.svg`、`home-1280.svg`、`period.svg`、`chart-hover.svg`、`chart-hover--keyboard.svg`、`chart-gap.svg`、`chart-scale.svg`、`chart-scale--normal.svg`、`chart-scale--wide.svg`、`chart-scale--extreme.svg`、`extreme.svg`、`cancel.svg`、`cancel--cancelled.svg`。
- [视觉契约](../visual-contract.md)、[96状态原始映射](../evidence/A/CONTROL-STATE-MAP.md)、[数据方案](../evidence/resume-2026-10-23/F-data-prep/P2-P4-DATA-PLAN.md)。准备报告中的“建议”不自动成为批准政策。

## Blocked by

- [04 — 真实持仓最小旅程](04-holdings-journey.md)：真实浏览器与首张完整画面视觉门槛。
- [01 — 财务合同](01-financial.md)：现有单投影已接受；新增批量边界/日序列须在本票内部冻结并由root独立核验后，UI才能消费。不得365次直接调用完整builder，不得新增第二套成本或费用账本。

## 验收标准与反例

- [ ] 本周/月/年起止按上海时区，快捷项和实际日期同显；自定义直接打开，反向日期禁用应用；取消/Esc仅丢弃草稿。失败/超时/乱序保持旧标签与完整旧数据。
- [ ] 成本100、期初mark120、卖130时期间净10/已实现30/浮变−20；当前市值独立。部分平仓、做空、跨年、费用释放和IPO沿唯一canonical/F政策核验。
- [ ] 每个日期使用该日允许的成交、证据、行情与FX；不可用最新值回填。未来灰区、缺口、真零和无持仓分别可解释。原币、覆盖、价格日期与FX来源可查。
- [ ] 2px单线、6px交互点、12px轴且最多7刻度、万/亿两位、双向十字线与轴端标签。264px读数浮层自适应，至少12px内边距，日期及六行金额完整可见，边缘避让不裁切。
- [ ] 鼠标300ms显示/100ms关闭；键盘立即显示、左右/Home/End选点、Enter固定、Esc返回且重入前抑制。所有点/条件状态列入本版本动态登记，不以一个点代表全图。
- [ ] 日期详情与普通库接线按HP06合同，来源日期/账户/市场正确，含未平仓成交，无queue，返回保留范围/滚动/焦点；被移除的“查看该日敞口”不得恢复。
- [ ] 两桌面视口和必要窄屏可达性：截图、空间测量和对照图独立接受。新增控制、弹层、图点及上下游触发frontend-control-audit，记录执行与通过分母；鼠标/键盘/模拟触控/物理触控证据分列。

## 派发说明（root解除依赖并明确派发后生效）

页面唯一owner沿P1文件范围，仅 `app/components/homepage-v25/**` 与必要workspace接线。财务owner拟负责 `app/lib/reviews/homepage-v25-performance.ts`及测试、新 `homepage-v25-series.ts`及测试；精确边界须在派发时再次冻结，`position-ledger.ts`仍只读，除非root基于测量明确授权有限提取。S源码、全局CSS、依赖、配置、数据库不在范围。页面与领域文件不交叉写入；不得再派代理。

输入为原始entries、明确revision、实际raw candles、真实可知FX与scope；输出为一个带sourceRevision/边界/coverage/原币的完整bundle。准备期不修改产品。领域合同兼容性回归仍受F已接受合同约束，不能重命名掩盖回归。

## 验收证据

证据计划 `evidence/P2/{data,functional,state-persistence,visual,controls}/`；dirty哈希、固定Node26/SQLite3.53、真实服务与隔离DB、日期/范围、viewport/缩放/DPR、输入方式、原业务逻辑hash。root亲自操作并直接对照原稿。当前功能/状态链/视觉全部NOT VERIFIED；无接受签署。

## 历史

2026-10-23 05:30 CST：当前 A source `094b2416…` 原完整三市场首冷 **2617.548995ms，FAIL**，重复投影/完整字段等价/64MiB 入缓存有限通过；第一冷失败后后两冷 NOT VERIFIED，未补跑冒充通过。唯一 CPU 采样已完成并归档，`indexedQuote` 日历/时区调用路径占投影 inclusive 64.69%；批内 market + full cursor + effective now + policy 共享仅为待用户选择架构，回答前不追加性能候选。详见 `evidence/P2/data/immutable-sharing/REPORT.md` 与 root benchmark 工件。B 新纯序列已冻结，root 独立 18/18 PASS，允许后续接口审查，不放行页面/P4；B 自身完整源开销尚未测。P2 正式仍0/3，全部原门槛和历史失败保留。

- 2026-10-23：root补齐后续票；保持blocked与0/3，P1仍未冻结，无新增实施授权。


2026-10-23 02:36 CST：P1第二候选仍在root独立验收。02:29签署有限依赖门（evidence/P1/acceptance-2/DEPENDENCY-GATE.md）：首条真实持仓→详情→普通库→重读返回及1440/1280首张布局通过，非P1整票通过。已明确派发P2-A纯批量投影（financial_g61，合同SHA a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a）与S同票恢复第2轮v3/日期/请求purpose；P2页面/P3/P4产品仍未派发。root完整Workspace回归95项为50 PASS/45 FAIL，日志evidence/P1/acceptance-2/verification/workspace-all.log，已交原owner先只读分类根因；不声称全量通过。02:31后F、02:32后S正获授权开发，后续浏览器HMR状态不得冒充freeze2证据；先前截图与有限门保留原版本效力，剩余UI验收等待消费合同重新冻结。真实保存/reload/guard、96状态及窄屏仍NOT VERIFIED。P4来源政策另见evidence/P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md：无可信处置链接不默认pro-rata，未知保持未知。


2026-10-23 03:19 CST：P2-A性能诊断已达到批准的有限修复尝试上限，4产品文件冻结，状态 performance-discussion-required，非 implementation-ready。单证券1866×365三次冷1232.22/1204.75/1232.80ms、重复1.89/2.24/1.29ms及365字面数值PASS；但同规模3账户/3市场场景冷2972.63ms、重复2951.56/3016.77/3024.79ms FAIL，完整结果超过64MiB无法入缓存。不能用单证券成绩覆盖该失败；保持64MiB/完整公开字段合同，先只读审查结构共享/内部紧凑缓存架构，未经讨论不继续补丁、不接入P2页面。P2正式0/3，P1仍2/3 FAIL，P3首条搜索切片进行中。root独立12财务字面反例与3现金回归PASS；workspace lint exit0（0 errors/10既有warnings），仅局部证据。P2-B仅一页准备稿（evidence/P2/data/p2-b/PREPARATION.md），无产品授权。

间歇请求体overlay诊断保持OPEN：evidence/P1/round3/ROOT-REQUEST-BODY-DIAGNOSIS.md。确定性适配器探针证明已消费/锁定的非GET Request可触发同栈，但实际上游消费者尚未定位；实际重载/重开局部成功不能证明全程无故障，loading截图也不是overlay截图。原始失败与工件局限明确保留，不实施猜测性框架修复。


2026-10-23 07:09 CST：A/B独立审查确认Important I-01（future-only HKD使合法USD端点/当前FX被丢弃）。真实summaries→entries→A→B单独新反例1/1 FAIL；[报告](../evidence/P2/data/p2-b/independent-review/REVIEW.md)。Root另执行同一冻结最小反例，结果单独保留于ROOT-independent-future-currency.log；不修改产品。此为A资格/FX链缺陷，F metric在eligible过滤后正确反映输入缺失，不能将F既有纯函数接受扩成A整体验收。P2/P4财务接入BLOCKED，A原三候选上限冻结，性能架构问题仍待用户答复；仅读受控leaf准备不绕过门槛。正式轮数0/3不变。
