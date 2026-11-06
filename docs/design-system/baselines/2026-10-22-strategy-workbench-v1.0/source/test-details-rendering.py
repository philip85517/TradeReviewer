#!/usr/bin/env python3
"""Behavior tests for Markdown details blocks.

This is intentionally a small executable test: it exercises the real parser
and renderer without starting the document builder or writing generated HTML.
"""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = ROOT / "build-visual-spec.py"
spec = importlib.util.spec_from_file_location("build_visual_spec", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


SOURCE = """# Reader fixture

Normal paragraph remains a paragraph.

<details>
<summary>展开规则</summary>

Details opening paragraph keeps its own block boundary.

### 重复小标题

- 第一条列表
- 第二条列表
- 第三条列表

| 字段 | 规则 |
| --- | --- |
| 起点 | 6/14 |
| 截止 | 9/13 |

表后说明仍然是独立段落。

| 第二表 | 值 |
| --- | --- |
| A | 1 |
</details>

### 重复小标题

普通 Markdown 回归段落。

| 外部 | 值 |
| --- | --- |
| 回归 | 保留 |
"""


def render_fixture() -> tuple[str, list[tuple[str, str, int]], list[dict]]:
    descriptors, images = module.collect_descriptors(SOURCE)
    assigned, _ = module.assign_block_ids(descriptors, {"blocks": []})
    html, headings = module.render_markdown(
        SOURCE,
        assigned,
        ROOT,
        ROOT,
        images,
        chapter_anchors=True,
    )
    return html, headings, assigned


def test_details_preserves_block_boundaries() -> None:
    html, headings, assigned = render_fixture()
    details = re.search(r"<details[^>]*>.*?</details>", html, re.S)
    assert details, "details block should render"
    body = details.group(0)
    assert body.count("<p") == 2, body
    assert body.count("<h3") == 1, body
    assert body.count("<ul>") == 1 and body.count("<li") == 3, body
    assert body.count("<table>") == 2, body
    assert body.count("<tbody>") == 2, body
    assert "表后说明仍然是独立段落。" in body
    for text in ("第一条列表", "第二条列表", "第三条列表", "第二表"):
        assert text in body, text

    # collect_descriptors intentionally keeps one paragraph descriptor for
    # the entire details block; rendering must attach that ID once after the
    # summary so the summary is not part of the comment quote target.
    details_descriptor = next(item for item in assigned if "Details opening paragraph" in item["text"])
    marker = f'data-comment-block="{details_descriptor["id"]}"'
    assert html.count(marker) == 1
    assert re.search(r'<div class="details-body"[^>]*' + re.escape(marker), body)
    assert body.index(marker) > body.index("</summary>")
    assert "展开规则" not in body[body.index(marker):]

    # Folded headings are content, not TOC entries.  The outer duplicate title
    # still gets one normal TOC entry and no duplicate id is emitted.
    ids = re.findall(r'\sid="([^"]+)"', html)
    assert len(ids) == len(set(ids)), ids
    assert sum(title == "重复小标题" for _, title, _ in headings) == 1, headings


def test_normal_markdown_regression() -> None:
    html, headings, _ = render_fixture()
    assert "Normal paragraph remains a paragraph." in html
    assert "普通 Markdown 回归段落。" in html
    assert html.count("<table>") == 3
    assert any(title == "Reader fixture" for _, title, _ in headings)


if __name__ == "__main__":
    test_details_preserves_block_boundaries()
    test_normal_markdown_regression()
    print("details rendering tests: PASS")
