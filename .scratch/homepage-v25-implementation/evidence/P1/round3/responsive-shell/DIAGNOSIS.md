# P1 third-candidate responsive shell diagnosis

State: diagnosis-recorded; not accepted. P1 remains **2/3 FAIL**. This is preparation of the existing third candidate, not a new task or formal acceptance round.

Owner: `/root/responsive_shell`, GPT-6.1 SOL / ultra. Root owns the active 3333 browser/service, whole-page visual consistency, complete data flow and independent acceptance. The worker does not operate or restart that service, use CUA, write a database or delegate.

## Trigger, scope and references

This authorized narrow-screen repair affects shell/header/sidebar layout and therefore triggers `docs/agents/frontend-control-audit.md`. Product writes are limited to shell/header/sidebar selectors in `app/components/homepage-v25/home-surface.css`; evidence writes are limited to this directory. No control, typeface, data/state or desktop dimension redesign is authorized. Search/detail/holdings dimensions, global CSS, TSX, tests, services, DB, shared trackers and commits are excluded from this worker's writes. Root retains their applicable integrated acceptance.

Read before implementation: current development workflow, task decomposition, frontend audit, UI task/acceptance templates, feature visual-contract and DESIGN-COVERAGE HV25-03/06. Approved source `visual-design.candidate.md` HP11 lines 42–75, public visual rules 77–110, HP03 lines 113–129; current component manual global inner dimensions, IconButton, SegmentedTabs and Select sections. Complete original home-1440/home-1280/account SVG XML was parsed, with their shell/control geometry inspected. Their existing PNG renderings were directly viewed from `evidence/resume-2026-10-23/integration-debug/visual-readback/`.

| Requirement / element locator | Exact source / reference | Journey and acceptance evidence owner |
| --- | --- | --- |
| HV25-03 / HOME-HP11-B001 | `source/images/home-1440.svg`, `home-1280.svg`; HP11 layout table | Root compares 1440×1000 and 1280×800: 72px rail, 64px header, 24px content padding. Worker makes no changes active above 900px. |
| HV25-06 / HOME-HP03-B001 | `source/images/account.svg`; HP03; manual header controls | Root checks market/account/search, account open/Esc/selection/long text; preserve 176×36 account and 36px header controls. |
| Narrow reachability / feature visual-contract | Original 390×844 screenshot and ROOT-RESPONSIVE-CHECKPOINT | Root compares 390, 759/760 and 900/901, including nav/settings, header, holdings horizontal area/pagination/detail/return and keyboard/mouse. Narrow is reachability, not an invented mobile visual reference. |

Reference root: `docs/design-system/baselines/2026-10-22-homepage-v2.5/`. Actual before evidence: `evidence/continue-2026-10-23/root-{390,1440,1280}-before.png`, `root-390-before.metrics.json`, `ROOT-RESPONSIVE-CHECKPOINT.md`. These historical screenshots were directly viewed; final-version acceptance remains separate.

## Evidence and single causal hypothesis

At actual 390×844 / DPR 1, the screenshot shows the account/search/filter row at about y128–164 while the header bottom is y136 and content begins around y156. The supplied metrics independently place `.hp-home-scroll` at y136. The sidebar brand is clipped at the left and settings/menu crowd the first strip. Desktop before screenshots show the expected 72px rail and 64px header; the checkpoint measures the 1280 reservation x96/y88/w1160/h474 and holdings x96/y586/w1160/h520.

The single hypothesis is **desktop sizing contracts remain applied after their containers switch to narrow layouts**:

1. Base `.hp-page-header` has `height:64px; flex:0 0 64px` inside the column-flex `.hp-home-background`. The existing max-900 rule changes `height:auto` and enables wrapping, but leaves the 64px flex-basis in force. A two-line layout needs 36 + 8 + 36 + 24 vertical padding + 1 border = 105px. Its second row therefore overflows a 64px main-axis allocation. Changing only that narrow rule to `flex-basis:auto` lets the existing wrapped content determine its allocation.
2. At max-759, global `.app-sidebar` already uses a three-column mobile grid (`minmax(0,1fr) auto auto`) with brand, settings and nav trigger; its working contract is full width and `flex:0 0 auto`. Homepage's higher-specificity base selector instead retains `width:72px; min-width:72px; flex-basis:72px; padding:20px 8px; gap:28px`. Three mobile grid columns cannot fit the 72px rail box. Restore full-width/auto-basis and the global mobile 6px 12px padding/10px gap only at max-759. Restore brand start alignment there, as the desktop-only centering otherwise centers it inside the newly flexible first grid column.

The corresponding global patterns are in `app/globals.css` lines 5384–5445, 6125–6171 and 6237–6359. At min-760 the global shell deliberately restores a desktop flex rail; keep that boundary. The existing homepage nav and settings buttons remain 56px and their labels stay visible; no font, control size, item visibility or popup behavior changes. Global pointer-coarse secondary navigation has min-height 44px, already met by 56px. Header remains the approved 36px; this CSS slice makes no new claim of physical-touch acceptance.

## Minimal experiment and expectations

Make one coherent cascade correction: add `flex-basis:auto` to the existing max-900 header rule, and a max-759 sidebar adaptation with full width/min-width zero/auto basis/global mobile spacing and start-aligned brand. No extra spacers, overflow masking, font shrinking, hidden controls, fixed content heights or unrelated declarations.

Expected 390 behavior: brand/settings/menu occupy the full-width top strip; the existing wrap creates a content-sized header (about 105px for two rows), enclosing account/search/filter. At 759/760 the mobile grid/desktop rail transitions at the existing boundary. At 900/901 the header wrapping rule transitions; enough width should keep all header items reachable. At 1440/1280 neither added responsive change matches, so 72/64/24 budgets should be identical. Nav popup should remain an overlay and not reflow content. Holdings keeps its current 960px narrow horizontal area and desktop dimensions; all its reachability and return behavior require root's actual interactions.

## Applicable states and gate ownership

| State | Applicability / pending evidence |
| --- | --- |
| normal / selected | Applicable: root screenshot and actual market/account/navigation operation. |
| expanded | Applicable: account and mobile nav overlay, close/Esc and focus return; root real browser. |
| longtext | Applicable: fixed-width account ellipsis/full identity and nav labels; root real browser. |
| empty / loading / error | Applicable to account/global data but unchanged by this CSS slice; root regression ensures header geometry and controls remain usable. No synthetic state injection by worker. |
| ambiguous | No shell identity ambiguity state; account identities and actual options remain in root's integrated state audit. |

CSS-only does not introduce a business write. DB-write gate is NOT APPLICABLE for this slice because handlers/state/repository are untouched and no browser write is performed here; full P1 persistence is still NOT VERIFIED, owned by root. A mirrored CSS unit test is not useful; root's historical failing screenshot and fresh browser before/after are the behavioral regression. Worker will record parse/whitespace checks and content hashes, then hand off IMPLEMENTATION-READY, never accepted.

Mouse/keyboard/emulated-touch/physical-touch remain separate; this worker has performed zero real control interactions. All functionality, state/navigation and independent visual gates remain NOT VERIFIED pending root evidence. Physical touch/software keyboard remain NOT VERIFIED without corresponding real evidence.
