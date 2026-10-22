# V2.4.1 shared graphics coverage

Status: `READY FOR ROOT REVIEW`  
Task: `V241-09` (`.scratch/homepage-v241-repair/issues/09-shared.md`)  
Owner: shared-docs worker; coordinator/root performs independent acceptance and serial integration.  
Baseline: `docs/design-system/baselines/2026-10-20-homepage-v2.4.1`  
Scope: static design documentation and approved shared graphics only. No product code, business database, frozen source originals, or comments are in scope.

## Acceptance contract

The comparison sources are the current `source/visual-design.candidate.md` chapters 3, 4, 7, 8, 9 and 10, the confirmed `prototypes/round4` and `prototypes/round5` files/evidence, and the rendered `previews/hcr06` and `previews/hcr07` pages. The graphic must make these contracts legible in the rendered state:

- `S1` Global symbol search opens a header/home overlay with an independent result scroll; local holdings/trading-library search remains an inline filter for its current table. They must not be represented by the same interaction or by a toolbar that pushes the table.
- `S2` Toolbar, table header, and data rows have separate non-overlapping bands. Header labels and data use the same column anchors; numeric columns share a right edge; action hit areas remain 36px.
- `S3` Date controls use the approved calendar icon for a date/range and a down arrow for a year selector. Natural 本周/本月/本年 resolve in Shanghai time (Monday/day 1/Jan 1 through today) and show the actual date range after selection.
- `S4` Live list filtering is by trade/fill date and keeps unsettled fills. Live statistics are by round close date and exclude unfinished rounds. These dates are visibly distinguished.
- `S5` Simulation identity is one practice per symbol with multiple rounds. Repeated same-symbol/same-day practices remain independent, and no cross-practice matching is implied. Round replay returns to the originating practice with filter/sort/page/scroll/focus context.
- `S6` Return journeys restore the source context and do not two-way bind a trade-library condition into homepage state.
- `S7` Loading, empty, error, extreme, missing-input and reduced-motion states preserve the same geometry and communicate the state without hiding the date/identity semantics.

The static-doc/database gate is `NOT APPLICABLE`; rendered visual comparison is required. Every row below must have a rendered evidence path in `REPORT.md`; missing browser or pixel evidence remains `NOT VERIFIED`.

Current evidence: 51 authorized/current and root-authorized related SVGs have non-empty Chrome screenshots under `work/shared/evidence/browser/`; per-file status and hash binding are in `REPORT.md` and `evidence/SHA256SUMS.txt`. The row column below preserves the initial inventory status for audit history.

## Exact file inventory

All rows below are explicitly in the approved write scope. The `reference` column records the exact current rule and/or confirmed image used for comparison; it is not permission to edit the referenced source.

