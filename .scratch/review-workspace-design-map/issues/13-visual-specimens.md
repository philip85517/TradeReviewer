# 确定公共视觉样例与参数标注

ID: review-design-13
Parent: [复盘工作区视觉规范重构决策地图](00-design-map.md)
Labels: wayfinder:prototype
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: coordinator
Resolution comment: 待解决

## Question

在已选择的完整工作区中，哪些公共视觉规范需要用实际组件、适用状态和尺寸标注解释，怎样继承 V2.5 而不复制出第二套规范？

## Scope / What to build

目标：让颜色、层级、文字、数字、间距、控件状态可以直接比较，使整页和局部采用同一套视觉语言。

讨论材料为公共样例板和标注样章，不是正式设计决议或业务实现。覆盖 E01/E05–E18/E20–E22、N01/N03/N04 的呈现；E03/E19 的专用工具轮廓与操作由 TradingView 契约票负责，本票只检查相邻区域的协调性，不另定 TV 图标。

## Refs

- [视觉恢复计划](../visual-recovery-20261024/PLAN.md)：七组样例、逐章回填与当前缺口。
- [精确视觉覆盖](../visual-recovery-20261024/DESIGN-COVERAGE.md)：每组元素、来源、状态、owner 与验收。
- [V2.5 控件手册](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html)与[全站视觉](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/visual-spec.html#sitewide-visual)：公共规范来源。
- [当前正文](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/source/visual-design.candidate.md)：RV03、RV06–RV09；版本以视觉覆盖记录的 SHA 为准。
- [原控件参考截图](../../../docs/design-system/baselines/2026-10-22-review-workspace-v1.0/evidence/reviewer-reference-v25.png)：观察状态与排版的参考，不把旧截图当当前原型验收。

## Blocked by

- [确定沉浸式工作区与左右区域职责](04-immersive-layout.md)

依赖的是用户选定的整页结构，用于抽取同源组件；基础 V2.5 阅读可提前进行，不新增研究票。

## 执行的主要思路

先从用户选择的整页提取真实组件，标明共享 token 的来源；再补适用状态、长文本/数字和错误例；最后制作一段“目标与取舍→可见样例→状态规则→参数引用”的样章供讨论。不要先设计脱离全页的组件库。

## 验收标准与反例

- [ ] 七组样例均有实际组件、使用场景、参数标注、来源及状态边界；与整页同源，参数与渲染一致。
- [ ] 覆盖字体层级、数字对齐、相邻表面、按钮/输入/菜单、图表标注、业务卡片和反馈恢复；不以纯 token 表通过。
- [ ] 标明 V2.5 继承、工作区专用差异、未确认候选；不替换 TV 专用轮廓，不把未知功能补成通用动作。
- [ ] 当前正文 14 类状态按适用组件登记；焦点单独展示，软键盘与物理触控证据区分。
- [ ] 非制作者直接比较参考和样例，确认状态变化不跳位、不缩字；用户对样例/差异作出真实选择后记录 Resolution。

反例：画出一组漂亮卡片却在完整工作区使用另一套尺寸；表格列 36px 但组件实际不一致；补了更多颜色，却仍没有表单与错误态。

## 验收证据

本票证据放在 `../evidence/visual-specimens/`，决议放在 `../comments/review-design-13/`，制作后链接具体文件。当前未制作，所有设计接受项 NOT VERIFIED。原型视觉/键盘需直接检查；业务持久化为 NOT APPLICABLE（纯设计原型，无业务写入）。

## 派发说明

领取者先读当前规范、已选整页及精确覆盖矩阵；不得直接改权威正文或关闭用户评论。协调者负责全页一致性；非制作者负责视觉对照。用户确认后由正文整合票回填。

## 历史

2026-10-24：用户指出新版缺少界面和视觉规范预览，并选择完整工作区原型优先；新增本票填补公共规范应用示例的责任缺口。本轮仅建票，不作 HITL 决议。
