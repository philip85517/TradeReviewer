# 当前页面诊断与修改要求

证据来自本轮运行的远端基线 A 与原生复盘，非旧稿截图。原生页面运行在隔离在线备份 `.data/strategy-visual-acceptance.sqlite`；未使用业务数据库写测试。基线 commit `9c2b3d2`，浏览器 macOS / IAB，DPR1。候选与最终截图的接受范围见 acceptance.md；字体链实测不等于实际汉字 glyph 来源。

## 1. 信息带与图表面积：保留结构，收敛强调

- 位置/截图：[策略台基线](../../../.scratch/strategy-visual-system-20261008/evidence/workbench-before-1440.jpg)。
- 来源：基线 `.scratch/strategy-portfolio-backtesting/workbench-design/index.html`，IF05/06/REPAIR03；固定A契约。
- 实测：1440×900上方48+48+48+38=182px；图壳1038px宽，右检查区320px；1280×800图壳878px宽。按钮大多36px高。
- 任务影响：重新增高标题、叠新工具带，会进一步挤掉绘图区；现有问题不能归结为「按钮都太大」。
- 原因判断：历史样式叠加让几类信息使用相近的字重/颜色，身份、操作、解释的边界比空间结构更值得校准。
- 修改规则：保留A空间预算；实验17/700、图头14；控件13/20/500、选中600、辅助12/18。主要动作实心，配置/保存等次要动作安静。不得迁移首页B或复盘布局。
- 验收：1440/1280同场景矩形对比，模式切换位移≤1px，图高达到原360/320底线，数字和原因完整。

## 2. 中文 fallback 顺序含混

- 位置/截图：[字体与控件实测JSON](../../../.scratch/strategy-visual-system-20261008/evidence/workbench-before-1440.json)，截图中文字混排见上图。
- 来源：A本地Geist Latin字体；`app/layout.tsx` next/font Latin子集；`app/globals.css` body链。
- 实测：A computed链为 `Geist, ui-sans-serif, system-ui, -apple-system, "system-ui", "PingFang SC", "Microsoft YaHei", sans-serif`；原生为 `Geist, sans-serif, "PingFang SC", "Microsoft YaHei", sans-serif`；fonts状态loaded。
- 任务影响：中文、拉丁、数字的视觉重量与基线难以形成可维护规则，系统变化可能改变中文来源。
- 原因判断：Geist未提供中文；泛型已在明确CJK字体之前。不能凭computed断言实际正在用错字体。
- 修改规则：显式CJK链放在generic之前；中文正文14/22/400；数字Mono且保留单位。Canvas显式传fontFamily/fontSize，不能只改DOM。
- 验收：computed链、加载状态、含「买入前判断，EMA20，¥100,000.00，56.00」混排截图；glyph来源与Windows仍单列NOT VERIFIED。

## 3. 可用播放按钮白字对比不足

- 位置/截图：[运行中基线](../../../.scratch/strategy-visual-system-20261008/evidence/workbench-before-running-1440-confirmed.jpg)。
- 来源：A `.primary`，normal `#2f80ed` / hover `#4a91ed`。
- 实测：运行中播放可用、13px白字；normal computed白/#2f80ed，计算3.866:1。hover3.199是源码计算，非真实hover实测。完成态disabled不用于这一缺陷判断。
- 任务影响：小字主动作在深色环境显得亮而薄，阅读与操作辨认受影响。
- 原因判断：动作蓝同时用于净值与实心按钮，没有按文字背景用途分色。
- 修改规则：新增实心primary三态#2469c8/#2b72d3/#205bac，保留已有蓝语义；真实选中/焦点分别表达。
- 验收：normal≥4.5；hover、active按最终真实背景核算；Tab可见焦点。原生primary是淡蓝透明底，不套用A比值。

## 4. 图标来源与光学重量不统一

- 位置/截图：基线图头、回放和「实验操作」箭头。
- 来源：A手写SVG、Unicode `⌄`；原生Lucide，绘图19px、部分状态14px。
- 实测：A工具SVG槽18px，stroke1.7；36px控件。原生当前绘图/工具按钮实测36×36；此前草稿31×36不是本轮证据。
- 任务影响：箭头外观依赖字体，同尺寸图形的黑度不一致，用户难区分状态和动作。
- 原因判断：并行来源和后置CSS，而非图标库本身失效。
- 修改规则：动作Lucide18/stroke1.75、36×36命中框；中文动词保持；品牌与状态14px登记例外。禁止全局将所有SVG拉成18。
- 验收：SVG computed尺寸/描边与截图光学比较，键盘label与命中框独立检查。

