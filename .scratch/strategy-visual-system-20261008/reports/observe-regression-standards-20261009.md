# 完整观察：首页统一 · 独立规范与级联回归审查

2026-10-09。审查者 `observe_regression_standards` 未实现本轮页面；只读源码与根代理本轮真实浏览器截图/DOM记录。本报告是修复前审查，不把票04的历史 PASS 当本轮前提，也不代替整页功能、状态安全和最终视觉接受。

**结论：修复前严格回归 FAIL。** 601px出现区域重叠，760px省略完整财务读数；这两项可由本轮画面与实测独立证明。恢复模块的对齐及字体角色漏出统一作用域，右栏金额的角色扩大和操作图标级联还需整页校准。票04的 U10/U12/U15 既有接受受影响，应在票、README及接受记录中同步重开，历史截图/FAIL/PASS保留，不能用本报告覆盖历史记录。

## 审查依据与范围

- 项目：`AGENTS.md`、`docs/agents/development-workflow.md`、`task-decomposition.md`、`ui-task-templates.md`。独立直接视觉比较是单独门槛；已知范围内失败不能由测试或整体分数抵消。
- 本次准确合同：`../full-restore-contract.md`、`../style-unification-contract-20261009.md`、`../DESIGN-COVERAGE.md` 中 U10–U16。
- 实际规范：`docs/designs/2026-10-08-strategy-visual-system/homepage-style-reuse.md`，以及首页参考工作树 `/Users/zhoulin/.codex/worktrees/0ff3/TradeReview/docs/design-system/TradeReview-首页拉齐-v0.2.md`。
- 业务引用：DD05–DD09、TD01–TD02，`docs/specs/2026-09-29-strategy-desktop-ux-design.md`；WD06来源返回及WD03控件角色，`docs/specs/2026-09-30-strategy-stable-workbench-design.md`。
- 源码：`app/components/strategy-prototype/{full-workbench-preview,running-prototype,recovery-prototype}.{tsx,css}`、`workbench-visual-theme.css`。

此次是完整旧 Workbench 的独立历史布局预览。完整恢复合同允许历史布局、合成三个月双策略与默认完整展开。**不得把紧凑A的固定28px状态位、320px检查区、默认折叠、零外层滚动等预算直接套成本票新硬约束。** 首页参考用于角色、文字、颜色、控件及状态，不用于照搬首页网格。可校准角色与自然流布局，不能删改完整价格、数量、评论、阶段、截止、计划/实际区别或默认已展开行情；也不能用折叠业务内容来掩盖挤压。

## 本轮实际证据

全部来自根代理本轮浏览器；本审查者直接打开图片，不控制浏览器。`before-complete-*` 固定 `observe / complete / 首页统一`、EMA20 v1.4、2024-09-13收盘后，同一合成预设。

|证据|CSS视口/DPR|直接审查用途|
|---|---|---|
|[1440](../evidence/observe-regression-20261009/before-complete-1440.jpg)、[实测](../evidence/observe-regression-20261009/before-complete-1440.json)|1440×900 / 1|主次角色、恢复对齐、图框及侧栏密度|
|[1280](../evidence/observe-regression-20261009/before-complete-1280.jpg)、[实测](../evidence/observe-regression-20261009/before-complete-1280.json)|1280×800 / 1|桌面紧边界；源码与DOM对照|
|[601](../evidence/observe-regression-20261009/before-complete-601.jpg)、[实测](../evidence/observe-regression-20261009/before-complete-601.json)|601×800 / 1|中间断点重叠反例|
|[760](../evidence/observe-regression-20261009/before-complete-760.jpg)、[实测](../evidence/observe-regression-20261009/before-complete-760.json)|760×800 / 1|完整财务读数被ellipsis的反例|
|[390](../evidence/observe-regression-20261009/before-complete-390.jpg)、[实测](../evidence/observe-regression-20261009/before-complete-390.json)|390×844 / 1|首屏、辅助预览工具密度、事件导航宽度|
|[更多菜单](../evidence/observe-regression-20261009/before-more-menu-1280.jpg)、[实测](../evidence/observe-regression-20261009/before-more-menu-1280.json)|1280×800 / 1|嵌套文字角色、选中项与浮层|
|[事件抽屉](../evidence/observe-regression-20261009/before-event-drawer-1280.jpg)、[实测](../evidence/observe-regression-20261009/before-event-drawer-1280.json)|1280×800 / 1|真实多行理由、原判断、计划/实际及关闭目标|

## 已证实问题与修改规则

### R1 · P1 · 601–759px几何规则断层使状态与动作重叠

位置：观察顶部、时间操作条、进度恢复。601图中顶部合成标识与资产摘要挤压；时间条中的“比较组合/回看/日期”落到下一个恢复模块区域。

来源：`running-prototype.css:1341–1429` 在 max759启用100dvh、overflow:auto、标题换行及时间条column；`workbench-visual-theme.css:515–530,571–620` 的自然高度、flex-shrink:0、头部grid与时间条增长修复却仅在max600生效。601–759进入旧的窄布局，同时缺失为新文字角色准备的高度修复。

实测：601时间条x10/y656/w581/h48，恢复模块y716/h80。时间条采用column且有多行状态、主动作和日期，但只有48px外框；本轮图片直接显示后续动作压入恢复区。601没有文档横溢并不能证明垂直排版正确。

影响：当前查看日、结果截止与“回看”操作难以归属；相邻点击位置可能与视觉文本不一致，用户不能可靠判断下一动作。

