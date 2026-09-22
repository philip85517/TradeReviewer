# 行情模块文档交付

Luna负责docs/adr/0002-market-data-flow.md；协调者负责两图、回执、索引和独立验收。
已核对router、daily-fallback、API、providers和sync调用；审阅修正Baidu 15m能力、分层取消/Tiger超时、配置读取和周线聚合说明。
两图各9/9 showcase，四尺寸Chrome通过，深浅截图独立复核。静态预览沿用会话41303、端口8765，最终URL已在内置浏览器核验；未连接交易数据库，未调用行情服务。
104条本地Markdown引用有效，两个JSON/HTML回执哈希和HTTP响应字节一致。应用测试/构建未运行，本次只改文档。
完整产物和证据：docs/adr/market-data-verification.md。无未解决阻断；未推送。
