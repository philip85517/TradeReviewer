# DESIGN-COVERAGE · 策略台视觉验收与实施规划

本矩阵覆盖本次“根据已确认视觉建立验收标准并拆解任务规划”的规划范围。它不声称产品实现已通过；初始结果全部为 `NOT VERIFIED`。实现任务必须在本矩阵和对应 Resolution 形成后，另建或扩展实现期矩阵并填写具体文件 owner。

| 需求 ID / 规格与原文 | elementID / 范围 | 准确参考图或文件 | 阶段与状态 | owner / 任务 | 交付/证据 | 浏览器操作 | 可观察预期与反例 | 证据路径 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 目标：策略台和复盘使用同一可复查视觉合同 | map scope | `visual-contract.md`；0.7 README | 规划期 | `/root` / 00 | 终点、边界、术语、职责 | 无（文档票） | 三道门槛分开；反例：把样板确认写成生产完成 | `README.md`、map issue | NOT VERIFIED |
| P02 A01–A03 当前视觉检查点和来源哈希 | A01–A03 | `versions/0.7-20261010/README.md`、`screenshots/*`、`manifest.json` | complete / top-bottom / live | 01 | 固定场景/视口/DPR/滚动矩阵 | 真实浏览器重跑每个入口 | 同状态可复现；反例：旧截图替代新证据 | 01 issue、future `evidence/` | NOT VERIFIED |
| P03 U01/U02/U03/U04 信息层级、文字、颜色、图标和组件状态 | U01–U04 | `README.md`、`diagnosis.md` | default/selected/focus/disabled | 02、05 | 共享 token 和上下文例外 Resolution | computed + 截图 + 键盘/鼠标 | 文字、对比度、命中区和基线稳定；反例：只凭审美描述 | `acceptance-standard.md` H/T/C/K | NOT VERIFIED |
| P04 U05 双阶段/双截止/未来信息门槛 | U05 | `README.md` 复盘工作区；`development-workflow.md` 状态转移 | S0/S1/S2、replay/tooltip/zoom | 03 | 状态转移表、来源字段和真实图表证据 | 隐藏未来→next/play→next decision→Text→早期→保存重开 | 目标 K 线/成交真实出现且未来不泄露；反例：只改游标 | 03 issue、future `acceptance.md` | NOT VERIFIED |
| P05 U06 原判断、完整计划/批注、计划/实际和形成阶段 | U06 | `README.md` 复盘工作区；`observe-regression-20261009.md` | long content / expanded | 02、03、04 | 长文本截图和同源字段核对 | 展开、回看、刷新、重开 | 原文完整且来源清楚；反例：为密度删固定评论 | 04 issue、future screenshots | NOT VERIFIED |
| P06 U07 响应式、滚动、较窄窗口和触摸边界 | U07 | `README.md`、`observe-scroll-20261010.md`、0.7 screenshots | 1440/1280/1024/980/760/600/390 | 04 | 关键断点对照表、滚动证据 | resize、页底滚动、回放换行；适用时真实触摸/软键盘 | 图表/主要动作/完整正文可达；反例：body 锁死或裁切 | `visual-contract.md`、04 issue | NOT VERIFIED |
| P07 F01–F07 完整 Workbench 恢复范围 | F01–F07 | `full-workbench-preview.md`、0.7 entry links | T0/running/complete/results/compare | 01、07 | 入口、状态、数据完整性清单 | 逐一打开 URL，切场景和回放 | 净值/K 线/持仓/结果/比较/旧 benchmark-like 视图均可达 | 01/07 issues | NOT VERIFIED |
| P08 G01–G04 导览和样板入口 | G01–G04 | `full-workbench-preview.md`、`homepage-style-reuse.md` | nav collapsed/expanded | 02、05、07 | 导览、默认入口、ARIA 和链接 | 展开导航、Tab、返回/刷新 | 首屏动作和层级稳定；反例：首页 B 比例直接覆盖复盘 | 02/05 issues | NOT VERIFIED |
| P09 R01–R10 严格回归与历史 FAIL/NV 保留 | R01–R10 | `observe-regression-20261009.md`、`acceptance.md` | regression | 06 | 回归差距、旧证据、重开规则 | 同状态重复操作和并排截图 | 历史结果不被覆盖；反例：新截图抹掉 FAIL/NV | 06 issue、future `FINAL-ACCEPTANCE.md` | NOT VERIFIED |
| P10 U08/U09/U10–U16 生产接线、共享风格和文档固化边界 | U08/U09/U10–U16 | 0.7 README “选定后推广范围”；`CONTEXT.md` | implementation planning | 05、07 | 文件 owner、接口、例外、版本门禁 | 后续实现后执行真实保存/重开 | 只推广已接受合同；反例：静态内存样板当生产状态 | 05/07 issues、future docs | NOT VERIFIED |

## 覆盖说明

- A/F/G/R/U 编号沿用已有策略视觉目录，便于回查历史票据；本目录新增 P 编号只标识规划任务，不重写历史接受记录。
- 当前没有用户决策 Resolution，因此所有行保持 `NOT VERIFIED`；完成地图创建不关闭任何实现或验收票。
- 反例必须与证据一起保存；没有截图、真实操作或适用的持久化证据时，不能把 DOM、HTTP 200、无溢出或总体评分写成 PASS。
