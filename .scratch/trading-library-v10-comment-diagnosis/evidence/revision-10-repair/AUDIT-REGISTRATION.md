# Revision 10 audit registration

Trigger: user requested fixes to comment findings concerning navigation layout, statistics, chart representation and home consistency. Version: final dirty-content hashes recorded after build; pre-change manifest preserved in ../revision-10-repair-before. Service: start-preview.sh, localhost3090, static docs, session38862 inherited and actual browser open verified. Data: fixed library-design-fixture.json synthetic sample; original database untouched. Browser desktop CSS1440×900 and1280×800, explicit viewport override DPR1, browser native zoom not independently controllable; capture measured geometry. Root owns integration/record, independent reviewer owns separate rendered visual gate.

## Scope and inventory

Prototype whole page affected; all interactive elements registered after DOM/source inventory (not fixed denominator guessed before implementation). Product navigation icons and unrelated actions should be static labelled context or omitted. Scope states: A/B/C × real/sim × list/stats =12 normal states; loading/empty/error and long-date boundary compared in both widths where layout differs. Scheme changes preserve mode/tab/conditions. Mode changes preserve each mode conditions and tab. Reload resets demo by explicit contract. No async service data or persistence promise. Mouse/keyboard tested separately; physical touch and DB not applicable to desktop static design deliverable. No requested item excluded.

| ID | Action/journey | Expected / counterexample | Owner | Result |
|---|---|---|---|---|
| NAV-SCHEME-A/B/C | switch3 schemes in same mode/tab/range | distinct hierarchy, unchanged data; no reset disguised as scheme choice | root+independent | PASS（本轮候选范围，证据见独立/root报告） |
| NAV-MODE | live↔sim, retain each range/tab | heading, date meaning, account presence and results atomic; no old-data flash | root | PASS（本轮候选范围，证据见独立/root报告） |
| NAV-TAB | list↔stats in both modes | tab semantics/focus, actual content replacement | root | PASS（本轮候选范围，证据见独立/root报告） |
| NAV-DATE | default→long date→mode→restore | visible full dates, correct scope summary/data | root | PASS（本轮候选范围，证据见独立/root报告） |
| NAV-STATES | normal/loading/empty/error | no false zero rates, no stale cross-mode results, clear cause/recovery | root | PASS（本轮候选范围，证据见独立/root报告） |
| NAV-KEYBOARD | Tab, arrows, Enter/Space | focus visible, radio/tab keyboard contract | root | PASS（本轮候选范围，证据见独立/root报告） |
| NAV-SPACE | before/during/after mode+tab; 1440/1280 | controls stable, content height changes intentional, no clipped titles | root+independent | PASS（本轮候选范围，证据见独立/root报告） |
| DATA-C08 | long/short/flat/missing samples and fees | correct denominators, no double fee subtraction; drawdown pending explicit | independent numerical | PASS（本轮候选范围，证据见独立/root报告） |
| DIST-C09 | five intervals rate/amount/selection/return/error | shared count scale, zero width, denominator retained, no paging | independent visual+root | PASS（本轮候选范围，证据见独立/root报告） |
| HOME-C10 | reference vs bound same template, entry/return4frames | source controls/grid/signs/spacing stable, changed data regions declared | independent visual+root | PASS（本轮候选范围，证据见独立/root报告） |
| READER | changed chapter anchors, image viewers, latest10comment localization | actual correct newest content and original comment images accessible | root | PASS（本轮候选范围，证据见独立/root报告） |

Outcome acceptance will record exact attempted/executed/pass denominators separately; no overall100% claim from screenshots alone. Pending final layout/drawdown decision prevents claiming full requirement acceptance.

## 最终范围结论

最终版本见review-package.json，57hash由独立与root分别确认。独立审查的24正常组合、最终1280/1440工具栏、首页1440与6指标/分布稿通过；root完成受影响BT02表格/候选链接、C07–C10定位4/4、首页1280缩略与100%模态及第12帧返回、分布3/3帧。原10评论由字节保真验证；本轮不声称逐条重做前6条的全部UI。最后root1280视口实际1280×900，独立早期1280×800与1440比较证据有效，末轮误标截图已剔除。触控未验证；数据库不适用。上述PASS仅候选阶段，最终布局/回撤定义仍OPEN。
