# 有限源码诊断假设（执行前）

2026-10-23，`gpt-6.1-sol / ultra`；只读诊断，P1 正式仍 2/3 FAIL。

本轮不重跑“预先消费或锁定 Request → 同栈错误”的旧 fixture。新的单一假设是：
Node26 内置 `internal/webstreams/adapters:479–482` 对 destroyed 或不可读的原 Node
stream 执行 `new ReadableStream(); readable.cancel(); return readable`。因此 srvx
首次惰性桥接就可能收到 disturbed Web stream，首次 `_request` 即在 undici
`extractBody` 抛目标错误；它不要求存在更早的公开 Web reader。

同时核验反证：仅 Node stream disturbed、但仍 readable 时，不足以使新 Web stream
disturbed。首次 `new Request(srvxRequest,{headers})` 在 Node26 内置 undici 私有
`input.#state` 访问处失败，先于 Request body 转移分支，不能把该首次尝试直接当消费者。

允许范围仅本目录新增诊断文档、一个纯内存 IncomingMessage/Request 脚本和 stdout
记录；脚本不 listen、不发 HTTP、不读取/写入 DB、不导入应用业务模块、不安装 runtime
observer、不改依赖。当前真实失败请求的身份和 abort/drain 来源仍未知。

纯内存矩阵：fresh、只读一个 Node chunk、Node 已 drain/end、未读 Node 已 destroy。
只通过已安装的原 clone 函数和 srvx getter观察，不给产品加补丁。结果仅证明具体候选
分支的充分条件及反例；不称原事件重现或实际消费者定位。
