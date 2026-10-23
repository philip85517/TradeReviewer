# 04 — 真实持仓经详情进入普通交易库并完整返回

ID: P1
State: open
Status: acceptance-failed
Assignee: /root/integration_g61
候选实现负责人: /root/integration_g61（gpt-6.1-sol / ultra）
集成、完整数据流与整页视觉独立接受负责人: /root
验收: 2/3，第1、2轮FAIL；第三轮仍FAIL或必需NOT VERIFIED则暂停同票，禁止改名重置。

2026-10-23 05:34 CST：root 读完 11 项只读诊断后裁定普通集合不依赖首页全 daily/FX 就绪，交唯一 Workspace/host owner 先 RED 修复等待链；见 `../evidence/continue-2026-10-23/ROOT-WORKSPACE-FIX-DISPATCH.md`。88 PASS/11 FAIL 保留；#10/#11 未实现的附件/期间恢复不靠标签/skip消除。此为同票第三候选准备，非正式第三轮接受。

2026-10-23 04:26 CST：root导航恢复有限真实复验及43项独立测试PASS，见 `evidence/P1/round3/navigation-recovery-fix/ROOT-CHECKPOINT.md`。仅NR04及失败/超时后手动恢复子旅程；正式仍2/3 FAIL，第三轮未启动。独立peer发现pending onUi推迟15秒deadline，新增5项因果探针2FAIL/3PASS，尚未修产品；原Recall/request-body与Workspace全量仍OPEN。

## Scope / What to build

实盘首页真实数据骨架→准确持仓行→详情→唯一查看交易→普通/trades集合（含期间未平仓成交）→返回/home恢复来源UI并重读数据。URL直达、刷新、后退与原离开保护都真实生效。固定八槽、C摘要、账户/市场、局部查询/排序/页/CSV是本旅程的实际控件，不能画成无效装饰。P1不接受P2/P4尚未实现的业务区，也不填假数据；整页最终仍由P5验收。

## Refs

- [55项精确矩阵](../DESIGN-COVERAGE.md)：P1涉及HV25-01..06、11..12的原子范围部分、23..30持仓、44..46、47..51适用数据/控件状态、53..55；HV25-21..22为P2曲线键盘与缺口，保留后续NOT VERIFIED。矩阵保留每项原文行号、manifest文本定位、准确参考图，不伪造原稿elementID。
- [视觉契约](../visual-contract.md)：1440×1000/1280×800、100%缩放；参考原稿home两宽1440/1280×2346；C方案两宽×642。DPR实测记录。具体48/40/48×8/48和列宽/颜色/字级/状态预算按契约。
- V2.5全文及current component manual；重点正文HP01/HP03/HP04/HP06/HP08/HP09/HP10/HP11与附录二；原图home-1440/home-1280、holding-option-C-normal/large-1440/1280、detail、holding-return及detail/after、account、count-boundaries、empty、local-search-pages、extreme。均在docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/。
- 普通库BT01/BT03/BT04/BT06/BT07：docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md；journeys-date.svg、handoff.svg、library-return.svg。仅必要接线，库内V1全面改版排除依据为用户已选范围。
- [P1逐操作登记](../evidence/A/P1-HOLDINGS-JOURNEY.md)、[96状态准确映射](../evidence/A/CONTROL-STATE-MAP.md)、[诊断与派发接口](../evidence/resume-2026-10-23/integration-debug/P1-DISPATCH-DRAFT.md)。旧Luna所有权说明为历史，以本票当前模型为准。先读原文/图，不能仅据摘要实现。

## Blocked by

- [02 — 快照与导航](02-state.md)：已恢复第1轮独立接受；消费冻结v2接口，不改S源。
- [03 — 原图与状态准备](03-assets.md)：已独立接受，仅准备Scope。

