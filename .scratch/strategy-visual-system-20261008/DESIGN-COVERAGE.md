# 策略台视觉规范样板 · 设计覆盖契约

## 2026-10-10 视觉版本归档与远端分支授权

用户本轮明确授权将当前视觉归档并提交远端分支；以下 A01–A03 supersede 本文历史范围中的“不推送”，不改变任何产品元素与状态合同。文档实现 owner: visual_checkpoint_docs_luna；整页视觉、数据与提交集成 owner: root；独立归档审查: checkpoint_audit。

|需求 / 元素|准确规格 / 参考图|owner / 交付|用户旅程与可观察结果|验收证据 / 状态|
|---|---|---|---|---|
|A01 本地当前视觉冻结 / E01–E08、E12无改动|用户本轮；observe-scroll-20261010.md；evidence/observe-scroll-20261010/after-top-{1440,1280,390}.jpg及final-live-bottom.jpg，阶段complete、EMA20、2024-09-13净值|Luna版本README；root截图/manifest|版本页→精确活预览与本地图；源码/图像SHA绑定，保留原始FAIL与NV|versions/0.7-20261010/manifest.json；PASS root SHA核对与真实浏览器，3业务原件本地保留/远端排除|
|A02 文档与视觉版本索引 / 产品元素不适用（仅文档导航）|用户本轮；当前0.7规范与历史0.5/0.6接受记录|Luna根README/docs索引/designs索引及规范入口|根→文档→视觉索引→检查点；不迁移或重写历史接受|73条相对链接与root内容审查 PASS；历史FAIL/NV保留|
|A03 提交当前任务远端分支 / 产品元素不适用（Git检查点）|用户本轮；development-workflow.md“仅提交/推送”|root Git、验证/接受；checkpoint_audit只读审查|提交范围→普通push→ls-remote exact HEAD；保留工作树和原数据，不合并master|类型/相关193项/构建及5项集成PASS；3原件未暂存；独立审查与远端SHA待最终核对|

基线：origin/codex/strategy-workbench-v1-design @ 9c2b3d209a202422c3d5aeab5969a9b093cfda92。当前分支 codex/strategy-visual-system-20261008。f42e 未提交草稿只能作为实现参考，不作为已批准契约。用户最新要求覆盖旧稿预设复盘栏数/比例。启动包尚未定位，NOT VERIFIED。

范围：一套推荐视觉系统，两种业务上下文（组合策略 A 工作台、原生个股复盘），不是两个审美候选。合成数据、中文完整内容；仅可逆样板，不推广生产、不推送。root 为整页视觉一致性和完整数据/持久化流负责人；Luna 分文件实现；design_audit 独立审阅。

