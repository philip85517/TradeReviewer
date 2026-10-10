# 基线契约与设计覆盖矩阵

ID: review-visual-baseline-contract-20261011
Parent: [TradeReview 复盘视觉基线：开发与独立验收路线图](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root

## Scope / What to build

把现有 `2026-10-10` 视觉基线、用户已确认修复契约和前端控件审计要求整理成单一可执行输入，不修改产品代码、业务数据库或既有基线报告。交付三份派发前文档：

1. [设计覆盖矩阵](../DESIGN-COVERAGE.md)：每个视觉元素、动作、阶段、失败/取消状态都有 elementID、准确参考、owner、任务、反例和证据位置。
2. [状态与回放转移契约](../STATE-TRANSITIONS.md)：分离市场/成交截止，覆盖 S0/S1/S2、下一根、播放、下一笔决策、回看、末尾、Text 和保存失败。
3. [控件审计范围](../CONTROL-AUDIT-SCOPE.md)：公开控件全集、重复规则、输入方式、断点、证据和排除项。

## Refs

- [2026-10-10 视觉基线](../../../docs/design-system/versions/2026-10-10/README.md)
- [问题修复契约](../../../docs/design-system/versions/2026-10-10/design-contract.md)
- [基线设计覆盖](../../../docs/design-system/versions/2026-10-10/DESIGN-COVERAGE.md)
- [项目拆票标准](../../../docs/agents/task-decomposition.md)
- [前端控件与视觉空间审计标准](../../../docs/agents/frontend-control-audit.md)

## Blocked by

None.

## 验收标准与反例

- [ ] 逐项反查用户已确认规则：紧凑框架、S0/S1/S2、两种截止、计划/实际/批注来源、Text 价格锚点、双点预览、1:1、选中反馈、保存边界；没有用“优化层级”这类不可测表述代替。
- [ ] 每个范围项都能追到一张准确参考图/章节、一个任务和一个证据位置；未有画面证据的内容明确写 `NOT VERIFIED`。
- [ ] 状态表能说明动作前、动作中、完成/取消后的可见 bar、成交、未来信息来源、视野和持久化；反例包含 mock 状态变化但真实图表不变。
- [ ] 控件登记覆盖常驻、条件出现、更多菜单、图表热点、键盘入口和 disabled/错误状态；动态实例边界和分母公开。
- [ ] 纯文档校验通过：相对链接存在、引用路径有效、无业务代码/数据库变化；不以文档完成推断功能或视觉通过。

## 验收证据

- 文档差异：本目录三份文件的链接检查和逐行覆盖检查。
- 范围声明：版本、服务、数据、视口、输入方式、排除项和 `NOT VERIFIED` 分母。
- 浏览器/数据库/视觉：`NOT APPLICABLE`，因为本票只建立契约；后续票必须按此矩阵执行真实检查。

## 派发说明

- 允许写入范围：仅本目录的 `DESIGN-COVERAGE.md`、`STATE-TRANSITIONS.md`、`CONTROL-AUDIT-SCOPE.md`；不得改 `app/`、`conf/runtime.json`、共享数据库和历史报告。
- 输入：现有基线和规范；输出：可引用的 elementID、状态行、验收反例和证据路径。
- 共享文件唯一 owner：root 负责跨票合并；实现者不得自行删除未验证项或缩小范围。

## 历史

- 2026-10-11：创建，等待执行。
