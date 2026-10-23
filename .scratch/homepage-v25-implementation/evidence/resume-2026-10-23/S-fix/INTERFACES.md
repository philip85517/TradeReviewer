# S → P1 消费合同（恢复验收候选）

版本：`HomepageSnapshot.version = 2`。源码 SHA256：`ddceb3cb717d83431605fdbe2764c9d619321f883b8fbd7234bea3897aaafc1b`。本合同只描述纯模块，真实路由、storage adapter、数据查询、DOM 焦点及视觉验收仍属 P1/页面 owner。

## 1. 唯一权威与持久化字段

`state.snapshot` 是唯一 committed UI。`state.applied` 是 `snapshot.scope + snapshot.attachments` 的只读派生 getter，不保存第二份副本；`desired` 是 draft 的兼容 getter。页面已应用标题、市场币种和条件从 snapshot/applied 读取，弹层从 draft 读取。不得给 applied 赋值、把 draft 当作已应用标题、把整个 HomepageState 写进 storage，或直接修改内部对象；动作都返回新 state。

|唯一字段|内容/语义|
|---|---|
|`scope`|live、market、accounts；保留原 Scope 的 navigation range/date/symbol 兼容字段。首页全局初始化使用 `rangeMode: 'all'`，期间显示和当前数据查询必须读取独立 `period`，不得用此兼容字段复制期间权威|
|`attachments`|附加标的类别集合、整页 openOnly、pendingReview。标的类别与贡献 long/short/ipo 不是同一枚举；此纯层保留非空类别 ID，目录合法性由 P1 的真实筛选目录提供|
|`period`|`all + null/null`，或 `week/month/ytd/custom + 实际 from/to`。week/month/ytd 对应本周/本月/本年；按上海业务日计算实际日期由 P1 负责。all 保留原 API 的确定性初始化/全部范围兼容值，不要求增加产品快捷项|
|`history`|`range` 为 all / year(year) / this-year(year) / years(fromYear,toYear)；`chartMode` 为 period-pnl / cumulative-pnl / win-rate / round-count|
|`contribution`|mode + current/history 两个独立 view；每个 view 独立 category(long/short/ipo)、sort(profit-desc/loss-asc)、page、market、symbol、drilldown(markets/symbols)；只有 current 有本地 openOnly|
|`holdings`|query、sort key、page；query/sort/市场变化回第1页、真实数据页数减少时 clamp、每页8行均由页面以明确动作处理，不在 decode 时静默修改|
|`search`|query、open、resultsScrollTop、selectedSymbol 完整身份、triggerFocusId|
|`returnState`|source(home/trades/detail)、container(holdings/history/contribution/search)、detailId、精确 triggerFocusId、缺对象时 missingContainerTitle|
|其它|scrollTop、focus、futureDisclosureSources（UI 展开来源 ID 集合）|

范围对象、账户/类别集合和字段顺序都由共享 normalizer 规范化；集合去重排序，页码是正整数，滚动是非负有限数，日期必须为真实日历日期且起止有序。贡献 markets 层不保留一个潜伏的 market/symbol；symbols 层可保留局部市场与所选证券。市场已限定时页面可直接进入该市场 symbols 层；全市场的 market row → symbol list 旅程由页面实现。

保存期望 UI 的同时，不保存 rows、金额、汇率、业务对象或 request。encoder 对所有层逐字段重建，包括 contribution.current/history 和 history.range；未知属性被剔除，已知 UI 值非法则抛 `invalid-homepage-ui-state`。decoder 严格拒绝未知字段/非法值。不要用 encoder 给未知历史 JSON“洗白”；外部存储内容先走 read/restore。

## 2. 编辑、提交和更新域

