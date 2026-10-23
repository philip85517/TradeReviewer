# NR-PEER-01：绝对请求截止时间独立因果 RED

状态：**causal-red-ready；RED 后停止，未修产品，未签 accepted**。执行者 `financial_g61`，模型 `gpt-6.1-sol / ultra`。本次属于 P1 正式第 3 轮前的有限根因验证，正式接受计数仍为 **2/3**。

## 结论和执行边界

真实 `useHomepageHost` → session → S 管线已复现：同一 owned read 在 t=10s 接收 `onUi` 后，t=15.01s 仍 pending；连续 UI 更新也有同样结果。没有 UI 更新的对照按期 timeout，新 identity generation 仍拥有自己的完整 15 秒窗口。独立测试 **2 FAIL / 3 PASS，exit 1，2.97s**，失败均为预期业务断言，未出现 setup/import 错误。

仅新增 `app/components/homepage-v25/navigation-deadline.test.tsx` 和本证据目录。未修改产品、原测试、原证据或配置；未运行重型/全量测试、类型检查、lint、浏览器、HTTP、数据库、服务或性能测量。运行前后，11 个冻结输入与新增测试的 SHA256 全部相同。`01-absolute-deadline-red.json` 保留完整 before/after 指纹和 `inputsUnchanged: true`。

## 最小实验与实际结果

所有用例使用真实 hook、session、S、jsdom history/sessionStorage。只有外部 reader 被保留为永不结算的 deferred promise；fake timers 明确设置 `Date.now()`，没有 mock host/S 的超时函数。初始来源为 market=a、账户 one、2026-10-22，完整 UI 包含持仓 query/sort/page 与 scroll。种子数据为 `seed-only`，不得被当作 owned read 成功。

逻辑 t=0 为 `2026-10-23T01:00:00.000Z`（`1792717200000`）。原实现 timer 等待 `15_010ms`，因此本次 oracle 精确检查 t=15.01s。

|用例|最小操作 / 期望|实际与证据|结果|
|---|---|---|---|
|D01|t0 owned read；t10000 `onUi({scrollTop:25})`；t15010 应清 pending 并 timeout|UI 后 token 的 generation/scopeKey/startedAt 数值相同；t15010 仍 generation=3、startedAt=t0，error=null、timedOut=false、reads=[3]；失败在测试第 60 行 `toBeNull()`|**RED**|
|D02|t3000/6000/9000/12000/14900 连续 UI 更新；t15010 同一请求应 timeout|每次逻辑 token 均等于初始 token，未新发 read；t15010 仍 generation=3、error=null、timedOut=false、reads=[3]；失败在第 79 行|**RED**|
|D03|t10000 UI 更新后验证同一逻辑 token 没有重新开始|generation、scopeKey、startedAt、requestCounter 全保持原值；未报错|PASS|
|D04|没有 UI 更新；t14999 pending，t15010 timeout|t15010 request=null、error=timeout、timedOut=true、data=seed-only；来源 storage 字节保持|PASS|
|D05|t10000 identity B（market=hk）创建新 generation；旧 deadline 不能截断 B，B 在自身 t15010 后 timeout|B generation=5、startedAt=t10000、purpose=identity；全局 t15010 与 t24999 仍 pending；t25010 才 timeout；reads=[3,5]，来源与种子数据保持|PASS|

D05 目标期间继续服从 S 的既有投影规则：传入 `rangeMode=all` 后 token 保留原自定义 2026-10-22 区间，本用例仅把 identity/新 generation/新 startedAt 当作变量，不另改期间合同。D01/D02 在首个失败断言处停止；后续 timeout/source 断言未执行，不把它们计为已通过。日志 trace 独立记录了当时 request/error/timedOut/data/read count。

## 因果追踪

1. `app/components/homepage-v25/use-homepage-host.ts:203–206` 的 `onUi` 调 `updateHomepageUi` 并更新 session。
2. `app/lib/reviews/homepage-v25-state.ts:387–392` 调 `makeState`；`:233–237` 用 `clone(core)` 重建 requests，`:81` 是完整 JSON clone。因此逻辑 token 未变，request 对象引用会改变。
3. host `:188–201` 的 timeout effect 依赖整个 `session.ui.requests.global` 对象。引用改变触发 cleanup 清旧 timer，并从当前 effect 安装时重新排完整 `15_010ms`。
4. `markHomepageRequestTimedOut` 只有 timer 触发后才检查请求年龄，不能挽回原定 deadline。D01/D02 与 D04 对照排除了 owned read 本身重启：都只有同一个初始 reader 调用，只有中间 UI 更新不同。

这证实了 peer 报告 `../navigation-recovery-peer/REPORT.md` 的 NR-PEER-01。其 baseline 比对已说明 timeout effect 先于本次 sourceRecovery 修复存在；本次不把继承问题冒充 navigation-recovery diff 新引入的回归。静态可推导单次 t10s 更新会把 timer 改排至约 t25.01s，但本实验只测到 t15.01s，不声称已实测后移后的最终触发时间。

规格来源：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP09 第 501 行规定请求超过 15 秒进入手动恢复。这里验证的是同一请求的截止时间，不能因 UI 滚动/搜索状态改变而重置其业务年龄。

## 原命令、环境与冻结

工作目录：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`。固定 Node v26.0.0，darwin/x64；Vitest v4.1.10。运行墙钟 UTC `2026-10-22T20:21:28.364Z` 至 `2026-10-22T20:21:32.055Z`（上海 2026-10-23 04:21:28–04:21:32）。fake request clock 与墙钟分开。

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node \
  .scratch/homepage-v25-implementation/evidence/P1/round3/navigation-deadline/run-red.mjs \
  01-absolute-deadline-red \
  node_modules/vitest/vitest.mjs run \
  app/components/homepage-v25/navigation-deadline.test.tsx \
  --maxWorkers=1 --reporter=verbose
```

原始日志 `01-absolute-deadline-red.log` 未过滤；含环境的 `DEP0205 module.register()` deprecation warning，与两项业务断言失败分开。runner 以 `wx` 写日志和 manifest，防止覆盖既有证据。没有第二次运行或碰绿。

|冻结输入|SHA256|
|---|---|
|当前 host|`85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`|
|新增 navigation-deadline.test.tsx|`f10c3e7ececd6322d155778ef9ccb74def1f861eeeef89e95c76131dba6aa457`|
|S|`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`|
|session|`828162fd03dcba7d4632a189444e54e1c4f0761d937c7bf0b4e4ad96abb4766e`|

`FREEZE.json` 索引本测试、runner、原始日志/执行 manifest、本报告及所有冻结输入的指纹。未在文件内自引用自身 SHA。

## 接受限制

**实际 UI、鼠标/键盘、真实 scroll/focus/visibility、HTTP/持久化、浏览器往返与视觉：NOT VERIFIED。**本次只建立可重复的 hook/S 因果 RED，不替代 root 正式接受或真实用户旅程。已按授权在 RED 后停止，等待 root 派发；没有修复产品，也未重置 P1 轮次。