修改规则：统一业务几何断点，或按内容建立自然高度，覆盖原max759的窄布局；头部、摘要、时间条、恢复与图工作区不因100dvh父flex而压缩；column时间条要包住全部动作再进入下一区域。保留完整状态和截止，44px命中范围在所有窄布局适用控件上生效，不能缩字或删按钮来补高度。

验收：600/601、759/760、390及两桌面同状态实图；实际测区域及动作rect，前一区域底边不得越过下一区域起点；鼠标点击、Tab焦点与显示位置一致。另检查running/T0不同动作数量，不能只以complete一张图接受。

### R2 · P1 · 760px主KPI仍省略金额与收益率

位置：顶部“组合当日收益”。[760图](../evidence/observe-regression-20261009/before-complete-760.jpg) 实际显示 `¥1,097.16 · …`，完整数据应为 `¥1,097.16 · +1.08%`。

来源：`running-prototype.css:376–384` 继承overflow:hidden/text-overflow:ellipsis/nowrap；统一主题 `:227–235` 将金额改为24/32，而 `:559–564` 仅max600允许完整换行。760仍是四列摘要，724px总宽无法容纳全部24px读数。

实测：760摘要x18/y389/w724/h72。DOM text仍含完整值，截图却截去收益率；“DOM有全文”不构成价格可读验收。

影响：用户看不到当日收益率，组合对比和金额判断依据不完整，违反用户不隐藏重要价格与0.6主要财务数字全文规则。

修改规则：摘要按完整内容决定可用列数和换行，而非只有手机才释放overflow；保留主KPI24/32的角色、数字等宽及全文。可在中间宽度改两列/让金额及收益率明确分行，不缩成难读小字，不用title替代可见读数。

验收：至少600/601、759/760、980/981、1280/1440；固定相同正/负损益和较长金额，用实际截图确认货币值、符号及百分比全文，另检查scrollWidth/可见rect与父裁切。

### R3 · P2 · 恢复模块绕过统一工作区基线与中文字体角色

位置：进度恢复、原型演示工具及其展开内容。1440画面上“进度恢复”落在页面边缘，与主工作区明显错位。

来源：`running-prototype.css:31–39` 为header/summary/timebar/grid设置max1240及居中，recovery不在该列表；`recovery-prototype.css:8` 独立font shorthand，`:27,39–69` 又保留旧字号、字重、背景和焦点。统一主题 `:105–112` 对recovery仅覆盖border-color，普通按钮14/22无法修正容器font-family或全部子角色。

实测：1440 header/summary均x100/w1240，recovery x28/w1384，两侧相差72px；recovery实际font-family为 `Geist, sans-serif, "PingFang SC", "Microsoft YaHei", sans-serif`，13px/18.85px。页面统一链为 `Geist, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif`、普通正文14/22。generic sans-serif出现在中文回退之前，与规范不符；这不是逐字字体命中的实证。

影响：同一条操作链出现两个横向基线及独立文字节奏，容易把恢复/截止辅助理解成独立模块；旧演示工具操作状态会继续漏出不同焦点/动作色。

修改规则：恢复模块使用同一工作区宽度/居中基线；容器inherit统一字体，显式分配14/22业务控件和12/18辅助说明；来源/警告色按现有语义保留，普通背景、主动作、focus与统一token保持一致。该模块属于辅助说明的文字例外需明确记录，不能以scope遗漏隐式形成例外。

验收：1440/1280及窄屏baseline rect；恢复折叠/展开、失败/检查点恢复、disabled原因、Tab焦点直接图；computed字体链和各角色line-height，不声称Windows或每个汉字实际命中。

### R4 · P2 · 次要财务读数被统一为主KPI，侧栏阅读层级扩大

位置：持仓每行市值、现金、组合净值、总资产。1440和1280画面侧栏连续五组24px财务数字与页顶核心KPI等重，事件区被压到首屏底部。

来源：`workbench-visual-theme.css:227–235` 将running-summary、account-total、holdings-foot、holding-value的b捆在同一24/32/500规则。旧 `running-prototype.css:836–897` 的侧栏正文金额为13–14px；新规则没有按“主要KPI”和“次要明细”区分。

实测：1440持仓金额24/32/500，每行h67/w294；图框y478/h360。事件导航y777、事件标题约首屏底部。390图框y1224/h280，其中预览导览+场景说明已占前367px。与首页实际参考相比，复用的是主KPI样式，却没有保持普通明细的相对等级。

判断：这是一项明确可见的层级/密度失衡，不能仅凭token值与首页相同判断一致。它不等同于价格被裁切，也不授权迁移首页布局或压小图表。

修改规则：24/32用于页级主要资产KPI；侧栏完整财务明细恢复正文角色14/22/500，若16/24更利于读数，应作为校准候选在同状态实图审查。持仓名称/数量/市值的对齐关系保持，数字仍tabular且全文；区域标题18/26，元数据12/18。辅助预览导览可按自然换行与紧凑间距校准；业务默认完整展开、截止和原型声明不得消失。

验收：同视口/同图范围前后图，独立审查者直接对照主图、主KPI和明细的相对强调；量取图框与事件可见区、完整数量/价格。不要用变短文字、关闭完整数据或删除重复但有语义的资产读数掩盖密度。

### R5 · P2 · 图标/文字按钮通用级联缺少角色保护

位置：抽屉关闭及事件上一条箭头。

来源：`running-prototype.css:1118–1130` 关闭×本为23px/1；统一主题 `:71–79` 业务button14/22覆盖它。事件导航 `running-prototype.css:924–937` 仍min-width34，箭头font20；统一44px仅改变height，不处理width或字形视觉重量。

