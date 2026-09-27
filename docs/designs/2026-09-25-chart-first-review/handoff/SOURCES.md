# 风格与业务证据索引

核对日期：2026-09-25。源仓库 TradeReview，基线 b166d5626c72f2e0a4a7be98d89eb28bf1a036f3。下列为仓库相对路径；交付包只包含设计资料，不复制产品源码或交易数据库。

| 证据 | 仓库位置 | 本期继承内容 |
| --- | --- | --- |
| 全局样式 | app/globals.css | 深蓝灰表面、蓝色选中/焦点、圆角和应用响应式 |
| Recall 样式 | app/components/recall/recall.css | 顶栏、输入、指标、保存与导出对话框 |
| 字体 | app/layout.tsx | Geist Sans / Mono |
| 图表 | app/components/chart/replay-chart.tsx | 网格、坐标轴、用户显示与配色设置 |
| 配色定义 | app/lib/storage/chart-settings.ts | teal-red / green-red / blue-orange；保留已存设置 |
| 工具栏 | app/components/chart/drawing-toolbar.tsx | Lucide 图标及已有工具 |
| Text | app/lib/chart/text-geometry.ts | 字号、行高、尺寸与既有用户样式 |
| Recall 文档 | app/lib/recall/types.ts | 回合/决策/快照、行情与成交双游标、版本 |
| Recall 工作区 | app/components/recall/recall-workspace.tsx | 现有主流程接入点 |
| 旧计划 / 指标 | app/lib/reviews/types.ts / review-metrics.ts | 自由文本、手填风险与现有指标边界 |
| 回放 | app/lib/replay/recall-replay.ts | 只揭示可知且已完成的 K 线 |
| 持久化 | app/lib/recall/server-repository.ts | SQLite 与版本检查 |
| 保存契约 | app/api/storage/recall/route.test.ts | 复用已有集成切面 |
| 导出 | app/lib/recall-export/manifest.ts / export.test.ts | 已留存内容与现有 Markdown/图片导出 |
| 主路径测试 | app/components/recall/recall-integration.recall-review.test.tsx | 现有工作区用户流程 |

背景快照：[领域词汇](references/CONTEXT.md)、[指标口径](references/TRADING-DOMAIN.md)、[旧 Recall 规格](references/EXISTING-RECALL.md)、[项目工作流](references/WORKFLOW.md)、[任务跟踪](references/ISSUE-TRACKER.md)。早期规格与当前运行代码有差异时，本期最终需求明确说明选择，不能从历史资料静默推翻。

demo 无外部资源：自绘 SVG 蜡烛、线性图标、系统字体后备。正式实现复用现有图表/绘图组件、应用字体和 Lucide。浏览器校验图见 [手机侧栏](images/mobile-review.png)。
