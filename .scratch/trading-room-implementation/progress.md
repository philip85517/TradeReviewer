# 执行台账

- 用户已批准9票发布并开工，包含提案明确列出的spec §12交互默认。
- 01/02第一波；03/05第二波；04/06后续并行；07/08；09独立QA最终放行。
- 准备：当前为linked worktree，原有规格/词汇表/核查报告保留；npm ci启动中。
- 共享文件：dashboard装配由01负责人；workspace及全局样式由02负责人；其他代理不交叉写入。
- 原核查父任务不修改。

- 基线：npm ci成功（619依赖）；typecheck通过；5相关文件120 tests通过，耗时54.76s。日志reports/baseline-*。
- 正式库只读哈希记录：1857 executions、236 instruments、6 revisions、208 import_batches、127 reviews、6 settings。一致性备份acceptance.sqlite已生成。
- 已派发scope_dev（01）、navigation_dev（02）与qa_plan（独立QA准备），均Luna max；01/02已解锁开始TDD。
- 01契约已冻结：reports/01-contract.md，metadata映射不修改交易身份，RoomScope/RoomFxSnapshot/RoomMoneyView供后续消费。
- 02追加授予import-actions.tsx的Props导出最小变更权，避免复制接口；workspace仍仅02编辑。
- Ruling: 汇率估算采用BOC中行折算价，除以100归一化；理由与风险记录reports/fx-source-evidence.md。
- 3030服务session57273，隔离acceptance.sqlite；首页HTTP200，真实浏览器初始页面加载且无error日志。此为开发基线，不是新功能验收。
- Ruling: 快捷期间的“今天”及每日FX尝试日采用Asia/Shanghai，与用户当前时区一致；市场回合归属仍按来源交易日。成本：若未来用户切换时区，需要增加显式统计时区设置。已要求01覆盖上海凌晨UTC前一天边界，避免模块加载时冻结日期。
- 01初次报告范围模型与16定向测试通过，但仍保留旧独立筛选/统计组。协调者判定spec不符，退回scope_dev移除双scope主路径并更新旧测试，未验收01。
- 独立qa_plan初版准备完成：qa/seed-homepage-fixture.ts及qa-plan.md，最终需按真实03/07存储契约调整样例设置。
- 工具新增/重新激活非当前树代理遇agent thread limit；保留现有2开发者+独立QA席位，不换模型。后续复用scope_dev/navigation_dev执行有边界的下一票；QA不参与产品实现。
- 01预审继续：新component临时calendar传null币种导致默认USD，及无效自定义日期直接进入scope；已交scope_dev修正，04后续替换calendar也必须同币种快照。
- 02多次进度请求未返回，协调者interrupt后followup要求立即如实收尾report，保留现有代码，禁止继续扩大范围。此操作不视为02验收通过。

- 02完成：导航/数据管理代码审查及3030真实浏览器通过；3组件、7刷新、2导入/metadata测试passed，typecheck passed。完整workspace曾1项5秒超时，协调者同默认时限单独复验1 passed/65 skipped（6.47s），记录02-timeout-recheck.log。
- navigation_dev已复用03只读preflight，待01通过解锁实施。
- 02窄屏补验：Cua viewport请求390×844，页面clientWidth/scrollWidth均375（滚动条占宽）；数据管理四项导航、导入三按钮及行情模块可见，无横向溢出，已恢复viewport。HMR首次截图切回dashboard已辨别，随后实际点击数据管理再验。

- 01独立模型QA发现缺失金额被静默跳过、持仓过滤契约不一致，已退回修复；纯CNY无需FX的口径明确。高级筛选清除应保留期间/类别/性质，模拟运行回切保留有效选择。
- 03 preflight已核实getSettings/putSettings可存专用key，完成共享契约准备。03开始独立FX模块开发，最终接线验收仍等待01修正完成；同屏rates只消费string型RoomFxSnapshot。
- QA独立调查06完整成本证据，避免把兼容grossExposure零值当已知成本。

- 01修正独立复验18/18通过、diff-check通过，协调者确认持仓open限制/缺失金额partial/纯CNY/清除保留范围，标记通过；3030完整重载无阻断渲染错误。临时旧calendar的替换是04已分配范围，不声明04已完成。
- scope_dev接05，并单独获dashboard装配与library可选持仓行情投影所有权；navigation_dev继续03，可与05并行。

