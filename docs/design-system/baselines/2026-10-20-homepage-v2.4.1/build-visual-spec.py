#!/usr/bin/env python3
"""Build the 2.3 representative document reader and its stable comment manifest.

The Markdown source remains authoritative.  This renderer is intentionally
dependency-free and only implements the subset used by the strategy design
documents.  Stable block identity is kept in a separate JSON file so a
reordered source does not silently move an existing comment to another block.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit


HERE = Path(__file__).resolve().parent
FALLBACK_SOURCE = HERE.parent / "2026-10-11-strategy-backtest-v2" / "visual-design.md"
DEFAULT_SOURCE = HERE / "visual-design.md"
DEFAULT_OUTPUT = HERE / "visual-spec.html"
DEFAULT_MANIFEST = HERE / "document-manifest.json"
DEFAULT_IDENTITY = HERE / "document-identity.json"
DOCUMENT_ID = "HOME-DOC-V23"
VERSION = "2.4.1"

IMAGE_ID_BY_STEM = {
    "search.svg": "search",
    "search-result-frame.svg": "search",
    "search-empty-frame.svg": "search-empty",
    "search-error-frame.svg": "search-error",
    "search-motion-before-frame.svg": "search-motion-before",
    "search-motion-during-frame.svg": "search-motion-during",
    "search-motion-after-frame.svg": "search-motion-after",
}


def explicit_image_id(raw_src: str, fallback: str) -> str:
    name = Path(urlsplit(raw_src).path).name
    return IMAGE_ID_BY_STEM.get(name, Path(name).stem or fallback)


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def slugify(value: str) -> str:
    value = re.sub(r"[`*_~]", "", value).strip().lower()
    value = re.sub(r"[^\w\u4e00-\u9fff\- ]+", "", value, flags=re.UNICODE)
    return re.sub(r"[\s_-]+", "-", value).strip("-") or "section"


def split_table(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_separator(line: str) -> bool:
    cells = split_table(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def chapter_for_heading(title: str, current: str) -> str:
    match = re.search(r"\b((?:BT|HP)\d{2})\b", title)
    return match.group(1) if match else current


def chapter_from_marker(marker: str | None, current: str) -> str:
    match = re.search(r"\b((?:BT|HP)\d{2})\b", marker or "")
    return match.group(1) if match else current


def chapter_from_heading_anchor(raw_title: str, current: str) -> str:
    match = re.search(r"\{#chapter-((?:BT|HP)\d{2})\}", raw_title)
    return match.group(1) if match else current


def strip_markdown(value: str) -> str:
    """Return the complete selectable text represented by inline Markdown."""
    value = re.sub(r"!\[([^]]*)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = re.sub(r"[*_~]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def source_key(kind: str, text: str) -> str:
    return sha256_text(f"{kind}\0{text}")[:24]


def _stable_marker(line: str) -> tuple[str | None, str]:
    match = re.fullmatch(r"\s*<!--\s*stable-id\s*:\s*([A-Za-z0-9._-]+)\s*-->\s*", line)
    return (match.group(1), "") if match else (None, line)


def collect_descriptors(source: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Collect commentable blocks and images with one-based source lines."""
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    chapter = "DOC"
    previous_image: dict[str, Any] | None = None
    i = 0

    def add(kind: str, raw_text: str, line_no: int, explicit_id: str | None = None, **extra: Any) -> None:
        text = strip_markdown(raw_text)
        if not text:
            return
        blocks.append(
            {
                "kind": kind,
                "chapter": chapter,
                "text": text,
                "sourceLine": line_no,
                "sourceKey": source_key(kind, text),
                "explicitId": explicit_id,
                **extra,
            }
        )

    while i < len(lines):
        line = lines[i]
        if not line.strip():
            # Keep an image alive across the conventional blank line before
            # its caption.  The following non-caption paragraph clears it.
            i += 1
            continue

        marker, visible_line = _stable_marker(line)
        if marker:
            i += 1
            if i >= len(lines):
                break
            line = lines[i]
            visible_line = line

        heading = re.match(r"^\s*(#{1,6})\s+(.+?)\s*#*\s*$", visible_line)
        if heading:
            raw_title = heading.group(2)
            title = re.sub(r"\s*\{#[^}]+\}\s*$", "", raw_title).strip()
            chapter = chapter_from_heading_anchor(raw_title, chapter_for_heading(title, chapter_from_marker(marker, chapter)))
            if chapter == "DOC" and marker is None:
                for probe in lines[i + 1:]:
                    if re.match(r"^\s*#{1,6}\s+", probe):
                        break
                    hint = re.search(r"stable-id\s*:\s*(HOME-[A-Za-z0-9._-]*?((?:BT|HP)\d{2}))", probe)
                    if hint:
                        chapter = hint.group(2)
                        break
            previous_image = None
            i += 1
            continue

        if visible_line.strip() == "<details>":
            close = i + 1
            while close < len(lines) and lines[close].strip() != "</details>":
                close += 1
            content_start = i + 1
            while content_start < close and (not lines[content_start].strip() or lines[content_start].lstrip().startswith("<summary>")):
                content_start += 1
            content = [lines[index].strip() for index in range(content_start, close) if lines[index].strip()]
            if content:
                add("paragraph", " ".join(content), content_start + 1, marker)
            previous_image = None
            i = min(close + 1, len(lines))
            continue

        if visible_line.strip() in {":::state-demo", ":::replay-demo", ":::layout-detail", ":::replay-details"}:
            close = i + 1
            while close < len(lines) and lines[close].strip() != ":::":
                close += 1
            i = min(close + 1, len(lines))
            continue

        fence = re.match(r"^\s*```\s*([\w-]*)\s*$", visible_line)
        if fence:
            close = i + 1
            while close < len(lines) and not re.match(r"^\s*```\s*$", lines[close]):
                close += 1
            i = min(close + 1, len(lines))
            continue

        image = re.match(r"^\s*!\[([^]]*)\]\(([^)\s]+)(?:\s+['\"]([^'\"]*)['\"])?\)\s*$", visible_line)
        if image:
            image_entry = {
                "id": Path(urlsplit(image.group(2)).path).stem or f"image-{len(images) + 1:03d}",
                "src": image.group(2),
                "alt": image.group(1),
                "title": image.group(3) or "",
                "chapter": chapter,
                "sourceLine": i + 1,
            }
            images.append(image_entry)
            previous_image = image_entry
            i += 1
            continue

        if i + 1 < len(lines) and "|" in visible_line and is_separator(lines[i + 1]):
            headers = split_table(visible_line)
            for cell in headers:
                add("tablecell", cell, i + 1, marker)
                marker = None
            i += 2
            while i < len(lines) and lines[i].strip() and "|" in lines[i]:
                for cell in split_table(lines[i]):
                    add("tablecell", cell, i + 1)
                i += 1
            previous_image = None
            continue

        list_item = re.match(r"^\s*([-*+] |\d+[.] )(.*)$", visible_line)
        if list_item:
            while i < len(lines):
                current = re.match(r"^\s*([-*+] |\d+[.] )(.*)$", lines[i])
                if not current:
                    break
                add("listitem", current.group(2), i + 1, marker)
                marker = None
                i += 1
            previous_image = None
            continue

        paragraph_lines = [visible_line.strip()]
        start_line = i + 1
        i += 1
        while i < len(lines) and lines[i].strip():
            if re.match(r"^\s*(#{1,6})\s+|^\s*```|^\s*[-*+] |^\s*\d+[.] ", lines[i]):
                break
            if i + 1 < len(lines) and "|" in lines[i] and is_separator(lines[i + 1]):
                break
            if re.match(r"^\s*!\[", lines[i]):
                break
            paragraph_lines.append(lines[i].strip())
            i += 1
        kind = "caption" if previous_image and re.match(r"^图\s*[^｜|]+[｜|]", " ".join(paragraph_lines)) else "paragraph"
        if kind == "caption" and previous_image:
            canonical = re.match(r"^图\s*([^｜|]+)[｜|]", " ".join(paragraph_lines))
            if canonical:
                canonical_id = re.sub(r"(?:复用|再用|共享)$", "", canonical.group(1).strip()).strip()
                previous_image["id"] = canonical_id
                previous_image["canonicalId"] = previous_image["id"]
                previous_image["occurrenceId"] = f"{previous_image['id']}@{previous_image['sourceLine']}"
        add(kind, " ".join(paragraph_lines), start_line, marker)
        previous_image = None

    return blocks, images


