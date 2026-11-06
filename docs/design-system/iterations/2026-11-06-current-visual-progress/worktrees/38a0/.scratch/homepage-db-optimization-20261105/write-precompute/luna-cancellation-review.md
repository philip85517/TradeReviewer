# Luna 6 Max 独立复审：取消传播四文件 delta

日期：2026-11-06（Asia/Shanghai）

## 结论

**接受这次四文件取消传播 delta 的限定功能范围。** 本轮没有发现阻止该 delta 冻结的新 Critical 或 Important 功能/数据安全问题。该结论只覆盖 host 取消所有权到三个生产 homepage-view 读取入口的接线；不代表 Task 1 或首页预计算 Spec 全部通过。

Task 1 仍保留原报告中的完整 **Spec FAIL**：批量任务没有逐对象 target/completed/failed 进度，且扫描结束后已入队的全局计算不会因批次取消而撤销。全局保守刷新、host 15 秒 deadline 和完整页面 1 秒门槛也仍按原状态记录。

## 范围与字节核对

审查范围严格为：

- `app/components/homepage-v25/use-homepage-host.ts`
- `app/components/homepage-v25/use-homepage-host.test.tsx`
- `app/components/trade-review-workspace.tsx`
- `app/components/trade-review-workspace.homepage-view.test.tsx`

我逐项核对 `cancellation-fix-baseline/manifest.json` 与基线副本的 SHA-256；两者一致。当前四个文件 SHA-256 也与 `backend-cancellation-final-manifest.json` 的 after 值一致：

- `use-homepage-host.ts`: `db04427cac0a32551b86e517aa167e7839f6a0f9d6d1a12610ae06690d55cb6b`
- `use-homepage-host.test.tsx`: `a51ec13d6165738038d9a14634fb11665437de592ce560dbbc3f008110e26700`
- `trade-review-workspace.tsx`: `5560ec6a60451170ae0efab45dd1f61c5ee0d1e033f9373f1e308250f006f1d2`
- `trade-review-workspace.homepage-view.test.tsx`: `397080f6107138e7509e44c32596d9a2bef9a225e0793174400c089d966ac5cc`

实际静态审查使用冻结的 `backend-cancellation-four-file-delta.diff` 和当前代码，没有用 HEAD 相同性代替字节对照。

## Spec 复核

| 要求 | 结果 | 独立证据 |
|---|---|---|
| AbortSignal 独立传入，不污染 UI/context/JSON | **PASS** | `use-homepage-host.ts:44-47` 将 signal 作为 reload、resolveGlobalData 的独立参数；period/history callback 也以第二参数接收（:30-31）。`trade-review-workspace.tsx:2365-2368,2419-2421,2449-2458` 将其传给三个 homepage-view read 调用的第二参数；signal 没有加到 context 或 `HomepageViewRequest`。组件测试核对 fetch body context 的字段白名单并断言 JSON 不含 signal（`trade-review-workspace.homepage-view.test.tsx:66-68`）。 |
| signal 到达真实 fetch 与 202 等待 | **PASS（受控 fetch）** | 不变的 client 将 signal 放入 POST 的 `RequestInit` 并传给 202 轮询等待（`homepage-view-client.ts:55-64,75-80`）。工作区测试记录真实组件发出的 fetch `init.signal`，确认超时/卸载后 signal abort 且再过 1000ms 没有新 POST（`trade-review-workspace.homepage-view.test.tsx:35-81`）。这证明页面到 client/fetch fixture 的接线和轮询停止，不等同于真实浏览器网络栈验证。 |
| 超时、替换、离开、停用、卸载取消 | **PASS（host / 组件夹具）** | global/period/history 有分别持有的 controller，替换通过 `ownRead` abort 旧 owner（`use-homepage-host.ts:80-89,149-150,391,419`）；global 开始时撤销 period/history（:102-106,142-144）；configured global deadline 仍按 startedAt+15000ms 计算并 abort（:338-350），local deadline 仍为 15000ms（:363-366,462-474）；accepted 地址切换与卸载/停用会撤销 owner（:108-119,280-298）。公开入口用例覆盖期限前后、各域替换、卸载/停用/接受导航。 |
| guard 拒绝保留当前读取 | **PASS** | `navigate` 在 guard 通过之前不提交地址，也不调用 `acceptAddress`（`use-homepage-host.ts:482-498`）；公开入口测试确认拒绝后旧 signal 仍有效且其结果可以被接受（:540-555）。 |
| 旧 promise 不清新 owner/不发布迟到结果 | **PASS** | abort 后的 then/catch 提前返回；成功清理还通过 controller identity 检查，不能清除后继 controller（`use-homepage-host.ts:84-86,165-166,200-202,258-261,394-401,422-429`）。替换、迟到 resolve/reject 用例通过。 |
| React StrictMode 重放保留首次加载能力 | **PASS** | effect cleanup 取消 owner 并重置初始化 guard（`use-homepage-host.ts:113-118`）；StrictMode 测试确认第一次 signal 已 abort、重放建立不同且存活的第二次初读，结果可接受（`use-homepage-host.test.tsx:446-452`）。 |
| deadline 不漂移 | **PASS** | configured host 仍是 15000ms；非 configured legacy host 仍是 15010ms（`use-homepage-host.ts:338-340`）。global 与 local 测试验证 14999ms 仍存活、15000ms abort，UI 更新没有延长期限。 |

