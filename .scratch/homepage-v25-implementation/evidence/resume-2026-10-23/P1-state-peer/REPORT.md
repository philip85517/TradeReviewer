# P1 状态接线只读预审

时间：2026-10-23 01:12–01:18 Asia/Shanghai。审查者：`/root/state_g61`，未实现 P1。**不是冻结验收，P1 仍 0/3。** 产品源码、S/F、共享追踪均未修改；未启动服务、真实浏览器或访问数据库。

**01:21:38 增补（当前局部状态）：** owner 移除了 options.data 整组覆盖 effect，原 PS05 FX RED 已在新版本局部 PASS；原 RED 继续保留。继续静态审查新增 PS06，确认无效 `/home` URL 经有效账户纠错成功后，route.error/route.scope 没同步，错误仍显示。六项在绑定新 hash 的完整前后配对运行中为 **3 PASS / 3 FAIL**；FAIL 为 PS03/PS04/PS06，仍按下文区分 host 缺口与真实 UI 未验证。见 `probes-6-paired.log`、`paired-run-manifest.json`、`paired-source/`：host `6677d100386f959e58744a2b22fcc57714528808509bfcf99b0fcd6d943dfc85`，workspace `1169f6728dac506d47a4c554c395b569ecea96c16bbc5cc2aee766111c65ed25`，探针 `64b67b64b755e207b8f1b44c7973651878541e0e31194f9c3eabcf79b3df9740`。运行期间三者 hash 均未变化。后续正文的初次 5 项结果与 R1 根因是历史证据，不能再把旧 FX FAIL 描述为新版本仍失败。

## 版本与边界

最初读取副本为 `source/` + `source-manifest.json`（01:12:55）。owner 在审查期间更换了 reload 合同，因此结论绑定后一次副本 `probe-source/`，而非旧版。

|文件|01:16:37 至 01:17:34 探针前后 SHA256|
|---|---|
|use-homepage-host.ts|`c50d4be2bc51e5ad57d0e2719cb27e849b0f44a3065068c4cb86acaa9f5e0a79`|
|session-model.ts|`45e73c3b315b75f1660d6829694272d0d5bfcd1f51452a95fcacd2accf652973`|
|trade-review-workspace.tsx|`28830034a282ee9265fea54b62a387aaa60b959f5fffbf9f48300f7d4d00918a`|
|home-surface.tsx|`5d4d549adf1624dc63e08a76ebe0b7eaebebd4d6d2aac8616f5586598c7e957c`|
|S 冻结源|`ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`|

其余文件和测试 hash 见 `probe-manifest-before.json` / `probe-manifest-after.json`。五项探针文件最终 hash 为 `e9c6f8df6afa5aef366bca95f82a09d42011a75a630a50a75629416db611977f`；前一次四项日志保留在 `probes.log`，增加 FX 探针后的日志为 `probes-5.log`。两次运行间只增加本人目录内的探针，不改产品。所列产品 hash 在这段运行期间未变；不保证 owner 随后的版本仍相同。

触发标准：本次是 frontend 数据/状态接线检查，适用 `docs/agents/frontend-control-audit.md`。本次仅审查下表的现有状态消费链，方法为读源码和 jsdom hook 探针。视觉、真实 DOM 焦点、浏览器 back/forward、持久化业务回读、完整控件库存、鼠标/键盘/触屏均 **NOT VERIFIED**。没有把 hook 测试当真实旅程接受。

## 真实调用链

