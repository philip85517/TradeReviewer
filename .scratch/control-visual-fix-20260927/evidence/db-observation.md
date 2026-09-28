# 真实实例读取及自动持久化观察

按用户明确要求，3044当前代码通过conf/runtime.json连接正式SQLite。已用lsof核对Node进程打开 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite` 及WAL，不是上轮fixture。

初始1857 executions、236 instruments、208 import_batches。基线页面运行后：executions/import_batches全行摘要相同；instruments计数相同但全行摘要变化。证据db-before.json与db-current.json。因此不能宣称整库完全只读/零变化。

原应用打开页面会执行证券资料解析与持久化，服务日志包含GET /api/instruments/resolve、PUT /api/storage/trades；原有putInstrument会更新元数据及updated_at。此自动行为未经本次修复引入。未主动导入、删除、编辑交易或保存复盘。当前证据证明原始成交与导入批次未改变，但没有在初始阶段保存每个证券字段的前值，因此不对证券表逐字段差异作超出证据的断言。

验收结束再次对比成交/导入批次摘要，保留证券表变化说明，不能用重置正式库来制造“未变化”。
