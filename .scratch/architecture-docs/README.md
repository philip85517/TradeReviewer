# 架构文档整理

需求：用户调用 Archify，要求整理当前 TradeReview 架构到 docs/adr。

- 代码基线：07f86b8e4d4703f4f5cd171e1a7d9a37aa374de4；当前隔离 worktree 开始时无未提交修改。
- Luna 文件所有权：docs/adr/README.md、0001-current-architecture.md。协调者负责图规格、产物、验证和独立审阅。
- 审阅发现：正常导入路由与旧浏览器迁移需区分；要求补充 Recall 双游标和快照模型。BaoStock 已核实由 intraday route 注入，保留其当前能力。
- 图验收：9/9 showcase，4个桌面尺寸无溢出；查看2048浅色、1440深色截图；浏览器节点搜索SQLite通过。
- 静态服务：当前worktree的docs/adr，127.0.0.1:8765，会话41303，服务持续运行。没有连接数据库。
- 应用测试/类型/构建未运行：仅文档新增。原始交易数据未读取、未写入。
- 输出与完整回执：docs/adr/verification.md。
