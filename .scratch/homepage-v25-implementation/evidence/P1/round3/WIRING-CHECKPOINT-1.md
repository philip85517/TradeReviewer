# P1接线 checkpoint 1 — 非正式第三候选

实际模型 gpt-6.1-sol / ultra；正式历史仍1/3 FAIL、2/3 FAIL。有限首旅程/两桌面首张视觉依赖门保留；本检查点不签功能/持久化/视觉通过，不提交implementation-ready。未操作服务、浏览器或数据库；未改F/S、共享scope、layout或依赖。P3尚未实施。

## 当前可审查接线

1. session唯一beginHomepageRead显式purpose；唯一homepageNavigationScope保原生date、显式All清日期；完成校验仍在最新session上，owned bundle与UI同代接受。
2. host身份切换identity、直接URL/pop/返回navigation、focus/手动refresh、retry保原purpose。v3新写、仅v3缺失时读v2。外部data不覆盖已接受owned bundle。新的非默认scope首读探针在08 PASS：URL A股+one账户+date、来源query/sort/page→pending→一次同代bundle和外部callback→原生date URL与已恢复UI。
3. homepage-origin普通库真实nature变化经openGlobalTrades(commit)；仅guard允许且最新导航同步提交共享scope/source/history/route；取消、throw、stale无scope副作用。强测试覆盖sim/unknown、返回首页保UI，未知源记录未补live。
4. 首页修复行情仅该adapter传includeIntraday:false；全部当前/期间/历史消费者保持日线。原daily次数先真实追踪再固定4请求（US:ZZZ、US:XPEV、US:XPEV、US:ZZZ），不改共享默认。
5. 旧dashboard入口迁移到裸全局/trades、选择标的及子回合；保原trade/review/save/drawings/guard业务断言。aliases合法endpoint仅修精确mock，不放宽校验。

## 实测结果及剩余8项逐项状态

完整运行05为3文件118例：110 PASS/8 FAIL；其中workspace97=89 PASS/8 FAIL，原95=87 PASS/8 FAIL，新2个性质边界均PASS；host+session21 PASS。所有原95仍保留。08/10是后续局部结果，不能相加冒充最终全量。

