# 如何保留全库校验并复用按组计算结果

ID: HOME-PRECOMPUTE-SEAM
Parent: [首页数据库优化与一秒首屏](00-map.md)
Labels: wayfinder:task
Mode: AFK
State: closed
Status: accepted
Assignee: /root
集成负责人: /root

## Question / Scope

能否将“这份全库资料是否可信”的校验依据，与“某个账户、标的和交易性质的计算结果”分开保存和更新，并保持现有公开计算结果一致？用最小原型确定深模块的输入、输出、依赖与失效条件，作为后续后台执行者的实现接口。

问题不是重新定义缺失数据规则。保留当前全局完整性规则，在组结果复用后重新应用该规则；不能把筛选后的少量成交冒充完整全库输入。

## Refs

- [写后计算补充设计：共用模块与更新粒度](../../../docs/superpowers/specs/2026-11-05-homepage-write-precompute-design.md#三共用模块与更新粒度)
- [计算特征与全局依赖反例](../resume/calculation-report.md)
- [真实资料及旧库修正保护](../resume/source-report.md)
- [设计覆盖登记](../DESIGN-COVERAGE.md)

## Blocked by

- [单笔更新与旧库刷新能否安全共用局部计算](06-precompute-contract.md)

## 输入 / 输出与所有权

输入为固定版本、固定时点的既有全库事实与完整性依据。候选基础对象至少区分账户、标的、交易性质和模拟运行；账户费用、来源缺口、行情、汇率、复盘、业务日和有效期都需要明确依赖。

输出为经等价测试验证的模块接口、最小原型和下一实施计划；具体生产文件所有权须在领取后按当前拆解规范落实。此票不直接宣称后台发布或一秒目标完成。

## 验收标准与反例

以下为2026-11-06协调者最终接口验收；第3轮未通过的原文字快照保留在[接受前任务记录](../group-results/root-issue07-before-acceptance.md)，不抹除历史。

- [x] 四层对象、版本与字段清楚，原公式机械包装、反向还原逐字相同；[模型](../group-results/MODEL.md)与[生成核验](../group-results/root-fresh-verify/verification.json)。
- [x] 买100卖40为60股/720市值/120浮盈，改卖20为80/960/160；含4点非空历史，完整业务逐项相同；[root原始记录](../group-results/root-fresh-run/candidate/evidence.json)。
- [x] B新增或全库资料缺口时A的实际基础金额从磁盘恢复，合计仍按原规则不可用且保留原币720；[独立Luna核验](../group-results/luna-review.md#规格核对)。公开行对象可以重新组合，不冒称整行/整页缓存。
- [x] 成交、行情顺序、账户/标的/模拟运行、费用/冲突、汇率及业务时间依赖明确；秒钟推进命中并绑定新cursor，截止/收盘/换日失效，损坏/I/O/容量回原计算；[依赖规则](../group-results/DEPENDENCIES.md)及[root验收](../group-results/root-acceptance.md)。
- [x] 主批实际恢复29次/原求值52次；结束进程后由另一进程从同一SQLite恢复；载荷与物理字节、仍执行的准备/历史/持仓工作分别说明；[复跑摘要](../group-results/root-fresh-summary.json)。不把小样本当真实全库一秒证据。
- [x] Sol6.1 Ultra实施，单独Luna6 Max和root各自复跑、实际审查并接受；975产品与旧44文件及本轮127/128冻结检查通过；[Luna](../group-results/luna-review.md)、[root签署](../group-results/root-acceptance.md#接受签署)。无产品或UI接线变化，浏览器/视觉仅对此实验不适用。

## 次数与暂停范围

沿用原问题的新阶段计数和最多5轮上限，不因本票另起计数。财务公式/资格规则、Bars与并发专项继续暂停；若实现依赖修改这些规则，记录阻塞并停止该范围。

## 本次领取

2026-11-06由/root领取原票，候选4/5。先集中确认持久组结果、全库校验与业务有效期接口；独立实验仍不得修改公式或默认页面接线。原第3轮及历史FAIL证据冻结保留。

## 当前进展与历史原因

第3/5轮仅接受准备复用：34对业务结果相同，但内存句柄无法落盘，基础金额仍重算，精确毫秒键使真实请求通常失效。属于架构接口未完成，不是买卖数值case失败；[旧完整验收](../group-reuse/root-acceptance.md)及[第三轮](../group-reuse/ROUND-3.md)保留。

第4/5轮接受实际当前基础结果的持久化、恢复及业务有效期；Luna与root各74对相同，无Critical/Important问题。候选SHA9ebf07d269f7ec6d00ddd3bff0f950717e3a186f0cfb9904c2d90e88baf8fbae，见[第四轮简明结果](../group-results/ROUND-4.md)。新入口必须显式独立输出且拒绝覆写旧目录；没有修写旧冻结工具。双方共有DEP0205警告已登记为非阻塞。

准备、历史、持仓仍走原链路，持仓完整行/后台/真实全库/桌面一秒未完成。95%分支覆盖无provider，NOT VERIFIED。原产品失败在本票关闭后仍有效；本票不恢复财务规则、Bars或并发专项。

## Resolution comment

[独立结论记录](../comments/HOME-PRECOMPUTE-SEAM/20261105T185957Z-resolution.md)。本票六项接口决策门槛已由协调者独立接受，State closed / Status accepted；仅关闭本票。后续沿用原[写后提前计算任务](02-on-demand-rebuild.md)，不另起计数；恢复阶段已用4/5，下一性能候选5/5。