| File | Shared contract / state | Reference | Required rendered evidence | Initial status |
|---|---|---|---|---|
| `source/images/01-live-normal.svg` | `S2,S3,S4,S6`; live normal stats | candidate §8.2/§8.5/§10.1; hcr07 live normal | 1440 and 1280 render; toolbar/table anchor check | NOT VERIFIED |
| `source/images/02-simulation-normal.svg` | `S2,S3,S5`; simulation normal | candidate §8.3/§8.5; hcr07 simulation | 1440 and 1280 render; practice identity/date check | NOT VERIFIED |
| `source/images/03-distribution-selected.svg` | `S2,S4,S5`; distribution selected interval | candidate §8.5; round5 contribution/history evidence | rendered selected interval; surrounding toolbar remains fixed | NOT VERIFIED |
| `source/images/04-return.svg` | `S6`; replay/library return context | candidate §7.4/§8.4/Appendix II; hcr06 return | rendered return state; source focus/filter/page/scroll text visible | NOT VERIFIED |
| `source/images/05-loading.svg` | `S2,S7`; loading geometry | candidate §9.2/§10.1; hcr07 loading state | rendered loading frame | NOT VERIFIED |
| `source/images/06-empty.svg` | `S2,S7`; empty geometry | candidate §9.2/§10.1; hcr07 empty state | rendered empty frame | NOT VERIFIED |
| `source/images/07-error.svg` | `S2,S7`; error/retry | candidate §9.2/§10.1; hcr07 error state | rendered error frame with retry action | NOT VERIFIED |
| `source/images/08-extreme.svg` | `S2,S3,S4,S7`; extreme numeric/date | candidate §9.3/§10.1; hcr07 extreme fixture | rendered overflow-safe frame | NOT VERIFIED |
| `source/images/09-missing-input.svg` | `S2,S5,S7`; missing exit value | candidate §9.4/§10.1; hcr07 missing fixture | rendered missing-input frame | NOT VERIFIED |
| `source/images/account.svg` | `S2`; account selector and toolbar spacing | candidate §3.2/§10.1; round4 controls | rendered account state at 1440/1280 | NOT VERIFIED |
| `source/images/atoms.svg` | `S2,S3,S7`; shared primitives | candidate §2/§9/§10; round4 and round5 primitives | rendered atom board; hit-area and alignment checks | NOT VERIFIED |
| `source/images/filter.svg` | `S1,S2`; local filter popover | candidate §3.7/§10.1; confirmed filter prototype | rendered popover with draft/apply states | NOT VERIFIED |
| `source/images/handoff.svg` | `S4,S6`; homepage contribution to live library | candidate §7.2/§7.4; hcr06 handoff | rendered handoff state; trade date vs close-date copy | NOT VERIFIED |
| `source/images/hcr06-final-pending-library-1280.svg` | `S2,S4,S6`; pending list narrow | candidate §7.3/§8.2; hcr06 pending preview | rendered 1280×800; no toolbar/table overlap | NOT VERIFIED |
| `source/images/hcr06-final-pending-library.svg` | `S2,S4,S6`; pending list desktop | candidate §7.3/§8.2; hcr06 pending preview | rendered 1440×1000; source date/market/account visible | NOT VERIFIED |
| `source/images/hcr06-final-pending-return.svg` | `S6`; pending return | candidate §7.4; hcr06 pending preview | rendered return context | NOT VERIFIED |
| `source/images/hcr06-final-replay-a1.svg` | `S5,S6`; practice A round replay | candidate §8.3/§8.4; hcr06/hcr07 fixture | rendered replay and return identity | NOT VERIFIED |
| `source/images/hcr06-final-replay-a2.svg` | `S5,S6`; practice A second round | candidate §8.3/§8.4; hcr06/hcr07 fixture | rendered replay and return identity | NOT VERIFIED |
| `source/images/hcr06-final-replay-b1.svg` | `S5,S6`; independent practice B replay | candidate §8.3/§8.4; hcr06/hcr07 fixture | rendered B remains separate from A | NOT VERIFIED |
| `source/images/hcr06-final-return.svg` | `S6`; homepage return | candidate §7.4/Appendix II; hcr06 return preview | rendered source context restoration | NOT VERIFIED |
| `source/images/hcr06-final-rounds-a.svg` | `S2,S5`; practice A round set | candidate §8.3; hcr06/hcr07 fixture | rendered two rounds and unclosed remainder | NOT VERIFIED |
| `source/images/hcr06-final-sim-ab.svg` | `S2,S5`; one practice per symbol, multiple rounds | candidate §8.3; hcr06/hcr07 fixture | rendered A/B same-symbol identity and counts | NOT VERIFIED |
| `source/images/journeys-date.svg` | `S3,S4`; date journey | candidate §4.2/§7.2/§8.2; hcr06/hcr07 | rendered date/range/natural-period journey | NOT VERIFIED |
| `source/images/journeys-pending-99plus.svg` | `S4,S6,S7`; pending 99+ | candidate §7.3/§9.2; hcr06 pending | rendered badge/pending state | NOT VERIFIED |
| `source/images/journeys-pending-normal.svg` | `S4,S6`; pending normal | candidate §7.3; hcr06 pending | rendered pending journey | NOT VERIFIED |
| `source/images/journeys-pending.svg` | `S4,S6`; pending baseline | candidate §7.3; hcr06 pending | rendered pending journey | NOT VERIFIED |
| `source/images/search--detail.svg` | `S1,S6`; search detail state | candidate §3.4–§3.6; round4/round5 search | rendered detail result state | NOT VERIFIED |
| `source/images/search--empty.svg` | `S1,S7`; search empty state | candidate §3.4–§3.6/§9.2; round4/round5 search | rendered empty overlay | NOT VERIFIED |
| `source/images/search-detail.svg` | `S1,S6`; search detail frame | candidate §3.4–§3.6; search references | rendered detail frame | NOT VERIFIED |
| `source/images/search-empty-frame.svg` | `S1,S7`; empty frame | candidate §3.4/§9.2; search references | rendered empty frame | NOT VERIFIED |
| `source/images/search-error-frame.svg` | `S1,S7`; error frame | candidate §3.4/§9.2; search references | rendered error frame | NOT VERIFIED |
| `source/images/search-motion-after-frame.svg` | `S1,S7`; reduced-motion after | candidate §3.4/§9.5; search references | rendered after frame | NOT VERIFIED |
| `source/images/search-motion-before-frame.svg` | `S1,S7`; reduced-motion before | candidate §3.4/§9.5; search references | rendered before frame | NOT VERIFIED |
| `source/images/search-motion-during-frame.svg` | `S1,S7`; motion during | candidate §3.4/§9.5; search references | rendered during frame | NOT VERIFIED |
| `source/images/search-motion.svg` | `S1,S7`; search motion journey | candidate §3.4/§9.5; round4/round5 search | rendered motion sequence frame | NOT VERIFIED |
| `source/images/search-overlay-open.svg` | `S1,S2`; global overlay open | candidate §3.4–§3.6; search references | rendered overlay with home blocked and independent results | NOT VERIFIED |
| `source/images/search-overlay-reduced-motion.svg` | `S1,S7`; reduced-motion overlay | candidate §3.4/§9.5; search references | rendered reduced-motion state | NOT VERIFIED |
| `source/images/search-result-frame.svg` | `S1,S2`; results frame | candidate §3.4/§3.5; search references | rendered result alignment/scroll frame | NOT VERIFIED |
| `source/images/search.svg` | `S1,S2`; search entry control | candidate §3.2–§3.4/§10.1; round4/round5 search | rendered 36px hit area and separate local filter | NOT VERIFIED |

## Exclusions and handoff

- Excluded from this worker: `source/visual-design.candidate.md`正文, every `home*.svg`, `visual-samples-board.svg`, all other agents' graphics, frozen historical originals, and original comments.
- Body changes are recorded as a patch in this directory for root to apply serially; this worker does not edit the shared正文.
- Browser/database checks are not applicable to static docs, but any claimed visual pass needs a real rendered image or browser screenshot. Source-only inspection cannot move a row above `NOT VERIFIED`.
- The final per-file status, exact render commands, visual comparison notes, and unresolved items belong in `REPORT.md`.
