# Version-bound frontend control coverage

Frozen source: history-stats-cards.tsx `1888be1251f49ac47ce30883a6a2a3fda70f23bc0d7b18b43aa37fe4392cdc86`; history-stats-cards.css `2aa7ab4edad05a0aa0c76903577c8fa7ef30152d7280c4264b193f94c3d18842`; history-stats-cards.test.tsx `7e15238ca40b4b31fc3ec2b47775eb5a54ac409395a52173651b6c542831f505`.

Trigger: authorized frontend implementation affects history card layout, readouts, focus and popover lifecycle. Scope is this isolated controlled leaf only. Parent/root owns integrated visual consistency and complete data/persistence flow; worker is implementer, not independent acceptor. No real candidate render was inspected by worker.

Original requirements HV25-32/33/35/47–51; HOME-HP05-B001/HOME-HP09-B001/B031 are text references, original has no stable elementID. Exact source/reference mappings are in ROOT-DISPATCH.md and DESIGN-COVERAGE.md; parent DESIGN-COVERAGE.md was mapped before dispatch.

## Instance inventory and denominator

Four main full-card detail triggers are separately identified below. One portal close button is reused, but its four business contexts are separately counted. The dialog focus surface is part of each detail composite journey; it is not an additional financial control. No navigation, filtering, writes or repair action exists.

|Control instance|Default|Hover|Focus|Pressed|Disabled|Loading|Empty|Error|
|---|---|---|---|---|---|---|---|
|已平仓净盈亏 detail trigger|NV|NV|NV|NA¹|NA²|NV|NV|NV|
|已平仓回合数 detail trigger|NV|NV|NV|NA¹|NA²|NV|NV|NV|
|胜率 detail trigger|NV|NV|NV|NA¹|NA²|NV|NV|NV|
|已扣费用 detail trigger|NV|NV|NV|NA¹|NA²|NV|NV|NV|
|已平仓净盈亏 popup close|NV|NV|NV|NV|NA³|NA³|NA³|NA³|
|已平仓回合数 popup close|NV|NV|NV|NV|NA³|NA³|NA³|NA³|
|胜率 popup close|NV|NV|NV|NV|NA³|NA³|NA³|NA³|
|已扣费用 popup close|NV|NV|NV|NV|NA³|NA³|NA³|NA³|

¹ Original metric manual pressed state is not applicable: readonly metric action has no persistent pressed state. ² Original metric disabled state is not applicable: unavailable/error retains a usable explanation, not disabled information. ³ Close is an immediately available dismissal action regardless of financial data state; it has no disabled/loading/empty/error variant and is never blocked by data failure. A transient pointer/key press of close remains applicable.

64 raw instance×state cells:40 applicable (24 main-card +16 close),24 scope-based NA. Actual browser0/40 attempted,0 PASS,0 FAIL,40 NOT VERIFIED; actual pass rate N/A. This count does not turn39 synthetic tests into real control-state evidence. Expanded/closing/context/reduced-motion and responsive stress journeys are additional checks below, not denominator substitutions.

## Journey coverage

|Journey|Synthetic product evidence|Required independent actual evidence|
|---|---|---|
|HS01|PASS limited to02-green.log: Full9/14,64.3%,order and normal no badge|NOT VERIFIED|
|HS02|PASS limited to02-green.log: Known0% with5 rounds and positive amount|NOT VERIFIED|
|HS03|PASS limited to02-green.log: Known100% is submitted, not inferred|NOT VERIFIED|
|HS04|PASS limited to02-green.log: Explicit empty0/unknown; only explicitly known amounts0|NOT VERIFIED|
|HS05|PASS limited to02-green.log: Unknown net/fees/rate preserve14 rounds and reasons|NOT VERIFIED|
|HS06|PASS limited to02-green.log: Unknown counts, independent rate/wins/amount, available:false|NOT VERIFIED|
|HS07|PASS limited to02-green.log: Null pending four skeletons, nofake0, explanation remains|NOT VERIFIED|
|HS08|PASS limited to02-green.log: Frozen caller old summary retained during pending|NOT VERIFIED|
|HS09|PASS limited to02-green.log: Error retains caller values and reason|NOT VERIFIED|
|HS10|PASS limited to02-green.log: Null initial failure unknown; no local old-summary cache|NOT VERIFIED|
|HS11|PASS limited to02-green.log: Huge precise source strings,FX,coverage,invalid finite/count/rate|NOT VERIFIED|
|HS12|PASS limited to02-green.log: Currency mismatch only money unknown; exact source currency|NOT VERIFIED|
|HS13|PASS limited to02-green.log: sourceId/generation/currency A→B→A no resurrection/focus steal|NOT VERIFIED|
|HS14|PASS limited to02-green.log: Four detail triggers; pointer-synthetic click,key Tab/Enter/Space/Esc,outside/inside|NOT VERIFIED|
|HS15|PASS limited to02-green.log: Same-render group subtree replacement;160ms inert exit,reopen,reduced/mid-exit interruption|NOT VERIFIED|

Actual input modes: mouse NOT VERIFIED; real keyboard NOT VERIFIED; emulated touch NOT VERIFIED; physical touch NOT VERIFIED. userEvent/fireEvent are synthetic jsdom events only.

Root must compare original SVG-derived references against actual frozen render at1440×1000,1280×800,390×1000, A/B boundary sides and very long values,100%zoom,DPR1. Source SVG DPR unspecified. Required motion samples before/during/after must establish160ms opacity/4px,120ms colors without resizing,150ms synchronized data fade and reduced immediate terminal state; CSS text and timers cannot establish visual motion. Measure card/title/value/unit/ratio/affordance/focus/overlay boundaries and downstream displacement.

Functional controlled state contract has39/39 synthetic PASS only. Actual browser interaction gate NOT VERIFIED; independent original-reference visual gate NOT VERIFIED. Real historical calculations, year atomicity with chart/contribution, persistence/reload/full homepage integration remain NOT VERIFIED and owned by root. Database writes are NOT APPLICABLE for this pure readonly leaf, not a waiver of later integration persistence gates.

Root independent acceptance is pending; this is same-task candidate2 with formal leaf1/3 FAIL retained and P4 entire ticket0/3 unchanged. Old MetricCards candidate3 and all prior formal results are independent and unchanged.

Candidate2 adds ten literal percentage tests (three exact high-precision rounding cases, two trailing-zero endpoint precision cases, five invalid/unavailable cases), all passed in02-green.log. Original29 source is an unchanged byte prefix. Candidate1 actual four-dialog finite PASS and normal primary visual FAIL stay historical; neither is fresh candidate2 real-browser evidence. See SPEC-SELF-REVIEW.md and ROOT-ACCEPTANCE-1.md.
