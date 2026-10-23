# 期间／历史／贡献：只读接线缺口与后续顺序

日期：2026-10-23。执行者：`/root/attachment_review`，实际 `gpt-6.1-sol / ultra`。协调者 `/root` 继续独占整页视觉、完整数据／持久化链及独立最终接受。

## 结论与效力

当前首页的期间、历史和贡献仍未接入真实 host 数据链。已有五个受控 leaf、S v3 状态与 A/B 候选，不能合称完成这三个产品区域。`home-surface.tsx:290–293,323` 仍明确渲染未接入占位；Workspace 只建立 `homepageHoldings`，实际 Surface props 未携带 series、history 或 contribution bundle（`trade-review-workspace.tsx:2255,6025–6036`）。

这是**准备报告，不是产品通过、实施派发或接受轮次**。本次只读源码／规格／既有证据，并查看既有原稿 raster；未运行测试、浏览器、服务、数据库、网络或性能命令，未修改产品、测试、旧证据、共享文档或 tracker，未派代理。只写本目录。

保持当前状态：P1 正式 **2/3 FAIL**；P2/P3/P4 正式 **0/3**；P5 **NOT VERIFIED**。指标卡和 Bars 各自 leaf **2/3 FAIL**，第三候选是原同任务最后一次机会：旧数据更新提示仍灰蓝，违反更新蓝规范；新卡／图／panel 不能覆盖该失败或重置原 leaf 轮数。保留原 Workspace 全量 **101 项：99 PASS / 2 FAIL** 的原始日志；root 最新独立 ETF 精确两项 **2/2 PASS** 只更新该有限切片，不改称迁移后102项全量通过，旧返回用例的 FAIL／期间、历史、贡献未实现义务保留。本报告没有新执行覆盖，也不消除原 FAIL。

财务 **A 三候选暂停门**仍有效：三市场 cold `2617.548995ms > 2000ms`，以及已验证的未来-only HKD 污染有效 USD 历史／当前 FX 资格。用户未明确恢复同一任务前，不能增加第四修复候选，不能以 UI adapter、预过滤、另一账本或新票名绕过。以下所有后续产品步骤都是**待派发方案**；本次授权仅到报告。

## 读时版本与原始依据

Git HEAD（报告写入前）：`5a94ee3ff76e32993fe2c4791a83b40e877a7344`。该 SHA 不能代表 dirty/untracked 产品内容；关键文件的 SHA256 另列本目录 manifest，并在写后复核。版本检查点是“报告写入前／冻结时”，不宣称本会话开始即冻结全 worktree。

已直接读最新 `README.md`、`FINAL-ACCEPTANCE.md`、`PLAN.md`、`DESIGN-COVERAGE.md`。报告准备期间 root 更新了前三份中的 README/FINAL 与 DESIGN-COVERAGE，已重读其最新内容；README/FINAL 顶部 **07:49** 检查点与 root 本次明确补充共同作为当前状态。新增失配截图保留但不计视觉PASS，未来必须同时绑定 DOM实际视口和截图像素；下方保留的早期“等待／尚未授权”时间线不覆盖最新有限授权，也不放行 A/P2/P4。

规格基准为 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`（下称 **HP 原文**）；下表行号指该文件。HV25 是追踪号，`HOME-HP…` 为文本块定位，并非伪造原图 element ID。逐项合同取原文，摘要和 leaf 自测不替代原稿。

直接查看的既有原稿读回：`evidence/environment/reference-home-1440.png`、`evidence/P2/data/p2-b/implementation/references/period.png`、`evidence/P4/controls/reference-controls-six.png`、`evidence/P4/bars/reference-contribution-current-a-share.png`。它们用于读设计，不是本次产品截图或视觉接受。对应精确 SVG 在原稿 `source/images/`，见逐项表。比较要求仍为 1440×1000、1280×800、100%，以及 390 与相关响应式边界；未在本次执行比较。

裁定顺序：

1. `evidence/P4/ROOT-FINANCIAL-DECISIONS.md:5–13` 已关闭历史回合、费用、FX、胜率和普通库范围的口径问题；早期 PRE-DISPATCH 中 D1/D2/D3 的“待定”不可继续当作未裁定。
2. `evidence/P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md:5–18` 禁止无可信 disposal link 时默认 FIFO/pro-rata 或整证券 IPO；原模型没有真实处置链接，不能为 oracle 补造来源。
3. `evidence/P4/CANONICAL-READ-FACT-SEAM-PROPOSAL.md:104–139,217–229` 是候选只读 seam 提案，**不是现有 API，也不是 ledger/F 写入授权**。
4. `evidence/P2/data/immutable-sharing/ROOT-CHECKPOINT.md` 与 `evidence/P2/data/p2-b/independent-review/REVIEW.md` 保留 A 性能／FX 两个阻断；本次不重跑其反例。

## 当前真实调用链与所有权

```text
Workspace readHomepageBundle（一次请求自己的 bootstrap / raw daily / latest FX / 必需 Recall summary）
  → useHomepageHost（global token，fresh catalog 校验，matching owned read）
    → session-model.finishHomepageRead（S accepted 后替换一份 data）
      → buildHomepageHoldings（F 当前投影 + exact attachment qualification）
        → HomeSurface（持仓、搜索、详情、附件；期间／历史／贡献占位）