F 的恢复第2轮 current 净浮盈、市值与剩余费用纯合同已于01:27 CST独立接受。接线预审确认旧持仓浮盈不扣开仓费用，而批准的首页净口径需要扣除剩余开仓费用，因此P1消费该有限current接口，不新增第二套账本或用期间末浮盈代替当前浮盈。当前另在核查F行情选择与实际完成交易时段的一致性；未复现前不预判结论，若复现需重开F接受。P2/P4仍分别等待自己的依赖与派发。回放不新增，故新回放双游标/阶段门槛不适用；已有复盘/回放与离开保护必须回归。

## 验收标准与反例

- [ ] 原始entries明确live过滤，未被旧模拟SharedScope预过滤；各市场/显式账户/目标币种一致。unknown nature不默认为live；切换失败旧标签+旧数据，乱序旧响应不提交。
- [ ] 真实account+episode行及稳定identity，qtyKnown/costKnown/quote/FX缺失分别呈现。天数只可信startedAt上海日差，证据不足—。可信exchange+code/必要class身份；US/provider不冒充交易所。不同账户同证券可独立行，计数含义明确。
- [ ] 两指定桌面视口C摘要/工具栏、固定8槽、列宽和数字右边界符合原稿；0/1/5/8/9/50、极值/长名/未知不改高度。局部查询IME300ms、排序/分页/CSV在适用状态真实生效，全量导出精确值且formula-safe。
- [ ] 查询/排序/页/滚动非默认时，mouse与keyboard分别进入准确详情；外侧不关闭、焦点约束、Esc/关闭恢复行；行消失回标题并保留条件。
- [ ] 唯一“查看交易”进入普通/trades准确symbol集合，无queue/首episode强选；到达条件立即生效。成交日期含open，统计close-date保留，过滤不得截断复盘整回合账本上下文。
- [ ] /home及/trades直达/刷新/复制URL、back/forward与取消leave guard一致。catalog ready后校验账户/标的；非法范围/账户/标的不静默all，invalidmarket按原文warning+all。UI source token不覆盖目标URL。
- [ ] S v2快照UI-only；返回重读bootstrap后恢复完整来源UI、scroll/focus，不从缓存rows/price复原业务数据。隔离库受控变更后返回显示新数据；来源删除有解释与fallback。
- [ ] 既有复盘真实保存→repository→返回→重读→reload及未保存离开/取消不回归。显式隔离DB，原始业务库只读且逻辑hash复核。无需创造新的首页业务写入口。
- [ ] 影响前端开发触发frontend-control-audit；范围为本票所有已渲染控件和必要上下游。完整96公共分母保持，P1实际实例登记至evidence/P1/controls/；前/中/后空间尺寸、滚动和下游位置，异常、空态、选项与键盘分别记录。剩余P2–P4不是P1 PASS，不从分母删除。
- [ ] /root未参与UI实现，独立浏览器操作和直接参考/渲染看图；功能、端到端/持久化、视觉三门槛分别判定。未执行为NOT VERIFIED，主要设计偏差不能用测试抵消。

## 派发说明（依赖关闭且root明确授权后生效）

唯一owner /root/integration_g61，不再派代理。精确允许写入：

