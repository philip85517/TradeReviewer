# 完整观察统一版 · 严格回归与调整

2026-10-10滚动复验最终：用户确认整体视觉；随后下滑FAIL现已最小修复并用新实际输入和独立画面对照接受，04/05关闭于授权范围。[最新滚动接受与启动](observe-scroll-20261010.md)。下段保留修前FAIL及R01–R11历史，不将旧全页截图当滚动证据。

2026-10-10后续：用户确认整体视觉，但报告无法下滑。root实际复现1280×720文档1051px、body hidden，wheel/End均scrollY0；当前仅滚动门槛FAIL，04重开，[05修复契约](../../../.scratch/strategy-visual-system-20261008/issues/05-complete-preview-scroll.md)。下文R01–R11历史接受保留，待新证据后追加滚动接受。

2026-10-09。基于当前 `facb/TradeReview`、`codex/strategy-visual-system-20261008`，继续原远端设计分支基础。root 负责整页/数据链并独立接受，Luna `gpt-5.6-luna` high 仅实现四个有界呈现文件；两名未参与实现的审查者分别检查规范/级联与真实截图。没有提交、推送或推广生产。

2026-10-10最终结论：**本轮授权范围 PASS，04重新接受并关闭**。修前、第一批修后及Final3菜单的FAIL全部保留，新增证据逐项关闭；不是沿用旧三档PASS。接受范围是完整观察的视觉/响应式修复、相应真实运行旅程，以及结果/比较的共享导览。其他原型、生产保存及全量未来信息审计不因此通过，整体01票仍open。最终记录见下文。

## 发现与修复规则

证据目录：[新鲜截图、DOM与实测](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/)。图片均实际浏览器采集，DPR1；旧截图只提供设计历史。参考首页当前v0.2的文字/颜色/状态角色，复盘布局仍按DD05–09及用户图表优先要求。

|问题位置 / 图证|来源 / 实测|任务影响 / 根因|具体规则|接受方法|
|---|---|---|---|---|
|601px时间条与图/侧栏，before-complete-601|旧running max759 + theme自然高度只max600；timebar仅48px容纳多行、main166px容纳280px图|动作重叠、图表被覆盖；断点规则与100dvh压缩冲突|观察自然文档高度，所有业务区不压缩；窄图、caption完整结束后再出现侧栏|600/601、759/760直接看图+rect；真实点击、Tab；图高不能减少|
|760px当日收益，before-complete-760|24px数字仍四列，继承nowrap/hidden/ellipsis|实际显示¥1,097.16 · …，收益率不可读|完整金额与百分比全宽度可换行；中间宽度两列，极窄单列|每断点可见全文及scrollWidth/clientWidth；截图独立确认|
|辅助预览工具，before390/1440|preview-context≤980 column、gap18；390 nav+context约368px，图y1224；桌面图y478|用户先阅读工具说明，主工作面推后|紧凑导览；仅场景/样式/预览说明进入可展开工具，合成/当前预设常显；业务内容完整|关闭/展开状态，全部入口可达；测常驻高度与chart顶缘，图高保持|
|侧栏金额层级，before1440/1280|theme把holding-value、cash、nav、total与主KPI捆为24/32；持仓块341px|明细抢主指标层级，事件落到屏底|顶部KPI24/32/500，持仓/现金/净值/重复总资产14/22/500，正文14/22、辅助12/18|同范围整页图；持仓块高/事件位置与完整数量价格|
|恢复对齐/字体，before1440及extra-audit|恢复x28，主体x100；font shorthand13/18.85，generic在中文前|左右基线漂移、文字角色脱节|与主体共享max1240；显式CJK回退在generic前，业务14/22、辅助12/18|1440/1280与窄屏rect，展开工具computed及焦点|
|菜单子字号，before-more-menu + menu-fonts|父14/22未覆盖b12/16.8、small10/13|组合选择文字及本金过小|名称14/22/500，本金辅助12/18；长名称完整换行|实际长样例选择、菜单末项可达、Escape回焦点|
|图标/选中，before-selected/event-drawer|持仓仅底边1px；上一事件34×40.59/34×44，×继承正文14|点击范围与图标重量不一致；选中边界未按规则绘制|现Lucide18/1.75；图标目标36²/44²；选中四边1px+底景、焦点2px offset2|实际selected+focus、关闭/返回、disabled原因、DOM目标宽高与截图|
|759px断点，final-complete-760/759（第一批修后）|header53→143、timebar56→173、图头46→124；图y598→951|1px宽差将图推下353px；多个旧max759列排规则同时生效|组件各自按容量自然wrap，保持DOM/文字/点击框/原图高；760/759图y差≤60px|新final2同fixture两侧图与rect，不覆盖批1FAIL|
|390–320px净值图事件文字，第一批final-complete-*-full|Aug末至Sep13“再平衡”标签互相挤叠；Canvas标签跟每周点同密度|事件类型不可独立读；文字宽度没有参与布局|全部点/日期/完整详情保留；仅重复类型标签按真实坐标、文字宽度及8px净空稀疏呈现，当前最新优先|新窄净值/K线直接看图；主题/resize/视野刷新、原版不变与真实bar旅程分别接受|
|Final3手机更多菜单，final3-more-menu-390|x=-260.57、宽366，仅右侧105px露出；更多按钮独行到左侧后菜单仍以按钮right:0定位|选择名称大半在屏外；旧锚点与新流式布局不匹配|只在统一≤759将菜单锚到整个selector，原尺寸、全文、滚动、handler不改|Final4六档菜单与末项、长名加入、Escape回焦点；390 x14/w366，320 x14/w296|

