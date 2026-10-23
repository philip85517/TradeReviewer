# B series：root 独立有限接受

2026-10-23 05:36 CST。新源码 30c96eb082ea82dcede6574583c07f53859caf57ff8134705b85a0d45a106ac6；测试 49b799ab415c20898d71c1d29a426ba2d10ff0052ec3defa6f329c224f5474ff。root 已独立阅读两文件及 IMPLEMENTATION-READY.md 全文，并用固定 Node 运行新文件18项，exit0、18 PASS，05:26:16、2.64秒；真实输出 ROOT-INDEPENDENT.log。该命令时长不是金融性能结果。

有限接受范围：严格 Gregorian/inclusive 日期；单次公开 batch；上海 1ms/跨年/闰年；future 与缺失末点不回填；完整末点 summary/null future 契约；current 独立；真实费用/历史 FX；generation 新 wrapper 且保留完整 A evidence/metric references。八组字面 oracle 的实际 entries→A→B 消费路径已核对。无新金额公式、缓存或时钟读取。可供后续集成设计使用，不代表页面放行。

B 自身全规模开销 NOT VERIFIED；A 三市场 cold2617.548995ms 的 FAIL 不豁免，P2正式仍0/3，UI/P4未释放。真实图表、取消/晚响应、mouse/keyboard/touch、四区筛选、返回/reload/持久化和整页视觉均不在纯数据接受范围。
