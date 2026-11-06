# 视觉与状态契约 v0.1

## 参考与授权差异

- 当前首页历史画面：../homepage-design-report-20261006/desktop-overview.jpg，1440×1000 CSS px，2026-10-06旧状态；仅问题证据，非本轮最新测量。
- 旧主图规格：../../docs/specs/2026-09-25-chart-first-review-ui.md 与 ui-elements.md；实际参考 ../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png、04-holding-stage.png、05-final-review.png、07-interaction-states.png，1440×900历史demo。
- 权威新约束：BRIEF R06/R10；不照搬旧300–320px侧栏、首页B比例；主图内批注 + 流内原文对照，在必要空间不足时自然下置，图表价格轴不被覆盖。
- 外部：TradingView官方资料的操作分组和图表工作面研究，evidence/tradingview-reference-audit.md；不复制品牌，不声称其未公开设计数值。
- 用户启动包：NOT VERIFIED，尚未取得路径。

## 候选数值（源码配置目标，非浏览器实测）

沿用page #0b1220 / surface #111a2b / text #e7edf6 / muted #adbbcf / blue #2f80ed / gold #f3ba2f；盈利亏损来自现有ChartSettings，样板固定teal-red，以可比数据为准。
字体候选 "Geist", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif，generic最后；数字tabular-nums，完整中文不用Mono。标题20/28px、模块16/24px、正文与控件14/22px、长批注14/24px、辅助12/18px；权重400/500/600三档。
标准控件36px，主动作40px；细指针图标视觉18px/1.75 stroke，工具视觉20px/1.75；触摸与窄屏命中44px。焦点2px #9ecaff offset2，选中独立淡蓝背景+1px边框；hover不挤动。4/8/12/16/24间距，控件radius6、panel8；一屏不嵌套多层相同大边框。
首页简洁范围条→持仓摘要→单币历史真实组件→待复盘入口；辅助数据健康折叠，完整原因可读，未知不得写0或无意义圆环。
复盘同一工作区：紧凑阶段/截止/主要动作→真实图表与绘图工具→原判断/当前补充原文对照。无预设栏比例；中文内容可换行，不截重要价格。用图形锚点与稳定ID对应原文。

## 可比视口与代表状态

首页1440×1000、1280×720；复盘1440×900、1280×800；两者另查1024×768、390×844、320×740及断点两侧。浏览器缩放100%、DPR实记。实际未测禁止填推断值。
固定合成价格窗与序列、S1初始、原判断全文和新补充全文；baseline与recommended为同一组件树，只差样板局部样式，不能更换图表范围或缩短文字。
状态：默认/hover/selected/keyboard focus/readonly/disabled；更新状态若只作演示，清楚命名为状态演示，不伪称市场下载。长中文与长代码保留全文。初始S1选中持仓补记；点原判断按钮选择相同稳定ID，焦点用真实按钮.focus()进入，不用CSS假冒交互证据。

## 阶段与动作

|动作|阶段|市场截止|成交截止|图形/文本|视野|
|---|---|---|---|---|---|
|初始|S1|D69已完成bar|买入+ D68减仓；已知400股|S0原判断+S1补充，标签复盘补记|同一观察窗；仅已知行情定轴|
|回看S0|S0|D60收盘已知bar|首次买入未揭示|仅S0原判断；明确合成揭示边界，不冒充实盘买入前时刻|不传未来bars/fills/drawings给图表/tooltip/摘要|
|下一根|当前可知阶段|下一个可知bar|不隐式提前推进成交|按createdAtCursor过滤|revealRequest指向新增bar；是否实际可见待浏览器验收|
|查看S2|S2|固定已退出bar|揭示退出|继承S0/S1并显示S2结论|用户主动选择，非初始化曝光|
|回看原判断|不变|不变|不变|选中相同稳定ID并展开原文|不fit全量；不改判断|
|切基线/推荐|保留相同当前阶段|完全相同|完全相同|完全相同|同窗同价范围；不得重置为不同日期|

不挂RecallWorkspace/repository、无数据库保存、无模拟下单、不声称生产回放验收。浏览器阶段切换、真实K线新增可见、批注链接仍是本轮必须证据；缺失时保留NOT VERIFIED。
