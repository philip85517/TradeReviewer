# 既有 3333 服务：来源请求单次探测

2026-10-29 对当前已有的本地服务执行：

```sh
curl --silent --show-error --max-time 2 --output /dev/null \
  --write-out 'http_status=%{http_code} elapsed_seconds=%{time_total} bytes=%{size_download}\n' \
  http://127.0.0.1:3333/api/storage/homepage-source
```

结果：2.001553 秒超时，HTTP 状态 000，收到 0 字节。监听进程工作目录指向原 worktree；进程启动时间、代码版本、数据库文件及数据版本没有在本次确认，因此它不是可复现的新旧对照基线，更不代表真实浏览器完整首屏计时，也不能与合成原型数字直接比较。此探测只读，超时不证明服务端计算已终止。若要作为基线，必须在已记录的版本、独立数据副本、同一服务和浏览器条件下重新执行。
