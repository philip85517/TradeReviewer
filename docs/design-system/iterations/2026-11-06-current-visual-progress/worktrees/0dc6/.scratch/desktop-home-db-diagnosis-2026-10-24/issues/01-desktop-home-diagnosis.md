# 当前桌面首页数据库与显示链诊断

ID: DESKTOP-HOME-DB-DIAGNOSIS
State: closed
Status: accepted（诊断范围）
Assignee: /root
集成负责人: /root
Implementation: 无；本票只读诊断
审计协作: /root/astra_desktop_runtime、/root/astra_home_source_trace（GPT-6 Astra Ultra）
Blocked by: 无（诊断）；后续修复继承既有暂停/依赖，不在本票实施
Iteration: diagnosis only；原 P1/F07、ContributionBars 3 / 3 FAIL / 暂停不变

## What to build / Scope

按用户“当前验收确保验收当前的桌面版本……未连接到数据库中，诊断问题”要求，核对当前桌面环境、服务真实数据库、API 库存、首页读取/资格/状态/历史渲染链，输出有边界的诊断。没有修复授权扩展或重新计算原任务轮数。

## Refs

- 用户当轮 systematic-debugging 指示及 AGENTS.md 当前流程。
- [范围矩阵](../DESIGN-COVERAGE.md)、[诊断](../DIAGNOSIS.md)、[UI 审计](../UI-AUDIT.md)。
- [运行审计](../RUNTIME-AUDIT.md)、[源码审计](../SOURCE-TRACE.md)。

## 验收

- [x] /root 直接在真实页面核对 1440×900 / DPR1，保存[环境](../BROWSER-ENVIRONMENT.json)、[DOM](../DESKTOP-DOM.txt)与[截图](../DESKTOP-HOME.jpg)。
- [x] lsof/inode 和 DB/API 全量 ID 摘要交叉确认[实际业务库](../RUNTIME-AUDIT.md)。
- [x] [区分超时未提交、严格 live 资格和历史未接线](../DIAGNOSIS.md)；不将 UI 的 0 误报为真实空库。
- [x] 用[源码链](../SOURCE-TRACE.md)解释 timeout 后的空 seed、ready 与 null view 呈现问题。
- [x] [保留当前网络/CPU 细分 NOT VERIFIED](../DIAGNOSIS.md)，历史测量不冒充当前版本。
- [x] 协调者核对[链接、内容指纹和当前服务](../FINAL-VERIFICATION.json)，保存[独立验收](../FINAL-ACCEPTANCE.md)。

## 反例与未通过原因

现有页面 timeout、加载与错误同时显示、持仓空态不可信、历史未接线均保持 FAIL。诊断完成不关闭这些产品问题。本轮未 reload 真实业务库；此前初始化自动写入和审批拒绝记录继续有效。不得由此宣称完整首页/只读整段会话通过。
