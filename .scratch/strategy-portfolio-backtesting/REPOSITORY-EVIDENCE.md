# 规格的仓库依据

核对日期：2026-09-29。仅阅读源码/文档，没有读取交易数据库或向行情供应商请求数据。

| 结论 | 依据 |
| --- | --- |
| 策略导航未开放 | [工作区导航](../../app/components/trade-review-workspace.tsx)，策略按钮 disabled，文字“未开放” |
| 公共行情边界可复用，但不足以保证严格历史回测 | [ADR 0006](../../docs/adr/0006-market-data-module-boundary.md)、[公共行情服务](../../app/lib/market/market-data-service.ts) |
| 不照抄旧的供应商最小集合或统一时间偏移决策 | [ADR 0004 审查提示](../../docs/adr/0004-fixed-provider-priority-and-bar-normalization.md)、[ADR 0005](../../docs/adr/0005-market-platform-architecture-review.md) |
| 当前统一日线契约是 OHLCV，不含通用历史成交额/市值/财报契约 | [行情 contracts](../../app/lib/market/contracts.ts)、[元数据 contracts](../../app/lib/instruments/metadata-contracts.ts)；个别 provider 有 amount 并不等于统一契约已提供 |
| 可复用可知时间与证券历史身份工作，但仍需核验研究证据 | [行情 types](../../app/lib/market/types.ts)、[历史证券身份](../../app/lib/instruments/historical-instrument-identity.ts) |
| 模拟运行已有统计身份 | [交易 types](../../app/lib/trades/types.ts)：simulationRunId、tradeNature、分组身份 |
| 沿用净盈亏/浮盈亏等领域术语，新增组合净值不冒用现有收益率 | [领域词汇](../../docs/specs/2026-09-19-trading-room-domain.md) |
| 存储、回放与行情有测试先例 | [行情集成](../../app/lib/market/market-data-service.integration.test.ts)、[SQLite 仓库](../../app/lib/storage/sqlite-repositories.test.ts)、[仓位账本](../../app/lib/replay/position-ledger.test.ts)、[回放引擎](../../app/lib/replay/replay-engine.test.ts)、[复盘流程](../../app/components/review/focused-review-flow.test.tsx)、[真实图表组件测试](../../app/components/chart/replay-chart.recall-review.test.tsx) |
| 本地任务发布规则与实现验收规则 | [tracker](../../docs/agents/issue-tracker.md)、[开发流程](../../docs/agents/development-workflow.md)、[拆票](../../docs/agents/task-decomposition.md) |
| 平行 worktree 共享正式业务库；测试必须显式隔离 | [配置规则](../../conf/README.md) |

## 本轮文档验证范围

规格覆盖 R01–R06，标记建议默认值；保留七个 to-spec 正文栏目；明确当前缺口和后续实施验证，不声称新功能已完成。检查本轮新增 Markdown 相对链接指向真实文件、需求 ID 与页面 ID 完整、任务状态一致。未执行产品测试：本次仅文档，不能以产品测试替代规格审阅。
