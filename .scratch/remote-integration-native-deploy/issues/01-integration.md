# Remote integration

State: open
Status: in-progress
Assignee: /root
Coordinator: /root
Refs: ../DESIGN-COVERAGE.md G01–G04; current development workflow.
Blocked by: accepted candidate verification and repository merge conditions.

- [x] Read actual changes and verify accepted source/evidence; stage related files without runtime databases or private artifacts. Evidence: ../reports/final-stage-review.md and final-staged-manifest.json.
- [ ] Commit on task branch; push and verify remote head.
- [ ] Create/attach or reuse PR to master; check exact head, required checks, reviews and conflicts.
- [ ] Merge remotely and verify PR/remote master.
- [ ] Safely fast-forward clean local master, preserving unrelated work.

No product modifications, deployment, service restarts, database writes or worktree cleanup are authorized by this integration. User explicitly authorizes push, PR and merge.
