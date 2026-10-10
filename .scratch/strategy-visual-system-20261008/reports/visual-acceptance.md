# 独立视觉接受记录 · 持续补证

审阅者：design_audit（未实施被审阅的样板文件）。2026-10-08。本报告只记录独立直接看图和只读源码核查；未操作浏览器、未改实现文件。**本轮可逆样板在已直接比较的局部范围内可交用户评审，总体任务票仍应open，生产控件100%仍NOT VERIFIED。** 策略台已见状态及原生1440的S0/S1/S2、selected、特定Tab焦点局部视觉PASS；390价格角色FAIL已由第15节对应三阶段图关闭。随后重新打开桌面fit/价格焦点后的阶段遮挡和390初始主动作右裁FAIL，第16/17节保存旧失败并以新对应图关闭限定问题。S1成交标记被长批注遮挡仍是登记例外；完整Text焦点/编辑、Tooltip/wheel等未测不由局部修复扩写为PASS。最新策略台见第6节，原生源/测试边界见第11/15节，规范复审见第13节，最新回归见第16/17节；较早章节保留当时失败和旧版本范围。

## 1. 版本、依据与证据边界

基线：`origin/codex/strategy-workbench-v1-design @ 9c2b3d209a202422c3d5aeab5969a9b093cfda92`。当前分支 `codex/strategy-visual-system-20261008`。设计依据为 [融合设计 IF05–08/IF10](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md:81)、[A 第四轮契约 ST01–05](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md:5) 与 [本轮 DESIGN-COVERAGE](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/DESIGN-COVERAGE.md:1)。最新用户要求优先：两种业务上下文共用一套视觉规则，复盘不预设固定栏数；A 的既有预算保留。

审阅者直接以 `view_image(detail=original)` 打开以下图像；不是仅根据 DOM、工人结论或缩略图评分：

|证据|状态与来源|SHA-256|可证明的范围|
|---|---|---|---|
|[workbench-before-complete-1440.jpg](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-before-complete-1440.jpg)|父协调者提供的真实远端源截图；A、组合净值、complete、170 日，1440×900 / DPR1|`5881fc896533534dea35931da05c62745fe3011aad55ab83533522a259956de5`|本轮实际前图；非 CSS 模拟基线|
|[workbench-recommended-complete-1440.jpg](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-recommended-complete-1440.jpg)|同 A / 组合净值 / complete / 170 日 / 1440×900 / DPR1|`2eb6b88b908d22c4006386327896e56e789fb4e6a079f15b3e0fde96c2ea312b`|本次直接同状态视觉对照；不证明后续源码修订|
|[TradingView 原参考](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/references/2026-09-30-round1-tradingview-reference.png)|历史图；2864×1662，含浏览器栏，CSS 视口未知|本报告未以其 hash 冻结新版本|仅作读图优先、工具密度与回放位置参考；不能作新功能证据或像素基线|
|[STYLE04 完成图](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/style-04-evidence/complete-1440.png)|历史已完成 K 线图；本次直接打开|历史证据|验证原站主题、A 布局和文字动作语言；因图表类型不同，不作净值同态像素比较|

父协调者声明的 CSS 视口、DPR 与日期范围在此作为提供者记录；审阅者没有重新控制浏览器测量。两张本轮 JPEG 显示为完整 1440×900。尚未收到与 complete 图片绑定的最终源码 hash / 页面 manifest。只读核对时 `public/design-system-20261008/workbench/index.html` SHA-256 为 `f417bc19d7c845864f4499d9fb516fab0ace599db0eec667ad687697f796db37`（88,914 字节）；它已经包含截图之后的修订，不把该源码伪装为以上图片的拍摄版本。

## 2. 已完成策略台图的直接比较

|观察点|直接看到的结果|本轮局部判定|
|---|---|---|
|A 固定框架与读图面积|两图均保留窄导航、三条顶带、上下文行、主图和右检查区。主图从相同位置开始，右栏维持 320 的既定角色；回放和状态条仍在图底。未见新增大标题、扩大控件或移除字段挤压曲线。|PASS，仅 complete / 1440 的可见布局；没有用目测证明 ≤1px|
|图表同态|170 日净值曲线形状、终点 `1.0484`、月份轴、可见网格范围一致；图例仍给出组合净值、右轴、合成行情与截止日期。图表占整页主要空间，检查区辅助阅读。|PASS，仅该净值图；未证明 K 线/tooltip/推进|
|角色与层级|实验名突出但没有变大成编辑页标题；四项摘要数字优先，说明次级；当前范围、图头截止和检查区日期仍可读。右栏“组合详情→概览→持仓概览→配置/已知范围”的层次保留。|PASS，仅已见文本角色；字体实际逐字 fallback 未测|
|selected / 主次动作|“回放观察”保留蓝色选中外框；“组合净值”保留浅蓝底；“概览”使用下划线。选中态未全变成实心主按钮。配置、实验操作、原型工具等次按钮边框更清楚。|PASS，已见 selected；启用 primary / hover / active / focus 未出现在该状态|
|禁用与末尾说明|已完成图中“播放”“推进下一交易日”和速度处于降强调，状态明确“已到示意范围末尾”。同态图没有出现可继续播放的视觉诱导。|PASS，图片当时版本；最新 CSS 禁用级联见 F05|
|中文与数字|主要工作区文字完整可读；日期、金额和权重仍可辨，未以缩字或省略替换当前持仓、现金、净值、查看日与展开上限。|PASS，仅可见首屏；弹窗、长内容、完整明细待证|
|TradingView 方向与主题保留|沿用“图表主体 + 周围紧凑工具 + 图底回放”的职责，蓝色强调节制；保持 TradeReview 深色页面、深色图底及主题盈亏色。没有把历史参考的浅蓝图底或蓝橙蜡烛机械套入 A。|PASS，该状态方向；用户涨跌设置需另证|

视觉差异主要集中在次控件轮廓、菜单 SVG 箭头和行高微调。几个顶部模式及按钮宽度有轻微变化，未造成当前 1440 图的裁切或层级转移。边框统一提亮让低频“原型工具”也更显眼；当前未达重大问题，但后续应在运行态检查它是否抢过播放动作。

## 3. 源码核查、缺陷与修复历史

源码不是交互实测。以下问题已向协调者逐项反馈，保留早期失败与后续修复状态：

|ID|问题与准确来源|当前状态 / 需要的证据|
|---|---|---|
|F01 主按钮三态不完整|早期推荐稿把通用 `--blue` 改为深蓝，仍继承原 `#4a91ed` hover，缺少 U04 的 active。白字 / 旧 hover 源码对比约 3.199:1。当前 [L300–302/L346–351](/Users/zhoulin/.codex/worktrees/facb/TradeReview/public/design-system-20261008/workbench/index.html:300) 已新增 `--primary-solid/#2469c8`、hover `#2b72d3`、active `#205bac`。|原 FAIL 保留；SOURCE FIXED，最终running启用态视觉PASS；协调者computed正常为白字/rgb(36,105,200)，hover/active NOT VERIFIED。正常白字对应源码比值约 5.344/4.719/6.659，未包含遮罩/透明度。|
|F02 通用蓝被主按钮替换|早期 `--blue:#2469c8` 同时影响选中/导航；现在 [L298–302](/Users/zhoulin/.codex/worktrees/facb/TradeReview/public/design-system-20261008/workbench/index.html:298) 将语义蓝恢复 `#2f80ed`，独立 primary tokens。chartTheme.net 仍保留 `#2f80ed`。|原 FAIL 保留；SOURCE FIXED，最新 selected 对照待重拍。|
|F03 模式名暴露内部英文|早期工具弹窗显示 `baseline` 与原始 `recommended`。当前 [openAbout](/Users/zhoulin/.codex/worktrees/facb/TradeReview/public/design-system-20261008/workbench/index.html:602) 改为“推荐视觉 / 中文现状基线”并映射当前名字。|原 FAIL 保留；SOURCE FIXED，实际弹窗和可达性 NOT VERIFIED。|
|F04 图表字体未明确|早期 body 只有字体链，LWC layout 没有显式 fontFamily。当前 [createChart](/Users/zhoulin/.codex/worktrees/facb/TradeReview/public/design-system-20261008/workbench/index.html:476) 对 recommended 加同一字体链和 fontSize12。|原 NOT VERIFIED 保留；SOURCE FIXED，最新轴读数可读；实际tooltip/中文glyph与逐字渲染字体 NOT VERIFIED。|
|F05 新 primary 覆盖 disabled|首次核查版本 `f417bc19` 的推荐 primary specificity (0,4,1) 高于原 disabled (0,3,0)，未限定 enabled。后续 `33cfa5ba` 加 enabled，解决正常禁用态；但继承的原 primary:hover 仍高于 disabled，因此第二次反馈悬停风险。最新只读版本 `3520318c2d366988de0540928501122f3bce8ea884a6a4e3955e3bef72613071` 在 [L346–353](/Users/zhoulin/.codex/worktrees/facb/TradeReview/public/design-system-20261008/workbench/index.html:346) 保留 enabled 三态并新增推荐 primary:disabled（白字变辅助色、透明背景、边框#243145）。|原两次 FAIL 保留；**SOURCE FIXED**。第二批完整图正常禁用态直接可见，协调者另提供 normal-disabled 实测；最终 disabled hover / active 仍须真实操作补证。|
|F06 变更边界需精确记录|对远端原 A 的 diff 显示样板新增入口/单一 A 切换、图标、字体和颜色。另 [replayOptionLimit](/Users/zhoulin/.codex/worktrees/facb/TradeReview/public/design-system-20261008/workbench/index.html:595) 为 recommended 改变结果/比较/事件的日期选项截止；这是状态安全修正。|需要在授权偏差与功能验收中单列，不可声明“JS 完全未改”或“只有共同 token”。没有据此判为不该修复；源码只能确认边界，实际效果待功能门。|

目前推荐 CSS 没有扩大 A 的框架、实验标题或检查区，也没有换掉金融 series 主题。共同规则采用 body 作用域，并保留 A 例外；这符合本轮“同一视觉系统、两种上下文”方向。使用了继续叠加的 CSS 覆盖，因此选择器级联本身是实际风险，F05 正是反例。

