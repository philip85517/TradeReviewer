> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 设计覆盖与局部控件登记

触发：前端图表数据接线与展示开发，按 `docs/agents/frontend-control-audit.md`。范围仅历史图表及直接相邻的范围/市场联动；不是整页全控件验收。

参考 S1：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:349–387`。
参考 I1：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/history-stats-cumulative.svg`（原单累计状态，双线变化以本次用户确认覆盖）。
参考 B1：`evidence/before-cumulative.png`，原实际页面；另存默认态截图。

|需求/依据|elementID|精确参考|状态|owner|组件|浏览器操作|可观察预期与反例|证据|状态|
|---|---|---|---|---|---|---|---|---|---|
|用户确认默认双线|HC01|S1 / I1 / 本次确认|正常、正负混合|实现代理 / 主代理验收|FullHistoryPanel|打开首页滚至历史|各期及累计两线、图例、共用CNY轴；不重复计费|after-final-1280.png、root-tests.log|PASS|
|S1:359 / 真实接口|HC02|S1 / B1|全部、单年、区间、换市场|主代理|历史范围与市场|应用范围、取消、切市场|累计起点随范围；末点与范围总额一致；上方当前期间不受年份变化|real-history.json、market-oracles.json、browser-audit.json|PASS|
|S1:361–365|HC03|I1 / B1|鼠标点选、键盘、退出|主代理|图点、提示框|鼠标点选、方向键、Esc|两位小数；两线读数；无提示残留|after-tooltip.png、after-600-end.png、browser-audit.json|PASS|
|S1:359–387|HC04|S1|无成交、缺失、未来|实现代理 / 主代理|双线独立路径|小样本真实组件+未来年份UI|无成交累计平延；未知/未来不补零；当期未知不隐藏已知累计|root-tests.log、after-single-year.png、after-future.png|PASS|
|S1:361 / 既有CSS|HC05|I1 / B1|指标选项4种、断点|主代理独立视觉|图表、图例、下游|指标切换；1280/901/900/600|各期默认双线；其余单线；尺寸稳定、提示不遮挡核心读数|after-final-1280.png、after-901.png、after-900.png、after-600.png、after-600-end.png、browser-audit.json|PASS|

局部登记：M-net/M-cumulative/M-win/M-rounds（4选项）；R-all/R-single/R-range/R-future/R-cancel（5范围操作）；K-arrow/K-escape（2键盘操作）；P-point（1鼠标读数）；S-market（1市场联动）；V-1280/V-901/V-900/V-600（4视觉状态）。共17项，图点动态边界按全历史首/中/末与当年无成交/未来代表点验证，不声称逐点全量检查。

不适用：持久化写入（此功能无写操作）、物理触屏/软件键盘（本轮鼠标和键盘桌面浏览器）、负载压测（后端接口与数据量未变）。

所有证据位于 evidence/，绑定版本见 evidence/version.json；17项逐项接受与输入方式、独立视觉对照结论见 FINAL-ACCEPTANCE.md。浏览器实际验证鼠标点选及键盘；不将组件合成事件记为真实悬停覆盖。
