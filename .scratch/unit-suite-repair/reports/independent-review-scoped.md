# Independent review — holdings and runner bound

Reviewer: fresh `/root/unit_review`; read-only, no tests, edits, services, databases, remote operations or nested agents. Scope: holdings diff from HEAD `63690a494b8ad403081c7720985be54a95db60c7`; runner config compared to `vitest-config.before.txt`. Workspace edits were explicitly excluded while in progress.

Spec compliance: PASS. Code quality: PASS. Critical / Important / Minor findings: none in these two hunks.

The holdings fixture adds only a fixed `asOf` at test line 516. It preserves the invalid source date, market-calendar fallback, quote date, 30-day freshness window and both available assertions. The source prioritizes marketCalendarDate before execution-derived date; the September 2 quote is 17 days old at the fixed September 19 valuation time instead of 34 days old at the October 6 real clock. The test still catches an incorrect fallback to the later execution date. No production clock or stale-quote behavior changed. Existing red and case/full green logs support the scoped conclusion (1/1 and 30/30).

The runner delta is exactly the maxWorkers:2 setting plus its comment. Installed Vitest honors configured worker counts before CPU defaults, keeps isolation enabled and retains the original jsdom 5000ms timeout. Setup, includes, aliases and pre-existing native exclusions remain intact. The affected-file report has 270 passed / 3 failed, with all three failures in the unfrozen workspace file; it supports the bound's resource rationale but cannot prove full-suite success.

Root accepts these two scoped code changes. Bare full Vitest, both native command entrypoints, typecheck, scoped lint and final workspace review remain pending. Earlier native deployment work is outside this repair's review scope and preserved; all seven existing exclusions are accounted for by the entrypoint audit.
