# 首页视觉复用 · 实际样板验收

> 本文为0.6历史局部接受记录。2026-10-09严格回归曾因601/760及第一批修后759/390–320新鲜FAIL重开04；2026-10-10以18档及关键浮层的新证据接受本轮R01–R11并关闭04。下面历史PASS不替代[0.7本轮回归记录](observe-regression-20261009.md)，原FAIL与其他范围NOT VERIFIED保留。

2026-10-09，范围票04。协调者 root 独立接受本票的可逆视觉样板；独立审查者 benchmark_inventory 未参与实现，直接比较实际截图并核对源码。**本票桌面1440/1280、390视口视觉、受影响鼠标/键盘旅程和主题状态安全 PASS**。这是设计候选，不代表用户选定或生产全局推广；整体票01仍 open，原 NOT VERIFIED 和全仓检查 FAIL 不关闭。

准确首页参考、问题诊断、参数和后续固化范围见 [0.6规范](homepage-style-reuse.md)。参考是“首页控件迭代 ｜ 图表区”当前 `/design-preview` → “视觉调整”，不是已撤回的早期样板。基于当前工作树与原远端 `codex/strategy-workbench-v1-design@9c2b3d2`。

## 直接预览与对照

- [完整观察](http://127.0.0.1:3069/?prototype=strategy-workbench&view=observe&scene=complete)
- [完整结果](http://127.0.0.1:3069/?prototype=strategy-workbench&view=results&scene=complete)
- [完整比较](http://127.0.0.1:3069/?prototype=strategy-workbench&view=compare&scene=complete)

默认“首页统一”。同一业务实例上切“原版样式 / 首页统一”，可以对照阅读感受；只改变主题，不重挂回放。导览和演示场景切换会重开固定预设，页面已明确说明。此预览使用三个月、双策略、各自10万元合成数据；刷新重置，不是原始交易记录的替换。

所有下文图片均为真实浏览器新截图，不是生成图。证据根目录为 [style-unification-20261009](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/)，每次完整采集附有同名 DOM txt 与 computed JSON。图片为JPEG，CSS视口和文件头尺寸均独立核对；DPR1。

|画面|修改前 / 同数据原主题|统一后|
|---|---|---|
|观察1440×900|[真实修改前](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-before-1440.jpg)|[最终交付新图](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-delivery-final-1440.jpg)|
|结果1440×900|[真实修改前](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-before-1440.jpg)|[最终画面](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-final-1440.jpg)|
|比较1440×900|[真实修改前](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-before-1440.jpg)|[最终画面](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-final-1440.jpg)|
|观察1280×800|[同实例原主题](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-original-style-1280.jpg)|[统一后](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-final-1280.jpg)|
|结果1280×800|[同实例原主题](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-original-style-1280.jpg)|[统一后](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-final-1280.jpg)|
|比较1280×800|[同实例原主题](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-original-style-1280.jpg)|[统一后](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-final-1280.jpg)|
|观察390×844|[同实例原主题](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-original-style-390.jpg)|[最终首屏](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-fixed-final-390.jpg)、[时间与图型控件](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-time-controls-fixed-final-390.jpg)|
|结果390×844|[同实例原主题](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-original-style-390.jpg)|[最终首屏](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-final-390.jpg)|
|比较390×844|[同实例原主题](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-original-style-390.jpg)|[最终首屏](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-final-390.jpg)|

1280/390原主题对照包含新增预览wrapper，不冒充旧bundle。原先before1280/390错误捕获实际是1440×900，保留为 `*-capture-fail.jpg`，不算响应式证据。净值/回撤/仓位比较固定数据和截止；不同图型自身有不同坐标，不将图型之间当审美候选。

## 推荐与实测

推荐共用文字、容器、动作、选中及焦点角色，继续旧工作台的图表与账本结构。更大资产字级增加摘要高度，未缩减实际图表抵偿。窄屏采用内容自然换行、分析区下移与局部表格横滚；完整价格和判断保留。

|代表性元素|旧观察实测|统一后真实computed|
|---|---|---|
|页标题|22px / 24.64px / 650|24px / 32px / 600|
|主要资产|16px / 20px / 700|24px / 32px / 500，tabular数字|
|业务主动作|13px / 18.85px / 650，#357dda|14px / 22px / 600，#2169cc，圆角6|
|业务图型切换|12px / 17.4px|14px / 22px / 500|
|分区标题|16px / 20px / 620|18px / 26px / 600|
|中文说明|部分10–11px或Mono链|12px / 18px，显式sans中文回退|
|完整比较账本|旧12px / 15.6px|最终实际14px / 22px，tabular-nums|
|命中高度|部分导航30、range22、summary23|桌面所有已测交互高度≥36；390三页所有已测交互高度≥44|
|焦点|分散浅蓝规则|真实键盘焦点2px #9ecaff、offset2；与选中同时存在|

`observe-delivery-final-1440.json` 的可见标题、资产、主动作、图型和持仓标题，以及 `computed-final-ledger.json`、代表390 JSON支持此表；隐藏视图rect为0的条目不用于实际可见测量。已测的是控件高度，不据此宣称所有点击框都为36×36或44×44。中文fallback源码与computed通过，浏览器fontStatus loaded只证明资源状态，逐字字体命中未测。

明示例外：预览导览/场景/样式切换这些辅助工具文字12/18，仍使用36/44命中高度；正文业务控件14/22。图表轴文字、无文字range自身font-size、文字方向符和数据标记按其角色保留。现有Lucide未批量换尺寸，18/stroke1.75仍为后续固化候选。导航辅助蓝和部分来源辅助色沿现有状态保留，不能声称页面每一条文本都已改为同一色。

实测可见主动作白字/背景rgb(33,105,204)，未选中样式工具辅助字rgb(173,187,207)叠加面板rgb(17,26,43)，选中边框rgb(55,151,255)与背景rgb(22,61,99)，焦点rgb(158,202,255)；它们与候选色匹配。以这些实际值计算的主动作白字5.307:1、辅助字对面板8.940:1、焦点对面板10.233:1，完整计算见 [contrast-measured.json](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/contrast-measured.json)。结构线#263650对面板1.431:1仅作分组；主蓝对抬高层2.966:1不能单独表示必要选中边界，因此选中另加#3797ff边框。不是全页面每像素对比度审计，也未把disabled灰字当普通正文门槛。

## 分开的接受门槛

|门槛|结果 / root证据|
|---|---|
|真实图表旅程|PASS：T0净值1、现金100%、零持仓；切K线，下一交易日实际6月17日新bar与首次成交箭头出现；播放后实际6月18日新bar出现，再暂停。见 `t0-after-1440`、`t0-candles-after-1440`、`t0-firstbar-after-1440`及 `playback-newbar-paused-after-1440`。早期运行/暂停同为6月17日的截图不作新bar证据。|
|图型及来源导航|PASS：结果和比较净值/回撤/仓位实际切换；贡献、费用、滑点、成交额、事件与来源抽屉完整；事件回看后返回保留9月13日、原图型和筛选。见 `results-{drawdown,position-focus,ledger,source-drawer,source-return}-after-1440`、`compare-{drawdown,position,source-drawer,source-return}-after-1440`。|
|主题状态安全|PASS：质量组合→K线→7月12日→统一/原版/统一；前后日期39、资产¥100,626.03、收益+0.63%、日损益¥-449.01/-0.44%、现金20.0%完全一致。见 [状态JSON](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/style-state-preservation.json)和三张style-preservation图；可见网格/范围保持，未读取隐藏chart logical-range API，精确内部range不声称实测。源码仅applyOptions，无fitContent/重建/数据范围改变。|
|独立视觉对照|PASS：1440/1280三页、390首屏/操作/日期/仓位/价格/完整账本，以及代表选中、真实焦点、T0 disabled。见 [独立审查](../../../.scratch/strategy-visual-system-20261008/reports/style-unification-visual-review-20261009.md)。root另直接查看最终1440三页、新交付观察图、390运行操作/range focus/账本右端，不以worker报告代验。|
|390可读性与操作|PASS：文档宽度390，无页面横溢；日期两条基线可读；仓位与金额用局部实际键盘滚动到右端读取，焦点明确。窄表首列取消sticky避免遮挡；所有已测交互高度≥44。范围仅鼠标/键盘及CSS视口。|
|原盈亏/曲线/数据|PASS（本票变化范围）：既有盈亏变量、策略系列和计划/实际数据不改；Canvas只统一背景/网格/轴字体。完整资金、份额、原文保留。未扩大为所有原生产页前视审计。|
|检查|root typecheck exit0（会话81002）、scope ESLint exit0（会话5060），后续仅CSS修正；最终diff-check exit0。日志 `reports/style-unification-root-{typecheck,eslint,diff-check}.txt`。全仓历史lint17errors/1645warnings、全仓测试31failed/2694passed/6skipped仍FAIL，不用本票检查覆盖。|
|数据库持久化|NOT APPLICABLE：旧完整预览纯内存、不写DB。服务显式隔离DB。原生复盘样板的localStorage与生产SQL链不是此票的接受结论。|

功能与状态操作由root在实际浏览器完成；上述旅程的采集早于最后两处仅窄屏几何/完整账本文字CSS修正，业务源码未再变化。最后受影响区域重采并独立复验。桌面首屏最终图部分早于这两处修正；两处对桌面关闭账本首屏无影响，交付观察1440与展开账本1440另于最终源码冻结后重采。证据清单明确时点边界，不将旧截图重新绑定为最终采集。

## 代表状态与修复反例

- [运行中44px操作](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/observe-running-controls-final-390.jpg)、[真实range焦点](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-range-focus-final-390.jpg)。
- [结果贡献合计右端](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/results-contribution-final-390.jpg)、[比较完整资产](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-summary-prices-final-390.jpg)。
- [净值完整日期](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-net-dates-final-390.jpg)、[回撤完整日期](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-drawdown-dates-final-390.jpg)。
- [仓位左端](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-position-left-final-390.jpg)、[仓位右端55.4/34.6](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-position-right-final-390.jpg)。
- [完整账本左端390](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-ledger-fixed-left-final-390.jpg)、[右端390](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-ledger-fixed-right-final-390.jpg)、[桌面资产](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-ledger-assets-final-1440.jpg)、[成交额与交易次数](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/compare-ledger-turnover-final-1440.jpg)。

历史FAIL均保留，不能覆写成PASS：390观察挤压、结果419px/标题竖排、比较日期相撞、sticky遮挡价格；最终发现Running更具体36px规则覆盖新44px规则，及窄屏170px flex-basis导致空白；账本曾覆盖错误 `.comparison-metrics` 类，真实DOM `.comparison-full-ledger` 仍12px。实际复验修正权重、窄屏basis和正确类后分别另存新图。文件含 `narrow-*-fail`、`sticky-price-fail`、`controls-specificity-fail`、`time-controls-specificity-fail`、`ledger-*-font-fail`，完整列表在 [证据清单](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/manifest.json)。`compare-ledger-after-1440`实际是仓位图，`compare-ledger-after-390`实际是旧净值图，不作为展开账本证据。

## 明确保留未验证边界

NOT VERIFIED：实际宽屏粗指针设备、emulated/physical touch、软键盘、Windows/逐字中文字体命中、全部hover/active实际动作、完整Tooltip/图表缩放未来信息检查、原生复盘编辑态及生产SQL保存链、未定位启动包专项符合性。CSS coarse44与窄屏几何已分开通过源码审查，不能据此写真实设备PASS。原票01和0.5其他上下文的未验证项继续保留。

选定前需要用户从实际图选择的是焦点、密度、中文阅读与操作清晰度；参数由设计者校准。选定后公共theme、Button/Input/Select/Popover、ChartToolbar/DrawingToolbar/ReplayControls、图表背景/字体配置与项目指令的固化范围见0.6规范。本票仅在当前样板共用一个作用域主题，未跨工作树推广。

## 文件冻结与重启

实现入口：`app/components/strategy-prototype/full-workbench-preview.tsx`；统一样式：`workbench-visual-theme.css`；wrapper：`full-workbench-preview.css`；Running可选视觉prop/Canvas applyOptions：`running-prototype.tsx`。最终源码SHA256见 [source-freeze.json](../../../.scratch/strategy-visual-system-20261008/evidence/style-unification-20261009/source-freeze.json)，实际证据hash/尺寸/角色见manifest。未提交、推送或合并。

3069本地服务保持运行。交付末次真实浏览器检查为2026-10-09 17:45:39 Asia/Shanghai：临时视口覆盖已恢复，实际1280×720/DPR2、截图1280×720（浏览器接口按CSS尺寸输出），文档宽1280，当前完整观察/首页统一可见。此图仅证明交付服务可访问，不充当固定1440/1280/390视觉接受图；截图及元数据见manifest中的delivery_browser_check。标签已标为交付保留，open_in_codex返回queued，不冒称已在隐藏窗口立即打开。

重启时在当前工作树执行（使用现有依赖，不新建业务DB）：

```sh
TRADEREVIEW_DB_PATH="$PWD/.data/strategy-visual-acceptance.sqlite" \
WRANGLER_LOG_PATH=.wrangler/strategy-visual.log \
PATH="/usr/local/Cellar/node/26.0.0/bin:$PWD/node_modules/.bin:$PATH" \
node scripts/start-local.mjs --dev --port 3069 --hostname 127.0.0.1
```

端口为此样板独立预览端口；不改conf/runtime.json默认共享业务库路径或其他工作树服务。
# 后续严格回归状态 · 2026-10-09

此文件原PASS保留历史。新鲜601px发生按钮/恢复区及图表/侧栏重叠，760px收益截断，390px预览工具挤占，1440px基线及次级数字层级错误。04已重新open / acceptance-failed；U10/U12/U15相关整体结论重新打开，当前视觉gate FAIL。新证据与后续复验另存observe-regression-20261009，禁止用下方历史PASS覆盖本轮FAIL。