|动作|行为|
|---|---|
|`createHomepageState(scope)`|创建可直接编码/恢复的完整快照；所有 requests=null|
|`editHomepageDraft / editHomepagePeriodDraft / editHomepageHistoryDraft`|只改相应有效目标草稿。日期输入中暂时不完整/非法的原始文本及字段错误由弹层本地状态承载，校验后再交模块；不能把无效文本当 committed 日期|
|`cancelHomepageDraft`|关闭筛选并终结其 global request，保留筛选草稿；不要在仅打开弹层时重建草稿覆盖用户编辑|
|`cancelHomepageRequest(state, 'period'/'history')`|只终结相应请求，并把对应日期草稿还原到 committed；不改另一个域|
|`clearHomepageAttachments`|只清附加草稿，保留市场、账户、日期|
|`resetHomepageDefaults`|草稿市场=all、账户=*、附加为空；日期不变，committed 不变|
|`changeHomepageIdentity(state, scope)`|终结旧请求、丢弃旧身份附加草稿，准备新身份；原 committed 整组保持到新加载成功|
|`beginHomepageApply / beginHomepagePeriodApply / beginHomepageHistoryApply`|规范化目标、生成递增 token、保留旧 committed；各域只有最新 token 可完成|
|`completeHomepageRequest`|返回 `{state, accepted}`；只有 accepted=true 才允许页面同步提交匹配数据。一次只提交对应域，保留最新其它 UI|
|`retryHomepageRequest`|显式新 generation；global 兼容别名 `retryHomepageApply`|
|`markHomepageRequestTimedOut(state, now, 15000, domain)`|达到15秒后终结该请求，保留旧 committed、记录 timeout；只允许手动 retry|
|`updateHomepageUi`|更新 holdings/contribution/search/returnState/scroll/focus/future disclosure 或 historyChartMode；不允许绕过请求修改 global/period/history.range|

`requestCounter` 在同一个 owner 中跨域单调递增。generation 和 scopeKey 两者必须匹配。scopeKey 是完整规范化目标及其数据依赖：global 依赖当前 committed period 与 history range；period/history 各自依赖 committed global+attachments，不互相依赖。属性插入次序和集合排列不改变键；真实日期、身份或附加条件改变会改变键。

period 成功只更新当前期间相关数据；history 成功只更新历史相关数据；两者乱序均可成功。global 成功使旧身份/附件下的 period/history token 失效；period/history 先成功使加载时依赖旧日期的 global token 失效，errors.global=`superseded`，必须以新日期显式重试。historyChartMode 以及贡献/持仓浏览状态不被日期完成覆盖。

失败、错误 payload、超时、取消都终结 token；同一代随后成功不会被接受。旧请求的 generation/key 不匹配时直接忽略，不把较新的请求标成失败。网络 AbortController、timer、卸载清理、错误提示仍由 P1 负责。超时不是自动任务；P1 必须调用 mark 并中止/忽略底层请求。

## 3. 页面数据提交例子

下例中 businessData 只在页面的内存，不写入 HomepageState。React 应把 UI state 与匹配 projection 放在同一个 reducer 中；完成 action 必须对当时最新 state 校验，不能在异步闭包中对过期 state 校验后无条件 setState。

```ts
const started = beginHomepageApply(model.ui, model.ui.draft);
const token = started.request!;
dispatch({ type: 'started', ui: started });
// 查询身份来自 token.target；两个日期依赖取 started.snapshot，禁止再取待编辑草稿。
loadGlobal({ scope: token.target, period: started.snapshot.period,
  historyRange: started.snapshot.history.range }).then(
  data => dispatch({ type: 'global-finished', token, data }),
  error => dispatch({ type: 'global-failed', token, error: String(error) }),
);

// reducer 中，对 model.ui 的当前版本完成：
const completion = completeHomepageRequest(model.ui, {
  generation: action.token.generation, scopeKey: action.token.scopeKey,
  ok: true, applied: action.token.target,
});
return completion.accepted
  ? { ui: completion.state, businessData: action.data } // 同一次 reducer 提交标签和数据
  : { ...model, ui: completion.state };              // 保留旧数据
```

期间改用 `requests.period` 与 `{domain:'period', generation, scopeKey, ok:true, period:token.target}`；历史改用 `requests.history` 与 `{domain:'history', ..., historyRange:token.target}`。accepted 时只替换本域 projection：period KPI/曲线/current contribution，或 history KPI/曲线/history contribution。全局成功则替换该全局请求涵盖的整组数据。scopeKey 是 opaque token，不要自行拼接或只用 `homepageScopeKey` 替代 request.scopeKey。

失败 action 使用同一 token，`ok:false,error:'network-error'`；retry 后旧 token 不再生效。兼容 `applyHomepageResult` 只返回 state，新 P1 数据接线应使用带 accepted 的完整接口。

