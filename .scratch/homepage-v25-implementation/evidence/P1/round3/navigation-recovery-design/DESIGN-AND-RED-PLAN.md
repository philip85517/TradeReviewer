# 来源恢复的写入归属：最小设计与 RED 计划

状态：**design-ready，尚未实施、未运行新测试、未签产品 PASS**。实际模型 `gpt-6.1-sol / ultra`。P1 保留正式第 2/3 轮 FAIL；P3 保留 0/3。详情局部接受不改变这些状态。

本轮只读当前 host 全文、session adapter、S 的 begin/complete/retry/timeout/restore、实际 Surface/Workspace 调用点、peer 原 probe 与逐阶段 trace、批准正文来源返回合同。只在本目录写设计和输入指纹。未改产品/测试、未访问服务/HTTP/浏览器/数据库。原证据保持原样。

## 1. 证实与未证实分开

|事项|直接证据|结论|
|---|---|---|
|NR04 来源覆盖|peer test:89–97；`traces-2.json` NR04；NR03/04 只差一次 `onUi({scrollTop:25})`|确定的 host 写入归属缺陷。冷 `/trades` 首读失败，committed=all/空查询，source=A/ROKU；返家 navigation(A) 未完成时，onUi 把旧 committed 编码成 source，history/storage 立刻丢 A/ROKU|
|NR06 API 抢占|peer test:107–114；trace 的 g4 navigation(A) 被 g5 refresh(all) 替代|确定的 API 边界缺陷。较旧 A 响应正确失效，generation 机制没有失效。**不是浏览器刷新**，尚未证明真实用户控件或旧 repair Promise 在现场触发它|
|正常裸 `/home` 返回|NR01/02 PASS；NR03 不发 onUi 也 PASS|裸 `/home` 本身不能解释丢来源；history.hpSource 是合法恢复入口。不能把返回 URL 改成完整 query 当作根因修复|
|原 Recall 错证券/返回后刷新问题|本轮没有复现或新浏览器证据|**OPEN**。若现场 committed/source 都是 A，NR01/02 是对 NR04 归因的反证。不得混称为本设计已解释或已解决|
|真实 pending 控件可达性|Surface:248 搜索触发、252 主滚动、310 搜索结果滚动可调用 onUi；peer 只运行 hook|存在实际调用点；事件是否在 root 原现场发生、滚动是否由恢复自然触发，仍待 root 浏览器证据|

peer `run-2.log` 是既有 **4 PASS / 2 FAIL**，不是本轮新执行结果。其 host/session/S/Workspace 指纹与本次只读输入相同；Surface 后续详情 footer 修复已由 peer SOURCE-DRIFT 明示，不将 hook 结果升级成 UI 接受。

## 2. 合同与准确边界

