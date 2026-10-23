# Narrow wheel / height-chain diagnosis — read-only candidate

2026-10-23 CST. `/root/responsive_shell`, GPT-6.1 SOL / ultra. **Diagnosis and proposed candidate only; no product edit and no new verification run. P1 remains 2/3 FAIL.** This extends the existing third-candidate preparation, not the formal-round budget. Root owns the running 3333 service, browser, isolated database, whole-page visual consistency, state flow and independent acceptance.

## Trigger, scope and exact contract

Root observed a real vertical wheel dead zone at 390×844 on CSS SHA-256 `765c420c5d5f6eac81e56626786b4421fdd39925dcb071facac7561446493fbf`. This hash was read again and is unchanged. Current authorization is read-only source/reference/saved-evidence diagnosis and this evidence-directory write only. No CSS, TSX, global styles, tests, shared tracker, service, database or browser operations were performed; no subagent was spawned. No repro/retest was run by the worker.

The approved HP11 source (`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`, lines 42–75) and the feature `visual-contract.md` were read again. HP11 specifies 72px navigation, 64px header and 24px main horizontal padding at the two desktop comparison viewports 1440×1000 and 1280×800. The 2346px-high source illustrations are long designs to inspect at original scale, not a requirement to make the browser document that tall. HP11 does **not** explicitly define a mobile fixed header or a mobile document-versus-inner scrolling owner. The feature adds about-390px reachability/overlap/overflow checks and explicitly forbids claiming an exact mobile reconstruction from an absent mobile drawing.

The choice of scrolling owner must also preserve HP06 lines 432–464, especially line 456, and the feature's state chain: return to the real data while restoring the original scroll and source focus. This is why source-state inspection matters in addition to making the wheel move. A mobile viewport-height shell below is a scoped implementation choice for those existing contracts, not a newly approved mobile visual design.

| Requirement / exact element locator | Reference | Diagnosis / later independent evidence owner |
| --- | --- | --- |
| HV25-03 / HOME-HP11-B001; HV25-54 / same text locator | HP11 lines 42–75; original home-1440/home-1280 SVGs; `visual-contract.md` | Desktop geometry stays unchanged. Root directly compares fresh rendered reference states and breakpoint sides. |
| HV25-06 / HOME-HP03-B001 | HP03 lines 113–129; account.svg; current header contract | Header, account, market/search/filter and mobile navigation remain reachable with original control budgets. Root observes real wheel and keyboard journeys. |
| HV25-55 / HOME-HP06-B018, with HV25-53 / HOME-HP10-B101 | HP06 lines 432–464; appendix return-context line 659; library-return.svg | Root must observe nonzero homepage scroll → accurate detail/trades → return/re-read/reload, with position and focus restored. Existing source identifiers are retained. |

## Existing real evidence, not a worker reproduction

Root's current report states: document `scrollY=377.5`; `.app-content`, `.hp-home-host`, `.hp-home-surface` and `.hp-home-background` each height 1817; `.hp-home-scroll` has `clientHeight=scrollHeight=1712`, `scrollTop=0`, `overflow-y:auto`, `overscroll-behavior-y:contain`. A real wheel-down at [180,500] moved neither document nor child. PageDown had moved the document; a horizontal wheel had moved `.hp-home-scroll` to 586.

Saved `evidence/continue-2026-10-23/root-390-after.png` and `root-390-page-down.png` were directly viewed. The latter shows the top navigation/header scrolled out of view and later content visible, consistent with document scrolling; a screenshot alone does not identify the scrolling element. The root's numeric report supplies that distinction. The saved `root-responsive-after.json` was read: at 759×844 body height is 1841, sidebar height 69 and header height 64; at 760, 900 and 901×844 body height is 844. The original 390 before metrics put the old scroll box at height 1712 too. Thus the content-height problem predates the header/sidebar candidate; correcting header containment exposed the untested wheel path, rather than adding an event handler regression.

## Exact height and wheel chain