## 5. 阶段与可知截止距离过远

- 位置/截图：[原生1440画面](../../../.scratch/strategy-visual-system-20261008/evidence/native-review-current-1440.jpg)、[实测摘要](../../../.scratch/strategy-visual-system-20261008/evidence/native-review-current-summary.json)。
- 来源：RecallWorkspace顶部phases、底部cursor label，`recall.css` frame。
- 实测：阶段按钮y67.64、行情时间在底部约y868，纵向相隔约800px；完整年月日多在title，屏幕显示04-02 14:59。行情与成交已经分开，这是应保留的正确行为。
- 任务影响：确认当前阶段和信息边界需来回扫视，跨年日期理解依赖悬停。
- 原因判断：阶段导航与回放状态在两个空间职责下演进，没有整合知识边界。
- 修改规则：阶段紧邻完整行情/成交截止；S0/S1/S2同工作区；返回前阶段保留已看未来的补记来源。当前bar/成交实际揭示才算推进。
- 验收：S0→S1→S2真实chart截图、列表/摘要/tooltip/fit投影；双截止不合并。

## 6. 复盘标题、原文与动作角色不清

- 位置/截图：原生1440 header、底部回放；同上图。
- 来源：Recall层叠h1、sidebar h2、多个primary动作。
- 实测：标题18px/24.3px/400，计划标题16px/24px/400；「下一笔决策」与「留存当前快照」同时淡蓝强调，均36px/13px/400。
- 任务影响：标题与正文视觉重量接近；用户难以辨认当前主要推进动作，完整判断容易与计划说明混淆。
- 原因判断：尺寸有了，文字角色和任务主次没有固定；无需把所有字加大。
- 修改规则：复盘标题18/24/600、分区16/24/600、正文14/22/400；主要推进深蓝，留存secondary。原判断只读全文、当前补充分开，形成阶段与补记来源持续可见。
- 验收：完整多行中文、56/52/68/1000/20万同页；代表selected/focus；原判断图锚和全文对照一致。

## 7. 较窄窗口让任务面碎裂

- 位置/截图：[稳定900×800当前复盘](../../../.scratch/strategy-visual-system-20261008/evidence/native-review-current-900-fresh.jpg)。旧 `native-review-current-900.jpg` 在viewport更新未稳定时抓取，排除，不作为窄屏证据。
- 来源：原生responsive header、chart minimum、plan-open与replay布局。
- 实测：900×800，header752×145，chart674×220；无横向溢出，但图表高度降低，计划标题与回放占据后半屏，多条工具换行。
- 任务影响：图表可见面积与读图连续性下降；「没有overflow」不能证明工作面好用。
- 原因判断：响应式按局部组件换行，而非按整条复盘旅程预算；重测稳定截图后才可靠。
- 修改规则：按内容拥挤点收起/下移完整计划与原文，保留价格轴和主动作；不规定固定栏数/比例。桌面/较窄分别校准，不用统一图高硬塞。
- 验收：1280/900/390截图、实际滚动到全文/底部、价格轴和主要动作可达；物理触摸不由鼠标检查替代。

## 8. 来源与持久化不能靠视觉伪装

- 位置/证据：f42e草稿的fixture来源只作为历史参考；本轮源审计见 [source-audit.md](../../../.scratch/strategy-visual-system-20261008/reports/source-audit.md)。
- 来源：旧草稿 plan source=retrospective，repository仅内存；不是当前生产数据库缺陷。
- 实测边界：尚无当前样板save→返回→reload证据时，不能声称保存通过；旧截图也不能证明当前阶段投影安全。
- 原因判断：可见提示与仓储、阶段投影不共用权威状态时，样板会产生错误的保存或来源暗示；这不是生产数据库已损坏的结论。
- 任务影响：用户可能把补记理解为当时判断，把刷新后回到fixture理解为保存成功。
- 修改规则：样板显式合成/复盘补记，独立localStorage仓储、唯一key、错误/重置；业务库隔离。补充锚点不能指向当前不可知bar。正式推广再验SQL链路。
- 验收：实际保存编辑→离开/返回→刷新、原文/阶段/来源一致；失败不报成功，重置可恢复fixture。样板存储通过不称生产SQL通过。

## 本轮校准中的具体回归与修正

以下是运行新样板后发现的候选缺陷，保留失败画面，区别于原基线诊断。

