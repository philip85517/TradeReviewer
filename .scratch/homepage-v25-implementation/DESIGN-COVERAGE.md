## 2026-10-24 — 最后候选的独立覆盖结论

**P1/F07 3/3 FAIL暂停；整页未交付。** 以下当前覆盖与[最终接受](evidence/resume-2026-10-24/ROOT-ACCEPTANCE-3.md)同步。原55项需求、96状态及准确原稿引用均保留，不缩减分母或改变批准范围。三位实际实现者为Astra Ultra；root拥有整页视觉一致性、完整数据/持久化流程与独立接受。旧记录中的“2/3”只对应历史版本。

|要求/元素与原参考|本轮责任及用户旅程|独立证据与结论|
|---|---|---|
|HV25-14/15/16、47–51；HOME-HP02-B001、HP09-B001/B028/B031；原稿467–480/544–546，loading.svg/error.svg及原矩阵准确图；期间设计§§7–9|astra_source负责来源恢复；astra_finance负责指标子模块；root负责整页状态。读取→取消/恢复/拒收/超时|来源38项PASS；实际非法scope零IO拒收与真实超时仍显示期间加载，FAIL。见[拒收根因](evidence/resume-2026-10-24/period-ui-final-design/implementation/recovery-identity/final-publication/hard-invalid-diagnosis/DIAGNOSIS.md)、[最终页面](evidence/resume-2026-10-24/period-ui-final-design/implementation/recovery-identity/final-publication/root-independent/final-home-preview.png)。原稿缺少该非法URL的专门画稿，不能把它冒充精确视觉参考；终态契约明确适用。|
|HV25-44..46/53必要库接线与既有复盘；[编辑会话设计](evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/DESIGN.md)的E01/E02/E04/E07/E08/E14/E15/E19/E20/E22、D38及原02/04/05 PNG|astra_integration_design负责编辑会话；root独立实际图表、返回与持久化。工作图→A→B→返回；更新→保存→返回→reload→重开|[独立检查点](evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/session-design/root-independent/ROOT-CHECKPOINT.md)：80运行测试与所列真实鼠标路径有限PASS；strict 8错FAIL；完整dirty/失败/冲突/键盘/触摸/响应式视觉NOT VERIFIED。|
|HV25-14..20/38..43财务子合同，沿原矩阵和冻结合同的逐ID参考|astra_finance负责财务；root按原金额、时序、性能独立检查|[48+9原样本](evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/final-preparation/ROOT-RESULT.json)PASS，仅核心；不能代替真实首页超时门。|
|HV25-32..43历史及贡献，准确HP05参考保持|历史数据扩展依赖最小真实period E2E；root独立接受|真实页面明确尚未接入，NOT VERIFIED；ContributionBars 3/3空间FAIL暂停。没有以组件测试代替真实接线。|

本轮实际浏览器状态证据为1280×720/DPR2首页和1440×900复盘，已在各检查点如实记录；它们不代替原1440×1000/1280×800整页参考比较。所有授权偏差均为空；未验证的尺寸、信息层级和控件保持原合同。新发现登记在原P1下：[类型错误](issues/14-p1-strict-finding.md)、[终态加载](issues/15-p1-terminal-state-finding.md)、[首页超时](issues/16-p1-homepage-timeout-finding.md)，均无独立新轮数或第四修复授权。

以下为历史覆盖与派发记录。

## 2026-10-24 — 原子存储输入与同源 Workspace 接线

root批准 storage方案B与Workspace方案A/C1；分别归 /root/astra_integration_design 和 /root/astra_source（gpt-6-astra / ultra）。[存储票12](issues/12-stored-source-snapshot.md)明确只证明已存资料枚举；[Workspace派发](evidence/resume-2026-10-24/source/astra/workspace-design/ROOT-DISPATCH.md)及同目录DESIGN第10表逐一映射 HV25-06..31/32..43/44..53/03..05/54 至精确原规格、元素、参考图、用户旅程与独立证据。原55项/96状态不减，P1仍2/3FAIL，Metrics最后候选3待root，Bars3/3暂停。root继续拥有整页视觉及全数据流。存储/同源接线/表示覆盖/历史起点分别验收，成功读取不推导金融全集完整；history实施仍等最小真实period E2E。

## 2026-10-24 — Metrics 同票最后候选接线调整

HV25-14/15/16、HOME-HP02-B001，HP02正文191–221及HP09正文467–515；参考 home-1440.svg / home-1280.svg / atom-metric.svg、component-manual.html611–698。`astra_finance` 在 root 解除性能静默后仅改 metric-cards.tsx / test，直接消费窄 PeriodView；current 与完整 stamp 为唯一权威，all起点未知不抹已知current。整页视觉/完整数据流/独立接受owner root。原Metrics仍 **2/3 FAIL**，这是同一最后候选3；CSS不改、旧26项及新8组字面量、真实鼠标键盘/焦点/动效/断点视觉独立验收，详见 [派发](evidence/P2/metrics/astra-current/ROOT-DISPATCH.md)。不重置或放宽门槛。

## 2026-10-24 — Astra 三个新模块切片

旧F seam第3/3轮与S1第1/3轮纯模块PASS保留。下列均为先前计划中的新增能力，0/3起；不用于重置旧FAIL或已暂停叶子。root为整页视觉、完整数据流和独立接受owner。

|切片/owner/写面|精确规范、元素及参考|用户旅程/独立证据|
|---|---|---|
|Historical FX / astra_finance；仅F及同名test|HV25-32..43，HP05正文349–431 HOME-HP05-B001/B027/B034；逐ID图像见 [冻结合同](evidence/P4/historical-fx/CONTRACT.md)|闭合回合三原币槽→同关闭日截止转换→未来history/贡献；同日缺币隔离、Decimal乘后除、缺未来冲突、冻结；UI仍NV|
|Acquisition / astra_source；仅新financial-acquisition.ts及test|HV25-06..13 HP03、14..22 HP02、32..43 HP05、47..51 HP09；沿 [S1准确引用](evidence/P4/ROOT-DATA-CONTRACT.md) 与 [原始映射](evidence/resume-2026-10-24/source/astra/RAW-SOURCE-MAPPING.md)，全量55行原refs不变|同请求raw/metadata/candles/FX响应→真实observedAt/completedAt收据→S1；future clocks、detached FX receipt、raw由S1唯一复制、deterministic revision、unknown范围；IO/页面后续NV|
|PeriodView / astra_integration_design；仅新financial-view-model.ts及test|HV25-14..22/47..53，HOME-HP02-B001/B020/B024、HP09/HP10，正文193–252/467–515/550–568；home-1440.svg、home-1280.svg、period.svg、chart-gap.svg、loading--stale-data.svg、error--update-failure.svg；[冻结设计](evidence/resume-2026-10-24/astra-integration/PERIOD-VIEW-DESIGN.md)|已接受source+最终acceptedSnapshot或local token→series与独立current；P01–P13字面金额/unknown/身份/引用冻结；随后最小真实E2E接受才扩大history|

本轮同步组装后deadline已由root111测试及真实15.203秒截止/重试有限接受，见 [接受证据](evidence/resume-2026-10-24/astra-integration/deadline/ROOT-ACCEPTANCE.md)。不替代全页功能、持久化、视觉或全控件门。

## Astra 下一切片 — 全局同步组装后的截止检查

2026-10-24：root批准 `evidence/resume-2026-10-24/astra-integration/UNIFIED-DESIGN.md` 第5.1节。精确 refs/元素/旅程沿该文第6表的 HV25-47..51 / HOME-HP09-B001/B028/B031 及 HP08-B001；原图 loading.svg、loading--stale-data.svg、error.svg、error--update-failure.svg，原稿467–549行。owner `/root/astra_integration_design`，仅 use-homepage-host.ts / navigation-deadline.test.tsx；root独立接受。14999ms同步计算跨15000/15001后不得发布新data/两域/范围/币种或调用onReadAccepted，保留旧包并可手动重试；首次home/collection正确收敛。原domain-host1/3纯协议PASS保留，相邻回归重开；P1原2/3不重置。UI全页/持久化/视觉后续仍独立门。

## 2026-10-24 — 新派发版本与覆盖 owner

总55项及旧证据/FAIL保持。准确 S1 逐项ID→原spec/图片→owner→数据旅程→接受证据见 [冻结合同](evidence/P4/ROOT-DATA-CONTRACT.md)；S1仅source纯模块，不冒充UI覆盖。owner `/root/homepage_flow_scan24`，新四文件独占，root独立接受；seam/性能前置未关闭前不发布页面金融数据。

HistoryChart同叶formal1/3 FAIL及candidate2限定范围见 [root接受](evidence/P4/history-chart/ROOT-ACCEPTANCE-1.md)，owner `/root/ui_acceptance_scan24` 独占原三个chart文件，HV25-33/34/35/47–51，准确原refs/空态metadata/150ms及reduced/三视口和临界旅程沿原ROOT-DISPATCH。root负责整页视觉与数据流，非实现者直接视觉比较仍须保留。Bars3/3暂停；Metrics2/3、Stats1/3不重置。

财务seam第2/3 FAIL，root独立反例与性能诊断见 [第2轮](evidence/P4/seam/ROOT-ACCEPTANCE-2.md)；owner `/root/finance_resume24` 目前仅准备固定profile工具，未授权产品第3候选。各纯模块UI/DB写NA有范围依据；整页所有适用功能/持久化/视觉门仍未接受。

## 2026-10-23 — 新三域host有限接受；seam与相邻性能回归重开

root独立364/364定向回归及源码/hash复核完成。新configured domain-host纯协议第1/3轮PASS，见[evidence/P2/domain-host/ROOT-ACCEPTANCE-1.md](evidence/P2/domain-host/ROOT-ACCEPTANCE-1.md)，P1旧2/3 FAIL与页面接线NV不变。

P4只读财务seam第1/3轮FAIL：root真实公开接口复现非前缀费用选择、数量未知仍认证分配、两处episode关联coverage错误；原九性能样本4个超过2秒，数值/覆盖/缓存通过，性能原因未证。见[evidence/P4/seam/ROOT-ACCEPTANCE-1.md](evidence/P4/seam/ROOT-ACCEPTANCE-1.md)。A恢复1/3旧PASS证据保留，最终扩展版相邻性能门重开；同seam第二候选有界修复/对照诊断派发，非重置A。历史统计卡同票第二候选进行中，ContributionBars 3/3 FAIL仍暂停。producer只完成设计，不等于实现/接受。整页未交付，无推送/合并/发布。

