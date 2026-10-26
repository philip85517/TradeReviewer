#!/usr/bin/env python3
"""Render the authoritative trading-library Markdown with the existing reader style."""
from pathlib import Path
import hashlib
import html
import importlib.util
import re
import os
from urllib.parse import urlsplit, urlunsplit
import sys

HERE = Path(__file__).resolve().parent
READER = HERE / 'baselines/2026-10-26-trading-library-v2.0/build-visual-spec.py'
spec = importlib.util.spec_from_file_location('trading_library_reader', READER)
reader = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = reader
spec.loader.exec_module(reader)
source_path = HERE / 'trading-library-design-spec.md'
source = source_path.read_text(encoding='utf-8')
# Reuse typography and Markdown rendering without the visual reader's legacy
# rewrites of repository-only evidence paths to an unrelated rule-details page.
def rebase(raw, source_parent, output_parent):
    parts = urlsplit(raw)
    if parts.scheme or parts.netloc or raw.startswith(('#', '/')):
        return raw
    target = (source_parent / parts.path).resolve()
    return urlunsplit(('', '', os.path.relpath(target, output_parent), parts.query, parts.fragment))
reader.rebase_url = rebase
_, images = reader.collect_descriptors(source)
body, headings = reader.render_markdown(source, [], HERE, HERE, images, chapter_anchors=True)
# The preview serves docs/, so repository evidence outside docs is identified
# by its source path instead of exposing a broken HTTP link. Markdown keeps
# the original navigable repository links.
def repository_reference(match):
    url, label = html.unescape(match.group(1)), match.group(2)
    parts = urlsplit(url)
    if not parts.scheme and not parts.netloc and parts.path:
        target = (HERE / parts.path).resolve()
        if not target.is_relative_to(HERE.parent):
            return f'<span title="仓库来源：{html.escape(url)}">{label}（仓库来源）</span>'
    return match.group(0)
body = re.sub(r'<a href="([^"]+)"[^>]*>(.*?)</a>', repository_reference, body)
toc = ''.join(f'<a class="toc-level-{level}" href="#{html.escape(anchor)}">{html.escape(title)}</a>' for anchor, title, level in headings)
fingerprint = hashlib.sha256(source.encode('utf-8')).hexdigest()
output = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>交易库设计规范</title><style>{reader.STYLE}</style></head>
<body data-source-sha256="{fingerprint}"><div class="layout"><nav aria-label="规范目录"><strong>交易库设计规范</strong><p class="nav-meta">业务逻辑与统一术语</p>{toc}</nav><main class="rule-details"><header class="reader-header"><p class="document-status">业务规范 · 以 Markdown 源文件为准</p><a href="baselines/2026-10-26-trading-library-v2.0/visual-spec.html">交易库视觉设计 V2.0</a> · <a href="trading-library-design-spec.md">规范源文件</a></header>{body}</main></div></body></html>
'''
(HERE / 'trading-library-design-spec.html').write_text(output, encoding='utf-8')
print(f'Rendered trading-library-design-spec.html; source SHA256 {fingerprint}')
