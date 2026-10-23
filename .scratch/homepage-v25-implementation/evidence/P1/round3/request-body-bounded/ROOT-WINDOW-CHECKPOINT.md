# Root bounded observation checkpoint

2026-10-23 05:20 CST. Diagnostic only; P1 remains formal 2/3 FAIL. Root independently ran observer tests: 13/13 PASS. Frozen observer/preload hashes unchanged.

Window 01 never served: sandbox listen EPERM; preserve its startup traces as failed activation, not a non-reproduction. Window 02 explicitly escalated successfully, using the same isolated `.data/tradereview-test.sqlite`, port 3333; launcher PID 41320 and serving PID 41322. Exact activation is retained in chat/tool history and observer README.

Serving trace naturally discovered exact srvx 0.11.15, captured homepage GET materialization with null stream and HTTP 200. Static module requests reached the fixed 100-request budget at 18.469 seconds, before the later UI/non-GET journey. Both process stop markers report restoration failed=0, skipped=0, ownedRemaining=0. Trace summary is ROOT-WINDOW-02-SUMMARY.json. No probe consumer/formatter/bodyUsed getter was introduced.

This result does NOT establish the real request-body failure cause or prove a successful non-GET observation. Non-GET consumer ordering, first swallowed constructor error, and real native-clone private-stream identity remain NOT VERIFIED. Budget exhaustion is a diagnostic coverage limitation; no product fix or automatic repeat was performed.

Root restored service without probe env/NODE_OPTIONS using the exact same isolated database and port: session 88778, serving PID 41518. No database reset. Startup succeeded; real home GET returned 200. UI write/persistence and final-version acceptance remain separately required.
