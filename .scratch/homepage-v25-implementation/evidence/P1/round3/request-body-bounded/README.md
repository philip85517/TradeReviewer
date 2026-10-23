# Bounded request-body observer — frozen candidate

2026-10-23; `gpt-6.1-sol / ultra`. Implementation-ready for root review and one root-owned diagnostic window, after the P2 quiet measurement. **Actual failing request/consumer remains OPEN. P1 formal 2/3 FAIL is unchanged; this is not a third formal acceptance round or a framework fix.**

Read `HYPOTHESIS.md` for the hypothesis recorded before implementation and `../request-body-peer/PRODUCTION-CALLGRAPH.md` for the actual installed call graph and prior evidence limits. No previous evidence was replaced. This task made new files only here; no product/dependency/configuration changes, service, browser, database, network, subagents, commits, or shared tracker writes.

## Frozen inputs and outputs

| File | SHA256 |
| --- | --- |
| `bounded-observer.mjs` | `1b0a0ef8ce7e6aba0be8ebc541903c5d3c687fa7c65edf7dacdcc91367685907` |
| `bounded-preload.mjs` | `d62a91d488e89e13dc7c9436d31ee84ab634e80dceb13855045872ddae236586` |
| `bounded-observer.test.mjs` | `795d3162164a8d79fec00a0831ddbe5037d97b65f12a9e1c826e76b04b803ab6` |
| `HYPOTHESIS.md` | `295a5d5aa4d33841a5f9f45d062fad0955dfaf77752123e1de40d30becd0ae30` |
| Installed `node_modules/srvx/dist/adapters/node.mjs` | `4fb7ded812c93f17c0dc09605145f1f7846c97a1c754cec20cd1696235baa52a` |
| Installed `node_modules/srvx/dist/_chunks/_url.mjs` | `4ae668931bafa9ce172c8b10408703cc5ac1d4e22c9df617a816da9d5eb811f6` |

Hashes were computed read-only with pinned Node `createHash('sha256')`, exit 0. An earlier `shasum` command failed in Perl locale initialization, exit 9, without producing hashes; it is not verification evidence.

`bounded-observer.mjs` is inert when imported. `bounded-preload.mjs` installs only when both `TRADEREVIEW_REQUEST_BODY_BOUNDED=1` and a valid absolute output prefix are supplied. The prefix must be directly inside this directory and its basename must contain only letters, digits, `_`, or `-`. Output is `<prefix>.<pid>.ndjson`, exclusive create, mode 0600, once after uninstall. A missing output file is an output/activation failure, never a successful no-repro result.

## Mechanism and limits

The preload does not import srvx early and does not replace global Request. A temporary `Object.setPrototypeOf` hook recognizes naturally evaluated srvx Request prototypes by exact SHA256 fingerprints of the own body/_request/text/json functions. Source drift or a prototype loaded before installation is not silently accepted. Production does not use the offline `nodeRequestPrototype` test injection option.

Observation attaches to HTTP request dispatch, Node IncomingMessage public read/listener/data boundaries, natural `Readable.toWeb` returns, public Web stream operations, natural srvx body/_request/text/json operations, mapped native Request consumers/clone, and response finish/close/status. There are no per-reader wrappers, response listeners, Promise handlers, payload reads, or active probes of body/bodyUsed/redirect/clone. Stream state is sampled only from an already naturally returned object with the captured native locked getter and `Readable.isDisturbed`. GET/HEAD and non-GET are all tracked; `/home` and `/home.rsc` are retained as a fixed safe route. Unknown routes are redacted and remain tracked. No body, chunk length, headers/values, credentials, query values, error messages, or arbitrary function names are serialized.

| Per-process hard limit | Stop behavior |
| --- | --- |
| 60,000 ms from installation, including startup | Timer plus operation guards; no extension |
| 100 tracked requests | Includes the 100th request-entry; uninstalls before original dispatch continues, so its later chain is unobserved |
| 1,024 regular events | One additional reserved observer-stop marker; tail truncation is not a throw |
| 262,144 bytes | One fixed retained serialized Buffer, including a reserved stop marker; total JS heap/transient encoding/stack cost is not bounded by this number |
| 512 recoverable descriptors | Refuses additional installation and uninstalls immediately when reached |