实测：事件抽屉图关闭×为36×36点击框，但字形14px/22，明显弱于其命中区域和同页图型切换。事件上一条为34×40.59桌面、34×44窄屏，字形20px；字号/框的比例与关闭×不一致。

约束：0.6第47行明确历史验收只测最小高度，图标也未批量统一。因此本项不能倒写成“之前已证明所有图标18/1.75和36/44方形”。WD03第131行给工具默认36×36/约18px的方向；严格复审应解决或保留有理由的明确例外。

修改规则：为图标按钮显式角色，首选已有Lucide且尺寸18/stroke1.75，仅针对操作图标；单独保证min-width/min-height36，窄屏/coarse44。保留已有更大目标、aria-label/title与原行为，不对Canvas/SVG数据标记全局套18。若暂时保留文字箭头/×，需要独立校准字形而非继承正文14。

验收：抽屉真实键盘关闭、焦点回入口，上一条按鼠标实际定位；DOM宽高与截图视觉重量分别记录。coarse CSS规则不等于真实触摸设备通过。

## 需要根代理继续实测的事项

|事项|当前结论|需要的证据|
|---|---|---|
|盈亏颜色级联|正收益实测正常，**不是已证实缺陷**。根代理本轮 [extra audit](../evidence/observe-regression-20261009/before-extra-audit.json) 累计/当日收益均 `rgb(38,166,154)`，现有配置保留；源码顺序猜测不能抵消实际证据|负收益及修后原/统一同日期同数据对照；保护现有盈亏语义|
|选中持仓边界|源确认只有border-bottom:1，其余border-width0；统一仅border-color。这并不自动证明选中不可识别|四边border实际值、背景/必要边界对比度、aria-pressed、selected+focus同存画面；不强行要求每行四面边框|
|更多菜单嵌套角色|父button14并不保证b/span：旧菜单b12、组合页签span13；实际菜单画面仍有局部小文字|子元素computed，判定哪些是主选项正文14/22、哪些辅助12/18；保留完整预设本金及选择语义|
|600/759/980精确边界|601/760已FAIL，其他边界未直接看图|边界两侧固定viewport截图+rect，980/981检查wrapper单行挤压|
|抽屉390、完整较长内容|1280已看实际多行内容；390未在本报告直接检查|长理由/计划/成交量/价格，所有抽屉动作可达；键盘Esc返回、来源返回、不删文本|
|运行/T0/错误恢复、focus+selected+disabled|本报告不以完整场景推出其他状态PASS|root实际动作、新bar/截止、Tab与disabled原因，hover/pressed与focus分别测|
|默认展开、主题状态保存|源码wrapper仅visualTheme class/prop变化，key与scene/view/resetNonce相关；无本轮实操结论|主题原/统一往返日期、组合、图型、金额、range可见对照；演示场景重开与主题切换分开|
|触摸、逐字中文命中、Windows、Tooltip/缩放前视|NOT VERIFIED|按对应范围独立证据，不能以CSS或截图替代|

## 修复后接受方式

1. 保存本轮before及历史票04证据；修复后的源码版本、真实截图与测量另存，不把before覆盖成after。
2. 明确上述R1/R2至少阻断当前“完整观察”接受；U10/U12/U15按受影响范围重开。R3–R5要直接视觉复审，明确解决项或有理由例外。
3. 同fixture、阶段、市场/执行截止、视口和图范围对照，独立比较整页焦点、密度、中文阅读、图表工具栏、计划/实际、多行原判断与当前补充。初始合同默认完整展开继续保留。
4. 功能旅程、状态安全、视觉保真单独记录。此报告未运行浏览器、未执行保存、未验证生产DB；纯内存预览持久化为scope-based NOT APPLICABLE，生产写链不据此通过。
5. 根代理在独立直接看修后画面、实际操作与本地服务末次访问后，更新票04/README/接受记录并给真实预览链接。修复存在并不自动使本报告FAIL变为PASS。

## 首轮实现 ready 后的独立源码复核（追加）

对照 `evidence/observe-regression-20261009/before-source/` 内冻结的四文件，逐行比较首轮实现，不以Git HEAD替代本轮before。准确冻结要求为 `../observe-regression-contract-20261009.md` R01–R08。此节仅接受或拒绝**源码覆盖**，不替代修后画面、实际旅程与整页最终接受。

### 已覆盖与范围安全

|要求|源码复核|实际接受限制|
|---|---|---|
|R01预览工具整理|nav单行局部横滚；场景/主题/原说明进入默认关闭原生details，完整原按钮/链接保留；可见相邻context摘要明示合成、当前scene/theme|summary元素文字位置与合同有差异，且目标/焦点遗漏，见下；业务默认展开未改|
|R02自然文档流及恢复基线|主题`:361–377` observe height:auto/min-height0/overflow:visible；恢复max1240居中及正确font-family14/22已加|必须根实测601/759无重叠、两桌面图高不被压缩；初轮JSON恢复字体/基线已与规则一致|
|R03主次财务角色|顶部24/32，侧栏account-total/holdings-foot/holding-value14/22，tabular及完整值规则保留|角色须整页直接看图接受，不以源码24/14机械宣布良好|
|R04图工作区断点|max1023叠放图后侧栏、flex-shrink0、44高与窄图标44²；≥1024保持原网格|业务header/timebar仍有759/600历史规则共存，需601/759/760/1023/1024实际比较；宽屏coarse图标宽度遗漏|
|R05完整数字|所有宽度取消KPI及侧栏数字ellipsis，max1023两列、max359单列|实际长金额/负值全文和不同宽度不能由DOM文本单独推出|
|R06中文/菜单/抽屉|恢复容器正确回退、更多菜单b14/22及small12/18已加|组合tab/抽屉/恢复嵌套角色漏项，不能接受全量覆盖声明|
|R07选中/图标|持仓选中真实四边1px #3797ff；ChevronLeft/X为Lucide18/stroke1.75；桌面36²、max1023为44²|selected+focus、disabled与关闭后焦点须实际操作；宽屏coarse仍欠宽44|
|R08行为与范围|before→after `running-prototype.tsx` 仅Lucide import及两处glyph替换；handlers/state/data/chart init/effects/cutoff没有差异。wrapper新增sceneLabel/themeLabel及details包裹；reset/router/key/主题state不改。主题新增几何只作用于running，结果/比较布局未扩展|真实逐日揭示/播放、主题往返、来源返回、drawer Esc/鼠标及跨页共享工具仍由root执行；源码无差异不等于旅程通过|

