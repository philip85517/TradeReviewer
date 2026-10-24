# 设计覆盖矩阵

版本：RV10 proposal，基线 commit 5a94ee3f。只证明设计覆盖，不证明业务运行。精确旧图与章节见 visual-contract.md。

|需求/原始规格|elementID|新画板（source/images/）|阶段/旅程|owner|操作与预期/反例|证据|状态|
|---|---|---|---|---|---|---|---|
|2026-09-25-chart-first-review-ui-elements.md §5 E01|E01|01-entry-1440.svg|顶栏身份/返回|Luna画板/coordinator契约|长名、返回、周期、保存与导出可达|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E02|E02|01-entry-1440.svg|三阶段选择|Luna画板/coordinator契约|选中清晰；回看恢复双截止，不等于下一决策|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E03|E03|01-entry-1440.svg|绘图工具|Luna画板/coordinator契约|Text优先、更多保留旧工具、36/44px|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E04|E04|02-holding-1440.svg|已知K线与成交量|Luna画板/coordinator契约|未揭示为空，轴不利用未来价格|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E05|E05|01-entry-1440.svg|价格轴与沟槽|Luna画板/coordinator契约|96px独立区域，14px沟槽不被跨越|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E06|E06|01-entry-1440.svg|计划线|Luna画板/coordinator契约|琥珀虚线带名称，拖动与输入同对象|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E07|E07|02-holding-1440.svg|已知成交标记|Luna画板/coordinator契约|菱形+动作文字，受成交截止与设置约束|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E08|E08|02-holding-1440.svg|Text与来源|Luna画板/coordinator契约|14px、锚点、长文摘要、来源与IME|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E09|E09|01-entry-1440.svg|侧栏开关|Luna画板/coordinator契约|保留输入/窗口/双截止，焦点回入口|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E10|E10|01-entry-1440.svg|价格字段|Luna画板/coordinator契约|精度、方向、单位、无效值|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E11|E11|01-entry-1440.svg|规模切换|Luna画板/coordinator契约|三模式单一主输入、换算不清零|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E12|E12|01-entry-1440.svg|资金来源折叠|Luna画板/coordinator契约|默认折叠，时点/币种/来源可达|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E13|E13|01-entry-1440.svg|风险与R|Luna画板/coordinator契约|风险/R口径、缺项说明|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E14|E14|02-holding-1440.svg|持仓只读计划|Luna画板/coordinator契约|只读原计划，计划修订不覆盖|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E15|E15|03-final-1440.svg|事后只读摘要|Luna画板/coordinator契约|计划、成交只读；未平仓拆分|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E16|E16|03-final-1440.svg|逐笔退出选择|Luna画板/coordinator契约|每次退出独立，切换不串值|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E17|E17|03-final-1440.svg|提前退出三态/未评价|Luna画板/coordinator契约|不确定与未评价区别于否|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E18|E18|03-final-1440.svg|原因与符合度|Luna画板/coordinator契约|独立枚举、其他说明、证据来源|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E19|E19|01-entry-1440.svg|回放控制|Luna画板/coordinator契约|新增K/目标成交可见，末尾有原因|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E20|E20|05-conflict-1440.svg|保存/冲突|Luna画板/coordinator契约|真实状态、失败保留、冲突恢复|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E21|E21|09-export.svg|三图一表|Luna画板/coordinator契约|冻结版本、缺阶段、三图一表|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|
|2026-09-25-chart-first-review-ui-elements.md §5 E22|E22|04-records-1440.svg|决策和快照列表|Luna画板/coordinator契约|全部决策与多快照可达，预览/编辑/恢复区分|RV正文 + independent-review.md最终SHA表|PASS（设计定义）|

附加完整覆盖：R23 双截止/未来暴露与来源（01/02/03）；R24 保存返回重开/失败保留（05）；R25 响应式与导航展开（06/07/10）；R26 loading/empty/error/end/longtext/ambiguous（08）；R27 已完成成果/重新开始回放/未平仓（正文状态表与03/08）。owner为coordinator（状态契约）、Luna（画板）；静态设计只定义行为，实际功能验证NOT APPLICABLE。

版本绑定：最终工件SHA见 ../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/content-manifest.json；独立审查直接看全部10张，不以文字或源码推断替代。R23–R27的状态定义与指定画板检查PASS；行为与持久化实际运行NOT APPLICABLE。

## 2026-10-24 新增参考覆盖

E03/E19 及关联 E06/E08/E01 须按[最新参考契约](../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/references/2026-10-24-tradingview-toolbar-contract.md)重新设计、核验。上表 PASS 仅保留为历史记录，不代表满足用户此次 1:1 要求；当前为待设计 / NOT VERIFIED。负责人 coordinator，任务见 issues/03-tradingview-toolbar-alignment.md。
