# Candidate2 finite control/state coverage — root acceptance pending

Trigger: the dispatched repair affects metric readout layout and transient detail/focus state. Version: the three frozen candidate2 hashes in SOURCE-SHA256.json; HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. Original dispatch M01–M18 and the original DESIGN-COVERAGE mapping remain binding. This document records worker evidence only; it does not overwrite candidate1's FAIL, root formal1/3 or original independent review.

Scope: four readonly metric cards and their detail portal, close control, responsive layout, affordance and invalidation on currency/generation/source changes. Excluded implementation: host, producers, chart/replay, navigation, financial calculations and IO. Those exclusions do not waive the root's complete page/data/persistence/visual gates. Owner of bounded implementation: `/root/metrics_candidate2`; root owns whole-page visual consistency, complete data/persistence flow and independent acceptance.

## Reference and journey mapping

Reference root: `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`. Exact read ranges, original images, directly viewed copies and hashes are recorded in REFERENCE-READS.md and SOURCE-SHA256.json.

| Requirement and element | Exact reference | Journey / evidence owner |
| --- | --- | --- |
| HV25-14/15/16; HOME-HP02-B001 text block, no separate card element IDs | visual-design.candidate.md:191–221; home-1440.svg, home-1280.svg, atom-metric.svg | Four metrics and detail values M01–04/M12/M13; worker literal-B consumer evidence, root actual source truth |
| Same Metric component; global sizing | visual-design.candidate.md:42–75; component-manual.html:611–698; same three SVGs | Layout, typography, focus, hover M14–17; root direct matching-state comparison |
| Metric loading/empty/error states | visual-design.candidate.md:467–549; component-manual.html:611–698; loading--stale-data.svg, error--update-failure.svg | Stable old bundle, unavailable and reason readouts M07–10; worker synthetic, root actual host flow |
| Four semantic detail triggers and shared portal close | component-manual.html:611–698; atom-metric.svg | Enter/Space, Esc/outside/exact opener and version invalidation M05/M06/M18; root actual input |

## Dynamic instance inventory

Keys: `net`, `periodRealized`, `unrealizedChange`, `currentMarketValue`, in that visual/tab order. Each is one full-card semantic button and one heading/value. One mutually exclusive transient portal contains one close button; switching cards changes the active key. Selection identity is key + generation + source ID + report currency. An invalidated selection must remain closed when an earlier identity returns, until the user activates a trigger again.

Original eight-state manual: six applicable states × four keys = **24 base instances**. Pressed is NOT APPLICABLE because the readonly Metric has no persistent pressed state; transient expansion is exposed with aria-expanded. Disabled is NOT APPLICABLE because unavailable/error information remains readable and explains its reason rather than disabling the card. These are original scope reasons, not skipped checks.

All 24 real-browser cells below are **NOT VERIFIED for candidate2**. No actual mouse, keyboard, emulated touch or physical touch was executed by this worker. Synthetic tests are kept separate and are not used as a UI coverage numerator.

| Key | Default | Hover | Focus | Loading | Empty | Error |
| --- | --- | --- | --- | --- | --- | --- |
| net | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| periodRealized | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| unrealizedChange | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| currentMarketValue | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |

Loading expands to first-load null/skeleton and old committed bundle/pending. Error expands to initial null and stale committed bundle with 查看原因. Missing/future/currency mismatch are explicit data variants; zero is a known amount. Every key still needs actual open → read → close, exact opener restoration, switch and viewport placement checks. The base inventory does not claim these dynamic journeys are covered merely because the corresponding control exists.

## Bounded requirement inventory and evidence

