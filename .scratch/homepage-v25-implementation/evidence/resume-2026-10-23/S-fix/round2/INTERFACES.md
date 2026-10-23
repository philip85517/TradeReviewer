# S recovery round2 → integration 消费合同

候选状态：**implementation-ready，待 root 同票恢复第2/3轮独立接受**。实际模型 `gpt-6.1-sol / ultra`。本文件增补并替代旧接口文档中的 v2 附件、原生日期初始化、URL fallback 与读取意图规则；旧文档/历史证据保留。批准依据为 P3 状态合同 `016580e865e3e0be2bcab814dbdf62292836c7a16071ddbba98a7b40de618057` 及 root 显式 navigation 裁定。

冻结 S SHA256：`fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e`；测试 SHA256：`4f474e134ed06d19e2961df7aa66d65356a4a3c537749a6584429479e7d6759a`。准确版本/消费者指纹见 [source-freeze.json](source-freeze.json)。这里没有实现 host、路由或 storage。

## 1. v3：一个 committed 与一个附件 draft

`state.snapshot` 仍是唯一 committed UI，`applied` 仍从 `snapshot.scope + snapshot.attachments` 派生。不能保存另一份 selected/applied，也不能用 draft 更新已应用标题。附件改为：

```ts
type HomepageAttachments = {
  categories: string[];
  openOnly: boolean;
  pendingReview: boolean[];
};
```

|字段/值|约束|
|---|---|
|`openOnly`|正文 HP03 单向“仅看未平仓（含真零）”；不是旧图“是否有未实现数据”。贡献 `current.openOnly` 不变|
|`pendingReview=[true]` / `[false]`|只“是”/只“否”；S 只保存选择，不推断 episode 事实|
|`pendingReview=[]` / `[false,true]`|业务谓词均不限制；UI 选择不同，重开/codec/key 必须分别保留|
|集合|类别、账户、pending 选择均去重/稳定排序；重复/次序不改变 key；双选不压成空数组|
|版本|新建/写出为 `version:3`；外部 JSON 必须先 read/restore，不用 encoder 洗白|

v2 **完整严格验证后**迁移 `true→[true]`、`false→[]`，其余 UI 字段保持。v2 缺字段、嵌套业务字段、错误旧类型均拒绝。v3 布尔 `pendingReview:false` 不是有效 draft/snapshot；旧直接调用方改成 `[]`，仅持久化旧 bytes 走版本迁移。v1/未知版本继续明确拒绝。

encoder 逐层重建 UI 白名单、剔除业务属性，非法已知 UI 值拒绝；decoder 严格拒绝未知属性。持久化仍只用 `encodeHomepageSnapshot(ui.snapshot)`。恢复没有 request 或 retry intent，也没有行情、FX、金额、rows。

其它完整持久化字段保持：holdings(query/sort/page)；period；history(range + 四 chartMode)；contribution(mode + current/history 各自 category/sort/page/market/symbol/drilldown，current 本地 openOnly)；search(query/open/resultsScrollTop/selectedSymbol/triggerFocusId)；returnState(source/container/detailId/triggerFocusId/missingContainerTitle)；scrollTop/focus/futureDisclosureSources。原精确 trigger 和对象缺失标题 fallback 不变。

## 2. URL 日期与期间的一致性

`createHomepageState(validatedScope)` 立即创建完整可恢复 v3：URL all→period all；date→custom 单日；custom→相同实际区间。`scope` 的路由日期现在是 `period` 的受控投影；原生 date 表达可保留，并非第二个可独立编辑的期间。

成功 `beginHomepagePeriodApply(...,{preset:'all',from:null,to:null})` 后，同一完成动作将 snapshot.period 设 All、scope/draft 设 `rangeMode:'all'` 并删除 from/to/date；失败/超时/取消/晚返回均不清 committed 日期。成功非 All 将 scope 投影为 custom。期间变化不覆盖 history，也不因 scope 的投影日期变化错误终结 history token。

v2 明确迁移旧不一致：非 All period 按旧 URL helper 的优先级胜出；若旧 period=All，原生 scope 日期初始化 period；再统一 scope 投影。v3 自相矛盾的 scope/period 拒绝，不能显示 All 却仍过滤旧日期。

唯一目标投影：

```ts
const url = serializeHomepageNavigation(
  homepageNavigationScope(ui.snapshot, symbolIdentity ?? null),
);
// undefined：保留已有 source symbol；null：明确移除；string：用准确身份覆盖。
```

普通入口应传 null，证券入口传实际完整身份。此投影保留已应用 date/custom/all，剔除 attachments；显式 All 后不再 fallback 旧日期。日期点击目标仍可按附录2显式构造 date scope。URL 只含 live/market/accounts/range/symbol；附件只作为首页来源 UI，永不隐式 queue/过滤普通集合。

## 3. 单入口读取意图

```ts
type HomepageReadIntent =
  | { purpose: 'identity' | 'navigation'; scope: HomepageScope }
  | { purpose: 'apply'; draft?: HomepageDraft }
  | { purpose: 'refresh' };

const started = beginHomepageRead(ui, intent, now);
const token = started.request!; // purpose + generation + opaque scopeKey + target
```

