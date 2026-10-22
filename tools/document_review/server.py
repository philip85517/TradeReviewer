"""Loopback-only static document preview and local review storage service.

The service deliberately has no business database dependency.  Its only
mutable state is a JSON review record below the explicitly supplied comments
directory.  Document identity and quote validation come from generated
``document-manifest.json`` files; clients cannot choose arbitrary source text.
"""

from __future__ import annotations

import argparse
import copy
import html
import json
import mimetypes
import os
import re
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, unquote, urlsplit


DOCUMENT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def error_payload(code: str, message: str, **extra: Any) -> Dict[str, Any]:
    result: Dict[str, Any] = {"error": {"code": code, "message": message}}
    result.update(extra)
    return result


class ReviewValidationError(Exception):
    """A client input failed a contract validation before a write."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class ReviewStore:
    """Atomic, revisioned JSON store for one document's review comments."""

    MAX_BODY_BYTES = 1024 * 1024
    STORE_VERSION = 1

    def __init__(
        self,
        comments_dir: Path,
        *,
        docs_root: Optional[Path] = None,
        manifest_paths: Optional[Sequence[Path]] = None,
    ) -> None:
        raw_comments_dir = Path(comments_dir).expanduser()
        if raw_comments_dir.exists() and raw_comments_dir.is_symlink():
            raise ValueError("comments-dir must not be a symlink")
        self.comments_dir = raw_comments_dir.resolve()
        self.comments_dir.mkdir(parents=True, exist_ok=True)
        if not self.comments_dir.is_dir():
            raise ValueError("comments-dir must be a directory")
        self.docs_root = (Path(docs_root).expanduser().resolve() if docs_root else None)
        self.manifest_paths = [Path(path).expanduser().resolve() for path in (manifest_paths or [])]
        self.project_root = Path(__file__).resolve().parents[2]
        self._lock = threading.RLock()

    @staticmethod
    def validate_document_id(document_id: Any) -> str:
        if not isinstance(document_id, str) or not DOCUMENT_ID_RE.fullmatch(document_id):
            raise ReviewValidationError("invalid-document", "documentId is not a safe document identifier")
        return document_id

    def _store_path(self, document_id: str) -> Path:
        self.validate_document_id(document_id)
        target = self.comments_dir / (document_id + ".json")
        if target.is_symlink():
            raise OSError("refusing to follow a symlink in comments-dir")
        return target

    def _manifest_candidates(self) -> Iterable[Path]:
        seen = set()
        for path in self.manifest_paths:
            if path not in seen:
                seen.add(path)
                yield path
        if self.docs_root and self.docs_root.exists():
            pattern = "design-system/baselines/**/document-manifest.json"
            for path in sorted(self.docs_root.glob(pattern)):
                # The docs-root allowlist is based on the resolved target, so
                # a manifest symlink cannot smuggle a file in from elsewhere.
                if path.is_symlink():
                    continue
                resolved = path.resolve()
                try:
                    resolved.relative_to(self.docs_root)
                except ValueError:
                    continue
                if resolved not in seen:
                    seen.add(resolved)
                    yield resolved

    def _read_manifests(self) -> List[Dict[str, Any]]:
        manifests: List[Dict[str, Any]] = []
        for path in self._manifest_candidates():
            try:
                if not path.is_file() or path.is_symlink():
                    continue
                with path.open("r", encoding="utf-8") as handle:
                    manifest = json.load(handle)
            except (OSError, ValueError):
                continue
            if not isinstance(manifest, dict):
                continue
            if isinstance(manifest.get("documentId"), str):
                manifest = copy.deepcopy(manifest)
                manifest["_manifestPath"] = str(path)
                manifests.append(manifest)
        return manifests

    def documents(self, document_id: Optional[str] = None) -> Dict[str, Any]:
        manifests = self._read_manifests()
        if document_id is not None:
            self.validate_document_id(document_id)
            manifests = [item for item in manifests if item.get("documentId") == document_id]
        versions: List[Dict[str, Any]] = []
        for manifest in manifests:
            public = {key: value for key, value in manifest.items() if not key.startswith("_")}
            raw_url = public.get("documentUrl")
            manifest_path = manifest.get("_manifestPath")
            if isinstance(raw_url, str) and raw_url and isinstance(manifest_path, str) and self.docs_root:
                candidate = (Path(manifest_path).parent / raw_url).resolve()
                try:
                    relative = candidate.relative_to(self.docs_root)
                except ValueError:
                    relative = None
                if relative is not None and candidate.is_file():
                    # Keep documentUrl as the manifest's source field.  This
                    # derived field is the safe URL that the reader can load.
                    public["resolvedDocumentUrl"] = "/" + relative.as_posix()
            versions.append(public)
        versions.sort(key=lambda item: (str(item.get("documentId", "")), str(item.get("version", ""))))
        return {"documents": versions}

    def _find_manifest(self, document_id: str, version: Any, fingerprint: Any) -> Dict[str, Any]:
        if not isinstance(version, str) or not version:
            raise ReviewValidationError("invalid-document", "payload.version must be a registered version")
        if not isinstance(fingerprint, str) or not fingerprint:
            raise ReviewValidationError("invalid-document", "payload.fingerprint must be a registered fingerprint")
        matches = [
            manifest
            for manifest in self._read_manifests()
            if manifest.get("documentId") == document_id
            and manifest.get("version") == version
            and manifest.get("fingerprint") == fingerprint
        ]
        if not matches:
            raise ReviewValidationError("invalid-document", "document version or fingerprint is not registered")
        return matches[0]

    @staticmethod
    def _index_by_id(items: Any, kind: str) -> Dict[str, Dict[str, Any]]:
        if not isinstance(items, list):
            raise ReviewValidationError("invalid-manifest", f"manifest.{kind} must be an array")
        result: Dict[str, Dict[str, Any]] = {}
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                raise ReviewValidationError("invalid-manifest", f"manifest.{kind} has an invalid item")
            if item["id"] in result:
                raise ReviewValidationError("invalid-manifest", f"manifest.{kind} has duplicate id: {item['id']}")
            result[item["id"]] = item
        return result

    @staticmethod
    def _index_images(items: Any) -> Dict[Tuple[str, str, str], Dict[str, Any]]:
        if not isinstance(items, list):
            raise ReviewValidationError("invalid-manifest", "manifest.images must be an array")
        result: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        for item in items:
            if not isinstance(item, dict):
                raise ReviewValidationError("invalid-manifest", "manifest.images has an invalid item")
            image_id = item.get("id")
            occurrence_id = item.get("occurrenceId")
            chapter = item.get("chapter")
            if not all(isinstance(value, str) and value for value in (image_id, occurrence_id, chapter)):
                raise ReviewValidationError("invalid-manifest", "manifest.images requires id, occurrenceId, and chapter")
            key = (image_id, occurrence_id, chapter)
            if key in result:
                raise ReviewValidationError("invalid-manifest", f"manifest.images has duplicate occurrence: {occurrence_id}")
            result[key] = item
        return result

    @staticmethod
    def _quote_start(block_text: str, quote: str, before: str, after: str) -> int:
        """Return the one occurrence whose immediate context matches."""
        starts: List[int] = []
        cursor = 0
        while True:
            start = block_text.find(quote, cursor)
            if start < 0:
                break
            starts.append(start)
            cursor = start + 1
        candidates = [
            start
            for start in starts
            if block_text[:start].endswith(before)
            and block_text[start + len(quote) :].startswith(after)
        ]
        if len(candidates) != 1:
            raise ReviewValidationError("invalid-reference", "quote and before/after do not identify one manifest occurrence")
        return candidates[0]

    def _validate_payload(self, document_id: str, payload: Any) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        if not isinstance(payload, dict):
            raise ReviewValidationError("invalid-payload", "payload must be an object")
        manifest = self._find_manifest(document_id, payload.get("version"), payload.get("fingerprint"))
        blocks = self._index_by_id(manifest.get("blocks"), "blocks")
        block_order = {block_id: index for index, block_id in enumerate(blocks)}
        images = self._index_images(manifest.get("images", []))
        segments = payload.get("segments")
        if not isinstance(segments, list):
            raise ReviewValidationError("invalid-payload", "payload.segments must be an array")
        if not segments and payload.get("image") is None:
            raise ReviewValidationError("invalid-payload", "a comment needs a text segment or image")
        clean_segments: List[Dict[str, Any]] = []
        previous_block_index = -1
        for segment in segments:
            if not isinstance(segment, dict):
                raise ReviewValidationError("invalid-reference", "each segment must be an object")
            block_id = segment.get("blockId")
            block = blocks.get(block_id)
            if block is None:
                raise ReviewValidationError("invalid-reference", f"unknown blockId: {block_id}")
            if segment.get("chapter") != block.get("chapter"):
                raise ReviewValidationError("invalid-reference", f"chapter does not match blockId: {block_id}")
            block_text = block.get("text")
            if not isinstance(block_text, str):
                raise ReviewValidationError("invalid-manifest", f"block text is invalid: {block_id}")
            quote = segment.get("quote")
            if not isinstance(quote, str) or not quote or quote not in block_text:
                raise ReviewValidationError("invalid-reference", f"quote does not match blockId: {block_id}")
            before = segment.get("before", "")
            after = segment.get("after", "")
            if not isinstance(before, str) or not isinstance(after, str):
                raise ReviewValidationError("invalid-reference", "before and after must be text")
            block_index = block_order[block_id]
            if block_index <= previous_block_index:
                raise ReviewValidationError("invalid-reference", "segments must follow manifest block order")
            previous_block_index = block_index
            self._quote_start(block_text, quote, before, after)
            clean_segments.append(
                {
                    "blockId": block_id,
                    "chapter": block.get("chapter"),
                    "quote": quote,
                    "before": before,
                    "after": after,
                }
            )
        image = payload.get("image")
        clean_image: Optional[Dict[str, Any]] = None
        if image is not None:
            if not isinstance(image, dict):
                raise ReviewValidationError("invalid-reference", "image must be an object or null")
            image_id = image.get("id")
            occurrence_id = image.get("occurrenceId")
            chapter = image.get("chapter")
            expected_image = images.get((image_id, occurrence_id, chapter))
            if expected_image is None:
                raise ReviewValidationError("invalid-reference", "image occurrence does not match manifest")
            for key in ("src", "fingerprint"):
                if image.get(key) != expected_image.get(key):
                    raise ReviewValidationError("invalid-reference", f"image.{key} does not match manifest")
            clean_image = {
                "id": image_id,
                "occurrenceId": occurrence_id,
                "chapter": chapter,
                "src": expected_image.get("src"),
                "fingerprint": expected_image.get("fingerprint"),
            }
        opinion = payload.get("opinion")
        if not isinstance(opinion, str) or not opinion.strip():
            raise ReviewValidationError("invalid-opinion", "opinion must be non-empty text")
        clean_payload = {
            "version": manifest.get("version"),
            "fingerprint": manifest.get("fingerprint"),
            "segments": clean_segments,
            "image": clean_image,
            "opinion": opinion,
        }
        return manifest, clean_payload

    def _empty_record(self, document_id: str) -> Dict[str, Any]:
        return {
            "storeVersion": self.STORE_VERSION,
            "documentId": document_id,
            "revision": 0,
            "comments": [],
            "operations": {},
        }

    def _read_record(self, document_id: str) -> Dict[str, Any]:
        path = self._store_path(document_id)
        if not path.exists():
            return self._empty_record(document_id)
        with path.open("r", encoding="utf-8") as handle:
            record = json.load(handle)
        if not isinstance(record, dict) or record.get("documentId") != document_id:
            raise OSError("review record has an invalid document identity")
        record.setdefault("comments", [])
        record.setdefault("operations", {})
        record.setdefault("revision", 0)
        for comment in record["comments"]:
            if isinstance(comment, dict):
                comment.setdefault("replies", [])
                comment.setdefault("tasks", [])
                comment.setdefault("revisions", [])
                comment.setdefault("anchors", [])
        return record

    def _write_record(self, document_id: str, record: Dict[str, Any]) -> None:
        path = self._store_path(document_id)
        fd, temp_name = tempfile.mkstemp(prefix=f".{document_id}.", suffix=".tmp", dir=str(self.comments_dir))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(record, handle, ensure_ascii=False, indent=2, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, path)
            try:
                directory_fd = os.open(str(self.comments_dir), os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
            except OSError:
                pass
        except Exception:
            try:
                os.unlink(temp_name)
            except OSError:
                pass
            raise

    @staticmethod
    def _public_record(record: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "revision": record.get("revision", 0),
            "comments": copy.deepcopy(record.get("comments", [])),
            "service": {"storage": "local-file"},
        }

    def get(self, document_id: str) -> Dict[str, Any]:
        with self._lock:
            self.validate_document_id(document_id)
            return self._public_record(self._read_record(document_id))

    def _trusted_path(self, value: Any, *, suffix: Optional[str] = None) -> Path:
        if not isinstance(value, str) or not value.strip():
            raise ReviewValidationError("invalid-evidence", "a local file path is required")
        candidate = Path(value).expanduser()
        if not candidate.is_absolute():
            project_candidate = self.project_root / candidate
            docs_candidate = self.docs_root / candidate if self.docs_root else project_candidate
            candidate = project_candidate if project_candidate.exists() else docs_candidate
        resolved = candidate.resolve()
        roots = [self.project_root, self.docs_root] if self.docs_root else [self.project_root]
        if not any(root == resolved or root in resolved.parents for root in roots):
            raise ReviewValidationError("invalid-evidence", "path is outside trusted local roots")
        if suffix and resolved.suffix.lower() != suffix.lower():
            raise ReviewValidationError("invalid-task", "taskRef must point to a Markdown file")
        if not resolved.is_file():
            raise ReviewValidationError("invalid-evidence", "referenced local file does not exist")
        return resolved

    def _validate_evidence(self, value: Any, *, required: bool = True) -> List[Dict[str, str]]:
        if not isinstance(value, list) or (required and not value):
            raise ReviewValidationError("invalid-evidence", "evidence must contain local files and summaries")
        result: List[Dict[str, str]] = []
        for item in value:
            if not isinstance(item, dict) or not isinstance(item.get("summary"), str) or not item["summary"].strip():
                raise ReviewValidationError("invalid-evidence", "each evidence item needs a summary")
            path = self._trusted_path(item.get("path"))
            result.append({"path": str(path), "summary": item["summary"]})
        return result

    def _validate_task(self, item: Any, *, completion: bool = False) -> Dict[str, Any]:
        if not isinstance(item, dict) or not isinstance(item.get("taskRef"), str) or not isinstance(item.get("owner"), str) or not item["owner"].strip():
            raise ReviewValidationError("invalid-task", "each task needs taskRef and owner")
        task_path = self._trusted_path(item["taskRef"], suffix=".md")
        result: Dict[str, Any] = {"taskRef": str(task_path), "owner": item["owner"]}
        if completion:
            if item.get("completed") is not True or item.get("accepted") is not True:
                raise ReviewValidationError("tasks-incomplete", "every task must be completed and accepted")
            result["completed"] = True
            result["accepted"] = True
            result["evidence"] = self._validate_evidence(item.get("evidence"))
        return result

    @staticmethod
    def _event(comment: Dict[str, Any], actor: Dict[str, str], action: str, status: Optional[str] = None, reason: Optional[str] = None, **extra: Any) -> None:
        event: Dict[str, Any] = {"action": action, "status": status or comment.get("status"), "actor": copy.deepcopy(actor), "at": utc_now()}
        if reason is not None:
            event["reason"] = reason
        event.update(copy.deepcopy(extra))
        comment.setdefault("history", []).append(event)

    @staticmethod
    def _comment(record: Dict[str, Any], comment_id: Any) -> Dict[str, Any]:
        if not isinstance(comment_id, str) or not comment_id:
            raise ReviewValidationError("invalid-comment", "commentId is required for this action")
        for comment in record.get("comments", []):
            if comment.get("id") == comment_id:
                return comment
        raise ReviewValidationError("invalid-comment", "commentId does not exist")

    def _target_manifest(self, document_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._find_manifest(document_id, payload.get("targetVersion"), payload.get("targetFingerprint"))

    def _automatic_anchors(self, comment: Dict[str, Any], target: Dict[str, Any]) -> List[Dict[str, Any]]:
        blocks = self._index_by_id(target.get("blocks"), "blocks")
        anchors: List[Dict[str, Any]] = []
        for segment in comment.get("segments", []):
            block = blocks.get(segment.get("blockId"))
            if block is None or not isinstance(block.get("text"), str):
                anchors.append({"kind": "text", "oldBlockId": segment.get("blockId"), "oldQuote": segment.get("quote"), "before": segment.get("before", ""), "after": segment.get("after", ""), "confirmed": False, "reason": "deleted"})
                continue
            try:
                self._quote_start(block["text"], segment["quote"], segment.get("before", ""), segment.get("after", ""))
            except ReviewValidationError:
                reason = "changed" if segment.get("quote", "") in block["text"] else "deleted"
                anchors.append({"kind": "text", "oldBlockId": segment.get("blockId"), "oldQuote": segment.get("quote"), "before": segment.get("before", ""), "after": segment.get("after", ""), "confirmed": False, "reason": reason})
            else:
                anchors.append({"kind": "text", "oldBlockId": segment.get("blockId"), "newBlockId": segment.get("blockId"), "oldQuote": segment.get("quote"), "newQuote": segment.get("quote"), "newText": block["text"], "before": segment.get("before", ""), "after": segment.get("after", ""), "confirmed": True, "method": "automatic"})
        image = comment.get("image")
        if image is not None:
            images = self._index_images(target.get("images", []))
            key = (image.get("id"), image.get("occurrenceId"), image.get("chapter"))
            target_image = images.get(key)
            if target_image is None or target_image.get("src") != image.get("src") or target_image.get("fingerprint") != image.get("fingerprint"):
                anchors.append({"kind": "image", "oldImage": copy.deepcopy(image), "confirmed": False, "reason": "changed" if target_image else "deleted"})
            else:
                anchors.append({"kind": "image", "oldImage": copy.deepcopy(image), "newImage": copy.deepcopy(target_image), "confirmed": True, "method": "automatic"})
        return anchors

    def _apply_action(self, record: Dict[str, Any], request: Dict[str, Any], actor: Dict[str, str], comment: Dict[str, Any]) -> None:
        action = request["action"]
        payload = request.get("payload")
        if not isinstance(payload, dict):
            raise ReviewValidationError("invalid-payload", "payload must be an object")
        status = comment.get("status")
        if action == "review":
            if status != "pending-review":
                raise ReviewValidationError("invalid-state", "review is only valid for pending-review")
            decision = payload.get("decision")
            reason = payload.get("reason")
            if decision not in {"adopt", "clarify", "defer"} or not isinstance(reason, str) or not reason.strip():
                raise ReviewValidationError("invalid-transition", "review needs a decision and reason")
            tasks = payload.get("tasks", [])
            if not isinstance(tasks, list):
                raise ReviewValidationError("invalid-task", "tasks must be an array")
            if decision == "adopt" and not tasks:
                raise ReviewValidationError("invalid-task", "adopt needs at least one task")
            if decision != "adopt" and tasks:
                raise ReviewValidationError("invalid-task", "clarify and defer do not accept implementation tasks")
            clean_tasks = [self._validate_task(item) for item in tasks]
            comment["tasks"] = clean_tasks
            new_status = {"adopt": "pending-change", "clarify": "pending-clarification", "defer": "deferred"}[decision]
            comment["status"] = new_status
            self._event(comment, actor, "review", new_status, reason, decision=decision, tasks=clean_tasks)
            return
        if action == "reply":
            body = payload.get("body")
            if not isinstance(body, str) or not body.strip():
                raise ReviewValidationError("invalid-reply", "reply body must be non-empty text")
            comment.setdefault("replies", []).append({"body": body, "actor": copy.deepcopy(actor), "at": utc_now()})
            self._event(comment, actor, "reply")
            return
        if action == "reopen":
            if status not in {"pending-clarification", "deferred", "resolved", "pending-location"}:
                raise ReviewValidationError("invalid-state", "only deferred, clarification, location, or resolved comments can reopen")
            reason = payload.get("reason")
            if not isinstance(reason, str) or not reason.strip():
                raise ReviewValidationError("invalid-transition", "reopen needs a reason")
            comment["status"] = "pending-review"
            self._event(comment, actor, "reopen", "pending-review", reason)
            return
        if action == "submitRevision":
            if status != "pending-change":
                raise ReviewValidationError("invalid-state", "submitRevision is only valid for pending-change")
            target = self._target_manifest(comment["documentId"], payload)
            if target.get("version") == comment.get("version") and target.get("fingerprint") == comment.get("fingerprint"):
                raise ReviewValidationError("invalid-document", "submitRevision requires a different registered document version")
            submitted_tasks = payload.get("tasks")
            if not isinstance(submitted_tasks, list):
                raise ReviewValidationError("tasks-incomplete", "all stored tasks must be submitted")
            clean_tasks = [self._validate_task(item, completion=True) for item in submitted_tasks]
            expected = {(task.get("taskRef"), task.get("owner")) for task in comment.get("tasks", [])}
            actual = {(task.get("taskRef"), task.get("owner")) for task in clean_tasks}
            if actual != expected:
                raise ReviewValidationError("tasks-incomplete", "submitted tasks must exactly match reviewed tasks")
            anchors = self._automatic_anchors(comment, target)
            revision = {"targetVersion": target.get("version"), "targetFingerprint": target.get("fingerprint"), "tasks": clean_tasks, "initialAnchors": copy.deepcopy(anchors), "anchors": anchors, "actor": copy.deepcopy(actor), "at": utc_now()}
            comment.setdefault("revisions", []).append(revision)
            comment["anchors"] = copy.deepcopy(anchors)
            comment["status"] = "pending-verification" if all(anchor.get("confirmed") for anchor in anchors) else "pending-location"
            self._event(comment, actor, "submitRevision", comment["status"], None, revision=copy.deepcopy(revision))
            return
        if action == "mapAnchor":
            if status != "pending-location":
                raise ReviewValidationError("invalid-state", "mapAnchor is only valid for pending-location")
            latest_revision = comment.get("revisions", [])[-1] if comment.get("revisions") else {}
            if payload.get("targetVersion") != latest_revision.get("targetVersion") or payload.get("targetFingerprint") != latest_revision.get("targetFingerprint"):
                raise ReviewValidationError("invalid-map", "anchor mapping must use the submitted target revision")
            target = self._target_manifest(comment["documentId"], payload)
            anchors = comment.get("anchors", [])
            old_block = payload.get("oldBlockId")
            old_occurrence = payload.get("oldOccurrenceId")
            unresolved = next((anchor for anchor in anchors if not anchor.get("confirmed") and ((old_block and anchor.get("oldBlockId") == old_block) or (old_occurrence and anchor.get("oldImage", {}).get("occurrenceId") == old_occurrence))), None)
            if unresolved is None:
                raise ReviewValidationError("invalid-map", "oldBlockId does not identify an unresolved anchor")
            evidence = self._validate_evidence(payload.get("evidence"))
            reason = payload.get("reason")
            if not isinstance(reason, str) or not reason.strip():
                raise ReviewValidationError("invalid-map", "mapAnchor needs a reason")
            decision = payload.get("decision")
            blocks = self._index_by_id(target.get("blocks"), "blocks")
            if unresolved.get("kind") == "image":
                images = self._index_images(target.get("images", []))
                if decision == "map":
                    new_image = payload.get("newImage")
                    if not isinstance(new_image, dict):
                        raise ReviewValidationError("invalid-map", "image map needs the complete newImage")
                    key = (new_image.get("id"), new_image.get("occurrenceId"), new_image.get("chapter"))
                    target_image = images.get(key)
                    if target_image is None or any(new_image.get(field) != target_image.get(field) for field in ("src", "fingerprint")):
                        raise ReviewValidationError("invalid-map", "newImage must match the registered manifest occurrence")
                    unresolved.update({"newImage": copy.deepcopy(target_image), "confirmed": True, "method": "manual", "reason": reason, "evidence": evidence})
                elif decision == "delete":
                    old_image = unresolved.get("oldImage", {})
                    old_key = (old_image.get("id"), old_image.get("occurrenceId"), old_image.get("chapter"))
                    if old_key in images:
                        raise ReviewValidationError("invalid-map", "delete requires the old image occurrence to be absent from the target manifest")
                    unresolved.update({"confirmed": True, "method": "manual-delete", "deleted": True, "reason": reason, "evidence": evidence})
                else:
                    raise ReviewValidationError("invalid-map", "decision must be map or delete")
            elif decision == "map":
                new_id, new_text = payload.get("newBlockId"), payload.get("newText")
                block = blocks.get(new_id)
                if block is None or block.get("text") != new_text:
                    raise ReviewValidationError("invalid-map", "newBlockId and newText must match the registered manifest")
                unresolved.update({"newBlockId": new_id, "newText": new_text, "confirmed": True, "method": "manual", "reason": reason, "evidence": evidence})
            elif decision == "delete":
                old_quote = unresolved.get("oldQuote")
                if not isinstance(old_quote, str) or any(isinstance(block.get("text"), str) and old_quote in block["text"] for block in blocks.values()):
                    raise ReviewValidationError("invalid-map", "delete requires the old quote to be absent from the target manifest")
                unresolved.update({"confirmed": True, "method": "manual-delete", "deleted": True, "reason": reason, "evidence": evidence})
            else:
                raise ReviewValidationError("invalid-map", "decision must be map or delete")
            comment["anchors"] = copy.deepcopy(anchors)
            if all(anchor.get("confirmed") for anchor in anchors):
                comment["status"] = "pending-verification"
            if comment.get("revisions"):
                comment["revisions"][-1]["anchors"] = copy.deepcopy(anchors)
            self._event(comment, actor, "mapAnchor", comment.get("status"), reason, anchor=copy.deepcopy(unresolved))
            return
        if action == "verify":
            if status != "pending-verification":
                raise ReviewValidationError("invalid-state", "verify is only valid for pending-verification")
            revisions = comment.get("revisions", [])
            owners = {task.get("owner") for task in (revisions[-1].get("tasks", []) if revisions else [])}
            submitter = revisions[-1].get("actor", {}).get("name") if revisions else None
            if actor.get("name") in owners or actor.get("name") == submitter:
                raise ReviewValidationError("self-verification", "the implementer cannot verify their own revision")
            decision = payload.get("decision")
            reason = payload.get("reason")
            if decision not in {"resolve", "return"} or not isinstance(reason, str) or not reason.strip():
                raise ReviewValidationError("invalid-transition", "verify needs a decision and reason")
            evidence = self._validate_evidence(payload.get("evidence"), required=(decision == "resolve"))
            if decision == "resolve":
                comment["status"] = "resolved"
            else:
                return_to = payload.get("returnTo")
                if return_to not in {"pending-change", "pending-clarification"}:
                    raise ReviewValidationError("invalid-transition", "return requires pending-change or pending-clarification")
                comment["status"] = return_to
            self._event(comment, actor, "verify", comment["status"], reason, decision=decision, evidence=evidence)
            return
        raise ReviewValidationError("unsupported-action", f"unsupported review action: {action}")

    def apply(self, request: Any) -> Dict[str, Any]:
        if not isinstance(request, dict):
            raise ReviewValidationError("invalid-request", "request must be an object")
        operation_id = request.get("operationId")
        if not isinstance(operation_id, str) or not operation_id.strip() or len(operation_id) > 256:
            raise ReviewValidationError("invalid-operation", "operationId must be non-empty text")
        document_id = self.validate_document_id(request.get("documentId"))
        action = request.get("action")
        if action not in {"create", "review", "reply", "submitRevision", "verify", "reopen", "mapAnchor"}:
            raise ReviewValidationError("unsupported-action", "unsupported review action")
        actor = request.get("actor")
        if not isinstance(actor, dict) or not isinstance(actor.get("name"), str) or not actor["name"].strip() or not isinstance(actor.get("role"), str) or not actor["role"].strip():
            raise ReviewValidationError("invalid-actor", "actor.name and actor.role are required")
        expected_revision = request.get("expectedRevision")
        if isinstance(expected_revision, bool) or not isinstance(expected_revision, int) or expected_revision < 0:
            raise ReviewValidationError("invalid-revision", "expectedRevision must be a non-negative integer")
        with self._lock:
            record = self._read_record(document_id)
            known_operation = record.get("operations", {}).get(operation_id)
            if known_operation is not None:
                return copy.deepcopy(known_operation["response"])
            current_revision = record.get("revision", 0)
            if expected_revision != current_revision:
                latest = self._public_record(record)
                latest["error"] = {"code": "revision-conflict", "message": "expectedRevision does not match the latest revision"}
                return latest
            updated = copy.deepcopy(record)
            actor_clean = {"name": actor["name"], "role": actor["role"]}
            operation_comment_id = request.get("commentId")
            if action == "create":
                _, clean_payload = self._validate_payload(document_id, request.get("payload"))
                comment_id = f"comment-{uuid.uuid4().hex}"
                now = utc_now()
                comment = {"id": comment_id, "documentId": document_id, "version": clean_payload["version"], "fingerprint": clean_payload["fingerprint"], "segments": clean_payload["segments"], "quote": "\n".join(segment["quote"] for segment in clean_payload["segments"]), "image": clean_payload["image"], "opinion": clean_payload["opinion"], "actor": actor_clean, "status": "pending-review", "createdAt": now, "replies": [], "tasks": [], "revisions": [], "anchors": [], "history": [{"action": "create", "status": "pending-review", "actor": actor_clean, "at": now}]}
                updated.setdefault("comments", []).append(comment)
                operation_comment_id = comment_id
            else:
                comment = self._comment(updated, request.get("commentId"))
                self._apply_action(updated, request, actor_clean, comment)
            updated["revision"] = current_revision + 1
            response = self._public_record(updated)
            updated.setdefault("operations", {})[operation_id] = {"revision": updated["revision"], "commentId": operation_comment_id, "response": response}
            self._write_record(document_id, updated)
            return response

    def create(self, request: Any) -> Dict[str, Any]:
        return self.apply(request)


class ReviewRequestHandler(BaseHTTPRequestHandler):
    server_version = "TradeReviewDocumentReview/1"

    @property
    def review_server(self) -> "ReviewServer":
        return self.server  # type: ignore[return-value]

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _json(self, status: int, payload: Any, *, content_disposition: Optional[str] = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if content_disposition is not None:
            self.send_header("Content-Disposition", content_disposition)
        self.end_headers()
        self.wfile.write(body)

    def _text(
        self,
        status: int,
        body_text: str,
        content_type: str = "text/plain; charset=utf-8",
        *,
        content_disposition: Optional[str] = None,
    ) -> None:
        body = body_text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if content_disposition is not None:
            self.send_header("Content-Disposition", content_disposition)
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str, **extra: Any) -> None:
        self._json(status, error_payload(code, message, **extra))

    def _query(self) -> Dict[str, List[str]]:
        return parse_qs(urlsplit(self.path).query, keep_blank_values=True)

    def _document_id(self) -> Optional[str]:
        values = self._query().get("documentId", [])
        return values[0] if values else None

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host", "")
        allowed = {f"http://{host}"}
        hostname = host.rsplit(":", 1)[0].strip("[]") if host else ""
        if hostname in LOOPBACK_HOSTS:
            allowed.add(f"http://{hostname}:{host.rsplit(':', 1)[1]}" if ":" in host else f"http://{hostname}")
            allowed.add(f"http://127.0.0.1:{host.rsplit(':', 1)[1]}" if ":" in host else "http://127.0.0.1")
        return origin.rstrip("/") in {item.rstrip("/") for item in allowed}

    def _read_json_body(self) -> Any:
        length_header = self.headers.get("Content-Length")
        if length_header is None:
            raise ReviewValidationError("missing-content-length", "Content-Length is required")
        try:
            length = int(length_header)
        except ValueError:
            raise ReviewValidationError("invalid-content-length", "Content-Length must be an integer")
        if length < 0:
            raise ReviewValidationError("invalid-content-length", "Content-Length must be non-negative")
        if length > ReviewStore.MAX_BODY_BYTES:
            raise ReviewValidationError("body-too-large", "request body exceeds the configured limit")
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ReviewValidationError("invalid-json", "request body must be UTF-8 JSON")

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        try:
            if parsed.path == "/api/review":
                document_id = self._document_id()
                if document_id is None:
                    self._error(400, "missing-document", "documentId is required")
                    return
                self._json(200, self.review_server.store.get(document_id))
                return
            if parsed.path == "/api/documents":
                document_id = self._document_id()
                self._json(200, self.review_server.store.documents(document_id))
                return
            if parsed.path == "/api/export":
                document_id = self._document_id()
                if document_id is None:
                    self._error(400, "missing-document", "documentId is required")
                    return
                export_format = self._query().get("format", ["json"])[0]
                review = self.review_server.store.get(document_id)
                if export_format == "json":
                    self._json(
                        200,
                        review,
                        content_disposition=f'attachment; filename="{document_id}.json"',
                    )
                    return
                if export_format == "markdown":
                    self._text(
                        200,
                        self._markdown(review),
                        "text/markdown; charset=utf-8",
                        content_disposition=f'attachment; filename="{document_id}.md"',
                    )
                    return
                self._error(400, "invalid-format", "format must be json or markdown")
                return
            self._serve_static(parsed.path)
        except ReviewValidationError as exc:
            self._error(422, exc.code, exc.message)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            self._error(500, "storage-error", str(exc))

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path != "/api/review":
            self._error(404, "not-found", "route not found")
            return
        if not self._origin_allowed():
            self._error(403, "cross-origin", "write requests must be same-origin")
            return
        try:
            request = self._read_json_body()
            result = self.review_server.store.create(request)
            if "error" in result and result["error"].get("code") == "revision-conflict":
                self._json(409, result)
            else:
                self._json(200, result)
        except ReviewValidationError as exc:
            status = 413 if exc.code == "body-too-large" else 400
            if exc.code in {"invalid-reference", "invalid-document", "invalid-opinion", "invalid-actor", "invalid-payload", "invalid-comment", "invalid-reply", "invalid-task", "invalid-evidence", "tasks-incomplete", "invalid-state", "invalid-transition", "invalid-map", "self-verification", "invalid-manifest"}:
                status = 422
            self._error(status, exc.code, exc.message)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            self._error(500, "storage-error", str(exc))

    def _serve_static(self, request_path: str) -> None:
        relative = unquote(request_path.lstrip("/")) or "index.html"
        if "\x00" in relative:
            self._error(400, "invalid-path", "path contains a null byte")
            return
        candidate = (self.review_server.docs_root / relative).resolve()
        try:
            candidate.relative_to(self.review_server.docs_root)
        except ValueError:
            self._error(403, "unsafe-path", "path is outside the static docs root")
            return
        if not candidate.is_file():
            self._error(404, "not-found", "static file not found")
            return
        body = candidate.read_bytes()
        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    @staticmethod
    def _markdown(review: Dict[str, Any]) -> str:
        lines = [f"# 文档评论（revision {review['revision']}）", ""]
        for comment in review.get("comments", []):
            lines.extend(
                [
                    f"## {comment.get('id', '')} · {comment.get('status', '')}",
                    f"- 版本：{comment.get('version', '')}",
                    f"- 指纹：{comment.get('fingerprint', '')}",
                    f"- 章节：{', '.join(segment.get('chapter', '') for segment in comment.get('segments', []))}",
                    f"- 片段：{json.dumps(comment.get('segments', []), ensure_ascii=False)}",
                    f"- 原文：{comment.get('quote', '')}",
                    f"- 图片：{json.dumps(comment.get('image'), ensure_ascii=False)}",
                    f"- 意见：{comment.get('opinion', '')}",
                    f"- 操作者：{json.dumps(comment.get('actor', {}), ensure_ascii=False)}",
                    f"- 回复：{json.dumps(comment.get('replies', []), ensure_ascii=False)}",
                    f"- 任务：{json.dumps(comment.get('tasks', []), ensure_ascii=False)}",
                    f"- 修订：{json.dumps(comment.get('revisions', []), ensure_ascii=False)}",
                    f"- 定位映射：{json.dumps(comment.get('anchors', []), ensure_ascii=False)}",
                    f"- 历史：{json.dumps(comment.get('history', []), ensure_ascii=False)}",
                    "- 完整权威记录：",
                    "```json",
                    json.dumps(comment, ensure_ascii=False, indent=2, sort_keys=True),
                    "```",
                    "",
                ]
            )
        return "\n".join(lines)


class ReviewServer(HTTPServer):
    """HTTP server configured for loopback document review use."""

    allow_reuse_address = True

    def __init__(
        self,
        server_address: Tuple[str, int],
        *,
        comments_dir: Path,
        docs_root: Optional[Path] = None,
        manifest_paths: Optional[Sequence[Path]] = None,
    ) -> None:
        host = server_address[0]
        if host not in LOOPBACK_HOSTS:
            raise ValueError("document review server must bind to loopback")
        default_docs = Path(__file__).resolve().parents[2] / "docs"
        self.docs_root = (Path(docs_root).expanduser().resolve() if docs_root else default_docs.resolve())
        self.store = ReviewStore(comments_dir, docs_root=self.docs_root, manifest_paths=manifest_paths)
        super().__init__(server_address, ReviewRequestHandler)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TradeReview local document review server")
    parser.add_argument("--host", default="127.0.0.1", choices=sorted(LOOPBACK_HOSTS))
    parser.add_argument("--port", type=int, default=3072)
    parser.add_argument("--comments-dir", required=True, type=Path)
    parser.add_argument("--docs-root", type=Path, default=None)
    parser.add_argument("--manifest", action="append", type=Path, dest="manifest_paths")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    server = ReviewServer(
        (args.host, args.port),
        comments_dir=args.comments_dir,
        docs_root=args.docs_root,
        manifest_paths=args.manifest_paths,
    )
    try:
        print(f"document review listening on http://{args.host}:{server.server_address[1]}", flush=True)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
