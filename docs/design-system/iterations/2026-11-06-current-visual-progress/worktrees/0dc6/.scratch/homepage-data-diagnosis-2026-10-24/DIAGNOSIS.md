# 首页无交易信息：诊断结论

2026-10-24，root，systematic-debugging。当前 C4 生产预览 4392，桌面 CSS 1440×1000、DPR 1；未实施产品修复。

## 结论

现象有多条原因：新旧页面使用同一验收数据库，但对历史记录的交易性质采用不同口径；首页全量读取/组装超过整体截止时间；来源完整性还会阻止财务结果变成已知数值。历史区另有明确的未接线状态。把这些现象都解释为“没有连接数据库”不符合本次证据。

| 用户问题 | 本次结果 | 证据 |
| --- | --- | --- |
| 底层数据库是否正确和一致 | 两页面同一进程、同一 SQLite；4392 明确使用隔离验收副本，而非实时业务原库。原始成交全部存在 | [进程/句柄/逐行对比](VERSION-AND-DATABASE.json) |
| 解析接口协议是否有问题 | 当前真实响应 HTTP 200，完整结构和 SHA 绑定校验通过；两接口成交集合相同。业务性质与来源证据契约存在差异 | [真实模块探针](PROBE.json) |
| 请求是否阻塞 | 当前桌面两次复现整体 15 秒截止超时；独立 HTTP 读取正常返回，后续行情与财务计算链是重点 | [浏览器](BROWSER.json)、[完整首页状态](home-final-full-AX.txt) |
| 内部异常是否遗漏 | 未观测到本次 thrown exception；已确认有未展示的来源诊断和丢失异常原因的分支，不能据控制台为空断言没有内部问题 | 下文及 [问题票](issues/04-failure-observability.md) |

## 1. 数据库与数据完整性

当前 PID 60461 的 4392 服务实际打开 `.scratch/homepage-one-second-development/evidence/candidate-04/candidate.sqlite` 及其 WAL/SHM。首页 `/api/storage/homepage-source` 与旧库 `/api/storage/bootstrap` 都调用 `openSqliteDatabase()`，没有首页专属数据库。真实 API 均返回 1,868 条成交，按 ID 排序后全对象摘要一致。

`conf/runtime.json` 指向 `/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite`。对业务库和验收库均用 SQLite readOnly 打开，按 SQL 主键逐列对比：

- 业务库 1,866 条成交全部在验收库，missing=0、changed=0；验收库另有此前验收导入的两条 TradingView 模拟成交。
- 业务库 213 个导入批次全部相同，验收库额外 1 批；11 条修订全部相同。
- 两库并非完整字节副本：reviews 有 1 行 updated_at 不同；instruments 全部 236 行 updated_at 不同，其中 48 行 metadata_json 不同，另加 1 标的。不能把“原始成交相同”扩展成“全库完全相同”。这些是快照/运行库差异，本次没有证据将其归因于本次诊断。

因此，4392 不会自动获得副本建立后的业务库新导入，但这不能解释本次“已有 1,784 条券商成交在旧库可见、首页不见”。本次未切换数据库或修改任何成交性质。

代码：`app/api/storage/homepage-source/route.ts`、`app/api/storage/bootstrap/route.ts`、`db/sqlite.ts`。

## 2. 线上的协议通过，业务语义不一致

真实首页响应包含 `homepage-stored-collection-v1` receipt，scope=`all-persisted-records`，enumeration=`complete`；1,868 executions、237 instruments、214 importHistory；storage projectionGaps=[]。探针调用生产代码的 `parseHomepageStoredCollection` 完成结构和 payloadDigest 校验，无异常。旧库和首页原始执行记录没有传输丢失。

实际分类结果：

| 分类方法 | 实盘 live | 模拟 simulation | unknown |
| --- | ---: | ---: | ---: |
| 首页严格 `tradeNatureOf` | 0 | 84 | 1,784 |
| 旧库兼容 `displayTradeNature` | 1,784 | 84 | 0 |

