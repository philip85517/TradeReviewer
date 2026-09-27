# 设计覆盖与修复验收矩阵

2026-09-27 当前整体integration-pending，仅真实手机软件键盘为必需unverified，无豁免。每行pass仅适用于所列范围，不表示全功能签署。R7布局、R8图表销毁、R9冲突恢复、R10价格辅助及真实重导均已限定复验，见[最终记录](FINAL-ACCEPTANCE.md)。

实际owner：多个Luna gpt-5.6-luna/max实施；Astra gpt-6-astra/low独立验收；root负责真实浏览器及集成。准确设计来源与E01–22映射保留如下。[前序完整矩阵历史](DESIGN-COVERAGE-HISTORY-THROUGH-R9.md)保存原失败，不作为当前未结项。

来源：[US01–44 需求及行为](../../docs/specs/2026-09-25-chart-first-review-ui.md)；[E01–22 元素表及尺寸](../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)。以下画板均为 docs/designs/2026-09-25-chart-first-review 内原图：[02主图](../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)、[03录入](../../docs/designs/2026-09-25-chart-first-review/03-structured-record.png)、[04持仓](../../docs/designs/2026-09-25-chart-first-review/04-holding-stage.png)、[05事后](../../docs/designs/2026-09-25-chart-first-review/05-final-review.png)、[06导出](../../docs/designs/2026-09-25-chart-first-review/06-export-storyboard.png)、[07状态](../../docs/designs/2026-09-25-chart-first-review/07-interaction-states.png)。

每个 R 票为该行 owner，root 为组合负责人；浏览器在隔离库从新样例开始。每项证据进入 repair/reports，逐行更新 pass/fail/unverified，不以某票测试全绿替代。