|purpose|目标与草稿|成功/失败边界|
|---|---|---|
|identity|普通市场/账户切换；清旧附件草稿、失效全部旧请求；目标日期取当前 applied period，保 history|成功仅提交新 global；失败保旧 committed 整组，不预先改标题|
|apply|传 draft 或默认唯一 D；不清附件；目标日期规范化到 applied period|成功提交 token 的附件/身份，保最新其它 UI；失败保旧 C 与可继续编辑 D|
|refresh|读取 C；不把 D 当目标，不覆盖开始前或申请中编辑的 D|成功更新同条件数据；失败保 C/D；retry 仍 refresh|
|navigation|已验证 URL 的完整 scope/date 是目标；清旧附件草稿、失效旧请求；包括已有 owner 的 URL 改日期|成功一次提交 scope + 附件 + URL 所对应 period；失败保旧 scope/period；retry 保原 URL 目标，晚响应不能提交|

`beginHomepageApply` 保留为 apply 兼容入口。`beginHomepagePeriodApply` / `beginHomepageHistoryApply` 继续独立；clear/reset 仍只编辑 D，接同一 apply-purpose；关闭附件仍用 cancel 保 D。没有页面 `hasExplicitAll`。

global key 包含 purpose、规范化完整 target、开始依赖的 committed period/history。period/history key 依赖 global identity+attachments，互不依赖彼此日期。期间/历史先成功会失效依赖旧日期的 global；global 身份/附件成功会失效旧依赖的日期请求。失败、错 payload、15s timeout、cancel 后同代迟到无效；retry 新 generation。源对象属性插入次序/集合排列不改变 key。

`lastGlobalRead` 仅是非持久化重试意图：purpose，以及 navigation 原目标 scope；它不决定已应用标签，不能写 storage。它使取消/失败后仍能区分“刷新 C”和“应用 D”，以及保留 URL 日期重试。restore 清它并提升活跃 owner 的 generation。

数据必须跟随 token。navigation 期间 `started.snapshot.period` 仍是旧 committed，不能拿它当新 URL 的查询日期；新查询边界来自 `token.target.rangeMode/date/from/to`。identity/apply/refresh 的 target 日期已经由同一 S 投影。若读取的是完整 raw bundle，则接受后由新 snapshot 投影各区。

```ts
// session-model 的唯一开始 seam，以下仅为接线建议，未写产品：
function startHomepageRead<T>(model: HomepageSession<T>, intent: HomepageReadIntent, now: number) {
  return { ...model, ui: beginHomepageRead(model.ui, intent, now) };
}

// 必须在 reducer/最新 model 上校验；一次提交 UI 和同代数据。
const completion = completeHomepageRequest(model.ui, {
  generation: token.generation, scopeKey: token.scopeKey,
  ok: true, applied: token.target,
});
return completion.accepted
  ? { ui: completion.state, data: ownedData }
  : { ...model, ui: completion.state };
```

只在 accepted=true 后调用同代外部接受回调。options.data/旧 effect 不得覆盖 ownedData。原 source UI return 流仍须先校验 URL/catalog/source 一致性，并在同一次接受提交中复原；不允许未核验 source 覆写 URL，也不允许附件条件已变化却读一个缺所需事实的业务子集后再盲目恢复。S 不缓存业务数据。

## 4. integration 最小 diff（唯一 owner 后接线）

|文件/当前 seam|最小变更|
|---|---|
|`session-model.ts:startHomepageRead`|参数改为上述 intent，调用 `beginHomepageRead`；删除无条件 `changeHomepageIdentity`。调用方必须显式目的，不按 scope 差异猜测|
|`session-model.ts:homepageTradeUrl`|以 `serializeHomepageNavigation(homepageNavigationScope(snapshot, symbolIdentity ?? null))` 替换旧 period/fallback 分支|
|host `onScope`|`{purpose:'identity',scope}`；原成功前标题/owned data gate 保持|
|host URL bootstrap/acceptAddress/popstate|已通过真实目录校验后用 navigation；所有 URL 日期包括已有 owner 的切换均有权威，不当 identity。guard/补偿 pop 仍由 owner 负责|
|host 手动 reload / focus / visibility|`{purpose:'refresh'}`；不再传 D 或恢复旧 source 来补偿草稿清除；不要把刷新当 retry apply|
|附件 apply/clear/default|apply 读唯一 D；clear/default 先用原 S 草稿动作，然后 apply；UI 控件属 P3，本次未实现|
|期间成功更新地址|在 complete accepted 后从同一 snapshot 投影；All 清日期；拒绝/晚响应不得改地址|
|storage/history/source adapter|新写 v3 key，v3 缺失时读旧 v2，再统一 S read/restore；错误要保留可解释状态，不能默默吞合法旧条件。history.hpSource 走相同 reader|
|直接旧附件构造/测试 fixture|false→[]，true→[true]；显式仅否为[false]；保留原 date URL 断言，不改成 custom 掩盖消费断点|

已读取的 session/host consumer SHA 见 manifest，均未改。直接相邻测试 **13 PASS/3 FAIL**，三项都定位旧 `homepageTradeUrl` 将 native date 因新 period 初始化改写为 custom；完整日志 [11-adjacent-consumers.log](11-adjacent-consumers.log)。S 自身 native date→目标 URL→restore 链有明确通过的断言，不能把相邻 FAIL 当作已接线。

目录 membership/缺失通知、真实 browser history/guard、storage 异常/hydration/reload、全页附件事实/四区同源、DOM 焦点、真实持久化和视觉仍 **NOT VERIFIED**。S 没有实施 pending group 聚合、unknown、类别或 open inventory 判断；这些只能消费真实业务事实，不能用本 UI 合同伪造。
