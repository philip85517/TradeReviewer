# Workspace 原 8 FAIL：只读核查

2026-10-23；执行模型 gpt-6.1-sol / ultra。本次只读日志、现有测试与源码，仅新增本报告；没有改产品或测试，没有运行测试、编译或 lint，没有操作浏览器、服务或数据库。P1 正式 1/3 FAIL、2/3 FAIL 历史不变，不提交第三候选；host 与其他产品继续冻结。

## 结论与计数边界

原 8 项中，6 项有后续定向 GREEN 的保存记录／当时检查点说明；2 项仍是未完成的生产消费者与测试入口迁移，不能签通过。6 项的历史局部结果也不等于当前冻结版全量已通过：08、10、15 没有保存完整命令及逐条 verbose PASS 名称，逐项归属的证据限度列于下表；本次不通过猜测或重跑填补。

必须保留三组不同版本、不同范围的结果：

|记录|实际结果|可以说明什么|
|---|---|---|
|`acceptance-2/verification/workspace-all.log`|原 95 项：50 PASS / 45 FAIL|正式第二轮原始失败，不能用后来的局部结果改写|
|`round3/05-workspace-original95-plus2-and-host.log`|Workspace 97 项：89 PASS / 8 FAIL；原 95 项为 87 PASS / 8 FAIL，新增 2 项 PASS；另 host/session 21 PASS；总 118 项为 110 PASS / 8 FAIL|这是最近保存的这一组完整 Workspace 运行结果，仍 FAIL|
|`round3/08…`、`10…`、`15…`|分别为选定子集，见下文|只有对应版本的局部证据，不能相加成“97 全绿”，也不能更新当前完整通过率|

原 8 项不是新增 8 个产品回归的同义词：其中有新页面替换后错误的同步等待、非目标端点被故障 mock、卸载节点引用，也有真实尚未落地的页面功能。逐项原业务验证意图仍须保留。

## 逐项映射

`#` 为原 45 项诊断附表编号，非本轮重新编号。源码行号绑定文末本次只读 SHA。

