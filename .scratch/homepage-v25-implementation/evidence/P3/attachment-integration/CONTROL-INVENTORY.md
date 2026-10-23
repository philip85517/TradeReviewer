# P3 attachment integration — frozen local control register

This is the worker's affected-control register required by `docs/agents/frontend-control-audit.md` after control/state/data wiring. It is an input to root's independent audit, not whole-page acceptance. Scope authority: `ROOT-DISPATCH.md`; root owns whole-page visual consistency, the full persistence flow and real browser acceptance. **P3 formal 0/3; P1 formal 2/3 FAIL.**

## Frozen conditions and reference

Version: detached shared worktree `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`, git HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`; dirty product/test content is bound by `FINAL-MANIFEST.json` (generated 2026-10-22T22:42:59Z). Seven product files and four independent new tests are owned here; sixteen protected baseline files remain byte-identical. No worker commit.

Source contract: approved V2.5 `source/visual-design.candidate.md` lines 130–190, 255–346, 454–502; `source/component-manual.html` lines 456–510 and token chapter under `docs/design-system/baselines/2026-10-22-homepage-v2.5/`. Read original SVGs `filter`, `multi-applied`, `multi-applied--reopen`, `clear-attachments`, `clear-attachments--after-clear`, `reset`, `reset--reset`, `search-detail`, `holding-return`. Four directly inspected render derivatives are preserved in `reference-readback/`. Requirements map remains root's `DESIGN-COVERAGE.md`: HV25-11/12/13 and HOME-HP03-B044, with HV25-10/23–30/44–49 shared qualification/return dependencies.

Geometry to compare in a real browser: popover width 320 CSS px, field height 36, reset on its own second action row, bottom padding 16; applied badge and removable tokens; unchanged major hierarchy and table slots. The local anchor and <=600 CSS px fixed popover positioning require comparison on both sides of that breakpoint. Worker measured no browser rects, viewport, DPR, zoom, screenshot dimensions, scroll offsets or before/during/after frames. All rendered geometry, clipping, motion, focus reachability and long-text visual gates remain **NOT VERIFIED**.

Worker environment: Node 26.0.0, Vitest 4.1.10, jsdom/Testing Library and fake-indexeddb/local storage fixtures. No service started/stopped, no browser accessed, no real DB read/write, no network/service request. No worker preview URL or isolated database claim. Root's existing 3333 service and isolated database are root-owned and must be recorded by root at acceptance.

Finite qualification fixture: account A/B × concrete instruments HKEX:X (stock), HKEX:Y (ETF), live/null-run => AX, AY, BX, BY. Fresh completion summaries identify AY/BX completed; pending=true selects AX/BY and pending=false selects AY/BX. Different tests intentionally use one account with stock/ETF, unknown category/coverage, missing quote and missing account. Repeated row/detail/ordinary controls below are keyed by this full business identity, never only account or instrument. Post-filter row counts vary; no assertion of every possible production dataset.

## Attachment controls (complete local source register)

All rows are bound to the final manifest. Stable audit IDs are listed here even where the DOM uses accessible labels instead of an `id`. The local actionable/disabled source inventory contains **17 conditional instances**: one trigger, six checkboxes, three actions, six possible tokens, one error retry. The badge is noninteractive; dismissal/focus gestures are separately registered. These instances do not all coexist. This is not the whole-page denominator.

| Audit ID / instances | Source or accessible locator | Prerequisite/action | Expected state and feedback | Reference / owner | Evidence and boundary |
| --- | --- | --- | --- | --- | --- |
| ATT-TRIGGER / 1 | `home-surface.tsx:281`, button `附加筛选[，N 个已生效条件]` | Ready + attachment actions; open/close | Opens controlled D; badge counts C; unavailable before ready | filter/reopen; worker wiring, root acceptance | new Surface 2 tests; real mouse/keyboard/geometry NV |
| ATT-CATEGORY-stock / 1 | `attachment-filter.tsx:70`, checkbox 股票 | Open, not pending; toggle | Edits D only; category OR | filter/multi-applied; same owners | Surface stock/ETF competition and Workspace stock+ETF; no real input claim |
| ATT-CATEGORY-etf / 1 | line 71, checkbox ETF | Same | Edits D only; category OR | same | Same bounded evidence |
| ATT-CATEGORY-fund / 1 | line 72, checkbox 基金 + explanation | Open; observe disabled | No invented trusted classification; retained unsupported draft remains visible | approved metadata limitation | existing popover test; actual visual NV |
| ATT-OPEN / 1 | line 78, 仅看未平仓持仓 | Open, not pending; toggle | D only; nonzero canonical quantity qualifies even without quote/P&L | body overrides old unrealized label | new model and Surface tests; browser NV |
| ATT-PENDING-true / 1 | line 82, 待复盘：是 | Open, not pending; toggle | Single boolean requires owned strict summaries; helper uses existing reviewState pending default before coverage (boundary below) | filter; same owners | new Workspace required-failure/retry/return and cancel tests |
| ATT-PENDING-false / 1 | line 83, 待复盘：否 | Same | false requires complete owned episode coverage; none/both unrestricted | same | new model + all four Workspace tests |
| ATT-APPLY / 1 | line 88, 应用 / form Enter | D edited; apply | Pending keeps old C/rows/tokens; success commits atomically and resets holdings page; failure keeps C+D and editor | multi-applied / reopen | Surface + host + Workspace; 15s deadline existing bounded tests; real timing NV |
| ATT-CLEAR / 1 | line 89, 清除附加条件 | Open, not pending | Clears only D attachments, preserves scope/date, no read until apply | clear/after-clear | Surface + existing popover/S tests; browser NV |
| ATT-RESET / 1 | line 90, 恢复全部默认 | Open, not pending | S defaults in D, date retained, no read until apply; second action row | reset/reset--reset | Surface + existing popover/S tests; second-row geometry NV |
| ATT-TOKEN-category-{stock,etf,fund} / 3 | `home-surface.tsx:286`, 移除…条件 | Corresponding C category present; remove | New owned apply from C minus only this condition; old rows until success | multi-applied | stock removal Surface test; ETF/fund runtime removal NV |
| ATT-TOKEN-open / 1 | same, 移除仅看未平仓持仓条件 | C.openOnly | Same owned transaction; no extra category loss | same | source-register only; real/individual removal NV |
| ATT-TOKEN-pending-{true,false} / 2 | same, 移除待复盘：是/否条件 | Value in C.pendingReview | Same transaction; updated predicate decides strict read | same | source-register only; individual removal NV |
| ATT-ERROR-RETRY / 1 | `home-surface.tsx:289`, inline error 重试 | Failed read | Existing host reload; old committed scope until accepted | error state contract | host/Workspace retry via Apply verified; this specific error retry click NV |

ATT-DISMISS-Escape, ATT-DISMISS-outside and ATT-DISMISS-trigger are distinct gestures. Escape/outside preserve D and cancel pending apply ownership before closing; the trigger ref regains focus. Existing popover tests cover synthetic Tab/Shift+Tab trapping, Enter submission and outside/Escape; new Surface tests cover Escape/reopen and outside pending cancellation; Workspace covers late canceled summary rejection. These are component synthesis only. Tab/Shift+Tab/Enter/Escape in a real browser, simulated touch and physical touch are all **NOT VERIFIED**.

## Affected adjacent controls and repeated-instance rules

These are explicit dependency controls for root's whole-page inventory, not excluded acceptance gates. The worker's finite fixture exposes the counts below; root must freeze its actual browser rows/options/page count before deriving a full denominator. No invented click-through percentage is reported.

| Audit ID / finite fixture rule | Source/locator | State chain / minimum root acceptance | Worker evidence / remaining gate |
| --- | --- | --- | --- |
| SCOPE-MARKET-{all,a,hk,us} / 4 | Surface market group | Identity switch drops old D; selected C changes only with owned success | new host identity and Surface HK switch; other live clicks NV |
| SCOPE-ACCOUNT-trigger / 1; SCOPE-ACCOUNT-{*,A,B} / 3 | account listbox | Real selected scope, missing fresh account fallback, no old-account qualification before fallback | host final fallback keeps complete sources; root real controls NV |
| SCOPE-ACCOUNT-error-retry / 1 and empty-import / 1 conditional | account menu error/empty controls | Retain error and meaningful recovery, no business DB switch | unchanged source; browser NV |
| HOLDINGS-query-open/input/clear / 3 | 搜索持仓, search input, 清除持仓搜索 | Filtered selection remains source; apply page reset and return query restore | existing Surface/session bounded tests; real chain NV |
| HOLDINGS-CSV / 1 | 导出持仓 CSV | Export all selected rows, exact composite groups | new model CSV AX/BY check + old Surface export; actual download NV |
| HOLDINGS-sort-{name,value,pnl} / 3 | column-header buttons | Money sort stays disabled for unavailable evidence; selected rows remain same group set | bounded original Surface tests; real visual/value semantics NV |
| HOLDINGS-row-{AX,AY,BX,BY}-identity / 4 and -detail / 4 | row identity focus / 查看持仓详情 | Exact account+instrument identity; filtered-out rows absent | new Workspace opens AX exact detail; other real instances NV |
| HOLDINGS-row-{AX,AY,BX,BY}-value-{quantity,cost,quote,value,pnl} / 20 | `Value` role button, complete-value label | Tooltip/preview/pin retains exact selected value and unavailable reasons | original Surface finite evidence only; every real repeated instance NV |
| HOLDINGS-page-{previous,next} / 2 conditional | 上一页持仓 / 下一页持仓 | Successful apply resets page1; otherwise existing pagination source restoration | S/Surface bounded tests; multipage real rows NV |
| HOLDINGS-empty-{all-markets,import} / 2 conditional | 查看全部市场 / 导入交易 | Correct empty recovery within actual scope | unchanged source; browser NV |
| HOLDINGS-library / 1 | 进入交易库 | Same accepted attachments and fresh collection bundle, no automatic episode | old Workspace scoped collection tests; root real entry NV |
| DETAIL-{close,trades,return,repair} / 4 per active detail | detail dialog buttons | Exact AX→查看交易→HKEX:X ordinary; return restores source; missing exchange disables trades | new Workspace exact AX path + old bounded metadata/navigation; browser NV |
| DETAIL-value-{quantity,cost,value,pnl,quote} / 5 per active detail | active dialog `Value` controls | Same financial evidence as selected row | unchanged values; rendered independent financial acceptance NV |
| ORDINARY-expand-{X,Y} / 2 conditional | 展开证券…交易回合 | Exact X has AX only under pending=true; no Y, no BX leakage | new Workspace AX and cold BX cases; real browser NV |
| ORDINARY-episode-{AX,AY,BX,BY} / 4 conditional | explicit episode button by episode ID | User explicitly opens exact eligible episode; no auto-first | new Workspace AX explicit open + true Recall parser load; actual save NV |
| RETURN-collection / 1; RETURN-home / 1 | 返回交易库 / 返回首页 | Guarded detail/replay draft handling, fresh summary+bootstrap on return | new Workspace return + old CAS/nav-save tests; real persistence NV |
| ORDINARY-error-{retry,home} / 2 conditional | 重新读取目标交易集合 / 返回首页选择范围 | Source-backed retry revalidates schema/scope and current catalog | bounded old cold failure/recovery tests; real browser NV |
| RELOAD / browser journey | Native browser reload, not a DOM-control instance | Fresh read preserves valid source C/UI; global/unrelated source never inherits attachments | new host+Workspace remount with source bytes; true reload NV |

Existing search controls are root's already recorded search inventory, retained byte-identical except shared Surface/host wiring; original catalog/search/recovery/metadata/CAS tests remain in bounded regressions. Source controls in library/replay internals beyond explicit entry/return are not worker-owned, and their full inventory/financial acceptance remains root-owned. Period/history/contribution four-zone consumers are not implemented by this slice and remain **FAIL / NOT VERIFIED**, not N/A. Currency dropdown, near-three-month preset and profit-loss calendar are out-of-V2.5 interaction migrations per root, not replacement requirements.

## Eight-state and input evidence

| State | Applicable contract / observed bounded evidence | Component result | Real browser / visual |
| --- | --- | --- | --- |
| normal | real Surface trigger, 4-row Workspace initial fixture, no pending predicate => no strict summary read | PASS, new Surface/Workspace | NOT VERIFIED |
| selected | stock/ETF OR, cross-dimension AND; AX/BY versus AY/BX exact groups; committed badge/tokens | PASS, new model/Surface/Workspace | NOT VERIFIED |
| expanded | draft editor open/reopen; holding detail then exact ordinary expand and explicit episode | PASS for named fixture path | NOT VERIFIED |
| empty | unknown category/open/pending not falsely qualifying; no absent group widening; original empty Surface tests | PASS for bounded model/original fixture assertions | NOT VERIFIED; empty same-state geometry pending |
| loading | old rows/C/tokens during deferred read; conditional strict summaries and cancel ownership | PASS, new Surface/Workspace | NOT VERIFIED; frames/rects pending |
| error | required summary 503 rejects bundle, old rows+D remain, retry succeeds; late canceled bundle ignored | PASS, new Workspace | NOT VERIFIED; real failure/cancel pending |
| ambiguous | missing exchange blocks exact navigation; incomplete coverage never means pending=false; category not guessed. A raw no-record/incomplete-summary helper input can still mean pending=true via reviewState default; no blanket unknown claim | PASS only for named bounded assertions; raw-helper boundary explicitly retained | NOT VERIFIED; real identity/long candidate rendering pending |
| longtext | labels/tokens/reasons may wrap; approved density/reachability must remain | NOT VERIFIED, no dedicated long-text execution | NOT VERIFIED |

Real mouse: **0 executed**; real keyboard: **0**; emulated touch: **0**; physical touch: **0**. All 17 local control instances remain real-input **NOT VERIFIED** (0 PASS / 0 FAIL / 17 NV); real click attempt coverage 0/17, click-result coverage 0/17; real-result pass rate N/A because no executed real-result denominator. Dismissal gestures and downstream controls are separately NV and are not hidden by this local count. Component test pass counts are in `HANDOFF.md` and are not converted into real click coverage. No whole-page 100% claim.

## Open acceptance findings

| Finding | Status / owner | Required evidence |
| --- | --- | --- |
| Local attachment feature behavior has bounded synthetic/model proof only | NOT VERIFIED / root | Real filter→pending/failure→apply, clear versus reset, dismiss/reopen, identity, token actions |
| Geometry, visual fidelity, narrow reachability and motion | NOT VERIFIED / root independent reviewer | Same-state original reference comparisons; rects before/during/after; <=600 breakpoint both sides; long text |
| Exact ordinary/explicit episode/guarded fresh return/reload | NOT VERIFIED / root | Same isolated dataset real browser; source storage, URL, request/response and restored state |
| Recall business save→return→reload | NOT VERIFIED / root (P1 still FAIL) | Actual isolated DB persistence; fixtures/Recall parser do not prove save |
| Four-zone period/history/contribution/financial same-source consumers | FAIL / NOT VERIFIED / root + later P2/P4 consumers | Consume frozen qualification output; original financial and period/history gates |

No local component PASS changes formal P3/P1 acceptance or erases preserved original Workspace #10/#11 failure semantics.

Evidence boundary requested by root: `pendingFact` calls `reviewState(item)` before checking `episodeCoverage`. `reviewState` returns pending for missing review and missing Recall records. Thus the pure helper does **not** promise unknown for incomplete-summary/no-record input, even though `homepageAttachmentEpisodeCoverage` records incomplete coverage. For production single-boolean predicates, `readHomepageBundle` must first succeed at its owned strict summary read; absent rows in that successful authoritative response are interpreted by the existing review business semantics as not yet reviewed. Required-read failure never supplies a new accepted bundle. None/both predicate paths explicitly mark incomplete summary coverage but do not restrict eligibility by this pending fact. Future consumers must retain this call-chain precondition or independently define stronger fact evidence; it is not established by a helper-level complete flag alone. Root is reviewing this boundary; no product change was made in response.
