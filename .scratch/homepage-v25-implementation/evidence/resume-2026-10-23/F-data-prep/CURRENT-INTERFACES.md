# F additive current projection contract

Status: implementation-ready for coordinator restored acceptance round 2/3. The prior round 1/3 acceptance remains in force for its recorded version. UI NOT VERIFIED.

## Production entry and additive output

Use `buildHomepageV25PerformanceFromEntries(input)` from `app/lib/reviews/homepage-v25-performance.ts`. Its existing required `asOf`, explicit default live scope, original-fill lineage, raw candle selection, money conversion and evidence policies continue to apply.

The existing result now additionally exposes:

```ts
currentUnrealized: HomepageV25Metric;
currentOpenFees: HomepageV25Metric;
instruments: Array<{
  // Existing key and identity: accountId / instrumentId / nature / simulationRunId.
  currentMarketValue: HomepageV25Metric;
  currentUnrealized: HomepageV25Metric;
  currentOpenFees: HomepageV25Metric;
  // Existing evidence.current is retained.
}>;
```

`currentUnrealized` is canonical current gross unrealized minus the F fee pool still retained by open exposure. `currentOpenFees` is that remaining pool, not all fees incurred, period fees or realized fees. Both use the independent `asOf` state; `closingUnrealized` remains the selected period's effective closing state. A historical selected period therefore cannot substitute for current holdings.

Each metric retains `value`, `available`, coverage, classified reasons, original currency subtotals, target currency, conversion status and FX id/source/asOf/status. Same-currency values require no FX. The current evidence retains its actual knowledge cursor, selected original execution IDs, quantity, cost-known/fees-known flags, original fee pool, and selected quote. Current open fees do not require a quote. Current net UF requires trusted quantity, canonical cost, fees and a permitted quote. Quantity uncertainty blocks all current exposure metrics; unknown cost or fees must not erase independently trusted current MV. True flat exposure is numeric zero without a quote.

## P1 consumption

The approved design says the fourth card detail includes current UF (main design line 206), and the current holdings C summary includes holdings UF (line 274). Neither defines a separate gross-UF measure. Under F's accepted fee policy the same scope/asOf/quote/target must therefore use this same net-UF projection. The read-only real-pipeline probe records:

| Original evidence, mark 110 USD | Canonical / existing holdings gross UF | F current net UF | Current open fees |
| --- | ---: | ---: | ---: |
| Buy 2 at 100, fee 2 | 20 | 18 | 2 |
| Then sell 1 at 120, fee 1 | 10 | 9 | 1 |

The additive API supplies the shared result; P1 must not implement another fee or cost ledger. Use identity including nature/run and account/instrument, not instrument alone. A whole account/instrument metric must not be copied onto each episode row and then summed repeatedly. If P1 retains multiple episode rows for one F group, its display grouping or evidence-to-row mapping needs an explicit decision before integration. Local table filters must define their scope before comparing the C summary with the global fourth card detail.

The interface was sent to root and integration_g61 before source changes and confirmed by root. No P2/P4 daily or attribution API was implemented.
