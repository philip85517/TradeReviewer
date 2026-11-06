# 性质修复后的首页读取漏斗复查

2026-10-24 21:15–21:20 CST，root，systematic-debugging。Scope 为只读诊断与当前验收状态更新；不修改产品，不派发修复。财务 P1/F07、Bars 仍暂停 3/3；性质候选仍为接受的 1/3，不新增候选或重置轮数。

- [当前漏斗、卡点和证据边界](FUNNEL.md)
- [局部 UI 检查与桌面证据](CONTROL-AUDIT.md)
- [诊断任务](issues/01-current-funnel.md)
- [性质协议限定验收](../homepage-nature-contract/FINAL-ACCEPTANCE.md)

当前服务：[首页](http://127.0.0.1:4392/home)。4392 使用 `.scratch/homepage-nature-contract/evidence/preview.sqlite` 隔离副本，不是业务原库实时实例。服务继续运行；停止后可用 `./.scratch/homepage-nature-contract/START-PREVIEW.sh` 恢复，不要对运行中的端口重复启动。桌面 1440×1000 已重新加载并确认超时。源码及构建逐文件 hash 与性质验收版本一致，见 evidence/HTTP-VERSION.json。

本次诊断完成不代表首页通过验收。原始证据与旧失败记录保留；端到端 ≤1 秒、财务总额、历史模块均未通过。
