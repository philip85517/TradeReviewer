# R1 F4与状态范围复核

2026-09-26；gpt-6-astra / low。未操作浏览器、未运行测试/全量套件、未改产品。依据更新的R1-frame/R1-state报告及实际workspace/CSS；已view_image查看root保存的 `R1-frame-compact-1440.png`。chart正在返修，本轮不审。

## F4局部结论：默认层叠/重复占高已解除

实际DOM改为bar直接包含position/controls（同时带__primary），现有清边框/padding规则能够命中；controls的sticky已明确重置static，没有旧嵌套造成的失配。默认只有一个“更多 / 记录”；完整历史、完成、两个记录面板及成交来源均移入其中，默认不再另占整行。

root真实测量：1440×900 header61、chart750（y90）、bar48（y846）、closed more36；相对旧116px bar+两条38px面板+18px成交条已收敛。截图独立支持单条默认底栏结论。**F4默认1440紧凑高度局部pass**；这不等于E19全部状态、G08整体或R1 accepted。

root另报告更多展开body245.5/bar340.5/chart457.5，历史/完成/代表图/全快照入口可见。本代理没有操作该入口；源码native details与原处理器可达，worker frame两用例亦覆盖展开。带留存内容的嵌套代表图、1280/导航展开/390/长文本/编辑态仍unverified。

一个仍需保留在E19覆盖矩阵的缺项：主条现在只有截止/行情标记日期，所有持仓与计划/结果指标移入more。规格S107/E19仍要求一行重要指标；当前截图只能接受“高度收敛”，不能据此接受指标条完整性。应按阶段保留至少当前关键指标的紧凑摘要，避免重新展开全部原始字段；R3整合时验证侧栏关闭仍能看必要仓位/风险/结果。

## 状态/保护条件范围

- nextDecision pre-entry按首个稳定决策定位，独立于阶段恢复；同K测试以显式fill-1→fill-2断言成交截止，不靠全量结果计数。
- 普通逐根setWorking保留默认selectedDecisionId；直接选决策才改变归属。hasSeenFuture在主动未来入口单调合并；预入口/holding结果标签遮挡、选中成交仅在揭示集合中展示。
- 输入/IME快捷键过滤及nextBar/nextDecision/history的editing/history/post条件存在；末尾播放禁用且定时器结束。快照编辑按钮禁用相关推进，完整历史也禁用；完成按钮虽可点击，但complete handler明确拒绝history、editing、未清仓及缺失决策快照，不会通过更多入口绕过保存规则。
- report记录29 integration/38 workspace/6 diagnostic通过；本次未重跑，more折叠路径的旧测试仍由B补成真实展开操作。类型检查报告引用不同时间的chart WIP及旧frame错误，不当成当前最终全局结果。

本轮对上述状态修复未新增确定阻断发现，允许进入root定向浏览器复验；不能把mock Chart fixture结果提升为真实回放接受。需要：新回合→首买→跨窗口→同K多决策→Text→回早期→保存重开；逐入口未来来源、末尾/快照编辑操作、首屏与更多展开视野保持。C1–C3图表问题单独返修，不被F4局部pass覆盖。

## 追加：legacy首买来源缺陷重新打开

root随后提供了本轮真实999991证据：从已保存的holding首买56返回pre-entry，仍只显示“买入事实尚未揭示”，没有已看后续来源。此前switchPhase的firstDecisionReplay例外把“恰在首笔边界”排除，违反STATE-CONTRACT；首买相对入场前也是未来。前文“本轮未新增确定阻断”是当次审查覆盖不足，**不能用于接受此状态范围；R1来源安全scope仍fail待复验**。29/38/6旧测试不能覆盖或批准例外。

追加读取时，B已将实际源码改成返回早期比较 `replayStateIsLater(replay, graph.replay, currentExecutions)`，删除首笔例外，并有新测试 `marks a legacy holding cutoff at the first buy as future when returning to pre-entry`。这是修复中的源码证据；尚无本代理独立运行/根浏览器重验结论。R1-state.md仍保留“初始holding首笔不会误标”的旧描述，需B更新而非静默沿用。必须补验legacy首买→早期→新Text/计划→保存重开来源不丢；全新load本就从pre-entry初始化false，不需要保留错误例外照顾旧fixture。首帧尺寸局部pass不受此发现撤销，状态安全与R1整体继续未接受。
