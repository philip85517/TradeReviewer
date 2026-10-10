# Observe regression implementation · 2026-10-09

Implementation owner: Luna. Scope was limited to the four strategy prototype files named by the regression contract. Existing running state, replay model, chart initialization, fixed chart dimensions, route semantics, and unrelated working-tree edits were preserved.

## Changes

- Added a compact local preview navigation bar and a closed native preview-tools disclosure. The always-visible summary now includes the synthetic-demo label, current scene, and current visual theme; the original scene entries, explanation, controls, reset behavior, and route links remain available.
- Unified observe page flow to natural document height. Recovery shares the running content max width and alignment, the chart remains before the side rail at `max-width: 1023px`, and the original desktop side rail remains at wider widths.
- Kept top summary KPIs at `24/32/500`; reduced holding, cash, net-value, and total values to `14/22/500`. Important numeric strings can wrap without ellipsis or clipping. The narrow summary uses two columns through 1023px and one column below 360px.
- Applied explicit CJK fallback order and `14/22` body plus `12/18` auxiliary roles to recovery/menu/drawer content. Narrow running controls and standalone event/drawer icons use 44px hit areas; desktop icon boxes remain 36px.
- Moved the running-only narrow header/timebar/portfolio/chart-switch layout rules to one ≤759px block, leaving results/compare responsive rules at ≤600px. Preview links and the native tools summary use 44px controls at ≤759px and on coarse pointers; preview links keep a 6px radius and the `2px #9ecaff` focus ring.
- Set portfolio tab names to `14/22/500` with complete wrapping and capital sublabels to `12/18`. Drawer headings/body/auxiliary roles now explicitly use `18/26`, `14/22`, and `12/18`; legacy 13px and inline trade-title sizing are overridden within the unified theme. Coarse-pointer event navigation and drawer close controls are 44×44.
- Recovery demo chrome now assigns the summary and nested auxiliary text `12/18`, demo labels/select controls `14/22`, and explanatory notes/small text `12/18`, overriding the legacy 11px and `1.45` line-height roles within the observe theme scope.
- Final source token corrections set unified scene buttons to a 6px radius and drawer headings to `18/26/600`.
- Final recovery role pass makes reason details and config exposure `12/18`, with primary/secondary recovery actions at `14/22/600` and `14/22/500`; recovery kickers are `12/18/400`.
- Made selected holdings use a complete `1px #3797ff` boundary and retained the focus outline contract. Replaced the event back glyph and drawer close glyph with Lucide icons at 18px and stroke width 1.75.

## Verification

- `npx eslint app/components/strategy-prototype/full-workbench-preview.tsx app/components/strategy-prototype/running-prototype.tsx` — passed.
- `npm run typecheck` — passed.
- `git diff --check -- app/components/strategy-prototype/running-prototype.tsx` — passed.
- Fresh browser viewport calibration and acceptance screenshots remain owned by the coordinator; service 3069 was not restarted or changed.

## Bounded follow-up · R09/R10

- R09: removed the unified ≤759px forced-column treatment from preview context/tools and the running header, timebar, portfolio selector, chart switch, and chart heading. These containers now retain their existing content-driven flex wrapping and DOM order, while narrow controls keep 44px hit areas and the source narrow chart height remains 280px; the desktop/tablet chart keeps its original `clamp(320px, 40vh, 360px)` with `min-height: 320px`. The legacy 296px side rail rule between 1024–1059px is scoped over to the contract’s 320px rail. Results/compare responsive rules remain outside this running-only adjustment.
- R10: added a pure marker-label geometry helper in `running-prototype.tsx`. Unified marker labels use the actual Lightweight Charts time coordinate and measured canvas text width, reserve an 8px gap, prefer the newest event, and blank only dense labels while retaining every marker’s date, shape, position, color, and size. Labels at the visible plot edge are blanked when the complete label cannot fit, using `timeScale.width()` for the plot width; T0 remains the separate below-bar marker. Original-theme labels remain unchanged. Marker updates reuse the existing range, resize, data, and theme-update paths and use a render signature cache to avoid redundant `setMarkers` updates or a range/update loop.
- The existing unified menu and drawer typography overrides now also set menu/trade title weight to 500; no business data, event handlers, chart initialization, range restoration, cutoffs, or persistence code was changed in this follow-up.

## Follow-up verification and limits

- `npx eslint app/components/strategy-prototype/full-workbench-preview.tsx app/components/strategy-prototype/running-prototype.tsx` — passed after R09/R10.
- `npm run typecheck` — passed after R09/R10.
- `git diff --check -- app/components/strategy-prototype/running-prototype.tsx app/components/strategy-prototype/full-workbench-preview.css app/components/strategy-prototype/workbench-visual-theme.css` — passed after R09/R10.
- Browser screenshots, 760/759 and 601/600 geometry, 390/320 reachability, marker collision inspection, playback, theme switching, and source-return journeys remain NOT VERIFIED here because the coordinator owns the running browser and acceptance database. A remaining visual risk is that Lightweight Charts supplies no independent horizontal text offset for a marker; when distinct event types share the same measured interval, the helper preserves the newest complete label and blanks the older dense label. The event point and full side/drawer detail remain available for that event.

## R09/R10 calibration correction

- Restored explicit `flex-direction: row`, content-sized header actions, a non-forced title basis, natural timebar widths, and content-sized chart-switch buttons in unified ≤759px running chrome. At ≤430px the chart switch itself may take a full row so its two 44px buttons stay together and the K-line select gets its own complete row; the chart title/origin still use their own natural flex items. The source ≤759 chart height remains 280px.
- Marker edge checks now use Lightweight Charts `timeScale.width()` instead of the outer chart shell width, including single-event layouts; the original-theme all-text early return and T0 below-bar marker remain unchanged.
