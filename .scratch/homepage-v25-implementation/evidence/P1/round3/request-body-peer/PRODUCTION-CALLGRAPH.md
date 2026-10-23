# Request body：实际安装源码调用链与下一观察边界

2026-10-23，`gpt-6.1-sol / ultra`。遵循 systematic-debugging，仅只读复核现有证据、本地安装包实际 dist 源码与项目配置；本轮唯一新增文件是本报告。未运行任何适配器/观察器/测试/运行时探针，未访问 HTTP、浏览器、数据库或服务，未修改产品、依赖、测试或历史证据。下文“生产调用点”指原应用及依赖实际实现，不把独立合成探针当成原生产调用。

**结论仍 OPEN：异常已定位到 srvx 的惰性 Request 实体化，但实际失败请求及其非法消费者尚未定位。** 当前静态调用链没有发现一条已启用、会先消费同一 incoming stream 再正常转交首次 appRscHandler clone 的业务路径。已锁定/已消费 POST 探针证明充分条件；两条真实 PUT 的正常桥接/tee 不能证明该充分条件在原异常现场成立。

## 证据与版本边界

完整复核 `../ROOT-REQUEST-BODY-DIAGNOSIS.md`、`ROOT-WINDOW-02-ANALYSIS.md`、既有 `REPORT.md`、`CANDIDATE.md`、`LOW-IMPACT-REVIEW-1.md`、适配器矩阵/观察副作用/候选验证记录，并直接读 `candidate-observer.mjs` 与相关离线探针源码。没有重跑它们。原 overlay 文件名不等于截图内容：原图实际为 SQLite loading；目标栈来自 root 当时屏幕读取，缺失败 request ID。

本地包 manifest：srvx `0.11.15`、vinext `0.0.50`、@vitejs/plugin-rsc `0.5.26`、Vite `8.0.13`；原离线矩阵标注 Node `v26.0.0`。本轮不读取当前服务运行态，不把本地文件存在等同于当前进程已加载相同版本。读取的是 `.js/.mjs`，没有广泛打印 source map；栈中的 `.ts:616/562` 是映射位置，下面给出实际 dist 行号。

| 实际只读输入 | 当前 SHA256 |
| --- | --- |
| `node_modules/srvx/dist/adapters/node.mjs` | `4fb7ded812c93f17c0dc09605145f1f7846c97a1c754cec20cd1696235baa52a` |
| `node_modules/srvx/dist/_chunks/_url.mjs` | `4ae668931bafa9ce172c8b10408703cc5ac1d4e22c9df617a816da9d5eb811f6` |
| `node_modules/vinext/dist/server/request-pipeline.js` | `d69e2c414f3c8c2beae176e69cdc3717f928841572bdadef77d700b58d1afb36` |
| `node_modules/vinext/dist/server/app-rsc-handler.js` | `80a831b5a014f7cb9f59bd1055590f63fc78048308795a9920e96df746fc9a5d` |
| `node_modules/vinext/dist/index.js` | `fc4fa9015f2e651fc38a873b7537bc928ef67549b3d1e14d41809612480525c3` |
| `node_modules/@vitejs/plugin-rsc/dist/plugin-BhzHKRFo.js` | `34218a54f85631ac5e48f34ba4254bb70b74f41f4d012543ff46e5e3209210a8` |
| `node_modules/@vitejs/plugin-rsc/dist/utils/rpc.js` | `cd969d786c90f94b7cc6bc22dd0e155392940b361a47c8803a3e13541257421f` |
| `node_modules/vite/dist/node/chunks/node.js` | `fa7bedc63f02873469779fe5d3c1a3a60d7a9c8e1c164cfd64dd5f50859eef8c` |
| `vite.config.ts` | `54a837c1dffa64d21ac4f268382626ad7d50f0d1048cfcb8906a1a4180b2a1a0` |
| `next.config.ts` | `614bce25b089c3f19b1e17a6346c74b858034040154c6621e7d35303004767cc` |
| `build/sites-vite-plugin.ts` | `81b7cbfaeb970611572256aba0e313425beb3809f6426f63750696c15d9c756b` |

哈希使用 Python 标准库只读文件计算。首个 `shasum` 尝试因 Perl locale 初始化失败，未产出哈希；没有据失败命令宣称验证成功。

## 同一 incoming request 的首次入口调用链