业务库和验收库的 SQL `trade_nature` 都有 1,784 条 NULL；不是 HTTP 映射丢掉了已有 live 字段。旧库对没有显式性质的 futu/tiger/china-merchants 记录按来源兼容归为实盘；首页持仓和附件组选源要求显式 live，因而排除这些记录。

真实桌面对照：普通 `/trades` 选择“实盘”显示 **232 标的、732 回合**；从首页“进入交易库”生成 `/trades?scope=live&market=all&accounts=*&rangeMode=all`，显示 **0 标的、0 回合**。后者使用首页严格选源；同样写“实盘”不代表两条路径采用同一资格合同。

此外，直接以当前真实源运行既有财务投影/完整性模块，刻意不读取行情且 fx=null：representation=`unknown`，gapCount=3,056（只保存前 64 条详细诊断），含 `no-original-carrier`；universe 还含 `unassigned-evidence-scope`、`unresolved-corporate-action`；严格 selectedEntries=0。这证明即使先去掉行情等待，也不能把当前源当作完整且非零的实盘财务输入。该探针不是完整财务结果或性能验收，不能断言线上某一次超时已经运行到这个阶段。

代码依据：

- `app/lib/trades/types.ts:207`：严格性质；`app/lib/trades/trading-nature.ts:5`：兼容券商推断。
- `app/lib/storage/sqlite-store.ts:849`：数据库行映射，会保留 SQL 明确性质。
- `app/components/homepage-v25/holdings-model.ts:50`、`attachment-groups.ts:50`：首页只收明确实盘。
- `app/lib/import/statement-evidence.ts:644` 附近：非明确 live 的 carrier 不证明已处理；`financial-acquisition.ts:191`：receipt/来源检查与诊断。

本链路读取已持久化数据；新文件解析器的 lazy dispatcher 不是“旧库有数据、首页无数据”的已证实根因。也不能仅将所有 unknown 自动改 live 来关闭问题，尤其不能混入模拟记录或改变原始回合身份。

## 3. 超时漏斗：本次与历史证据分开

本次 4392 单次独立原生 Node HTTP 观测（包含读取响应 body，不是浏览器冷访问 p95）：

| 边界 | HTTP | 总耗时 | 字节 |
| --- | ---: | ---: | ---: |
| homepage-source | 200 | 540.35 ms | 6,329,541 |
| bootstrap | 200 | 249.18 ms | 6,327,800 |
| fx（缓存已齐） | 200 | 4.85 ms | 349 |

Node 探针另测首页结构/摘要解析 332.42 ms、prepareAcquisition 1,038.02 ms、无行情 entries 235.26 ms、无行情 complete 653.09 ms、ownSource 61.35 ms。这些是不同边界，不能与浏览器计时混合成一条精确端到端延迟，也不能作为正式基准。但它们直接证明获取 body 后仍有不可忽略的本地处理。

本次实际桌面首页两次最终显示“读取已超时，新范围未应用”；第二次在导航后约 18.4 秒被观察到终态，数值包含跨工具调度，**不是精确页面耗时**。源码绝对截止为 15,000 ms，并在 catalog/domain 同步计算后再次检查，超过截止就拒绝发布结果。超时不是一个 SQLite 查询超时码。

当前 `trade-review-workspace.tsx:2232` 的顺序是：

1. 原子源与 FX → 源校验与月结投影 → aliases → 所有成交的证券摘要。
2. 对全部 236 个成交证券 `Promise.all(readInstrumentMarketState(...includeIntraday:false))`，不是先按严格 live 资格筛选，也不是只读当前首屏需要的证券。
3. 组装全部 entries → 再次源绑定校验、来源诊断和指纹 → catalog → ownSource/financial view/holdings → 截止校验 → 发布。

旧交易库/首页 scoped collection 的读取可跳过该整批行情，因此“旧库能看到”不能证明首页金融链也能及时完成。全局超时只终止接收/发布，当前 loader 未向 source/market reads 传入统一 AbortSignal，后台工作可能继续。

