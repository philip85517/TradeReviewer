# 反馈与设计决策覆盖

## 触发、范围与证据边界

触发：用户要求检查已评论的设计问题，并明确确认“先形成设计决策地图”“按六组建立，先处理概念冲突”。范围为 V1.1 revision 5 的五条评论，共十七项诉求；仅静态来源核对和设计问题建图。

版本、文件 SHA-256 与文档 fingerprint 见[源文件清单](evidence/source-manifest.json)，原话见[评论快照](evidence/comments-v11-revision-5.json)。下表是版本绑定的局部覆盖，机器可读记录包含每个 commentId、elementId、occurrenceId、原图路径、负责人、旅程和证据要求，见[完整映射](evidence/feedback-coverage.json)。

排除：未反馈的全页控件穷举、浏览器实测、产品实现与数据库写入。当前所有实际 UI 操作与视觉验收均为 **NOT VERIFIED**；文档规划不适用数据库验收。这里的“已证实”仅指可从源码/正文直接核对的差异。间距舒适程度、模式底色柔和程度需后续等视口截图比较，不凭评论或 CSS 数字宣布通过/失败。此前 V1.1 定型验收保留为其历史范围证据，新评论均不自动标成回归或已解决。

## 问题、根因与决策归属

集成与整页一致性负责人为 root；领域定义票已由 root 接受，其结论及后续修订范围见[独立决策结论](comments/TL11-D01/2026-10-25-resolution.md)。其余票状态以各自字段为准；行为识别已另建子票，原十七项反馈覆盖不变。业务/统计一致性由“账户、练习与完整交易的边界”统一约束；本轮没有实现或持久化负责人，因为没有实施范围。

|反馈项|当前核对结论与根因|决策负责人所在票|用户旅程与待补证据|
|---|---|---|---|
|统一模拟盘账户名称|定义冲突已证实。CONTEXT 已定义模拟账户；V1.1 禁止新增账户控件。不能仅改显示字符串。|[账户、练习与完整交易的边界](issues/01-domain-boundaries.md)|进入模拟盘→识别账户与练习；概念关系、跨文件/跨练习反例和统计影响|
|全部/A股/港股/美股下拉|原型覆盖缺口已证实。E tools() 使用静态 div；正文已有市场范围语义。|[市场与账户选择器的规则](issues/03-market-account-selectors.md)|展开市场→选择→列表/统计一致；四种市场、空结果与返回恢复状态表|
|账户下拉及截断|原型覆盖缺口已证实。E 使用静态账户字段；V2.5 明确176px账户框、箭头和长名浮层。|[市场与账户选择器的规则](issues/03-market-account-selectors.md)|账户展开→选中→模式切换→恢复；长名、空项、失效选择及键盘状态|
|成交日期升降序|正文与演示覆盖不一致。正文有排序与恢复；E 列头静态、数组顺序渲染。不能据此断言正式产品排序故障。|[列表排序与复盘状态的表达](issues/04-list-sort-review-direction.md)|列头切换→分页→详情返回；稳定次序及状态恢复表|
|已复盘/未复盘筛选|语义冲突及演示缺口。正文有成交复盘状态，E 有标签无筛选；项目词汇表按回合定义已完成复盘。|[列表排序与复盘状态的表达](issues/04-list-sort-review-direction.md)|筛选→检查行归属→返回；草稿/部分完成/已清仓/开放回合判定|
|浅底色区分复盘状态|新增视觉要求。E 目前用状态标签；浅色行背景与选中/hover并存需要规则。|[列表排序与复盘状态的表达](issues/04-list-sort-review-direction.md)|筛选状态→悬停/选中行；文字与颜色双重识别及状态叠加样例|
|买卖方向状态色|新增表达要求。E 方向为普通文本；买卖并不等于盈亏。|[列表排序与复盘状态的表达](issues/04-list-sort-review-direction.md)|扫描方向→阅读盈亏与复盘状态；方向、盈亏、复盘状态色职责表|
|表格间距规范|规范细化需求；视觉程度未验证。已有行高和内边距，不等于列宽预算与可见字形间距完整。|[表格密度与标的显示规范](issues/05-table-density-symbols.md)|扫读表头与值→长内容/大数值；1440/1280列定义及渲染比较|
|美股缩写及悬浮全称|样例覆盖缺口已证实。E 实盘样例均为A股；需要ticker和完整身份的展示合同。|[表格密度与标的显示规范](issues/05-table-density-symbols.md)|扫描ticker→悬停/聚焦全称；长美股名、ticker与市场身份样例|
|实盘/模拟盘滑动切换|新增交互视觉要求。E 为互斥按钮，未提供移动滑块。两个模式不能被误解为开/关。|[统一滑动切换与柔和模式底色](issues/06-switches-mode-surfaces.md)|切换模式→保持模式可辨识；滑块状态、键盘、减少动态效果|
|柔和底色或边缘渐变|方案探索；不判定现方案失效。当前已有模式表面差异；需比较柔和程度与持续辨识。|[统一滑动切换与柔和模式底色](issues/06-switches-mode-surfaces.md)|切换前后→列表/统计浏览；两种表面方案及四状态比较|
|标的名＋练习日命名|层级与来源待决策。评论锚在回合集；练习名和回合名不可不加区分地替换。|[练习名称与日期口径](issues/02-practice-names-dates.md)|练习列表→回合集→返回；同日重复练习及一练习多回合|
|练习交易区间|日期层级待决策。实践日期/保存日期与历史交易区间不同，也不同于单回合开平仓时间。|[练习名称与日期口径](issues/02-practice-names-dates.md)|按练习日筛选→阅读历史区间；跨年样例及日期来源/未知状态|
|配对数量改完整交易量|定义冲突已证实。V1.1 买100+50卖80算两回合；词汇表的一段持仓过程此时仍开放。|[账户、练习与完整交易的边界](issues/01-domain-boundaries.md)|部分减仓→最终清仓→统计；完整交易、配对与股数计数反例|
|回合集表头间隔|规范细化需求；视觉程度未验证。需字段意义确定后分配列宽，不能只为截图等分列。|[表格密度与标的显示规范](issues/05-table-density-symbols.md)|练习→回合集→扫描表头与内容；列宽预算、表头与值同锚点比较|
|收益分布标题与右侧间距|规范细化需求；视觉程度未验证。E measure-toggle 有局部margin，缺少跨模块组合规范。|[表格密度与标的显示规范](issues/05-table-density-symbols.md)|进入统计→阅读标题及单位；标题/切换/说明入口的间距规范|
|收益率/金额小型滑动切换|新增组件统一要求。E 用两按钮切换；小型滑块视觉和命中区应分别定义。|[统一滑动切换与柔和模式底色](issues/06-switches-mode-surfaces.md)|收益率→金额→返回；两尺寸组件合同及标题组合样例|