- app/components/homepage-v25/** 新组件/局部样式/适配/测试；app/components/trade-review-workspace.tsx与同名测试；app/page.tsx、新app/home/page.tsx、新app/trades/page.tsx。
- app/components/library/trade-library.tsx与对应测试；library-browse-state.ts及测试。仅普通来源intent、execution-list/date range、返回和identity集合；原close-date统计/显式pending/simulation不改义。
- 有证据交易所路径：app/lib/instruments/metadata-contracts.ts及测试、providers/sec-company-tickers.ts、providers/nasdaq-directory.ts、metadata-providers.test.ts；app/lib/instruments/resolve-service.ts及测试（仅有限证据merge，不改TTL/请求/路由）；app/lib/storage/sqlite-store.ts及测试、indexeddb-instrument-metadata-repository.ts及测试（仅optional metadata保留/merge所必需，旧可信证据不得因新缺字段消失）；app/api/storage/instruments/metadata/route.test.ts。不新增业务表/schema。不凭fixture发明映射，需官方来源或保留未知。
- 报告/RED-GREEN/种子脚本：evidence/P1/，不覆盖既有历史。共享README/矩阵/最终接受由root维护，owner报告映射。

app/layout.tsx及新共享host/route group仅报告必要性后由root明确扩边，不能未经验证改变原prototype/metadata/fonts；优先最小persistent host或真正经过guard的地址controller。旧dashboard/room-holdings、全局globals.css、F/S源码、回放引擎、导入业务、依赖、配置、业务DB不在允许范围。必要新证据由root调整有限文件边界。

输入：raw entries、metadata、真实quote/candle、position snapshot、FX/status/asOf与ready/error/provenance；已接受S v2接口。输出：受控home surface、guarded ordinary library intent、完整UI source snapshot与准确数据重读，不维护第二套applied附件。kind未知按真实来源保留，不能填造价/费/汇率。source rows不缓存到UI快照。

首张真实整页出现即交root两宽截图和最小旅程；root接受前不扩P2–P4。P1内部切片不重置验收轮数；提交implementation-ready时root进入第1轮。TDD先RED再源修；固定Node26/SQLite3.53、对应有意义测试、tsc。UI操作通过CUA，写入测试必须显式TRADEREVIEW_DB_PATH独立库。

## 验收证据

当前功能、端到端、视觉均NOT VERIFIED。计划evidence/P1/functional/、state-persistence/、visual/、controls/。每轮记录源指纹、服务/端口、独立DB、真实路径、viewport/zoom/DPR与输入方式；/root独立接受记录evidence/P1/acceptance-N.md。当前1/3，第1轮FAIL，见evidence/P1/acceptance-1.md。

## 历史

- 2026-10-23 01:20 CST 预审：P1 仍0/3，尚未提交 implementation-ready。已确认并转交 owner 的根因包括：请求数据不能靠全局 revision 推断归属；新读取 FX 被旧 options.data effect 覆盖；gross UF 与净口径不一致。无 hpIndex 的 popstate 和 fresh catalog 删除保留为边界检查，真实浏览器后果待验证。种子脚本需确保同日成交、行情和 FX 时间在真实当前 instant 之前，再由 root 显式写入隔离库。

- 2026-10-23 00:49 CST：S恢复第1轮纯合同接受，A已接受；root正式授权integration_g61按本票有限文件范围开始P1。首张真实整页/最小旅程为扩展P2–P4之前的独立门槛，当前0/3。

- 2026-10-23：集成诊断完成且由root完整审查；建立本票与已填写视觉契约，S未接受前保持未领取/未授权。原A准备证据继续有效，无产品UI接受。


2026-10-23 01:59 CST：F恢复第3/3轮纯合同独立接受PASS，session source e91dce9cdddf83137370ef44647dda260336b03bd49b5082d201352664f762b0。root 19文件352测试PASS、严格依赖范围tsc与lint exit0；原三RED的新标签真实管线GREEN并断言净UF，81冻结文件hash不变。旧14FAIL及fixture校准全过程保留。允许P1消费当前指标；P1仍1/3 FAIL，P2–P4仍等待首次UI门槛。日批量/归因/视觉/持久化不在F此接受范围。详见evidence/resume-2026-10-23/F-fix/acceptance-3.md。

2026-10-23 02:40 CST：root正式第2/3轮FAIL，见evidence/P1/acceptance-2.md。最小真实旅程及两宽首张布局有限PASS保留；95项回归50PASS/45FAIL、ordinary性质/目录错配、daily-only修复接线及required NV未闭合。原owner准备第3候选，先根因与RED，不提交未具备全部适用门的正式候选。S/P2后续编辑后的运行画面不冒充freeze2证据。

2026-10-23 03:23 CST：P3 owned数据接线引入direct /trades空集合回归。root冻结UI全重载仍0标的/0回合，DB数据未丢；根因初次trades路由未执行owned read。见evidence/P1/round3/ROOT-DIRECT-TRADES-DIAGNOSIS.md。原owner先建RED，不以外部最新bundle旁路。双窗口409验收中断作废；recall-conflict-409.png实际是HMR附近错误证券，不是409正证据。Tab3真实seed保存rev1→2局部成立，但完整冲突/失败恢复仍NOT VERIFIED。P1第2轮FAIL及所有旧证据保留；当前未启动正式第3轮。


2026-10-23 03:49 CST：root冻结稳定版本独立完成Recall两真实窗口409、显式重载恢复、受控HTTP503输入保留/导航阻止、恢复PUT200及实际rev5重开持久化，局部PASS，见 evidence/P1/round3/ROOT-PERSISTENCE-CHECKPOINT.md。冷直达普通库读回归亦局部PASS；P1仍2/3 FAIL，未正式启动第三轮。P3首条搜索真实往返/查询与焦点恢复PASS，详情视觉发现原稿层级/主动作偏差，交同owner有限修复，附件尚未放行。request-body消费者仍OPEN，诊断候选未激活。指定视口set未生效，当前实际1280×720 DPR2，双桌面/390响应式门不以错误文件名冒充。P2性能架构方案仍待用户选择。
2026-10-23 04:08 CST：root 真实鼠标路径复现 NR04 来源丢失，见 `evidence/P1/round3/ROOT-NAVIGATION-RECOVERY-DIAGNOSIS.md`。A股/ROKU 冷普通库首读受控失败→返回 pending→打开搜索→硬刷新后变全部市场/空查询；正常重试仍77持仓。首次坏写为 onUi 用旧 committed 覆盖合法来源，非裸URL/generation本身。原 owner 仅获一次先 RED 的 host 生命周期候选，P1仍2/3 FAIL、第三轮未启动。03:57请求体观察窗口已约04:00撤回，同隔离DB/3333恢复无探针；日志未捕获目标异常、首页GET漏记且预算截断，真实消费者/原Recall现象仍OPEN。P3附件未授权，P2架构讨论仍待用户答复。原证据全部保留。



2026-10-23 04:43 CST：绝对deadline候选root组合77/77 PASS，真实窗口关闭/重开未重给完整15秒，详见 evidence/P1/round3/navigation-deadline/ROOT-CHECKPOINT.md；仅有限因果PASS，P1仍2/3 FAIL、第三轮未启动。旧NR04版本证据保留，当前全旅程与原request-body消费者仍未闭合。


## 2026-10-23 04:51 CST — 当前候选有限复验与暂停边界

root 独立对当前 Surface84897ee2… / CSSb7160f10… / host3218407b… 执行8文件77/77测试PASS，前后输入hash一致；真实HTTP503错误态居中错误色/88×36重试、键盘不可打开旧结果、真实retry恢复与正确Enter、1440滚动关闭重开及准确HKEX:6969详情返回均有限PASS。准确参考/视口1280×720 DPR2/控制实例/证据及排除项见 `evidence/P3/search-error-visual/ROOT-CHECKPOINT.md`（各子票路径相对于执行记录目录）。当前主服务3333实际浏览器预览可见，故障代理3334已恢复normal后停止；隔离DB未重建，业务库原始表逻辑哈希一致。

P1正式2/3 FAIL、第三轮未启动；P3正式0/3，不因有限checkpoint增加或重置正式轮数。P2三市场冷约2.97秒/重复约3秒且完整图超过64MiB，性能FAIL保持；原始实现及两项授权性能候选均未达完整目标后，按已调用systematic-debugging的“Discuss with your human partner before attempting more fixes”要求等待架构讨论（既有异步问题未回复），四产品文件冻结，未增加新修复候选。建议讨论保持64MiB并验证不可变对象共享；仍只是待选择方案，未实施。P2页面/P4产品/完整附件依赖未解除。

request-body实际消费者OPEN，生产调用图只定位到app handler首次clone之前，未定位原始非GET请求消费者；旧探针预算/首页GET漏记局限及全部原失败保留，无新探针激活或猜测性框架修复。完整当前Workspace回归、整页视觉/控件/响应式/触控仍NOT VERIFIED，已知未实现功能保持FAIL。所有恢复代理实际gpt-6.1-sol / ultra，当前候选已冻结；无提交、推送、合并或发布。
