# Docker Compose Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, repeatable `make deploy` workflow that publishes the current project to `/Users/zhoulin/projects/TradeReview` with Docker Compose, SQLite volume isolation, preserved configuration, and a code-only update path.

**Architecture:** A Node-based deployment orchestrator owns path validation, release creation, source synchronization, Docker Compose commands, health-gated release switching, and rollback. Repository deployment templates are stored under `deploy/`; the target directory receives a release-oriented `app/` tree, preserved `config/`, isolated `data/`, operational scripts, Compose files, and a usable `Makefile`.

**Tech Stack:** GNU Make, Node.js `>=22.13.0`, Docker Compose, Node `fs/promises`/`child_process`, SQLite CLI inside the runtime image, Vitest, ESLint, TypeScript, and existing vinext build/start scripts.

## Global Constraints

- Default deployment root is exactly `/Users/zhoulin/projects/TradeReview`.
- `make deploy` preserves existing `config/.env`, `data/`, `data/backups/`, and `logs/`.
- `make deploy-code` must not read, copy, delete, migrate, or overwrite the target storage/config paths.
- SQLite is isolated at the volume/filesystem boundary; this task does not migrate browser localStorage/IndexedDB data to a server API.
- A failed build or health check must leave the previous release active and must not delete user data.
- All target paths are absolute and the source directory may not equal the target directory.
- No deployment operation may use a root-wide destructive sync; deletion is limited to release staging/retention paths.
- The target `.env` is never committed, copied into an image, or overwritten after first creation.
- The default bind is `127.0.0.1:3000`; public ingress requires explicit configuration.
- Every task ends with a focused test and a small commit before the next task starts.

---

## Files and Responsibilities

- Create `Makefile`: source-side and deployed entrypoints (`deploy`, `deploy-code`, `deploy-status`, `deploy-backup`, `deploy-restore`, `deploy-rollback`, `deploy-down`, `deploy-config`).
- Create `scripts/deploy.mjs`: CLI parser, path validation, copy policy, release lifecycle, Compose runner, health-gated switching, and rollback.
- Create `scripts/deploy.test.mjs`: Node-environment Vitest tests with temporary source/target roots and injected command runners.
- Modify `vitest.config.ts`: include `scripts/**/*.test.mjs` while retaining existing app tests.
- Create `deploy/Dockerfile`, `deploy/.dockerignore`, and `deploy/compose.yaml`: production image and runtime composition.
- Create `deploy/config/.env.example`: safe defaults and documented variables.
- Create `deploy/ops/healthcheck.sh`, `deploy/ops/backup-db.sh`, `deploy/ops/restore-db.sh`, and `deploy/ops/status.sh`: target-side operational commands.
- Create `deploy/DEPLOYMENT.md`: operator guide, directory contract, recovery procedure, and security warnings.
- Modify `README.md`: link to deployment guide and document the two deployment modes without changing local-development instructions.

## Task 1: Add Deployment Templates and Make Entrypoints

**Files:**
- Create: `Makefile`
- Create: `deploy/Dockerfile`
- Create: `deploy/.dockerignore`
- Create: `deploy/compose.yaml`
- Create: `deploy/config/.env.example`
- Modify: `vitest.config.ts`
- Test: `scripts/deploy.test.mjs`

**Interfaces:**
- Make targets invoke `node scripts/deploy.mjs --mode=<mode> --source="$(CURDIR)" --target="$(DEPLOY_ROOT)"`.
- Compose reads `APP_PORT`, `APP_BIND`, `COMPOSE_PROJECT_NAME`, and `APP_RELEASE_CONTEXT` from the deployment command environment.
- The Dockerfile builds with `npm ci`, `npm run assets:ocr`, `npm run build`, and runs `npm run start` on Node 22.

- [ ] **Step 1: Write the failing manifest tests.**

  Add tests that read the repository files and assert:

  ```js
  expect(makefile).toContain("deploy-code:");
  expect(makefile).toContain("/Users/zhoulin/projects/TradeReview");
  expect(compose).toContain("./data/sqlite:/var/lib/tradereview");
  expect(envExample).toContain("APP_BIND=127.0.0.1");
  expect(dockerfile).toContain("npm run assets:ocr");
  ```

- [ ] **Step 2: Run the focused test to verify it fails.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "deployment templates"`.

  Expected result: FAIL because the Makefile and `deploy/` templates do not exist.

- [ ] **Step 3: Add the Makefile and templates.**

  Use `DEPLOY_ROOT ?= /Users/zhoulin/projects/TradeReview`, quote `$(CURDIR)` and `$(DEPLOY_ROOT)`, and keep operational targets delegated to the same Node CLI. Compose must mount `./data/sqlite` independently from the application image, expose only the configured host bind, and include a healthcheck that uses Node's built-in `fetch`.

- [ ] **Step 4: Run the focused test and static checks.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "deployment templates"`, `npm run typecheck`, and `npm run lint`.

  Expected result: all manifest assertions, typecheck, and lint pass.