## 4. 来源捕获、导航和返回例子

```ts
const captured = updateHomepageUi(model.ui, {
  scrollTop: currentScrollTop, focus: 'holdings',
  returnState: { source: 'trades', container: 'holdings', detailId: symbolIdentity,
    triggerFocusId: exactRowButtonId, missingContainerTitle: '当前持仓（最新）' },
});
const sourceBytes = encodeHomepageSnapshot(captured.snapshot); // P1 容错写 storage/history

// 目标 URL 使用已应用身份。普通/证券入口把实际当前期间转为 execution-date 范围；
// 日期点入口明确改为 rangeMode:'date',date，不把来源 period 当目标日期。
const { live, market, accounts } = captured.snapshot.scope;
const period = captured.snapshot.period;
const range = period.preset === 'all'
  ? { rangeMode: 'all' as const }
  : { rangeMode: 'custom' as const, from: period.from, to: period.to };
const targetUrl = serializeHomepageNavigation({ live, market, accounts, ...range,
  symbolIdentity });
// 普通入口省略 symbolIdentity；日入口使用 {live,market,accounts,rangeMode:'date',date}。

const target = parseHomepageNavigation(targetUrl, { allowedAccounts, allowedSymbols });
if (!target.ok) { /* 明确纠错，保留原 query；不能退回源快照或默认 all */ }
else { /* 立即按 target.scope 加载普通交易库，包含该成交日内 open，绝不默认 queue */ }

// 返回时重新读取业务数据，不从 sourceBytes 复原 rows。
const restored = restoreHomepageState(sourceBytes, model.ui);
if (restored.ok) {
  // requests 全为 null；在同一 live owner 必须传 previous，避免旧异步 token 编号重用。
  // 对 restored.state.snapshot 全条件重读，再与 UI 原子提交；真实结果提供 objectExists。
  const focus = restoreHomepageFocus(restored.state.snapshot, objectExists);
  // DOM ready 后精确恢复 focus.triggerFocusId；缺对象只回 focus.fallbackTitle 对应容器标题。
}
```

URL 只表达目标 live/market/accounts/execution-date range/symbol；sourceBytes 保存原首页有效 UI。不能用旧来源覆盖复制/刷新后的 URL 目标。attachments 不被 serializer 混入导航 query，也不会出现 queue。两/三段证券身份保留交易所、代码、必要资产类别；禁止空段、空白、控制字符或多段，存在目录时还验证 membership。

`accounts=['*']` 是全账户语义，不是需要出现在真实目录的伪账户；concrete ID 必须在传入 catalog 中。缺失/空/unknown/mixed/空列表项/重复参数显式失败；重复真实 ID 作为集合归一化。非法 market 唯一允许 all + `warning:'invalid-market'`，P1 必须显示提示。非法/不完整日期、scope、symbol 不静默扩大。目录在恢复/直达时由 P1 获得；本模块不读 DB，未提供 catalog 时只做语法校验。

## 5. 版本、恢复及责任边界

`readHomepageSnapshot` / `restoreHomepageState` 返回 missing-snapshot / invalid-json / unsupported-version / invalid-snapshot。v1 缺失 chartMode、history 选择语义、贡献 local openOnly，无法可靠重建，明确拒绝；不得用缺省条件偷偷迁移。v2 缺任何必需字段也拒绝。`decodeHomepageSnapshot` 保留旧的 snapshot|null 简化接口。新空白快照可直接 encode→restore。

首次全新 owner 恢复可不传 previous；同一个活跃 owner 恢复必须传 previous，清所有请求且继续单调 generation。请求本身和 counter 不进快照。业务日跨年/跨月时，preset/mode 与最后应用的实际 bounds 都保留；P1 计算新目标并成功加载后再切换，不在 decoder 中重算日期配旧数据。

P1 仍须验证：SSR/被禁 storage/getter/read/write/配额异常；hydrate 完成前不覆盖旧值；显式返回优先于晚偏好；真实 reload、真实普通交易库 execution-date/open 过滤、逐层详情返回与重新取数；已删除账户/证券的明确纠错；真实数据页码 clamp；精确 DOM 焦点和来源容器标题；鼠标、键盘、触屏与匹配设计截图。上述均 **NOT VERIFIED**，纯测试不能替代。此接口不表示 S 已接受。