## 4. 独立门槛记录

|门槛 / 范围|当前状态|理由|
|---|---|---|
|A / complete / 1440 同态直观对照|PASS（局部，截图版本）|两张新同态图直接打开，未见重大布局或信息缺失。|
|最新策略源码视觉接受|NOT VERIFIED / 等待最终交互证据|F05 已源码修复，失败历史保留；最终 hover / active 还未绑定真实证据。|
|运行态、启用主动作、悬停/按压/真实 Tab 焦点|部分 PASS / 部分 NOT VERIFIED|第三批最终同范围 running 与 stepBtn 实际 Tab 焦点图的局部视觉 PASS；悬停/按压/所有键盘流程不由这些图证明。|
|1280×800、1300 两侧、长路径/六组合/大金额、空/失败/弹窗|部分 PASS / 部分 NOT VERIFIED|第二批1280压力/加载/失败及第三批complete1280、1301/1299直接看图PASS；长路径、六组合菜单、空持仓/弹窗等仍待最终证据。历史 STYLE04 图片不继承为新样板通过。|
|200 导航|NOT VERIFIED / 本样板未实施|当前只有 A 的 54 窄导航；可维持本轮局部参考，不能称 IF05 融合导航已符合。|
|900 / 390|EXPLORATION，尚无本轮直观接受|当前 coverage 已明确探索性质，不作为 A 桌面合同的替代证据，也不因探索失败取消既有桌面要求。|
|原生复盘 S0/S1/S2、完整原文/补充/补记、计划/实际、断点|NOT VERIFIED|最终复盘图待提供，不预设 320 侧栏或沿用旧稿栏数。|
|功能链、截止安全、保存→返回→刷新|NOT VERIFIED（本审阅尚未执行）|本任务仅独立直观比图和源码核查；父协调者需提供隔离数据库/样板 repository 实测。|
|逐字实际字体 fallback / 物理触摸 / 生产 SQL|NOT VERIFIED|computed font-family 不证明 glyph；本轮不可逆推出物理触摸或生产持久化。|

截至此记录，只能接受已见完整 1440 策略台图的局部布局与层级。整套样板、跨上下文一致性及最新版本仍未接受。下一批证据应先关闭 disabled 级联并绑定新源码，再独立比较最终运行/完整态与原生复盘图；前次 FAIL 和历史图片继续保存。

## 5. 第二批策略台直观复验

父协调者随后提供以下七图，声明同一浏览器 Tab3、每次 DOM viewport 稳定。1440 图为 1440×900，1280 图为 1280×800；本审阅者直接打开所有七图。本批拍摄版本由协调者称 `A51cc…`，拍摄时 normal-disabled 计算为透明背景 / #65758a；disabled-hover 和事件列表边界在拍摄后仍继续修正。因此下面为这些图片的视觉判断，并非最新源码整个功能接受。

|图片 / SHA-256|独立直接可见的结果|判定|
|---|---|---|
|[final-complete-1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-complete-1440.jpg) · `9b030396a69590f0653aeacfbdc8d4fca5cde558cef1d69181f538422f3ae002`|与本轮真实远端 complete 前图同状态直接比较。标题和主图未扩大；净值曲线终值1.0484、日期范围、检查区和末尾控制都保留。图表字体变化后轴仍完整。|PASS，正常禁用态可见；悬停未拍|
|[final-compare-1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-compare-1440.jpg) · `1b1959a978c04931c61bbcecbb20acb0ec546364bd15e3418b9b418b78eb97e9`|与历史 STYLE04 compare-1440 直接同类状态对照。共同截止2024-06-19、蓝/金双曲线、失败组合身份/原因与表格保留；模式 selected 清楚，回放降强调。框架无重大改变。|PASS，视觉；共同截止实际行为另验|
|[final-event-1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-event-1440.jpg) · `3c46988e2120c13b909d29df830b99cfe51534c17b53f2d296095f5e5aaa8cc2`|事件日2024-06-18同时出现在图头、上下文、图例、右栏和状态条；原因、依据、旧/目标/实际权重、成交/未成交与费用18.40均完整可见。关闭仍停事件日与返回阶段结果明确为两个动作。|PASS，图片的整页层级与字段；点击/返回/日期选项边界不由此证明|
|[final-pressure-1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-pressure-1440.jpg) · `032a0fddcd2d8c090dd78dc57b81046f3caa23d0c415217bacc9b1c989dbbdce`|长实验名与组合名省略而保持单行，金额123,830,246和本金123,456,789仍完整，摘要范围和所有局部模式可见。检查区/主图不被挤下。|PASS，可见压力布局；完整名称的实际查看需另证|
|[final-pressure-1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-pressure-1280.jpg) · `5e74bfd6c5a5ed1adeb9dc89188ab54d6d864364e98508856122c8b80a52bd70`|与上述同一 compare 压力状态在较窄桌面对照。标题省略、身份行本金收起属于 A 的既有密度方式；主数字、图表价格轴、范围说明、回放和320检查区可读，无可见裁切。历史 STYLE04 pressure-1280 是 observe，未伪称与其同态。|PASS，1280 压力视觉；tooltip/六组合选项完整性另验|
|[final-loading-1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-loading-1280.jpg) · `1358511bb54d225e2431e293d18edd973663aa87b6de442edefadc876431adee`|同尺寸空图占位与右栏加载说明保留；未知摘要使用横线，没有伪零。图底禁用原因“加载中，暂不能推进”清楚。|PASS，图片层级/稳定占位；时间安全与异步闪现另验|
|[final-error-1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-error-1280.jpg) · `20075fcf2ec45f7d2dab7f80c5bed96c3d0210b79ddd5bafaa523342ba28abf8`|与历史 STYLE04 failure-1280 同类错误状态对照。失败原因、最后完整日、保留身份、重试/显式排除均可辨；实际数据显示到2024-06-19，主图没有长到失败日后。右栏内容自然内部滚动，toast 显示“合成重试…”。|PASS，重试后提示态的视觉；不是无 toast 错误首屏同态|

本批直接参考另包括 [STYLE04 compare1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/style-04-evidence/compare-1440.png)、[pressure1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/style-04-evidence/pressure-1280.png)、[failure1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-portfolio-backtesting/workbench-design/style-04-evidence/failure-1280.png)。历史图只用于批准设计的对照，不代替本轮浏览器事实。

第二批未发现重大视觉回退。已见七状态的局部视觉门可通过；**整套仍未接受**：最新修正后的 disabled-hover、启用主动作、Tab焦点、1300两侧及完整长文可达性待验，原生复盘、截止安全和持久化仍待最终证据。错误 toast 覆盖了右栏下部内容，符合临时提示角色；若要记录常态错误首屏，需另拍提示消失后的图。

## 6. 第三批：运行态范围、焦点、桌面边界与事件投影

本批所有下列图片均已由审阅者直接以 original detail 打开。父协调者声明最终重建 running 图及完整/边界/事件图使用源码 `3520318c2d366988de0540928501122f3bce8ea884a6a4e3955e3bef72613071`；最初 `final-running` 和前批 loading 图来自较早 `A51cc…`。图片 hash 与源码 hash 分开记录，旧图不替换或删除。

本次再用文件SHA-256及`sips`核对第5/6节15张JPEG：全部与表内hash一致，1440/1280/1301/1299图片像素尺寸分别与表内一致；当前workbench源码仍为3520318c…版。34个绝对文件链接均存在。图片像素尺寸仍不独自证明CSS viewport/DPR。

|图片 / SHA-256|独立可见的结果|判定|
|---|---|---|
|[before-running-confirmed](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-before-running-1440-confirmed.jpg) · `96f43bb54dc09ff34d7beb2ef8e87add9b667e804aa16946e6328d96d42e1b75` 与 [final-running-range](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-running-range-1440.jpg) · `adcbc39bc41688f2a27228a9d6c202067834644938d5d7421ce0a0a27b17502e`|同1440×900，2024-06-18、三交易日、净值1.0039；两图的14/17/18日横轴位置和曲线跨度直接相近，框架与摘要/持仓字段保留。“播放”实心深蓝、其余推进/回看次动作清楚，图为主体。|PASS，最终同范围 running 局部视觉；目测没有证明logical range数值相等或≤1px|
|[旧final-running](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-running-1440.jpg) · `55e278b86bb6398447a0c760d43043f7c426047eb7aa4fe7468beaf0ba76bddf`|同日期/三日但首点约x427、末点约x835；before约x307/795，跨度从约488变408。父协调者定位为先1280加载再改1440，LWC保留既有range；随后稳定1440并goto重建重新拍上行图。|F07：原比较条件不满足，保留过程证据；**不作为同range对照**。最终重拍关闭该视觉可比性问题，未判实现major回退，也未因此证明resize行为|
|[final-focus](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-focus-1440.jpg) · `d1534c0da001572479bf51c5f9552f3c9cca021a03b0d154d4b20d26e30f8910`|“推进下一交易日”有可见浅蓝外框，与“播放”的实心强调区分，回放条没有切掉轮廓。父协调者提供实际Tab到stepBtn记录，2px outline / offset2。|PASS，特定控件焦点视觉；图片原range沿用旧running，不作曲线位置对照，也不外推完整键盘链|
|[final-complete-1280](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-complete-1280.jpg) · `b24d8a43278975bc76b2ba617023c9119a77e52a8e6e2a70ef2af2d0b65fbb60`|1280×800，终值1.0484；主图、价格轴、日期、回放、检查区和已知范围可读，右栏字段完整。禁用play新增中性边界可见。|PASS，较窄桌面布局；宽度导致的历史可见范围不伪称与1440数值一致|
|[final-1301](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-1301.jpg) · `6932d6570326736aa1ef0d04920dc02b5074b8dc152086fb47f9df988fa943ba` 与 [final-1299](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-1299.jpg) · `a46d7d87f7e91c0f88742c45e1a974fc0592b1b762266b30e3136b8cd4f6e5eb`|1301/1299×800；≤1300身份本金/日期crumb、当前用户和摘要附注收起符合既有A规则，关键金额/百分比、工作区日期、图头、模式、轴和检查区仍可读；无可见相撞。协调者另记录DOM稳定后图底719。|PASS，断点两侧局部视觉；没有以目测替代模式位移≤1px实测|
|[final-event-projected](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-event-projected-1440.jpg) · `ed210572153ba62f672cff15b5526da8c671276bd034c088d5ecad85f6f8b3ab`|比较→6月18事件，全工作区日期/摘要/持仓同步；旧/目标/实际权重、费用和依据保留。返回动作清楚标“返回组合对比·截至2024-06-19”，不会与关闭混淆。|PASS，事件来源/层级视觉。折叠日期选择器不能证明只有3项；协调者实际3项→返回比较4项的记录属于其功能证据|

