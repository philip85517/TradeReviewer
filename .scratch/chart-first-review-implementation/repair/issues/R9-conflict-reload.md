# R9 — 冲突后显式重载同步计划表单

ID: R9
State: closed
Status: accepted
Assignee: luna_r7_layout (`gpt-5.6-luna / max`)
集成负责人: root；独立审查 Astra (`gpt-6-astra / low`)

## Scope / Refs

E10/E20，US29–30。依据 [主规格](../../../../docs/specs/2026-09-25-chart-first-review-ui.md)、[元素表](../../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)、[02主图](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)、[07错误状态](../../../../docs/designs/2026-09-25-chart-first-review/07-interaction-states.png)。仅修复保存冲突后用户显式载入最新版本时，计划表单缓存与新文档不一致。

## Blocked by

None。R8 生命周期缺陷已局部闭环，不影响此独立保存路径。

## 复现与验收

- 2026-09-27 root 真实浏览器 A3049 / B3051 共用显式合成隔离库，999999 同时加载计划数量1100；B写1200并正常保存；A写1300收到真实服务器409，输入1300保留、服务端仍1200。
- A点击“重新载入”后错误消失、草稿显示无未保存修改，但数量1300/风险5200仍留在计划表单。[原始失败图](../reports/R8-real-conflict-1300.png)。不能称冲突恢复已通过。
- [x] 显式载入后显示服务端1200及匹配风险4800；不残留旧1300覆盖层。
- [x] 重新编辑并保存后重开正确，无过期CAS或覆盖其他新字段。
- [x] 普通行情hydrate及500保存失败继续保留未保存的本地输入。
- [x] root 最终构建真实双窗口重走；Astra 独立复核证据。

## 文件所有权

Luna 仅修改 recall-workspace.tsx / recall-workspace.test.tsx 及必要独立回归文件；不修改数据、其他产品文件或运行全量/build。root 负责集成构建、浏览器、矩阵与最终记录。

## 历史

2026-09-27 真实故障验收发现并新建；已有自动化输入保留通过不覆盖显式重载路径。

## root限定接受

2026-09-27 最终双窗口已验1400/69重载正确、二次1300保存保留69，并恢复1000/68；本票限定接受，整体仍未接受。详[R9集成](../reports/R9-integration.md)、[Astra](../reports/R9-astra-review.md)。
