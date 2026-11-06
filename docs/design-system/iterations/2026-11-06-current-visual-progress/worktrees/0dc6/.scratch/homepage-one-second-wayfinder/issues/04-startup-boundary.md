# 首页启动如何隔离并保留进入交易库及返回旅程

ID: homepage-one-second-startup-boundary
Labels: wayfinder:grilling
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: HITL
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

基于生产基线和读模型合同，哪些初始化真正属于首页关键路径，哪些能在对应旅程按需启动？如何分离入口而不破坏已有筛选、进入交易库、返回、刷新及必要的复盘上下文？

## Scope

- 给出现状与候选依赖图，区分模块下载、挂载/effects、storage/bootstrap、aliases、财务读取、交易库entries、图表/导入等；用真实基线验证“移出关键路径”，不只增加lazy包装。
- 定义首页范围/导航状态及取消/代际边界；保留已批准入口语义、期间与最新持仓独立、搜索/附件入口及错误恢复。
- 启动收益与投影收益分别归因，导航后编译/解码/图表首帧仍计时；阶段预算只作定位建议，不能代替总门槛。
- 明确整页视觉负责人和完整数据/持久化流负责人，均由协调者集成；未来实施按不重叠代码所有权拆分，但票本身不是组件施工清单。

## Refs

- [当前共享工作区入口及启动研究](../../homepage-one-second-feasibility-2026-10-24/STARTUP-FEASIBILITY.md)。
- [首页入口](../../../app/home/page.tsx)、[交易库入口](../../../app/trades/page.tsx)、[当前工作区](../../../app/components/trade-review-workspace.tsx:2233)。
- [V2.5 设计正文](../../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)、[交易库设计（仅必要接线）](../../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md)。

## Blocked by

- [建立同源可比的生产导航基线与非零对照](02-comparable-baseline.md)
- [首页读模型与新鲜度的对外合同如何确定](03-read-contract.md)

## 验收标准

- [ ] 入口/读取依赖图、留在首页的必要工作与延后启动条件明确，有生产事实支持。
- [ ] 完整首页→交易库→返回/刷新等状态旅程表与控件范围可供独立验收，禁止用全量交易库改版替代接线。
- [ ] 保留批准桌面布局、密度、信息层级及关键状态，明确视觉与数据负责人。
- [ ] 用户实际取舍与协调者独立审查写入Resolution；不将设计接受写成启动提速已测得。

## 反例与证据

首页仍等全站bootstrap、路由拆分后仍运行所有effects、返回后范围丢失或旧响应覆盖新选择、缩小曲线/默认尺寸以过性能，均不接受。
