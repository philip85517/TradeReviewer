# NR-PEER-01 有限独立复验

记录：2026-10-23 04:41 CST，独立接受者 /root。P1 正式仍为 2/3 FAIL；本记录不启动第三次整票验收。

## 版本与范围

host `3218407b84c45656989bc0a2ac700c9741e6c55135f55ed2873e7ed2b968b167`；Surface `c6e14890fe36eb99e2dd03ba43608f7ced1ad482bdb57a757e09b8884f4d30b6`；CSS `d34b54ab5eb9b5232847607d3b5c94e9b93833da3703b2292793066e6dff43d1`。完整依赖指纹见 `ROOT-COMBINED-FREEZE.json` 和 `root-06-navigation-surface-77.json`。随后派发的 P3 CR03 视觉修改不在本版本证据范围。

触发：pending 期间 onUi 克隆请求对象，旧 effect 按新 effect 时间重新给满 15 秒，关闭/重开搜索可延迟失败恢复。原独立 RED 为 2 FAIL/3 PASS；仅按请求 startedAt 计算剩余期限，并核对 generation/scopeKey/startedAt，未改变 S、预算或来源权威。

## 独立执行

- root 固定 Node 26.0.0 执行 host/session/navigation-recovery/navigation-deadline/Surface/search/catalog/search-recovery 共 8 文件 **77/77 PASS**，exit 0；20:28:17.142–20:28:37.429Z，运行前后受保护输入一致。完整命令、日志和字节证据在 `root-06-navigation-surface-77.json/.log`。实现者的 48 PASS 不替代此结果。
- 真实浏览器、隔离数据库、受控代理仅延迟 `/api/trading-room/fx` 30 秒。窗口二从 20:34:32.807Z 开始，代理收到请求 20:34:32.888Z；4.150 秒关闭搜索，7.446 秒重开，7.599 秒仍 loading 且 Enter/ArrowDown 没有打开详情。
- 18.610 秒观测已转错误、loading=false、detailCount=0，查询 `6` 与输入焦点保留，URL 仍为 A 股来源。若重开 onUi 从 7.446 秒重给 15 秒，则最早约 22.4 秒才超时；本观测排除了该重置回归。证据 `root-window02-loading.ax.txt`、`root-window02-reopen.ax.txt`、`root-window02-loading-keys.ax.txt`、`root-window02-after-wait.ax.txt`、`root-window02-timing.json`，代理时间见上级 `navigation-fault-requests.jsonl`。
- 浏览器采样只支持转态发生于 **(7.599s, 18.610s]**，不能宣称浏览器精确 15.010 秒通过。等待工具虽传 20 秒，实际 3 秒结束并抛等待超时；这是采样中断，后续实际快照与原记录保留，不记为产品失败或精确时刻证据。精确边界由独立组件测试覆盖。
- 受控 HTTP503 错误键盘与恢复 retry/正常 Enter 的当前浏览器证据见 `../../../P3/search-recovery-fix/ROOT-CHECKPOINT.md`。代理已恢复正常配置。

## 接受边界

NR-PEER-01 有限因果/功能 PASS；完整 P1、当前版本全部来源恢复旅程、全控件、响应式与整页视觉均未由本记录接受。原 NR04 在 host `85731c…` 上的独立真实 PASS 仍有其版本效力，不能自动当作 `321840…` 全路径已复验。

间歇 request-body 原始问题仍 OPEN，实际消费者尚无因果证据；`request-body-peer/PRODUCTION-CALLGRAPH.md` 的只读审查不构成修复。原历史 FAIL 与正式轮次不覆盖。
