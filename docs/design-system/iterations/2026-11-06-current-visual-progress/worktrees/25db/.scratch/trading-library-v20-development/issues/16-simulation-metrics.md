2026-10-29：费用卡[独立数据链审查](../evidence/I16-statistics-snapshot/fees-wiring-20261029/independent/review.md)限定 PASS；[浏览器初查](../evidence/I16-statistics-snapshot/fees-wiring-20261029/independent/browser-review.md)显示混合未知状态文字换行使首行卡片增高。截图为 1280×720、状态不同，无法证明指定视口同态视觉；并行源码热重载后服务返回 404／超时，日期零费用、刷新重读和独立操作均 NOT VERIFIED。保留该观察并待源码稳定后复验。

2026-10-29：当前筛选范围不可计算原因[独立限定审查 PASS](../evidence/I16-statistics-snapshot/unknown-reasons-independent-review-20261029.md)。独立反例 2/2、作者组件 18/18、隔离 route 7/7、route→client 17/17；协调者真实隔离浏览器观察及哈希见[实现记录](../evidence/I16-statistics-snapshot/unknown-reasons-implementation-20261029.md)。独立真实浏览器、同态视觉和完整统计仍 NOT VERIFIED。

# 模拟统计显示练习金额、胜率、收益率与最差回撤

2026-10-29：财务客户端第 1/5 轮[独立复验 FAIL](../evidence/I16-statistics-snapshot/financial-client-independent-fix-round1-20261029.md)，异常和未知原因可引用不相干来源行；此前重复行缺陷已修复。第 2/5 次修复已提交[独立复验](../evidence/I16-statistics-snapshot/financial-client-fix-round2-20261029.md)，整项统计与 UI 尚未验收。

2026-10-29 后续：统计集成测试隔离修复[独立复验 PASS](../evidence/I16-statistics-snapshot/capital-independent-round2-20261029.md)，协调者同进程 41/41；不代表完整财务或页面通过。已平报表来源适配器[独立首轮 FAIL](../evidence/I16-statistics-snapshot/tradingview-financial-independent-round1-20261029.md)：数量不一致、方向不一致、出场日期早于进场的来源仍被判为已知已平；这只是尚未接入生产的纯函数风险。已记录第 1/5 轮，需修复并复验；顶层 available 与金额 unknown 的语义须明确。旧失败保留。

2026-10-29：统计客户端与范围模型历史冻结版本的[独立局部覆盖复验](../evidence/I16-statistics-snapshot/data-slice-coverage-independent-20261029.md)为 149/149 分支、32/32 测试；客户端此后已更改，不能将该数字当作新版本或全项目结果。本金数据链开发后，协调者[同进程回归 FAIL](../evidence/I16-statistics-snapshot/capital-root-combined-fail-20261029.md)：两个数据库集成测试的临时目录要求互斥，计第 1/5 轮，待隔离修复和独立复验。另根据用户已定完整练习范围与 [TradingView 官方说明](../evidence/I16-statistics-snapshot/tradingview-official-source-20261029.md)，正在开发已平交易的来源投影，不再以未经依据的“还需证明文件覆盖练习”为统一拒绝理由；未平仓、异常和权益轨迹仍须按实际数据处理。完整 UI、财务接线与正式迁移仍未验收。

2026-10-29 后续：统计数据切片第 1/5 轮修复经[独立复验](../evidence/I16-statistics-snapshot/data-slice-independent-fix-round1-20261029.md)限定 PASS；协调者核对版本并复跑 69/69，首次因测试限定的临时路径格式不符失败后按规定路径重跑，详见[记录](../evidence/I16-statistics-snapshot/root-fix-round1-20261029.md)。保留原 FAIL；独立审查者更正了客户端仅凭响应识别伪造身份超出接口合同的判断，客户端依赖可信服务端。完整统计页面、账户范围接线、财务及浏览器未通过。


