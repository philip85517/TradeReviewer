# Version-bound control/state matrix — HistoryChart candidate 1

Trigger: new frontend chart controls, interaction, layout and state wiring. Scope: only standalone controlled HistoryChart; parent owns final browser functionality, whole visual and complete data/persistence acceptance. References/IDs: DESIGN-COVERAGE.md. Candidate1 remains0/3, P4 remains0/3. Worker test PASS is scoped preparation only.

Version: TSX `03b9825a52e797b795e6f163697d98acd658d9f2e3a2427747f0d66f0fc4fc5d`; CSS `0db1c089e2d2522ce3a9e0755df6c47353e719f77cb760d4f2d7d2b652df9dfe`; test `b1526865de7b34cea7a9465685baa5b6dbbcf7586638fec917fba112ffed0851`. Complete49-case output is green-candidate1-final.log, pinned Node26.0.0, exact single include/maxWorkers1. Test-name phrases below identify the literal verbose cases; no mock chart is substituted.

| Case / test count | Requirement and supplied fixture/action | Actual worker assertion / raw test name phrase | Scoped result | Final root browser / visual |
|---|---|---|---|---|
| C01 /1 | HC01/02/11 monthly0,gap,negative; actual SVG hover/leave/Esc; all4 caller modes | “draws supplied values, reads an actual point and gap…”; exact fields, titles, unit and sameplot | PASS | NV |
| C02 /1 | HC03/09 independent scalar null+available, negative fractional wins,101% | “validates each full-reading scalar independently…”; no misleading raw scalar, exact own reason | PASS | NV |
| C03 /1 | HC01 annual2024/2025 and four independently provided modes | “uses semantic annual labels and selects literal rates…”; YYYY/每年 title, rate12.345 rather than2/3 ratio | PASS | NV |
| C04 /1 | HC05 monetary source-missing, count/rate explicitlyknown | “plots an independently known count and rate…”; moneygap, count3/rate12.345 known with reason | PASS | NV |
| C05 /1 | HC04 no-round known cumulative then unknown cumulative | “only draws explicitly available no-round cumulative…”; caller123.456 drawn, unknown not carried/0; other modesgap | PASS | NV |
| C06 /3 | HC06/07 future/loading/error contradictory values; each all4modes | “never leaks any supplied numeric fact from a … point”; no plot/primary/AX/source/coverage leak | PASS | NV |
| C07 /1 | HC05/10 adjacent no-round/missing/future and positive endpoints | “separates adjacent gap semantics…”; separate backgrounds, disconnected paths | PASS | NV |
| C08 /1 | HC03 truezero versus unavailable | “retains real zero at the zero axis…”; zero point/primary0, missing— | PASS | NV |
| C09 /1 | HC03/09 sub-unit signed monetary values | “keeps sub-unit monetary ticks distinct…”; nonzero ticks notall0; exact0.0250 reading | PASS | NV |
| C10 /1 | HC03 supplied rate0/100,count0/137 | “fixes rate endpoints at0/100…”; fixedpercentageaxis, integercounttickscover137 | PASS | NV |
| C11 /1 | HC09 30-digit integercount at342card | “keeps an extreme caller integer count exact…”; plotwidth>180, integer-valued scientificticks, exactfullcount | PASS | NV |
| C12 /6 | HC03 invalid rates101/−.1, counts1.5/−1, NaN/Infinitymoney | “fails closed on invalid…”; no drawn value, primary—, precise reason | PASS | NV |
| C13 /1 | HC13 targetUSD but reportCNY | “fails closed on currency mismatch…”; unavailableprimary, sourceUSD retained, no CNY relabel | PASS | NV |
| C14 /1 | HC09 extreme signed30digit+20fraction singlepoint,2originalcurrencies,longFX,10001coverage | “preserves exact huge signed monetary strings…”; r3 finite point,亿ticks, exact source/fx/asOf/coverage | PASS | NV |
| C15 /2 | HC07 globalinitial pending/error no submitteddata | “keeps initial … space…”; card320, nofakecurve, distinctloading/error state | PASS DOM/static | NV actual stablegeometry/color |
| C16 /2 | HC07 complete old data during pending/error; then caller removesolddata | “keeps complete old props and range…”; exactoldlines/range, cardcontainedstatus, no leafcache | PASS DOM/static | NV actual stablegeometry/color |
| C17 /1 | HC07/09 longolddatafailure reason | “keeps a long old-data failure reason complete…”; fulltitle/AX/textinsidecard, same84/66/1312/276 plot | PASS DOM/static | NV actualellipsis/readability |
| C18 /1 | HC08 successfulempty with contradictorydata | “honors successful empty range…”; no path/hit/fakezero orrepair | PASS | NV |
| C19 /5 | HC01/02/15 all12monthlabels at342/430/520/1168/1328card | “keeps every semantic label, staggering only…”; measuredcrowding rows, all4sameplot/samelabelrows | PASS measuredfixture | NV actualfonts/viewports |
| C20 /1 | HC01 measured12annualwidth32 at430, then short3monthrange | “uses measured annual label widths…”;2rows onlyasneeded then1row | PASS measuredfixture | NV |
| C21 /2 | HC01/12/15 30/40year342card, then1328 | “thins only crowded visual year ticks…”; nonoverlapping2rows, first/last, ALLhits, omittedyearkeyboard/exactvalue, all4modechoice; desktoprestoresall1row | PASS measuredfixture | NV actual390/desktop |
| C22 /3 | HC01/02/15 40yearcard759/760/761 | “keeps annual labels readable around the former760px breakpoint…”; all40on2rows, spacing≥30px with measured26pxlabels | PASS measuredfixture | NV realboundary |
| C23 /1 | HC12 actual Tab/ArrowLeftRight/HomeEnd/Esc/gap/downstreambutton | “uses real Tab focus, arrows, Home and End…”; DOMfocusall, gapsreadable, Escstaysfocused, downstreamreachable | PASS jsdomkeyboard | NV nativekeyboardfinalversion |
| C24 /1 | HC11/12 samepointmouse thenkeyboard,leave/blur | “gives mouse and keyboard identical reading facts…” | PASS event/DOM | NV nativemousefinalversion |
| C25 /5 | HC13 data/source/generation/mode/currency A→B→A | “permanently clears reading through …”; no oldtooltip/crosshair restoration | PASS | NV integratedcontext |
| C26 /2 | HC12 endpointfocusrect3/12period342card | “contains endpoint focus rectangles…”; right≤340,left≥2, sameallmodebounds | PASS measuredfixture | NV actualoutlinepixels |
| C27 /1 | HC14 replacement and unmount | “fades one atomic surface150ms…”; terminalnewunits, exactWAAPIopacity150easeout,cancelobsolete | PASS behavior | NV actualmotion |
| C28 /1 | HC14 reduced preference initially and duringfade | “shows reduced-motion replacement directly…”; skip/cancelanimation | PASS behavior | NV browserpreference |

Hover120ms CSS/focus-immediate/static status cascade are separately audited in MOTION-STATIC.md; source assertions do not replace actual browser cascade/timing. Card status safety-band/rows/dense-year differences and original right-inset difference are disclosed in AUTHORIZED-DEVIATIONS.md.

Root's historical minimal browser prerequisite is limited PASS only on the versions in ROOT-MINIMAL-JOURNEY-GATE.md. Final version mouse, keyboard, responsive visual, downstream/longreading and reduced-motion browser gates remain NOT VERIFIED independently. Emulated touch: NV; physical touch: NV. No test here is labeled actual browser evidence.

Excluded: host mode/range controls, range request/retry, financial calculations/FX/attribution/ratios/cumulative/known-subset totals, three-part atomic replacement, server, DB, detail return/reload/persistence. Host-level data/persistence integration is NOT VERIFIED future work; DB writes are N/A for this no-IO leaf. Old ContributionBars3/3FAIL remains frozen, no reset or integration bypass.
