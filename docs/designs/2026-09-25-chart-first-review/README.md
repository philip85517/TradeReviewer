# 主图优先三阶段复盘 · 设计交付

2026-09-25 · 最终视觉 demo v1.0 · 已确认方案 A（按阶段侧栏）

[打开视觉 demo](index.html) · [完整开发规格](../../specs/2026-09-25-chart-first-review-ui.md) · [本地开发任务](../../../.scratch/chart-first-review-design/issues/01-chart-first-review.md)

## 画板

| 页面 | 内容 | 设计判断 |
| --- | --- | --- |
| [01 布局探索](01-layout-options.png) | 主图＋阶段侧栏、行内快改、临时底部表格 | 已确认 A，B/C 仅保留为探索记录 |
| [02 入场判断](02-chart-workspace.png) | 主图、绘图工具、计划侧栏与逐根揭示 | 价格轴位于图表与侧栏之间，不被覆盖 |
| [03 结构记录](03-structured-record.png) | 买入前计划与事后执行评价的阶段入口 | 表单嵌入对应阶段，图表始终在场 |
| [04 持仓过程](04-holding-stage.png) | 分批退出、心态补记与继承标注 | 新判断不覆盖旧快照 |
| [05 事后复盘](05-final-review.png) | 执行复盘侧栏、原计划、实际成交与结果 | 事后逐次评价退出，原计划只读 |
| [06 导出分镜](06-export-storyboard.png) | 三张阶段图＋一张总结表 | 同一观察窗口逐渐揭示，最终汇总全部数据 |
| [07 交互状态](07-interaction-states.png) | 输入、保存、失败与窄屏规则 | 设计约束供后续实现验证 |

阶段归组保留原来的交易回合、每次交易决策及其快照。未来实现将通过图上 Text 保存叙述，并将数字和枚举结构化写入数据库；详见完整规格。

## 预览与启动

在项目根目录执行：

```bash
python3 -m http.server 8853 --bind 127.0.0.1 --directory docs/designs/2026-09-25-chart-first-review
```

访问 [本机设计预览](http://127.0.0.1:8853/#stage1)。这是纯静态设计预览，不启动正式业务服务，不连接或修改交易数据库。如端口已由本次预览服务占用，直接打开现有入口；不要重复启动。

本轮演示的临时文字与数字编辑仅存在当前页面，刷新恢复合成示例。PNG 截图用于直接审阅；真正的服务端保存、绘图工具完整能力与 PPTX 导出属于后续开发范围。

设计包由 `index.html`、`design.css`、`design.js` 、`supporting-boards.js` 和 `theme.css` 组成，使用本地资源，无网络依赖。附加 `?board=1` 可隐藏文档导航用于图片画板展示，例如 `http://127.0.0.1:8853/?board=1#stage1`。七张最终 PNG 均为浏览器实拍的 1440×900 画板。

验收遵循[项目工作流](../../agents/development-workflow.md)，记录见[设计验收](../../../.scratch/chart-first-review-design/verification-v1.0.md)。

## v2 修订

买入前计划和事后执行评价不再放在同一张独立卡中。右侧栏参与布局并保留价格轴与分隔区，窄屏下置；阶段切换保留各自草稿。原成交只读，初始计划不会被事后评价覆盖。本轮依然仅为静态设计演示。

## v1.0 开发交付

用户已确认阶段拆分。本版按现有 TradeReview 深蓝灰、蓝色交互态及默认青涨红跌对齐，并补齐[元素规范](../../specs/2026-09-25-chart-first-review-ui-elements.md)。[完整交付阅读入口](handoff/index.html)包含需求、元素、demo、图片、开发任务与验收记录；源码与说明均可离线使用。
