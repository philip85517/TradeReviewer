# TL20-D01 independent acceptance review preflight

**Status:** `PREPARED — NOT A VERDICT`

**Reviewer:** Luna 5.6 Max (independent acceptance reviewer)

**Implementer:** Sol 6.1 Ultra (`/root/legacy_contract_sol`)

**Date:** 2026-10-26

## Scope and constraints

This record prepares the independent acceptance review for the legacy identity and contract decision in TL20-D01. It is a bounded preflight only. The implementer report and review package were not available when this record was prepared, so neither specification compliance nor task quality is accepted, rejected, or inferred here.

The review is limited to the read-only decision/research scope in the dispatch brief: establish facts from the current source, propose an exact candidate contract where justified, and document compatibility and validation evidence. No product implementation, UI work, migration, business database write, commit, push, or merge is authorized for this review. Synthetic records may be used in temporary read-only validation, but they do not establish product acceptance.

The only file written by this preflight is this file under `evidence/decisions/TL20-D01/`.

## Version and reference anchors

The review is anchored to the source manifest at `.scratch/trading-library-v20-development/evidence/source-manifest.json`, whose baseline commit is `d95afc37d30f817edbd6daab41e85f485138de0d`. The acceptance reviewer must use the current files and source evidence, not a worker summary alone.

Authoritative inputs read for this preflight:

- `.scratch/trading-library-v20-development/evidence/dispatch/legacy-contract-brief.md` — dispatch scope, forbidden actions, four synthetic record classes, candidate contract requirements, validation requirements, and report format.
- `.scratch/trading-library-v20-development/issues/01-legacy-contract.md` — TL20-D01 question, evidence obligations, and resolution fields.
- `.scratch/trading-library-v20-development/DESIGN-COVERAGE.md` — relevant requirement IDs and the fact that future product/UI evidence is initially `unverified`.
- `.scratch/trading-library-v20-development/INTERFACES.md` — ownership and contract boundaries for practice identity, imports, revisions, rounds, pairs, and Recall.
- `.scratch/trading-library-v20-development/README.md` and `EXECUTION.md` — round state, read-only decision scope, and acceptance restrictions.
- `docs/agents/development-workflow.md` — coordinator ownership, independent acceptance, evidence requirements, data safety, and pure-decision applicability.
- `docs/agents/task-decomposition.md` — requirement-to-reference mapping and acceptance evidence rules.
- `docs/agents/issue-tracker.md` — `accepted` requires independent coordinator verification; `NOT VERIFIED` must be preserved.
- `docs/design-system/trading-library-design-spec.md` — authoritative practice, duplicate/update, date/source, round, execution, allocation, and pending-policy semantics (especially lines 7–79 and 111–129).
- `docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md` — BT04 identity and partial-fill examples (lines 134–170), plus BT09/BT10 evidence and pending-boundary rules (lines 354–408).

Current source anchors inspected before the worker report:

- `app/lib/trades/types.ts:100-138,181-216` — execution source fields, `TradeEpisode`, and `tradeScopeKey`.
- `app/lib/trades/episodes.ts:23-47,85-131` — episode sorting, scope grouping, opening keys, and generated episode IDs.
- `app/lib/storage/import-history.ts:8-28,43-115` — legacy import-history shape and compatibility parsing.
- `app/lib/storage/sqlite-contracts.ts:29-77` and `app/lib/storage/sqlite-http-client.ts:52-166` — current bootstrap, payload, merge, and HTTP contracts.
- `db/sqlite-schema.ts:35-61,181-200,412-437` — import batches, executions, simulation fields, Recall documents, and migration history.
- `app/lib/storage/sqlite-store.ts:311-370,1008-1140,1242-1352,1695-1872` — provenance/reconciliation helpers, persistence and revision scope, transaction path, and import writes.
- `app/api/storage/bootstrap/route.ts:13-21`, `app/api/storage/trades/route.ts:19-43`, and `app/api/storage/trade-revisions/route.ts:5-19` — current storage API entry points.
- `app/lib/recall/server-repository.ts:102-197`, `app/lib/storage/recall-completion-bridge.ts:14-51`, and `app/lib/recall/types.ts:23-26,105-124,144-206` — episode-keyed Recall documents, CAS save path, completion bridge, and execution-based decisions/evidence.

These anchors establish review risks to test against the worker's evidence: the baseline has no first-class practice entity; `simulationRunId` is an existing source field, not proof of practice equivalence; episode IDs are generated from scope/opening/time/occurrence; import-batch/source provenance and trade-revision scope are not a complete practice/version contract; and Recall is currently keyed by `episodeId`. A candidate contract must explicitly adapt or preserve these references instead of silently treating them as the new identity.

## Independent acceptance gates

Both gates remain `NOT VERIFIED` until the worker report and review package are available and the reviewer checks the source evidence directly.

### Gate A — specification compliance

Check that the work answers every dispatch and issue requirement, with exact source anchors and no invented policy:

- current SQLite, bootstrap, storage HTTP, import-history, trade-revision, episode, and Recall paths are traced end to end;
- the candidate TypeScript types and function signatures are exact and cover practice, version, source record, human action round, internal pair/allocation, and Recall adaptation where required;
- field-level mapping states which existing fields are retained, transformed, insufficient, or intentionally unknown;
- the four synthetic records are separately represented and can show what does and does not distinguish file, version, source record, human action round, and internal pairing;
- the proof does not use filename, net amount, time, or price as a durable identity substitute, and does not infer a human round or pair from timing/price heuristics;
- the transaction boundary covers import preview/choice/commit and affected references, with expected-revision/CAS behavior where applicable;
- dry-run or preview behavior, rollback/atomicity, and old-reference compatibility are addressed with reproducible evidence;
- facts are separated from recommendations, and date, behavior, multi-scope, human-recognition, conflict, and migration/backfill decisions remain explicitly pending HITL or follow-up tickets when the authoritative design leaves them pending;
- no backfill, migration, product implementation, or business-DB mutation is presented as completed without authorization and evidence.

