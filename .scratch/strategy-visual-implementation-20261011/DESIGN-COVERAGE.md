# DESIGN-COVERAGE · 策略台视觉首个实现切片

本矩阵只覆盖本切片实际修改和验证的元素；规划期的完整 P01–P10 矩阵仍在
[上一级规划目录](../strategy-visual-acceptance-plan-20261011/DESIGN-COVERAGE.md)，
未被本切片验证的条目保持 `NOT VERIFIED`。

| 需求 / 原文 | elementID | 准确参考图或文件 | 阶段与状态 | owner / 任务 | 用户旅程 | 具体修改或检查 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 完整历史不污染阶段/全局回放上下文 | U05 / R06 | `docs/verification/2026-09-20-recall-followups.md`；`visual-contract.md` | S0/S1 → 完整历史 → 返回回放 | `/root` / issue 01 | 推进两根 → 完整历史 → 尝试第二决策 → 返回回放 → 全局总结 | historyMode 禁止普通 `selectDecision`，保留进入历史前双游标和 candles | `recall-workspace.test.tsx` focused + 112-test suite | PASS（自动化） |
| 完整历史切周期不截断行情 | U05 / R07 | 同上；回放状态表 | 完整历史 / 1W | `/root` / issue 01 | 完整历史 → 切 1W | historyMode 用 `revealRecallHistory` 重建目标周期 | `recall-workspace.test.tsx` focused + 112-test suite | PASS（自动化） |
| 图表优先、长中文和阶段/双截止可见 | U06 / U07 | `versions/0.7-20261010/screenshots/observe-1440.jpg`、`observe-390.jpg`；推荐样板 CSS | S1 / selected | `/root` / issue 01 | 打开推荐路由，保持 S1、计划、批注和图表 | 复用现有推荐 CSS；真实浏览器测 chart/plan/中文流式布局 | `browser-matrix.md` + 当前浏览器截图 | PASS（当前三视口） |
| 1280 窄桌面页面可垂直滚动 | U07 / R09 | `observe-scroll-20261010.md`；`observe-bottom-1280.jpg` | 1280×800 / page flow | `/root` / issue 01 | 页面顶部 → scrollY 600 | 原型存在时覆盖全局 body lock：`overflow-y:auto`、`overflow-x:hidden` | `browser-matrix.md` | PASS（真实浏览器） |
| 控件选中和焦点环可识别 | U03 / G03 | `acceptance-standard.md`；主图元素规范 | 390 / 持仓过程 selected；播放 focus | `/root` / issue 01 | 窄窗选中 S1，Tab 到播放 | 读取实际 `aria-pressed`、背景/边框、focus-visible outline 和高度 | `browser-matrix.md` | PASS（真实浏览器） |
| Text → 回看早期 → 保存/重开真实闭环 | U05 / U06 / R05 | `development-workflow.md` 首条旅程 | 全阶段 | `/root` / 后续切片 | 真实主图、隔离 SQL、重开 | 本切片未扩展生产写入；不把 localStorage 样板当 SQL | 无 | NOT VERIFIED |
| 真机触摸、软键盘、导出字体 | U07 / R10 | `acceptance-standard.md` | 触摸/导出 | `/root` / 后续切片 | 真机与导出 | 尚未有对应设备和导出管线 | 无 | NOT VERIFIED |