|阶段|当前代码调用链|已观察行为 / 边界|
|---|---|---|
|初次直达|`app/home/page.tsx` 或 `app/trades/page.tsx` → `TradeReviewWorkspace(initialPage)` → 既有 bootstrap → `storageState=ready && aliasRecoveryState=ready` → host 初始化|host 初始化 effect 等 ready 才读地址/storage，账户与证券目录由 workspace 当前真实 entries 生成。未 ready 时不会先把未知账户判掉。|
|URL authority|host `acceptAddress` → `parseHomepageNavigation(url,{allowedAccounts,allowedSymbols})` → route 或错误|显式无效 query 保留地址并显示 route error；不会使用 source 覆盖目标。合法 `/home?...market=hk` 与 source 的 `a` 不一致时采用 URL；独立探针 PASS。`accounts=*` 由已接受 S 处理。|
|来源快照|`HomeSurface.openDetail` → `onUi` 记录 row trigger/scroll → `openTrades` → `homepageTradeUrl(snapshot)` + `encodeHomepageSnapshot(snapshot)` → `navigate`|目标使用 committed 身份和实际 period 转 execution-date；source 保存 UI。navigate 先调用既有 leave guard，允许后才写 source/history/route。来源仅存在 sessionStorage/history，不含业务 rows。|
|普通库目标|host trades route → workspace effect → `homepageCollectionState` → `TradeLibrary(initialBrowseState)`|显式 stocks/live/reviewStatus=all，collectionInstrumentId 作为过滤，selectedInstrument/episode=null。日期进入 executionDateFrom/To；不设置 queue。scope.accountIds 与 ordinaryEntries live 过滤独立于旧 SharedScope。真实 open 成交与整回合上下文仍待端到端验证。|
|返回重读|`openHome` → `navigate('/home')` → guard → `acceptAddress` / `validateSource` → `startHomepageRead` → `readHomepageBundle(requestId)` → `finishHomepageRead`|请求拥有自己的 bootstrap、市场读取和 FX 响应。旧 committed UI + data 保留到匹配成功；成功后才恢复 UI、source、URL 并增加 restoreKey。**有下述 FX 二次覆盖风险。**|
|请求归属|host pending token → reload result.requestId/generation → S `completeHomepageRequest` generation+scopeKey → atomic session|现版已取消“任意 revision 更新都当成最新请求结果”的旧实现。独立 timeout/late-owned-result 探针 PASS；owner 已有 earlier-reader/newer-token 测试。|
|焦点/滚动|restoreKey remount → HomeSurface ready effect → snapshot.scrollTop / exact trigger → 缺 DOM 时 `hp-holdings-title`|源码有精确 trigger 恢复和标题 fallback。实际数据缩页、行删除、标题可聚焦性和 scroll 容器几何，均需浏览器验证。|
|leave guard|host navigate/pop → workspace `setActiveView` → `recallLeaveGuardRef` + navigationAttempt → 原复盘 guard|普通 navigate 取消不会写 URL/source；已有 hook 测试覆盖。浏览器 pop 的 rollback/forward 还有下述边界。|

注意：`session-model.finishHomepageRead` 只要求 token accepted，随后可恢复传入 sourceBytes；其内部不对 source 与 token 再比对。当前 host 先比较 source.scope 与 URL.scope，因此该入口正常使用有前置约束；后续消费者不可绕过这一约束。period/history 完整投影扩展不在本次 P1 持仓切片的当前实现中，不据此判 FAIL。

## 发现与最小可复现证据

### R1 — 接受的新 FX 随后被 options.data 的旧 FX 覆盖

**确定的 adapter 失败 + workspace 静态路径，优先修复。**

1. workspace:2179–2194 的 `readHomepageBundle` 从新响应生成 `freshFx`，返回 owned bundle。
2. host:75–85 接受 token 后先调用 `onReadAccepted(data)`，再提交 fresh session。
3. workspace:2198–2204 更新 executions、stored instruments、reviews、marketStates/jobs/asOf；没有更新 `useFxRates` 的状态。
4. workspace:1343–1346 的旧 `fxRates.state` 仍生成旧 fxSnapshot，2172–2175 因前述 setState 重建 homepageData：新 entries + 旧 FX。
5. host:124–127 在 pending 清空后无条件把这个新 options.data 对象替换到 session.data，覆盖刚接受的 FX。

独立探针精确模拟该 onReadAccepted 重建动作，得到 `scope=hk`、`entries=fresh-entries`、`fxSnapshot=old-fx`，期望 `fresh-fx`，FAIL。它未挂载完整 workspace；因此“完整页面显示哪一个数值”仍须浏览器复验，但两条所有权路径和覆盖机制均为当前源码实有。

建议只保留一个已接受业务 bundle 权威；外部 live 更新需有明确字段/版本语义，不能以任意 options.data 对象整体覆盖已接受结果。若选择写回外部状态，应让 FX 与本次完整 bundle 同次发布，不能只写 entries/marketStates。