## 精确评论锚点与参考图

- **BT02 · approved-e-sim-stats-1440**：[评论所指原图](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/images/approved-e-sim-stats-1440.jpg)；评论 `comment-d1f625046bf84bffa4d2d8105a230e6f`；出现位置 `approved-e-sim-stats-1440@state-demo-1-4`。
- **BT03 · journeys-date**：[评论所指原图](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/images/journeys-date.svg)；评论 `comment-feff887300194312b9bdc1d89a8caba0`；出现位置 `journeys-date@state-demo-2-1`。
- **BT03 · journeys-date**：[评论所指原图](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/images/journeys-date.svg)；评论 `comment-78729b543f764799b5cf2aef6b238611`；出现位置 `journeys-date@state-demo-2-1`。
- **BT04 · hcr06-final-rounds-a**：[评论所指原图](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/images/hcr06-final-rounds-a.svg)；评论 `comment-d1dfdc86adc743c29bd056038ee0ef99`；出现位置 `hcr06-final-rounds-a@state-demo-3-2`。
- **BT05 · 02-simulation-normal**：[评论所指原图](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/images/02-simulation-normal.svg)；评论 `comment-f369091e0dc04e11a992e2dc6359e163`；出现位置 `02-simulation-normal@state-demo-5-1`。

## 公共参考与已知冲突

- [项目领域词汇](../../CONTEXT.md)：模拟账户、交易回合、交易决策、已完成复盘。
- [V1.1 正文](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/source/visual-design.candidate.md)：第二章条件记忆但不新增账户控件、第四章配对计回合、第十章成交复盘状态。
- [E 原型](../../docs/design-system/baselines/2026-10-24-trading-library-v1.1/navigation-e-prototype.html)：静态市场/账户字段、实盘表头、样例状态、两类按钮切换。
- [V2.5 公共规范](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md)：4px间距网格、数值右对齐、列最小宽度/溢出、36px命中区、账户176px建议宽度、盈利绿亏损红。
- [V2.5 账户参考图](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/account.svg)：当前值/下拉/截断。V2.5 首页市场用四标签，本次交易库下拉是用户明确要求的页面差异，不能声称首页也采用下拉。

## 后续验收门槛

各 HITL 票先取得用户真实结论并记录独立 Resolution。视觉票以1440和1280可比视口做实际渲染比较；模式表面覆盖实盘/模拟盘×列表/统计，表格覆盖长文本、大数值、空值、美股及重复练习。独立视觉接受人须与实现人不同，当前未指派、未执行；不能借用旧接受记录关闭这些新决策。

进入后续实施时，重读当前开发流程，先补设计覆盖中的具体接受证据与派发所有权，再执行相关控件审查。真实浏览器操作、状态恢复、视觉比较及有写入时的隔离库持久化分别验收。
