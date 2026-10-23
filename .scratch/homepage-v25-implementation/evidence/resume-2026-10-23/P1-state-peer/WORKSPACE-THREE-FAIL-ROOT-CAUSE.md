# P1 冻结第 1 轮：三个 Workspace FAIL 的独立根因诊断

诊断者 `/root/state_g61`，实际模型 `gpt-6.1-sol / ultra`。2026-10-23 01:59–02:06 Asia/Shanghai；本次只读产品，仅在独占 peer 目录新增探针、源码副本、日志和报告。按 systematic-debugging 阶段 1–3 做原始复现、HEAD 对照、单变量验证；没有产品修复，没有正式接受 P1。

结论：**gold 路径揭示全局普通交易库丢失历史记录可达性的真实回归；cash 是旧展示位置的断言失效；sidebar region 首个失败来自 malformed aliases mock 与新增初始化门槛，修正这个单变量后继续暴露相同的历史记录过滤回归。** 不能把三个失败统称为 fixture 缺 nature，不能给原始记录补 `live` 来取得绿色。

## 版本、方法与证据边界

固定 worktree `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`；HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`。Node 固定为 `/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node`，v26.0.0。精确测试 include，未全量跑测。未运行浏览器、服务、SQLite、业务数据库或真实 HTTP；Workspace 探针使用其原有 mocked fetch、fake-indexeddb、jsdom 内存 local/sessionStorage。

主诊断固定执行 freeze-1 的 Workspace、host、session、holdings、home-surface、fx-adapter 字节，通过 Vitest transform 覆盖模块输入。HEAD 组只把 **Workspace** 换为 `git show HEAD:...`，其余所列固定输入相同，fixture nature 不变。未固定完整传递依赖图，不能把本报告当作 F 接受或全仓冻结；性质过滤根因另由固定全部直接构造/筛选输入的纯函数探针证明。测试副本保留三项原始用例及 helper，仅重定位相对 import、追加诊断 afterEach；因果变体另标。原始 53/59 FAIL 均保留。

| 输入 | SHA256 |
|---|---|
| HEAD Workspace | `608f67cf29284bad6c252ba4843b2bc20fe67e9ef43583247d88e8fdc729e74b` |
| freeze-1 Workspace | `55e40ada6ba54e64fe1e714eeca7af7a267822471fff5169ce1761b6af52db8c` |
| freeze-1 host | `67ca968a215963a648c09033ac76f65a2c321b23f88e896f71aa18693c2ca4b9` |
| freeze-1 session | `45e73c3b315b75f1660d6829694272d0d5bfcd1f51452a95fcacd2accf652973` |
| freeze-1 holdings | `8fe5dd40ad258f48bbc3cddee16f925798b8ecb089caf03f6991a2f7ab45621c` |
| freeze-1 home-surface | `11e9111792fb403bcbaa8c1f829ee72efab3a3586ee48692445873441d75d58e` |
| 原始当前 Workspace test | `eadb211335a32dbb21e929f4d59fc203f6b9a69e7de1e03a225ab6bebfd266ab` |

每组完整输入/开始结束时间/命令/前后哈希见各自 `manifest.json`。HEAD 首次 manifest 中 Workspace 的 `source` 文字误标为 freeze copy，但实际保存字节和 SHA 是上表 HEAD 内容；后续 runner 已修正该文字，未覆盖首次证据。

`workspace-three-freeze1-alias` 运行期间 owner 改了 ambient home-surface，manifest 如实记录 `changedWhileReading`；**执行输入仍为 runner 内捕获的 freeze-1 字节**，不能把该组当作“当前树完全稳定”的证明。HEAD、freeze1、cash-selector、alias-unknown 组观察清单前后稳定。随后 `workspace-three-reference/` 记录到 owner round-2 Workspace 已为 `dbe69b2b4e4d94ff82420ca2e471469d47f13214b89b77d39ecb902f26e3509b`；本文定位均指冻结副本，未声称该后来版本已修复或仍失败。

## 最小复现结果

Runner：`run-workspace-three-diagnosis.mjs`。以下标签各有独立目录，拒绝覆盖既有输出。

| 标签/唯一因果变量 | 结果 | 可观察事实 |
|---|---|---|
| `head`：仅换回 HEAD Workspace | **3 PASS**，89 skipped | 三个既有完整用例均通过 |
| `freeze1`：冻结 Workspace | **3 FAIL**，89 skipped | gold 无复盘按钮；cash 无旧 `现金状态` label；sidebar 无交易库 region |
| `freeze1-cash-selector`：仅 cash 断言改查数据管理中的原提示 | **1 PASS**，91 skipped | 原 PUT 次数/expectedRevision、成功事实、重试后只读断言全保留 |
| `freeze1-alias`：仅第三项 aliases mock 返回合法 `{aliases:[]}` | **1 FAIL**，91 skipped | 交易库 region 出现，接着找不到小鹏展开按钮，0 标的/0 回合 |
| `freeze1-alias-unknown`：在上项基础仅选择来源未知 | **1 FAIL**，91 skipped | 性质选择已执行，仍找不到小鹏展开按钮 |
| `workspace-nature-reachability-2`：真实构造器+筛选器的纯数据对照 | **4 PASS** | 验证“旧记录丢失”观察式，以及显式 live/unknown 对照，**不是产品通过** |

精确重跑命令已在 manifest；示例为固定 Node 执行本目录 runner 加上标签。既有标签拒绝重用；重复验证须用新目录，保留 RED。纯数据首次 probe 因我写错一层相对 import，收集到 0 test，日志留在 `workspace-nature-reachability/`；修正仅探针 import 后另存 `workspace-nature-reachability-2/`，不把 setup 错误算产品 RED。

## W01：历史 broker 记录在全局普通库失去全部性质选项可达性（确定的产品回归）

原失败：`keeps the parent review mounted until a failed navigation save is retried successfully`，`renderGoldReplay` 查找 `复盘自由黄金-DRS` 失败。原始错误及栈见 P1/53、59；测试:869–891（冻结原测试）注入 tiger source，**没有** tradeNature/tradingNature。实际还没进入复盘，故此 FAIL 不证明离开 guard 本身坏了；它证明该用例已无法到达被测 guard。

原始输入和跨层值：

```json
{"source":{"platform":"tiger","row":1},"accountId":"test","instrument":"HK:6228"}
```

1. `app/lib/trades/types.ts:207`：`tradeNatureOf(fill)` 仅使用显式证据，返回 **unknown**。
2. `app/lib/trades/episodes.ts:122`：episode.tradeNature = **unknown**。没有合法证据可将其当成首页 live。
3. 既有 `app/lib/trades/trading-nature.ts:5–11` 的展示兼容规则：缺显式 nature 的 tiger/futu/china-merchants 返回 **live**。`app/lib/trades/library.ts:253–259` 用 `displayTradeNature(firstFill)` 得到 entry.tradeNature = **live**。
4. 既有 `app/lib/reviews/shared-scope.ts:26–29,42`：episode unknown 回退 entry.tradeNature，所以旧全局普通库的 live 选择能找到它。以上四文件与 HEAD 完全相同，完整 hashes/源码见 `workspace-three-reference/manifest.json`。
5. freeze-1 Workspace:5805–5807 把生产**全局主导航交易库**也转到 `homepage.openTrades(null)`；:2214–2227 强制其 ordinary 初始性质 live；:2229–2231 在 ordinary live 前新增 `explicitLiveEntries(tradeLibraryEntries)`。
6. freeze-1 holdings:41–45 的 explicitLiveEntries 要求每笔 `tradeNatureOf(fill)==="live"`，正确拒绝缺证据历史记录；问题在它被复用于全局普通库。
7. 改选 ordinary unknown 时不再经过 explicitLiveEntries，却仍由 shared-scope 的 entry live fallback 拒绝；simulation 也拒绝。因此原记录不只是从首页消失，而是从**全局普通库全部三项性质选择**消失。

单一假说：新增 ordinary live 的显式性质前置筛选，与旧 library 展示性质回退并不等价；把首页来源范围套到全局主导航，构造了无可选入口的“筛选洞”。

最小验证 `workspace-nature-reachability.test.ts` 用真实 `buildInstrumentTradeSummaries → buildTradeLibraryEntries → explicitLiveEntries/filterEntriesBySharedScope`，不捏造 entry。tiger、futu 缺 nature 均观察到：

| source 证据 | canonical/episode | entry 展示性质 | HEAD live/simulation/unknown | freeze-1 ordinary live/simulation/unknown |
|---|---|---|---|---|
| absent tiger | unknown | live | **1 / 0 / 0** | **0 / 0 / 0** |
| absent futu | unknown | live | **1 / 0 / 0** | **0 / 0 / 0** |
| explicit live futu 对照 | live | live | 1 / 0 / 0 | 1 / 0 / 0 |
| explicit unknown futu 对照 | unknown | unknown | 0 / 0 / 1 | 0 / 0 / 1 |

受影响旅程：已有历史 broker 导入 → 全局交易库 → 标的/回合 → 真实复盘/返回；两个原 fixture 都代表可加载的既有数据形态，不可通过补 nature 将其豁免。原始文件本身没有本次更改，HEAD 同样数据全链通过进一步排除“本来就不可达”。不推断真实业务库中有多少此类记录；未访问业务库。

建议 owner 最小修复边界：明确区分首页带 live/market/account/date/symbol 来源的普通集合与全局主导航的既有交易库语义。首页/财务继续要求显式 live；全局旧记录至少保留一个可见且可解释的性质入口。可保留既有全局浏览行为，或让普通库一致展示其真实 unknown，但后一选择不得只改一个筛选器造成标签/账户/回合身份冲突；本票不应擅自写数据迁移或全局性质重定义。**禁止**改原 fill 加 live、删去未知记录测试、或把金融 live gate 全局放宽。

两种有限策略区别供 root 裁定：A，**仅全局既有普通库**恢复 legacy shared-scope 展示兼容，保留原 live 下旧记录可达；首页来源集合仍用 explicit-live。B，普通库本地以 canonical actual nature 做一致 unknown 投影，用户切到来源未知可找到旧记录，source 与全局 shared-scope 模块不改。仅删除**所有** ordinary 入口的 explicitLiveEntries 虽能让原 gold 默认为 live 的断言变绿，也会把首页带 `scope=live` 集合扩大到 canonical unknown，不能以三个测试绿色替代来源范围合同。

必需反例：缺 nature tiger/futu 通过全局入口可到回合；其 source 和 canonical unknown 保持不变，首页 live 持仓不得纳入；显式 unknown、显式 simulation、显式 live 三类独立；首页精确来源集合不扩大；主动选择回合后才进入复盘，无 queue 自动选首回合；原 save-failure guard 用例须实际执行到失败保存、取消/重试和最终导航。

## W02：现金保存后的旧展示 selector 失效（确定；被测 mock 写/读链通过）

原失败 `keeps a successful typed save observable when summary refresh fails, then retries with reads only`，test:1334–1370 的 `getByLabelText("现金状态")` 超时。

单一假说：旧 label 随旧首页 RoomAllocation 退出生产挂载；保存事实、失败提示与 read-only retry 仍在数据管理，不是 PUT 或摘要刷新链丢失。

源追踪：`RoomAllocation.CashStrip` 的 `app/components/dashboard/room-allocation.tsx:195–205` 独占 `aria-label="现金状态"`。冻结 Workspace 生产首页已换 HomeSurface，旧 ReviewDashboard 仅 demo；cash 数据管理 slot 仍在。冻结 Workspace:2030–2058 的 refreshCashData 按请求/范围归属保存失败事实；:2061–2085 的 saveCashBaseline 在 PUT 成功后先保存更新后的 baseline 与 saved fact，再读取摘要；读失败设置 `已保存现金基准，摘要暂未刷新；请重试读取`，没有撤回成功事实。:5700–5723 给 CashBaselinePanel 传 error，并显示 read-only retry。

原失败后诊断 DOM 已包含：baseline **120000**、source **caller-updated**、revision **3**；状态 `已更新现金基准` 和 `已保存现金基准，摘要暂未刷新；请重试读取`；按钮 `重试读取现金摘要`。fetch 日志与原 mock 队列一致：初始 live 读、恢复 simulation 范围读、一次 PUT、保存后的失败摘要读。不是新增摘要读取将 queued503 提前消费。

最小验证仅将旧 label 断言替换为：

```ts
expect(within(screen.getByRole("region", { name: "数据管理" }))
  .getByText(/已保存现金基准，摘要暂未刷新/)).toBeInTheDocument();
