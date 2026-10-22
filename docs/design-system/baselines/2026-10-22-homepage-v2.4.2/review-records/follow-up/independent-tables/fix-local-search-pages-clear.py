#!/usr/bin/env python3
"""Create a reviewable copy of local-search-pages--clear with footer clearance.

This script intentionally writes only the requested output path. It never edits the
shared source in place; the root/shared owner can apply the one-line coordinate
change after review.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

SOURCE_SHA256 = "2294ed552ce1b67699dcc0c04ace9e0133c9a46e7804e7aaad9702596560cae1"
OLD = '<text x="40" y="1844" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="start">V2.4.1 · 设计状态图，非产品运行截图</text>'
NEW = '<text x="40" y="1838" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="start">V2.4.1 · 设计状态图，非产品运行截图</text>'
OLD_SUMMARY = '<text x="56" y="1829" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="start">1–8 / 50 项</text>'
NEW_SUMMARY = '<text x="56" y="1825" font-size="12" fill="#A8B6CB" font-weight="400" text-anchor="start">1–8 / 50 项</text>'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    data = args.source.read_bytes()
    source_sha = hashlib.sha256(data).hexdigest()
    if source_sha != SOURCE_SHA256:
        raise SystemExit(f"source SHA mismatch: expected {SOURCE_SHA256}, got {source_sha}")
    text = data.decode("utf-8")
    if text.count(OLD) != 1 or text.count(OLD_SUMMARY) != 1:
        raise SystemExit(f"expected exactly one footer at y=1844, found {text.count(OLD)}")
    if 'transform="translate(0,-1326)"' not in text:
        raise SystemExit("expected the reviewed transform translate(0,-1326)")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text.replace(OLD, NEW).replace(OLD_SUMMARY, NEW_SUMMARY), encoding="utf-8")
    print(f"wrote {args.output}")
    print(f"source {source_sha}")
    print(f"output {hashlib.sha256(args.output.read_bytes()).hexdigest()}")
    print("footer baseline: 1844 -> 1838 (transformed 518 -> 512)")
    print("pagination summary baseline: 1829 -> 1825 (transformed 503 -> 499)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