最小回归：初次 FX=A，返回读取 FX=B（汇率、asOf、missingPairs 均不同），同时 entries 有变；等待所有 React effects 后仍为完整 B，刷新/下一次 quote 更新也不能回 A。失败/超时/取消 B 后保持完整 A。

### R2 — 返回前目录校验不涵盖 fresh bootstrap 中的删除

**确定的 host 校验缺口；整个 UI 是否已充分解释仍待实际旅程。**

探针起点：旧 catalog 有账户 one，来源快照选择 one，当前位于 trades。返回 home 时 validateSource 按旧 catalog 通过；fresh reload 删除 one；再发布 accounts=[]。当前 host 的 notice/route.error 均为空，scope 仍是 one，且没有 catalog 变化时重校验的 effect。独立“host 应说明被删账户”断言 FAIL。

缓解因素：HomeSurface:60 对找不到的单账户已有 `账户已不可用` 标签，所以不能把“host 无 notice”直接等同于整个页面完全无解释。保持 one 也没有静默扩大到 all。需要冻结后验证可纠错入口、删除标的说明和精确焦点 fallback；本项不主张自动退回 all。

建议在接受 owned fresh bundle 时按 **该 bundle 的目录** 校验来源，而不是仅按出发前 catalog 校验；保留失效条件并明确说明/提供选择入口，按来源容器做焦点 fallback。对请求期间账户/证券被删做真实隔离数据复验。

### R3 — 无 hpIndex 的同文档 popstate 被忽略

**确定的 handler 边界；可达性和实际浏览器后果未验证。**

host:168 对目标 state.hpIndex 非 number 直接 return。探针把位置改到同源 `/trades?...` 且 state=null 后派发 popstate，guard 调用次数为 0，route 留在 home；handler 本身没有恢复地址。独立断言 FAIL。

这项使用合成 popstate，**不是**真实后退操作。正式入口是否能产生此类 history 条目，取决于旧路由/Next history/进入应用前条目；需冻结后的真实浏览器检查，不能靠此探针声称已破坏所有 back/forward。

建议定义无索引条目的安全分支，并让它也经过原 guard；若认定应用内不可能出现，必须用实际路由和历史栈证据约束这个前提。不要把 unknown entry 当无动作。

### R4 — rollback 的零毫秒 timer 不证明回滚事件已完成

**静态时序风险，尚未复现。** host:171 先 `history.go(-delta)`，173 用 setTimeout(0) 开 guard。浏览器 history.go 异步；零毫秒 timer 不保证 skipPop 对应的 rollback pop 已到。立即允许/取消、连续后退、多 entry forward 时，应等待明确 rollback pop 后才开 guard，并以 attempt/target 串行化。需真实浏览器覆盖取消后 URL/route/source/review 均停在原项，确认后只移动一次。

### R5 — 无效 home URL 纠错成功后，route error 没被清除

**确定的 hook 失败 + 真实控件静态消费链。** 新版本 host `6677d100...`：

1. 直达 `/home?scope=live&market=all&accounts=gone&rangeMode=all`，ready 后 `acceptAddress` 设置 route.error=账户不存在、route.scope=DEFAULT_SCOPE。
2. HomeSurface 的真实账户选项通过 `onScope({...snapshot.scope,accounts:['one']})` 发起 owned read。
3. owned read 成功，snapshot.accounts 已是 one，URL 也更新为 accounts=one。
4. beginRead 成功分支只更新 session、restoreKey、source 和 URL，没有同步 `setAddressRoute`。route.error 仍是原错误，route.scope 仍是默认 all。
5. workspace 从 `homepage.route.error` 传 HomeSurface 的 error，纠错成功后仍显示“目标账户已不存在或不可用，请选择有效账户”。

独立 PS06 在前后 hash 配对运行中 FAIL。建议在成功的 home 状态提交边界，同时同步代表同一接受状态的 route scope/error；只清除本次已解决的地址错误，不能无条件吞掉 storage/其它来源通知。回归还应含初次 invalid-range、unknown-symbol、invalid-market warning 后的有效选择，避免 UI、地址、route 再分裂。

