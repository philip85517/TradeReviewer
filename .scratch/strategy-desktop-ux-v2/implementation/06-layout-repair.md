# 06 layout repair — X06-02

- Scope: compact the recovery area that was pushing the chart below its approved first-screen height. The repair is limited to `recovery-prototype.tsx` and `recovery-prototype.css`; the controlled props, parent runtime, and clock behavior are unchanged.
- Sources: approved DD02/DD11/DD13 in `docs/specs/2026-09-29-strategy-desktop-ux-design.md`; C22–C23/C28 in `DESIGN-COVERAGE.md`; `INTEGRATION-06.md`; the X06-02 entry in `issues/06-bulk-reveal-and-recovery.md`; and the pre-repair execution-failure/lagging screenshots plus the 1280/1440 TradeReview references.

## Repair

- Put the bulk-reveal control and collapsed demo-tools disclosure on the same recovery row. Opening the disclosure expands its contents naturally below the row.
- When an excluded incident and a lagging state refer to the same portfolio, show one feedback card. It keeps the failure date, current view date, last complete date, and chart/ledger cutoff visible; the reason remains available in a keyboard-accessible disclosure. “View last complete day” and “Return to portfolio list” appear once.
- Keep unexcluded failures fully actionable in one compact card: affected portfolio, failed day, last complete day, reason, retry, exclude, and list return remain visible together. The chart/ledger boundary stays explicit for a merged lagging state.
- Keep failure and boundary copy at 12px, maintain the existing 36px minimum control height, and reduce card padding/stacked heading space. The chart dimensions and parent layout are untouched.

## Verification

- `npx eslint app/components/strategy-prototype/recovery-prototype.tsx` — PASS.
- `npm run typecheck` — PASS (`tsc --noEmit`, exit 0).
- Browser/rendered visual comparison — NOT VERIFIED by this implementation task. The coordinator owns the existing-tab check and final screenshots; the pre-repair failures remain preserved, and this report does not claim a visual pass.
- Functional journey, keyboard focus, and browser screenshots — NOT VERIFIED here; the controlled props and callbacks were not changed. Root and the independent reviewer own those gates.
- No tests, browser, database, API, or commit actions were run.

## X06-03 — Preserve the event panel in the 1280 failure state

- Finding: the independent review of [`failure-fixed-1280.png`](../screenshots/06/failure-fixed-1280.png) showed the exposure notice covering the event heading/navigation and reducing the event card to a thin strip. I directly inspected that screenshot and the read-only side-panel markup.
- Cause: `.running-side` assigned `minmax(0, 1fr)` to the event row while the holdings and exposure rows kept their automatic heights. At the 1280 viewport, those rows consumed the available side-panel height; `.event-block` then allowed zero height and hid its overflow, so its heading and controls lost usable space.
- Repair: make the side panel its own thin-scrollbar vertical region, give the event row a 216px minimum, keep the exposure notice as the final normal-flow row, and prevent the event heading from shrinking. The event list continues to scroll within its existing height cap and can grow to fill available event space. Event navigation buttons retain their existing 36px/40px minimum heights. No chart sizing, recovery UI, runtime, hooks, model, or data behavior changed.
- Verification: `npx eslint app/components/strategy-prototype/running-prototype.tsx` — PASS; `npm run typecheck` — PASS (`tsc --noEmit`, exit 0). Rendered post-repair appearance remains **NOT VERIFIED** by this implementation task; root is capturing the 1280 failure state and the independent reviewer must recheck it. No browser/database/API/commit actions were performed here.
