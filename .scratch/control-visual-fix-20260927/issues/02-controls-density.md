# 02 — 使用统一控件并舒适阅读持仓列表
State: closed
Status: accepted
Assignee: controls (gpt-6-luna / max)
集成负责人: root
Blocked by: None（依赖已由root接受）

Scope: C01/C02/C04/C05。图1作为语言参照，将共享尺寸/颜色/选中态真正接入交易库与交易室；修复periodTabs覆盖；增大持仓默认行/迷你图阅读空间；资产分布仅控件/密度调整，保留原金融状态。
Refs: ../visual-contract.md；../DESIGN-COVERAGE.md；../../control-visual-diagnosis-20260927/DIAGNOSIS.md；矩阵图1/2/3。必须先看图。

允许修改: library/library-scope-controls.tsx、library/trade-library.css、library/trade-library.tsx对应筛选片段及相关测试；dashboard/review-dashboard.tsx/.module.css/.test.tsx对应控件；room-holdings.tsx/.module.css/.test.tsx；room-allocation.tsx/.module.css与相关测试；新增共享控件/样式目录。app/globals.css只能移除/迁移直接相关library控件重复规则，不能全局改button/select或其他页面样式。不得改01所有的图表文件，避免共享写入。不改变筛选语义、数据层、金融计算、导航或回放工作区。

- [x] 同档真实控件尺寸统一；期间无旧覆盖；共享实现有真实消费者。
- [x] 真实页面账户/计价/性质/期间/维度切换可用；库中未知来源保留。
- [x] 持仓11列、搜索分页和详情仍可用；默认密度改善，窄屏局部滚动。
- [x] 原图对照、桌面/宽屏/窄屏无遮挡；相关行为测试pass。
报告: ../implementation-controls.md。三道门槛分别记录；不提交git，不再派代理。

实现单测、真实页面实现预检与未验证门槛见[实现报告](../implementation-controls.md)。保持 open，等待 root/Astra 独立整页验收。

root签署：已核验当前Scope适用门槛，证据见[最终验收](../FINAL-ACCEPTANCE.md)与[独立验收第三轮](../independent-acceptance.md)。各勾选对应DESIGN-COVERAGE同ID证据；真实完整圆环/物理触摸仍NOT VERIFIED，未被勾选宣称通过。保留此前缺陷发现及修复历史。
