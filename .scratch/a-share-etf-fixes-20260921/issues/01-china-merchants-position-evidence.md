# 01 - 招商证券证券余额证据

What to build: 将招商证券流水表 `证券余额` 转成可回放的 opening/closing `StatementPosition`，并在缺失时显式标记复核。

Blocked by: None

Status: complete

Acceptance:

- [x] 首笔卖出可从同一交易行余额反推出期初库存。
- [x] 每条证据带 PDF 页/行来源和文档 ID。
- [x] 缺失余额不按 0 处理，并标记 `reviewRequired/historyIncomplete`。
- [x] 现有成交字段和 parser 交易行数量保持不变。
- [x] 相关单测、回放测试通过。
