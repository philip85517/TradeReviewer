# 设计覆盖矩阵

所有实现派发前建立。精确相对路径见视觉契约；用户本轮需求优先。root拥有整页视觉及样板全数据边界。Luna只能写新样板模块，研究代理只写各自审计文件。

## 滚动回归派发（2026-10-07，用户“无法上下滑动”）

|需求 / 来源|元素|阶段/状态|owner / 文件|旅程与反例|证据 / 状态|
|---|---|---|---|---|---|
|R05/R14；用户滚动反馈；visual-contract 完整内容要求|E01/E05/E08/E14|首页 / S0/S1/S2，两种样式；桌面及窄窗|Luna 仅样板 CSS；root 整体验收|进入长页面，上下滚动可到达全文和底部动作；body hidden 但样板不能随内容无限撑长|issues/03-preview-scroll.md；局部 height 规则 PASS_SOURCE_ONLY，构建/HTTP/新 CSS 资源通过；实际滚动 NOT VERIFIED|
|R05/R14；实际 useFullscreen target main.review|E01/E05/E08/E14|进入与退出原生全屏|同一 Luna CSS；root|fullscreen 元素成为滚动拥有者，退出后恢复 root；不能删内容或拦截全部 wheel/touch|同票；fullscreen overflow 规则 PASS_SOURCE_ONLY；原生全屏/触摸 NOT VERIFIED|

## 补充派发：2026-10-07 独立源码复核

R08/R10（原判断与阶段补记，E08/E14/E15）：Luna 修正 prototype.tsx 与 fixture.ts 中旧阶段补记的只读展示及命令保护；S1→S2 编辑/清空→S1 原持仓补记及形成时点不得被改写。准确参考：本轮 BRIEF R08、visual-contract.md 的阶段与原文规则。证据：fixture-regression-red.log 先捕获锁定失败；fixture-safety-final.log 和 sample-final-review.md 闭合指定源码反例，sample-independent-review.md 保留历史 FAIL，真实交互仍 NOT VERIFIED。

R07/R09（截止及同源数据，E02/E07）：同一 Luna 修正首页 latestTradeDate/latestImportedTradeDate 使用已知成交尾部日期 D68，估值仍 D69。参考：design-system-fixture.ts 的 sample-reduce 与 BRIEF R09；验收为元数据回归测试。

R12/R14（复位，E01/E04）：同一 Luna 增加复位 epoch，使同阶段复位也重建真实 SDK；不在样式比较或每次下一根时重建。源码复核可验证接线，真实 viewport 验收仍 NOT VERIFIED。

R05/R11（字体角色，E01/E03/E08）：root 仅修改新样板 CSS 的 textarea 字体继承及推荐字重，参数参考规范草案；不改全局。源码与文档对照，浏览器字体/几何仍 NOT VERIFIED。

R08/R10 的原文 DOM 面板由同一 Luna 改为可聚焦且可复制的静态完整原文，root 给 pre-wrap 与自然高度，避免窄窗用 textarea 内部滚动隐藏关键判断；图上 Text 仍使用实际 ReplayChart。验收为全文/来源的源码复核，窄窗实际阅读与选中仍 NOT VERIFIED。

|需求|元素|owner|用户旅程|验收/反例证据|旧元素ID|准确参考|状态|
|---|---|---|---|---|---|---|---|
|R01|资料与启动包|root|阅读/取得包|materials-inventory；启动包路径缺失|01–22上下文|docs/agents/development-workflow.md|项目资料已读；启动包 NOT VERIFIED|
|R02,R05|基础样式/字体/图标|foundation/root|首页与复盘走查|foundation-source-audit + static-contrast + sample-final-review|E01–E03,E08|app/globals.css; app/layout.tsx|PASS_SOURCE_ONLY；实测 NOT VERIFIED|
|R03,R04|问题证据与测量|root|同状态前后比较|DIAGNOSIS 八类来源/规则；没有新截图或 computed|全部适用元素|历史desktop-overview.jpg + 本轮实拍待获取|诊断已交付；最新画面/测量 NOT VERIFIED|
|R06|主图工作面|Luna/root|样板进入复盘|真实 ReplayChart 接线与全文流布局；sample-final-review|E04,E05,E08,E14|02/04 PNG + BRIEF R06|IMPLEMENTED / PASS_SOURCE_ONLY；画面 NOT VERIFIED|
|R07,R09|阶段/双截止/未来边界|Luna/root|S1→S0→S2→S0/下一根|fixture-safety-final 11 tests + sample-final-review|E02,E04,E07,E19,E22|04/05 PNG + recall-replay.ts|PASS 指定数据/源码；主图/Tooltip/轴 NOT VERIFIED|
|R08,R10|原判断/补记/完整内容|Luna/root|点原判断/查看补充|sample-final-review：原稿/旧阶段只读、sticky 来源、完整 div focus|E08,E14,E15|04-holding-stage.png + BRIEF R08|IMPLEMENTED / PASS_SOURCE_ONLY；交互/视觉 NOT VERIFIED|
|R11,R12|规范与复用|root/Luna|源码样板/文档阅读|规范草案 + source hash 774 + typecheck/lint/build|E01–E08,E19|scope primitives; ReplayChart; ChartToolbar|候选文档/接线已交付；校准 NOT VERIFIED|
|R13,R15|推荐样板前后比较|Luna/root|固定fixture切baseline/recommended|variant 不进 key，数据/全文共用；sample-final-review|E01–E08,E14,E19|visual-contract.md|PASS_SOURCE_ONLY；真实视口保持/前后图 NOT VERIFIED|
|R14|主动作/工具/计划线/批注|Luna/root|选择工具/选批注/切阶段|actual components 与真 DOM focus 接线；HTTP route 200|E01–E08,E19|02 PNG; drawings.ts; chart-toolbar.tsx|IMPLEMENTED；真实操作与选中焦点画面 NOT VERIFIED|
|R05,R14|长文/窄屏/控件状态|Luna/root|390/320/Tab/详情|样板 CSS 自然高度、44 命中声明、independent source review|E01–E03,E05,E08|07-interaction-states.png|PASS_SOURCE_ONLY；尺寸/轴/窄窗 NOT VERIFIED|
|R16|交付/固化范围|root|预览+文档+验收|REVIEW-GUIDE + acceptance + preview-http-final + 固化清单|全部适用|README/acceptance/design-system草案|文档/运行入口已交付；浏览器与视觉 NOT VERIFIED|
|R17|可逆与数据隔离|Luna/root|刷新样板|sample-final-review 无写接口；隔离启动脚本/运行测试|E20,E21 N/A|BRIEF R17|PASS_SOURCE_ONLY / COMMAND_ONLY；生产持久化 N/A|
|旧完整生产功能|计划编辑/规模/退出评价/保存导出|既有生产feature|非本轮设计样板|N/A：未承诺新增这些写入流程；旧验收不变|E09–E13,E16–E18,E20,E21|原主图规格保留，不修改|NOT APPLICABLE 本轮；旧验收保留原状态|

最终逐项门槛及证据链接见 [acceptance.md](acceptance.md)。实现完成程度与 UI 接受分开；整体 open / acceptance-failed，未用已实施替代未验证。