第三批关闭运行态主次动作、特定真实Tab焦点及1300两侧的图片缺口。未提供最终 disabled-hover/active 操作画面或computed记录、完整弹窗/名称可达性、原生复盘阶段与保存链证据；这些继续 NOT VERIFIED。200展开导航未实施；900/390只记录 min-width1100 的探索事实，不作A移动或融合导航接受。

另只读核对协调者保存的 [workbench-final-computed.json](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-final-computed.json)：viewport1440×900/DPR1、identity48、plot584、replay44、inspect320；启用play为白字、rgb(36,105,200)背景、13/20/500、高36，step为透明/辅助字色。此文件只有正常状态controls/layout，不含hover/active，也没有图表range或逐字字体来源。它支持正常控件几何/配色的提供者实测，不能补齐缺失状态。

## 7. 规范与覆盖文档的只读审查

检查对象为 [规范草案0.2](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/designs/2026-10-08-strategy-visual-system/README.md:1)、[diagnosis](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/designs/2026-10-08-strategy-visual-system/diagnosis.md:1) 与 [DESIGN-COVERAGE](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/DESIGN-COVERAGE.md:7)。未改这些文件。本节检查的是本轮文档可追溯性，不把归档交付包当现行权威规格。

短路径替换清单（使用仓库根相对完整路径即可；变成Markdown链接时按文件所在目录调整）：

|现有简写|准确来源|
|---|---|
|`elements.md`、`elements`|`docs/specs/2026-09-25-chart-first-review-ui-elements.md`，U02/U03/U04/U05/U06/U07均应连到具体元素/章节|
|`STYLE-04-CONTRACT.md` / `STYLE04`|`.scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md`|
|`round1-tradingview-reference.png`|`.scratch/strategy-portfolio-backtesting/references/2026-09-30-round1-tradingview-reference.png`（历史参考，非本轮接受证据）|
|`02-chart-workspace.png`|`docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png`；便携副本为 `docs/designs/2026-09-25-chart-first-review/handoff/images/02-chart-workspace.png`|
|`04-holding-stage.png`|`docs/designs/2026-09-25-chart-first-review/04-holding-stage.png`；便携副本为 `docs/designs/2026-09-25-chart-first-review/handoff/images/04-holding-stage.png`|
|`05-final-review.png`|`docs/designs/2026-09-25-chart-first-review/05-final-review.png`；便携副本为 `docs/designs/2026-09-25-chart-first-review/handoff/images/05-final-review.png`|
|`globals.css` / “现有Lucide”|`app/globals.css` 与对应控件源码；Lucide具体库/控件来源应继续写明，泛名不等于实际图标尺寸证据|

`rg --files`确认三张批准PNG在顶层和handoff/images均存在，逐文件SHA相同：02为 `a907b8031ca5ee3ead09b8500e5f823f6f310943a41dda347d5d66ee1e0ee11c`；04为 `3241fc77b7d5c6cf73b90f3550b8526c309b353435a918f82e2c155e811d10db`；05为 `2392cc92154276e8f5fec50ad3f260740f9caf9346905607c166ff972ec2f7d7`。顶层README确认A阶段方案已批准；handoff README明确包是v1.0便携快照，权威为两份 `docs/specs/2026-09-25-chart-first-review-ui*.md`。最新用户“不预设复盘栏数/比例”覆盖历史侧栏布局，原判断、计划、逐阶段揭示及来源等行为仍应逐项映射。

审阅者也直接以original detail打开这三张1440×900批准图：它们提供图上原判断持续在场、新阶段新增文字、金色计划/实际成交区分、价格轴完整及同一工作面推进的视觉职责。图中的D60/D69/D80、旧布局侧栏和英文画板眉题是历史设计内容，不据此要求新样板透露未来、预设复盘栏数或保留英文。新样板必须用本轮实际阶段图独立证实这些职责。

|文档缺口 / 例外|证据与建议|状态|
|---|---|---|
|一般输入40与紧凑36用途未区分|草案L39全称“输入36px”；IF06 L94明确一般输入/搜索/筛选40，只有A紧凑回放36。应分别列一般表单、A回放及本轮原生紧凑样板候选的用途/批准偏差，避免推广时覆盖40px契约。|需修订规范；不要求本轮扩大A回放|
|A空间预算和降密度边界未在规则表精确列出|草案说保留预算，但应直接列48/48/48/38/44/44/28/320及1440≥360、1280≥320，并引用IF06 L99；记录≤1300收起项、min-width1100、200未实施与900/390探索。后两项是验收边界，不能仅在未来推广写54/200。|需补参数/范围说明|
|圆角6/8和4px节奏仍缺现存例外表|草案L37给6/8规则；样板A保留`--radius:7px`、replay-date/speed/详情5、menu-item4、pill14、legend4与gap5/14。原生样板顶栏button仍5（CSS L46）。应将保留的合同例外写组件/目的/责任/视口，不能宣称当前全已6/8。|需补准确例外，保留A框架|
|字体链目标与两种实际链尚不完全同一|草案L21含Noto；当前A body L305/chart L476不含Noto且含ui-sans/-apple/Blink，原生CSS L2含Noto。两者都把明确中文字体放generic前，但Noto可用性/是否打包、Windows及实际glyph未证。应区分规范候选、实际实现链和跨平台NOT VERIFIED；可统一后再冻结源码。|实现链来源已核对；逐字/平台NOT VERIFIED|
|selected语义写成一律aria-pressed|草案L27只写aria-pressed；A inspection tabs实际用aria-selected（源码L592），原生工具用aria-pressed。规则应按tab/toggle等控件语义区分，视觉selected与focus可共存。|需修订表达，不能为样式强换语义|
|disabled优先级与状态参数仍可明确|F05证明原hover可污染disabled。草案只有原因/语义要求，建议列disabled文字#65758a、transparent、border#243145、opacity1及不被hover/active覆写；disabled对比度例外保留。需要最终实际状态证据。|SOURCE FIXED；真实hover/active NOT VERIFIED|
|元素级源/阶段字段和最新证据尚未逐项冻结|Coverage U05/U06列E IDs但依赖简写和旅程概括；需要具体规范章节、对应S0/S1/S2数据/文本形成阶段、补记来源、截图及实际选择/保存证据绑定。A cutoff日期修正也须列授权偏差，不能称全为token。|等待最终接受记录|
|版本/截图manifest及acceptance文件尚未完成|草案L7链接acceptance.md，但本次`rg --files`只见README和diagnosis；应补最终hash、viewport/DPR/range/state、提供者和版本，使早A51cc图与352终版分清。当前未完成是交付缺口，不借报告本身称系统通过。|待root补齐|
|缺失启动包|文档与Coverage均明示未定位；保持NOT VERIFIED。现有handoff能离线启动不证明用户所说的未找到启动包就是此包。|NOT VERIFIED，禁止猜认|

草案已明确角色差异、中文fallback证据限度、主题权威、图上原文/同源全文、形成阶段/复盘补记、独立接受门与后续推广范围，方向与当前任务一致。以上参数与例外修订完成前，规范只能标为待校准草案；最终复盘图片及功能证据到位后再检查跨上下文一致性。

## 8. 生产默认与样板opt-in隔离的源码审查

本节追加按协调者要求做全feature的只读隔离审查；基于当前 `git diff HEAD`，非浏览器实测。`git status`显示四个tracked文件改动：DrawingCanvas、ReplayChart、RecallWorkspace、app/page；新增样板组件、public和文档另列。审查期间Luna仍修改样板TSX，以下hash只冻结被审查生产文件的当时版本，不把施工中临时状态判作最终结果。

|文件 / 当时SHA-256|默认生产行为与opt-in边界|源码判定|
|---|---|---|
|[app/page.tsx](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/page.tsx:35) · `92be63f6bc89f0bb6672b6ffd942cd1bdd607227a15cc6d9d5136092e5f3af14`|review-design仅在`NODE_ENV !== production`且mode匹配时返回新样板；其余仍返回既有TradeReviewWorkspace。现有strategy/creation预览条件未变。|入口渲染SOURCE SCOPED；未执行production构建/路由实测|
|[ReplayChart](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/replay-chart.tsx:1021) · `1b9aa46bcfeddd25218ecead21d94634ba0eae985706caaf11f3722c3b347311`|仅recommended添加fontFamily/fontSize12；mode值加入建图effect依赖，默认undefined不因对象身份反复建图。data属性默认undefined，designPrototype继续传给DrawingCanvas。未改默认K线/成交/计划/盈亏/viewport算法。|默认值SOURCE PRESERVED；实际生产图回归仍须相应测试|
|[DrawingCanvas](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/drawing-canvas.tsx:134) · `1df969cff80e91b5c234fa635597d8d53aa6d3b7017d3dbd9139475b00f7c769`|paint新增可选textFont，默认仍canvasTextFont（600）；仅recommended选400。自动展开effect L505首个条件要求designPrototype，未传时无动作；data属性默认缺省。未改默认文本布局/命中/编辑/撤销/持久化算法。|默认值SOURCE PRESERVED；样板首次多行展开是授权样板行为偏差，应记录|
|[RecallWorkspace](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:2690) · `7089b3a8aa89e173a0cb72c31b5b1f2501d6867707f50fbe6f60c540cd6de61a`|safeStageProjection默认false；默认visibleDecisions为原document.decisions、计数仍“n笔决策”、统计仍“已揭示/总数”；原provenance仅在样板移到图附近，默认保留。新class/data默认不添加。未改默认repository/市场与执行截止。|默认表达SOURCE PRESERVED；样板过滤与已知计数是安全行为修正，不能仅称颜色token|

