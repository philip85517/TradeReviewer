# Source selection implementation report

Status: implementation-ready (bounded source-selection scope)

Owner: `/root/deploy_source` (`gpt-5.6-luna`, medium)

## Exact exports

- `resolveReleaseSource({ sourceDir, ref = "current" }, dependencies = {})` returns `{ commit, requestedRef, branch, resolvedRef }`. `commit` is a full 40-character SHA; `current` requires application-relevant tracked/untracked cleanliness, supports detached HEAD (`branch: null`), and ignores the deployment copier's local-only directories and credential patterns. `master` performs a forced, explicit `git fetch origin +refs/heads/master:refs/remotes/origin/master` before resolving `refs/remotes/origin/master^{commit}`. Other refs use option-safe `git rev-parse --verify --end-of-options <ref>^{commit}` and tolerate unrelated worktree dirt; local branch refs report their branch name.
- `createSourceSnapshot({ sourceDir, selection, destinationDir })` archives exactly the selected commit, checks archive paths and rejects symlink entries, extracts to a temporary staging directory, filters application secrets/local state using the deployment copy policy, and copies committed regular files into the caller-provided empty destination. It returns `destinationDir`.

## Red/green evidence

The required TDD red run was:

```text
node --test scripts/deploy-source.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../scripts/deploy-source.mjs
```

After implementation, the scoped green run was:

```text
node --test scripts/deploy-source.test.mjs
13 tests; 13 pass; 0 fail
```

The real temporary Git fixtures cover clean and dirty current source, excluded local changes, detached HEAD, explicit refs with dirty worktrees and branch metadata, whitespace-sensitive application paths, tracked `build/sites-vite-plugin.ts` inclusion and dirty rejection, staged and unstaged rename status from an ignored path into application source, remote master advancement, fetch failure without stale fallback, committed bytes versus working-tree dirt, filtered secrets, and committed symlinks. Full SHA validation is also exercised through the injected command boundary.

The required follow-up red run changed the injected resolver to return `deadbeef`; the test failed because the invalid SHA was accepted. A production archive red run also showed that excluding root `build/` omitted tracked `build/sites-vite-plugin.ts`, causing the real build to fail with an unresolved import. The implementation now retains tracked `build/` source while still filtering generated output through Git/archive state, and rejects dirty tracked build edits. The full scoped run passes. Command and archive operations have a 30-second deadline with contextual timeout errors; archive completion waits for both the child process and output stream.

## Scope and limitations

- Files changed for this slice: `scripts/deploy-source.mjs`, `scripts/deploy-source.test.mjs`, and this report only. No commits, pushes, production target/service actions, or business database actions were performed.
- The snapshot uses the host `git` and `tar` executables; the tests exercise both against unique temporary repositories and bare remotes.
- Full application/deployment integration, native process lifecycle, target safety, and browser/database acceptance remain coordinator-owned.
