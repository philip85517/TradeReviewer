# Vite 请求体异常：未定位，保留现场与证据限制

2026-10-23 03:18 CST，root。状态 NOT VERIFIED / 尚未修复。遵循 systematic-debugging：先定位实际请求来源，不猜测修改框架。

此前浏览器重新进入交易页时观察到 `Response body object should not be disturbed or locked`，堆栈为 undici extractBody → srvx NodeRequest._request → redirect getter → vinext cloneRequestWithHeaders → appRscHandler。03:09–03:11 的实际完整刷新、展开、进入 Recall、返回普通库未再复现。浏览器控制台 error/warn 为空仅证明这次操作，不能关闭原问题。

证据限制：`reload-request-body-overlay.png` 与同名 ax.txt 经 root 重看，实际仅包含 SQLite loading 状态，并未保存错误 overlay；文件名不能作为已捕获 overlay 的依据。堆栈来源是当时屏幕读取。`request-adapter-diagnostic.json` 才是本次确定性适配层探针输出。

固定 Node26，实际 srvx0.11.15 / vinext0.0.50：未读取的 GET/POST/PUT 均能通过原 clone 并读取；预先 getReader 锁定或 text() 消费的 POST body 均产生与观察相同的异常和 redirect getter 堆栈。因此已证实“非 GET body 已锁定/消费”足以触发这个框架路径，**尚未证实谁对实际请求做了这件事**。普通 GET 刷新本身不是已证明根因。没有改 node_modules，没有隐藏 overlay，没有用 API 绕过交互。

下一次复现须在框架入口记录 method、URL、bodyUsed/locked 和前一动作，追查请求进入 RSC 适配前的消费者。自动保存/中断仅是假设；若无可重复证据，不作修复结论。独立可推进的 P2 数据和 P3 搜索切片继续；这项未定位问题仍保留在整页接受边界。

本次真实重载后 Recall 100/90/120 重新显示的局部正证据另存 `recall-reopen-after-real-reload.{ax.txt,png}`，不替代 503/409、完整持久化或最终版本验收。
# 2026-10-23 04:08 CST root 观察窗口与撤回补记

03:57 CST root 经独立候选测试后激活一次有界 preload 观察窗口，父33284/子33286、同显式隔离 DB/3333，不重置 DB。原候选 SHA 及日志见 `request-body-peer/ROOT-WINDOW-02-ANALYSIS.md`。有效日志 03:57:20.864–03:57:49.115，70 请求（68 GET/2 PUT），无捕获到目标异常；两条 PUT 显示正常 srvx Node→Web 和 Request.clone/tee。GET /home 覆盖缺口、2000事件预算截断及同步日志/包装时序扰动均明确保留。不能从零异常推断已修复，不能把正常 Node disturbed 判为非法消费者。

root 现场 03:59+ 曾看到“读取已超时，新范围未应用。”；随后附件抓取跨越重启边界，`root-window-02-timeout.ax.txt/.png` 实为 SQLite 正在连接，不是该超时原帧。03:57:43 六次 CSS HMR 及 metadata/resolve 重复/429 仅为 root 工具输出现场证言，未保存 stdout 文件，不从 NDJSON 反造。超时与 HMR、冷编译或探针的因果未证实。

root 已于约04:00撤回观察器并终止33286，用同隔离 DB/同3333恢复无探针服务（子33597，session72713），实际页面重新读到 A股74持仓。未改 node_modules、框架、配置或业务 DB；候选/日志保留。当前真实非法消费者与原错误仍 OPEN，不再次自动加探针或猜测框架修复。NR04 导航缺陷另有真实 RED，见 `ROOT-NAVIGATION-RECOVERY-DIAGNOSIS.md`，不能混并归因。

