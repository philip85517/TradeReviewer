# Terminal request-body observer — frozen candidate for root review

2026-10-23; gpt-6.1-sol / ultra. Offline candidate only. **No real observation
window was activated, no original incident was attributed, no product fix was
made; P1 formal remains 2/3 FAIL.** Root must independently review this candidate
before deciding whether to activate one real save window. This is the same
diagnostic task, not another performance repair or a renamed acceptance round.

Only files in this independent evidence directory were added. No product,
dependency, test expectation, configuration, service/browser/network/DB,
shared tracker, subagent, commit, or push operation occurred. The existing
3333/session88778 service was neither queried nor changed. Tests install the
observer only around in-memory objects, never via enabled preload or a server.

## Inputs and changes from the old observer

Read the project AGENTS.md and development-workflow, frontend-control-audit,
task-decomposition, ui-task-templates documents; systematic-debugging and
test-driven-development SKILL.md plus writing-good-tests.md. Read the prior
round3 ROOT-REQUEST-BODY-DIAGNOSIS.md, request-body-code-audit/REPORT.md and
request-body-bounded/{bounded-observer.mjs,bounded-observer.test.mjs,
bounded-preload.mjs,README.md}, including installation, lifecycle, restoration,
buffering and stop behavior. Prior evidence is preserved.

The old candidate allocated GET identities/request slots and observed toWeb
only after return. The new candidate maps only exact PUT
`/api/storage/reviews` and `/api/storage/review-summaries`, discards URL queries,
and rejects fragments, absolute-form URLs, suffixes and trailing-slash variants.
Static GET and every other method/path allocate no identities or request slots.
It records the original Node object before the natural bridge and correlates
the actual returned Web object afterward. It does not wrap Web consumers,
native Request consumers, Node read/resume/pipe, or listener registration.
The stop marker now counts inside the event/byte budgets.

## API, ownership and restoration contract

`terminal-observer.mjs` exports `HARD_LIMITS` and
`installTerminalObserver(options)`. Importing it installs nothing and performs
no I/O. Installation returns a frozen controller with:

- `state()`: passive scalar counters, active status and effective limits.
- `stop(reason = 'manual')`: synchronously disables observation, restores owned
  descriptors in reverse order, clears all weak identity maps, cancels its one
  unref'd timer, removes its one process beforeExit hook, and calls `onFlush`
  once. Later calls return the identical result and never flush again.

Options are `onFlush`, downward-only `limits`, worktree `root` for location
redaction, and `nodeRequestPrototype`, `clock`, `schedule`, `cancel`. Offline
tests use the latter inputs for already-loaded srvx and deterministic budgets.
An explicitly supplied prototype still must match the exact srvx body/_request
getter fingerprints; source drift is not accepted. Production preload does
not supply a prototype or import srvx early. A second installation while active
returns the same controller, preserving its original sink/deadline and avoiding
stacked wrappers. The module does not automatically reinstall after stop.

Default owned descriptors are six hooks, plus two on one naturally discovered
srvx prototype: Server.prototype.emit; IncomingMessage.prototype.emit and
destroy; ServerResponse.prototype.emit; Readable.toWeb; Object.setPrototypeOf;
srvx prototype body and _request getters. A natural Object.setPrototypeOf call
recognizes srvx using exact own-getter SHA256 fingerprints. Each wrapper calls
the original once with the same receiver/arguments, returns the original value
or Promise/thenable untouched, and rethrows the identical synchronous error.
Diagnostics and sink failures do not replace the original operation result.
Global Request, its prototype and Web stream prototype are never patched.

There are no per-request descriptors, listeners, data/readable subscriptions,
readers, body reads, cancel/tee/pipe calls, Promise handlers, lazy getter probes
or payload inspections. Only natural operations are observed. Mappings are weak
maps; metadata contains WeakRef references to N/S. Descriptor records strongly
retain only the bounded patched targets, never individual requests. Passive
close/aborted and response finish/close observation uses filtered natural emit
calls rather than request listeners. A mapped N's first natural destroy call
gets one short source-location stack; it is called through unchanged. A target
getter throw gets at most one further short stack. Stacks have at most six
locations and 2KiB each; custom stack getters/formatters are not executed.