|05中的失败|后续证据/根因|当前状态|
|---|---|---|
|preserves review timeframe/cursor top navigation|原同步getByRole早于普通库ready；仅await findByRole，原timeframe/cursor断言保持；08 PASS|局部GREEN，待下一完整运行|
|refreshes every trade episode|09请求轨迹证明真实aliases路径是/api/storage/tradingview-account-migration/aliases，原mock少/storage返回502→账户恢复error→普通库不ready；修精确endpoint后10 PASS|局部GREEN|
|uses META for historical FB|同endpoint mock阻断，已修；10的筛选表达式未选中本例|待独立复验，不假称GREEN|
|cancelled import/failed market|aliases修正后进入真实普通库；10继续失败是多个真实回合按钮匹配，不再是ready失败|FAIL；最小选择真实子回合边界待修，业务断言保持|
|confirmed import/failed market|相同aliases入口已修；10筛选表达式未选中本例|待独立复验|
|stored metadata→ETF scope (#41)|旧dashboard filter入口已被新首页取代；真实P3附件未消费|FAIL + REQUIRED DEPENDENCY NOT VERIFIED，不能删断言或假筛选|
|alternate simulation runs (#42)|原持有select DOM在scope变化后被卸载；改每次重新query后两运行保留断言继续执行，10推进到nature旧DOM引用后的下一断言失败|FAIL，继续同样追踪真实控件，不能删run/account目录断言|
|return filters/period/calendar (#45)|真实P2期间/视图及P3附件消费未完成|FAIL + REQUIRED DEPENDENCY NOT VERIFIED，第三轮前须补齐|

06 full strict tsc exit0，但早于最新测试微调，最终需再验。07对6个consumer lint exit1：1 error/10 warnings，错误为现cash effect，不写全量lint PASS。05/08/09/10原始日志均保留。

## 首读/回调同代与真实浏览器限制

新增host test settles the initial non-default URL and restored source with its own accepted bundle and callback（08 PASS）验证：readOnInitialize=true，非默认URL+合法v3来源；pending时无callback，数据仍旧；接受requestId1自己的owned-complete后requests.global=null、error=null、scope/URL native date保留、query/sort/page保留，callback仅该bundle一次。

root观察真实3333尚在pending/CTA禁用，仍需在本检查点产品hash上独立验证；上述hook探针不能替代真实Workspace readHomepageBundle→catalog→host→HomeSurface链。现未证实根因，不把它判环境或假装PASS。

## cash effect lint：精确触发与有限提案（未实施）

- 当前workspace1992–2030 useEffect由cashClient/cashDataRequest/cashScopeKey触发；cashScopeKey包含nature、accountIds、simulationRunId、targetCurrency、today等。effect同步调用1995 setCashSaving(false)、1998 setCashSavedFact、1999 setCashSummaryRefreshError；rule定位1998。它在挂载/范围变化触发React内同步派生状态重设，随后同effect才发外部fetch。不是P1新S消费错误。
- 既有HEAD同根因证据是60-workspace-baseline-lint.log（1990同setCashSavedFact），本次07保留新位置，不宣称基线错误可豁免。
- 当前2090起已经按scopeKey派生savedFact/error可见性；但直接删除effect清除会导致A→B→A后旧savedFact复活，不能把删除当修复。最小提案：把临时现金状态集中到带scopeKey的一个状态容器，在scopeKey变化时显式、一次性废弃旧保存事实/摘要错误/saving，再由effect只负责请求及序号取消；可使用React允许的当前render条件reset或已有scope事件入口，但必须覆盖URL/恢复/币种/日期全部触发，不能只补某个click。保留写入sequence与read-only retry语义。
- 修复前必须RED验证A→B→A不复活、pending保存结果跨scope不可见、已保存事实+摘要503仍可只读retry且PUT不重复。尚无本轮现金重构授权，本检查点不修改此业务流、不禁rule。

## 消费源与精确当前指纹

S root accepted v3 source fd8f36e859fca9567f52fbd17acebc6f403af733ff4ff3e2ac0144073f9f643e；manifest记录磁盘实际观察值。F当前有P2纯数据owner并行开发，manifest仅记录观察hash，不把后续运行数归于freeze2/F3。原30owner文件都逐项记录，6个本轮consumer diff另存checkpoint-1-consumer.diff。

- `app/components/homepage-v25/session-model.test.ts` — `26af3ce00e02f03ee1b0cda92512c54ba1acbaca24b5080fd9175cd408de0f5f`
- `app/components/homepage-v25/session-model.ts` — `ece59d74c52a5ea5a64f4c8501fdd797e8b90cdf6ff8fa6c4e60396746c628d5`
- `app/components/homepage-v25/use-homepage-host.test.tsx` — `e48d5d94322fe0d0546445ec555af358d00076b5270239d2751ee09c1d84e208`
- `app/components/homepage-v25/use-homepage-host.ts` — `b6fa6f855b6e2fc6a6a3de2c23d8d4465ddd634a4349cd7da2bcdd002efc02ec`
- `app/components/trade-review-workspace.test.tsx` — `abd51845f58ddba1bfa2aad4d48de66f4952ada2047952e48364fe50921ded6f`
- `app/components/trade-review-workspace.tsx` — `16a390e81b7a408017e53b1c6bedcef0a542ff17dc8a7f771a3071132d443ae7`

本检查点后继续既有A/B/D/F授权修复与回归；P3等root审查消费后正式派发。

## root随后提供的真实首读诊断正证据

root在本检查点形成后报告：真实3333的非默认/home?scope=live&market=a&accounts=p1-count-09&rangeMode=all已收敛，asOf=18:56:57.357Z，pending消失，普通库CTA enabled，query/name-desc/page2与Eye焦点保留。原title unknown实际是assetType，并非nature，不据此修改性质。此为可变版本诊断证据，尚非冻结或正式第3轮；不扩大为全部首读/刷新/持久化PASS。

随后root要求financial独立性能计时期间暂停重测试；10已结束，此刻无本owner测试运行。产品6consumer已在checkpoint manifest绑定；只继续轻量源码/文档，不启动Workspace或相邻重测。
