# 已确认的局部视觉决定

最终确认日期：2026-10-21。依据为本对话的逐轮选择，以及用户审阅第四轮后回复“确认”并要求归档。以下记录控制本轮局部修订，不重新定义此前已达成一致的全页布局。

|问题|最终选择|具体约定|证据与边界|
|---|---|---|---|
|D01 表头对应关系|第二轮 A|金额表头保留单行；半角括号配合可见文字右缘校准。逐列比较可见字形，不能只检验元素框坐标；辅助对齐线只用于文档验收。|[第二轮](records/homepage-v241-repair/visual-options/round2/index.html?section=d01)、[第三轮验收](records/homepage-v241-repair/visual-options/round3/ACCEPTANCE.md)。全表格族尚需传播。|
|D02 持仓汇总|原 C 方案|标题右侧并列汇总；保留搜索和导出空间。|[C 决议](records/homepage-v241-repair/comments/01/2026-10-20-resolution.md)。四张目标图的结构检查不代替全部状态视觉验收。|
|D03 标题层级|确认建议规格|一级功能区 18px/600，图表标题 16px/600；同角色一致，不改变模块顺序。|[第二轮证据](records/homepage-v241-repair/visual-options/round2/ACCEPTANCE.md)。|
|D07 历史选择器|A 共享组合容器，第四轮去重文案|年份仅显示 `2026` 等范围；展示方式为“每月净盈亏／累计净盈亏”。单年自动按月，跨年自动按年，对应“每年净盈亏／累计净盈亏”。年份与展示方式不是两个粒度选择。|[第四轮](records/homepage-v241-repair/visual-options/round4/index.html?section=d07)。跨年语义保留，但第四轮没有提供跨年可操作实现或验收。|
|D08／D09 状态区|区域背景与解释|去掉区域内重复文字，背景区分状态；hover 或键盘聚焦解释原因。保留无回合、真实零、未知、未来、失败之间的语义区别。|[第二轮状态原型与验收](records/homepage-v241-repair/visual-options/round2/ACCEPTANCE.md)。纯 hover 仍须补独立验收，不用点击替代。|
|D10 胜率说明|常规 A、窄卡 B|常规 321×88；窄宽压力例 278×104。百分比与回合计数共享文字基线；窄卡“盈利回合”位于计数正上方 4px，不强制与左侧标题等高。|[第四轮](records/homepage-v241-repair/visual-options/round4/index.html?section=d10)、[修正前失败截图](records/homepage-v241-repair/visual-options/round4/evidence/d10-before-gap-fix.jpg)。|
|D11 贡献筛选|B 文本下划线|标签 14px；排序下拉视觉表面 28px，命中区 36px，与同一行的其它元素协调。分类、排序、仅看未平仓维持独立状态。|[第三轮验收](records/homepage-v241-repair/visual-options/round3/ACCEPTANCE.md)。|

“其它已确认”延续此前选择，不批准在评审范围之外新增布局、压缩内容或改变统计口径。表中的固定样例尺寸是原型参照；正式整页必须验证相同密度和必要的窄宽回退，不能只照搬孤立卡片而不检查父容器。

这些选择解决了本票的开放视觉问题。其余 D04—D06、D12—D17 的排查和修复要求见[问题跟踪表](ISSUE-STATUS.md)，不能因不出现在本表而被遗漏。
