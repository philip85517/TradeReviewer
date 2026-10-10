# 首页角色复用到完整 Workbench · 独立审查

审查者：`/root/benchmark_inventory`，未参与本票实现；仅直接查看保存的实际图及只读源码，不运行服务、不操作共享浏览器。范围：票04、统一契约、DESIGN-COVERAGE U10–U16。最终结论为 **本票范围独立视觉 PASS；静态代码审查 PASS**，无未解决的重大范围内差距。真实用户旅程由 root 另行接受，票01全体验收、实际粗指针/真机触摸和中文逐字命中继续 **NOT VERIFIED**。下方保留首轮发现与历史 FAIL，最终复验见末节。

## 参考与比较边界

- 准确参考是 0ff3 当前 `/design-preview` 的“视觉调整”，对应 `docs/design-system/TradeReview-首页拉齐-v0.2.md`、`home-design-preview.module.css` 与 `evidence/style-unification-20261009/homepage-reference-1440.jpg`；不是撤回的旧样板，也不等于用户批准全部首页候选参数。
- 工作台的图表优先布局、完整账本、双策略独立本金、日期/阶段和计划/实际规则继续沿用旧完整 Workbench。这里只比较共用文字、颜色、控件和容器角色，未把首页网格或侧栏比例作为目标。
- 真正修改前图是 `{observe,results,compare}-before-1440.jpg`。1280/390 原 before 的文件头实为1440×900，已保存为 `*-capture-fail.jpg`，不能用于对应断点通过声明。1280/390 的 `*-original-style-*` 是新 wrapper 原主题对照，含新增样式比较控件；不是修改前旧 bundle。
- 直接核对 JPEG 文件头：本次桌面 after1440 为1440×900，after1280/original-style1280 为1280×800；当前390图为390×844。实际 viewport/DPR 记录为 root 采集的 JSON，本审查未自行控制浏览器。

## 首轮直接看图结果（历史节点）

图片均位于 `evidence/style-unification-20261009/`，使用 `view_image` 原尺寸查看；下述判断不由 DOM 或 worker 报告替代。

|覆盖项|直接查看的主要证据|独立判断|
|---|---|---|
|U10 文字与指标|首页参考；三页 before1440/after1440；三页 original-style1280/after1280|桌面 PASS。页标题和分区层级清楚，主要指标24px放大、普通说明保持紧凑；完整金额未挤成省略号。摘要因字级稍增高，未通过缩图抵偿。中文说明的旧 Mono 声明另列静态待修。|
|U11 容器和图表|观察净值、T0 K线/首bar；结果净值/回撤/仓位；比较净值/回撤/仓位1440，三页1280|桌面 PASS。保留 chart+右侧持仓、结果图+损益、比较矩阵+完整主图层级；结果图236px、比较图360/320px与旧样式一致，观察 canvas 也未缩小。盈亏绿/红、策略蓝/紫实虚线、A/B/现金堆叠系列仍可区分。|
|U12 控件与状态|results-position-focus-after-1440、T0 disabled、各图选中态；compare-table-keyboard-scroll-after-390|已看代表态 PASS：选中蓝底、真实焦点外轮廓与选中态独立、T0不可用动作明显。桌面样式切换清楚。390最终命中区/完整操作区待最终复验；宽屏 coarse 分支尚未验证。|
|U13 完整内容|results-ledger-after-1440/390、results-source-drawer-after-1440/390、compare-source-drawer-after-1440、各 source-return|所见字段 PASS：贡献、费用、滑点、换手、事件原文、计划/实际份额和完整价格均保留；窄屏抽屉正文多行且三个底部动作完整。比较完整账本展开的实际图缺失，不能由名为compare-ledger的仓位/净值图推定通过；结果窄表总计列还需局部横滚证据。|
|U14 样式比较与回放视觉|style-preservation-{unified-before,original,unified-after}-1440；t0-after、t0-candles、t0-firstbar、playback-newbar-paused-after-1440；source-return|可见结果 PASS：统一→原版→统一前后均为质量组合、7月12日、相同资产/现金及相同K线可见区。T0显示100%现金/零持仓，下一日真实6月17日bar与首次成交出现，6月18日暂停图有另一根真实bar。返回结果/比较的截图仍保留9月13日及原所选图型。实际点击链和完整状态安全由 root 独立验收，本审查不代签。|
|U15 响应式|三页1440/1280全部；observe-after390、observe-after-controls390、results-after/chart/ledger/drawer390、compare-after/table-keyboard-scroll/ledger390及对应原主题|桌面 PASS。现有390中观察金额完整换行、结果头部与两列KPI恢复、抽屉内容完整；比较矩阵局部横滚与焦点可见。现有compare-ledger-after390日期轴文字仍重叠，已知修复待最终新图；整体390 NOT VERIFIED。|
|U16 候选复用边界|统一契约、票04、coverage、wrapper/theme源码|仅在开发样板内 opt-in，原主题可逆；不声称跨工作树已固化、正式首页已推广或中文逐字命中已验证。最终文档/清单尚待 root 完成。|

