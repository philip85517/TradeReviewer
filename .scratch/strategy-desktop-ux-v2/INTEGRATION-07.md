# 07 比较视图集成契约（06已接受，正式派发）

批准来源：桌面规格DD06各组Mi（177–200行）、DD09（220–240行）、DD12–DD14（260–281行）；07票AC01–07；DESIGN-COVERAGE C25–27/C28。06已由root接受，按本契约正式派发实现。

## 所有权与参考

2026-09-30中断后由 /root/comparison_runtime_resume 负责running-prototype.tsx/css的唯一比较入口/返回/曝光接线；/root/comparison_ui_resume 负责comparison-prototype.tsx/css。ResultsPrototype比较按钮已经接好，当前无人写入results文件；Astra/low独立审查为 /root/acceptance_resume。旧owner历史记录保留。派发前再次确认无06未关闭写入，精确接口先由双方确认；同一文件不得交叉写。root拥有整页和状态链验收；Astra/low独立看图/审查。实现保持Luna6/max，不接生产服务/数据库。

先阅读批准正文、07票与当前workflow，直接对照screenshots/reference/tradereview-{1440,1280}.png及05修后结果截图。新比较无像素批准画板，按正文和既有风格直接比较，不从旧宽度裁片推导桌面布局。

## 状态与入口

- Runtime继续拥有唯一M/V、每组合Mi、稳定PortfolioId、各自实际账本/资金/执行override、事件定位、曝光。比较只消费截止内账本；无新推进时钟。
- 已完成工作台提供“比较组合”次动作；阶段/完整结果也能进入。少于两个组合/T0无可分析区间须有就近原因。
- 默认同步比较的可用上界是所比较组合min(Mi)。从早期结果或回看入口进入时，R不隐式越过该来源R/V；可明确选择“查看共同已展开区间”到共同上界，且记录来源曝光。这同时满足DD09共同有效区间和DD06/DD09不隐式揭示早期回看后的收益。区间实际起止、共同截止和当前R均可见。
- 失败/落后组合列始终保留状态及Mi；曲线/统计仅到当前有效R。较短共同区间不能仍标完整计划期，部分/失败组不能进入完整期排名。默认按策略选择顺序，无赢家推荐。
- 用户明确选择某组合更晚区间时，进入清楚标注“非同步 · 单组合”模式，R≤其Mi，其他组未来收益不出现。保留比较集合和返回同步操作，最远已看记录只增不减。
- 比较事件→过程：定位组合ID、事件日、可选标的；显示返回来源比较入口。返回比较保留集合、R、同步/单组模式、曲线模式、筛选、图例选择与滚动。普通返回过程恢复进入比较前的V/组合/模式/标的/视野，不把R当过程V。
- Runtime隐藏于结果或比较时键盘/播放/展开均不得继续推进；列表重开源比较上下文也不可被误识别成普通单组结果。

## 可视投影

### 已冻结接线接口（root与运行owner，2026-09-29）

ComparisonPrototype由UI文件导出，runtime唯一控制R、同步/单组模式及选定身份。props：portfolios（id/name/strategy/capital/draft/ledger/maxCursor/status active|failed|excluded/failureDate?），calendar、cursor、mode synchronized|single、selectedPortfolioId（非空，来源组合身份；root批准收窄）、entryId、visible、commonMaxCursor；动作onCursorChange(cursor)、onRevealCommon()、onRevealSingle(id)、onModeChange(mode,selectedId?)、onReturn()、onEvent(portfolioId,event,symbol?)。UI持有chart/filter/legend/scroll并保持挂载；不得自行扩展Mi。ResultsPrototype加可选onCompare(sourceCursor)及compareDisabledReason，按当前有效R调用。

进入默认min(sourceV/R,commonMi)，返回同步恢复原同步R；commonMi=T0但其他组有完整日时允许显示共同空态和失败列，可显式查看参与组更晚单组。全部T0或少于2组才禁用入口。按钮约束与界面空态互相一致。

- 顶部先区间/完整或阶段或部分状态，再口径矩阵（起点、独立本金、数据集合与合成版本、策略/预设、币种CNY、费用0/滑点0/小数股）。差异就近解释，可折叠详细数据质量；不能所有信息都用警示黄。
- 净值叠图与回撤来自各组calculateResultAnalysis，同一时间轴。仓位展示同一比较集合中被选组合的实际标的/现金占比时间序列，并明确当前组合；不能用期末饼图替代时间变化。
- 净值/回撤最多突出4条曲线，其余可通过固定身份图例开关访问。既有6个明确“展示样例”不能冒充6个插件；样例资本倍率仍独立。名称、颜色和线型共同辨认，颜色不得借用收益正负意义。
- 指标来源同一账本、同一R；未知为不可用，零回合胜率不可计算；无可信基准不得编造超额收益。结果partial/unfilled消费06实际执行语义。
- 事件列表可以按组和执行类型筛选，按R/有效截止过滤；未发生未来事件数值不可提前出现。长名/多组矩阵局部横向滚动，不压缩主图成窄条。

## 接受门槛

07自身在1440×900/1280×800取得同状态截图，先独立审查代表屏再扩展。root实际走同步双组→更早R→显式更晚单组→事件定位/来源返回→6组图例→失败组共同边界；数值与05/06公开账本核对。鼠标键盘分别记录。独立视觉、状态安全、真实浏览器均PASS才能接受，不能依赖worker自报。08随后用全新会话验完整旅程。

## 07 第二阶段精确拆分（代表屏门槛已过）

2026-09-30：Astra直接比较representative-fixed-1440/1280与reference，X07-02限定代表屏首屏门槛PASS；root实测plot top434.02，高360/320，bottom794.02/754.02，DPR1。日期轴完整；1280滑块位于首屏底边，后续添加常驻内容必须重验。旧FAIL保留，07整体尚未接受。

- C25–27/DD09/E08曲线：comparison_runtime_resume（Luna6/max）转为仅新增comparison-chart.tsx/css及implementation/07-chart.md的writer，running TSX/CSS冻结。输入公开ResultAnalysis与显式显示的series，不接runtime时钟。真实NAV/DD/标的+现金历史仓位，HTML12px坐标与SVG导线对齐，360/320高度。root测试图与数值，Astra直接看图。
- C25–27/E02/E03/E07/E08/E12整体：comparison_ui_resume（Luna6/max）仍仅comparison-prototype.tsx/css及implementation/07-ui.md；集成chart接口、指标在曲线前、6组最多4线legend、分组/执行事件筛选+事件source-return、local state/scroll按entryId重置且返回保留、数据范围/版本/unknown/无基准。根协调者为整页/完整状态owner。
- Charts frozen接口：export type ComparisonChartMode = 'net-value'|'drawdown'|'allocation'; export type ComparisonChartSeries = {id:PortfolioId;name:string;analysis:ResultAnalysis;color:string;dash:string}; export function ComparisonChart({series,mode,currentDate,empty}: {series:ComparisonChartSeries[];mode:ComparisonChartMode;currentDate:string;empty:boolean})。UI为仓位模式只传一个明确选中的组合series，NAV/DD传最多4条；chart不拥有筛选、游标或其它页面state。
- 无新依赖/生产数据/数据库/窄屏；props主接口不变。精确参考与验收仍为本文件原表、INTEGRATION-07、acceptance/07与screenshots/07，最终08等待07全部接受。
