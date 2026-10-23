# Controlled period selector: bounded contract

2026-10-23. Owner `/root/financial_sharing`, gpt-6.1-sol / ultra. Root owns whole-page consistency, integration, independent functional acceptance and visual comparison. This is an isolated leaf candidate, not P2 acceptance; P2 remains 0/3 and all prior FAIL / NOT VERIFIED remain.

## Authority and version

Read original HP02 prose `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:210–221`, component manual global alignment107 / SegmentedTabs196–282 / Popover370–455 / FilterPopover456–510, and original `source/images/period.svg`. Directly viewed the existing 1100×1100 `evidence/P2/data/p2-b/implementation/references/period.png`. The image is a reference plate, not a CSS viewport. Source identifiers: HV25-17/18 and HOME-HP02-B020. Parent dispatch: `evidence/continue-2026-10-23/ROOT-PERIOD-SELECTOR-DISPATCH.md`.

Initial input SHA256:

| Input | SHA256 |
| --- | --- |
| Dispatch | 7c5493ae01304f28fd74ac0a731e8495b1ca41b1d19addb93cfb400023afc50f |
| Original prose | daa1434e4437c340cbd23e38e15a7a34c31a892685ad7dfd1269ffe418605c22 |
| Component manual | 1f532219fc78f52b8c9c7366aa4bf1b02d349fb43c3d0093311f7784bde246f0 |
| period.svg | 4fbe2cdd0d411a25adc92c555784c09b82eabcd5927691edab01aca70e31b6d8 |
| Existing period.png | 2b799a786ff774980e15eeec5f20c22fd6f8112c571d23dc3f03159de6defba0 |

The three permitted product/test files do not exist at contract registration. Only these new files and this evidence subtree may be written. No existing file, shared tracker, Surface, host, Workspace, state contract, dependency, configuration or test is edited.

## Minimal controlled interface

`PeriodSelector` imports existing S `HomepagePeriod` as a type. Props:

- `applied: HomepagePeriod` — sole authority for selected shortcut and displayed range.
- `draft: { from: string; to: string }`, `open: boolean`, `pending: boolean`, `error: string | null`.
- `today: string` — required Shanghai civil date `YYYY-MM-DD`, already converted by caller; the leaf never reads a clock or local timezone.
- `allRange: { from: string; to: string } | null` — caller-supplied actual inclusive boundary for `all`; null produces an explicit unavailable label, never an inferred earliest trade.
- `onDraftChange(draft)`, `onOpenChange(open)`, `onApply(period)` — report events only. No committed period, request generation, amounts, IO or storage is owned here.

Shortcut order follows the original plate: 本年 / 本月 / 本周. They compute inclusive year/month/Monday-to-today ranges from the supplied civil date, including leap days and year-crossing weeks. Invalid `today` makes shortcuts unavailable with a nearby reason. Future custom dates remain valid. A same-year visible range may shorten the end year as in the original trigger; its accessible name retains both complete dates.

## Visual and space budget

| Element | Contract / original reference | Allowed change | Forbidden change |
| --- | --- | --- | --- |
| Three shortcuts | Each68×36,14px centered,8px gaps; ytd selected in original | Selected outline follows controlled applied; hover/pressed/focus feedback | Request changes selected before controlled success |
| Date trigger | 216×36,16px existing CalendarDays SVG icon; full range accessible | Wrap as a unit under shortcuts when narrow | Truncating the actual range without an accessible full value |
| Popover | 480px wide including20px padding; absolute overlay, starts24px below trigger row | Natural content height, long errors wrap | Pushing the page, clipping error/actions, fixed error height |
| Fields | Desktop200×36 each,20px gap; text left; explicit start/end labels | At narrow width stack fields, preserve36px hit area | Shrinking text or hiding a field |
| Actions | Apply88×36, centered14px; cancel adjacent | Apply disabled for invalid/pending; cancellation available | Duplicate request, invalid request or draft loss |
| Colors / motion | Text#E6EDF7, secondary#A8B6CB, error#FF8592, border#283448, surfaces#111A26/#162233, selected#6CA8FF;120ms transitions | Reduced-motion removes transition | New icon system or animation-dependent operation |

Root comparison targets:1440×1000,1280×800,390×844 CSS px, plus either side of the component's narrow stacking breakpoint. At390 the available content width is342 (minimum24px per side); popover must fit that available width. The caller supplies page gutters; the leaf additionally caps overlay width to viewport minus48px. Zoom/DPR and actual geometry remain NOT VERIFIED until root renders it. No reference-design deviation is authorized.

## State and focus contract

