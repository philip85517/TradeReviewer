# TradeReview agent workflow

For implementation work, follow [the project development workflow](docs/agents/development-workflow.md): the primary agent coordinates; Luna (`gpt-5.6-luna`) is the default implementation model in bounded, disjoint subagent tasks; the coordinator independently reviews and accepts the working feature.

Preserve existing work and original trade data. Use an isolated database for browser tests that write. Do not push, merge, or publish without the user's request.

Use [conf/runtime.json](conf/runtime.json) as the project default for the shared business database and port. Parallel worktrees must retain its absolute database path; do not create a worktree-local business database. Explicit `TRADEREVIEW_DB_PATH` overrides are required for tests or browser acceptance that write. See [conf/README.md](conf/README.md) for configuration precedence.

When the user says “提交修改至远端，并同步到基线” or equivalent, follow the remote integration workflow in [the project development workflow](docs/agents/development-workflow.md): commit on the task branch, push that branch first, create or reuse a PR targeting remote `master`, merge the PR after required checks/review, verify the remote merge, then safely fast-forward local master. That request authorizes the whole sequence; do not substitute a local master merge followed by a direct master push. Report the PR URL and synchronization result. Explicit instructions for the current task override this default.

A completed UI delivery must include a clickable preview URL in the current chat, freshly checked in a real browser with its local service still running, plus verification results and startup instructions. Never claim completion solely from a worker report.

For UI work with a supplied reference design, visual fidelity is an explicit acceptance requirement. Before implementation, record the reference, comparison viewport, layout, density, hierarchy, key states, and authorized deviations. Assign one owner for whole-page visual consistency and one for the complete data/persistence flow.

Functional correctness, end-to-end behavior, and visual fidelity are separate acceptance gates. A reviewer who did not implement the reviewed UI must directly compare its rendered screenshots with the reference design (or documented UI requirements and existing visual conventions when no design is supplied) at comparable viewports and relevant responsive boundaries. Tests, DOM assertions, HTTP success, absence of overflow, and overall scores cannot substitute for visual evidence or cancel unresolved major design discrepancies.

Core write flows must be verified through actual persistence, return navigation, and reload in an isolated database. Passing callbacks or rerendered fixtures do not prove that the application state chain is connected. Keep mouse, keyboard, emulated touch, and physical touch evidence distinct.

Use the [UI task and acceptance templates](docs/agents/ui-task-templates.md) when dispatching or accepting UI work. Claim completion only when every applicable gate has supporting evidence; preserve FAIL and NOT VERIFIED explicitly. Mark a gate NOT APPLICABLE only with a scope-based reason, never to skip a required check. Documentation-only work does not require UI or database acceptance.

Use [local Markdown task tracking](docs/agents/issue-tracker.md). Follow the user's explicit instructions when they override the default workflow.