|原项／完整测试名|05 首错与确定根因|后续保存证据、当前源码核对|本次结论|
|---|---|---|---|
|#27 `preserves the review timeframe and cursor while top navigation re-enters training mode`|05:18–325，顶部导航后同步 `getByRole(tab, 按标的浏览)` 早于普通库 ready；停在入口，没有执行后面的 timeframe/cursor 保存断言。|`WIRING-CHECKPOINT-1.md` 明确记录本项在 08 PASS。08 实际整组还有其他 5 FAIL，不能把文件名 final 当全绿。当前测试 `trade-review-workspace.test.tsx:2916–2948` 已 await `findByRole(tab)`，再选真实黄金子回合；仍断言 active 1h、原行情游标、保存文档 working.timeframe 与当前 phaseContext.timeframe。|**历史局部 GREEN；当前全量未重验。** 首因是测试等待，不证明所有导航/Recall 状态都没有缺陷。|
|#34 `refreshes every trade episode regardless of the selected episode`|05:327–690，找不到交易库；09 的实际请求轨迹证明 aliases 正确 URL 为 `/api/storage/tradingview-account-migration/aliases`，旧单例 mock 少了 `/storage`，落入 502 故障分支。账户恢复 error 阻断 ready，而非被选 episode 导致刷新缺失。|09 保留明确 `账户范围恢复失败` 与两次实际 aliases 路径；`WIRING-CHECKPOINT-1.md` 明确记录修精确 endpoint 后 10 本项 PASS。10 是 2 PASS / 2 FAIL，不是整组 GREEN。当前测试 :3617 起保留选择旧／新回合、intraday 请求起止、计划草稿 `12` 和原 toolbar/select 实例不重挂等断言；只为 aliases 返回合法数据，其余目标行情仍故障。|**历史局部 GREEN；当前全量未重验。** 不把这里的 Recall 刷新用例与首页 daily-only 修复用例合并。|
|#35 `uses META as the market-data symbol for historical FB trades`|05:692–1055，同样在交易库 ready 前被错误 aliases mock 阻断。历史 FB→META 请求／保留 US:FB identity 的断言当时未运行。|08 本项仍 FAIL；检查点明确说 10 筛选没有选中本项，不能用 10 给它签 PASS。后续 15 是按“剩余 aliases 三项＋stale DOM”收口保存的 4 PASS / 93 SKIP；本项属于该 aliases 三项。当前测试 :3739–3803 正确分派 aliases，仍要求所有 intraday 请求用 META，merge instruments 保留 `id: US:FB` 及 `Meta Platforms, Inc. (historical FB)`。|**后续四项定向 GREEN 的归属记录；15 本身不含逐条 PASS 名／命令，逐项日志归属存在限度。当前冻结版未重验。**|
|#36 `keeps the library chart available after a cancelled import with failed market refresh`|05:1057–1367，上传前搜索框不可达；aliases 也被目标行情 502 mock 打坏。修 endpoint 后 10 不再卡 ready，而是全页正则匹配多个真实“打开…第N次交易”按钮。|10:12–306 保留第二首错，不能说仅修 endpoint 就通过。当前测试 :3805–3835 已先定位“小鹏汽车交易回合”region，再在内选真实子回合；仍实际上传、取消，断言 merge executions 为空且原图表可用。15 的 4 项收口包含本项，紧凑日志逐项限度同上。|**后续四项定向 GREEN 的归属记录；当前全量未重验。** 没有删除取消／不写入／图表断言。|
|#37 `keeps library context through a confirmed import with failed market refresh`|05:1369–1731，同错误 aliases 故障夹具使普通库未 ready；并未到达确认导入。|08 仍 FAIL；检查点明确 10 未选中本项。当前测试 :3837–3891 对 aliases 合法返回、目标行情仍 502；保留 merge 3 executions、确认弹窗关闭、hydrated Recall 图表、返回交易库以及搜索值 XPEV。15 的 4 项收口包含本项，紧凑日志逐项限度同上。|**后续四项定向 GREEN 的归属记录；当前全量未重验。** 回调／内存 fixture 通过不升级为真实 DB 导入持久化通过。|
|#41 `passes stored instrument metadata into the trading room scope`|05:1733–2095，仍等待生产中已卸载的旧 `我的交易室` region，然后用旧“交易室范围／更多筛选／ETF radio”。首错后 persisted metadata 的过滤结果未验。|当前测试 :5357–5411 仍保留旧入口和 `assetType: etf` 的 bootstrap metadata；当前 `home-surface.tsx:249` 附加筛选 disabled，生产 `HomeSurface` 不提供旧 scope region。P3 目前已接受的最小目录搜索／详情切片没有完成四区 ETF 筛选消费。无本项后续 GREEN。|**未闭合：生产筛选消费者＋等价测试迁移 REQUIRED / NOT VERIFIED。** 不能删除原 ETF 业务断言，也不能恢复旧 dashboard 或仅改成“按钮存在”使测试变绿。|
|#42 `retains alternate simulation runs when the complete room changes its shared scope`|05:2097–2459 先卡旧首页“1 个未平仓回合”；迁移裸全局 `/trades` 后，08 持有已卸载 runs select，选 scope 后仍断言旧节点；10 修 runs 重取后又持有旧 nature select，切 live 实际未作用到新控件，故共享模拟运行仍存在。|08/10 两个后续首错都保留；当前测试 :5413–5481 将 nature/runs/libraryRun/libraryAccount 都改为每次 query 的函数，使用真实 simulationRunId 与 account；仍验证 run-a/run-b 完整选项、切换、open 过滤零结果、清除、live 隐藏 runs、返回 simulation 后完整账户/运行目录，以及选 run-b account 后清空冲突 run。15 四项收口含 stale DOM 本项。|**后续四项定向 GREEN 的归属记录；当前全量未重验。** 修的是测试节点生命周期；不是将 unknown 补 live，也没有删除目录断言。|
|#45 `returns to the trading room with its filters, period, and calendar view after opening a holding review`|05:2461–2824 首停旧“1 个未平仓回合”；后续还依赖旧近 3 自然月、币种筛选、年日历及“打开持仓回合复盘”入口。|当前测试 :5536–5592 仍保留原断言；当前 `HomeSurface:256` 期间、:288 历史区仍明确未接入，附件筛选 disabled。真实新旅程应为持仓／目录详情→普通库→必要 Recall→返回来源；P2 期间／日历及 P3 附加筛选尚未完成，不能用已通过的局部 holdings query/sort/page restore 或搜索返回代替。无本项后续 GREEN。|**未闭合：P2/P3 页面消费与批准旅程的等价迁移 REQUIRED / NOT VERIFIED。** 不能用 host snapshot 纯函数通过当期间／日历可见恢复通过。|