## 2026-10-23 11:12 CST — 历史统计卡第1/3轮 FAIL

root独立29项测试与4条实际详情/焦点有限PASS；1440正常胜率64.285714…主值被截断并隐藏%，与原稿64.3%不符，正式1/3 FAIL。候选1冻结，等待同叶候选2；完整响应/动效/数据接线仍NV。见[evidence/P4/history-stats/ROOT-ACCEPTANCE-1.md](evidence/P4/history-stats/ROOT-ACCEPTANCE-1.md)。ContributionBars原3/3 FAIL暂停不变；新domain-host接口已审查批准实施，不等于P1/P4接受。整页未交付。

# V2.5 首页实施设计覆盖

## 权威续推检查点：2026-10-23 07:09 CST

**整页仍未交付。** 当前实现代理实际均为 **gpt-6.1-sol / ultra**。P1正式2/3 FAIL；P2/P3/P4正式0/3，P5未验证；下列准备/局部PASS不增加或重置轮数，所有历史失败保留。

- P3附件七文件候选已冻结，独立审查无新Critical/Important/Minor；root126/126与既有Workspace10/10定向回归PASS。真实390×844筛选应用→准确交易回合→实际保存→返回→刷新有限旅程PASS，隔离库revision5→6已SQL核对；[有限检查点](evidence/continue-2026-10-23/ROOT-ATTACHMENT-CANDIDATE1-CHECKPOINT.md)。CSV、全组合、四区联动、完整控件/视觉仍NV。
- Chart候选2已冻结，root34/34及原独立焦点反例2/2PASS；真实1280/390键盘六来源/退出/Esc及流内详情有限验证。原leaf第1/3FAIL保留，第2次正式接受尚未签署；鼠标300/100ms及全状态视觉不能由测试替代。
- **A/B新增Important I-01：未来-only HKD组污染有效USD FX资格，使合法历史/当前[0,770,840,140]变null。** 独立最小真管线反例FAIL；[完整报告](evidence/P2/data/p2-b/independent-review/REVIEW.md)。B本身仅日历组合，无新B算术问题。A保持三候选冻结，原2617.55ms>2000ms性能FAIL及架构待答复不变；P2/P4财务接入BLOCKED，不以UI预过滤绕过。
- 指标卡和贡献条形新受控leaf正由两名GPT6.1SOLUltra并行准备，仅读既定只读结果，不改财务/host、不释放P2/P4页面；[指标派发](evidence/P2/metrics/ROOT-DISPATCH.md)、[条形派发](evidence/P4/bars/ROOT-DISPATCH.md)。root独立验收，各leaf上限3轮。
- 请求体60秒观察窗自然捕获3个正常review PUT，未捕获失败消费者；全部8服务钩子恢复、无残留，3333已恢复无探针同一隔离库服务。**原问题OPEN**，不是修复通过。History/Period候选2有限证据仍见原控件检查点，完整矩阵NV。

## 以下为保留的历史检查点（不代表当前状态）

## 当前并行续推

用户继续指令维持 GPT6.1 SOL / ultra 与最多3轮。原P3附件接口已批准并进入限定接线TDD；P2受控日曲线仍仅提前准备独立新文件，A性能讨论待答复，金融页面门未释放。准确逐行来源、原图、控件/状态/旅程、owner、文件边界和证据分别以 [P3附加派发](evidence/P3/attachment-integration/ROOT-DISPATCH.md)（HV25-10..13/23..30/44..49，HOME-HP03-B044）及 [P2曲线派发](evidence/P2/chart/ROOT-DISPATCH.md)（HV25-19..22，HOME-HP02-B030）补充矩阵。root已直接看原图，图表正文自然高度/完整金额/默认不显点优先于旧plate。曲线所有卡内候选均挡主线时，root明确批准绘图区下方正常文档流详情撑开卡，默认比例不变，不允许绝对overflow遮下一模块；这是一项响应式极端布局裁定，不冒充原稿明确像素。P3 owner attachment_integration、曲线 owner daily_chart；root拥有整页视觉和完整数据流。新增产品门待独立验收，原55需求/96公共状态保持。

历史控件及周期leaf第1/3轮FAIL保留，第2轮root实际操作的局部修复和80测试证据见[控件检查点](evidence/continue-2026-10-23/ROOT-CONTROLS-CANDIDATE2-CHECKPOINT.md)；不等于完整14/63适用状态接受。Workspace root14定向与host24全文件测试PASS、实际390普通库返回/reload仅有限通过，见 [有限检查](evidence/continue-2026-10-23/ROOT-WORKSPACE-FINITE-CHECKPOINT.md)。附件新接线修改后须重验。P1仍2/3 FAIL，未实现消费者仍FAIL。

2026-10-23：HV25-17/18（HOME-HP02-B020 / HP02:210–221 / period.svg）的受控期间选择器 leaf 提前实施归 `/root/financial_sharing`（gpt-6.1-sol / ultra）。[准确派发](evidence/continue-2026-10-23/ROOT-PERIOD-SELECTOR-DISPATCH.md)绑定草稿/校验/快捷/取消/等待失败旅程及root证据；只新3文件，不接入页面或金额，不解除A性能FAIL/P4/完整P2依赖，不重置轮数。整页视觉/完整数据流/独立接受仍root；原55项分母与NV保持。

2026-10-23 05:34 CST：HV25-09/10/23/24/27/29/31/53/55 的普通库/来源/回放入口准备修复归 `/root/workspace_integration`（gpt-6.1-sol / ultra）；准确原稿、单一写入、旅程和 root 独立证据见 [root 派发](evidence/continue-2026-10-23/ROOT-WORKSPACE-FIX-DISPATCH.md)。修复 fresh bootstrap 与可选行情的错误等待依赖，保留 URL/source/generation 与回放截止。P1 正式仍2/3 FAIL；旧失败和原矩阵不删。

2026-10-23 05:30 CST：当前附加诊断映射 **HV25-23/24/27/29/53/54**（原持仓表、元数据、普通库与来源返回条目保持不删）。`/root/financial_sharing`，实际 gpt-6.1-sol / ultra，仅只读诊断 `evidence/continue-2026-10-23/root-workspace-current-0522.log` 的 11 个失败；对照当前原规格 HP03/HP04/HP06、原持仓/详情/返回图及当前项目回放流程，逐项给出 stale assertion / genuine regression / unresolved 与第一坏写或等待链。证据归档 `evidence/continue-2026-10-23/workspace-diagnostic/`。此派发不允许产品、测试期望、数据库或服务变更，不增加/重置 P1 正式轮数；root 仍负责完整数据流、整页视觉和独立接受。

## 当前实施归属（优先于下方历史规划说明）

2026-10-23恢复覆盖：当前模型统一gpt-6.1-sol / ultra；F财务子合同归/root/financial_g61，S状态子合同归/root/state_g61。S于00:49 CST、F于01:10 CST分别通过恢复第1轮纯合同接受；/root/integration_g61已获授权实施P1，后续P2–P4仍须逐票解除依赖。F日序列性能及实际页面消费仍待验证。/root继续负责整页视觉、完整数据流和独立接受。55项分母及所有原规格/参考不变，产品项仍NOT VERIFIED。原Luna说明保留为历史，当前执行以RESUME-2026-10-23.md为准。

2026-10-22 用户已授权多 Agent 开发。下方55行保留原规格、manifest定位和准确图像引用；不删减任何要求，全部产品项初始 NOT VERIFIED。PLAN.md 的 P1–P5 是各行所标 P* 的实际交付责任；单一 /root/integration_g61 页面 owner 负责产品，/root 负责整页视觉、完整数据流与独立验收。F 承担 HV25-14..20 / 38..43 的财务子合同；S 承担 HV25-01/06/11..13/29/42/44..49/53/55 的状态与导航子合同；A 负责96状态当前资产映射及 P1 派发登记。纯模块通过不自动改变以下任何 UI 结论。

A逐操作/必需状态登记与S纯合同已接受，P1精确文件和接口见issues/04-holdings-journey.md与visual-contract.md；P1真实往返与首张视觉接受前不扩展P2–P4。最大3轮限制与失败暂停记录见 PLAN.md 和各票。

本表服务于可行性与初步拆解，**不是派发完成表或验收通过表**。当前实施中，全部产品项仍 NOT VERIFIED。当前包含55个规划跟踪项；正式实施前还须按每个操作、必需状态与真实动态实例展开，不把一行多个状态当成已完成逐状态覆盖。

- 批准来源：[V2.5 正文](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)、[完整阅读器](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/visual-spec.html)、[公共手册](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html)。正文 HP11 明确整页图与[第四轮局部原型](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/prototypes/round4/index.html)、[第五轮原型](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/prototypes/round5/index.html)共同作用；后者的详情连接为占位。
- 原稿没有覆盖全部控件的稳定 elementID。本表 HV25-* 是本轮新增的**需求跟踪 ID**；elementID 栏注明无，并给出真实 manifest 文本块定位，不能冒充原稿元素 ID 或套用复盘 E01–E22。
- 比较视口1440×1000、1280×800，100%；图稿自身较高时滚动比较，不能缩整图后声称尺寸相同。
- owner 已指定/root/integration_g61作为各P1–P4唯一页面实现与接线负责人（依赖接受后逐票授权），/root独立接受。每片一个当前用户指定模型实现负责人、一个完整数据流负责人，主协调者负责整页视觉和独立集成接受；实施票另冻结实际姓名/模型、文件所有权、真实依赖。P*为执行PLAN阶段，P1票见issues/04-holdings-journey.md；其余依赖解除前不实施。
- 证据路径均为未来计划位置，当前没有该产品证据。预留 `evidence/P*/functional/`、`state-persistence/`、`visual/`、`controls/` 并绑定代码版本、数据版本、服务、浏览器与设备；不制造空PASS记录。
- 控件96状态逐项见 [CONTROL-STATE-COVERAGE.md](CONTROL-STATE-COVERAGE.md)。共享规范先落首页，其他页面完整迁移不在本期；必要接线影响面仍需回归。

