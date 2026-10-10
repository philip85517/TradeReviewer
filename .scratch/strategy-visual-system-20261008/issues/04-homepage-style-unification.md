# 04 — 在完整策略复盘中复用首页视觉

ID: TR-VIS-04
State: closed
Status: accepted-scoped
Assignee: workbench_style_luna
集成负责人: root（整页视觉与数据链）

## Scope / Refs

按 [契约](../style-unification-contract-20261009.md) 与 DESIGN-COVERAGE U10–U16，复用首页当前候选参数到旧完整观察、结果、比较。保留既有组件/完整字段，样式比较不重挂业务组件。首页具体参考及新鲜图详见契约；旧阶段/图表规格见full-restore-contract。

## Blocked by

None；02/03恢复已接受。回放状态不扩展，以root已接受真实逐日合同为基础。

## 验收标准与反例

- [x] 三页面两桌面与390样式、字段、图表未被挤压；[同状态前后与窄屏图](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-acceptance.md)、[独立直接看图](../reports/style-unification-visual-review-20261009.md)。
- [x] 样式切换保持当前日期/组合/图型/金额与可见视野，不返回初始状态；[前后状态JSON](../evidence/style-unification-20261009/style-state-preservation.json)、[实际旅程与内部range边界](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-acceptance.md)。
- [x] 真实逐日/播放、三分析图与来源恢复；视觉prop不改截止/数据/状态机；[root旅程接受](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-acceptance.md)。既有完整Tooltip/wheel前视审计仍NOT VERIFIED，不扩大本票结论。
- [x] 代表selected/真实focus/T0 disabled，已测交互高度36/44、主要文字与实际代表色对比度；[参数与状态](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-acceptance.md)、[计算](../evidence/style-unification-20261009/contrast-measured.json)。辅助原型chrome12/18、点击框非全正方形、真实touch/逐字字体未测明确登记。
- [x] root typecheck/scope lint/diff exit0，原全仓FAIL保留；[检查与日志位置](../../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-acceptance.md)、[源码冻结及证据清单](../evidence/style-unification-20261009/manifest.json)。

## 派发说明

唯一Luna实现允许：full-workbench-preview.tsx/css、新workbench-visual-theme.css（候选共享token/组件样式）、running-prototype.tsx中optional视觉主题与Canvas applyOptions（不改状态/数据/视野）；必要结果/比较原CSS修改须先告知root，优先scope统一覆盖。不得修改另一个工作树、globals、原数据、其他已改样板，不push。报告reports/style-unification-implementation-20261009.md。样式切换禁止key/resetNonce变化；Canvas只applyOptions不重建/fitContent。独立代理不参与实现，root接受。

## 历史

2026-10-10 用户“整体ok”认可0.7画面；05新鲜滚轮/键盘、导航作用域及独立直接看图重新接受，关闭本次滚动重开范围。[最终滚动记录](../../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)。不扩大到公共组件/生产推广，旧FAIL与未验证项保留。

2026-10-10 用户认可整体视觉后报告“无法下滑”；root实测1280px文档1051px，body hidden，native wheel/End均0。重新打开仅滚动门槛，由[05](05-complete-preview-scroll.md)修复；旧R01–R11截图与接受保留，不能以旧全页截图代替实际滚动。本轮最终接受待新鲜证据。

2026-10-10 root重新接受04：[当前回归接受](../../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)。R01–R11新鲜证据关闭；18档主体、5档K线、6档菜单/末项、抽屉/焦点/恢复/长名由未参与实现者直接看图，root另接受真实逐日/播放/主题保持及来源返回。Final3菜单FAIL后仅3处CSS修复，Final4独立复验。历史三档PASS、第一批断点/标签FAIL、Final3菜单FAIL保留；[最终清单](../evidence/observe-regression-20261009/manifest.json)。关闭不扩大为全量未来信息/生产SQL/触屏/其他原型接受，整体01仍open；0.7候选尚待用户画面选择，没有提交或推送。

2026-10-09 严格回归重新打开：root 新鲜复现601px按钮/恢复区与图/侧栏重叠、760px收益省略、390px预览工具挤占、1440px恢复基线与次级金额层级错误。此前PASS保留历史；当前视觉FAIL。U10/U12/U15相关结论重开。见[回归契约](../observe-regression-contract-20261009.md)及新evidence/observe-regression-20261009，后续不得引用旧报告替代本轮验收。

2026-10-09 创建；参考当前首页真实运行与源码，保留已有恢复证据。

2026-10-09 root接受本票并关闭：真实鼠标/键盘旅程与主题状态、独立画面对照分别PASS。独立审查期间出现的中文Mono、coarse几何、36/44权重、170px空白、错误账本selector与12px字体、日期/价格遮挡均修复后另存新证据，原FAIL不覆写。纯内存预览DB持久化NA；实际设备、中文逐字、整体01/生产推广继续NOT VERIFIED。当前候选用户审美选择仍待实际评审，不等于正式规范批准；没有提交/推送/合并。