def read_identity(path: Path, document_id: str, version: str) -> dict[str, Any]:
    if not path.is_file():
        return {"schema": "strategy-document-identity/1", "documentId": document_id, "version": version, "blocks": [], "images": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"identity file must contain an object: {path}")
    data.setdefault("blocks", [])
    data.setdefault("images", [])
    return data


def _next_id(chapter: str, used: set[str], next_numbers: dict[str, int]) -> str:
    prefix = f"HOME-{chapter}" if re.fullmatch(r"HP\d{2}", chapter) else "HOME-DOC"
    number = next_numbers.get(prefix, 1)
    while f"{prefix}-B{number:03d}" in used:
        number += 1
    next_numbers[prefix] = number + 1
    return f"{prefix}-B{number:03d}"


def assign_block_ids(descriptors: list[dict[str, Any]], identity: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Attach stable IDs; matching is by explicit marker then unique sourceKey."""
    existing = [entry for entry in identity.get("blocks", []) if isinstance(entry, dict) and entry.get("id")]
    by_explicit = {entry.get("id"): entry for entry in existing}
    by_key: dict[str, list[dict[str, Any]]] = {}
    for entry in existing:
        by_key.setdefault(entry.get("sourceKey", ""), []).append(entry)
    used: set[str] = set()
    next_numbers: dict[str, int] = {}
    assigned: list[dict[str, Any]] = []
    for descriptor in descriptors:
        explicit = descriptor.get("explicitId")
        entry = by_explicit.get(explicit) if explicit else None
        if entry is None and not explicit:
            candidates = [candidate for candidate in by_key.get(descriptor["sourceKey"], []) if candidate.get("id") not in used and str(candidate.get("id", "")).startswith("HOME-")]
            if len(candidates) == 1:
                entry = candidates[0]
        # A source marker is a durable identity declaration.  It is allowed
        # to introduce a new ID on the first build and then remains matched
        # by the identity table on later rewrites.
        if entry:
            block_id = entry["id"]
        elif explicit and explicit not in used:
            block_id = explicit
        else:
            block_id = _next_id(descriptor["chapter"], used | {str(e.get("id")) for e in existing}, next_numbers)
        used.add(block_id)
        assigned_descriptor = {**descriptor, "id": block_id}
        assigned.append(assigned_descriptor)

    updated = []
    for descriptor in assigned:
        updated.append(
            {
                "id": descriptor["id"],
                "kind": descriptor["kind"],
                "chapter": descriptor["chapter"],
                "text": descriptor["text"],
                "sourceKey": descriptor["sourceKey"],
                "sourceLine": descriptor["sourceLine"],
            }
        )
    return assigned, updated


def _relative_source(path: Path) -> str:
    try:
        return path.resolve().relative_to(HERE.parents[3]).as_posix()
    except ValueError:
        return str(path.resolve())


def rebase_url(raw: str, source_parent: Path, output_parent: Path) -> str:
    """Make relative document links work from the generated HTML directory."""
    parts = urlsplit(raw)
    if parts.scheme or parts.netloc or raw.startswith("#") or raw.startswith("/"):
        return raw
    if parts.path.endswith("rule-details.md"):
        return urlunsplit((parts.scheme, parts.netloc, "rule-details.html", parts.query, parts.fragment))
    if ".scratch/" in parts.path or parts.path.startswith(".scratch") or "/scratch/" in parts.path:
        return urlunsplit((parts.scheme, parts.netloc, "rule-details.html", parts.query, parts.fragment))
    target = (source_parent / parts.path).resolve()
    if target.suffix.lower() == ".md" and target.is_file():
        target = target.with_suffix(".html")
    try:
        new_path = target.relative_to(output_parent.resolve()).as_posix()
    except ValueError:
        new_path = Path(__import__("os").path.relpath(target, output_parent.resolve())).as_posix()
    return urlunsplit((parts.scheme, parts.netloc, new_path, parts.query, parts.fragment))


def image_dimensions(path: Path) -> tuple[int, int] | None:
    """Read intrinsic dimensions without third-party image dependencies."""
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if path.suffix.lower() == ".svg":
        match = re.search(rb"<svg[^>]*\bviewBox=[\"']\s*[-+0-9.]+\s+[-+0-9.]+\s+([-+0-9.]+)\s+([-+0-9.]+)", data[:4096], re.I)
        if match:
            return max(1, round(float(match.group(1)))), max(1, round(float(match.group(2))))
        match = re.search(rb"<svg[^>]*\bwidth=[\"']([0-9.]+)(?:px)?[\"'][^>]*\bheight=[\"']([0-9.]+)(?:px)?[\"']", data[:4096], re.I)
        if match:
            return max(1, round(float(match.group(1)))), max(1, round(float(match.group(2))))
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data.startswith(b"\xff\xd8"):
        index = 2
        while index + 9 < len(data):
            if data[index] != 0xFF:
                index += 1
                continue
            marker = data[index + 1]
            index += 2
            if marker in {0xD8, 0xD9}:
                continue
            if index + 2 > len(data):
                break
            length = int.from_bytes(data[index:index + 2], "big")
            if marker in set(range(0xC0, 0xC4)) | set(range(0xC5, 0xC8)) | set(range(0xC9, 0xCC)) | set(range(0xCD, 0xD0)):
                if index + 7 <= len(data):
                    return int.from_bytes(data[index + 5:index + 7], "big"), int.from_bytes(data[index + 3:index + 5], "big")
                break
            index += max(2, length)
    return None


def inline(value: str, source_parent: Path, output_parent: Path) -> str:
    tokens: list[str] = []

    def dimension_attrs(raw: str) -> str:
        dimensions = image_dimensions((source_parent / urlsplit(raw).path).resolve())
        return f' width="{dimensions[0]}" height="{dimensions[1]}"' if dimensions else ""

    def stash(rendered: str) -> str:
        tokens.append(rendered)
        return f"\x00{len(tokens) - 1}\x00"

    value = re.sub(
        r"!\[([^]]*)\]\(([^)\s]+)(?:\s+['\"]([^'\"]*)['\"])?\)",
        lambda m: stash(
            f'<a class="image-link" href="{esc(rebase_url(m.group(2), source_parent, output_parent))}">'
            f'<img data-comment-image="{esc(Path(urlsplit(m.group(2)).path).stem)}" src="{esc(rebase_url(m.group(2), source_parent, output_parent))}" alt="{esc(m.group(1))}"'
            + (f' title="{esc(m.group(3))}"' if m.group(3) else "")
            + dimension_attrs(m.group(2)) + "></a>"
        ),
        value,
    )
    value = re.sub(
        r"\[([^]]+)\]\(([^)\s]+)(?:\s+['\"]([^'\"]*)['\"])?\)",
        lambda m: stash(
            f'<a href="{esc(rebase_url(m.group(2), source_parent, output_parent))}"'
            + (f' title="{esc(m.group(3))}"' if m.group(3) else "")
            + f">{esc(m.group(1))}</a>"
        ),
        value,
    )
    value = re.sub(r"`([^`]+)`", lambda m: stash(f"<code>{esc(m.group(1))}</code>"), value)
    value = esc(value)
    value = re.sub(r"\*\*([^*]+)\*\*|__([^_]+)__", lambda m: f"<strong>{esc(m.group(1) or m.group(2))}</strong>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)", lambda m: f"<em>{esc(m.group(1) or m.group(2))}</em>", value)
    return re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m.group(1))], value)


def render_markdown(
    source: str,
    descriptors: list[dict[str, Any]],
    source_parent: Path,
    output_parent: Path,
    image_descriptors: list[dict[str, Any]] | None = None,
    chapter_anchors: bool = False,
) -> tuple[str, list[tuple[str, str, int]]]:
    """Render source and attach IDs using the already assigned descriptors."""
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    descriptor_by_line: dict[int, list[dict[str, Any]]] = {}
    for descriptor in descriptors:
        descriptor_by_line.setdefault(descriptor["sourceLine"], []).append(descriptor)
    out: list[str] = []
    # Keep the source heading level with the stable anchor.  The anchor is
    # the comment/navigation contract; level is presentation metadata only.
    headings: list[tuple[str, str, int]] = []
    used_heading_ids: dict[str, int] = {}
    i = 0
    chapter = "DOC"
    pending_marker: str | None = None
    image_by_line = {entry["sourceLine"]: entry for entry in (image_descriptors or [])}

    def block_attrs(descriptor: dict[str, Any]) -> str:
        return f' data-comment-block="{esc(descriptor["id"])}" data-chapter="{esc(descriptor["chapter"])}" data-source-line="{descriptor["sourceLine"]}"'

    def take(line_no: int, kind: str) -> dict[str, Any] | None:
        candidates = descriptor_by_line.get(line_no, [])
        for candidate in candidates:
            if candidate["kind"] == kind and not candidate.get("_used"):
                candidate["_used"] = True
                return candidate
        return None

    demo_index = 0
    while i < len(lines):
        line = lines[i]
        stable_line = re.fullmatch(r"\s*<!--\s*stable-id\s*:\s*([A-Za-z0-9._-]+)\s*-->\s*", line)
        if stable_line:
            pending_marker = stable_line.group(1)
            i += 1
            continue
        if not line.strip():
            i += 1
            continue
        if line.strip() in {":::state-demo", ":::replay-demo"}:
            demo_index += 1
            demo_id = f"state-demo-{demo_index}"
            close = i + 1
            while close < len(lines) and lines[close].strip() != ":::":
                close += 1
            frame_paths = []
            for raw in lines[i + 1:close]:
                parts = [item.strip() for item in raw.split("|", 2)]
                if len(parts) == 3 and parts[0] and parts[1]:
                    frame_paths.append(tuple(parts))
            if not frame_paths:
                i = min(close + 1, len(lines))
                continue
            cards = []
            for index, (raw_src, label, note) in enumerate(frame_paths):
                image_stem = Path(urlsplit(raw_src).path).stem or f"state-{index + 1:02d}"
                image_id = explicit_image_id(raw_src, image_stem)
                src = rebase_url(raw_src, source_parent, output_parent)
                hidden = "" if index == 0 else " hidden"
                cards.append(
                    f'<figure class="replay-frame" data-frame="{index}"{hidden}>'
                    f'<div class="replay-frame-label"><span>{esc(label)}</span><span>文档演示</span></div>'
                    f'<a class="image-link image-viewer-trigger" href="{esc(src)}" data-image-viewer="true" aria-label="打开{esc(label)}原尺寸图稿（100%）"><img data-comment-image="{esc(image_id)}" data-comment-occurrence="{esc(image_id)}@{demo_id}-{index + 1}" src="{esc(src)}" alt="{esc(label)}" loading="lazy"></a>'
                    f'<figcaption>{esc(note)}</figcaption></figure>'
                )
            out.append(
                f'<section class="replay-demo" id="{demo_id}" aria-labelledby="{demo_id}-title">'
                '<div class="replay-demo-head"><div><p class="demo-kicker">截图状态对照 · 文档演示</p>'
                f'<h3 id="{demo_id}-title">按步骤读懂状态变化</h3>'
                '<p class="demo-limit">截图状态对照 · 文档演示；按钮仅切换截图，不操作产品</p></div>'
                '<div class="replay-controls" role="group" aria-label="分镜控制">'
                '<button type="button" data-replay-action="prev">上一步</button>'
                '<button type="button" data-replay-action="next">下一步</button>'
                '<button type="button" data-replay-action="play">播放</button>'
                '<button type="button" data-replay-action="pause" disabled>暂停</button>'
                '<button type="button" data-replay-action="reset">重播</button></div></div>'
                '<!-- replay-local-details --><div class="replay-stage" aria-live="polite">' + "".join(cards) + '</div>'
                '<p class="replay-progress" data-replay-progress>第 1 / ' + str(len(frame_paths)) + ' 帧</p>'
                '</section>'
            )
            i = min(close + 1, len(lines))
            continue
        if line.strip() in {":::layout-detail", ":::replay-details"}:
            marker_name = line.strip()[3:]
            close = i + 1
            while close < len(lines) and lines[close].strip() != ":::":
                close += 1
            if marker_name == "layout-detail":
                items = [
                    ("BT-IMG-02", "日期提示 · 原图局部", "crop-date", "当前日期和已展开日期放在图表上方"),
                    ("BT-IMG-02", "调仓原因卡 · 原图局部", "crop-event", "右侧卡片说明为什么发生这次买卖"),
                ]
                title = "整页布局的可读局部"
                intro = "原图局部；点击每张局部可打开完整原图。"
            else:
                items = [
                    ("BT-IMG-17", "6月14日 · 推进前", "crop-replay-before", "起点标记在最右侧，尚未建仓"),
                    ("BT-IMG-18", "6月17日 · 推进后", "crop-replay-plot", "起点右侧出现新K线与首次建仓箭头"),
                    ("BT-IMG-19", "2024-06-28 · 日期条", "crop-replay-date", "已展开至 2024-06-28，来源为快速展开"),
                    ("BT-IMG-20", "回看 2024-06-14 · 日期条", "crop-replay-date", "回看起点，仍保留已展开日期"),
                ]
                title = "两段示例的关键局部"
                intro = "原图局部；局部只帮助看清日期和标记，点击每张局部可打开完整原图。"
            cards = []
            for detail_index, (image_id, label, crop_class, note) in enumerate(items):
                src = rebase_url(f"../2026-10-11-strategy-backtest/images/{image_id}.jpg", source_parent, output_parent)
                cards.append(
                    f'<figure class="source-detail-card"><div class="source-detail-label">{esc(label)}</div>'
                    f'<div class="source-crop {crop_class}" role="img" aria-label="{esc(label)}：{esc(note)}">'
                    f'<a class="image-link image-viewer-trigger" href="{esc(src)}" data-image-viewer="true" aria-label="打开{esc(label)}原尺寸图稿（100%）"><img data-comment-image="{esc(image_id)}" data-comment-occurrence="{esc(image_id)}@{marker_name}-{detail_index}" src="{esc(src)}" alt="{esc(label)}，原图局部"></a></div>'
                    f'<figcaption>{esc(note)}。<a href="{esc(src)}">查看完整原图</a></figcaption></figure>'
                )
            detail_html = f'<section class="source-details" aria-label="{esc(title)}"><h3>{esc(title)}</h3><p class="source-details-intro">{esc(intro)}</p><div class="source-detail-grid">{"".join(cards)}</div></section>'
            if marker_name == "replay-details" and out and "<!-- replay-local-details -->" in out[-1]:
                out[-1] = out[-1].replace("<!-- replay-local-details -->", detail_html)
            else:
                out.append(detail_html)
            i = min(close + 1, len(lines))
            continue
        match = re.match(r"^\s*(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if match:
            level, raw = len(match.group(1)), match.group(2)
            title = re.sub(r"\s*\{#[^}]+\}\s*$", "", raw).strip()
            chapter = chapter_from_heading_anchor(raw, chapter_for_heading(title, chapter_from_marker(pending_marker, chapter)))
            pending_marker = None
            base = re.search(r"\{#([\w\u4e00-\u9fff-]+)\}", raw)
            chapter_match = re.search(r"\b((?:BT|HP)\d{2})\b", title)
            anchor = f"chapter-{chapter_match.group(1)}" if chapter_anchors and chapter_match else (base.group(1) if base else slugify(title))
            count = used_heading_ids.get(anchor, 0)
            used_heading_ids[anchor] = count + 1
            anchor = anchor if count == 0 else f"{anchor}-{count + 1}"
            headings.append((anchor, title, level))
            out.append(f'<h{level} id="{esc(anchor)}">{inline(title, source_parent, output_parent)}</h{level}>')
            i += 1
            continue
        if line.strip() == "<details>":
            close = i + 1
            while close < len(lines) and lines[close].strip() != "</details>":
                close += 1
            summary = ""
            if i + 1 < close:
                summary_match = re.match(r"\s*<summary>(.*?)</summary>\s*$", lines[i + 1])
                summary = summary_match.group(1) if summary_match else "更多规则"
            content_start = i + 1
            while content_start < close and (not lines[content_start].strip() or lines[content_start].lstrip().startswith("<summary>")):
                content_start += 1
            detail_lines = [lines[index].strip() for index in range(content_start, close) if lines[index].strip()]
            content = " ".join(detail_lines)
            is_detail_table = len(detail_lines) >= 2 and "|" in detail_lines[0] and is_separator(detail_lines[1])
            descriptor = take(content_start + 1, "paragraph") if content and not is_detail_table else None
            attrs = block_attrs(descriptor) if descriptor else ""
            out.append(f'<details><summary>{inline(summary, source_parent, output_parent)}</summary>')
            if is_detail_table:
                out.append('<div class="table-wrap" tabindex="0" role="region" aria-label="规则表"><table><thead><tr>')
                for cell in split_table(detail_lines[0]):
                    out.append(f'<th scope="col">{inline(cell, source_parent, output_parent)}</th>')
                out.append('</tr></thead><tbody>')
                for row in detail_lines[2:]:
                    out.append('<tr>')
                    for cell in split_table(row):
                        out.append(f'<td>{inline(cell, source_parent, output_parent)}</td>')
                    out.append('</tr>')
                out.append('</tbody></table></div>')
            elif content:
                out.append(f'<p{attrs}>{inline(content, source_parent, output_parent)}</p>')
            out.append("</details>")
            i = min(close + 1, len(lines))
            continue
        fence = re.match(r"^\s*```\s*([\w-]*)\s*$", line)
        if fence:
            close = i + 1
            while close < len(lines) and not re.match(r"^\s*```\s*$", lines[close]):
                close += 1
            language = fence.group(1)
            code = "\n".join(lines[i + 1:close])
            class_attr = f' class="language-{esc(language)}"' if language else ""
            out.append(f'<pre><code{class_attr}>{esc(code)}</code></pre>')
            i = min(close + 1, len(lines))
            continue
        image = re.match(r"^\s*!\[([^]]*)\]\(([^)\s]+)(?:\s+['\"]([^'\"]*)['\"])?\)\s*$", line)
        if image:
            src = rebase_url(image.group(2), source_parent, output_parent)
            image_entry = image_by_line.get(i + 1, {})
            image_id = image_entry.get("id") or Path(urlsplit(image.group(2)).path).stem or f"image-{i + 1:03d}"
            occurrence_id = image_entry.get("occurrenceId") or f"{image_id}@{i + 1}"
            dimensions = image_dimensions((source_parent / urlsplit(image.group(2)).path).resolve())
            dimension_attrs = f' width="{dimensions[0]}" height="{dimensions[1]}"' if dimensions else ""
            is_plate = urlsplit(image.group(2)).path.lower().endswith(".svg")
            figure_class = "document-image figure plate-figure" if is_plate else "document-image figure"
            image_markup = f'<a class="image-link image-viewer-trigger" href="{esc(src)}" data-image-viewer="true" aria-label="打开{esc(image.group(1))}原尺寸图稿（100%）"><img data-comment-image="{esc(image_id)}" data-comment-occurrence="{esc(occurrence_id)}" src="{esc(src)}" alt="{esc(image.group(1))}"{dimension_attrs}></a>'
            if is_plate:
                image_markup = f'<span class="image-pan-hint">图板可横向滚动查看</span><div class="image-pan" tabindex="0" role="region" aria-label="{esc(image.group(1))}">{image_markup}</div><a class="image-action image-viewer-trigger" href="{esc(src)}" data-image-viewer="true" data-image-viewer-alt="{esc(image.group(1))}">查看原尺寸</a>'
            out.append(f'<figure class="{figure_class}">{image_markup}')
            caption_index = i + 1
            while caption_index < len(lines) and not lines[caption_index].strip():
                caption_index += 1
            if caption_index < len(lines) and re.match(r"^图\s*[^｜|]+[｜|]", lines[caption_index].strip()):
                caption_line = lines[caption_index].strip()
                descriptor = take(caption_index + 1, "caption")
                attrs = block_attrs(descriptor) if descriptor else ""
                out.append(f'<figcaption class="caption"{attrs}>{inline(caption_line, source_parent, output_parent)}</figcaption>')
                i = caption_index
            out.append("</figure>")
            i += 1
            continue
        if i + 1 < len(lines) and "|" in line and is_separator(lines[i + 1]):
            headers = split_table(line)
            out.append('<div class="table-wrap" tabindex="0" role="region" aria-label="规则表"><table><thead><tr>')
            for cell in headers:
                descriptor = take(i + 1, "tablecell")
                attrs = block_attrs(descriptor) if descriptor else ""
                out.append(f"<th scope=\"col\"{attrs}>{inline(cell, source_parent, output_parent)}</th>")
            out.append("</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip() and "|" in lines[i]:
                out.append("<tr>")
                for cell in split_table(lines[i]):
                    descriptor = take(i + 1, "tablecell")
                    attrs = block_attrs(descriptor) if descriptor else ""
                    out.append(f"<td{attrs}>{inline(cell, source_parent, output_parent)}</td>")
                out.append("</tr>")
                i += 1
            out.append("</tbody></table></div>")
            continue
        list_match = re.match(r"^\s*([-*+] |\d+[.] )(.*)$", line)
        if list_match:
            ordered = list_match.group(1)[0].isdigit()
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>")
            while i < len(lines):
                current = re.match(r"^\s*([-*+] |\d+[.] )(.*)$", lines[i])
                if not current:
                    break
                descriptor = take(i + 1, "listitem")
                attrs = block_attrs(descriptor) if descriptor else ""
                out.append(f"<li{attrs}>{inline(current.group(2), source_parent, output_parent)}</li>")
                i += 1
            out.append(f"</{tag}>")
            continue
        paragraph_lines = [line.strip()]
        start_line = i + 1
        i += 1
        while i < len(lines) and lines[i].strip():
            if re.match(r"^\s*(#{1,6})\s+|^\s*```|^\s*[-*+] |^\s*\d+[.] ", lines[i]):
                break
            if i + 1 < len(lines) and "|" in lines[i] and is_separator(lines[i + 1]):
                break
            if re.match(r"^\s*!\[", lines[i]):
                break
            paragraph_lines.append(lines[i].strip())
            i += 1
        text = " ".join(paragraph_lines)
        kind = "caption" if re.match(r"^图\s*[^｜|]+[｜|]", text) else "paragraph"
        descriptor = take(start_line, kind)
        attrs = block_attrs(descriptor) if descriptor else ""
        out.append(f'<p{attrs}>{inline(text, source_parent, output_parent)}</p>')
    return "\n".join(out), headings


STYLE = r"""
:root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; color: #e7edf6; background: #0b1220; }
* { box-sizing: border-box; }
html { scroll-behavior: auto; }
body { margin: 0; min-width: 0; font-size: 16px; line-height: 1.8; background: #0b1220; }
.layout { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }
nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 32px 20px; background: #0d1726; border-right: 1px solid #263650; }
nav strong { display: block; margin-bottom: 5px; font-size: 14px; color: #e7edf6; letter-spacing: .03em; }
nav .nav-meta { margin: 0 0 18px; color: #8292a8; font-size: 12px; line-height: 1.5; }
nav a { --nav-indent: 0px; position: relative; display: block; padding: 3px 8px 3px calc(8px + var(--nav-indent)); color: #adbbcf; text-decoration: none; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
nav a.toc-level-1 { --nav-indent: 0px; margin-top: 4px; color: #e7edf6; font-size: 14px; font-weight: 700; }
nav a.toc-level-2 { --nav-indent: 12px; color: #c8d5e6; font-size: 13px; font-weight: 650; }
nav a.toc-level-3 { --nav-indent: 24px; font-size: 12.5px; }
nav a.toc-level-4, nav a.toc-level-5, nav a.toc-level-6 { --nav-indent: 36px; font-size: 12px; }
nav a:hover, nav a:focus-visible, nav a.is-current { color: #8cbdff; text-decoration: none; }
nav a::before { content: ""; position: absolute; left: 0; top: 3px; bottom: 3px; width: 2px; border-radius: 2px; background: #3797ff; opacity: 0; }
nav a.is-current::before { opacity: 1; }
main { width: min(100%, 1032px); padding: 40px 40px 88px; margin: 0 auto; overflow-wrap: anywhere; }
h1 { margin: 0 0 20px; font-size: 32px; line-height: 1.3; color: #e7edf6; }
h2 { margin: 48px 0 14px; font-size: 24px; line-height: 1.5; color: #e7edf6; border-bottom: 1px solid #263650; padding-bottom: 6px; }
h3, h4, h5, h6 { margin: 32px 0 10px; line-height: 1.5; color: #e7edf6; }
p { margin: 0 0 18px; }
a { color: #8cbdff; text-underline-offset: 2px; }
a:focus-visible, button:focus-visible, [tabindex]:focus-visible { outline: 2px solid #9ecaff; outline-offset: 2px; }
ul, ol { margin: 0 0 20px; padding-left: 28px; }
li { margin: 2px 0; }
strong { color: #e7edf6; }
code { padding: .1em .35em; border-radius: 4px; background: #182337; font-size: .9em; }
pre { overflow-x: auto; margin: 20px 0; padding: 16px; border-radius: 6px; background: #111a2b; color: #e7edf6; line-height: 1.5; }
.table-wrap { max-width: 100%; overflow-x: auto; margin: 18px 0 24px; }
table { min-width: 620px; border-collapse: collapse; font-size: 14px; line-height: 1.5; }
th, td { padding: 9px 12px; border: 1px solid #263650; text-align: left; vertical-align: top; }
th { background: #182337; color: #e7edf6; font-weight: 650; }
.figure { margin: 24px 0 8px; }
.plate-figure { width: 100%; }
.image-pan { max-width: 100%; overflow-x: auto; overscroll-behavior-x: contain; }
.plate-figure .image-pan img { width: 952px; max-width: none; }
.image-pan-hint { display: block; margin-bottom: 5px; color: #8292a8; font-size: 12px; }
.image-action { display: inline-block; margin: 7px 0 1px; font-size: 12px; }
.document-image img { max-width: 100%; }
.image-link { display: block; }
.image-viewer-modal[hidden] { display: none; }
.image-viewer-modal { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 24px; background: rgba(3, 8, 16, .86); }
.image-viewer-dialog { position: relative; display: flex; flex-direction: column; width: min(1100px, 100%); max-height: calc(100vh - 48px); overflow: hidden; border: 1px solid #45678f; border-radius: 10px; background: #0b1220; box-shadow: 0 16px 60px rgba(0,0,0,.55); outline: none; }
.image-viewer-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 14px; color: #e7edf6; background: #101c2f; }
.image-viewer-head button { min-height: 36px; padding: 5px 12px; border: 1px solid #45678f; border-radius: 6px; color: #e7edf6; background: #182a43; cursor: pointer; font: inherit; }
.image-viewer-scroll { overflow: auto; padding: 16px; overscroll-behavior: contain; }
.image-viewer-scroll img { width: auto; max-width: none; height: auto; margin: 0 auto; border-color: #45678f; }
body.image-viewer-open { overflow: hidden; }
img { display: block; max-width: 100%; height: auto; border: 1px solid #263650; }
.caption { display: block; margin: 0 0 20px; font-size: 12px; line-height: 1.5; color: #adbbcf; }
h1, h2, h3, h4, h5, h6, [data-comment-block] { scroll-margin-top: 64px; }
[data-comment-block].review-highlight { background: #163d63; box-shadow: 0 0 0 2px #3797ff; border-radius: 3px; }
.review-image-target { outline: 3px solid #66b5ff; outline-offset: 6px; border-radius: 6px; box-shadow: 0 0 0 8px rgba(55, 151, 255, .22), 0 0 24px rgba(102, 181, 255, .72); }
@media (max-width: 1080px) { .layout { grid-template-columns: 210px minmax(0, 1fr); } main { padding-left: 32px; padding-right: 32px; } }
@media (max-width: 720px) { .layout { display: block; } nav { position: static; height: auto; max-height: 42vh; border-right: 0; border-bottom: 1px solid #263650; padding: 18px 20px; } main { padding: 28px 18px 56px; } h1 { font-size: 32px; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
.replay-demo { margin: 28px 0; padding: 22px; border: 1px solid #31517a; border-radius: 10px; background: #101c2f; }
.replay-demo-head { position: sticky; top: 76px; z-index: 5; background: #101c2f; padding-bottom: 10px; display: flex; gap: 20px; align-items: flex-start; justify-content: space-between; }
.replay-demo h3 { margin: 0 0 6px; font-size: 20px; }
.demo-kicker { margin: 0 0 3px; color: #8cbdff; font-size: 12px; letter-spacing: .04em; }
.demo-limit { margin: 0; color: #adbbcf; font-size: 14px; line-height: 1.6; }
.replay-controls { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.replay-controls button { min-height: 36px; padding: 5px 11px; border: 1px solid #45678f; border-radius: 6px; color: #e7edf6; background: #182a43; cursor: pointer; font: inherit; font-size: 13px; }
.replay-controls button:hover:not(:disabled), .replay-controls button:focus-visible { background: #24558a; }
.replay-controls button:disabled { opacity: .45; cursor: default; }
.replay-stage { margin-top: 18px; min-height: 510px; }
.replay-frame { display: flow-root; width: 100%; height: auto; margin: 0; }
.replay-frame[hidden] { display: none; }
.replay-frame-label { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; color: #d4e1f2; font-size: 13px; }
.replay-frame-label span:last-child { color: #d6b66c; }
.replay-frame img { display: block; width: 100%; height: 450px; object-fit: contain; background: #0b1220; }
.replay-frame figcaption { margin-top: 8px; color: #adbbcf; font-size: 13px; line-height: 1.6; }
.replay-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.replay-comparison article { border: 1px solid #31517a; border-radius: 8px; padding: 14px; background: #0b1729; }
.replay-comparison h4 { margin: 0 0 8px; color: #eef6ff; }
.replay-comparison dl { margin: 0; }
.replay-comparison dl > div { display: grid; grid-template-columns: 10.5rem minmax(0, 1fr); gap: 8px; padding: 7px 0; border-top: 1px solid #243d5e; }
.replay-comparison dt { color: #dcecff; font-weight: 700; }
.replay-comparison dd { margin: 0; color: #b8c9df; }
.replay-comparison p { margin: 10px 0 0; color: #9eb4cf; font-size: 13px; }
.replay-progress { margin: 12px 0 0; color: #8cbdff; font-size: 13px; }
.source-details { margin: 22px 0; padding: 16px; border: 1px solid #31517a; border-radius: 8px; background: #0d192b; }
.source-details h3 { margin: 0 0 5px; font-size: 17px; }
.source-details-intro { margin: 0 0 12px; color: #adbbcf; font-size: 13px; }
.source-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.source-detail-card { min-width: 0; margin: 0; }
.source-detail-label { margin-bottom: 6px; color: #dcecff; font-weight: 700; font-size: 13px; }
.source-crop { position: relative; width: 100%; overflow-x: auto; overflow-y: hidden; background: #0b1220; border: 1px solid #345477; }
.source-crop .image-link { position: relative; display: block; width: 400px; height: 100%; overflow: hidden; }
.source-crop img { position: absolute; left: 0; top: 0; max-width: none; width: 1440px; height: auto; border: 0; }
.source-crop figcaption { color: #adbbcf; }
.crop-date { height: 55px; }
.crop-date img { left: -100px; top: -213px; }
.crop-event { height: 132px; max-width: 290px; }
.crop-event .image-link { width: 290px; }
.crop-event img { left: -1034px; top: -724px; }
.crop-replay-plot { height: 260px; max-width: 270px; }
.crop-replay-plot .image-link, .crop-replay-before .image-link { width: 270px; }
.crop-replay-plot img { left: -740px; top: -385px; }
.crop-replay-before { height: 260px; max-width: 270px; }
.crop-replay-before img { left: -740px; top: -385px; }
.crop-replay-date { height: 55px; }
.crop-replay-date .image-link { width: 480px; }
.crop-replay-date img { left: -100px; top: -213px; }
@media (max-width: 720px) { .replay-demo { padding: 16px; } .replay-demo-head { position: sticky; top: 76px; z-index: 5; background: #101c2f; padding-bottom: 10px; display: block; } .replay-controls { justify-content: flex-start; margin-top: 12px; } .replay-stage { min-height: 460px; } .replay-frame { height: auto; } .replay-frame img { height: 400px; } .replay-comparison { grid-template-columns: 1fr; } .replay-comparison dl > div { grid-template-columns: 8.5rem minmax(0, 1fr); } }
@media (max-width: 720px) { .source-detail-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .replay-frame img { transition: none; } }
"""


def build_companion_page(source_path: Path, output_path: Path, version: str = VERSION) -> None:
    """Publish a Markdown companion as a readable page linked back to the reader."""
    if not source_path.is_file():
        return
    source = source_path.read_text(encoding="utf-8")
    _, images = collect_descriptors(source)
    body, headings = render_markdown(source, [], source_path.parent, output_path.parent, images, chapter_anchors=True)
    title = headings[0][1] if headings else source_path.stem
    toc = "".join(
        f'<a class="toc-level-{level}" href="#{esc(anchor)}" data-target="{esc(anchor)}">'
        f'{inline(heading, source_path.parent, output_path.parent)}</a>'
        for anchor, heading, level in headings
    )
    reader_target = output_path.parent / "visual-spec.html"
    if not reader_target.is_file():
        reader_target = output_path.parent.parent / "visual-spec.html"
    reader_href = __import__("os").path.relpath(reader_target, output_path.parent).replace(__import__("os").sep, "/")
    output_path.write_text(
        f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{esc(title)}</title><style>{STYLE}</style></head>
<body><div class="layout"><nav aria-label="文档目录"><strong>{esc(title)}</strong><p class="nav-meta">文档 {esc(version)} · 控件与参考附页</p>{toc}</nav><main class="rule-details" id="companion-document"><header class="reader-header"><p class="document-status">文档附页 · {esc(version)}</p><a class="review-open" href="{esc(reader_href)}">返回正文阅读器</a></header>{body}</main></div></body></html>
''', encoding="utf-8"
    )


def build(
    source_path: Path = DEFAULT_SOURCE,
    output_path: Path = DEFAULT_OUTPUT,
    manifest_path: Path = DEFAULT_MANIFEST,
    identity_path: Path = DEFAULT_IDENTITY,
    document_id: str = DOCUMENT_ID,
    version: str = VERSION,
) -> dict[str, Any]:
    source_path = Path(source_path).resolve()
    output_path = Path(output_path).resolve()
    manifest_path = Path(manifest_path).resolve()
    identity_path = Path(identity_path).resolve()
    source = source_path.read_text(encoding="utf-8")
    fingerprint = sha256_text(source)
    descriptors, image_descriptors = collect_descriptors(source)
    lines = source.replace("\r\n", "\n").split("\n")
    current_chapter = "DOC"
    demo_occurrence = 0
    pending_marker = None
    for line_number, line in enumerate(lines, 1):
        heading = re.match(r"^\s*#{1,6}\s+(.+?)\s*#*\s*$", line)
        if heading:
            raw_heading = heading.group(1)
            current_chapter = chapter_from_heading_anchor(raw_heading, chapter_for_heading(re.sub(r"\s*\{#[^}]+\}\s*$", "", raw_heading).strip(), current_chapter))
        marker_match = re.fullmatch(r"\s*<!--\s*stable-id\s*:\s*([A-Za-z0-9._-]+)\s*-->\s*", line)
        if marker_match:
            pending_marker = marker_match.group(1)
            current_chapter = chapter_from_marker(pending_marker, current_chapter)
        if line.strip() not in {":::state-demo", ":::replay-demo"}:
            continue
        demo_occurrence += 1
        close = line_number
        frame_index = 0
        while close < len(lines) and lines[close].strip() != ":::":
            parts = [item.strip() for item in lines[close].split("|", 2)]
            if len(parts) == 3 and parts[0] and parts[1]:
                image_stem = Path(urlsplit(parts[0]).path).stem or f"state-{close}"
                image_id = explicit_image_id(parts[0], image_stem)
                frame_index += 1
                image_descriptors.append({"id": image_id, "occurrenceId": f"{image_id}@state-demo-{demo_occurrence}-{frame_index}", "sharedImageId": image_id, "src": parts[0], "chapter": current_chapter, "sourceLine": line_number, "alt": parts[1]})
            close += 1
    for marker_name, image_ids, chapter_id in (
        ("layout-detail", ["BT-IMG-02", "BT-IMG-02"], "BT01"),
        ("replay-details", ["BT-IMG-17", "BT-IMG-18", "BT-IMG-19", "BT-IMG-20"], "BT08"),
    ):
        if f":::{marker_name}" not in source:
            continue
        for detail_index, image_id in enumerate(image_ids):
            image_descriptors.append({
                "id": image_id, "occurrenceId": f"{image_id}@{marker_name}-{detail_index}",
                "sharedImageId": image_id,
                "src": f"../2026-10-11-strategy-backtest/images/{image_id}.jpg",
                "chapter": chapter_id, "sourceLine": 0, "alt": f"{image_id} 原图局部",
            })
    identity = read_identity(identity_path, document_id, version)
    assigned, identity_blocks = assign_block_ids(descriptors, identity)
    body, headings = render_markdown(source, assigned, source_path.parent, output_path.parent, image_descriptors)
    for relative_name in (
        "visual-design.md",
        "sources.md",
        "assessment.md",
        "rules.md",
        "evidence/acceptance.md",
        "rule-details.md",
    ):
        companion_source = source_path.parent / relative_name
        # The isolated preview already carries a generated companion page; its
        # extended attribute is intentionally read-only in this workspace.
        # Regenerating visual-spec.html must not fail on that unrelated file.
        if companion_source.name == "visual-design.md" and companion_source.with_suffix(".html").exists():
            continue
        build_companion_page(companion_source, companion_source.with_suffix(".html"), version=version)

    image_entries: list[dict[str, Any]] = []
    for image in image_descriptors:
        target = (source_path.parent / urlsplit(image["src"]).path).resolve()
        image_entries.append(
            {
                "id": image["id"],
                "occurrenceId": image.get("occurrenceId") or f'{image["id"]}@{image["sourceLine"]}',
                "sharedImageId": image["id"],
                "src": rebase_url(image["src"], source_path.parent, output_path.parent),
                "fingerprint": sha256_bytes(target.read_bytes()) if target.is_file() else None,
                "chapter": image["chapter"],
                "sourceLine": image["sourceLine"],
                "alt": image["alt"],
                **({key: image[key] for key in ("width", "height") if key in image}),
            }
        )

    manifest = {
        "schema": "strategy-document-manifest/1",
        "documentId": document_id,
        "version": version,
        "fingerprint": fingerprint,
        "sourceFile": _relative_source(source_path),
        "documentUrl": output_path.name,
        "blocks": [
            {
                "id": entry["id"],
                "chapter": entry["chapter"],
                "kind": entry["kind"],
                "text": entry["text"],
                "sourceLine": entry["sourceLine"],
                "sourceKey": entry["sourceKey"],
            }
            for entry in assigned
        ],
        "images": image_entries,
    }
    identity_output = {
        "schema": "strategy-document-identity/1",
        "documentId": document_id,
        "version": version,
        "blocks": identity_blocks,
        "images": [
            {
                "id": image["id"],
                "occurrenceId": image["occurrenceId"],
                "sharedImageId": image["sharedImageId"],
                "src": image["src"],
                "chapter": image["chapter"],
                "sourceLine": image["sourceLine"],
            }
            for image in image_entries
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    identity_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    identity_path.write_text(json.dumps(identity_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    toc = "\n".join(
        f'<a class="toc-level-{level}" href="#{esc(anchor)}" data-target="{esc(anchor)}">'
        f'{inline(title, source_path.parent, output_path.parent)}</a>'
        for anchor, title, level in headings
    )
    page_title = headings[0][1] if headings else "策略回测台文档"
    # Keep manifest text exact after JSON.parse while avoiding raw repository
    # scratch paths in the static HTML source.
    manifest_json = json.dumps(manifest, ensure_ascii=False).replace("<", "\\u003c").replace(".scratch/", "\\u002e" + "scratch/")
    document = f'''<!doctype html>
<html lang="zh-CN" data-document-id="{esc(document_id)}" data-document-version="{esc(version)}" data-document-fingerprint="{esc(fingerprint)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(page_title)}</title><style>{STYLE}</style><link rel="stylesheet" href="review-client.css"></head>
<body><div class="layout"><nav aria-label="文档目录"><strong>首页图文规范</strong><p class="nav-meta">文档 {esc(version)}</p>{toc}</nav><main id="reader-document" data-document-id="{esc(document_id)}" data-document-version="{esc(version)}" data-document-fingerprint="{esc(fingerprint)}"><header class="reader-header"><p class="document-status">文档 {esc(version)} · 首页设计规范</p><button type="button" id="review-open" class="review-open">评论</button></header>{body}</main></div><div class="image-viewer-modal" hidden aria-hidden="true"><div class="image-viewer-dialog" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="image-viewer-title"><div class="image-viewer-head"><strong id="image-viewer-title">原尺寸图稿 · 100%</strong><button type="button" data-image-viewer-close>关闭</button></div><div class="image-viewer-scroll" tabindex="0"><img data-image-viewer-image alt=""></div></div></div><script type="application/json" id="document-manifest">{manifest_json}</script><script>
(() => {{
  const modal = document.querySelector('.image-viewer-modal');
  const modalImage = modal?.querySelector('[data-image-viewer-image]');
  const scrollBox = modal?.querySelector('.image-viewer-scroll');
  const closeButton = modal?.querySelector('[data-image-viewer-close]');
  let lastTrigger = null;
  let lastScroll = {{ x: 0, y: 0 }};
  let inertState = [];
  const focusables = () => [...(modal?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])].filter((node) => !node.disabled && node.offsetParent !== null);
  const isolateBackground = () => {{
    inertState = [...document.querySelectorAll('.layout, #review-panel')].map((node) => ({{ node, inert: node.inert }}));
    inertState.forEach(({{ node }}) => {{ node.inert = true; }});
  }};
  const restoreBackground = () => {{ inertState.forEach(({{ node, inert }}) => {{ node.inert = inert; }}); inertState = []; }};
  const closeViewer = () => {{
    if (!modal || modal.hidden) return;
    modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('image-viewer-open'); restoreBackground();
    window.scrollTo({{ top: lastScroll.y, left: lastScroll.x, behavior: 'auto' }});
    lastTrigger?.focus({{ preventScroll: true }});
  }};
  document.querySelectorAll('[data-image-viewer="true"]').forEach((trigger) => trigger.addEventListener('click', (event) => {{
    event.preventDefault(); lastTrigger = trigger; lastScroll = {{ x: window.scrollX, y: window.scrollY }};
    const source = trigger.querySelector('img'); const sourceUrl = trigger.dataset.imageViewerSrc || source?.currentSrc || source?.src || trigger.href; if (!sourceUrl || !modal || !modalImage) return;
    const alt = source?.alt || trigger.dataset.imageViewerAlt || trigger.textContent.trim() || '图稿';
    modalImage.src = sourceUrl; modalImage.alt = alt; modal.querySelector('#image-viewer-title').textContent = `${{alt}} · 原尺寸 100%`;
    isolateBackground();
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('image-viewer-open');
    scrollBox.scrollTop = 0; scrollBox.scrollLeft = 0; closeButton.focus({{ preventScroll: true }});
  }}));
  closeButton?.addEventListener('click', closeViewer);
  modal?.addEventListener('click', (event) => {{ if (event.target === modal) closeViewer(); }});
  document.addEventListener('keydown', (event) => {{
    if (modal?.hidden) return;
    if (event.key === 'Escape') {{ event.preventDefault(); event.stopImmediatePropagation(); closeViewer(); return; }}
    if (['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && !scrollBox?.contains(document.activeElement)) {{ event.preventDefault(); return; }}
    if (event.key !== 'Tab') return;
    const nodes = focusables(); if (!nodes.length) {{ event.preventDefault(); modal.querySelector('.image-viewer-dialog')?.focus(); return; }}
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {{ event.preventDefault(); last.focus(); }}
    else if (!event.shiftKey && document.activeElement === last) {{ event.preventDefault(); first.focus(); }}
  }}, true);
}})();
</script><script>
(() => {{
  const links = [...document.querySelectorAll('nav a[data-target]')];
  const headings = links.map((link) => document.getElementById(link.dataset.target)).filter(Boolean);
  const mark = () => {{
    let current = headings[0];
    for (const heading of headings) if (heading.getBoundingClientRect().top <= 120) current = heading;
    links.forEach((link) => {{
      const active = link.dataset.target === current?.id;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }});
  }};
  document.addEventListener('scroll', mark, {{ passive: true }}); mark();
}})();
</script><script>
document.querySelectorAll('.replay-demo').forEach((demo) => {{
  const frames = [...demo.querySelectorAll('.replay-frame')];
  if (!frames.length) return;
  const progress = demo.querySelector('[data-replay-progress]');
  const buttons = Object.fromEntries([...demo.querySelectorAll('[data-replay-action]')].map((button) => [button.dataset.replayAction, button]));
  const labels = frames.map((frame) => frame.querySelector('.replay-frame-label span')?.textContent || '当前步骤');
  let index = 0;
  let timer = null;
  let lastPlaybackControl = buttons.play;
  const render = () => {{
    frames.forEach((frame, frameIndex) => {{ frame.hidden = frameIndex !== index; }});
    progress.textContent = `第 ${{index + 1}} / ${{frames.length}} 帧 · ${{labels[index]}}`;
    buttons.prev.disabled = index === 0;
    buttons.next.disabled = index === frames.length - 1;
    buttons.play.disabled = Boolean(timer) || index === frames.length - 1;
    buttons.pause.disabled = !timer;
  }};
  const stop = ({{ restoreFocus = false }} = {{}}) => {{ if (timer) {{ window.clearInterval(timer); timer = null; }} render(); if (restoreFocus) {{ const control = lastPlaybackControl && !lastPlaybackControl.disabled ? lastPlaybackControl : buttons.play; control?.focus({{ preventScroll: true }}); }} }};
  const move = (nextIndex) => {{ stop(); index = Math.max(0, Math.min(frames.length - 1, nextIndex)); render(); }};
  demo.__setReplayIndex = (nextIndex) => move(nextIndex);
  buttons.prev.addEventListener('click', () => move(index - 1));
  buttons.next.addEventListener('click', () => move(index + 1));
  buttons.reset.addEventListener('click', () => move(0));
  buttons.play.addEventListener('click', (event) => {{ lastPlaybackControl = event.currentTarget; if (index === frames.length - 1) return; timer = window.setInterval(() => {{ if (index >= frames.length - 1) stop(); else {{ index += 1; render(); }} }}, 1800); render(); }});
  buttons.pause.addEventListener('click', (event) => {{ lastPlaybackControl = event.currentTarget; stop(); }});
  demo.addEventListener('keydown', (event) => {{ if (event.key === 'ArrowRight') move(index + 1); if (event.key === 'ArrowLeft') move(index - 1); }});
  document.addEventListener('keydown', (event) => {{ if (event.key === 'Escape' && timer) {{ event.preventDefault(); stop({{ restoreFocus: true }}); }} }});
  document.addEventListener('visibilitychange', () => {{ if (document.hidden) stop(); }});
  render();
}});
</script><script src="review-client.js" defer></script></body></html>
'''
    output_path.write_text(document, encoding="utf-8")
    return {"fingerprint": fingerprint, "manifest": manifest, "identity": identity_output, "output": str(output_path)}


def resolve_default_source() -> Path:
    return DEFAULT_SOURCE if DEFAULT_SOURCE.is_file() else FALLBACK_SOURCE


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=resolve_default_source())
    parser.add_argument("--version", default=VERSION)
    parser.add_argument("--output-dir", type=Path, default=HERE)
    args = parser.parse_args()
    output_dir = args.output_dir.resolve()
    result = build(
        source_path=args.source,
        output_path=output_dir / "visual-spec.html",
        manifest_path=output_dir / "document-manifest.json",
        identity_path=output_dir / "document-identity.json",
        version=args.version,
    )
    print(f"wrote {result['output']}")


if __name__ == "__main__":
    main()
