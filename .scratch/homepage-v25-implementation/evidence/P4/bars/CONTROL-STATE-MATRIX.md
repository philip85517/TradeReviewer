# CB01–CB15 version-bound coverage — candidate 1

Version is the3product SHA256 values in PRODUCT-SHA256SUMS; HEAD5a94ee3ff76e32993fe2c4791a83b40e877a7344. Trigger: new frontend native controls, signed bar layout and controlled readout state. Scope: this pure list/bar leaf; host controls, qualification, actual routing/data/persistence, page visuals excluded and still required by root. Root acceptance round0/3. Current immutable fixture has5signed rows; dynamic boundary fixtures cover3named market identities and8instrument identities. No whole-page or100% claim.

`synthetic` means testing-library/user-event in jsdom. It is not real input, visual comparison or browser layout. All final synthetic results below reference GREEN.log (22/22). Real mouse/keyboard/emulated/physical are each NOT VERIFIED for every row, worker numerator0; no silent aggregation.

| ID | Finite repeat / controls and prerequisite | Synthetic observed / counterexample | Static style evidence | Real mouse | Real keyboard | Emulated touch | Physical touch | Independent visual / owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CB01 |3market actions+3readouts, suppliedCN/HK/US |PASS each action returns its original identity; each detail opens correct title/Esc exact focus; no extra activation |70px pitch, commonzero declaration |NV |NV |NV |NV |NV root |
| CB02 |8symbol actions+8readouts, current supplied page |PASS each exact account/instrument/nature/run object; order remains supplied; all8detail titles/Esc exactfocus |43px pitch, eight-slot reserve |NV |NV |NV |NV |NV root |
| CB03 |each supplied row detail and independent total detail |PASS prepared777raw, original123.456789USD, FXsource/asOf/id/status, coverage3/3; total987654.321987CNY survives page replacement |264pxouter,12pxpadding,fixed overflowwrap |NV |NV |NV |NV |NV root |
| CB04 |native action/detail Tab/Enter/Space |PASS focused action Enter+Space activates twice; next detail Space opens/focuses dialog, no activation |2pxfocus declaration;36/44pxcontrols |NV |NV |NV |NV |NV root |
| CB05 |inside,Esc,trigger-focusedEsc,outside,close; floating position |PASS inside stays; each close returns exact original connected opener; parentEscape remains untouched; literal mocked rect clamp12px and256px |fixedviewportboundreadout; no layout push declared |NV |NV |NV |NV |NV root |
| CB06 |mixed+,mixed-,net0 |PASS literal left/width37.5/12.5and25/25 on opposite sides; net0retains2nonzero parts |sameouter14px,zero50% |NV |NV |NV |NV |NV root |
| CB07 |same+,bothnegative,zero,tiny,centthreshold±0.005 |PASS contiguous50/25→75/25; negatives35/15→25/10; displayzero no parts; tiny0.01/1000width0.0005%; no net recompute |insetstroke,no minsegmentwidth,signcolors |NV |NV |NV |NV |NV root |
| CB08 |unknown,NaN/Infinity,currency mismatch,total unknown |PASS known part preserved; unavailable不可计算+suppliedreason; invalidreason; foreign—and12.3456USD neverCNY; fulltotalreasonvisible |reasonwrap,neutralunknown |NV |NV |NV |NV |NV root |
| CB09 |current→history supplied closedResult |PASS history has1closed-negative part, raw-32.123456789; no current浮盈 section; mode change dismissesoldreadout |sameheight/axis |NV |NV |NV |NV |NV root |
| CB10 |pending-old committed rows+total |PASS5rows and suppliedtotalstay;正在更新期间shown |reservedlist,inline status |NV |NV |NV |NV |NV root |
| CB11 |rowsnull/fullTotalnull/initialpending |PASS8neutral skeletons,0businessrows,0segments/amounts/0.00 |344pxdesktop/512pxnarrowreserve |NV |NV |NV |NV |NV root |
| CB12 |error-old and initialerror |PASS committed777andtotal stay withreason; initial no inventedrows;0retry/repairCTA |reasonwrap,reserve |NV |NV |NV |NV |NV root |
| CB13 |emptyrows+suppliedreason |PASS explanation;0fakezero/rows/retry |reservedarea,no competingpanel |NV |NV |NV |NV |NV root |
| CB14 |longidentity/source,verylargeexactvalue,roundedzero |PASS full long label/detail source retained; exact123456789012345678901234567890.1234567890123456789CNY/USD; raw-0.0049retained |ellipsisprimary+fullnative title/detailwrap; 80digitdisplaymath |NV |NV |NV |NV |NV root |
| CB15 |immutable rows/currency/mode replacement; wide/breakpoint/narrow |PASS existing one-way replacement assertions hide staleview,555.123456newraw, frozeninputsunchanged. Root flagged CNY→USD→CNY retained-selection restoration risk; unresolved, independent round1 reproduction pending, no restoration assertion. Responsive actual geometry NOT VERIFIED; no layout engine ran |max735container two-line,736+singleline,common50%axis; root-approvedstrategy |NV |NV |NV |NV |NV root |

NOT VERIFIED is abbreviated NV only in the table. Root must use original images at comparable states,1440×1000/1280×800/390×844,100% zoom,DPR recorded, and container widths735/736/737px. Record real scrollWidth/clientWidth, track/segment rectangles and target/focus evidence. Static audit and mocked rects cannot increment those gates.

Leaf DB writes: NOT APPLICABLE (no IO). Actual onActivate navigation/drill, page total identity/qualification, pending version chain, complete data boundary, return/reload/persistence: NOT VERIFIED (root), financial integration remains BLOCKED by frozen A. A prepared fixture proves only view consumption. P4 formal0/3 and financial blocker unchanged.
