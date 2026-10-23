# Root window 02 — 离线日志分析

2026-10-23，实际 `gpt-6.1-sol / ultra`。本轮只读现存日志、候选、相关源码与本地截图；仅新增本报告、`root-window-02-analysis.mjs` 和其统计输出 `root-window-02-analysis.json`。未执行候选/preload，未启动或停止服务，未访问 HTTP、浏览器或数据库，未修改产品/依赖/配置/原证据。

**结论：窗口内确实捕获到两条真实非 GET 请求的体流消费，但没有捕获目标异常，真实非法消费者仍 OPEN。** 两条 PUT 的首个意图是 srvx 正常 Node→Web 桥接，后续是 vinext/undici Request.clone 的 tee 与 Node 读完；不能把这条正常路径定为 body disturbed/locked 的根因。日志在 03:57:49.115 +08 耗尽；之后的读取超时不在可观测窗口内。GET `/home` 本来就被漏记。本次没有“已修复”或产品接受结论。

## 输入、时间与复核方式

全部 NDJSON 行成功解析，无缺失/重复 sequence；所有带请求 ID 的行均有先行 request-entry。统计脚本使用固定 Node26，执行 exit 0，输入前后 SHA 相同；只做离线断言/聚合，不启动应用。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/homepage-v25-implementation/evidence/P1/round3/request-body-peer/root-window-02-analysis.mjs
```

| 输入 | SHA256 | 内容边界 |
| --- | --- | --- |
| `root-window-02.33284.ndjson` | `e5bbfefcdafceaf70e34db934c7de70fc5a07b4940c6cbbcc31ad08c419ba334` | 286 bytes / 2 行：preload + observer-ready；0 请求 |
| `root-window-02.33286.ndjson` | `0ae599f389904d3464f2672c6cb3b555a3e1459791407c545a24dbee79c4e277` | 928349 bytes / 2002 行：preload + seq1..2000 + seq2001预算 marker |
| `candidate-observer.mjs` | `864628680b8aaaaa0a8628390a31a8526271bce3add330e9f0bd0d8a3f646613` | 原候选未改 |
| `candidate-preload.mjs` | `2cc07345628ba3b43439dedcea55d0eccee9625ad58f48f7e2fc0324b1fa3733` | 原候选未改 |

子进程 33286：preload 03:57:20.864；首 request-entry 03:57:23.570；最后带时间事件 03:57:49.115（均 +08）。预算 marker 没有 at 字段，紧接该最后事件，不能为 marker 另造精确时间。70 个请求低于 200 请求预算，实际耗尽的是 2000 事件预算。`server-dispatch-return` 只说明 dispatcher 同步返回，不等于响应成功或落库。

## 已覆盖 method/path

| 捕获 method/path | request-entry | 所属事件行 |
| --- | ---: | ---: |
| GET `/trades` | 1 | 30 |
| GET `/api/trading-room/cash/baselines` | 8 | 240 |
| GET `/api/trading-room/cash` | 8 | 240 |
| GET `/api/trading-room/fx` | 4 | 120 |
| GET `/api/trading-room/principal` | 2 | 60 |
| GET `/api/trading-room/reference-capital` | 2 | 60 |
| GET `/api/instruments/resolve` | 8 | 224 |
| GET `/api/storage/market-data` | 19 | 469 |
| GET `/api/storage/instruments/metadata` | 4 | 120 |
| GET `<redacted-path>` | 12 | 360 |
| PUT `/api/storage/reviews` | 2 | 76 |
| **合计** | **70：68 GET / 2 PUT** | **1999** |

其余 seq1 为 observer-ready。按当前 capture 条件，12 条已捕获但路径未知的 GET 属于 `/api/` 前缀未列入白名单的路径；不能恢复其精确 endpoint 或从旁证擅自补名。窗口没有已捕获 POST/PATCH/DELETE/HEAD；没有响应 status 或 body，因此不能据此证明 metadata PUT/429 不存在。

全局 phase：request-entry 70、server-dispatch-return 70、getter-begin 666、getter-return 665、consumption-intent 132、operation 266、node-end 64、node-close 64、web-body-returned 2。**operation-throw / node-error / node-aborted / capture-unavailable / patch-unavailable 均为 0。** 这些零仅适用于采样覆盖内公开同步边界。

getter-begin 为 `srvx:body` 200 与 `srvx:_request` 466；return 分别 200 与 465。最后 seq2000 是 rb-33286-67 的 `_request` getter-begin，下一行直接预算 marker；相差的 1 条 return 不能解释为 throw 或挂起。六个最后进入请求（65–70：2 resolve、4 market-data）没有记录 end/close/first-intent，均受窗口截断影响，不能据此判定六个失败。

## 最早意图、真实非 GET 与异常边界

最早 body getter 是 seq4、03:57:28.404，GET `/trades`，栈为 `cloneRequestWithHeaders → appRscHandler → plugin-rsc`，正常 return。最早消费意图是 **seq24、03:57:33.934，rb-33286-1 GET `/trades` 的 `node:resume`**；栈为 `IncomingMessage._dump → resOnFinish → ServerResponse.emit`。这是响应收尾的 Node 自动排空意图，不是已确认的非法上游业务读者。

全部 first-intent：62 次 `node:resume`、2 次 `node:on:data`；全部意图：resume 64、read 64、on:data 2、web:tee 2。实际 operation：resume 70、read 194、web:tee 2；没有公开 getReader/reader.read/srvx.text/json 操作事件。没有这些事件不等于没有下游消费：clone 后的 native Request / tee 分支及内部实现不全部由本观察器包装。

| 序列 | rb-33286-46 | rb-33286-50 | 可证实的解释 |
| --- | --- | --- | --- |
| PUT `/api/storage/reviews` 进入 | seq1280，03:57:48.595 | seq1380，03:57:48.669 | 入口 raw Node disturbed=false，非合成请求 |
| 首意图 `node:on:data` | seq1283，03:57:48.626 | seq1411，03:57:48.691 | `newReadableStreamFromStreamReadable → Readable.toWeb → srvx body → cloneRequestWithHeaders → appRscHandler`；正常桥接自然安装监听 |
| 自然 Web body 返回 | seq1284，03:57:48.627 | seq1412，03:57:48.691 | 两次均 locked=false、disturbed=false；仅首次快照 |
| `node:resume` | seq1304，03:57:48.631 | seq1432，03:57:48.693 | Web adapter pull；不是额外业务读取栈 |
| `web:tee` | seq1306，03:57:48.637 | seq1434，03:57:48.695 | `undici cloneBody → cloneRequest → Request.clone → NextRequest → wrapRequest → runAppRouteHandler` |
| 首 read 意图 | seq1309，03:57:48.639 | seq1437，03:57:48.695 | Node resume_ 自然读取 |
| 首 raw Node disturbed=true | seq1312，03:57:48.639 | seq1440，03:57:48.696 | 证明原 Node 体流已进入消费；不独立证明 Web Request 非法 |
| node-end / node-close | seq1315/1316，03:57:48.639 | seq1443/1444，03:57:48.697 | raw Node 流已读完/关闭，均 aborted=false；无目标 throw |

两条 PUT 各有 38 行，原文件行区间分别 1281–1318 与 1381–1446（第二条与别的请求交错）。无响应 status、内容或事务证据；不宣称保存成功。静态 route 的 PUT 第37行自然 `await request.json()` 是预期解析入口，但日志没有对该 handler 内解析成功与具体分支建立相关证据。本轮不执行解析或数据库操作。

安装包静态代码与上述正常链一致：srvx `body` 对非 GET 调 Readable.toWeb；`_request` 以自然 body 创建 NativeRequest。vinext clone helper 的 fallback 自然访问 body/redirect 等；NextRequest 对已有未用 Request 调 clone。日志中的 `.ts` 栈是 source-map 名称；实际读取文件为 dist 版本，而非假称存在 `node_modules/vinext/src/` 文件。

| 当前只读源码 | SHA256 |
| --- | --- |
| `node_modules/srvx/dist/adapters/node.mjs` | `4fb7ded812c93f17c0dc09605145f1f7846c97a1c754cec20cd1696235baa52a` |
| `node_modules/vinext/dist/server/request-pipeline.js` | `d69e2c414f3c8c2beae176e69cdc3717f928841572bdadef77d700b58d1afb36` |
| `node_modules/vinext/dist/shims/server.js` | `95c7ca648241ef870b7d12d26bfe804cf7ffe2a53b809906c5ea18ed469f0627` |
| `app/api/storage/reviews/route.ts` | `f096f37d16fd815dedb5f0a58ec6af6242c1ec14e87b110b4e9d6536f88e9830` |

## 未覆盖、扰动候选与现场证据分层

**GET `/home` 缺口。** 原 safeRoutes 不含 `/home`，未知非 API GET/HEAD 被跳过，`.rsc` 后缀正规化也无法修补缺失条目。因此 `/home` 与 `/home.rsc` 没有 raw ID，这个窗口不能用于排除首页 document/RSC GET 的异常。POST `/home` 理论上捕获但脱敏为未知路径；窗口也没有这项记录。此点已由原 OB01 合成反例证实，本次未改候选。

**事件预算不是包装预算。** 耗尽后 emit 停止、capture 不再追踪新请求，但原 active 仍 true；已追踪请求继续经过 wrapper、记录 seen 状态，新的自然 stream/reader 仍可能增加包装/恢复项。666+665=1331 个 getter 事件占前2000事件的66.55%，且其 stack 与同步文件写入增加扰动。不能从事件数计算实际耗时或断言观察器导致超时；也不能宣称预算后已卸载/零开销。OB02/03 保持有效：Web 初始状态不代表后来 throw 时状态。

**HMR/元数据风暴只有部分可直接观测。** NDJSON 确认大量 resolve/market-data/metadata 与 cash 等 GET 重复，不能记录响应状态、HMR 或任意查询。root 在本轮消息补充：未落盘的 `write_stdin(session58899)` 输出曾有 **03:57:43 连续6次 globals.css HMR**，以及 metadata/resolve 的大量 GET/PUT/429。此为 root 现场文字证言；本报告未取得该 stdout/Network 原始文件，不能从 NDJSON 反推 HMR 或 429。静态/HMR GET 被设计排除，metadata PUT/429 也不在已捕获70请求内。HMR造成重挂载/重新请求、接口限流/慢读、冷启动编译，以及观察器同步日志/包装时序，均可能干扰窗口；各自因果与超时关联 **未证实**。

**超时与附件必须分开。** root 现场补充：03:59+ 的 CUA getAXState 当时显示“读取已超时，新范围未应用。”及 A股74持仓，随后已撤回候选，并用同隔离 DB/3333 恢复无探针。此为 root 的现场证言，本 agent 未执行或重查浏览器。现落盘 `root-window-02-timeout.ax.txt` 与 PNG 实际只显示“正在连接交易数据 / 正在从 SQLite 读取交易记录…”，root 说明附件取得边界可能在 stop/restart 后，不能把该图冒充超时原帧。PNG/AX 与超时现场时序不等同。它们的 SHA 记录在统计 JSON；没有精确 request ID/HTTP 状态把 03:59+ 超时连回 03:57:49 前某个请求。

## 结论状态与最小后续约束

- **已证实：** 有真实非 GET 体流被消费；当前捕获的两条 PUT 展示正常 adapter/clone 路径，无目标同步异常；事件预算确实截断日志；首页 GET 未覆盖。
- **仍 OPEN：** 原 intermittent disturbed/locked 的失败请求身份、异常前真实非法消费者、03:59+ 超时原因、HMR/限流/候选的各自影响。不存在“未复现即修复”的接受结论。
- **当前动作：** 保持原候选与历史证据，服务是否恢复以 root 现场归属记录为准，本 agent 不做运行检查或再次激活。任何下一窗口先由 root 裁定覆盖/预算方案，绑定 stdout/脱敏 Network/自然失败栈与同请求 ID，再决定是否需要采样。不要为本分析增读 bodyUsed、添加 data listener/reader、输出用户内容或重置隔离 DB。

这份报告不修产品、不重开 S/F，不把 NR04/NR06 导航反例与本 body 异常或 root 原 Recall 现象合并归因。