| ID | Finite journey / invariant | Worker candidate2 evidence | Root acceptance required |
| --- | --- | --- | --- |
| M01 | Period net value/detail; closed → open → close/switch | Original consumer assertions preserved; synthetic PASS | Actual pointer/default/detail and source truth |
| M02 | Period realized value/definition/detail | Original assertions preserved; synthetic PASS | Actual pointer/default/detail |
| M03 | Period unrealized change value/definition/detail | Original assertions preserved; synthetic PASS | Actual pointer/default/detail |
| M04 | Independent current market value and current unrealized detail | Original assertions preserved; synthetic PASS | Actual pointer/default/detail and current source |
| M05 | Four keys in tab order; Enter/Space; Esc/exact opener | Original tests synthetic PASS; candidate2 net invalidation test also exact opener | Real keyboard, focus visibility, clipping |
| M06 | Inside remains open; outside close/restoration; direct card switch | Original tests synthetic PASS | Real mouse and actual outside/portal geometry |
| M07 | Old bundle pending preserves amounts/context, no IO | Original tests synthetic PASS; source review | Host committed generation and pending feedback layout |
| M08 | First load null has four skeletons, no fake zero | Original tests synthetic PASS | Real loading layout |
| M09 | Empty/missing/future distinct; independent current | Original tests synthetic PASS | Real host contexts and unavailable layout |
| M10 | Initial/stale failure context, 查看原因 and true currency | Original tests synthetic PASS | Real error host journey and new header affordance layout |
| M11 | Positive/negative/zero/missing; neutral market value | Original tests synthetic PASS | Actual tones, 28/34 values, signs and retained units |
| M12 | Full precision, original currencies, FX provenance, coverage and mismatch evidence | Original tests synthetic PASS | Actual readable long detail/scroll and complete financial origin |
| M13 | Period changes do not substitute historical value for current | Original tests synthetic PASS | Atomic host bundle, actual period flow |
| M14 | Long Chinese/30-digit pressure amount; original ordinary/extreme values | Exact precision synthetic PASS; proposed affordance header separation | Real unit/sign/ellipsis/readability, reference fidelity; ordinary/extreme must remain untruncated |
| M15 | 1440/1280 four equal columns,88px,12px gap | CSS/source review only | Independent comparable viewport rendered/reference images |
| M16 | 996/995 and492/491 container sides;390 narrow | CSS/source review only | Actual no-overlap and dense header/pending layout; candidate1 FAIL preserved |
| M17 | Affordance-only120ms hover, reduced motion and2px focus | CSS/source review only | Actual motion/style/focus, no value movement/obscuring |
| M18 | Frozen input; generation/source/currency invalidates detail permanently until activation | Final23/23: original20 preserved + net three identity-return paths; unchanged independent literal currency1/1 worker rerun | Actual host identity transitions and focus, other keys, independent acceptance |

New finite lifecycle regressions each use the net trigger: open → change exactly one identity dimension → closed/exact opener → move focus to outside reader → restore prior identity → still closed/outside focus retained → explicit reopen/full original decimal → Escape/exact opener. Currency, generation and source each failed before the repair (RED3; original20 passed), then passed (GREEN23 and final23). The independently authored currency counterexample also passes in this worker rerun. Generation/source are new worker synthetic reproductions, not claims that the prior independent review proved them. The RED outside-focus check was not reached after the preceding resurrection assertion failed.

Original20 bodies are byte-preserved; exact counts, commands, exit codes and logs are in COMMANDS.md. No geometry mock, CSS-source test, HTTP result or fixture rerender is substituted for actual visual/input/persistence evidence.

## Findings and gate disposition

| Finding / gate | Preserved historical result | Candidate2 status |
| --- | --- | --- |
| Candidate1 M-01 / I-01: opaque bottom action overlapped retained 亿 at390 focus | FAIL; original root image and coordinates unchanged | Proposed header reservation/top placement; actual visual **NOT VERIFIED** |
| Candidate1 retained currency selection resurrected and stole reading focus | Independent FAIL; original literal test unchanged | Worker synthetic PASS with new currency/generation/source variants; root real/independent acceptance pending |
| Pending feedback moved below value with original12/16 typography | Previous placement depended on old bottom action | New placement source-inspected; actual baseline/readability/reference **NOT VERIFIED** |
| Scoped types / TSX-test lint | Historical evidence retained | PASS on frozen TSX/test; CSS lint not claimed |
| Mouse / real keyboard / emulated touch / physical touch | Distinct prior evidence stays prior-version evidence | Each **NOT VERIFIED** here |
| Financial truth / page return-reload/persistence / performance | Existing root blockers unchanged | **NOT VERIFIED/BLOCKED** at page scope |
| Leaf DB-write flow | No IO in controlled readonly leaf | **NOT APPLICABLE** to leaf only; page persistence remains required |
| Whole page/P2/P4 delivery and formal result | Same leaf formal1/3FAIL | **NOT VERIFIED/BLOCKED**; implementation-ready only |

Root must bind fresh actual evidence to these hashes, directly compare default/hover/focus/error/pending/long states at1440/1280/390 and boundary sides with the approved references, and independently judge all applicable journeys. No authorized design deviation is asserted. Product writes are frozen; no browser/service or shared acceptance/tracker edits occurred in this worker scope.