```

结果 **1 PASS**。保留了账户/来源/`expectedRevision:2`、PUT 总数 1、用户点击 `重试读取现金摘要`、重试按钮消失、PUT 仍为 1 的全部断言。无需改 nature（原 cash fixture 是显式 canonical simulation）、请求顺序或产品现金语义。

建议最小修复：让原用例定位用户当前可见的数据管理保存事实与错误状态，仍保留全部保存和重试约束。若产品还需要首页现金 strip，是另一个展示需求，不应为恢复旧 selector 重新挂旧首页。此结果只证明 mock 调用链，真实 HTTP 保存、持久化、返回及 reload 仍由 root 验证，**NOT VERIFIED**。

## W03：sidebar 首个 region 缺失来自 alias endpoint 错误响应；随后是 W01（确定的分层因果）

原失败 `returns to the library with its expanded stock context after opening a library round`，test:5415–5452，无 storageClient override，先 click 全局交易库，之后找不到 region。

单一假说 H3a：通用 fetch mock 给真实 aliases loader 返回了 replay frame；新增 ready gate 阻止普通路由初始化，故库还未渲染。这不是 nature 过滤导致 region 消失，也不是 URL 串场或应多等一个 tick。

输入 → validator → state → route → DOM：

1. test:653–658 的默认 fetch 对所有 URL 返回 `{ok:true,json:async()=>nextFrame}`。`nextFrame` 没有 aliases 数组。
2. 冻结 Workspace:1240–1243 在没有 storageClient override 时使用 `createActiveAliasLoader()`；`app/lib/storage/migration-browser-alias.ts:63–70` 调 migration client。
3. `app/lib/storage/tradingview-account-migration-client.ts:388–390,455–463` 要求 `{aliases:[...]}`；收到 frame 后抛出 `Migration response was invalid`。这些 validator/loader 文件与 HEAD 相同。
4. 冻结 Workspace:2611–2643 捕获后设 aliasRecoveryState=error、sharedScopeRestored=false，但仍能 hydrate 已导入数据；:2200 新增的 homepage ready 条件要求 storage **和 aliases** 均 ready。
5. homepage 未 initialized → :2214–2227 路由同步 effect 退出 → ordinaryLibraryKey 未跟随 route.key；:6047 的 key 差异分支只渲染 `正在读取目标交易集合…`，不渲染 TradeLibrary region。
6. 原失败 DOM 同时有 `/trades?scope=live&market=all&accounts=*&rangeMode=all`、顶层 `账户范围恢复失败：Migration response was invalid` 和 `重试账户范围恢复`、目标集合 loading，且数据管理仍显示 1 个已导入标的。故能具体定位阻塞层，不把顶层 error 隐去报告成“完全无反馈”。

H3a 单变量验证：仅在该用例的 fetch mock 增加 aliases path→`Response.json({aliases:[]})`，其他响应与原始 fill 不变。结果 region **已出现**；下一步小鹏展开按钮缺失（0 标的/0 回合）。这证明 H3a；也证明仅修 aliases 不足以恢复原完整旅程。

第二个假说 H3b：小鹏缺显式 nature 与 gold 同属 W01。valid aliases 基础上选择来源未知后仍无小鹏按钮；纯数据对照再次证明 absent futu 在所有选项均被排除。

判断边界：

- 原测试通用 fetch double 没有满足真实 aliases API 合同，应该修成按 endpoint 的合法 mock，保留原历史 nature 数据；不要放宽 aliases validator。
- 新 ready gate 在**真实 aliases 失败**时也会使已 hydrate 普通库停在 loading；HEAD 未因此阻塞既有库。这是已证明的条件行为差异，尚不能仅凭 mock 断言其违反了已批准 fail-closed 策略。root 应决定全局库是否可在不扩大范围的情况下独立恢复；至少 loading/错误/重试须准确表达，不能静默回退扩大账户范围。顶层已有 error+retry，不将某单层缺 notice 直接等同全页失败。
- 本次没有模拟 aliases 成功后的真实服务器落盘、浏览器 reload、indexed history 或补偿 pop；这些不是本组证据的 PASS。

建议测试：合法 aliases 空数组+缺 nature 历史成交 → 全局库实际展开/选回合/返回仍展开；alias503/invalid → 明确失败与 retry，保留原已应用范围/数据，成功后自动进入所需集合且不扩大账户；存在 alias 映射 → catalog 在 validation 前得到正确账户；独立来源 scope 不受全局普通库性质选择反写。

## 控件/状态审计记录与交接

触发：root 要求诊断 P1 三个真实控件旅程回归；应用 `docs/agents/frontend-control-audit.md`。本次限定源码+mock 合成事件，不做真实 UI 验收，无浏览器或服务 URL。CSS viewport、zoom/DPR、几何、视觉对照、真实鼠标/键盘/触屏均 **NOT VERIFIED**，没有从单测推导覆盖率。

| scoped ID | 冻结范围/前置 | 动作及期望链 | 诊断结果/证据 | owner/后续 |
|---|---|---|---|---|
| WS-GLOBAL-LIBRARY | 生产、legacy tiger/futu unknown | 全局库→性质选择→回合→复盘 | 可达性 FAIL；HEAD3PASS/freeze3FAIL、nature4观察断言PASS | integration 同票修复；root 独立浏览器复验 |
| WS-GUARD-RETRY | gold 实际进入复盘后 | 保存失败→保持父复盘→重试→导航 | 原冻结用例尚未进入 guard，当前 guard 行为 NV | 恢复入口后原完整用例必须执行到终点 |
| WS-CASH-SAVE-READ-RETRY | canonical simulation、revision2 | PUT成功→503提示→只读retry→PUT仍1 | selector-only 1PASS，仅 mock 链；真实持久化NV | integration 修测试定位；root 验真实保存链 |
| WS-ALIAS-RECOVERY | 无 storage override、aliases loader | aliases读取/校验→ready→普通路由→交易库 | malformed mock 阻塞已复现；合法 aliases 后解除；之后 W01 | integration 按 endpoint 修mock并补错误/恢复测试 |
| WS-LIBRARY-RETURN | 合法aliases、legacy futu | 展开→主动复盘→返回仍展开 | freeze被W01阻断；HEAD完整PASS；新版本返回终点NV | integration/root 待完整复验 |

只读审计完成；产品功能、真实持久化、整页视觉和 P1 正式接受均未被本报告签署。原3 FAIL、初次 probe setup failure、历史6 FAIL与15 owned probe结果保持独立，不覆盖旧证据。建议 integration 先修 W01 的全局/来源范围边界，W02 仅调整断言位置，W03 先修 endpoint mock，再独立验证真实 alias-error 策略；不更改 S、F 或原始交易证据。
