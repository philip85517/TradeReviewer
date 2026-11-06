# 桌面首页数据库接线：只读运行审计

Owner: `/root/astra_desktop_runtime`（GPT-6 Astra Ultra，只读运行审计）  
Task: D02 真实 DB；为 D03/D04 提供库存和性质证据  
Status: scoped-audit-complete；最终桌面诊断由协调者独立接受  
Evidence time: 2026-10-24 10:24:54–10:25:57 +08:00（02:24:54–02:25:57 UTC）

## 结论

**当前 127.0.0.1:3333 服务实际连接了 `conf/runtime.json` 指定的真实业务数据库，运行层连接为 PASS。** 新鲜 `lsof` 将监听 PID 29149、当前 worktree、业务库绝对路径及相同 inode 50862003 串联起来；随后两个已允许的只读 API 均返回 200。`/api/storage/trades` 的 1,866 条成交、213 个导入批次、236 个证券的完整 ID 摘要分别与本轮只读业务库快照一致，3/3 PASS。

这一结果排除了“该服务未打开真实业务库或 trades API 只返回空库”的运行层假设，**不等于 `/home?scope=live&market=a&accounts=*&rangeMode=all` 的首页资格、采集状态或桌面渲染通过**。本代理未操作浏览器，未请求 homepage-source、财务、FX、metadata 或其它 endpoint；桌面可见结果由主代理验证，首页筛选链由源码代理审计。

## 版本、范围和方法

- 基线 HEAD：`58bf0d90e68ddc634de180b3f5c3d16a089f0eb3`，当前为 detached HEAD，工作树已有大量产品及审计修改，全部保留。
- Worktree：`/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`。
- 本轮源内容清单生成于 10:24:54.949，覆盖 app/db/scripts/conf 及构建配置共 880 个文件；content digest `de7aae4a9905f2f51e167cfbf1e027777f92e9206f21454b5285b9230c2b6491`；见 [runtime-content-manifest.json](runtime-content-manifest.json)。该清单冻结磁盘内容；未检查 dev server 每个模块的内存编译版本，不能单凭 cwd 证明浏览器已加载全部最新代码。
- 用户触发：首页看似未连接数据库，要求当前桌面版本诊断。遵循 `AGENTS.md`、development-workflow、frontend-control-audit 与 systematic-debugging，先取证，不修复。
- 写入范围仅本目录 `runtime-*` 和本报告。未修改产品代码、配置、业务库，未启动/停止/重配服务，未提交/推送/合并，未派子代理。
- 直接 DB 探针使用配置的 Node `v26.0.0` 与查询得到的 SQLite `3.53.0`，以 `new DatabaseSync(path, { readOnly: true })` 打开业务库，在只读 deferred 事务内做 SELECT。未导入应用的 SQLite 初始化函数。所有 shell 调用使用 `login:false`。
- HTTP 请求仅 `GET /api/storage/status` 和 `GET /api/storage/trades`；先前被拒的主页 reload 没有重试。未输出账户明细、成交明细、完整账单或原始 API body。
- 保留 P1/F07/Bars 已达 3/3 的暂停状态；本报告不解除任何既有失败或未验证项。

## 进程与物理数据库

| 核对项 | 新鲜结果 | 证据 / 结论 |
| --- | --- | --- |
| 监听地址 | PID 29149，`127.0.0.1:3333` | [runtime-process.json](runtime-process.json)，PASS |
| cwd | 当前 `0dc6/TradeReview` | 同上，PASS |
| 配置业务库 | `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite` | 解析当前 `conf/runtime.json`；默认正式端口仍是 3022 |
| 实际打开文件 | 直接以配置绝对路径执行 `lsof -a -p 29149 <dbPath>` 成功，FD 34u、inode 50862003 与 `stat` 一致；同进程也打开该库 WAL/SHM | 同上，PASS；不是推测环境变量，也不是仅看 status 的 basename |
| 原生运行时 | lsof 显示 pinned Node executable 和其 `libsqlite3.dylib`；只读探针实际查询 SQLite 3.53.0 | process + DB 证据 |
| 原进程完整启动命令、启动时间 | `ps` 被沙箱 `operation not permitted` 阻止 | NOT VERIFIED；没有为此升级或反复重试 |