[生产TradeReviewWorkspace调用](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/trade-review-workspace.tsx:5270)未传designPrototype；`rg`全app确认只有新RecallDesignPrototype实际传此prop。默认decisions map由原map index改为`document.decisions.indexOf(decision)`，在已验证唯一决策数组中序号相同；这是未受flag限制的实现细节改动，未发现具体业务语义越界，但额外线性查找不能笼统称代码零变化。当前四个diff未见其它生产行为改写。

隔离结论为**源码范围PASS，运行回归NOT VERIFIED**。以下限定必须保留：

- app/page是开发渲染守卫；样板模块和CSS仍是静态import，public/design-system-20261008静态资产没有dev访问守卫。不能声称production构建完全不含样板。当前样板CSS选择器均限定`.recall-design-prototype`及其workspace，未看到裸全局body/button/SVG规则污染正式UI。
- stats目前条件是已知成交计数表达式，statsOpen和统计入口本身保持原行为；不能写成“S0/S1入口已隐藏”。是否每项统计值都受当前截止，需要实际阶段证据。
- [canonical-chart-capture](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/canonical-chart-capture.ts:263)未向paint传textFont，正式留存截图仍用默认600，而recommended live文字用400。正式产品保持原行为；若本轮要宣称样板留存截图同一字重，需补实际核对或准确列偏差。字体族本身与既有canvasTextFont相同，body CSS不是Canvas实际字体证据。
- [text-geometry](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/lib/chart/text-geometry.ts:121)仍以`round(fontSize*1.5)`给文本卡行高，14px为21px；与CSS正文14/22需记录Canvas例外，不能宣称所有文字已统一22。
- production数据库repository/默认设置保存未改。样板本地repository和隔离DB测试需由协调者实际save→return→reload证明，源码隔离不代替持久化门。

原生样板功能失败历史由协调者实际发现并提供，本审阅未重现操作：hydration/localStorage SSR问题、S0未来3笔列表/计数泄漏、设置菜单no-op、自动保存后撤销历史重置均保留**曾FAIL**。前两项已有opt-in源码修正，后两项本次仍在施工；计划值保存/返回/重读由协调者报告PASS。待冻结最终源码和阶段/窄屏/持久化图后，再记录独立视觉结果与功能提供者证据，不能凭新prop或工人结论直接转PASS。

## 9. 原生样板稳定源码与功能复验更新

协调者通知实现已冻结后重新读取四个生产diff及样板源码。app/page、ReplayChart、RecallWorkspace与第8节hash相同；[DrawingCanvas](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/drawing-canvas.tsx:503)最终hash更新为 `0f969da1e4fa40973a38eb6c2aa96595f53286b29dbb7601139e98ed55faf174`。自动展开改为`prototypeExpandedIdsRef`，只有显式designPrototype、`prototype-`前缀、可见多行text才逐卡自动展开一次，因此随后S1补充可以首次完整出现；省略prop的正式生产调用仍提前返回。原绘图/撤销/默认600路径未改，SOURCE SCOPED结论继续成立。

最终新增样板文件hash：

|文件|SHA-256|只读确认|
|---|---|---|
|[recall-design-prototype.tsx](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.tsx:33)|`b28fa2c874e42bd31afc29b746b9be8c7539face122c0c4bedfa8b0e184b86e1`|挂载后读取项目图表设置，React状态响应设置交互；不调用saveChartSettings。episodes/instruments/candlesByTimeframe/designPrototype使用稳定memo，保存回调稳定，避免每次保存重建输入触发加载。实际撤销回归见下方提供者证据。|
|[data](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype-data.ts:73)|`395d3997c4b322b54bd9675a0dcd0a64c6a8beb41aed8001eb5a11843a0987d4`|原判断注明S0形成、复盘补记及当前可知边界；持仓补充注明S1形成/复盘补记；合成行情和独立localStorage样板key。实际可见阶段仍须图片/动作证据。|
|[CSS](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.css:1)|`75b146c6ae8acf5a03c145c7a955312862ad38707d88930507801f129a7ac417`|全部限定样板wrapper；推荐角色18/24/600、16/24/600、正文14/22（CSS字重继承）、13/20/500、12/18；18px/1.75图标，桌面36px控件与≤900的44px最小高度。具体角色/触摸区是否在渲染正确仍等截图/测量。|

推荐live Canvas明确400，图表轴字号12；**canonical-chart-capture仍未传textFont、默认600**，Canvas14px行高仍21。CSS fallback含Noto但Canvas/轴链不含Noto，跨平台实际glyph仍NOT VERIFIED。app/page仍是开发渲染guard，静态import和public资产仍存在；不能写为生产包未包含样板。未新增其它tracked生产改动。

补查本地运行时生成的 [Geist font-face](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.vinext/fonts/geist-8ac0455e797f/style.css:1)：family实际声明为`Geist`，100–900可变字重，列出的unicode-range是拉丁/西里尔/越南语而无中文区间；[layout](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/layout.tsx:6)通过next/font载入Geist。它证明该本地运行时存在同名face声明，不能证明每个可见中文字选中了PingFang、微软雅黑或Noto，也不能代替字体网络加载和逐字渲染证据。

协调者完成真实浏览器复验并报告：第二条多行文字绘制→自动保存完成后undo仍enabled→实际undo后redo enabled→实际redo成功；S0图层只有原判断和两条测试文字，没有S1未来补充。该旅程记为**提供者功能PASS（修复后）**，本审阅未执行浏览器。此前undo reset **曾FAIL**保留，不能抹去失败历史；计划保存→返回→重新读取也沿用协调者提供者PASS。设置交互SOURCE FIXED，是否实际菜单各项均成功、最终阶段/窄屏视觉仍待证据。

## 10. 原生最终1440阶段、选中与真实焦点的独立视觉接受

审阅者使用view_image/original直接逐张打开下列六图，再直接打开批准02/04/05/07作对应广义阶段职责比较。六张JPEG尺寸均自行解析为1440×900；协调者提供viewport1440×900/DPR1及固定settings/known-range说明。[基线S0](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-baseline-s0-1440.jpg)是**同一合成fixture、同一opt-in阶段安全与补记样板的原主题**，不是未经改动的真实业务页面。只有S0提供了同fixture基线/推荐配对；S1/S2按批准广义阶段检查，不称逐像素或同一真实数据配对。

|图 / SHA-256|直接观察与批准职责比较|局部视觉判定|
|---|---|---|
|baseline-s0 · `371851d96a52a283771bf95e45069634a8b718d0a163042240d348e2977428fa`；[final-s0](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-s0-1440.jpg) · `11f3628f8042d0af264ab4dda2afa710e10f77a83950c37b98bac818b1e135cf`|推荐原判断减字重后全文仍可读，明确S0形成/复盘补记/可知范围；0笔已揭示、成交尚未揭示。计划56/52/68、1000股、风险4000、3R及参考资金200000保留；52/56轴标签与右表单分离，68超当前轴范围保留数值及“显示计划价格”。对照02的计划与轴职责，未来事实未呈现。|PASS，S0密度/层级与图表职责；全future-state安全仍靠提供者动作门|
|[final-s1](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-s1-1440.jpg) · `b0e3cdef9f9c9da51f03ffa89a4cb7b3b317f69da58695f70d27c968a4e93434`|原判断全文未替换，新增全文卡注明S1形成/复盘补记；1笔已揭示、真实买入标记和持仓1000出现。右栏展示原计划只读与当前执行；金色计划/成本标签和主题青涨红跌与动作蓝区分。对照04的原计划仍在、新持仓信息随揭示出现。|PASS，所示S1视觉；不以此证明所有推进/返回range算法|
|[final-s2](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-s2-1440.jpg) · `f848e2330132cbde24764b4943007a1a210b18cf3077fd1416b8cf495697f552`|原判断与S1补充均留在同一画面；3笔已揭示、持仓0/net6800，行情可知至Apr10与成交截止Mar15分别标明。原计划56/52/68独立保留；事后退出评价是独立选择/人工补记，并明确不按盈亏自动评价。对照05的计划/实际并列及分次退出职责。|PASS，所示S2视觉；两退出持久化引用/不串值另用提供者证据|
|[final-selected](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-selected-1440.jpg) · `6718e81fcc22292c9d66adae509b9d316565325bd106ed6a94f63119156c7dcd`|绘图选择、阶段、数量模式的选中填色/描边仍清楚；打开图层后原判断有选择控制点，列表项目为蓝边。图层浮层遮住stage context右端及价格轴顶端刻度，56/52计划标签未遮。|PASS，selected可见；遮挡例外待界定，不能写所有状态价格轴均无遮挡|
|[final-focus](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-focus-1440.jpg) · `a2a01524e7be20984a93f6c7dfbba780281064419dcf10efd8017f09f8e002c6`|协调者实际Tab来到初始止损输入，外侧焦点环清晰独立于字段正常边框和阶段selected，数字仍可辨认。对应07焦点解释职责。|PASS，特定真实Tab焦点视觉；完整键盘/IME仍需实际旅程|

批准 [07-interaction-states.png](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/designs/2026-09-25-chart-first-review/07-interaction-states.png) 精确路径已确认，SHA `355deddf537dd1e58860c5b31b4beeedc142fbf515ed3e5f789540248130cec4`，与handoff/images同名副本字节相同。02/04/05/07是历史设计和交接说明，保留阶段、原计划、中文、价格轴、轻量交互职责；本轮最新用户授权不同数据、充分原文、阶段来源和不预设复盘栏数，不能把历史固定侧栏数/卡片坐标当本轮必须复制的比例。

偏差与接受边界明确如下：推荐样板保留既有原生工作区导航/侧栏结构，用独立样板工具条和合成行情提示实现可逆比较，工具条不是未来产品新增业务导航承诺；S1仍可展开原计划侧栏，对比04默认隐藏图是可开关状态差异。历史示例有费用40/净6760，本fixture费用0/净6800有源码数据依据，不是主题或计算差异。原判断和S1长文首次完整展开、图附近双截止/形成阶段/复盘补记、已知计数过滤均是样板授权行为变化，不能称所有差异只来自CSS tokens。REVIEW是合成标的代码，Asia/Shanghai是时区标识，业务动作和标签已中文。

