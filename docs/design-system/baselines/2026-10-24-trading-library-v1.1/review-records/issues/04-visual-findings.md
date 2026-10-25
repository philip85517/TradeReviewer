# 04 — 图稿视觉复验

ID: V11-04
State: closed
Status: accepted（保留此前 acceptance-failed 记录）
Assignee: v11_frames
集成负责人: root

## Scope / What to build
修复独立视觉比较发现的信息入口与窄版表格边界问题。只改 V1.1 图稿生成器及其 SVG 输出。

## Refs
[设计矩阵](../DESIGN-COVERAGE.md)、[独立验收](../INDEPENDENT-ACCEPTANCE.md)。

## Blocked by
02 图稿初稿已完成，最终整包验收依赖本票复验。

## 问题与验收
- [x] 趋势信息图标与标题重叠：按标题宽度布局并留8px；最终统计截图通过。
- [x] 信息入口问号与 E 信息i不符：统一信息i；最终统计截图通过。
- [x] 分布按钮贴副标题：副标题、图表起点及面板底边同步下移；最终统计截图通过。
- [x] 1280列表状态列越出卡片约8px：表头/数据右对齐到卡片内边1232；最终accepted-paged-*经root与独立审查直接查看通过。
- [x] 实盘分镜硬编码11行覆盖正式每页6笔：恢复fixture navigation的page_size及分页，保留E原型固定11行作为视觉样例。

## 验收证据
旧问题和复验保留在 [独立验收记录](../INDEPENDENT-ACCEPTANCE.md)；截图在 screenshots/final-*，最后窄版修正使用 accepted-*，不覆盖失败证据。

最终复验：6个指标/分页检查与5个母版检查通过；独立验收IA-02/03/04关闭。最终截图使用accepted-paged-*，失败截图保持原样。[完整证据](../INDEPENDENT-ACCEPTANCE.md)。
