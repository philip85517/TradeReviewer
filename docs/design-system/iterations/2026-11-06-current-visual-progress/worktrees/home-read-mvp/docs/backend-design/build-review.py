#!/usr/bin/env python3
"""Build the two backend review readers without changing their Markdown sources.

The comment protocol and unmodified review client come from the homepage V2.5
visual specification. Block identities live outside the source in each reader's
document-identity.json. Removed or rewritten blocks remain reserved; an old
comment is never silently reassigned to another paragraph.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / "docs"
REFERENCE = DOCS / "design-system/baselines/2026-10-22-homepage-v2.5"
VISUAL_URL = "/design-system/baselines/2026-10-22-homepage-v2.5/visual-spec.html"
DOCUMENTS = (
    {"key": "current", "source": HERE / "current-state.md", "id": "BACKEND-CURRENT", "label": "现状说明", "status": "实现快照 · 非目标规范"},
    {"key": "target", "source": HERE / "target-design.candidate.md", "id": "BACKEND-TARGET", "label": "目标设计审查稿", "status": "模块级候选 · 待审查，未授权实现"},
)
VERSION = "2026-10-25"


def esc(value: str) -> str:
    return html.escape(str(value), quote=True)


def digest(value: str | bytes) -> str:
    return hashlib.sha256(value.encode("utf-8") if isinstance(value, str) else value).hexdigest()


def canonical(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slug(value: str) -> str:
    value = re.sub(r"[`*_~]", "", value).lower().strip()
    value = re.sub(r"[^\w\u4e00-\u9fff\- ]+", "", value)
    return re.sub(r"[\s_-]+", "-", value).strip("-") or "section"


class TextContent(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []

    def handle_data(self, data: str) -> None:
        self.text.append(data)


def plain(markup: str) -> str:
    parser = TextContent()
    parser.feed(markup)
    return canonical("".join(parser.text))


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def relative(path: Path, parent: Path) -> str:
    return Path(os.path.relpath(path, parent)).as_posix()


def table_cells(line: str) -> list[str]:
    # A code span may itself contain a pipe. It is not a cell separator.
    cells, current, in_code, escaped = [], [], False, False
    for char in line.strip().strip("|"):
        if char == "`" and not escaped:
            in_code = not in_code
        if char == "|" and not in_code and not escaped:
            cells.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        escaped = char == "\\" and not escaped
    cells.append("".join(current).strip())
    return cells


def table_separator(line: str) -> bool:
    return bool(line.strip()) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in table_cells(line))


STYLE = r"""
:root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; color: #d5dfec; background: #0b1220; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 0; font-size: 17px; line-height: 1.8; }
.layout { display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 100vh; }
.document-nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 30px 18px; background: #0d1726; border-right: 1px solid #263650; }
.nav-title { display: block; color: #e7edf6; font-size: 16px; letter-spacing: .03em; }
.nav-meta { margin: 5px 0 18px; color: #91a2b9; font-size: 12px; line-height: 1.65; }
.document-switcher { display: grid; gap: 5px; padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid #263650; }
.document-switcher a { display: block; padding: 7px 9px; border-radius: 5px; color: #b7c9e0; font-size: 13px; text-decoration: none; }
.document-switcher a[aria-current="page"] { color: #cee4ff; background: #19304e; font-weight: 700; }
.document-switcher a:hover { background: #14253c; color: #e7edf6; }
.toc-label { margin: 0 0 8px; font-size: 11px; color: #8292a8; letter-spacing: .08em; }
.toc a { --indent: 0px; position: relative; display: block; padding: 5px 7px 5px calc(8px + var(--indent)); color: #aebdd1; text-decoration: none; font-size: 12.5px; line-height: 1.55; overflow-wrap: anywhere; }
.toc a.toc-level-1 { color: #e7edf6; font-size: 13px; font-weight: 700; margin: 4px 0; }
.toc a.toc-level-2 { color: #d0dced; font-size: 13px; font-weight: 650; margin-top: 5px; }
.toc a.toc-level-3 { --indent: 12px; }
.toc a.toc-level-4, .toc a.toc-level-5, .toc a.toc-level-6 { --indent: 24px; }
.toc a:hover, .toc a.is-current { color: #8cbdff; }
.toc a.is-current::before { content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 2px; background: #3797ff; }
main { width: min(100%, 1032px); min-width: 0; padding: 40px 40px 88px; margin: 0 auto; overflow-wrap: anywhere; }
.reader-header .document-status { color: #aebdd1; line-height: 1.6; }
.reader-intro { padding: 16px 18px; margin: 0 0 30px; border-left: 3px solid #527faa; background: #101e31; color: #aebdd1; font-size: 14px; line-height: 1.8; }
.reader-intro p { margin: 0; }
h1 { margin: 0 0 26px; font-size: 34px; line-height: 1.45; color: #eff4fc; letter-spacing: -.025em; }
h2 { margin: 52px 0 20px; padding-bottom: 10px; border-bottom: 1px solid #2a3c56; font-size: 25px; line-height: 1.5; color: #eff4fc; }
h3 { margin: 32px 0 14px; font-size: 21px; line-height: 1.6; color: #e7edf6; }
h4, h5, h6 { margin: 26px 0 12px; font-size: 18px; line-height: 1.6; color: #e7edf6; }
p { margin: 0 0 20px; }
strong { color: #edf4ff; font-weight: 650; }
a { color: #8cbdff; text-underline-offset: 3px; }
a:hover { color: #b6d5ff; }
a:focus-visible, button:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline: 2px solid #9ecaff; outline-offset: 3px; }
ul, ol { margin: 0 0 22px; padding-left: 27px; }
li { margin: 7px 0; }
code { padding: .1em .3em; border-radius: 4px; background: #1a273c; color: #d4e4f8; font-size: .86em; }
pre { max-width: 100%; overflow-x: auto; margin: 20px 0; padding: 18px; border: 1px solid #293c57; border-radius: 6px; background: #0a1322; line-height: 1.65; tab-size: 2; }
pre code { padding: 0; background: none; font-size: 13px; }
blockquote { margin: 20px 0; padding: 14px 18px; border-left: 3px solid #587ca5; background: #111f32; }
.table-wrap { max-width: 100%; overflow-x: auto; margin: 22px 0 28px; border: 1px solid #2d405b; border-radius: 6px; }
table { min-width: 620px; width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.75; }
th, td { padding: 12px 14px; border-right: 1px solid #263650; border-bottom: 1px solid #263650; text-align: left; vertical-align: top; }
th { color: #e7edf6; background: #17263b; font-weight: 650; }
tr:last-child td { border-bottom: 0; }
th:last-child, td:last-child { border-right: 0; }
tbody tr:nth-child(even) { background: #0e192a; }
details { margin: 22px 0; border: 1px solid #2c425e; border-radius: 7px; background: #0e1a2b; }
summary { cursor: pointer; padding: 13px 16px; color: #b9d8ff; font-size: 15px; line-height: 1.75; }
details[open] > summary { border-bottom: 1px solid #2a3e57; }
.details-body { padding: 20px 20px 2px; }
.details-body > :first-child { margin-top: 0; }
.details-body h3 { font-size: 19px; }
.details-body table { font-size: 14px; }
.semantic-flow { padding: 18px 20px 14px; margin: 22px 0; border: 1px solid #31517a; border-radius: 8px; background: #101e31; }
.semantic-flow > p { margin: 0 0 12px; color: #9bbce4; font-size: 13px; }
.semantic-flow ol { display: grid; gap: 9px; margin: 0; padding-left: 23px; }
.semantic-flow li { margin: 0; padding-left: 4px; font-size: 15px; line-height: 1.8; }
.flow-node { display: inline; color: #e0ecfb; }
.flow-arrow { color: #7da5d5; padding: 0 9px; }
.diagram-source { margin: 12px 0 0; }
.source-meta, .evidence-notice { color: #9aafca; font-size: 13px; }
.source-line { display: block; min-height: 1.65em; scroll-margin-top: 24px; }
.source-line:target { background: #244369; outline: 1px solid #6aa3e8; }
.line-number { display: inline-block; min-width: 5ch; margin-right: 14px; color: #748eaf; user-select: none; }
h1, h2, h3, h4, h5, h6, [data-comment-block] { scroll-margin-top: 86px; }
[data-comment-block].review-highlight { background: #163d63; box-shadow: 0 0 0 2px #3797ff; border-radius: 3px; }
@media (max-width: 1080px) { .layout { grid-template-columns: 228px minmax(0, 1fr); } main { padding-left: 30px; padding-right: 30px; } .document-nav { padding-left: 14px; padding-right: 14px; } }
@media (max-width: 720px) { .layout { display: block; } .document-nav { position: static; height: auto; max-height: 42vh; padding: 20px; border-right: 0; border-bottom: 1px solid #263650; } .document-switcher { grid-template-columns: 1fr 1fr; gap: 5px 10px; margin-bottom: 12px; padding-bottom: 12px; } .document-switcher a { min-height: 44px; display: flex; align-items: center; } main { padding: 28px 20px 60px; } h1 { font-size: 29px; } h2 { font-size: 23px; margin-top: 42px; } h3 { font-size: 20px; } .details-body { padding: 16px 14px 0; } summary { min-height: 44px; } .toc a { padding-top: 7px; padding-bottom: 7px; } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
"""

READER_JS = r"""(() => {
  const links = [...document.querySelectorAll('.toc a[data-target]')];
  const headings = links.map(link => document.getElementById(link.dataset.target)).filter(Boolean);
  function reveal(target) {
    let parent = target?.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }
  function followHash() {
    if (!location.hash) return;
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (!target) return;
    reveal(target); requestAnimationFrame(() => { target.scrollIntoView({block: 'start'}); mark(); });
  }
  function mark() {
    let current = headings[0];
    for (const heading of headings) if (heading.getClientRects().length && heading.getBoundingClientRect().top <= 125) current = heading;
    links.forEach(link => { const active = link.dataset.target === current?.id; link.classList.toggle('is-current', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => { let target; try { target = document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch (_) {} reveal(target); if (link.hash === location.hash) requestAnimationFrame(followHash); }));
  document.addEventListener('scroll', mark, {passive: true});
  document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', mark));
  window.addEventListener('hashchange', followHash);
  followHash(); mark();
})();
"""


class Builder:
    def __init__(self, output: Path) -> None:
        self.output = output
        self.evidence: dict[str, dict[str, object]] = {}
        self.links: list[dict[str, str | int]] = []

    def evidence_url(self, target: Path, output_parent: Path, line: int | None = None) -> str:
        repo_name = target.relative_to(ROOT).as_posix()
        key = digest(repo_name)[:16]
        dest = self.output / "evidence" / f"{key}.html"
        data = target.read_bytes()
        # Only explicitly linked text files are exposed, never a directory or DB.
        if b"\x00" in data or len(data) > 4_000_000:
            raise ValueError(f"cannot expose non-text or oversized reference: {repo_name}")
        source = data.decode("utf-8")
        lines = source.splitlines()
        ranges = self.evidence.setdefault(repo_name, {"path": repo_name, "fingerprint": digest(data), "url": f"evidence/{key}.html", "requestedLines": []})
        if line:
            ranges["requestedLines"] = sorted(set(ranges["requestedLines"]) | {line})
        # These are explicitly linked source/evidence files, rendered as escaped
        # text. Keep them complete: a link to a named function need not carry a
        # line number, and showing only a file's imports would lose its evidence.
        selected = range(1, len(lines) + 1)
        content, previous = [], 0
        for index in sorted(selected):
            if index != previous + 1:
                content.append('<span class="source-line evidence-notice">… 中间行省略；此页为只读摘录 …</span>')
            content.append(f'<span class="source-line" id="L{index}"><span class="line-number">{index}</span>{esc(lines[index - 1])}</span>')
            previous = index
        if previous < len(lines):
            content.append('<span class="source-line evidence-notice">… 后续行省略；原始文件保留在仓库 …</span>')
        note = f"只读完整快照，共 {len(lines)} 行。构建时内容指纹：{digest(data)}。不含目录浏览或原文件写入口。"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>证据 · {esc(repo_name)}</title><link rel="stylesheet" href="../reader.css"></head><body><main><p><a href="../current/index.html">现状说明</a> · <a href="../target/index.html">目标设计审查稿</a> · <a href="{VISUAL_URL}">视觉规范</a></p><h1>只读证据</h1><p class="source-meta">{esc(repo_name)}</p><p class="evidence-notice">{note}</p><pre><code>{''.join(content)}</code></pre></main></body></html>\n''', encoding="utf-8")
        return relative(dest, output_parent) + (f"#L{line}" if line else "")

    def url(self, raw: str, source: Path, output_parent: Path, source_line: int) -> str:
        parts = urlsplit(raw)
        if parts.scheme or parts.netloc:
            if parts.scheme.lower() not in {"http", "https", "mailto"}:
                raise ValueError(f"unsupported link scheme at {source}:{source_line}: {raw}")
            return raw
        if not parts.path:
            return raw
        raw_path = unquote(parts.path)
        line_match = re.match(r"^(.*?):(\d+)$", raw_path)
        requested_line = int(line_match.group(2)) if line_match else None
        path = line_match.group(1) if line_match else raw_path
        target = (DOCS / path.lstrip("/") if path.startswith("/") else source.parent / path).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            raise ValueError(f"reference outside project: {raw}") from None
        if not target.is_file():
            raise ValueError(f"missing reference at {source.relative_to(ROOT)}:{source_line}: {raw}")
        if any(target == document["source"].resolve() for document in DOCUMENTS):
            key = next(document["key"] for document in DOCUMENTS if target == document["source"].resolve())
            converted = relative(self.output / key / "index.html", output_parent)
        elif target.name == "visual-design.candidate.md" and (target.parent.parent / "visual-spec.html").is_file():
            converted = relative(target.parent.parent / "visual-spec.html", output_parent)
        elif target.suffix.lower() in {".html", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".pdf"} and target.is_relative_to(DOCS):
            converted = relative(target, output_parent)
        else:
            converted = self.evidence_url(target, output_parent, requested_line)
        result = urlunsplit(("", "", converted.split("#", 1)[0], parts.query, converted.split("#", 1)[1] if "#" in converted else parts.fragment))
        self.links.append({"source": source.relative_to(ROOT).as_posix(), "sourceLine": source_line, "original": raw, "resolved": result})
        return result

    def inline(self, value: str, source: Path, output_parent: Path, source_line: int) -> str:
        pattern = re.compile(r"(`+)(.*?)\1|\[([^\]]+)\]\(([^)\s]+)(?:\s+[\"']([^\"']*)[\"'])?\)|\*\*(.+?)\*\*|__(.+?)__|(?<!\*)\*([^*]+)\*(?!\*)|~~(.+?)~~")
        output, end = [], 0
        for match in pattern.finditer(value):
            output.append(esc(value[end:match.start()].replace("\\|", "|")))
            if match.group(1):
                output.append(f"<code>{esc(match.group(2))}</code>")
            elif match.group(3):
                url = self.url(match.group(4), source, output_parent, source_line)
                title = f' title="{esc(match.group(5))}"' if match.group(5) else ""
                output.append(f'<a href="{esc(url)}"{title}>{self.inline(match.group(3), source, output_parent, source_line)}</a>')
            elif match.group(6) or match.group(7):
                output.append(f"<strong>{self.inline(match.group(6) or match.group(7), source, output_parent, source_line)}</strong>")
            elif match.group(8):
                output.append(f"<em>{self.inline(match.group(8), source, output_parent, source_line)}</em>")
            else:
                output.append(f"<del>{self.inline(match.group(9), source, output_parent, source_line)}</del>")
            end = match.end()
        output.append(esc(value[end:].replace("\\|", "|")))
        return "".join(output)


class Reader:
    def __init__(self, builder: Builder, document: dict[str, str | Path]) -> None:
        self.builder, self.document = builder, document
        self.source = Path(document["source"])
        self.output = builder.output / str(document["key"])
        self.output.mkdir(parents=True, exist_ok=True)
        self.source_text = self.source.read_text(encoding="utf-8")
        self.lines = self.source_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        self.blocks: list[dict[str, object]] = []
        self.headings: list[dict[str, str | int]] = []
        self.heading_counts: dict[str, int] = defaultdict(int)
        self.chapter = "DOC"
        self.pending_marker: str | None = None
        self.identity_path = self.output / "document-identity.json"
        self.old_identity = json.loads(self.identity_path.read_text(encoding="utf-8")) if self.identity_path.is_file() else {"blocks": []}
        self.old_by_key: dict[str, list[dict[str, object]]] = defaultdict(list)
        for block in self.old_identity["blocks"]:
            self.old_by_key[str(block["sourceKey"])].append(block)
        self.reserved = {str(block["id"]) for block in self.old_identity["blocks"]}
        self.used: set[str] = set()
        self.next_number = 1

    def inline(self, text: str, source_line: int) -> str:
        return self.builder.inline(text, self.source, self.output, source_line)

    def block(self, tag: str, content: str, line: int, kind: str, extra: str = "") -> str:
        text = plain(content)
        if not text:
            return f"<{tag}{extra}>{content}</{tag}>"
        key = digest(f"{kind}\0{self.chapter}\0{text}")[:24]
        candidates = [block for block in self.old_by_key[key] if block["id"] not in self.used]
        if self.pending_marker:
            block_id = self.pending_marker
            self.pending_marker = None
            if block_id in self.used:
                raise ValueError(f"duplicate explicit block ID: {block_id}")
        elif candidates:
            block_id = str(candidates[0]["id"])
        else:
            prefix = str(self.document["id"])
            while f"{prefix}-B{self.next_number:04d}" in self.reserved | self.used:
                self.next_number += 1
            block_id = f"{prefix}-B{self.next_number:04d}"
            self.next_number += 1
        self.used.add(block_id)
        self.blocks.append({"id": block_id, "chapter": self.chapter, "kind": kind, "text": text, "sourceLine": line, "sourceKey": key})
        attrs = f' data-comment-block="{esc(block_id)}" data-chapter="{esc(self.chapter)}" data-source-line="{line}"'
        return f"<{tag}{attrs}{extra}>{content}</{tag}>"

    def diagram(self, code: str, line: int) -> str:
        names: dict[str, str] = {}
        node = re.compile(r'\b([A-Za-z][\w-]*)\s*(?:\[\((.*?)\)\]|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})')
        for match in node.finditer(code):
            names[match.group(1)] = next(group for group in match.groups()[1:] if group is not None).strip('"')
        edges = []
        for offset, source_line in enumerate(code.splitlines()):
            if "-->" not in source_line:
                continue
            parts = re.split(r"\s*-->\s*", source_line.strip())
            for start, end in zip(parts, parts[1:]):
                start_id, end_id = re.match(r"([\w-]+)", start), re.match(r"([\w-]+)", end)
                if not start_id or not end_id:
                    raise ValueError(f"unsupported Mermaid edge at source line {line + offset}")
                left, right = names.get(start_id.group(1), start_id.group(1)), names.get(end_id.group(1), end_id.group(1))
                content = f'<span class="flow-node">{esc(left)}</span><span class="flow-arrow"> → </span><span class="flow-node">{esc(right)}</span>'
                edges.append(self.block("li", content, line + offset, "flow"))
        if not edges:
            raise ValueError(f"Mermaid must have a readable semantic flow at source line {line}")
        raw = self.block("code", esc(code), line, "code")
        return f'<div class="semantic-flow" role="group" aria-label="协作流程"><p>协作关系 · 沿箭头阅读，分支分别列出</p><ol>{"".join(edges)}</ol><details class="diagram-source"><summary>技术详情：查看原始图定义</summary><div class="details-body"><pre>{raw}</pre></div></details></div>'

    def render(self, start: int = 0, stop_at_details: bool = False) -> tuple[str, int]:
        output, i = [], start
        while i < len(self.lines):
            text = self.lines[i].strip()
            if not text:
                i += 1
                continue
            if text == "</details>":
                if not stop_at_details:
                    raise ValueError(f"unmatched </details> at {self.source}:{i + 1}")
                return "\n".join(output), i + 1
            marker = re.fullmatch(r"<!--\s*stable-id\s*:\s*([A-Za-z0-9._-]+)\s*-->", text)
            if marker:
                self.pending_marker = marker.group(1)
                i += 1
                continue
            if text.startswith("<!--"):
                while i < len(self.lines) and "-->" not in self.lines[i]:
                    i += 1
                i += 1
                continue
            if re.fullmatch(r"<details(?:\s+[^>]*)?>", text):
                i += 1
                while i < len(self.lines) and not self.lines[i].strip():
                    i += 1
                summary = re.fullmatch(r"\s*<summary>(.*?)</summary>\s*", self.lines[i]) if i < len(self.lines) else None
                if not summary:
                    raise ValueError(f"details requires a one-line summary at {self.source}:{i + 1}")
                summary_html = self.block("summary", self.inline(summary.group(1), i + 1), i + 1, "summary")
                body, i = self.render(i + 1, True)
                output.append(f'<details>{summary_html}<div class="details-body">{body}</div></details>')
                continue
            heading = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", text)
            if heading:
                level, title = len(heading.group(1)), heading.group(2)
                explicit = re.search(r"\s*\{#([^}]+)\}\s*$", title)
                title = re.sub(r"\s*\{#[^}]+\}\s*$", "", title)
                base = explicit.group(1) if explicit else slug(title)
                self.heading_counts[base] += 1
                anchor = base if self.heading_counts[base] == 1 else f"{base}-{self.heading_counts[base]}"
                if level <= 2:
                    self.chapter = anchor
                markup = self.inline(title, i + 1)
                self.headings.append({"id": anchor, "title": plain(markup), "level": level})
                output.append(self.block(f"h{level}", markup, i + 1, "heading", f' id="{esc(anchor)}"'))
                i += 1
                continue
            fence = re.match(r"^(`{3,}|~{3,})\s*([\w-]*)\s*$", text)
            if fence:
                end = i + 1
                while end < len(self.lines) and not re.fullmatch(re.escape(fence.group(1)) + r"\s*", self.lines[end].strip()):
                    end += 1
                if end == len(self.lines):
                    raise ValueError(f"unclosed code fence at {self.source}:{i + 1}")
                code = "\n".join(self.lines[i + 1:end])
                if fence.group(2) == "mermaid":
                    output.append(self.diagram(code, i + 2))
                else:
                    output.append("<pre>" + self.block("code", esc(code), i + 2, "code") + "</pre>")
                i = end + 1
                continue
            if i + 1 < len(self.lines) and "|" in text and table_separator(self.lines[i + 1]):
                headers = "".join(self.block("th", self.inline(cell, i + 1), i + 1, "tablecell", ' scope="col"') for cell in table_cells(text))
                i += 2
                rows = []
                while i < len(self.lines) and self.lines[i].strip() and "|" in self.lines[i]:
                    rows.append("<tr>" + "".join(self.block("td", self.inline(cell, i + 1), i + 1, "tablecell") for cell in table_cells(self.lines[i])) + "</tr>")
                    i += 1
                output.append(f'<div class="table-wrap" tabindex="0" role="region" aria-label="可横向滚动的数据表"><table><thead><tr>{headers}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')
                continue
            list_item = re.match(r"^([-*+]\s+|\d+[.)]\s+)(.*)$", text)
            if list_item:
                ordered = list_item.group(1)[0].isdigit()
                rows = []
                while i < len(self.lines):
                    item = re.match(r"^\s*([-*+]\s+|\d+[.)]\s+)(.*)$", self.lines[i])
                    if not item or item.group(1)[0].isdigit() != ordered:
                        break
                    rows.append(self.block("li", self.inline(item.group(2), i + 1), i + 1, "listitem"))
                    i += 1
                tag = "ol" if ordered else "ul"
                output.append(f'<{tag}>{"".join(rows)}</{tag}>')
                continue
            if re.fullmatch(r"(?:---+|\*\*\*+|___+)", text):
                output.append("<hr>")
                i += 1
                continue
            line = i + 1
            pieces = [text]
            i += 1
            while i < len(self.lines) and self.lines[i].strip():
                probe = self.lines[i].strip()
                if re.match(r"#{1,6}\s|```|~~~|[-*+]\s|\d+[.)]\s|</?details|<summary|<!--", probe):
                    break
                if i + 1 < len(self.lines) and "|" in probe and table_separator(self.lines[i + 1]):
                    break
                pieces.append(probe)
                i += 1
            paragraph = " ".join(pieces)
            quote = paragraph.startswith("> ")
            if quote:
                paragraph = re.sub(r"(?:^| )>\s?", " ", paragraph).strip()
            markup = self.block("p", self.inline(paragraph, line), line, "paragraph")
            output.append(f"<blockquote>{markup}</blockquote>" if quote else markup)
        if stop_at_details:
            raise ValueError(f"unclosed details in {self.source}")
        return "\n".join(output), i

    def build(self) -> dict[str, object]:
        body, _ = self.render()
        fingerprint = digest(self.source_text)
        manifest = {"schema": "strategy-document-manifest/1", "documentId": self.document["id"], "version": VERSION, "fingerprint": fingerprint, "sourceFile": self.source.relative_to(ROOT).as_posix(), "documentUrl": "index.html", "blocks": self.blocks, "images": []}
        old = [dict(block, active=False) for block in self.old_identity["blocks"] if block["id"] not in self.used]
        identity = {"schema": "strategy-document-identity/1", "documentId": self.document["id"], "version": VERSION, "blocks": old + [dict(block, active=True) for block in self.blocks], "images": []}
        write_json(self.output / "document-manifest.json", manifest)
        write_json(self.identity_path, identity)
        write_json(self.output / "comment-migration.json", {"entries": []})
        write_json(self.output / "comments-snapshot.json", {"documentId": self.document["id"], "revision": 0, "comments": []})
        for filename in ("review-client.js", "review-client.css"):
            shutil.copyfile(REFERENCE / filename, self.output / filename)
        toc = "\n".join(f'<a class="toc-level-{heading["level"]}" href="#{esc(heading["id"])}" data-target="{esc(heading["id"])}">{esc(heading["title"])}</a>' for heading in self.headings)
        switcher = "".join(f'<a href="../{document["key"]}/index.html"' + (' aria-current="page"' if document["key"] == self.document["key"] else "") + f'>{document["label"]}</a>' for document in DOCUMENTS)
        title = self.headings[0]["title"] if self.headings else self.document["label"]
        manifest_json = json.dumps(manifest, ensure_ascii=False).replace("<", "\\u003c")
        attrs = f'data-document-id="{self.document["id"]}" data-document-version="{VERSION}" data-document-fingerprint="{fingerprint}"'
        page = f'''<!doctype html><html lang="zh-CN" {attrs}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{esc(title)}</title><link rel="stylesheet" href="../reader.css"><link rel="stylesheet" href="review-client.css"></head>
<body><div class="layout"><nav class="document-nav" aria-label="文档目录"><strong class="nav-title">后端业务与数据设计</strong><p class="nav-meta">两份独立审查文档<br>结论先行，技术论据逐层展开</p><div class="document-switcher" aria-label="审查文档">{switcher}<a href="{VISUAL_URL}">视觉规范审查稿 ↗</a></div><p class="toc-label">本稿目录</p><div class="toc">{toc}</div></nav><main id="reader-document" {attrs}><header class="reader-header"><p class="document-status">{self.document["status"]}</p><button type="button" id="review-open" class="review-open">评论</button></header><aside class="reader-intro" aria-label="阅读提示"><p>先读每章结论；展开“技术详情”查看处理对象、规则和证据。选中正文后点击“评论”，可引用原文、回复、评审与导出。本稿与另一份文档分别保存评论。</p></aside>{body}</main></div><script type="application/json" id="document-manifest">{manifest_json}</script><script src="../reader.js" defer></script><script src="review-client.js" defer></script></body></html>\n'''
        (self.output / "index.html").write_text(page, encoding="utf-8")
        return {"documentId": self.document["id"], "fingerprint": fingerprint, "blocks": len(self.blocks), "headings": len(self.headings), "output": relative(self.output / "index.html", ROOT)}


class AuditHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.links: list[str] = []
        self.blocks: dict[str, str] = {}
        self.stack: list[tuple[str, str | None]] = []
        self.active: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if data.get("id"):
            self.ids.append(str(data["id"]))
        for attribute in ("href", "src"):
            if data.get(attribute):
                self.links.append(str(data[attribute]))
        block = data.get("data-comment-block")
        if block:
            if block in self.blocks:
                raise ValueError(f"duplicate comment block {block}")
            self.blocks[block] = ""
            self.active.append(block)
        if tag not in {"meta", "link", "br", "hr", "img", "input"}:
            self.stack.append((tag, block))

    def handle_endtag(self, tag: str) -> None:
        if not self.stack:
            return
        _, block = self.stack.pop()
        if block:
            self.active.remove(block)

    def handle_data(self, data: str) -> None:
        for block in self.active:
            self.blocks[block] += data


def validate(output: Path) -> dict[str, int]:
    pages: dict[Path, AuditHTML] = {}
    total_blocks = 0
    for path in sorted(output.rglob("*.html")):
        parser = AuditHTML()
        parser.feed(path.read_text(encoding="utf-8"))
        if len(set(parser.ids)) != len(parser.ids):
            raise ValueError(f"duplicate DOM ID in {path}")
        pages[path.resolve()] = parser
    for document in DOCUMENTS:
        folder = output / str(document["key"])
        manifest = json.loads((folder / "document-manifest.json").read_text(encoding="utf-8"))
        parser = pages[(folder / "index.html").resolve()]
        if list(parser.blocks) != [block["id"] for block in manifest["blocks"]]:
            raise ValueError(f"manifest/DOM block ID or order mismatch in {folder}")
        for block in manifest["blocks"]:
            if canonical(parser.blocks[block["id"]]) != block["text"]:
                raise ValueError(f"manifest/DOM text mismatch: {block['id']}")
        for filename in ("review-client.js", "review-client.css"):
            if (folder / filename).read_bytes() != (REFERENCE / filename).read_bytes():
                raise ValueError(f"review client must be an unmodified copy: {folder / filename}")
        for filename in ("comments-snapshot.json", "comment-migration.json"):
            json.loads((folder / filename).read_text(encoding="utf-8"))
        total_blocks += len(manifest["blocks"])
    count = 0
    for path, parser in pages.items():
        for url in parser.links:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc:
                continue
            target = (DOCS / unquote(parts.path).lstrip("/") if parts.path.startswith("/") else path.parent / unquote(parts.path)).resolve() if parts.path else path
            if not target.is_relative_to(DOCS) or not target.is_file():
                raise ValueError(f"unsafe or missing generated link in {path}: {url}")
            if parts.fragment:
                other = pages.get(target)
                if other is None and target.suffix == ".html":
                    other = AuditHTML()
                    other.feed(target.read_text(encoding="utf-8"))
                if other and unquote(parts.fragment) not in other.ids:
                    raise ValueError(f"missing anchor in {path}: {url}")
            count += 1
    return {"pages": len(pages), "commentBlocks": total_blocks, "localLinks": count}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=HERE / "review")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    output = args.output_dir.resolve()
    if not output.is_relative_to(HERE):
        raise ValueError("output must stay inside docs/backend-design")
    if args.check_only:
        print(json.dumps(validate(output), ensure_ascii=False))
        return
    output.mkdir(parents=True, exist_ok=True)
    (output / "reader.css").write_text(STYLE.strip() + "\n", encoding="utf-8")
    (output / "reader.js").write_text(READER_JS.strip() + "\n", encoding="utf-8")
    builder = Builder(output)
    documents = [Reader(builder, document).build() for document in DOCUMENTS]
    write_json(output / "reference-index.json", {"references": sorted(builder.evidence.values(), key=lambda entry: str(entry["path"])), "links": builder.links})
    (output / "index.html").write_text('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>后端设计审查稿</title><link rel="stylesheet" href="reader.css"></head><body><main><h1>后端业务与数据设计</h1><p>现状和目标保留独立身份与评论记录。</p><ul><li><a href="current/index.html">现状说明：实现快照</a></li><li><a href="target/index.html">目标设计审查稿：模块级候选，未授权实现</a></li><li><a href="' + VISUAL_URL + '">视觉规范审查稿</a></li></ul></main></body></html>\n', encoding="utf-8")
    result = validate(output)
    write_json(output / "build-info.json", {"generator": "docs/backend-design/build-review.py", "clientSource": relative(REFERENCE, ROOT), "clientModification": "unmodified copies", "documents": documents, "validation": result})
    print(json.dumps({"documents": documents, "validation": result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
