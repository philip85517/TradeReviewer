# NR-PEER-01：唯一有限 host timer 候选冻结

状态：**implementation-ready，等待 root 独立接受；不是 P1 accepted**。执行者 `financial_g61`，实际模型 `gpt-6.1-sol / ultra`。P1 正式计数仍 **2/3**；本次不重置、也不代签正式第 3 轮。

## 最终行为与最小改动

host 以 `request.startedAt + 15_010` 作为绝对 callback 截止时间。S 的 UI-only clone 仍可触发 effect 重新安装，但只等待剩余时间，不再重新等待完整 15.01 秒。timer 回调先核对当前请求的 generation、scopeKey、startedAt；不同 generation 的旧 timer 无权改变新请求。

保留原 host 的 10ms 调度余量，S 的 `markHomepageRequestTimedOut` 默认阈值仍是 `15_000ms`；没有修改 S 的业务超时判定。原来的 sourceRecovery、失败后手动 retry、owned bundle 接受和 persistence 流程均保持原代码。

本次唯一产品改动：`app/components/homepage-v25/use-homepage-host.ts`，7 行增加 / 2 行删除；独立新测试 `navigation-deadline.test.tsx` 从原 RED 到最终 GREEN **字节未改**。`candidate.diff` 仅对照因果 RED 时 host 的保存副本，没有混入先前 navigation-recovery 改动。原 host/session/recovery 测试、S/session、Workspace、catalog、CSS 与本次 RED 版本一致。Surface 由 root 授权其他 owner 并行改动，本任务没有写入；其运行版本各自记录在 JSON。

## TDD 与实际验证

|步骤|实际结果|版本绑定证据|
|---|---|---|
|01：独立因果 RED|1 文件，**2 FAIL / 3 PASS，exit 1，2.97s**|`01-absolute-deadline-red.log/json`；原 host SHA `85731c...`；`REPORT.md` / `FREEZE.json` 原样保留|
|02：新 5 项 GREEN|**5/5 PASS，exit 0，2.84s**|`02-absolute-deadline-green.log/json`|
|03：43 项原导航/会话 + 新 5 项|4 文件，**48/48 PASS，exit 0，15.49s**|`03-navigation-48-green.log/json`：原 host 22、session 4、recovery 17、新 deadline 5|
|04：有限严格类型检查|**exit 0，输出为空**|`04-finite-strict-types.log/json`；5 个显式入口及其导入，未执行项目全量 tsc，无 emit/incremental 写入|
|05：有限 lint|**exit 0，输出为空**|`05-host-deadline-lint.log/json`；仅 host 与新增 deadline test|

02–05 每次 `before/after` 指纹完全相同，`inputsUnchanged=true`。未创建第二候选、未改测试碰绿、未重跑业务全量或 benchmark。Vitest 原始日志保留环境 `DEP0205` warning；无应用错误被过滤。

新用例结果：D01 t10s UI 更新后，t15.01s request=null / error=timeout；D02 五次 UI 更新后同样按原 deadline timeout；D03 UI 更新保留原逻辑 token；D04 未交互请求仍按原 deadline；D05 identity B 在 t10s 获新 generation，旧 deadline 不截断 B，B 在自己的 t15.01s timeout。D01/D02 最终的来源 history/storage、种子数据保留断言现在均实际执行通过。

原 43 项回归包含 sourceRecovery 的 failure/timeout → manual retry、late resolve/reject、focus/visibility 不自动抢占、identity B 优先、guard cancel/throw/latest、source UI 与 owned bundle 归属；各展开名称保留在 verbose 日志，不用相邻测试代替具体组合。

## 可重放命令与环境

cwd `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；固定 Node v26.0.0 darwin/x64；Vitest v4.1.10。

每项使用相同前缀：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node \
  .scratch/homepage-v25-implementation/evidence/P1/round3/navigation-deadline/run-candidate.mjs LABEL NODE_ARGS...
```

实际 `LABEL` / `NODE_ARGS`：

```text
02-absolute-deadline-green node_modules/vitest/vitest.mjs run app/components/homepage-v25/navigation-deadline.test.tsx --maxWorkers=1 --reporter=verbose
03-navigation-48-green node_modules/vitest/vitest.mjs run app/components/homepage-v25/use-homepage-host.test.tsx app/components/homepage-v25/session-model.test.ts app/components/homepage-v25/navigation-recovery.test.tsx app/components/homepage-v25/navigation-deadline.test.tsx --maxWorkers=1 --reporter=verbose
04-finite-strict-types node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2017 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler --esModuleInterop --resolveJsonModule --isolatedModules --jsx react-jsx --types @cloudflare/workers-types app/components/homepage-v25/use-homepage-host.ts app/components/homepage-v25/use-homepage-host.test.tsx app/components/homepage-v25/session-model.test.ts app/components/homepage-v25/navigation-recovery.test.tsx app/components/homepage-v25/navigation-deadline.test.tsx
05-host-deadline-lint node_modules/eslint/bin/eslint.js app/components/homepage-v25/use-homepage-host.ts app/components/homepage-v25/navigation-deadline.test.tsx
```

runner 使用 `wx` 保存证据，重放应换新 LABEL，不能覆盖原文件。02 首次墙钟 UTC `2026-10-22T20:24:48.914Z`，05 结束 `2026-10-22T20:25:47.283Z`；04 同时独立运行，结束 `20:25:47.798Z`。完整环境/命令/时间/退出状态在各 JSON。

## SHA256 与冻结

|文件|SHA256|
|---|---|
|最终 host|`3218407b84c45656989bc0a2ac700c9741e6c55135f55ed2873e7ed2b968b167`|
|新增 deadline test（RED/GREEN 相同）|`f10c3e7ececd6322d155778ef9ccb74def1f861eeeef89e95c76131dba6aa457`|
|`candidate.diff`|`6b388e575595e1a9f43c35d06902fa56d5cea8e288890596a89147666f6b603b`|
|`candidate-before.ts.txt`（原 host）|`85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`|
|原 RED `REPORT.md`|`c1cc72b7fbecc1226f93e87960a129ae7db11fc54fa20dfc333627422b50fe06`|
|原 RED `FREEZE.json`|`f6c7958e7057ffc28043e88dced681dfb4094c4b1745cc479e833a62da582754`|

`CANDIDATE-FREEZE.json` 保存全部输入和本目录证据 SHA256（不自引用自身），核对原 RED 证据未变、唯一 host 候选未变及受保护输入未变。root 已说明 Surface 的并行变更属于独立 CR01/02 候选，本报告不接受其功能。

## 尚未验证与停止边界

实际 UI、浏览器 timer 调度/滚动/focus/visibility、往返/刷新、HTTP、业务持久化、视觉均 **NOT VERIFIED**。没有启动服务、访问 DB/浏览器、改依赖/配置、提交或推送。真实浏览器后台节流可以延迟 timer 的实际执行，本候选只消除 UI-only clone 人为重设请求年龄，不承诺浏览器实时调度。

按单候选授权已冻结，等待 root 与 Surface 候选共同冻结后独立 UI 与正式接受。不扩展到未复现的一般卸载、URL/pop 或异步 callback 生命周期问题。
