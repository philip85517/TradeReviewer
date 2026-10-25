# 08 — E 方案全站视觉对齐与模拟盘环境提示
ID: E-REFINE
State: closed
Status: accepted
Assignee: root (集成；原实现 e_refine_impl / gpt-5.6-luna)
集成负责人: root

## Scope / Refs
见 ../e-refinement/DESIGN-COVERAGE.md，E01–E08。新建 navigation-e-prototype.html；保留旧 D/E、正式图稿、评论。
## Blocked by
None。用户已经选择 E。
## 验收标准
- [x] 七项请求及相邻交互回归通过，版本绑定 browser-evidence.json。
- [x] root 浏览器功能与状态链；独立 e_independent_acceptance 同态截图对比，见 acceptance.md。
- [x] 可点击预览、服务运行、启动说明。
## 派发
唯一 UI owner Luna；允许写新 HTML、e-refinement/IMPLEMENTATION.md。不改其他文件，不再派代理。报告新增说明实例与自测。root 保存独立证据。
## 历史
2026-10-24：用户选E后建票；旧 D/E 验收记录保留。

2026-10-24 首轮独立验收 FAIL，见 e-refinement/first-failure.md；已交回 Luna 修正。最终门槛尚未通过。

最终签署：当前hash通过，详见 [验收记录](../e-refinement/acceptance.md) 与 [独立视觉审查](../e-refinement/INDEPENDENT-ACCEPTANCE.md)。原派发所有权已于第三次失败后移交root，原历史不删除。