Stop reports `{restored, skipped, failed, ownedRemaining}`. A later third-party
descriptor is preserved rather than overwritten and increments skipped. Require
failed=0 and ownedRemaining=0; unexplained skipped>0 means exact restoration
is NOT VERIFIED. Saved external wrapper references cannot be revoked; when
inactive they delegate directly without new recording. Wrapper identity and
timing change while active; this is not a zero-overhead claim.

The result provides events/text getters, buffer/bytes, limits/reason/restoration
and a flushFailed getter. It retains only the fixed serialized buffer plus
bounded scalar metadata after stop. A throwing sink sets flushFailed without
throwing into the application. No output retry is performed. A missing or
partial file is failed output, never evidence of no reproduction.

## Hard budgets and event interpretation

| Per process | Stop behavior |
| --- | --- |
| 60,000 ms from installation, including startup | One wall timer and guards on natural operations; no extension. A blocked JS event loop cannot be preempted; overdue operations first disable observation. |
| 4 allowlisted PUT request-entry hits | Fourth entry is recorded and immediately stops before the original dispatch continues; its subsequent chain is truncated. |
| 128 total events | At most 127 regular events plus one reserved stop marker. |
| 65,536 serialized bytes | One fixed backing buffer, including a 2KiB stop reserve. This does not bound all transient allocations/JS heap. |
| 64 owned descriptors | Reaching the limit stops installation/observation and restores what was installed. |

First mapped target body-unusable getter throw stops immediately. Other mapped
getter/bridge throws stop with materialize-throw; diagnostic/patch failures also
stop safely. BeforeExit and manual stop restore too. Every budget stop has
`tailTruncated:true`; bytes includes blockedPhase when the pending event could
not fit. Exactly one final observer-stop is required. Missing later events
after a budget do not prove missing application behavior.

Correlate PID + id and elapsedMs, using root's independently captured UTC window
start. request-entry records Node `disturbed, isReadable, readable,
readableEnded, destroyed, readableAborted, complete, aborted`. bridge-before
uses the same N id; bridge-after assigns the actual S an id and records its
locked/disturbed state plus N after. body-return records whether S is the same
bridge/previously returned body. materialize-enter/return/throw records the last
naturally observed stream, not a certification of a Request's private body.
Require the relevant natural body-return within the materialization chain when
binding the error to S. No private/native body transitions or arbitrary later
Web consumers are observed by this narrow module.

`readableEnded=true, readableAborted=false, complete=true, aborted=false` after
full drain is normal end, even if autoDestroy makes destroyed=true.
`readableEnded=false, readableAborted=true, complete=false, aborted=true`
distinguishes the tested unread destroy. Other flag combinations must be kept
as observed. Node disturbed alone proves neither bytes read nor a bad Web body.
complete=true alone does not imply preconsumption. A destroy stack may only
show autoDestroy; it does not identify the earlier complete pre-reader.

If N is already terminal before bridge, S is initially disturbed, the same S
naturally returns from body, and _request then throws the target error, the
trace can support the pinned Node bridge-cancel branch. Original abort/drain
source still needs lifecycle/source/browser evidence. Clean initial S followed
by a later failure remains a different, unobserved consumer chain. Destroy
before mapping, saved pre-install methods, multiple realms, already-loaded
srvx, custom instance overrides, source drift, empty safe stacks and budget
tails remain explicit blind spots. GET success cannot substitute for PUT data.

## Verification and preserved logs

