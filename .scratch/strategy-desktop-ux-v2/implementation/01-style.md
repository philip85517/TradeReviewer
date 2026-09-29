# 01 Desktop style implementation report

- Ticket: [01 — 单组合工作台](../issues/01-single-portfolio-observation.md)
- Owner: `/root/desktop_workbench_style_01`
- Scope: [running-prototype.css](../../../app/components/strategy-prototype/running-prototype.css) only. TSX, model, creation, app shell, shared CSS, API and database are outside this style slice.
- State: CSS first pass is available for coordinator browser integration. This is an implementation handoff, not ticket acceptance.
- References viewed directly: [TradeReview 1440](../screenshots/reference/tradereview-1440.png), [TradeReview 1280](../screenshots/reference/tradereview-1280.png), and [legacy running day 5](../../strategy-portfolio-backtesting/screenshots/running-day5-1440.jpg). The first two establish the existing dark shell, navigation, blue action, panel and border treatment; the legacy capture is state/style context, not the approved layout target.
- Contract: approved [desktop UX spec](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md) DD02, DD05, DD08, DD13 and DD14; 1440×900 and 1280×800 at 100%, with 6–8px panel/control radii, 14px body text, 12–13px event reasons, and the full main plot plus holdings summary visible in the first screen.

## Implemented styling

- Reworked the running page into a compact header, 36px portfolio tabs, four-column 64px summary, single-row 48px time controls, and a desktop chart/portfolio sidebar grid. The desktop sidebar uses 320px at wider widths and 296px in the 760–1059px range; plot height is `clamp(320px, 40vh, 360px)`.
- Styled chart mode controls, clipped chart annotations, holdings, empty-state copy and event navigation to match the TradeReview dark surfaces and blue selection/action cues.
- Ordinary event cards use neutral slate surfaces with restrained blue event labels; the event list and holdings list have local scroll bounds so their content does not enlarge the plot.
- Added a fixed right-side 420–480px drawer layer with its own scrollable content and sticky actions. It covers the portfolio sidebar without changing the chart/timebar layout.
- Kept the `max-width: 1059px` and `max-width: 759px` responsive behavior. At widths covered by the task, the desktop grid stays active.
- Added an explicit `.running-prototype[hidden]` rule because the component deliberately keeps its chart mounted while hidden to retain the viewport.

## Verification and limits

- Reference screenshots above were opened and visually inspected at their supplied image sizes. The visual contract records the CSS viewports (1440×900 and 1280×800, 100% zoom; DPR 1 for those captures); the 1440 reference export is scaled by its capture tool.
- Implementation verification: **NOT VERIFIED** in a running browser. The coordinator owns browser operation and must check the CSS against actual rendering and the TSX changes.
- Functional journey / end-to-end behavior: **NOT VERIFIED** by this style owner; no browser interaction or build/test was run under this bounded CSS task.
- Visual rendering comparison: **NOT VERIFIED**. This report must not be treated as an independent review or visual PASS.
- Database persistence: **NOT APPLICABLE** to this CSS-only change and in-memory prototype.
- Follow-up owner: `/root` for integrated 1440×900 and 1280×800 screenshots, CSS adjustment if required, and the independent acceptance handoff.

## Follow-up from coordinator review

- Source: [independent review](../acceptance/reviewer-01.md), including V01-04 and the coordinator's fresh desktop screenshot observation.
- Changed `.account-total b` to the same neutral slate used for other portfolio values; positive/negative colors remain limited to signed return values. `.holdings-foot b` remains neutral as well.
- Raised both the “下一已知事件” label and its date/type line from 10px to 12px. Set the button to a 40px minimum height and a 160px maximum width so the full known date/type fits within the 296px sidebar while leaving space for the section title.
- Static selector review: **PASS** for the requested neutral account amount styles and 12px event-navigation text. Browser follow-up: **NOT VERIFIED** by this style owner, as the coordinator retains browser ownership; the coordinator should confirm the 1280px title/button fit in the fresh rendering.
- No business/model/chart color changes and no build or tests run.

## Follow-up for T0 origin label

- Styled the newly added `.chart-origin` as 12px muted, tabular-neutral auxiliary text with `white-space: nowrap`.
- Allowed flex wrapping within `.chart-heading` and gave the title block a 170px flexible basis, so the origin label and chart tabs can move to another heading row when their combined width requires it. The chart shell retains `min-height: 320px` and its existing desktop height rule.
- Static CSS inspection: **PASS** for the requested font, color, nowrap, wrapping scope, and unchanged chart minimum height. At-viewport rendering: **NOT VERIFIED**; coordinator browser check remains authoritative.
