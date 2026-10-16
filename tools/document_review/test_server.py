"""Behaviour tests for the local document review storage server.

These tests exercise the HTTP seam and use a temporary manifest and comments
directory.  They intentionally do not use the application's business DB.
"""

from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path

try:
    from .server import ReviewServer, ReviewStore
except ImportError:  # Running the file directly from its directory.
    from server import ReviewServer, ReviewStore


class ReviewServerBehaviourTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.docs = root / "docs"
        self.docs.mkdir()
        self.manifest_path = root / "document-manifest.json"
        self.target_manifest_path = root / "document-manifest-22.json"
        self.comments = root / "comments"
        self.task_path = self.docs / "task-01.md"
        self.task_two_path = self.docs / "task-02.md"
        self.evidence_path = self.docs / "evidence-01.md"
        self.task_path.write_text("# 本地任务\n", encoding="utf-8")
        self.task_two_path.write_text("# 第二个本地任务\n", encoding="utf-8")
        self.evidence_path.write_text("# 验收证据\n", encoding="utf-8")
        self.manifest = {
            "documentId": "BT-DOC",
            "version": "2.1",
            "fingerprint": "sha256:document-21",
            "sourceFile": "design-system/visual-design.md",
            "documentUrl": "/design-system/visual-design.html",
            "blocks": [
                {
                    "id": "BT02-intro",
                    "chapter": "BT02",
                    "text": "前置说明：金额要容易比较。字号和行高也应解释。",
                    "sourceLine": 12,
                },
                {
                    "id": "BT08-table",
                    "chapter": "BT08",
                    "text": "行情已展开至：已经允许看的行情到哪天。",
                    "sourceLine": 88,
                },
                {
                    "id": "BT04-order",
                    "chapter": "BT04",
                    "text": "先验证第一段。",
                    "sourceLine": 104,
                },
                {
                    "id": "BT05-order",
                    "chapter": "BT05",
                    "text": "再验证第二段。",
                    "sourceLine": 118,
                },
                {
                    "id": "BT06-duplicate",
                    "chapter": "BT06",
                    "text": "重复词在这里，重复词在后面。",
                    "sourceLine": 132,
                },
            ],
            "images": [
                {
                    "id": "BT-PLATE04",
                    "occurrenceId": "BT-PLATE04@102",
                    "src": "images/bt04.png",
                    "fingerprint": "sha256:image-4",
                    "chapter": "BT04",
                },
                {
                    "id": "BT-PLATE04",
                    "occurrenceId": "BT-PLATE04@118",
                    "src": "images/bt04.png",
                    "fingerprint": "sha256:image-4",
                    "chapter": "BT05",
                },
            ],
        }
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        self.target_manifest = {
            **self.manifest,
            "version": "2.2",
            "fingerprint": "sha256:document-22",
            "blocks": [
                {**self.manifest["blocks"][0]},
                {**self.manifest["blocks"][1]},
                {**self.manifest["blocks"][2]},
                {**self.manifest["blocks"][3]},
                {**self.manifest["blocks"][4], "text": "重复词已经被改写。"},
            ],
        }
        self.target_manifest_path.write_text(json.dumps(self.target_manifest), encoding="utf-8")
        self.server = ReviewServer(
            ("127.0.0.1", 0),
            comments_dir=self.comments,
            docs_root=self.docs,
            manifest_paths=[self.manifest_path, self.target_manifest_path],
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.tmp.cleanup()

    def request(self, method: str, path: str, body: dict | None = None, headers=None):
        connection = HTTPConnection(self.host, self.port, timeout=3)
        encoded = None
        request_headers = {"Accept": "application/json"}
        if body is not None:
            encoded = json.dumps(body).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        request_headers.update(headers or {})
        connection.request(method, path, encoded, request_headers)
        response = connection.getresponse()
        raw = response.read()
        connection.close()
        content_type = response.getheader("Content-Type", "")
        if "application/json" in content_type:
            return response.status, json.loads(raw) if raw else None
        return response.status, raw.decode("utf-8") if raw else ""

    def request_export_bytes(self, path: str):
        connection = HTTPConnection(self.host, self.port, timeout=3)
        connection.request("GET", path, headers={"Accept": "*/*"})
        response = connection.getresponse()
        status = response.status
        content_type = response.getheader("Content-Type", "")
        disposition = response.getheader("Content-Disposition", "")
        raw = response.read()
        connection.close()
        return status, content_type, disposition, raw

    def create_request(self, operation_id="op-1", expected_revision=0, opinion="请补充说明"):
        return {
            "operationId": operation_id,
            "expectedRevision": expected_revision,
            "documentId": "BT-DOC",
            "action": "create",
            "actor": {"name": "审阅者", "role": "评论者"},
            "payload": {
                "version": "2.1",
                "fingerprint": "sha256:document-21",
                "segments": [
                    {
                        "blockId": "BT02-intro",
                        "chapter": "BT02",
                        "quote": "金额要容易比较。",
                        "before": "前置说明：",
                        "after": "字号和行高也应解释。",
                    }
                ],
                "image": None,
                "opinion": opinion,
            },
        }

    def test_get_starts_at_revision_zero(self):
        status, data = self.request("GET", "/api/review?documentId=BT-DOC")
        self.assertEqual(status, 200)
        self.assertEqual(data["revision"], 0)
        self.assertEqual(data["comments"], [])
        self.assertEqual(data["service"], {"storage": "local-file"})

    def test_create_persists_and_gets_by_document(self):
        status, created = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 200)
        self.assertEqual(created["revision"], 1)
        self.assertEqual(len(created["comments"]), 1)
        comment = created["comments"][0]
        self.assertEqual(comment["quote"], "金额要容易比较。")
        self.assertEqual(comment["status"], "pending-review")

        status, fetched = self.request("GET", "/api/review?documentId=BT-DOC")
        self.assertEqual(status, 200)
        self.assertEqual(fetched["revision"], 1)
        self.assertEqual(fetched["comments"], created["comments"])

    def test_same_operation_retry_is_idempotent_but_same_opinion_new_operation_is_new_comment(self):
        request = self.create_request(operation_id="op-1", opinion="同一意见")
        first_status, first = self.request("POST", "/api/review", request)
        retry_status, retry = self.request("POST", "/api/review", request)
        self.assertEqual((first_status, retry_status), (200, 200))
        self.assertEqual(retry, first)

        second = self.create_request(operation_id="op-2", expected_revision=1, opinion="同一意见")
        second_status, second_result = self.request("POST", "/api/review", second)
        self.assertEqual(second_status, 200)
        self.assertEqual(second_result["revision"], 2)
        self.assertEqual(len(second_result["comments"]), 2)

    def test_revision_conflict_returns_latest_without_writing(self):
        self.assertEqual(self.request("POST", "/api/review", self.create_request())[0], 200)
        stale = self.create_request(operation_id="stale", expected_revision=0)
        status, data = self.request("POST", "/api/review", stale)
        self.assertEqual(status, 409)
        self.assertEqual(data["error"]["code"], "revision-conflict")
        self.assertEqual(data["revision"], 1)
        self.assertEqual(len(data["comments"]), 1)

    def test_invalid_manifest_reference_does_not_pollute_storage(self):
        request = self.create_request()
        request["payload"]["segments"][0]["quote"] = "相似但不是清单原文。"
        status, data = self.request("POST", "/api/review", request)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-reference")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 0)
        self.assertEqual(list(self.comments.glob("*")), [])

    def test_context_must_be_adjacent_and_duplicate_substrings_need_context(self):
        request = self.create_request()
        request["payload"]["segments"][0]["after"] = "错误的后文"
        status, data = self.request("POST", "/api/review", request)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-reference")

        ambiguous = self.create_request(operation_id="ambiguous")
        ambiguous["payload"]["segments"][0] = {
            "blockId": "BT06-duplicate",
            "chapter": "BT06",
            "quote": "重复词",
            "before": "",
            "after": "",
        }
        status, data = self.request("POST", "/api/review", ambiguous)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-reference")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 0)

    def test_segments_must_follow_manifest_order_and_allow_cross_chapter_ranges(self):
        request = self.create_request(operation_id="ordered")
        request["payload"]["segments"] = [
            {
                "blockId": "BT04-order",
                "chapter": "BT04",
                "quote": "先验证第一段。",
                "before": "",
                "after": "",
            },
            {
                "blockId": "BT05-order",
                "chapter": "BT05",
                "quote": "再验证第二段。",
                "before": "",
                "after": "",
            },
        ]
        status, result = self.request("POST", "/api/review", request)
        self.assertEqual(status, 200)
        self.assertEqual(result["comments"][0]["quote"], "先验证第一段。\n再验证第二段。")

        reversed_request = self.create_request(operation_id="reversed", expected_revision=1)
        reversed_request["payload"]["segments"] = list(reversed(request["payload"]["segments"]))
        status, data = self.request("POST", "/api/review", reversed_request)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-reference")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 1)

    def test_storage_failure_does_not_publish_a_partial_revision(self):
        def fail_write(_document_id, _record):
            raise OSError("simulated atomic write failure")

        self.server.store._write_record = fail_write
        status, data = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 500)
        self.assertEqual(data["error"]["code"], "storage-error")
        status, result = self.request("GET", "/api/review?documentId=BT-DOC")
        self.assertEqual(status, 200)
        self.assertEqual(result["revision"], 0)
        self.assertEqual(result["comments"], [])
        self.assertEqual(list(self.comments.glob("*")), [])

    def test_image_reference_is_validated_against_manifest(self):
        request = self.create_request()
        request["payload"]["segments"] = []
        request["payload"]["image"] = {
            "id": "BT-PLATE04",
            "occurrenceId": "BT-PLATE04@102",
            "chapter": "BT04",
            "src": "images/bt04.png",
            "fingerprint": "sha256:image-4",
        }
        status, result = self.request("POST", "/api/review", request)
        self.assertEqual(status, 200)
        self.assertEqual(result["comments"][0]["image"]["id"], "BT-PLATE04")
        self.assertEqual(result["comments"][0]["image"]["occurrenceId"], "BT-PLATE04@102")
        self.assertEqual(result["comments"][0]["image"]["chapter"], "BT04")

        second = self.create_request(operation_id="image-second", expected_revision=1)
        second["payload"]["segments"] = []
        second["payload"]["image"] = {
            "id": "BT-PLATE04",
            "occurrenceId": "BT-PLATE04@118",
            "chapter": "BT05",
            "src": "images/bt04.png",
            "fingerprint": "sha256:image-4",
        }
        status, result = self.request("POST", "/api/review", second)
        self.assertEqual(status, 200)
        self.assertEqual(result["comments"][1]["image"]["occurrenceId"], "BT-PLATE04@118")
        self.assertEqual(result["comments"][1]["image"]["chapter"], "BT05")

    def test_manifest_symlink_outside_docs_root_is_not_discovered(self):
        outside = Path(self.tmp.name) / "outside-manifest.json"
        outside.write_text(json.dumps({**self.manifest, "documentId": "SYMLINK-DOC"}), encoding="utf-8")
        link_dir = self.docs / "design-system" / "baselines" / "linked"
        link_dir.mkdir(parents=True)
        (link_dir / "document-manifest.json").symlink_to(outside)
        status, data = self.request("GET", "/api/documents?documentId=SYMLINK-DOC")
        self.assertEqual(status, 200)
        self.assertEqual(data["documents"], [])

    def test_documents_exposes_safe_resolved_document_url(self):
        baseline = self.docs / "design-system" / "baselines" / "v21"
        baseline.mkdir(parents=True)
        (baseline / "visual-spec.html").write_text("<main>registered</main>", encoding="utf-8")
        manifest = {**self.manifest, "documentUrl": "visual-spec.html"}
        manifest_path = baseline / "document-manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        status, data = self.request("GET", "/api/documents?documentId=BT-DOC")
        self.assertEqual(status, 200)
        resolved = [item.get("resolvedDocumentUrl") for item in data["documents"] if item.get("version") == "2.1"]
        self.assertIn("/design-system/baselines/v21/visual-spec.html", resolved)

    def test_body_limit_and_cross_origin_write_are_rejected_without_pollution(self):
        too_large = self.create_request(opinion="x" * (ReviewStore.MAX_BODY_BYTES + 1))
        connection = HTTPConnection(self.host, self.port, timeout=3)
        encoded = json.dumps(too_large).encode("utf-8")
        connection.putrequest("POST", "/api/review")
        connection.putheader("Content-Type", "application/json")
        connection.putheader("Content-Length", str(len(encoded)))
        connection.endheaders()
        response = connection.getresponse()
        status = response.status
        data = json.loads(response.read())
        connection.close()
        self.assertEqual(status, 413)
        self.assertEqual(data["error"]["code"], "body-too-large")
        cross_origin = self.create_request(operation_id="cross")
        status, data = self.request(
            "POST",
            "/api/review",
            cross_origin,
            headers={"Origin": "https://evil.example"},
        )
        self.assertEqual(status, 403)
        self.assertEqual(data["error"]["code"], "cross-origin")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 0)

    def test_export_is_same_authoritative_record_and_markdown_is_plain_text(self):
        self.request("POST", "/api/review", self.create_request())
        status, content_type, disposition, raw = self.request_export_bytes(
            "/api/export?documentId=BT-DOC&format=json"
        )
        self.assertEqual(status, 200)
        self.assertEqual(content_type, "application/json; charset=utf-8")
        self.assertEqual(disposition, 'attachment; filename="BT-DOC.json"')
        data = json.loads(raw)
        self.assertEqual(data["revision"], 1)
        status, content_type, disposition, raw = self.request_export_bytes(
            "/api/export?documentId=BT-DOC&format=markdown"
        )
        self.assertEqual(status, 200)
        self.assertEqual(content_type, "text/markdown; charset=utf-8")
        self.assertEqual(disposition, 'attachment; filename="BT-DOC.md"')
        markdown = raw.decode("utf-8")
        self.assertIn("金额要容易比较。", markdown)
        self.assertIn("完整权威记录", markdown)
        self.assertIn("fingerprint", markdown)

    def test_static_files_are_confined_to_docs_root(self):
        (self.docs / "index.html").write_text("<p>readable</p>", encoding="utf-8")
        status, data = self.request("GET", "/index.html")
        self.assertEqual(status, 200)
        self.assertIn("readable", data if isinstance(data, str) else "")
        status, _ = self.request("GET", "/../document-manifest.json")
        self.assertIn(status, (403, 404))

    def test_review_reply_reopen_and_revision_lifecycle_preserve_history(self):
        status, created = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        review = self.create_request(operation_id="review-1", expected_revision=1)
        review["commentId"] = comment_id
        review["action"] = "review"
        review["payload"] = {
            "decision": "adopt",
            "reason": "需要补充实际操作说明",
            "tasks": [{"taskRef": str(self.task_path), "owner": "实施者"}],
        }
        status, data = self.request("POST", "/api/review", review)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-change")
        self.assertEqual(data["comments"][0]["tasks"][0]["owner"], "实施者")

        reply = self.create_request(operation_id="reply-1", expected_revision=2)
        reply["commentId"] = comment_id
        reply["action"] = "reply"
        reply["payload"] = {"body": "请保留原始引用。"}
        status, data = self.request("POST", "/api/review", reply)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-change")
        self.assertEqual(len(data["comments"][0]["replies"]), 1)

        submit = self.create_request(operation_id="submit-1", expected_revision=3)
        submit["commentId"] = comment_id
        submit["action"] = "submitRevision"
        submit["payload"] = {
            "targetVersion": "2.2",
            "targetFingerprint": "sha256:document-22",
            "tasks": [{
                "taskRef": str(self.task_path),
                "owner": "实施者",
                "completed": True,
                "accepted": True,
                "evidence": [{"path": str(self.evidence_path), "summary": "页面证据"}],
            }],
        }
        submit["actor"] = {"name": "提交者", "role": "实施者"}
        status, data = self.request("POST", "/api/review", submit)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-verification")
        self.assertEqual(data["comments"][0]["quote"], "金额要容易比较。")
        self.assertEqual(data["comments"][0]["revisions"][0]["anchors"][0]["method"], "automatic")

        verify = self.create_request(operation_id="verify-self", expected_revision=4)
        verify["commentId"] = comment_id
        verify["action"] = "verify"
        verify["actor"] = {"name": "提交者", "role": "复核者"}
        verify["payload"] = {"decision": "resolve", "reason": "看起来已完成", "evidence": [{"path": str(self.evidence_path), "summary": "复核"}]}
        status, data = self.request("POST", "/api/review", verify)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "self-verification")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 4)

        verify["operationId"] = "verify-owner"
        verify["actor"] = {"name": "实施者", "role": "复核者"}
        status, data = self.request("POST", "/api/review", verify)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "self-verification")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 4)

        verify["operationId"] = "verify-1"
        verify["expectedRevision"] = 4
        verify["actor"] = {"name": "独立复核者", "role": "复核者"}
        status, data = self.request("POST", "/api/review", verify)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "resolved")

        reopen = self.create_request(operation_id="reopen-1", expected_revision=5)
        reopen["commentId"] = comment_id
        reopen["action"] = "reopen"
        reopen["payload"] = {"reason": "发现回归，需要重新评审"}
        status, data = self.request("POST", "/api/review", reopen)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-review")
        self.assertGreaterEqual(len(data["comments"][0]["history"]), 6)

    def test_review_clarify_and_defer_need_explicit_reopen(self):
        status, created = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        clarify = self.create_request(operation_id="clarify", expected_revision=1)
        clarify["commentId"] = comment_id
        clarify["action"] = "review"
        clarify["payload"] = {"decision": "clarify", "reason": "业务含义尚不明确", "tasks": []}
        status, data = self.request("POST", "/api/review", clarify)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-clarification")

        reply = self.create_request(operation_id="clarify-reply", expected_revision=2)
        reply["commentId"] = comment_id
        reply["action"] = "reply"
        reply["payload"] = {"body": "补充了上下文，但不自动重开。"}
        status, data = self.request("POST", "/api/review", reply)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-clarification")

        reopen = self.create_request(operation_id="clarify-reopen", expected_revision=3)
        reopen["commentId"] = comment_id
        reopen["action"] = "reopen"
        reopen["payload"] = {"reason": "已补充说明，请重新评审"}
        status, data = self.request("POST", "/api/review", reopen)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-review")

    def test_submit_requires_real_registered_revision_and_all_task_acceptance(self):
        status, created = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        review = self.create_request(operation_id="review-task", expected_revision=1)
        review["commentId"] = comment_id
        review["action"] = "review"
        review["payload"] = {"decision": "adopt", "reason": "需要修改", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者"}]}
        self.assertEqual(self.request("POST", "/api/review", review)[0], 200)

        same_version = self.create_request(operation_id="same-version", expected_revision=2)
        same_version["commentId"] = comment_id
        same_version["action"] = "submitRevision"
        same_version["payload"] = {"targetVersion": "2.1", "targetFingerprint": "sha256:document-21", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者", "completed": True, "accepted": True, "evidence": [{"path": str(self.evidence_path), "summary": "原版本不能冒充新提交"}]}]}
        status, data = self.request("POST", "/api/review", same_version)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-document")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 2)

        fake = self.create_request(operation_id="fake-manifest", expected_revision=2)
        fake["commentId"] = comment_id
        fake["action"] = "submitRevision"
        fake["payload"] = {"targetVersion": "9.9", "targetFingerprint": "sha256:fake", "tasks": []}
        status, data = self.request("POST", "/api/review", fake)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-document")

        incomplete = self.create_request(operation_id="incomplete", expected_revision=2)
        incomplete["commentId"] = comment_id
        incomplete["action"] = "submitRevision"
        incomplete["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者", "completed": True, "accepted": False, "evidence": []}]}
        status, data = self.request("POST", "/api/review", incomplete)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "tasks-incomplete")
        self.assertEqual(self.request("GET", "/api/review?documentId=BT-DOC")[1]["revision"], 2)

    def test_changed_anchor_requires_map_and_delete_evidence_before_verify(self):
        request = self.create_request()
        request["payload"]["segments"][0].update({"quote": "重复词", "before": "", "after": "在这里，"})
        request["payload"]["segments"][0].update({"blockId": "BT06-duplicate", "chapter": "BT06"})
        status, created = self.request("POST", "/api/review", request)
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        review = self.create_request(operation_id="changed-review", expected_revision=1)
        review["commentId"] = comment_id
        review["action"] = "review"
        review["payload"] = {"decision": "adopt", "reason": "改写重复词说明", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者"}]}
        self.assertEqual(self.request("POST", "/api/review", review)[0], 200)
        submit = self.create_request(operation_id="changed-submit", expected_revision=2)
        submit["commentId"] = comment_id
        submit["action"] = "submitRevision"
        submit["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者", "completed": True, "accepted": True, "evidence": [{"path": str(self.evidence_path), "summary": "改写证据"}]}]}
        status, data = self.request("POST", "/api/review", submit)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-location")

        bad_map = self.create_request(operation_id="bad-map", expected_revision=3)
        bad_map["commentId"] = comment_id
        bad_map["action"] = "mapAnchor"
        bad_map["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "decision": "map", "oldBlockId": "BT06-duplicate", "newBlockId": "BT06-duplicate", "newText": "伪造的新文", "reason": "映射", "evidence": [{"path": str(self.evidence_path), "summary": "证据"}]}
        status, data = self.request("POST", "/api/review", bad_map)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-map")

        map_request = bad_map.copy()
        map_request["operationId"] = "good-map"
        map_request["expectedRevision"] = 3
        map_request["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "decision": "map", "oldBlockId": "BT06-duplicate", "newBlockId": "BT06-duplicate", "newText": "重复词已经被改写。", "reason": "确认对应的新块", "evidence": [{"path": str(self.evidence_path), "summary": "改写证据"}]}
        status, data = self.request("POST", "/api/review", map_request)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-verification")
        self.assertEqual(data["comments"][0]["quote"], "重复词")
        anchor = data["comments"][0]["anchors"][0]
        self.assertFalse(data["comments"][0]["revisions"][0]["initialAnchors"][0]["confirmed"])
        self.assertEqual(data["comments"][0]["revisions"][0]["anchors"][0]["method"], "manual")
        self.assertEqual(anchor["method"], "manual")
        submit_event = next(event for event in data["comments"][0]["history"] if event["action"] == "submitRevision")
        self.assertFalse(submit_event["revision"]["anchors"][0]["confirmed"])

    def test_invalid_state_and_delete_require_explicit_valid_transition(self):
        status, created = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        verify = self.create_request(operation_id="early-verify", expected_revision=1)
        verify["commentId"] = comment_id
        verify["action"] = "verify"
        verify["actor"] = {"name": "独立复核者", "role": "复核者"}
        verify["payload"] = {"decision": "resolve", "reason": "过早", "evidence": [{"path": str(self.evidence_path), "summary": "证据"}]}
        status, data = self.request("POST", "/api/review", verify)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-state")
        delete = self.create_request(operation_id="bad-delete", expected_revision=1)
        delete["commentId"] = comment_id
        delete["action"] = "mapAnchor"
        delete["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "decision": "delete", "oldBlockId": "BT02-intro", "reason": "误删", "evidence": [{"path": str(self.evidence_path), "summary": "删除证据"}]}
        status, data = self.request("POST", "/api/review", delete)
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "invalid-state")

    def test_one_comment_supports_multiple_tasks_and_shared_task_reference(self):
        status, created = self.request("POST", "/api/review", self.create_request())
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        review = self.create_request(operation_id="multi-review", expected_revision=1)
        review["commentId"] = comment_id
        review["action"] = "review"
        review["payload"] = {"decision": "adopt", "reason": "拆成两个任务", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者"}, {"taskRef": str(self.task_two_path), "owner": "实施者"}]}
        status, data = self.request("POST", "/api/review", review)
        self.assertEqual(status, 200)
        self.assertEqual(len(data["comments"][0]["tasks"]), 2)
        submit = self.create_request(operation_id="multi-submit", expected_revision=2)
        submit["commentId"] = comment_id
        submit["action"] = "submitRevision"
        submit["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者", "completed": True, "accepted": True, "evidence": [{"path": str(self.evidence_path), "summary": "任务一证据"}]}, {"taskRef": str(self.task_two_path), "owner": "实施者", "completed": True, "accepted": True, "evidence": [{"path": str(self.evidence_path), "summary": "任务二证据"}]}]}
        status, data = self.request("POST", "/api/review", submit)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-verification")

    def test_multiple_comments_can_share_one_task_reference(self):
        status, first = self.request("POST", "/api/review", self.create_request(operation_id="shared-one"))
        self.assertEqual(status, 200)
        first_id = first["comments"][0]["id"]
        second_request = self.create_request(operation_id="shared-two", expected_revision=1, opinion="第二条意见")
        status, second = self.request("POST", "/api/review", second_request)
        self.assertEqual(status, 200)
        second_id = second["comments"][1]["id"]
        for operation_id, revision, comment_id in (("shared-review-one", 2, first_id), ("shared-review-two", 3, second_id)):
            review = self.create_request(operation_id=operation_id, expected_revision=revision)
            review["commentId"] = comment_id
            review["action"] = "review"
            review["payload"] = {"decision": "adopt", "reason": "共享实施任务", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者"}]}
            status, _ = self.request("POST", "/api/review", review)
            self.assertEqual(status, 200)
        for operation_id, revision, comment_id in (("shared-submit-one", 4, first_id), ("shared-submit-two", 5, second_id)):
            submit = self.create_request(operation_id=operation_id, expected_revision=revision)
            submit["commentId"] = comment_id
            submit["action"] = "submitRevision"
            submit["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者", "completed": True, "accepted": True, "evidence": [{"path": str(self.evidence_path), "summary": "共享任务证据"}]}]}
            status, result = self.request("POST", "/api/review", submit)
            self.assertEqual(status, 200)
            self.assertEqual(result["comments"][0 if comment_id == first_id else 1]["status"], "pending-verification")

    def test_delete_mapping_requires_real_absence_then_enters_verification(self):
        delete_target = {**self.target_manifest, "blocks": [{**block} for block in self.target_manifest["blocks"]]}
        delete_target["blocks"][-1]["text"] = "目标版本已删除该说明。"
        self.target_manifest_path.write_text(json.dumps(delete_target), encoding="utf-8")
        request = self.create_request(operation_id="delete-create")
        request["payload"]["segments"][0].update({"blockId": "BT06-duplicate", "chapter": "BT06", "quote": "重复词", "before": "", "after": "在这里，"})
        status, created = self.request("POST", "/api/review", request)
        self.assertEqual(status, 200)
        comment_id = created["comments"][0]["id"]
        review = self.create_request(operation_id="delete-review", expected_revision=1)
        review["commentId"] = comment_id
        review["action"] = "review"
        review["payload"] = {"decision": "adopt", "reason": "确认删除无效说明", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者"}]}
        self.assertEqual(self.request("POST", "/api/review", review)[0], 200)
        submit = self.create_request(operation_id="delete-submit", expected_revision=2)
        submit["commentId"] = comment_id
        submit["action"] = "submitRevision"
        submit["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "tasks": [{"taskRef": str(self.task_path), "owner": "实施者", "completed": True, "accepted": True, "evidence": [{"path": str(self.evidence_path), "summary": "删除证据"}]}]}
        self.assertEqual(self.request("POST", "/api/review", submit)[1]["comments"][0]["status"], "pending-location")
        delete = self.create_request(operation_id="delete-map", expected_revision=3)
        delete["commentId"] = comment_id
        delete["action"] = "mapAnchor"
        delete["payload"] = {"targetVersion": "2.2", "targetFingerprint": "sha256:document-22", "decision": "delete", "oldBlockId": "BT06-duplicate", "reason": "目标版本确实删除该说明", "evidence": [{"path": str(self.evidence_path), "summary": "清单对照"}]}
        status, data = self.request("POST", "/api/review", delete)
        self.assertEqual(status, 200)
        self.assertEqual(data["comments"][0]["status"], "pending-verification")
        self.assertTrue(data["comments"][0]["anchors"][0]["deleted"])
        self.assertTrue(data["comments"][0]["revisions"][0]["anchors"][0]["deleted"])

    def test_restart_reads_phase_two_file_and_export_includes_history_tasks_replies(self):
        self.assertEqual(self.request("POST", "/api/review", self.create_request())[0], 200)
        comment_id = self.request("GET", "/api/review?documentId=BT-DOC")[1]["comments"][0]["id"]
        reply = self.create_request(operation_id="restart-reply", expected_revision=1)
        reply["commentId"] = comment_id
        reply["action"] = "reply"
        reply["payload"] = {"body": "保留历史。"}
        self.assertEqual(self.request("POST", "/api/review", reply)[0], 200)
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        restarted = ReviewServer(("127.0.0.1", 0), comments_dir=self.comments, docs_root=self.docs, manifest_paths=[self.manifest_path, self.target_manifest_path])
        thread = threading.Thread(target=restarted.serve_forever, daemon=True)
        thread.start()
        old_server, old_thread = self.server, self.thread
        self.server, self.thread = restarted, thread
        self.host, self.port = restarted.server_address
        status, data = self.request("GET", "/api/export?documentId=BT-DOC&format=json")
        self.assertEqual(status, 200)
        self.assertEqual(len(data["comments"][0]["replies"]), 1)
        self.assertIn("history", data["comments"][0])
        self.assertIn("tasks", data["comments"][0])


if __name__ == "__main__":
    unittest.main()
