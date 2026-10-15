# 复盘浏览器验收观察工具

`review-harness.mjs` 提供三个独立观察边界；不操作浏览器、启动服务或写数据库。浏览器适配器必须使用公开鼠标/键盘操作，只读当前页面、图表 SDK 和隔离 SQL。修复依据与实际证据见 [Task20](../../.scratch/review-clean-r1-implementation-plan-20261011/evidence/20/ACCEPTANCE.md)。

运行自检：`npm run test:acceptance-harness`（等价于 `node --test scripts/acceptance/review-harness.test.mjs`）。该 Node 原生测试文件被 Vitest 明确排除，避免把原生 `node:test` 用例误当作 Vitest suite；常规 `npm test` 也会显式执行此自检。

| 接口 | 调用规则 | 失败边界 |
| --- | --- | --- |
| `jsonSafe(value)` / `serializeRows(rows)` | 公共 serializer 是单参数；共享对象完整保留，只有当前递归路径的回边标记 `[Circular]`。非空真实 SQLite 行必须测试 | 不接受非数组 rows；不要依靠空查询证明序列化有效 |
| `waitForWorkspaceReady(read, expectedEpisodeId, options)` | 唯一可见工作区、无加载/错误、唯一可见回合 selector，UI/document/canvas 精确同 ID，SDK 与恢复条件皆为 true，才放行。默认 20 秒预算、100ms 轮询 | `LOAD_ERROR`、`HARNESS_ERROR`、`IDENTITY_MISMATCH`、`LOAD_NOT_READY`；保留轨迹和最后观察。超时按最后状态分类 |
| `selectExactDrawing({read, neutralize, click, expected, ...options})` | 记录前态，公开取消并证实 null，再原生点击；之后核对 ID、tool 和 episode。默认 2 秒预算、50ms 轮询 | `SELECTION_NOT_TARGET` 等失败必须终止依赖的编辑/拖动；截图同时记录 intended/actual ID |

完整观察字段和输入接口见 [PLAN](../../.scratch/review-clean-r1-implementation-plan-20261011/evidence/20/PLAN.md)。`read()` 观察缺失应报工具错误，不能把取不到内部值当作匹配。就绪适配器还需定义当前阶段有效的截止与恢复条件；Task20 的 observer 只实测所用 S1/S2 样本，不能直接继承到 S0 空成交状态。

已完成初开身份验证后的响应式 resize 可另行验证连续性，必须记录完整前置通过证据、三处身份、图表就绪与实际隐藏控件。这不允许放宽首次打开/重新打开的完整就绪合同。

验收文件以每次运行的唯一 ID 命名。运行起止绑定产品和工具 SHA，任何源码变化使该次证据失效。SQL 前后、SQL→恢复画布、SQL→实际 SDK 都要比较；同态视野数值使用已批准验收容差，不能对整份含浮点布局缓存的 JSON 要求字节相等。

工具行为通过与产品旅程通过分别报告。一个没有预期 preview 的断言只证明观察失败，未经诊断不能单靠错误代码断定是产品实现、命中位置或观察适配器故障。停止后的动作明确标 `NOT VERIFIED`。历史 runner、原始 FAIL 和原始证据保留；新 helper 不自动迁移或放行全部历史脚本。