疑似盈亏覆盖经实际测量不成立：正收益仍#26a69a，负收益原/统一均#ef5350。6/17同日实际对照资产¥99,979.87、-0.02%、组合/K线/可见日期一致。没有用源码猜测替代运行事实。

## 验收计划与边界

固定complete / EMA20 / 2024-09-13 / 同三个月双策略 / 净值。1440×900、1280×800、760×800、601×800、390×844前后可比；另320、600、759、980/981、1023/1024及实现新增断点两侧。功能/状态安全/视觉分别接受。无写入：合成预览纯内存，生产持久化NOT APPLICABLE于本票，不据此通过生产SQL链。服务显式隔离数据库`.data/strategy-visual-acceptance.sqlite`，不写业务库。

|门槛|当前结论|必须的新鲜证据|
|---|---|---|
|编译与源码|PASS（限定本票）|root typecheck/四文件scoped ESLint/build/diff均exit0；独立源码审查Running64及wrapper8个JSX handler等同before；标签helper9边界检查，R11精确三处CSS|
|实际端到端/状态|PASS（下文旅程）|真实净值/K线T0→6/17→播放暂停；主题负收益对照；来源返回、菜单/详情/恢复。内部logical range未读，不称全面测量|
|独立视觉|PASS（授权范围）|未参与实现者直接看18档净值整页、5档K线、6档菜单及末项、390/1280抽屉上底、焦点、恢复与长名；历史V01–V11 FAIL保留并分别关闭|

物理触摸/模拟触摸、Windows逐字字体、全量Tooltip/缩放前视审计、生产SQL保存与全局推广保留原NOT VERIFIED。鼠标与键盘会分别记录，不以窄窗尺寸替代触屏。

## 预览与重启

[完整观察](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=complete) · [可从头逐日](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=T0)。2026-10-10 00:01 Asia/Shanghai，root真实浏览器确认标题/完整预设/URL，恢复正常1280×720、DPR2并保留tab；lsof确认本任务node PID44702仍监听127.0.0.1:3069。最终live图与DOM同目录，服务继续运行。

在本工作树运行：

```sh
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" \
WRANGLER_LOG_PATH=.wrangler/strategy-visual.log \
PATH="/usr/local/Cellar/node/26.0.0/bin:$PWD/node_modules/.bin:$PATH" \
node scripts/start-local.mjs --dev --port 3069 --hostname 127.0.0.1
```

既有服务在3069，重启前按[项目流程](../../agents/development-workflow.md)核对进程归属，不终止其他服务。

## 最终复验：参数、画面与取舍

固定complete、EMA20、2024-09-13、同三个月双策略fixture及净值范围。Final3主矩阵18档：1440×900、1280×800、1060/1059、1024/1023、981/980、760/759、601/600、431/430、360/359/320（均高800）、390×844，DPR1。每档保存viewport及整页真实图、DOM、computed；不能用无横溢替代Canvas可读。Final4只改变≤759菜单定位三处CSS，独立审查精确反向恢复Final3哈希，另三文件未变；Final4重新采1440/390/760/759，主体几何完全一致。正常视口live图DPR2另登记，不混作同视口对照。

