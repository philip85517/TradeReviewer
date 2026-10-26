#!/usr/bin/env python3
"""Focused V2.0 contracts for exercise identity, metrics, and live actions."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from xml.etree import ElementTree


SOURCE = Path(__file__).with_name("generate-library-frames.py")
spec = importlib.util.spec_from_file_location("library_frames_v20", SOURCE)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
assert spec.loader is not None
spec.loader.exec_module(module)
FIXTURE = json.loads((SOURCE.parent / "library-design-fixture.json").read_text())


class MetricsContractTest(unittest.TestCase):
    def test_simulation_summary_uses_exercises_and_keeps_unknown_residual(self):
        summaries = module.derive_sim_exercises(FIXTURE)
        result = module.stats_for_exercises(summaries)
        self.assertEqual((result["count"], result["calculable_count"], result["unknown_count"]), (6, 5, 1))
        self.assertEqual(result["net"], 388.0)
        self.assertEqual(result["win_rate"], 60.0)
        by_id = {row["id"]: row["net"] for row in summaries}
        self.assertEqual([by_id[f"practice-{letter.lower()}-{date}-01" if letter != "E" else "practice-e-20261015-02"] for letter, date in (("B", "20261018"), ("C", "20261016"), ("D", "20261017"), ("E", "20261015"), ("F", "20261019"))], [-104.0, 354.0, -78.0, 98.0, 118.0])
        a = next(row for row in summaries if row["id"].startswith("practice-a"))
        self.assertEqual((a["pair_count"], a["open_quantity"], a["realized_gross"], a["fees"]), (2, 70, 1900.0, 23.0))
        self.assertIsNone(a["net"])
        self.assertIsNone(a["rate"])
        valued_a = module.summarize_exercise({**next(item for item in FIXTURE["simulation_exercises"] if item["id"].startswith("practice-a")), "ending_valuation": 140})
        self.assertEqual(valued_a["floating"], 2800.0)
        self.assertEqual(valued_a["net"], 4677.0)

    def test_simulation_svg_exposes_sample_denominators_and_no_direction_cards(self):
        svg = module.stats_frame(1440, 1000, FIXTURE, "simulation-stats")
        ElementTree.fromstring(svg)
        self.assertIn("练习总数", svg)
        self.assertIn("可计算样本", svg)
        self.assertIn("收益率样本", svg)
        self.assertIn("388.00", svg)
        self.assertIn("60.00%", svg)
        self.assertIn("残余估值未知不进入分布", svg)
        self.assertNotIn("做多胜率", svg)
        self.assertNotIn("做空胜率", svg)
        self.assertNotIn("练习保存日期", svg)

    def test_missing_inputs_keep_exercises_and_mark_unknowns(self):
        missing = module.stats_frame(1440, 1000, FIXTURE, "missing")
        gap = module.stats_frame(1440, 1000, FIXTURE, "trend-gap")
        for svg, calculable, unknown, total in ((missing, "4", "2", "6"), (gap, "3", "3", "6")):
            ElementTree.fromstring(svg)
            self.assertIn(f">{total}<", svg)
            self.assertIn(f"可计算样本（未知 {unknown}）", svg)
            self.assertIn(f"当前范围 · {calculable} 个可计算练习", svg)
        self.assertIn("补充平仓费用后重新计算", missing)
        self.assertIn("文件读取失败", gap)

    def test_net_and_trend_colors_follow_value_sign(self):
        cards = module.metric_cards(0, 0, 600, [
            ("累计净盈亏", module.fmt(-104)),
            ("平均盈利", module.fmt(0)),
            ("平均亏损", module.fmt(None)),
        ])
        self.assertIn(f'fill="{module.COLORS["negative"]}"', cards)
        self.assertIn(f'fill="{module.COLORS["text"]}"', cards)
        trend = module.trend_card(0, 0, 600, 260, "趋势", "按练习日期 · 日", [
            {"date": "2026-10-01", "cumulative": -104.0},
            {"date": "2026-10-02", "cumulative": 0.0},
            {"date": "2026-10-03", "cumulative": 98.0},
        ], simulation=True)
        self.assertIn(f'fill="{module.COLORS["negative"]}"', trend.svg)
        self.assertIn(f'fill="{module.COLORS["muted"]}"', trend.svg)
        self.assertIn(f'fill="{module.COLORS["positive"]}"', trend.svg)

    def test_live_one_sell_to_many_buys_is_one_round(self):
        trades = [
            {"id": "open-1", "date": "2026-10-01", "side": "买入", "quantity": 50, "price": 10.0, "fee": 1.0},
            {"id": "open-2", "date": "2026-10-02", "side": "买入", "quantity": 50, "price": 12.0, "fee": 1.0},
            {"id": "close-1", "date": "2026-10-03", "side": "卖出", "quantity": 80, "price": 14.0, "fee": 2.0},
            {"id": "close-2", "date": "2026-10-04", "side": "卖出", "quantity": 20, "price": 13.0, "fee": 1.0},
        ]
        result = module.aggregate_live_actions(trades)
        self.assertEqual([r["quantity"] for r in result["rounds"]], [80, 20])
        self.assertEqual(result["rounds"][0]["allocation_count"], 2)
        self.assertEqual(result["rounds"][0]["open_ids"], ["open-2", "open-1"])

        split_fills = [
            {"id": "open", "date": "2026-10-01", "side": "买入", "quantity": 100, "price": 10.0, "fee": 1.0},
            {"id": "fill-a", "date": "2026-10-02", "side": "卖出", "quantity": 40, "price": 12.0, "fee": 1.0, "human_action_id": "human-1"},
            {"id": "fill-b", "date": "2026-10-02", "side": "卖出", "quantity": 40, "price": 12.1, "fee": 1.0, "human_action_id": "human-1"},
        ]
        split_result = module.aggregate_live_actions(split_fills)
        self.assertEqual(len(split_result["rounds"]), 1)
        self.assertEqual(split_result["rounds"][0]["quantity"], 80)
        self.assertEqual(split_result["rounds"][0]["close_ids"], ["fill-a", "fill-b"])

    def test_trend_month_year_and_empty_use_simulation_semantics(self):
        for kind in ("trend-month", "trend-year", "trend-empty", "empty"):
            svg = module.stats_frame(1440, 1000, FIXTURE, kind)
            ElementTree.fromstring(svg)
            self.assertIn("模拟盘统计", svg)
            self.assertIn("练习", svg)
            self.assertNotIn("按保存日期", svg)

    def test_distribution_uses_calculable_exercise_denominator(self):
        summaries = module.derive_sim_exercises(FIXTURE)
        distribution = module.distribution_for_exercises(summaries, "金额")
        self.assertEqual(sum(item["count"] for item in distribution), 5)
        panel = module.distribution_panel(96, 100, 1080, distribution, unit="练习", denominator=5)
        root = ElementTree.fromstring(f'<svg xmlns="http://www.w3.org/2000/svg">{panel.svg}</svg>')
        self.assertEqual(len(root.findall(".//{http://www.w3.org/2000/svg}rect[@data-bar='distribution']")), 5)
        self.assertIn("5 个可计算练习", panel.svg)

    def test_live_list_uses_navigation_page_size_for_pagination(self):
        svg = module.list_frame(1280, 800, FIXTURE, "live-list")
        self.assertIn(">1 / 2<", svg)
        for day in ("2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-07"):
            self.assertIn(f">{day}<", svg)
        self.assertNotIn(">2026-10-08<", svg)


if __name__ == "__main__":
    unittest.main()