### 08／10／15 的原始输出限度

- **08**：Workspace 6 个实际执行用例为 1 PASS / 5 FAIL / 91 SKIP，另 host 一个 PASS；总 2 PASS / 5 FAIL / 109 SKIP（116）。失败名明确是 #34、#35、#36、#37、#42；#27 局部 PASS 的归属有同版本 `WIRING-CHECKPOINT-1.md` 逐项记录，但本紧凑日志没有打印该 PASS 名称。
- **10**：Workspace 2 PASS / 2 FAIL / 93 SKIP；明确 FAIL 是 #36 多匹配、#42 旧 nature 节点。#34 PASS 有当时检查点记录；#35／#37 当时明确未被选中，绝不倒填到 10。
- **15**：Workspace 4 PASS / 93 SKIP，03:06:49 开始。与当时“剩余 aliases 三项（#35/#36/#37）＋stale DOM（#42）”收口上下文和当前对应最小修正一致；**日志没有保存匹配表达式和四个逐条 PASS 名称，故本报告把归属与输出本体分开陈述**。未为了补证再跑测试。后续正式集成检查应保存完整命令、版本和逐条结果。

## 仍未闭合两项的额外来源边界

#41 与 #45 还不只是换 selector：两者现有 execution 都沿用 `availabilityExecution`（测试 :308–325），其 futu source 没有显式 nature。`app/lib/trades/types.ts:207–208` 将缺失 nature 保持 unknown，`homepage-v25/holdings-model.ts:41–46` 只收明确 live。#41 的 statement metadata 只证明 ETF 分类，不能证明 live 性质或 US 交易所；#45 的旧 open 回合也不能直接冒充新首页 live 持仓。

后续必须拆清原有验证意图及批准的新入口：保留 legacy unknown 全局库可达性，另在已有可信 live 来源的真实首页消费者中验证分类／期间／来源恢复；如需要新 fixture，应有明确来源语义并保留原 unknown 反例，不能静默给现有记录填 live。ETF 过滤和币种／期间／年历状态都要以实际新控件和四区共同资格验证，不能依靠 metadata 目录展示、普通库局部过滤或 UI-only storage 字节独自替代。

## Cash：是相邻 lint／状态护栏，不是这 8 项之一

现金成功写入后 503 的旧 UI 断言曾在更早版本失败，但 **05 的 8 FAIL 名单没有现金测试**。本次不得把 cash 的 3 PASS 再从 8 中扣除。

- `CASH-CHECKPOINT.md` 与 `cash-only.diff` 记录有限修复：仅新增带 scopeKey 的 transient reset，当前 Workspace :1986–1994 在 key 改变时一次性清 saving/fact/error；下一 render key 相同，不循环。原 effect 的 request/write sequence、取消、异步数据读取和 read-only retry 保留。未用 microtask、timeout 或禁规则回避 lint。
- `11-cash-behavior-before.log`：03:05:57，3 PASS / 94 SKIP；`13-cash-behavior-after.log`：03:06:25，同 3 PASS / 94 SKIP。它们是**行为回归护栏**，修复前已经通过，不存在新行为 RED。
- 三项现有完整名字分别为 `keeps a successful typed save observable when summary refresh fails, then retries with reads only`（测试 :1465）、`keeps the saved fact and read-only retry after repeated summary failures`（:1500）、`drops a late save and summary failure after an actual caller scope A-B-A switch`（:1545）。保留 PUT 仅一次／expectedRevision 2、保存事实、重复 503、可见只读 retry，以及跨 scope 迟到 PUT/summary 不发布等原断言。
- `root-cash-regression.log`：root 独立保存 03:14:47 的 3 PASS / 94 SKIP。日志是紧凑汇总，不包含源 hash 和逐条名称；结合当时 cash checkpoint，属于该 cash 版本的独立局部回归，不是当前 host 变化后的全量认证。
- 真正 RED 是 `12-cash-lint-red.log` 的 1 error / 10 warnings（effect 同步 setCashSavedFact）；`14-cash-lint-green.log` 及 `root-workspace-lint.log` 均为 **0 errors / 10 warnings**。warning 没有消失，不宣称全量 lint 无问题。现金 patch 当时 Workspace SHA 为 `058e952eb866041836ee0f119a58fc4be32ec8e3a5880f0c97298e772c46c764`，与当前后续 P3/cold-read 版本不同。