服务当时确实打开了真实业务库，而非标准 `make dev` 会创建的 `.data/tradereview-test.sqlite`。这是对既有运行状态的观察，本代理未改变其连接。不能以通用 `make dev` 说明冒充该现存进程的启动命令。

## 核心表和数据保护证据

只读快照：[runtime-db-before.json](runtime-db-before.json)（10:24:55.322）与 [runtime-db-after.json](runtime-db-after.json)（10:24:55.550）。摘要方法为每行键排序、行 JSON 排序，再对整表逻辑内容取 SHA-256；不是 SQLite 文件字节 hash。

| 表 | 数量 | 当前逻辑 SHA-256 | 上述窗口前后 |
| --- | ---: | --- | --- |
| executions | 1,866 | `a62b30a06ddb482d00c9394ae485414fe5f0a0c2124ce5ea75086ddcc35cb284` | count / hash 不变 |
| import_batches | 213 | `5df503b117465d4a1417243c0ad99c1f2b6d4bc284de7bbf0e5298b2c2c8bc60` | count / hash 不变 |
| trade_revisions | 11 | `ce9df05f98de4c5a56ff147dc97883631ebf3090cc2ac8effd44a76b3b6dd665` | count / hash 不变 |
| reviews | 138 | `cb7619ca003c6410e71975baa316247429be6c1b50294252d6caa2cf06843e45` | count / hash 不变 |

schema migrations 1–14 在该窗口内完全一致。与历史 09:47:44.470 +08:00 的 `BUSINESS-FINAL.json` 比较，原始成交、导入、修订三表 count/hash 仍一致；reviews 数量仍为 138，但 hash 已由历史 `c99f0daa…` 变为上述 `cb7619ca…`。变化已存在于本轮 before；本证据不能判定发生时间或责任进程。历史初始化 autosave 导致的 reviews 变化证据和问题仍保留，不以本轮窄窗口不变将其改成 PASS。

上述四表前后摘要的时间窗口早于成功的联网 GET。为遵循协调者避免重复已成功 DB/hash 取证的边界，本代理未在成功 GET 后重跑整库 hash；因此不把该窄窗口证明扩大为整段用户浏览器会话“完全无写入”。本代理自身的直接数据库句柄始终 readOnly，两个 GET 的 handler 是状态/库存读取路径。

## API 与真实库存

初次受限沙箱请求在 10:24:55 返回 `connect EPERM 127.0.0.1:3333`，保留 [runtime-api.json](runtime-api.json)。这属于工具网络限制，不能作为应用断连或 HTTP 失败证据。

协调者随后明确允许同一 localhost 的两个 GET 做窄范围网络升级。升级获准，10:25:56.725–10:25:57.226 的结果见 [runtime-api-approved-attempt.json](runtime-api-approved-attempt.json)：

| Endpoint | HTTP / 缓存 | 可观察结果 |
| --- | --- | --- |
| `/api/storage/status` | 200 / `no-store` | schemaVersion 14；instruments 236、executions 1,866、import_batches 213、reviews 138；daily_candles 154,410、market_candles 52,781 |
| `/api/storage/trades` | 200 / `no-store` | executions 1,866、importHistory 213、instruments 236 |

| 集合 | DB / API 数量 | DB 和 API 的相同 ID SHA-256 | 结果 |
| --- | --- | --- | --- |
| executions | 1,866 / 1,866 | `f1ba304ea8345abd02f84934ab3c3562536a39593770529b0577d2717b450a1f` | PASS |
| importHistory ↔ import_batches | 213 / 213 | `c2f85deea5de537a9bb046ec609ee489147ea7bd62562767b477c1ac74f3ed07` | PASS |
| instruments | 236 / 236 | `bf2c2ac372f76b9d0b604d94e7b7b6fd4a2e38bbdd86c45dabe55190f2dc13aa` | PASS |

比较使用排序后的完整 ID 数组，保留重复项；不是只比较数量。DB 参照时间为 10:24:55.322，与 API 取证相隔约 62 秒，非单个跨 HTTP/DB 原子事务。status 中的 `databasePath` 被 route 有意显示为 `tradereview.sqlite`，真实绝对路径由 lsof/inode 提供，而非该字段。

## 性质、券商和市场：不要混同存储空值与展示实盘

