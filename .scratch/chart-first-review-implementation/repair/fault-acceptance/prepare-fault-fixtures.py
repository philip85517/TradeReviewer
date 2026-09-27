#!/usr/bin/env python3
"""Create isolated Recall UI fixtures without touching the source database.

The source is opened read-only and copied with sqlite3.Connection.backup().
Only recall JSON/projection rows in the two new fixture files are changed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = ROOT / ".scratch/chart-first-review-implementation/repair/acceptance.sqlite"
LEGACY_FIXTURE = HERE / "legacy-fixture.sqlite"
PENDING_FIXTURE = HERE / "needs-confirmation-fixture.sqlite"
EPISODE_ID = (
    "episode:%5B%22SYNTHETIC-REPAIR-fresh-replay%3ACN%3A999996%3Alive%22"
    "%2C%222026-08-10T02%3A00%3A00.000Z%22%2C%22buy%22%2C%221000%22%2C%2256%22%5D:1"
)
ENTRY_ID = "synthetic-repair-fresh-replay-entry"
PARTIAL_ID = "synthetic-repair-fresh-replay-partial"
CLOSE_ID = "synthetic-repair-fresh-replay-close"
DRAWING_ID = "drawing-1790426055724-hn3sy"
DRAWING_OWNER = "synthetic-repair-fresh-replay-partial"


def connect_read_only(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def execution_fingerprint(connection: sqlite3.Connection) -> tuple[int, str]:
    columns = [row[1] for row in connection.execute("PRAGMA table_info(executions)")]
    rows = [dict(zip(columns, row)) for row in connection.execute(
        f"SELECT {', '.join(columns)} FROM executions ORDER BY id"
    )]
    payload = compact_json({"columns": columns, "rows": rows}).encode("utf-8")
    return len(rows), hashlib.sha256(payload).hexdigest()


def backup_source(destination: Path) -> None:
    if destination.exists():
        raise RuntimeError(f"refusing to replace existing fixture: {destination}")
    source = connect_read_only(SOURCE)
    target = sqlite3.connect(destination)
    try:
        source.backup(target)
        target.commit()
    finally:
        target.close()
        source.close()


def recall_row(connection: sqlite3.Connection) -> tuple[str, str | None, int, str]:
    row = connection.execute(
        "SELECT episode_id, draft_json, revision, finalized_json "
        "FROM recall_documents WHERE episode_id = ?",
        (EPISODE_ID,),
    ).fetchone()
    if row is None:
        raise RuntimeError(f"missing target Recall document: {EPISODE_ID}")
    return row


def update_recall_row(
    connection: sqlite3.Connection,
    draft: dict[str, Any],
    finalized: dict[str, Any] | None,
) -> None:
    connection.execute(
        "UPDATE recall_documents SET draft_json = ?, finalized_json = ? WHERE episode_id = ?",
        (compact_json(draft), compact_json(finalized) if finalized is not None else None, EPISODE_ID),
    )


def manual_evidence_pointers(document: dict[str, Any]) -> list[dict[str, Any]]:
    state = document.get("manualEvaluations") or {}
    pointers: list[dict[str, Any]] = []
    for key in ("drafts", "versions"):
        for evaluation in state.get(key, []):
            pointers.extend(
                evidence
                for evidence in evaluation.get("evidence", [])
                if evidence.get("kind") == "text"
                and evidence.get("drawingId") == DRAWING_ID
                and evidence.get("ownerId") == DRAWING_OWNER
            )
    return pointers


def make_legacy_missing_text_fixture(destination: Path) -> dict[str, Any]:
    backup_source(destination)
    connection = sqlite3.connect(destination)
    connection.row_factory = sqlite3.Row
    try:
        _, draft_json, revision, finalized_json = recall_row(connection)
        draft = json.loads(draft_json)
        finalized = json.loads(finalized_json) if finalized_json is not None else None
        before_draft = [dict(item) for item in manual_evidence_pointers(draft)]
        before_formal = [dict(item) for item in manual_evidence_pointers(finalized)] if finalized else []
        if not before_draft or not before_formal:
            raise RuntimeError("target fixture does not contain the expected Text evidence")

        changed = 0
        for document in (draft, finalized):
            if document is None:
                continue
            state = document.get("manualEvaluations") or {}
            for key in ("drafts", "versions"):
                for evaluation in state.get(key, []):
                    for evidence in evaluation.get("evidence", []):
                        if (
                            evidence.get("kind") == "text"
                            and evidence.get("drawingId") == DRAWING_ID
                            and evidence.get("ownerId") == DRAWING_OWNER
                            and evidence.get("textRevision") == 1
                        ):
                            evidence["textRevision"] = 2
                            changed += 1

        update_recall_row(connection, draft, finalized)
        projection_changed = connection.execute(
            "UPDATE recall_manual_evaluation_evidence "
            "SET text_revision = 2 "
            "WHERE episode_id = ? AND kind = 'text' AND drawing_id = ? "
            "AND owner_id = ? AND text_revision = 1",
            (EPISODE_ID, DRAWING_ID, DRAWING_OWNER),
        ).rowcount
        if projection_changed != changed:
            raise RuntimeError(
                f"legacy projection mismatch: JSON changed {changed}, projection changed {projection_changed}"
            )
        connection.commit()
        after_draft = manual_evidence_pointers(draft)
        after_formal = manual_evidence_pointers(finalized) if finalized else []
        return {
            "revision": revision,
            "draftPointersBefore": before_draft,
            "formalPointersBefore": before_formal,
            "draftPointersAfter": after_draft,
            "formalPointersAfter": after_formal,
            "projectionRowsChanged": projection_changed,
            "drawingId": DRAWING_ID,
            "drawingOwner": DRAWING_OWNER,
            "availableDrawingRevision": 1,
            "missingPointerRevision": 2,
        }
    finally:
        connection.close()


def manual_state(document: dict[str, Any]) -> dict[str, Any]:
    state = document.get("manualEvaluations")
    if not isinstance(state, dict):
        raise RuntimeError("target document has no manualEvaluations state")
    associations = state.get("associations")
    if not isinstance(associations, list) or len(associations) != 1:
        raise RuntimeError("expected exactly one episode-level manual association")
    return state


def make_needs_confirmation_fixture(destination: Path) -> dict[str, Any]:
    backup_source(destination)
    connection = sqlite3.connect(destination)
    connection.row_factory = sqlite3.Row
    try:
        _, draft_json, revision, finalized_json = recall_row(connection)
        draft = json.loads(draft_json)
        finalized = json.loads(finalized_json) if finalized_json is not None else None
        state = manual_state(draft)
        association = state["associations"][0]
        evaluation_id = association["evaluationId"]
        before = {
            "status": association.get("status"),
            "decisionId": association.get("decisionId"),
            "executionIds": list(association.get("executionIds", [])),
            "documentStatus": draft.get("status"),
        }
        association["status"] = "needs-confirmation"
        association["decisionId"] = None
        association["executionIds"] = [ENTRY_ID, PARTIAL_ID]
        draft["status"] = "needs-confirmation"
        draft.pop("completedAt", None)
        draft["reconciliation"] = {
            "addedExecutionIds": [],
            "removedExecutionIds": [CLOSE_ID],
            "stale": True,
        }
        update_recall_row(connection, draft, finalized)
        connection.execute(
            "UPDATE recall_manual_evaluation_associations SET status = 'needs-confirmation', decision_id = NULL "
            "WHERE episode_id = ? AND version_kind = 'draft' AND evaluation_id = ?",
            (EPISODE_ID, evaluation_id),
        )
        connection.execute(
            "DELETE FROM recall_manual_evaluation_association_executions "
            "WHERE episode_id = ? AND version_kind = 'draft' AND evaluation_id = ?",
            (EPISODE_ID, evaluation_id),
        )
        for execution_id in (ENTRY_ID, PARTIAL_ID):
            connection.execute(
                "INSERT INTO recall_manual_evaluation_association_executions "
                "(episode_id, version_kind, document_revision, evaluation_id, execution_id) "
                "VALUES (?, 'draft', ?, ?, ?)",
                (EPISODE_ID, revision, evaluation_id, execution_id),
            )
        connection.commit()
        after = {
            "status": association["status"],
            "decisionId": association["decisionId"],
            "executionIds": list(association["executionIds"]),
            "documentStatus": draft["status"],
        }
        formal_state = manual_state(finalized) if finalized else None
        formal_association = formal_state["associations"][0] if formal_state else None
        return {
            "revision": revision,
            "evaluationId": evaluation_id,
            "before": before,
            "after": after,
            "formalAfter": {
                "status": formal_association.get("status") if formal_association else None,
                "executionIds": list(formal_association.get("executionIds", [])) if formal_association else [],
                "documentStatus": finalized.get("status") if finalized else None,
            },
            "projectionExecutionIds": [ENTRY_ID, PARTIAL_ID],
            "staleExecutionId": CLOSE_ID,
        }
    finally:
        connection.close()


def verify_fixture(path: Path, expected_count: int, expected_hash: str) -> dict[str, Any]:
    connection = connect_read_only(path)
    try:
        count, digest = execution_fingerprint(connection)
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if count != expected_count or digest != expected_hash:
            raise RuntimeError(f"execution table changed in fixture {path}")
        if integrity != "ok":
            raise RuntimeError(f"integrity check failed for {path}: {integrity}")
        return {"executionCount": count, "executionSha256": digest, "integrityCheck": integrity}
    finally:
        connection.close()


def write_report(report: dict[str, Any]) -> None:
    report_path = HERE / "fixtures-report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="allow replacing only the two fixture files created by this script",
    )
    args = parser.parse_args()
    if not SOURCE.exists():
        raise SystemExit(f"source database not found: {SOURCE}")
    if args.force:
        for destination in (LEGACY_FIXTURE, PENDING_FIXTURE):
            if destination.exists():
                destination.unlink()

    source_before_connection = connect_read_only(SOURCE)
    try:
        source_count_before, source_hash_before = execution_fingerprint(source_before_connection)
    finally:
        source_before_connection.close()

    legacy = make_legacy_missing_text_fixture(LEGACY_FIXTURE)
    pending = make_needs_confirmation_fixture(PENDING_FIXTURE)

    source_after_connection = connect_read_only(SOURCE)
    try:
        source_count_after, source_hash_after = execution_fingerprint(source_after_connection)
    finally:
        source_after_connection.close()
    if (source_count_before, source_hash_before) != (source_count_after, source_hash_after):
        raise RuntimeError("source executions changed while preparing fixtures")

    report = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": str(SOURCE),
        "episodeId": EPISODE_ID,
        "sourceExecutionsBefore": {"count": source_count_before, "sha256": source_hash_before},
        "sourceExecutionsAfter": {"count": source_count_after, "sha256": source_hash_after},
        "legacyFixture": {
            "path": str(LEGACY_FIXTURE),
            **verify_fixture(LEGACY_FIXTURE, source_count_before, source_hash_before),
            **legacy,
        },
        "needsConfirmationFixture": {
            "path": str(PENDING_FIXTURE),
            **verify_fixture(PENDING_FIXTURE, source_count_before, source_hash_before),
            **pending,
        },
        "startup": {
            "legacy": "TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f7a5/TradeReview/.scratch/chart-first-review-implementation/repair/fault-acceptance/legacy-fixture.sqlite npm run dev -- --hostname 127.0.0.1 --port 3052",
            "needsConfirmation": "TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f7a5/TradeReview/.scratch/chart-first-review-implementation/repair/fault-acceptance/needs-confirmation-fixture.sqlite npm run dev -- --hostname 127.0.0.1 --port 3052",
        },
        "scope": "isolated UI fixture only; it does not prove a real import/reimport journey",
    }
    write_report(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
