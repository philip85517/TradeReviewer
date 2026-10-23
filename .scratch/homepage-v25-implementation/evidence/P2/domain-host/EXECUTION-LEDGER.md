# Execution ledger — plan: INTERFACE-AND-ATOMIC-COMMIT-DESIGN.md

- Root approval recorded in ROOT-APPROVAL.md; proposal SHA matches approval.
- Pre-flight: session completion returns explicit S acceptance and whole package; host consumes it in one update. Global context ranges must share exactly the same pure S/source projection as completion. Domain notifications must stay separate from legacy global bootstrap.
- Ruling: keep artifacts in this assigned evidence directory and do not run skill workspace/commit/subagent scripts — explicit root file ownership and no-commit/no-subagent scope override those skill defaults. Cost if wrong: execution bookkeeping differs, not product behavior.
- Task 1 in progress: write session + real hook counterexamples before implementation, preserve all 4 session / 24 host cases.

- Task 1 RED: pinned Node26 Vitest exact session/host files, maxWorkers=1 → 42 new failures + all 28 original cases passed (70 total). RED.log contains seed-slot undefined, missing completion/action API, and configured global extractor/ranges assertions; no product implementation existed.
- Task 2 in progress: implement shared S global/source projection and explicit completion, then independent typed hook owners/timers.

- Task 2 GREEN: GREEN-ATTEMPT-1.log reports 70/70 PASS (17 session + 53 hook) using the original exact command; all original 28 retained.
- Internal shared helpers homepageGlobalReadState/homepageRequestMatches/cancelHomepageLocalReads are exported only between these modules so context projection and publication share S acceptance, and all owner comparisons include domain/generation/scopeKey/startedAt. No date arithmetic outside S except deadline clock.
- Task 3 in progress: scoped strict dependency tsc/lint, then author self-review; root owns independent acceptance.

- Scoped type/lint attempt1 found only new test literal-key widening and React render ref access; corrected typed test tuples, mount capability useState, and unused test params. Attempt2 tsc exit0 and lint exit0 (empty logs). No business assertion weakened.
- Author self-review found accepted invalid collection-address pop kept new local requests because cancellation occurred after validation. Added actual popstate counterexample → RED-GUARDED-INVALID-EXIT.log 1 FAIL (period owner remains); moved local cancellation before collection validation, without changing legacy global routing/validation policy. This is the approved new local lifecycle, not an old global repair.

- Task 3 complete: GREEN-FINAL.log 71/71 PASS (17 session + 54 hook; original 28 retained, 43 new); TSC-FINAL.log exit0; LINT-FINAL.log exit0; NARROW-LEGACY-REGRESSION.log 30/30 PASS across existing navigation-deadline/navigation-recovery/attachment-host. No additional product changes after these checks.
- Root-requested fromGlobal throw, accepted callback throw, collection-only slot preservation and restored source ranges/committed snapshot equality are all represented by actual passing hook cases.
- Freeze at exact four-source fingerprints in FROZEN-SOURCE-SHA256.json, with all 11 protected baseline fingerprints unchanged. SOURCE-SNAPSHOT.patch records full already-untracked source content against /dev/null, not a before/after diff. IMPLEMENTATION-READY.md records version-bound protocol coverage and external NOT VERIFIED gates.
- Author finite self-review complete; root independent acceptance PENDING. Old P1 2/3 FAIL, original host/global/source/navigation FAIL, leaf statuses and counts are unchanged. No active command/test process from this worker. Four source/test files frozen; no HistoryStatsCards candidate2 edit before separate dispatch.
