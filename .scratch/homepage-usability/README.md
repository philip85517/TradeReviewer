# 首页与交易复盘易用性改进

来源：当前对话的页面审查；基线 `f2361fb`。用户已确认任务拆分，并选择本地 Markdown 跟踪。

任务 01–09 已在本地实现。验证结果与工具环境边界见 [验收记录](verification.md)。

## 工作任务

| 编号 | 任务 | 优先级 | 阻塞 |
| --- | --- | --- | --- |
| 01 | [恢复窄屏下的导入与股票切换入口](issues/01-responsive-import-navigation.md) | P1 | 无 |
| 02 | [从交易库进入复盘时保留选定回合](issues/02-preserve-selected-episode.md) | P1 | 无 |
| 03 | [将空首页改为明确的导入引导](issues/03-empty-home-onboarding.md) | P2 | 无 |
| 04 | [提供适合大量股票的查找与筛选列表](issues/04-searchable-stock-list.md) | P2 | 无 |
| 05 | [突出当前回合与开始继续复盘操作](issues/05-replay-primary-actions.md) | P2 | 无 |
| 06 | [将复盘笔记改为单列分阶段填写](issues/06-staged-review-notes.md) | P2 | 无 |
| 07 | [在交易库直接提供导入与行情更新](issues/07-library-import-market-actions.md) | P2 | 无 |
| 08 | [往返页面时保留交易库浏览上下文](issues/08-preserve-library-context.md) | P2 | 02 |
| 09 | [提升现有页面文字与关键指标的可读性](issues/09-readable-text-and-metrics.md) | P2 | 无 |

## 执行约定

- 优先处理 01、02；其余无阻塞任务均可独立开始，08 必须在 02 完成后开始。
- 共同修改同一界面不自动构成阻塞；实施时协调，避免引入无关的大范围重构。
- 保持本地数据边界、导入确认、行情缓存和未来数据遮蔽规则；使用独立数据副本验证，不修改原始交易数据。
- 各任务自行完成必要回归与页面验证，不将质量检查集中到最后一个任务。
- 本轮覆盖入口、回合定位、查找、复盘控制、笔记、交易库衔接和可读性；不新增模式洞察、跨设备同步或独立记录系统。
