# History chart design coverage — candidate 1, 0/3

Trigger: new frontend chart, controls and state wiring. Scope is the standalone controlled history SVG leaf; no host, finance, service or DB changes. Implementer /root/contribution_bars; independent functionality/whole-page visual/complete data-persistence owner /root.

Approved evidence personally read: visual-design.candidate.md lines349–394,467–518; original nine SVGs; complete round5 history HTML/CSS/JS/notes. Faithful 1440×1000 PNG views are in references/. SVG has no DPR; comparison assumed100%, parent real browser DPR1.

Original geometry: card x56,y214,w1328,h320,r10; title x80,y246,16px/600; plot x140..1380,y280..490; semantic labels baseline526,11px; 2px blue line, r3 points; border/grid #283448, card #111a26, muted text #a8b6cb. No extra host margin. Original final month label extends beyond card; narrow implementation must contain it while retaining labels and report any geometry difference.

| Requirement / mapped ID | Exact reference | Journey and owner | Worker evidence (49-case final exact-file run) | Independent acceptance |
|---|---|---|---|---|
| HC01 / HV25-33,34; HOME-HP05-B001 | HP05 357–361; history/cumulative/win/rounds.svg; round5 mode selector | Caller four-mode/month-year selection; leaf | Semantic titles, month/year labels and field selection tests PASS | Root browser NV |
| HC02 / HV25-34 | HP05 361; four mode SVGs, common320px card | Switch modes without axis/plot movement; leaf | Same bounds from all-mode axis extent PASS | Root 1440/1280/390 comparison NV |
| HC03 / HV25-34 | win.svg0/100%; rounds.svginteger; extreme.svgzero | Read actual0/100/negative/count; leaf | Exact endpoints, integer coverage and true-zero points PASS | Root browser NV |
| HC04 / HV25-47 | HP05 389; history.svg no-round zones, cumulative.svg explicit carried caller values | Focus no-round period; leaf | Gap/reason; cumulative only if independently available, parent clarification logged PLAN, PASS | Root browser NV |
| HC05 / HV25-48 | HP05 389; source-missing.svg | Explain missing period; leaf | Unknown breaks path; source reason retained; partial independent known fields PASS | Root browser NV |
| HC06 / HV25-49 | HP05 389; history.svgfuturezone | Focus future interval; leaf | Neutral region; no supplied future number leaks in every mode, PASS | Root browser NV |
| HC07 / HV25-50,51 | journeys-year.svg; error.svg; HP09 467–505 | Initial and old-data pending/error; leaf | Fixed space; old complete data retained; card-contained blue/red reason, PASS DOM/static | Root browser NV |
| HC08 / HV25-47 | empty.svg; HP05 374–376 | Successful empty range; leaf | No fake trend, explicit reason PASS | Root browser NV |
| HC09 / HV25-34,35 | extreme.svg; HP05 361,365 | Long amount/provenance and single point reading; leaf | Exact source, compact ticks, finite geometry, wrapping slot PASS DOM/static | Root browser/overflow NV |
| HC10 / HV25-47–51 | HP05 389; round5 fixture combinations | Adjacent different unavailable states; leaf | Separate regions, no path bridge, exact reasons PASS | Root browser NV |
| HC11 / HV25-35; HOME-HP09-B031 | HP05 365–375; round5 events; HP09 508–518 | Hover/leave/Esc temporary reading; leaf | Same supplied full reading, crosshair, close, no navigation PASS | Root mouse browser NV |
| HC12 / HV25-35 | HP05 365; round5 keyboard handlers | Tab, arrows, Home/End including gaps; leaf | Real focus, same reading as mouse, blur/Esc PASS | Root keyboard NV; touch separate NV |
| HC13 / HV25-35,50 | HP09 495–505 | Caller data/source/mode/currency switch and roundtrip; leaf | Permanent reading invalidation PASS A→B→A | Root integrated chain NV |
| HC14 / HOME-HP09-B001,B031 | HP09 508–518 | Replacement/hover/reduced preference; leaf |150ms atomic fade,120ms color,no morph,reduced cancellation PASS behavior/static | Root actual motion NV |
| HC15 / HV25-35 | HP05 365; HP09 475–489 | Read and move downstream; leaf | No repair/detail navigation; bounded safe reading slot PASS DOM/static | Root downstream/visual NV |

## Separate acceptance gates and version

Final product version: history-chart.tsx `03b9825a52e797b795e6f163697d98acd658d9f2e3a2427747f0d66f0fc4fc5d`; CSS `0db1c089e2d2522ce3a9e0755df6c47353e719f77cb760d4f2d7d2b652df9dfe`; test `b1526865de7b34cea7a9465685baa5b6dbbcf7586638fec917fba112ffed0851`.

Worker exact-file/single-worker functional tests: 49/49 PASS in green-candidate1-final.log. Scoped strict tsc and ESLint --max-warnings0 PASS in corresponding final logs. Earlier shared dependency tsc FAILs are preserved and were fixed only by their original owners. No full build/suite or benchmark run.

Minimal real-browser prerequisite: root limited PASS in ROOT-MINIMAL-JOURNEY-GATE.md applies only to its recorded minimal version, before this expansion. It proves permission to continue, not final feature acceptance. Final SHA-bound real-browser functional journey, screenshot/reference visual comparison at1440×1000/1280×800/390×1000 and responsive boundaries: NOT VERIFIED by worker. Root owns these gates. Actual mouse and keyboard final-version evidence are NV; emulated touch and physical touch are separately NV.

Host financial calculations, three-part atomic year replacement, integrated context/data chain and details return/reload/persistence: NOT VERIFIED future integration. DB writes N/A in this leaf because it exposes no IO or write action. No runtime monitor or financial acceptance was added. History candidate1 remains0/3; P4 remains0/3. Old ContributionBars remains frozen3/3 FAIL.

## Version-bound controls and states

CONTROL-STATE-MATRIX.md binds HC01–15 to the final three hashes and raw test names. Each caller period has a focusable real SVG hit target, including all gaps and every crowded annual period; arrows/Home/End and leave/blur/Esc use the same supplied reading. Mode/range/repair/navigation controls remain caller/HistoryControls scope. No callbacks or writes are added.

## Authorized local responsive differences

Root explicitly authorized and asked this worker to append the three decisions to ../ROOT-DISPATCH.md: card-contained y44–62 old-data status band; measured single/two-row labels at y298/312; dense annual visual ticks only after two rows fail, preserving first/last and every point/AX/keyboard/reading. See AUTHORIZED-DEVIATIONS.md for exact budgets, boundary rule, RED→GREEN evidence, and outstanding visual NV. No threshold based solely on viewport width remains. Normal monthly12-point desktop reference keeps all labels on one row; 1328px card40-year fixture also restores all single-row labels. These local adaptations are coordinator-authorized proposals pending actual comparison, not direct visual proof from original artwork.