历史 [完整 profiling](../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md) 在旧隔离 4391 开发版本定位过：236 证券行情约 7.24 秒、complete 约 3.85 秒、fromGlobal 约 3.70 秒，总计约 17.54 秒。它支持当前代码路径的瓶颈解释；**这些数字不是本次 4392 的逐阶段新测值**。本次没有重新捕获浏览器完整性能轨迹，不能对两次超时的每一个毫秒做归因。已有证据不支持把本次主要原因定为数据库锁等待或接口一直不返回。

## 4. 隐藏诊断与错误状态

当前真实接口、源校验、无行情财务组装没有抛错；两次桌面控制台 warn/error 查询为空，服务日志只有启动记录。不是“已确认不存在内部异常”，因为：

- homepage-source/bootstrap route 的 catch 不保留错误对象、堆栈或 requestId，只返回通用 503。
- `sqlite-http-client.ts:161` 将首页结构/摘要异常统一替换为 invalid-response，丢失原 cause。
- `use-homepage-host.ts:216` 对过期请求直接返回；已经超时则只呈现 timeout，原始异常可能不可见。
- 真实模块已返回来源 unknown/3,056 gaps；它们是业务诊断，不会自然成为 console exception。

桌面可见状态亦存在问题：[首页超时截图](home-warm-desktop.jpg) 顶栏显示 timeout，但期间仍显示“期间数据读取中”，持仓为“当前范围暂无持仓”并建议导入，容易把失败/未知误认为已成功读到零条。`period-surface.tsx:62` 的 view=null 占位没有区分全局终态；`home-surface.tsx:331` 的空态依赖 ready/rows，而非成功完成财务来源。

历史已平仓区源码 `home-surface.tsx:337` 明确保留“尚未接入”；workspace history status=`not-wired`。该区域没有历史信息还包含未实现接线这一原因，修复数据库或延长超时也不会自动接入。

## 后续修复顺序建议（未实施）

1. 先确定历史券商来源的受审计性质归属及兼容策略，形成首页与库一致的作用域合同；保留 unknown/模拟隔离、原始成交与回合身份。补齐原始 carrier、月结归属和 corporate-action 诊断，不能伪造 complete。
2. 以该合同制作真实非零金样，再针对读取范围、行情调度和重复源处理统一设计；分开验收交易可见性与财务金额完整性。整体 ≤1秒仍 FAIL，不能通过延长 15秒截止或只验骨架解决。
3. 为请求各阶段增加关联 ID、耗时、数据规模、失败阶段、cause 与取消状态；日志不写原始金额/账号。同步明确 loading/timeout/unknown/empty/not-wired 五类 UI 状态。
4. 本次仅诊断。财务 P1/F07、Bars 原暂停 3/3 保持；涉及它们的实现需要恢复原任务，不能借诊断票重置。独立 UI/可观测性修复也尚未在本次实施。

## 版本与验证边界

- HEAD 58bf0d90 加 C4 冻结工作区。重新核对清单 884 文件，missing=0、changed=0；9 个入口 JS/CSS hash 均与原绑定相同。没有 rebuild 或替换服务。
- [Vitest 探针](probe.test.ts)：1/1 PASS，真实 API 和实际领域代码，无产品 mock；此 PASS 是诊断探针成功执行，不是首页验收通过。早期 harness 的 sandbox EPERM、scope 初始化错误、表无 id 错误均保留日志，不是产品修复轮次。
- [只读比较工具](compare-and-bind.mjs) 按主键核对行，不输出账号、金额或原始 evidence；实际业务库连接为 readOnly。页面自身既有 metadata 自动写入只发生在隔离运行库。
- 真实桌面观察与鼠标/浏览器语义点击见 [CONTROL-AUDIT](CONTROL-AUDIT.md)。未做新导入、保存或一键修复，未验证正常数据视觉，未声称全页控件通过。
