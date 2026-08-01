# Final review fix report — Docker Compose deployment

## Result

The final review findings were addressed across release staging, runtime publication and recovery, first-run initialization, target-side operations, SQLite backup/restore safety, release locking and retention, command timeouts, diagnostic redaction, Docker context exclusions, and operator documentation.

No private screenshots or private runtime data were inspected. Browser-local storage behavior and screenshot handling remain unchanged.

## Fixes delivered

1. Release staging now keeps tracked application assets such as root `build/` and nested `app/data/`, while excluding runtime roots and a wider set of environment, credential, private-key, and certificate files.
2. Runtime control-plane files are published through an explicit allowlist under the target root, and a failed publication or candidate acceptance restores the previous runtime snapshot before recovering the prior release.
3. A clean full deployment creates the documented target layout, initializes `config/.env` with mode `0600`, initializes SQLite storage safely, and preserves existing configuration, database, backup, and log content on repeat runs.
4. The deployed target now owns its operational entry point and Makefile, so `make deploy`, `deploy-code`, `deploy-status`, `deploy-backup`, `deploy-restore`, `deploy-rollback`, `deploy-down`, and `deploy-config` work from the target root.
5. Candidate failure diagnostics are bounded and redacted, report the active release and rollback command, stop a failed first release, and rebuild/start/health-check the previous release when one exists. Recovery failures remain visible rather than being suppressed.
6. SQLite backup uses a consistent SQLite backup under the operator's UID/GID, integrity-checks the result, publishes the backup and checksum atomically with restrictive modes, and prunes only recognized regular backup files. Restore validates the input, swaps database files atomically, and restores the original database and service if post-swap health verification fails.
7. Deployment locks contain owner metadata and a token. Dead same-host owners can be recovered, cross-host locks are age-gated, and only the lock owner can release a lock.
8. Release retention honors `RELEASES_TO_KEEP` with a minimum of two, preserves active and previous releases, and ignores unknown entries and symlinks.
9. Compose and operational subprocesses now have explicit timeouts; diagnostic output is sanitized before being raised to callers.
10. Docker ignore rules are root-aware and aligned at both effective boundaries, and Compose now declares `restart: unless-stopped`. The deployment guide documents the complete target layout and failure/recovery contract.

## TDD and automated verification

Behavioral tests were added before implementation for real-repository staging, secret exclusion, clean/repeated initialization, target-root Make commands, corrupt and successful SQLite backup/restore flows, command timeouts, lifecycle recovery and diagnostics, retention, stale-lock recovery, and Docker template policy.

Final results:

- `PATH=/usr/local/bin:/usr/bin:/bin npm run test:unit` — exit 0; 68 files passed, 521 tests passed.
- `PATH=/usr/local/bin:/usr/bin:/bin ./node_modules/.bin/vitest run scripts/deploy.test.mjs` — exit 0; 51 tests passed as part of the full unit run.
- `PATH=/usr/local/bin:/usr/bin:/bin npm run typecheck` — exit 0.
- `PATH=/usr/local/bin:/usr/bin:/bin npm run lint` — exit 0.
- `PATH=/usr/local/bin:/usr/bin:/bin npm run build` — exit 0.
- `PATH=/usr/local/bin:/usr/bin:/bin npm test` — exit 0; production build passed and rendered-output suite passed 3 tests.
- `bash -n deploy/ops/*.sh` — exit 0.
- `node --check scripts/deploy.mjs` and `node --check deploy/ops/run-command.mjs` — exit 0.
- `git diff --check` — exit 0 on the final working-tree diff.

The successful builds emitted the existing non-fatal Vinext/OpenCV browser-externalization, large-chunk, and route-classification warnings.

## Docker validation and remaining environment caveat

- `docker --version` — exit 0: Docker 29.6.2.
- `docker compose --env-file deploy/config/.env.example -f deploy/compose.yaml config --no-env-resolution --quiet` — exit 0 without creating a runtime `.env` in the source tree.
- An isolated target-root deployment was initialized, staged, and validated with Compose. Its deployed `make deploy-code` reached the real image build path but could not fetch the uncached `node:22-bookworm-slim` base image because Docker Hub's OAuth endpoint timed out. The command exited 2 after reporting both the candidate failure and failed prior-release rebuild. `docker image inspect node:22-bookworm-slim` confirmed the image was not cached.
- `make deploy-down` completed successfully, no containers remained for the isolated Compose project, and the explicitly created temporary target was removed.

The only remaining caveat is environmental: a complete live build/start/health/rollback and SQLite sentinel rehearsal still requires Docker Hub connectivity (or the base image preloaded locally). Filesystem tests and injected/fake-runner integration tests cover those contracts in this environment.
