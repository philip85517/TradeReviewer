# Deployment Port Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the default host port for TradeReview deployment from `3000` to dedicated port `4317`, while adding a first-deployment availability check.

**Architecture:** Keep the container listening on `3000`; only the host-side `APP_PORT` mapping changes to `4317`. The deployment lifecycle performs a TCP bind preflight only when no active release exists, so first deploys fail early with an actionable message while existing-release updates remain compatible with Compose recreation.

**Tech Stack:** Docker Compose, Node.js ESM deployment script, Bash operations, Vitest.

## Global Constraints

- Host default port is exactly `4317`.
- Container internal port and healthcheck URL remain `3000`.
- Existing target `.env` values are preserved by normal deployment synchronization; only the current target configuration is explicitly migrated once.
- No process or container owned by another application is stopped or reconfigured.

---

### Task 1: Add port availability seam and regression tests

**Files:**
- Modify: `scripts/deploy.mjs`
- Test: `scripts/deploy.test.mjs`

**Interfaces:**
- Produce `assertDeploymentPortAvailable(targetDir, { skipIfActiveRelease })` as an exported async function that validates `APP_PORT`, probes `APP_BIND:APP_PORT`, and throws an actionable error on `EADDRINUSE`.
- `runDeployment` invokes the seam before release staging only for a target with no active release.

- [ ] **Step 1: Write the failing tests**

Add tests to the deployment test suite that:

1. create a target `.env` with `APP_BIND=127.0.0.1` and an available ephemeral port and expect `assertDeploymentPortAvailable` to resolve;
2. reserve a local TCP port, write that port into target `.env`, and expect the function to reject with `already in use` and `APP_PORT` guidance;
3. verify an existing active release skips the probe and does not call the port listener.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
PATH=/usr/local/bin:/usr/bin:/bin npx vitest run scripts/deploy.test.mjs --reporter=dot -t "deployment port"
```

Expected: FAIL because the exported seam and lifecycle call do not exist.

- [ ] **Step 3: Implement the minimal port probe**

Import `createServer` from `node:net`. Read `APP_BIND` and `APP_PORT` through the existing `deploymentConfigValue` helper. Reject ports outside `1..65535`; attempt `server.listen({ host, port })`; close immediately on success; translate `EADDRINUSE` into an error that names the configured endpoint and suggests editing `config/.env`.

Call the probe inside the deployment transaction after configuration initialization and before release allocation only when `readActiveRelease(paths.currentLink)` returns no release. Keep code deployments with an active release on the existing Compose lifecycle.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the same focused Vitest command; expected result is PASS for all port tests.

- [ ] **Step 5: Commit the lifecycle seam**

```bash
git add scripts/deploy.mjs scripts/deploy.test.mjs
git commit -m "feat: preflight deployment host port"
```

### Task 2: Change default port configuration and documentation

**Files:**
- Modify: `deploy/config/.env.example`
- Modify: `deploy/compose.yaml`
- Modify: `deploy/DEPLOYMENT.md`
- Modify: `README.md`
- Modify: `scripts/deploy.test.mjs`

**Interfaces:**
- Produce a consistent public default: host `4317` to container `3000`.

- [ ] **Step 1: Add failing manifest assertions**

Update the existing deployment manifest tests to require `APP_PORT=4317`, Compose mapping fallback `4317:3000`, and documentation links to `localhost:4317`; keep assertions that `PORT=3000` and the healthcheck URL remain internal `3000`.

- [ ] **Step 2: Run the manifest tests and verify they fail**

```bash
PATH=/usr/local/bin:/usr/bin:/bin npx vitest run scripts/deploy.test.mjs --reporter=dot -t "deployment manifests"
```

Expected: FAIL while manifests still use `3000` as the host default.

- [ ] **Step 3: Update the defaults and docs**

Set `APP_PORT=4317` in the template, change only the host-side Compose fallback to `4317`, update the default URL in the deployment guide and README, and update fixture expectations that represent the template default. Do not change internal `PORT: 3000`, `EXPOSE 3000`, or healthcheck URLs.

- [ ] **Step 4: Run the manifest tests and verify they pass**

Run the focused command again; expected result is PASS.

- [ ] **Step 5: Commit the default-port changes**

```bash
git add deploy/config/.env.example deploy/compose.yaml deploy/DEPLOYMENT.md README.md scripts/deploy.test.mjs
git commit -m "feat: use dedicated default deployment port"
```

### Task 3: Migrate the current deployment target and verify end to end

**Files:**
- Modify: `/Users/zhoulin/projects/TradeReview/config/.env` (deployment state, not source-controlled)

**Interfaces:**
- Current target listens on `127.0.0.1:4317` unless the operator later changes `APP_PORT`.

- [ ] **Step 1: Update only the current target port**

Replace the existing `APP_PORT=3000` line in `/Users/zhoulin/projects/TradeReview/config/.env` with `APP_PORT=4317`; preserve all other values and file permissions.

- [ ] **Step 2: Run the complete verification suite**

```bash
PATH=/usr/local/bin:/usr/bin:/bin npx vitest run scripts/deploy.test.mjs --reporter=dot
npm run typecheck
npm run lint
node --check scripts/deploy.mjs
bash -n deploy/ops/*.sh
git diff --check
```

Expected: all tests and static checks pass.

- [ ] **Step 3: Run a dry-run and inspect effective Compose configuration**

```bash
make deploy-config
docker compose --project-directory /Users/zhoulin/projects/TradeReview \
  --file /Users/zhoulin/projects/TradeReview/compose.yaml \
  --env-file /Users/zhoulin/projects/TradeReview/config/.env config
```

Expected: published mapping is `127.0.0.1:4317->3000/tcp`, while the app environment and healthcheck continue to use `3000` internally.

- [ ] **Step 4: Commit source changes and report target migration**

```bash
git status --short --branch
git add docs/superpowers/plans/2026-08-02-deployment-port-isolation.md
git commit -m "docs: add deployment port implementation plan"
```

Report the target `.env` migration separately because it is outside the source repository.
