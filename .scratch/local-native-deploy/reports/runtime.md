# Native runtime boundary

Status: implementation-ready; coordinator integration review pending.

The runtime module exports `createNativeRuntime({ targetDir, runtimeConfig, env = process.env, healthTimeoutMs = 60000, commandRunner?, startCommand? })`. The returned boundary is `{ inspect, build, start, waitHealthy, stop }`.

`runtimeConfig` is validated as an absolute database path, loopback hostname (`127.0.0.1` or `::1`), valid port, and absolute optional config path. `build(releaseDir)` runs `npm ci --include=dev` followed by `npm run build` with a finite command timeout, so the production build toolchain remains available even with `NODE_ENV=production`; command stdout/stderr and failures are appended to a per-release build log beneath the deployment target. It does not inspect or interrupt the old listener. Service environment construction removes ambient runtime/database/port overrides, sets production mode and the resolved database, prepends the release's `node_modules/.bin` using the platform path delimiter, and writes Wrangler logs beneath the deployment target. Log directories and files are validated as ordinary paths before writes.

`start` launches the configured production entrypoint detached with a target log, explicit loopback host and port, and captures PID/cwd/command/start time and process group. Listener inspection uses shell-free `lsof`/`ps`, deduplicates PIDs, resolves physical paths, decodes escaped UTF-8 path bytes, and fails closed for ambiguous or unreadable ownership. `waitHealthy` accepts a verified listener descendant in the managed process group and requires HTTP 2xx from both `/` and `/api/storage/status` within the finite health budget. `stop` validates PID reuse, physical cwd, command identity, and start time before terminating the process group (falling back to the listener PID for legacy wrappers) and waits for the configured port to become free; an already-exited startup handle is accepted only after confirming no listener remains.

## Verification

Command: `node --test scripts/deploy-native-runtime.test.mjs`

Result: 11 passing, 0 failing.

Evidence covers real detached start/health/stop on a Unicode and spaces path, a wrapper that spawns a different listener PID, orphan listener cleanup after wrapper exit, same-cwd foreign process refusal, foreign listener preservation, unhealthy endpoint cleanup, startup early exit cleanup, independent `npm ci --include=dev` and build environment, retained success/failure build diagnostics, symlinked log rejection, and finite build failure behavior. Tests create only unique temporary fixtures and ports; no formal service, database, or deployment target is modified.