|需求 / 元素|精确参考|实现所有者与文件|用户旅程 / 接口|验收证据|
|---|---|---|---|---|
|U01 远端基础/原 A 布局|IF-05/06，docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md:81； .scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md；.scratch/strategy-portfolio-backtesting/references/2026-09-30-round1-tradingview-reference.png|workbench Luna；public/design-system-20261008/workbench/；只复制远端 A|组合→回放→事件/返回→结果/比较，保留 JS 合同|1440×900、1280×800同状态前后图；真实 LWC；完整控制 inventory|
|U02 字体/角色/对比度/状态|docs/specs/2026-09-25-chart-first-review-ui-elements.md:44,118；IF06；用户二/四；现有 globals.css|两 Luna，各自样板 CSS；root 统一 token|Geist+明确中文fallback在generic前；数字Mono；复盘标题18/24/600、分区16/24/600、正文14/22、控件13/20、元数据12/18；策略A保留实验17/700、图头14和固定预算，不因统一而放大；原文不缩短|computed JSON仅证明字体链，不冒充逐字rendered font；前后截图；颜色合成后对比计算；真实Tab焦点|
|U03 36控件/18图标/4px节奏|docs/specs/2026-09-25-chart-first-review-ui-elements.md:44；现有Lucide|两 Luna|默认36独立点击框，图标18、stroke1.75；触摸候选44；按钮6容器8；4/8/12/16/24间距；顶栏部分31×36、计划命中112×36与A局部尺寸登记例外|rect/padding/svg实测；选中、focus、disabled不同机制；窄屏主动作44实测，不替代触摸|
|U04 语义颜色|docs/specs/2026-09-25-chart-first-review-ui-elements.md:15；用户三|两 Luna|保留page#0b1220/surface#111a2b/升降设置/gold#f3ba2f；primary#2469c8 hover#2b72d3 active#205bac；focus#8cbdff；必要控件border#58708f|实测默认/Tab焦点；hover/active仅源码计算，真实悬停NOT VERIFIED；4.5正文/3必要形状；财务不只靠颜色|
|U05 S0/S1/S2同一workspace/截止|docs/specs/2026-09-25-chart-first-review-ui-elements.md:81 E02/E04/E07/E14/E15；docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png；docs/designs/2026-09-25-chart-first-review/04-holding-stage.png；docs/designs/2026-09-25-chart-first-review/05-final-review.png；用户三|recall Luna；app/components/design-prototype、recall-workspace opt-in seam、chart opt-in seam；不得改变生产默认|S0首次动作→图表实际揭示bar/成交→S1→S2；阶段+行情/成交完整截止紧邻图；新旧判断按形成阶段|真实浏览器前后；列表/摘要投影PASS，Tooltip/wheel未来覆盖NOT VERIFIED；新增390完整角色S0不含成本；若发现基线问题记录、样板修复只opt-in|
|U06 图上全文、原判断/补充/补记、计划/实际|docs/specs/2026-09-25-chart-first-review-ui-elements.md E06/E08/E10/E14/E16；用户三/四|recall Luna|复用 RecallWorkspace/ReplayChart/DrawingCanvas/DrawingToolbar/plan components；完整多行中文不删不改短；图上+同源展开原文；明确复盘补记|S0/S1/S2全文截图；选择/定位关联；初始56、止损52、目标68、1000股、20万完整|
|U07 较窄视口/长内容|docs/specs/2026-09-25-chart-first-review-ui-elements.md:108；IF06；用户不预设复盘比例优先|两 Luna；root校准|A桌面1440/1280、54导航及1300断点两侧独立验，200展开未实施；900/390 A横滚不替代桌面接受。复盘≤1330图480下移计划，≤600图720/全文纵向流；用户最新授权探索优先，旧200–240趋势/表自身滚动不称忠实PASS|viewport稳定后截图+overflow rect；CSS视口与JPEG尺寸同时记录；不得隐去价格或裁切长文；≤600回放六控件两行换行、44px命中、原DOM/Tab顺序保留；顶栏工具横滚分别登记|
|U08 持久化与隔离|AGENTS 数据保护；用户四 actual样板|recall Luna实现样板localStorage repository，root验证；服务.data/strategy-visual-acceptance.sqlite|baseline/recommended固定fixture，独立唯一storage key；样板保存→返回工作图→刷新；明确样板本地保存，可重置|实际浏览器save/reload，网络无业务DB写；不称生产SQL链路验证|
|U09 规范与诊断/后续固化|用户一二四五|root docs/designs/2026-10-08-strategy-visual-system/README.md，diagnosis.md，acceptance.md|每问题位置/图/来源/实测/影响/原因/规则/验收；参数出处与例外；未来推广清单|文件/独立review报告/版本hash/coverage状态，不借旧截图作为新证据|

推荐视觉合同：紧凑、安静、中文可读；不扩大每个控件，强化角色差异。策略 A 固定框架尺寸保留。复盘不复制首页B、不建立新固定320栏契约；优先图上证据与可打开全文。禁止省略计划/价格/原文。baseline/recommended使用相同fixture、阶段、视口、chart range。原有盈亏颜色与用户设置是权威。

## 2026-10-08 补充：完整动态视图恢复（派发前契约）

精确状态与视觉引用见 [full-restore-contract.md](full-restore-contract.md)。root拥有整页与完整状态；benchmark_inventory独立看图。F各项是旧完整布局恢复，不冒充紧凑A已融合。图片根为 `.scratch/strategy-desktop-ux-v2/screenshots/integration/`。