|需求ID / 精确规格行号|elementID / 原稿文本定位|准确参考图|阶段与状态|owner / 候选批次|交付映射|浏览器操作|可观察预期与反例|证据计划|结果|
|---|---|---|---|---|---|---|---|---|---|
|HV25-01 / [正文:11](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:11)–38|无；文本 HOME-HP01-B005|[home-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)|首页/实盘|/root/integration_g61实现/数据接线；/root整体验收 / P1|范围 Module|从其他页模拟视角进入首页|只显示实盘；不删除其他页模拟能力|`evidence/P1/` 三类证据待生成|NOT VERIFIED|
|HV25-02 / [正文:31](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:31)–38|无；文本 HOME-HP01-B026|[home-history-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-history-1440.svg)|作用域隔离|/root/integration_g61实现/数据接线；/root整体验收 / P1/P2/P4|提交状态 Module|切期间、历史年份、持仓搜索、贡献下钻|各自作用域不串改；市场/账户作用整页|`evidence/P1-P2-P4/` 三类证据待生成|NOT VERIFIED|
|HV25-03 / [正文:42](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:42)–75|无；文本 HOME-HP11-B001|[home-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)<br>[home-1280.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1280.svg)<br>[home-history-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-history-1440.svg)<br>[home-history-1280.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-history-1280.svg)|两视口/两贡献模式|/root/integration_g61实现/数据接线；/root整体验收 / P1–P5|整页集成|相同视口滚动阅读并切贡献模式|导航72/页头64/左右24/模块24；顺序与上方位置稳定|`evidence/P1–P5/` 三类证据待生成|NOT VERIFIED|
|HV25-04 / [正文:77](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:77)–110|无；文本 HOME-HP11-B021|[visual-samples-board.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/visual-samples-board.svg)|颜色/字号/对齐|/root/integration_g61实现/数据接线；/root整体验收 / P1–P5|首页控件 Adapter|比较正常/盈亏/未知/聚焦状态|使用指定token、系统字体、字级、数字字形右边缘对齐|`evidence/P1–P5/` 三类证据待生成|NOT VERIFIED|
|HV25-05 / [正文:77](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:77)–110|无；文本 HOME-HP11-B021|[visual-samples-board.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/visual-samples-board.svg)<br>[extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/extreme.svg)|金额与精度|/root/integration_g61实现/数据接线；/root整体验收 / P1/P2/P3/P4|金额显示 Module|hover/focus/复制/导出不同量级金额|两位小数、万/亿阈值；底层保留精度；不缩字号或伪造零|`evidence/P1-P2-P3-P4/` 三类证据待生成|NOT VERIFIED|
|HV25-06 / [正文:113](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:113)–129|无；文本 HOME-HP03-B001|[account.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/account.svg)|市场/账户/工具排布|/root/integration_g61实现/数据接线；/root整体验收 / P1|范围+页头|切全部/A/HK/US与账户|账户176×36；页头搜索筛选18视觉/36命中；币种对应市场|`evidence/P1/` 三类证据待生成|NOT VERIFIED|
|HV25-07 / [正文:130](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:130)–160|无；文本 HOME-HP03-B019|[search-overlay-open.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-overlay-open.svg)|全局搜索开启/退出|/root/integration_g61实现/数据接线；/root整体验收 / P3|搜索 Module|搜索图标→打开；Esc/外侧关闭|舞台最大960、两侧≥24、背景inert；关闭回触发器不清查询|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-08 / [正文:130](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:130)–160|无；文本 HOME-HP03-B019|[search.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search.svg)|搜索输入/IME/无匹配/错误|/root/integration_g61实现/数据接线；/root整体验收 / P3|搜索 Module|输入拼音选词、连续改词、清空/重试|300ms；组合期间不提交半词；区分无匹配与请求失败|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-09 / [正文:130](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:130)–160|无；文本 HOME-HP03-B019|[search-detail.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-detail.svg)|结果→详情→搜索|/root/integration_g61实现/数据接线；/root整体验收 / P3|搜索/详情/导航|选结果→详情→Esc返回|详情焦点约束；外侧不关闭；唯一主动作查看交易；恢复查询/滚动/选中/焦点|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-10 / [正文:130](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:130)–160|无；文本 HOME-HP03-B019|[search.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search.svg)<br>[search-detail.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-detail.svg)|唯一标的身份|/root/integration_g61实现/数据接线；/root整体验收 / P3|搜索/导航|选择跨交易所同代码结果|名称/代码/交易所/币种/类别可辨；不跳固定首行；集合由决策票确定|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-11 / [正文:161](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:161)–190|无；文本 HOME-HP03-B044|[filter.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/filter.svg)<br>[multi-applied.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/multi-applied.svg)<br>[multi-applied--reopen.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/multi-applied--reopen.svg)|筛选草稿/已应用|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3|提交状态/筛选|编辑后取消/外侧关闭再打开；切市场/账户|320宽/36字段；同维OR跨维AND；取消保草稿，切身份丢旧草稿|`evidence/P1-P3/` 三类证据待生成|NOT VERIFIED|
|HV25-12 / [正文:161](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:161)–190|无；文本 HOME-HP03-B044|[multi-applied.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/multi-applied.svg)|筛选提交成功/失败|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3|提交状态/筛选|应用新筛选并注入失败|成功整组更新；失败旧应用范围与草稿保留，不能显示新标签旧数据|`evidence/P1-P3/` 三类证据待生成|NOT VERIFIED|
|HV25-13 / [正文:161](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:161)–190|无；文本 HOME-HP03-B044|[clear-attachments.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/clear-attachments.svg)<br>[clear-attachments--after-clear.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/clear-attachments--after-clear.svg)<br>[reset.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/reset.svg)<br>[reset--reset.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/reset--reset.svg)|清除附加/恢复默认|/root/integration_g61实现/数据接线；/root整体验收 / P3|筛选 Module|应用附加筛选→清除；恢复默认|清除保市场/账户/live；恢复默认独立一行；两者不改日期|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-14 / [正文:193](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:193)–209|无；文本 HOME-HP02-B001|[home-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)|四张KPI|/root/integration_g61实现/数据接线；/root整体验收 / P2|期间表现投影|进入→切期间→读详情|四卡同时88高；前三随期间，第四最新市值不变且不含现金负债|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-15 / [正文:193](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:193)–209|无；文本 HOME-HP02-B001|[contribution.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution.svg)|期间算术/部分平仓/跨年/空头|/root/integration_g61实现/数据接线；/root整体验收 / P0/P2/P4|期间表现投影|核对样本后切区间与市场|净=期间实现+期末浮盈−期初浮盈；逐笔归属、费用一次计入；不是当前浮盈总额|`evidence/P0-P2-P4/` 三类证据待生成|NOT VERIFIED|
|HV25-16 / [正文:193](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:193)–209|无；文本 HOME-HP02-B001|[account.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/account.svg)<br>[chart-gap.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-gap.svg)|原币/FX/覆盖|/root/integration_g61实现/数据接线；/root整体验收 / P0/P2|金额与期间投影|切全部/港股/美股，制造缺FX|币种与市场一致；详情保原币/覆盖/来源；缺失不可计算，不补0|`evidence/P0-P2/` 三类证据待生成|NOT VERIFIED|
|HV25-17 / [正文:210](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:210)–221|无；文本 HOME-HP02-B020|[period.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/period.svg)|本周/月/今年|/root/integration_g61实现/数据接线；/root整体验收 / P2|期间状态 Module|点击快捷日期并进入交易库|上海自然边界、周一开始、起止含当日；传实际起止日|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-18 / [正文:210](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:210)–221|无；文本 HOME-HP02-B020|[period.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/period.svg)|自定义草稿/无效/更新成功失败|/root/integration_g61实现/数据接线；/root整体验收 / P2|期间状态 Module|反向日期/未来/有效日期→应用→失败→重试|先校验再提交；旧范围与完整数据保留直到成功|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-19 / [正文:222](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:222)–252|无；文本 HOME-HP02-B024|[chart-scale.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-scale.svg)<br>[chart-scale--normal.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-scale--normal.svg)<br>[chart-scale--wide.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-scale--wide.svg)<br>[chart-scale--extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-scale--extreme.svg)|主曲线/量级|/root/integration_g61实现/数据接线；/root整体验收 / P2|曲线 Module|选择不同期间和极值样本|单条日净盈亏2px，点6px仅hover/focus，轴12px≤7刻度，完整金额可查|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-20 / [正文:222](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:222)–252|无；文本 HOME-HP02-B024|[chart-hover.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-hover.svg)|鼠标图点/边缘提示框|/root/integration_g61实现/数据接线；/root整体验收 / P2|曲线 Module|hover中间日和四边；移出|300ms显示/100ms关闭；264宽按内容自适应；该日市值浮盈/累计实现净额，不裁字|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-21 / [正文:222](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:222)–252|无；文本 HOME-HP02-B024|[chart-hover--keyboard.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-hover--keyboard.svg)|键盘图点/固定/关闭|/root/integration_g61实现/数据接线；/root整体验收 / P2|曲线 Module|Tab→左右/Home/End→Enter固定→Esc|键盘立即显示同字段；Esc后重新进入才展示；焦点回触发点|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-22 / [正文:222](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:222)–252|无；文本 HOME-HP02-B024|[chart-gap.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/chart-gap.svg)|缺行情/缺FX/零值/未来|/root/integration_g61实现/数据接线；/root整体验收 / P2|曲线/数据状态|浏览缺口、真实0、未来区间|缺口断线不插值；未知—及原因；未来/零独立；无查看该日敞口入口|`evidence/P2/` 三类证据待生成|NOT VERIFIED|
|HV25-23 / [正文:255](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:255)–294|无；文本 HOME-HP04-B001|[holding-option-C-normal-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-normal-1440.svg)<br>[holding-option-C-normal-1280.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-normal-1280.svg)|持仓表几何|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3|持仓 Module|加载1/8/9条并翻页|标题48/表头40/行48/页脚48；八槽；列25/8/10/11/11/15/14/6，内16|`evidence/P1-P3/` 三类证据待生成|NOT VERIFIED|
|HV25-24 / [正文:609](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:609)–643|无；文本 HOME-HP10-B088|[holding-option-C-normal-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-normal-1440.svg)<br>[holding-option-C-normal-1280.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-normal-1280.svg)<br>[holding-option-C-large-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-large-1440.svg)<br>[holding-option-C-large-1280.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-option-C-large-1280.svg)|持仓汇总C/普通大额|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3|持仓+整页视觉|比较长名/大金额的两宽度|汇总在标题右侧；搜索导出空间独立；A/B仅历史候选|`evidence/P1-P3/` 三类证据待生成|NOT VERIFIED|
|HV25-25 / [正文:255](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:255)–294|无；文本 HOME-HP04-B001|[extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/extreme.svg)|价格/金额/长数字|/root/integration_g61实现/数据接线；/root整体验收 / P3|持仓/金额显示|hover/focus价格成本与导出|价格成本两位；不把全精度损失到数据层；长值不撑高行|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-26 / [正文:295](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:295)–346|无；文本 HOME-HP04-B048|[count-boundaries.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/count-boundaries.svg)<br>[count-boundaries--nine-items-last-page.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/count-boundaries--nine-items-last-page.svg)<br>[50-items.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/50-items.svg)<br>[50-items--page-7.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/50-items--page-7.svg)|分页0/1/8/9/50|/root/integration_g61实现/数据接线；/root整体验收 / P3|持仓 Module|翻50条到第7页，核对末页|八行槽稳定；50项末页2条；0不出现1/1与活动翻页；1–8禁用箭头|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-27 / [正文:324](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:324)–346|无；文本 HOME-HP04-B052|[empty.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/empty.svg)<br>[empty--zero-holdings.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/empty--zero-holdings.svg)<br>[extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/extreme.svg)|零持仓/无匹配/缺价缺成本|/root/integration_g61实现/数据接线；/root整体验收 / P3|持仓 Module|清空本地搜索、切空账户、缺输入|空态彼此区分；无匹配仅输入X清除；缺成本暂无、缺价待更新，不写0|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-28 / [正文:295](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:295)–311|无；文本 HOME-HP04-B048|[local-search-pages.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/local-search-pages.svg)<br>[local-search-pages--one-match.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/local-search-pages--one-match.svg)<br>[local-search-pages--clear.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/local-search-pages--clear.svg)|持仓局部搜索/IME/分页重置|/root/integration_g61实现/数据接线；/root整体验收 / P3|持仓 Module|第3页输入词并清除|300ms/IME规则；只过滤表；清除与改词回第1页，不开全局搜索|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-29 / [正文:295](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:295)–311|无；文本 HOME-HP04-B048|[count-scales.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/count-scales.svg)|排序/跨币种完整性|/root/integration_g61实现/数据接线；/root整体验收 / P3|持仓/金额投影|排序后切市场/改词/缺FX|有可比较CNY完整覆盖才排序；缺输入解释禁用；排序/范围变化页码重置|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-30 / [正文:295](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:295)–311|无；文本 HOME-HP04-B048|[count-scales.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/count-scales.svg)|导出全筛选|/root/integration_g61实现/数据接线；/root整体验收 / P3|持仓 Module|50条过滤后在第2页导出|导出全部筛选结果而非当前页；完整原始精度可查|`evidence/P3/` 三类证据待生成|NOT VERIFIED|
|HV25-31 / [正文:312](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:312)–322|无；文本 HOME-HP04-B050|[holding-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-return.svg)<br>[holding-return--detail.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-return--detail.svg)<br>[holding-return--after.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/holding-return--after.svg)|持仓详情/关闭/来源消失|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3|持仓/导航|键盘逐行查看→详情→返回；删除来源后返回|末列按钮居中且可访问名查看持仓详情；恢复行/搜索/排序/页/滚动/焦点；消失回标题|`evidence/P1-P3/` 三类证据待生成|NOT VERIFIED|
|HV25-32 / [正文:349](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:349)–362|无；文本 HOME-HP05-B001|[history.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history.svg)<br>[history-stats-win.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-win.svg)|历史四指标/胜率|/root/integration_g61实现/数据接线；/root整体验收 / P4|历史投影|切有回合/无回合/极端胜率样本|净收益/回合/胜率/费用按平仓日；持平入胜率分母；无回合—；A321×88/B278×104|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-33 / [正文:349](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:349)–394|无；文本 HOME-HP05-B001|[journeys-year.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/journeys-year.svg)<br>[history-stats-empty.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-empty.svg)<br>[history-stats-error.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-error.svg)|年份草稿/范围提交|/root/integration_g61实现/数据接线；/root整体验收 / P4|历史状态 Module|单年/跨年/全部→应用→失败/成功|单年月粒度、多年年粒度；原子更新历史与历史贡献，不改期间/持仓/图模式|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-34 / [正文:349](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:349)–394|无；文本 HOME-HP05-B001|[history.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history.svg)<br>[history-stats-cumulative.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-cumulative.svg)<br>[history-stats-win.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-win.svg)<br>[history-stats-rounds.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-rounds.svg)|四种历史曲线模式|/root/integration_g61实现/数据接线；/root整体验收 / P4|历史图表 Module|切每期/累计/胜率/回合|同容器不改绘图区；胜率0–100且逐桶，不取平均；回合整数|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-35 / [正文:349](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:349)–394|无；文本 HOME-HP05-B001|[history-stats-empty.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-empty.svg)<br>[history-stats-error.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-error.svg)<br>[history-stats-source-missing.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-source-missing.svg)<br>[history-stats-extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-extreme.svg)|历史零/无回合/未来/缺失/错误|/root/integration_g61实现/数据接线；/root整体验收 / P4|历史图表/数据状态|切边界年份并注入错误/缺失|区分真0、无回合留空、未来、缺失和错误；不补虚构点|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-36 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–410|无；文本 HOME-HP05-B027|[contribution-states.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-states.svg)<br>[contribution-historical-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-historical-a-share.svg)|底部唯一贡献/模式日期|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献 Module|当前↔历史切换|只变本模块，沿用各自已有日期，无第三日期控件，上方不移动|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-37 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–431|无；文本 HOME-HP05-B027|[contribution-states.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-states.svg)<br>[contribution-current-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-current-a-share.svg)|市场→证券→详情|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献/导航|全部市场点A股→某证券→详情→返回面包屑|顶部仍全部；直选市场直接证券；不得泛化按钮跳固定证券或加双栏|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-38 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–431|无；文本 HOME-HP05-B027|[contribution-current-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-current-a-share.svg)<br>[contribution-historical-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-historical-a-share.svg)|多/空/打新与独立筛选|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献 Module|切分类/排序/仅未平仓，切历史再返回|分类互斥；上市后自买做多；历史仅未平仓禁用但记忆；控件行几何稳定|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-39 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–431|无；文本 HOME-HP05-B027|[contribution.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution.svg)|全量对账/开期浮盈/缺估值|/root/integration_g61实现/数据接线；/root整体验收 / P0/P2/P4|期间与贡献投影|跨年与部分平仓算例核对总和|当前全量贡献=期间净；含已平仓部分期初浮盈；100/150/0→50；历史只闭合回合|`evidence/P0-P2-P4/` 三类证据待生成|NOT VERIFIED|
|HV25-40 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–431|无；文本 HOME-HP05-B027|[contribution-mixed-sign-demo.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-mixed-sign-demo.svg)<br>[contribution-extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-extreme.svg)|实心/中空、同/异号、极小值|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献绘图 Module|比较双正/双负/正负/真0样本|实现实心、浮变中空；同向同色/异号分零线；同14外高；负#EF7F89；按分归0不画假柱|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-41 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–431|无；文本 HOME-HP05-B027|[contribution-current-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-current-a-share.svg)|贡献分页/全量合计|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献 Module|证券50项→7页；切3市场汇总|证券每页八行，末页2；市场3行不套证券页数；合计全量，翻页焦点新页首行|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-42 / [正文:395](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:395)–431|无；文本 HOME-HP05-B027|[contribution-current-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-current-a-share.svg)<br>[contribution-historical-a-share.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-historical-a-share.svg)|双模式记忆/详情返回|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献/导航|分别改分类排序页和下钻→切模式→详情返回|各模式独立保分类排序下钻页；返回恢复上下文/焦点；来源消失回标题|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-43 / [正文:416](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:416)–431|无；文本 HOME-HP05-B034|[contribution-loading.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-loading.svg)<br>[contribution-empty.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-empty.svg)<br>[contribution-error.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-error.svg)<br>[contribution-extreme.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/contribution-extreme.svg)|贡献等待/空/错误/极值|/root/integration_g61实现/数据接线；/root整体验收 / P4|贡献/数据状态|等待/无贡献/失败/大金额|保持工具区和布局；无结果≠真0≠缺输入；原因可查、重试保条件|`evidence/P4/` 三类证据待生成|NOT VERIFIED|
|HV25-44 / [正文:434](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:434)–453|无；文本 HOME-HP06-B018|[journeys-library-entry.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/journeys-library-entry.svg)|普通交易库入口|/root/integration_g61实现/数据接线；/root整体验收 / P1|导航 Module|导航进入普通交易库|无待复盘徽章；无queue参数；已应用范围到达即生效|`evidence/P1/` 三类证据待生成|NOT VERIFIED|
|HV25-45 / [正文:434](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:434)–464|无；文本 HOME-HP06-B018|[hcr06-final-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/hcr06-final-return.svg)<br>[library-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/library-return.svg)|日期/证券入口与范围|/root/integration_g61实现/数据接线；/root整体验收 / P1/P2/P3/P4|导航+交易库接线|点日期/查看交易→核对到达结果|日期按成交日含未平仓；证券真实完整身份；市场账户明确，不默认为首条|`evidence/P1-P2-P3-P4/` 三类证据待生成|NOT VERIFIED|
|HV25-46 / [正文:454](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:454)–464|无；文本 HOME-HP06-B016|[hcr06-final-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/hcr06-final-return.svg)<br>[library-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/library-return.svg)|返回全部来源状态|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3/P4|导航+完整数据流|关闭详情/交易库返回/刷新后再返回|重读数据，恢复期间/历史/账户/筛选/持仓/贡献双模式/滚动/焦点；对象消失仅回标题|`evidence/P1-P3-P4/` 三类证据待生成|NOT VERIFIED|
|HV25-47 / [正文:467](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:467)–494|无；文本 HOME-HP09-B001|[loading.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/loading.svg)<br>[loading--stale-data.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/loading--stale-data.svg)|首次骨架/后台更新|/root/integration_g61实现/数据接线；/root整体验收 / 每片/P5|提交快照+整页视觉|冷启动与已有数据刷新|骨架最终几何；后台保整组旧数据与旧标签，不能变成混合范围|`evidence/每片-P5/` 三类证据待生成|NOT VERIFIED|
|HV25-48 / [正文:467](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:467)–494|无；文本 HOME-HP09-B001|[error.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/error.svg)<br>[error--update-failure.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/error--update-failure.svg)<br>[repair.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/repair.svg)|冷失败/更新失败/唯一修复|/root/integration_g61实现/数据接线；/root整体验收 / 每片/P5|数据状态/修复接线|失败→修复→重复点击→成功/部分失败|只一个全局一键修复；处理中防重；成功共同刷新，部分失败理由；不伪0|`evidence/每片-P5/` 三类证据待生成|NOT VERIFIED|
|HV25-49 / [正文:495](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:495)–502|无；文本 HOME-HP09-B028|[error--update-failure.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/error--update-failure.svg)|竞态/旧响应/超时/重试|/root/integration_g61实现/数据接线；/root整体验收 / 每片/P5|提交快照 Module|快速A→HK→US，乱序返回；15秒超时重试|generation+scope key双匹配；忽略取消旧结果；失败新范围未应用；重试新编号|`evidence/每片-P5/` 三类证据待生成|NOT VERIFIED|
|HV25-50 / [正文:503](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:503)–515|无；文本 HOME-HP09-B031|[search-motion-before-frame.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-motion-before-frame.svg)<br>[search-motion-during-frame.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-motion-during-frame.svg)<br>[search-motion-after-frame.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-motion-after-frame.svg)<br>[search-overlay-reduced-motion.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search-overlay-reduced-motion.svg)|动效中断/reduced motion|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3/P5|共享控件 Adapter|开关浮层/中断动画/开启减弱动效|160ms位移-4→0+透明；hover120ms；图fade150ms；无尺寸推进；减弱直接终态|`evidence/P1-P3-P5/` 三类证据待生成|NOT VERIFIED|
|HV25-51 / [正文:516](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:516)–549|无；文本 HOME-HP08-B001|[atoms.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/atoms.svg)<br>[visual-samples-board.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/visual-samples-board.svg)|12类/96状态|/root/integration_g61实现/数据接线；/root整体验收 / 每片/P5|共享控件 Adapter|按逐状态表执行真实控件行为|85适用逐项验证，11NA按原文理由；存在控件或缩略图不是PASS|`evidence/每片-P5/` 三类证据待生成|NOT VERIFIED|
|HV25-52 / [正文:550](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:550)–568|无；文本 HOME-HP10-B001|[home-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)<br>[home-1280.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1280.svg)|独立三类接受|/root/integration_g61实现/数据接线；/root整体验收 / P5|主协调者|完整旅程/受影响页面/真实持久化回归|功能、状态持久化、视觉分别通过；版本与隔离数据绑定；全页控件分母明确|`evidence/P5/` 三类证据待生成|NOT VERIFIED|
|HV25-53 / [正文:646](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:646)–668|无；文本 HOME-HP10-B101|[journeys-library-entry.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/journeys-library-entry.svg)<br>[library-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/library-return.svg)|URL直达/刷新/非法值|/root/integration_g61实现/数据接线；/root整体验收 / P1|导航 Module|复制URL直达与刷新，输入非法参数|/home及/trades；URL权威；显式accounts/市场/日期/symbolIdentity；非法提示且不静默扩大|`evidence/P1/` 三类证据待生成|NOT VERIFIED|
|HV25-54 / [正文:42](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:42)–75|无；文本 HOME-HP11-B001|[home-1440.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)|整页+round4/round5局部规范共同作用|/root/integration_g61实现/数据接线；/root整体验收 / P0–P5|整页视觉/共享控件|对照整页与批准的局部控件/曲线原型|最新局部控件不覆盖整页顺序；原型详情stub不替代真实容器|`evidence/P0–P5/` 三类证据待生成|NOT VERIFIED|
|HV25-55 / [正文:432](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:432)–464|无；文本 HOME-HP06-B018|[journeys-library-entry.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/journeys-library-entry.svg)<br>[library-return.svg](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/library-return.svg)|必要交易库接线/非完整改版|/root/integration_g61实现/数据接线；/root整体验收 / P1/P3/P4|完整数据流/导航|到达→真实交易→已有复盘保存→返回重开|来源条件立即应用，成交列表/平仓统计日期分离；不趁接线扩大模拟配对和统计改版|`evidence/P1-P3-P4/` 三类证据待生成|NOT VERIFIED|