Run from `/Users/zhoulin/.codex/worktrees/0dc6/TradeReview`:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node --test .scratch/homepage-v25-implementation/evidence/P1/round3/request-body-terminal-observer/terminal-observer.test.mjs
```

Final `green-final-02.log`: exit 0; 13 tests, 13 PASS, 0 FAIL. Both module and
preload passed pinned node --check (exit 0, empty output). The suite exercises
real no-socket IncomingMessage/ServerResponse, installed srvx0.11.15/vinext0.0.50
and Node26 Request/streams; it never starts a service or reads/writes a DB.
It proves natural discovery, clean content preservation, no entry consumption,
same-object terminal bridge chains, distinct full drain/abort flags, a mapped
natural destroy source stack, exact allowlist, 200 harmless static GETs,
every budget, final marker within all bounds, exact descriptor restoration,
later-owner preservation, inactive-wrapper delegation, one flush, sink failure,
real timer/beforeExit, original receiver/arguments/result/error identity, and
no added thenable handler. Preload tests exercise disabled/invalid-prefix paths
only; enabled preload/file output and real-service compatibility are NOT VERIFIED.

`red-01.log` was recorded before module implementation: ten explicit missing
implementation assertions failed. `green-01.log` has six passes/four failures:
the aggregate descriptor-map assertion produced a Request surface mismatch;
switching to exact own-key and per-descriptor comparisons proved restoration
without changing its expected descriptors. `green-02.log` then passed 10/10.
`red-02-preload.log` preceded preload implementation: 12 passes and one explicit
missing-preload failure. `green-final.log` passed 13/13; `green-final-02.log`
also passes after strengthening the positive destroy-source assertion.
All earlier logs remain. No full project suite was run, per root's explicit
scope. These offline commands are not P1 formal acceptance attempts.

## Root-only activation proposal — not executed

Review the frozen manifest/code and independently run the narrow tests first.
Do not combine this with a P2 performance window or the old observer. Record the
currently owned serving PID/command/environment, original NODE_OPTIONS, port,
root UTC start, and the existing **explicit isolated DB** path and sidecars.
Keep that DB and port; do not run make dev/npm run dev (which resets its test
DB), invent another DB, or fall back to the business DB. The worker did not
authorize itself to stop/restart anything.

`terminal-preload.mjs` installs only if TRADEREVIEW_REQUEST_BODY_TERMINAL=1 and
the absolute TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE prefix is directly in this
directory with a letters/digits/underscore/hyphen basename. It exports
`activation`: disabled with reason, or installed with output and observer.
Output is `<prefix>.<pid>.ndjson`, exclusive create mode0600 once **after
restoration**. The serving PID's file is required; launcher/other PID files
have independent per-process budgets and cannot prove serving observation.
Missing file/final marker or failed restoration invalidates the window.

The following exact runner template is reviewable, not executed. Root must
first confirm it matches the existing owned runner and preserve all its actual
environment. Supply task_db from the reviewed existing isolated database and
task_original_node_options from that service (it may be empty). Use a fresh
task_window for each expressly chosen window; do not automatically rearm.

```sh
task_root=/Users/zhoulin/.codex/worktrees/0dc6/TradeReview
task_node_dir=/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin
task_diag="$task_root/.scratch/homepage-v25-implementation/evidence/P1/round3/request-body-terminal-observer"
: "${task_db:?Set to the reviewed existing isolated database absolute path}"
: "${task_original_node_options?Set from the original service; empty is allowed}"
task_window=root-terminal-window-01
env PATH="$task_node_dir:$task_root/node_modules/.bin:$PATH" \
  TRADEREVIEW_DB_PATH="$task_db" \
  TRADEREVIEW_REQUEST_BODY_TERMINAL=1 \
  TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE="$task_diag/$task_window" \
  NODE_OPTIONS="${task_original_node_options}${task_original_node_options:+ }--import=$task_diag/terminal-preload.mjs" \
  "$task_node_dir/node" "$task_root/scripts/start-local.mjs" --dev --hostname 127.0.0.1 --port 3333
```

Root then performs one already-authorized real save producing one of the two
PUT routes; capture browser method/fixed path/status or cancellation/initiator/
time and original overlay/terminal stack without exporting payload/headers/
queries. Keep saving, return navigation, reload and isolated persistence as
separate acceptance evidence. Observe only the chosen single window; a budget
tail, no matched PUT or absent discovery is NOT VERIFIED, not no consumer.

After the timer/first throw/budget stop, require observer-ready, natural srvx
discovery, allowlisted request-entry and a coherent bridge/body/error chain in
the serving PID trace, plus exactly one stop marker with clean restoration.
If no error occurs, report no reproduction rather than fixed. A bare SIGTERM,
explicit process.exit or SIGKILL before stop is not guaranteed to flush; no
signal/exit handlers are installed. Root owns restoring the exact original
runner/environment with this added preload/opt-in removed, preserving the
isolated DB and all evidence. Actual consumer attribution, service
compatibility, browser save, persistence, UI/visual acceptance and product
repair all remain NOT VERIFIED by this candidate.
