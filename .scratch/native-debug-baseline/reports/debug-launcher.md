# Debug launcher implementation report

Status: implementation-ready (review fixes applied; coordinator acceptance pending)
Owner: debug_launcher (gpt-5.6-luna)
Scope: `scripts/debug-local.mjs`, `scripts/debug-local.test.mjs`

## Contract implemented

- Standard startup resolves the source only from the current worktree's `conf/runtime.json` and always targets `.data/tradereview-test.sqlite` on `127.0.0.1:3333`.
- Redirecting database/runtime-config environment variables and port/source/database flags are rejected before side effects.
- Native runtime assertion runs before backup or child launch through the agreed `assertNativeEnvironment(options)` module interface.
- The source is opened read-only and copied using Node 26's built-in SQLite online backup API. The temporary copy is checked with `PRAGMA quick_check`, then atomically renamed into place. A failed preparation removes only its temporary file and preserves the previous copy.
- Source/destination aliases, symlink/hardlink targets, open targets, occupied ports, and concurrent launchers are rejected through preflight checks and an exclusive lock held until child exit or signal cleanup.
- CLI preflight uses `lsof` when available to detect a listener on fixed 3333 and an open fixed database target; tests inject equivalent checks without binding a real port.
- Source may remain open and writing while backup runs; source WAL/SHM are never treated as an error or modified. Destination WAL/SHM symlinks/opens are rejected, and safe old sidecars are removed immediately before atomic replacement.
- Native assertion runs before reading runtime config or touching the filesystem. Spawn failures release the lock; Unix children run in a detached process group and cleanup signals the group before lock release.
- Child `PATH` starts with the pinned Node executable directory, then the worktree `node_modules/.bin`, then ambient PATH, preventing a `vinext` shebang from selecting a foreign Node runtime.
- Signal handlers are installed before lock acquisition and backup. An aborted pending backup is checked before quick-check/publication, temporary output and owned locks are cleaned, and destination preflight is repeated immediately before sidecar removal/replacement. Database and sidecar hard links are rejected.
- Existing destination sidecars are moved to unique quarantine names before replacing the main database and restored if the main rename fails; successful publication removes quarantine files. Backup cancellation races the online backup and schedules cleanup of any late temporary completion.
- Direct target hard links are rejected. Shutdown is signal-triggered and bounded; the lock is released only after the detached process group is proven gone. Once the main rename commits, quarantine cleanup errors cannot roll back old sidecars over the new main file.
- The child is launched with `process.execPath scripts/start-local.mjs --dev --hostname 127.0.0.1 --port 3333`, an explicit fixed `TRADEREVIEW_DB_PATH`, and worktree `.bin` precedence in `PATH`.

## Red/green evidence

Initial red run: `node --test scripts/debug-local.test.mjs` failed 2/5 while the injectable spawn seam and symlink assertion expectation were incomplete.

Final green run: `node --test scripts/debug-local.test.mjs`

```
11 tests, 11 passed, 0 failed
```

The tests use unique temporary fixture roots and synthetic SQLite databases, including a genuinely live uncheckpointed WAL source, stale destination sidecars, and cancellation during pending backup. They do not open the configured production database or bind port 3333.

## Dependency note

The launcher dynamically imports `scripts/native-environment.mjs` only for real CLI startup. That file is owned by task 01 (`native_environment`) and must export synchronous `assertNativeEnvironment(options = {})` as specified in the shared README interface. Unit tests inject the assertion and therefore remain runnable before task 01 lands.