## 必要交易库引用

HV25-45/46/53/55 同时受[交易库 V1.0 BT01/BT03/BT04/BT06/BT07](../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md)约束，特别是成交日期包含未平仓、到达即应用、来源范围只读摘要和逐层返回。准确参考为 [journeys-date.svg](../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/journeys-date.svg)、[handoff.svg](../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/handoff.svg)、[library-return.svg](../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/images/library-return.svg)。不据此把库内练习配对/全部统计/全页视觉改版加入本期。

## 派发前必须补齐

- 将本表合并展示的图点鼠标/键盘、表格数据边界、筛选草稿/成功/失败等拆成可单独判定的状态与旅程；补实际控制实例和条件入口分母。
- 读取精确参考图片及原型，正式分配整页视觉 owner 和完整数据流 owner；每条实现票只拥有有限文件且交付完整行为。
- 给所有适用控件状态绑定真实产品路径及证据，按版本固定清单。旧 metadata 的 integration-assets 路径需要在派发引用中映射到当前包，不能自行篡改历史或把尚未接受的资产记作通过。
- 功能、状态/持久化、独立视觉接受分别记录。全页验收不得留必需项 NOT VERIFIED；本轮表格的 NOT VERIFIED 是评估范围说明，不是已交付产品的豁免。

2026-10-23 01:43 CST：行情完成时段回归重开。root独立复制并运行真实entries→F→P1探针，US/CN-SH/HK共3/3 RED；US 17:30Z误选当日未完成日线，CN/HK 08:30Z漏选当日已完成日线。根因quoteFor用上海日替代交易所完成时段。原F恢复1/2轮PASS及原始证据保留，仅行情边界及其金额依赖重开；当前fixing，已用恢复2/3，implementation-ready后正式第3轮。授权同owner仅F源码/同名测试复用既有完成时段规则；不能修改共享日历/账本或用adapter绕过。证据：evidence/resume-2026-10-23/coordinator/F-session-cutoff-red.log及同前缀3份JSON。P1仍0/3，F依赖金额尚未放行。