桌面主要观察：1440的工作台内容宽度与右侧约320px持仓栏保持；结果与比较图形及账本结构未借用首页网格。1280同数据对照仍保留主图与完整矩阵。事件抽屉里的长中文、份额、开盘价、费用和计划/实际对照都可辨认，没有为了统一字号删减判断或金融字段。

## 静态代码审查

已直接读 `full-workbench-preview.tsx/css`、`workbench-visual-theme.css`、`running-prototype.tsx` 本次工作区 diff（不使用 HEAD~1），以及相关结果/比较/图表 CSS。以下是当前源码审查，不替代真实交互。

做得明确的部分：主题状态在 wrapper 内，视觉按钮仅 `setVisualTheme`，Running key仍仅由scene/view/resetNonce组成；无第二回放状态机。可选视觉 prop 默认 original，原创建消费者不传 prop 时保持原主题。MarketChart创建时读取最新themeRef，后续切换仅applyOptions背景/轴/网格/边框/字体；没有因主题切换更新系列数据、fitContent、重建实例或改时间范围。CSS只在 opt-in ancestor下生效，没有给图表SVG套操作图标尺寸。开发入口仍有非production保护。

首轮待修（修复状态见最终复验）：

1. **中文说明仍继承Mono，契约差距。** `running-prototype.css:56`、`results-prototype.css:57`、`comparison-prototype.css:44` 的font shorthand使用Geist Mono/ui-monospace；统一层只覆盖字号/行高，未取消running-kicker、results-eyebrow/section-kicker、comparison-eyebrow/section-kicker的font-family。应在统一scope为中文说明明确inherit或同一sans链；数值轴可保留其角色例外。已交root，不在此报告修源码。
2. **宽屏coarse套用手机几何。** theme当前 `(max-width:600px), (pointer:coarse)` 块同时包含44px命中区与单列header/timebar、结果单列analysis-grid、比较日期轴平移等。1280/1440的触控设备也会应用窄屏布局，超出触屏命中区要求。建议命中区保留coarse，几何规则仅限制窄屏；当前该分支 NOT VERIFIED。
3. **完整比较账本主体仍为旧12px。** 已补并直接查看 `compare-full-ledger-{expanded,assets}-after-1440.jpg`，字段完整性通过；但 `.comparison-metrics th/td` 仍继承旧12px，统一层只给summary-table覆盖14/22，正文角色与结果贡献/比较主矩阵不一致。已请求统一scope修正，或明确记录经认可的表内密度例外。
4. **wrapper导航与range命中区漏覆盖。** 导览a仅padding7px 8px，窄屏/coarse规则只覆盖scene/style按钮；结果range旧22px、比较range旧36px也未获得44px。建议统一控制最低36/44并实际测量；结果input需加入统一focus2px/offset2。已交root。
5. **主动作交互色需补齐。** 统一comparison-primary静态规则的specificity覆盖旧hover规则，部分揭示态hover可能与默认色相同；结果/比较主动作缺统一active。建议补同候选hover/active和导览a显式focus，已交root。此项为状态角色补齐，非数据或回放修改。

源码初次冻结SHA256：wrapper426d986c…、wrapperCSS691a2794…、themea0547674…、Running7829be4e…、pagea57b648f…。修复后需记录最终hash和复看受影响实际图；此处不把初次freeze当最终。

## FAIL 历史与证据缺口

- `*-before-1280/390-capture-fail.jpg`：FAIL，实际1440×900；不可取消或改名冒充正确断点。
- `observe-initial-narrow-fail-390.jpg`：FAIL，初稿中portfolio/more、badge、timebar及图型控件重叠，日收益裁切。当前观察390所见重叠已改善，最终操作区仍待补图。
- `results-narrow-header-fail-390.jpg`：FAIL，标题挤成逐字竖排、KPI裁切；当前results-after/chart390直接看图已修复该反例。
- `compare-narrow-dates-fail-390.jpg`及当前旧compare-ledger390：FAIL，日期轴重叠；保留，等修后最终证据。
- `compare-ledger-after-1440/390.jpg` 名称不能证明账本完整性：1440实际为仓位图；390实际为净值图。需要展开完整账本后真实滚动图。
- 追加桌面完整账本证据：`compare-full-ledger-assets-after-1440.jpg` 直接确认两策略完整资产/现金/盈亏字段；`compare-full-ledger-expanded-after-1440.jpg` 确认成交额¥597,625.56/¥173,495.56、交易笔数、首次/再平衡/部分/未成交计数及对账。两张文件头均1440×900，桌面U13字段缺口闭合；字号角色问题另列，原误命名证据不删除。

