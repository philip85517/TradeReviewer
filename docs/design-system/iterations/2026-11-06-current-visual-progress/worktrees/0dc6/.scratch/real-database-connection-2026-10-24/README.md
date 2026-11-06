# 当前网页接入真实数据库

2026-10-24，协调者 /root；独立只读审计 /root/astra_database_connection_audit（GPT-6 Astra Ultra）。

运行时连接已生效：[交易库](http://127.0.0.1:3333/trades) 当前显示实盘、全部账户、A 股，52 标的 / 85 回合。API 的 1,866 笔成交、213 个导入批次、236 个标的 ID 集合均与真实库一致。服务 PID 29149 / 会话 97376，保持运行。

整体验收保持 **open / acceptance-failed，1 / 3**：原首页范围 URL 显示空列表；主动刷新未验证；自动复盘保存导致 reviews 内容摘要改变，名称元数据亦存在自动写入。不得称作完整只读通过。没有修改产品代码、配置默认端口或原交易记录；未推送、合并或发布。

- [主任务](issues/01-connect-business-database.md)
- [自动写入问题](issues/02-automatic-writes.md)
- [最终验收与控件覆盖](FINAL-ACCEPTANCE.md)
- [诊断与独立审计](DIAGNOSIS.md)
- [启动说明](STARTUP.md)
- [需求/证据映射](DESIGN-COVERAGE.md)
- [最终 API 核对](API-FINAL.json)、[业务表摘要](BUSINESS-FINAL.json)、[内容 manifest](CONTENT-MANIFEST.json)
- [真实页面截图](FINAL-REAL-DATABASE.jpg)、[完整 AX 状态](FINAL-UI-FULL.txt)

此前首页 P1/F07、ContributionBars 的 3 / 3 暂停及失败证据继续有效；本次运行配置切换不代表恢复或接受这些任务。

2026-10-24 桌面范围补充：[当前桌面首页诊断](../desktop-home-db-diagnosis-2026-10-24/DIAGNOSIS.md)在 1440×900 直接观察到首读 timeout，指标/曲线未接受数据且空 seed 被呈现为“暂无持仓”。新鲜业务库与 API ID 摘要仍一致。此前窄屏交易库 52/85 只属于当时交易库状态，不能证明桌面首页通过；本目录原 1 / 3 失败与自动写入问题继续保留。
