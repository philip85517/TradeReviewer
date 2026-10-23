# Motion and status static/behavioral audit — candidate 1

Version: exact three products in PRODUCT-SHA256.json. HP09 original lines508–518 and manual hover120ms. This is source/behavioral evidence; actual browser timing and visual smoothness are NOT VERIFIED.

| Interaction | Source behavior | Evidence / scoped result |
|---|---|---|
| Point hover/focus reading | Actual hit target sets current committed reading; point fill and hover-cell fill transition120ms ease-out; no size transform | CSS point/hit120ms; mouse/keyboard same-facts test PASS. Actual pointer timing NV |
| Keyboard focus | 1.5px blue focus-visible rect, no delayed stroke transition | CSS immediate focus stroke; real jsdom Tab/arrows/Home/End PASS. Actual focus outline pixels NV |
| Committed data/mode/currency replacement | One current surface opacity0→1 over150ms ease-out; new source/units are terminal facts immediately; no financial snapshot, path/number morph, delayed stale reading or old-detail restoration | Behavioral animate exactargs and cancellation test PASS; A→B→A5 cases PASS. Actual browser fade NV |
| Replacement/unmount cleanup | Running WAAPI animation cancelled; media listener removed | Cancellation behavioral assertions PASS |
| Reduced motion | CSS removes120ms transitions; initial reduced preference skips WAAPI; change to reduced during active fade cancels it, underlying opacity is immediate1 | Reduced-motion behavior test PASS. Actual browser preference interaction NV |
| Old complete pending/error | Fixed card-contained18px status; updating #6ca8ff, error #f26b78, initial loading #91a5bf; reason text is complete in AX/title | Scoped DOM3 regressions PASS; CSS specificity statically inspected. Actual cascade/color/geometry screenshots NV |

No animation imports/dependencies, service, browser, IO or benchmark added. No popup enter/exit animation was specified for this history reading; it uses the approved direct temporary-reading lifecycle plus shared data replacement fade.