```text
Node http.Server 收到 IncomingMessage N / ServerResponse R
  → Vite / Connect 中间件（配置决定哪些分支可达）
  → plugin-rsc post middleware :780
      runner.import / getFetchHandlerExport；req.url 恢复 originalUrl
      → toNodeHandler(fetchHandler)(N,R) :786
          → srvx new NodeRequest({req:N,res:R}) :722
          → appRscHandler(rawRequest) :273
              await ensureInstrumentation?.() :274
              仅获取/过滤 headers :275–277
              → cloneRequestWithHeaders(rawRequest, headers) :278
                  try new Request(rawRequest,{headers}) :382
                  catch（首个错误被丢弃）
                  fallback：body :387 → redirect :388
                      → inherited getter :_url.mjs:11
                      → rawRequest._request :node.mjs:271
                      → body（缓存 stream 或首次 Readable.toWeb(N)）
                      → new NativeRequest(url,{body,...}) :274
                          → undici extractBody 拒绝 unusable body（原错误边界）
                  fallback new Request(url,init) :398 尚未执行
  [首次 clone 成功以后]
    → handleAppRscRequest :289 → App middleware / rewrite / route / action
```

`redirect` 是 Request 的元数据 getter，通过 lazyInherit 转发到 `_request`；**它不是 HTTP redirect 已发生的证据**。`_request` 用的是 srvx 模块初始化时捕获的 NativeRequest。原栈失败的是把自然 body 装入这个原生 Request，不是 fallback 最后 :398 的第二次构造。

clone 的首个 :382 constructor 错误没有保存。因此“第一次一定只是跨 realm 错误”“第一次一定消耗了流”都不能从现有栈推出；若流第一次变坏发生在 clone 内部，也仍须保留该首错误和同一 stream 身份再判断。未检查 Node 内置 undici 的私有实现来填补这一缺口，更没有以另一个 npm undici 版本替代它。

## 真正有消费能力的原实现：可达性逐项区分

| 调用点 / 原动作 | 相对首次入口 clone 的阶段与当前配置 | 能成立的结论及不能成立的归因 |
| --- | --- | --- |
| srvx `node.mjs:254–258` `body → Readable.toWeb(N)` | clone 自然取 body 时发生；可建立 Node data/resume/read 桥接 | 真实生产桥接，window02 两 PUT 首 `on:data` 栈与此相符。桥接消费 raw Node 是正常动作，不能直接推成 Web stream 已 locked/disturbed。 |
| srvx `node.mjs:262–269,314–329` `text/json → readBody(N)` 或 `Response(cachedBody).text()` | **若有先行调用者**，可在 `_request` 前读取原 Node 或已缓存 Web stream | 这是实际存在的消费入口，但当前首次 appRscHandler clone 前路径没有找到调用它的活跃调用者。先读 raw Node 与先锁定 cached Web stream 也不是同一种证据。现有 bodyUsed 合成探针证明 getter 会实体化，未证明它是原消费者。 |
| Vite `node.js:17877–17904` proxy `opts.bypass(N,R,opts)`；`:17182/17211/17256` 转发 pipe/body | 配置 hook 可读取 N 后返回 string 并 `next()`；普通 proxy 转发后直接 return | bypass 是有条件的 pre-clone 消费能力，不是当前已启用路径：项目 `vite.config.ts` 未配 proxy/bypass。普通转发没有正常“读完再 next 到 appRscHandler”的分支。不能只搜索到 pipe 就归因。 |
| vinext Pages API `api-handler.js:17–55,127` `req.on(data/end)` | `index.js:1029` 先因无 pages/src/pages 直接 next；即便 Pages API 匹配后解析，也由 :1203 return | parser 确实能消费 Node，但本项目当前 App-only 配置不经过它；未匹配 API 不调用 parseBody。不是原 app 入口的已证实先行消费者。 |
| plugin-rsc RPC `plugin-BhzHKRFo.js:950–975` → `utils/rpc.js:42–45` `request.body.pipeThrough(TextDecoderStream)` / decode | 仅 loadModuleDevProxy 开启且 exact RPC path；匹配后处理并 return，失败 `next(error)` | vinext :331–335 仅传 entries，没有开启该选项，插件默认 options 对象也未设置它。即使开启，其常规分支不读完同 N 再无错误 next 到 app RSC。RPC payload 重建 Request 也不自动等于外层 incoming Request。 |
| App middleware `app-rsc-handler.js:106–115`；`app-middleware.js` / middleware-runtime 的 clone | **首次 :278 clone 后** | 同一次正常入口执行里不能解释 :278 之前的消费；若认为有二次入口/重入，须证明同一 N/stream 的链，不能省略这一步。当前项目无 middleware/proxy 文件。 |
| route `runAppRouteHandler` → `createTrackedAppRouteRequest` → NextRequest `server.js:50–52` `input.clone()`；`reviews/route.ts:37 request.json()` | **首次 clone 后**进入 route；窗口 PUT 的 native clone/tee 在这里 | 有真实消费/tee 能力，已有两个正常 PUT 的因果栈；不是同一入口 :278 的先行 consumer。route 中其他 json/formData 同理。客户端 response.json 消费的是另一侧响应。 |
| Server Action `app-server-action-execution.js:45–64` body reader/read | App request 分发之后，即首次 clone 后 | 实际会锁/读 body，但尚无原失败是 action 或重复派发的证据。不能凭当前页面/自动保存动作定责。 |
| instrumentation `app-rsc-handler.js:274` → `instrumentation-runtime.js:15–24 register()` | 配置存在时确在 clone 前；register 无 rawRequest 参数，可有任意全局副作用 | 本项目根/src 下没有 instrumentation 文件；生成 entry 只在有文件时注入 hook。没有证据指向活跃 register/body parser。当前源码也未找到 patchGlobalRequest() 的项目/vinext/plugin 调用；不能假设其已启用。 |
| srvx `fetchNodeHandler → callNodeHandler` `node.mjs:694–696,598–635` | 可复用 `runtime.node.req/res` 交给原 Node handler | 这是潜在复用能力；当前检视 vinext/plugin 的正常入口没有调用。不能用该导出存在证明真实重入。 |
| Vite/Connect finalhandler `node.js:5940–5962` `req.resume()`；Node `_dump` 收尾 | terminal/error 或响应结束排空，不正常 next 回首次 clone | window02 GET `/trades` 最早 resume 即 `_dump → resOnFinish`；它发生在响应收尾，不能被“first intent”标签改写为上游非法业务读取。 |
| vinext `prod-server.js:43–48,870–875` `readNodeStream(N)` | 独立生产服务器将 Node 体转 Web Request；不是当前 dev plugin-rsc→srvx 栈 | 字面 production server 源码有 body bridge，但没有原异常走此入口的证据。不能与已观测 dev adapter 混用。 |

