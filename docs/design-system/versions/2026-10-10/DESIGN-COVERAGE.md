> 归档副本（2026-10-10）。以下原结论保留原时间和范围；标注“本地历史记录”的文件未随远端归档。当前版本入口见 [版本说明](README.md)。

# 修复覆盖与验收计划

## 2026-10-10 当前状态（截至E149）

**64 PASS / 2 NOT VERIFIED / 0 FAIL（66行有限UI旅程）**。X04由E140/141/145真实非空Undo/Redo闭合；G02/K01由E140/141短箭头keyboard/Esc及独立像素闭合，G02另有E141完整风险行/E142长数值；P01由E144失败留页重试/E146实际点击早于PUT且完成后导航、返回reload闭合。[当前11票边界](reports/146-current-ticket-boundaries.md)列版本和精确范围。历史工程失败保留：141全量50失败；E146全量最终为3 FAIL / 3226 PASS / 6 SKIP测试，1 failed / 324 passed / 3 skipped文件，455.32s（日志（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/root-146-full-unit.log`））。[E148诊断](reports/root-148-trade-review-diagnosis.md)：3项默认超时单worker全部PASS，整父测试文件91 PASS，无代码/测试修改；这不取消E146失败。E149最终串行全量PASS：325 passed / 3 skipped文件（328总计），3229 passed / 6 skipped测试（3235总计），803.39s，exit0；命令`npm run test:unit -- --maxWorkers=1 --reporter=dot`，见[日志](reports/root-149-full-unit.log)。32个freeze-141文件hash相符。typecheck/build/runtime/scoped lint均PASS，scoped lint保留9 warnings；全仓lint历史失败保留，不能声称全仓lint绿。 [最终概览](reports/149-final-acceptance.md)。K02/R03、实际OS原生指针逐帧NV保持。32文件冻结为[freeze-141](reports/freeze-141.json)，旧冻结与旧全绿只是历史。

## 2026-10-10 E139历史状态（后由E146逐项补证）

**60 PASS / 3 NOT VERIFIED / 3 FAIL（66行）**。X04为E138非空草稿enabled Undo FAIL；G02/K01为E136短箭头focus的同一反例，两项源码/单测修后均待root真实浏览器。P01为Preview导航接线待验；E135 retain race独立源码/probe已有限PASS。E139数据库rev351→352、bundles32→33且working相等，留存未丢失。K02/R03真实输入环境NV不变。当前不是最终冻结/完整接受，旧freeze-final与3220全量为历史版本。11票精简边界表（本地历史记录：`.scratch/drawing-control-fix-20261009/reports/139-current-ticket-boundaries.md`）是本轮逐票最小补证清单。

|新增反例/现行ID|参考|唯一owner|最小真实复验|结果|
|---|---|---|---|---|
|E136 / DCA09 / G02,K01|契约§7；136-arrows-selected short普通/选中；独立像素报告|compact_hotspot_fix，Canvas generic focus proxy|短箭头普通→键盘选择→Esc，终端可辨/焦点避让/取消代理隐藏；一个近边通用图形邻接|E139历史FAIL；E140/141/145有限复验闭合，见顶部|
|E138 / DCA11 / X04|契约§1,8；138-root nonempty-enabled-undo；138-text-draft-undo-red|compact_hotspot_fix，Canvas编辑焦点保护+Toolbar历史按钮标记|既有命令→非空编辑→enabled Undo/Redo，草稿不提前提交且既有命令正确回退/恢复→Cancel|E139历史FAIL；E140/141/145有限复验闭合，见顶部|
|E135/E139 / P01|契约§8；135保存边界诊断、138独立probe、139数据|canvas_state_fix负责Recall；Preview接线由root另派|留存pending→实际index→返回/reload；失败保持当前页|E139历史NV；E144/146已有限闭合；E139实际留存成功|

## 2026-10-10 后续反例（保留原66项分母）

|反例/现行ID|准确参考与证据|唯一实现owner|用户旅程/验收证据|当前结果|
|---|---|---|---|---|
|E122 / DCA05 / X01|design-contract §4；evidence/122-longtext-last-line.jpg；reports/e119-e126-independent-visual-review.md|canvas_state_fix：drawing-canvas.tsx及Canvas测试|390宽35行中文，编辑完成→展开→滚至末尾→取消/重选；底部操作区不得遮末行，文字/尺寸/滚动位置不因选择变化；root实图和独立视觉复验|PASS：E131窄屏/E132同E122桌面状态，末行可读；root与独立视觉分别通过|
|E127c / DCA10 / G02|design-contract §7；evidence/127c-rr-390-target-before.png、during.png；独立复核报告|canvas_state_fix：Canvas标签与控制柄局部层级|窄图小RR目标价柄拖动前/中/后、撤销；标签完整，柄可辨可点；root实图+几何，独立视觉复验|PASS：E130四柄命中、fallback无交集、真实滚动及Undo；限已测小RR|
|E128 / P01 / R01|evidence/128-narrow-index-intercepted.jpg/txt；本表已要求返回/响应可达|compact_hotspot_fix：仅review-design-preview.css|390宽链接中心实际命中右侧栏开关；修后真实点击索引→返回→reload，390/640/641/1440实图，保留顶栏高度和44px开关|PASS：E129实际点击→返回→reload，断点截图及独立视觉已证|

本轮新增反例属于既有文字阅读、标签操作、返回链和响应可达门槛，不扩展整体布局设计。root仍负责整体视觉一致性和持久化链；未实现UI的browser_visual_review负责独立视觉对照。634db全量运行因新反例待修被主动中断（exit130，非PASS）。历史产品冻结1044545e；旧指纹见reports/freeze-final.json，已被E135/E136/E138后续修复取代。10445全量曾有1条保存时序断言失败，保留日志；测试等待修订后的全量运行单独记录。

基准来源：批准选择规范（本地历史记录：`docs/design-system/drawing-selection-feedback.md`）、元素表（本地历史记录：`docs/specs/2026-09-25-chart-first-review-ui-elements.md`）、审计状态全集（本地历史记录：`.scratch/drawing-control-audit-20261009/DESIGN-COVERAGE.md`）、[本轮明确规则](design-contract.md)。原11票都含精确截图和源码，必须读图片而非只读摘要。

1440×900同数据同S1双截止03-18 15:00、左右面板开、价格范围沿用审计02，按需要测试1280×800/1024×768/390px及导航/侧栏变化。DPR1/2、细/粗指针、键盘、IME、reduce motion分列。任何对图形的动作不推进阶段/截止；临时动作不持久化。无变更的顶栏布局不重新设计。整页视觉与完整数据链owner=root；独立视觉review由未实施者执行。

|需求|元素|准确参考|阶段状态|所有者|旅程和反例|证据|状态|
|---|---|---|---|---|---|---|---|
|DCA01 / Esc 不能取消已有选中|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/01-escape-selection.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task1；root集成|依原票准确参考与反例；T01–12.select / D02 / K01|[CONTROL](CONTROL-ACCEPTANCE.md)及CONTROL B/F逐族选择、E87/E107/E133拖动取消|具体缺陷PASS；详见原票有限接受|
|DCA02 / 趋势线单击即保存零长度对象|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/02-zero-length-creation.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task1；root集成|依原票准确参考与反例；T02.create / D01|[CONTROL](CONTROL-ACCEPTANCE.md)及E69动态创建、E87拖动、E101首点Esc；E136补双击|原零长度缺陷有限接受；E136双击动作已具备，E138现有过程录像待独立核阅，不需再造动作矩阵|
|DCA03 / 平行通道没有首段反馈且跨工具沿用旧取点|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/03-channel-stale-draft.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task1；root集成|依原票准确参考与反例；T04.create / D01|[CONTROL](CONTROL-ACCEPTANCE.md)及E71创建、E82拖动、E101基线及宽度阶段跨工具/重开|具体缺陷PASS|
|DCA04 / 更多绘图工具菜单展开后不可见|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/04-more-menu-clipped.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|menu_owner / task2；root集成|依原票准确参考与反例；M01 / M02|[CONTROL](CONTROL-ACCEPTANCE.md)及E25–28七项鼠标与键盘菜单；E100邻接回归|具体缺陷PASS|
|DCA05 / 仅选中文字就改变换行和可见内容|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/05-text-selection-reflow.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task3；root集成|依原票准确参考与反例；X01|[CONTROL](CONTROL-ACCEPTANCE.md)及E105同宽普通/选择；E131/132长中文末行/取消重选；独立视觉|具体缺陷PASS|
|DCA06 / 文字编辑器遮挡样式且与原正文重叠|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/06-text-editor-overlap.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task3；root集成|依原票准确参考与反例；X02 / R01|[CONTROL](CONTROL-ACCEPTANCE.md)及E50字号、E55/56窄样式滚动、E98点击、E119/121前景和完成取消|scoped accepted：E50/55/56/119/121已覆盖四类现有样式入口；无需组合穷举，真实IME另列NV|
|DCA07 / 价格批注流程与 TradingView Price Note 不一致|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/07-price-note-contract.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task3；root集成|依原票准确参考与反例；X03 / P01|[CONTROL](CONTROL-ACCEPTANCE.md)及E80精确价和完整时间、E83两点、E110/133持住预览/取消、E123框锚分离|具体缺陷PASS|
|DCA08 / 市场锚点光标方向错误且移动入口难辨认|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/08-cursor-hit-target.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task3；root集成|依原票准确参考与反例；G01 / D02 / R02|[CONTROL](CONTROL-ACCEPTANCE.md)及E81–90实际拖动光标、E99/100邻接、E106/107模拟环境|有限功能接受：E130邻接、E137边界/锁定已有具体证据；实际OS指针逐帧仍NV|
|DCA09 / 箭头工具实际只画线和圆点|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/09-arrow-no-arrowhead.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|label_geometry / task4a（纯helper）→ canvas_owner 集成；root视觉验收|依原票准确参考与反例；T08 / G02|[CONTROL](CONTROL-ACCEPTANCE.md)及E75真实箭头/拖动；E136补方向/短线普通选中|scoped accepted：E140/141真实keyboard/Esc及独立像素闭合E136，历史反例保留|
|DCA10 / 盈亏比与回撤线的文字相互遮挡|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/10-dense-labels.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|label_geometry / task4a（纯helper）→ canvas_owner 集成；root视觉验收|依原票准确参考与反例；T05 / T09 / T12 / G02|[CONTROL](CONTROL-ACCEPTANCE.md)及E64/72/76/79密集数值、E130四柄fallback滚动|scoped accepted：E141真滚112完整百分比，E142普通/选中375R及held当前1.99R独立像素通过，限所测代表|
|DCA11 / 新文字完成后再点空白会进入草稿并阻挡切工具|E03/E04/E05/E08按原票|原票（本地历史记录：`.scratch/drawing-control-audit-20261009/issues/11-text-draft-tool-switch.md`）及该票jpg精确引用|S1普通/选中/拖动/取消/编辑；S0回看保留截止|canvas_owner / task1；root集成|依原票准确参考与反例；X04 / D01|[CONTROL](CONTROL-ACCEPTANCE.md)及E83/85完成退出、E101非空切工具保留，E136补草稿Undo|scoped accepted：E140/141 Undo、E145非空Undo/Redo/再Undo保留草稿；E138 FAIL保留|

## 当前证据口径

66行CONTROL为有限、版本绑定的操作集合（当前64 PASS / 2 NV / 0 FAIL；E149限定工程检查PASS，环境NV），不是原11票所有复合条目的替代分母。已具备动作不重复，精确缺口见顶部与精简表；root直接接受和非实现者视觉复核分开。K02真实中文IME、R03物理触控无真实设备证据，保留NOT VERIFIED。