| 元素 | 任务 | 画板/状态 | 浏览器操作与可观察预期 | 必须反例 | 证据/状态 |
| --- | --- | --- | --- | --- | --- |
| E01 | R1 首次框架门槛；R3 完整布局 | 02/三阶段 | 紧凑顶栏、必要动作与导航 | 长标的/导航展开不挤主图 | 桌面局部pass：R7-pre-plan-1280/1440、R7-pre-nav-1440；header89/63.3；长名称边界另列 |
| E02 | R1/R3 | 04/回看 | 阶段恢复双游标、明确选中 | 下一决策不恢复旧阶段末尾 | 回放状态局部pass：[R1最终门禁](repair/reports/R1-astra-final-gate.md)；R7当前阶段导航可读 |
| E03 | R2/R3 | 02/桌面窄屏 | 工具完整、尺寸符合 | 旧工具不丢/44px命中 | 工具完整性/定向测试见R2复审；R7桌面36/窄屏44局部；不扩大成真机键盘通过 |
| E04 | R1 | 02/盲看推进 | 真实新K和时间轴进入视野 | 刷新不跳/未完成K/无行情 | 核心pass：R1真实窄窗连续至9/24末根64.89、返回原构图；R5手动窗和R6低价live/capture通过 |
| E05 | R1/R3 | 03/侧栏开关 | 轴和标签独立可读 | 14px沟槽、编辑不遮价 | 桌面局部pass：R7侧栏320/沟槽14；R6右边缘live/retained不遮轴；真机键盘unverified |
| E06 | R1/R3 | 03/输入拖线 | 同一计划源、金色虚线 | 空值/做空/拖线重开 | 计划56/52/68、输入及风险冻结见R5/R6；拖线/空值/做空按R7审计分别限定域/浏览器证据；R10辅助fit真实按钮不遮价、三价可见pass |
| E07 | R1 | 04/已揭示决策 | 菱形+买入减仓清仓文字 | 同K多成交/隐藏设置/盲看 | 同K分笔真实点击/重开见R1；R6低价与右轴capture已关闭旧失败；设置边界见R7审计 |
| E08 | R2 | 07/长文输入 | 14px短卡、编号、连线、展开原文 | IME/拖动/旧快照/导出 | 旧R2反例经R2复审修正；R6-editor-filled-1440/390实际32px中文编辑器边界pass；A/B冻结及真实导出pass；真机IME未验 |
| E09 | R3 | 03/侧栏开关 | 可看图、草稿保留、焦点返回 | 不推进/不改窗口/44px关闭 | R5 Esc焦点返回pass；R7窄屏下表单scrollTop475且趋势220保持；R7 More互斥、恢复和实际滚轮末条可达pass（R7-integration） |
| E10 | R3 | 02/买入前 | 入场单行、止损目标双列 | 无退出评价/14px输入 | R7桌面/390局部pass：入场独行、止损目标双列、14px输入、36/44控件；无退出评价前置 |
| E11 | R3 | 03/规模模式 | 数量金额仓位三段切换 | 空基数/步长/不归零 | R5真实数量金额比例往返不归零；缺基数/步长领域证据见R7审计 |
| E12 | R3 | 03/资金折叠 | 默认紧凑、来源时点币种 | 未知非0/summary触控44px | R6/R7默认折叠、未知资金不作0局部pass；展开长值和触控另列 |
| E13 | R3/R4 | 02/计划指标 | 紧凑等宽风险和R | 3R=3:1/缺项原因 | R7真实4000风险、3R=3:1、缺比例提示pass；缺项/做空领域证据另列 |
| E14 | R3 | 04/持仓 | 只读事实、单独修订入口 | 无最终评价/冻结初始风险 | R5/R6真实原计划只读、修订54/72独立、初始风险4000冻结pass；最终窄屏层级另列 |
| E15 | R3/R4 | 05/事后 | 3–4行只读摘要后可直接评价 | 未平仓已实现/浮动拆分 | R5未知费用非0、未平仓4776/3288分列pass；R6重开6760/1.69Rpass |
| E16 | R4 | 05/逐次退出 | 日期动作量价选择 | 同日退出互不串值 | R5逐次退出独立；R6实际导出4776+1984=6760；同日领域与浏览器范围分列 |
| E17 | R4 | 05/提前退出 | 是否不确定与未评价独立 | 未达目标不自动判断 | R4人工状态分段/未知与未评价区别；R5真实逐次评价和重开局部pass |
| E18 | R4 | 05/评价归因 | 紧凑原因符合度、证据关联 | 无退出也可回合/建仓标签、重开 | R4领域证据验证、R5无退出人工标签、R6冻结A导出pass；R8旧missing Text显示与待确认fixture→确认→重开消费者pass（R8-astra-consumers）；R10真实修订PDF→待确认→人工确认→重开及SQL新集合pass |
| E19 | R1/R3 | 02/04/三阶段回放 | 紧凑控制和指标 | 输入阻止快捷键/无效动作说明 | R1回放及未来边界pass；R7手机返回单行44px关闭旧失败；R7 More占高与恢复已由root真实操作pass |
| E20 | R1/R3 | 07/保存错误 | 真实保存状态、保留草稿 | 冲突不写已保存 | R6正式完成→库1/1→刷新1/1、post/global重开pass；R7组件最终128/128；R8真实500保留/重试pass；R9真实409保留、显式重载及二次保存pass（R9-integration） |
| E21 | R2/R5 | 06/导出 | 三图一表可离线、文字表可读 | 缺阶段不伪造/无控件/冻结版本 | R6真实10页PPTX/3原图/7原生表格/0包错误，LibreOffice逐页核对；自动holding真实草稿导出哈希闭环；非原生PowerPoint验收 |
| E22 | R3/R5 | 06/代表图记录 | 可选代表图、充分空间比较 | 全部决策保留/无96px滚动盒 | 桌面真实More滚轮末条编辑pass（R6-more-wheel-bottom-pass）；390原body120.5失败保留；R7修复body195/趋势220、代表图完整/末条44px可达pass；收起hidden正确 |

## 原始用户故事归属

编号逐项对应主规格 User Stories；每组内每条均须逐点检查。US38/39 验收结构化口径和隔离，不新增统计大屏。