Any limit, target materialization throw, other materialization throw, or diagnostic/patch error stops new observation and restores owned descriptors before one flush. BeforeExit and explicit stop also uninstall. Restoration runs in reverse, restores prior own descriptors or deletes added own methods, and preserves a later third-party replacement instead of clobbering it. Stop clears identity maps, descriptor records, timer and lifecycle listener. A saved reference held by third-party code cannot be revoked; it becomes a passive original-call delegate when inactive. This changes wrapper identities/descriptors and timing while active, and is not a zero-overhead claim. Node processes inheriting NODE_OPTIONS each have their own timer, limits and PID file; launcher files may contain no requests.

## Verification

Run from the worktree, using the pinned Node 26.0.0 / SQLite 3.53.0 runtime:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/homepage-v25-implementation/evidence/P1/round3/request-body-bounded/bounded-observer.test.mjs
```

Final exact output is `green-final.log`: exit 0, 13 tests, 13 PASS, 0 FAIL, 890.275079 ms. Both `node --check bounded-observer.mjs` and `node --check bounded-preload.mjs` exited 0 with no output. Tests use real in-memory IncomingMessage, srvx and native Request/ReadableStream objects, plus no-socket child processes; they never listen or visit the app. They prove exact descriptor/key restoration, natural prototype discovery, GET/home and GET/home.rsc recognition, GET/HEAD null body, actual Node/Web/tee/JSON/clone payload preservation, original result/thenable/error identity, no lazy request-entry reads, all five automatic budgets, real timer, beforeExit, one flush, source drift, later third-party replacement, sink failure and sensitive-value omission.

The synthetic same-stream getReader lock → natural redirect/_request target throw proves that the observer can retain a sufficient-condition chain and uninstall on that throw. **It does not identify the real application's consumer or reproduce the original incident.** The native clone fixture also preserves both JSON payloads; Node26 calls public tee there, but which private branch becomes either Request's body remains unknown. Cached native stream identity and the request's last-stream pointer are cleared across clone instead of assigning a later consumer to a stale stream.

Earlier logs remain: red-01 is missing-module RED; green-01 intentionally records only its command (the initial broad descriptor assertion failed and no exact transcript was saved); green-02 preserves a bad reader-own-symbol assertion; green-04/05 preserve stack-format safety failures; green-08 preserves a test assumption that a later native JSON call must be the first Web intent, disproven by native clone's earlier public tee. Green-03/06/07 are intermediate passes. No earlier failure was overwritten. `offline-preload-*.ndjson` are no-socket test artifacts, not real-service evidence.

## Root-only bounded activation

Root must first review these frozen hashes/code and finish independent targeted verification. Do not activate during a P2 performance window. Record the current owned service PID/command/port, its actual NODE_OPTIONS and environment, and the existing isolated acceptance database path and sidecar state. Keep the same explicit isolated database and port; do not run `make dev` / `npm run dev`, which resets the standard test database. Never fall back to the business database. Stop only the root-owned service that occupies the chosen port.

The following is an explicit development-runner example, not a command executed by this worker. Use it only when root confirms it matches the existing service mode and preserves the environment. Set `task_db` to the already reviewed absolute isolated database path first; the command deliberately refuses to invent one. Set `task_original_node_options` to the original service's value if it differs from the current shell. Use a fresh allowed basename for every window, preserving all earlier files.

```sh
task_root=/Users/zhoulin/.codex/worktrees/0dc6/TradeReview
task_node_dir=/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin
task_diag="$task_root/.scratch/homepage-v25-implementation/evidence/P1/round3/request-body-bounded"
: "${task_db:?Set task_db to the reviewed existing isolated database absolute path}"
task_prefix="$task_diag/root-window-01"
task_original_node_options="${NODE_OPTIONS-}"
env PATH="$task_node_dir:$task_root/node_modules/.bin:$PATH" \
  TRADEREVIEW_DB_PATH="$task_db" \
  TRADEREVIEW_REQUEST_BODY_BOUNDED=1 \
  TRADEREVIEW_REQUEST_BODY_BOUNDED_FILE="$task_prefix" \
  NODE_OPTIONS="${task_original_node_options}${task_original_node_options:+ }--import=$task_diag/bounded-preload.mjs" \
  "$task_node_dir/node" "$task_root/scripts/start-local.mjs" --dev --hostname 127.0.0.1 --port 3333
