# 04 — 手动刷新汇率与持久化快照

**What to build:** 手动获取可追溯最新人民币汇率，持久化并展示来源、日期与失败缓存状态。

**Blocked by:** None — can start immediately

**Status:** accepted — scoped implementation and functional verification passed; final regression tracked in 09

- [x] 核实免费公开来源覆盖 CNY/HKD/USD，记录来源条款、数据时点；不发送交易数据
- [x] 仅手动刷新请求外部数据，进入页面只读保存快照
- [x] 失败保留上次完整快照并标注缓存日期，无快照不可折算
- [x] 同一快照统一更新；拒绝非法/非正汇率，有限超时，不改交易数据库业务事实
- [x] 连续两次成功刷新及失败回退、服务重启读取有测试

验收证据：模块实现/独立 QA 报告与 [协调者集成验收](../reports/coordinator-acceptance.md)。整体验收及剩余工作台导入回归由 09 跟踪。