- 首屏390px协调者实测clientWidth=scrollWidth=375、期间和核心净盈亏可见，viewport已恢复。
- QA测试服务3040 session6744/PID43180使用qa-fixture.sqlite；3031属于另一e7ec worktree，未触碰。独立QA开始01/02真实浏览器路径，后续功能不提前宣告验收。
- 06成本独立证据已完成reports/06-cost-evidence.md，确认可信完整long回合才可用grossExposure候选；IPO cashCost/fee分离、不用空白费用或期初库存猜成本。

- 03协调者定向6文件20测试通过，真实BOC API两次POST成功，3030 UI点击刷新后disabled恢复、获取时间19:03→19:12；证据fx-live-refresh-*、fx-browser-*。
- Ruling明确：FX采集快照按各币种最新有效官方报价组成，保留每币种发布时间；各模块共享同一采集快照，不强制不同币种官方发布时间完全相同。此要求覆盖03-preflight的过严时间组建议；独立QA援引旧建议的P1已退回更正。QA hook abort清理P2交实现者修复。
- 独立QA无法绑定浏览器（表面不可用），改由root实际UI操作并落盘DOM/截图、QA独立审查证据；qa-wave1.md已按此限制完成01/02检查，不冒充QA直接操控。

- 03完成：开发者22 FX/API/UI tests、10 data/refresh、29 import-flow全部通过，tsc通过；导入同名选择器已限定trade-card保留断言。root已验收真实API/UI，独立QA复核hook修复。navigation_dev转06。
- 05协调者独立3文件24测试通过（holdings+library），正在独立QA审查和最终report。

- 05开发报告已完成，33定向测试通过；root在3030已见期前持仓、实际市场分组与行情早于交易/过期/缺失提示。library.latestQuote已为实际运行提供行情投影，无需为05扩成实时行情系统。独立QA还在收尾，scope_dev开始无05依赖的04（01/03已完成）。

- root直接重载3040首页发现03集成P1：FX hook仅在data active时enabled，首页不读/更新FX。已重新打开03并要求nav补app首次打开测试；不以service单测和data页通过覆盖此遗漏。
- 05浏览器两HK0700账户label同名需稳定区分，已交scope最小修正。fixture只有legacy daily_candles可能未进入当前marketStates，交QA核实种子契约。

- 03 P1闭合：root3040冷启动无需data页即显示267.52 CNY（200CNY+10USD×6.7521），fx-browser-fresh-home.txt；独立QA复核hook+集成4测试通过。
- 05独立QA发现显式快照旧unrealizedPnl和source无效日期阻断回退两项，交scope修；同名账户序号已修。QA样例HK quote应2026-09-18，旧09-19周六不是有效行情样例，正在生成v2，运行库未直接改写。

- 06开发报告7定向tests、67workspace、36refresh/import通过；root独立7tests通过。06接口稳定，scope负责同04接dashboard主摘要/RoomQuality。nav开始07独立本金存储/模型/UI，页面依赖由统一装配收尾。
- QA v2已在3040 session54060/PID52428运行；缺价根因为QA ID HK:0700不符现有summary canonical HK:700，API后者404。交QA修seed所有references生成v3，正式身份不改。

- QA v3已切换3040（session93216），canonical HK:700报价与持仓实际通路正常。root真实UI核对两账户数量40/100、成本51/50、报价52、浮盈亏40/200；进入账户2准确40@51回合，返回保留港股本月。证据holdings-browser-*-v3.txt。
- 05协调者修复复验3files29tests通过（05-coordinator-recheck.log），显式快照重估与非法来源日期回退已有回归；等独立QA更新结论。
- 06独立QA指出首页装配缺失和未知资产月胜率P2：前者已在04装配出现，后者交nav修复。04根代理审查发现未来日期范围、跨币曲线、31日翻月和未来导航问题，已反馈owner，尚未验收。

- 05独立QA复核两缺陷和v3实际UI通过，标记completed。04独立QA确认8项问题（含单点不画、未知资产详情），统一交scope修复。QA转07模型预审。
- FX失败样例3041 session68644保留旧估算272且data页显示9/10旧值/本次失败；首页缺失败警示交08补齐。原始数据未参与。