```

This direct runner requires node_modules/.bin in PATH for its vinext child. Preserve the root terminal's stdout/stderr for independent original error evidence; observer files are buffered until a stop. Startup consumes the 60-second budget. A launcher PID file is not proof the HTTP-serving child was observed.

Within one window in a real browser, perform only already authorized flows against that isolated database:

1. Navigate to `/home`, capturing natural document GET and any actual RSC GET; record browser method, fixed path, status, initiator and time without exporting request bodies/headers/query values.
2. Navigate to the actual library journey and return to `/home`; unknown safe paths may appear redacted, so retain the sanitized independent browser route/time evidence. A library-only window does not cover homepage entry.
3. Perform one existing authorized save/write action that generates a real non-GET (for example the existing review save flow), and verify its normal isolated persistence/return/reload through the established acceptance procedure. Do not introduce an arbitrary request or artificially lock/consume production streams to force this probe's synthetic condition.
4. If the target error occurs, retain the original error stack and same-window browser evidence; the materialization throw automatically ends observation. Otherwise let the serving PID reach its 60-second/other budget stop. Missing target throw is no-repro, not fixed or accepted.

After stop, inspect each PID file. Require exactly one final `observer-stop`, `restoration.failed=0`, `ownedRemaining=0`; unexplained `skipped>0` means full restoration is not proven. The serving trace must have observer-ready, a matching srvx-prototype-discovered event, `/home` request-entry (and RSC if it naturally occurred), and an actual non-GET entry. Check stop reason before treating a missing return/end/close as a failure. A duration/bytes/events/request/descriptor tail is truncated observation. If startup consumes the window or no prototype is discovered, preserve the failed coverage and do not infer consumer absence. Do not repeatedly extend/rearm this module automatically.

Rollback is root-owned: stop the instrumented service only after the flush marker has been captured, then restart the exact original owned command/environment with the same explicit isolated database and port and without these two opt-in variables/this added preload. Preserve all traces and database contents/sidecars. Normal forced SIGTERM/explicit process.exit/SIGKILL before the timer is not guaranteed to emit beforeExit or flush the buffer; a missing final marker invalidates that window. Do not add an exit/signal handler merely to rescue it.

## Evidence interpretation and open boundaries

Correlate PID + request ID, method/fixed route/RSC, stream ID, operation stack locations, node-first-data, web state, materialize-enter/return/throw, and response finish/close/status. First-intent is a capability boundary, not proof of data consumption or illegality. Normal bridge read/on:data, native clone/tee, and response `_dump` are not a culprit by label. A useful consumer candidate needs same-object clean state, an earlier actual operation with its stack, later unusable state and the corresponding target throw. Node disturbed and Web disturbed/locked are separate facts.

Native/private consumption can bypass public hooks; clone records an explicit unknown internal stream transition. The first `new Request(raw,{headers})` error swallowed by vinext remains unseen. This candidate does not wrap constructors or transform source to recover it. Multiple realms, already-loaded srvx, source drift, saved pre-install method references, request reentry, untracked streams and custom stack formatters remain blind spots. Location-only stack extraction can be empty; empty stacks are not evidence no caller exists. A target throw without a complete same-stream prior chain remains OPEN. If the real request is GET/HEAD, retain that fact; the installed srvx normal GET/HEAD body is null, so do not force the non-GET explanation onto it.

No real-service compatibility, browser journey, original failure reproduction, causal consumer attribution, UI delivery, persistence acceptance or P1 acceptance is claimed by this artifact. Root must independently review and collect those results.
