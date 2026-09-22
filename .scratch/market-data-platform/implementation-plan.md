# 独立行情模块：首期实施

用户于 2026-09-22 指示“推进开发”。在已确认的独立模块方向上开始可逆重构；决策地图中的质量阈值、来源组合和版本迁移仍保持未决，不冒充用户已回答。

## Global Constraints

- 不修改原始交易数据、数据库结构、现有来源优先级或未经核验的时间戳/复权/成交量转换。
- 同一个证券通过一个应用入口同步 1D/1H，独立失败不能丢弃另一个周期的成功结果。
- 取消必须传播；刷新失败保留已有数据；无法得到 1H 时保留可用旧 15m 数据。
- 数据获取成功与质量口径已核验是不同状态，不宣称研究级质量。
- UI 继续负责显示消息、证券元数据和用户任务状态；模块负责行情编排、覆盖读取、缓存回退与结构化诊断。
- 不推送、合并、发布；使用当前隔离 worktree，本地任务记录保留。

## Tasks

1. Luna：建立 `app/lib/market/market-data-service.ts` 公共入口和行为测试；接入 workspace，删除重复编排逻辑。允许修改该模块及其测试、workspace 和直接关联测试。模块请求包含证券身份、dailyRange、hourlyRanges、previous、repository、fetcher、signal 和刷新选项；输出 daily/hourly 数据、coverage、status、error、source、requestedRanges 及刷新诊断。调用现有低层同步器；不新增 provider 抽象。先测试再实现。
2. 协调者：审查实际 diff，补充模块边界/未决事项文档，独立运行相关测试、类型检查、构建和回归。必要问题交 Luna 修复。
3. 独立审查代理：审查最终生产变更和测试覆盖，协调者裁定并验收。

## Shared interfaces / conflicts

生产文件由同一 Luna 负责，避免入口契约与 UI 并行冲突；协调者仅写任务记录和 ADR。诊断不新建持久化 schema。本期覆盖 existing supported markets，扩展市场以现有 SupportedMarket 边界为准。

## Progress

- 环境：既有隔离 worktree，原有文档修改保留；依赖复用 ccc5 worktree 的 node_modules。
- Task 1: complete，Luna 完成日线/小时线编排与页面接入，新增 14 项入口行为/集成测试。
- Task 2: complete，协调者首次全量发现测试等待时序问题，修正后最终全量 1919 通过、5 跳过；最终类型、构建、变更文件 lint 和浏览器复验通过，日志见验收记录。
- Task 3: 独立审查两项 P2（联合错误展示、DOMException code）已修复并复审接受，见 `code-review.md`。
- 首期以最小可逆模块边界落地；未解决的供应商策略与口径规则仍保留在地图，不自动关闭。
