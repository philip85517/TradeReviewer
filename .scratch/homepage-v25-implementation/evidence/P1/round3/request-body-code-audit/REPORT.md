# Request-body 有限源码诊断：Node 终态桥接会自行生成 disturbed body

2026-10-23；`gpt-6.1-sol / ultra`。只读诊断完成并冻结；**真实失败请求和它的 abort/drain 来源仍 NOT VERIFIED，未修复，P1 正式仍 2/3 FAIL。** 本报告不增加正式验收轮次、不改名绕过第三 FAIL 暂停规则。

本轮发现的新增事实是：**无需先消费或锁定任何 Web Request，Node26 的 `Readable.toWeb` 对已经 destroyed 或不可读的 IncomingMessage 会先 cancel 一个新建 Web stream，再返回它；srvx 随后首次 `_request` 就会抛目标错误。** 两个纯内存终态分支均通过原安装版本的 vinext helper 得到 `extractBody → srvx _request → redirect → cloneRequestWithHeaders` 栈。它们是具体候选分支的可执行充分条件，不是原应用失败现场，也没有定位原请求的实际上游来源。

## 范围、版本和精确阅读输入

- 根目录 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`，`git branch --show-current` 为空（detached HEAD），工作树保留原有 dirty/untracked 内容。
- 只新增本目录文件；未改产品/依赖/测试期望/配置/共享 tracker，未启动、重启、停止或访问服务、浏览器、HTTP、DB，未激活 observer，未派子代理、commit、push。
- root 提供的现有 3333/session88778/显式隔离库运行信息只作为任务边界，worker 没有重新读取或改变其运行态。
- 触发：P1 实际 UI 报错的局部源码诊断。UI 点击、持久化、视觉、本次实时服务兼容性均没有执行，不能据此计入控件执行覆盖或产品接受。纯诊断文档和离线脚本不新增 UI/DB 验收义务；原 feature 的相关门槛仍由 root 保留。

先读并沿用：

- `AGENTS.md`。
- `docs/agents/development-workflow.md`、`docs/agents/frontend-control-audit.md`、`docs/agents/task-decomposition.md`、`docs/agents/ui-task-templates.md`。
- `/Users/zhoulin/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/systematic-debugging/SKILL.md`；另读同目录上级 `using-superpowers/SKILL.md`（其 SUBAGENT-STOP 明确排除本次派发子代理）。
- `.scratch/homepage-v25-implementation/evidence/P1/round3/ROOT-REQUEST-BODY-DIAGNOSIS.md`。
- 同 round3 下 `request-body-bounded/README.md`、`HYPOTHESIS.md`、`ROOT-WINDOW-CHECKPOINT.md`、`ROOT-WINDOW-02-SUMMARY.json`、`bounded-observer.mjs`（相关状态/身份/包装代码）、`bounded-observer.test.mjs`（内存 fixture 与相关用例）；没有重跑旧观察器/旧 fixture。
- 同 round3 下 `request-body-peer/PRODUCTION-CALLGRAPH.md`。该报告已完成的普通前置 middleware 候选追踪没有当作本轮新发现重复汇报。

新增源码阅读：

- `node_modules/srvx/dist/adapters/node.mjs:200–329,715–730`，`node_modules/srvx/dist/_chunks/_url.mjs`。
- `node_modules/vinext/dist/server/request-pipeline.js:371–407`，`node_modules/vinext/dist/server/app-rsc-handler.js:272–299`。
- `node_modules/@vitejs/plugin-rsc/dist/plugin-BhzHKRFo.js:772–790`。
- **固定 Node 二进制自身内嵌源码**，通过 `process.binding('natives')` 只读取得 `internal/deps/undici/undici`、`internal/webstreams/adapters`、`internal/streams/readable`、`_http_server`、`_http_incoming`；不是 npm 中另一个 undici 版本。精确行号摘录见 `PINNED-NODE-SOURCE-EXCERPTS.txt`。
- `app/lib/storage/sqlite-http-client.ts:74–178`、`app/lib/storage/review-summary-client.ts`、`app/lib/storage/sqlite-repositories.ts:139–158`；`app/components/trade-review-workspace.tsx:1239,2408,3268–3302,5593–5625`，以及对该文件/存储目录的 AbortController/abort/signal/PUT 只读检索。

## 已确认的所有权链和反证

1. **原生首次构造不是这组固定输入的 body 消费者。** srvx 把自己的 prototype 接到 NativeRequest.prototype（node.mjs:287–288）。Node26 undici 的 `MakeTypeAssertion` 使用普通 prototype hasInstance（内嵌 :4739–4741），所以 `new Request(raw,{headers})` 认它为 Request，随后 :11872 访问 `input.#state` 直接失败。body 提取与 `pipeThrough` 在 :12066–12108，尚未执行。四个内存 case 的首次错误均为 `Cannot read private member #state from an object whose class did not declare it`，Node 状态不变且新增 data listener=0。此反证限定于本次固定原生全局 Request/未补丁的 srvx；不能外推到未知 realm/全局替换。
2. **新的首次 Web disturbance 所有者是 Node bridge 内部 cancel。** 原 helper fallback :387 读 `raw.body`，srvx :258 调用 `Readable.toWeb(N)`。Node `internal/webstreams/adapters:479–482` 在 `isDestroyed(N) || !isReadable(N)` 为真时执行 `new ReadableStream(); readable.cancel(); return readable`。新流 S 此时 unlocked，但 disturbed；该 cancel 没有读取 payload。接着 fallback :388 的 redirect getter → srvx `_request:274` → undici `extractBody:6745–6747` 拒绝 S，首次 #request 赋值未完成。
3. **Node 终态和正常传输完成不同。** `complete=true`（HTTP parser payload 已完整到达）本身不触发此分支；fresh 完整缓冲但未读 case 成功。Node 完整 drain 后 `readableEnded=true, destroyed=true, readableAborted=false, complete=true, aborted=false` 是正常结束后 autoDestroy；不是 abort。未读即 destroy case 为 `readableEnded=false, destroyed=true, readableAborted=true, complete=false, aborted=true`。两者都在同 bridge 分支制造 disturbed S，但不同上游原因不能混称。
4. **Node disturbed 不是读取字节或 Web unusable 的充分证据。** partial-read 的 N 已 disturbed 但仍 readable，S 保持 clean，原 helper 成功且剩余 `B` payload 正确。destroy-before-read case 的 N 也 disturbed，却没有先读 body。因此 first-intent/Node disturbed 标签不能定责实际非法读取。
5. **真实可达的 abort 来源存在，但尚未绑定原请求。** Node `_http_server:840–849` 的 socketOnClose → abortIncoming → req.destroy(ConnResetException) 是实际实现；`_http_incoming:218–222` 在未完成读取/消息时设置 aborted。plugin-rsc :782–784 在创建 NodeRequest 前 await resolve/import；appRscHandler :274 在首次 clone 前 await instrumentation（即使 hook 不存在也有 await 边界）。这提供“非 GET 在惰性桥接前已被断开”的可达时间窗口，**没有证明原事件在该窗口取消**。
6. **暂不能指向保存代码主动 abort。** 当前默认 putReview/putReviewState 等使用 `jsonRequest`（sqlite-http-client:101–107,164–167），summary PUT 在 review-summary-client:60–65；这些请求没有传 AbortSignal。drawing 队列跳过过期 sequence 发生在发请求前，已发请求随后只忽略过期结果，并未 abort（workspace:3275–3282）。页面刷新/连接关闭、其他非 GET、其他注入 fetcher/环境仍未排除，不能据此断言“自动保存取消”是根因。

