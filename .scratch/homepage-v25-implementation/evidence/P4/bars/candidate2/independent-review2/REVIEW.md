# ContributionBars candidate2 — independent scoped spec / quality review

Reviewer `/root/series_bundle_review`, actual `gpt-6.1-sol / ultra`, did not implement these products. This is a read-only review of the frozen controlled leaf, triggered by root's candidate2 spec/quality and interaction/layout review request. It is not a P4, performance, integrated financial, whole-page, visual or formal-round acceptance.

Worktree `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`. Beginning source check: `2026-10-22T23:43:02.445472+00:00`. The final check, exact inputs, output digest and unchanged beginning/end hashes are in `SOURCE-SHA256.json`. Freeze marker `../IMPLEMENTATION-READY.md` is sufficient together with `../PRODUCT-SHA256SUMS`; no alternate manifest filename is required.

## Findings

**Critical: 0. Important: 0. Minor: 1.** This is a scoped finding count, not an acceptance verdict. No new lifecycle/financial consumer defect was established, so no independent test or counterexample was added or executed. Root's independent 28+1 rerun is separate; this reviewer did not repeat it.

### CB-M04 — Minor: retained-data update uses loading/neutral color

Source: `app/components/homepage-v25/contribution-bars.tsx:168`, `contribution-bars.css:86`. When `readState.kind === "pending"` with a non-null retained committed rows list, the leaf renders its own `hp-contribution-bars__status--pending` status reason. Its only matching local status color is the generic `#a7b3c4`. There is no retained-data update color override; only error receives an override at CSS:87.

The original approved `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:469` explicitly makes these state semantics global. Line 471 distinguishes “加载为灰蓝，更新为蓝…失败为红”; line 476 defines the relevant state as “已有数据、后台更新” retaining the last complete valid data. This applies to the leaf's displayed update status. It does **not** require all `pending` states to be blue: first load with `rows === null` can remain gray-blue. The quoted passage does not fix a particular blue hex, so this review does not invent one.

Actual reproduction supplied by root, independently read here, at this repository path:

`.scratch/homepage-v25-implementation/evidence/continue-2026-10-23/bars-candidate2-pending-390.txt`

Root selected “更新保留旧值” in browser tab 13 at `http://127.0.0.1:3334/bars.html`; the retained-data reason reads “更新中，继续显示已提交贡献”. The raw browser observation records viewport `390×844` and computed status color `rgb(167, 179, 196)`. Zoom/DPR are not recorded in that raw observation. This exactly matches the local generic CSS. Root also separately reported actual error color `rgb(255, 133, 146)`; that report supports the distinction but is not a substitute for a full visual comparison.

Impact: initial loading and retained-data updating lose the approved color distinction. The explicit reason remains readable, and this finding does not establish financial, request, retention or navigation failure. It is an existing omission newly identified during candidate2 review, not a claim that candidate2 introduced it. Browser operation belongs to root; this reviewer did not operate the browser or directly inspect the pending screenshot. The source/spec mismatch plus root's raw computed-style observation establish this bounded Minor. No repair was performed.

## Review of the three requested corrections

| Item | Independent source/spec judgment | Evidence limit |
| --- | --- | --- |
| CB-M01 permanent invalidation | TSX:91–93 now clears selection when rows identity, fullTotal identity, mode or report currency mismatches. The render update is conditional and terminates after selection becomes null. Returning old refs cannot reconstruct that selection. Immutable rows/source replacements therefore invalidate permanently; mode and total readouts use the same guard. | No new test run here. Worker logs 28/28 and unchanged independent 1/1 exit0 were read and remain worker execution evidence. |
| CB-M01 focus lifetime | TSX:116–119 restores a connected opener on the close transition and clears that opener. Returning to the old context leaves `active/open` null and does not cause the old focus effect to fire again. A fresh activation saves a new opener. Normal Esc, outside, close, resize/scroll cleanup and exact activation object paths remain unchanged. | Actual focus/Tab/scroll and disappearing-opener fallback in the integrated host remain NOT VERIFIED here. There is no public generation ID: generation/source coverage depends on the approved immutable rows/fullTotal reference contract. In-place mutation or an unannounced generation reusing all refs cannot be detected by this API and is outside that contract. |
| CB-M02 failure color | CSS:87 has three class selectors, outranking the two-class generic status rule at :86, and uses approved `#FF8592`. TSX:168 emits both required classes for error. No duplicate retry or data reset was added. | Root reported actual error rgb(255,133,146); reviewer source conclusion is bounded to this local cascade. This does not accept other states; CB-M04 remains. |
| CB-M03 desktop continuous zero | CSS:12–22 creates a single nonempty-list decorative axis, full list height, pointer-events none; :50 hides old row fragments. If list width is W and reserved detail width D, action width A=W−D. Its grid is 24/52/24 with no gaps, so track center is 0.24A+0.5×0.52A=0.5A, exactly the new `(W−D)/2` line. Coarse pointer sets both D and the row detail column to 44px; default both are 36px. | This is a CSS geometry derivation, not a real layout measurement. Actual continuous paint, subpixel placement, row reasons and inherited host CSS remain NOT VERIFIED here. |
| CB-M03 ≤735px fallback | CSS:124–145 hides the list line and explicitly restores each second-line track's 50% zero. Track spans both action columns, while identity/value use the first row. The 56px narrow action minimum, row padding and coarse target sizing remain. The approved local two-line exception is preserved. | Container widths 735/736/737, 390px long content, wide/coarse pointer and actual visual drift require root's measured rendered comparisons. |