### Gate B — task quality

Check that the work is reviewable, reproducible, and safe:

- report status is one of `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`, with version, fact/source-line citations, candidate contract, four-case evidence, commands/results, and open items;
- every acceptance claim points to actual source or synthetic evidence and can be rerun from the listed command and fixture inputs;
- synthetic fixtures contain no real trade content or secrets and are sufficient to exercise complete date, missing/ambiguous date, legacy run, and existing manual artifact/Recall cases;
- the report records limitations and unresolved gaps as `NOT VERIFIED` rather than hiding them behind a diagram, type sketch, DOM result, or passing callback;
- scope remains read-only and no product files, config, real business DB, commits, pushes, or merges were changed;
- evidence is internally consistent with the current source version and does not rely on an archived handoff copy or worker self-certification in place of direct inspection.

## Required four-case evidence matrix

For each row, the eventual review package must provide the synthetic input, observed output, command, result, and source anchors. A field may be `unknown` or `not derivable` when the current system cannot establish it; that is evidence, not a defect to paper over.

| Case | Required scenario | Evidence that must be checked | Disallowed inference |
| --- | --- | --- | --- |
| A | Complete practice date | Mapping from account/instrument/date/source and all records to a stable practice reference, version, source records, and any applicable round/pair/Recall references; duplicate/update behavior is explicit. | Treating a filename, import timestamp, net amount, time, or price as the practice identity. |
| B | Missing or ambiguous date | Explicit transient/unknown handling, user-confirmation boundary, and preservation of source/import/history dates as distinct fields; no silent fallback to an import or history date. | Inventing a formal unknown practice row or silently substituting `importedAt`, file date, or trade range for practice date. |
| C | Legacy run | Mapping of an existing `simulationRunId` and old episode/import references into the candidate contract, including whether equivalence is impossible and how old references remain readable. | Treating `simulationRunId` alone as a stable practice/version identity or assuming all records in a legacy run are equivalent without evidence. |
| D | Existing manual artifact | Recall/review document, decisions, execution evidence, revision, and human-artifact references are tested for compatibility with practice and version; action round and internal pair remain separate concepts. | Treating an episode ID or an execution-ID list as proof of a stable human action round or internal pair, or inferring pairing from time/price. |

The reviewer must also verify the negative claim for each case: no cross-practice pairing, no accidental reuse of an old reference as a new practice/version, and no silent deletion or transfer of notes, screenshots, annotations, or history on update.

## Contract and state-safety checklist

The eventual review must inspect the actual candidate declarations and call paths, not only prose or diagrams:

1. Practice identity includes the account/instrument/date/source semantics required by the design, and numbering remains stable under sorting and duplicate handling.
2. Practice version is distinguishable from the practice itself; source file/document, source record, import batch, and revision references have explicit semantics and do not collapse into one ID.
3. A source execution record is addressable independently of a practice, version, human action round, and internal allocation/pair.
4. Human action round, completed round, execution detail, and internal pair/allocation have distinct contracts and providers/consumers; partial fills and residual quantities do not collapse concepts.
5. Recall's episode-bound documents and completion bridge have an explicit adapter/reference strategy, including old-reference read compatibility and behavior when the new reference is unavailable.
6. Import preview produces candidate diff and user choice before writes. Commit uses one atomic transaction and an expected revision/CAS guard where the current contract requires it. Rollback leaves prior state and references intact.
7. Legacy references are either proven compatible or explicitly marked as requiring an adaptation/decision ticket. No migration/backfill is claimed without an authorized scope.
8. The proposed contract identifies real providers and consumers in the current source and marks future consumers or policy-dependent behavior as pending rather than pretending implementation exists.

## Applicability and evidence boundaries

This is a pure read-only decision/contract preflight. Frontend control, visual comparison, browser interaction, physical/mouse/keyboard/touch, and product-database persistence gates are `NOT APPLICABLE` for this bounded scope, with that scope reason recorded here. They must not be manufactured from a type check, static diagram, HTTP response, or synthetic fixture. If a later worker change affects frontend controls, interactions, layout, or data/state wiring, the project frontend control and visual audit standard applies separately before delivery.

The requested acceptance is therefore currently `NOT VERIFIED`; no product acceptance or issue closure follows from this preflight.

## Review package required before verdict

When root supplies the worker report and review-package paths, the independent reviewer will:

- read the report and every cited fixture/result;
- inspect the current source and any changed evidence files directly at the anchored version;
- rerun or spot-check listed read-only commands and verify the four synthetic classes;
- record separate Gate A and Gate B findings, including any `FAIL` or `NOT VERIFIED` item and a stable problem ID for repair/review tracking;
- state whether the evidence supports `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`, without converting open policy questions into implementation requirements;
- preserve this preflight and add the actual verdict in the designated decision evidence only after the report/package are present.

The same stable-problem repair/review loop is capped at five rounds; root tracks the round count as required by the dispatch brief.

**Preflight conclusion:** ready for the next independent review pass once the worker report and review package exist. No verdict is issued in this file.