## 当前冻结版本与后续检查的边界

本次读到的 Workspace 生产分支仍明确 `showDemo ? ReviewDashboard : HomeSurface`（:5930–6000）；普通库区 :6060 起保留 direct scoped/global origin 与真实 source return。`readHomepageBundle` 的完整 bootstrap／aliases／daily／FX 与 owned read 发布仍是新路径；不建议为旧测试退回无归属 external latest bundle。后续 cold direct-trades 修复和最新 navigation-recovery host 的 43 PASS 分别有自己的冻结证据，**不能把它们追加到原 Workspace 89 PASS 来消除这 8 项**。

本次没有当前冻结版 97／99 项完整 Workspace 实跑结果，也没有单项换序试验。故：

1. 历史六项只记局部修正与 GREEN 记录；全部原业务断言保留，最终受影响闭包仍待 root 调度实际运行并绑定同一消费版本。
2. #41／#45 仍须等待相应 P2/P3 生产消费与批准入口迁移，当前不修改、不预签 PASS，也不触发 P1 正式第三轮。
3. 05 的八个首错都能沿具体入口／夹具／节点／未实现消费者解释，未发现该日志证明的顺序污染；**当前没有换序对照，顺序污染未排除**。
4. NR04 的 root 真实重试恢复与 43 hook/session 测试是 navigation recovery 的局部证据，不解释也不关闭原 Recall 自动选择错误证券的 OPEN 根因。

## 本次只读输入指纹

以下 SHA256 在本次核查读取时计算；旧日志未修改。没有将后续源码与旧日志混标为同一版本。

|文件|SHA256|
|---|---|
|`acceptance-2/verification/workspace-all.log`|`cf24867a0f76781f065e0a7791b5e6f0b63e5dc33aa25ce301ffaf265c738d0f`|
|`round3/WIRING-CHECKPOINT-1.md`|`9dac9eb65704cde501d7dee4b815efeb89f2352d63c2a643a1f4019a2fe26724`|
|`round3/05-workspace-original95-plus2-and-host.log`|`6e6dbfa2f4f835aa488986346537ce1776752ede3f9c1d00fed2e7dcd73e2eaf`|
|`round3/08-final-six-and-nondefault.log`|`d9c7701ebc5da4b17c7df31a2a390ddb158e44653eedf54a23866ece50c9d1db`|
|`round3/10-aliases-and-requeried-runs.log`|`9f99d0549d42697664d9ff47b7b1c45ecf1c72e9435052b0904126509229aa50`|
|`round3/15-aliases-and-dom-targeted.log`|`af09b4927ded70c6b8d1fe585c538f83ab1193f5dbc47e35150c15913d923935`|
|`round3/root-cash-regression.log`|`44c8c976f8e82af345ba2a61740e588de8c796d04853f536d2d8835cd897d0fb`|
|`app/components/trade-review-workspace.tsx`|`6d255f0e1ed1a0af1d094cedb769cfe7fd33c6164c87b46a8ba8f57944581d22`|
|`app/components/trade-review-workspace.test.tsx`|`4e9a6823ec30acb94672aac5180824209d9d960ac1a704baf944c6bc3ab030c5`|
|`app/components/homepage-v25/use-homepage-host.ts`|`85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`|
|`app/components/homepage-v25/home-surface.tsx`|`914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5`|

本报告不签 P1 完成、P3 完成、全量通过或真实持久化通过。等待 root 新授权。