- [ ] **Step 5: Commit the template boundary.**

  ```bash
  git add Makefile deploy vitest.config.ts scripts/deploy.test.mjs
  git commit -m "feat: add Docker Compose deployment templates"
  ```

## Task 2: Implement Safe Path Planning and Source Synchronization

**Files:**
- Create: `scripts/deploy.mjs`
- Modify: `scripts/deploy.test.mjs`

**Interfaces:**

```js
export const DEFAULT_DEPLOY_ROOT = "/Users/zhoulin/projects/TradeReview";
export function parseArgs(argv); // -> { mode, sourceDir, targetDir, backupPath?, dryRun }
export function resolveDeploymentPaths(targetDir); // -> { appDir, releasesDir, currentLink, configDir, dataDir, backupsDir, logsDir, opsDir }
export function validateDeploymentPaths(sourceDir, targetDir); // throws on equal/unsafe paths
export function getSyncPolicy(mode); // -> { copyApplication, copyRuntimeFiles, preserveStorage, preserveConfig }
export function createReleaseId(sourceDir, now = new Date());
export async function runDeployment(options, dependencies = {});
```

- [ ] **Step 1: Write failing path and policy tests.**

  Cover the default root, `full` versus `code` policies, source/target equality rejection, target descendants of source rejection, and exclusion of `.git`, `node_modules`, `dist`, `build`, `.next`, `.wrangler`, `data`, `logs`, `config`, `trades`, and `.superpowers` from application sync.

- [ ] **Step 2: Run the tests to verify they fail.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "path|policy|release"`.

  Expected result: FAIL with missing exports.

- [ ] **Step 3: Implement argument parsing, validation, and copy policy.**

  Resolve every path with `realpath`/`resolve`, reject equal paths and source paths inside the target, and use `fs.cp` with a relative-path filter. `full` copies deployment templates and the root `Makefile`; `code` copies only application build context. Never pass a target root to a destructive sync operation.

- [ ] **Step 4: Add release staging and atomic pointer helpers.**

  Create `app/releases/<release-id>`, copy into it, write a temporary symlink, and replace `app/current` only after the caller accepts the release. Preserve the previous pointer and return it in the deployment result for rollback.

- [ ] **Step 5: Run focused tests and commit.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "path|policy|release"` and `git diff --check`.

  ```bash
  git add scripts/deploy.mjs scripts/deploy.test.mjs
  git commit -m "feat: add safe deployment planning"
  ```

## Task 3: Add Compose Lifecycle, Health Gating, and Rollback

**Files:**
- Modify: `scripts/deploy.mjs`
- Modify: `scripts/deploy.test.mjs`
- Modify: `deploy/compose.yaml`

**Interfaces:**

```js
export function createComposeRunner({ targetDir, env, commandRunner });
export async function buildAndStartRelease({ targetDir, releaseId, previousRelease, composeRunner });
export async function waitForHealthy({ targetDir, timeoutMs, composeRunner });
export async function rollbackRelease({ targetDir, releaseId, previousRelease, composeRunner });
```

- [ ] **Step 1: Write failing lifecycle tests with an injected command runner.**

  Assert that a successful run calls Compose build/up/health in order and switches `current`; a build failure leaves `current` unchanged; a health failure restores the previous pointer and starts the previous release. Use a command runner that records `{ command, args }` rather than invoking Docker.

- [ ] **Step 2: Run the lifecycle tests to verify they fail.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "Compose lifecycle"`.

  Expected result: FAIL because the lifecycle exports are not implemented.

- [ ] **Step 3: Implement Compose invocation.**

  Run Compose with `--project-directory <target> --file <target>/compose.yaml --env-file <target>/config/.env`, set `APP_RELEASE_CONTEXT=./app/releases/<release-id>`, and use the target's `COMPOSE_PROJECT_NAME`. Do not expose secrets in command output.

- [ ] **Step 4: Implement health timeout and rollback.**

  Poll `docker compose ps`/the service health state until the configured timeout. On any non-zero build, start, or health result, restore the previous `current` pointer and bring the previous release back up. Remove only the failed release staging directory after rollback; never touch `data/` or `config/`.

- [ ] **Step 5: Run focused tests and commit.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "Compose lifecycle"` and `git diff --check`.

  ```bash
  git add scripts/deploy.mjs scripts/deploy.test.mjs deploy/compose.yaml
  git commit -m "feat: gate deployments on Compose health"
  ```

## Task 4: Add SQLite Backup, Restore, Status, and Runtime Scripts

**Files:**
- Create: `deploy/ops/healthcheck.sh`
- Create: `deploy/ops/backup-db.sh`
- Create: `deploy/ops/restore-db.sh`
- Create: `deploy/ops/status.sh`
- Modify: `scripts/deploy.mjs`
- Modify: `scripts/deploy.test.mjs`

**Interfaces:**

```text
backup-db.sh [--retention-days N]
restore-db.sh /absolute/path/to/backup.sqlite
healthcheck.sh
status.sh
```

