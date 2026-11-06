# 01 原生组件设计样板

State: closed
Status: accepted
Assignee: design_sample
Integration owner: root
Blocked by: none
Owner: design_sample (gpt-5.6-luna), root acceptance

目标：单个推荐样板，实际 RecallWorkspace，完整合成内容；baseline/recommended同fixture对照。先真实图表最小旅程，再scoped视觉。

可写：app/components/design-prototype/*，app/page.tsx；追加仅显式 opt-in 样板接口的文件：app/components/recall/recall-workspace.tsx、app/components/chart/replay-chart.tsx、app/components/chart/drawing-canvas.tsx。三者唯一 owner 为 design_sample。生产默认值和路径保持原行为，不改业务库/领域计算/持久化。接口仅由推荐样板传入。

必读：当前workflow/decomposition/UI模板；本目录README、DESIGN-COVERAGE；当前复盘规格和element表；参考02/04/05/07原图；当前strategy DR/spec（保留固定原型范围，不搬首页B）。

验收：真实图表推进/计划/完整长Text/原判断+当前补充/双截止；同state前后；推荐13/20控制文字、14/22中文正文、图上Text沿用真实几何14/21但降为400、12/18辅助、18/24标题；36h desktop、44 coarse、独立icon18/19 stroke1.75、radius4–6；primary深蓝与白字≥4.5；保留主题绿红。输入标签不短改、价格不隐藏。具体值以真实页面校准。

2026-10-07 root 最小图表门槛：sample-base-calibrated-s0.jpg → 下一根 → sample-base-calibrated-s1.jpg；新bar、买入marker、持仓1000、行情2024-02-12 15:00和成交09:35同时真实可见。长原文完整位于图表；此前原生Text Control+Enter新增成功。允许推进scoped视觉。

追加接口契约：RecallWorkspace 可选 designPreview 配置 → ReplayChart显式layout字体链及size12 → DrawingCanvas可选Text字重400（默认仍600；不修改几何/文本/锚点）；safeStageProjection=true时导航只显示已知决策（S0可保留当前首笔计划占位），统计不显示未来全量分母。原fixture完整3笔保持，baseline不启用这些接口以保留问题证据。样板中完整日期/时区可见，主要推进按钮单一实心蓝。接口未传入时生产行为不变。源字体家族含具体中文回退且generic最后。

窄屏390×844：自然纵向滚动，chart至少220高，计划全文自然高度、全部动作可达，不靠缩小文字、隐藏价格或删文案通过。1440×900/1280×800与断点两侧比较。截图与实际computed由root采集；独立视觉审查者theme_audit。

报告：../reports/sample-implementation.md，含实际model、文件、命令结果、未验证。无更多子代理。root独立检查前不得自称feature accepted。

root最终接受：已先实际接受最小图表旅程，再验完整S0→买入→减仓→退出→回S0补记；真实全文、选择/Tab焦点、Space/Enter、已知摘要/导航/fitAll代表入口。独立source review及独立直接看图PASS；D11/D12/D14/D15失败图保留并按实际复验关闭代表状态。最终typecheck/diff-check和服务存活PASS，浏览器预览仍运行。见../FINAL-ACCEPTANCE.md及reports。关闭的是可评审视觉样板任务，正式持久化、真实策略/回测功能、跨平台字形、物理触摸、全resize时序和启动包专项仍未验证。

验收勾选（签署：root，2026-10-07；仅本票可评审样板范围）：

- [x] 实际图表最小旅程及阶段链：[浏览器证据](../reports/browser-journeys.md)。
- [x] 完整内容、原判断与补充、代表选择和焦点：[最终验收](../FINAL-ACCEPTANCE.md)。
- [x] 同数据匹配画面、窄屏及断点组合独立复核：[视觉审查](../reports/visual-review.md)。
- [x] 默认路径兼容审查：[源码审查](../reports/preview-seam-review.md)。
- [x] 类型、相关回归、数据保护与实时预览：[验证记录](../reports/verification.md)。