图高仍由原 `running-prototype.css:612–615` 的 `clamp(320px,40vh,360px)` 与原窄窗280px规则负责；首轮没有新增图高规则。1280×800时320px是原合同计算结果，不应要求所有桌面硬改360px。

### 首轮源码遗漏：仍阻断 R01/R06/R07 全量覆盖接受

|位置与可复现源证据|遗漏/影响|要求的局部修正与验证|
|---|---|---|
|`full-workbench-preview.css:12,18,36–50`|nav a及preview tools summary仅36高；max759与coarse只列scene/style button。root本轮 `after-complete-601.json`、390、760中两个目标实际仍36。原统一nav radius6/focus2offset2规则亦被移除，目前a仍radius4；不能以未focus时outline:none证明其没有浏览器默认焦点，但统一focus token源码明确丢失|为nav链接/原生summary加窄窗与coarse44，并考虑与观察max1023的窄窗定义一致；恢复统一nav radius6及focus2px/offset2。Tab并局部横滚到最后入口，查看真实焦点与目标范围|
|`running-prototype.tsx:1343` + `running-prototype.css:201–207`|组合名称是span，非b；span独立13px/600且ellipsis/nowrap，父button14不改变它。新主题未列该span，违反R06组合名14/22与13偶然覆盖清理|对真实`.portfolio-tabs button span`分配14/22，完整名称空间不足时需明确可达机制；不能误写b selector。将该真实子元素加入computed记录与长菜单/选中Tab截图|
|`running-prototype.css:1188–1194,1215–1219,1244–1245`，`running-prototype.tsx:1513`|抽屉dd仍13；成交标的b既旧CSS13又**内联fontSize:13**；coverage-detail正文p仍13。新主题没有抽屉正文专属角色。inline优先级不能靠普通作用域CSS14覆盖|抽屉正文/成交主字段14/22，辅助12/18；给标的标题辅助class或移除13内联字号再显式角色，不改handler/data。实测drawer dd、b、计划/实际span、warning正文，长价格全文与三动作可达|
|`recovery-prototype.css:150–166,173` + 新主题`:369–392`|恢复容器字体已修，但summary子span仍独立11px，summary12继承容器22行高；demo-block p仍12/1.45=17.4。容器inherit不自动修正嵌套font-size/line-height|真实summary及其span、展开demo正文显式12/18；业务控件14/22。展开恢复工具的computed核对，不能只采容器或默认折叠态|
|新主题`:423–439,487–492,984–1004`|图标宽/高36²，在max1023改44²；coarse只min-height44，≥1024粗指针时width/min-width仍36。R07要求44×44，不再是旧height-only例外|在coarse范围给真实event-nav first/drawer-close宽高44；不改变宽屏composition。源码门槛与真实粗指针/触摸证据分别记录，物理设备继续NOT VERIFIED|
|`full-workbench-preview.tsx:52–55`|原生details summary文字仍仅“预览工具 · 场景/视觉/说明”；当前scene/theme/合成位于相邻context摘要。可见状态没有丢失，但元素位置不完全符合R01冻结“summary明示当前状态”|root按整页校准选择将状态放入summary，或记录相邻常显摘要等效的授权偏差；不能声称逐字合同实现，也不需要为此删除说明或业务内容|

本次源审查发现实现报告中的“recovery/menu/drawer content已全部14/22和12/18”超出实际覆盖：父容器与通用button规则无法覆盖旧子selector或inline字号。上述遗漏已发给root，需局部修正后重新检查真实元素。此节保留首轮失败，后续最终版本通过时另追加记录，不覆盖该节。

## 最终 ready 首批源码复核（2026-10-09 23:21–23:23 +08:00 追加）

本节重新对比 `evidence/observe-regression-20261009/before-source/app/components/strategy-prototype/` 冻结原文件与四个允许文件；不以实现者 READY 或上一轮 PASS 为前提。只读源码审查，无浏览器操作、无实现修改、无视觉接受。首轮遗漏及其 FAIL 记录保留。

**23:21读到的源码门槛为局部 FAIL：R06 还有两处辅助行高遗漏；其余受检修正规则的源码覆盖通过。** 随后实施者并行补齐，最终重新读取结果见文末。实际 DOM 是否命中、整页视觉、功能旅程由 root 的真实浏览器证据分别接受，不能由本节替代。