- 04 root定向5files44tests通过；browser真实验证3月汇总→7月→点日详情保持全局月、7/31→8/31→9/19、future禁用、年12月、2024下钻及闰年2/29。证据04-browser-*.txt。仍发现部分月label无覆盖、calendar下钻custom输入未同步、trendPoints未来平铺未修、全部年份截止12/31；交scope修复，未放行。
- 08已授权scope新增quality模型与组件并装配dashboard，DataManagement只给qualitySlot；workspace接线由nav，避免并发写共享文件。
- 07根源码预审发现StrictMode mountedRef与读写响应竞态，已交nav补测试；未把开发中产品标为完成。

- 07模型/API/hook/组件开发报告已到，28定向tests+lint+tsc通过，独立QA模型预审通过；dashboard所有者scope收到装配snippet，07尚待UI验收。06已完成首页实际装配+unknown胜率排除回归，标记completed，最终09再统一核对。
- 3040切至本金新契约v4样例，session78712；3041无FX样例浏览器检查完成后服务已停止，保留DB与证据。

- 04最终独立QA通过；root追加custom08-15..09-10跨月裁切→8月日格、inputs与global一致证据，标记completed。
- 08分工调整以加快并行：scope接nav已落盘红测，负责quality纯模型/RoomDataQuality/dashboard；nav负责quality-details/DataManagement/workspace与真实回调。彼此不交叉文件。
- 07真实浏览器：完整全局本金101200含当期无已平仓的HK/ETF；A股200净利/20000成本1%、10000本金2%；改20000保存重开保留；细筛与ETF市场回退；0金额和币种确认拦截；run-a ETF1000USD得1%、run-b无配置、live仍10000。
- 07两P1仍待修：保存/清空等待期间可编辑导致返回后丢draft；sim→live保留runId使API400。已交对应owner，07-browser-missing-pool.txt为失败反例。冷启动清空HK正常回退成本1%、缺HK提示及已填92000，证据missing-pool-clean-start。
- 根独立FX/principal新增文件lint通过（fx-principal-coordinator-lint.log），03此前setState-effect错误已修。
- 07两P1已闭合：saving锁定控件；live mutation规范化runId=null。root5files28tests通过、sim→live清空/保存实际成功；独立07-qa通过，07标记completed。
- 08 summary/details与live callback已接入。root在3041验证旧汇率首页明确失败提示、直接数据管理有当前范围详情、重试汇率后详情同步可用（无需重新进入）。
- 08 QA无status candle误判完整已由scope修复，3files23tests。source-unsupported动作语义交nav修；root新增空账户弹窗P1已交nav，保留08-browser-transaction-empty-account.txt反例，不作通过证据。
- 08交易明细空账户已实际复验：MSFT两笔成交与补录/编辑可用；source诊断实际显示日线/1H状态和覆盖入口。跨账户issue精确定位追加交nav收尾。
- 09首次全量测试因开发中语法错误与默认超时中止，原log保留。独立storage复验确认1项旧首页空态文案断言失配，交scope只修测试适配，保留存储边界断言。
- 09 build exit0、typecheck exit0、5 runtime tests passed。1280桌面和390窄屏（client=scroll=375）实测无溢出；交付新tab console errors为空，截图与DOM已存。正式库再次UNCHANGED。
- 首轮失败分类已复验：deploy单文件53/53通过；workspace.refresh单文件7/7通过（均默认timeout）；storage-boundary更新旧空态定位后3/3通过。
- QA追加日线/1H分离P2，scope负责daily-status模型、nav负责workspace输入；nav同时补issue episodeId→准确账户导航。最终全量将基于冻结后代码重跑。

- 最终集中结果：189files/1709tests passed，workspace旧helper21失败；只改queryAll fallback后69/69独立默认timeout通过。合并覆盖190files、1730pass、5skip。最终typecheck/build/runtime5/52files lint均通过，protectedUNCHANGED，21:29 HTTP200/真实浏览器零error，3030 session57273仍运行。

- 09独立QA最终通过，全部9票completed。临时3040/3041已停止；3030用户预览保持运行。最终报告reports/delivery.md、reports/09-qa.md与本聊天交付一致。
