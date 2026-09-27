"""Read-only audit of the synthetic acceptance database; never opens business data."""
from pathlib import Path
import base64
import hashlib
import json
import sqlite3
import sys
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--expect-final", action="store_true")
parser.add_argument("--prefix", default="R5")
args = parser.parse_args()
assert args.prefix and all(c.isalnum() or c in "-_" for c in args.prefix)

root = Path(__file__).resolve().parent
target = root / "acceptance.sqlite"
assert target.is_file() and not target.is_symlink()

def digest(rows):
    return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=True).encode()).hexdigest()

with sqlite3.connect(target.as_uri() + "?mode=ro", uri=True) as db:
    db.row_factory = sqlite3.Row
    rows = [dict(r) for r in db.execute("SELECT * FROM executions ORDER BY id")]
    old24 = [r for r in rows if not r["id"].startswith("synthetic-repair-low-price-")]
    old21 = [r for r in old24 if not r["id"].startswith("synthetic-repair-delivery-fresh-")]
    assert len(rows) == 25 and digest(rows) == "1b79e6e605b493b4e0ce7833094824c807680c972166a83a1a3f0b8aefd12b36"
    assert len(old24) == 24 and digest(old24) == "e6fb7f410f9692fb3ce9e7bd05ec3456af61ba4e52bdb31563f779d01764cf55"
    assert len(old21) == 21 and digest(old21) == "24a9793c206dbea76d03211a18d387ea89f6acfc999b5845857f9abdae64384d"
    assert db.execute("PRAGMA quick_check").fetchone()[0] == "ok"
    row = db.execute("SELECT * FROM recall_documents WHERE episode_id LIKE '%999996%'").fetchone()
    draft = json.loads(row["draft_json"])
    formal = json.loads(row["finalized_json"]) if row["finalized_json"] else None
    global_snapshot = next((s for s in (formal or draft)["snapshots"] if s["decisionId"] == "global"), None)
    bundle = next((b for b in (formal or draft).get("retainedBundles", []) if global_snapshot and b["id"] == global_snapshot.get("retainedBundleId")), None)
    report = {
        "database": str(target), "mode": "read-only", "quickCheck": "ok",
        "rawExecutions": {"count": len(rows), "sha256": digest(rows), "old24Sha256": digest(old24), "old21Sha256": digest(old21)},
        "revision": row["revision"], "draftStatus": draft.get("status"), "formalStatus": (formal or {}).get("status"),
        "working": {k: draft["working"].get(k) for k in ("phase", "cursor", "executionCursor", "selectedDecisionId", "hasSeenFuture")},
        "globalSnapshot": {k: global_snapshot.get(k) for k in ("id", "phase", "cursor", "executionCursor", "timeframe", "hasSeenFuture", "retainedBundleId")} if global_snapshot else None,
        "globalBundle": {k: bundle.get(k) for k in ("id", "captureContext", "actualMetrics", "exitEvaluationRevisionIds", "manualEvaluationRevisionIds")} if bundle else None,
        "storyboard": draft.get("storyboard"),
    }
    if args.expect_final:
        assert formal and formal["status"] == "completed"
        assert global_snapshot and global_snapshot["phase"] == "post-review"
        assert global_snapshot["executionCursor"] == "synthetic-repair-fresh-replay-close"
        assert global_snapshot["cursor"] == "2026-09-24T16:00:00.000Z"
        assert bundle and bundle.get("manualEvaluationRevisionIds")
        assert bundle["captureContext"]["phase"] == "post-review"
        (root / "reports" / f"{args.prefix}-final-global.png").write_bytes(base64.b64decode(global_snapshot["imageDataUrl"].split(",", 1)[1]))
    filename = f"{args.prefix}-final-state.json" if args.expect_final else f"{args.prefix}-state-before-final-recheck.json"
    (root / "reports" / filename).write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({"output": filename, "revision": row["revision"], "rawCount": len(rows), "formalPhase": global_snapshot.get("phase") if global_snapshot else None, "hasBundle": bool(bundle)}, ensure_ascii=False))