2026-10-29 更新：统计数据切片[第 1/5 轮独立验收](../evidence/I16-statistics-snapshot/data-slice-independent-round1-20261029.md) FAIL：真实响应变异的无效表头及身份未被拒绝；这不是生产库已损坏的证据。真实隔离库保存、等价重导、日期更正及重开通过。修复进行中；页面接线、财务投影、视觉和全项目覆盖率仍 NOT VERIFIED。共享筛选“全部账户”与统计空授权集合语义不同，后续接线须明确转换并验证。


ID: TL20-I16
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: STATS
Priority: P1

## Scope / What to build

**最新用户决定：**初始资金按练习计价币种使用分别配置的全局默认值，初始各为 100,000；也可为每次练习单独设置。港股通按导出数据实际币种计价。结束估值和缺少手续费时的模拟练习处理以[决定](../USER-DECISIONS-2026-10-27.md)为准，覆盖下方冲突的历史描述；权益轨迹不得凭空编造。新增控件、持久化与默认值变更对旧练习的影响尚待设计及验收。

模拟范围选择→统计卡→信息i查看样本/费用/估值说明→按D02确认的生产来源读取或补正→如有更正则真实保存→返回/reload重算。

- 6练习/5可算/1未知、B–F=-104/354/-78/98/118，合计388 CNY、胜率3/5=60%；A余70无结束估值未知，明确给140才4677。
- 毛已实现+毛余仓浮动-费用一次；已含费净额不再扣；持平进胜率分母，未知排除，零可算显示—。练习计数不混配对，不平均内部胜率。
- 按[D04用户确认](../comments/TL20-D04/2026-10-26-resolution.md)，市场/账户筛选依据每练习唯一归属，整份练习至多计一次；不拆样本、不拼同账户权益。单标的不等于单一多空方向；分类/筛选及分母仍待原方向票确认。
- 收益率只用该练习正初始资本；缺失/零/负本金不影响可用金额和胜负，金额/收益率分母分别显示；不借账户本金/当前行情补值。
- 最差练习回撤逐练习完整权益轨迹计算后取最大，含费用/浮动；100→120→90为25%，另一100→110→99为10%，汇总25%；部分1/2显示— · 可计算1/2练习，空—/无练习，完整零0.00%。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/trading-library-design-spec.md](../../../docs/design-system/trading-library-design-spec.md)，L81–109
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L187–208
- [approved-e-sim-stats-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-sim-stats-1440.jpg)
- [02-simulation-normal.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/02-simulation-normal.svg)
- [09-missing-input.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/09-missing-input.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [独立模拟练习逐层进入回放，更正日期后仍属原练习](14-simulation-entry-date.md)
- [练习资金、结束估值与权益轨迹以什么来源为准？](02-valuation-authority.md)
- [一次练习的账户与标的边界是什么？](04-multi-scope.md)

## 实施与验证步骤

下列尚不存在的定向测试文件是本票拟增测试落点，执行前核对现有测试组织；它们不是本轮已运行或已通过的检查。

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `practice-metrics-oracle` 先建立行为反例并确认失败：独立断言6/5/1/388/60%，A无估值未知；含费100不能再减费；20配对盈利+2配对亏损的两练习胜率50%。
- [ ] 为 `amount-rate-separate-eligibility` 先建立行为反例并确认失败：净额60本金1000→6%；本金缺/0/负→金额60及胜负有效、率未知；缺残余估值不许用零/实时价。
- [ ] 为 `worst-practice-drawdown` 先建立行为反例并确认失败：25%/10%→25%；部分路径→—·1/2；全部合法零→0%；缺路径/估值/非正初值/外部现金流不冒算。
- [ ] 在允许范围内实现上列可观察旅程，连接真实提供方/消费者；不扩大任务、不再派代理、不重写全局架构。
- [ ] 执行定向检查：`npm run test:unit -- app/lib/reviews/practice-performance.test.ts app/components/library/library-practice-statistics.test.tsx`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 独立断言6/5/1/388/60%，A无估值未知；含费100不能再减费；20配对盈利+2配对亏损的两练习胜率50%；证据记录在本票独立报告内。
- [ ] 净额60本金1000→6%；本金缺/0/负→金额60及胜负有效、率未知；缺残余估值不许用零/实时价；证据记录在本票独立报告内。
- [ ] 25%/10%→25%；部分路径→—·1/2；全部合法零→0%；缺路径/估值/非正初值/外部现金流不冒算；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：完整模拟统计指标及信息i、经D02批准的来源读取或输入补正、错误/取消/来源查看（不预设一定存在手填入口）；说明不常驻挤占卡片。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 默认实现模型 Luna (`gpt-5.6-luna`)，协调者 root 独立review/接受；本轮没有派发执行。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `app/lib/reviews/practice-performance.ts（拟新增）`
- `app/components/library/library-practice-statistics.tsx（拟新增）`
- `app/components/library/library-statistics.module.css（STATS唯一写者）`
- `app/api/storage/practices/route.ts（仅DATA写来源输入）`
- 输入/输出与接线：DATA按D02输出带来源/时间/费用属性的PracticeValuationInput；STATS输出金额/率各自eligibility和原因、practice级样本、独立MDD覆盖；INTEGRATOR重读后原子替换范围与结果。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

实际功能、真实持久化/返回链、独立视觉均 NOT VERIFIED。 未来报告位置：`../evidence/I16/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。

## 2026-10-28 资金设置局部纵切：派发准备

协调者选择现有数据页“账户与计价”的全局设置和“导入记录→模拟练习→查看完整记录”的单次设置，具体 [执行合同、控件/状态登记、冻结指纹及隔离验收](../evidence/I16-capital-task-preparation-20261028/plan.md#2026-10-28-资金设置局部纵切执行合同)与 [覆盖矩阵](../DESIGN-COVERAGE.md#i16-初始资金设置局部纵切2026-10-28-派发合同)。这是设置及有效值的有界完整旅程，不是现有 V2 画板或完整统计验收。CAPITAL-UI 具体实现者待派发；root 负责集成、视觉一致性和持久化链，非实现者独立视觉审查。桌面真实浏览器、持久化与视觉均 NOT VERIFIED；触屏及窄屏依用户决定本次 EXCLUDED。派发前需核实共享文件所有权，采集实际同状态基线并冻结版本，不改正式库/配置。

本局部设置不以 I14 回放或 D02 估值作为前置；实际收益率重算及 I16 原完整统计旅程仍保留上方 I14 / D02 / D04 依赖，不因本切片实施或通过改变状态。图表首旅程仍未因此验收。

2026-10-28 统计输入快照[独立验收第 1 轮 FAIL](../evidence/I16-statistics-snapshot/independent-review-round1.md)：合成隔离库移除不可变触发器后，篡改来源记录、文件日期或导入历史日期，读取未全部识别；当前输出不直接包含上述被改记录，不能据此断言真实数据损坏。原实现者修复中，待冻结后独立复验；完整统计接线和 V2 页面仍未完成。

2026-10-28 统计快照[第 2 轮独立验收 FAIL](../evidence/I16-statistics-snapshot/independent-review-round2.md)：首轮 7 个反例及合法人工改期已复核；新增合成反例发现文件名来源的当前练习日期被改后可能错误输出，修订导入时间与存储记录不一致也未拒绝。修复及复验待进行；与真实库损坏无关，详见独立审查记录。

2026-10-28 统计快照[第 3 轮独立验收 FAIL](../evidence/I16-statistics-snapshot/independent-review-round3.md)：前两轮 9 个异常及合法人工改期已复核；隔离库解除不可变触发器后，版本 JSON 的练习归属或序号与版本表不一致仍被读取。当前快照不输出这两个字段，不代表真实数据已损坏；第 3/5 轮修复中。完整统计和 V2 产品未接受。

2026-10-28 统计快照[第 4 轮独立复验](../evidence/I16-statistics-snapshot/independent-review-round4.md)在合成库限定范围 PASS，前三轮 FAIL 保留。协调者重跑冻结版本测试 40/40，并核验源码与测试 SHA；仅解除该后端准备切片的已测问题。完整统计 API、财务来源、页面及用户旅程仍未接入/未接受；真实接线缺口见[来源评估](../evidence/I16-statistics-snapshot/production-wiring-assessment.md)。

2026-10-29 协调者以原生 Node 直接重跑纯计算 `practice-metrics.test.ts`：74/74 通过，V8 对 `practice-metrics.ts` 分支覆盖 99.06%（106/107）。这是该模块的定向结果，不是全项目 95% 覆盖，也不证明真实来源、统计 API、页面和用户旅程已接线。真实 CSV 字段[观察](../evidence/I16-statistics-snapshot/real-csv-source-semantics-20261028.md)显示报表进出两行重复净损益和手续费，未经确认的完整性和费用语义仍不可推算。

2026-10-29 [财务投影第 1/5 次修复独立复验](../evidence/I16-statistics-snapshot/tradingview-financial-independent-fix-round1-20261029.md)在真实来源预检合同内限定 PASS；0000 年直接输入仍错误接受（来源预检会拒绝），同日秒级应由生产映射保留及核对。后端真实来源接线进行中；完整统计及 UI 仍未验收。

2026-10-29 I16 财务服务端第 1/5 轮[有界独立验收 PASS](../evidence/I16-statistics-snapshot/financial-server-independent-round1-20261029.md)：六份真实文件在隔离库完成保存、重开和 V2 路由读取；独立 3/3、回归 172/172。映射模块分支 81.25%，未达到 95%；账户、市场、日期范围及授权边界、客户端和 UI 仍待完成。

2026-10-29 I16 客户端[独立验收第 1/5 轮 FAIL](../evidence/I16-statistics-snapshot/financial-client-independent-round1-20261029.md)：重复报表组身份或来源行可通过响应校验，可能重复计算；修复中。客户端分支 200/208（96.15%）不抵消该失败；页面、真实网络及完整统计仍 NOT VERIFIED。

2026-10-29：I16 统计入口[独立首验 FAIL](../evidence/I16-statistics-snapshot/ui-independent-review-20261029.md)：保存中可切换而丢失离开保护；账户筛选后刷新时显示与控件不一致的统计范围。第 1/5 次修复中。协调者隔离运行 4 套 97/97，未覆盖该两项反例；真实完整指标、趋势/分布下钻、同态视觉与完整产品仍未通过。

2026-10-29：I16 统计 UI [第 1/5 轮独立复验](../evidence/I16-statistics-snapshot/ui-independent-fix-round1-20261029.md) **FAIL**：日期保存中切页及筛选刷新错位的首验反例已通过，但 V2 六练习样例胜率显示 60.0%，规范要求 60.00%。进入第 2/5 轮修复；原 FAIL 保留，收益率卡片、趋势分布、真实浏览器与同态视觉仍未验证。

2026-10-29：I16 页面第 2/5 轮独立组件复验限定 PASS，原并发反例、60.00% 样例及零值/失败重试通过；协调者核对五项 SHA 一致并重跑新增独立探针 2/2 PASS。证据 `evidence/I16-statistics-snapshot/ui-independent-fix-round2-20261029.md`。旧一位小数探针断言失败为过时预期，原文件及日志保留；收益率、趋势、分布、真实财务链、浏览器和同态视觉仍未通过，历史 FAIL 保留。

2026-10-29：I16 财务完整练习判断独立验收第 1/5 轮 FAIL：报表中所有可见组闭合不足以证明期末无残余；六份真实 CSV 经隔离保存、重开和真实统计 route/client 均错误提升为完整净额 known。保留已平报表小计，完整净额/费用/收益率须有额外依据；详见 `evidence/I16-statistics-snapshot/financial-full-practice-independent-20261029.md`。已交回修复；完整统计与浏览器均未验收。

2026-10-29：该问题第 1/5 轮修复[独立复验 FAIL](../evidence/I16-statistics-snapshot/financial-full-practice-independent-fix-round1-review-20261029.md)：全部报表组缺费用时小计未知，但原因错误称小计已知。原误提升反例通过；下一次修复为第 2/5 轮。来源 revision 更换隔离、真实网络、浏览器和完整统计仍 NOT VERIFIED。

2026-10-29：I16 指标与信息说明[独立首验 FAIL](../evidence/I16-statistics-snapshot/ui-metrics-info-independent-20261029.md)：胜率分母缺说明，聚焦时鼠标离开错误关闭提示；第 1/5 轮修复中。合成金额输入另有精度和缩写问题，真实路径可达性 NOT VERIFIED；视觉与浏览器未验收。

2026-10-29：[独立视觉初查](../evidence/I16-statistics-snapshot/independent-visual-initial-20261029.md)发现卡片、回撤和趋势/分布布局的可见差异及截图中未见切换入口。当前截图视口和数据状态不同且代码并行变动；应冻结版本、匹配状态与视口后独立复验，视觉 NOT VERIFIED。

2026-10-29：信息提示第 1/5 轮修复[独立复验](../evidence/I16-statistics-snapshot/ui-metrics-info-independent-round2-20261029.md)条件性 FAIL：无焦点点击后鼠标移出仍保持打开，真实浏览器可达性未验证；原首验反例复测通过，进入第 2/5 轮修复。极端合成金额不声称真实财务可达。

2026-10-29：财务完整性第 2/5 轮修复[独立限定复验 PASS](../evidence/I16-statistics-snapshot/financial-full-practice-independent-fix-round2-review-20261029.md)：原反例及正式测试 52/52，新增探针 10/10；六份真实 CSV 只读经隔离库链路，完整练习净额保持未知。保留原 FAIL；部分可算时小计文案的范围不够明确，已安排单独修正。真实网络、浏览器、revision 更换及完整统计仍 NOT VERIFIED。

2026-10-29：信息提示第 2/5 轮修复[独立组件复验 PASS](../evidence/I16-statistics-snapshot/ui-metrics-info-independent-fix-round2-review-20261029.md)，原无焦点点击反例、实际 DOM 焦点及 Esc/外点/切换通过，正式测试 16/16；协调者复跑 16/16。旧 focus 探针不移动真实焦点，失败及纠正保留。超长金额合成反例仍 FAIL、生产可达性未证实；真实浏览器、整体视觉和完整统计仍 NOT VERIFIED。已开始按批准画板修正统计布局，以上证据仅适用于复验时冻结版本。

2026-10-29：财务小计范围说明[独立限定复验 PASS](../evidence/I16-statistics-snapshot/financial-full-practice-independent-fix-round3-reviewer-20261029.md)：0/2、1/2、2/2 可算组经隔离 SQLite、进程内 route 与客户端验证；52/52 正式/原反例及 13/13 新探针通过，协调者复跑 24/24。旧探针的一项旧文案断言失败及更新预期保留；作者 RED 只有摘要。真实网络、浏览器及完整统计仍 NOT VERIFIED。

2026-10-29：当前财务路径[定向 V8 覆盖](../evidence/I16-statistics-snapshot/financial-coverage-independent-20261029.md)：投影 30/36（83.33%），V2 客户端 244/253（96.44%），合计 274/289（94.80%），5 文件 68/68。新增不支持交易类型的预检拒绝及既有练习保护场景未新增命中分支；未命中项主要为正式入口阻断的防御分支，不能将该次定向结果算作整体 95%。新测试待独立复核。

2026-10-29：统计新增定向集成测试覆盖全局本金修改后的刷新失败与重试：旧结果保留，恢复后按新本金重算收益率并更新分布。实现者定向 1/1、ESLint 通过，独立复验进行中；未更改产品代码。该单次执行覆盖率不是全项目 95% 结果；浏览器、视觉及完整统计验收未完成。详见 [测试证据](../evidence/I16-statistics-snapshot/financial-retry-20261029.md)。

2026-10-29 后续：独立定向复验 1/1 限定通过；组件仅验证区间归属变化，精确收益率由单独客户端读取断言；真实网络、浏览器与视觉未验，详见 [独立证据](../evidence/I16-statistics-snapshot/financial-retry-independent-review-20261029.md)。

2026-10-29：本金保存跨入口状态安全第 1、2、3/5 轮独立验收均 FAIL；[第 3 轮](../evidence/I16-statistics-snapshot/capital-pending-independent-round3-20261029.md)反例为单练习网络中断后服务端迟到提交，重开可能误示旧值。第 4/5 轮修复中；统计页、跨刷新和跨标签不确定状态尚未贯通，不可视为完成。

2026-10-29：静态无效全局本金经真实进程内统计 route、V2 client 与隔离数据库的[独立定向复验](../evidence/I16-statistics-snapshot/invalid-capital-v2-20261029/independent-review.md) 1/1，金额、费用保持已知而收益率为未知；不覆盖网络不确定或整页验收。

2026-10-29：第 4/5 轮[实现记录](../evidence/I16-statistics-snapshot/capital-uncertain-fix-round4-20261029.md)定向 26/26，待独立复验；统计页、刷新/跨标签及迟到覆盖仍未解决，整项状态安全 FAIL / NOT VERIFIED。

2026-10-29：第 4/5 轮[独立复验](../evidence/I16-statistics-snapshot/capital-pending-independent-round4-20261029.md)整体 FAIL / NOT VERIFIED：迟到覆盖已复现，刷新、多标签和统计链未解决；双实例反例的生产可达性未证。已进入最后第 5/5 轮。

2026-10-29：第 5/5 轮[诊断](../evidence/I16-statistics-snapshot/capital-uncertain-fix-round5-20261029.md)显示较早请求可在较晚保存成功后覆盖金额，涉及全局和单练习；未改产品代码。按用户五轮限制停止进一步修复，独立复核中；服务端版本和恢复屏障为尚未验证的候选设计。

2026-10-29：第 5 轮[独立复核](../evidence/I16-statistics-snapshot/capital-pending-independent-round5-20261029.md)确认隔离真实路由下两个乱序覆盖反例 FAIL：旧请求 175000 在新 50000 成功之后写入，数据库及 GET 返回 175000。真实浏览器网络和统计页面未测；跨刷新/标签及统计影响是源码推断。停止本问题修复。

2026-10-30：针对 V2 缩写金额需提供完整值，修复键盘无法聚焦的问题；[实现和测试](../evidence/I16-keyboard-full-value-20261029/implementation/report.md)组件 29/29、隔离数据链 1/1，[独立复核](../evidence/I16-keyboard-full-value-20261029/independent-review.md)确认范围及悬停状态 Escape 限制。实际鼠标悬停、完整同态视觉和 I16 整票尚未验收；本金乱序问题保持 STOPPED。

2026-10-30：[独立浏览器复核](../evidence/I16-keyboard-full-value-20261029/independent-browser/independent-review.md)在两个桌面视口证明四项金额键盘焦点及完整金额提示（8/8），并验证所测费用说明操作；鼠标悬停 0/8、未缩写和未知值、完整同态视觉仍 NOT VERIFIED。截图期间源文件哈希前后一致，协调者核对当前核心文件指纹一致。I16 继续开放。