阶段/主动作视觉本地PASS：同一蓝色主动作族，原生“下一笔决策”为唯一实心主蓝；逐K、播放、留存使用辅助表达，阶段selected和mode selected为浅蓝/描边，图表盈亏与计划金色独立。推荐原判断400与较清楚的边框减轻基线过粗密度，未改造为另一套产品主题。图层浮层覆盖轴顶端是既有overlay实现，当前图不是Text编辑器；[elements §115](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-25-chart-first-review-ui-elements.md:115)禁止Text编辑遮挡价格轴，因此完整编辑状态接受需真实Text编辑图或明确例外，当前selected图不能补该门。

只读查看 [recall-final-computed-1440.json](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-computed-1440.json) 的提供者正常态测量：viewport1440×900/DPR1、scrollWidth1440、fontStatus loaded；标题18/24/600，右h2 16/24/600；next13/20/500、白字/rgb(36,105,200)，绘图选择36×36。源与视觉相互支持，但没有hover/active或逐字glyph证据。周期仍Geist Mono，selected 1D为500（阶段600）；搜索/图层/设置/多数周期按钮宽31、高36，规范须列这些既有紧凑例外，不能宣称所有selected都600或所有桌面命中区都36×36。

协调者实际S2退出2@61选择“按计划+计划内分批”→S0→重新读取→S2→选择退出2保留，提供者功能PASS；审阅者只读 [reload DOM](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-exit-persistence-after-reload.dom.txt:120)确认退出2 selected、按计划checked、计划内分批selected。关闭/再开计划保留也为提供者PASS，不能以DOM终态独立证明整条操作链。900/390等窄屏、Text编辑及样板整个适用接受门仍待证据，本节不宣称feature完整通过。

## 11. 最新SQLite读取边界、默认隔离及测试失败复审

重新只读核对当前源码，四个tracked生产文件仍为第9节稳定hash（page `92be63f…`、ReplayChart `1b9aa46…`、RecallWorkspace `7089b3a…`、DrawingCanvas `0f969da…`）；`git diff --stat HEAD`仍只有这四个文件，70插入/9删除。它们的推荐字体、逐卡首次展开和已知决策投影继续由显式designPrototype限定，正式调用省略prop；未发现新增生产数据库、正式默认主题/尺寸、持久化算法或正式导出字重改变。默认路径的实际完整生产回归仍NOT VERIFIED，静态import/CSS以及public资产可进入生产包的边界仍成立。

第9节样板TSX和CSS是较早快照，当前替代版本如下，不能将旧图自动绑到此版：

|文件|当前SHA-256|本次只读确认|
|---|---|---|
|[recall-design-prototype.tsx](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.tsx:25)|`77a2327a613d950e724622965e45ccaa58b8e73f57ff52649aa9f5ea07394a67`|挂载后`readPrototypeChartSettings()`→SQLite HTTP client `getSettings()`；ChartSettings只为type import，移除了migration-only模块runtime依赖。读取失败给role=alert；没有静默替换默认设置。设置交互只setState；未调用putSettings。|
|[recall-design-prototype.css](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.css:298)|`cee93e6911be0419d15909ea266b612ef0d2fca24b0271b8e13a5046f1fc2020`|最终响应式推荐wrapper在≤1330改全页固有高度纵向流，chart-stage480px；≤600为720px，≤900控件min-height44px。基线wrapper和正式页面不适用这些规则；不是单纯字号/颜色改动。|

[sqlite-http-client](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/lib/storage/sqlite-http-client.ts:157)的getSettings是GET `/api/storage/settings` / no-store，putSettings另为PUT，本样板只调用GET。该读取连接权威设置边界，合成复盘写入仍走独立localStorage repository；不是“完全不接触SQL读取”。production API模块未在本轮修改。两项新增[测试](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.test.ts:47)注入getSettings，验证成功返回和失败拒绝；它们没有渲染role=alert或证明真实浏览器HTTP失败界面，不能扩写为完整错误态UI PASS。

只读审阅[test-failure-audit](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/reports/test-failure-audit.md:1)及其命令/计数，以下是**提供者测试证据**，本审阅未运行这些套件：

- 历史全量并行结果必须保留为 **31 failed / 2694 passed / 6 skipped**。任务新增的legacy settings runtime import结构回归已针对性修复；不能把所有31项归为基线或资源争用。
- holdings独立28通过/1失败，干净9c2b3d2 archive同28/1；2026-09-02固定日期在本次2026-10-08超过30天。该项基线失败已提供对照。
- storage边界修复前1通过/2失败，修复后2通过/1失败；剩余“交易室共享范围”DOM等待在9c2b3d2 archive亦2/1，已提供基线对照。
- refresh7通过、deploy Vitest58通过、完整workspace独立79通过；并行原失败在独立运行未重现。与争用一致是**推断**，不构成逐项根因证明。`node --test`不是该Vitest测试文件的有效runner。
- 最终影响范围8文件189测试独立通过，typecheck提供者通过；新增样板6测试通过。全量并行修复后未重跑，**全量绿仍NOT VERIFIED**。

canonical-chart-capture仍省略textFont→默认600，recommended live400；Canvas14/21，CSS正文14/22；CSS含Noto而Canvas/axis链不含Noto，跨平台逐字glyph仍NOT VERIFIED。以上为明确实现边界，不因SQLite修复被消除。

## 12. 修复后的窄屏直接视觉比较与失败保留

审阅者view_image/original直接打开下面五图，并重看批准02/07。JPEG尺寸和hash独立解析；fullPage高度不是视口高度。协调者提供390×844、1280×900及实际稳定视口说明；900图是全页截图，不冒充900×800视口内全部可见。390/900图拍于CSS `4b627cf853997cd07729ee26b00f21787eb255135294d047c371bc4134a1febc`，当前cee93在这些断点规则相同是源码/协调者版本说明，不能写为全部重新拍于cee93；1280图是cee93最终修复版。

|直接查看图 / 尺寸 / SHA-256|观察|局部接受|
|---|---|---|
|[repaired-s0-390-full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-s0-390-full.jpg) · 390×1967 · `f571f1b61af9955f83c0beb647060c7a5e4adfb3b3d3767fc352b4a11665455a`|原判断S0来源/不确定性/完整计划与20万元可读，OHLC与Text顶部不再叠；52/56轴价仍在图内，目标68在下置计划内，正文/表单/回放可按页滚动。计划线左标签穿过Text局部，68在卡内换行分开为6/8；顶栏本地数据被压窄。|原文底部裁切修复PASS；局部叠字/顶栏裁切保留|
|[repaired-s1-390-full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-s1-390-full.jpg) · 390×1896 · `88838db88626eb348b9aad834d6229c010fa5ea820ea2e7cd4f05e97eb9a5dee`|原判断全文仍在，S1来源/当前观察/后续随回放揭示完整新增，买入/成本/计划与右轴独立；下方原计划56/52/68、1000股/风险4000/3R和当前持仓1000完整。底部动作行在fullPage绘制空白，不能凭此判按钮消失或可达。|原判断保留与阶段补充局部PASS；动作另用独立视口图|
|[repaired-s1-900-full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-s1-900-full.jpg) · 900×1505 · `79d6aa09c3e5a24452ec2211051b88ca905259dee3367c2a6b53c65a0c70bf42`|原判断和S1全文各卡独立、价格轴在内、真实买入标记和56/52计划可见，下置完整原计划/当前持仓/主要下一决策可见于全页。计划线左标签跨过Text，紧凑本地数据可见仅地/数。|旧220高裁切修复PASS；顶栏E01完整可读尚FAIL|
|[repaired-s0-1280-full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-s0-1280-full.jpg) · 1280×1539 · `223cf32953a3818eef20394eb475a4f4864357b3bc79ea921aa4e88d5183991f`|最新全页纵向，S0全文、OHLC/价格轴及下方完整计划输入/资本派生值可读。相较1440右栏排列明显改为下置，主要动作须滚动到下方；不称相同折内布局。|整页可达/全文与计划字段局部PASS，登记响应式偏差|
|[repaired-390-action-viewport](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-390-action-viewport.jpg) · 390×844 · `fa0a5791665b89623963d9c481b1d73d2bb6f170ffc81e4fb29bc92a649699d5`|真实滚动终态中完整原计划和持仓400/已实现4800，逐根/播放/下一根/下一笔决策及适应全部/更多完整可辨，主动作44高由协调者测量。该图补充fullPage绘制空白的实际视口证据。|特定滚动后主要动作视觉可见PASS；点击D68后持仓400为提供者实际功能PASS|

[repaired-computed-390](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-computed-390.json:1)是协调者提供测量：viewport390×844、scrollWidth390/scrollHeight1896、stage328×720，sidebar374×534；当时页面已滚动，负y不是内容消失。[1280测量](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-repaired-computed-1280.json:1)给viewport1280×900/scrollWidth1280、shell1252×510、stage1202×480、plan1252×597。它们支持宽度/尺寸边界；不是屏幕键盘、touch手势、所有按钮操作或Text编辑无遮挡的证明。

历史 **FAIL** 保留：直接查看[recall-final-900.jpg](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-900.jpg)900×800，SHA `7d7e8d939071356101661ced32aeb9e065b3094a411a174906bf1ecb69a91756`，旧75b146版原判断顶部与OHLC叠、全文计划/资本尾部被220高趋势区裁切。初390/1280的裁切FAIL由协调者实际报告并留图，本审阅不假称逐张重现；只有本节新对应版本补图关闭局部裁切/可达问题，不删除旧失败。

**响应式偏差必须明确登记**：[elements §6](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/specs/2026-09-25-chart-first-review-ui-elements.md:107)及批准07描述上部约200–240趋势区/下部独立滚动；当前≤1330为480高图、≤600为720高图和全页滚动，所有工具/回放随页离开首屏。最新用户允许不预设栏数/按内容安排并要求图上原文完整，支持此可逆探索；它是本轮推荐候选的实际布局行为变化，不能宣称旧契约逐条无偏差。正文展开占用较多图面积、价格轴仍在图内，下方计划与主要动作经滚动可达，符合本轮所示阅读目的。手机软件键盘和完整触摸旅程未测，生产推广前须另验。

