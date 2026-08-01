# Task 4 report: SQLite operations and runtime scripts

## Delivered

- Added `deploy/ops/backup-db.sh`, `restore-db.sh`, `healthcheck.sh`, and `status.sh`.
- Backups use `sqlite3 .backup` through `docker compose run` with a mounted `data/backups` directory, write a SHA-256 sidecar, and apply retention only to timestamped backup artifacts.
- Restore accepts only an absolute, regular, non-symlink input; verifies a checksum sidecar when present; creates and retains a pre-restore backup; stops the app; invokes SQLite `.restore` through the Compose runtime image; and starts the app before requiring the health script to pass.
- Health checks Compose-reported service health plus the configured local HTTP endpoint. Status reports release, services, bind, database presence/size, and latest backup checksum state without printing `.env` contents.
- Added CLI dispatch for `status`, `backup`, `restore`, and `healthcheck`, without changing release build/start/rollback behavior.
- Installed `sqlite3` in the runtime image because the operation scripts intentionally invoke the CLI in that image.

## Verification

Passed:

- `PATH=/usr/local/bin:/usr/bin:/bin ./node_modules/.bin/vitest run scripts/deploy.test.mjs -t "SQLite operations"` — 3 tests passed.
- `PATH=/usr/local/bin:/usr/bin:/bin ./node_modules/.bin/vitest run scripts/deploy.test.mjs` — 19 tests passed.
- `bash -n deploy/ops/*.sh`
- `git diff --check`
- `npm run typecheck`
- `npm run lint`

The brief's literal focused command, `PATH=/usr/local/bin:/usr/bin:/bin vitest ...`, could not find a globally installed `vitest`; the repository-local executable above ran the same suite successfully.

## Environment limitation

Docker is unavailable in this worktree environment: `docker: command not found`. Consequently, `docker compose config` and a live backup/restore/health runtime check could not be performed. The scripts have shell-syntax and source-contract coverage, but live Compose validation remains for an environment with Docker installed.

## Review follow-up

- `status.sh` now requires only safe deployment, config, and data parents. It reports an absent SQLite directory or database as missing instead of exiting before status output.
- `restore-db.sh` now rejects a checksum sidecar whenever it exists but is not a regular, non-symlink file; a valid regular sidecar remains checksum-verified.
- Added isolated executable-script behavior tests with a temporary target and fake Docker command. They prove restore rejection for relative, missing, directory, symlink, checksum-mismatch, and unsafe-sidecar inputs, and prove status reports a missing SQLite directory without failing.

Follow-up verification passed:

- `PATH=/usr/local/bin:/usr/bin:/bin ./node_modules/.bin/vitest run scripts/deploy.test.mjs -t "SQLite operations"` — 6 tests passed.
