# Terminal bridge observer — scope recorded before implementation

2026-10-23; gpt-6.1-sol / ultra. Root authorized an offline evidence module and
pure-memory tests only. P1 formal stays 2/3 FAIL. No product/dependency/service,
browser/network/database, shared tracker, subagent, or commit operations.

Hypothesis to observe, not assert about the original incident: an allowlisted
PUT's original IncomingMessage N is already destroyed/not readable before its
first natural Readable.toWeb(N); Node26 returns a canceled/disturbed fresh S;
srvx naturally returns the same S and its natural _request throws the target
body error. Normal full pre-drain/end and abort/destroy must remain distinct.

Reviewed the prior bounded observer and tests/preload/README. Gaps relevant to
this task: all GETs took request slots; toWeb only mapped after returning;
initial stream disturbance could predate mapping; broad consumer wrappers were
unnecessary for this narrow question; the former events budget excluded its
extra stop marker. We will keep one bounded buffer and reverse descriptor
restoration, preserve third-party replacements, and clear weak identity maps.
New hard budgets count the stop marker and bytes. Timer starts at installation,
including startup; no target requests still expires. No extending/rearming.

Observer installation changes callable identities/timing while active. It must
call each original once with the same receiver/arguments/result/error; never
read a body or proactively touch srvx lazy getters, add data/readable listeners,
attach Promise handlers, replace Request, or import srvx early. Request/stream
identities use weak maps and weak references. Lifecycle observation wraps only
natural emit and mapped natural destroy; no per-request listener or descriptor.

RED tests precede implementation. They exercise real IncomingMessage, installed
srvx/vinext, native Web streams in memory, plus controlled clock/scheduler for
budget boundaries. Tests do not listen, perform HTTP, touch DB, or run the
opt-in preload. Final activation is a root-owned review decision.
