# Independent exact-delta review — R13 debug port isolation

Reviewer: `/root/unit_review`. Source review only; no tests, source edits, nested agents, service, database or remote actions. This report is the only written file.

Scope and baseline: `scripts/debug-local.test.mjs` compared directly with `reports/debug-local-test.before.mjs`, because both this test and `scripts/debug-local.mjs` were already untracked in `reports/starting-git-state.txt:19–20`. A Git added-file diff would incorrectly include the pre-existing native deployment work in this repair. Baseline test content hash: `b0037d4723c4433c09453b29316b574bbf1ed2e9`; reviewed current test hash: `3eea1bdd68c6e2d5db0a230e83d2ae166fdfa6ab`. Read production debug source hash: `7c7cff28666fb0f1138d92686302ff4cfdde3f86`.

## Spec review: PASS, scoped

Strengths:

- The exact delta consists only of six `isPortOccupied: () => false` options at test lines 23, 52, 82, 99, 102 and 112, across five existing non-port test cases. No assertions, names, cases, fixtures, existing backup/spawn hooks, error expectations or timeout settings changed.
- The existing seam is used at its intended boundary: production `assertDebugPreflight` selects the injected port probe at `scripts/debug-local.mjs:105`; `prepareDebugDatabase` forwards the same options at 119 (and its later preflights at 125/143); `startDebugServer` spreads options into preparation at 190. The delta changes no production source or API and adds no bypass outside that port-probe seam. Real source/target path checks, file-open checks, lock acquisition, SQLite backup, quick check and publication/error cleanup continue to execute.
- The occupied-port case is byte-for-byte unchanged at test lines 57–61. It still injects true, requires rejection and asserts that no target copy was created. The fixed child contract remains asserted at 83–84, including loopback host and port 3333; the tests do not move the service to another port or start a real child server.
- Original data and failure assertions remain: copy contents and source write isolation at 25–28; previous copy and released lock after failed backup at 53–54; corrupt-copy rejection and previous-copy preservation at 99–101; synchronous spawn error and released lock at 103–104; real AbortController cancellation, rejection, released lock and no published copy at 109–117. The unique temporary SQLite fixtures at 10–18 and each test's cleanup are unchanged. Existing live-WAL, path/symlink/hardlink/open-target/concurrent-lock and sidecar safety cases are unchanged as well.

Critical: none. Important: none. Minor: none.

The exact delta complies with issue08 and DESIGN-COVERAGE R13. Injecting the port result prevents an unrelated live host listener from stopping these backup/launch/cancellation scenarios before their intended branches. It does not weaken the explicit occupied-port rejection scenario or any data-safety assertion.

## Code-quality review: PASS, scoped

The change follows the existing option-injection pattern already used by the live-WAL and sidecar tests (40, 128 and 143). Direct per-call injection keeps scope visible and requires no shared wrapper or new test API. The six substitutions are additive options only; original asynchronous operations and error assertions remain intact. All eleven debug test names/counts and existing timeouts remain unchanged, with no skip, `only`, swallowed-error success path or mocked SQLite result added.

Critical: none. Important: none. Minor: none.

## Evidence and recommendation

Read-only inspection of preserved `reports/debug-test-final.log` confirms the prior host-port failures stop at preflight source 105/119. Root's fresh `reports/debug-test-final-v2.log` now records 15 passed / 0 failed / 0 skipped (11 debug cases plus 4 native-environment cases). This reviewer did not run that command or inspect/control the listener. Root owns the requirement that this run retained the existing 3333 service.

The existing full-suite report records 319 passed files / 3 skipped files, 3064 passed tests / 6 original skips, and the deployment report records 57 passed. This excluded native-test-only delta does not change Vitest-collected code or compiled production behavior; it does not invalidate those earlier frozen results by itself.

Recommendation: accept the R13 exact source delta. The coordinator should confirm the fresh native result and listener condition, then close the overall ledger only after every required gate has evidence. This is scoped Spec/Quality acceptance, not an independent claim that the entire repair has been accepted.