|需求/元素/状态|准确规格/参考图|唯一实现owner/交付|用户旅程及可观察反例|验收证据/状态|
|---|---|---|---|---|
|F01 入口与已展开预设/E01 E12|用户最新请求；DD10、DD14；contract；t0-1280.png|full_preview/新wrapper+page开发条件|打开完整→明示合成/已展开/刷新；原创建保持T0|PASS：observe-final两档、results/comparison-entry/reload-final、original-create-t0；manifest最终SHA，独立V01/C01|
|F02 净值/K线/持仓 E02 E03 E05 E06|DD05–06:175–200；first-bar-1280.png|full_preview/running opt-in|complete净值丰富；切K线同日；T0无交易→下一日真实bar|PASS：observe-{net,candles}-final两档、first-bar-after两档与DOM；独立V01/V05|
|F03 结果净值 E08|DD09:220–234；results-1280.png|full_preview/复用ResultsPrototype|从观察进结果R=V，图与截止一致|PASS：results-net-final两档与最终reload；独立V02|
|F04 回撤/仓位 E08|DD09:230；WD06:166；results-1280.png+原results组件|full_preview/原组件不删|切回撤/仓位真实数据图且R不变|PASS：1440 drawdown/position-after、1280 results三图final；R保持9/13，独立V02|
|F05 损益/贡献/费用/事件 E07 E08|DD09:231；原ResultsPrototype；results-1280.png|full_preview/原组件不删|完整字段、滚动可达、结果事件→来源R恢复|PASS：results-lower实际滚动两档、result-event/return；独立V03，root实测来源恢复|
|F06 比较净值/回撤/仓位/口径 E02 E08|DD09:233–240；comparison-1280.png|full_preview/原ComparisonPrototype|双组共同区间，3种图切换，事件→来源比较恢复|PASS：comparison三图after两档/最终net1440/return与reload；独立V04，root实测来源恢复|
|F07 T0/running/complete/播放 E04 E05|DD06:177–200；TD02 T03/T06；t0/first-bar-1280.png|full_preview/可选初始预设|T0初始0持仓；第10日可继续真实播放；普通创建默认无变化|PASS：T0/first两档、running-play-paused/reset、running-final1280、t0-from-results-final；独立V05|
|G01 可发现完整目录 WB01 WB08|用户本次请求；WD03/WD06；当前A+STYLE04|view_guide/仅publicHTML|顶栏全部视图→原版/当前两组入口|PASS：guide-final两档，Tab/Escape焦点实际恢复、独立V06；原布局预算保留|
|G02 A观察净值/K线、结果、比较 WB03|REPAIR03/STYLE04，public现有组件|view_guide/目录调用原函数|固定截止，净值默认，完整预设不提前隐式揭示旧running|PASS：a-presets-final.json及九切面1280实图，独立V06/V07|
|G03 A事件/指标/明细/配置 WB06 WB07 WB08|REPAIR03；public原renderInspect/renderDetail/openConfig|view_guide/目录调用原函数|各状态实际打开、Escape返回焦点，事件返回来源保持|PASS：a-{events,event,metrics,detail,config}-final1280实图/DOM，真实关闭与来源返回；独立V07|
|G04 A T0/running/review/complete/loading/error/pressure WB01–06|REPAIR03场景表；public scenarioState|view_guide/目录场景选择|七状态原截止/失败恢复不改，旧scenario URL保留；新preview可重载|PASS：a-scenes-final.json及七场景1280图，旧running/新event深链接刷新实测；独立V07|

样板状态：可评审；已记录功能旅程、阶段安全/本地持久化与独立视觉局部PASS，最终角色遮挡FAIL修复并独立直接看图复核。完整UI接受仍有Tooltip/wheel、编辑态、production SQL/physical touch/缺失启动包等NOT VERIFIED，总体票保持open，不声称100%。完整控制清单、历史FAIL与版本证据见 docs/designs/2026-10-08-strategy-visual-system/acceptance.md。

2026-10-08后续恢复范围F01–07/G01–04由root实际旅程及benchmark_inventory独立视觉/代码分别接受；证据完整索引见[full-workbench-preview](../../docs/designs/2026-10-08-strategy-visual-system/full-workbench-preview.md)、[独立审查](reports/full-restore-visual-review.md)、[冻结清单](evidence/full-restore-manifest.json)。范围票02/03关闭；整体01票与前述NOT VERIFIED不变。全仓lint最终FAIL 17errors/1645warnings保留。

## 2026-10-09 首页视觉统一（派发前）