Applied本年 → open directly from range trigger → reversed dates only affect draft and show field-associated error → correction enables Apply → caller sets pending → old applied range/selection remain, duplicate submission blocked and nearby pending reason readable → caller supplies failure → old applied plus draft remain and retry allowed → caller supplies successful applied/open transition → label/selection change together and focus returns to trigger. The leaf cannot prove the page's amount/contribution atomicity.

Opening focuses the start field. Within the nonmodal dialog, Tab follows start/end, readable error/status when present, enabled Apply, Cancel; Tab after Cancel cycles to the first available dialog control. Shift+Tab from the first field returns to the range trigger, whose next Tab reenters the dialog. Escape, Cancel and outside pointer close through `onOpenChange(false)`, preserve draft/applied and restore the trigger focus after the controlled close. Outside pointer cancels without applying. Pending does not block the range trigger or cancellation: closing only dismisses the editor, never aborts an in-flight request, resets pending or changes applied. The caller still publishes that request's result. This is a local focus boundary, not a global search overlay or inert page. Native Enter/Space activate buttons. ArrowLeft/Right and Home/End move shortcut focus only; they never submit. Pending shortcuts remain focus-readable but suppress activation; invalid-today shortcuts are disabled and skipped by Tab.

## Fixed control inventory and eight-state denominator

Eight states: default / hover / focus / pressed / disabled / loading / empty / error. Each cell below is an applicable component-state registration unless `N/A` explicitly explains why. Registration is not execution evidence. Repeated shortcut instances each count separately. All DOM IDs are instance-specific; stable audit IDs use the `PS-*` names below.

| ID / count | Default | Hover | Focus | Pressed | Disabled | Loading | Empty | Error | Expected local/caller boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PS-YTD /1 | Yes | Yes | Yes | Yes | Invalid today | Pending | N/A: option always exists | Failure keeps applied | Only request accurate ytd |
| PS-MONTH /1 | Yes | Yes | Yes | Yes | Invalid today | Pending | N/A: option always exists | Failure keeps applied | Only request accurate month |
| PS-WEEK /1 | Yes | Yes | Yes | Yes | Invalid today | Pending | N/A: option always exists | Failure keeps applied | Only request accurate Monday range |
| PS-RANGE /1 | Applied label | Yes | Yes | Open/close | N/A: opening/cancel always available | Old label | All boundary unavailable | Old label | Open directly; no apply |
| PS-FROM /1 | Draft value | Yes | Yes | Edit | Pending | Retain draft | Empty validation | Invalid/reverse associated | Only onDraftChange |
| PS-TO /1 | Draft value | Yes | Yes | Edit | Pending | Retain draft | Empty validation | Invalid/reverse associated | Only onDraftChange |
| PS-APPLY /1 | Valid draft | Yes | Yes | One request | Invalid/pending | Locked | Empty disables | Retry after request failure | Only request custom period |
| PS-CANCEL /1 | Visible while open | Yes | Yes | Close | N/A: cancellation available | Available | N/A: no value | Available | No draft/applied mutation |
| PS-FEEDBACK /1 | N/A: no feedback | N/A: text | Keyboard readable | N/A: text | Reason | Pending reason | Field reason | Server/field reason | Accessible description/status, no request |

Applicable state registrations: shortcuts3×7=21; range7; fields2×8=16; apply8; cancel6; feedback5 =63. Total original9×8=72;9 N/A cells are documented above. Controls with actions=8 (three shortcuts, range, two inputs, Apply, Cancel); feedback is a separate dynamic non-action item. Keyboard journeys and input modes are recorded separately, not inflated into additional control counts. Parent excludes service/browser/DB/full suite/performance from this implementation task; required root browser evidence remains NOT VERIFIED, not PASS or N/A.

## Acceptance boundaries

| Gate | Planned evidence | Current status / owner |
| --- | --- | --- |
| Targeted function | Real leaf mounted in jsdom, controlled caller harness; literal date expectations; RED then same tests GREEN | NOT VERIFIED until run / worker |
| Real mouse/keyboard/touch, layout, screenshots | Real rendered leaf at root targets; compare reference in matching invalid/pending/failure states | NOT VERIFIED / root; jsdom is synthetic input only |
| Homepage E2E, complete monetary atomicity, contribution, return/reload | Later authorized page integration | NOT VERIFIED / root |
| Independent visual | Reviewer who did not implement directly compares render/reference | NOT VERIFIED / root |
| DB write persistence | No business write exists in this controlled leaf | NOT APPLICABLE to leaf; whole-home write flows remain required |

Real execution/click/state coverage presently0/8 actions and0/63 state registrations; physical touch NOT VERIFIED. No browser preview is produced under this dispatch. Do not substitute targeted tests for these denominators or accept the feature from this report.
