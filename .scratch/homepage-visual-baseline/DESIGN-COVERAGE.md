# 首页图文规范需求覆盖

基线 master 7a5d137d。相对交付根：docs/design-system/baselines/2026-10-15-homepage-v1.0/。不修改产品代码或业务库。

| 需求 | 对应章节 / 来源 | 负责人 | 证据 |
| --- | --- | --- | --- |
| H01 目标与历史取舍 | HP01；历史需求与sources.md | root / sources研究 | visual-design.md、sources.md、独立审阅 |
| H02 全页与各分区 | HP02–HP08；当前master组件与真实截图 | root | images/structure-board.svg、各章HOME图、captures.json |
| H03 控件、元素、样式与验收 | HP03–HP10、R01–R16；当前TSX/CSS | root / sources研究 | rules.md、computed-styles.json、computed-controls.json、style-samples.svg |
| H04 动效与响应式 | HP05/07状态分镜；HP09，1440/390采集 | root | 原图局部SVG帧、home-mobile.jpg、mobile-chart.jpg；产品未测行为明确NOT VERIFIED |
| D01 目录、原图、图文阅读 | VDF-002；策略台v2.2阅读形式 | reader实施 / root与reviewer独立验收 | reader-desktop.jpg、reader-narrow.jpg、independent-review.md |
| D02 文字与图片评论 | 复用f922策略台v2.2评论契约 | reader实施 / root持久化验收 | comments-persisted.jpg、comments-new-process.jpg；23项服务回归及客户端生命周期 |
| D03 状态演示 | 实际截图独立帧，非产品操作 | reader实施 / root修正与reviewer验收 | HP05/07；鼠标下一步与键盘Enter验证 |
| H05 最大问题评估独立 | 现状截图、口径与任务关系 | root | assessment.md / assessment.html |

具体版本绑定覆盖、排除项及失败修正记录见 evidence/acceptance.md 与 independent-review.md。产品全功能、物理触摸及业务写入未宣称通过。
