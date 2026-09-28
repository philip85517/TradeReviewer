# 03 — 独立真实页面交互与整页视觉验收
State: closed
Status: accepted
Assignee: acceptance（用户确认 gpt-6-astra / low）
集成负责人: root
Dependencies: 01/02已独立复核并接受

Scope: J01及C01–C07、D01真实数据库边界核对。
Refs: ../visual-contract.md、../DESIGN-COVERAGE.md、前两票、用户四张原图及前轮截图。
允许写入: ../independent-acceptance.md及../evidence/independent-*、自己的浏览器诊断脚本；禁止修改产品代码、正式数据库或测试造数。不再派代理。

- [x] 直接看原图及当前真实页面截图，多视口逐项对照，不只读CSS/报告。
- [x] 自己操作真实页面完整旅程，记录真实所选范围、点击与可见结果，不使用mock/合成数据。
- [x] 检查DOM几何、图表选点/resize、控件可用、详情/搜索/分页、跨页返回。
- [x] 代码审查找新回归；分别给功能/端到端/视觉PASS或FAIL及证据。
- [x] 原始数据摘要核对交root；记录真实行情不足可验证的状态及实际限制。

root签署：已核验当前Scope适用门槛，证据见[最终验收](../FINAL-ACCEPTANCE.md)与[独立验收第三轮](../independent-acceptance.md)。各勾选对应DESIGN-COVERAGE同ID证据；真实完整圆环/物理触摸仍NOT VERIFIED，未被勾选宣称通过。保留此前缺陷发现及修复历史。
