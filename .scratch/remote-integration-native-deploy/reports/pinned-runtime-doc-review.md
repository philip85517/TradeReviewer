# G07 pinned runtime profile and documentation review

Reviewer: /root/unit_review. Date: 2026-10-07 (Asia/Shanghai).

Scope: current uncommitted deltas against HEAD `cf7d48cc4d0052841b64690085e68b23325ffaea` in `conf/native-environment.json`, `README.md`, `conf/README.md`, `deploy/DEPLOYMENT.md`, `docs/agents/development-workflow.md`, and new `conf/NATIVE-RUNTIME.md`; coordinator records `pinned-entrypoints-runtime.json` and `sqlite3530-private-probe.json`. Read the current G05/G07 issues, task README and coverage ledger. Native entrypoint source is still moving and is explicitly excluded. No tests, runtime executable invocation, SQL, service/process operation, source edit, Git mutation, browser or remote operation was performed. The only write is this report.

## Spec

Scoped PASS. No Critical or Important finding in this profile/documentation scope.

- `conf/native-environment.json:2-4` retains approved Node `26.0.0` and SQLite `3.53.0`; only the absolute executable changes to the new user-local private copy. There is no silent move to the observed Homebrew SQL `3.53.1` or official Node SQL `3.51.3`.
- `conf/NATIVE-RUNTIME.md:3-5`, `conf/README.md:5`, `deploy/DEPLOYMENT.md:9-17`, and workflow `:141` distinguish actual `sqlite_version()` from compiled metadata and migration version. The earlier metadata/live-engine failure is preserved in G05 and the integration README; the new documents do not relabel that old observation as a valid actual-engine check.
- The private-runtime record contains Node `26.0.0`, the exact configured `execPath`, SQL version `3.53.0`, and the source ID reproduced at `conf/NATIVE-RUNTIME.md:55`, measured without DYLD overrides. The temporary probe records the same SQL version/source ID and the official source URL/SHA3-256. These are coordinator measurements inspected as evidence, not new reviewer runtime acceptance.
- `conf/NATIVE-RUNTIME.md:18`, `:42-50` and `:60` accurately bound the operation to copied binaries and private Mach-O dependencies, retain the existing system/runtime/service boundary, warn about Homebrew/system dependencies and missing binary portability, and distinguish source integration from formal deployment. The source config does not alter business paths or ports. Inspection of the records cannot independently establish an exhaustive absence of external mutations; the preservation statements are coordinator provenance, consistent with the documented scope.

## Quality

No Critical or Important finding. One Minor documentation evidence-link issue:

- **M01 — Link the actual compiler-command record.** `conf/NATIVE-RUNTIME.md:58` says the concrete build commands are saved in the linked `pinned-entrypoints-runtime.json` and runtime-local `tradereview-provenance.json`. Those two files are byte-identical and contain `install_name_tool`/`codesign` commands but no `compilerCommand`. The complete clang invocation is in `reports/sqlite3530-private-probe.json`, matching the command shown at `conf/NATIVE-RUNTIME.md:31-39`. Add that probe link or qualify the current link as dependency-patching/signing evidence. The recipe itself is intact, so this is a traceability issue, not a runtime blocker.

Strengths: the documentation exposes the machine-specific absolute path and remaining dynamic-library dependencies, provides the source hash, compiler flags, patch targets, signing sequence and SQL source ID, and requires a real SQL check on another machine instead of assuming the official Node version implies the SQLite version.

Read-only byte verification: runtime-local provenance exactly matches the repository evidence (`cmp`, exit 0). SHA256 of the actual private files matches every recorded value:

| Private file | SHA256 |
| --- | --- |
| `bin/node` | `edebc13bd41fe2560ce2d049a83b52409184cdcf139ff275787432815a8079ce` |
| `lib/libnode.147.dylib` | `6b8ec0e1d3256a564ef775e254ef1ea350a99742fe25ddc3295281c12334f812` |
| `lib/libsqlite3.dylib` | `0b50949e4766d3d9185b6207eca6e21987cb5186cd0e765bd3e6ae24cecc37f5` |

The first hash utility invocation failed due to the shell's unsupported `C.UTF-8` locale. The successful retry used `LC_ALL=C`; no runtime binary was executed. Official-source statements were checked for consistency with the supplied local evidence, without fetching sources again.

## Recommendation and limits

Accept this profile/documentation scope with M01 as a minor correction. Standard-entrypoint routing, missing-runtime behavior, actual guard placement, toolkit ownership/rollback and child-process propagation remain subject to the forthcoming frozen G05/G07 source review and coordinator validation. G05/G07 overall acceptance, existing-service engine identification, fresh full-unit/build/native validation, and remote merge readiness are not established by this report. Preserve the earlier I01/G05 failure history and keep unresolved integration gates open.
