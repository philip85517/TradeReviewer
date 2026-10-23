# ContributionBars candidate 1 — independent spec and quality review

Reviewer: `/root/series_bundle_review`, actual gpt-6.1-sol / ultra. Review date: 2026-10-23 CST. Scope: the three frozen new ContributionBars source files and their real readonly input types, original design and dispatch. Root retains independent acceptance and formal round accounting. **Critical 0 / Important 0 / Minor 2.** The two findings remain open. This report neither accepts the leaf nor advances P4, finance, performance, visual or whole-page gates.

The worker's `IMPLEMENTATION-READY.md` is the final freeze marker at `2026-10-23T07:26:03.972933+08:00`, HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. Actual product SHA values matched its `PRODUCT-SHA256SUMS`; root confirmed this equivalent manifest is sufficient. The worker's full evidence manifest is `SHA256SUMS`, rather than a file named SOURCE-SHA256.json. The independent beginning/end hashes are recorded in this directory's `SOURCE-SHA256.json` and must match for this review to apply.

| Frozen source | SHA-256 |
| --- | --- |
| `app/components/homepage-v25/contribution-bars.tsx` | `8e01b337f4d3774e6778683247e0ab3f56c0676485db33065216733d377b3fcc` |
| `app/components/homepage-v25/contribution-bars.css` | `67993922cb8f7def8b6693c2bda986ac2fa5edf4d537b850a67d0b44769935c2` |
| `app/components/homepage-v25/contribution-bars.test.tsx` | `2cc9f4b7efcc5423cbfc45cab051000aff065b4be83571c1f158c4d32fc8152b` |
| Actual A/F metric types, `app/lib/reviews/homepage-v25-performance.ts` | `094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a` |
| Actual B, `app/lib/reviews/homepage-v25-series.ts` | `30c96eb082ea82dcede6574583c07f53859caf57ff8134705b85a0d45a106ac6` |

## Findings

### M01 — Invalidated readout returns without activation and steals outside focus

Severity **Minor**; genuine controlled-consumer state/focus defect. Source: TSX:87–91 and 114–117. `active` masks a retained `selection` when rows/total/mode/currency change; it does not invalidate that selection. Returning to the old references/context makes `active` valid again, then the layout effect focuses the revived dialog. This violates the dispatched invalidation lifetime and stable focus contract. It is not evidence of stale monetary caching: the revived contents are read from the current props and retain the correct CNY label.

Independent reproduction uses one literal frozen row and supplied total, with no A/B call, financial calculation or IO:

1. Render current CNY with stable rows/total; activate the separate contribution readout. Dialog is focused.
2. Replace reportCurrency with USD while retaining source facts. This explicitly supported currency-mismatch state hides the dialog and returns focus to its trigger.
3. Focus a separate outside button.
4. Restore CNY with the original rows/total references, without activating any readout.
5. **Actual:** the dialog reappears and receives focus. **Expected:** it remains closed and outside focus stays put.

`context-restoration.test.tsx` executed once, with exact single-file `test.include`, native Node26, one worker and an independent `defineConfig` (no mergeConfig). **1 file / 1 test FAIL**, inner process exit1. Two soft assertions separately captured the unexpected dialog and its stolen focus; unlike a fail-fast test, neither observation is inferred from an unexecuted later assertion. Exact command, stdout/stderr and exit are retained unedited in `COUNTEREXAMPLE.log`. The Python logging wrapper itself returned0 after recording the child failure; the test result is exit1. Existing22 worker assertions were read, not rerun. They cover one-way invalidation, not restoration.

Impact is bounded to transient readout/focus state; there is no demonstrated wrong amount, wrong navigation identity, persistence write or financial contamination. This supports Minor rather than Important. Other round trips (rows/total/mode) follow the same source guard but were not separately executed; do not count them as additional verified cases. Root owns any revision authorization and reacceptance.

### M02 — Error status color is overridden by the generic status selector

Severity **Minor**; source-level visual state defect. CSS:75 sets `.hp-contribution-bars .hp-contribution-bars__status { color: #a7b3c4 }` with specificity `(0,2,0)`. CSS:76 attempts `.hp-contribution-bars__status--error { color: #f2b5bc }` with specificity `(0,1,0)`. TSX:166 places both classes on a status paragraph inside the section, so the generic gray-blue color wins despite the later error declaration.

Reproduction: supply `readState={{kind:"error", reason:"贡献读取失败"}}`, either with old committed rows or null initial rows. The error reason remains textually accessible, but the leaf's red failure style cannot apply under this stylesheet. Original global state requirements (`visual-design.candidate.md:471`) distinguish loading gray-blue and failure red. Expected: the failure color applies while keeping the supplied reason. Source cascade establishes the defect; actual browser computed color and screenshot are **NOT VERIFIED by this reviewer**. No second executable test or style audit was run. The preserved reason makes this a minor visual-state distinction rather than a loss of error information.

## Spec and quality assessment

Original sources read: `visual-design.candidate.md:395–431` (HP05 contribution), `467–549` (global state/request/motion/shared controls); original component manual composite/alignment, IconButton, DataTable and ChartTooltip sections. Original current/mixed-sign faithful renders and worker copies of loading, empty, error, missing valuation, extreme and historical reference images were directly viewed. The reference's legacy local retry is superseded by the explicit dispatch/global unique repair rule. The approved max735px local two-line strategy is recorded in worker evidence; it is not an independently accepted rendered result.