### 范围边界

本次通过证据覆盖 homepage-view client 的 fetch 与 202 poll。真实浏览器中的在途 HTTP 中断、重连/离开时序和桌面 UI **NOT VERIFIED**，由 root 继续验收。destination 为 trades 时，`readHomepageBundle` 的旧 collection/FX 分支不经 homepage-view client；本轮没有证明那些 legacy I/O 都物理取消，也不把这次 delta 表述为全 workspace I/O 取消。

服务端已排队的后台计算不由前端 AbortSignal 撤销；批量对象进度和取消已入队计算继续 **FAIL**。

## Quality 与定向复跑

复跑命令：

```sh
./scripts/native-node.sh node_modules/vitest/vitest.mjs run app/components/homepage-v25/use-homepage-host.test.tsx app/components/trade-review-workspace.homepage-view.test.tsx app/components/homepage-v25/homepage-view-client.test.ts app/components/homepage-v25/attachment-host.test.tsx --maxWorkers=1
```

结果：**4 files passed / 107 tests passed / 0 skipped / exit 0**，20.16s。运行时：Node `v26.0.0`、SQLite `3.53.0`；Vitest `4.1.10`。Node 输出 DEP0205 deprecation warning，没有测试失败。独立原始日志：`luna-cancellation-tests-20261106.log`。

四个测试文件只使用 fetch fixture、React 测试环境和 fake-indexeddb；没有打开任何业务 SQLite 路径。没有启动服务、构建、运行全量、修改产品或执行旧冻结测量工具。实现者报告中的 types/lint 结果未由我重跑。全量 workspace 旧 mock/未归因失败仍需 root 处理；前次 root 全量记录的 97 个失败没有在本审查中重跑、归类或称作全部基线，本次 107 项定向通过不能抹除它们。

## 最终判定

**取消传播 delta：限定接受。Task 1 完整 Spec：仍 FAIL。** 保留原 `luna-backend-review.md` 的失败与 NOT VERIFIED 状态；真实性能、完整 build 和浏览器验收由 root 负责。


## 附录：真实 Chrome 端到端 15 秒截止反例（root 追加证据）

本附录按 root 的最终浏览器记录追加；不改动前面的 107 项单测结果或静态结论。只读核对的实际文件位于本目录顶层：`final-browser-cancellation.json`、`cancel-browser-deadline.json/.png`、`cancel-browser-after-deadline.json/.png`（当前工作树没有名为 `cancel-browser-deadline/after-deadline.*` 的子目录）。

`final-browser-cancellation.json` 给出请求开始时间 `1793929158972` 与截止时间 `1793929174938`，相差 **15.966 秒**。到 deadline 文本仍含“正在读取新范围…”、“修复中…”和“正在读取范围，仍显示已提交数据。”。截图 `cancel-browser-after-deadline.png` 也显示持续忙碌状态；对应 JSON 快照在 elapsed 37.797s 时仍为 `ready: false`，busy 包含期间选择、当前表现指标和持仓。

Chrome Network 事件进一步证明 15 秒后 polling 未停止：

| 请求 | 相对开始时间 | 相对 deadline | 结果 |
|---|---:|---:|---|
| `33720.107` | 16.460s | +0.494s | HTTP 202 |
| `33720.108` | 16.978s | +1.012s | HTTP 202 |
| `33720.109` | 17.485s | +1.519s | HTTP 202 |
| `33720.110` | 17.998s | +2.032s | HTTP 202 |
| `33720.111` | 18.509s | +2.543s | HTTP 202 于 18.572s 返回 |

root 记录的约 18.6s 鼠标切回“全部”后，`33720.112` 在 18.609s 发出并于 18.652s 返回 HTTP 200；JSON 最终状态为 URL `market=all`、`ready: true`。这只能证明改回全部后恢复，不能证明 A 股请求在 deadline 被停止。

**更新综合验收状态：真实浏览器中的端到端 deadline 停止为 FAIL，四文件 delta 不能据此称完整最终接受。** 原 107/107 受控测试通过结论保持有效，但它没有复现真实 Chrome 中 deadline 后继续 polling 的行为。原先表格中的 deadline PASS 仅指受控 host/React 测试与代码静态路径；在真实浏览器门槛上已被本反例覆盖为 FAIL。不得据此推断 107 项单测无效，也不得把端到端 FAIL 用单测通过抵消。