2026-10-23 01:58 CST：P1第1/3轮独立接受FAIL。真实末页持仓→详情→准确普通交易库→重读返回来源UI通过；详情四核心指标卡视觉结构缺失、Esc/关闭焦点BODY、已知值误带缺失title、空态下一步缺失，以及broad metadata官方exchange校验旁路均交回原owner；3个Workspace回归先诊断再修。真实保存/reload/guard、完整控件与窄屏仍NOT VERIFIED。详见evidence/P1/acceptance-1.md；P2–P4产品仍BLOCKED。


2026-10-23 01:59 CST：F恢复第3/3轮纯合同独立接受PASS，session source e91dce9cdddf83137370ef44647dda260336b03bd49b5082d201352664f762b0。root 19文件352测试PASS、严格依赖范围tsc与lint exit0；原三RED的新标签真实管线GREEN并断言净UF，81冻结文件hash不变。旧14FAIL及fixture校准全过程保留。允许P1消费当前指标；P1仍1/3 FAIL，P2–P4仍等待首次UI门槛。日批量/归因/视觉/持久化不在F此接受范围。详见evidence/resume-2026-10-23/F-fix/acceptance-3.md。


2026-10-23 02:36 CST：P1第二候选仍在root独立验收。02:29签署有限依赖门（evidence/P1/acceptance-2/DEPENDENCY-GATE.md）：首条真实持仓→详情→普通库→重读返回及1440/1280首张布局通过，非P1整票通过。已明确派发P2-A纯批量投影（financial_g61，合同SHA a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a）与S同票恢复第2轮v3/日期/请求purpose；P2页面/P3/P4产品仍未派发。root完整Workspace回归95项为50 PASS/45 FAIL，日志evidence/P1/acceptance-2/verification/workspace-all.log，已交原owner先只读分类根因；不声称全量通过。02:31后F、02:32后S正获授权开发，后续浏览器HMR状态不得冒充freeze2证据；先前截图与有限门保留原版本效力，剩余UI验收等待消费合同重新冻结。真实保存/reload/guard、96状态及窄屏仍NOT VERIFIED。P4来源政策另见evidence/P2/data/P4-COORDINATOR-PROVENANCE-DECISION.md：无可信处置链接不默认pro-rata，未知保持未知。

2026-10-23 02:40 CST：P1正式第2/3轮FAIL（evidence/P1/acceptance-2.md）。45项Workspace回归逐项诊断已保存；首条真实普通库往返与两宽首张布局仅有限PASS，真实Recall草稿入库有正证据但reload/冲突/完整控件与视觉仍NOT VERIFIED。全页未接受，公共96状态分母保持。原owner准备第3候选，不能重置轮数。

2026-10-23 02:48 CST：S v3纯合同恢复第2/3轮root独立PASS（135测试+16独立反例，tsc/lint0，精确hash一致）；见evidence/resume-2026-10-23/S-fix/acceptance-2.md。host/session旧URL三FAIL仍保留并由integration接线；全部产品门槛未自动通过。

2026-10-23 03:05 CST：root按P1已验证首条往返/两宽首张画面及已接受S3的有限依赖门，派发P3首条搜索→无持仓详情→普通库→返回切片，见evidence/P3/ROOT-DISPATCH.md。P1仍正式第2轮FAIL，P3仍0/3；扩大附件前须独立验收首条搜索旅程。P2-A三次1866成交×365端点冷样本数值全部PASS，但耗时2945.84/2938.31/2913.29ms超过2秒；原失败/profile保留，正按根因有限优化，尚未接受或接入页面。P4财务定义已由ROOT-FINANCIAL-DECISIONS.md裁定，仅只读seam提案获授权，产品尚未派发。完整持久化/控件/视觉继续NOT VERIFIED。