## Declined to judge / 未验证边界

- 真实用户旅程、键盘点击次序、浏览器控制台和样式切换后内部对象身份：root独立操作，本审查只接受截图可见结果及静态接线，不代替root功能验收。
- 原票01完整回放/Tooltip等全体验收、真机触摸/软件键盘、中文逐字字体命中：不在本票视觉通过声明中，继续 NOT VERIFIED。
- 数据持久化：本票仅内存合成预览且不写库，NOT APPLICABLE；不推定正式数据路径通过。
- 全仓lint历史FAIL与本票范围检查：本审查不运行会写工作区的检查、不从worker报告推定通过；最终由root附新鲜命令证据，既有全仓FAIL不可被scope通过覆盖。
- 生产推广、push/merge/publish、跨工作树统一固化：本票未授权，NOT APPLICABLE。

此历史审查节点没有桌面未解决重大视觉偏差，但窄屏最终图、完整比较账本及两项静态修正尚未闭合，因此当时为 **NOT VERIFIED**。该节点不能作为最终功能接受，后续复验见末节。

## 最终采集轮次中的再发现（复验前保留）

已直接查看 `{observe,results,compare}-final-{1440,1280}.jpg`：三页桌面仍满足布局、字级、完整金额和图表面积要求；已补的 `compare-chart-after-390.jpg` 净值日期不重叠，`compare-position-scroll-after-390.jpg` 仓位数字与 `results-contribution-scroll-after-390.jpg` 合计列可在实际局部滚动图中读取。以上关闭对应内容证据缺口，但不覆盖下述 FAIL。

- `observe-time-controls-final-390.jpg` **FAIL（复验前）**：直接看图可见业务动作高度比44px wrapper工具按钮低；配套实际390×844/DPR1 JSON证实查看配置、实验列表、更多组合、查看结果、比较、回看日期及净值/K线控件均为36px。统一层具体类的36px规则权重高于窄屏/粗指针通用button/select的44px规则；CSS声明存在不能证明命中区已生效。已交root修复并重采，当前U12/U15不可据此放行。
- 同图观察标题与T0之间约150px空白，源自旧 `.chart-heading > div:first-child { flex: 1 1 170px }` 在手机column布局中成为高度基准。这是旧窄屏几何继承的密度差距，建议统一scope仅在narrow取消该flex-basis；不以缩小实际图表抵偿。
- wrapper统一态工具导航/场景/样式文字当前12px，业务内控件14px。契约的14/22控件口径需在最终记录中明确辅助chrome例外，或修为14/22；不能将当前状态报告为所有控件均14。

此前五项静态问题当前源码已见修正接线：中文说明inherit、coarse与narrow几何分开、完整比较账本14/22、range36/44、主动作hover/active；随后导览a窄屏44与结果input统一focus亦已补。但上方specificity反例尚待新图/实际测量，源码修改本身不视为通过。

## 最终独立复验（2026-10-09）

最终源码与 `source-freeze.json` 一致，并由本审查者独立读取 SHA256 核对：

|源码|SHA256|
|---|---|
|full-workbench-preview.tsx|426d986c04cb78602fd6d820c89760581ad1e81e0f447da0ca1dc5d1178b9c5b|
|full-workbench-preview.css|4b060b73f6ec7cf6a0c6664b927c3f8a85bae0ef1a44bb32f39f2fac57c1666c|
|workbench-visual-theme.css|e1ec30945d818e738f0366c0b3989e9e246bbc7bea784dcb020b0ea0a3297aea|
|running-prototype.tsx|7829be4ec52fbb575cc1c4c2742a14e1a859b0a3b111eaa848cf71c9e10e8038|
|app/page.tsx|a57b648f9b98fee573505f60623000c1422b75cde0de713c0fc5c707718e25c3|

直接查看最终三页 `{observe,results,compare}-final-{1440,1280}.jpg`；390 为 `observe-fixed-final-390.jpg`、`results-final-390.jpg`、`compare-final-390.jpg`。本审查独立以文件头确认分别为1440×900、1280×800、390×844，补图也逐张确认尺寸；采集 JSON 为相同 CSS viewport / DPR1。未使用旧错误 before1280/390 来证明断点通过。