准确首页参考/截图/授权差异与范围见 [统一契约](style-unification-contract-20261009.md)，票04；首页业务数据不同，不比较其布局。root为整页/状态责任人，Luna唯一实现。下表初始均NOT VERIFIED。

|ID / 元素|准确参考|阶段与旅程|owner/交付|预期/反例|证据|
|---|---|---|---|---|---|
|U10 文字/指标 E01 E02 E03 E08|首页v0.2文字段、module h1/h2/strong；首页1440/observe-before|complete观察/结果/比较；原版切统一|Luna scoped theme|24/32/600页标题，18/26/600模块，24/32/500主要指标；14/22正文、12/18说明，无截价格|PASS：三页1440/1280/390前后图、computed；完整账本14/22新图。辅助chrome12/18例外，逐字字体NV|
|U11 面板/图表 E02 E05 E08|首页v0.2颜色，module root；旧before三图|观察净值/K线、结果/比较三图|Luna theme+optional Canvas|同surface/border；图尺寸/范围/策略色盈亏色不变，Canvas不fit|PASS：三页终图与原尺寸；Canvas仅applyOptions，已有PnL/曲线色与数据保留；内部logical-range未实测|
|U12 控件/选中 E04 E05 E12|首页v0.2尺寸、module button/focus/coarse|默认/Tab焦点/选中/disabled|Luna wrapper/theme|36/44高度、6radius、focus2offset2；切样式不重挂；SVG图表尺寸不套18|PASS：time-controls-fixed/running-controls-final390、range-focus-final390、T0 disabled、computed与对比计算；真实coarse/touch/全部hover动作NV|
|U13 完整内容 E06 E07 E08|DD05–09；同数据before结果/比较|结果滚动完整字段、事件原文、计划/实际|Luna theme，root状态|不可为视觉删判断或金额；表局部横滚完整内容|PASS：贡献右端、比较资产、账本左右390与资产/成交额1440、来源长文。错误旧ledger图标注不充数|
|U14 视觉比较与回放 E04 E05|统一契约样式切换；full-restore阶段表|切组合/图型后比较，T0逐日/运行播放|Luna optionalprop，root验|日期/组合/金额/可见视野不变；next真实bar和成交可见，结果/来源返回保留|PASS：style-state-preservation equal，T0→6/17实际bar/成交→播放6/18新bar暂停，source-return；完整Tooltip/wheel NV不覆盖|
|U15 响应式 E01–08|统一契约验收；首页不迁网格|1440/1280/390，同complete/所选|Luna theme；独立review|图空间保留、44高度，窄表可横滚，无价格裁切|PASS：三页两桌面及390终图；真实ArrowRight/focus，日期两基线、完整仓位/价格；实际设备/软键盘NV|
|U16 规范复用/例外 NA|用户最新统一要求、首页v0.2固化|可逆样板与后续推广|root docs/记录|真实本地共享候选样式，不声称跨工作树已固化；保留前失败|PASS：0.6规范/实际验收、独立报告、source-freeze/manifest与root检查；后续公共推广范围明确|

2026-10-09最终范围记录：[root实际接受与启动](../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-acceptance.md)、[独立看图/静态审查](reports/style-unification-visual-review-20261009.md)、[证据冻结清单](evidence/style-unification-20261009/manifest.json)。04关闭。表中的PASS仅对应本票范围；历史FAIL、票01仍open与原NOT VERIFIED不变。候选可审美评审，未作生产全局推广或推送。
# 2026-10-09 严格回归补充覆盖（派发前）

04重新open / acceptance-failed，U10/U12/U15相关结论重开。准确引用与候选差异见[回归契约](observe-regression-contract-20261009.md)，当前新证据在evidence/observe-regression-20261009。root负责整页视觉/完整状态；实现Luna/high；独立visual reviewer未参与实现。

