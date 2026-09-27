# R4独立验收准备

2026-09-26；gpt-6-astra / low。只读准备，全部unverified；R1门槛未解除，不授权实施。已读 `R2-R4-INTERFACES.md`、`issues/R4-evaluation.md`、现有actual-metrics与exit-evaluations组件。未改产品/数据库、未跑浏览器/测试、未派代理。

当前静态反例明确：metrics组件仅phase=holding显示realizedNet/unrealizedGross，post-review选最终netPnl/actualR，即使未平仓；exit组件无choices提前返回，全部人工标签位于退出draft内，所以无退出不能记录回合/建仓标签。退出label缺价格、long只写卖出。以上是准备基线，不是新实现验收。

## 必要RED→GREEN场景

| 场景 | 必须观察的结果 |
| --- | --- |
| 999993部分退出未平仓→事后 | 已实现净额与浮动（注明未扣费）仍显示；最终净额/R不可用；底栏/详情/侧栏同口径，不把position.netPnl重新命名替代 |
| 999994仅建仓、无退出 | 可给回合或该建仓打仓位/入场/判断人工标签并关联Text/快照；无虚构退出/订单/earlyExit；切归属不串值 |
| 同日/同K两个退出600/400 | 日期+减仓/清仓+数量+真实均价，选择切换各自保留yes/no/uncertain/null及原因；未知价/数量明确 |
| 缺费用/成本/数量、无估值 | 缺项说明而非0；毛净区分；期初费用按关闭量分摊、剩余费用保留、末笔吸收舍入；兼容0不得越过accuracy标志 |
| 无原计划/做空/加仓 | no-plan不同as-planned，不造止损；做空方向正确；多建仓无事前全回合预算则R为空；初始冻结R不随修订改变 |
| 已有6760/1.69R样例 | 分批均价62.80、完整费用40只扣一次、净毛目标兑现56.3%，既有财务链不回归 |
| 评价/人工标签无证据或旧证据 | 可空有说明；稳定Text ID+修订/快照指针，缺失保留原引用；不按盈亏自动生成标签，不改变旧退出评价版本 |
| 原生UI操作 | 原因/符合度紧凑选择、输入14px、触控44px；其他说明无效时保留本地文本且禁止错误留存；先看D05同状态再比较 |

## 新字段从请求到冻结/投影的最小覆盖

1. 兼容：旧文档无新字段可读取，保持缺失；新标签稳定ID、明确回合/建仓目标、词典版本、人工来源/记录时间、阶段、双截止/hasSeenFuture、证据指针。跨回合决策或错误证据关联请求拒绝；不靠UI校验。
2. 原子保存：Recall document是唯一权威；新字段与只读可重建投影同事务提交。一次成功保存→重开/查询相等；旧revision冲突与事务故障不产生半更新，保留本地编辑；不直接编辑投影。
3. 迁移：仅追加migration，不改旧SQL/checksum。显式隔离库从旧schema迁移、重复启动幂等；原成交行数/内容摘要不变。无新字段旧版本不自动填false/0。
4. 留存：A标签/评价+证据修订留存为bundle；后续草稿B保存，旧快照/正式版/导出仍读A；再次留存才出现B。readOnly按bundle的revision IDs读取，不从当前associations/latest drafts补旧内容。缺冻结字段明确缺失。
5. 关联变化：重导导致决策拆分/合并时保留原标签/评价、转待确认关联，不按数组序号覆盖；冻结bundle引用原决策及证据版本独立；确认后只影响新草稿/新留存。
6. 导出：manifest/PPTX读取冻结通用标签和评价（文本可读），与表内指标口径一致；无已留存汇总不拿草稿补造；旧PPTX/Markdown兼容。
7. 统计隔离：人工标签回合/决策范围明确；提前率分母仅yes+no，uncertain/null单列，数量加权与决策率分开，样本/缺失/币种明确；实盘与每个模拟运行不混合。

R4先交接R3确切props：document updater、phase/双截止/hasSeenFuture、readOnly及bundle revision引用、validation callback；R3唯一写Workspace，不并发覆盖。R2新Text字段如需document校验由R4单owner接入。验收只需对应领域、仓储事务、冻结/投影与新UI的必要定向用例；全量检查root后续集中执行。各层分别给结论，组件pass不代表整页或R1解锁。
