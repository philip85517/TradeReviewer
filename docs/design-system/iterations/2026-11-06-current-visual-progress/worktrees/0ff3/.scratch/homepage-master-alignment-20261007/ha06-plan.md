# 持仓总体与市场视图 Implementation Plan

> Workers: use superpowers:executing-plans and test-driven-development. Current user approved implementation; do not request duplicate approval.

Goal: 默认总体 CNY，常驻总体/A股/港股/美股，持仓四模块同步而历史复盘范围独立。
Architecture: dashboard owns a local holdingsMarket state, default all. Derive a holdings-only identity, reporting currency and FX snapshot; reuse portfolio/history calculations and existing ScopeChoiceGroup. Global reportCurrency and roomScope retain historical-performance meaning.
Tech Stack: existing React/TypeScript/CSS modules/Vitest.
Spec: issues/06-holdings-overview-market-tabs.md; docs/specs/2026-09-19-trading-room-homepage.md sections 26–29,88–96; docs/design-system/TradeReview-首页拉齐-v0.2.md.

## Contract / coverage (owner: Luna implementation; root whole-page visual, data integration and acceptance)
|ID|Element / exact requirement|Journey / evidence|
|HA06-01|H03 holding header: persistent 总体（CNY）/A股/港股/美股; default all; local to holdings|initial→each tab→all; screenshot + keyboard test|
|HA06-02|H04 summary + H05 history + H06 allocation + H07 holdings table same scope|mixed A/HK/US fixture including ETF; assert all four consumers and counts; real browser|
|HA06-03|all CNY using one FX snapshot, original detail retained; partial data never fake totals|complete FX / missing FX / partial quote tests; CNY subtotal evidence|
|HA06-04|market by canonical security market incl ETF, original settlement currency, unknown market only in all|A ETF + HK ETF + US non-USD settlement test; no duplication|
|HA06-05|closed-performance filters independent; holdings tab overrides assetCategory/markets only, retains account/nature/search/assetType/currency filters and visible chips|switch tab does not mutate roomScope or lower metrics; filtered scope test|
|HA06-06|period/date and async refresh/cancel/retry preserved; worker result identity changes with market|rapid switch pending test, old result not accepted; browser period + switch|
|HA06-07|same style/density; tabs before KPIs, clearly selected/focused, desktop ≥36px and narrow ≥44px; horizontal tab overflow locally if needed|1440,1280,1054/1055,759/760,390,320 screenshots/measurements|
|HA06-08|cash is account-level, not attributed to market; clearly label 全账户范围（当前账户筛选） when market selected; preserve original currency cash if cash target differs|cash label + no misleading market attribution test|

Reference screenshots: evidence/final-20261008/pair-1440-recommended-v2.png and pair-390-recommended.png. No user mockup for new tabs; approved textual contract above overrides former currency-first layout. Reference CSS viewport1440×1000/390×844, 100% zoom; read actual image dimensions/DPR at comparison. Authorized deviation: one persistent market row and CNY default KPI/history/allocation. No re-layout of rest page, no theme change, no review phase changes.

## Review focus
- Missing FX must preserve known CNY valuation without claiming complete total; inspect existing money semantics before changing domain.
- ETF belongs to its security market, not a separate exclusive market.
- Market tab must not contaminate lower performance or inherit conflicting global market filter silently; explain holdings market independence in row helper.
- Pending history may retain snapshot only for same identity; different market cannot flash old values as new.
- Account cash not market cash; global reportCurrency must not override default holdings CNY.

## Task 1 — complete holdings viewing slice (Luna)
Allowed files: app/components/dashboard/review-dashboard.tsx, .module.css, .test.tsx; add holdings-view helper + tests in same directory if needed; room-allocation.tsx/.test.tsx only for account-cash labeling. Domain change requires report to root first. No parent workspace modification needed: useFxRates is already enabled independently of report currency.
- [ ] Add failing behavior tests for HA06-01..06,08, run and save RED output.
- [ ] Add local holdingsMarket and separate holdings report currency (all CNY, market original); derive holdings identity assetCategory/markets override. Keep global report currency untouched. Wire current portfolio, worker identity/input, summary/history/allocation/table consistently. Reuse real FX prop including usable partial rates only if domain safely supports them; inspect missing-FX result semantics and report any gap.
- [ ] Insert ScopeChoiceGroup market tabs below header with helper stating holding-only scope; preserve period and refresh. Label cash account scope.
- [ ] Run targeted tests including existing dashboard/allocation/history and typecheck, save GREEN. No git commit (mixed existing work).
- [ ] Report exact changes, commands, gaps and file hashes to evidence/ha06/implementation.md. Browser/visual remains NOT VERIFIED until root.

## Task 2 — root acceptance + independent review
- [ ] Review actual code and money handling; run relevant suites and build once.
- [ ] Record protected/isolated DB snapshots, restart own3031 service with explicit isolated DB only.
- [ ] Actual browser initial→A→HK→US→all with four linked panels; selected period preservation, lower historical metrics stable, mouse/keyboard/refresh state.
- [ ] Capture comparable screenshots and dimensions at required viewports; independent reviewer directly inspects screenshots versus textual contract/reference.
- [ ] Update issue, coverage, README, FINAL-ACCEPTANCE together. Keep prior FAIL/NV history; do not claim all complete with required gaps. No new write-flow required; this slice only changes viewing state, existing background refresh stays isolated.

## Implementation scope clarification

Keep global `RoomMoneyView.converted*` strict: partial subtotals never become complete totals or return denominators. Introduce holdings-only per-member subtotal with available/total/memberKeys and reuse existing FX trust rules.

- ha06_subtotal_helper (gpt-5.6-luna) exclusively owns new `app/lib/reviews/holdings-money-subtotal.ts` and its test.
- ha06_holdings_markets (gpt-5.6-luna) owns dashboard, portfolio/history domain integration, summary/history/allocation consumers and their tests; do not edit the helper pair.
- root owns integrated UX/data acceptance and documentation; ha06_independent_review reviews source and rendered evidence read-only.

Required counterexamples: native CNY plus missing foreign FX; complete FX with a foreign known holding and another missing quote; no native CNY but convertible foreign subtotal; unknown currency stays in denominator; identical known members across modules; incomplete return stays unavailable; overall holdings ignores the closed-performance market filter.

## 验收发现后的范围补充（2026-10-09）
- HA06-01/07：真实键盘测试发现 ScopeChoiceGroup tabs 未实现方向键；由主worker补 tabs mode roving focus、ArrowLeft/Right/Home/End，radio/segmented不改。共享组件键盘测试与实际市场切换分别验证。
- HA06-07：390px 同排提示挤压总体标签。窄屏提示换行，tab组不收缩；保留44px点击高度。失败画面 integration-overall-390.png 保留，最终图另存。
- root 仍负责整页视觉；main worker负责上述共享组件及样式；独立reviewer最终对比。
- HA06-07：320px 双列 KPI 会拆分完整金额（after-320.png，修复前证据）。root授权 ≤360px 持仓KPI单列，390px仍双列；不隐藏、不省略、不缩短金额。实现归属公共持仓summary CSS，按同样数据和视口复验。
