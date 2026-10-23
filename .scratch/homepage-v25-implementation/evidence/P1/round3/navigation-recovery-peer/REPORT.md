# Navigation recovery 冻结候选：独立只读审阅

状态：**review-ready；不是 root 正式接受，不签 P1/P3 accepted**。审阅者 `financial_g61`，实际模型 `gpt-6.1-sol / ultra`。2026-10-23，仓库 `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`。

本次没有发现能由候选差异证实的新增实质回归。来源恢复、identity 优先级、手动 retry 与 late result 归属符合批准设计；但发现一个**原先就存在、此次测试仍未覆盖的 15 秒 deadline 缺口**：pending UI 回调会重启 timeout timer。必须把它与本补丁解决的 source 覆盖问题分开，不能用静止场景的 timeout PASS 声称所有交互中都满足 15 秒合同。

## 审阅边界与证据级别

- 采用 `code-review` 的 Standards / Spec 两条审阅线。root 已给定精确 baseline、冻结 diff 和禁止再派代理的范围，因此本次在同一审阅者内独立检查两条线，没有创建其他 agent 或另选 git 基准。
- 完整阅读设计、冻结报告、`candidate.diff`、当前 host/session/S、17 个新增测试；核对原 host 测试及实际 Workspace/Surface 的受影响调用点。原 spec 为 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP06/HP09 与来源恢复附录。
- 本次只运行文件读取、diff/文本定位、SHA256 核对。**没有运行任何新测试、类型检查、lint、性能测试或浏览器；没有访问 HTTP、服务或数据库。**仅新增本报告，不修改产品、测试或旧证据。
- **静态证明**：能由当前实现和依赖代码直接推出的行为。**记录证据**：已经落盘的他人执行结果，本次只核对文件和版本。**待验证推测/缺测**：未建立动态反例，不能标产品 FAIL。**实际 UI NV**：本审阅未独立操作实际页面，不升级 hook/jsdom 结论。

## 发现：既有 timeout deadline 会被 UI 回调延后

**NR-PEER-01 / P2 / 静态因果明确 / 既有问题，非本差异引入。**

准确位置：当前 `use-homepage-host.ts:188–201`，以及 S 的 `homepage-v25-state.ts:81,233–237,387–392`。原 baseline 的 host `178–191` 已包含相同 timer 及依赖数组。

1. timeout effect 依赖整个 `session.ui.requests.global` 对象，并从 effect 安装时再等待 `15_010ms`；cleanup 会清除旧 timer。
2. host `onUi` 调用 `updateHomepageUi`。S 的 `makeState` 对整个 core 做 JSON clone，因此即便 generation、scopeKey、startedAt 没变化，`requests.global` 也会变成新对象。
3. pending 中一次 UI 更新触发 rerender 后，effect 会清除旧 timer，并再等完整 `15_010ms`。`markHomepageRequestTimedOut` 虽按 `startedAt` 判断，但只有新 timer 触发时才被调用。
4. 推导时间线：请求 t=0 开始；t=10s `onUi({scrollTop:25})` 后 timer 改排到约 t=25.01s；t=15.01s 时仍没有 timeout callback。若持续产生回调，手动恢复提示可继续延后。这不是请求本身重新开始。

实际可调用点存在：Surface `:248` 搜索按钮、`:252` 主滚动、`:310` 搜索结果滚动均可发 `onUi`；其中搜索按钮与主滚动不以 pending 禁用。**本次没有观察真实页面在这些时间点触发事件，具体 UI 时序仍 NV。**

规格依据：HP09 `:501` 要求请求超过 15 秒转手动恢复。新增 R04/R06 先推进整段 `15_010ms`，然后才发 UI 回调；它们证明“无中间 UI 变化的超时→恢复”，没有覆盖上面的时间线。

建议 root 的独立最小 oracle（尚未编写/运行）：发 navigation → 先推进 10s → `onUi(scrollTop)` → 再推进 5.01s；此时必须 timeout、清 active request、保留原 source；再验证 retry 新 generation 与旧 resolve/reject 无权发布。也应检查同一 generation 多次 UI patch 不延长原 deadline。本报告不授权或实施修复；root 决定此既有合同缺口如何纳入当前门槛，原轮次不重置。

## Standards 审阅

|检查项|直接证据|结论|
|---|---|---|
|范围与原工作保护|冻结 diff 只改变 host；原 host test/session/S/Workspace/Surface 指纹与 manifest 一致|未见越界产品改动或覆写原测试|
|唯一业务与已应用状态|`SourceRecovery` 只有 generation 和可选 UI 字节；target 仍由 S token/lastGlobalRead 决定，data 仍来自 owned result|没有第二份业务缓存或 applied 账本|
|请求匹配不另造算法|host `:92` 拒绝旧 pending generation；session 调 S 的 generation+scopeKey+payload 验证|未放宽原 S 接受规则|
|失败证据和验收边界|原 RED、候选 GREEN、原测试均保留；冻结报告显式 UI NV、Recall OPEN|未见以单测替代真实旅程/视觉接受|
|15 秒合同|上面 NR-PEER-01|继承的规格风险，不能据此次静止计时测试关闭|

