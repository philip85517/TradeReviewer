# Literal caller harness instructions — root independent acceptance

This is a usage guide, not an executed browser report or another product. Worker starts/stops no service and opens no browser. Use root's existing literal React/Vite harness/service. Current root-owned minimum entry is `.scratch/homepage-v25-implementation/evidence/P2/selector/root-browser/history-minimal.html` with `history-minimal-harness.tsx`, historically served at `http://127.0.0.1:3334/history-minimal.html`. Worker has not freshly checked that URL. Root may extend its own harness; the frozen three products must remain unchanged.

Import the actual product `HistoryChart` and its exported types as the existing minimum harness does. Import its real CSS through the product module. No chart mock, API/DB, financial aggregation or importing Vitest test code into the browser. Caller mode selector is an external native `<select>`; mode values are period-pnl / cumulative-pnl / win-rate / round-count. `reportCurrency="CNY"`; initial `readState={{kind:"ready"}}`. The minimum three-point fixture alone is insufficient for final matrix acceptance.

## Copy-ready dense-year literal data

The following caller-only helper repeats deliberately independent literal financial facts. The loop builds period identities/dates only; it does not compute net/cumulative/count/rate/FX. Place this in root's own harness and use `annual(30)` / `annual(40)`. The exact input value in every year is independent of its position; a hidden visual year still has a hit target and full reading.

```tsx
import type { HistoryChartData, HistoryMoneyMetric } from "../../../../../../app/components/homepage-v25/history-chart";
const money = (value: string | null): HistoryMoneyMetric => ({
  value, available: value !== null, reasons: value === null ? ["该字段未提交"] : [],
  coverage: { total: 7, available: value === null ? 0 : 7 },
  money: { originalByCurrency: value === null ? {} : { CNY: value }, targetCurrency: "CNY", conversion: "same-currency", fx: null },
});
const scalar = (value: string | null) => ({ value, available: value !== null, reasons: value === null ? ["该字段未提交"] : [] });
function annual(count: 30 | 40): HistoryChartData {
  const labels = Array.from({ length: count }, (_, index) => String(1980 + index));
  return { sourceId: `root-literal-${count}-years`, requestGeneration: "literal-1", grain: "year",
    range: { label: "全部", start: `${labels[0]}-01-01`, end: `${labels.at(-1)}-12-31`, timeZone: "Asia/Shanghai" },
    points: labels.map(year => ({ key: year, label: year, start: `${year}-01-01`, end: `${year}-12-31`,
      state: "value", reasons: [], periodNet: money("-12345.678900"), cumulativeNet: money("98765.432100"),
      roundCount: scalar("3"), winningRounds: scalar("2"), winRate: scalar("12.345"),
    })),
  };
}
```

Keep `data` immutable and stable between unrelated renders; intentionally create a new object for committed replacement. Do not mutate point objects in place. The leaf does not resolve range/financial consistency or create missing counts for the harness.

## Required caller fixtures and external controls

CONTROL-STATE-MATRIX.md is the complete49-case functional inventory, not a native-browser PASS. Root can provide external native selects/buttons for the following immutable literal fixtures and props; these controls belong only to the harness. Give each a visible unique label and keep a downstream focusable button after the leaf.

| Caller control/fixture | Required literal facts and props | Native check |
|---|---|---|
| Mode | Existing4-value mode select; hold the same committeddata | Exact0 /98765.432100 /12.345% /3 reading on knownpoint; no ratio/cumulativecalculation; identical card/plot/labelselection |
| Standard monthly12 | Twelve keys/labels1月…12月; literal positive/negative/zero values, a no-round gap and trailingfuture | Desktop1440/1280 singleline labels;390 actualspacing may2row; all12retained; defaultcard320 |
| Annual short | Explicit2024/2025/2026businessintervals and yeargrain | SemanticYYYY and每年净盈亏; all4mode selection |
| All30 / all40 years | annual(30) / annual(40) above |390 first/last/selectedvisualticks nonoverlap; omittedvisualyears stillTab/ArrowLeftRight/HomeEnd+AX+exactreading; all4samechoice.1440 all40 labels1row when actualspacingfits. Also inspect actualcard widths759/760/761 with all40; no hardbreakpoint inversion |
| Gap states | Separate adjacent no-rounds/source-missing/future/loading/error with callerreasons; deliberately contradictory availablefinancialnumbers forfuture/loading/error | Distinctregions, no bridgedline. All4modes:future/loading/error expose no financial facts even in reading/AX. source-missingcount/rate may drawif independentlyknown |
| No-round cumulative | no-rounds with cumulativeNet explicitly123.456, then unavailablecumulative | Knowncumulative only draws exact123.456 withreason; unknownnotcarried/0; othermodeskeepgap; independentcount may be explained |
| Initial pending/error | data=null and matchingreason | Card320, nofakecurve; grayblueinitialwaiting versusredfailure; downstreampositionstable |
| Olddata pending/error | Hold identical completeolddata andrange; setkindpending/error withreason | Sameplot/card/downstreamposition; status onlyy44–62, updatingblue/errorred. Thenreasonrepeat30times:singlelineellipsis visually, fulltitle/AX/text |
| Empty | kindempty and literalreason, includingcontradictorydata | No curve/points/targets/fakezero orrepairentry;card320 |
| Small/large/invalid | Values from C09/C11/C12/C13/C14 in CONTROL-STATE-MATRIX | Nonzerofractionalaxisnotall0; 30-digitcountfullreading; full30digitmoney+20decimal/provenancewraps; invalid/mismatchprimary—withreason |
| Context A→B→A | Separatebuttons replace data/sourceId/requestGeneration/mode/currency; return originalidentityafterB | OpenreadingA clears atB, remainsclosed onA; nooldtooltip/crosshairresurrection |
| Motion | Externalcommitdata/mode/currency buttons; browserreducedmotion preference | Currentterminaldata150msfade, hovercolor120ms, immediatefocusstroke; reducedskip/cancels; no crossunitpathmorph |
| Reading navigation | Real SVGpoint andgap targets, externaldownstreambutton | Nativehover/leave, Tab/arrows/HomeEnd, Escclosesandkeepsfocus, blurcloses, mouse/keyboardfactsagree, downstreamaccessible |

## Matching comparison and evidence

Use1440×1000 /1280×800 /390×1000,DPR1andexplicit actualcard widths around responsivecrowding. Originalreference9SVGs/faithfulPNGs are mapped in DESIGN-COVERAGE; AUTHORIZED-DEVIATIONS records the safe-band/rows/tickselection/normalflowreading/rightinset differences for direct judgment. Capture default/all4modes, gaps,oldpending/error, longreading, denseyears and focusendpoints. Measure geometry and also directly inspect screenshots; no DOM/nooverflow assertion replaces independentvisualcomparison.

Record mouse, keyboard, emulatedtouch and physicaltouch separately; preserve mistakenactions and distinguish harnesserrors fromproductdefects. Root's historical minimal limitedPASS cannot accept the finalSHA. No DBwrites are needed for this pureleaf; actual financial/atomicthreepart/hostcontext/return/reload/persistence remain separate futureintegrationNV. A liveURL checked byroot is partoffinalUIdelivery, which this worker is not claiming.