|ID / 元素|精确参考与当前图|唯一实现owner / 文件|用户旅程 / 反例|接受证据 / 当前状态|
|---|---|---|---|---|
|R01 E01 E12|契约§1；before390/760；首页v0.2控件文字|Luna full-workbench-preview.tsx/css|展开工具，5入口/场景/视觉仍可达，完整说明不删|FAIL：预览占首屏；后测关闭/展开图|
|R02 E01 E04 E05|契约§2；before1440/601；DD05–06|Luna theme observe scope|自然纵向流、1240共享基线，图高不减少、无重叠|FAIL：错位/100dvh压缩；后测rect/截图|
|R03 E02 E03 E06|契约§3；before1440/1280；首页v0.2文字角色|Luna theme observe scope|核心24/32、明细14/22，完整数字/数量、盈亏色保持|FAIL：全部金额24；后测字体/整页|
|R04 E01–07|契约§4；before601/760；DD06–08|Luna theme observe scope|320/390/600/601/759/760/980/981/1023/1024/1280/1440；图优先、44命中|FAIL：断点断层；后测断点两侧|
|R05 E02|契约§5；before760；DD08及用户价格完整|Luna theme observe scope|全金额+百分比，任何宽度无ellipsis裁切|FAIL：收益截断；后测scrollWidth/截图|
|R06 E04 E06 E07 E12|契约§6；before-menu/drawer/extra-audit；首页v0.2|Luna theme|长菜单/恢复展开/多行详情，正文14/22、辅助12/18、CJK链|FAIL：10/13子元素；后测computed/全文|
|R07 E05 E06 E07|契约§7；before-selected/event-nav；首页v0.2状态|Luna theme+running TSX仅图标|真实选中四边/Tab焦点/菜单Escape/disabled，36²/44²|FAIL：底边/窄箭头；后测状态图与rect|
|R08 E04 E05 E07 E08|契约§8；DD06/DD09；full-restore合同|Luna仅呈现；root完整状态|T0真实bar/成交、播放、主题保持状态、来源返回、共享结果比较工具|NOT VERIFIED：待改后新鲜真实旅程|
|R09 E01 E04 E05|回归契约补充§9；final-complete-760/759.jpg及JSON；首页文字角色、DD05图表优先|同一Luna full-preview CSS/theme observe；root整页|760→759自然容量换行，图y差≤60；601/600无覆盖，390/320完整|FAIL：独立看图发现353px突变；保留批1，新final2图/rect接受|
|R10 E05 E07|回归契约补充§10；final-complete-390/360/359/320-full.jpg；DD06可见事件与完整详情|同一Luna running TSX marker呈现（可纯helper/边界测试）；root状态|全部事件点/完整详情；类型标签按真实间距去碰撞，当前最新优先；原版不变；resize/range/theme/T0/播放|FAIL：独立看图发现重复文字挤叠；final2净值/K线窄图、真实旅程、源码范围与独立看图分别接受|
|R11 E06|回归契约 final3补充§11；final3-more-menu-390与bottom JSON x=-260.57/w366；首页v0.2菜单完整内容与R06|同一Luna theme≤759菜单定位；root整页/状态|320/390/601/759菜单不出视口、760/1280旧锚不变；长名称加入/末项Tab/Escape回焦点|FAIL：final3 root直接看图；新final4-menu及源码限定diff接受|

## 2026-10-10本轮最终接受追加（保留上表派发前FAIL）

范围为完整观察视觉与共享导览。root整页/数据流；Luna实现，独立source及visual审查者未参与实现。18档Final3主体对应最终主体源码；Final4仅R11菜单三处CSS，反向精确恢复Final3哈希，另三文件未变；1440/390/760/759新主体几何再次一致。下表仅关闭本轮授权反例，整体01及历史全量NV不变。精确引用/owner/旅程继续上表；最终SHA与截图时点在evidence/observe-regression-20261009/manifest.json。

