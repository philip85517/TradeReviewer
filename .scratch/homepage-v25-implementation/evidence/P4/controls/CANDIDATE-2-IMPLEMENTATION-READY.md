# History leaf candidate 2 — Implementation-ready / frozen

2026-10-23. Original owner /root/responsive_shell, gpt-6.1-sol / ultra. Root independent acceptance is still required. Leaf formal round1/3 FAIL, P4 formal0/3 and P1 formal2/3 FAIL are preserved; this is the single authorized second candidate, not a round reset or page/data release.

## Change and cause

The original selected caller label could be three lines in a fixed36px trigger, producing the root-observed y112–172 text against y124–160 controls at390. Candidate2 derives the closed label from appliedRange (year / 今年 / from–to / 全部). The selected caller label remains complete in aria-label, title and the expanded option. Closed triggers use nowrap; expanded options still use white-space normal, overflow-wrap anywhere and automatic height. No ellipsis or clipping was added.

Product diff is deliberately limited to label/fullLabel separation, the title attribute and closed whitespace rules. Width282, height36, type14, both triggers, arrow/divider, pending/error/commit ownership, menu content/height and metric behavior are unchanged. No new year list, current-year inference, editor or data source. See candidate2-product.patch; full three-file diff candidate2.patch. Candidate1 exact bytes, manifest, RED/GREEN and root FAIL are preserved.

## Version and checks

| Frozen product/test file | SHA256 |
|---|---|
| `app/components/homepage-v25/history-controls.tsx` | `a2090b6c52b85665431b0ad63517cdd8aa6112588f7705410f0b8709a355e3cd` |
| `app/components/homepage-v25/history-controls.css` | `fb0bde9b33c436885f4bc1a8632fbc18d86050f14733e5696b1f1e4c42aef7ae` |
| `app/components/homepage-v25/history-controls.test.tsx` | `e6e58ed6a550d9d077444ee112c9b3910cf2885fd0658024755a712b80442e14` |

Protected home-surface.css SHA256 remains `28af46a70f2583e63e3296a2532da4a6f5f74d0fbb5b0a861ab6a86563e65b4d` before and after. Read its actual button/hover/active/margin rules: leaf button selectors retain greater specificity than global button rules; closed nowrap agrees with the global rule, while expanded leaf options explicitly preserve normal wrapping/height auto. This is static cascade inspection, not rendered geometry evidence.

- RED: 7 expected assertion failures /31PASS in38, exit1, candidate2-RED.log. Four modes, label-refresh, long pending/error journey and numeric-label contract expose direct caller-label rendering. No import error.
- GREEN:38/38PASS,5.62s, exit0, candidate2-GREEN.log. All four modes retain full accessible/title/menu descriptions; actual caller years2038/2036 are used. Long descriptions preserve old labels through request/pending/error, block repeated pending submission, permit retry and update only after caller commit. Tab/Esc and adjacent metric remain covered, including independent pending metric callbacks.
- Targeted tsc and ESLint exit0; candidate2-typecheck.log / candidate2-lint.log have no diagnostics.
- PostCSS syntax parse PASS:20 rules,98 declarations; candidate2-css-parse.json. No CSS mirror test or browser measurement was introduced.
- Vitest runtime emits only Node DEP0205 module.register deprecation warning; see full log. Exact commands and log hashes are in candidate2-manifest.json.

## Version-bound coverage / exclusions

Original inventory remains10 fixture controls (2 triggers +4 caller range options +4 metrics; actual range denominator is N),16 state rows with14 applicable and2 scope-based N/A. New tests cover all four descriptive closed labels, accessible/title/expanded retention, external description refresh and long-label pending/error/keyboard/metric recovery. Existing hover/focus/pressed/disabled/loading/empty/error implementation and targeted behavior checks remain; static CSS is not visual PASS.

Candidate2 component checks PASS only. Current candidate actual mouse/native keyboard/390 geometry/1280/1440 visual comparison with original references and actual home CSS: NOT VERIFIED; root must independently run. Candidate1 finite browser PASS scenarios are prior-version evidence and its long-label FAIL is retained. No actual browser coverage is claimed for candidate2. Physical/emulated touch, production history/chart units, history/contribution atomic refresh, current mode preservation, integration, persistence, return and reload: NOT VERIFIED outside this leaf. DB write gate N/A for the leaf because it has no DB or persistence API.

No service/browser/DB/performance/full suite/subagents/integration/commit/push executed. Only the original three files and this dedicated evidence directory were written. Files are frozen for root browser acceptance; no further edits will be made without a new release.
