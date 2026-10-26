#!/usr/bin/env python3
"""Focused contracts for the C08/C09 static metrics and distribution design."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from xml.etree import ElementTree


SOURCE = Path(__file__).with_name("generate-library-frames.py")
spec = importlib.util.spec_from_file_location("library_frames", SOURCE)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
assert spec.loader is not None
spec.loader.exec_module(module)

FIXTURE = json.loads((SOURCE.parent / "library-design-fixture.json").read_text())


class MetricsContractTest(unittest.TestCase):
    def test_fixture_totals_and_directional_rates(self):
        simulation = module.derive_sim_rounds(FIXTURE)
        live = module.derive_live_rounds(FIXTURE)
        self.assertEqual(len(simulation), 7)
        self.assertEqual(round(sum(row["net"] for row in simulation), 2), 2272.0)
        self.assertEqual(round(sum(row["fees"] for row in simulation), 2), 33.0)
        self.assertEqual(module.stats_for(simulation)["win_rate"], 71.43)
        self.assertEqual(len(live), 5)
        self.assertEqual(round(sum(row["net"] for row in live), 2), 747.14)
        self.assertEqual(round(sum(row["fees"] for row in live), 2), 22.86)
        self.assertEqual(module.stats_for(live)["win_rate"], 60.0)
        self.assertEqual(module.direction_stats(simulation)["long"]["wins"], 5)
        self.assertEqual(module.direction_stats(simulation)["long"]["rate"], 71.43)
        self.assertIsNone(module.direction_stats(simulation)["short"]["rate"])

    def test_direction_denominator_includes_flat_and_unknown_is_reported(self):
        rows = [
            {"direction": "long", "net": 4},
            {"direction": "long", "net": -2},
            {"direction": "long", "net": 0},
            {"direction": "short", "net": 5},
            {"direction": "short", "net": -1},
            {"direction": "short", "net": 0},
            {"direction": "mystery", "net": 100},
        ]
        result = module.direction_stats(rows)
        self.assertEqual((result["long"]["wins"], result["long"]["count"]), (1, 3))
        self.assertEqual((result["short"]["wins"], result["short"]["count"]), (1, 3))
        self.assertEqual(result["long"]["rate"], 33.33)
        self.assertEqual(result["short"]["rate"], 33.33)
        self.assertEqual(result["unknown_count"], 1)
        self.assertIsNone(module.direction_stats([])["long"]["rate"])

    def test_distribution_membership_and_bar_geometry(self):
        rows = [{"net": -10, "rate": -1}, {"net": 20, "rate": 2}, {"net": 200, "rate": 20}]
        distribution = module.distribution_for(rows, "金额")
        self.assertEqual(sum(item["count"] for item in distribution), 3)
        self.assertEqual(module.distribution_max_count(distribution), 1)
        panel = module.distribution_panel(96, 100, 1080, distribution, selected="盈利 0–100")
        root = ElementTree.fromstring(f'<svg xmlns="http://www.w3.org/2000/svg">{panel.svg}</svg>')
        bars = root.findall(".//{http://www.w3.org/2000/svg}rect[@data-bar='distribution']")
        self.assertEqual(len(bars), 5)
        widths = [float(bar.attrib["width"]) for bar in bars]
        self.assertEqual(widths[2], 0.0)
        self.assertGreater(widths[1], 0.0)
        self.assertEqual(widths[1], widths[3])
        self.assertEqual(widths[1], widths[4])
        self.assertIn("回合数", panel.svg)
        self.assertIn("3 个有效回合", panel.svg)

    def test_trend_gap_direction_cards_use_filtered_denominator(self):
        rounds = module.derive_sim_rounds(FIXTURE)
        gap = FIXTURE["trend_modes"]["gap_scenario"]
        missing = {item["date"] for item in gap["dates"] if item["status"] == "missing"}
        selected = module.stats_for(
            [row for row in rounds if row["date"] not in missing], gap["start"], gap["end"]
        )
        self.assertEqual(selected["count"], 5)
        self.assertEqual(module.direction_stats(selected["rounds"])["long"]["count"], 5)
        svg = module.stats_frame(1440, 1000, FIXTURE, "trend-gap")
        self.assertIn(">可计算净盈亏<", svg)
        self.assertIn("做多胜率 · 5/5 样本", svg)
        self.assertNotIn("做多胜率 · 5/7 样本", svg)


if __name__ == "__main__":
    unittest.main()