2026-10-23 03:19 CST：P2-A性能诊断已达到批准的有限修复尝试上限，4产品文件冻结，状态 performance-discussion-required，非 implementation-ready。单证券1866×365三次冷1232.22/1204.75/1232.80ms、重复1.89/2.24/1.29ms及365字面数值PASS；但同规模3账户/3市场场景冷2972.63ms、重复2951.56/3016.77/3024.79ms FAIL，完整结果超过64MiB无法入缓存。不能用单证券成绩覆盖该失败；保持64MiB/完整公开字段合同，先只读审查结构共享/内部紧凑缓存架构，未经讨论不继续补丁、不接入P2页面。P2正式0/3，P1仍2/3 FAIL，P3首条搜索切片进行中。root独立12财务字面反例与3现金回归PASS；workspace lint exit0（0 errors/10既有warnings），仅局部证据。P2-B仅一页准备稿（evidence/P2/data/p2-b/PREPARATION.md），无产品授权。

间歇请求体overlay诊断保持OPEN：evidence/P1/round3/ROOT-REQUEST-BODY-DIAGNOSIS.md。确定性适配器探针证明已消费/锁定的非GET Request可触发同栈，但实际上游消费者尚未定位；实际重载/重开局部成功不能证明全程无故障，loading截图也不是overlay截图。原始失败与工件局限明确保留，不实施猜测性框架修复。

2026-10-23 03:23 CST：P3 owned数据接线引入direct /trades空集合回归。root冻结UI全重载仍0标的/0回合，DB数据未丢；根因初次trades路由未执行owned read。见evidence/P1/round3/ROOT-DIRECT-TRADES-DIAGNOSIS.md。原owner先建RED，不以外部最新bundle旁路。双窗口409验收中断作废；recall-conflict-409.png实际是HMR附近错误证券，不是409正证据。Tab3真实seed保存rev1→2局部成立，但完整冲突/失败恢复仍NOT VERIFIED。P1第2轮FAIL及所有旧证据保留；当前未启动正式第3轮。
## 2026-10-23 04:16 CST — 搜索 CR01 / CR02 有限恢复派发

此追加表覆盖下方原矩阵相应行的本次有限文件 owner；不改变55项需求、96状态或 P3 正式0/3。root 已读正文130–160、搜索与错误参考渲染；原 Surface `914f13c9…` / CSS `d34b54ab…` 上两反例均真实 FAIL。先独立 RED，产品授权待 root 导航浏览器检查结束；不得与 host 候选同时改产品。

|需求 / elementID / 原文|准确参考（相对于原稿 source/images）|阶段/控件/旅程|实现 owner 与集成 owner|可观察合同与证据|当前结论|
|---|---|---|---|---|---|
|HV25-07/08/09；HOME-HP03-B019；正文130–160，关闭搜索与来源保留|`search.svg`、`search-detail.svg`、`search-motion.svg`|CR01：ready 搜索6→非零结果滚动→关闭→重开；同时覆盖详情返回与 restoreKey 不变|`/root/state_g61` 仅 Surface 与新增独立测试；`/root`整页视觉、完整数据流、实际浏览器独立接受|同次挂载保 query/选中身份/非零scrollTop/输入焦点；不回写旧来源；960舞台及独立结果滚动预算不变。原失败 `evidence/P3/control-review/root/scroll-before.*` / `scroll-reopen.*`；新 RED/GREEN/manifest 在 `evidence/P3/search-recovery-fix/`|原真实 FAIL；候选 NV|
|HV25-07/08/09；HOME-HP03-B019；正文137–160、467–502；manual431–435、446–454|`search.svg`、`search--empty.svg`（错误）、`search-error-frame.svg`；`search--detail.svg`为无结果|CR02：已有结果→!ready/global pending/global error/accountStatus error→Enter；恢复ready再Enter；composition保持原规则|同上；host/session/S/目录/CSS/Workspace不在此授权写入范围|仅当前可见且可选结果可打开详情；加载/错误Enter不得改变detail/selected/source；清除、重试、正常Enter仍可用。原真实错误态 FAIL：`evidence/P3/control-review/root/enter-error-before.*` / `enter-error-after.*`；pending等分支真实NV|错误态真实 FAIL；其余及修复后 NV|

前端审计触发：搜索控件与状态接线改变；有限清单见 `evidence/P3/control-review/ROOT-BROWSER-CHECKLIST.md`，整页完整分母仍保留。root 负责实际鼠标/键盘、前后/同态截图与几何；模拟/物理触控分开保留NV。参考比较使用实际CSS viewport，不以截图像素推断。不得修改既有测试断言、清空来源或关闭搜索来绕过反例。

## 2026-10-23 04:26 CST — NR-PEER-01 绝对请求截止时间

HV25-47..49、HP09 的“超过15秒转手动恢复”对应正文第467–501行、尤其501；参考 `images/error--update-failure.svg` 与 `loading--stale-data.svg`。owner financial_g61 临时独占 host 的 timer 生命周期及新增 navigation-deadline.test.tsx，root拥有完整数据流/视觉与独立接受。正常pending标题/旧完整bundle、失败后来源字节、手动retry目的、identity新generation必须保持原合同。

独立5项实际因果探针：t0读→t10s onUi→t15.01s仍pending、以及连续onUi推迟原deadline均RED；无onUi按期及identity B自有窗口正例PASS（合计2FAIL/3PASS）。先固定原RED、再仅一候选使计时按请求startedAt而非UI对象clone重新开始；generation换代取消旧timer，新请求有自己的完整窗口。不得改变S纯合同、原测试、15秒预算、sourceRecovery权威或业务数据。浏览器与功能/状态/视觉门由root后续独立执行；本有限修复不更名/重置P1，第3正式接受仍未启动。



## 2026-10-23 04:39 CST — 搜索错误状态视觉 CR03（原 P3 同票）

