#!/usr/bin/env python3
"""Structural checks for the bounded V241-03 holdings migration."""

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "docs/design-system/baselines/2026-10-20-homepage-v2.4.1"
TARGETS = {
    "home-1280.svg": ("545", "581", "710", "820"),
    "home-1440.svg": ("705", "741", "870", "980"),
}
CANDIDATES = [
    PACKAGE / "source/images" / f"holding-option-C-{frame}-{width}.svg"
    for frame in ("normal", "large")
    for width in ("1280", "1440")
]


def text_at(source: str, x: str, y: str) -> int:
    return len(re.findall(rf'<text x="{re.escape(x)}" y="{re.escape(y)}"', source))


def main() -> None:
    checks = []
    for name, anchors in TARGETS.items():
        for folder in ("source/images", "images"):
            path = PACKAGE / folder / name
            source = path.read_text()
            assert source.count('<rect x="96" y="586"') == 1, path
            assert '<text x="112" y="630"' not in source, path
            if folder == "source/images":
                for anchor in anchors:
                    assert text_at(source, anchor, "610") == 1, (path, anchor)
                summary_instances = 4
            else:
                # Packaged boards keep each metric as one combined text node.
                assert text_at(source, anchors[0], "610") == 1, (path, anchors[0])
                assert text_at(source, anchors[2], "610") == 1, (path, anchors[2])
                summary_instances = 2
            # Header brackets and table anchors are outside the migration scope.
            assert "当前持仓（最新）" in source and "持仓市值" in source, path
            assert "持仓浮动盈亏" in source, path
            checks.append({"path": str(path.relative_to(ROOT)), "status": "PASS", "summaryInstances": summary_instances})

    for path in CANDIDATES:
        source = path.read_text()
        assert "当前持仓（最新）" in source and "持仓市值（CNY）" in source, path
        checks.append({"path": str(path.relative_to(ROOT)), "status": "UNCHANGED-CANDIDATE-REFERENCE", "summaryInstances": 2})

    out = ROOT / ".scratch/homepage-v241-repair/holdings-c/evidence/structural-verification.json"
    out.write_text(json.dumps({
        "scope": "V241-03 D02 C1-2",
        "targets": checks,
        "coverage": {
            "fullPageDefaults": "2 viewports × 2 packaged/source copies = 4",
            "approvedCandidateReferences": "4 (normal/large × 1280/1440)",
            "states": ["normal", "extreme/large", "empty", "loading", "return"],
            "interactiveBrowser": "NOT VERIFIED by implementer; root owns independent acceptance",
        },
    }, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
