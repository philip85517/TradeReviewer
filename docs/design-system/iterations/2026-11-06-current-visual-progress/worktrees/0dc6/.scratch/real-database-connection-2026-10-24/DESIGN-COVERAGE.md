# 需求与运行时接线证据

范围依据：用户“将当前的网页接入真实数据库”。没有新 UI 元素或视觉设计；采用现有交易库控件和项目运行配置。整页视觉一致性与完整数据流均由 /root 负责；独立审计为 Astra。此次不实施首页 V2.5 新设计，不改变已暂停任务的合同。

| ID / 元素 | 精确依据 | Owner | 旅程 / 合同 | 证据及结果 |
| --- | --- | --- | --- | --- |
| DB01 服务数据源 | conf/runtime.json、scripts/start-local.mjs | /root | 3333 进程打开共享绝对路径业务库 | SERVICE-OPEN-FILES.txt；PASS |
| DB02 API 集合 | app/api/storage/trades、真实库只读查询 | /root | executions/importHistory/instruments ID 集合一致 | API-FINAL.json；PASS |
| UI01 交易库列表 | 现有 TradeLibrary，原用户 URL | /root | 原首页范围入口加载后仍可见真实记录 | CURRENT-UI.txt；FAIL，严格 live 资格合同不同 |
| UI02 交易性质 | 现有“交易性质”下拉 | /root | 普通库来源未知→实盘，旧券商来源推导实盘 | REAL-BUSINESS-LIVE-UI.txt；PASS，232/732 |
| UI03 市场 | 现有“按市场筛选”下拉 | /root | 实盘全部市场→A股，保留全部账户 | FINAL-UI-FULL.txt、FINAL-REAL-DATABASE.jpg；PASS，52/85 |
| UI04 主动刷新 | frontend-control-audit.md 刷新复验 | /root | 重载后真实数据与范围保持 | NOT VERIFIED，自动审批拒绝 |
| DATA01 数据保护 | AGENTS.md / frontend-control-audit.md | /root | 四张核心表内容不变 | BUSINESS-FINAL.json；FAIL，reviews 摘要改变 |

比较环境：现有用户浏览器视口 CSS 319×694，DPR 2，visualViewport 304×694 / scale 1，顶端滚动 0。未修改布局、字号、密度、信息层级或响应式实现。截图用于证明真实数据状态；不以它替代 V2.5 设计保真或全控件验收。未取得同态独立视觉对照，保留 NOT VERIFIED。