- [ ] **Step 1: Write failing operational contract tests.**

  Test that each script uses `set -euo pipefail`, rejects missing/non-regular restore paths, writes timestamped backups under `data/backups`, emits a checksum, and invokes SQLite's consistent `.backup`/`.restore` commands through the Compose runtime image.

- [ ] **Step 2: Run the focused tests to verify they fail.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "SQLite operations"`.

  Expected result: FAIL because the scripts do not exist.

- [ ] **Step 3: Implement backup and restore scripts.**

  `backup-db.sh` creates a timestamped backup and checksum without copying a live WAL file directly. `restore-db.sh` verifies the input checksum when present, creates a pre-restore backup, stops the app, runs `.restore` in the image, and starts the app only after health passes. A failed restore leaves the pre-restore backup available and does not remove the original backup.

- [ ] **Step 4: Implement status and health scripts.**

  `status.sh` reports active release, retained releases, Compose service state, configured bind, database file existence, size, and checksum status without printing `.env` contents. `healthcheck.sh` checks both Compose service health and the local HTTP endpoint.

- [ ] **Step 5: Run focused tests, shell syntax checks, and commit.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "SQLite operations"`, `bash -n deploy/ops/*.sh`, and `git diff --check`.

  ```bash
  git add deploy/ops scripts/deploy.mjs scripts/deploy.test.mjs
  git commit -m "feat: add SQLite deployment operations"
  ```

## Task 5: Add Integration Tests and Operator Documentation

**Files:**
- Modify: `scripts/deploy.test.mjs`
- Modify: `README.md`
- Create: `deploy/DEPLOYMENT.md`

- [ ] **Step 1: Write failing end-to-end filesystem tests.**

  Use a temporary source and target directory with sentinel files in `.env`, `data/sqlite`, `data/backups`, and `logs`. Run the orchestrator with a fake Compose runner and assert:

  ```js
  expect(afterEnv).toBe(beforeEnv);
  expect(afterDatabase).toEqual(beforeDatabase);
  expect(afterBackups).toEqual(beforeBackups);
  expect(afterLogs).toEqual(beforeLogs);
  expect(result.activeRelease).toMatch(/^[0-9]{8}T[0-9]{6}Z-/);
  ```

  Add a second test proving that a failed health check leaves the old release active and a third proving concurrent lock acquisition fails with a clear message.

- [ ] **Step 2: Run the integration tests to verify they fail.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs -t "integration|storage|lock"`.

  Expected result: FAIL until the complete workflow is wired together.

- [ ] **Step 3: Wire all Make targets to the orchestrator.**

  Map `deploy`, `deploy-code`, `deploy-status`, `deploy-backup`, `deploy-restore`, `deploy-rollback`, `deploy-down`, and `deploy-config` to explicit CLI modes. Validate `BACKUP` before invoking restore and print the target root plus active release at the end of every mutating command.

- [ ] **Step 4: Write operator documentation.**

  `deploy/DEPLOYMENT.md` must contain first deployment, code-only update, config editing, status, backup/restore, code rollback, stop/start, default bind behavior, data preservation guarantees, and the SQLite isolation limitation. README adds a concise link and command summary.

- [ ] **Step 5: Run integration tests and commit.**

  Run `PATH=/usr/local/bin:/usr/bin:/bin vitest run scripts/deploy.test.mjs`, `npm run typecheck`, `npm run lint`, and `git diff --check`.

  ```bash
  git add Makefile README.md deploy scripts/deploy.mjs scripts/deploy.test.mjs
  git commit -m "docs: document safe deployment workflow"
  ```

## Task 6: Full Verification and Deployment Dry Run

**Files:**
- Modify only files required by failing verification; do not add generated target data to Git.

- [ ] **Step 1: Run the complete automated suite.**

  ```bash
  PATH=/usr/local/bin:/usr/bin:/bin npm run test:unit
  PATH=/usr/local/bin:/usr/bin:/bin npm run typecheck
  PATH=/usr/local/bin:/usr/bin:/bin npm run lint
  PATH=/usr/local/bin:/usr/bin:/bin npm run build
  PATH=/usr/local/bin:/usr/bin:/bin npm test
  ```

  Expected result: all existing tests plus deployment tests pass.

- [ ] **Step 2: Validate the deployment templates.**

  Run `docker compose -f deploy/compose.yaml config` with the example environment, `bash -n deploy/ops/*.sh`, and `git diff --check`. If Docker is unavailable, record the exact environment limitation and still run the filesystem/injected-runner suite.

- [ ] **Step 3: Run a disposable deployment rehearsal.**

  Set `DEPLOY_ROOT` to a `mktemp -d` directory, run `make deploy`, write a sentinel into its SQLite directory and `.env`, run `make deploy-code`, then verify both sentinels remain byte-for-byte unchanged. Run `make deploy-status` and `make deploy-rollback`, then stop the disposable Compose project and remove only that explicitly created temporary directory.

- [ ] **Step 4: Review the final diff and commit verification evidence.**

  Run `git status --short`, `git diff --stat master...HEAD`, and `git diff --check master...HEAD`. Do not commit `data/`, `.env`, logs, Docker volumes, or build output.