|门槛|最终直接证据及判断|
|---|---|
|U10 文字和指标 · PASS|当前首页实际参考、真正 before1440、同数据原主题1280/390与最终三页比较：24px标题/主要数字、18px分区、14px业务正文和控件形成一致角色；完整金额仍可读。完整账本最终14/22；中文说明最终scope取消旧Mono。wrapper导航、场景和样式工具文字12/18按 coordinator 明确的辅助原型chrome例外保留，命中区仍36/44；不声称所有控件文字均14px，也不声称逐字字体命中已测。|
|U11 容器、面积和系列 · PASS|桌面最终三页、观察K线/T0首bar、结果和比较回撤/仓位代表图：保留旧工作台宽度、右侧持仓、完整比较矩阵及 chart 优先结构。观察canvas360/320、结果236、比较360/320的既有桌面高度未以字号放大为由缩小；窄屏去除标题170px高度空白，没有缩实际图表。蓝/紫实虚线、A/B/现金系列与盈亏颜色仍保留。|
|U12 状态与命中区 · PASS（已采桌面和390）|`observe-time-controls-fixed-final-390.jpg`：结果/比较/回看/图型业务控件明显恢复44px，实际JSON亦为44。`observe-running-controls-final-390.jpg`：下一日、播放、速度、阶段结果、回看及展开操作均完整可见且44px。`results-range-focus-final-390.jpg` 与比较局部横滚代表图的真实焦点2px/offset2清楚且与选中态独立；T0 disabled保持。hover/active在最终CSS独立声明。实际wide coarse/物理触摸未采，继续NOT VERIFIED。|
|U13 字段、账本和长文 · PASS|最终 `compare-ledger-assets-final-1440.jpg` / `compare-ledger-turnover-final-1440.jpg` 直接确认14px完整资产、现金、总损益、成交额¥597,625.56/¥173,495.56、28/8笔交易和13/3次再平衡；`compare-ledger-fixed-left/right-final-390.jpg` 直接确认账本表头/字段与右侧完整¥99,102.99、¥20,111.64及未知胜率判断可局部横滚读取。`computed-final-ledger.json` 仅作字号14/22、tabular-nums的补充测量；不是看图替代。结果贡献合计、费用/滑点/换手、比较期末资产、仓位55.4/34.6分别见最终390局部滚动图；来源抽屉长文和计划/实际字段沿用已直接查看的代表截图。|
|U14 可逆主题和阶段 · PASS（截图可见结果 + 静态接线）|统一→原版→统一三张保留同策略/7月12日/金额/现金/K线可见区；T0100%现金零持仓，下一日实际6月17日bar/首次成交，播放后6月18日bar可见。结果/比较事件返回代表图保留9月13日来源与所选图型。主题handler仅setVisualTheme；不进入Running key或resetNonce，不改截止/系列/回放状态机；Canvas仅applyOptions样式，无重建/fitContent。root拥有真实操作链最终判定。|
|U15 密度与390边界 · PASS（viewport / mouse / keyboard）|最终三页390头部保持全文，操作区完整；`compare-net/drawdown-dates-final-390.jpg` 日期各自可读；`compare-position-left/right-final-390.jpg` 与 `results-contribution-final-390.jpg` 展示可达的完整仓位/贡献合计，局部表格横滚不造成页面水平溢出。窄屏与coarse几何分开只读确认，实际coarse与真机/软键盘保持NOT VERIFIED。|
|U16 可逆样板范围 · PASS（静态）|仅开发预览opt-in主题；Running默认original，原创建路径消费者不传主题保持原版。沿用既有业务/数据/PnL/系列；没有迁入首页网格或做生产推广。辅助chrome12px是明示例外，本票通过不构成用户批准全部首页候选参数或跨工作树固化。|

最终范围内代码审查没有剩余 Critical / Important findings：中文说明inherit、主动作hover/active、导览/滑块焦点和36/44命中均已接线；Running窄屏/粗指针最终以同等具体权重覆盖36px，窄屏chart-heading子项flex:none；完整账本最终使用真实DOM类 `comparison-full-ledger` 覆盖14/22（此前错误类 `comparison-metrics` 存在不能证明修复）。恢复票已通过的 initialPreview/initialView 和开发入口接线没有在本票增加第二状态机或改变普通创建入口。

历史 `observe-time-controls-final-390.jpg` 的36px/空白FAIL、旧账本12px、旧日期轴/窄屏头部/错误viewport FAIL均保留；它们的当前反例分别由不同名称的新图关闭，不覆盖历史记录。

root另行报告最终 `git diff --check` exit0、此前 scope eslint/typecheck exit0（后续只改CSS）；本审查读了对应日志，但没有自行运行这些命令，不把空日志或worker通过当作独立执行证据。原全仓lint FAIL及票01 NOT VERIFIED保持。纯内存预览不写数据库，持久化NOT APPLICABLE；真实粗指针、物理触摸、软键盘、中文逐字字体、整套Tooltip/回放和生产推广仍不在本票通过声明中。

**独立最终结论：票04的桌面1440/1280、390视觉范围与可逆主题静态代码 PASS；无未解决重大视觉偏差。真实功能与整体项目接受由 coordinator 分开判定，未验证边界不关闭。**