| Boundary / source | Current contribution |
| --- | --- |
| `app/globals.css:36–48`, `3811–3814` | html/body have only `min-height:100%`; body base overflow hidden becomes `overflow:auto` at max1059. Document scrolling is therefore available in narrow mode. |
| `app/globals.css:4901–4903`, `5384–5388` | At phone widths the shell is a column with `height:auto; min-height:100dvh`. Its minimum height is not a definite viewport-sized maximum for the child chain. |
| `app/globals.css:5271–5277`, `5440–5442` | app-content is a column flex child with `flex:1`; the max1059 rule supplies `min-height:calc(100dvh - 58px)`. In auto-height phone shell it can grow with content. The actual top strip is 69px, so its old 58px subtraction would also overrun a fixed shell unless released. |
| `app/globals.css:205–209`, `4903`; homepage CSS `12` | Dashboard workspace is flex:1. The global max759 workspace minimum is `calc(100dvh - 130px)`; homepage changes it to a block with overflow hidden but supplies no definite height and does not release that narrow minimum. |
| homepage CSS `13`, `15–16` | host/surface/background use `height:100%`. These percentages cannot create a viewport constraint when their upstream size is content-based. The real 1817px chain confirms the resulting expansion. |
| homepage CSS `28`, `115` | The repaired header correctly takes its wrapped content height, about 105px at 390. It does not constrain the whole application; no need to undo it. |
| homepage CSS `42`, `115` | hp-home-scroll is `flex:1; min-height:0; overflow:auto; overscroll-behavior:contain`. In the content-height background it receives all 1712px, so its vertical scroll range is zero; it still is the horizontal overflow scroller. |
| `app/globals.css:6239–6244`, `6346–6356` | At min760 the shell restores definite `height:100vh` and app-content resets minimum to zero. This is the existing working height-chain pattern and matches the saved 759/760 body-height discontinuity. |

**Single causal hypothesis:** the phone shell lost the definite upstream height required by the homepage's existing inner-scroller/state contract. The inner box expands instead of overflowing vertically. Its unchanged two-axis containment is the immediate barrier preventing a wheel at that box from chaining into the document. Both facts are needed to explain all observed inputs: no vertical child movement, no chained document wheel, successful document PageDown, and successful child horizontal wheel.

This diagnosis does not claim that `overscroll-behavior:contain` universally blocks every keyboard scroll or every device gesture. The supplied real wheel result is bound to this current browser/version/state; keyboard and touch remain separate.

## One proposed minimal candidate — NOT APPLIED

Restore the missing phone-only height-chain constraints in the **existing max759 block** of `home-surface.css`:

```css
.homepage-v25-app { height:100dvh; }
.homepage-v25-app > .app-content,
.homepage-v25-app .workspace.dashboard-mode { min-height:0; }
```

These are three property applications and one coherent cause correction. The shell uses actual dynamic viewport height; flex allocates the remaining space after the existing auto-height top strip. Releasing app-content's old viewport-minus-58 minimum is necessary because the current top strip is 69px. Releasing workspace's independent viewport-minus-130 minimum prevents it from exceeding the remaining space when the existing recovery/error notice occupies space above the workspace. Both minima return to the already-used desktop/base minimum of zero. No artificial top-strip subtraction is hard-coded.

At 390×844 with the supplied current no-notice state, the prediction is shell 844, top strip 69, app-content/host/surface/background about 775, header 105, hp-home-scroll about 670 with a positive range of about 1042. Root must measure the actual geometry; these arithmetic predictions are not rendered evidence or a PASS. Normal document scroll should be zero while wheel/PageDown inside the content moves `.hp-home-scroll`; horizontal scrolling remains in that same box. No hidden body overflow is added to conceal an incorrect size.

The candidate changes no control size, font, row/card/holdings dimensions, module order, header wrap, search/detail overlay, navigation handler, state field, source persistence or desktop declaration. The existing `overscroll-behavior:contain` remains useful at the real inner scroll boundaries and on the horizontal axis.

### Why not only `overscroll-behavior-y:auto`

A max759 `overscroll-behavior-y:auto` would be a one-declaration wheel-chain workaround: in the reported no-range child it should permit document scrolling. It would leave the entire 1817/1712px height chain unchanged and leave root's actual vertical location owned by document. Source currently captures/restores only the inner box:

