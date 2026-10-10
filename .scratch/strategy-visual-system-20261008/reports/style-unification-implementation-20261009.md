# TR-VIS-04 implementation report — 2026-10-09

## Scope delivered

The reversible unified visual layer is implemented in the authorized workbench files:

- `full-workbench-preview.tsx` adds the default `首页统一` / `原版样式` in-place style switch. The existing Running key, reset nonce, business state, fields, viewport state, and navigation contracts remain unchanged.
- `workbench-visual-theme.css` scopes the candidate homepage roles to the complete Observe, Results, and Comparison surfaces. It applies the approved typography, Chinese fallback order, page/surface/raised/border/text/muted/action/focus roles, selected and disabled states, 36px controls, and 44px narrow/coarse-pointer controls.
- `running-prototype.tsx` passes the optional visual theme through the existing component tree. Lightweight Charts use `applyOptions` for switching and initialize from the active theme without chart recreation or `fitContent`; synthetic K-line and P/L colors remain unchanged.
- Narrow rules preserve complete KPI strings, keep timebar actions inside their auto-growing surface, reserve a menu column beside portfolio tabs, avoid header badge overlap, and allow chart view controls to wrap. Results and Comparison headers now flow as a single narrow column; Results KPI values and supporting labels can wrap without the restored ellipsis truncation, and the Results analysis rail stacks below the chart at phone widths. Comparison chart date labels now use separate narrow-screen baselines with the complete result label aligned to the visible frame; allocation readouts receive a local horizontally scrollable SVG surface; comparison summary and ledger tables release their sticky first column so keyboard-scrolled values remain visible.
- Unified kicker/eyebrow roles explicitly inherit their source typography, while chart axes retain their numeric mono exception. Narrow geometry, date separation, table sticky-column release, and allocation chart width are now scoped only to `max-width: 600px`; coarse pointers retain the 44px hit-area rule independently at wider viewports.
- Comparison metrics and full-ledger table cells use the unified 14px/22px body role with tabular numeric values while retaining their existing local horizontal-scroll regions and complete fields.
- The final scope pass keeps narrow geometry and chart/table narrow corrections under `max-width: 600px`, retains 44px hit areas for narrow and coarse-pointer controls, gives unified navigation links a 36px desktop target with a 44px narrow/coarse target, aligns primary action hover/pressed colors, adds actual scroll-region and summary focus rings, and normalizes the remaining in-scope auxiliary roles to 12px/18px.
- The final narrow control correction repeats the running prototype class in the `max-width: 600px` and coarse-pointer overrides so class-qualified 36px rules cannot reduce running buttons/selects below 44px; the narrow chart heading's first child also releases its desktop flex growth to avoid reserving an empty column above the chart.
- Running prototype `summary` controls now receive the same 44px narrow/coarse hit area and unified 2px focus ring as the other controls.

## Verification performed

- `npm run typecheck` — PASS.
- `npx eslint app/components/strategy-prototype/full-workbench-preview.tsx app/components/strategy-prototype/running-prototype.tsx` — PASS.
- `git diff --check` on the authorized implementation files — PASS.
- The running service at port 3069 was inspected in a real browser at the complete Observe fixture. The default unified switch, complete summary values, chart, portfolio holdings, event ledger, and recovery controls were present in the rendered accessibility tree and desktop screenshot. The browser check was an implementation check only.
- In that browser session, switching `原版样式` and back to `首页统一` kept the rendered chart mode (`组合净值`), date (`2024-09-13 · 收盘后`), and complete daily P/L string (`¥1,097.16 · +1.08%`) unchanged. This is a local implementation check, not final acceptance evidence.

## Acceptance status

Independent three-viewport visual comparison, full Results/Comparison journey coverage, style-toggle state preservation across date/portfolio/chart/amount/viewport, replay/source-return checks, and keyboard/touch evidence remain **NOT VERIFIED** here. Root owns the fresh 1440×900, 1280×800, and 390×844 browser evidence and final acceptance. The ticket remains in progress until those gates are recorded.
