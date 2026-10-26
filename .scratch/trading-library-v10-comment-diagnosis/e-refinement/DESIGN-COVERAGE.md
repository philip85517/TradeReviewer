# E 方案细化契约
State: closed
Status: accepted
日期：2026-10-24。用户选择 E 并提出七项调整。本轮仅更新独立视觉样例，正式设计正文、图稿、评论与旧 D/E 样例保持不变。新入口 navigation-e-prototype.html。

## 设计依据
- 用户本轮 1–7 点：E；删除返回首页；说明收进悬浮入口；全站侧栏；删除视角；全工作区区分模拟；全站盈亏色。
- docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:64–107、520–538：72px 导航，64px 页头，24px 内容边距；全站 token；说明图标与 hover/focus；36px 控件。
- 同目录 source/images/home-1440.svg：TR、首页/交易库/分析/数据/策略的线性 SVG 图标、56px 导航项、选中蓝色表面。不要照抄图中的旧数量徽章（正文451已取消）。无账户页脚。
- 同目录 source/images/visual-samples-board.svg、atoms.svg：颜色与说明入口。
- ../de-prototype/screenshots/E-confirm.png：E 相邻模式与页签、两行导航层级。

## 方案与边界
初始实现 Luna；第三次回归后 root 接管必要集成修正，保留已有 E 布局和交互。新的非实现 Agent 负责独立视觉与代码复核，root 仍负责真实浏览器功能及状态验收。
E 两行导航，移除视角和返回及旧 D/E 比较器/来源；预览正常/加载/空可放简洁原型工具（独立底栏或标题右侧，标注视觉样例）；刷新重置信息放原型说明，不常驻段落。
实盘使用全站 #0B1019 页面、#111A26 卡；模拟整个工作区（次导航+筛选+内容背景）换为低饱和蓝灰 #111E2C，卡片 #162332，连续 1px #40566D 内边与顶部2px弱蓝灰线，加强内凹层次。尺寸不变，侧栏与站点标题不变。仅改变颜色/阴影，不做移动动画。按钮两模式均统一蓝色选中态，禁止紫色。模式文字同时表达身份。
全站正数 #53D7A0、负数 #FF8592；频数分布盈利绿/亏损红，零/未知中性。曲线可保持操作蓝，金额主值按正负。不把费用和胜率等非盈亏值染成盈亏色。
说明在统计标题/指标附近用 16px 无框圆形说明 SVG，36px命中；hover/focus显示、移开/失焦/Esc消失，点击可切换固定便于触控。口径和原型说明分开。最差练习回撤保留可见名称及 —，原因进浮层；定义是所选练习中最大的单次权益回撤，不拼账户，缺权益路径不编值。原样例其余数据不变。
比较视口1440×1000、1280×800；沿用既有本轮桌面样例范围，不设计手机/触控生产版。无数据库、无写流；不验收生产导航或交易动作。

## 状态契约与控件清单
模式 live/simulation 共享当前 list/stats，记忆各模式日期；切页更新日期语义；刷新回默认实盘列表。日期 fixture/long，分布 rate/amount，预览 normal/loading/empty；口径 hover/focus/click/Esc及移开；原型说明同理。侧栏仅视觉上下文，非业务跳转，不伪造业务导航。无请求、无错误/重试或保存，N/A。
原登记变化：删除上一/下一方案、来源、返回；保留模式2、页签2、日期2、预览3、分布2；新增说明实际实例由实现报告列出。受影响全部样例控件及四主态纳入本轮，非整站全量。

|ID/用户点|elementID|参考/状态|owner|操作与预期/反例|证据|状态|
|---|---|---|---|---|---|---|
|E01/1|e-nav|E-confirm.png；四主态|root / 独立 e_independent_acceptance|相邻模式和页签，E结构稳定|screenshots|PASS|
|E02/2|e-header|用户2；所有态|root / 独立 e_independent_acceptance|无返回首页按钮|screenshots|PASS|
|E03/3|metric-help,prototype-help|公共规范538；展开/隐藏|root / 独立 e_independent_acceptance|hover/focus可读口径，Esc/移开关闭；无底部长文；回撤未知保留|browser-evidence.json|PASS|
|E04/4|e-sidebar|home-1440.svg；四态|root / 独立 e_independent_acceptance|72px线性图标、节奏颜色对齐，无假徽章/账户|screenshots|PASS|
|E05/5|mode-control|用户5|root / 独立 e_independent_acceptance|无视角可见标签|screenshots|PASS|
|E06/6|e-workspace|本契约新提案；实盘/模拟×列表/统计/空/加载|root / 独立 e_independent_acceptance|全底色/内边切换，几何稳定，无紫色，无红绿模式色|browser-evidence.json|PASS|
|E07/7|pnl-values,distribution|公共规范81–105|root / 独立 e_independent_acceptance|正绿负红，费用/未知中性|browser-evidence.json|PASS|
|E08/回归|date-range,page-tabs,measure,preview|旧样例数据/状态契约|root / 独立 e_independent_acceptance|鼠标/键盘、长范围、空加载、刷新正确|browser-evidence.json|PASS|

验收门槛：功能、内存状态链、独立同态视觉比较分别通过；持久化 N/A（throwaway）。保存最终hash、截图、操作日志、geometry、console；失败保留后交回实现者。E已选择，模拟底色具体提案待用户确认。

最终证据：acceptance.md、INDEPENDENT-ACCEPTANCE.md、verification.json；三次 FAIL 历史保留，最终签署仅限当前 SHA。
