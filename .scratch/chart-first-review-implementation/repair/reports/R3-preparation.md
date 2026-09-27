# R3 实施准备

日期：2026-09-26。本文是 R1 通过后的只读准备，不修改产品或测试，也不解除 R2–R4 前置门槛。

## 已核对基线

- 依据：`R3-phase-layout.md`、`R2-R4-INTERFACES.md`、当前 `DESIGN-COVERAGE.md`，并查看 D02/D03/D04/D05/D06 原图。
- 当前工作区入口是 `RecallWorkspace`；计划侧栏、计划修订和三阶段 `RecallStoryboard` 已分别存在，均复用 workspace 的 `onChangeDocument`。
- R1 的 `更多 / 记录` 已是完成、完整历史、快照和三阶段入口；R3 应在其上整理层级，不能把这些动作重新铺成多行常驻工具。

## 三阶段首屏顺序

| 阶段 | 主图/底栏 | 侧栏首屏 | 次级内容 |
| --- | --- | --- | --- |
| 买入前 | 价格与回放优先；紧凑显示计划预期 R/初始风险 | 入场价、止损、目标，再是三种规模模式与数量 | 资金、元数据、长 Text、版本/来源详情折叠；无计划显示明确空态 |
| 持仓 | 保留 Text 与当前已知数量；底栏只显示可信当前事实、下一步和留存 | 原计划与当前只读事实，随后给出独立的计划修订入口 | 修订草稿、风险预算、版本链和来源详情折叠；不显示退出评价或最终盈亏 |
| 事后复盘 | 完整历史图与成交标记；底栏先放 R4 可信摘要和复盘动作 | 只读原计划/实际摘要 → 退出选择与评价 → 回合/建仓人工标签 | 完整计划、修订、证据和来源详情放后；缺少退出或未平仓保持真实空态 |

三个阶段都保持图表、截止游标和主动作在首屏，侧栏独立滚动；首屏顺序不因长 Text 或修订记录改变。

## 次级收纳与三类入口

- `更多 / 记录` 继续收纳完成、完整历史、全部快照与三阶段代表图；展开后使用正常流式面板，比较内容不能再塞进 96px 高滚动盒。
- 代表图选择只写 `document.storyboard[phase].snapshotId`，用于 D03/D06 的三阶段讲述；它不改变当前 phase、replay 双截止、选中决策，也不自动留存。
- 工作阶段是实时 `phase` 加 replay/绘图/Text 状态；留存是显式生成的不可变快照/冻结 bundle。编辑快照只展示其冻结结构化版本，不能把最新草稿注入旧快照。
- 所有决策和附加快照仍须从记录入口可达；代表图预览、工作阶段和留存动作在文案与焦点上保持可区分。

## 尺寸、容器与 1280/390

- 用工作区可用宽度的 container query/布局测量决定横向或纵向，不用单一 viewport 断点硬切。横向所需下限约为图表绘图区 640px、价格轴 84–108px、14px 沟槽、侧栏 300–320px 及必要内边距；不足时纵向堆叠。
- 1440 维持图表 + 价格轴 + 侧栏；1280 保持标题 18px，标题区用 `minmax`/明确第二行或更多入口承载导出与 toolbar，禁止靠缩字或缩按钮消除换行。导出动作可进入已有次级入口。
- 桌面输入 14px、辅助文字至少 12px、控件约 36px；手机触控目标至少 44×44。390px 采用纵向布局，上方趋势保留 200–240px，下面字段独立滚动且价格仍可见，禁止横向溢出或全屏遮罩式侧栏。
- 关闭/Esc 必须把焦点交还原触发点；resize、开关侧栏和布局切换不改变 replay 双游标或当前图表视野。

## 允许文件与 R4 稳定边界

- R3 可写：`app/components/recall/recall-workspace.tsx`、`recall.css`、`recall-plan-sidebar.tsx`、`recall-plan-revisions.tsx`、`recall-storyboard.tsx`，以及对应 workspace/integration tests 和这些组件的 CSS。
- R4 负责评价/指标、document/types、repository、retained bundles、迁移及导出冻结字段；R3 不直接改这些共享领域文件，也不在 Workspace 里伪造 `position.netPnl`。
- R4 评价组件应提供稳定 props（名称可按最终交接调整）：
  `document` 或只读 snapshot bundle、`episode`、`phase`、`knowledgeCutoff { cursor, executionCursor }`、`hasSeenFuture`、`readonly`、`bundleId/retainedBundle`、`onChangeDocument`、`onValidationChange`。
- 指标返回值须带可信来源/截止语义，快照编辑使用只读冻结 bundle；普通工作态和快照态共用 workspace 的统一保存事务，不能各自持久化。
- 现有计划侧栏的 `input/phase/readOnly/knownQuantity/hasSeenFuture/retained/onChange/onClose/children`、修订的 `knowledgeCutoff/hasSeenFuture/onChangeDocument/onValidationChange`、Storyboard 的 `document/onChangeDocument/disabled` 可作为 R3 集成基线。

## 验收证据

R3 实施后需用 1440、1280、390 在侧栏开闭、长标题、导出动作和导航展开状态各留证；核对三阶段同状态截图、真实手机键盘、代表图选择不切阶段、全部快照可达，以及 resize 后游标/视野保持。本文不声称这些验收已经通过。
