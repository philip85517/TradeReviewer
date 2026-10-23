# Request body peer diagnosis — OPEN, no proposed repair

2026-10-23 03:32 CST。实际 `gpt-6.1-sol / ultra`，独立只读诊断。按当前 development-workflow 与 systematic-debugging/root-cause-tracing，保留 root 原始失败与证据限制。仅新增本目录；没有修改产品、测试、node_modules、配置或共享记录，没有启动/重启服务、浏览器、网络请求或数据库访问。本报告不是 P1/整页接受，也不阻塞独立 direct `/trades` 修复。

**结论：已定位异常构建边界，未定位真实请求及其首个消费者。** root 的已锁定/已消费非 GET 探针证明充分条件，不能把它当成线上原因。没有证据支持更换框架、增加 clone、吞 overlay、修改自动保存或重试。

## 版本与原始证据

- 基线 HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`；固定 Node `v26.0.0`，srvx `0.11.15`、vinext `0.0.50`、@vitejs/plugin-rsc `0.5.26`、Vite `8.0.13`。
- `source-manifest.json` 记录 38 个输入路径、SHA-256、采样时间 `2026-10-22T19:32:38.824Z`、框架入口存在性与配置相对 HEAD 的空 diff。它约束本次静态结论，不代表当前服务启动版本已独立确认。
- 完整读 root `ROOT-REQUEST-BODY-DIAGNOSIS.md` 与 `request-adapter-diagnostic.json`。原截图实际为 loading，未捕获 overlay；真实堆栈来自当时屏幕读取。03:09–03:11 未再复现不关闭问题。此次未重复 root 的 GET/POST/PUT、locked/consumed matrix。

## 已证实的调用链

以下位置均相对仓库根，准确源码哈希见 manifest。

| 边界 | 实际输入/动作 | 可证实结论 |
| --- | --- | --- |
| `@vitejs/plugin-rsc/dist/plugin-BhzHKRFo.js:780–788` | Connect `(req,res)` → runner import → `toNodeHandler(fetchHandler)(req,res)`；catch `next(e)` | 此层未显式读取 body。错误可进入 Vite 公共错误中间件。 |
| `srvx/dist/adapters/node.mjs:719–728` | 创建 `new NodeRequest({req:nodeReq,res:nodeRes})` 后立即调用 handler | 未显式消费/重试/复用请求；NodeRequest 保留同一 IncomingMessage 身份。 |
| `vinext/dist/server/app-rsc-handler.js:273–278` | instrumentation 初始化后，仅过滤 headers，马上 `cloneRequestWithHeaders(rawRequest,...)` | 第一份入口 clone 在 app middleware、server action、route handler 前。当前没有项目 instrumentation 文件。 |
| `vinext/dist/server/request-pipeline.js:379–398` | 首次 `new Request(request,{headers})` 失败即进入 fallback；先取 body，再取 redirect | 原首次 constructor 错误被 catch 丢弃。观察堆栈中的错误发生在 fallback 的 redirect getter，不是应用显式 redirect。不能据此推定首次 constructor 自己消费了 body。 |
| `srvx/dist/_chunks/_url.mjs:9–11`、`adapters/node.mjs:271–282` | inherited redirect getter → `_request` → body getter → `new NativeRequest(url,{body,duplex})` | 此处尝试把 Web stream 装入原生 Request；root matrix 已证明 unusable stream 在这里拒绝。实际哪个请求、何时 unusable 仍 OPEN。 |
| `srvx/dist/adapters/node.mjs:254–260` | 非 GET/HEAD 首次 body getter 调用 `Readable.toWeb(#req)` | GET/HEAD 返回 null；**读取 body 本身也会建立转换，不能把主动读取当无侵入采样。** |

应用 `app/api/storage/recall/route.ts:73`、`trades/route.ts:34`、`instruments/metadata/route.ts:72` 等 `request.json()` 在 route dispatch 后；同一次入口执行中不可能先于上述第一份 clone。客户端 Recall/review-summary/sqlite-http-client 使用 JSON 字符串发请求，响应 `.json()` 消费的是响应。这些路径可以产生后台 PUT，但尚未证明消费同一个入口 Request。若出现重入，须用身份/序号证据证明，不能仅以“搜索到 json()”定责。

## 当前可疑面及排除限度

- 项目无检出的 middleware/proxy/instrumentation 入口，也无 pages/src/pages。`vite.config.ts` dev 插件仅 vinext 与 `sites()`；sites `apply:'build'`，Cloudflare plugin 仅 build。没有配置级 dev body parser/proxy。`vinext/index.js:1029` 的 pages 中间件因此直接 next；其中 pages 路径不能直接当成本项目消费者。worker fetch 仅 URL/image 分支，不是上述本地 srvx 入口。
- vinext dev origin/timing 中间件只操作 URL、headers、response；plugin-rsc 在交给 srvx 前只有 import/URL 恢复。已读路径中**没有找到**正常 app 入口 clone 前的显式 body 消费。这个静态否定不覆盖未记录的运行时插件、旧进程版本、第三方全局补丁或实际请求重入；不据此宣布框架无错。
- 原生 Node Request 构建的 abort/close 信号路径不读取 body；“取消导致锁定”目前没有独立证据。原 `patchGlobalRequest()` 为可选导出，当前检查范围没有调用，不能当作已启用行为。
- acceptance `recall-fault-proxy.mjs:20–23,27–44` 对 PUT 先读代理 IncomingMessage 后，用**新的** `http.request` 将 Buffer 发到 3333。代理消费与上游 srvx IncomingMessage 不是同一对象；它不足以证明本次锁定。当前 proxy 日志仅 ready 行，也没有 overlay 请求关联。

## 两个会误导诊断的事实

**1. 当前页面不是错误请求身份。** Vite `node/chunks/node.js:5084–5099` 的 `errorMiddleware(err,_req,...)` 调用 `logError`，由 `server.environments.client.hot.send({type:'error',...})` 广播。因此后台 PUT 的失败可以在当前 `/trades` 页显示 overlay。此为静态可达机制，尚未证明原事件就是 PUT；不能把进入 `/trades` 的动作等同于失败 GET。

**2. `bodyUsed` 采样会改执行路径。** srvx 没有独立的被动 bodyUsed getter；lazyInherit 把它转发到 `_request`。本目录纯内存 `observer-effect-probe.mjs` 的单变量结果为：只读 method/url/host 时 materializer/body getter 调用均 0；随后仅读 bodyUsed，返回 false，但两者调用均变 1。见 `observer-effect.json`。所以入口日志不要先读 bodyUsed、redirect、clone、text/json，也不要主动取 body。已存在 stream 才可读 locked/isDisturbed；自然 getter 返回后可观察，不能为观察而创建它。

该探针只验证观察副作用，未使用 HTTP、应用路由、clone 或异常 body。首跑 synthetic fixture 缺 rawHeaders 产生独立 TypeError，保留于 `observer-effect-initial-fixture-failure.txt`；补齐 IncomingMessage 的 rawHeaders 后 exit 0。这不是原异常复现或修复证据。

## 已有日志是否足够

| 设施 | 能看到 | 缺失/使用限制 |
| --- | --- | --- |
| vinext `index.js:1011–1022` → `server/request-log.js:37–50` | response finish 的 method、URL、status、耗时 | 无 request ID/对象身份/首消费堆栈。若 root 已保存当前服务 stdout，可先按错误时间查附近非 GET/500；并发下仅邻近不能定因。 |
| Vite error logger | 原异常栈，及广播 overlay | `_req` 没关联进日志，不能推出 method/URL。 |
| `DEBUG=connect:dispatcher` (`vite/.../node.js:6016,6177`) | middleware 名、route、originalUrl 与 dispatch 顺序 | 没 method、ID、body 状态或消费栈；需进程启用，不是现有日志可以补出的事实。默认不应为此重启。 |
| round3 已保存日志/adapter JSON | 现有局部矩阵与 proxy ready | 未找到真实异常对应的 request/caller pair。原问题仍 OPEN。 |

## 下一次最小采样方案（候选，尚未实现/执行）

由 root 在 UI 保存验收结束后选择受控窗口。保持请求/响应语义与 overlay 原样，仅将观察器留在 peer evidence 中，输出 NDJSON。建议先一轮可卸载 preload；不改 node_modules 或产品。它仍是运行时包装，会影响时序，须记录是否启用并保留无观察器对照。

1. 在 `http.Server` 原 `request` emit 前对该 IncomingMessage 建 WeakMap ID，例如 `rb-1`，单调时间序号贯穿全部事件。记录 method、经过白名单规范化的路径（无 query 值/动态业务 ID）、端口/进程、request-entry；不读取内容、headers 值、账户/交易/文档。未知路径只保留脱敏路由类。没有额外 data listener、reader 或 clone。
2. 入口/每个原中间件调用前后记录该 Node 流 `Readable.isDisturbed(req)`、readableEnded、readableFlowing、destroyed、complete、aborted；这些不触发 srvx 惰性 Request。不能只凭 Node disturbed=true 或 complete=true 宣布 Web body unusable：adapter 的正常搬运也可改变它们。
3. 对**已追踪的同一个 req**，仅包装原有 `on/addListener/once('data')`、read/resume/pipe、asyncIterator 入口，调用原实现一次并保留 this/参数/返回值。记录首个消费意图 stack、层名与序号；不自行订阅 data，不保存 chunk。记录自然的 abort/close/error 元数据。避免 once→on 等内部嵌套重复计为多个独立消费者。
4. 包装同一安装 srvx `NodeRequest.prototype` 的自然 body getter、`_request` getter、text/json；通过 `runtime.node.req` 取同一 WeakMap ID。getter **只在原调用本来发生时**执行；body 原 getter返回后才对返回 stream 加 WeakMap 标签，记录 locked / `Readable.isDisturbed(stream)`；`_request` 只记录 begin/success/throw，不主动读取 bodyUsed。先确认观察器与插件适配器使用同一 class/module 实例，否则声明未覆盖。
5. 若需定位 Web 侧首锁定，仅对上述已标记 stream 的公开 getReader/tee/pipeTo/pipeThrough/values/asyncIterator/cancel 调用记录 stack，并记录 reader read/cancel/releaseLock 顺序；不额外获取 reader。native 内部消费可能不经这些公开方法，缺事件不能反证未消费。保留自然 getter前后的状态，先定位哪一边界首次变化，再决定是否需要更窄的下一轮观察。
6. 错误 handler 关联同一 req ID、错误名/栈，并继续原 `next(error)`。root 浏览器保存前一动作、Network method/path/status/initiator 与同一时间段；不要把一个页面截图代替请求身份。理想证据是 `same ID: entry(clean) → consumer stack → natural materialization(unusable) → error`；若首样本已坏则继续向外层追，不下修复结论。

最小事件形状（均为合成值）：

```json
{"id":"rb-1","seq":4,"phase":"node-consumption-intent","method":"PUT","route":"/api/storage/recall","node":{"disturbed":false,"readableEnded":false,"flowing":null,"destroyed":false},"operation":"on:data","callerStack":"<code locations only>"}
```

**受控重启与 DB 保留：** 临时 Vite plugin 的 configureServer 只有启动时注册；把文件放进 peer 目录不会让现有进程加载。当前 vinext `cli-args.js` 不支持 `--config`，未知 flag 被忽略，`start-local.mjs --dev --config ...` **不能**可靠加载候选。可由 root 另审 peer-only programmatic Vite launcher（`createServer({root,configFile:原vite.config.ts,plugins:[observer],...})`，显式保留原 host/port/strictPort），或 `NODE_OPTIONS=--import=<peer-preload>` 继承到现有启动器。二者均须受控重启，当前没有执行、也没有确认完整插件兼容性。优先 preload 可避免复制生产配置。

保留**现有同一显式隔离 DB 路径**，由 root 确认服务归属后停止/启动；`scripts/start-local.mjs --dev` 本身不创建备份或重置 DB。不得使用 `make dev/npm run dev`（debug-local 会重制备份，丢当前测试写入），不得默认读取主业务库，不新增第二业务 DB。现阶段不触碰 root 当前服务。

## 可证伪问题与退出条件

本次唯一待验证问题是：**原实际请求的 body 在首次 appRscHandler clone 前，是否已被同一对象上的某个调用消费/锁定，调用者是谁？** 现有充分条件不回答它。若采样显示无先行消费而在原始 constructor/fallback 自身发生状态转移，则保留第一份 constructor 错误与适配器身份，另开最小框架边界复现；不能提前认定。

诊断当前完成于“边界及下次观察方案 ready”；真实消费者、触发请求、首次 constructor 错误、受影响频率均 **OPEN / NOT VERIFIED**。无产品修复建议，无接受结论。

执行证据命令（仅本目录写入）：固定 Node 运行 `observer-effect-probe.mjs > observer-effect.json` exit 0；固定 Node 运行 `capture-sources.mjs` exit 0。未跑产品测试或重复 root 原矩阵；未执行任何 launcher/preload。