其余当前前置链：Vite 注册顺序见 `node.js:26312–26351`；vinext dev origin `index.js:956–971`、timing/logger `:976–1025` 仅 headers/URL/response；plugin-rsc `:782–786` import/恢复 URL 后直接交 srvx，没有显式 body 解析。sites 插件 `apply:'build'`，Cloudflare 插件也只在 build 时添加；`next.config.ts` 为空配置。静态查不到先行消费者不等于证明运行时没有额外 preload、另一份模块、旧进程版本或未证实重入。

## GET 到底能否出现该栈

需要区分**相同调用框架**和**相同 body-unusable 异常**：

- 普通 GET/HEAD 也会走 `appRscHandler → clone → redirect getter → _request` 的惰性构建链；window02 的 GET `/trades` 有正常 getter 调用并返回。因此看到这些框架帧本身不能反推 method=POST/PUT。
- 当前 srvx `body` 对 method=`GET|HEAD` 明确返回 `null`，并且根本不对 N 做 `Readable.toWeb`；`_request:274` 因此传 null body。**在该源码、未修改 Request/方法的正常 GET/HEAD 前提下，已锁/已消费 incoming body 不是此处 extractBody 异常的解释。** 即使网络层 GET 带 payload，当前 getter 也不会把它装进此 Web Request。现有离线 GET 成功与此一致。
- 这不是“所有运行环境 GET 绝不可能抛任何 Request 错”的绝对证明。原失败 method、已加载代码、全局补丁状态未知；不能替原现场补值，也没有证据需要假设这些额外变体。
- Vite `errorMiddleware/logError` (`node.js:5084–5099`) 把错误广播给 client hot channel，且 `_req` 未绑定进错误日志。后台非 GET 错误**可以**显示在当前 GET 页面；这里只证明机制可达，不能确认原事件就是后台 PUT。reload 动作/当前 URL 都不是失败请求身份证据。

## window02 覆盖缺口使哪些推论失效

| 已保存事实 | 不能推出 |
| --- | --- |
| 70 request-entry = 68 GET + 2 PUT；没有目标 throw | 不能关闭原间歇问题、不能排除未覆盖/预算后请求，也不能证明 PUT 保存或 HTTP 成功；原日志不含响应 status。 |
| safeRoutes 没有 `/home`，未知非 API GET/HEAD 被跳过；`.rsc` 规范化后仍缺 /home | 不能说“首页 document/RSC GET 已覆盖且正常”；也不能由缺日志推出 GET 发生 body-unusable。POST `/home` 只会被脱敏，本窗口没有该记录。 |
| 03:57:49.115 后紧接2000事件 budget marker；最后一条 `_request begin` 无 return | 不能当成 getter throw/挂起。最后6请求缺 end/close 同样是截断，不是6个失败。03:59+ 超时超出可观测窗口，无法连回此前某 ID。 |
| getter begin/return 共1331事件，占预算66.55%；耗尽后 emit 停但 active/既有 wrapper 仍运行并可继续包装新 stream/reader | 不能称“预算后零成本/已卸载”或以2000行约束总包装内存/时序；也没有耗时对照证明候选导致超时。 |
| PUT 46/50 自然 body 初次返回 unlocked/undisturbed，之后正常桥接、Request.clone tee、Node 读完 | 初始快照不是异常时状态；Node disturbed=true 不等于 Web body unusable。0公开 getReader/srvx.json 事件不排除 native 内部 clone/tee 的消费。 |
| GET 最早 resume 是响应 `_dump`；HMR/429 有 root 现场文字证言但无同段落盘 stdout/status | 不能把 first-intent 自动当作 first illegal consumer，不能从脱敏API路径恢复具体endpoint、429或HMR因果，更不能把采样超时归到HMR/观察器/框架任一方。 |

