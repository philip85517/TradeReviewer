# Four KPI controlled readout: finite scoped inventory

Prepared by `/root/metric_cards`, actual gpt-6.1-sol / ultra, 2026-10-23 CST. Version is the three hashes in `SOURCE-SHA256.json`, based on HEAD `5a94ee3ff76e32993fe2c4791a83b40e877a7344`. Root owns whole-page visual consistency and all real browser/input acceptance. This inventory is a leaf preparation record, not P2/P4 acceptance.

Trigger: implementation changes frontend readouts, detail controls, keyboard interaction, layout and readonly B data wiring. Scope: only four metric cards and their shared detail portal. Excluded: page caller/range selector/chart/contribution/holdings, IO, persistence, service, DB, A/B/F computation/cache/performance. No data write occurs in this leaf, so its DB write journey is NOT APPLICABLE; future page persistence gates remain unchanged.

## Exact references and ownership

| Requirement | Exact original source | Element | Owner / journey | Evidence |
| --- | --- | --- | --- | --- |
| HV25-14/15/16: four ordered metrics and current independence | visual-design.candidate.md:191–221 / HP02 | HOME-HP02-B001 text block (no separate card element IDs) | Worker readonly rendering; root host bundle integration | Literal B consumer values; M01–04/M13; root browser pending |
| Baseline 276×88, label14/20, primary28/34, 12px gap, signs | Same spec:42–75,191–221; component-manual.html:611–698; original atom-metric.svg and home-1440.svg/home-1280.svg | Metric component | Worker leaf CSS; root complete visual consistency | Source/CSS self-review only; M15/M16/M17 real render NOT VERIFIED |
| Stable pending, missing, failure context | Same spec:467–549 and manual Metric state rows | Metric loading/empty/error | Host retains committed bundle; leaf never fetches or accepts a new range | M07–M10 synthetic; no browser evidence |
| Enter/Space, Esc/outside, visible 2px focus | Manual:611–698; atom-metric.svg | All four detail actions and shared close | Worker semantic controls; root actual input acceptance | M05/M06 synthetic focus; real inputs NOT VERIFIED |
| Exact money, source, FX, coverage/current unrealized | Spec:191–221; readonly exported B metric/series types | Four detail readouts/current section | Worker presentation only; B financial authority | M12/M14 consumer assertions; root scroll/placement NOT VERIFIED |

Reference root is `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/`. Hashes and direct-view record are in `REFERENCE-READS.md` / `SOURCE-SHA256.json`.

## Dynamic instance registry

Keys are `net` (期间净盈亏), `periodRealized` (期间已实现), `unrealizedChange` (期间浮盈变动), `currentMarketValue` (当前持仓市值). Every key has one 88px full-card semantic button. The open portal is one mutually exclusive transient detail, plus one close button. Its identity includes key + committed generation + source ID + report currency. Every key can open and close; generation/source/currency replacement invalidates the old detail and restores its exact opener. Clicking a second card switches directly to that card.

The original eight-state component has six applicable states × four keys = 24 base instances below. “SYNTHETIC” means JSDOM consumer evidence, never actual mouse/keyboard/visual acceptance. Every real browser cell is NOT VERIFIED in this worker scope.

| Key | Default | Hover | Focus | Loading | Empty | Error |
| --- | --- | --- | --- | --- | --- | --- |
| net | M01 SYNTHETIC | M17 NOT VERIFIED | M05 SYNTHETIC | M07/M08 SYNTHETIC | M09 SYNTHETIC | M10 initial + stale SYNTHETIC |
| periodRealized | M02 SYNTHETIC | M17 NOT VERIFIED | M05 SYNTHETIC | M08 first-load SYNTHETIC; stale value source-inspected only | M09 SYNTHETIC | M10 initial SYNTHETIC; stale visual/interaction NOT VERIFIED |
| unrealizedChange | M03 SYNTHETIC | M17 NOT VERIFIED | M05 SYNTHETIC | M08 first-load SYNTHETIC; stale value source-inspected only | M09 SYNTHETIC | M10 initial SYNTHETIC; stale visual/interaction NOT VERIFIED |
| currentMarketValue | M04 SYNTHETIC | M17 NOT VERIFIED | M05 SYNTHETIC | M07/M08 SYNTHETIC | M09 SYNTHETIC | M10 initial SYNTHETIC; stale visual/interaction NOT VERIFIED |

