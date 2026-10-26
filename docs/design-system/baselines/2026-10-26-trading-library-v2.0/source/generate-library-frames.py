#!/usr/bin/env python3
"""Generate the Trading Library V2.0 design sample frames.

The generator deliberately keeps the page shell in one place. Frames are
static design evidence; the fixture is labelled as sample data and is not a
claim about the business database.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from datetime import date
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent
IMAGE_DIR = ROOT / "images"
FIXTURE_PATH = ROOT / "library-design-fixture.json"

COLORS = {
    "bg": "#0B1019", "sidebar": "#0E1622", "sidebar_active": "#1C2B42", "chrome": "#0B1019",
    "surface": "#111A26", "nav": "#111A26", "raised": "#162233",
    "border": "#283448", "text": "#E6EDF7", "muted": "#A8B6CB",
    "subtle": "#71829B", "blue": "#6CA8FF", "positive": "#53D7A0",
    "negative": "#FF8592", "warning": "#FFC66D"
}

LIVE_THEME = dict(COLORS)
SIM_THEME = {
    **LIVE_THEME,
    "surface": "#162332",
    "nav": "#111E2C",
    "raised": "#243B5C",
    "border": "#40566D",
}


def set_theme(simulation: bool) -> None:
    """Use the approved E simulation surface while retaining site-wide tokens."""
    COLORS.clear()
    COLORS.update(SIM_THEME if simulation else LIVE_THEME)
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"


def esc(value: object) -> str:
    return (str(value).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def text(x: float, y: float, value: object, size: int = 14, fill: str = "text",
         weight: int = 400, anchor: str = "start", cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return (f'<text x="{x:g}" y="{y:g}" font-size="{size}" fill="{COLORS[fill]}" '
            f'font-weight="{weight}" text-anchor="{anchor}"{c}>{esc(value)}'
            +(f'<title>{value.full_amount:,.2f} CNY</title>' if hasattr(value,'full_amount') else '')+'</text>')


def rect(x: float, y: float, w: float, h: float, fill: str = "surface",
         stroke: str = "border", radius: int = 8) -> str:
    return (f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{radius}" '
            f'fill="{COLORS[fill]}" stroke="{COLORS[stroke]}"/>')


def line(x1: float, y1: float, x2: float, y2: float, stroke: str = "border",
         width: int = 1, dash: str = "") -> str:
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" stroke="{COLORS[stroke]}" stroke-width="{width}"{d}/>'


def icon_calendar(x: float, y: float) -> str:
    return (f'<svg x="{x:g}" y="{y:g}" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
            f'<path d="M5 4h14v16H5zM8 2v4M16 2v4M5 9h14" fill="none" stroke="{COLORS["text"]}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def icon_search(x: float, y: float) -> str:
    return (f'<svg x="{x:g}" y="{y:g}" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">'
            f'<circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="{COLORS["muted"]}" stroke-width="1.7"/><path d="m15 15 4.5 4.5" fill="none" stroke="{COLORS["muted"]}" stroke-width="1.7" stroke-linecap="round"/></svg>')


def icon_refresh(x: float, y: float) -> str:
    return (f'<svg x="{x:g}" y="{y:g}" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
            f'<path d="M20 11a8 8 0 0 0-14.7-4L3 10m0-4v4h4M4 13a8 8 0 0 0 14.7 4L21 14m0 4v-4h-4" fill="none" stroke="{COLORS["text"]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def icon_help(x: float, y: float, label: str) -> str:
    """A 36px accessible hit area; the SVG title is the static tooltip contract."""
    return (f'<svg x="{x:g}" y="{y:g}" width="36" height="36" viewBox="0 0 36 36" role="img" aria-label="{esc(label)}">'
            f'<title>{esc(label)}</title><circle cx="18" cy="18" r="7" fill="none" stroke="{COLORS["muted"]}" stroke-width="1.5"/>'
            f'<path d="M18 17.2v6.1M18 14.8v.2" fill="none" stroke="{COLORS["muted"]}" stroke-width="1.5" stroke-linecap="round"/></svg>')


def sidebar(h: int, active: str = "交易库", focus: str | None = None) -> str:
    # Keep the shared shell's five navigation destinations and icon slots. The
    # library frame has no pending-review badge; that queue is an explicit
    # in-library filter, never a home navigation default.
    items = [
        ("M3 10L12 3l9 7M5 9v12h5v-7h4v7h5V9", "首页"),
        ("M5 3h14v18H5zM8 7h8M8 11h8M8 15h5", "交易库"),
        ("M3 3v18h18M6 16l5-6 4 3 6-8", "分析"),
        ("M3 6c0-4 18-4 18 0v12c0 4-18 4-18 0zM3 6c0 4 18 4 18 0M3 12c0 4 18 4 18 0", "数据"),
        ("M6 3v18M6 7h8a4 4 0 0 1 4 4v6M15 14l3 3 3-3", "策略"),
    ]
    out = [f'<rect x="0" y="0" width="72" height="{h}" fill="{COLORS["sidebar"]}"/>',
           text(36, 35, "TR", 20, "blue", 700, "middle")]
    for i, (path, label) in enumerate(items):
        y = 73 + i * 64
        if label == active:
            out.append(f'<rect x="8" y="{y:g}" width="56" height="56" rx="8" fill="{COLORS["sidebar_active"]}"/>')
        elif label == focus:
            out.append(f'<rect x="8" y="{y:g}" width="56" height="56" rx="8" fill="none" stroke="{COLORS["blue"]}" stroke-width="2"/>')
        icon_color = COLORS["blue"] if label == active else COLORS["muted"]
        out.extend([
            f'<svg x="24" y="{y + 5:g}" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="{path}" fill="none" stroke="{icon_color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            text(36, y + 48, label, 12, "blue" if label == active else "muted", 400, "middle")
        ])
    return "".join(out)


def header(w: int, title: str = "交易库") -> str:
    return (f'<rect x="72" y="0" width="{w - 72}" height="64" fill="{COLORS["chrome"]}" stroke="{COLORS["border"]}"/>'
            + text(96, 39, title, 24, "text", 700))


def control(x: float, y: float, w: float, label: str, value: str, kind: str = "input") -> str:
    out = [text(x, y - 9, label, 12, "muted"), rect(x, y, w, 36, "surface")]
    if kind == "date":
        out.append(icon_calendar(x + 12, y + 10))
        out.append(text(x + 36, y + 23, value, 14, "text"))
    elif kind == "search":
        out.append(icon_search(x + 12, y + 9))
        out.append(text(x + 40, y + 23, value, 14, "muted"))
    else:
        out.append(text(x + 12, y + 23, value, 14, "text"))
        out.append(text(x + w - 14, y + 23, "⌄", 14, "muted", 600, "end"))
    return "".join(out)


class FormattedAmount(str):
    def __new__(cls, value, full_amount):
        result=super().__new__(cls,value);result.full_amount=full_amount;return result


def fmt(v: float | int | None) -> str:
    if v is None:
        return "—"
    return FormattedAmount(f"{v / 100000000:.2f} 亿" if abs(v) >= 100000000 else f"{v / 10000:.2f} 万" if abs(v) >= 10000 else f"{v:,.2f}",v)


def lifo_rounds(exercise: dict) -> dict:
    inventory = []
    rounds = []
    for trade in exercise["trades"]:
        if trade["side"] == "买入":
            inventory.append({"id": trade.get("id"), "date": trade.get("date"), "quantity": trade["quantity"], "price": trade["price"], "fee": trade["fee"]})
            continue
        remaining = trade["quantity"]
        remaining_exit_quantity = trade["quantity"]
        remaining_exit_fee = trade["fee"]
        while remaining and inventory:
            opening = inventory[-1]
            quantity = min(remaining, opening["quantity"])
            opening_fee = opening["fee"] * quantity / opening["quantity"]
            closing_fee = remaining_exit_fee * quantity / remaining_exit_quantity
            gross = (trade["price"] - opening["price"]) * quantity
            cost = opening["price"] * quantity + opening_fee
            rounds.append({
                "open_id": opening["id"], "close_id": trade.get("id"),
                "open_date": opening.get("date"), "close_date": trade.get("date"),
                # The matcher currently models buy-then-sell pairs only. Keep
                # that fact explicit so direction metrics never infer short
                # from the closing sell.
                "direction": "long",
                "quantity": quantity, "open_price": opening["price"], "close_price": trade["price"],
                "gross": round(gross, 2), "opening_fee": round(opening_fee, 2),
                "closing_fee": round(closing_fee, 2), "fees": round(opening_fee + closing_fee, 2),
                "cost": round(cost, 2), "net": round(gross - opening_fee - closing_fee, 2),
            })
            rounds[-1]["rate"] = round(rounds[-1]["net"] / cost * 100, 4) if cost else 0
            opening["quantity"] -= quantity
            opening["fee"] -= opening_fee
            remaining -= quantity
            remaining_exit_quantity -= quantity
            remaining_exit_fee -= closing_fee
            if opening["quantity"] == 0:
                inventory.pop()
    return {
        "rounds": rounds,
        "closed_fees": round(sum(x["fees"] for x in rounds), 2),
        "open_fees": round(sum(x["fee"] for x in inventory), 2),
        "open_quantity": sum(x["quantity"] for x in inventory),
        "open_lots": inventory,
    }


def aggregate_live_actions(trades: list[dict]) -> dict:
    """Return one live round per human close action.

    ``lifo_rounds`` intentionally remains the small internal allocation
    matcher used by the fixture.  A fixture sell row is one action unless
    several technical sell fills carry the same explicit ``human_action_id``;
    allocations from those fills are then rendered as one human round.  The
    fixture does not claim that this is the production action recognition
    algorithm.
    """
    ordered = sorted(trades, key=lambda x: (x.get("date", ""), x.get("id", "")))
    result = lifo_rounds({"trades": ordered})
    grouped: dict[str, list[dict]] = {}
    for allocation in result["rounds"]:
        grouped.setdefault(allocation["close_id"], []).append(allocation)
    trade_by_id = {trade.get("id"): trade for trade in ordered}
    action_groups: dict[str, list[dict]] = {}
    for trade in (t for t in ordered if t["side"] == "卖出"):
        # One row is the fixture's default human action. Tests can provide
        # human_action_id to model multiple technical fills of one action.
        key = str(trade.get("human_action_id") or f"trade:{trade.get('id')}")
        action_groups.setdefault(key, []).append(trade)
    actions = []
    for index, (action_key, close_trades) in enumerate(action_groups.items(), 1):
        allocations = [allocation for trade in close_trades for allocation in grouped.get(trade.get("id"), [])]
        if not allocations:
            continue
        quantity = sum(row["quantity"] for row in allocations)
        close_price = round(sum(trade_by_id[row["close_id"]]["price"] * row["quantity"] for row in allocations) / quantity, 4)
        actions.append({
            "round_id": f"action-{action_key}",
            "close_id": close_trades[0].get("id"),
            "close_ids": [trade.get("id") for trade in close_trades],
            "open_id": allocations[0]["open_id"],
            "open_ids": [row["open_id"] for row in allocations],
            "allocation_count": len(allocations),
            "open_date": min(row["open_date"] for row in allocations),
            "close_date": max(trade.get("date") for trade in close_trades),
            "date": max(trade.get("date") for trade in close_trades),
            "direction": "long",
            "quantity": quantity,
            "open_price": round(sum(row["open_price"] * row["quantity"] for row in allocations) / sum(row["quantity"] for row in allocations), 4),
            "close_price": close_price,
            "gross": round(sum(row["gross"] for row in allocations), 2),
            "opening_fee": round(sum(row["opening_fee"] for row in allocations), 2),
            "closing_fee": round(sum(row["closing_fee"] for row in allocations), 2),
            "fees": round(sum(row["fees"] for row in allocations), 2),
            "cost": round(sum(row["cost"] for row in allocations), 2),
            "net": round(sum(row["net"] for row in allocations), 2),
            "allocations": allocations,
            "scope": "live",
        })
    for row in actions:
        row["rate"] = round(row["net"] / row["cost"] * 100, 4) if row["cost"] else None
    return {**result, "rounds": actions}


def derive_live_rounds(fixture: dict) -> list[dict]:
    by_symbol = {}
    rounds = []
    for trade in fixture["live_trades"]:
        by_symbol.setdefault(trade["code"], {"id": trade["code"], "trades": [], "symbol": trade["symbol"], "code": trade["code"]})["trades"].append(trade)
    for item in by_symbol.values():
        result = aggregate_live_actions(item["trades"])
        for i, closed in enumerate(result["rounds"], 1):
            rounds.append({**closed, "round_id": f"{item['code']}-{i}", "symbol": item["symbol"], "code": item["code"], "date": closed["close_date"], "scope": "live"})
    return sorted(rounds, key=lambda x: (x["date"], x["code"], x["round_id"]))


def derive_live_positions(fixture: dict) -> list[dict]:
    positions = []
    by_symbol = {}
    for trade in fixture["live_trades"]:
        by_symbol.setdefault(trade["code"], {"trades": [], "symbol": trade["symbol"], "code": trade["code"]})["trades"].append(trade)
    for item in by_symbol.values():
        result = lifo_rounds({"trades": sorted(item["trades"], key=lambda x: x["date"])})
        for lot in result["open_lots"]:
            positions.append({"id": lot["id"], "date": lot["date"], "symbol": item["symbol"], "code": item["code"], "quantity": lot["quantity"], "price": lot["price"], "fee": lot["fee"]})
    return sorted(positions, key=lambda x: x["date"])


def derive_sim_rounds(fixture: dict) -> list[dict]:
    rounds = []
    for exercise in fixture["simulation_exercises"]:
        result = lifo_rounds(exercise)
        for i, row in enumerate(result["rounds"], 1):
            rounds.append({**row, "round_id": f"{exercise['id']}-{i}", "exercise_id": exercise["id"], "exercise": exercise["label"], "symbol": exercise["symbol"], "code": exercise["code"], "date": exercise["practice_date"], "scope": "simulation"})
    return sorted(rounds, key=lambda x: (x["date"], x["exercise_id"], x["round_id"]))


def summarize_exercise(exercise: dict) -> dict:
    """Summarize one imported practice file as one statistical sample.

    Internal pairs are retained for details, but they never become summary
    samples.  Residual lots need an explicit ending valuation; otherwise the
    exercise net and return remain unknown.
    """
    result = lifo_rounds(exercise)
    pairs = result["rounds"]
    fees = round(sum(float(t.get("fee", 0) or 0) for t in exercise.get("trades", [])), 2)
    realized_gross = round(sum(row["gross"] for row in pairs), 2)
    residual = result["open_quantity"]
    valuation = exercise.get("ending_valuation")
    floating = None
    if not residual:
        floating = 0.0
    elif valuation is not None:
        # Fees are charged once below from the original trade rows. Keep the
        # residual floating component gross so an explicit valuation of 140
        # for A is 1900 + 2800 - 23 = 4677, not 4670.
        floating = round(sum((valuation - lot["price"]) * lot["quantity"] for lot in result["open_lots"]), 2)
    net = None if floating is None else round(realized_gross + floating - fees, 2)
    capital = exercise.get("initial_capital")
    rate = round(net / capital * 100, 4) if net is not None and capital is not None and capital > 0 else None
    return {
        "id": exercise["id"], "exercise_id": exercise["id"], "exercise": exercise["label"],
        "display_name": exercise.get("display_name", exercise["label"]), "account_id": exercise.get("account_id"),
        "symbol": exercise["symbol"], "code": exercise["code"], "date": exercise["practice_date"],
        "practice_date": exercise["practice_date"], "history_start": exercise.get("history_start"),
        "history_end": exercise.get("history_end"), "imported_at": exercise.get("imported_at"),
        "trade_count": len(exercise.get("trades", [])), "pair_count": len(pairs), "pairs": pairs,
        "rounds": pairs, "open_quantity": residual, "open_lots": result["open_lots"],
        "fees": fees, "closed_fees": result["closed_fees"], "open_fees": result["open_fees"],
        "realized_gross": realized_gross, "floating": floating, "net": net, "rate": rate,
        "initial_capital": capital, "calculable": net is not None, "scope": "simulation",
    }


def derive_sim_exercises(fixture: dict) -> list[dict]:
    return sorted((summarize_exercise(exercise) for exercise in fixture["simulation_exercises"]), key=lambda x: (x["practice_date"], x["id"]))


def date_between(value: str, start: str, end: str) -> bool:
    return start <= value <= end


def stats_for(rounds: list[dict], start: str | None = None, end: str | None = None) -> dict:
    selected = [r for r in rounds if start is None or date_between(r["date"], start, end)]
    daily = {}
    for row in selected:
        daily.setdefault(row["date"], 0.0)
        daily[row["date"]] += row["net"]
    points = []
    cumulative = 0.0
    for day in sorted(daily):
        cumulative += daily[day]
        points.append({"date": day, "net": round(daily[day], 2), "cumulative": round(cumulative, 2)})
    wins = [r["net"] for r in selected if r["net"] > 0]
    losses = [r["net"] for r in selected if r["net"] < 0]
    return {"rounds": selected, "points": points, "count": len(selected), "wins": len(wins), "losses": len(losses), "net": round(sum(r["net"] for r in selected), 2), "fees": round(sum(r["fees"] for r in selected), 2), "win_rate": round(len(wins) / len(selected) * 100, 2) if selected else None, "average_profit": round(sum(wins) / len(wins), 2) if wins else None, "average_loss": round(sum(losses) / len(losses), 2) if losses else None}


def stats_for_exercises(exercises: list[dict], start: str | None = None, end: str | None = None) -> dict:
    selected = [e for e in exercises if start is None or date_between(e["practice_date"], start, end)]
    calculable = [e for e in selected if e["net"] is not None]
    wins = [e["net"] for e in calculable if e["net"] > 0]
    losses = [e["net"] for e in calculable if e["net"] < 0]
    daily: dict[str, float] = {}
    for row in calculable:
        daily.setdefault(row["practice_date"], 0.0)
        daily[row["practice_date"]] += row["net"]
    points = []
    cumulative = 0.0
    for day in sorted(daily):
        cumulative += daily[day]
        points.append({"date": day, "net": round(daily[day], 2), "cumulative": round(cumulative, 2)})
    rates = [e["rate"] for e in calculable if e["rate"] is not None]
    return {
        "exercises": selected, "rounds": calculable, "points": points,
        "count": len(selected), "calculable_count": len(calculable), "unknown_count": len(selected) - len(calculable),
        "wins": len(wins), "losses": len(losses), "net": round(sum(e["net"] for e in calculable), 2),
        "fees": round(sum(e["fees"] for e in selected if e.get("fees") is not None), 2), "win_rate": round(len(wins) / len(calculable) * 100, 2) if calculable else None,
        "average_profit": round(sum(wins) / len(wins), 2) if wins else None,
        "average_loss": round(sum(losses) / len(losses), 2) if losses else None,
        "rate_count": len(rates), "average_rate": round(sum(rates) / len(rates), 4) if rates else None,
    }


def direction_stats(rounds: list[dict]) -> dict:
    """Summarize explicit long/short samples without guessing direction.

    A breakeven row remains in its direction's denominator, while only a
    strictly positive net is a win. Rows with any other direction are kept in
    an explicit unknown count and do not affect either rate.
    """
    result = {}
    unknown_count = 0
    for direction in ("long", "short"):
        selected = [row for row in rounds if row.get("direction") == direction]
        wins = sum(1 for row in selected if row.get("net", 0) > 0)
        result[direction] = {
            "count": len(selected),
            "wins": wins,
            "rate": round(wins / len(selected) * 100, 2) if selected else None,
        }
    unknown_count = sum(1 for row in rounds if row.get("direction") not in ("long", "short"))
    result["unknown_count"] = unknown_count
    result["eligible_count"] = result["long"]["count"] + result["short"]["count"]
    return result


def derived_trends(fixture: dict) -> dict:
    live = derive_live_rounds(fixture)
    sim = derive_sim_exercises(fixture)
    return {"live": [{"date": p["date"], "net": p["net"]} for p in stats_for(live)["points"]], "simulation": [{"date": p["date"], "net": p["net"]} for p in stats_for_exercises(sim)["points"]]}


def distribution_for_exercises(exercises: list[dict], mode: str = "金额") -> list[dict]:
    eligible = [e for e in exercises if e["net"] is not None and (mode != "收益率" or e["rate"] is not None)]
    if mode == "收益率":
        rules = [("亏损 > 5%", lambda e: e["rate"] < -5), ("亏损 0–5%", lambda e: -5 <= e["rate"] < 0), ("持平", lambda e: e["rate"] == 0), ("盈利 0–5%", lambda e: 0 < e["rate"] <= 5), ("盈利 > 5%", lambda e: e["rate"] > 5)]
    else:
        rules = [("亏损 > 100", lambda e: e["net"] < -100), ("亏损 0–100", lambda e: -100 <= e["net"] < 0), ("持平", lambda e: e["net"] == 0), ("盈利 0–100", lambda e: 0 < e["net"] <= 100), ("盈利 > 100", lambda e: e["net"] > 100)]
    denominator = len(eligible)
    return [{"label": label, "rounds": [e for e in eligible if predicate(e)], "count": sum(1 for e in eligible if predicate(e)), "rate": round(sum(1 for e in eligible if predicate(e)) / denominator * 100, 2) if denominator else None} for label, predicate in rules]


def distribution_for(rounds: list[dict], mode: str = "金额") -> list[dict]:
    if mode == "收益率":
        rules = [("亏损 > 5%", lambda r: r["rate"] < -5), ("亏损 0–5%", lambda r: -5 <= r["rate"] < 0), ("持平", lambda r: r["rate"] == 0), ("盈利 0–5%", lambda r: 0 < r["rate"] <= 5), ("盈利 > 5%", lambda r: r["rate"] > 5)]
    else:
        rules = [("亏损 > 100", lambda r: r["net"] < -100), ("亏损 0–100", lambda r: -100 <= r["net"] < 0), ("持平", lambda r: r["net"] == 0), ("盈利 0–100", lambda r: 0 < r["net"] <= 100), ("盈利 > 100", lambda r: r["net"] > 100)]
    denominator = len(rounds)
    return [{"label": label, "rounds": [r for r in rounds if predicate(r)], "count": sum(1 for r in rounds if predicate(r)), "rate": round(sum(1 for r in rounds if predicate(r)) / denominator * 100, 2) if denominator else None} for label, predicate in rules]


def distribution_max_count(distribution: list[dict]) -> int:
    return max((item["count"] for item in distribution), default=0)


def validate_fixture(fixture: dict) -> list[str]:
    errors = []
    a = next(x for x in fixture["simulation_exercises"] if x["id"].startswith("practice-a"))
    result = lifo_rounds(a)
    if len(result["rounds"]) != a["expected_pair_count"]: errors.append("练习 A 内部配对数不匹配")
    if result["open_quantity"] != a["expected_residual_quantity"]: errors.append("练习 A 未平仓数量不匹配")
    if [r["quantity"] for r in result["rounds"]] != [50, 30]: errors.append("练习 A fixture 配对顺序不匹配")
    if round(sum(x["net"] for x in result["rounds"]), 2) != 1884.0: errors.append("练习 A 已实现配对净额不匹配")
    if result["open_fees"] != 7.0: errors.append("练习 A 未平仓费用不匹配")
    summaries = derive_sim_exercises(fixture)
    by_id = {row["id"]: row for row in summaries}
    if by_id[a["id"]]["net"] is not None: errors.append("练习 A 残余估值缺失时不应计算净额")
    valued_a = summarize_exercise({**a, "ending_valuation": 140})
    if valued_a["net"] != 4677.0: errors.append("练习 A 明确结束价140时净额应为4677")
    if [by_id[e["id"]]["net"] for e in fixture["simulation_exercises"][1:]] != [-104.0, 354.0, -78.0, 98.0, 118.0]: errors.append("练习 B-F 净额不匹配")
    summary_stats = stats_for_exercises(summaries)
    if (summary_stats["count"], summary_stats["calculable_count"], summary_stats["unknown_count"], summary_stats["net"], summary_stats["win_rate"]) != (6, 5, 1, 388.0, 60.0): errors.append("模拟练习汇总口径不匹配")
    trends = derived_trends(fixture)
    if len(trends["live"]) < 5: errors.append("实盘趋势有效日期少于5个")
    if len(trends["simulation"]) < 5: errors.append("模拟盘趋势有效日期少于5个")
    symbols = [(x["practice_date"], x["symbol"]) for x in fixture["simulation_exercises"]]
    if len(symbols) == len(set(symbols)): errors.append("模拟盘缺少同标的同日独立练习")
    multi = aggregate_live_actions([{"id": "open-1", "date": "2026-10-01", "side": "买入", "quantity": 50, "price": 10.0, "fee": 1.0}, {"id": "open-2", "date": "2026-10-02", "side": "买入", "quantity": 50, "price": 12.0, "fee": 1.0}, {"id": "close-1", "date": "2026-10-03", "side": "卖出", "quantity": 80, "price": 14.0, "fee": 2.0}, {"id": "close-2", "date": "2026-10-04", "side": "卖出", "quantity": 20, "price": 13.0, "fee": 1.0}])
    if [r["quantity"] for r in multi["rounds"]] != [80, 20] or multi["rounds"][0]["allocation_count"] != 2: errors.append("实盘一卖多开未聚合为一条人类回合")
    split_action = aggregate_live_actions([{"id": "open", "date": "2026-10-01", "side": "买入", "quantity": 100, "price": 10.0, "fee": 1.0}, {"id": "fill-a", "date": "2026-10-02", "side": "卖出", "quantity": 40, "price": 12.0, "fee": 1.0, "human_action_id": "human-1"}, {"id": "fill-b", "date": "2026-10-02", "side": "卖出", "quantity": 40, "price": 12.1, "fee": 1.0, "human_action_id": "human-1"}])
    if len(split_action["rounds"]) != 1 or split_action["rounds"][0]["quantity"] != 80: errors.append("同一人工动作的技术卖出拆分应为一个回合")
    return errors


# A panel owns its measured bottom; no caller guesses heights from row counts.
from dataclasses import dataclass

@dataclass
class Panel:
    svg: str
    bottom: float


def button(x, y, w, label, active=False, disabled=False, focus=False, inactive_fill='surface'):
    return (rect(x, y, w, 36, 'raised' if active else inactive_fill, 'blue' if active or focus else 'border', 6)
            + text(x+w/2, y+23, label, 14, 'subtle' if disabled else 'blue' if active else 'text', 500, 'middle'))


def segments(x,y,labels,active,width=176):
    cell=width/len(labels)
    return ''.join(button(x+i*cell,y,cell-2,label,label==active) for i,label in enumerate(labels))


def range_label(state):
    return state['start'] if state['start']==state['end'] else f"{state['start']} 至 {state['end']}"


def common_chrome(width, height, title, subtitle, state, view='实盘', page='列表', return_label=None):
    """E navigation row: mode and page tabs share one 58px subnav."""
    mode_x, nav_y = 96, 70.5
    mode = [rect(mode_x, nav_y, 184, 44, 'nav', 'border', 9)]
    mode += [button(mode_x + 4, nav_y + 4, 88, '实盘', view == '实盘', inactive_fill='nav'),
             button(mode_x + 92, nav_y + 4, 88, '模拟盘', view == '模拟盘', inactive_fill='nav')]
    tabs_x = mode_x + 184 + 18
    tabs = []
    for i, label in enumerate(('列表', '统计')):
        x = tabs_x + i * 72
        tabs.append(text(x + 34, nav_y + 27, label, 14, 'blue' if page == label else 'muted', 600, 'middle'))
        tabs.append(line(x, nav_y + 42, x + 68, nav_y + 42, 'blue' if page == label else 'border', 2 if page == label else 1))
    return [''.join(mode + tabs)]


def filter_controls(width,state,view='实盘',review=None):
    y = 161
    out=[control(96,y,290,'练习日期' if view=='模拟盘' else '成交 / 平仓日期',range_label(state),'date'),
         control(404,y,180,'市场',state['market'])]
    if view=='实盘':out.append(control(602,y,180,'账户 / 身份',state['account']))
    else:out.append(control(602,y,216,'账户 / 身份',state.get('account','模拟练习身份 · 不显示实盘账户')))
    out += [control(width-308,y,220,'交易搜索',state['search'] or '筛选当前列表','search'),button(width-60,y,36,''),icon_refresh(width-50,y+10)]
    return ''.join(out)


def document(width,height,title,body,state=None,view='实盘',return_label=None,active='交易库',focus=None):
    simulation = view == '模拟盘'
    page_bg = '#111E2C' if simulation else COLORS['bg']
    main_edge = '<line x1="72" y1="64" x2="%d" y2="64" stroke="#607C96" stroke-width="2"/>' % width if simulation else ''
    main_inset = f'<rect x="72.5" y="64.5" width="{width-73}" height="{height-65}" fill="none" stroke="#40566D"/>' if simulation else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(title)}"><title>{esc(title)} · 设计样例</title>'
            +f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>'
            +f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/><rect x="72" y="64" width="{width-72}" height="{height-64}" fill="{page_bg}"/>{main_edge}{main_inset}'
            +sidebar(height,active,focus)+header(width,'交易库')+''.join(body)+'</svg>')


def table(x,y,w,title,subtitle,headers,rows,count=None,page=1,page_size=6,selected=None,focus=None):
    total=len(rows) if count is None else count
    pages=max(1,math.ceil(total/page_size)); visible=rows[(page-1)*page_size:page*page_size]
    has_footer = total > page_size
    # E table geometry: tag/header occupy 96px, rows are 48px, pagination only
    # appears when the current business result actually has another page.
    h=96+max(1,len(visible))*48+(48 if has_footer else 0)
    if '练习' in subtitle:
        tag = f'{total} 次练习'
    elif '内部配对' in subtitle:
        tag = f'{total} 个内部配对'
    elif '回合' in subtitle:
        tag = f'{total} 个回合'
    else:
        tag = f'{total} 笔样例成交'
    out=[rect(x,y,w,h),rect(x+18,y+18,92,28,'raised','border',14),text(x+64,y+37,tag,12,'muted',500,'middle')]
    for label,offset,anchor in headers:out.append(text(x+offset,y+78,label,12,'muted',400,anchor))
    out.append(line(x+24,y+90,x+w-24,y+90))
    for i,row in enumerate(visible):
        ry=y+96+i*48
        rid=row['id']; cells=row['cells']
        if rid==selected or rid==focus:out.append(rect(x+12,ry,w-24,48,'raised','blue' if rid==focus else 'border',4))
        for (value,tone),(label,offset,anchor) in zip(cells,headers):out.append(text(x+offset,ry+29,value,14,tone,500 if rid==selected else 400,anchor))
        out.append(line(x+24,ry+48,x+w-24,ry+48))
    if not visible:out.append(text(x+24,y+132,'没有符合条件的记录',14,'muted'))
    if has_footer:
        out.extend([text(x+24,y+h-24,f'{(page-1)*page_size+1 if total else 0}–{min(page*page_size,total)} / {total} 项',12,'subtle'),button(x+w-188,y+h-48,36,'‹',disabled=page==1),text(x+w-112,y+h-25,f'{page} / {pages}',14,'muted',400,'middle'),button(x+w-60,y+h-48,36,'›',disabled=page==pages)])
    return Panel(''.join(out),y+h)


def metric_cards(x,y,w,data):
    gap=12;cw=(w-gap*(len(data)-1))/len(data);out=[]
    for i,(label,val) in enumerate(data):
        tone='text'
        if any(key in label for key in ('净盈亏','累计净盈亏','平均盈利')):
            amount=getattr(val, 'full_amount', None)
            tone='positive' if amount is not None and amount > 0 else 'negative' if amount is not None and amount < 0 else 'text'
        elif '平均亏损' in label:
            amount=getattr(val, 'full_amount', None)
            tone='negative' if amount is not None and amount < 0 else 'text'
        xx=x+i*(cw+gap);out += [rect(xx,y,cw,104),text(xx+16,y+30,label,12,'muted')]
        if '费用' in label:
            out.append(icon_help(xx+cw-52,y+12,'费用口径：模拟练习按原始成交费用合计且只计一次；实盘按已闭合回合的开仓分摊费与平仓费计入净盈亏。'))
        out.append(text(xx+16,y+76,val,28,tone,600))
    return ''.join(out)


def distribution_panel(x, y, w, distribution, selected=None, denominator=None,
                       status=None, unit='练习'):
    """Render the five boundary-preserving bins as one horizontal bar panel."""
    denominator = sum(item["count"] for item in distribution) if denominator is None else denominator
    max_count = distribution_max_count(distribution)
    row_h = 30
    top = y + 116
    bottom = top + len(distribution) * row_h
    panel_h = bottom - y + 26
    label_x = x + 24
    bar_x = x + 270
    bar_w = max(220, w - 540)
    count_x = x + w - 176
    percent_x = x + w - 24
    out = [rect(x, y, w, panel_h), text(label_x, y + 34, '收益分布', 18, 'text', 600)]
    if status == 'loading':
        subtitle = '正在加载… · 区间和分母等待数据'
    elif denominator:
        subtitle = f'当前范围 · {denominator} 个可计算{unit} · 点击区间查看下方样本'
    else:
        subtitle = f'当前范围没有可计算{unit}'
    out.append(text(label_x, y + 70, subtitle, 12, 'muted'))
    # Center the axis title on its own line above the baseline so it cannot
    # collide with the left 0 tick at narrow widths.
    out += [text(bar_x + bar_w / 2, y + 84, f'{unit}数', 12, 'subtle', 400, 'middle'), line(bar_x, y + 106, bar_x + bar_w, y + 106)]
    if max_count:
        out += [text(bar_x, y + 102, '0', 11, 'subtle', 400, 'start'),
                text(bar_x + bar_w, y + 102, str(max_count), 11, 'subtle', 400, 'end')]
    for index, item in enumerate(distribution):
        ry = top + index * row_h
        if item['label'] == selected:
            out.append(rect(x + 12, ry - 6, w - 24, row_h, 'raised', 'blue', 5))
        tone = 'negative' if '亏损' in item['label'] else 'positive' if '盈利' in item['label'] else 'muted'
        out.append(text(label_x, ry + 22, item['label'], 14, tone, 500 if item['label'] == selected else 400))
        width = bar_w * item['count'] / max_count if max_count else 0
        # A zero count deliberately has zero width: no minimum-width hint bar.
        out.append(f'<rect x="{bar_x:g}" y="{ry+11:g}" width="{width:g}" height="8" rx="4" fill="{COLORS[tone]}" data-bar="distribution" data-count="{item["count"]}" data-bar-width="{width:g}"/>')
        if status == 'loading':
            out.append(rect(bar_x, ry + 11, bar_w * .3, 8, 'raised', 'border', 4))
            count_label, rate_label = '…', '…'
        elif denominator:
            count_label = str(item['count'])
            rate_label = f'{item["rate"]:.2f}%'
        else:
            count_label, rate_label = '0', '—'
        out += [text(count_x, ry + 22, count_label, 14, 'text', 500, 'end'),
                text(percent_x, ry + 22, rate_label, 14, 'muted', 400, 'end')]
    if status == 'empty' or (not denominator and status != 'loading'):
        out.append(text(bar_x + bar_w / 2, top + len(distribution) * row_h / 2, f'没有可计算{unit}，无法绘制分布', 14, 'muted', 400, 'middle'))
    return Panel(''.join(out), y + panel_h)


def risk_band(x, y, w):
    return (text(x, y + 18, '最差练习回撤 —', 12, 'muted', 500)
            + icon_help(x + 112, y, '回撤口径：取所选练习中最大的单次练习权益回撤，不把不同练习拼成一个账户。当前样例缺少权益路径，暂不可计算。'))


def fee_band(x, y, w):
    return icon_help(x, y, '费用口径：已平仓回合的开仓分摊费与平仓费；已计入净盈亏，不含未平仓费用。')


def trend_card(x,y,w,h,title,subtitle,values,value_key='cumulative',grain='day',simulation=False):
    # Keep the help target after the visible heading, with a fixed readable gap
    # for both the normal and missing-input heading variants.
    title_help_x = x + 24 + len(title) * 18 + 8
    trend_help = ('趋势口径：按练习日期汇总各练习的净盈亏；费用按练习口径扣除，不代表一个连续账户的权益曲线。'
                  if simulation else
                  '趋势口径：按回合平仓日期累计已平仓有效回合的净盈亏，费用已扣除。')
    out=[rect(x,y,w,h),text(x+24,y+34,title,18,'text',600),icon_help(title_help_x,y+16,trend_help),text(x+24,y+57,subtitle,12,'muted')]
    left,right,top,bottom=x+92,x+w-48,y+94,y+h-48
    nums=[v.get(value_key) for v in values if v.get(value_key) is not None]
    if not nums:
        out += [line(left,yy,right,yy) for yy in [top,(top+bottom)/2,bottom]]
        out.append(text((left+right)/2,(top+bottom)/2,'正在加载…' if subtitle=='首次加载' else '没有可绘制的有效数据',14,'muted',400,'middle'))
        return Panel(''.join(out),y+h)
    lo,hi=min(0,min(nums)),max(0,max(nums));span=max(1,hi-lo);lo-=span*.12;hi+=span*.12
    yy=lambda v:bottom-(v-lo)/(hi-lo)*(bottom-top)
    zero=yy(0)
    for tick in [hi,0,lo]:out += [line(left,yy(tick),right,yy(tick),'muted' if tick==0 else 'border',1,'4 4' if tick==0 else ''),text(left-12,yy(tick)+4,fmt(tick),12,'subtle',400,'end')]
    prev=None
    for i,v in enumerate(values):
        xx=(left+right)/2 if len(values)==1 else left+(right-left)*i/(len(values)-1)
        label=v['date'][:4] if grain=='year' else v['date'][:7] if grain=='month' else v['date'][5:]
        out.append(text(xx,bottom+25,label,12,'subtle',400,'middle'))
        value=v.get(value_key)
        if value is None:
            out += [line(xx,top,xx,bottom,'warning',1,'3 5'),text(xx,top+22,'缺失',12,'warning',400,'middle')];prev=None;continue
        point=(xx,yy(value));tone='positive' if value > 0 else 'negative' if value < 0 else 'muted';out.append(f'<circle cx="{xx:g}" cy="{point[1]:g}" r="4" fill="{COLORS[tone]}"><title>{esc(v["date"])} · {value:,.2f} CNY</title></circle>')
        if prev:out.append(line(*prev,*point,'blue',2))
        prev=point
        if v.get('status')=='no_trades':out.append(text(xx,min(bottom-14,point[1]+26),'无成交 · 0.00',12,'muted',400,'end'))
    return Panel(''.join(out),y+h)


def stats_frame(width,minimum,fixture,kind):
    sim=kind in ['simulation-stats','trend-gap','trend-single','trend-empty','trend-month','trend-year','empty','missing','extreme']
    set_theme(sim)
    state=dict(fixture['navigation']['simulation' if sim else 'live']);view='模拟盘' if sim else '实盘'
    exercises=derive_sim_exercises(fixture) if sim else []
    rounds=derive_live_rounds(fixture) if not sim else []
    status=kind if kind in ['loading','empty','error','missing'] else None
    grain='day';mode='金额' if kind in ['distribution','return-stats','amount-stats'] else '收益率';selected='盈利 > 100' if kind in ['distribution','return-stats'] else None
    title=f'{view}统计';subtitle='按练习样本汇总 · CNY' if sim else '有效已平仓回合 · CNY'
    if kind=='trend-month':state.update(start='2026-01-01',end='2026-12-31');grain='month'
    if kind=='trend-year':state.update(start='2020-01-01',end='2026-12-31');grain='year'
    if kind in ['trend-empty','empty']:state.update(start='2026-10-20',end='2026-10-25');status='empty'
    if kind=='trend-single':state.update(start='2026-10-15',end='2026-10-15')
    if kind=='extreme':
        exercises=[summarize_exercise(e) for e in fixture['boundary_exercises']]
        state.update(start='2026-10-03',end='2026-10-07')
    stats=stats_for_exercises(exercises,state['start'],state['end']) if sim else stats_for(rounds,state['start'],state['end'])
    points=stats['points']
    if grain!='day':
        groups={}
        source_rows=stats['exercises'] if sim else stats['rounds']
        for row in source_rows:
            if row.get('net') is None:continue
            key=row['practice_date'][:7] if sim and grain=='month' else row['practice_date'][:4] if sim else row['date'][:7] if grain=='month' else row['date'][:4]
            groups[key]=groups.get(key,0)+row['net']
        cum=0;points=[]
        for key,value in sorted(groups.items()):cum+=value;points.append({'date':key,'cumulative':round(cum,2)})
    if kind=='missing':
        missing_date=fixture['missing_inputs']['date'];total=stats['count']
        if sim:
            missing_id=fixture['missing_inputs']['exercise_id']
            selected_exercises=[{**exercise, 'net': None, 'rate': None, 'calculable': False, 'fees': None} if exercise['id']==missing_id else exercise for exercise in stats['exercises']]
            stats=stats_for_exercises(selected_exercises)
        else:
            stats=stats_for([r for r in stats['rounds'] if r['date']!=missing_date])
        points=sorted(stats['points']+[{'date':missing_date,'cumulative':None}], key=lambda p:p['date'])
        subtitle=f"可计算 {stats['calculable_count'] if sim else stats['count']} / {total} {'练习' if sim else '回合'} · {missing_date} 平仓费用缺失 · 全范围净盈亏 —"
    if kind=='trend-gap':
        gap=fixture['trend_modes']['gap_scenario'];state.update(start=gap['start'],end=gap['end']);missing={d['date'] for d in gap['dates'] if d['status']=='missing'}
        if sim:
            # Keep the missing exercise identities in the selected sample so
            # totals and metadata remain traceable.  Only their derived net,
            # rate and unavailable fee are unknown; no missing input becomes
            # a fabricated zero.
            selected_exercises=[{**exercise, 'net': None, 'rate': None, 'calculable': False, 'fees': None} if exercise['practice_date'] in missing else exercise for exercise in exercises]
            stats=stats_for_exercises(selected_exercises,state['start'],state['end'])
            known={p['date']:p['cumulative'] for p in stats['points']}
        else:
            stats=stats_for([r for r in rounds if r['date'] not in missing],state['start'],state['end']);known={p['date']:p['cumulative'] for p in stats['points']}
        cum=0;points=[]
        for d in gap['dates']:
            if d['status']=='missing':value=None
            else:value=known.get(d['date'],cum);cum=value
            points.append({**d,'cumulative':value})
        subtitle=f"10-17、10-18 文件缺失 · 全范围净盈亏 — · 可计算 {stats['calculable_count'] if sim else stats['count']} {'练习' if sim else '回合'}"
    body=common_chrome(width,minimum,title,subtitle,state,view,'统计');body.append(filter_controls(width,state,view));y=215;w=width-120
    if status=='error':
        body += [rect(96,y,w,68,'raised'),text(120,y+27,'更新失败 · '+range_label(fixture['navigation']['error_attempt'])+' 未应用',14,'warning',600),text(120,y+50,'当前仍显示 '+range_label(state)+' 的完整结果',12,'muted'),button(width-156,y+16,108,'重试')];y+=92
    if sim:
        if status=='loading':
            sim_first=[('练习总数','…'),('可计算净盈亏','…'),('胜率','…'),('费用（全部样本）','…')]
            sim_second=[('可计算样本','…'),('收益率样本','…'),('平均盈利','…'),('平均亏损','…')]
        else:
            net_label='可计算净盈亏' if kind in ['missing','trend-gap'] else '累计净盈亏'
            sim_first=[('练习总数',str(stats['count'])),(net_label,fmt(stats['net'])),('胜率',f"{stats['win_rate']:.2f}%" if stats['win_rate'] is not None else '—'),('费用（全部样本）',fmt(stats['fees']))]
            unknown_suffix=f"（未知 {stats['unknown_count']}）" if sim and stats.get('unknown_count',0) else ''
            sim_second=[('可计算样本'+unknown_suffix,str(stats['calculable_count'])),('收益率样本',str(stats.get('rate_count',0))),('平均盈利',fmt(stats['average_profit'])),('平均亏损',fmt(stats['average_loss']))]
        body.append(metric_cards(96,y,w,sim_first));y+=116
        body.append(metric_cards(96,y,w,sim_second));y+=116
        body.append(risk_band(96,y,w));y+=30
    else:
        metrics=[(l,'…') for l in ['有效回合','累计净盈亏','胜率','平均盈利','平均亏损','费用（已扣除）']] if status=='loading' else [('有效回合',str(stats['count'])),('可计算净盈亏' if kind in ['missing','trend-gap'] else '累计净盈亏',fmt(stats['net'])),('胜率',f"{stats['win_rate']:.2f}%" if stats['win_rate'] is not None else '—'),('平均盈利',fmt(stats['average_profit'])),('平均亏损',fmt(stats['average_loss'])),('费用（已扣除）',fmt(stats['fees']))]
        body.append(metric_cards(96,y,w,metrics));y+=122
    trend_points=[] if status=='loading' else points
    trend_title='可计算练习累计净盈亏' if sim else ('可计算累计净盈亏' if kind in ['trend-gap','missing'] else '累计净盈亏趋势')
    trend_subtitle='首次加载' if status=='loading' else ('按练习日期' if sim else '按回合平仓日期')+' · '+{'day':'日','month':'月','year':'年'}[grain]
    trend=trend_card(96,y,w,290,trend_title,trend_subtitle,trend_points,grain=grain,simulation=sim);body.append(trend.svg);y=trend.bottom+18
    dist=distribution_for_exercises(stats['exercises'] if sim and status!='loading' else [],mode) if sim else distribution_for(stats['rounds'] if status!='loading' else [],mode)
    denominator=(stats['rate_count'] if mode == '收益率' else stats['calculable_count']) if sim else stats['count']
    table_y=y;unit='练习' if sim else '回合';panel=distribution_panel(96,y,w,dist,selected=selected,denominator=denominator,status=status,unit=unit)
    body.append(panel.svg);body.append(segments(198,table_y+16,['收益率','金额'],mode,192));body.append(icon_help(390,table_y+16,f'分布口径：每个可计算{unit}计入一个区间，条长表示{unit}数，占比以可计算{unit}为分母；残余估值未知不进入分布。'));y=panel.bottom+18
    if selected:
        chosen=next(d for d in dist if d['label']==selected);rows=[]
        for row in chosen['rounds']:
            if sim:rows.append({'id':row['id'],'cells':[(row['practice_date'],'text'),(row['display_name'],'text'),(fmt(row['net']),'positive' if row['net']>=0 else 'negative'),('查看详情 →','blue')]})
            else:rows.append({'id':row['round_id'],'cells':[(row['date'],'text'),(row['symbol'],'text'),(fmt(row['net']),'positive'),('进入复盘 →','blue')]})
        caption=f"{len(rows)} 个{unit} / 范围内 {denominator} 个可计算{unit}"
        headers=[('练习日期' if sim else '平仓日期',24,'start'),('练习' if sim else '标的',280,'start'),('净盈亏(CNY)',606,'end'),('操作',760,'start')]
        panel=table(96,y, w, ('区间练习 · ' if sim else '区间回合 · ')+selected,caption,headers,rows,focus=rows[0]['id'] if kind=='return-stats' and rows else None);body.append(panel.svg);y=panel.bottom+24
    if kind=='extreme':
        body += [rect(96,y,w,92,'raised'),text(120,y+30,'金额详情 · 平均盈利',14,'text',600),text(120,y+63,f"{stats['average_profit']:,.2f} CNY",18,'positive'),button(width-180,y+28,132,'复制完整金额')];y+=116
    if kind in ['missing','trend-gap']:
        body += [rect(96,y,w,68,'raised'),text(120,y+28,'缺失输入未进入统计与分布分母；全范围结果不可计算。',14,'warning'),text(120,y+51,'补充平仓费用后重新计算' if kind=='missing' else '10-17、10-18：练习文件读取失败；10-20：已确认无成交，日收益 0.00。',12,'muted')];y+=92
    return document(width,max(minimum,math.ceil(y)),title,body,state,view)


def trade_rows(fixture,state,pending=False):
    trades=sorted([t for t in fixture['live_trades'] if date_between(t['date'],state['start'],state['end']) and (not pending or t['review_status']=='pending')],key=lambda t:(t['date'],t['id']))
    return [{'id':t['id'],'cells':[(t['date'],'text'),(t['symbol'],'text'),(t['code'],'text'),(t['side'],'text'),(str(t['quantity']),'text'),(f"{t['price']:,.2f}",'text'),(f"{t['fee']:,.2f}",'text'),('待复盘' if t['review_status']=='pending' else '已复盘','warning' if t['review_status']=='pending' else 'positive')]} for t in trades]


def list_frame(width,height,fixture,kind):
    sim=kind in ['simulation-list','view-simulation','simulation-return'];state=dict(fixture['navigation']['simulation' if sim else 'live']);view='模拟盘' if sim else '实盘';pending=kind=='pending'
    set_theme(sim)
    if kind=='date':state.update(start=fixture['source']['date'],end=fixture['source']['date'])
    if kind=='month-list':state.update(start='2026-10-01',end='2026-10-31')
    title='模拟盘练习' if sim else '实盘交易';subtitle='按练习日期' if sim else '按成交日期'
    body=common_chrome(width,height,title,subtitle,state,view);body.append(filter_controls(width,state,view))
    # Keep the review-state business filter in the compact E filter row.  It
    # remains available without introducing the old B two-line title gap.
    body += [control(836,161,120,'复盘状态','待复盘' if pending else '全部')];y=215
    if sim:
        rows=[]
        for e in sorted(fixture['simulation_exercises'],key=lambda e:(e['practice_date'],e['id'])):
            if not date_between(e['practice_date'],state['start'],state['end']):continue
            summary=summarize_exercise(e);rows.append({'id':e['id'],'cells':[(e['practice_date'],'text'),(e.get('display_name',e['label']),'text'),(e['symbol'],'text'),(e['code'],'text'),(str(summary['trade_count']),'text'),(str(summary['pair_count']),'text'),(str(summary['open_quantity']),'muted')]})
        headers=[('练习日期',24,'start'),('练习身份',260,'start'),('标的',442,'start'),('代码',594,'start'),('成交明细',860,'end'),('内部配对',1010,'end'),('未平仓数量',1170,'end')]
    else:
        rows=trade_rows(fixture,state,pending)
        # Anchor the status column to the table's inner right edge.  This
        # keeps the 1280px frames inside the card while preserving the same
        # column contract at 1440px.
        headers=[('成交日期',24,'start'),('标的',262,'start'),('代码',442,'start'),('方向',614,'start'),('数量',807,'end'),('价格',964,'end'),('费用',1075,'end'),('状态',width-144,'end')]
    focus=state['focus'] if kind in ['live-return','view-restore','simulation-return'] else None
    # Preserve the fixture navigation contract for every list journey.  The
    # E prototype uses a fixed preview row count, but the frame state owns the
    # actual business page size and must continue to drive pagination.
    panel=table(96,y,width-120,title,('练习' if sim else '成交'),headers,rows,page=state['page'],page_size=state['page_size'],focus=focus)
    # Sorting remains visible as a compact table summary, away from the
    # search/refresh controls in the single E filter row.
    body += [panel.svg, text(width-144, y+37, state['sort'], 12, 'muted', 400, 'end')]
    return document(width,max(height,int(panel.bottom+24)),title,body,state,view)


def object_state(fixture,live):
    state=fixture['navigation']['live' if live else 'simulation']
    if live:
        obj={'id':'600519','label':'贵州茅台','symbol':'贵州茅台','code':'600519','trades':[t for t in fixture['live_trades'] if t['code']=='600519']};rounds=[r for r in derive_live_rounds(fixture) if r['code']=='600519'];result=lifo_rounds(obj)
    else:obj=fixture['simulation_exercises'][0];result=lifo_rounds(obj);rounds=result['rounds']
    return state,obj,result,rounds


def rounds_frame(width,height,fixture,kind):
    live=kind.startswith('live');state,obj,result,rounds=object_state(fixture,live)
    set_theme(not live)
    if kind=='rounds-b':obj=fixture['simulation_exercises'][1];result=lifo_rounds(obj);rounds=result['rounds']
    view='实盘' if live else '模拟盘';unit='回合' if live else '内部配对';title=obj['label']+(' · 回合集' if live else ' · 内部配对详情');body=common_chrome(width,height,title,obj['symbol']+' · '+obj['code'],state,view,return_label='返回列表');body.append(filter_controls(width,state,view));y=215
    rows=[{'id':str(i),'cells':[(f'{unit} {i}','text'),(r['open_date']+' → '+r['close_date'],'text'),(str(r['quantity']),'text'),(fmt(r['net']),'positive' if r['net']>=0 else 'negative'),('进入复盘 →','blue')]} for i,r in enumerate(rounds,1)]
    panel=table(96,y,width-120,title,('已闭合'+unit),[('回合' if live else '内部配对',24,'start'),('开仓 → 平仓',180,'start'),('配对数量',680,'end'),('净盈亏(CNY)',880,'end'),('操作',980,'start')],rows,focus=('2' if kind=='rounds-a-return' else '1') if kind.endswith('return') else None);body.append(panel.svg);y=panel.bottom+24
    body.append(metric_cards(96,y,width-120,[('闭合净盈亏',fmt(sum(r['net'] for r in rounds))),('已平仓费用',fmt(result['closed_fees'])),('未平仓数量',str(result['open_quantity'])),('留存开仓费用',fmt(result['open_fees']))]));y+=120
    return document(width,max(height,int(y)),title,body,state,view,'返回列表')


def replay_frame(width,height,fixture,kind):
    live=kind=='library-replay';state,obj,result,rounds=object_state(fixture,live);idx=1
    set_theme(not live)
    if kind=='replay-a2':idx=2
    if kind=='replay-b1':obj=fixture['simulation_exercises'][1];result=lifo_rounds(obj);rounds=result['rounds']
    rd=rounds[idx-1];view='实盘' if live else '模拟盘';unit='回合' if live else '内部配对';title=obj['label']+f' · {unit} {idx} 复盘'
    return_label='返回回合集' if live else '返回练习详情'
    body=common_chrome(width,height,title,obj['symbol']+' · '+obj['code'],state,view,return_label=return_label);body.append(filter_controls(width,state,view))
    x,y,w=96,215,width-120;h=580
    body += [rect(x,y,w,h),text(x+24,y+34,title,18,'text',600),segments(x+24,y+54,[f'{unit} {i}' for i in range(1,len(rounds)+1)],f'{unit} {idx}',max(100,len(rounds)*100)),button(x+w-300,y+54,120,'定位开仓'),button(x+w-156,y+54,132,'定位平仓',True)]
    left,right,top,bottom=x+84,x+w-92,y+130,y+410
    bars=fixture['chart_samples'][obj['id']]['bars'];lo=min(b['low'] for b in bars);hi=max(b['high'] for b in bars);pad=(hi-lo)*.15;lo-=pad;hi+=pad
    sy=lambda p:bottom-(p-lo)/(hi-lo)*(bottom-top)
    sx=lambda day:left+(right-left)*next(i for i,b in enumerate(bars) if b['date']==day)/max(1,len(bars)-1)
    for value in [lo,(lo+hi)/2,hi]:body += [line(left,sy(value),right,sy(value)),text(right+12,sy(value)+5,f'{value:,.2f}',12,'subtle')]
    for i,b in enumerate(bars):
        xx=left+(right-left)*i/max(1,len(bars)-1);tone='positive' if b['close']>=b['open'] else 'negative';body += [line(xx,sy(b['high']),xx,sy(b['low']),tone),rect(xx-7,min(sy(b['open']),sy(b['close'])),14,max(2,abs(sy(b['open'])-sy(b['close']))),tone,tone,1)]
        if i in [0,len(bars)//2,len(bars)-1]:body.append(text(xx,bottom+25,b['date'][5:],12,'subtle',400,'middle'))
    # Selected matched entry/exit are visible; other opening context remains muted.
    for t in obj['trades']:
        xx=sx(t['date']);yy=sy(t['price']);active=t['id'] in [rd['open_id'],rd['close_id']];tone='blue' if active else 'subtle';above=t['side']=='卖出'
        body.append(f'<circle cx="{xx:g}" cy="{yy:g}" r="9" fill="{COLORS["surface"]}" stroke="{COLORS[tone]}" stroke-width="2"/>')
        label=('卖' if above else '买')+' '+str(t['quantity'])+'股'+('' if active else ' · 上下文')
        body.append(text(xx,yy-20 if above else yy+30,label,14,tone,600,'middle'))
        if active and above:body += [line(xx,top,xx,bottom,'blue',1,'4 4')]
    body += [text(x+24,y+473,f"{unit} {rd['quantity']} 股 · {rd['open_price']:,.2f} → {rd['close_price']:,.2f}",18,'text',600),text(x+24,y+504,f"开仓 {rd['open_date']}  /  平仓 {rd['close_date']}  ·  已平仓费用 {rd['fees']:.2f} CNY",14,'muted'),text(x+w-24,y+473,'净盈亏 '+fmt(rd['net'])+' CNY',18,'positive' if rd['net']>=0 else 'negative',600,'end'),text(x+24,y+549,'日线 · 设计行情样例 · 成交标记为原始成交数量',12,'muted'),button(x+w-156,y+525,132,return_label)]
    return document(width,max(height,y+h+24),title,body,state,view,return_label)


def home_valuation(fixture):
    valuation=fixture['valuation'];points=[]
    for day,quotes in sorted(valuation['quotes_by_date'].items()):
        partial={**fixture,'live_trades':[t for t in fixture['live_trades'] if t['date']<=day]}
        positions=derive_live_positions(partial);realized=sum(r['net'] for r in derive_live_rounds(partial))
        floating=sum(p['quantity']*(quotes[p['code']]-p['price'])-p['fee'] for p in positions)
        points.append({'date':day,'cumulative':round(realized+floating-valuation['opening_unrealized'],2)})
    quotes=valuation['quotes_by_date'][fixture['navigation']['home']['end']];positions=derive_live_positions(fixture)
    for p in positions:
        p['quote']=quotes[p['code']];p['market_value']=p['quantity']*p['quote'];p['floating']=p['quantity']*(p['quote']-p['price'])-p['fee']
    market=sum(p['market_value'] for p in positions);floating=sum(p['floating'] for p in positions);realized=stats_for(derive_live_rounds(fixture))['net']
    return {'positions':positions,'market_value':market,'floating':floating,'realized':realized,'total':realized+floating-valuation['opening_unrealized'],'points':points}


def home_reference_text(svg, x, y, value):
    """Replace a datum while preserving the approved host text geometry/style."""
    pattern=rf'(<text x="{re.escape(str(x))}" y="{re.escape(str(y))}"[^>]*>).*?(</text>)'
    full=getattr(value,'full_amount',None)
    body=(f'<title>{full} CNY</title>' if full is not None else '')+esc(value)
    updated,count=re.subn(pattern,lambda m:m[1]+body+m[2],svg,count=1)
    if count!=1:raise ValueError(f'Homepage reference text missing: {x}, {y}')
    return updated


def home_frame(fixture,focus=False):
    import importlib.util

    renderer=getattr(home_frame,'_renderer',None)
    if renderer is None:
        module_path=ROOT/'homepage-template.py'
        spec=importlib.util.spec_from_file_location('trading_library_homepage_template',module_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f'Unable to load homepage renderer: {module_path}')
        renderer=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(renderer)
        home_frame._renderer=renderer
    reference=ROOT.parents[1]/'2026-10-22-homepage-v2.5/source/images/home-1440.svg'
    return renderer.render_home(
        reference,
        fixture,
        home_valuation(fixture),
        stats_for(derive_live_rounds(fixture)),
        focus,
    )


FRAMES={
 '01-live-normal.svg':'live-stats','02-simulation-normal.svg':'simulation-stats','03-distribution-selected.svg':'distribution','04-return.svg':'return-stats',
 '05-loading.svg':'loading','06-empty.svg':'empty','07-error.svg':'error','08-extreme.svg':'extreme','09-missing-input.svg':'missing',
 'journeys-date.svg':'date','journeys-date-1280.svg':'date','journeys-date-month.svg':'month-list',
 'hcr06-final-sim-ab.svg':'simulation-list','hcr06-final-rounds-a.svg':'rounds-a','hcr06-final-replay-a1.svg':'replay-a1','hcr06-final-replay-a2.svg':'replay-a2','hcr06-final-replay-b1.svg':'replay-b1',
 'journeys-trend-gap.svg':'trend-gap','journeys-trend-single.svg':'trend-single','journeys-trend-empty.svg':'trend-empty','journeys-trend-month.svg':'trend-month','journeys-trend-year.svg':'trend-year',
 'handoff.svg':'home','journeys-home-entry.svg':'home','journeys-library-list.svg':'live-list','journeys-live-rounds.svg':'live-rounds','journeys-library-replay.svg':'library-replay','journeys-live-rounds-return.svg':'live-rounds-return','journeys-library-list-return.svg':'live-return','journeys-view-restore.svg':'view-restore',
 'journeys-library-list-return-1280.svg':'live-return',
 'hcr06-final-pending-library.svg':'pending','hcr06-final-pending-library-1280.svg':'pending','library-return.svg':'home-return','journeys-library-return.svg':'home-return','hcr06-final-return.svg':'return-stats',
 'distribution-amount.svg':'amount-stats','journeys-view-simulation.svg':'view-simulation','journeys-simulation-return.svg':'simulation-return','journeys-rounds-a-return.svg':'rounds-a-return','journeys-rounds-b.svg':'rounds-b',
}


def generate(name,fixture):
    kind=FRAMES[name];width=1280 if '-1280' in name else 1440;height=800 if width==1280 else 1000
    if kind.startswith('home'):return home_frame(fixture,kind=='home-return')
    if kind in ['date','month-list','live-list','live-return','view-restore','pending','simulation-list','view-simulation','simulation-return']:return list_frame(width,height,fixture,kind)
    if kind in ['live-rounds','live-rounds-return','rounds-a','rounds-a-return','rounds-b']:return rounds_frame(width,height,fixture,kind)
    if kind in ['library-replay','replay-a1','replay-a2','replay-b1']:return replay_frame(width,height,fixture,kind)
    return stats_frame(width,height,fixture,kind)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--frames',nargs='*');parser.add_argument('--all',action='store_true');args=parser.parse_args()
    fixture=json.loads(FIXTURE_PATH.read_text());errors=validate_fixture(fixture)
    if errors:raise SystemExit('\n'.join(errors))
    names=list(FRAMES) if args.all or not args.frames else args.frames
    for name in names:
        if name not in FRAMES:raise SystemExit('Unknown frame: '+name)
        svg=generate(name,fixture);ElementTree.fromstring(svg);(IMAGE_DIR/name).write_text(svg)
    print(f'Generated {len(names)} frames; fixture invariants passed.')


if __name__=='__main__':main()