当前残余：1）[ChartToolbar完整本地数据源文案](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/chart-toolbar.tsx:148)在390/900实际可见只有“地/数”，E01完整可读不能写全PASS；2）计划线左标签在展开批注区域局部叠字，原文主内容能识别但视觉可读性待优化；3）Text真实编辑/IME/拖动无遮挡未验证，selected图层浮层也遮轴上端，本节不关闭该门。

## 13. 规范/覆盖文档0.3只读复审与整套边界

第7节针对0.2的缺项是当时真实状态。当前[README0.3](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/designs/2026-10-08-strategy-visual-system/README.md:1)已补一般输入40/样板36、A精确54/48/38/44/28/320预算、200未实施与900/390未适配、圆角7/5/4与gap5/14、A无Noto与nativeCSS有Noto、disabled级联、Canvas14/21例外、aria角色差异；[acceptance.md](/Users/zhoulin/.codex/worktrees/facb/TradeReview/docs/designs/2026-10-08-strategy-visual-system/acceptance.md:1)现已存在，第7节的文件不存在缺项关闭。覆盖使用精确elements及STYLE04路径，不能继续只写模糊简称。当前文档仍在整理，审阅者未修改root文档。

剩余应准确固化的参数/例外：

- 桌面搜索/图层/设置/多数周期31×36、15m35.4×36，绘图36×36；周期selected Geist Mono500、阶段selected600，不能一概称36方形/全部selected600。
- nativeCSS fallback含Noto，Canvas与axis链不含Noto；正式capture600/live400，CSS正文22/Canvas21，完整值和影响应各列。
- 原生≤1330纵向固有流/480，≤600/720，与旧200–240/独立滚动的差异、原因、已测390/900/1280、软件键盘NOT VERIFIED及负责人应列，不混入A320空间规则。
- 图层overlay遮轴上端、计划线左标签跨Text、紧凑数据按钮裁切，按实际证据保留，避免写所有状态轴无遮挡/完整名称全PASS。
- 历史31FAIL/全量未重跑、真实hover/active、跨平台glyph、手机键盘/模拟与物理触摸、实际wheel/Tooltip、正式SQL整条链与三阶段导出仍显式NOT VERIFIED或历史FAIL；缺失启动包专项NOT VERIFIED。

精确引用替换仍建议：`elements.md`→`docs/specs/2026-09-25-chart-first-review-ui-elements.md`；`STYLE04`→`.scratch/strategy-portfolio-backtesting/workbench-design/STYLE-04-CONTRACT.md`；批准02/04/05/07→`docs/designs/2026-09-25-chart-first-review/{02-chart-workspace,04-holding-stage,05-final-review,07-interaction-states}.png`（这些图与handoff/images副本逐字节相同）；`globals.css`→`app/globals.css`；`Lucide`→实际`app/components/chart/chart-toolbar.tsx`/`drawing-toolbar.tsx`及共同CSS规则精确路径。资料名不是运行测量来源。

整套判断：两业务上下文已能以真实LWC/原生组件展示同一推荐动作蓝、现有盈亏色、中文字重层级、形成阶段/复盘补记和原判断持续保留，可以作为**可逆、可评审样板及规范候选**交给用户。当前已见桌面/窄屏阅读与实际主动作局部门通过，生产默认路径源码隔离有依据；紧凑文案裁切和局部批注叠字尚存，适用交互/响应式偏差仍需明确登记，**不能宣称整套视觉通过、原契约无偏差、全量测试绿或生产控件100%接受**。这与可提交用户选定的候选范围不同；正式推广要按用户选定范围另行实现与验收。

## 14. de678两项修复的独立直接复验与390角色区分新失败

CSS随后改为 `de678a0cb52491f97f04377b73d7479924438e282712d1a3fbcfa1b379b45f36`（501行），第11/12节cee93与更早4b627图是其之前的版本，不能用它们直接关闭新修复。审阅者只读查看最后规则：本地数据badge non-shrink/min-width90/nowrap，≤900 min-height44；`aria-label$="，精确编辑"`命中按钮width112/right36，隐藏重复文字并保留透明背景、原aria/title/事件以及focus-visible2px/offset2。规则仍限定recommended wrapper，未改TSX、生产CSS或A。

随后审阅者view_image/original直接打开四张新图，独立解析尺寸/hash如下：

|图 / 尺寸 / SHA-256|直接观察|判定|
|---|---|---|
|[accepted-s0-1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-accepted-s0-1440.jpg) · 1440×900 · `4c8c7391242b3cdb1afb647300846fea975c5bde0a880213506e55bb83f1d9cf`|完整本地数据，S0双截止紧邻图、原判断全文/计划与20万元仍在，无重复左侧白字穿Text。轴上计划入场56/初始止损52名称与完整价独立、目标68在侧栏。|两项局部修复PASS；S0角色/未来可知所示态PASS|
|[accepted-price-focus-1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-accepted-price-focus-1440.jpg) · 1440×900 · `14e2426915a9d18ca5bd990d9b876de7993c910f3b6f3030e7a46e700c8d2451`|真实Tab到入场hit，蓝焦点环完整包围右侧计划名称/56价格，未被轴容器裁切；附近当前价56.50仍可辨。顶部阶段截止在sticky层下；此前称page-scroll28不准确，后续协调者定位为隐藏图表祖先内部scrollTop28，见第16节，window.scrollY不能排除此失败。|特定实际Tab焦点环视觉PASS；阶段可见性FAIL，后续新图复验|
|[accepted-s1-900-full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-accepted-s1-900-full.jpg) · 900×1505 · `f87e7af1958cce394a6461c8ee71746365274b26d98f20b282f471a5cca2bebe`|完整本地数据，原判断/S1补充保留且重复左侧计划白字已去；右轴成本56/计划入场56/初始止损52名称完整，买入标记可见；原文、下置原计划与主要动作完整。|窄屏两项局部修复PASS，所示900角色区分PASS|
|[accepted-s1-390-full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-accepted-s1-390-full.jpg) · 390×1896 · `7fbaced145d2ff88ff0ea964ae0f776c895cc44cee2a7688bac2880d63c25c1c`|完整本地数据、原判断和S1全文、已知成交1笔、持仓1000与下方原计划56/52/68完整，白字穿Text消除。展开卡仍盖住右轴gold名称及实际买入标记，右轴只看见两处56.00和52.00。|裁字/重复白字两项PASS；图上计划/实际角色区分FAIL，需修复后复验|

协调者提供badge390实测93×44、plan-hit112×36，符合源inline minHeight36优先的发现。该紧凑价格标签命中区36高须登记触摸例外，不宣称所有窄屏控件44。点击初始止损hit实际聚焦初始止损INPUT value52/outline2，为**提供者功能PASS**；本审阅没有执行点击操作。旧裁字/重复白字FAIL和第12节图保留，以上新图独立关闭对应局部问题。

**新FAIL的原因及门槛**：390的成本与计划都是金色、同为56.00，角色名被批注底遮后无法靠位置或颜色分辨；买入菱形/名称也在同一遮挡区。下方原计划摘要只解释计划56/52/68，不解释两个轴价哪一个是实际成本，因此不能以侧栏数字完整抵消图上计划/实际区分。900与1440具备清楚名称，390需要在图附近保留可见完整名称+价，或让展开原文避开角色标签/已揭示成交；成本/实际行必须继续按当前已知截止，S0不得出现未揭示事实。完整原文可读和图上角色区分要分别成立，不能通过隐藏原判断来消除问题。该项在最终修复前阻止390图表角色的视觉PASS，不扩大为生产默认缺陷修复授权。

## 15. 窄屏价格角色修正的冻结版独立接受

本节冻结源码快照：RecallWorkspace SHA `38896bdf912b7c9c1845212789249112935d7d63c342aea6f8c575fe64f524ec`，样板CSS SHA `ad14a9b379c714b56ff37e2040782d160a88cf604a40cb64d4662bbe4b32b522`。这是第11节之后的新改动，不能继续把Recall旧7089b3a或CSS de678称该次版本；后续CSS见第16/17节。四个tracked生产文件仍为page、ReplayChart、DrawingCanvas、RecallWorkspace，当时diff总123插入/9删除；本次新增价格角色helper/节点在RecallWorkspace中，除此三文件hash不变。

[buildRecallPrototypePriceRoles](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:266)首先要求mode=recommended。它复用[当前planPriceLines](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:1141)，实际成本使用[chartExecutions→position](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:1213)：编辑快照受executionCursor限定，普通回放只revealedExecutions，完整history由用户显式进入。S0优先只报“实际成交尚未揭示”；S1成本还要求quantityAvailable/pnlAvailable、非零数量及有效成本；S2只有已知零持仓才报“实际已清仓 · 持仓0”。未发现新helper读取episode未揭示成本。计划行是当前图上同源计划，不擅自补充未记录价格。

[新节点](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-workspace.tsx:3010)在阶段说明下、ReplayChart外，正常文档流排列；[CSS](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.css:505)默认display:none，仅≤600推荐wrapper显示四行单列12/18文本，计划金色/实际muted各有左边线，不靠数字位置区分。正式调用和baseline不产生该节点，900/1440没有新增可见信息带。page准确条件为NODE_ENV!==production，而非仅development字面条件；生产渲染被挡住仍不等于静态import/CSS/public资产不打包。

四项[price-role测试源码](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall-prototype-price-roles.test.ts:11)覆盖S0即使输入有成本仍不显示、S1已知成本、S2零持仓及baseline不增加行。它们是有意义的阶段反例；当前源条件还保护未知数量/成本，测试未覆盖这些分支。协调者最终提供typecheck及9文件193测试PASS/35.05s，本审阅没有执行这些测试；它们替代第11节修改前8文件189的影响范围结果，**不替代历史全量31FAIL/2694PASS/6SKIPPED，也不把未重跑全量写绿**。生产默认全部运行和导出仍NOT VERIFIED。

