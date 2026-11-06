# 历史成交性质协议修复

Spec: docs/specs/2026-09-07-tradingview-simulated-trade-import.md（数据模型与历史兼容）；docs/superpowers/specs/2026-09-10-focused-review-design.md §1（scope/episode ID稳定）。
授权：2026-10-24 用户“首先解决2的接口协议问题”。

## 全局约束
- 只统一性质合同；财务 P1/F07、Bars 暂停3/3，不恢复金额、性能、采集发布实现。
- 原始source/SQL行不改，持久scope、episode ID及原成员不变；共享业务性质与历史身份作用分开。
- 显式unknown不升级；已知解析器精确(platform, formatRuleId)且非空fileFingerprint、无模拟/截图冲突才能兼容live。人工IPO无可审计生成合同，保留unknown。
- 不改公式/费用/行情/超时预算，不伪造complete；有mixed unknown/live的历史回合不能按首笔升级。
- user指定gpt-6.1-sol ultra；root独立验收，最多3轮候选，超限暂停并保留原因。
- 当前隔离worktree detached HEAD 58bf0d9，保留既有dirty工作；不提交/推送。

## Task 1 — 共用证据解析与历史身份分离（Sol实现）
RED：历史受支持券商有指纹/规则时，新旧性质一致live；unknown、未知规则、无指纹、模拟冲突、截图、人工IPO保持隔离；显式live/simulation及旧TradingView回合不回归。
GREEN：新增resolvedTradeNatureOf共享业务解析；保留tradeNatureOf/tradeScopeKey原身份语义，simulationScope原排序/ID合同独立冻结；episodes/library身份key仍用旧合同，episode/library业务性质从全部成员一致解析，混合保留unknown。首页/现金/来源完整性/actual-metrics业务读取改用resolved helper；sqlite写入、对账、迁移、TradingView资格保持原declared读取。精确接口由实现者在不突破上述约束下选择。
文件范围：app/lib/trades/{types.ts,trading-nature.ts,nature-resolution.ts,episodes.ts,library.ts}、app/components/homepage-v25/{attachment-groups.ts,holdings-model.ts}、app/lib/reviews/homepage-v25-performance.ts、app/lib/cash/cash-model.ts、app/lib/import/statement-evidence.ts、app/lib/recall/actual-metrics.ts及对应test；直接受性质影响的业务读取消费者（shared-scope/review-queue/library-performance/library-sorting/dashboard/workspace）可仅调整性质读取与身份分离，禁止无关行为重构；新增范围必须列入报告并由root复核。其他产品文件不得修改。新增文件可不创建如果无需。
行为测试涵盖homepage attachment/holdings/performance消费者，无公式更改；必要额外test文件须先说明。
报告evidence/IMPLEMENTATION.md，记录RED/GREEN命令与结果。

## Task 2 — 独立集成验收（root）
先冻结实际1868成交全episode ID→成员基线与SQLite逻辑摘要；修复后同数据逐项比较。
集中相关回归、tsc/lint/build，独立代码与规格审查；build前确认4392服务所有权并隔离新运行数据。
桌面1440×1000：普通库live、simulation、unknown，首页范围库live，返回/刷新；首页仍超时则独立记录，不用其失败掩盖分类修复也不称完整首页完成。
参照既有布局与截图 .scratch/homepage-data-diagnosis-2026-10-24/legacy-live-trades.jpg、home-scoped-trades.jpg；无CSS变化，root负责整页视觉与数据链。
Preview新鲜浏览器检查并保持运行，最终列出启动方式和剩余阻塞。
