# 确认重复导入与修订账单的幂等口径

Type: grilling
Label: wayfinder:grilling
Status: open
Assignee: unassigned
Parent: ../map.md
Blocked by: 01

## Question

基于当前 PDF 的重复副本、同文档重导和可能的修订文件，确认数据库与网页导入预览如何分层处理：内容哈希相同的副本是否跳过，文件名变化但内容相同如何归并，同文档修订如何替换旧事实，真实同秒同价同量多笔如何保留？给出可执行的对账判定和人工冲突动作。
