# 01 — 回放历史边界与推荐样板滚动归属

ID: strategy-visual-implementation-01
Parent: [策略台视觉验收与实施规划](../../strategy-visual-acceptance-plan-20261011/issues/00-map-strategy-visual-acceptance.md)
State: open
Status: implementation-ready
Assignee: /root
集成负责人: /root
Blocked by: 无
Priority: P0

## What to build / Scope

在真实 `RecallWorkspace` 边界上保证：

1. 完整历史查看中的普通阶段导航不会把未来游标写回全局回放上下文；返回回放后再选全局仍恢复进入历史前的市场/成交游标和 K 线数量。
2. 完整历史查看中切换周期仍显示完整行情、全部成交和最后成交之后的 K 线。
3. 推荐视觉样板在 1280×800 这类自然内容高超过视口的宽度上可以由文档垂直滚动；1440×900 和约 390px 仍保持现有图表优先布局、长中文和控件状态。

## Refs

- [0.7 视觉合同](../../strategy-visual-acceptance-plan-20261011/visual-contract.md)
- [主图复盘元素规范](../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)
- [项目开发流程](../../../docs/agents/development-workflow.md)
- [历史复现记录](../../../docs/verification/2026-09-20-recall-followups.md)
- [推荐样板 CSS](../../../app/components/design-prototype/recall-design-prototype.css)

## 允许写入的文件

- `app/components/recall/recall-workspace.tsx`
- `app/components/recall/recall-workspace.test.tsx`
- `app/components/design-prototype/recall-design-prototype.css`
- 本 issue 目录和 `evidence/`

不得修改业务数据库，不得以静态 mock 取代真实图表路由，不得把首页布局比例复制到复盘页。

## 用户旅程与验收

- [x] 从回放边界进入“完整历史”，普通决策导航在历史模式被禁用，handler 也拒绝绕过 UI 的普通选择。
  - 证据：`recall-workspace.test.tsx` 的 `does not let full history overwrite the global replay context`，focused suite 通过。
- [x] 完整历史切换到 1W 后仍有 `fill-3` 和完整历史 K 线。
  - 证据：`keeps all full-history candles and executions when changing timeframe`，focused suite 通过。
- [x] 推荐样板 1280×800 可从 `scrollY=0` 滚至 `scrollY=600`，下方计划区可见，横向溢出仍裁剪。
  - 证据：[真实浏览器矩阵](../evidence/2026-10-11-browser-matrix.md)。
- [x] 1440×900 保持 chart `832×698`、plan `320×698`、14px 间距语义；390px 保持 chart shell `374×889`、chart stage `328×720`、plan `374×534`。
  - 证据：[真实浏览器矩阵](../evidence/2026-10-11-browser-matrix.md)。
- [x] 阶段选中态和键盘焦点态有实际浏览器计算值及命中区证据。
  - 证据：[真实浏览器矩阵](../evidence/2026-10-11-browser-matrix.md)。
- [ ] 完整主图旅程包含 Text、回看早期、保存/重开，并在 SQL 隔离库中完成一次真实持久化验收。
  - 状态：`NOT VERIFIED`，本切片只做回放状态安全与视觉滚动修复。
- [ ] 真实触摸、软键盘、导出字体、所有策略台场景和远端集成。
  - 状态：`NOT VERIFIED`，不属于本切片。

## 反例与证据

- 反例：历史模式点选第二条决策后返回回放，再点全局总结，未来成交仍出现。测试现在锁住该路径。
- 反例：历史模式切到 1W 后横幅宣称完整历史，但最后成交之后的 K 线消失。测试现在锁住该路径。
- 反例：1280×800 页面自然高约 1500px，但 `body` `overflow:hidden`，计划区无法通过页面滚动到达。浏览器矩阵记录修复前后值。

## 完成状态

实现与局部验证完成，保持 `open / implementation-ready`，等待独立整页视觉与完整功能门槛验收；不得据此关闭地图或声明生产发布完成。
