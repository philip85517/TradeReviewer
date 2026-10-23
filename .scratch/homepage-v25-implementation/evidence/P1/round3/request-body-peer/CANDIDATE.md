# Request-body capture candidate — not activated

2026-10-23；实际 `gpt-6.1-sol / ultra`。仅本 peer 目录新增文件；产品、依赖、配置、服务、浏览器、数据库均未改动。`REPORT.md` 原结论保持 **真实消费者 OPEN**。本候选不是根因或产品修复，不属于 P1 接受结果。

## 最小候选与记录边界

`candidate-observer.mjs` 仅导出安装/卸载函数，import 无安装和文件/端口操作。`candidate-preload.mjs` 默认关闭：必须同时设置 `TRADEREVIEW_REQUEST_BODY_TRACE=1` 和本目录内的绝对 `TRADEREVIEW_REQUEST_BODY_TRACE_FILE` 才安装。preload 仅语法检查，尚未执行；未来受控服务兼容性 **NOT VERIFIED**。

安装后，包装 `http.Server.prototype.emit('request', req, res)`，在原 dispatcher 前以 WeakMap 给原始 IncomingMessage 分配 ID。仅对已追踪同一对象观察原有 `read/resume/pipe/asyncIterator`、自然注册的 `on/addListener/once('data')`；**不注册 data listener，不读内容，不获取 reader**。包装同一安装 srvx NodeRequest 的自然 `body/_request/text/json`；原 body getter 自己返回 stream 后才观察它公开的 getReader/tee/pipeTo/pipeThrough/values/asyncIterator/cancel 及自然 reader 的 read/cancel/releaseLock。不主动取 body/bodyUsed/redirect/clone，不 attach Promise handler。

每个自然调用原实现一次，保留 this、原参数、返回值/Promise 身份、抛出对象。getter/method 的同步异常按固定 `body-disturbed-or-locked`/`other` 分类后原样抛出；不记录任意 error.message。日志失败被隔离；卸载只恢复仍属于自己的描述符，不覆盖后来第三方补丁。Node 流状态不读取 srvx 的惰性 getter。首次消费**意图**标 `first:true`，同一 operation 的重复意图不重复计数；每次 operation 保留事件序号。第一次自然 getter与消费记录包含代码帧。

日志只含时间/单调时间、PID、ID、method、固定白名单 route、Node 状态、已自然返回的 Web stream 状态、operation、固定错误分类和代码帧。query 不读取/输出，未知路径为 `<redacted-path>`；动态 ID、headers、body、chunk、参数、错误消息均不输出。代码帧去除工作目录前缀和 query，仍含代码文件位置。输出权限 0600，新文件 `wx` 不覆盖。每进程最多 200 个请求、2000 个事件（另 1 条预算耗尽 marker）；未知非 API GET/HEAD 的静态/HMR流量略过，所有 mutation/API GET保留。预算耗尽、patch/capture unavailable 都是诊断缺口，不能当作无消费证据。

## root 审核后才可执行的启动步骤

**以下命令未执行。** root 先完成 UI 保存验收、记录当前服务 PID/归属、端口、启动命令、隔离 DB 的**确切绝对路径**及已有 NODE_OPTIONS。只在 root 选择窗口后停止自己确认归属的进程，保留原隔离 DB 及其 WAL；不运行备份/reset，不复制第二业务 DB。不得把空路径回落到共享业务库。

本轮最小选择是复用 `scripts/start-local.mjs --dev`，它继承环境并保留显式 DB。`make dev/npm run dev` 会重建测试备份，**不可用于保留当前验收写入**。vinext CLI 不支持本候选 `--config`，不可依赖该参数。

先在将要启动服务的同一个 shell 中定义并核对以下变量；DB/端口用 root 已确认的当前值，禁止原样使用占位符。

```sh
task_node=/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node
task_peer=/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/.scratch/homepage-v25-implementation/evidence/P1/round3/request-body-peer
task_db='/ABSOLUTE/PATH/TO/ROOT-CONFIRMED-EXISTING-ISOLATED.sqlite'
task_port=3333
task_original_node_options="${NODE_OPTIONS-}"
```

再次核对 manifest 与候选 SHA，再由 root 执行受控启动（不能与仍占用该端口的原进程同时启动）。用新的 run label，每个进程自动追加 PID；父启动器可能只有 ready 记录，实际处理请求的 vinext 子进程才有 request-entry。设置固定 Node 的 PATH 让 vinext shebang 使用同版本。原 NODE_OPTIONS 原样保留，并记录是否本来还有其他 preload。