| 需求 ID | 任务 | 对应元素/旅程 | 证据/结果 |
| --- | --- | --- | --- |
| US01, US03, US04, US05, US06, US07 | R1 | E04/E07/E19：新回合→逐K/播放/快进→回看→重开 | R1真实核心门禁pass；R5/R6手动窗/capture扩展见R7审计；R7真实逐K/下一决策/play及R8最终build resize/切回合复核pass |
| US02 | R1 首次框架门槛；R3 完整布局 | E01：紧凑顶栏 | R7桌面1280/1440/导航展开局部pass；截图及尺寸见R7覆盖审计 |
| US08, US09, US10, US11, US12 | R2（R1验证快捷键） | E03/E08：Text→折叠拖动→快照→重开 | R2复审+R5真实折叠拖动留存+R6 filled编辑器局部pass；真机IME单列unverified |
| US13, US14 | R1/R3 | E02/E22：三阶段/全部决策 | R1阶段双截止及同K独立pass；R6桌面全部记录pass；390 More局部pass（R7-more-image-visible-390及R7-more-bottom-390） |
| US15, US16, US17, US18, US19 | R3 | E06/E10–13：价格规模资金风险 | R5三规模往返/初始风险与R7 E10布局局部pass；领域和边界按R7审计分列 |
| US20, US21, US22, US23 | R4 | E15–18：实际成交与逐次退出评价 | R5/R6逐次退出、真实6760与1.69R、未知费用非0局部pass；对应领域历史通过 |
| US24 | R3/R4 | E14：计划修订/冻结风险 | R5/R6原始风险4000冻结与修订54/72独立pass |
| US25, US26, US27, US28 | R4 | E13/E15/E18：缺项/未平仓/回合与建仓归因 | R5未知费用/未平仓/无退出人工归因pass；R8历史fixture实际missing提示与确认→重开pass；R10真实PDF导入来源链通过（R10-real-reimport） |
| US29, US30 | R1/R5 | E20：保存重开/失败冲突 | R7组件失败/冲突保留输入通过（最终128/128）；R6正常完成/重开真实pass；R8真实500和409保留pass；R9显式重载已修复、真实双窗口重载/二次保存pass |
| US31 | R2/R5 | E08/E22：冻结图文与编辑状态 | R5/R6工作Text B不覆盖留存A、实际PPTX导出A与哈希独立pass；legacy路径限定见R7审计 |
| US32, US33, US34, US35, US36 | R5 | E21/E22：同窗三图一表/缺阶段/附录 | R6真实PPTX10页/3图7原生表及auto holding同窗推荐闭环pass；缺阶段/附录域测试证据分列；R7窄屏真实滚轮比较局部pass |
| US37, US38, US39 | R4/R5 | 结构化查询/分母缺失币种/实盘模拟隔离 | typed SQL、单回合分母/缺失/币种及运行隔离历史测试通过，详R7-evidence-gaps；metric同run/混run/可知边界22/22，见R7-metric-scope |
| US40, US41, US43 | R3 | E05/E09/E10：窄屏趋势和价格同屏，真机键盘单列 | R7桌面与390趋势220+表单scrollTop475局部pass；真实手机价格/退出原因软件键盘unverified无豁免 |
| US42, US44 | R1/R3/R4 | E09/E10/E18/E20：阶段隔离/草稿保留 | R1阶段/来源隔离、R5草稿保留与R7冲突测试pass；窄屏More/plan展开关系待当前修复验收 |

## R9 新增保存反例覆盖

| 需求/元素 | 精确来源与参考 | owner | 旅程与反例 | 证据/状态 |
| --- | --- | --- | --- | --- |
| US29–30 / E10,E20 | 主规格保存与冲突；元素E10/E20；02-chart-workspace.png、07-interaction-states.png（上方来源链接） | luna_r7_layout（Luna5.6max）→Astra独立→root真实集成 | A/B共同1100；B1200已保存；A1300冲突保留；显式重载应1200/4800风险；再编辑保存不能复用过期CAS；hydrate不丢本地 | [R9](repair/issues/R9-conflict-reload.md) accepted限定；R8-real-conflict-1300保留原失败，R9-reloaded-1400及R9-integration为修复后证据 |

## R10 新增视觉碰撞

E05/E06：02/03画板、价格标签可读；owner Luna5.6max→Astra→root。[R10票](repair/issues/R10-plan-price-action.md)。默认1280×720当前计划fit按钮与金色入场标签相交（R9-preview-ready）；需固定辅助动作到非右轴位置并真实验点击/双截止/390触控。修复后限定pass：R10-default-before-fit、R10-fitted-390/1440、R10-preview-ready及R10-integration。
