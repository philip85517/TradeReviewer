# F current supplement independent harness diagnosis

First run `F-acceptance-2-tests.log`: 283 PASS / 3 FAIL. The three coordinator fixtures supplied a same-business-day daily candle while using an instant cutoff. The approved F quote boundary deliberately excludes unfinished same-day daily candles for instant asOf (`quoteFor`, c.tradingDate < boundary.day). `quote-missing` is correct for that fixture; these expectations were invalid, not a product rejection. Changed only the fixture candle tradingDate from January 22 to completed January 21; fills, asOf, numeric expectations unchanged. Original log retained.

Copied two trace-producing tests initially retained their F-data-prep output prefix. They wrote current supplemental traces, never the historic F-fix evidence. Prefix now isolated under coordinator/F2-traces; integrity is rechecked before acceptance. No product source edited.

The next run retained one failure because the independent short fixture lacked explicit open-short evidence. The canonical ledger correctly classified an unproven initial sell as incomplete inventory. Added explicit opening/closing position effect evidence only; quantities/fees/expectations unchanged. Invalid harness runs remain preserved, and no product fixes were requested.
