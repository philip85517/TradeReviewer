# 交易库初始化触发自动复盘与元数据写入

ID: real-db-20261024-02
State: open
Status: acceptance-failed
Assignee: /root
集成负责人: /root
Blocked by: 无
Priority: P1
修复候选轮次: 0 / 3；本次只诊断，未实施候选

## Scope / What to build

来源：真实数据库连接第 1 轮验收观察。固定并修复系统 hydration 被误作用户复盘编辑、旧保存队列跨存储身份、浏览触发元数据持久化的边界。不能改写业务数据或默默重启已暂停财务任务；产品修复尚未派发。

## Refs

- [诊断及精确源码位置](../DIAGNOSIS.md)
- [原主票](01-connect-business-database.md)
- [业务前摘要](../BUSINESS-BEFORE.json)、[业务后摘要](../BUSINESS-FINAL.json)
- [数据保护规则](../../../docs/agents/frontend-control-audit.md)

## Design / acceptance proposal

先一次性扫描 bootstrap、restore、autosave effect、排队、storage identity、API 和无条件 UPSERT。把“用户已编辑且 ready 的草稿保存”收敛成一个有明确输入、取消和幂等语义的模块接口；系统 hydration 不产生用户草稿写入。名称缓存与用户业务内容持久化分别定义明确运行策略，避免以过滤某个市场临时屏蔽。

- [ ] 隔离数据库启动普通 /trades，无编辑时 reviews 摘要不变；明确 metadata 的允许写入合同并验证。
- [ ] 隔离数据库切换/重启，旧队列不能写入新数据库或覆盖后恢复记录。
- [ ] 实际用户编辑仍可保存、返回、重载读取；失败/取消保留输入且可重试。
- [ ] 主代理独立验收，记录触发、状态合同、截图、请求和数据库摘要；每候选最多 3 轮，超限暂停并记录。

## Counterexamples / current evidence

真实库浏览已出现 reviews PUT 和 metadata PUT。reviews 138 行数量不变但完整摘要改变；仅有与旧隔离快照的一条时间戳差异不足以证明全部影响。该票保持 FAIL，不以 API 成功或截图显示数据抵消。