现有 bounded 观察器在 `Readable.toWeb` **返回后**才给 S 关联请求身份。bridge 在返回前的内部 `readable.cancel()` 当时没有 S→request 映射，公开 cancel wrapper 就可能没有可记录 meta。因此“未见公开 Web consumer”不排除这个分支；新第一条自然 body 返回若已 disturbed，也不应自动归因于业务 json/text。

## 可执行矩阵与实验历史

精确命令（工作目录为上述 worktree；root 可独立执行，脚本只 stdout，不自行写文件）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node .scratch/homepage-v25-implementation/evidence/P1/round3/request-body-code-audit/memory-node-terminal-repro.mjs
```

固定 Native Node `v26.0.0`；srvx `0.11.15` / vinext `0.0.50`。使用没有 socket 的真实 IncomingMessage/ServerResponse、真实 srvx NodeRequest 和原安装版 clone helper，不导入业务模块。没有预先消费/锁定 Web Request，没有 global Request 替换和 prototype observer。所有 body 读取仅用于成功 case 的结果校验，发生在 clone 返回后。

| case | N disturbed / readable | N ended / destroyed / readableAborted | complete / aborted | S 首次状态（helper return/throw 后、读前） | helper 结果 |
| --- | --- | --- | --- | --- | --- |
| fresh（完整缓冲未读） | false / true | false / false / false | true / false | unlocked / undisturbed | 成功，payload `AB` 正确 |
| node-partially-read（Node 先读 A） | true / true | false / false / false | true / false | unlocked / undisturbed | 成功，剩余 payload `B` 正确 |
| node-drained（完整预读并正常 end） | true / false | true / true / false | true / false | unlocked / disturbed | 目标 extractBody→_request→redirect 错误 |
| node-destroyed-unread（未读即 destroy） | true / false | false / true / true | false / true | unlocked / disturbed | 同目标错误 |

- 第 1 次本地脚本执行 exit1：fresh case 成功；partial fixture 在 socket=null 时先 read 再 push EOF，触发 IncomingMessage `_read:211` 对 null socket 的访问，使 fixture 自身 destroy，随后新 Web body 的 disturbed=false 断言失败。`memory-node-terminal-results.ndjson` 保留当次 stdout；原 stderr 仅保留于本次工具执行输出，没有另存文件。未把该 fixture 失败计作产品问题或候选假设被证实。
- 第 2 次修正纯 fixture：先缓冲完整 AB+EOF 再读1字节，exit0；`memory-node-terminal-results-02.ndjson` 完整四 case，`memory-node-terminal-stderr-02.log` 为空。没有改产品或测试期望。
- 第 3 次仅追加 root 要求的 readableAborted/Node isReadable 观察字段，exit0；最终 `memory-node-terminal-results-03.ndjson` 完整矩阵和 PASS 断言，`memory-node-terminal-stderr-03.log` 为空。**本子任务已执行 3 次本地矩阵命令，冻结，不再追加第四次实验。** 这 3 次本地命令不冒充 P1 正式验收轮次。

## 下一次真实保存的最小观察提案（未实现、未激活）

先由 root 审查；只针对一次原已授权、显式隔离 DB 上的真实保存旅程。保存入口对应的固定路径由原 UI/源码确认（已读候选为 PUT `/api/storage/reviews` 或 `/api/storage/review-summaries`），不能从脱敏旧日志反造 endpoint。既有服务保持无探针，直到 root 明确选择观察窗口；不在本任务自动重启或部署。

**硬预算建议：** 单进程安装起 ≤60秒、最多4个命中保存 allowlist 的非 GET 请求、≤128事件、≤64KiB序列化缓冲、≤64个自有 descriptor；静态 GET 不分配 request/stream 映射也不消耗这4个目标名额，仍服从全局60秒。首个目标 throw 或任一预算即卸载并一次 flush，保留 stop/恢复计数；缺文件/截断不能叫无复现。禁止无限延长或静默再装一轮。

最小事件集合：

1. 自然 HTTP request-entry 给 N 一个 WeakMap ID；只记录 method、固定安全路径、PID/seq/time，以及被动 `readable, Readable.isReadable, readableEnded, destroyed, readableAborted, complete, aborted, Readable.isDisturbed`。不碰 srvx body/bodyUsed/redirect/clone。
2. 对同 N 的**自然** `Readable.toWeb(N)` 调用，记录 call-before 的上述 Node 状态和 N ID；只调用原函数一次；返回后为实际返回 S 赋新 ID，记录 N→S、`locked` getter/`Readable.isDisturbed(S)` 和 Node after。不调用 reader/cancel/tee/pipe，不订阅 data/readable，不做 Promise then。
3. 自然 NodeRequest body getter返回只关联它确实返回的 S（记录是否就是该 toWeb 返回 S、是否已有 cached S）；自然 `_request` return/throw 记录同 N/S 和终态/原始目标错误栈。不为采样主动读取 getter。每 request 最多一条目标 throw 栈；若启用下项 destroy 来源观察，再最多一条 destroy 栈，每栈最多6帧/2KiB，仍服从总事件/字节预算。
4. 为目标 N 加不启动流动的 `aborted/close` 一次性生命周期记录；若需定位终态来源，可另审**只对被映射 N 的自然 destroy 调用**记录首个位置栈与调用前状态，不输出 error message、payload、chunk长度、header/query值，不改变调用/返回/异常。正常 end 的证据用 readableEnded/complete/response终点，不能加 data listener。Node destroy来源栈若缺失，保留来源 NV。
5. root 同窗另存真实浏览器的 method、固定path、status/取消状态、initiator、时间、原 overlay/终端栈及实际前一动作；原请求payload不导出。记录保存→返回→reload 与真实隔离持久化证据，避免把另一条成功保存和某条被取消请求合并为一个 ID。

判读：若同 N 在 toWeb 前已 destroyed/不可读，首次自然返回 S 即 disturbed，随后同 S 在 `_request` 抛目标错误，可把**首个 Web disturbance 所有权**绑定到本 Node bridge cancel 分支；还需 Node destroy栈/生命周期/浏览器取消证据判定是 abort 还是完整预读。若 N→S 初始 clean 后才变坏，本提案未覆盖其所有 Web 消费者，保留原 cached-stream/后续消费方向 NV；若首次 S 未映射、预算前没有真实非 GET 或缺原错误，同样 NV。GET正常不能替代任何一条非 GET 证据。

## 冻结结论

- 新候选分支和反例：本地内存验证 PASS。
- 首次原生构造的 pinned #state 分支：静态+本地验证，排除其在该输入上先读/转移 body。
- 原应用实际失败 request method/path/ID、首次 Node 终态来源、是否经历该分支：**NOT VERIFIED**。
- 原故障修复、真实保存持久化、UI/视觉接受：**未执行/未通过本报告证明**。
- 无补丁建议；root 可独立复跑矩阵和审查观察提案，P1 正式 2/3 FAIL 保留。
