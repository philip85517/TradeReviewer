# 独立行情入口验收

状态：首期已验收（2026-09-22）；最新结果见末尾。

## 环境与安全

- 工作树 `/Users/zhoulin/.codex/worktrees/1cd8/TradeReview`，起点 `07f86b8`，保留之前未提交的架构文档和任务记录。
- Node v26.0.0；复用 ccc5 工作树已安装依赖的符号链接。
- 原工作树没有 `.data` 数据库。验收独立库 `.scratch/market-data-platform/preview.sqlite`，只有两笔人工样本成交。
- 服务 session 85153，端口 3017 已占用，vinext 自动选择 3018；未停止占用服务。当前预览 http://127.0.0.1:3018/ 。
- 启动：`TRADEREVIEW_DB_PATH="$PWD/.scratch/market-data-platform/preview.sqlite" npm run dev -- --hostname 127.0.0.1 --port 3018`（确认端口空闲）。
- 样本交易内容摘要见 `preview-baseline.json`，完成后核对。

## 基线

`npm run test:unit -- app/lib/market/sync-service.test.ts app/lib/market/intraday-sync-ranges.test.ts app/components/trade-review-workspace.refresh.test.tsx --maxWorkers=2`

3 个文件 / 28 个测试通过；日志 `baseline-tests.log`。Node module.register 废弃提示是环境警告。

## 首期验收清单

- [x] 独立模块成功/失败/取消/覆盖读取/旧周期行为测试。
- [x] 页面接入，UI 不再直接编排两个低层同步器。
- [x] 协调者独立审查与独立代码审查。
- [x] 全量单测、类型检查、构建。
- [x] 浏览器隔离样本刷新、页面错误和桌面/窄屏检查。
- [x] 样本成交原始字段指纹未变；真实交易库未使用。

## 已知边界

不实现每市场三源策略、口径转换、历史数据修复、持久 worker 或研究快照。本轮浏览器刷新只是独立入口的接入验收，不用于给供应商打质量分。

## 中途验证（保留失败证据）

- 首次全量单测：`npm run test:unit -- --maxWorkers=2`，218 个文件通过、1 个失败、2 个跳过；1913 通过、1 失败、5 跳过。失败为 workspace 在首次刷新未结束时立刻寻找第二次刷新按钮。日志 `full-unit-tests.log`；正在修复并复验，未据此宣称全量通过。
- 首次构建：`npm run build` 通过，日志 `build.log`。现有 OpenCV crypto 浏览器 externalization、较大 bundle、vinext 部分路由无法静态分类提示保留。
- 构建后运行时：`node --test tests/rendered-html.test.mjs tests/local-dev-storage.test.mjs tests/focused-review-ui.test.mjs`，5/5 通过，日志 `runtime-tests.log`。
- 浏览器首次样本刷新：1 个标的 partial，日线 complete，小时 partial；独立库 279 daily / 35 hourly。取消按钮因任务已完成而消失，本次不作为取消路径通过证据；取消由行为/现有批量集成测试验收。
- 独立审查提出：联合 provider/coverage 错误显示优先级、硬失败区间丢失、DOMException 数字 code 污染诊断；均交回实现者修复。
- 独立复审确认 P2 均已解决，未发现新的重要问题。workspace 原失败按正确等待首次刷新完成后重测，71/71 通过。
- 样本首次刷新后完整 API 对象摘要有变化，因为原有元数据刷新增加了 `instrument.localizedName` 显示层。移除此新增显示字段后，与原始两笔样本摘要完全一致；`preview-after.json` 记录核对结果。不将完整 API 对象变化隐瞒为“完全未变”。

## 最终验证

- 全量 `npm run test:unit -- --maxWorkers=4`：220 文件通过 / 2 跳过；1919 测试通过 / 5 跳过，165.47 秒，退出 0。`final-unit-tests.log`。
- 协调者单独运行新入口两份测试：14/14 通过，`final-service-tests.log`。最后新增异常测试的构造参数顺序被最终 typecheck 捕获，已修正；保留失败于 `final-typecheck.log`，不以 Vitest 运行通过代替类型检查。
- 最终构建 `npm run build` 退出 0，`final-build.log`。运行时 5/5 通过记录见上。
- 浏览器最终验证使用同一隔离预览：首次刷新完成；开发热更新中断第二次操作后，页面显示未完成任务，通过“恢复未完成行情”恢复至 partial，未完成数归零；缓存仍在。当前小时线仍有 5 段缺口，错误详情有来源/区间，不算上游完全可用。
- 最终测试库有 279 日线、72 小时线；交易 2 笔原始字段摘要仍与初始一致。完整任务诊断保存在 `preview-final.json`。
- 桌面 1440×900、窄屏 390×844 无横向溢出；浏览器 error 日志为空。临时 viewport 已重置，预览页已标记保留；服务 session 85153 继续运行。
- 未提交、推送、合并或发布。真实交易库从未打开。后续来源/时间戳问题保持明确待办，不在本期猜测性修正。
- 协调者最终 `npm run typecheck` 退出 0：`coordinator-typecheck-confirmed.log`；变更文件 ESLint 退出 0、0 错误，6 个既有 workspace 警告，`final-lint.log`；`git diff --check` 通过。