|实际比较|结果|取舍|
|---|---|---|
|1440图顶缘 / 高度|478.188/360 → 491/360|下移12.812px，完整字级与目标框需要空间；不称桌面首屏面积增加|
|390图顶缘 / 高度|1224/280 → 1053/280|提前171px；完整KPI、截止与44px控件保留，仍需滚动|
|760→759图顶缘|第一批598→951；最终598→622|353px跳变变为24px，符合≤60契约；320→280图高沿用原规则|
|601/600|图顶缘均741、高280|业务自然高度；图及caption之后再出现持仓，原覆盖消除|
|1024/1023|侧栏320；次档图后侧栏，图顶缘491→598|107px由摘要四列→两列产生，有内容原因；所有字段可达|
|360/359|图顶缘1101→1241|摘要两列→单列增加140px，完整金额优先|
|桌面主面板底部|仍有约200px空白|外壳随侧栏伸高而原图高保留；后续可评审按内容收束外壳，本轮未扩图范围|

最终实际字体：标题24/32/600，图头18/26/600，主指标24/32/500，持仓14/22/500；主动作14/22/600、36高、横padding14，更多14/22/500、36高、横padding11；独立箭头36²、窄窗44²，Lucide SVG18²/stroke1.75。恢复summary12/18、目标36/44为辅助原型例外，业务恢复正文14/22。`document.fonts.status=loaded`、Geist check true，仅证明加载与声明链，不证明逐汉字字库命中。

[最终computed](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/final4-live-role-audit.json)中的不透明代表色实算：主动作白字/#2169cc **5.307:1**，次要与更多#adbbcf/#111a2b **8.940:1**，事件箭头#a9bdd6/#0d1828 **9.281:1**。[计算结果](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/final4-contrast-measured.json)。结构线不独自表达必要状态；所有Canvas/Tooltip/半透明disabled叠层未逐像素验，不扩推这些样本。

root实际操作并直接观察真实图表：

- T0无持仓；下一日6/17净值实际揭示99,979.87及首次成交，A469.2351×¥94.76、B599.8956×¥75.87。另在真实日K线T0→6/17直接观察新bar与成交箭头；控件出现或mock图不是证据。
- 播放暂停到7/12，资产100,691.06、真实折线/日期/5条事件更新。原版↔统一保持6/17、组合、K线、金额与可见日期范围；内部logical range未读。
- 390选中A后Tab到B：A四边选中、B真实2px/offset2焦点，不能称同一项同时焦点。菜单末项通过Tab滚入可见区域；Escape菜单关闭回更多；加入80k完整长名组合，金额¥79,282.39及负收益完整。菜单高430px，390 top图纵向延伸超过首屏，需滚动末项，不称全部同时可见。
- 390/1280抽屉上/底、原文、计划/实际数量、开盘价、费用/估值及动作完整；Escape关闭。结果与比较点9/6事件→真实观察K线/抽屉→关闭→返回来源，恢复原R=9/13及来源页面。共享节点复验不扩推结果/比较业务整页布局。
- 展开恢复工具、创建9/13内存检查点、回看6/17、重载回9/13，日期与最远已看来源保持；明确仅内存，SQL保存不适用于本票。

代表画面：[桌面修改前](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/before-complete-1440.jpg)、[桌面最终整页](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/final4-complete-1440-full.jpg)、[390最终整页](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/final4-complete-390-full.jpg)、[选中与焦点](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/final3-holding-selected-focus-390.jpg)、[菜单最终](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/final4-menu-390.jpg)。完整证据、源码哈希、截图时点见[冻结清单](../../../.scratch/strategy-visual-system-20261008/evidence/observe-regression-20261009/manifest.json)。

[独立源码审查](../../../.scratch/strategy-visual-system-20261008/reports/observe-regression-standards-20261009.md)与[独立直接看图审查](../../../.scratch/strategy-visual-system-20261008/reports/observe-regression-visual-20261009.md)均限定本票PASS。root检查日志在reports/observe-regression-root-*.txt；R11为此前检查后仅CSS定位，最终diff-check再exit0。既有模型未改，本轮无新增模型测试，标签纯helper执行9边界检查。历史全仓lint17errors/1645warnings、单测31FAIL/2694PASS/6SKIP保留，scoped通过不代表全仓通过。

此外仍未验证：未定位设计启动包专项符合性、其他原型Text编辑/IME/导出及全局公共推广。候选0.7的[规则、例外及固化范围](homepage-style-reuse.md)同步；目前可评审，尚未变为用户正式批准的全局规范。
