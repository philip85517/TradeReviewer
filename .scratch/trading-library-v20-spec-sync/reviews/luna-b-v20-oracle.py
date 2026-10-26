#!/usr/bin/env python3
"""Independent hand oracle for the V2.0 sample-number contracts.

This script intentionally does not import the V2.0 generator.  Its inputs and
calculations are the small counterexamples used by the review of F08-F10.
"""
from collections import defaultdict


# O-01: one live sell action consumes two buys, then a second sell consumes the
# remaining lot.  Technical allocations and human actions have different units.
trades = [
    {"id": "b100", "side": "buy", "quantity": 100, "price": 100.0, "fee": 10.0},
    {"id": "b50", "side": "buy", "quantity": 50, "price": 110.0, "fee": 5.0},
    {"id": "s80", "side": "sell", "quantity": 80, "price": 130.0, "fee": 8.0},
    {"id": "s70", "side": "sell", "quantity": 70, "price": 140.0, "fee": 7.0},
]
open_lots = []
allocations = []
for trade in trades:
    if trade["side"] == "buy":
        open_lots.append({**trade, "original_quantity": trade["quantity"]})
        continue
    remaining = trade["quantity"]
    while remaining:
        lot = open_lots[-1]
        quantity = min(remaining, lot["quantity"])
        buy_fee = lot["fee"] * quantity / lot["original_quantity"]
        sell_fee = trade["fee"] * quantity / trade["quantity"]
        gross = (trade["price"] - lot["price"]) * quantity
        allocations.append((quantity, lot["id"], trade["id"], round(gross - buy_fee - sell_fee, 2)))
        remaining -= quantity
        lot["quantity"] -= quantity
        if not lot["quantity"]:
            open_lots.pop()
by_action = defaultdict(list)
for allocation in allocations:
    by_action[allocation[2]].append(allocation)
human_actions = [
    (action, sum(row[0] for row in rows), len(rows), round(sum(row[3] for row in rows), 2))
    for action, rows in by_action.items()
]
assert allocations == [
    (50, "b50", "s80", 990.0),
    (30, "b100", "s80", 894.0),
    (70, "b100", "s70", 2786.0),
]
assert human_actions == [("s80", 80, 2, 1884.0), ("s70", 70, 1, 2786.0)]
assert sum(lot["quantity"] for lot in open_lots) == 0
print("O-01 raw_allocations=", allocations)
print("O-01 human_actions=", human_actions, "open=", sum(lot["quantity"] for lot in open_lots))


# O-03: simulation totals keep unknown and flat samples visible while the
# amount win rate uses calculable samples as its denominator.
nets = [60.0, -20.0, 0.0, None, 10.0]
calculable = [net for net in nets if net is not None]
summary = {
    "count": len(nets),
    "calculable_count": len(calculable),
    "unknown_count": len(nets) - len(calculable),
    "wins": sum(net > 0 for net in calculable),
    "losses": sum(net < 0 for net in calculable),
    "net": sum(calculable),
    "win_rate": round(sum(net > 0 for net in calculable) / len(calculable) * 100, 2),
    "flat": sum(net == 0 for net in calculable),
}
assert summary == {
    "count": 5,
    "calculable_count": 4,
    "unknown_count": 1,
    "wins": 2,
    "losses": 1,
    "net": 50.0,
    "win_rate": 50.0,
    "flat": 1,
}
print("O-03 summary=", summary)


# O-04: the overall practice win rate remains 2/3.  Return-rate bins use the
# separate two-row rate sample and must not replace the overall denominator.
rows = [
    {"net": 60.0, "rate": 6.0},
    {"net": 40.0, "rate": None},
    {"net": 0.0, "rate": 0.0},
    {"net": None, "rate": None},
]
calculable_rows = [row for row in rows if row["net"] is not None]
rates = [row["rate"] for row in calculable_rows if row["rate"] is not None]
overall_win_rate = round(sum(row["net"] > 0 for row in calculable_rows) / len(calculable_rows) * 100, 2)
assert overall_win_rate == 66.67 and len(rates) == 2
amount_rules = [
    ("亏损 > 100", lambda value: value < -100),
    ("亏损 0–100", lambda value: -100 <= value < 0),
    ("持平", lambda value: value == 0),
    ("盈利 0–100", lambda value: 0 < value <= 100),
    ("盈利 > 100", lambda value: value > 100),
]
rate_rules = [
    ("亏损 > 5%", lambda value: value < -5),
    ("亏损 0–5%", lambda value: -5 <= value < 0),
    ("持平", lambda value: value == 0),
    ("盈利 0–5%", lambda value: 0 < value <= 5),
    ("盈利 > 5%", lambda value: value > 5),
]


def bin_counts(values, rules):
    denominator = len(values)
    return [
        (label, sum(predicate(value) for value in values), round(sum(predicate(value) for value in values) / denominator * 100, 2) if denominator else 0.0)
        for label, predicate in rules
    ]


amount_counts = bin_counts([row["net"] for row in calculable_rows], amount_rules)
rate_counts = bin_counts(rates, rate_rules)
assert amount_counts == [
    ("亏损 > 100", 0, 0.0),
    ("亏损 0–100", 0, 0.0),
    ("持平", 1, 33.33),
    ("盈利 0–100", 2, 66.67),
    ("盈利 > 100", 0, 0.0),
]
assert rate_counts == [
    ("亏损 > 5%", 0, 0.0),
    ("亏损 0–5%", 0, 0.0),
    ("持平", 1, 50.0),
    ("盈利 0–5%", 0, 0.0),
    ("盈利 > 5%", 1, 50.0),
]
print("O-04 summary=", {"count": 4, "calculable_count": 3, "unknown_count": 1, "wins": 2, "win_rate": overall_win_rate, "rate_count": len(rates)})
print("O-04 amount_counts=", amount_counts)
print("O-04 rate_counts=", rate_counts)


# O-05/O-06: the residual is valued gross, and the original trade fees are
# subtracted once.  Capital gates return rate only; it does not gate net.
realized_gross = 50 * (130 - 110) + 30 * (130 - 100)
floating = 70 * (140 - 100)
fees = 10 + 5 + 8
unknown_net = None
valued_net = realized_gross + floating - fees
assert (unknown_net, realized_gross, floating, fees, valued_net) == (None, 1900.0, 2800.0, 23.0, 4677.0)
print("O-05 A=", {"unknown_net": unknown_net, "realized_gross": realized_gross, "floating": floating, "fees": fees, "valued_net": valued_net})
for capital in (None, 0, -100):
    rate = None if capital is None or capital <= 0 else valued_net / capital * 100
    assert valued_net == 4677.0 and rate is None
    print("O-06 capital=", capital, "net=", valued_net, "rate=", rate)
print("ORACLE_STATUS=PASS")