没有为了列数量而附加可维护性“smell”；此次新增 ref 的职责和清理点足够明确。一般 URL/pop 在读途中改页、callback 抛错问题在批准设计中已明确未获新 RED/未纳修复，本次不将这些原行为冒充新回归。

## Spec 审阅：生命周期与权威优先级

批准设计 SHA `266e50e3862a23dde17a4dbb9d9d9505f457a451a7f7bd76fcc1256aaa8bef3b`。HP06 `:436–456` 及附录 `:655–660` 区分目标 URL、来源 UI 和重新读取业务数据；HP09 `:475–480,497–501` 要求 pending/失败保旧整组、最新有效意图优先与手动恢复。

|场景|实际实现追踪|测试覆盖与静态结论|
|---|---|---|
|首次 navigation / 返回读取|host `:84–89` 建立 `{generation,source}`；`:149,170` 只把合法且匹配的来源传入|R01/R07，原 non-default 初始化测试；保护不依赖 scope 是否不同|
|pending UI patch|`:203–206` 仍更新临时 UI，但 recovery 存在时不写 source/storage/history|R01/R07 精确字节与完整 snapshot 断言；不提前应用 A 或伪造业务成功|
|reject / timeout|catch `:124–132` 与 timer `:188–201` 清 active pending，不清恢复上下文|R03/R03b/R04；合法来源在失败后仍能恢复。timeout 时点另有 NR-PEER-01|
|手动 retry|`:231–235` 无 active pending 才 retry；`:84–86` 仅 navigation retry 重新带 captured source；S `:352–358` 保 purpose/target、新 generation|R03/R03b/R04；不能退化 refresh(old applied)，不能丢完整 query/page/focus|
|pending reload|`:231–235` recovery 与 pending 共存时直接返回|R05 的 reader count/token 不变；消除已知 API 抢占，不称为浏览器硬刷新|
|identity B 覆盖旧 A 意图|`:88` 将保护归属转给 B generation；B 不带 A source；session 仅在 sourceBytes 存在时 restore|R09 success/late resolve/late reject 与 B failure→retry；B 自有 bundle 与 UI 能提交，不恢复 A 到 B|
|旧结果到达|成功先过 `:92`；旧 reject 进入 S 后因 generation/scope 不匹配不接受，且不清 current pending|R04/R09。旧 A 不能释放 B 或 retry 的 source 写保护|
|恢复成功后释放|`:109–114` 先取得 S 接受后的 UI+owned data，再仅清 matching recovery generation；home `:115–118` 以新 committed 持久化|R06 接受后 onUi 与 focus refresh 恢复正常；R09 新 B 可以写来源|
|focus / visibility|`:244` 同时要求无 pending、无 recovery，且 home/无 route error/非 hidden|R06 failure/timeout 均不自动抢占；成功后的正常 refresh 有对照|
|出站 scoped/global|`:226–227` recovery 中不重新编码旧 committed；navigate `:213` guard+最新 navigation intent 成立后才 commit/push|R08 允许/取消/抛错/旧 guard 晚到；target 仍按 committed 生成，protected source 保留|
|直达 trades 的目标与来源不同|route 根据目标 URL，reader 数据为全局 bundle；来源只供返回 UI 使用|原 cold trades 失败→retry 的目标 a 与来源 hk 对照仍原样；不能把 UI 来源误当目标集合 scope|

实际 Workspace `:2180–2200` 的 reader 返回同一次 bootstrap/market/FX/entries bundle，只有 requestId，没有另一个 scope 缓存；`:2205` 的 onReadAccepted 更新该 bundle 所属数据。Surface 的 `onRepair` 在真实异步操作结束后调用 `homepage.reload`（Workspace `:5988`），所以 pending reload 防御有真实调用入口；本次没有证明它在原故障现场实际触发 NR06。

## 17 个新测试逐组核对

这里的 PASS 来源为冻结执行记录，不是本次重跑。测试断言使用真实 host/S/session、deferred reader、jsdom history/sessionStorage；reader 的 data 是合成字符串，不证明真实网络/数据库链。