root 直接对照当前实际 `evidence/P3/search-recovery-fix/root-http503-after-keys.png` 与已批准 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/search--empty.svg`（1100×690）及 `search-error-frame.svg`（1100×820，带说明框），明确 FAIL：错误白字/重试位于结果区左上，原稿为居中错误色提示及88×36描边重试。Surface c6e14890… / CSS d34b54ab… 的功能检查不抵消该差距。P3正式0/3，P1正式2/3 FAIL保持，未开始新正式轮次。

|需求/elementID/准确规格|准确参考|状态/旅程|owner与范围|预期及证据|当前|
|---|---|---|---|---|---|
|HV25-08；HOME-HP03-B019，无原elementID；正文130–160，manual370–455的加载/错误/恢复规则|上述精确两SVG的GlobalEntitySearch第三组；直接已看派生reference-readback/search-error-frame.png|真实目录读取503→输入保持→重试→恢复可选结果；另核loading/empty不混同|state_g61仅home-surface.tsx的搜索失败markup及home-surface.css局部错误样式；root唯一浏览器、整页视觉及完整数据流负责人|舞台960/两侧24、输入结果锚点/滚动不变；错误提示在结果区按参考居中，error token；重试88×36/6px圆角/描边；保查询/错误原因/键盘不可选隐藏结果；实际1280×720 DPR2先对照，不声称其他断点。证据evidence/P3/search-error-visual/，原失败不覆盖|视觉FAIL；修后NV|

仅授权一个有限视觉候选；不得改host、S、session、目录、Workspace、依赖、既有测试或数据库，不添加假loading/假网络/新业务状态。已验证搜索键盘与恢复测试作为受保护回归。无新业务写入，数据库写入门对该局部修复NOT APPLICABLE；实际导航/查询恢复/重试及独立视觉仍适用。无用户授权设计差异。原四区附件和P2/P4仍未放行。


## 2026-10-23 04:51 CST — CR03及受影响旅程独立结论

沿04:39同票派发矩阵，HV25-08 / HOME-HP03-B019错误态：Surface84897ee2… / CSSb7160f10…；root真实503与原稿同态直接看图及DOM测量，1280×720 DPR2下居中提示#FF8592、88×36描边重试及键盘焦点有限PASS；错误原因/查询保留，503恢复后准确Enter与1440关闭重开、原生鼠标详情来源返回有限PASS。功能、状态恢复、视觉分别记录在 `evidence/P3/search-error-visual/ROOT-CHECKPOINT.md` 的版本绑定控制表；77定向测试与源码manifest另存，测试不能替代视觉。原CR01/02/03 FAIL证据不删。整浮层高度/说明行数与参考仍有记录边界，未宣称全像素一致；完整96状态/四区附件/响应式/触控仍NOT VERIFIED，无新增设计豁免。P3正式0/3、P1正式2/3 FAIL保持，P2/P4依赖未解除。


## 最新继续指令

用户要求修复后继续GPT6.1 SOL / Ultra并行开发至完成。root选择此前推荐的64MiB不可变对象共享有界实验，准确派发/元素/owner/证据与依赖见 [CONTINUE-2026-10-23.md](CONTINUE-2026-10-23.md)。既有FAIL/NV及正式轮数保持。P2此前等待架构讨论的状态由本次明确选择更新为候选开发中，尚未接受。

2026-10-23 05:13 CST：root显式调整纯新文件开发顺序，准许P2-B series消费冻结A的有限正确性接口（root F141/141、完整public/365 oracle），A性能FAIL不豁免，未接受A、不释放UI/P4、不改变正式轮数。见 `evidence/P2/data/p2-b/ROOT-DISPATCH.md`。

2026-10-23 05:20 CST: P1 third-candidate shell CSS ownership assigned to /root/responsive_shell (gpt-6.1-sol / ultra), bounded matrix and reference/journey/gates in evidence/P1/round3/responsive-shell/ROOT-DISPATCH.md. Root retains whole-page visual/data/independent acceptance. HV25-03/06 only; no scope/round reset or product PASS.

## 2026-10-23 — 历史A组合受控leaf提前准备

HV25-33/34 / HOME-HP05-B001（原正文349–394，manual103/107；准确原图source/images/journeys-year.svg、history-stats-cumulative.svg、history-stats-win.svg、history-stats-rounds.svg、history-stats-error.svg）的**范围/指标选择交互子范围**owner为/root/responsive_shell；root为整页视觉、完整数据流、独立接受。详见evidence/continue-2026-10-23/ROOT-HISTORY-CONTROLS-DISPATCH.md。普通/范围菜单、四指标、pending旧范围、失败重试、键盘取消、空选项与窄屏/长范围都必须登记。历史/贡献金额原子接线和完整页面仍NOT VERIFIED；P4正式0/3不变，不释放性能/图表依赖。无授权设计差异；旧FAIL保留。root已看准确派生图history-year-reference.png，不以旧三选择器截图代替A组合。


## 2026-10-23 07:03 CST — Four KPI controlled leaf preparation

Root development-order ruling and complete dispatch: [KPI leaf](evidence/P2/metrics/ROOT-DISPATCH.md). This is new readonly presentation preparation, not P2/A acceptance or a fourth performance fix. Actual owner `/root/metric_cards` gpt-6.1-sol/ultra; root owns whole-page visual consistency, all data/persistence wiring and independent browser/visual acceptance. P1 2/3 FAIL, P2/P3/P4 0/3, original55 requirements and96 states remain.

|Requirements / element / exact spec|Exact reference|States and journey / owner|Observable contract and evidence|Status|
|---|---|---|---|---|
|HV25-14/15/16 / HOME-HP02-B001 (text, no separate element); HP02:191–221; manual611–698|source/images/home-1440.svg, home-1280.svg, atom-metric.svg; root directly viewed derived original reference before dispatch|M01–04 four values/details; M05–06 Enter/Space/Esc/outside/focus; metric_cards controlled3files only|4cards88high,labels14/20,value28/34,periodSummary net/periodRealized/unrealizedChange; independent current MV; original precision/coverage/FX sources in detail. evidence/P2/metrics/|NOT VERIFIED|
|Same plus HP09:467–549 / Metric eight states|source/images/loading--stale-data.svg,error--update-failure.svg,atom-metric.svg|M07–14 pending/firstload/empty/missing/future/error/sign/zero/long values/period-current independence; same owner/root|Last committed bundle preserved; never new dates with old values; no fake0, financial recalculation or data request; pressed/disabled originalNA; no next-step in empty|NOT VERIFIED|
|Same globalHP01:42–75 and Metric manual|home-1440.svg,home-1280.svg,atom-metric.svg|M15–18 widths1440/1280/390 and derived breakpoint sides,hover120ms,focus2px,reduced motion,frozen input; root real browser/visual|4 equal desktop cards12gap, local responsive reading order/card88 maintained; full details readable; no whole-page caller released; physical touch distinct|NOT VERIFIED|

Frontend audit trigger: new controls/readout layout. Registry M01–18 expands four metric-key instances × applicable states; synthetic tests are not real action coverage. Leaf no IO means DB writes N/A, while actual page state/persistence/financial/visual gates remain applicable and unaccepted. No user-authorized design deviation.


## 2026-10-23 07:07 CST — controlled contribution-bar preparation

HV25-36–42 / HOME-HP05-B027 map to original HP05:395–431 and the exact contribution SVG state set in [root dispatch](evidence/P4/bars/ROOT-DISPATCH.md). Owner /root/contribution_bars, actual gpt-6.1-sol / ultra; root visual/data/persistence/independent acceptance owner. Scope is supplied signed rows and exact identity activation only; no finance, host, toolbar, attribution or P4 page release. CB01–15 registry and original references/acceptance evidence obligations are in dispatch. Root viewed current-a-share and mixed-sign references before dispatch. Leaf0/3; P4 formal0/3. Functional browser/visual NOT VERIFIED; no-IO leaf DB writes NA by scope, feature persistence still required. A freeze and cap unchanged.

Metric dispatch clarification: reportCurrency is the displayed report context. A metric with different money.targetCurrency is shown as — with explicit mismatch reason, retaining exact original/target currency evidence; no relabeling, conversion or financial requalification. Root sent ruling before implementation completion; [metrics dispatch](evidence/P2/metrics/ROOT-DISPATCH.md).

## 2026-10-23 bounded ETF existing-test migration

|ID|Exact reference|Owner|Journey / evidence|Boundary|
|---|---|---|---|---|
|ETF-T1|visual-design.candidate.md HP01:115–175 / HP03:257–314; images/filter.svg / holding-return--detail.svg; source trusted metadata contract|attachment_review, GPT-6.1 SOL / ultra; independent root|explicit-live trusted ETF→draft checkbox→apply→token/row/category detail; stock/unknown negative; evidence/continue-2026-10-23/workspace-etf-migration|Only stale selector+local fixture migration. Full return obligations retained in unchanged failing test; no production/finance changes. Real browser and whole feature NV.|

## 2026-10-23 贡献bars候选2同票修复覆盖

CB-M01→HV25-36–42/HOME-HP05-B027与全局467–549：原readonly来源详情/上下文失效旅程，由原contribution_bars owner修复，root原独立反例+实际外部焦点/币种返回验收；CB-M02→全局失败色与原contribution-error.svg：#FF8592实际计算色/错误保留截图；CB-M03→原contribution-current-a-share.svg、contribution-mixed-sign-demo.svg连续零线：root1280/1440对图、735边界与390 fallback。原ROOT-DISPATCH精确源与owner不变，新增验收记录ROOT-ACCEPTANCE-1.md，轮数1/3FAIL。仅原三leaf文件，不放行P4金融或host。

## 2026-10-23 07:49 CST — shared update-state regression reopened
MC-M03 and CB-M04 map exact original source visual-design.candidate.md469/471/476 plus shared samples/manual; owner metrics_candidate2 and contribution_bars, coordinator root. Journey: existing valid values→background update→retained old values with blue update text; initial placeholders remain gray-blue. Actual390 computed evidence under continue-2026-10-23/metrics-candidate2-pending-color-390.txt and bars-candidate2-pending-390.txt; same task formal2/3 FAIL each; final bounded candidate3 dispatches under respective directories. Financial owner/data path remains A-frozen, no host consumer release. Screenshot/DOM viewport mismatch artifacts retained but excluded from visual PASS.

## 2026-10-23 10:26 CST — A恢复同任务

|需求/准确规格与元素|参考与状态|owner/交付/旅程|反例与证据|状态|
|---|---|---|---|---|
|HV25-14..22/47..49；HP02:193–252、HP09:467–518；HOME-HP02-B001文本，无独立elementID|source/images/period.svg、chart-gap.svg、chart-hover.svg；历史端点/current/未来/休市/缺FX|finance_calendar_resume仅performance源/测试；root完整数据流/独立接受；actual entries→A→B|future-onlyHKD不能污染USD合法历史/current；真正eligibleHKD缺FX仍未知；原1866×365三形态/3冷样本/完整public等价。evidence/P2/data/calendar-resume/|恢复0/3，原FAIL保留；UI NV|

## 2026-10-23 历史独立模块派发前映射

HV25-32/33/35/47–51、HOME-HP05-B001/HP09-B001/B031（原稿无稳定elementID）准确对应HP05:349–394、HP09:467–515和history原始8SVG、公共A/B样例。历史四卡owner /root/metrics_candidate2，模型gpt-6.1-sol/ultra；仅新history-stats-cards三文件，旅程/全部HS01–15/边界和证据在 [准确派发](evidence/P4/history-stats/ROOT-DISPATCH.md)。root已直接看8参考，负责整页视觉、完整跨层数据及独立接受。待旧卡候选3冻结后发工，当前leaf0/3、全部NV，P4仍0/3，不提前放行金融/host。

HV25-33/34/35/47–51同原块准确对应history、cumulative/win/round/empty/error/missing/extreme/journeys-year原图及round5历史原型；新历史四模式leaf仅新history-chart三文件，HC01–15、输入knownness/模式/读数/固定geometry/证据在 [预备派发](evidence/P4/history-chart/ROOT-DISPATCH.md)。root实际读图并独立接受；实施owner待root命名后追加，未开始不冒充已派发。leaf0/3、全部NV，无授权设计差异，现有current图FAIL保留。

2026-10-23 10:40 CST：历史四指标受控叶子正式派发 /root/metrics_candidate2；历史四模式图表受控叶子正式派发 /root/contribution_bars，准确依据与HS01–15/HC01–15逐项证据分别见各自 ROOT-DISPATCH.md。两者只新增独立三文件；旧指标卡和贡献图候选3冻结由root独立验收。两个新叶子0/3，原旧计数不变。root继续统一整页视觉、完整财务/持久化流；不以新叶子掩盖旧FAIL或NV。

## 2026-10-23 — P4只读事实seam正式派发

HP05:349–432 / HV25-32..46 / HOME-HP05-B001/B002及HP02/HP09财务共性 → SF01..SF08逐项映射见evidence/P4/seam/ROOT-DISPATCH.md；exact原规格、参考、owner、真实数据journey与独立证据要求在该唯一派发。Owner finance_calendar_resume，gpt-6.1-sol/ultra；root完整数据流/整页视觉/独立接受。只读canonical+F facts四文件，UI/DB写范围NA，P4整票0/3；不重置A已显式恢复1/3 PASS，后续扩展需重新回归。
# 2026-10-23 新增三域host能力（0/3；旧FAIL不重置）

|需求/精确规格|elementID|参考|状态/owner/交付|旅程/反例|证据/状态|
|---|---|---|---|---|---|
|HV25-14..22；HP02:193–252|HOME-HP02-B001/B020/B024|source/images/period.svg、loading--stale-data.svg、error--update-failure.svg|period pending/error/accepted；metrics_candidate2；session/host|P/H并发，P只换本域opaque完整包+日期；不改当前市值/持仓/H，晚响应不提交|evidence/P2/domain-host/ROOT-DISPATCH.md；NV|
|HV25-33..43；HP05:349–432|HOME-HP05-B001|source/images/journeys-year.svg、history-stats-error.svg|history pending/error/accepted；同owner|H三部分一组换且保留贡献mode，取消/超时不动旧包；独立deadline|同上；NV|
|HV25-44..49/53/55；HP06:434–465、HP09:467–515|HOME-HP06-B018/B016、HOME-HP09-B001/B028|source/images/library-return.svg、loading--stale-data.svg|global source/collection compatibility；同owner，root集成|global使旧域失效；owned-only callback、UI-only来源恢复、普通库不继承附加范围|同上；NV，旧P1失败不变|

## 2026-10-24 Astra 续推 owner 变更

用户授权新 Astra 并行设计/修复及必要重构。所有需求/元素/原图/旅程仍按下文原矩阵与 `evidence/P4/ROOT-DATA-CONTRACT.md`；仅 owner 移交为 astra_finance（seam最后候选）、astra_source（S1首候选）、astra_integration_design（只读整合设计）。确切写面/证据/原轮次见 [ASTRA-CONTINUE-2026-10-24.md](ASTRA-CONTINUE-2026-10-24.md)。root独立接受，不改变暂停项或视觉预算。


## 2026-10-24 S1 qualification regression

HV25-06..22/47..51, HP02/HP03/HP09 and original S1 reference set remain; astra_finance owns the bounded qualifier repair, root owns data flow and acceptance. Exact write set, journey, F01–F08 counterexamples and initial-assembly exclusion: [dispatch](evidence/resume-2026-10-24/source/qualifier-repair/ROOT-DISPATCH.md). S1 reopened after 1/3 PASS; next formal round 2/3, old evidence retained. No numeric authority or design deviation.

### 2026-10-24 stored representation implementation
HV25-06..31/47..51/53 and exact HOME anchors/reference images/journeys are mapped in evidence/resume-2026-10-24/representation-design/DESIGN.md section9, read before dispatch. Owner astra_integration_design, Astra ultra; root integrated data/visual/acceptance. Four-file stage A approved in ROOT-DISPATCH.md; R01–R15 required; 0/3. No UI deviation or financial authority replacement; history only dependency, Bars3/3 remains paused. UI/DB write NA for pure module only; full page gates remain.

## 2026-10-24 canonical catalog repair dispatch

Owner `/root/astra_source` (Astra ultra), root独立集成、全页视觉与完整数据流。设计/根因 `evidence/resume-2026-10-24/source/astra/workspace-design/catalog-diagnosis/ROOT-CAUSE-AND-WRITESET.md` 方案B，精确6文件 catalog-model / home-surface / trade-review-workspace 各源码与测试。HV25-10 / HOME-HP03-B019 对应正文130–160及search.svg/search-detail.svg；HV25-45 / HOME-HP06-B018 对应434–464及detail.svg/library-return.svg/hcr06-final-return.svg。旅程：raw00700→summary700→目录完整可导航身份→搜索/持仓详情共同目标→普通库准确原成交→返回原状态/焦点。保留raw IDs/类别未知，隔离交易所/类别/币种冲突，不改财务/DB/CSS。先literal RED，最终冻结后root真实UI、准确fill与隔离库返回/reload、匹配视口视觉；当前FAIL/NV，不增加P1轮次预算。

## 2026-10-24 F07 and inventory chronology dispatch

HV25-14..22/47..51, HP02/HP03/HP09 and necessary HP06 flow map to original exact refs in F07-UNIFIED-DESIGN.md §8.1 / UI01–11; phase/cutoff/viewport §8.2 unchanged. Owner astra_finance (Astra ultra), root complete data/persistence flow, whole-page consistency and independent acceptance. [Exact authorized manifest and gates](evidence/resume-2026-10-24/source/qualifier-repair/F07-ROOT-IMPLEMENTATION-DISPATCH.md). R15/48-case chronology evidence is financial unknown propagation, not new UI design. Required journeys raw→library→real chart→Recall→explicit fee revision→return/reload; initial minimal real-chart gate before dependent expansion. F07 original P1 2/3 FAIL, representation1/3 FAIL; all UI/persistence/visual gates NOT VERIFIED until fresh root evidence. Bars3/3 paused.


## 2026-10-24 — Period UI final design decision, implementation still gated

Root accepted bounded PeriodSurface + existing header status slot, including the explicit ≤900 meaningful asOf/status row adaptation; [decision](evidence/resume-2026-10-24/period-ui-final-design/ROOT-DESIGN-DECISION.md). Exact HV25/element/reference/control/owner mappings and the12-file manifest are [DESIGN §§7–9](evidence/resume-2026-10-24/period-ui-final-design/DESIGN.md). `/root/astra_source` is the sole future Workspace/UI implementer; root owns whole-page visual consistency and persistence acceptance. Disabled-trigger closure focuses the stable period heading. No product release before representation/ledger acceptance; no round reset, no Bars fourth attempt, no UI PASS inferred from this design.

### F07 actual-route dependency correction (2026-10-24)

Root verified persisted instruments route to RecallWorkspace, not legacy demo ReviewChartWorkspace. The minimal first real slice now includes already-designed P13 display-only nullable/gross-cost adapters; controller/phase/cutoff/viewport unchanged. P14 remains gated. Evidence: `evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/ROOT-ACTUAL-ROUTE-DECISION.md`. UI03–07 remain NOT VERIFIED; no round reset.


## 2026-10-24 — representation stage A independently accepted 2/3

Root fresh 135/135 representation and 48/48 chronology controls PASS; strict/lint exit0 and four frozen file hashes match. Additional bounded finance regression 619 PASS / 4 external sample tests SKIPPED, 29 stage hashes unchanged. Prior R15 FAIL preserved. [Root acceptance](evidence/resume-2026-10-24/root-representation/ROOT-ACCEPTANCE-2.md). Stage B may proceed after the temporary browser probe is restored and ownership released. F07 real-chart, editor persistence, browser performance, final page integration and fidelity remain open; P1 2/3 FAIL and ContributionBars 3/3 FAIL paused are unchanged. Existing legacy statement-only chronology prefilter risk A01 remains separately OPEN; it is not the current homepage projection.

### 2026-10-24 bounded parallel implementation release

Exact probe restoration is verified; browser stage timing NV. [Root release](evidence/resume-2026-10-24/ROOT-PARALLEL-RELEASE.md) assigns Stage B's two Workspace files to astra_integration_design and A1's two S1 files to astra_source, both existing Astra ultra agents. All original HV25/element/reference/journey mappings above and representation-design §9 remain authoritative. Root owns whole-page consistency and end-to-end persistence. Source's later Period UI ownership is gated on Stage B freeze. S1 next 3/3, P1 next 3/3; no resets, no Bars fourth patch. Required browser, financial and visual gates remain open.


## 2026-10-24 — scoped real-chart gate and parallel release

Root independently verified known fee1/cumulative net−1 → unknown on actual sell reveal → known on rewind; plan/Text/snapshot return and explicit reload/reopen evidence09–23 is retained. Stage B323/323 checkpoint accepted. [Exact root release](evidence/resume-2026-10-24/ROOT-DEPENDENCY-RELEASE.md) releases Period UI to astra_source and original P14 two-file editor to astra_finance, both actual Astra ultra. Root owns integrated visual/persistence gates; existing reference/element inventories remain authoritative. No formal counter reset or full UI acceptance. Old JSON failure OPEN; F07/P1 last candidate, Bars3/3 paused. Final financial/performance/real-edit/fidelity gates remain open.


## 2026-10-24 — 旧留存来源统一修复

HV25-55 邻接 F07 UI06/07/08/10/11、E04/E07/E09/E14/E15/E19/E20/E22 的 RS01–06/08 逐项原规格/图/owner/旅程/证据映射见 [派发](evidence/resume-2026-10-24/source/qualifier-repair/F07-acceptance/retained-summary-diagnosis/ROOT-DISPATCH.md)。astra_finance仅五文件，root全数据流及视觉独立接受；实际44同屏混源FAIL保留。原F07/P1 **2/3 FAIL**，最后候选不重置。兼容Markdown旧缺口独立OPEN，不声称全部导出通过。


### Recovery ownership unified implementation (2026-10-24)

Existing Period/header recovery rows retain their original specs, owners and evidence gates. Root approved the independently reviewed two-file ownership correction: [dispatch](evidence/resume-2026-10-24/period-ui-final-design/independent-review/ROOT-RECOVERY-DISPATCH.md). Actual request identity replaces predicted UI version arithmetic; user journey and visual design remain unchanged. Browser global timeout remains FAIL; full Period journey NOT VERIFIED. No acceptance budget resets.

## 2026-10-24 — 摘要编码候选与保留编辑会话复开

|范围 / 原合同|元素 / 参考|owner / 实际模型|旅程与接受证据|状态|
|---|---|---|---|---|
|首页真实原子来源完整性、原R14/S1/F/sourceId与金额合同；post-sample-design/DESIGN.md D01–10|无新增UI；沿用既定V2.5首页画板与全局恢复/期间/持仓入口|astra_finance，gpt-6-astra ultra；root独立接受|同步编码与完整字符串UTF-8等价；原golden/全部消费者、48+9与原阈值；最终真实首页不得超时；只改摘要引擎与两处私有grammar消费，不改ownership/金额/IO|设计待批准；真实首页FAIL保留|
|RS03/04/06；2026-09-19-review-workspace.md81/89–90/99；2026-09-25-chart-first-review-ui.md116–120/182/184–186/200/224|E02/E04/E07/E08/E14/E15/E19/E20/E22，D38；02-chart-workspace/04-holding-stage/05-final-review|astra_integration_design，gpt-6-astra ultra；root整页视觉及持久化接受|W Oct22→A→B→返回必须恢复W双截止/视野/Text；当前53–56实际返回Oct21FAIL。导航/dirty/异步capture须统一会话处理|来源子集PASS；会话FAIL /设计中|

## 2026-10-24 — bounded final-candidate dispatch

[Root exact dispatch](evidence/resume-2026-10-24/ROOT-BOUNDED-SESSION-AND-RECOVERY.md) authorizes the existing recovery two-file and retained-session two-file designs to separate Astra ultra owners, retaining every original spec/reference/element/journey mapping above and in the approved designs. Root owns complete flow/visual acceptance. Each gets one coherent implementation and one selected run; failure freezes, no counter reset. P1/F07 final third candidate; Bars3/3 paused. Finance is diagnostic-only pending CPU attribution, with no shared-digest implementation release. All affected UI gates remain FAIL/NOT VERIFIED pending independent evidence.