协调者确认冻结CSS ad14a9 / RecallWorkspace Git blob `3fd2281ce7cbec007d207462fc2128f503f3f3bc`（本审阅独立hash-object一致），随后补齐S2与真实主动作图。审阅者view_image/original直接看四图并独立解析JPEG尺寸/hash；fullPage高度不当视口高度：

|最终图 / 尺寸 / SHA-256|独立直接观察|范围接受|
|---|---|---|
|[price-roles S0 390](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s0-390-full.jpg) · 390×2071 · `29eba88a61cf299393d63b3c6b1bb68279b4ee006d687ce012553fe82cd33245`|阶段/完整行情截止、复盘补记、计划56/52/68和“实际成交尚未揭示”完整，不显示actual cost；0笔已揭示决策，原判断全文/20万元及完整计划保持。|S0角色可读/未知实际未泄漏PASS|
|[price-roles S1 390](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s1-390-full.jpg) · 390×1956 · `d1cfdfc977dd752fcd0d172b0c45de550e010f21f03303bd449672a6842e68cc`|同三条计划名称与价，实际成本56.00 CNY另行说明；行情/成交均Mar1且明确时区，1笔已知、当前持仓1000；原判断与S1全文继续完整。|S1计划/成本不混淆、原文持续保留PASS|
|[price-roles S2 390](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s2-390-full.jpg) · 390×2912 · `0dc9cfbbc756e0f0682546e8809934c426e0426a52a9f07016cb92fc5bb755e6`|完整Apr10行情/Mar15成交截止，3笔已知、实际已清仓/持仓0；计划56/52/68仍完整，原判断与S1全文保持；下置净6800 CNY与退出评价、返回买入前判断入口可见于全页。|S2已清仓角色、原文/阶段来源PASS；不称折内全部可见|
|[price-roles action 390](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-action-390.jpg) · 390×844 · `7743154fe05a6395cc1ad802e6b7d5d13f811f0453aea3af78bdd44d40ada408`|真实滚动视口内Mar9当前持仓400/已实现4800，完整“下一笔决策”与辅助动作可读，按钮位于右边界内。|这一实际视口主动作可读PASS；其他按钮同时可见不成立|

协调者实际测量下一笔rect x264.84/w108/h44/right372.84、viewport390/scrollWidth390，支持最后图的完整命中区；实际Mar9推进与持仓变化仍属**提供者功能证据**。回放行是内部横向滚动，计划侧栏x505，上一根左端少量裁绘。S0 fullPage右端裁绘不能当按钮消失FAIL，也不能称全部按钮同时可见；本轮只接受已实际滚动到达的主动作及已记录的按钮旅程。

第14节的新价格角色FAIL由这一冻结版三阶段/source证据关闭，历史FAIL图继续保留。S1实际成交标记仍在展开Text后，**价格角色可读PASS不等于成交标记无遮挡**；这是已登记的窄屏样板探索例外，真实Text编辑/IME和所有缩放视野中的标记可读仍未验证。没有用隐藏原文、模糊价格或新增未来成本消除问题。

当时scroll0追加图已直接查看：[delivery S0 1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-delivery-final-s0-1440.jpg)、[S1 1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-delivery-final-s1-1440.jpg)、[S2 1440](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-delivery-final-s2-1440.jpg)均1440×900。S1阶段/双截止在这些静态快照完整可见，原判断/S1全文、S1买入菱形、成本与计划各名、当前持仓1000和辅助/主要动作清楚，S0未知决策0、S2已知3/持仓0/净6800与各截止继续区分。但它们没有覆盖实际fit/价格focus之后的内部滚动，不能关闭第14节阶段可见性FAIL；此前据此作出的关闭判断已撤回，见第16节真实回归与新复验。三个阶段均未出现新价格角色带。S0/S1阶段回放下仍为唯一实心主要“下一笔决策”；S2禁用推进且完整返回入口可辨。此轮截图在此前窄屏后保留较近的图表窗口，不能冒充与第10节旧S0基线图具有相同chart range，也不将S2所示窗口称全部成交标记同时可见。

[delivery S1 900 full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-delivery-final-s1-900-full.jpg)900×1505直接图中，完整阶段/双截止、原判断/S1全文、买入标记、成本56/计划56/止损52角色、下方完整计划和主动作均可读，未出现新带。鼠标停在历史Feb13导致OHLC/Crosshair显示该已知bar，图只支持这一局部历史交叉线，不证明所有hover/未来过滤通过。

协调者[1440实测](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-delivery-final-1440.json:1)为1440×900/scroll0/scrollWidth1440、chart782×696、priceRoleDisplay=none；[900实测](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-delivery-final-900.json:1)为900×800/scroll0/scrollWidth900、chart822×480/display=none。源码display边界与实图一致，可关闭“desktop/900无额外可见带”这个限定门；window.scrollY0不能证明隐藏祖先scrollTop0或上下文仍可见，也不能以该测量代替总体无溢出或交互接受。696是本次旧版本的图高，后续flex版本不可沿用。

以上追加图独立SHA-256：S0 1440 `d9822c5c7308b9becce07be042ef443c5b400cd0a78adbef8d1aab91cc9d16a6`；S1 1440 `661287a219adcaf452615177b2f2a4b6b2f265a86667a4f417aa7f3481a4ff9b`；S2 1440 `c8ce96463b764c960e6e390e1faa6abf49a1eb6322bf9780e730decfaf9d1518`；S1 900 `bcad19d13a44618271bb58914937827c5cc2beb11072bb6019a83af2a27400e9`。仅上述明确状态/版本接受，不从worker报告或根测试计数推导其他视觉门。

规范最新复审：README已明确31×36/周期Mono500、112×36触摸例外、CJK链差异、capture600/live400、1330/480及600/720的探索偏差、价格角色区与图层overlay例外；第13节相应缺项关闭。仍须保留缺失启动包、字形来源、真实hover/active、Text编辑/IME、触摸、Tooltip/wheel、导出、正式SQL链等NOT VERIFIED，以及历史31FAIL/全量未重跑。明确这些边界后可交用户评审推荐候选，不能推广为生产100%接受。

## 16. 桌面fit/价格焦点阶段遮挡回归及实际复验

第15节的静态window-scroll0不足以接受fit/focus旅程。协调者随后实际点击“适应全部”、Tab到价格精确编辑，发现overflow:hidden图表祖先发生内部scrollTop28，阶段说明被header遮住。审阅者再次view_image/original直接打开两张1440×900失败图：[comparison-fit recommended](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-comparison-fit-recommended-s0-1440.jpg)，SHA `8db2205e008e5eeeb3bc5e934dfb0322306e3811db77f41a413f3df2c9c3e8bc`；[同次scroll0](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-comparison-fit-recommended-s0-1440-scroll0.jpg)，SHA `f2c072d73814b737de2455c564bde0a2f5cb4239c8a0b208423d83df35149996`。两图均看不到阶段/完整双截止，首个绘图选择按钮上端被裁；原判断、计划输入和下一笔动作仍完整不能抵消阶段可知性**FAIL**。内部28px是提供者定位，图片本身只直接证明遮挡；此前第14节“page-scroll28”已更正，第15节仅凭静态图作出的关闭已撤回。失败图继续保留，不因后续同名scroll0描述改成PASS。

修复先由协调者绑定CSS `f41e222319bb83eab43d87d134464514f2a6b689bf2296f1d39d41f6d9f26bc3`。审阅时磁盘已为第17节67e版；桌面块仍相同，历史f41e截图绑定来自提供者说明，不能称本审阅独立hash了已经被替换的f41e文件。[桌面修复块](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.css:477)仅≥1331且recommended wrapper：column纵向flex/min-height0，context flex0 0 auto，chart flex1 1 0/heightauto/min-height0。原[container规则](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/recall/recall.css:450)的stage height100%再加context确实可使内容超过shell；新规则让context正常占行、图表分配剩余高度，匹配[ResizeObserver](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/chart/replay-chart.tsx:1160)读取实际空间。没有改默认生产CSS、阶段数据、共享颜色或字体，≤1330/≤600图高规则不在这一media区内。这个源解释合理；源检查不替代实际看图。其他桌面高度、1330/1331边界和专注布局全旅程仍未因此通过。

以下新图均直接view_image/original，尺寸/hash独立读取；日期/fit动作顺序、实际Tab及源码拍摄版本由协调者提供。baseline是同合成fixture、同阶段安全seam的原主题对照，不是未经修改的生产业务页。

|新图 / 1440×900 / SHA-256|直接比较|局部接受|
|---|---|---|
|[v05 fit baseline S0](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-fit-baseline-s0-1440.jpg) · `76bb7d11c70de400fbbc6d41293ea8398357435c23847d70901a3bbf416b5df8`|真实fit后Jan1至Feb28可见bar，Mar1成交尚未揭示；旧主题原判断、计划56/52/68、20万元完整，但阶段行被内部scroll裁掉，左选择上端裁切。|真实对照缺陷保留；不把基线自身失败当推荐门可降低的理由|
|[v05 fit recommended S0](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-fit-recommended-s0-1440.jpg) · `d2324e704f73a96a9c2d0c9e146fb4776c926d2c05d0d38ef05190ac5ca6605c`|同可见日期范围，S0/完整可知时间/成交尚未揭示/复盘补记紧邻图；OHLC、原判断全文、56/52标签、侧栏68及资本可读，主图仍占主要空间，下一笔唯一实心蓝主要动作。|同范围fit后阶段及阅读局部PASS；不称图高或垂直像素完全相同|
|[v05 actual price focus](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-fit-price-focus-1440.jpg) · `33818b54169e855efde3d4e7ec639c0146a99dc719b91049c7448438f49b3653`|入场56标签外侧2px焦点完整，没有轴容器裁切；顶部阶段说明继续完整，原判断和当前价56.50仍可辨。焦点边框附近含当前价，但计划名称/价依旧有金色角色标签。|这一实际Tab价格焦点及阶段持续可见PASS；完整Text焦点/编辑不在图内|
|[v05 S1](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-s1-1440.jpg) · `ccd9debfca10fac0c55410e4cbf710704eef2b395a19f9d9818e328f698cab73`|Mar1已揭示1笔买1000@56，持仓1000；双截止/来源完整，原判断全文与新S1全文同时保留；成本、计划56和止损52各有名称，原计划56/52/68与风险4000/3R、主动作可见。|实际推进后的S1所示阶段/源文持续保留/计划与实际角色局部PASS|
|[v05 S2](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-s2-1440.jpg) · `0f74093ed46ff30daf023c6ad5b4f42facebbf6eb4347ef345797b544d33ef5e`|Apr10行情/Mar15成交各有完整截止，已揭示3笔，持仓0/净6800；原判断与S1补充继续在图上，计划56/52/68完整、买入/两卖出标记可见；禁用推进/返回S0入口可辨。|S2同角色与原文保留局部PASS；当前右退出面板只首屏，不证明所有退出评价组合|

