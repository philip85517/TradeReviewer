# 确认数据库与内部复盘模型的验收不变量

Type: grilling
Label: wayfinder:grilling
Status: open
Assignee: unassigned
Parent: ../map.md
Blocked by: 01, 02

## Question

确认一次人工导入后，数据库行、内部 `TradeExecution`、`TradeEpisode`、月结单证据和回放标记之间必须满足哪些可计算不变量：文件/批次幂等、成交数量与分笔守恒、费用/金额一致性、持仓边界、时间证据、IPO 事件可见性，以及发现矛盾或单边记录时如何分类和报告？
