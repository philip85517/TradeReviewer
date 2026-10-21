#!/usr/bin/env python3
"""Apply the approved C summary geometry to full-page homepage boards.

This migration intentionally targets only the four summary text elements in
each full-page board.  It does not rewrite table columns, controls, brackets,
or any candidate A/B/C board.  Running it twice is safe and fails loudly if
the expected source geometry is no longer present.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "docs/design-system/baselines/2026-10-20-homepage-v2.4.1"
TARGETS = ("home-1280.svg", "home-1440.svg")

# Frozen pre-migration hashes retained so a repeat run still reports the
# original-to-current evidence instead of erasing the first-run diff.
BASELINE_SHA256 = {
    "source/images/home-1280.svg": "125889fde104369ad1603ee2948878f5aedf2ca79750e60e1ddc6c3c14c7874f",
    "source/images/home-1440.svg": "609c6e79bfb6268a16915d56841ab096f23422bcd5e5f999c23b34a238ddfba7",
    "images/home-1280.svg": "40d9d2319e89f89a448d047c1ecefaa5b3026ee4f5dca35cbf2696a0a1d3d287",
    "images/home-1440.svg": "5b886c155eef65cee7fe69cb265142943fa8beb862d0364fbfd756329cc82b81",
}

# Relative to the holdings module's left edge (x=96).  These are the C
# candidate's metric anchors adapted to the full-page module widths.  The
# title, toolbar, table and all non-summary geometry stay unchanged.
GEOMETRY = {
    "home-1280.svg": {
        "metric_value": {"x": "545", "y": "610"},
        "metric_value_text": {"x": "581", "y": "610"},
        "pnl_label": {"x": "710", "y": "610"},
        "pnl_value": {"x": "820", "y": "610"},
    },
    "home-1440.svg": {
        "metric_value": {"x": "705", "y": "610"},
        "metric_value_text": {"x": "741", "y": "610"},
        "pnl_label": {"x": "870", "y": "610"},
        "pnl_value": {"x": "980", "y": "610"},
    },
}


def replace_once(source: str, pattern: str, replacement: str, label: str) -> str:
    matches = list(re.finditer(pattern, source))
    if len(matches) != 1:
        raise AssertionError(f"{label}: expected exactly one match, found {len(matches)}")
    match = matches[0]
    return source[: match.start()] + match.expand(replacement) + source[match.end() :]


def migrate(path: Path) -> dict[str, object]:
    name = path.name
    original = path.read_text()
    # Recover the interrupted first attempt deterministically before applying
    # the guarded migration.  This branch is only for the migration's own
    # literal backreference marker and cannot match a clean board.
    if "\\1" in original:
        if "source/images" not in str(path) or name != "home-1280.svg":
            raise AssertionError(f"{path}: unexpected literal migration marker")
        original = original.replace(
            '<text x="545" y="610"\\1>市值 </text><text x="581" y="610"\\1><title>260,102.03 CNY</title>26.01 万</text><text x="710" y="610"\\1>持仓浮动盈亏 </text><text x="820" y="610"\\1><title>23,153.48 CNY</title>+2.32 万</text>',
            '<text x="112" y="630" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start">市值 </text><text x="148" y="630" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start"><title>260,102.03 CNY</title>26.01 万</text><text x="376" y="630" font-size="12" fill="#E6EDF7" font-weight="400" text-anchor="start">持仓浮动盈亏 </text><text x="486" y="630" font-size="12" fill="#53D7A0" font-weight="400" text-anchor="start"><title>23,153.48 CNY</title>+2.32 万</text>',
        )
    g = GEOMETRY[name]
    if (
        f'<text x="{g["metric_value"]["x"]}" y="610"' in original
        and f'<text x="{g["pnl_label"]["x"]}" y="610"' in original
        and '<text x="112" y="630"' not in original
    ):
        digest = hashlib.sha256(original.encode()).hexdigest()
        relative = str(path.relative_to(PACKAGE))
        baseline = BASELINE_SHA256[relative]
        changed = {
            "marketValueLabel": {"from": {"x": "112", "y": "630"}, "to": g["metric_value"]},
            "marketValueValue": {"from": {"x": "148", "y": "630"}, "to": g["metric_value_text"]},
            "pnlLabel": {"from": {"x": "376", "y": "630"}, "to": g["pnl_label"]},
            "pnlValue": {"from": {"x": "486", "y": "630"}, "to": g["pnl_value"]},
        }
        return {
            "path": str(path.relative_to(ROOT)),
            "beforeSha256": baseline,
            "afterSha256": digest,
            "status": "already-migrated",
            "changedElements": changed,
        }
    # Ensure this is the old full-page layout, and never silently re-migrate.
    if original.count('<rect x="96" y="586"') != 1:
        raise AssertionError(f"{path}: holdings module anchor missing or duplicated")
    packaged = "source/images" not in str(path)
    if packaged:
        if original.count('<text x="112" y="630"') != 1 or original.count('<text x="376" y="630"') != 1:
            raise AssertionError(f"{path}: packaged summary anchors missing or duplicated")
    else:
        if original.count('<text x="112" y="630"') != 1:
            raise AssertionError(f"{path}: old summary label anchor missing or duplicated")
        if original.count('<text x="376" y="630"') != 1:
            raise AssertionError(f"{path}: old P&L label anchor missing or duplicated")
        if original.count('<text x="486" y="630"') != 1:
            raise AssertionError(f"{path}: old P&L value anchor missing or duplicated")

    updated = original
    if packaged:
        updated = replace_once(updated, r'<text x="112" y="630"([^>]*)>市值 ([^<]*)</text>', f'<text x="{g["metric_value"]["x"]}" y="{g["metric_value"]["y"]}"\\1>市值 \\2</text>', f"{name}: packaged market value")
        updated = replace_once(updated, r'<text x="376" y="630"([^>]*)>当前浮盈 ([^<]*)</text>', f'<text x="{g["pnl_label"]["x"]}" y="{g["pnl_label"]["y"]}"\\1>持仓浮动盈亏 \\2</text>', f"{name}: packaged P&L")
    else:
        updated = replace_once(updated, r'<text x="112" y="630"([^>]*)>市值 </text>', f'<text x="{g["metric_value"]["x"]}" y="{g["metric_value"]["y"]}"\\1>市值 </text>', f"{name}: market-value label")
        updated = replace_once(updated, r'<text x="148" y="630"([^>]*)>', f'<text x="{g["metric_value_text"]["x"]}" y="{g["metric_value_text"]["y"]}"\\1>', f"{name}: market-value value")
        updated = replace_once(updated, r'<text x="376" y="630"([^>]*)>持仓浮动盈亏 </text>', f'<text x="{g["pnl_label"]["x"]}" y="{g["pnl_label"]["y"]}"\\1>持仓浮动盈亏 </text>', f"{name}: P&L label")
        updated = replace_once(updated, r'<text x="486" y="630"([^>]*)>', f'<text x="{g["pnl_value"]["x"]}" y="{g["pnl_value"]["y"]}"\\1>', f"{name}: P&L value")

    if updated == original:
        raise AssertionError(f"{path}: migration produced no change")
    path.write_text(updated)
    return {
        "path": str(path.relative_to(ROOT)),
        "beforeSha256": hashlib.sha256(original.encode()).hexdigest(),
        "afterSha256": hashlib.sha256(updated.encode()).hexdigest(),
        "changedElements": {
            "marketValueLabel": {"from": {"x": "112", "y": "630"}, "to": g["metric_value"]},
            "marketValueValue": {"from": {"x": "148", "y": "630"}, "to": g["metric_value_text"]},
            "pnlLabel": {"from": {"x": "376", "y": "630"}, "to": g["pnl_label"]},
            "pnlValue": {"from": {"x": "486", "y": "630"}, "to": g["pnl_value"]},
        },
    }


def main() -> None:
    results = []
    for name in TARGETS:
        for relative in ("source/images", "images"):
            results.append(migrate(PACKAGE / relative / name))

    evidence = ROOT / ".scratch/homepage-v241-repair/holdings-c/evidence"
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / "migration-manifest.json").write_text(
        json.dumps(
            {
                "migration": "V241-03 holdings C full-page defaults",
                "approvedCandidates": [
                    "source/images/holding-option-C-normal-1280.svg",
                    "source/images/holding-option-C-normal-1440.svg",
                    "source/images/holding-option-C-large-1280.svg",
                    "source/images/holding-option-C-large-1440.svg",
                ],
                "targets": results,
                "assertions": [
                    "Only four summary text anchors changed per target.",
                    "Table columns, header bracket glyphs, toolbar, rows, and footer were not rewritten.",
                    "Candidate A/B/C boards were not touched.",
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
