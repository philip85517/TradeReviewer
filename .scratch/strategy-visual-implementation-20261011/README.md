# 策略台视觉首个实现切片 · 2026-10-11

本目录记录 0.7 视觉合同在真实复盘工作区中的首个实现切片。它承接
[视觉验收与实施规划](../strategy-visual-acceptance-plan-20261011/README.md)，
把回放状态安全、窄窗文档流和可复查的真实浏览器证据分开记录。

## 当前状态

- `State: open`
- `Status: implementation-ready`
- `Assignee: /root`
- `集成负责人: /root`
- `Blocked by: 无（首个切片以已批准的 0.7 合同为输入）`
- `Branch: codex/strategy-visual-implementation-20261011`
- `Preview: http://127.0.0.1:3070/?prototype=review-design&mode=recommended`

## 范围

本切片锁定两条真实缺口：完整历史查看不能污染阶段/全局回放上下文，且完整历史切换周期后仍须保留所有成交和最后成交后的行情；推荐样板在自然高度超过视口时必须允许页面垂直滚动。视觉样板继续复用现有主题、图表、绘图工具、计划侧栏和双截止文案。

不包含公共 token 全面迁移、生产 SQL 写入、远端推送/合并、触摸真机、软键盘和导出字体接受。

## 任务

- [首个切片：回放历史边界与滚动归属](issues/01-replay-history-and-scroll.md)

## 证据

- [实现覆盖矩阵](DESIGN-COVERAGE.md)
- [真实浏览器矩阵](evidence/2026-10-11-browser-matrix.md)
- [自动化验证日志](evidence/2026-10-11-verification.md)

## 接受边界

本目录当前只达到 `implementation-ready`：聚焦单测、类型、构建、变更文件 lint 和真实浏览器布局已有证据；完整 `npm run lint` 仍受仓库 `.scratch` 历史/第三方 vendor 文件的既有 lint 噪声影响，生产数据库写入/重开、真实触摸/软键盘和完整端到端图表旅程仍需后续独立验收。