批准文件：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`。

- 436–448：首页入口传递已应用范围/市场/账户/日期/标的，普通库不预设 queue。
- 456、659：返回 `/home` 重新读取业务数据，恢复完整来源 UI；原对象消失只回退容器标题，保留有效条件。
- 475–480、497–501：pending/失败保留旧完整范围与有效数据；新范围不能提前提交；15 秒后手动恢复。
- 655、658：直达/刷新按目标 URL 重建范围，来源不能覆盖目标集合。来源恢复不能放宽非法 URL。
- 660：generation 与 scope key 双匹配；retry 使用新编号。

这里有三种不同权威，不能合并：**目标地址范围**、**唯一已提交 UI+业务 bundle**、**只用于来源恢复的 UI 字节**。恢复请求尚未成功时，第三者可以合法地与第二者不同；NR04 正是把第二者误当成第三者的新版本。

当前因果链（行号绑定本目录 manifest）：

1. host:34 从 DEFAULT_SCOPE 创建 committed；131–134 的 cold trades 地址只更新 route。
2. host:147–162 取 history.hpSource / storage，发 owned 首读；114–122 首读失败，保留旧 committed，允许用户恢复/返回。
3. host:198–218 guard 后 push `/home`，合法 source 随 entry 保留；135–140 发 navigation(A) 并携带 sourceBytes。
4. S:303–309 正确保留旧 snapshot，navigation 目标 A 与旧 committed all 并存；session:12–16 只在匹配成功后恢复捕获的 sourceBytes。
5. **host:193–196 没有恢复归属判断**，onUi 更新旧 snapshot 后直接 persist；67–73 同时写 source.current / storage / history。NR04 的第一次坏写在这里，不在 reload 初始化。
6. host:220–223 home reload 不携带 source，且 pending 没有排重；S 的 refresh 正确取 committed，于是形成 NR06 的 all 请求。

`Pending.source`（host:25、80）已有按请求携带的 source，但 pending 在失败和超时会清空（117、183）。因此只添加 `if (!pending.current)` 不能保护失败/超时后的合法来源。仅比较 scope key 也不充分：同 scope 的不同查询/页码/焦点仍可能被旧 UI 覆盖。

## 3. 建议最小修复：host 内的来源恢复生命周期

建议产品范围首先只有 `app/components/homepage-v25/use-homepage-host.ts`；必要定向测试放同名 test。**不改 S/F/session 语义、Workspace 数据读取、URL 编解码或存储格式**。本设计不构成实施授权。

### 3.1 保存恢复上下文，保留单一 committed authority

在 host 保存一个内存恢复上下文，只有合法来源 UI 字节（可为空）以及与当前读取的关联；目标仍从 S request/lastGlobalRead 取，业务 bundle 仍只从匹配 owned result 取。它不是第二份 applied，也不包含业务价格/成交/目录缓存。

- 首页 navigation 开始恢复时建立上下文；包括 cold 非默认 `/home` 和从 trades 返回，不仅限于 scope 不同的情形。
- 将上下文与本次 token/调用闭包绑定。请求失败或 15 秒超时后保留恢复字节；清掉的是活跃请求，不是合法来源。
- 只有当前有效 owned result 被 S 接受，且 UI+该 result.data 已一起提交后，才结束这次恢复并持久化新 snapshot。旧 resolve/reject 不得释放新上下文或写来源。
- guard cancel/throw/stale 在导航提交前不创建、替换或清除恢复上下文。显式新导航可替换恢复目标，URL 仍优先；无效目标保持现有明确错误。
- 用户明确改变 market/account 是新的 identity 意图，继续用 S 的 identity 规则；不能为了保护来源而强行改回旧返回目标。它成功后成为新 committed，再允许来源写入；失败前原合法来源仍保留。此分支必须先加反例再决定具体上下文清理点。

### 3.2 限制旧 UI 的来源写权限

`onUi` 保持现有局部 UI 更新能力，但在来源恢复尚未成功期间，不把旧 committed 的编码写入 source/storage/history。该阶段的旧画面 UI 回调是临时值，不能自动变成返回来源；成功后仍按既有 `finishHomepageRead(..., sourceBytes)` 恢复来源。

这不预提交 A 的标题/币种/表格，不清空或伪造数据，也不新增禁用全页控件的政策。原先匹配完成本就会恢复 captured source，因此不在此次修复中引入“将 pending 临时交互合并进来源”的新合同。若 root 的真实操作要求 pending 输入也持久化，应单列产品语义裁定，不能靠任意合并旧 snapshot 得到。

还需检查两个既有主动来源捕获点（216–217）：`openTrades` / `openGlobalTrades` 目前直接编码 committed。若恢复未完成，主动离开可继续采用原来的目标范围规则，但来源捕获应复用受保护的 source 字节，不能另走旁路覆盖它。实现前先用最小 hook 反例确认这条旁路；**不顺带修改导航按钮的范围或 guard 行为**。匹配 owned success 的 canonical persist 则是有权的新来源写入，不应被普通 onUi 的保护条件一起屏蔽。

### 3.3 reload/retry 的归属

建议选择最小、可预测的策略：**来源 navigation 已 pending 时，显式 reload 合并到现有读取，不另起 refresh(committed)**。已有用户 retry/更新按钮在 pending 时禁用；晚到的非交互回调也不能把目标换成旧 applied。该建议消除 NR06 的 API 机制，但不把它称为现场 UI 根因。

- pending return navigation：不增 generation、不增 reload 调用、不更换 data/source/URL，等待同一请求结果。
- return navigation 已失败/超时：手动 retry 使用 S 的 retry，保留 navigation purpose/target，创建新 generation；同时把恢复上下文的原 sourceBytes 交给该请求。当前 home retry 丢 sourceBytes 是源码级相邻风险，**还需 RED 证实**，不能只保范围却丢 search/页码/焦点。
- 恢复未结束时，focus/visibility 不能发旧 applied refresh。现有 !pending 只保护活跃窗口；失败后 pending=null，应同样保留手动恢复。此项是待验证的邻接路径，不是已观察自动抢占。
- 来源成功恢复之后，普通 home refresh 继续读取 committed，保留最新 draft；trades retry 仍按目标 URL 范围并保留 readonly home source。readOnInitialize=false 的现有种子初始化保持不变。

### 3.4 不采用的替代做法

不把 source 直接塞进 applied 来伪装首读成功；不重新启用 options.data 全量同步；不改 URL 到默认 all；不增加第二套 generation/scope 算法；不缓存业务数据；不重写 Recall 选择逻辑。没有这些范围的 RED 证据。

## 4. 先 RED 的定向计划（尚未编写/执行）

原 peer 证据保持只读。后续使用新 test/日志路径，不覆盖 run-2/trace，不改失败期望掩盖现象。

|ID|最小输入与动作|必须保留的断言|当前证据级别|
|---|---|---|---|
|R01|原 NR04：cold scoped trades 首读 reject → 返回 → nav pending → onUi(scroll25) → 卸载/新挂载|onUi 前后 source/history/storage **字节一致**；目标 A 不预提交；新 owned 后 A/ROKU/selected/scroll/focus 均恢复，data 来自新请求|已存在原始 RED；新断言待运行|
|R02|R01 的 UI 事件改为真实 Surface 搜索 trigger、主 scroll、结果 scroll；deferred host callback|可见 pending 与旧数据一致；source 未被旧 snapshot 改写；不能用直接 host API 冒充点击可达性|计划 RED；Surface 测试只有必要时纳入有限测试范围|
|R03|冷首读失败 → 返回 read reject；再 onUi → 手动 retry|失败后仍保完整 source；retry 新编号、同 navigation target；成功恢复完整 UI+该请求 bundle+callback 一次|计划 RED，防止只修 pending 条件|
|R04|R03 将 reject 替换为 fake timer 15 秒 timeout；旧请求稍后完成|同上；旧结果/旧 reject 不清新上下文、不调用 accepted、不写 source|计划 RED/回归护栏，不预称失败|
|R05|原 NR06 的 pending 时直接 reload|既有请求仍 pending、reader 调用数不变、generation 不变；接受它后 A/ROKU 与 matching data/callback 同代|已有 API RED；原 NR06 对新版策略需保留原日志并把“newer-refresh”旧输出单列，不能声称新策略还会产生该结果|
|R06|失败/timeout 后 focus、visibilitychange；随后用户 retry|自动事件不另起 refresh；手动 retry 可恢复；回到成功状态后正常 focus refresh 仍工作|计划 RED/护栏，真实自动触发未证实|
|R07|同 scope、不同 search/page/focus 来源；cold failure → return pending onUi|不能仅以 scope 相同就赋旧 snapshot 写权限；按完整来源恢复|计划 RED|
|R08|return pending 时调用既有 openTrades / openGlobalTrades；guard cancel/throw/stale/允许分别覆盖|取消时 URL/history/source/commit 全不变；允许时目标范围仍由目标合同定义，原来源不被旧默认 UI 捕获替换|计划反例；仅确认旁路后最小处理|
|R09|恢复 pending 时显式 identity B，B 成功/失败；A 晚到|成功只提交 B 自有 bundle，不能又恢复 A；失败仍保来源可返回；A 晚到不得释放 B 归属或改 history|计划护栏，不改变 S 规则|
|R10|NR01/02/03/05、direct home/trades、非法 URL、fresh catalog 删除账户/identity、已知 hpIndex 异步补偿 pop、v2→v3/readOnInitialize=false|原断言保留；范围/来源/数据/guard 分别验证；不读 external latest bundle|既有通过对照 + 定向受影响回归|

R01/R03/R05 是最小第一批；R04/R06 保护相同生命周期；R07–R10 根据最小变更覆盖相邻 writer/意图和既有承诺。不扩 95 项回归或其他 UI 功能来代替这些因果断言。新测试执行前仍需 root 授权解除本次只读冻结。

## 5. root 真实浏览器补证方案

root 继续独占服务/浏览器/隔离 DB。建议保留当前失败现场，不改 seed 或清 storage；本设计不要求业务写入。

1. 正常对照：已接受 A/ROKU → 普通库 → 返回 pending → 浏览器刷新；记录 URL、visible scope/query、首读结果。NR01/02 期待保留来源。
2. 缺陷路径：合法 source 的 cold trades 首读失败/超时 → 从实际按钮返回 → pending 中点搜索或滚动 → 浏览器刷新。分别记录 **失败后 / 返回 pending / 首次 UI 回调后 / 刷新后** 的 history.hpSource 与 sessionStorage UI 字节/摘要，scope/query、pending purpose/generation 和 matching-read 是否完成。
3. 若回调前 committed/source 都是 A，不能用 NR04 解释；定位首次 source writer/读完成/挂载边界，原 Recall 问题继续 OPEN。只记录 UI 与请求归属，不采集请求 body 或交易行。
4. NR06 如需升级成真实旅程证据，必须找到实际 enabled 控件，或真实更早 repair Promise 在 return pending 后完成并调用 reload 的证据；否则只签 API 防御。浏览器硬刷新不是 host.reload。
5. 后续修复复验：失败→返回→pending 控件→刷新，失败→重试/超时→重试，正常 ordinary 往返和 stable reload 各自留证；鼠标/键盘、emulated/physical touch 分开，无法执行仍 NV。

## 6. 尚待裁定与冻结

- 原 Recall 选择错误及其 return/reload 原因仍 OPEN；本设计不关闭该问题。
- pending 输入目前是旧 committed 的临时 UI，不合并成来源；若要改变，先另定合同。此次建议不增加 UI 控件或降级已批准行为。
- `onReadAccepted` 抛错、URL/pop 改页而旧导航仍在 flight 的更一般问题，本轮没有新的动态 RED，不在本设计中猜测修复。
- 没有功能/持久化/视觉新 PASS；本轮只有只读因果审阅和拟议 RED。后续候选仍属于 P1 原第三候选门槛，不重置轮次。

当前精确输入 SHA、前后稳定性见同目录 `READ-ONLY-MANIFEST.json`。核心 host SHA `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`，session SHA `828162fd03dcba7d4632a189444e54e1c4f0761d937c7bf0b4e4ad96abb4766e`，S SHA `fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`。
