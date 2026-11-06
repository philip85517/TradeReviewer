# 本轮诊断范围与证据计划

原始依据：用户 2026-10-24“当前验收确保验收当前的桌面版本，而不是窄屏版本，目前看未连接到数据库中，诊断问题”。无新增视觉设计或产品实现。

| ID | 当前依据 / 参考 | Owner | 旅程与待证假设 | 证据 |
| --- | --- | --- | --- | --- |
| D01 桌面环境 | 当前首页 + 用户桌面要求；目标 1440×900 | /root | 确认 CSS 视口、缩放、截图、URL | 浏览器环境/截图 |
| D02 真实 DB | conf/runtime.json / 服务实际打开文件 | Astra runtime | 3333 实际共享库路径及库存是否一致 | lsof、只读摘要、API |
| D03 首页数据源 | homepage-source route 与 snapshot contract | Astra source | 真实库存有没有在服务/客户端边界丢失 | 源码行号、确定性只读探针 |
| D04 资格与范围 | 原 live/a/*/all query；现有普通库为工作对照 | Astra source | 显式 live 与历史券商推导是否导致清空 | 各层数量/性质证据 |
| D05 加载/错误/空态 | 首页 acquisition/host/view model/current surface | /root | 未连接、加载失败、资格过滤分别如何呈现 | 桌面 AX、console、网络及代码 |

排除：本轮窄屏验收、全部控件操作、业务库写入、修复实现、已暂停任务第 4 轮。历史截图和源代码结论不能替代当前桌面浏览器实际证据。桌面诊断不是首页 V2.5 整体验收通过。

## 本轮结果

| ID | 结果 | 具体证据 |
| --- | --- | --- |
| D01 | PASS：1440×900 / DPR1 当前真实桌面页面 | [环境](BROWSER-ENVIRONMENT.json)、[桌面截图](DESKTOP-HOME.jpg) |
| D02 | PASS：实际业务库连接；API 全量 ID 一致 | [运行审计](RUNTIME-AUDIT.md)、[HTTP 证据](runtime-api-approved-attempt.json) |
| D03 | 源码消费链已诊断；本轮新初始化 HTTP 时序 NOT VERIFIED | [源码链](SOURCE-TRACE.md)、[汇总](DIAGNOSIS.md) |
| D04 | 确认 strict live 与 broker display live 差异；当前空行不能作为已完成筛选证据 | [运行审计](RUNTIME-AUDIT.md)、[源码链](SOURCE-TRACE.md) |
| D05 | FAIL：timeout/加载文案矛盾、空 seed 呈现真实空态、历史未接线 | [局部 UI 审计](UI-AUDIT.md)、[DOM](DESKTOP-DOM.txt) |

独立诊断由 /root 实际浏览器检查并核对两名 Astra 审计形成，非根据 worker PASS 宣称交付。修复和原 3 / 3 暂停项未恢复。