[fit-focus测量](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-fit-focus-1440.json:1)为提供者实际数据：viewport1440×900、windowY0，shell与column clientHeight=scrollHeight=674/scrollTop0，context y139/h28，chart782×646/y167，focus112×36/outline2/offset2。它具体补足之前windowY0不能排除内部滚动的证据缺口；与直接图片共同关闭**此1440真实fit→特定价格Tab焦点**的阶段遮挡回归。实际点击止损定位52输入、推进下一笔是提供者功能PASS；本审阅只读S1/S2 DOM与图片，没有执行浏览器动作。worker提前写root PASS不能作为证据；此限定接受来自后来实际root图/测量和独立比较。完整Text焦点/IME、其他编辑、wheel/Tooltip、其他高度/专注布局仍NOT VERIFIED。

900也直接复看[v05 S1 full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-s1-900-full.jpg)，900×1505，SHA `7dcb8e9a14e9494236ab953abe9354688211b882bc4a3321e1cf3ac609a36454`：阶段全文/双截止、原判断与S1全文、实际买入标记、成本与计划名称、下置完整原计划和主动作可读，无新价格角色带。[对应测量](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-s1-900.json:1)为viewport900×800、scrollWidth900、chart822×480、rolesDisplay none；fullPage高度不当viewport，page-width不等于所有工具行无内部横滚。

## 17. 390初始回放主要动作右裁及换行版复验

新的f41e [v05 S1 390 full](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-s1-390-full.jpg)390×2000，SHA `c521a3b2a15355a2f8cd390f842135abffb6da8b5860ca25b26487c022a5983d`，本审阅直接看到阶段/四行角色/原判断/S1全文均完整，但初始回放行主要“下一笔决策”右端文字裁掉，后两按钮在横滚外。第15节点击后自动滚入或另一滚动位置的图片只证明该时刻可达，不能证明默认动作完整。此新**初始主要动作可见性FAIL**保留；价格角色修复PASS和所有按钮存在不能抵消它。

最终磁盘CSS独立SHA `67e714fc53087cf5f8270d2bf60533c87a832d0b31339a2282172e4a291c125d`。四个tracked生产文件hash仍与第15节相同，git diff仍123插入/9删除；新修正只有样板CSS。在[≤600动作规则](/Users/zhoulin/.codex/worktrees/facb/TradeReview/app/components/design-prototype/recall-design-prototype.css:450)将直接recall-controls子行flex-wrap:wrap/heightauto/overflowvisible、gap6，button不压缩。保留DOM顺序，没有CSS order；第16节≥1331桌面规则不变。header工具栏仍可内部横滚，不能把回放行修复扩写为全页所有按钮同时可见。旧附近注释仍称replay保留内部横滚，和新wrap规则不一致，仅源注释需后续整理，不是功能PASS证据。

直接view_image/original打开67e两张新图：

|最终390全页图 / 尺寸 / SHA-256|直接观察|局部接受|
|---|---|---|
|[wrap S1 initial](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-s1-390-full.jpg) · 390×2050 · `9d0999788cc3a0c181d1bf44b445654e8409f41526cbf710a4edaf13283b6eca`|同Mar1持仓1000，阶段/计划56/52/68/实际成本56完整，原判断与S1全文保持；回放6按钮自然两行，唯一实心蓝下一笔完整在第2行左侧，留存/计划侧栏完整。|初始回放六按钮横向完整与主要动作可见局部PASS；需页滚动到末尾，不称390×844首屏可见|
|[wrap actual next-decision](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-action-390-full.jpg) · 390×2050 · `3b0cdd882fbabb5258fa5b3dc3af0520fd82d16fbce82f1ded30f96fd8a40bac`|实际下一笔后Mar9行情/成交、2笔已知、持仓400/已实现4800；新bar与卖出局部红标出现，原判断/S1全文/已知成本仍在；两行所有回放按钮和主要动作继续完整。|修复后实际推进终态所示阅读/主动作局部PASS；成交标记全无遮挡仍登记例外|

[wrap测量](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-s1-390.json:1)是提供者实际viewport390×844：row x17/width356/clientWidth=scrollWidth356/high94/wrap/overflowvisible，六按钮各44高且fullyWithinViewportX true。测量y1893/1943是在全页底部，**withinX并不表示当时都在viewport Y内**；与全页图共同证明页面滚动到回放行后不需该行横滚，不能替代真实键盘逐按钮操作、软件键盘或触摸命中实测。提供者点击下一笔→Mar9持仓400是真实功能证据，本审阅未操作浏览器。

本节关闭390初始主要动作右裁这个限定FAIL；第14/15节价格角色三阶段已另行关闭，本文不将S1新图冒充67e三阶段全部新拍。第16节桌面fit/focus图片拍于f41e；67e的最终新capture与当前冻结源码核对见第18节。整套结论仍限于可交用户评审的可逆样板，总体任务票保持open；完整生产UI、启动包、正式SQL链/导出、真实hover/active、字体glyph来源、完整Text编辑/IME、wheel/Tooltip、模拟/物理触摸仍NOT VERIFIED，历史全量31FAIL且修复后全量未重跑继续保留。

## 18. 最终冻结版本补图与范围结论

最后只读独立hash仍为CSS `67e714fc53087cf5f8270d2bf60533c87a832d0b31339a2282172e4a291c125d`、A `3520318c2d366988de0540928501122f3bce8ea884a6a4e3955e3bef72613071`。协调者在真实浏览器重新捕获当前冻结版本的1440图，本审阅直接view_image/original逐张核对，不仅沿用f41e的桌面规则推断。拍摄时版本由提供者绑定，磁盘源码hash与图片hash由审阅者分别独立读取；root最终manifest另行整理，不把未生成的manifest称已有证据。

|最终直接图 / 1440×900 / SHA-256|观察与范围结论|
|---|---|
|[final v05 S0](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-s0-1440.jpg) · `6c3d7162fa8bca1eaebb6307e3685abf42b9ec4b0f29a243d547bfe754a8535a`|与第16节同已知日期范围，S0完整阶段/市场可知时间/成交未揭示/复盘补记仍在图上方；0笔未来决策，原文全文/资本、计划输入及56/52标签和68侧栏完整，主要下一笔动作可见。冻结版所示态局部PASS。|
|[final v05 actual price focus](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-price-focus-1440.jpg) · `17717343246d83f7739beafebb337778704fa38dbf63c70d5a0302a848f0f0cc`|实际Tab入场56命中区焦点环完整、阶段持续可见，原文与主动作没有退回ad14遮挡状态。冻结版限定价格焦点局部PASS；未新增Text焦点/编辑证据。|
|[final v05 S1](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/recall-final-v05-s1-1440.jpg) · `56a6ccda2dc127ab926ea2b3472918143fc51b4ee8c81556e74174d1236a2422`|阶段Mar1双截止/复盘补记完整；1笔1000@56、持仓1000、原判断全文及S1完整补充持续可见，计划与成本各名可辨、原计划56/52/68/4000/3R不删减。最终所示S1局部PASS。|
|[A review final running](/Users/zhoulin/.codex/worktrees/facb/TradeReview/.scratch/strategy-visual-system-20261008/evidence/workbench-review-final-running-1440.jpg) · `adcbc39bc41688f2a27228a9d6c202067834644938d5d7421ce0a0a27b17502e`|Jun18三交易日净值曲线x约307至793，与第6节重建视野图相同跨度；54窄导航/320检查区、读图面积、中文角色层级、已知范围及完整持仓金额保留。播放唯一实心蓝主要动作，observe选框/图表选项浅底/概览下划线各有角色；没有看到新挤压或裁切。该1440运行态冻结版局部PASS，不以静态播放按钮证明新的播放旅程。|

**独立范围接受：可作为推荐视觉系统的可逆样板交用户评审。** 两上下文维持共同角色/动作蓝/现有盈亏色，当前已直接查看的策略台状态与原生S0/S1/S2、选中/特定价格焦点、900正文和390价格角色及初始回放主动作满足本轮限定阅读目的。桌面fit/focus后阶段遮挡与390默认主动作右裁已分别用对应修复新图关闭，历史FAIL记录保留；完整S0判断与S1补充未因修复移除或提前泄漏，补记来源仍明确。

范围仍有界限：S2最终新图拍于f41e、390三阶段角色图拍于ad14，后续67e不改对应阶段逻辑/角色样式是源码依据，不能宣称它们全部重新拍于67e。≤1330纵向480/≤600纵向720及页面阅读与旧200–240/独立下区滚动存在登记探索偏差；窄屏S1成交marker与长Text遮挡仍为明确例外；A900/390仅min-width1100探索，不接受手机布局。baseline合成fixture、安全seam和真实生产业务页必须分别命名。

**完整功能与总体UI接受仍NOT VERIFIED，总体任务票不得关闭。** 未测的完整Text编辑/IME及文字焦点、所有Tooltip/wheel/拖动/缩放视野、真实hover/active、跨平台逐字字体fallback、软件键盘、模拟/物理触摸、三阶段导出、正式生产SQL读写整条链、生产默认100%控件与缺失启动包专项不由这次局部PASS代替。历史全量31 failed /2694 passed /6 skipped与未重跑全量继续显式保留；9文件193测试/typecheck是root提供的影响范围证据，本独立视觉审阅没有重跑测试。没有将已登记探索偏差、测试计数或source guard转化为全量符合批准设计/全量通过声明。