|ID|最终接受证据（同目录）|结论 / 边界|
|---|---|---|
|R01|final3矩阵、工具开合、final4 shared results/compare|PASS：仅预览工具折叠，业务原文及入口保留|
|R02|final3-complete-601/600/1440 full与JSON|PASS：自然高度不覆盖，1440恢复/主体x100，原图高保留|
|R03|final4-live-role-audit、18档全图|PASS：主24/32/500、次14/22/500，数量价格与盈亏色完整|
|R04|final3 18档，含1060/1059、1024/1023、431/430、360/359|PASS：1024侧栏320，文档完整，目标36/44；非触屏证据|
|R05|final3 760/390/320、final4-long-portfolio-390-full|PASS：全金额与百分比无裁切|
|R06|final4菜单6档、final3恢复full、final3/4抽屉上下|PASS：名称14/22/500、辅助12/18与CJK声明链；逐字字体NV|
|R07|final3-holding-selected-focus-390、final4-live-role-audit、drawer|PASS：A四边选中、B真实焦点，18/1.75及36²/44²|
|R08|final3 T0/next/play-pause/next-candles、theme-state-negative；final4 source result/compare return|PASS：真实bar/成交/播放、主题保留日期组合金额图、来源R恢复；全量Tooltip/wheel NV|
|R09|final3 760/759及final4重采，601/600|PASS：598→622差24≤60，601/600均741；前批FAIL保留|
|R10|final3窄净值及5档K线全图；独立源码9helper检查|PASS：全部点/日期/详情保留，重复类型文字8px净空；原range不改|
|R11|final4-menu-320/390/601/759/760/1280、menu-bottom390、long-portfolio390|PASS：390 x14/w366，末项Tab滚动、Escape回焦点、长名加入；纵向需滚动|

root typecheck/scoped ESLint/build/diff exit0，独立源码与实际直接看图分别PASS。[最终接受](../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)列明实际代表色、取舍、NOT VERIFIED和启动。04 closed/accepted-scoped，无推送、无生产推广。

## 2026-10-10 滚动回归派发前（05；用户整体视觉认可）

按[05契约](issues/05-complete-preview-scroll.md)，root整页/状态责任，scroll_fix_luna唯一CSS实现，observe_scroll_diagnosis独立源码/看图。证据根`evidence/observe-scroll-20261010/`；布局参考前轮Final4及本轮before-1280，固定EMA20/9月13/完整净值，不授权其他视觉改变。

|需求ID / 来源|elementID|参考图 / 状态|owner / 交付|旅程与反例|接受证据 / 状态|
|---|---|---|---|---|---|
|S01 用户无法下滑；规范homepage-style-reuse:62|E01/E05|before-1280.jpg及before-metrics/wheel-after/keyboard-end；完整EMA20 9/13|Luna full-preview CSS；root浏览器|桌面/1060向下wheel/End到页底再Home；1059/390现有滚动保持；不改截止/组合/图型|桌面FAIL：1051>720但scrollY0；窄屏原PASS需复验|
|S02 自然文档滚动作用域；用户整体ok|E01/E05|前轮Final4 1440、390；本轮同状态before|同Luna；root导航|完整结果/比较及原版滚动；离开原创建恢复body旧策略；无全局扩大|NOT VERIFIED|
|S03 完整信息/状态与局部滚动|E06/E07|前轮Final4菜单/抽屉；本轮新state|同Luna；root状态|滚动菜单末项/抽屉底→Escape→页面wheel；截止/组合保持，不推进、不fit|NOT VERIFIED|
|S04 用户已确认视觉；规范角色及图高|E01/E05/E07|final4-complete-1440及本轮同视口before；1280/390|root整页；独立observe_scroll_diagnosis|相同状态首屏前后直接比图，字号/图高/空间不变；只恢复native滚动|NOT VERIFIED；截图及实际CSS宽度/DPR分别登记|

## 2026-10-10 滚动最终接受（保留上表派发前FAIL）

|ID|新证据（observe-scroll-20261010）|当前结论|
|---|---|---|
|S01|green-matrix/1280-wheel/1280-keyboard-up、5档after-bottom及final-live-wheel|PASS：页边真实wheel到最大值、Home/up回顶、End到底；不是全页截图代替输入|
|S02|after-results/compare inner及document-bottom、original-document-bottom、leave-original-create|PASS：结果内部468/比较577与文档106分别可达；原版106；离开body hidden恢复。结果原探针false保留并按实际局部归属解释|
|S03|1280/390 menu/drawer top/bottom、menu-visible-bottom390、close/input JSON|PASS：局部滚动与Escape回焦点；末项完整金额可达，截止/组合/图型保持。初始390菜单底部超视口的截屏限制保留|
|S04|DPR1配对1280/1440/390 top图/几何、独立observe-scroll-review-20261010|PASS：未参与实现者直接对照接受；原CSS仅追加4行，其余呈现文件字节不变|

root新build/CSS解析/diff PASS；活服务/正常viewport恢复通过。[最新接受](../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)。05与04本次重开范围关闭，不扩推01/生产/全量未来信息与实际触屏。
