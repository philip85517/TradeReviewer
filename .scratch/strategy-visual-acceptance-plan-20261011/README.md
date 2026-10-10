# 策略台视觉验收与实施规划 · 2026-10-11

这是 TradeReview 策略台和图表优先复盘工作区的规划包。它把已确认的 0.7 完整观察样板转换为可重复的视觉验收标准、状态安全门槛和有依赖的实施票，不把当前可逆样板误写成生产完成。

## 终点定义

终点是一个可以交给实现者和独立审查者的版本合同：

1. 策略工作台可在完整观察、运行中、T0、结果和比较场景之间保持同一视觉角色与完整数据；图表是主工作面，图表工具栏、回放和计划标记的位置稳定。
2. 原生复盘工作区以同一张图承载 S0 入场前、S1 持仓中、S2 退出后；阶段、行情截止和成交截止相邻可读，推进真实揭示目标 K 线/成交，原判断、批注和结论不被覆盖或删短。
3. 全部视觉判断都能在固定数据、文案、阶段、图表范围、视口、DPR 和缩放条件下复现；功能正确性、真实状态/持久化、视觉还原分别有证据。
4. 共享 token 和公共组件有清楚的推广边界；策略台 A 的固定空间预算、复盘的图表优先和自然文档流是登记过的上下文例外，不靠全局样式悄悄覆盖。

本规划回合只建立地图、票据和验收文件。它不实现组件、不修改生产 schema、不写入业务库、不推送或合并远端。

## 当前依据

- 当前视觉入口：[0.7 视觉检查点](../../docs/designs/2026-10-08-strategy-visual-system/versions/0.7-20261010/README.md)
- 设计规范草案：[Strategy visual system README](../../docs/designs/2026-10-08-strategy-visual-system/README.md)
- 共享视觉候选：[首页/完整 Workbench 共用规则](../../docs/designs/2026-10-08-strategy-visual-system/homepage-style-reuse.md)
- 严格回归：[observe-regression-20261009.md](../../docs/designs/2026-10-08-strategy-visual-system/observe-regression-20261009.md)
- 滚动修复：[observe-scroll-20261010.md](../../docs/designs/2026-10-08-strategy-visual-system/observe-scroll-20261010.md)
- 诊断依据：[diagnosis.md](../../docs/designs/2026-10-08-strategy-visual-system/diagnosis.md)
- 状态与实现工作流：[development-workflow.md](../../docs/agents/development-workflow.md)
- UI 验收模板：[ui-task-templates.md](../../docs/agents/ui-task-templates.md)
- 拆票标准：[task-decomposition.md](../../docs/agents/task-decomposition.md)
- 本地票据规则：[issue-tracker.md](../../docs/agents/issue-tracker.md)

## 票据地图

地图票：[00 — 策略台视觉验收与实施规划](issues/00-map-strategy-visual-acceptance.md)

子票按以下顺序形成合同。依赖只表示真实的契约或验收前置，不表示实现者必须按同一人执行。

| 票 | 类型 | 产物 | 状态 |
| --- | --- | --- | --- |
| [01 — 冻结基线与比较矩阵](issues/01-freeze-baseline-and-comparison-matrix.md) | `wayfinder:task` | 固定参考状态、视口、证据清单 | open / ready-for-agent |
| [02 — 共享视觉合同与上下文例外](issues/02-decide-shared-vs-context-specific-visual-contract.md) | `wayfinder:grilling` | 用户决策：共享规则和例外边界 | open / ready-for-agent |
| [03 — 阶段、双截止与未来信息门槛](issues/03-decide-stage-cutoff-and-future-information-acceptance.md) | `wayfinder:grilling` | 用户决策：S0/S1/S2 状态和泄露防护 | open / ready-for-agent |
| [04 — 响应式、密度与长内容合同](issues/04-decide-responsive-density-and-long-content-contract.md) | `wayfinder:prototype` | 用户决策：关键宽度的可见性和流式布局 | open / ready-for-agent |
| [05 — 公共组件推广边界与例外登记](issues/05-decide-shared-component-rollout-boundaries.md) | `wayfinder:grilling` | 用户决策：token/组件推广和例外 owner | open / ready-for-agent |
| [06 — 独立验收、回归和发布门槛](issues/06-decide-independent-acceptance-and-regression-gates.md) | `wayfinder:grilling` | 用户决策：PASS/FAIL/NOT VERIFIED 证据门槛 | open / ready-for-agent |
| [07 — 实施任务图与版本门禁](issues/07-synthesize-implementation-backlog-and-release-gates.md) | `wayfinder:task` | 可派发的纵向切片和版本顺序 | open / ready-for-agent |

票据创建会话不领取或关闭任何子票。用户选择和研究证据应写入对应票的独立 `comments/<ID>/...-resolution.md`，再更新地图的 `Decisions so far`。

## 使用方式

1. 先处理 01，冻结同状态截图和来源哈希；不要用旧截图或自动化 DOM 测量替代真实画面。
2. 依次处理 02–06。HITL 票一次只询问一个视觉/产品选择，结论写入 Resolution；没有结论时保持 `NOT VERIFIED`。
3. 只有 02–06 的合同成立后，才处理 07，把每条决策转换成实现文件 owner、真实主图旅程和回归报告路径。
4. 实现阶段另建功能目录或引用本目录，并在实现前更新新的 `DESIGN-COVERAGE.md`；不能把本规划票的 `ready-for-agent` 当作功能通过。

## 未决选择

- 0.7 完整观察是否作为生产默认视觉基线，还是继续只作可逆样板。
- 共享 token 在首页、策略 A 和 RecallWorkspace 之间的最小共同集合，以及 A 固定预算和复盘自然流的例外保留方式。
- 双截止在每个回放动作、Tooltip、列表、摘要和缩放入口上的不可见/可见边界与来源标签。
- 1440×900、1280×800/720、1024/980、760/759、600 和 390 宽度的密度取舍、滚动归属和长文本展示方式。
- 生产 SQL 保存/重开闭环、真实触摸/软键盘和导出字体一致性的验证顺序。

## 完成边界

本目录的“完成”只表示验收合同和实施顺序已得到用户决策并有可复查证据。只有后续实现任务在真实浏览器、真实主图和适用的隔离数据库中通过三道门槛，才能把产品功能票关闭；生产公共组件固化、远端 PR、合并和发布不由本目录自动触发。