以下是 execution 级聚合，不是账户或交易回合数量。broker 使用原始证据的 `source.platform`，不会输出账户。

| source.platform | executions | SQL trade_nature | JSON source.tradeNature | JSON source.tradingNature |
| --- | ---: | --- | --- | --- |
| china-merchants | 375 | NULL | 缺失/NULL | 缺失/NULL |
| futu | 814 | NULL | 缺失/NULL | 缺失/NULL |
| tiger | 595 | NULL | 缺失/NULL | 缺失/NULL |
| tradingview | 82 | simulation | 缺失/NULL | simulated |

SQL `trade_nature` 汇总为 NULL 1,784、simulation 82、显式 live 0。**SQL NULL 本身并不自动等于领域 unknown。** 本轮另核对 API 投影和实际代码：

1. [sqlite-store.ts:848](../../app/lib/storage/sqlite-store.ts#L848) 的 `mapExecutionRow` 先读取 evidence.source，仅在 source.tradeNature 未定义时才补入字符串列值。因此 API 的 82 条 TradingView 为 `tradeNature=simulation`、`tradingNature=simulated`，其余 1,784 条两个性质字段均缺失；API 聚合证实这一点。
2. [types.ts:207](../../app/lib/trades/types.ts#L207) 的 `tradeNatureOf` 只采用显式 tradeNature 或 legacy tradingNature，最后 fallback unknown；对本次实际 API source 字段应用同一表达式，得到 unknown 1,784、simulation 82、live 0，见联网 API 证据的 `domainNatureUsingTypesTs207`。这是读取 API 字段后的确定性计算，不是把 SQL NULL 直接改名为 unknown。
3. [trading-nature.ts:5](../../app/lib/trades/trading-nature.ts#L5) 的 `tradingNature` / `displayTradeNature` 在两个性质字段均没有时，允许 futu/tiger/china-merchants 推导为 live；按本次实测 platform/nature 交叉聚合，会显示 live 1,784、simulation 82。[library.ts:253](../../app/lib/trades/library.ts#L253) 将该 display nature 写入 library entry，而 episode scope identity 保留 `tradeNatureOf`。因此普通交易库可以显示“实盘”，与 strict nature 筛选层不同；不能从 strict live=0 得出“没有导入真实成交”。

| market | executions | instruments |
| --- | ---: | ---: |
| CN-SH | 291 | 35 |
| CN-SZ | 131 | 21 |
| HK | 248 | 61 |
| US | 1,196 | 119 |
| 合计 | 1,866 | 236 |

A 股市场库存本身有 422 条成交、56 个证券；这不等于指定首页 strict live 范围中会出现 422 条，更不等于 422 个可计算财务回合。主页是否在 nature gate、account/market gate、source admission 或后续采集中清空，由另一份源码和桌面证据分别定位。

## 覆盖与未验证边界

| ID / 门槛 | 实际动作和结果 | 结论 / Owner |
| --- | --- | --- |
| D02 进程→业务库 | 新鲜 lsof listener/cwd/配置绝对路径/inode，PASS | 本代理 |
| D02 业务库→trades API | 2 个 GET 200、3 个 ID 集合匹配 | 本代理，PASS |
| D04 原始性质事实 | SQL、JSON source、API 字段、tradeNatureOf 与 display broker 规则分开核对 | 本代理事实 PASS；首页筛选接受属源码代理/协调者 |
| D01 桌面视口/截图 | 本代理未操作浏览器 | NOT VERIFIED by this agent；协调者负责 |
| D03 homepage-source 消费链 | 本代理未请求该接口 | NOT VERIFIED by this agent；源码代理/协调者负责 |
| D05 首页可见反馈/加载错误 | 未以 HTTP 200 或库存存在冒充桌面结果 | NOT VERIFIED by this agent；协调者负责 |
| 控件、键盘、触控、布局、写流程 | 分派为只读运行审计，无此操作范围 | 本代理范围 NOT APPLICABLE，不能作为整页 PASS |
| 产品修复/完整交付 | 未实施修复；暂停项未恢复 | 不作通过声明 |

可复核脚本：[runtime-capture.mjs](runtime-capture.mjs)、[runtime-api-approved-attempt.mjs](runtime-api-approved-attempt.mjs)。证据已保存，正常交接不需重新运行；脚本存在不代表授权扩大到页面加载或其它接口。
