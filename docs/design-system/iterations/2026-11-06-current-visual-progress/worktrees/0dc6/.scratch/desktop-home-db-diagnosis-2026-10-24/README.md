# 桌面首页真实数据库接线诊断

State: closed
Status: accepted（仅诊断；首页产品验收仍 FAIL）
Owner: /root

用户要求：按当前桌面版本验收，诊断首页看似未接数据库的问题。当前 URL `/home?scope=live&market=a&accounts=*&rangeMode=all`。仅诊断，不修改产品代码、业务库、服务配置，不恢复已达 3 / 3 暂停的实现任务。

按 systematic-debugging 收集并关联：进程实际 DB → API 源库存 → 首页资格/范围 → 财务采集与状态 → 桌面渲染。以桌面 CSS 1440×900 为首选，至少宽度 1280；窄屏仅作历史记录，本轮不用于证明桌面通过。主代理负责实际浏览器，Astra 只读并行审计运行数据和源码。

触发 frontend-control-audit；范围为首页加载、范围值、数据状态和可见反馈的诊断，不作全控件/写流程/完整视觉设计交付。优先读取既有用户页面；已知初始化可写复盘/metadata，因此不主动 reload 真实库、不改 URL 绕过此前审批拒绝；若必须新开页面，采用 WAL-aware 隔离快照与独立端口并明确其证据边界。

诊断由 /root 独立核对并接受：当前真实业务库已连接；当前桌面首页首读超时，没有发布财务数据，空初始持仓却显示成“暂无持仓”。旧券商性质推导与首页严格 live 资格不同；历史区域尚未接线。当前各请求/CPU 阶段耗时仍 NOT VERIFIED。既有窄屏 52/85 证据不用于本次桌面首页验收。

- [诊断结论](DIAGNOSIS.md)、[独立验收](FINAL-ACCEPTANCE.md)、[诊断任务](issues/01-desktop-home-diagnosis.md)。
- [桌面截图](DESKTOP-HOME.jpg)、[环境](BROWSER-ENVIRONMENT.json)、[前端局部审计](UI-AUDIT.md)、[范围矩阵](DESIGN-COVERAGE.md)。
- [运行审计](RUNTIME-AUDIT.md)、[源码链](SOURCE-TRACE.md)、[实际性质函数探针](source-policy-probe.json)。
- [最终校验](FINAL-VERIFICATION.json)、[服务仍运行](FINAL-SERVICE.txt)。

已有产品发现继续保持 open：[超时](../homepage-v25-implementation/issues/16-p1-homepage-timeout-finding.md)、[终态呈现](../homepage-v25-implementation/issues/15-p1-terminal-state-finding.md)、[历史贡献](../homepage-v25-implementation/issues/07-history-contribution.md)、[真实库初始化自动写入](../real-database-connection-2026-10-24/issues/02-automatic-writes.md)。本轮不恢复 P1/F07、ContributionBars 原 3/3 暂停，也不将诊断接受视为首页交付。
