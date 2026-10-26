from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET


HERE = Path(__file__).resolve().parent
REFERENCE = HERE.parents[1] / "2026-10-22-homepage-v2.5/source/images/home-1440.svg"
FIXTURE_PATH = HERE / "library-design-fixture.json"


def load_renderer():
    spec = importlib.util.spec_from_file_location("homepage_template", HERE / "homepage-template.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def load_generator():
    path = HERE / "generate-library-frames.py"
    spec = importlib.util.spec_from_file_location("library_frame_generator_for_home_test", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def sample_fixture() -> dict:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    fixture["live_trades"] = [
        {"id": "open-600519", "date": "2026-10-03", "symbol": "贵州茅台", "code": "600519", "side": "买入", "quantity": 100, "price": 1712.0, "fee": 8.56},
        {"id": "close-600519", "date": "2026-10-07", "symbol": "贵州茅台", "code": "600519", "side": "卖出", "quantity": 40, "price": 1735.0, "fee": 6.94},
        {"id": "open-688981", "date": "2026-10-15", "symbol": "中芯国际", "code": "688981", "side": "买入", "quantity": 80, "price": 92.0, "fee": 2.95},
    ]
    fixture["navigation"]["home"].update(start="2026-10-01", end="2026-10-15", period="本月")
    return fixture


def sample_valuation() -> dict:
    return {
        "as_of": "2026-10-15 15:00 Asia/Shanghai",
        "currency": "CNY",
        "positions": [
            {"date": "2026-10-03", "symbol": "贵州茅台", "code": "600519", "quantity": 60, "price": 1712.0, "fee": 5.14, "quote": 1740.0, "market_value": 104400.0, "floating": 1674.86},
            {"date": "2026-10-15", "symbol": "中芯国际", "code": "688981", "quantity": 80, "price": 92.0, "fee": 2.95, "quote": 94.0, "market_value": 7520.0, "floating": 157.05},
        ],
        "market_value": 111920.0,
        "floating": 1831.91,
        "realized": 747.14,
        "total": 2579.05,
        "points": [
            {"date": "2026-10-01", "cumulative": 0.0},
            {"date": "2026-10-02", "cumulative": 0.0},
            {"date": "2026-10-03", "cumulative": 297.14},
            {"date": "2026-10-04", "cumulative": -157.86},
            {"date": "2026-10-05", "cumulative": 847.14},
            {"date": "2026-10-07", "cumulative": 2547.14},
            {"date": "2026-10-08", "cumulative": 2347.14},
            {"date": "2026-10-09", "cumulative": 2457.14},
            {"date": "2026-10-12", "cumulative": 2479.05},
            {"date": "2026-10-15", "cumulative": 2579.05},
        ],
    }


def sample_stats() -> dict:
    rounds = [
        {"date": "2026-10-03", "net": 48.0, "fees": 2.0},
        {"date": "2026-10-05", "net": -52.0, "fees": 2.0},
        {"date": "2026-10-08", "net": 98.0, "fees": 4.0},
        {"date": "2026-10-12", "net": -7.0, "fees": 3.0},
        {"date": "2026-10-15", "net": 660.14, "fees": 11.86},
    ]
    return {
        "rounds": rounds,
        "points": [{"date": r["date"], "net": r["net"], "cumulative": sum(x["net"] for x in rounds[: i + 1])} for i, r in enumerate(rounds)],
        "count": 5,
        "wins": 3,
        "losses": 2,
        "net": 747.14,
        "fees": 22.86,
        "win_rate": 60.0,
        "average_profit": 268.71,
        "average_loss": -29.5,
    }


class HomepageTemplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.renderer = load_renderer()
        cls.fixture = sample_fixture()
        cls.valuation = sample_valuation()
        cls.stats = sample_stats()
        cls.source_hash = hashlib.sha256(REFERENCE.read_bytes()).hexdigest()

    def render(self, **kwargs):
        return self.renderer.render_home(REFERENCE, self.fixture, self.valuation, self.stats, **kwargs)

    def test_canonical_controls_geometry_and_titles_survive(self):
        source = ET.fromstring(REFERENCE.read_bytes())
        output = ET.fromstring(self.render())
        self.assertEqual(output.attrib["viewBox"], source.attrib["viewBox"])
        self.assertEqual(output.attrib["role"], "img")
        self.assertEqual(output.find("{http://www.w3.org/2000/svg}title").text, "首页全貌：当前表现、持仓、历史统计与底部贡献")
        source_controls = sorted((n.attrib.get("data-control") or "", n.attrib.get("role") or "") for n in source.iter() if n.attrib.get("data-control"))
        output_controls = sorted((n.attrib.get("data-control") or "", n.attrib.get("role") or "") for n in output.iter() if n.attrib.get("data-control"))
        self.assertEqual(output_controls, source_controls)
        self.assertEqual(len(list(source.iter("{http://www.w3.org/2000/svg}polyline"))), len(list(output.iter("{http://www.w3.org/2000/svg}polyline"))))
        self.assertEqual(len(list(source.iter("{http://www.w3.org/2000/svg}line"))), len(list(output.iter("{http://www.w3.org/2000/svg}line"))))
        self.assertIn('stroke="#283448"', self.render())
        self.assertNotIn('>12</text>', self.render())

    def test_fixture_data_is_bound_without_inventing_positions(self):
        rendered = self.render()
        self.assertIn("2,579.05", rendered)
        self.assertIn("747.14", rendered)
        self.assertIn("1,831.91", rendered)
        self.assertIn("11.19 万", rendered)
        self.assertIn("贵州茅台", rendered)
        self.assertIn("中芯国际", rendered)
        self.assertIn("当前样例共2个持仓", rendered)
        self.assertIn("1–2 / 2 项 · 估值 2026-10-15 15:00 · 覆盖 2/2 持仓", rendered)
        for stale in ("Cerebras Systems", "宁德时代", "恒生科技ETF", "Tesla, Inc.", "微软", "中证500ETF"):
            self.assertNotIn(stale, rendered)
        self.assertIn("5", rendered)
        self.assertIn("3 / 5 盈利回合", rendered)
        self.assertIn("22.86", rendered)
        out = ET.fromstring(rendered)
        chart_groups = [n for n in out.iter() if n.tag.endswith("g") and any(c.tag.endswith("polyline") for c in n)]
        self.assertTrue(chart_groups)
        self.assertEqual(len([n for n in chart_groups[0] if n.tag.endswith("circle")]), len(self.valuation["points"]))
        zero_paths = [n for n in out.iter() if n.tag.endswith("path") and n.attrib.get("stroke") == "#A8B6CB" and "M172" in n.attrib.get("d", "")]
        self.assertEqual(len(zero_paths), 1)
        zero_y = float(zero_paths[0].attrib["d"].split()[1])
        self.assertGreater(zero_y, 276.0)
        self.assertLess(zero_y, 496.0)
        future = next(n for n in out.iter() if n.attrib.get("data-state") == "future-zone")
        self.assertLessEqual(float(future.attrib["x"]) + float(future.attrib["width"]), 1296.0)

        action_rects = [
            node for node in out.iter()
            if node.tag.endswith("rect") and abs(float(node.attrib.get("x", "nan")) - 1343.36) < 0.01
        ]
        action_icons = [
            node for node in out.iter()
            if node.tag.endswith("svg") and abs(float(node.attrib.get("x", "nan")) - 1353.36) < 0.01
        ]
        self.assertEqual(len(action_rects), 2, "only the two real holdings may expose view hit areas")
        self.assertEqual(len(action_icons), 2, "empty holding rows must not expose document icons")

        trend_points = next(
            node for node in out.iter()
            if node.tag.endswith("polyline") and node.attrib.get("stroke") == "#6CA8FF"
        ).attrib["points"].split()
        expected_x = 172 + (1380 - 172) * (6 / 14)
        dated_circle = next(
            node for node in out.iter()
            if node.tag.endswith("circle") and any(
                child.tag.endswith("title") and "2026-10-07" in (child.text or "")
                for child in node
            )
        )
        self.assertAlmostEqual(float(dated_circle.attrib["cx"]), expected_x, places=2)
        self.assertAlmostEqual(float(trend_points[5].split(",")[0]), expected_x, places=2)
        dated_label = next(node for node in out.iter() if node.tag.endswith("text") and (node.text or "") == "10-07")
        self.assertAlmostEqual(float(dated_label.attrib["x"]), expected_x, places=2)
        dated_grid = next(
            node for node in out.iter()
            if node.tag.endswith("path") and abs(float(node.attrib.get("d", "").split()[0][1:]) - expected_x) < 0.01
        )
        self.assertAlmostEqual(float(dated_grid.attrib["d"].split()[0][1:]), expected_x, places=2)
        final_circle = next(
            node for node in out.iter()
            if node.tag.endswith("circle") and any(
                child.tag.endswith("title") and "2026-10-15" in (child.text or "")
                for child in node
            )
        )
        self.assertAlmostEqual(float(final_circle.attrib["cx"]), 1380.0, places=2)

    def test_source_dependent_style_and_geometry_are_consumed(self):
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "reference.svg"
            text = REFERENCE.read_text(encoding="utf-8")
            text = text.replace('M172 276.0 L1380 276.0" fill="none" stroke="#283448"', 'M172 276.0 L1380 276.0" fill="none" stroke="#FF00AA"', 1)
            copy.write_text(text, encoding="utf-8")
            rendered = self.renderer.render_home(copy, self.fixture, self.valuation, self.stats)
            self.assertIn("#FF00AA", rendered)
            self.assertIn('M172 276.0 L1380 276.0', rendered)

    def test_real_generator_shapes_bind_without_test_only_timestamp(self):
        generator = load_generator()
        fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        valuation = generator.home_valuation(fixture)
        stats = generator.stats_for(generator.derive_live_rounds(fixture))
        rendered = self.renderer.render_home(REFERENCE, fixture, valuation, stats)
        self.assertIn("11.19 万", rendered)
        self.assertIn("2026-10-15 15:00", rendered)
        self.assertIn("5 回合", rendered)
        self.assertIn("2/2 持仓", rendered)

    def test_missing_expected_node_fails_loudly_and_focus_is_only_focus_difference(self):
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / "missing.svg"
            copy.write_text(REFERENCE.read_text(encoding="utf-8").replace(">当前表现</text>", ">当前表现缺失</text>", 1), encoding="utf-8")
            with self.assertRaises(ValueError):
                self.renderer.render_home(copy, self.fixture, self.valuation, self.stats)
        normal = self.render()
        focused = self.render(focus=True)
        self.assertNotEqual(normal, focused)
        self.assertIn('x="8" y="137"', focused)
        self.assertIn('stroke="#6CA8FF"', focused)
        self.assertIn('x="8" y="73" width="56" height="56" rx="8" fill="#162233"', focused)
        self.assertEqual(hashlib.sha256(REFERENCE.read_bytes()).hexdigest(), self.source_hash)


if __name__ == "__main__":
    unittest.main()
