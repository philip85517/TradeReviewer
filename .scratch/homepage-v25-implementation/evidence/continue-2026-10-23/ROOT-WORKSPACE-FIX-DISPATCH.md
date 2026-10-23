# 普通库就绪等待链：root 修复裁定与派发

2026-10-23 05:34 CST。承接 workspace-diagnostic/REPORT.md（9e0842ff…）；root 已完整阅读并独立检查 all daily Promise.all → initialized → ordinaryLibraryKey → TradeLibrary mount。99 项 88 PASS/11 FAIL 保留。P1 第三候选准备修复；正式仍 2/3 FAIL，不重置轮次。

## 裁定

普通交易集合和准确 catalog 需要同代 fresh bootstrap，不以首页全部标的 daily 或 FX 成功作为就绪前置。首页金额 bundle 仍按原合同原子接收，不用旧 seed 或部分市场值发布首页新范围。可以明确读取意图/结果边界，不添加第二份 committed scope，不取消 generation/source 校验。

晚到行情只更新它拥有的 instrument/cache，不替换用户已选择、已编辑的 review state、phase、双 cutoff 或 pending restore。准备数据与进入回放不隐式选择首回合。FX 故障保留诚实状态和恢复路径，不伪造值。

## Owner / 允许写入

`/root/workspace_integration`，实际 gpt-6.1-sol / ultra；root 负责整页视觉、数据流及独立验收。独占 app/components/trade-review-workspace.tsx/同名 test、app/components/homepage-v25/use-homepage-host.ts/同名 test；确需并报告理由时可扩 session-model.ts/同名 test。不得改 S/F/ledger/series/surface/CSS/library 或 tracker。证据限 workspace-fix/。无子代理、DB/browser/service、性能或全仓 suite 操作。

先保留并运行原 pending saved intraday、unrelated-stock blocking RED；追加 late completion 不覆写 selected replay/state 的因果反例。单候选修复，不提前 resolve、不延长等待、不调计数。可按报告修正 #1/#2/#5 的 owner/阶段增量、#6–8 的故障 endpoint 并加独立 FX 故障反例、#9 region ready；所有后置业务断言必须执行。#10/#11 未实现附件/期间/日历不删除或 skip 来制造全部通过，先交迁移 proposal。

## 原始设计 / 覆盖 / 独立接受

先重读 docs/agents/development-workflow.md、task-decomposition.md、ui-task-templates.md、frontend-control-audit.md；原规格 docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md HP03:113–190、HP04:295–316、HP06:436–448、HP09:467–514，直接查看同目录 images/holding-return.svg、search-detail.svg。DESIGN-COVERAGE：HV25-09/10/23/24/27/29/31/53/55。原回放双截止、未来信息与视野沿当前 workflow。

root 实际 browser：冷普通库在无关 daily pending 时可选准确回合；迟到行情不改 saved timeframe/cursor；home 详情→普通集合→fresh 返回恢复；FX 故障/恢复、取消/晚响应；1440×1000、1280×800、390×844 受影响入口/状态。写入限既有隔离库；mouse/keyboard/touch 分开，组件测试不替代真实图表、视觉、持久化。

交付仅 implementation-ready，含 RED/GREEN、精确变化、余留 FAIL/NV 和 hashes。正式第三轮由 root 单独宣布；必需门未通过不得 accepted。
