# 3091 文档预览服务阻塞诊断（只读）

生成时间：2026-11-05（Asia/Shanghai）  
范围：`tools/document_review/server.py`、`tools/document_review/test_server.py`、当前本地进程及评论目录；不修改服务、不重启 PID 88902、不写评论。

## 冻结状态与复现

当前进程：

```text
PID 88902
/Library/Developer/CommandLineTools/.../Python3 .../tools/document_review/server.py
--host 127.0.0.1 --port 3091
--docs-root /Users/zhoulin/.codex/worktrees/80b0/TradeReview/docs
--comments-dir /Users/zhoulin/.codex/worktrees/80b0/TradeReview/docs/design-system/reviews
```

源码在 `server.py:23` 导入 `HTTPServer`，`ReviewServer`（`849-868`）直接继承它；`main()`（`881-895`）调用单线程 `serve_forever()`。当一个 Chrome 连接完成 TCP 建连但没有发送完整 HTTP 请求行时，`HTTPServer` 已经从 listen socket 接受它，随后 `BaseHTTPRequestHandler` 在请求读取阶段阻塞。单线程主循环不会回到 `accept()`，所以后续 GET 连接只能建立在内核队列里或等待超时，服务表面上“监听但不响应”。

### 可复现路径（不改文件）

1. 让一个客户端只连接 `127.0.0.1:3091`，不发送 HTTP 字节，保持连接。
2. 另一个客户端请求 `GET /`，`curl --max-time 1` 收到 `Operation timed out`、0 bytes。
3. 释放第一个空闲连接后，服务重新接受请求；同一进程随后对 `/` 返回 404、对 `/api/documents` 返回 200。

本轮只读复现与现场观察一致：先直接 GET 可响应；建立空闲 TCP 连接后第二个 GET 在 1 秒内超时；释放空闲连接后 PID 仍存活且恢复响应。`lsof` 在现场只显示 `127.0.0.1:3091 (LISTEN)`，说明阻塞连接已被释放，不代表路径不存在。

根因等级：**P1 预览可用性/单线程拒绝服务**。触发条件是任意本机客户端（浏览器预连接、异常扩展、半开连接或手工 socket）占住唯一 handler；不是 `ReviewStore` 锁死，也不是业务数据库锁。

## 事件链与源码证据

```text
listen socket
  -> HTTPServer.handle_request()/get_request()
  -> 单一 BaseHTTPRequestHandler 实例
  -> 读取 request line / headers（客户端不发完整请求时阻塞）
  -> 未到达 do_GET()/do_POST()
  -> serve_forever() 不再 accept 后续连接
```

- `ReviewServer` 没有 `ThreadingMixIn`/`ThreadingHTTPServer`，也没有 `get_request()` 或 handler socket timeout 覆盖。
- `ReviewRequestHandler.do_GET()`/`do_POST()` 本身是同步处理；静态文件、manifest 扫描和 `/api/documents` 返回都在同一个请求线程。
- `server.py:75` 创建 `threading.RLock()`；`get()` 在 `364-367` 加锁，`apply()` 在 `618` 起加锁。该锁保护的是一个进程内 `ReviewStore` 的读-改-写临界区，不能让 HTTP 层并发，也不能解除请求读阶段的阻塞。

## ReviewStore 并发、关闭与一致性风险

### 已有安全性质

- `_write_record()`（`331-354`）在评论目录内创建临时文件，JSON 写入、flush、`fsync`，再 `os.replace()`，最后尝试 fsync 目录；完整目标文件不会被半写内容覆盖。
- `_read_record()`（`312-329`）每次从目标 JSON 重新读取；服务重启不会依赖不可恢复的内存评论。
- `operations` 幂等键在 `apply()`（`618-623`）先查，重复提交返回已有 response；`expectedRevision`（`623-627`）防止客户端基于旧版本盲写。
- 既有测试会实际 POST、回复、停止服务、重新启动并检查历史/任务/回复仍在，证明正常关闭/重启的文件恢复路径。

### 若改成线程化服务后的风险

- 同一个 `ReviewServer` 实例内，现有 `RLock` 会串行化 `get()` 与 `apply()`，所以单进程多 handler 不会在 `_read_record`/`_write_record` 中交错读改写；这是可以复用的保护，不应删除。
- 静态 `documents()`/manifest 读取没有使用该锁。若另一个进程同时重建 manifest，可能得到不同版本的枚举结果；这不影响评论 JSON 的原子替换，但服务端需把 manifest 变更视为外部部署边界。
- `RLock` 不是跨进程锁。两个预览服务若误用同一个 `comments_dir`，可能同时读到同一 revision、各自更新后先后 `os.replace()`，产生最后写入者覆盖；`expectedRevision` 只能由同一服务实例内的请求协调，不能保护跨进程写入。
- `server_close()` 只关闭监听 socket，不保证正在 handler 中阻塞的 accepted socket 立即结束。若启用线程化，建议 `daemon_threads=True`、明确 `block_on_close` 取值，并对每个 accepted socket 设置读取/写入超时；否则关闭时可能仍被慢/空闲客户端拖住。
- `do_POST()` 读取 body 前依赖 `Content-Length`，已有最大 1 MiB 限制；但没有请求头/请求体读取 deadline，慢速发送仍可占用一个线程。线程化后这是资源耗尽风险，需 timeout 或上游连接数限制。

