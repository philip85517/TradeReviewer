# Coordinator independent acceptance

Status: accepted — 实施、独立QA与协调者验收完成；下文时间顺序保留历史失败/修正，最终结论见末尾。

Preview: http://127.0.0.1:3031/ — isolated .data/library-ux/acceptance.sqlite, initial browser verified data loaded (236 instruments, 766 rounds). Source fingerprints saved separately. UI may change during HMR; final verification must rerun after final patch.

| Scenario | Expected | Result |
|---|---|---|
| Fresh browser state | live/stocks/all/newest | 真实浏览器通过（tab8） |
| Account filter on multi-account stock | only matching account episodes/count/metrics | 自动化通过；QA迁移工作台账户操作路径中 |
| Drawer close vs apply | close discards draft, apply commits atomically | 真实浏览器、键盘、窄屏通过 |
| Same stock multiple runs | one stock with separated runs, friendly labels | 独立组件/聚合测试通过；真实样本每股单运行 |
| Clear simulation run while profit sorted | newest order and matching indicator | 真实浏览器通过 |
| Complete review and return | correct ID, progress updated, expanded row/scroll retained | 真实隔离DB保存及第二页返回通过 |
| Include reviewed | same stock state relaxed, year/account/nature unchanged, global totals unchanged | 真实浏览器与独立测试通过 |
| CNY weighted example | +100 / 100000 = 0.10% | 独立财务测试通过 |
| FX example | (1000-100*7)/(10000+1000*7) = 1.76% | 独立财务测试通过 |
| FX manual only | page mount reads cache, no external fetch; manual updates same snapshot | 真实手动刷新/再次进入缓存通过 |
| FX failure | cache label/date or unavailable, never fabricated zero | 受控失败浏览器及服务测试通过 |
| Empty/missing metrics | unavailable and sample disclosure | 组件及财务测试通过 |
| Desktop/narrow/keyboard | readable, no blocked navigation, drawer focus/escape | 最终1280×720/375×844及Escape通过 |
| 5000 rounds | actual timings recorded, no tool roundtrip used as metric | 未达目标，追加优化并复测中 |

Commands at final: npm run typecheck; relevant Vitest + consolidated full suite; npm run build; runtime checks as applicable. No repeat of already green checks unless changed code/new findings warrant.

Startup: TRADEREVIEW_DB_PATH="$PWD/.data/library-ux/acceptance.sqlite" npm run dev -- --hostname 127.0.0.1 --port 3031 (from this worktree; check port ownership before restart).

## Intermediate browser check (not final gate)
-3031 truebrowser: freshlibrary live/stocks/all/newest,232stocks/734liverounds.
-Drawer keyboard: initialclose focus; ShiftTab→Apply; Tab→close. Escape restores trigger.
-Draftyear2025 thenEscape discarded; reopenvalueall. Apply2025→79stocks/132rounds,removableyear2025chip; reopenvalue2025.
-TransientREVIEW_TAGS HMR error occurred duringparallelwrites, fixedsource andfreshreload resolved; mustcheckfinalfreshconsole separately.
-Summary/CNY/header sorting integration remainspending; noend-to-endacceptanceclaim.

- Drawer narrow screenshot checked at actual375×844 DOMviewport: scrollablecontent and persistentCancel/Applyfooter visible; Escape focusreturnpassed. Temporaryviewportreset. CUAviewport affects selectedtab; closed intermediateperf tab3 to target devtab2. Finalwholepage narrowcheckpending.

##03 truebrowser write/return check (isolatedcopyonly)
- Search黄金ETF华安→one stock,2accounts,6rounds. Expandedchilddate2026-04-02→2026-07-28,+5373.17 correctlyopenedidenticalworkspaceround.
- Savedtestreview text viaCompleteandNext in acceptance.sqlite only; returnretainssearch/expandedstock,progress1/6,StartReview5.
- Pendingfilter→5rounds;localinclude→6childrenwhileglobalfilteredcount/StartReviewremain5.
- Rootfoundlistusedcurrentindexordinal, differedfromworkspacestableordinal; returnedtoUIowner. Extra locallyincludedrowrequiresownoutofglobalstatisticsbadge;returnedtoUIowner.
- Finalmetrics/layoutintegrationnotyetdone; financialbrowsergatespending.

- Post-review SQL fingerprintcheck: protected source all5tables exactbaselinehashes match (1857executions,236instruments,130reviews,208imports,6revisions). Isolatedcopyexecutions/imports/revisions unchanged; reviews131 afteroneQA save; instrument47records changedmetadata_json/updated_at only viaexistingdisplaymetadata hydration. Evidence:data-check-after-review.json.

##04 realprovider browser gate
-Manual refresh clicked twice against actuallocal3031API; bothsucceeded. Data date2026-09-18; savedtimefirst19:50:44,second19:51:27 (local2026-09-19). UI rates HKD0.8538CNY/USD6.6975CNY,CNY1.
-Returntodashboardandreenterlibrarykeepsgoldsearch/pending/expanded/localinclude;FXreadshowsidentical19:51:27savedtime,nomountrefresh.
-CNY-onlyclosedsummarywithoutFXpreviouslyworked:pendinggold4trustedclosed,+49397.50/11.91%,openexcluded. AfterFXsameCNYvalues.
-Cachedfailurebrowserpathplannedoncontrolled3032API405(noexternalrequests);realservicefailurecoveredunitQA.