|冻结规则|最终 ready 源码结论|范围、授权偏差和待实证边界|
|---|---|---|
|R01 导览与辅助工具|单行导航局部横滚，原生 details 默认无 open；原场景按钮、样式按钮和完整说明均保留。导航 focus2px/offset2 与 radius6 恢复；nav/summary 在 max759 与 coarse 中44高。统一场景按钮原遗漏的 radius6 已于本次复核期间补回|root 明确接受：相邻常显摘要展示“合成演示 / 当前场景 / 当前样式”，原生 summary 使用简短工具名，作为“summary 明示状态”的等效排版。仍须实看折叠与展开、横滚后最后入口键盘焦点；预览工具的 max759 是辅助工具断点，业务观察布局另按1023/759两层规则|
|R02 自然高度、恢复基线、原图高|observe height:auto/min-height:0/flex:0 0 auto/overflow:visible；恢复 max1240 居中与显式中文回退链；业务区域 flex-shrink:0 已覆盖601–759|未增添图高覆盖；原 `clamp(320px,40vh,360px)` 与≤759原280px规则继续有效。1280×800下320px符合原图高，不应硬改360。601/759实际布局与基线仍需新截图/rect确认|
|R03 财务与标题角色|摘要24/32/500；account-total、holdings-foot、holding-value14/22/500。图头/侧栏区域标题18/26/600。抽屉 h3 原继承620的遗漏已补为600|原金额与收益比例未删；有 tabular。按主次阅读任务的整页观感、实际盈亏颜色仍由直接看图/computed接受|
|R04 响应式与命中框|≤1023 chart-first 顺序叠放，≥1024原布局保留；旧600修正整体移动至759，覆盖原600/759断层。业务按钮/select/summary具同等权重44覆盖；独立箭头与关闭36²，≤1023及coarse44²|≥1024 coarse仅命中范围，不改变宽屏布局。drawer-trades原内联 minHeight:auto 内容本身多行；max759/coarse采用!important最低44覆盖。必须测实际目标rect，不能把粗指针模拟称物理触摸|
|R05 完整数值|所有 KPI/侧栏重要金额显式 visible/clip/normal/anywhere；≤1023两列，≤359单列。无数字/百分比文字更改|需复验长金额在320/390/760/1023/1024及桌面；源码允许换行不等于阅读层级已接受|
|R06 中文、菜单、抽屉、恢复|组合真实span14/22/500与small12/18、菜单b14/22、辅助small12/18；drawer p/dd14/22、dt与类别12/18，成交主字段14/22；旧 inline fontSize13 被作用域!important14覆盖，未改 handler。恢复demo summary/span与p/small12/18、label/select14/22均补齐|仍有下表两处辅助行高遗漏；此前父容器已统一不能证明所有嵌套角色统一的误判已修正。中文回退链通过源码，不宣称逐字字体命中或跨平台实际回退|
|R07 选中、图标、焦点|持仓 selected四边1px #3797ff与底景；焦点2px/offset2。ChevronLeft/X为现有Lucide18/stroke1.75，仅两个操作图标。桌面36²/窄窗与coarse44²，前轮coarse缺宽已补|selected+focus、disabled hover隔离、关闭后焦点还须实际旅程。未给图表SVG全局尺寸，未新增图标资源|
|R08 行为、数据与共享范围|running TSX与 before 对比仅Lucide import及两处glyph替换；cutoff/model/events/money/state/handler/chart init/effects/range无差异。wrapper只新增场景/样式文字与details结构，原reset/router/key/theme-state不变；主题视觉切换不加入key。结果/比较既有布局CSS未扩展|真实T0→下一日bar/成交、运行播放、主题往返、来源返回、drawer关闭、长菜单，以及共享预览工具对结果/比较桌面与390的影响都由 root 接受；源码无 handler 差异不能代替功能回归|

### 最终 ready 尚缺的两个 R06 明确角色覆盖

|真实元素 / 源码|可复现级联结论|最小修正|
|---|---|---|
|`recovery-prototype.tsx:253` 的 `.recovery-reason-details`，旧 `recovery-prototype.css:137`|显式12px/1.45产生17.4px行高，不继承统一容器22px；最终主题尚未列此元素。属于恢复原因的辅助文字，冻结规则要求12/18|统一 observe 作用域对 `.recovery-reason-details` 明示12px/18px；展开与summary的实际computed一起验证|
|`running-prototype.tsx:1527` 的 `p.config-exposure`，旧 `running-prototype.css:1248–1256`|旧12px!important仍有效；最终通用 `.drawer-content p`14/22修改其行高22px而不能覆盖字号，组合为12/22。属于配置中的已见后续来源辅助说明，要求12/18|统一 observe 作用域对 `.config-exposure` 明示12px/18px，必要12字号沿既有!important；不删除已见后续日期/来源/时区文字，不改曝光状态|

### 复核文件身份

以下为2026-10-09 23:23:05 +08:00读取的SHA-256。本次源码读取与实施者补丁并行，hash读取已经跨越两处行高补丁；此表不能视为上表FAIL状态的冻结。23:24最终逐selector读取与hash匹配后另行接受：

|允许文件|SHA-256|
|---|---|
|full-workbench-preview.tsx|`b0a80086cbcc213b6a3ddc4e5679306e1cd3f36be425b831d3cc208618acc5fb`|
|full-workbench-preview.css|`eab90e4d3554ce53c8b3179569acbb8106fca3bc879f7ab92e5e74b9e6142674`|
|workbench-visual-theme.css|`d173672baa0790c6993076f0486bc25486dc86c5ba9a6f51dfb0d26f15c4e2f9`|
|running-prototype.tsx|`360650f1688855c9195b290c344491c78fd2379e8836d3b250fe709e11bdcb8a`|

本次 source 范围无需数据库或浏览器写入；没有执行持久化、实际回放或视觉验收。报告仅更新本文件，未修改实施文件或项目接受记录。

## 最终补齐后的源码门槛（2026-10-09 23:24 +08:00 追加）

