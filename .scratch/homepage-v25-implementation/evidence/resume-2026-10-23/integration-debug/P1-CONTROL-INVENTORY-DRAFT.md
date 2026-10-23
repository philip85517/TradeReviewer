# P1 实际控件实例登记草案

日期：2026-10-23。准备性清单，运行时全部 **NOT VERIFIED**。正式实现后按最终源指纹、URL、独立 DB、viewport/zoom/DPR、鼠标/键盘/仿真触屏分别展开至 `evidence/P1/controls/`。动态实例按真实稳定 ID 展开，不能用本表行数充当实际控件数量。保持 96 公共状态（85 适用/11 说明性不适用）的原分母，不覆盖 A 历史准备证据。

参考：已批准 V2.5 正文 HP03/HP04/HP06/HP09/HP11/附录二；current component manual 账户、分段标签、数据表、空态、修复与图标八态；root 视觉契约和 P1 票。`S-*` 下述名称只表示待消费语义，不假定尚未交付的 API 字段名。

|实例键/入口|实际动作或说明|必须展开的状态/空间/返回证据|P1 边界|
|---|---|---|---|
|`NAV-HOME`|导航到 `/home` / 从来源回首页|当前态/hover/focus/pressed；经过同一 leave guard；返回重读+恢复，不先改地址再确认|P1|
|`NAV-TRADES`|普通交易库入口|无待复盘 badge；ordinary stocks、无 queue、不自动首episode；已应用市场/账户/日期即时生效|P1|
|`NAV-EXISTING:{destination}`|实际渲染的分析/数据/设置等原导航|逐个登记可达性/返回/guard；保留原业务，不改版；窄视口实际菜单若渲染也展开|受影响既有回归|
|`HEADER-MARKET:{all,a,hk,us}`|四个直接可见市场标签|各自鼠标/键盘/active；旧范围保持至最新请求成功，失败/取消/超时/乱序；不能新币种配旧数|P1|
|`HEADER-ACCOUNT-TRIGGER`|176×36 当前账户与下拉|default/hover/focus/pressed/disabled/loading/empty/error；打开/关闭、Esc 原触发焦点、加载保值、长名全称|P1|
|`HEADER-ACCOUNT-OPTION:{accountId-or-all}`|每个实际可选实盘账户/全部语义|选中标记独立区、方向键/Enter、固定176宽、长名提示；unknown/sim 不混；URL 明确账户，多 ID 不冒作一个真实账户|P1|
|`HEADER-ACCOUNT-IMPORT`|空账户“导入账户”下一步|鼠标/Enter 到现有数据管理/导入；Esc 返回；失败留原因；不新增导入流程|P1 条件渲染|
|`GLOBAL-REPAIR`|首页唯一错误恢复动作|110×32 表面/110×36 hit；错误出现才渲染；pending 不重复；成功移除、失败保原因；各卡不另设重试|P1 条件渲染|
|`ERROR-REASON:{source}`|可访问的错误/过期/缺失原因|焦点可达、实际说明、Esc 关闭说明；不是 fake retry；没有错误时无正常成功徽章|P1 条件渲染|
|`HOLDINGS-SEARCH-ENTRY`|若工具栏使用搜索入口，打开内联输入|开关/焦点转入、36高、内容前中后稳定；不能打开全局搜索遮罩|P1，按真实结构展开|
|`HOLDINGS-SEARCH-INPUT`|局部过滤持仓|键盘/IME composition/debounce300ms/失焦；保全局范围；query变化回第1页；空间不跳|P1|
|`HOLDINGS-SEARCH-CLEAR`|输入尾部唯一 X|query 非空时实际清空，回第1页；空态不增加同义按钮；focus 可见且关闭不误清全局|P1 条件渲染|
|`HOLDINGS-SORT-NAME`|A 已接受名称排序|default/升/降、aria/箭头、focus；排序重置页，保 query/全局；不臆造表外独立新入口|P1|
|`HOLDINGS-SORT-MV`|正文明确市值排序|升/降、可比 CNY 金额、缺 FX/覆盖不足 disabled+原因；完整换算才能使用；未知不等于0|P1，A 原逐操作表需此补项|
|`HOLDINGS-SORT-UPL`|浮动盈亏排序|同上；正/负/真零/未知、全部市场 FX；仅表格局部，不动期间/贡献|P1|
|`HOLDINGS-EXPORT`|导出全量已筛选结果|36高；0条 disabled 文案；非当前页截断；完整精度、负号、文本安全、下载名与错误结果；无多次触发|P1|
|`HOLDINGS-FULL-IDENTITY:{instrumentId,accountId,episodeId}`|截断名称/身份的 hover 与 focus 全文|名称/代码/可信 exchange/必要类别，账户区别；无证据明确原因；提示不改变48行高|P1，非虚构导航|
|`HOLDINGS-FULL-VALUE:{rowId,column}`|缩写金额/未知说明的完整读数|hover 与 keyboard focus、完整精度；有实际复制入口才另登记复制动作；不加未批准按钮或全表无序 Tab 点|P1，按实际交互展开|
|`HOLDINGS-ROW-DETAIL:{instrumentId,accountId,episodeId}`|末列“查看持仓详情”|每行36命中盒，hover/focus/pressed；稳定身份，绝不直接review；至少同证券双账户反例|P1|
|`HOLDINGS-PREV` / `HOLDINGS-NEXT`|两方向翻页|0不渲染操作箭头；1–8禁用；9第二页1行；50第7页2行；边界禁用、原地8槽；query/sort/market改回1|P1，两个独立实例|
|`HOLDINGS-EMPTY-NEXT:{action}`|真空持仓适用的下一步|仅实际批准范围切换/导入等；no-match 不重复清空；无假第1页；失败保原因|P1 条件渲染|
|`HOLDING-DETAIL-CLOSE`|明确关闭按钮 / Esc|焦点约束、Tab/ShiftTab、外点不关；恢复 query/sort/page/scroll/精确行；对象消失回表标题|P1|
|`HOLDING-DETAIL-VIEW-TRADES`|唯一主动作“查看交易”|完整可信 symbol identity、来源范围/账户/live；ordinary 集合、execution含open；无身份不造假URL，说明原因|P1|
|`LIBRARY-SOURCE-RETURN`|显式返回首页来源|UI-only v2 source，实际重读数据，scroll/focus；与地址 back/forward/refresh 分开证据|P1|
|`LIBRARY-AFFECTED:{controlId}`|目的库实际可见且本次受影响的条件、clear、列表/统计视角等|到达即 applied；execution-list 范围与 close-date stats 分离；库内显式pending/sim保原义；不把V1全改版带入|P1 必要下游回归，逐控件展开|
|`LIBRARY-EPISODE:{instrumentId,accountId,episodeId}`|用户主动选择准确回合进入既有复盘|到达库不自动选第一条；完整episode账本不被列表日期截断；选中身份与返回来源准确|P1 必要下游|
|`REVIEW-SAVE` / `REVIEW-RETURN`|既有复盘真实写入与逐层返回|隔离DB实际存储→返回→重读→reload；不以callback/fixture通过代替持久化；原回放回归|P1 必要下游，两个实例|
|`LEAVE-GUARD:{confirm,cancel,other-rendered-action}`|未保存离开保护每个实际动作|显式导航与browser back各测；取消保持地址/页面/数据，确认一次提交；旧异步允许不能覆盖新导航|P1 必要下游，动态展开|
|`URL-RECOVERY:{action}`|非法/不完整 URL 或失效来源的实际纠错入口|known catalog ready 后判定；无静默 all（market按合同warn+all例外）；返回有效上下文；无 fake symbol|P1 条件渲染|

只读信息另记录布局/可访问性，不伪装成交互：持仓标题、C 汇总、列头（无排序者）、计数/页码、更新时间、静态条件摘要、原始账户说明、缺值文字、loading/empty 文案和容器标题 fallback。

**分阶段未实施实例保持 NOT VERIFIED：** 页头全局搜索/筛选及其遮罩/草稿/token（P3），当前期间/主图/日期详情（P2），历史范围/四曲线/贡献模式及下钻（P4）。准备截图能展示进行中空间，不能将 noop 或伪造 disabled 认作合格状态；不得为提前全渲染而越权实施。完整 UI 最终仍在 P5 验收。

**每个实例的正式记录字段：** trigger、范围/排除理由、source+test hash、URL、数据/DB版本、前/中/后 bounding box 与 scroll/下游位置、操作方式、期望/实际、异常/返回、原图同状态对照、PASS/FAIL/NOT VERIFIED、root 独立接受引用。鼠标、键盘、仿真触屏、物理触屏分别记，不相互替代。
