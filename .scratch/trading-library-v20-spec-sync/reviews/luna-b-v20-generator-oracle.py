#!/usr/bin/env python3
"""Targeted post-freeze counterexamples against the V2.0 generator.

This is an acceptance aid, not a replacement for the package test suite.  It
feeds the four previously hand-calculated cases through the current generator
functions so the remaining test-coverage gap is explicit.
"""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/generate-library-frames.py"
FIXTURE_PATH = SOURCE.parent / "library-design-fixture.json"

spec = importlib.util.spec_from_file_location("v20_generator_counterexample", SOURCE)
assert spec is not None and spec.loader is not None
generator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = generator
spec.loader.exec_module(generator)
fixture = json.loads(FIXTURE_PATH.read_text())


def trade(identifier: str, date: str, side: str, quantity: int, price: float, fee: float = 0.0) -> dict:
    return {
        "id": identifier,
        "date": date,
        "side": side,
        "quantity": quantity,
        "price": price,
        "fee": fee,
    }


def exercise(identifier: str, trades: list[dict], *, capital=None, valuation=None) -> dict:
    return {
        "id": identifier,
        "label": identifier,
        "symbol": "Oracle",
        "code": identifier,
        "trades": trades,
        "account_id": "oracle-account",
        "practice_date": "2026-10-01",
        "initial_capital": capital,
        "ending_valuation": valuation,
    }


def closed(identifier: str, amount: float, *, capital=None) -> dict:
    return exercise(
        identifier,
        [
            trade(f"{identifier}-open", "2026-10-01", "买入", 1, 100.0),
            trade(f"{identifier}-close", "2026-10-02", "卖出", 1, 100.0 + amount),
        ],
        capital=capital,
    )


def test_exact_live_action_vs_internal_pairs() -> None:
    result = generator.aggregate_live_actions(
        [
            trade("b100", "2026-10-01", "买入", 100, 100.0),
            trade("b50", "2026-10-02", "买入", 50, 110.0),
            trade("s80", "2026-10-03", "卖出", 80, 130.0),
            trade("s70", "2026-10-04", "卖出", 70, 140.0),
        ]
    )
    rounds = result["rounds"]
    assert len(rounds) == 2
    assert result["open_quantity"] == 0
    assert result["open_lots"] == []
    assert rounds[0]["quantity"] == 80
    assert rounds[0]["allocation_count"] == 2
    assert rounds[0]["open_ids"] == ["b50", "b100"]
    assert rounds[1]["quantity"] == 70
    assert rounds[1]["allocation_count"] == 1
    assert rounds[1]["open_ids"] == ["b100"]
    print("O-01 generator=PASS rounds=2 allocations=[2,1] residual=0")


def test_flat_and_all_unknown_denominators() -> None:
    samples = [
        closed("o03-win-60", 60.0),
        closed("o03-loss-20", -20.0),
        closed("o03-flat", 0.0),
        exercise("o03-unknown", [trade("o03-unknown-open", "2026-10-01", "买入", 1, 100.0)]),
        closed("o03-win-10", 10.0),
    ]
    summary = generator.stats_for_exercises([generator.summarize_exercise(item) for item in samples])
    assert (summary["count"], summary["calculable_count"], summary["unknown_count"]) == (5, 4, 1)
    assert (summary["wins"], summary["losses"], summary["net"], summary["win_rate"]) == (2, 1, 50.0, 50.0)
    flat_summary = generator.summarize_exercise(samples[2])
    assert flat_summary["net"] == 0.0
    assert flat_summary["pairs"][0]["net"] == 0.0
    all_unknown = generator.stats_for_exercises([generator.summarize_exercise(samples[3])])
    assert (all_unknown["count"], all_unknown["calculable_count"], all_unknown["unknown_count"]) == (1, 0, 1)
    assert all_unknown["win_rate"] is None
    assert all_unknown["net"] == 0
    print("O-03 generator=PASS flat_in_denominator=1 all_unknown_win_rate=None")


def test_amount_and_rate_denominators_are_independent() -> None:
    samples = [
        closed("o04-net-60", 60.0, capital=1000.0),
        closed("o04-net-40-no-capital", 40.0, capital=None),
        closed("o04-flat", 0.0, capital=1000.0),
        exercise("o04-unknown", [trade("o04-unknown-open", "2026-10-01", "买入", 1, 100.0)], capital=1000.0),
    ]
    summaries = [generator.summarize_exercise(item) for item in samples]
    stats = generator.stats_for_exercises(summaries)
    amount = generator.distribution_for_exercises(summaries, "金额")
    rate = generator.distribution_for_exercises(summaries, "收益率")
    assert (stats["count"], stats["calculable_count"], stats["unknown_count"]) == (4, 3, 1)
    assert stats["win_rate"] == 66.67
    assert stats["rate_count"] == 2
    assert sum(item["count"] for item in amount) == 3
    assert sum(item["count"] for item in rate) == 2
    assert generator.summarize_exercise(samples[1])["net"] == 40.0
    assert generator.summarize_exercise(samples[1])["rate"] is None
    print("O-04 generator=PASS overall_win_rate=66.67 amount_samples=3 rate_samples=2")


def test_valued_a_keeps_net_when_capital_is_missing_or_nonpositive() -> None:
    source_a = next(item for item in fixture["simulation_exercises"] if item["id"] == "practice-a-20261015-01")
    for capital in (None, 0, -100):
        valued = copy.deepcopy(source_a)
        valued["ending_valuation"] = 140
        valued["initial_capital"] = capital
        summary = generator.summarize_exercise(valued)
        assert (summary["realized_gross"], summary["floating"], summary["fees"], summary["net"]) == (1900.0, 2800.0, 23.0, 4677.0)
        assert summary["rate"] is None
    print("O-05/O-06 generator=PASS valued_net=4677 capital=None/0/-100 rate=None")


if __name__ == "__main__":
    test_exact_live_action_vs_internal_pairs()
    test_flat_and_all_unknown_denominators()
    test_amount_and_rate_denominators_are_independent()
    test_valued_a_keeps_net_when_capital_is_missing_or_nonpositive()
    print("GENERATOR_ORACLE_STATUS=PASS")