**SOURCE PASS，限定四允许文件、R01–R08受检源码与root明示的R01等效排版；不等于视觉或功能接受。** 在root报告Luna最终补齐后，重新读取实际selector、其旧CSS来源与四文件SHA-256。未发现上述遗漏仍然存在，也未发现本轮增加几何或业务handler变更。历史FAIL均保留。

|上一轮遗漏 / 最终补齐|实际最终来源|独立源码确认|
|---|---|---|
|统一场景按钮radius6|`full-workbench-preview.css:33`|unified作用域显式6px，覆盖base4px；不用修改原版4px|
|drawer模块标题18/26/600|`workbench-visual-theme.css:503–507`|h3显式600，覆盖原running-prototype.css中620|
|恢复原因辅助12/18|主题`:406–410`|真实`.recovery-reason-details`字号12px、行高18px；覆盖旧12/1.45，summary按此继承|
|配置后续来源辅助12/18|主题`:406–410`|真实`.config-exposure`字号12px、行高18px均!important，晚于通用drawer p14/22且覆盖旧字号!important；源日期/来源/时区文字无改|
|恢复操作与kicker字重|主题`:386–404`|recovery-primary600、secondary500、kicker400；正文14/22、辅助12/18角色保持|
|首轮其余遗漏|主题真实tab span/menu b/dd/trade b/demo summary等selector，preview nav/summary及coarse规则|新规则命中真实元素，内联字号13使用局部!important14覆盖；44目标规则覆盖窄窗/coarse；完整说明和业务内容保留|

23:24:28读取最终四文件SHA-256与上表23:23哈希一致，主题最终身份为 `d173672baa0790c6993076f0486bc25486dc86c5ba9a6f51dfb0d26f15c4e2f9`。running TSX仍仅两个Lucide glyph替换及import，wrapper保持原reset/router/key与主题state，故没有新行为差异。没有以源码PASS取消以下必需验收：真实DOM角色/命中范围、同状态整页与断点视觉比较、主题往返、逐日bar/成交揭示、播放、菜单/抽屉/来源返回、共享结果比较预览回归。跨平台逐字中文字体命中与物理触摸继续NOT VERIFIED。

## 第二批 R09/R10：首次 ready 仍失败（追加，保留首批 SOURCE PASS）

首批源码通过后，root 的独立真实画面复审发现窄窗图表被过多整行区域挤到下方、密集“再平衡”marker文字互相覆盖。冻结合同新增 R09/R10，允许局部自然换行和统一样式 marker **文字呈现**修复；原 marker 日期、点/箭头、颜色、完整事件和阶段截止不属于删减范围。`first-final-source/`及其冻结JSON保留首批 SOURCE PASS 身份。此节没有浏览器操作，画面结论来自 root 的新鲜浏览器证据；以下尺寸另由本审查读取其JSON直接核对。

### R09 新鲜视觉 FAIL 未被源码改动取消

|同一完整场景/统一主题|root 保存的证据|独立读JSON确认|
|---|---|---|
|760×800|`final2-check-complete-760.jpg/.json`，JSON时间15:37:53.623Z|图表y598、高320；header53、timebar56、chart-heading46；context59|
|759×800|`final2-check-complete-759.jpg/.json`，JSON时间15:37:55.440Z|图表y827、高280；header143、timebar117、chart-heading96；context77。与760仅差1px，图表位置差229px，超过R09冻结≤60px|
|390×844|`final2-minimal-complete-390.jpg/.json`，JSON时间15:37:23.978Z|图表y1125、高280；header143、timebar172、chart-heading150；context135。root对照首批y1047，图表进一步下移78px|

第二批首次 ready 从 grid 改为 flex，仍以 header-actions 的 `flex-basis:100%`、chart-switch 子控件160px basis、position旧width100%等组合制造固定整行；原≤759的 timebar/chart-heading column 规则必须逐项明确覆盖，不能以父容器已有flex-wrap推断整个区域按容量自然排布。root已据真实画面退回实施者。自然换行、完整文字、44px命中、原图高、≥1024侧栏320及共享预览工具须一起重新校准；不以“无溢出”接受上述 chart-first 失败。原 synthetic-badge 在 `running-prototype.css:1363–1366` 的 `order:3`亦需注意：R09保留同DOM顺序，统一窄窗不应无意继承此重排。

首次 ready 的 running TSX 与原冻结source对比，新增marker helper/ref/signature及既有theme/range/resize/data更新路径中的文字刷新；createChart的初始化选项、mode依赖、setData数据切片、range保存/恢复、业务state/handler、save与models未见扩大修改。wrapper的reset/key/router/主题state保持不变，结果/比较业务布局未扩展。该范围结论不证明R09实际布局或R10文字正确。

### R10 源码 FAIL：绘图区边界与单事件/null坐标

首次 ready 读取到 `running-prototype.tsx` 的 `markerLabelsForLayout`（当时132–166）按cursor最新优先、实测canvas文字宽度及timeToCoordinate坐标去碰撞，空text保留marker本身；原版样式走原事件名称。方向符合冻结范围，但仍有三个明确边界遗漏：

|源码事实|可复现问题|最小修正，不改变事件与图范围|
|---|---|---|
|调用以 `root.current?.clientWidth` 作为visibleWidth|chart容器宽度包含右price-axis；timeToCoordinate返回的是时间轴/绘图区局部坐标。靠右label可落在价格轴，容器边界检查仍判可见|用同一 `chart.timeScale().width()` 作为边界，再按halfWidth检查左右；不要fitContent或改range|
|`preserveAllText || events.length < 2` 提前返回全名|仅一个事件时完全跳过边界检验；靠左/靠右单事件文字仍可裁切|仅原版 `preserveAllText` 直接返回；统一样式单事件也执行坐标及边界检查|
|`candidate.x === null` 直接continue而保留原名|未映射到时间轴的事件不进入accepted区间，却仍带文字；由plugin裁切不能证明该文字符合统一边界规则|统一样式null坐标明确设text为空，保留点/日期/shape/color与完整侧栏/抽屉原文|

