# 架构记录

- [全市场行情架构审查与深化候选（待选择）](0005-market-platform-architecture-review.md)

本目录记录 TradeReview 的架构回溯和可视化资料。当前入口是：

- [0001：当前架构回溯记录](0001-current-architecture.md)
- [当前架构交互图（HTML）](architecture.html)
- [当前架构图规格（JSON）](architecture.json)
- [架构图验证回执](verification.md)

`0001-current-architecture.md` 描述 2026-09-21 的代码实现状态，不是一次新的架构批准或未来路线承诺。架构图是同一份回溯的可视化摘要；当代码边界变化时，应同时更新 ADR 和图规格。

## 行情模块展开

- [0007：长桥、AKShare、富途 Skill 与行情源可用性研究](0007-provider-skills-feasibility.md)
- [0006：行情数据模块边界](0006-market-data-module-boundary.md)
- [0002：行情获取、缓存与数据源交互](0002-market-data-flow.md)
- [0003：行情源可用性、口径核验与优先级建议](0003-market-source-validation-and-priority.md)
- [0004：固定行情源优先级与 1H 时间口径](0004-fixed-provider-priority-and-bar-normalization.md)
- [整体调用时序图](market-data-flow.html) · [JSON 规格](market-data-flow.json)
- [数据源交互与降级时序图](market-provider-interaction.html) · [JSON 规格](market-provider-interaction.json)
- [行情图验证回执与启动方式](market-data-verification.md)