The generation regressions added at test:192–211 cover currency, immutable rows, changed source identity via new rows, changed fullTotal, current/history, and total readout currency. They assert close, one trigger return, outside focus on restoration, and fresh activation. The tests use the real component with supplied immutable literals. Reading them is not an independent execution result. This reviewer independently compared the before snapshots: TSX contains only the two-line invalidation addition; CSS contains the declared axis/error corrections; all original 22 test bodies remain the unchanged suite prefix, with six appended cases.

## Preserved data and rendering boundary

Current actual `HomepageV25Metric`/money types at `app/lib/reviews/homepage-v25-performance.ts:36–42` remain the source of the readonly metric wrapper (TSX:9–13). The correction changes no public type, source input, qualification or currency conversion. TSX:39–48 checks presentation consistency; mismatches suppress the primary amount and retain truthful original value/currency in facts (:66–80). Current fields remain prepared realized/unrealized/net; history consumes only supplied closedResult (:94–97,112–113). The original exact identity is passed at :178. Full total comes directly from `fullTotal` (:109,200–203), never from summing visible rows. Signed sums at :98–108 and :172–189 only map supplied amounts to a common visual scale. Equal 14px outer heights/inset hollow, sign colors and absence of minimum monetary width remain unchanged in CSS:49–59. No IO, business cache or call into A/B/F was introduced.

This does not revalidate the upstream financial data. A remains frozen after three candidates, including its separate future-currency FX defect; P2/P4 financial connection remains blocked. B/A/F source fingerprints are retained only to bind the reviewed type/data boundary, not to accept those modules.

## Controls, references and required NOT VERIFIED

Original HP05 text :395–431 and global :467–549 were read; original IconButton/DataTable/ChartTooltip manual sections were read. Reference current-a-share, mixed-sign and error images were directly viewed from the preserved faithful PNG copies in the bars directory. They establish reference continuous zero, signed solid/hollow treatment and failure distinction; they are not current product screenshots.

Scope is the candidate2 bar/list and its detail/action/status lifetime only; root owns the full page, host navigation, financial flow and persistence. Header, mode selector, drill breadcrumb, filters, sort, page control and transaction-detail container remain excluded from this implementation leaf, with no acceptance implied. Current project AGENTS and the five docs/agents workflow references remain applicable. Parent explicitly prohibits product changes, services/browser/DB/network/performance/full suite, old evidence edits and new agents.

| Registry / journey | Reviewer evidence and status | Required owner / limit |
| --- | --- | --- |
| CB01–04 exact market/instrument actions, native keys | Source reviewed, no changed callback; actual execution NOT VERIFIED here | Root's version-bound real mouse/keyboard matrix; dynamic instances separately |
| CB05 detail close/return, CB15 immutable replacement | Source correction consistent; execution NOT VERIFIED here | Root's independent 28+1 and actual context/focus journeys; removed source must follow host heading fallback |
| CB06–09 signed/current/history/zero/unknown/currency | Unchanged rendering path reviewed; actual paint/readout comparison NOT VERIFIED here | Root actual current/history, sign combinations, no fake zero or relabeled money |
| CB10–13 pending/initial/error/empty | CB-M04 confirmed with root raw style observation; error local cascade corrected; other visual states NOT VERIFIED here | Root retained/first-load/first-error/empty comparisons and no invented values/axis |
| CB14 long content/provenance, CB-M03 responsive axis | Static sizing/scale derivation only; actual visual NOT VERIFIED | Root original-versus-rendered wide1440/1280, narrow390,735/736/737; 14px rects, zero continuity, source scroll end, overflow, focus ring |
| Mouse / keyboard / emulated touch / physical touch | Reviewer real-browser numerator **0**; no all-controls percentage | Keep independent input methods distinct; worker/browser/test counts do not transfer |
| Leaf IO / DB writes | NOT APPLICABLE: this readonly leaf performs none | Real host data connection, return/reload/persistence remain NOT VERIFIED; no financial acceptance |

No service was started and no preview was claimed. Known scoped failures and required NV remain visible. Formal leaf round ruling and P4 status belong only to root; this report does not increment/reset/sign either. After writing this report and its manifest, reviewer evidence is frozen and no further writes are authorized without a new dispatch.