|组|展开数|本次读到的关键断言|仍不能推出|
|---|---:|---|---|
|R01|1|pending onUi 前后存储字节不变；卸载重挂后 fresh owned result 与完整 source 一致|旧挂载 promise 在卸载后结算的行为；真实硬刷新网络生命周期|
|R03 + R03b|2|失败后有/无 UI patch 的 retry 都保 captured UI、同 navigation target、新编号、callback 一次|所有 cold home / fresh catalog 变化组合|
|R04|2|静止 15.01s timeout、retry，旧 resolve/reject 均无权发布|pending 期间 UI patch 后仍在原请求 15s deadline 超时|
|R05|1|pending reload 无额外 reader、无 token 替换，原 navigation 可接受|原用户现场究竟由哪个 UI/异步回调触发抢占|
|R06|2|failure/timeout 后 focus/visibility 不发 read；成功后恢复正常 focus refresh|真实 OS 窗口/浏览器 visibility 顺序与自动滚动|
|R07|1|同 scope 的不同 search/page/focus 来源不被误认为已提交|完整真实控件恢复与焦点落点|
|R08|5|scoped/global 允许出站、取消/抛错、两 guard 晚到，source 与 commit/entry 分别断言|离开后旧 read 失败/timeout，再从 trades retry/返回的组合|
|R09|3|B 成功、旧 A resolve/reject、B failure→retry 不恢复 A|B 自己 timeout→retry 的组合（未发现对应独立用例）|
|总数|17|每个展开分支与 verbose 日志名称对应|不能替代真实 UI 接受|

## 尚缺组合测试与已知范围外风险

1. **优先：NR-PEER-01**，同 generation pending UI patch 与 15 秒 deadline 的组合。有静态因果，缺独立 RED；应由 root 保留为明确合同风险。
2. **R08 离开后的失败/timeout**：当前只让旧 read 在 trades 成功，再返回 home。未测离开后旧 read 失败/timeout、trades 手动 retry、再返回时 source/URL/collectionOrigin 均保持正确。实现可能合理，尚无反例，不标 FAIL。
3. **identity B timeout**：已有 B reject→retry 及 navigation timeout 两类对照，组合逻辑静态一致；仍缺 B timeout→retry→late A/B 的独立测试。不能只凭邻近用例标这个组合已覆盖。
4. **R01 的硬重挂边界**：旧挂载请求未在卸载后 resolve/reject。此测试不能证明跨挂载取消，也不能完全等同浏览器 hard reload。host 原本没有 mounted-generation guard；这是既有一般生命周期边界，不是本差异新引入的 finding。
5. 批准设计明确排除的更一般问题：onReadAccepted 抛错、URL/pop 改页而旧 navigation 未结束。本次未构造新 RED，不要求候选扩修；不据此宣称这些路径已安全。

## 冻结记录与独立核对

已读取 `04-affected-26-and-recovery.log/json`：17 新 + 22 原 host + 4 原 session，记录 **43 PASS / exit 0**；严格 tsc 的 `05` 和有限 lint 的 `06` 均记录 exit 0，运行前后 SHA 一致。另看到 root 已保存 `root-07-independent.json` exit 0；它属于 root 的执行，本审阅未代签。原 `01` 3 FAIL、`02` 15 FAIL/2 PASS 与候选 `03/04` 仍全部保留。

本次实读 SHA256：

|文件|SHA256|
|---|---|
|host 当前候选|`85731c885096209b54cf5918cc9a9ee82aeab5f76e30905f8a2af9430484f5e0`|
|新增 navigation-recovery.test.tsx|`1f8e62d6d8ab1a1e4a59657c9e1e0ffdc644fd31e9351c8257d54be693ebbf09`|
|原 use-homepage-host.test.tsx|`327c1c9ce4b0587abf9618e70bb961f0c520defe8485c173689cc82cc5262caa`|
|session-model.ts|`828162fd03dcba7d4632a189444e54e1c4f0761d937c7bf0b4e4ad96abb4766e`|
|homepage-v25-state.ts|`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`|
|Workspace|`6d255f0e1ed1a0af1d094cedb769cfe7fd33c6164c87b46a8ba8f57944581d22`|
|Surface|`914f13c9cb429c40b76acf45a562168fbc4e309a6fdbaeb5248a52a2529f95b5`|
|批准设计|`266e50e3862a23dde17a4dbb9d9d9505f457a451a7f7bd76fcc1256aaa8bef3b`|
|FROZEN-REPORT.md|`46c8d8dcac237aa2b9e2841affb3d1ed8b225aea7a32b0096d65b109773f57da`|
|candidate.diff|`4c471f9cd996cf255094869d936365e7c4c2367d74d3aad5a3ce903763f70091`|

host baseline SHA 为 `74d765fe938aaa126ef115a683dea7f96181aab67c24de6e33e3e51fde08d2f2`。当前产品/测试 SHA 与冻结 manifest 相符；本报告不修改任何输入。

## 接受状态

来源写权限修复的静态审阅已完成；存在 NR-PEER-01 的既有 deadline 合同风险与上述未覆盖组合。**实际鼠标、键盘、focus/visibility、超时/失败重试、浏览器刷新/返回、业务持久化与视觉在本 peer 审阅均为 NOT VERIFIED。**root 的独立真实旅程与正式验收仍是唯一接受门；原 Recall 错证券原因保持 OPEN，本报告不重置原轮次或替代整票接受。