- Controlled browser FXfailure passed onproductioncomponent3032harness: localPOSTreturns405, existingcachedsnapshotretained(HKD0.9/USD7,date09-18), explicit“刷新失败，仍使用已保存汇率” +“使用缓存汇率” shown. This testsUItransportfailure, notrealECB outage;servicefailureatomicitycoveredunitQA.

## Final integration browser evidence (pagination build)
- Actual3031 second stock page shows101–200/232, full734round summary/733pending unchanged. ExpandedST诺泰 opens第2round2025-03-27→06-10; workbench4executions/PnL-2842.39 matches. Return retainssecondpage+expandedstock.
- Simulation nature shows4stocks32rounds; mixedruns performancebuttons disabled. Drawer oneTradingView source, friendlyrunlabels. Selecting天通股份5UG9 yields1stock12rounds/+20580/1.71%; PnLsortenabled/pressed. Removingrun resetslatestdescending(aria-pressedtrue), mixedrunbuttonsdisabled again. Switchingqueue retains32round scope and disablesbothperformanceheaders.
- npm test: productionbuild and5runtime tests pass (log /tmp/tradereview-e7ec-final-runtime.log).
- Full lint excluding generatedbenchmarkdist foundonepreexistingprefer-const error inlocalized-metadata-hydration.ts (verifiedHEAD); coordinatorconvertedassignmenttoconst withoutbehaviorchange. Remainingwarningsbaseline. InitialdefaultVitest abortedafterresource-contention5secondtimeouts; boundedfullrunmaxWorkers2/testTimeout20s underway.
- Boundedfullrun identifiedoldworkspace-test navigationhelper stillassumingdefaultqueue. IndependentQAassignedupdatepublicnavigationtonewspec withoutweakeningreplayassertions.

## 最新最终验证证据
- 最新类型检查、生产构建均通过（/tmp/tradereview-e7ec-final-typecheck.log、final-build.log）。
- 全量 185 文件运行结束：178 通过、2 跳过、5 失败；1691 测试中 1636 通过、5 跳过、50 失败。50 项均落在旧导航/来源名称/新增本地FX读取影响的5个测试文件，逐项交由QA修订公开用户操作路径和明确网络边界，不删除业务断言。
- 协调者随后独立复测20个相关文件155项全部通过（/tmp/tradereview-e7ec-final-scoped.log），含已修复的broker、refresh、SQLite边界。workspace/import两文件仍由QA收口。
- 全仓lint排除本地生成benchmark bundle后：0错误、13个既有警告。已为生成bundle增加精确eslint ignore，源文件仍检查。
- 浏览器tab8重新加载真实3031：默认实盘/按标的/全部回合，232标的734回合，CNY摘要-14065.01、加权收益率-0.05%、698可信已平仓样本。1280×720桌面截图检查通过；375×844窄屏DOM宽375、文档scrollWidth360，无横向溢出，控件可读。抽屉窄屏内容可滚动、固定底部取消/应用可见；Escape关闭、焦点回高级筛选。已重置viewport，错误console为空，tab8标为交付。
- 受保护原库executions/instruments/reviews/import_batches/trade_revisions五张表最终hash全部与baseline一致，见source-final-check.json。
- 性能仍未通过：5000回合清空搜索恢复在不同负载下约403–829ms，目标300ms。已避免立即读取整页AX影响事件到绘制计时；系统load曾超过260，须保留环境限制，不伪称p95达标。追加轻量聚合/有界缓存优化进行中。

## 最终性能与界面复核（21:38）
- options复用后typecheck、production build、全仓lint均exit0（cache-typecheck/cache-build/cache-lint日志）；lint仍为13项既有warning。
- 协调者重新检查main+drawer同源entries/options，source失效边界覆盖entries/review hydration/market status/FX；相关45项独立回归已通过，drawer额外36项由实现者通过。
- 固定并通过DOM确认1280×720、visibility visible，生产组件766/236组与5000/1530组分别采集抽屉、展开、筛选各20事件。nearest-rank p95（事件→双rAF，毫秒）：766=36.4/49.8/100.1；5000=38.2/42.7/121.1。当前抽样达到拟定200/300ms目标。
- 搜索按黄金/甘李/半导体与清空循环，包含LRU热范围，不代表任意冷查询、首屏、父工作台或网络性能；保留早期高负载超标样本。先前tab9未逐批固定尺寸，后观察为370×844，不将其列为桌面证据；重新在实际1280×720的活动tab10完整跑120事件，见performance-final-samples.json。
- 最终真实3031在1280×720再次进入：默认实盘股票734回合；切换回合仍734，四列表头与实际行对齐截图核对，CNY金额/返回股票视图正确。新页面控制台error为空，活动预览tab10保留，临时viewport已reset。
- 仅剩独立QA workspace中的3项实际XLSX导入确认路径测试待调查，不能标为全量全绿。

## 最终结论
- 独立QA规格矩阵qa-final-spec-coverage.md已完成；工作台65/65、import29/29。3项XLSX测试为1s查询超时，保留真实解析/取消/提交断言并增加上限10s等待后通过。
- 协调者最终4文件130项全部通过，76.97s，/tmp/tradereview-e7ec-final-four-files.log；另3项导入独立复测通过；最新typecheck通过。
- 先前全仓运行5个失败文件现均经定向修订复测通过；全仓没有重复跑，不能声称有一次最终185文件全绿日志。
- 功能范围无未解决缺陷；性能抽样达目标但不扩张为冷启动/任意查询/整站SLA。01–09 accepted。预览3031保持运行，tab10最终真实浏览器无错误，sourcehash不变。