## 独立探针结果

命令（固定 Node26、仅一个新增文件、cache=false）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/focused.vitest.config.ts
```

|编号|断言|结果与适用范围|
|---|---|---|
|PS01|合法显式 URL 不被不同来源快照覆盖|PASS，hook 局部|
|PS02|timeout 后 owned promise 迟到不改 committed/data、不触发 accepted callback|PASS，hook 局部|
|PS03|fresh return 删除账户后的 host 解释|FAIL；HomeSurface 缺失账户标签是已有缓解，整页待验|
|PS04|无 hpIndex 的 popstate 经过 guard|FAIL；合成事件边界，可达性待实测|
|PS05|onReadAccepted 重建 options.data 后仍保留 fresh FX|FAIL；hook 加 workspace 同形发布动作，完整 UI 待验|

日志：`probes.log` 为首次 4 项 2 PASS/2 FAIL；`probes-5.log` 为 5 项 2 PASS/3 FAIL，命令 exit=1。两份保留，不用历史无 owned-result 的断言冒充现版问题。

## Pending 与冻结后建议矩阵

以下正在实现或本次禁止执行，不作正式验收失败：可信 US exchange/必要 asset class 目录接线、整个 host 与真实页面首次运行、所有隔离 DB 写入/返回/reload、真实 keyboard focus、视觉比较与触屏。

|旅程/反例|冻结后需要的证据|
|---|---|
|直达/刷新/复制 URL|accounts=*、有效 concrete、unknown/empty/mixed、非法日期、unknown symbol、invalid-market warning；ready 前不错误扩大；真实 CN/HK/可信 US identity|
|来源与目标分工|source A + explicit target B 必须 B；裸返回恢复 A；storage getter/read/write/unsupported-v1/坏 JSON 有明确结果且不提前覆盖旧值|
|返回重读|非默认 query/sort/page/scroll → 详情 → 普通库 → 隔离数据变更 → 返回；新数据、原 UI、精确 trigger；目标消失回容器标题|
|请求|A→B 乱序、失败→迟到成功、timeout→迟到、取消→迟到、retry；FX/metadata/quote/rows 同属接受版本；新 owned bundle 不被旧外部数据覆盖|
|账户/证券删除|出发后 fresh bootstrap 删除所选账户或标的；保留失效条件并解释/可修正，不静默 all、不复原缓存业务 rows|
|leave guard|点击返回与浏览器 back/forward；cancel/save/discard/save-failure 各分支；连续点击/连续 back；已标记与未标记 history 条目；完整保存→repository→返回→重读→reload|
|普通库|execution-date 包含未平仓成交；collection identity 唯一，无 queue/首 episode 强选；进入复盘不截断整回合账本|

仅将 PS01/PS02 记作所审 hook 局部 PASS。没有接受 P1/S/F 或产品，也没有推进 P2–P4。

增补版局部 PASS 为 PS01/PS02/PS05；PS06 新增 FAIL 见上文。已向 integration 直接交付 RED 与根因，不代其修改产品。


## 2026-10-23 01:50:07 — frozen P1 round-1 peer recheck (addendum)

The original six unchanged probes plus the prepared nine owned-read probes now pass 15/15 on freeze-1 host `67ca968a215963a648c09033ac76f65a2c321b23f88e896f71aa18693c2ca4b9` and workspace `55e40ada6ba54e64fe1e714eeca7af7a267822471fff5169ce1761b6af52db8c`; all eleven manifest inputs stayed stable before/after. See `FROZEN-ROUND-1.md` for every case, full boundaries, command, and `p1-round1-manifest.json` / `p1-round1.log` / immutable source copies. All historical RED logs and conclusions above are preserved as historical evidence. Browser indexed compensating-pop timing remains root-owned NOT VERIFIED, despite the source now awaiting the compensating event. No formal P1/F/product acceptance is made.

Secondary static review is in `SECONDARY-STATIC-REVIEW.md` and its 18-file source/hash manifest: M01 confirmed source-level broad metadata-import validation bypass; ordinary execution-list versus final-close-statistics and the normal official metadata merge paths had no additional static defect found. No DB or browser reproduction was performed.