|问题位置 / 证据|实测与原因|规则 / 任务影响 / 接受方法|
|---|---|---|
|900/390全文与计划；[390失败](../../../.scratch/strategy-visual-system-20261008/evidence/recall-first-390-fail.jpg)、[1280失败](../../../.scratch/strategy-visual-system-20261008/evidence/recall-final-s0-1280.jpg)|最初候选仍继承220px图高及多层overflow:hidden；1280计划仅324px且中文裁切，不能由无页面overflow判断通过|推荐作用域恢复正常纵向文档流；≤1330图480、≤600图720；计划自然高度。全文、主动作和价格通过截图与实际滚动验证；不改生产responsive|
|“本地数据”；[修正后390](../../../.scratch/strategy-visual-system-20261008/evidence/recall-accepted-s1-390-full.jpg)|原窄badge收缩为两行残字；样板CSS固定不收缩后实测93×44/nowrap，桌面93×36|来源名完整，工具栏内部横向可达；不能只留“地/数”。比较真实图及computed|
|重复计划白字与原判断；[修正后S0](../../../.scratch/strategy-visual-system-20261008/evidence/recall-accepted-s0-1440.jpg)、[键盘焦点](../../../.scratch/strategy-visual-system-20261008/evidence/recall-accepted-price-focus-1440.jpg)|ReplayChart既画右轴标签又有left8 HTML编辑按钮；白字跨在正文上|推荐CSS只迁移透明112×36命中框到右轴，完整aria/title保留；实际Tab有2px/offset2焦点，点击止损聚焦52输入；拖动/触摸仍未验证|
|390轴上成本/计划同值；[语义失败](../../../.scratch/strategy-visual-system-20261008/evidence/recall-accepted-s1-390-full.jpg)|全展开原判断盖住成本/计划角色名，只剩两个56.00；同色同值不能表达事实和计划区别|窄屏正常流加入完整角色和值；读取已知position，S0不可泄漏实际成本；最终三阶段截图及独立审核记录于acceptance。保留全文，不能用裁字解决|

保存实证已取得：[52→51.5及原文刷新留存](../../../.scratch/strategy-visual-system-20261008/evidence/recall-persistence-reload-1440.jpg)、[退出评价刷新后DOM](../../../.scratch/strategy-visual-system-20261008/evidence/recall-exit-persistence-after-reload.dom.txt)。样板unique key可重置；生产SQL保存仍NOT VERIFIED。

最终价格角色回归：390的[S0](../../../.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s0-390-full.jpg)、[S1](../../../.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s1-390-full.jpg)、[S2](../../../.scratch/strategy-visual-system-20261008/evidence/recall-price-roles-s2-390-full.jpg)完整保留三项计划及当前实际角色，S0实际成本不出现；独立看图关闭上述角色遮挡FAIL。图内买入marker可能仍被长Text遮挡，登记为后续碰撞策略例外，不用新增读数声称marker无遮挡。

桌面末轮操作回归：[适应全部后阶段裁切](../../../.scratch/strategy-visual-system-20261008/evidence/recall-comparison-fit-recommended-s0-1440-scroll0.jpg)。来源为推荐CSS与原生chart-stage的100%高度叠加；shell client696/scroll724、内部scrollTop28，window.scrollY0却仍看不到阶段。影响是适配视野或聚焦控件后丢失知识边界。规则为阶段自然高度、图表flex占剩余空间，不用overflow遮掩；[修复后实际Tab焦点](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-fit-price-focus-1440.jpg)及JSON证明shell client/scroll674=674、scrollTop0，阶段与底轴完整。文字编辑浮层并未因此获得完整接受。

390末轮初始位置回归：[未点击前回放主动作右裁](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-s1-390-full.jpg)。来源为推荐CSS仍让6控件单行横滚；旧点击后截图由浏览器scrollIntoView自动滚入，仅证明可达。影响是主要下一笔操作在静止画面难辨。规则为≤600回放控件正常换行、保留DOM/键盘顺序与44px高度，独立于顶栏工具横滚；必须重新比较静止画面及实际推进，不能删次要动作来凑宽。

最终回放修复复验：冻结CSS67e下，[390未点击静止画面](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-s1-390-full.jpg)及[实测](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-s1-390.json)显示六控件两行、高94px、每控件44px、width/clientWidth/scrollWidth均356px，各按钮横向完整。真实点击下一笔后[Mar9/持仓400](../../../.scratch/strategy-visual-system-20261008/evidence/recall-v05-wrap-action-390-full.jpg)在图中可见。关闭默认主动作右裁这个局部FAIL，保留旧图与工具栏横滚/首屏需纵向滚动的不同边界。