原候选提前 import srvx、包装函数身份/own descriptors、同步写日志/取 stack 均可能扰动时序，大小与因果未测。`bodyUsed` 还会经 lazy getter 主动实体化 Request；既有纯内存结果 false 时 materializer/body getter 也从0变1，因此不能把它加入“被动入口采样”。NR04来源恢复及原Recall选错证券均不由本报告合并归因。

## 最小下一观察方案（设计，未实现/未执行）

目标仅收集**自然 `_request` 抛错时的同请求 method/固定路径/ID，以及此前第一个同对象消费边界**。先保留现有无观察器服务；如 root 有已保存 stdout/Network，可先读同秒 method/status，邻近时间仍不得当作对象相关性。只有 root 另审候选并选择窗口后才允许激活，旧候选不能原样自动复用。

1. **覆盖/关联：** `Server.emit('request')` 前为 N 建 WeakMap ID；固定 `/home`、`/home.rsc`、`/trades`、`/trades.rsc` 及 API GET/全部 mutation 均可记录（RSC 规范化明确记录）；未知路径固定脱敏、query/headers/body/chunk/账户值不输出。入口仅 Node 被动公开状态。自然 body getter 返回后才给 stream 标记身份；自然 `_request` 成功/同步 throw 对应同 ID，不主动取 body/bodyUsed/redirect/clone。另记 response finish/close/status（不订阅 data），把正常排空与错误边界按顺序分开。
2. **减少事件：** GET 只记 entry、首次实体化结果/throw、response终点，不逐 getter 取栈。非 GET 才在原 Node data监听/read/resume/pipe/asyncIterator、已自然返回 Web stream 的 getReader/tee/pipe/iterator 等首个操作边界取一次短栈；每 request 最多一个 Node 首意图栈、一个 Web 首意图栈和一个目标错误栈，各最多6帧/2KiB。不逐 read 打点、不包装 reader.read、不追加 Promise handler；原方法只执行一次，返回值/Promise/异常对象原样保持。自然 getter或操作边界可采已获得同 stream 的 locked/isDisturbed；缺 native 内部事件明确保留。
3. **真正硬预算：** 单进程最多60秒、100个被追踪请求、1024事件、256KiB缓冲、512条可恢复描述符，任一先达或目标异常出现即停止新观察/包装并卸载现有自有包装；不是仅停止 emit。预算外保留一条带时间/原因/最后seq的结束记录。生命周期监听也撤除，恢复项数量不能越界；只恢复仍属于自己的 descriptor，不覆盖后来的第三方修改。候选需先离线证明预算后零新增包装/事件、/home覆盖、卸载、原语义保持，再让 root 审查；本轮不编写/执行该候选。
4. **I/O与撤回：** 有界内存缓冲，停止后一次写 peer 目录新文件，避免每 getter 同步写盘。进程提前退出可能丢缓冲，必须记为缺口。root另存同窗脱敏Network method/path/status/initiator/时间及原栈，不修改请求/响应内容。不要新增全局 Request 替换来捕获首 constructor。若需受控重启，由 root 保留同一显式隔离DB/WAL/端口和原启动参数；不使用会重建备份的 make dev。撤回去掉本次 preload，恢复原参数；不改/回滚数据。运行时包装、提前import及一次flush仍有扰动，不能声称无开销。
5. **证据判据：** 同ID clean entry → 可定位真实先行消费 → 自然 stream unusable → `_request`目标throw，才支持该 consumer 的因果候选；仍须最小单变量复核。若 entry已坏、未见先行者、只见正常桥接、或原生内部缺口，则继续OPEN。若失败发生在首次 :382 constructor 内而后才变坏，本方案未保证保留其被吞错误；不能拿“无外部消费记录”定责 constructor，须另审更窄观察方案。

本轮没有提出框架/业务修复，也没有实测新方案的性能。真实失败请求身份、非法消费者、首 constructor 错误、原事件频率及超时关联仍 **OPEN / NOT VERIFIED**；P1/P3接受状态不变。