Pressed is NOT APPLICABLE for each key: the original manual explicitly gives no persistent pressed state for readonly metrics; `aria-expanded` communicates transient detail visibility. Disabled is NOT APPLICABLE for each key: original manual uses unavailable/error explanation rather than disabling readonly information. No `aria-pressed`, disabled card or new data action is rendered.

Loading variants: host old bundle + pending keeps all four fields/date context; null + pending yields four skeletons. Error variants: host old bundle + error keeps fields/date context and exposes 查看原因; null + error yields — and failure reason. Empty variant: explicit empty masks all values with — and retains explanation. Missing is per metric available/value; a missing net never substitutes an earlier point or suppresses an independently available realized/current value. Future summary hides all period numeric source evidence while current remains independent. Currency mismatch is a display consistency failure per root ruling: —/币种与报表不一致, true source amount/currency retained in details, also currentUnrealized. No conversion/financial eligibility is recalculated.

## Bounded control / journey acceptance map

| ID | Finite scenario and state transition | Worker result | Root required acceptance |
| --- | --- | --- | --- |
| M01 | net value/detail: closed → open → close; direct switch | Synthetic PASS | Actual pointer + visual default/detail |
| M02 | periodRealized value/detail and definition | Synthetic PASS | Actual pointer + visual |
| M03 | unrealizedChange value/detail and definition | Synthetic PASS | Actual pointer + visual |
| M04 | currentMarketValue value/detail, separate currentUnrealized | Synthetic PASS | Actual pointer + visual |
| M05 | Tab all four in reading order; Enter/Space; Esc restores exact opener | Synthetic PASS | Real keyboard, visible focus and no clipping |
| M06 | Inside keeps open; outside closes/restores; another card switches | Synthetic PASS | Real mouse/outside geometry |
| M07 | Pending old committed bundle + details; no IO/callback path | Synthetic PASS + source review | Host integrated stale generation, actual repeat activation |
| M08 | Null first load: four skeletons, no invented zero, explanation | Synthetic PASS | Actual layout loading state |
| M09 | Empty, individual missing, future period; current independent | Synthetic PASS | Actual contexts with host B, empty layout |
| M10 | Failure old/null: original context + 查看原因, never zero | Synthetic PASS | Actual failure journey with host, error affordance layout |
| M11 | Positive/negative/zero/missing distinction; current neutral | Synthetic PASS | Reference matching tones/typography |
| M12 | Exact full amount, original USD/HKD, FX source/date/ID/status, coverage; mismatch literal | Synthetic PASS | Actual detail readability and origin completeness |
| M13 | Changed period fields/current identical, no historical substitute | Synthetic PASS | Host complete same-generation bundle integration |
| M14 | 30-digit exact raw + long Chinese in accessible name/detail | Synthetic PASS (precision only) | Actual overflow ellipsis/sign/unit, full detail scrolling; regular/reference extreme must not ellipsize |
| M15 | 1440/1280 viewport: four equal columns,88px height,12px gaps | CSS inspected; NOT VERIFIED | Direct matching-state reference comparison by independent root |
| M16 | Container widths996/995 and492/491; narrow390;88px retained | CSS inspected; NOT VERIFIED | Actual rendered breakpoint sides; no overlap/stranded space |
| M17 | Hover only affordance120ms; reduced motion; focus2px | CSS inspected; NOT VERIFIED | Real browser motion/style evidence |
| M18 | Deep frozen input unchanged; new generation closes old detail | Synthetic PASS | Host real generation/source/currency replacement journey |

Mouse evidence: none. Real keyboard evidence: none (user-event is synthetic). Emulated touch: none. Physical touch: none. Detail portal positions from actual geometry when integrated; JSDOM geometry is not asserted or mocked as browser evidence. No build/full suite/performance was run by this worker under the bounded dispatch.

## Layout and extreme-value contract

Worker CSS preserves 88px/14–20/28–34 and current homepage tokens. Container width below996 uses two equal columns; below492 uses one, in source order. This is a local proposed implementation choice accepted for root comparison, not an approved visual waiver or page breakpoint. Detail panel reserves24px viewport edges, caps height and permits scrolling only when needed; root must check narrow/long content and the complete host visual context.

Root expressly rejected scientific notation and authorized only spatial overflow ellipsis for the 30-digit pressure amount, retaining its sign and 万/亿 unit. CSS ellipsizes only the numeric flex span when it actually overflows; the unit remains outside that span. The exact raw value is unchanged in the trigger accessible name and details. Regular/reference extreme numbers must remain fully visible. No JSDOM overflow-size emulation was used. This fallback still needs actual rendered independent visual acceptance.
