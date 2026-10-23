# Root independent sharing checkpoint — 2026-10-23 05:12 CST

Same P2 ticket; no round reset. P2 formal UI 0/3 remains. This bounded architecture experiment does not pass the original performance acceptance contract.

Frozen performance source SHA256 `094b24161c7714149535cb3c1893ed2fe8304d140ed090ec26a81df3decacd5a`, test `23f73d5a0e7c6758de5ac20f264083562ae41a502e4098b7ee6668e52fab70a8`. Root reviewed full production/test diff, frozen reference, fixture and runner before independently executing `python3 .../immutable-sharing/run-benchmarks.py root-independent` in a coordinated quiet window. No DB/service/browser involved.

| Exact 1866-fill /365-day case | Root cold ms | Repeat maximum ms | Retained accounting bytes | Result |
|---|---|---|---|---|
| single-market rounds, 3 fresh samples |1128.985607 /1168.610030 /1139.703609|5.623950|53,026,188|PASS|
| long-prefix all-buy, 3 fresh samples |1080.099637 /1080.806027 /1098.117899|1.991084|53,658,846|PASS|
| three accounts /three markets sample 1 |2617.548995|4.642301|67,101,836 of67,108,864|**FAIL cold >2000ms**|
| three-market samples2/3 |NOT VERIFIED|NOT VERIFIED|NOT VERIFIED|Runner stopped at first FAIL as designed|

All completed samples retain complete public-byte equality against frozen baseline (operational diagnostics separately preserved), actual cache admission, 365 literal numeric oracles, no extra canonical queries on repeats and immutability checks. Multimarket repeats1.301056/0.988668/4.642301ms. Prepare340.29/batch2277.26ms only locates the stage; it does not establish the expensive internal operation. Full candidate correctness separately passed root's pinned-Node F suite141/141 (`root-F141.log`). These PASS results do not cancel performance FAIL.

Original >15s and all prior candidates/failures remain evidence. There is no fourth optimization candidate. Root approved one read-only exact-fixture worker CPU profile, with no product/fixture/financial/budget changes; profile timing cannot count as formal performance evidence. A subsequent architecture fix requires discussion under systematic-debugging's 'Discuss with your human partner before attempting more fixes'. UI consumers and P4 remain unreleased at this checkpoint. Independent P1 body diagnosis and P3 new-file filter work continue.

Evidence: `root-independent-summary.json`, every `root-independent-*.json/.log`, source/test manifest14 and raw profile (when complete) all in this directory. This is not feature/UI acceptance.