依据为项目**实际安装的官方 Lightweight Charts API**，非推测新接口：`node_modules/lightweight-charts/dist/typings.d.ts:2946`声明timeToCoordinate返回局部x或null，`:2954–2957`声明timeScale.width；`dist/lightweight-charts.development.mjs:12931–12935`从time索引映射局部坐标，`:12947–12948`的width返回timeAxisWidget实际宽度。此API与坐标属于同一尺度；包括右price-axis的外层clientWidth不等价。

上述 source FAIL 已交给 root 并转给实施者。第二批首次 ready 后工作文件已进入再修，不把后续正在写入的source/hash当成上述失败版本的冻结。等待新 READY 后重新读取四文件与契约，另追加最终source gate；继续保留首批 SOURCE PASS、其后独立视觉 FAIL、当前第二批 FAIL 的完整时间顺序。最终视觉/最小真实图表旅程仍由 root 独立接受。

## 第二批 final3 早期画面仍失败（追加）

root第三次校准的早期实际画面仍发现R09残余，未直接接受：`final3-check-complete-759.json`，2026-10-09T15:43:35.645Z记录图表y687/高280，header53、timebar117、chart-heading46、context77。与既有同场景760px图表y598差89px，仍超过冻结≤60px。root定位为timebar actions `flex:1 1 280px`使402px分配空间承载约446px完整操作内容、再生成第二行。该FAIL保留；后续实施者把actions及context tools改为按内容auto。23:44的中途hash与晚些selector跨越补丁，不拿该hash为晚些源码接受身份。最终受检身份如下。

## 最终校准 READY 后独立 SOURCE PASS（2026-10-09 23:46 +08:00 追加）

**SOURCE PASS，仅R01–R10与四允许文件的呈现/marker文字范围；实际视觉、状态、真实图表旅程继续由root独立验收。** 等root明确最后一次READY后，重新读取实际文件、冻结原始source、首批finalsource与R01–10合同；23:46:13及随后第二次SHA-256一致。未参与实现，没有浏览器操作、数据库写入或实现改动。

|冻结规则|最终源码覆盖与位置|不能由此替代的接受证据|
|---|---|---|
|R01 预览工具与常显状态|wrapper保持原入口/reset/key/router/theme-state；nav局部横滚，原生details默认关闭，原场景/视觉/完整说明保留。root明示授权相邻常显scene/theme/合成摘要的等效排版。preview CSS窄窗与coarse的nav/summary/按钮44，radius6与focus2/offset2仍存在|默认折叠/展开、完整说明、横滚后键盘最后入口，以及跨结果/比较共享工具的实际图与操作|
|R02 自然文档流、恢复基线与原图高|主题`:361–377`自然height:auto/flex:0 0 auto/overflow:visible，恢复max1240/居中/中文font角色。新`:762–766`明确≥760原clamp320/40vh/360、min320；≤759原280未改|实际中间断点无遮挡/压缩；图表空间仍须整页看图。原图高规则重述不等于全桌面360|
|R03 主次财务层级|首批24/32/500 KPI、14/22/500侧栏金额、18/26/600模块及tabular保留；本批菜单与成交主字段补500（`:440–449,529–533`）|盈亏实际颜色、完整数字与阅读焦点不能由字号token代替|
|R04 窄窗44及图后侧栏|≤1023按DOM顺序叠放chart/side；业务button/select/summary44，独立icons44²；宽屏及coarse规则保留。没有恢复旧600/759缺口|实际44rect与控件全可达、focus/disabled分别验证；物理触摸仍NOT VERIFIED|
|R05 完整价格/KPI|全宽取消重要金额ellipsis/hidden，窄≤1023两列、≤359单列，无原数字/比例变更|320/390及长值actual全文、换行可读性|
|R06 中文与真实嵌套角色|前次漏项真实tab span、menu b/small、drawer dd/trade b/h3、recovery summary/p/label/reason与config-exposure保留显式14/22、12/18。`:406–410`原因及后续来源12/18!important，恢复600/500/400字重仍在|实际computed与逐字CJK字体命中分别记录，跨平台没有以源码通过代验|
|R07 选中/焦点/图标|持仓四边1px #3797ff/底景、focus2/offset2；ChevronLeft/X18/stroke1.75、36²/44²局部控件。未套全局图表SVG|真实selected+focus、关闭后焦点、disabled不被hover重新激活|
|R08 行为与范围|running TSX与原before完整diff除两个Lucide glyph外，仅授权helper/ref/signature及既有回调marker文字刷新。createChart初始化选项、mode effect依赖、setData切片、logical range计算/保存/恢复、模型/截止/业务state/handlers/save未改。wrapper仅结构/说明文字；结果/比较业务布局未扩展|T0→下一日、播放、主题往返保留日期/范围、来源返回、菜单/抽屉及共享结果/比较实际旅程，必须另过|
|R09 自然换行、DOM顺序、320侧栏|主题`:628–737`明确header/timebar/chart-heading均row+wrap；headeractions、timebaractions为0 1 auto/width:auto，position解除旧width100，chartbuttons解除160basis/100width；badge order0覆盖原order3。preview CSS`:39–49`context wrap、tools0 1 auto，内容保留。`:756–760`覆盖旧1024–1059侧栏296为320；≥1060原minmax296/320最大轨道320保留|760/759图y差≤60、601/600无遮挡、390/320内容可达仍须新鲜画面；新增≤430图表selector布局需430/431两侧K线画面，不宣称旧FAIL已被源码PASS取消|
|R10 仅统一marker文字|running TSX`:132–167`原版仅preserveAllText直接返回；统一单事件检查边界、null坐标明确空text。`:409–442`取当前可知snapshot events，plotWidth用timeScale.width；canvas按实际12px/CJK链测宽，8px间隙，按cursor/index最新优先。所有event仍逐项push原time/position/shape/color/size，T0独立below marker保留。只有text允许变空|标签碰撞、边界和最新事件可读必须净值/K线320/390实际截图；主题原版往返、resize/range刷新不能由纯helper测试代验|