| Concern | Independent source assessment / practical limit |
| --- | --- |
| Financial authority and readonly boundary | TSX:3–7 imports only Decimal/React/ReactDOM/local CSS at runtime; HomepageV25Metric is type-only. Props use readonly current/history rows; no A/B/F calls, IO, amount/FX/revision cache, row filtering/sorting/page commit, net or total derivation. Extent/same-sign accumulation at96–106/170–187 places visual geometry only. No consumer repair of supplied net. |
| Exact identity | TSX:14–28 carries market or instrument account/instrument/market/nature/simulationRunId. TSX:176 passes `row.source.identity` directly to onActivate. Readout buttons are separate. No fixed security or generic navigation target was found. Actual market drill and existing detail integration remain host NV. |
| Signed geometry | Every row uses the same 50% axis and visible-row extent. Positive/negative paths use separate offsets, same-sign pieces are continuous in percentage coordinates, both-negative pieces extend left, and net0 does not suppress supplied nonzero pieces. No minimum monetary width. CSS:40–44 specifies equal14px outer height and inset hollow shadow, with exact required bar colors. These are source conclusions, not rendered rectangle/visual PASS. |
| Zero, unknown and currency | TSX:39–64 reads available/value/finite/currency consistently. Cent-rounded zero is neutral0.00 and omitted from shape; original strings remain in detail. Unknown is explicit不可计算 with reasons. A mismatched target currency is—, and raw source value/currency is separately shown. This is presentation consistency, not recomputation of financial eligibility. |
| Real types and full detail | Actual HomepageV25Metric value/available/coverage/reasons/money fields are reused readonly. TSX:66–80 preserves full literal value, originalByCurrency, coverage and FX source/asOf/id/status. A/F and B remained read-only. Only the single new readout counterexample was executed; broad correctness of every literal is not newly test-accepted. |
| Total and historical isolation | TSX:107/198–201 reads fullTotal directly and never derives a visible-page subtotal. Current rows supply realized/change/net separately; history rows supply closedResult only and produce no unrealized field/segment. Finance qualification and whether host total is truly full-scope are outside this leaf and remain NV. |
| Controlled pending/empty/error | TSX:165–201 renders supplied committed rows/total during pending or error and preserves reason; rowsnull+pending yields8neutral slots with no business amounts; initial error/empty render absence with supplied reason and reserved list area. No duplicated retry/repair or invented business rows. The meaning and currency of committed parent props remain host responsibility. Error color has M02. |
| Readout lifetime/keyboard | Native buttons, separate action/readout, scoped Escape, outside/close handler, exact connected opener and fixed264px/12px readout exist in source. M01 shows invalidation is incomplete. Removing an opener needs host fallback to contribution title; root host journey remains NV. Browser keyboard, event ordering and overlay clipping are not accepted from jsdom. |
| Visual integration | No competing title/panel/inset/toolbar/pagination was added. The source reserves344px desktop symbol area,210px market area,512px narrow symbol area; CSS focus rings are2px. Root must compare actual initial/empty/error and current/history geometry and state colors against original references. |

## Required NOT VERIFIED boundaries

- **Independent actual visual gate:** component/reference screenshot comparison at1440×1000,1280×800,390×844, container735/736/737px,100% zoom and recordedDPR. Equal visible14px height, inset tiny hollow stroke, honest positive/negative shape, no overflow/obscured unit, extreme values, narrow full identity/source access, initial8slots, empty/error alignment and final-page reserved space require real layout evidence. Source declarations and worker style parsing do not clear this gate.
- **Common-zero appearance:** all rows align zero to the same x in source, but each row renders its own short zero span (CSS:38–39/122). Reference SVGs contain a continuous vertical path. Root should directly compare continuity/visibility and actual alignment, including unequal row heights and narrow fallback; this reviewer has no component screenshot and does not promote the suspicion into a confirmed visual finding.
- **Actual control coverage:** CB01–CB15 real mouse, real keyboard, emulated touch and physical touch remain separate NV by this reviewer. The sole new jsdom counterexample is synthetic and does not increment a browser numerator. Wide/narrow pointer hit areas, touch, focus contrast, outside behavior and viewport edge/scroll clipping remain root checks.
- **Host navigation and request chain:** market row→market securities→existing instrument detail, closed-round meaning, all original identity/range/filter/sort/page/scroll/focus restoration, disappeared-row title fallback, latest-request wins, committed currency/title consistency, pagination first-row focus, retained-row pending/error behavior under real requests and return/reload/persistence remain NV. Host controls and IO were deliberately excluded, not waived.
- **Financial and performance gates:** future-HKD/valid-USD FX contamination in frozen A remains an Important blocker to P2/P4 financial hookup. A is frozen at its three-candidate limit; no fourth repair, cache, threshold change, alternate ledger or acceptance waiver follows from this review. A cold2617.548995ms>2000 performance failure is not remeasured or accepted. Full contribution scope qualification/reconciliation and finance precision/fees/source completeness cannot be proven by a prepared view fixture.

## Execution and freeze boundary

Only new files under `evidence/P4/bars/independent-review/` were authored by this reviewer. No product, worker evidence, existing test, A/B/F/ledger, host, configuration/dependency, shared tracker, service, DB, browser, network, performance, full suite, child agent or commit was changed/run. One new literal counterexample file and one exact-include test execution were used. No fix or retry occurred. The source manifest pins the candidate and actual type/design inputs and records unchanged beginning/end A/B/F/product hashes.

Critical0 and Important0 means no such newly demonstrated issue within this bounded review; it is not a read-only PASS or feature acceptance. M01/M02 and all applicable required NV remain visible for root's combined ruling. P4 formal0/3 is unchanged by this report; root alone records the leaf's actual independent acceptance round. **Review artifacts freeze when SOURCE-SHA256.json is written; reviewer stops all writes pending a new explicit task.**