## 最小安全修复（建议，不在本任务实施）

按优先级：

1. **解除单连接阻塞：** 将 `ReviewServer` 改为 `ThreadingHTTPServer` 等价实现，保留 loopback 校验和现有 `ReviewStore._lock`；设置 `daemon_threads`，并在 `get_request()` 或 handler `setup()` 对 accepted socket 设置有限 timeout（覆盖 request line、headers、body、response）。
2. **保持关闭可控：** 保留 `server_close()`；在测试和进程退出路径先停止接收，再等待非 daemon 请求结束；超时线程不得阻止恢复服务。不要以提高 `serve_forever(poll_interval)` 代替 socket timeout，它只影响监听循环唤醒，不影响 handler 的 `recv`。
3. **明确单写者边界：** 同一 `comments_dir` 只允许一个预览服务；启动前做目录/端口拥有者校验。若未来需要多进程，增加跨进程文件锁或 SQLite/WAL 存储，并保持 revision/idempotency 约束，不能仅依赖 `RLock`。
4. **增加回归测试：** 一个空闲连接不能阻塞第二个健康 GET；慢 header/body 在 deadline 后释放；并发 POST 同 revision 至少一个得到 revision conflict，评论 JSON 在重启后完整保留；SIGINT/关闭后临时文件不冒充目标记录。

不要把 `HTTPServer.timeout` 单独当作修复：它不会限制已接受连接的 `recv()` 阶段。不要绕过 `ReviewStore._lock` 或直接用非原子的 JSON 覆盖来“提速”。

## 可复用测试与本轮验证

仓库已有 `tools/document_review/test_server.py`，使用临时 docs/manifest/comments，不触碰业务数据库；`setUp()` 在线程中启动 `ReviewServer`，`tearDown()` 调用 `shutdown()`、`server_close()`、join。覆盖 23 项行为测试，包括：GET/POST、校验失败、导出、幂等 operation、revision conflict、原子文件写入相关路径和“停止后重启读取回复/历史/任务”。

本轮执行：

```text
/usr/bin/python3 -m unittest tools.document_review.test_server
Ran 23 tests in 11.575s
OK
```

测试未覆盖：空闲 accepted socket、慢请求 timeout、并发 GET/POST、关闭时活跃 handler、跨进程同目录写入。最小新增测试应直接使用 `socket.create_connection()` 连上测试端口并不发送字节，再用第二个 `HTTPConnection` 断言在修复版仍能返回；并确保测试 finally 关闭第一个 socket。

## 不丢评论的恢复方案

当前服务是文档评论服务，非业务数据库服务；评论真相在 `docs/design-system/reviews/*.json`，写入采用临时文件+原子替换。恢复前后均不要删除、截断或移动这些 JSON。

1. 在停止 PID 前，只读列出评论目录、记录每个目标 JSON 的大小/mtime，并用 Python `json.load()` 验证所有正式 `*.json`；同时保留隐藏临时文件（若存在）作为诊断证据，不把它们提升为正式记录。
2. 将整个 `docs/design-system/reviews` 目录复制到带时间戳的外部备份目录（保留权限；不要使用会跟随 symlink 的递归清理）。备份完成后再次验证 JSON 的 `documentId`、`revision`、`comments` 和 `operations` 摘要。
3. 确认当前没有正在完成的 POST 后，再向 PID 88902 发送可等待的终止信号；不要先 `kill -9`。若 handler 仍占住端口，记录 PID/端口后再使用升级信号，原因是目标只是结束预览进程，已提交评论已经原子落盘，未提交请求最多留下临时文件。
4. 用**同一 comments 目录**重新启动服务（或先用新端口做健康检查），先 GET `/api/documents`、各已有 `/api/review?documentId=...` 和 `/api/export?...format=json`，确认 revision/评论数/操作键一致，再恢复浏览器流量。不要切换到业务数据库、不要删除目录中的 JSON 以“清理卡死”。
5. 若端口仍被旧 PID 占用，不能换端口后把旧服务留着并发写同一目录；先确认旧 PID 已退出，再启动唯一服务。若必须临时用另一个端口，仍只允许一个写者，并在验收记录最终 URL/端口。

### 当前恢复状态

本次按用户要求没有停止或重启 PID 88902。现场在释放复现用空闲连接后，3091 对 `/`、workspace `README.md` 和 `/api/documents` 均可响应；这只证明当前阻塞条件已暂时消失，不证明服务已具备抗空闲连接能力。

## 结论

当前故障是 `HTTPServer` 单线程 + accepted socket 无读取超时造成的可复现请求饥饿。`ReviewStore` 的进程内锁、原子 replace、revision/idempotency 和重启测试为可复用基础；最小修复应在 HTTP 接入层增加线程化与 socket deadline，并补充空闲/慢请求/并发测试，同时维持单 comments 目录单写者约束。评论不需要从数据库恢复，安全路径是先只读校验并备份 JSON，再终止卡住服务、用原目录启动唯一新实例并做 revision/导出校验。