```sh
test -f "$task_db" && test "$task_db" != /ABSOLUTE/PATH/TO/ROOT-CONFIRMED-EXISTING-ISOLATED.sqlite && \
env PATH="$(dirname "$task_node"):$PWD/node_modules/.bin:$PATH" \
  TRADEREVIEW_DB_PATH="$task_db" \
  TRADEREVIEW_REQUEST_BODY_TRACE=1 \
  TRADEREVIEW_REQUEST_BODY_TRACE_FILE="$task_peer/root-window-01.ndjson" \
  NODE_OPTIONS="${task_original_node_options}${task_original_node_options:+ }--import=$task_peer/candidate-preload.mjs" \
  "$task_node" scripts/start-local.mjs --dev --hostname 127.0.0.1 --port "$task_port"
```

若 root 的实际已确认端口不是 3333，应显式保留该值；不自动切端口。不使用本说明决定哪个现有服务可停止，不自行 kill PID。候选不写/打印 DB 路径；root 独立记录服务实例与数据路径归属。若见 `candidate not active` / `capture-unavailable` / 预算耗尽，保留日志并记录未覆盖；不能把现有服务成功启动等同于观察器有效。

## 回滚（由 root，候选已激活时才需要）

1. 保存本次 PID NDJSON、服务 stdout 与浏览器 Network 的脱敏 method/path/status/initiator/时间；不要保存请求 body、敏感 query。记录最后动作及 overlay真实栈，不能用当前页面 URL 代替失败请求。
2. root 停止本次自己拥有的候选服务，然后按**原启动命令**、同一隔离 DB 和端口启动；不携带本候选 `--import`、TRACE/TRACE_FILE。上方命令仅为单次 `env`，不会把候选变量永久 export 到 shell；原 NODE_OPTIONS 保持 `task_original_node_options`。若原启动命令也用 start-local，移除两项 TRACE 和本次 `--import` 即可。
3. 不恢复/删除 DB/WAL，不重置 UI 保存结果，不改依赖或配置；保留候选与所有失败证据。只恢复服务运行参数。无需执行任何 git 回滚。无候选 request-entry 的新进程不能单独证明回滚；应核对启动环境与 PID。

## 根因捕获判据与扰动局限

理想链：**同 ID** `request-entry(clean)` → 原消费者代码栈 → 自然 body getter 返回 `locked/disturbed` → 自然 `_request` 同步 `operation-throw(body-disturbed-or-locked)`。只有自然边界可见的变化才归因；首消费者标记代表**调用意图**，不是已读取字节。`Readable.toWeb` 自己注册 data/resume/read 属正常搬运，Node disturbed不等于 Web不可用；不能把它错误判为上游业务消费。`getReader` 标记锁定意图；其后记录并非完整每次异步状态快照。

此最小候选**未包装 Connect next/errorMiddleware**，以免重建 Vite 插件接入；它可以把同步 materializer 异常关联 ID，但不捕获被框架吞掉的首次 `new Request` 错误，也不连接 overlay广播到浏览器。若只有错误无先行消费者、入口已坏、另一个 srvx module实例、async rejection、native内部绕过公开方法、响应流/worker、首请求前其他 preload消费，均仍 OPEN。错误请求的真实身份和首个消费者不能由当前充分条件矩阵代替。

运行时包装改变函数 identity/name/length、对象 own descriptors，代码栈与同步文件写入改变时序；preload 早 import srvx 可能改变原生 Request捕获/模块初始化时序。新读者 wrapper与原生 stream内部路径不保证同覆盖。WeakMap/WeakRef不持有原 body或chunk；有限恢复描述符仍增加对象/函数开销，非零内存扰动。日志 sink失败不会更改原请求结果，但会丢诊断；候选没有 performance/时序无扰动保证。须保留无观察器对照，间歇问题在采样下未复现不等于修复。

## 合成验证与来源

固定 Node26，唯一行为验证命令为：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/homepage-v25-implementation/evidence/P1/round3/request-body-peer/candidate-observer.test.mjs
```

`candidate-red.log` 为最初空实现 6FAIL/1PASS；`candidate-green-1.log` 保留 6PASS/1FAIL，暴露候选 capture局部变量遮蔽。修候选后 `candidate-green-2.log` 7PASS；增加真实 IncomingMessage无listen、预算、栈格式化失败/第三方恢复后 `candidate-green-3.log` **10PASS**。真实 NodeRequest自然读取的返回内容只在内存断言，日志断言不含该内容/query；无 HTTP、端口监听、应用入口或数据库。preload只检查语法，尚未执行。最终 SHA、命令/exit与时间在 `candidate-verification.json`；不覆盖旧 REPORT/source manifest及失败证据。