- `home-surface.tsx:261` publishes `event.currentTarget.scrollTop` from `.hp-home-scroll`.
- `home-surface.tsx:150–157` restores `scrollRef.current.scrollTop = snapshot.scrollTop` and focuses with `preventScroll:true`.
- `home-surface.tsx:194–197` and `:298` capture that same ref at detail and ordinary-trades entry.

Therefore the reported document377.5/child0 state would keep recording zero. PageDown already demonstrates why apparent reachability is insufficient. Merely allowing document wheel does not resolve the required return-position ownership; supporting document scrolling properly would require a separate state-owner change in TSX and a broader journey audit. That is outside this CSS diagnostic slice and is unnecessary when the existing inner contract can be restored. Do not change both height and overscroll at once: it would obscure which hypothesis resolved the failure.

## Breakpoint effect and root acceptance boundary

| Viewport | Current source/evidence | Proposed effect; still NOT VERIFIED |
| --- | --- | --- |
| 390×844 | auto-height phone column; 1817px current content chain / 1712px no-range inner box | Only here/other max759 widths: definite shell and released minima; positive inner Y range. Navigation/header stay outside the inner scrolling area. Root checks no new clipping or unreachable lower content. |
| 759×844 | body1841, nav69/header64; same auto-height global branch | Same phone-only correction. Expected available inner viewport is 844−69−64=711 absent notices. Root checks vertical wheel and horizontal holdings at both bounds. |
| 760×844 | restored row/100vh, body844; 72px rail; header64 | New rule does not match. Original 760 height, rail, account and 960px holdings rules remain. |
| 900×844 | desktop rail/100vh; max900 header and holdings rules apply | New rule does not match; current max900 wrap and horizontal holdings behavior untouched. |
| 901×844 | desktop rail/100vh; fixed64 header, 24px padding | New rule does not match. |
| 1280×800 and 1440×1000 | approved desktop comparison sizes | New rule does not match; 72/64/24 budget and all controls unchanged in source. Fresh independent visual comparison remains root-owned. |
| Short phone landscape / software keyboard / dynamic viewport | Existing supplied evidence does not cover these | min-height releases avoid stale viewport-derived minima, but actual no-clipping, focus/keyboard and dvh behavior must remain NOT VERIFIED until corresponding real evidence. |

The homepage class is only attached to `main` for real dashboard (`trade-review-workspace.tsx:5753`). A max759 rule scoped to that class does not change the ordinary-library/review/data shell; root must still verify return because changing class and restoring scroll crosses this boundary. Open search/detail remains fixed-overlay content; opening/closing must preserve the inner position and not cause new background motion.

| Required root action / gate | Current conclusion |
| --- | --- |
| Actual wheel down/up at the original content coordinate and near lower/upper limits; visible downstream content movement plus document/inner offsets | FAIL remains the existing root observation until a candidate is authorized/applied and directly checked. No new action by worker. |
| Horizontal wheel to the final holdings actions; vertical wheel while horizontally shifted; pagination and detail close | NOT VERIFIED for proposed candidate. Preserve x separately from y. |
| Nonzero inner scroll → exact detail → ordinary library → re-read return/reload; source/focus preserved | NOT VERIFIED for proposed candidate. Required by existing HP06 and source contract. |
| PageDown/Home/End/Tab/Escape; navigation and account/search overlays; recovery/error notice geometry | NOT VERIFIED. Keyboard operation is not wheel proof. |
| 390,759/760,900/901,1280/1440 screenshots/rects and independent design comparison | NOT VERIFIED for proposed candidate. No source claim substitutes for actual comparison. |
| Emulated touch, physical touch, software keyboard | NOT VERIFIED, each separately. |
| Product/typecheck/test/build/service/DB actions in this diagnostic step | NOT APPLICABLE: read-only diagnosis, no product mutation or rerun authorized. Full P1 gates remain unaffected. |

The worker has performed zero real interactions for this diagnosis. This document is a proposed next minimal experiment for root, not IMPLEMENTATION-READY or accepted output. Existing DIAGNOSIS/IMPLEMENTATION-READY files and prior failure evidence are retained as historical records; no prior PASS is broadened and no P1 round counter changes.
