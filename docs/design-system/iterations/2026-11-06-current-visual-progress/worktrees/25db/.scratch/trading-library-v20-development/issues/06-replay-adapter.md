# 新回合身份怎样接入既有回放状态并安全重开？

ID: TL20-D06
Labels: wayfinder:task
Parent: [交易库 V2.0 完整产品落地决策地图](00-map.md)
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Resolution comment: 未产生

## Question

在现有 Recall/真实图表中核对双截止、Text 归属、暴露来源和持久化字段后，新主动回合与练习配对需要怎样的最小身份适配，才能保留已有草稿、快照和视野而不建立第二套复盘系统？

## Scope

只解决本问题或为其准备事实，不实施产品。已确认合同不重新投票；未决业务规则不能由实现者推定。AFK仅核对当前工作目录内事实并产出可审查契约；涉及用户政策另回HITL票。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L144–169
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L254–298
- [docs/specs/2026-09-25-chart-first-review-ui.md](../../../docs/specs/2026-09-25-chart-first-review-ui.md)，L112–119
- [开发计划](../IMPLEMENTATION-PLAN.md)、[覆盖矩阵](../DESIGN-COVERAGE.md)、[当前代码证据](../evidence/code-baseline.md)。
- 代码入口：app/components/trade-review-workspace.tsx；app/components/review/review-chart-workspace.tsx；app/components/replay/replay-controls.tsx；app/lib/recall/；app/lib/reviews/episode-viewport.ts；app/lib/storage/review-storage.ts。

## Blocked by

- [旧数据怎样映射为独立练习并保留复盘引用？](01-legacy-contract.md)
- [人的交易行为识别与配对范围](../../trading-library-v11-design-decisions/issues/07-action-identification.md)
- [列表排序与复盘状态的表达](../../trading-library-v11-design-decisions/issues/04-list-sort-review-direction.md)

## 验收标准与反例

- [ ] 逐行完成 REPLAY-STATE-CONTRACT.md 的字段到现有类型/保存调用的映射；确认每个动作行情/成交截止各自变化，标出原子组合与独立字段。
- [ ] 给出精确适配接口与调用方、失败/冲突恢复和重开契约；分组或旧引用不能唯一映射时回上游 HITL，不能自动强移。
- [ ] 核对真实 SDK 绘图延迟、主动导航与 resize/阶段恢复的优先级；不以同步 mock 推定目标 bar 一定可见。
- [ ] 只输出事实清单与适配设计供协调者审查；本票不修改产品、不跑业务库、不宣称真实主图门槛已通过。
- [ ] 独立Resolution记载事实/用户原话、理由、影响边界和待同步位置；协调者接受证据后才可closed。

## 验收证据

NOT VERIFIED；本轮未领取、未解决。未来事实/草稿放 `../evidence/decisions/TL20-D06/`，Resolution放 `../comments/TL20-D06/`；不存在的证据目录不代表已生成。纯决策不要求产品UI/DB验收；prototype若创建只验证讨论材料，不冒充产品。

2026-10-28 独立只读准备，均为静态代码证据，不是动作、浏览器或持久化验收：

- `app/lib/recall/types.ts` 已包含阶段、成交截止、阶段上下文和草稿；`hasSeenFuture` 表达是否看过后续，当前字段不足以单独描述来源。文档身份仍围绕 episode；未发现新练习、主动回合或配对的身份字段。
- `app/lib/recall/server-repository.ts` 按 episode 读取并以 revision 处理保存冲突；`app/components/recall/recall-workspace.tsx` 有实际加载、队列保存和冲突保留逻辑。旧 episode 与新身份不能仅凭相似名称直接替换。
- 现有 workspace 有下一根、播放、下一决策、阶段切换、完整历史、周期切换、Text 和视野相关实现。是否满足双截止、同 K 多成交、未来信息隐藏、切换与恢复的优先级，以及真实图表推进可见，仍须按回放契约逐项操作验证。搜索现有复盘相关目录未找到单独的重新开始回放入口；回到买入前可能恢复旧阶段状态，不能认定等价于重新开始。
- 完整字段/动作映射、身份适配契约、实际保存重开与独立视觉检查尚未完成。本次准备不解除上述依赖，不表示 I12 可实施或已接受。

## 历史

- 2026-10-26 建图：open / ready-for-agent / unassigned；待真实依赖关闭后领取。