本批新增≤430局部图表selector规则将标的select安排完整行，仍保留两个图型按钮和完整标的文字；没有将整页header/timebar/chart-heading强制列排。它属于新实现边界，已要求root把430/431两侧纳入实际比较，以实看决定是否形成新的明显断层。

### 独立只读执行核对

从当前TS AST提取**实际**`eventType`和`markerLabelsForLayout`，使用项目TypeScript转译、Node VM执行断言，无写入测试文件或实现。空集、单事件左边界、单事件右边界、单事件null、可见单事件、重叠最新优先、非重叠全名、原版全名保留、数组逆序最新优先9项均PASS。测试使用36px注入测宽及100px绘图区，只证明helper边界/优先级逻辑；真实canvas字体/坐标与最终视觉需另验。

另从冻结before与当前两个TSX AST收集全部`on[A-Z]` JSX属性，按原表达式文本比较：running64个、wrapper8个完全一致。全TSX diff亦未发现业务函数修改；新增range/resize/theme/data-path调用均只刷新marker呈现，不新增range拟合/重新初始化。`currentEvents`从当前snapshot读取与原visibleSnapshots最后项在现有clamped chartCursor下相同：`running-prototype.tsx:647–653`将chartCursor限制到selectedMax，`:683–685`使用同一ledger索引，`running-model.ts:268`每个snapshot保留当时累计events。没有使用未来snapshot或删除历史事件。

### 最终受检源码身份

|文件|SHA-256（23:46两次读取一致）|
|---|---|
|full-workbench-preview.tsx|`b0a80086cbcc213b6a3ddc4e5679306e1cd3f36be425b831d3cc208618acc5fb`|
|full-workbench-preview.css|`a8922b03e0c413b2e4cf9e7c57ab3c7ed38b1da4bbc92138eaee9558113a9570`|
|workbench-visual-theme.css|`35e93012dc8145df615a103a34513fbb33b3ff0b586fea30f531ffd3daec619f`|
|running-prototype.tsx|`44b4766e0c809f269341895892d7725a6b9897f7c1f53f0ab06cd9d93e1ed2ae`|

本报告保留初始FAIL、首轮源码遗漏FAIL、首批限定SOURCE PASS、第二批首次ready视觉/source FAIL及final3早期视觉FAIL。上述最终SOURCE PASS不覆盖这些失败证据，不单独给票04/全功能/视觉完成结论。若实施文件继续变化，以上身份需重新审查；root只在全部适用门槛各有证据后更新最终接受记录。

## R11 手机更多组合浮层补充：有限 SOURCE PASS（2026-10-09 23:54 +08:00）

root真实 `final3-more-menu-390` 新发现菜单x=-260.57、宽366，主要内容落在左侧视口之外。冻结合同及coverage实现前新增R11/E06，允许仅unified≤759把浮层锚点从落入独行的“更多组合”小容器移到完整portfolio-selector，保留原宽/max-height/滚动、原文、handlers/焦点行为。原R01–R10源码结论保留，该新浮层FAIL未被先前SOURCE PASS取消。

**R11 SOURCE PASS：只改变允许的菜单定位；没有业务、其余几何或文字角色diff。** 读取最后READY后实际主题`:693–714`：portfolio-selector追加position:relative；portfolio-more覆盖旧position:relative为static并保留width:auto；menu重述top:calc(100% + 6px)/right:0。原菜单仍position:absolute，宽min(390px,100vw-24px)、max-height:min(56vh,430px)、overflow-y:auto、z-index等来自 `running-prototype.css:260–274`，未改。原版和≥760不受该≤759 unified作用域影响。

在内存中反向移除上述三处精确补丁，所得主题SHA-256**精确等于**本报告23:46受检final3的 `35e93012dc8145df615a103a34513fbb33b3ff0b586fea30f531ffd3daec619f`。其余三个允许文件SHA仍等于23:46身份，故确认本批没有额外init/range/数据/handlers/state/persistence、marker或结果/比较布局差异；R01–R10静态接受继续有效。新主题SHA-256为 `5a58d7981428e2b21cd682430113b4f6e4094280a4c708416bb3a0add6ae6b0f`（2026-10-09 23:54:08 +08:00）。

只读核对root保存的 `final4-menu-390.json`（15:53:35.015Z）：menu x14/w366，横向末端380在390视口内；标题实际14/22/clip，未删原文。此图menu y450/h430、bottom880，超过844视口底36px；必须把“横向完整可见”与文档/菜单滚动到末项可达分开记录，不能用首张图宣布所有纵向内容一次可见。320/390/601/759菜单画面、760/1280旧锚回归、长名称选择、末项键盘滚动、Escape回焦点仍由root新鲜真实证据和独立视觉审查接受，本source报告不替代它们。原final3浮层FAIL与后续final4证据均保留。
