# Candidate observer 低扰动边界复核 — 未激活

2026-10-23 03:55–04:00 +08；实际模型 `gpt-6.1-sol / ultra`。本次仅新增证据与合成测试，未修改原候选、产品、依赖或配置；未启动/停止服务，未使用浏览器、HTTP 或数据库，未执行 preload。该候选原作者也是本次复核者，这是补充源码/反例自审，不代替 root 的独立激活审查。

**结论：候选仍未激活，真实消费者仍 OPEN。** 原候选保持“不主动读取内容、不访问 bodyUsed、不额外安装 data listener/reader”的边界；但以下三个限制已由合成反例确认。现在不能把它描述为覆盖当前 `/home` 路径的完整捕获器，也不能把事件预算描述为总包装开销上限。

## 版本与执行证据

固定 Node26 唯一新增执行命令：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/homepage-v25-implementation/evidence/P1/round3/request-body-peer/low-impact-review-probes.test.mjs
```

`low-impact-review-probes.log`：**3 PASS / 0 FAIL，exit 0**。`low-impact-review-probes-manifest.json`：2026-10-22T19:55:30.966Z 至 19:55:31.419Z；候选/测试执行前后 hash 相同。只使用合成 EventEmitter dispatcher、SyntheticRequest 与内存流；没有 `listen()`。测试自然调用 `getReader()` 仅取得锁，不调用 reader.read，不读取内容。

| 文件 | SHA256 |
| --- | --- |
| `candidate-observer.mjs` | `864628680b8aaaaa0a8628390a31a8526271bce3add330e9f0bd0d8a3f646613` |
| `candidate-preload.mjs` | `2cc07345628ba3b43439dedcea55d0eccee9625ad58f48f7e2fc0324b1fa3733` |
| `low-impact-review-probes.test.mjs` | `71f1ec7a40b058a78acf79dbdde6de6eef84c7d4d67de3241e2f0d889f6d5200` |

原 `candidate-green-3.log` 的 10 PASS 保留，不把本次 3 PASS 解释为真实服务或 P1 接受。

## 已确认限制

| ID | 最小反例与已观测输出 | 根因位置 | 捕获解释与最小下一步 |
| --- | --- | --- | --- |
| OB01 | GET `/home`、GET `/home.rsc?synthetic=DO_NOT_LOG`：均没有 request-entry。GET `/trades` 被捕获；POST `/home` 被捕获但 route=`<redacted-path>`。敏感 query 未输出。 | observer:6–20 白名单没有 `/home`；127–130 跳过非 API 未知 GET/HEAD。 | 当前首页真实 GET/RSC GET 无 request ID；“没有消费日志”不能排除这些请求。root 若选择激活，应先决定是否只补已知固定 `/home` 白名单并重新验证；无需扩大为输出任意路径。候选本次未改。 |
| OB02 | `maxEvents=1` 后已有 trace-budget-exhausted；随后同一已追踪请求自然返回 4 个新 Web stream，仍新增 own `getReader` 包装；日志数量不再增加，四个流仍 unlocked。 | 43–49 只停止 emit；90–101 包装仍 active；104–118 在 exhausted 后仍 patch 新 stream/reader，69–74 继续积累恢复条目。 | 预算约束日志行数，不约束已追踪请求后续方法调用/新包装数或恢复列表大小。WeakRef 不等于零成本；不能宣称预算后停止观察。root 可选择真正停止后续安装的候选修订，或明确短时人工窗口与这种开销限制；本次不实施。 |
| OB03 | 第一次自然 body getter 返回流时记录 locked=false；随后自然 getReader 锁定；再次自然 body getter 返回同一流，但仍只有最初一条 locked=false 状态，另有 getReader consumption-intent。 | 110–114 WeakSet 在重复 stream 时提前 return；操作日志只含 Node 状态，不重采 Web locked。 | 不可把最近一条 web-body-returned 当成故障发生时状态。getReader 仅证明调用意图；成功返回的原生 getReader 与后续锁状态需按时序判断。若需要状态跳变证据，可在自然 getter 返回/原方法边界观察已得到的同一流公开状态，但不得主动取 body/bodyUsed/reader。候选本次未改。 |

## 保持的边界与仍需 root 决定的扰动

候选 method wrapper 用 Reflect.apply 保留 this/参数/同步返回值及 Promise 身份，同步异常对象原样抛出；不附加 Promise handler。原 body getter 只在框架自然调用时运行。日志只含固定路径标签、method、关联 ID、流公开状态、固定异常分类与代码位置，未记录 body/query/header/参数/任意错误消息。预算、日志失败、覆盖缺失必须显式视为缺口。

但包装改变函数 identity/name/length 与对象 own descriptor；同步日志写入及取 stack 改变时序。preload 提前 import srvx 可能改变模块初始化时机；当前只做过语法检查，**受控真实服务接入 NOT VERIFIED**。候选也未包装 Connect/Vite error handler，未把 overlay 广播与请求 ID 关联；native 内部路径、早缓存方法、另一份 srvx 实例、异步 rejection 仍可能绕开。读取 `this.runtime?.node?.req` 是已安装 srvx 的相关性前提，不能向任意自定义 getter 保证无副作用。

`Readable.toWeb` 自身正常 data/resume/read 桥接可能是 first consumption-intent，不等于非法的业务消费者；Node disturbed 也不独立证明 Web stream 不可用于 Request。只有同一原始 IncomingMessage ID 下的自然原调用与实际失败边界能形成因果候选。无复现、无日志或仅看见正常桥接均不能宣告修复或根因成立。

## 最小决策建议

1. 原候选保持冻结，先由 root 决定是否修订 OB01 的固定首页路径覆盖及 OB02 的预算行为；本报告不授权激活或重启。
2. 如以后选择受控窗口，沿用 `CANDIDATE.md` 的确切现有隔离 DB/端口与可回滚启动流程，并先记录原进程/启动参数。候选不创建第二业务库、不 reset 数据；现有 UI 保存验收结果保留。
3. 结论必须同时保留：同 ID 入口状态、first-intent 代码位置、自然 materializer throw、对应 method/脱敏 path 与原服务 stdout。OB03 的首次快照不可冒充 throw 时状态；需要浏览器 overlay 身份时仍由 root 单独记录 Network/时间。当前捕获仍是候选方案，真实消费者 **OPEN**。

原 `REPORT.md`、`CANDIDATE.md`、候选文件及全部 RED/GREEN 历史均未覆盖。返回导航的 NR04/NR06 是另一份有条件/API 层反例，不归因于本 Request body 问题，也不归因于 root 先前 Recall 立即 reload 现象。