尚无实际调用：prepareHomepageV25Source → buildHomepageV25Series → 五个 leaf
尚无产品数据输出：闭合回合 history bundle / category attribution / contribution bundle
```

非测试源码检索只找到 A/B 和五个 leaf 的定义，没有首页消费调用；这与上面实际 Workspace props 和占位互相印证。不是仅凭 `git diff` 下结论。

|层／真实 owner|已存在的事实与位置|具体缺口与边界|
|---|---|---|
|S：UI 契约 owner|`homepage-v25-state.ts:1,25–60` 存 UI-only snapshot、period/history draft、三域 requests/errors/timeouts；`320–349` 双匹配且 `accepted` 控制提交|S 不存业务金额、图点、回合或费用事实。数据 bundle 原子提交必须由 consumer 实现，不能因为 reducer 已通过便假设 host 已消费三域。S 当前冻结。|
|Workspace：真实来源读取、现有保存 owner|`trade-review-workspace.tsx:2182–2212` 每次 fresh bootstrap、完整 raw daily、latest FX、按需求 fresh Recall；`2217–2249` 仅接受 owned bootstrap，保留更新后的 review/drawing draft、sequence 与 intraday owner|返回 bundle 没有 A 所需 historical FX journal／pair knowledge、lifetime coverage、四组 revisions、prepared source，也没有历史回合／贡献模型。当前 latest FX 对象不是历史 journal。先核实可用证据／缺失表达，再另行派发最小数据适配，不能伪造覆盖。|
|host/session：单一页面／集成 owner|`use-homepage-host.ts:15,22,26,48` reload context 和 pending 仅为默认 global `HomepageRequest`；`session-model.ts:9–17` 也只 start/finish global；`use-homepage-host.ts:208,351–352` 只观察 global deadline，公开附件／全局读接口|没有 period/history begin/complete/retry/cancel 或分域 data commit。`T` 可以承载未来模型，但目前“一个 T”本身不定义何时允许局部替换。需要三域结果分区、依赖键和完整 bundle 原子提交合同，保持源恢复／collection 所有权。|
|A：financial owner，暂停中|`homepage-v25-performance.ts:449–480,631,906` 具有 source revisions、严格历史／当前 FX 证据、lifetime coverage、incurred FeeFacts、immutable prepared source 与 batch/current|接口已有但该 host 未准备输入／调用。A 仍有两个已验证阻断；不能在消费端修空值或替换金额。A 接受不自动补齐 P4 round/attribution API。|
|B：日历组合 owner|`homepage-v25-series.ts:15–34,43–65` 一次 A batch，逐日端点，periodSummary 及独立 current，传播 policy/revision/sourceId/requestGeneration|只组合日历，不负责来源、范围快捷、历史闭合回合或费用归因；S generation 为 number、B 字段为 string，未来 adapter 要显式一一映射，同时保留 scopeKey，不能只靠字符串 generation 接受。B 自身完整规模开销仍待测。|
|P4 财务模型：尚待明确派发的 financial owner|已有财务裁定与只读 seam 提案|没有已实现／接受的 full-precision movement、round allocated-fee、closed-round summary/month-year buckets、互斥来源归因输出。UI 不应调用 canonical 私有 evaluator 或自己维护费用池。|
|五个 leaf：受控显示 owner|见下表各接口|它们不是数据读取、资格、数据持久化或详情返回 owner。leaf 有限 PASS/候选不推出 host 或页面 PASS。|
|root|整页视觉／完整数据持久化／独立接受|需在最终同版本真实服务和隔离库验证，不能由本报告替代。|

特别保留现有 owned read 规则：`use-homepage-host.ts:195–197` 明确 ambient `options.data` 只 seed 初始化；不得在以后用“外部最新值”绕过本请求接受。`trade-review-workspace.tsx:2224–2247` 的 review/drawing CAS 和 daily-only merge 要原样延续到新增请求域，不能因补 finance bundle 覆盖本地未保存内容。

## 原设计 → leaf／S → host gap

以下产品要求均尚未因本报告获得接受。负责分工为：唯一页面 owner 负责 controls/host/Surface/导航；financial owner 负责数字／覆盖／回合／归因；root 独立接受。需要新文件时先按当前 task decomposition 登记，不能本报告隐式扩大写权限。

|原设计／追踪定位与精确原图|现有 leaf 与 S 字段|尚缺的真实接线及验收事实|
|---|---|---|
|HV25-02，HOME-HP01-B026，HP 31–38；`home-history-1440.svg`：全局 market/accounts 整页，period/history/holdings search/local drill 彼此隔离|S `snapshot.scope/attachments/period/history/contribution`，三域请求键 `274–280`|新区域必须同一 accepted 全局资格和报表币种；局部 drill 不能改 top market。当前 holdings 已消费资格，不等于三块区域消费完成。|
|HV25-14/15/16，HOME-HP02-B001，HP 193–209；`home-1440.svg`,`home-1280.svg`,`atom-metric.svg`,`account.svg`,`chart-gap.svg`：前三期间卡＋独立当前市值、费用一次、原币／FX／覆盖|`metric-cards.tsx:10–22,29–35,81–82` 接收完整 readonly B series、reportCurrency、status；S `snapshot.period`|缺 A prepared inputs→B→committed host payload→Surface props。net=R+endUF−startUF；第四卡／当前持仓不能随期间变成历史估值。currency、标签、详情来源必须绑定同一 accepted source/generation，未知不补0。四卡88高与390详情旧 FAIL 的复验另归 root。|
|HV25-17/18，HOME-HP02-B020，HP 210–221；`period.svg`：上海快捷／自定义草稿／应用／取消，旧 label+data 保留|`period-selector.tsx:9–22` 要 `applied,draft,open,pending,error,today,allRange` 与 callbacks；S `periodDraft`、`beginHomepagePeriodApply`、`snapshot.period`、`requests.period`|host 没有 onPeriodApply/分域完成。caller 负责上海 today 与全部实际起止；`all` 的 null bounds 不能直接交给要求 start/end 的 B。Popover 的未应用输入／open 可由单一 control host 管理，不伪造为已应用 snapshot。失败／Esc／关闭保持旧 committed values。|
|HV25-19..22，HOME-HP02-B024（曲线局部派发另定位 B030），HP 222–252；`chart-scale.svg`,`chart-scale--normal.svg`,`chart-scale--wide.svg`,`chart-scale--extreme.svg`,`chart-gap.svg`：日线、六字段、缺口、鼠标／键盘|`performance-chart.tsx:10–26` 接收 B series/currency/pointStatus；六字段固定 MV、UF、lifetime R、lifetime net、period net、incurred period fee|host 未提供 series；point status 需对应 accepted source 的点，不能用 ambient 请求拼接。保留 future、source-missing、真实0；末有效日缺失不能拿更早可绘点顶替 summary（B:56–65）。300/100ms、键盘即显、Enter固定/Esc 与原264px详情几何及已批准窄屏 flow 策略需真实 leaf+整页复验，不能仅判 DOM 有图。|
|HV25-32，HOME-HP05-B001，HP 349–355；`history.svg`,`history-stats-empty.svg`：历史四卡依序净额／回合／胜率／已扣费|S `history.range`；**没有符合这四种统计的历史卡 leaf**。当前 MetricCards 固定三期间＋当前MV，不能直接充当历史卡|缺 full-precision canonical closed rounds、allocated round fees、胜率独立覆盖及 historical FX。无闭合回合 count0、rate—；持平算分母，未知净额不当亏损或删分母。episode.status 不能取代归零事实；不能重用期间 incurred fee 当历史已扣费。|
|HV25-33，HOME-HP05-B001，HP 357–370；`journeys-year.svg`,`history-stats-error.svg`：单年月桶／多年年桶，历史三部分原子变更|`history-controls.tsx:7–15,57–59,98–108` 只消费 caller rangeOptions、appliedRange/chartMode，发 intent；S `historyDraft`、`beginHomepageHistoryApply`、`requests.history`|host 无历史域读与 commit；需用真正的关闭业务日生成范围选项／桶，不按 updatedAt 或 current period 截断。历史四卡、对应曲线、历史贡献一组接受；不强制切 contribution mode，不动当前区。选项不是全部任意年份编辑 UX 的实现证明，需按原 `journeys-year` 逐状态核对 caller 可达范围。|
|HV25-34/35，HOME-HP05-B001，HP 357–394；`history-stats-cumulative.svg`,`history-stats-win.svg`,`history-stats-rounds.svg`,`history-stats-source-missing.svg`,`history-stats-extreme.svg`|S `history.chartMode`，onUi 支持 `historyChartMode`；HistoryControls 是菜单，不含 plot|缺历史四模式 plot 与有覆盖的 buckets。现有 PerformanceChart 固定日度六项金额，不是胜率0–100/整数回合图。累计从选中范围起算、胜率逐桶计算且全范围率用总分母；不能平均月率／日率。无回合、真0、缺输入、future、读取失败分别建模，保持同绘图区尺寸。|
|HV25-36，HOME-HP05-B027，HP 395–399；`contribution-states.svg`,`contribution-historical-a-share.svg`：底部唯一贡献，两模式复用已有日期|S `contribution.mode`、`current/history` 两份 view；`contribution-bars.tsx:24–28` 区分 current/history prepared rows|Surface 无贡献容器、模式切换／日期说明和 data props。不能在持仓前后加两个贡献区；不能添加第三套日期控件或把全局范围写成 local mode。|
|HV25-37/42，HOME-HP05-B027，HP 399,407,428–431；`contribution-states.svg`,`contribution-current-a-share.svg`：市场→证券→真实详情→面包屑／返回|S 每模式 `market/symbol/drilldown` 及 `returnState{container:"contribution",detailId,triggerFocusId,missingContainerTitle}`；Bars `onActivate` 传完整 market/instrument identity|缺局部 drill controller 与真实证券 detail resolver。当前 Surface `detailOrigin` 仅 holdings/search（88–89），open/forward 路径 `216–240` 与消失回退 `204–209` 也只有这两类；不能用当前持仓查不到就跳首行／search假来源。需覆盖已平仓、多个账户同证券、完整交易所身份，保留当前全局 accounts/date，不把类别归因键误当导航证券身份。|
|HV25-38，HOME-HP05-B027，HP 401；`contribution-current-a-share.svg`,`contribution-historical-a-share.svg`：long/short/IPO 互斥，排序／仅未平仓独立|S 每模式 category/sort，只有 current 存 openOnly；Bars **不含工具条／归因**|缺分类／排序／openOnly controller 以及可证明的 category facts。历史 openOnly 禁用，但不能清空 current.openOnly。上市后自买做多；mixed 缺 disposal link 分类 unknown，不能拿证券名称／IPO cost evidence／sourceTradeId 推断。此处 long/short/IPO 也不能和全局 stock/ETF 资产附件混为一个筛选维度。|
|HV25-39，HOME-HP05-B027，HP 397,403；`contribution.svg`：当前完整贡献=期间净，100/150/0→50；历史仅闭合|Bars current row 必须已经有 periodRealized/unrealizedChange/net，history row 已有 closedResult；`fullTotal` 明确 caller 提供（9–28,38,83–98）|缺 A 端点到全量 exact-group／分类贡献的 financial projection；不能只取当前仍持仓证券，不能按页面8行或已知子集求 fullTotal。期间含关闭部分的 opening UF；历史用已闭合 round。当前与历史不能加总；历史缺链接可保 canonical 总额并明确不可归因，不能伪称类别合计已守恒。|
|HV25-40，HOME-HP05-B027，HP 403；`contribution-mixed-sign-demo.svg`,`contribution-extreme.svg`：实心R／中空UFdelta、同14px、同向同色／异号跨零、分归0不画假柱|Bars 已受控绘制 supplied signed metrics，并保持 source invalidation guards（91–98）|待 accepted 数据进入及整页实际计算色／共同零线／390 flow detail。第二候选和 root22/22局部测试不能自行取消原视觉／详情复活 FAIL；外部行集合、币种、模式往返需验证详情不会复活。|
|HV25-41，HOME-HP05-B027，HP 405；`contribution-current-a-share.svg`：证券8/页、50→7末2；市场3行无证券分页，全量合计|S 每模式 page；Bars 无分页、fullTotal 单独输入|缺 full set→稳定排序→分页 display projection、页夹取与焦点迁移。合计必须在分页前；不能重新用 page rows 构造 prepared source。市场钻取后按当模式独立页数，翻页 focus 新页首行。|
|HV25-43，HOME-HP05-B034，HP 416–431；`contribution-loading.svg`,`contribution-empty.svg`,`contribution-error.svg`|Bars readState ready/pending/error/empty；S 三域 errors/timeouts|缺 owner 将当前模式关联至 period/history/global 的真正读取状态、同时保旧 committed rows+range，工具条几何不跳。empty reason 不是 unknown money；缺输入要原原因。只使用原定恢复动作，不能加第二个行情/FX修复链。|
|HV25-44..49/53/55，HOME-HP06-B018/B016、HP09-B001/B028、HP10-B101，HP 434–502,646–668；`journeys-library-entry.svg`,`hcr06-final-return.svg`,`library-return.svg`,`loading--stale-data.svg`,`error--update-failure.svg`|S 已保存 period/history、贡献两模式、scroll/focus；host 有 guard、versioned source、global read，普通库 translation 不带 queue/首选episode（session-model:34–49）|新区域须接到同 source/persistence/URL 合同：数据重新读，UI恢复；来源失效只回贡献标题。历史详情进普通库沿**当前全局已应用日期**（P4裁定），不是 history range。不得使普通全局 `/trades` 继承首页附件或等待首页 finance。原返回测试义务继续存在，不以 leaf 复现替代。|

## 数据适配不可省略的两道检查

### 1. 同一份全量资格，保持 composite source

已有 `attachment-groups.ts:48–68,112–123,163–220` 按 account/instrument/nature/run 精确成组，先选完整来源，再由 canonical summary builder 合并同证券 raw fills，并按 fill ID 去重。下游不能把选中组拆成“账户集合 × 证券集合”而重建 Cartesian 组合，也不能按期间／历史日／当前页先切 fills、期前费用和 IPO cash。这份实际接口可作为未来 finance boundary 的输入 seam，但其存在不表示三个新区域已消费。

`buildHomepageHoldings` 已将同 asOf 的 current quantity evidence、完整 episode lineage 与 summary-complete 标记交给资格判断。未来 A/B 需要自己的原始完整载体和严格 endpoint eligibility；**不能把当前持仓重建后的 entries 当历史 prepared source，或预删 future-only carriers 来修 A FX**。未来载体上可能带端点前已知证据，资格修复必须在财务 owner 的同一时间／证据规则内完成。

pendingReview 必须保持严格差别：Workspace `2190–2194` 仅 single boolean 时读取本请求自己的 Recall summary；空数组与两值都不施加该谓词（qualifier `201–214`），不能用旧 ambient summary 或把 unknown 当 false。已披露 caveat 继续可见：`pendingFact:148–160` 看到适用 pending 可先返回 true，只有发布 false 才要求完整 lineage；它**没有独立证明 Recall 已 fresh**。当前 single-bool consumer 的 owned summary fetch 是其安全前提，未来新域不得只拿默认 pending episode fixture 绕过此前提。该已知限制在本次未另跑反例，不新声称缺陷被验证或修复。

全局 openOnly 资格依赖最新同 asOf 数量，不是历史 range 末是否开仓；局部贡献 current.openOnly 是另外一份 UI 条件。真实 metadata 用于 stock/ETF 分类，名称推断负例继续保留。

### 2. source 合同与 P4 事实不是同一种输出

`HomepageV25PrepareInput` 所需的 `fxObservations/currentFxSnapshot/lifetimeSourceCoverage/revisions`（A:474–479）在当前 Workspace read bundle 中尚未提供。现有 `fx-adapter.ts:4–12` 将响应压成 latest `RoomFxSnapshot`，不能由此产生每 pair 的 historical known/published/fetched 证据。下一次派发需先建立真实来源可用性表；缺 historical journal 或完整 lineage 时如实 unknown，不将读取时间、最新 FX、空列表或 `complete:true` 当证据。

P4 的历史净额/费用/回合另需：同一 canonical context 的全精度数量 transition、归零日、反转 close/open、F `realizedFeeDelta` 与 allocation lineage。现有 incurred `HomepageV25FeeFact` 按实际发生日，不可改写为关闭日或直接累计当 round allocated fee。seam 提案 `104–139` 描述的是未来 additive readout；需要独立明确文件授权后由 financial owner 实施与接受，UI 只消费最终 bundle。

不能拿旧模块代替：`trading-room-contribution.ts:21–33,56–59` 基于 `episode.status === "closed"`、丢除 unknown/trustedPnl-null 并用一份 Room FX 汇总；不满足 canonical 回合、独立覆盖和严格逐关闭日 FX。`trading-room-history.ts:17–54` 是 holdings daily history 数据（含市值／浮盈／日盈亏），不是这次四个闭合统计与月/年桶。复用必须在财务语义证明后由原 owner 明确限定，不能只改标题接上。

## 分域原子提交合同（后续实现需先固定）

|动作／token 域|成功应原子替换的数据与标签|须保留的其他状态|
|---|---|---|
|global：市场／账户／全局附件、返回重读、统一刷新|同一 qualified source/currency 下的期间三卡+日线+当前贡献、独立 current MV/持仓、历史四卡+history buckets+历史贡献；source/revisions/policies 绑定 accepted generation|期间与历史实际已应用范围分别保持；保留仍有效局部状态，必要重夹 page 并解释消失对象；不能混新市场标签和旧金额。普通 collection 独立路由继续无需等待首页财务。|
|period|仅前三期间卡、日线、**current contribution 数据（即使当前正显示 history mode）**及实际 period label/URL范围|current MV、最新持仓、history cards/curve/history contribution、contribution mode 与其另一模式 view 保持。|
|history|历史四卡、对应 buckets/curve、**history contribution 数据（即使当前正显示 current mode）**与 range label|当前期间、最新持仓/current MV/current contribution、contribution mode 保持。|
|UI-only chart mode／贡献分类排序钻取分页／详情|基于已 accepted facts 投影对应显示；`updateHomepageUi` 保存允许字段|不把 applied period/history range 经 onUi 提前提交，不做 financial 计算／IO 的隐式全局切换。|

S `320–349` 已负责 generation+scopeKey+当前依赖键与 exact target；consumer 必须在 `accepted === true` **同一次 state commit** 中替换该域完整 payload，不能先 setData 再完成 reducer。S 不需要因消费缺失改成金融缓存。period/history 新域需各自 pending/error/timer/cancel/retry，重试新 generation；UI cloning 不延长 startedAt 的15秒 deadline。全局依赖变化后旧域结果不得写入；独立 period/history 可按 S 已定义键并行提交，不为方便将历史依赖绑到 period date。

需要明确的 host 合同（还未实施）：typed read context 包含域、原 token、source/read target；结果带域与 source/revisions/policies/asOf；已取消／晚到结果不得调用 accepted-bootstrap callback，collection 也不能成为 homepage 的部分金融 bundle；source restore 只能恢复 UI，不能恢复旧金融值。新 model 应显式分出 global/current/period/history 部分或等价的 accepted bundle slots，避免“一份任意 T”导致局部 read 擦掉另一区数据。

## 可独立推进与等待门

|项目|是否依赖 A 恢复／接受|当前授权与下一步边界|
|---|---|---|
|本报告、原规格与接口覆盖表、缺字段清单、字面 oracle／请求时序的书面设计|不依赖|**本次已授权的只有报告**，到冻结即停止；不能记为产品通过。|
|既有受控 leaf 的原失败修正与独立有限视觉／控件复验，纯 UI shell／工具条／hist plot 的受控 literal-fixture 设计|可不消费 A，技术上可分开|只能在各自已有有效派发或 root 新的有界派发内推进；由 root 管理原票轮数和 owner。不授权借此读真实财务或写共享 host。UI fixture 不能被称为数据接线完成。|
|非金融 host 三域接口、source/CAS/late-result 方案与隔离 literal-fixture 测试设计|技术上可在 A 前准备|仅可准备；实际 host/session/Workspace 是共享单一 owner 写域，须 root 另发明确范围。即便这些纯协议测试通过，**不得接 A 候选进 live 页面**。S 当前冻结，不需为 consumer 缺失扩写 S。|
|现有 P1/P3 已授权的非财务问题／真实持仓、附件、Recall 保存返回有限复验|不因本报告新增 A 依赖|root 可在原授权内继续；不将 P3 有限 PASS 扩张为 P2/P4 或完整返回 PASS。原 ETF/返回日志均保留。|
|A 的性能/FX 修正、任何 live A/B 页面消费、通过 UI 过滤修正金额、额外性能候选|**必须先等用户明确恢复同一 A 任务**；后者绕过方式不允许|当前停止。恢复时保持2秒/64MiB/完整公开字段/金额合同，root 独立重新接受；报告不能替代用户回答或重置三候选门。|
|canonical/F fact readout、闭合回合/history/attribution financial modules|依赖 A/P2 明确重开与一致财务基线，且另需明确文件授权|P4 裁定已定口径，不能以“业务问题已答复”当 ledger/F 实施授权。新 seam 独立接受后再派 P4 model。若需真实 schema/import/provider/disposal link，必须单独说明新范围，不在本方案自动获批。|
|整页 P2/P4 live 集成及最终接受|依赖 accepted A/B、相应 P4 financial model、host 接线与原 UI 门|不得预先替换占位为似真的部分数据来放行；root 分别验功能、真实持久化/返回/reload、与原图视觉，再执行全页接受。|

## 有序集成方案（未实施）

### 阶段 0：保持当前冻结

- [ ] root 保留 A 三候选与两个原 FAIL、各 formal 轮数及完整 Workspace 原始输出；记录本报告仅为准备。
- [ ] 不并发写 host/session/Workspace、canonical/F 的共享文件；各受控 leaf 原失败的有限复验沿原 owner/票继续，不替代整页接受。

### 可与 A 等待同时派发的实际代码（不只是继续写报告）

root 仍可继续实际开发。下列 A/B 无依赖的产品模块均可在暂停期间独立实现；这里给出建议独占 owner，**不创建代理、不赋予本报告执行权限，也不侵占原 owner 正在冻结／接受的文件**。root 可在当前 leaf 验收后按下列边界直接发实现任务。三者不需要先完成 A，不能被笼统列成“财务等待所以全部停工”。

|可立即另派的实现包|精确建议写域／唯一 owner|固定接口与输入依赖|可证明的交付／仍不能声称的内容|
|---|---|---|---|
|C-HC：历史四统计卡|新 `app/components/homepage-v25/history-stats-cards.tsx`、`.css`、`.test.tsx`；建议 `/root/metric_cards`（原指标卡冻结后），或 root 指定另一独占 leaf owner；不得回改原 metric-cards 三文件|本模块导出 `HistoryStatsCardsProps`：`closedNet`、`allocatedFees` 使用现有 readonly financial metric 展示结构；`closedRounds`、`winRate` 是 caller 准备的独立 `{value:string|null,coverage,reasons}`，**不伪装成货币**；另有 `reportCurrency`、`rangeLabel`、`contextKey`、`readState`。只 import 现有 metric 的 type；不 import/call A/B。率／分母／费用已由 caller 提供，卡内不重算|按 HP353–355 的四卡顺序和 A321×88/B278×104 组合、无回合 count0/rate—、真实0／未知独立、金额／原币／原因详情与焦点失效；真实业务数值与 host 原子提交仍未接受。|
|C-HP：历史四模式图|新 `app/components/homepage-v25/history-chart.tsx`、`.css`、`.test.tsx`；建议 `/root/daily_chart` 原曲线 leaf 冻结后独占新文件；不改原 performance-chart|本模块导出 `HistoryChartProps`：S `HomepageHistoryRange/ChartMode`；readonly `buckets[]` 有 stable key、periodLabel、state、caller 准备的 periodPnl/cumulativePnl/winRate/roundCount 各值及独立 coverage/reasons；另有 reportCurrency/contextKey/readState。值为已准备原精度字符串，图只做比例/刻度/格式；不累计盈亏、不平均胜率、不闭合回合、不填缺口|同一绘图区四模式、单年月/多年年标签、货币/0–100%/整数轴、真实0／无回合／future／missing、hover/focus/Esc临时详情、不导航，1440/1280/390 原图有限验收。不能由 fixture 图宣称 history 数据已连接。|
|C-CP：唯一贡献区 controller|新 `app/components/homepage-v25/contribution-panel.tsx`、`.css`、`.test.tsx`；建议 `/root/contribution_bars` 原 Bars 三文件冻结后独占新文件；既有 Bars 只被消费，不改其金融含义|本模块导出 `ContributionPanelProps`：S `HomepageSnapshot["contribution"]`、当前全局 market、已应用 period/history 显示标签、**caller 对当前 mode/view 选好的完整有序 rows 与 fullTotal**（复用 `ContributionBarsProps` 判别 union）、projection 的 `mode/viewKey/contextKey/readState`，及 `onModeChange`、`onViewChange(mode,nextView)`、`onInstrumentActivate(exactIdentity)`。market 激活只请求局部 view 变化；证券激活把完整 identity 交 detail owner。分类资格／已知优先稳定排序由 caller 给结果；panel 不推断来源，不建 prepared source|实际工具条、双模式受控切换／记忆、历史禁用 openOnly且保留current值、全部市场→证券面包屑、full rows 后8行分页、50→7末2、3市场无证券分页、新页首行focus、fullTotal跨页不变。controlled fixture host 可直接验证这些产品行为；真实数据投影、详情保存返回与 source持久化仍未接受。|
|C-HOST：三域 consumer 协议（共享域，须串行派发）|现有 `app/components/homepage-v25/session-model.ts`、`use-homepage-host.ts` 及其精确同名测试；**仅当前 `/root/workspace_integration` 唯一集成 owner**（`ROOT-WORKSPACE-FIX-DISPATCH.md:13`，root重新有界派发后）；先不改 Workspace/Surface，不改冻结S，不和原 host工作并写|直接消费 S 已有 `HomepageRequest<HomepagePeriod,"period">`、`HomepageRequest<HomepageHistoryRange,"history">`、begin/complete/cancel/retry；为新域提供显式 opaque TP/TH data slots、可选 typed period/history loader、分域 read context、accepted-only commit、per-domain deadline/error/cancel。默认全局调用方保持现有接口行为。loader 的输入必须包含原 token 与 committed global dependency，不允许只传日期；本阶段不 import A/B、不绑定任何实际 financial loader|可实作并验证三域乱序接受、独立状态／数据原子替换、跨域失效、15秒始发deadline、retry新号、取消晚响应、source恢复／CAS不回退等通用协议；不能在这包里顺手接 Workspace live finance／修A／扩S。root 若认为 slots 接口还需签字，先签该具体接口再派实现，毋须等待A数值修复。|

三个新 leaf 包可并行：只有 type imports 与既有稳定 Bars API，没有共享新增文件。需要共用新展示 type 时，**由 root 先指定唯一 type owner 并冻结接口，再派另外两包**；不要让三个 worker 同写一个“history model”，也不要在展示 type 中装入另一套财务算法。建议每包只产本包实现／精确定向证据，由未实现该包的 root 独立验收；原对应票轮数不能另起名字重置。

这条侧线会减少真实剩余 UI 代码，但不能提前把未接受的 A/B 连到首页。C-HOST 是唯一共享写域，所以与三个新 leaf 技术上可并行、与任何当前 host修复必须串行。实际普通交易库、已有 Recall 写入／返回问题仍沿原 P1/P3 owner 的有效授权继续处理。

### 阶段 1：A 的等待与恢复门（上方独立代码可同时实施）

- [ ] 只有用户明确恢复后，financial owner 才按已验证 FX 资格问题和 cold profile 根因提交同任务有界候选；不能在 caller 删除 future carrier、禁用多市场、放宽2秒/64MiB、删公开字段或换名重来。
- [ ] root 在冻结版本独立核对：有效 USD `[0,770,840,140]` 与未来 HKD 的严格资格反例、raw evidence cutoff、金额／费用／immutable/public-field 等价，以及原完整1866×365三账户三市场性能。失败／必需未验证继续阻断。B 自身完整规模组合开销也另测，不能以 A repeat 成绩代替。

### 阶段 2：只在获授权的 boundary 明确真实来源与 host 协议

- [ ] financial 与唯一集成 owner 对照 A PrepareInput 写 source-availability 合同：bootstrap 完整载体、原始 daily、真实历史 FX journal、current per-pair evidence、lifetime coverage、四 revisions、统一 asOf；不可用项明确 unknown。不将 latest Room FX 扩写成历史事实。
- [ ] root 明确派发 host/session/Workspace 文件边界，先以字面结果验证三域 accepted/rejected、原子 commit、15秒 timer、取消晚响应、source/UI恢复与 review/drawing CAS。可提前准备纯协议，live finance 消费仍须阶段1接受。
- [ ] 所有新域复用同一 exact composite group 资格，完整 fills/fees/event 载体先 financial evaluate，再做范围／类别／显示筛选；不改 ordinary global collection 的来源隔离和当前无需 daily/FX 的路径。

### 阶段 3：P4 先接受财务 facts，再接受领域模型

- [ ] 在 A 财务基线可复用且 root 明确授权 ledger/F 有界文件后，按已存在 seam 提案提取同一 evaluator/context 的 immutable full-precision position/movement facts 与现有 F fee-step readout；不重写账本／费用池。提案 O01–O08 只是未来验收输入，目前没有运行。
- [ ] 独立核对 add→partial→flat、reversal、IPO/event-only、execution-backed allocation 去重、期前费、未知 fee、缺 episode 关联、missing historical FX、真实0/小正/负与关闭日边界。count、money、winner、FX、provenance coverage 分开。
- [ ] 再分别派发 history bundle（月/年桶、四卡、范围累计、逐桶率/总分母）与 current/history contribution bundle。类别归因只在实际可信 disposal link 下按批准 canonical pool 分配；混合缺链保 unknown 与 canonical 总额，不自动造 lot/FIFO/pro-rata。
- [ ] 核对全量 current contribution 与 period net 同账户／market／fee／FX／source policy 逐组件守恒，包括100/150/0→50；allocated fee 与 incurred fee 各守其原时间语义；禁止 UI sum known subset 当全量。

### 阶段 4：同一页面 owner 串行接三块区域

- [ ] 先接 global 与 period 域：真实 source→A→B→四卡/日线/当前贡献完整 payload；PeriodSelector 的全部范围／Shanghai 快捷／自定义草稿，成功一次提交旧 label+data→新 label+data。当前 MV/持仓独立不随期间变。
- [ ] 再接 history 域：真实 closed-round bundle→历史四卡/四模式 plot/history contribution；HistoryControls 仅发意图，range成功原子替换三部分，chartMode 属 UI-only，不切 contribution mode。
- [ ] 补唯一底部贡献 controller：两模式独立工具条/分类/排序/openOnly、全量→市场→证券本地 drill、8行分页与全量合计、真实证券详情与 focus fallback。已有 Bars 只消费 supplied immutable rows，不承担这些 missing controllers。
- [ ] 将贡献返回来源纳入现有 detail controller，支持已平仓对象；普通库仍是完整证券集合、当前 applied global dates/accounts/live、无默认 queue/首episode。URL 显式值优先、账户回退及非法身份提示沿现有合同；返回重读 finance 后恢复 UI，绝不从 snapshot 恢复旧金额。

### 阶段 5：root 在最终同版本独立接受

- [ ] 功能／数据：跨年10 vs历史30、部分减仓、反转／空头、费用／FX缺失、空历史/真0/future/错误、完整精确附件组与未知分类、三域乱序／取消／超时／retry、条件不串域、8行/50条/3市场。原返回用例全部业务义务继续断言，不能删除历史/贡献记忆来让新 UI 通过。
- [ ] 真实持久化：显式隔离库，准确 row→详情→普通库→真实保存→返回→reload；期间/history/两模式 view/scroll/focus 还原，409、失败保草稿、晚 bootstrap 不覆盖绘图；source失效回对应标题、条件保持。Callbacks/fixture rerender 不代替此门。
- [ ] 视觉／交互：由未实现该 UI 的 root 或独立 reviewer 在原稿匹配状态/视口直接比较四卡88高、层次、绘图区/缺口/tooltip、历史四模式、唯一贡献工具条/14px分段与连续零线；覆盖1440、1280、390及受影响边界。鼠标、键盘、模拟触控和真实触控分别记录；leaf旧 FAIL 逐一复验，不用测试绿或无overflow代替。
- [ ] root 按实际变更决定定向／整合回归与整页验收，版本绑定控制 inventory/功能/视觉/持久化各门，统一更新 README/FINAL；未通过保持 FAIL/NV。以上是未来检查清单，本次零项执行、不增加正式轮次。

## 本次冻结与限制

这份静态定位没有新验证的生产缺陷；报告列明的是直接可见的未实施接线以及既有已验证阻断。Critical/Important/Minor 的新缺陷计数不适用；已知 A 重要资格问题和性能 FAIL 按原报告保留，未被降级。静态没有发现其他缺陷不等于功能 PASS。

本次门：文档准备已形成；产品功能、真实浏览器交互、完整持久化、视觉接受均 **NOT VERIFIED（本次未运行）**。原功能 FAIL 的效力不变。冻结后的报告／源码 hash 及读集变化记录在 `MANIFEST.json`；该 manifest 完成后停止写入，交 root 决定下一次具体派发。
