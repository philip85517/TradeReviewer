#!/usr/bin/env python3
"""Generate the Trading Library V1.0 design sample frames.

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
    "bg": "#0B1019", "surface": "#111A26", "raised": "#162233",
    "border": "#283448", "text": "#E6EDF7", "muted": "#A8B6CB",
    "subtle": "#71829B", "blue": "#6CA8FF", "positive": "#53D7A0",
    "negative": "#FF8592", "warning": "#FFC66D"
}
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"


def esc(value: object) -> str:
    return (str(value).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def text(x: float, y: float, value: object, size: int = 14, fill: str = "text",
         weight: int = 400, anchor: str = "start", cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return (f'<text x="{x:g}" y="{y:g}" font-size="{size}" fill="{COLORS[fill]}" '
            f'font-weight="{weight}" text-anchor="{anchor}"{c}>{esc(value)}</text>')


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
    out = [f'<rect x="0" y="0" width="72" height="{h}" fill="{COLORS["surface"]}"/>',
           text(36, 35, "TR", 20, "blue", 700, "middle")]
    for i, (path, label) in enumerate(items):
        y = 76 + i * 64
        if label == active:
            out.append(f'<rect x="8" y="{y:g}" width="56" height="56" rx="8" fill="{COLORS["raised"]}"/>')
        elif label == focus:
            out.append(f'<rect x="8" y="{y:g}" width="56" height="56" rx="8" fill="none" stroke="{COLORS["blue"]}" stroke-width="2"/>')
        icon_color = COLORS["blue"] if label == active else COLORS["muted"]
        out.extend([
            f'<svg x="24" y="{y + 2:g}" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="{path}" fill="none" stroke="{icon_color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            text(36, y + 45, label, 12, "blue" if label == active else "muted", 400, "middle")
        ])
    out.append(line(16, h - 56, 56, h - 56, "border"))
    out.append(text(36, h - 28, "账户", 10, "subtle", 500, "middle"))
    return "".join(out)


def header(w: int, title: str = "交易库", source: str = "来源：日期入口", return_label: str = "返回首页") -> str:
    return (f'<rect x="72" y="0" width="{w - 72}" height="64" fill="{COLORS["surface"]}" stroke="{COLORS["border"]}"/>'
            + text(96, 38, title, 24, "text", 600)
            + text(w - 222, 38, source, 12, "muted", 400, "end")
            + f'<rect x="{w - 202}" y="14" width="178" height="36" rx="8" fill="{COLORS["raised"]}" stroke="{COLORS["border"]}"/>'
            + text(w - 113, 37, return_label, 14, "text", 500, "middle"))


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


def table_card(x: float, y: float, w: float, h: float, rows: list[dict], narrow: bool) -> str:
    out = [rect(x, y, w, h), text(x + 24, y + 34, "实盘交易", 18, "text", 600),
           text(x + 24, y + 56, "来源日期条件已生效 · 保留未平仓成交", 12, "muted"),
           text(x + w - 24, y + 34, f"{len(rows)} 笔交易", 14, "muted", 500, "end")]
    headers = [("成交日期", x + 24, "start"), ("标的", x + 156, "start"),
               ("方向", x + 456, "start"), ("数量", x + 576, "end"),
               ("成交价", x + 721, "end"), ("状态", x + 871, "start")]
    for name, colx, anchor in headers:
        out.append(text(colx, y + 88, name, 12, "muted", 400, anchor))
    out.append(line(x + 24, y + 100, x + w - 24, y + 100, "border"))
    row_y = y + 136
    for i, row in enumerate(rows):
        out.extend([
            text(x + 24, row_y, row["date"], 14, "text"),
            text(x + 156, row_y, f'{row["symbol"]} · {row["code"]}', 14, "text"),
            text(x + 456, row_y, row["side"], 14, "positive" if row["side"] == "卖出" else "text"),
            text(x + 576, row_y, row["quantity"], 14, "text", 400, "end"),
            text(x + 721, row_y, f'{row["price"]:,.2f}', 14, "text", 400, "end"),
            text(x + 871, row_y, "已记录" if row["side"] == "卖出" else "未平仓", 14, "muted"),
            line(x + 24, row_y + 19, x + w - 24, row_y + 19, "border")
        ])
        row_y += 48
    out.append(text(x + 24, y + h - 24, f"设计样例 · 共 {len(rows)} 笔 · 第 1 页", 12, "subtle"))
    return "".join(out)


def summary_cards(x: float, y: float, w: float, narrow: bool, rows: list[dict]) -> str:
    gap = 16
    count = 2 if narrow else 3
    cardw = (w - gap * (count - 1)) / count
    open_count = sum(1 for row in rows if row["side"] == "买入")
    data = [("当前范围", "2026-10-15"), ("交易笔数", f"{len(rows)} 笔"), ("未平仓", f"{open_count} 笔")]
    out = []
    for i, (label, value) in enumerate(data[:count]):
        xx = x + i * (cardw + gap)
        out.extend([rect(xx, y, cardw, 88), text(xx + 16, y + 28, label, 12, "muted"), text(xx + 16, y + 62, value, 28, "text", 600)])
    return "".join(out)


def build_date_frame(width: int, height: int, fixture: dict) -> str:
    narrow = width <= 1280
    content_x = 96
    content_w = width - content_x - 24
    source_date = fixture["source"]["date"]
    rows = [row for row in fixture["live_trades"] if row["date"] == source_date]
    if not rows:
        raise ValueError(f"date fixture has no live row for {source_date}")
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="journeys-date {width}">',
           f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>',
           f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/>', sidebar(height), header(width),
           text(content_x, 96, "首页 / 交易库", 12, "muted"),
           text(content_x, 130, "按日期进入 · 实盘交易", 24, "text", 600),
           text(content_x, 154, "来源日期、市场和账户已应用；列表按成交日筛选。", 12, "muted"),
           text(width - 24, 130, "已应用条件", 12, "blue", 600, "end"),
           text(width - 24, 154, "2026-10-15 · 全部市场 · 全部账户", 12, "muted", 400, "end"),
           text(content_x, 188, "视角", 12, "muted"),
           rect(content_x, 196, 182, 36, "raised"),
           f'<rect x="{content_x + 4}" y="200" width="82" height="28" rx="6" fill="{COLORS["blue"]}"/>',
           text(content_x + 45, 219, "实盘", 14, "bg", 600, "middle"), text(content_x + 136, 219, "模拟盘", 14, "muted", 600, "middle"),
           text(content_x + 206, 188, "页面", 12, "muted"),
           rect(content_x + 206, 196, 176, 36, "raised"),
           f'<rect x="{content_x + 210}" y="200" width="78" height="28" rx="6" fill="{COLORS["blue"]}"/>',
           text(content_x + 249, 219, "列表", 14, "bg", 600, "middle"), text(content_x + 334, 219, "统计", 14, "muted", 600, "middle")]
    y = 262 if narrow else 268
    out.extend([control(content_x, y, 220, "成交日期", "2026-10-15", "date"),
                control(content_x + 248, y, 160, "市场", "全部市场"),
                control(content_x + 436, y, 176, "账户", "全部账户"),
                control(width - 24 - 220 - 28 - 36, y, 220, "交易搜索", "筛选当前列表", "search"),
                f'<rect x="{width - 24 - 36}" y="{y:g}" width="36" height="36" rx="8" fill="{COLORS["surface"]}" stroke="{COLORS["border"]}"/>',
                icon_refresh(width - 24 - 36 + 10, y + 10),
                text(width - 24 - 36 + 18, y + 52, "刷新", 10, "subtle", 400, "middle")])
    table_y = y + 74
    table_h = 404 if narrow else 452
    out.append(table_card(content_x, table_y, content_w, table_h, rows, narrow))
    summary_y = table_y + table_h + 24
    if summary_y + 88 <= height - 20:
        out.append(summary_cards(content_x, summary_y, content_w, narrow, rows))
    else:
        out.append(text(content_x, height - 28, "来源：日期入口 · 返回首页恢复原日期与焦点", 12, "subtle"))
    out.append("</svg>")
    return "".join(out)



def fmt(v: float | int | None) -> str:
    if v is None:
        return "—"
    return f"{v:,.2f}"


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


def derive_live_rounds(fixture: dict) -> list[dict]:
    by_symbol = {}
    rounds = []
    for trade in fixture["live_trades"]:
        by_symbol.setdefault(trade["code"], {"id": trade["code"], "trades": [], "symbol": trade["symbol"], "code": trade["code"]})["trades"].append(trade)
    for item in by_symbol.values():
        result = lifo_rounds({"trades": sorted(item["trades"], key=lambda x: x["date"])})
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
            rounds.append({**row, "round_id": f"{exercise['id']}-{i}", "exercise_id": exercise["id"], "exercise": exercise["label"], "symbol": exercise["symbol"], "code": exercise["code"], "date": exercise["saved_date"], "scope": "simulation"})
    return sorted(rounds, key=lambda x: (x["date"], x["exercise_id"], x["round_id"]))


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


def derived_trends(fixture: dict) -> dict:
    live = derive_live_rounds(fixture)
    sim = derive_sim_rounds(fixture)
    return {"live": [{"date": p["date"], "net": p["net"]} for p in stats_for(live)["points"]], "simulation": [{"date": p["date"], "net": p["net"]} for p in stats_for(sim)["points"]]}


def distribution_for(rounds: list[dict], mode: str = "金额") -> list[dict]:
    if mode == "收益率":
        rules = [("亏损 > 5%", lambda r: r["rate"] < -5), ("亏损 0–5%", lambda r: -5 <= r["rate"] < 0), ("持平", lambda r: r["rate"] == 0), ("盈利 0–5%", lambda r: 0 < r["rate"] <= 5), ("盈利 > 5%", lambda r: r["rate"] > 5)]
    else:
        rules = [("亏损 > 100", lambda r: r["net"] < -100), ("亏损 0–100", lambda r: -100 <= r["net"] < 0), ("持平", lambda r: r["net"] == 0), ("盈利 0–100", lambda r: 0 < r["net"] <= 100), ("盈利 > 100", lambda r: r["net"] > 100)]
    denominator = len(rounds)
    return [{"label": label, "rounds": [r for r in rounds if predicate(r)], "count": sum(1 for r in rounds if predicate(r)), "rate": round(sum(1 for r in rounds if predicate(r)) / denominator * 100, 2) if denominator else None} for label, predicate in rules]


def validate_fixture(fixture: dict) -> list[str]:
    errors = []
    a = next(x for x in fixture["simulation_exercises"] if x["id"].startswith("practice-a"))
    result = lifo_rounds(a)
    if len(result["rounds"]) != a["expected_closed_rounds"]: errors.append("练习 A 回合数不匹配")
    if result["open_quantity"] != a["expected_open_quantity"]: errors.append("练习 A 未平仓数量不匹配")
    if [r["quantity"] for r in result["rounds"]] != [50, 30]: errors.append("练习 A LIFO 配对顺序不匹配")
    if round(sum(x["net"] for x in result["rounds"]), 2) != 1884.0: errors.append("练习 A 闭合净盈亏不匹配")
    if result["open_fees"] != 7.0: errors.append("练习 A 未平仓费用不匹配")
    trends = derived_trends(fixture)
    if len(trends["live"]) < 5: errors.append("实盘趋势有效日期少于5个")
    if len(trends["simulation"]) < 5: errors.append("模拟盘趋势有效日期少于5个")
    symbols = [(x["saved_date"], x["symbol"]) for x in fixture["simulation_exercises"]]
    if len(symbols) == len(set(symbols)): errors.append("模拟盘缺少同标的同日独立练习")
    return errors


def page_switches(x: int, view: str, page: str) -> str:
    view_active = 0 if view == "实盘" else 1
    page_active = 0 if page == "列表" else 1
    return "".join([text(x, 188, "视角", 12, "muted"), rect(x, 196, 182, 36, "raised"), f'<rect x="{x + 4}" y="200" width="82" height="28" rx="6" fill="{COLORS["blue"] if view_active == 0 else COLORS["surface"]}"/>', f'<rect x="{x + 96}" y="200" width="82" height="28" rx="6" fill="{COLORS["blue"] if view_active == 1 else COLORS["surface"]}"/>', text(x + 45, 219, "实盘", 14, "bg" if view_active == 0 else "muted", 600, "middle"), text(x + 137, 219, "模拟盘", 14, "bg" if view_active == 1 else "muted", 600, "middle"), text(x + 206, 188, "页面", 12, "muted"), rect(x + 206, 196, 176, 36, "raised"), f'<rect x="{x + 210}" y="200" width="78" height="28" rx="6" fill="{COLORS["blue"] if page_active == 0 else COLORS["surface"]}"/>', f'<rect x="{x + 292}" y="200" width="78" height="28" rx="6" fill="{COLORS["blue"] if page_active == 1 else COLORS["surface"]}"/>', text(x + 249, 219, "列表", 14, "bg" if page_active == 0 else "muted", 600, "middle"), text(x + 331, 219, "统计", 14, "bg" if page_active == 1 else "muted", 600, "middle")])


def common_chrome(width: int, height: int, title: str, subtitle: str, source: str, view: str, page: str, condition: str, return_label: str = "返回首页", sidebar_active: str = "交易库", sidebar_focus: str | None = None) -> list[str]:
    content_x = 96
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{title} {width}">', f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>', f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/>', sidebar(height, sidebar_active, sidebar_focus), header(width, title, source, return_label), text(content_x, 96, "首页 / 交易库", 12, "muted"), text(content_x, 130, title, 24, "text", 600), text(content_x, 154, subtitle, 14, "muted"), text(width - 24, 130, "已应用条件", 12, "blue", 600, "end"), text(width - 24, 154, condition, 12, "muted", 400, "end"), page_switches(content_x, view, page)]
    return out


def filter_controls(width: int, date_value: str = "2026-10-15", mode: str = "成交日期", include_account: bool = True) -> str:
    narrow = width <= 1280
    y = 262 if narrow else 268
    # 220px is reserved for the search field; long dates remain readable in a 220px date control.
    controls = [control(96, y, 220, mode, date_value, "date"), control(344, y, 160, "市场", "全部市场")]
    if include_account: controls.append(control(532, y, 176, "账户", "全部账户"))
    controls.extend([control(width - 24 - 220 - 28 - 36, y, 220, "交易搜索", "筛选当前列表", "search"), f'<rect x="{width - 24 - 36}" y="{y:g}" width="36" height="36" rx="8" fill="{COLORS["surface"]}" stroke="{COLORS["border"]}"/>', icon_refresh(width - 24 - 36 + 10, y + 10), text(width - 24 - 36 + 18, y + 52, "刷新", 10, "subtle", 400, "middle")])
    return "".join(controls)


def generic_table(x: int, y: int, w: int, h: int, title: str, subtitle: str, headers: list[tuple[str, int, str]], rows: list[list[tuple[str, str, int, str]]], count_label: str, footer: str = "设计样例", total_count: int | None = None, page_count: int = 1) -> str:
    visible = min(len(rows), 6)
    needed = 136 + visible * 48 + 56
    h = max(h, needed)
    out = [rect(x, y, w, h), text(x + 24, y + 34, title, 18, "text", 600), text(x + 24, y + 56, subtitle, 12, "muted"), text(x + w - 24, y + 34, count_label, 14, "muted", 500, "end")]
    for label, offset, anchor in headers: out.append(text(x + offset, y + 88, label, 12, "muted", 400, anchor))
    out.append(line(x + 24, y + 100, x + w - 24, y + 100, "border"))
    row_y = y + 136
    for row in rows[:6]:
        for i, (value, tone, size, _anchor) in enumerate(row):
            offset, anchor = headers[i][1], headers[i][2]
            out.append(text(x + offset, row_y, value, size, tone, 400, anchor))
        out.append(line(x + 24, row_y + 19, x + w - 24, row_y + 19, "border"))
        row_y += 48
    total = len(rows) if total_count is None else total_count
    suffix = f"第 1/{page_count} 页" if page_count > 1 else "第 1 页"
    out.append(text(x + 24, y + h - 24, f"{footer} · 共 {total} 项 · {suffix}", 12, "subtle"))
    return "".join(out)


def trend_card(x: int, y: int, w: int, h: int, title: str, subtitle: str, values: list[dict], break_on_gap: bool = False, value_key: str = "cumulative", empty_label: str = "—") -> str:
    out = [rect(x, y, w, h), text(x + 24, y + 34, title, 18, "text", 600), text(x + 24, y + 57, subtitle, 12, "muted")]
    left, right, top, bottom = x + 72, x + w - 32, y + 90, y + h - 42
    nums = [v.get(value_key, v.get("net", 0)) for v in values]
    if not nums:
        for yy in (top, (top + bottom) / 2, bottom):
            out.extend([line(left, yy, right, yy, "border"), text(left - 10, yy + 5, "—", 12, "subtle", 400, "end")])
        out.append(text(x + 24, y + 132, empty_label, 28, "muted", 600))
        return "".join(out)
    max_v, min_v = max(nums), min(nums)
    if max_v == min_v: max_v, min_v = max_v + 1, min_v - 1
    pad = (max_v - min_v) * .12
    max_v, min_v = max_v + pad, min_v - pad
    zero_y = bottom - (0 - min_v) / (max_v - min_v) * (bottom - top)
    for tick, yy in ((max_v, top), (0, zero_y), (min_v, bottom)):
        out.append(line(left, yy, right, yy, "border" if tick != 0 else "muted", 1, "4 4" if tick == 0 else ""))
        out.append(text(left - 10, yy + 5, fmt(tick), 12, "subtle", 400, "end"))
    points = []
    for i, value in enumerate(values):
        xx = left + (right - left) * (i / max(1, len(values) - 1))
        vv = value.get(value_key, value.get("net", 0))
        yy = bottom - (vv - min_v) / (max_v - min_v) * (bottom - top)
        points.append((xx, yy))
        out.append(f'<circle cx="{xx:g}" cy="{yy:g}" r="4" fill="{COLORS["positive"] if vv >= 0 else COLORS["negative"]}"/>')
        out.append(text(xx, bottom + 22, value["date"][5:], 11, "subtle", 400, "middle"))
    for i, (a, b) in enumerate(zip(points, points[1:])):
        if break_on_gap and (date.fromisoformat(values[i + 1]["date"]) - date.fromisoformat(values[i]["date"])).days > 1: continue
        out.append(line(a[0], a[1], b[0], b[1], "blue" if b[1] <= zero_y else "negative", 2))
    out.append(text(right, top - 12, fmt(nums[-1]), 14, "text", 500, "end"))
    return "".join(out)


def metric_cards(x: int, y: int, w: int, data: list[tuple[str, str]]) -> str:
    gap = 16; cardw = (w - gap * (len(data) - 1)) / len(data); out = []
    for i, (label, value) in enumerate(data):
        xx = x + i * (cardw + gap); out.extend([rect(xx, y, cardw, 96), text(xx + 16, y + 28, label, 12, "muted"), text(xx + 16, y + 70, value, 28, "text", 600)])
    return "".join(out)


def stats_shell(width: int, height: int, title: str, subtitle: str, source: str, condition: str, view: str, stats: dict, selected: str | None = None, status: str | None = None, mode: str = "金额", points: list[dict] | None = None) -> list[str]:
    narrow = width <= 1280; w = width - 120; y = 342 if not narrow else 336
    points = stats.get("points", []) if points is None else points
    out = common_chrome(width, height, title, subtitle, source, view, "统计", condition)
    out.append(filter_controls(width, condition.split(" · ")[0], "统计范围", include_account=view == "实盘"))
    if status == "loading": metrics = [("有效回合", "…"), ("累计净盈亏", "…"), ("胜率", "…"), ("平均盈利", "…"), ("平均亏损", "…"), ("闭合费用", "…")]
    elif not stats.get("rounds") and status in ("empty",): metrics = [("有效回合", "—"), ("累计净盈亏", "—"), ("胜率", "—"), ("平均盈利", "—"), ("平均亏损", "—"), ("闭合费用", "—")]
    else: metrics = [("有效回合", str(stats.get("count", 0))), ("累计净盈亏", fmt(stats.get("net"))), ("胜率", f"{stats['win_rate']:.2f}%" if stats.get("win_rate") is not None else "—"), ("平均盈利", fmt(stats.get("average_profit"))), ("平均亏损", fmt(stats.get("average_loss"))), ("闭合费用", fmt(stats.get("fees")))]
    out.append(metric_cards(96, y, w, metrics))
    out.append(trend_card(96, y + 120, w, 280, "累计净盈亏趋势", "按保存日期" if view == "模拟盘" else "按回合平仓日期", points, break_on_gap=status == "gap", value_key="cumulative"))
    dist = distribution_for(stats.get("rounds", []), mode)
    rows = []
    for d in dist:
        count, rate = d["count"], d["rate"]
        tone = "positive" if "盈利" in d["label"] else "negative" if "亏损" in d["label"] else "muted"
        if status in ("loading",): count, rate = "…", "…"
        elif status == "empty": count, rate = "—", "—"
        rows.append([(d["label"], tone, 14, "start"), (str(count), "text", 14, "end"), (f"{rate:.2f}%" if isinstance(rate, (int,float)) else "—" if rate is None else str(rate), "text", 14, "end")])
    panel_title = "收益分布 · 已选区间" if selected else "收益分布"
    subtitle2 = f"切换：{mode}　·　占比分母 = {stats.get('count', 0)} 个有效回合" if status != "empty" else "当前范围没有有效回合；不生成虚构分布"
    out.append(generic_table(96, y + 424, w, 300 if narrow else 320, panel_title, subtitle2, [("区间",24,"start"),("回合数",606,"end"),("占比",760,"end")], rows, f"{len(dist)} 个区间", "设计样例", total_count=len(dist)))
    if selected:
        chosen = next((d for d in dist if d["label"] == selected), dist[0])
        local = [[(r.get("exercise", "实盘"), "text", 14, "start"), (r["symbol"], "text", 14, "start"), (fmt(r["net"]), "positive" if r["net"] >= 0 else "negative", 14, "end"), ("进入复盘", "blue", 14, "start")] for r in chosen["rounds"]]
        out.append(generic_table(96, y + 760, w, 220, f"区间明细 · {selected}", "仅展示当前区间回合；顶部范围和分母保持不变。", [("练习/来源",24,"start"),("标的",360,"start"),("净盈亏",606,"end"),("动作",760,"start")], local or [[("—","muted",14,"start"),("没有回合","muted",14,"start"),("—","muted",14,"end"),("—","muted",14,"start")]], f"{len(chosen['rounds'])} 个回合", "设计样例", total_count=len(chosen["rounds"])) )
    if status == "error": out.append(text(96, height - 32, "新范围未应用 · 重试将保留原筛选条件", 14, "warning"))
    elif status == "missing":
        missing_count = stats.get("missing_count", 0); total_count = stats.get("count", 0) + missing_count
        fields = "、".join(stats.get("missing_fields", [])) or "必要字段"
        out.append(text(96, height - 32, f"可计算样本 {stats.get('count', 0)} / {total_count} · 缺失输入不纳入分布分母（{fields}）", 14, "warning"))
    return out


def replay_card(x: int, y: int, w: int, h: int, ex: dict, round_data: dict, index: int) -> str:
    out = [rect(x, y, w, h), text(x + 24, y + 34, f"{ex['label']} · 回合 {index} 复盘", 18, "text", 600), text(x + 24, y + 58, f"{ex['symbol']} · {ex['code']} · LIFO 配对", 14, "muted"), line(x + 24, y + 82, x + w - 24, y + 82, "border")]
    trades = ex["trades"]; left, right = x + 56, x + w - 56; base = y + 254
    out.append(line(left, base, right, base, "border", 2))
    min_d, max_d = min(t["date"] for t in trades), max(t["date"] for t in trades)
    span = max(1, (date.fromisoformat(max_d) - date.fromisoformat(min_d)).days)
    for t in trades:
        xx = left + (date.fromisoformat(t["date"]) - date.fromisoformat(min_d)).days / span * (right - left)
        color = "positive" if t["side"] == "买入" else "negative"
        out.append(f'<circle cx="{xx:g}" cy="{base:g}" r="7" fill="{COLORS[color]}"/>')
        out.extend([text(xx, base - 28, t["side"], 14, color, 600, "middle"), text(xx, base + 30, t["date"][5:], 12, "subtle", 400, "middle"), text(xx, base + 52, f"{t['quantity']}股 · {t['price']:.2f}", 12, "muted", 400, "middle")])
    out.extend([text(x + 24, y + 336, "当前回合", 12, "muted"), text(x + 24, y + 368, f"{round_data['quantity']} 股 · {round_data['open_price']:.2f} → {round_data['close_price']:.2f}", 18, "text", 600), text(x + 420, y + 336, "扣费后净盈亏", 12, "muted"), text(x + 420, y + 368, f"{round_data['net']:.2f} CNY", 18, "positive" if round_data["net"] >= 0 else "negative", 600), text(x + w - 24, y + 368, "返回回合集", 14, "blue", 500, "end")])
    return "".join(out)


def home_frame(width: int, height: int, fixture: dict, kind: str) -> list[str]:
    live = derive_live_rounds(fixture); summary = stats_for(live)
    active_source = "来源：首页 · 当前范围" if kind == "entry" else "来源：交易库返回 · 范围已恢复"
    return_label = "当前首页" if kind == "entry" else "返回交易库"
    subtitle = "当前期间 · 实盘" if kind == "entry" else "原期间、位置和交易库入口焦点已恢复"
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="首页交易库入口 {width}">', f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>', f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/>', sidebar(height, "首页", "交易库"), header(width, "首页", active_source, return_label)]
    x, w = 96, width - 120
    out.extend([text(x,96,"首页",12,"muted"), text(x,130,"交易概览",24,"text",600), text(x,154,subtitle,14,"muted"), control(x,196,220,"期间","2026-10-03 至 2026-10-15","date"), control(x+248,196,160,"视角","实盘")])
    data = [("期间净盈亏(CNY)", fmt(summary["net"])), ("期间已实现(CNY)", fmt(summary["net"])), ("期间浮盈变动(CNY)", "—"), ("当前持仓市值(CNY)", fmt(sum(p["quantity"] * p["price"] for p in derive_live_positions(fixture))))]
    gap=16; cardw=(w-gap*3)/4
    for i,(label,val) in enumerate(data):
        xx=x+i*(cardw+gap); out.extend([rect(xx,260,cardw,104),text(xx+16,288,label,12,"muted"),text(xx+16,330,val,28,"positive" if val.startswith("+") else "text",600)])
    points=summary["points"]; out.append(trend_card(x,388,w,250,"累计贡献趋势","当前期间 · 按回合平仓日期",points,value_key="cumulative"))
    out.extend([rect(x,666,w,230), text(x+24,700,"持仓预览",18,"text",600), text(x+w-24,700,"查看全部",14,"blue",500,"end")])
    positions=derive_live_positions(fixture)
    if not positions: positions=[]
    for i,pos in enumerate(positions[:3]):
        yy=744+i*48; out.extend([line(x+24,yy-20,x+w-24,yy-20,"border"),text(x+24,yy,f"{pos['symbol']} · {pos['code']}",14,"text"),text(x+520,yy,f"{pos['quantity']} 股",14,"text",400,"end"),text(x+w-24,yy,"未平仓",14,"muted",400,"end")])
    return out


def _rounds_table(width: int, height: int, fixture: dict, live: bool = False) -> list[str]:
    ex = fixture["simulation_exercises"][0]; result=lifo_rounds(ex); y=342 if width>1280 else 336; w=width-120
    if live:
        rows=derive_live_rounds(fixture); symbol_rows=[r for r in rows if r["symbol"]=="贵州茅台"]
        out=common_chrome(width,height,"实盘对象 · 回合集","选择标的后查看已闭合回合与未平仓余量。","来源：实盘交易列表 · 贵州茅台","实盘","列表","2026-10-03 至 2026-10-12 · 贵州茅台 · 全部市场")
        out.append(filter_controls(width,"2026-10-03 至 2026-10-12","成交日期"))
        table_rows=[[(f"回合 {i+1}","text",14,"start"),(f"{r['quantity']} 股 · {r['open_price']:.2f} → {r['close_price']:.2f}","text",14,"start"),(fmt(r['net']),"positive" if r['net']>=0 else "negative",14,"end"),("已平仓","positive",14,"start")] for i,r in enumerate(symbol_rows)]
        out.append(generic_table(96,y,w,360,"贵州茅台 · 回合集","实盘回合按平仓日归属；未平仓余量保留在来源列表。",[("回合",24,"start"),("配对",360,"start"),("净盈亏",606,"end"),("状态",760,"start")],table_rows,f"{len(table_rows)} 个回合"))
        return out
    out=common_chrome(width,height,"练习 A · 回合集","已闭合回合与未平仓余量来自同一练习样例。","来源：模拟盘练习列表 · 练习 A","模拟盘","列表","练习 A · 贵州茅台 · 保存于 2026-10-15")
    out.append(filter_controls(width,"2026-10-15","保存日期",include_account=False))
    rows=[[(f"回合 {i}","text",14,"start"),(f"LIFO · {r['quantity']} 股","text",14,"start"),(fmt(r['net']),"positive" if r['net']>=0 else "negative",14,"end"),("已平仓","positive",14,"start")] for i,r in enumerate(result["rounds"],1)]
    out.append(generic_table(96,y,w,360,"练习 A · 回合","70 股未平仓不纳入闭合统计。",[("回合",24,"start"),("配对",360,"start"),("净盈亏",606,"end"),("状态",760,"start")],rows,"2 个回合"))
    out.append(metric_cards(96,y+384,w,[("闭合净盈亏",fmt(sum(r["net"] for r in result["rounds"]))),("闭合费用",fmt(result["closed_fees"])),("未平仓",f"{result['open_quantity']} 股")]))
    return out


def state_frame(width: int, height: int, kind: str, fixture: dict) -> str:
    live_rounds, sim_rounds = derive_live_rounds(fixture), derive_sim_rounds(fixture)
    exercises=fixture["simulation_exercises"]; y=342 if width>1280 else 336; w=width-120
    if kind == "simulation-list":
        out=common_chrome(width,height,"练习列表","每次练习保持独立身份；列表与保存日期范围一致。","来源：模拟盘视角 · 已应用","模拟盘","列表","2026-10-15 至 2026-10-19 · 全部市场")
        out.append(filter_controls(width,"2026-10-15 至 2026-10-19","保存日期",False))
        rows=[]
        for ex in exercises:
            result=lifo_rounds(ex); rows.append([(ex["saved_date"],"text",14,"start"),(ex["label"],"text",14,"start"),(f"{ex['symbol']} · {ex['code']}","text",14,"start"),(str(len(result["rounds"])),"text",14,"end"),("已完成" if result["rounds"] else "未完成","positive" if result["rounds"] else "muted",14,"start")])
        out.append(generic_table(96,y,w,452,"模拟盘练习","保存日期范围内 6 个独立练习全部可见。",[("保存日期",24,"start"),("练习",156,"start"),("标的",456,"start"),("已平仓回合",606,"end"),("状态",760,"start")],rows,f"{len(rows)} 项练习"))
    elif kind in ("rounds-a","live-rounds"):
        out = _rounds_table(width,height,fixture,kind=="live-rounds")
    elif kind in ("replay-a1","replay-a2","replay-b1","library-replay"):
        ex=exercises[0] if kind not in ("replay-b1",) else exercises[1]; idx=1 if kind in ("replay-a1","replay-b1","library-replay") else 2; result=lifo_rounds(ex); rd=result["rounds"][min(idx-1,len(result["rounds"])-1)]
        title=f"{ex['label']} · 回合 {idx} 复盘"; out=common_chrome(width,height,title,"回合成交标记、数量和配对结果保持可追踪。","来源：回合集 · 已保留上下文","模拟盘","列表",f"{ex['label']} · {ex['symbol']} · 回合 {idx}")
        out.append(filter_controls(width,ex["saved_date"],"保存日期",False)); out.append(replay_card(96,y,w,460,ex,rd,idx))
    elif kind in ("live-stats","simulation-stats","distribution","return-stats"):
        sim=kind=="simulation-stats"; scope=sim_rounds if sim else live_rounds; start,end=("2026-10-15","2026-10-19") if sim else ("2026-10-03","2026-10-12"); s=stats_for(scope,start,end); title="模拟盘统计" if sim else "实盘统计"; source="来源：模拟盘视角 · 练习保存日期" if sim else "来源：实盘视角 · 回合平仓日期"; condition=f"{start} 至 {end} · 全部市场" + ("" if sim else " · 全部账户")
        selected="盈利 > 100" if kind in ("distribution","return-stats") else None; subtitle="返回后恢复同一范围、分布区间与局部回合列表。" if kind=="return-stats" else "只统计有效已平仓回合；累计趋势与分布来自同一回合集。"
        out=stats_shell(width,height,title,subtitle,source,condition,"模拟盘" if sim else "实盘",s,selected)
    elif kind in ("handoff","library-return"):
        out=home_frame(width,height,fixture,"entry" if kind=="handoff" else "return")
    elif kind == "view-restore":
        out=common_chrome(width,height,"视角往返 · 条件恢复","实盘、模拟盘和再次回到实盘各自保留范围与局部位置。","来源：交易库列表 · 返回实盘","实盘","列表","2026-10-03 至 2026-10-12 · 全部市场 · 全部账户")
        out.append(filter_controls(width,"2026-10-03 至 2026-10-12","成交日期"))
        live_rows=[[(r["date"],"text",14,"start"),(r["symbol"],"text",14,"start"),(str(r["quantity"]),"text",14,"end"),(fmt(r["price"]),"text",14,"end"),("已记录","muted",14,"start")] for r in fixture["live_trades"][:5]]
        out.append(generic_table(96,y,w,380,"返回实盘 · 原列表位置","范围、筛选、页码和触发焦点恢复。",[("成交日期",24,"start"),("标的",360,"start"),("数量",606,"end"),("成交价",700,"end"),("状态",820,"start")],live_rows,"实盘列表"))
        out.append(rect(96,y+404,w,126)); out.extend([text(120,y+438,"往返路径",12,"muted"),text(120,y+476,"实盘  →  模拟盘（2026-10-15 至 2026-10-19）  →  实盘",18,"text",600),text(120,y+504,"再次回到实盘：2026-10-03 至 2026-10-12 · 全部账户",14,"muted")])
    elif kind in ("pending","pending-1280"):
        positions=derive_live_positions(fixture); out=common_chrome(width,height,"待复盘交易","库内显式筛选；未平仓状态由残余数量决定。","来源：交易库内筛选 · 已应用","实盘","列表","2026-10-01 至 2026-10-15 · 待复盘=是 · 全部市场"); out.append(filter_controls(width,"2026-10-01 至 2026-10-15","成交日期")); rows=[[(p["date"],"text",14,"start"),(f"{p['symbol']} · {p['code']}","text",14,"start"),("买入","text",14,"start"),(str(p["quantity"]),"text",14,"end"),("未平仓","warning",14,"start")] for p in positions]; out.append(generic_table(96,y,w,320,"实盘交易 · 待复盘","残余数量大于 0 的开仓成交。",[("成交日期",24,"start"),("标的",156,"start"),("方向",456,"start"),("数量",606,"end"),("状态",760,"start")],rows,f"{len(rows)} 笔交易"))
    elif kind == "month-list":
        trades=[r for r in fixture["live_trades"] if date_between(r["date"],"2026-10-01","2026-10-15")]; out=common_chrome(width,height,"按月进入 · 实盘交易","普通月份范围；一行对应一笔成交。","来源：日期入口 · 月范围已应用","实盘","列表","2026-10-01 至 2026-10-31 · 全部市场 · 全部账户"); out.append(filter_controls(width,"2026-10-01 至 2026-10-31","成交日期")); rows=[[(t["date"],"text",14,"start"),(f"{t['symbol']} · {t['code']}","text",14,"start"),(t["side"],"positive" if t["side"]=="卖出" else "text",14,"start"),(str(t["quantity"]),"text",14,"end"),(fmt(t["price"]),"text",14,"end")] for t in trades]; out.append(generic_table(96,y,w,500,"月份成交明细","按成交日逐笔展示。",[("成交日期",24,"start"),("标的",300,"start"),("方向",560,"start"),("数量",680,"end"),("成交价",780,"end")],rows,f"{len(trades)} 笔成交",total_count=len(trades),page_count=2))
    elif kind in ("trend-month", "trend-year", "trend-gap","trend-single","trend-empty"):
        sim=derive_sim_rounds(fixture)
        if kind == "trend-month":
            base = stats_for(live_rounds); grouped = {}
            for p in base["points"]: grouped.setdefault(p["date"][:7], 0.0); grouped[p["date"][:7]] += p["net"]
            cumulative = 0.0; points=[]
            for month in sorted(grouped): cumulative += grouped[month]; points.append({"date": month + "-01", "net": round(grouped[month], 2), "cumulative": round(cumulative, 2)})
            s = {**base, "points": points}; title="趋势 · 月粒度"; cond="2026-01-01 至 2026-12-31 · 实盘"; status=None
        elif kind == "trend-year":
            base = stats_for(live_rounds); grouped = {}
            for p in base["points"]: grouped.setdefault(p["date"][:4], 0.0); grouped[p["date"][:4]] += p["net"]
            cumulative = 0.0; points=[]
            for year in sorted(grouped): cumulative += grouped[year]; points.append({"date": year + "-01-01", "net": round(grouped[year], 2), "cumulative": round(cumulative, 2)})
            s = {**base, "points": points}; title="趋势 · 年粒度"; cond="2020-01-01 至 2026-12-31 · 实盘"; status=None
        elif kind=="trend-gap":
            s=stats_for(sim); points=[p for p in s["points"] if p["date"] in set(fixture["trend_modes"]["gap_dates"])]; title="趋势 · 日期缺口"; cond="2026-10-15 至 2026-10-19 · 模拟盘"; status="gap"
        elif kind=="trend-single":
            s=stats_for(sim,"2026-10-15","2026-10-15"); points=s["points"]; title="趋势 · 单点样本"; cond="2026-10-15 · 模拟盘"; status=None
        else:
            s=stats_for(live_rounds,"2026-10-20","2026-10-25"); points=[]; title="趋势 · 空样本"; cond="2026-10-20 至 2026-10-25 · 实盘"; status=None
        out=stats_shell(width,height,title,"缺失日期不补零；单点和空样本范围与图内数据一致。","来源：统计 · 日期口径已保留",cond,"模拟盘" if "模拟盘" in cond else "实盘",s,status=status,points=points)
    elif kind in ("loading","empty","error","extreme","missing"):
        scope=live_rounds; normal=stats_for(scope,"2026-10-03","2026-10-12")
        if kind=="loading": out=stats_shell(width,height,"统计加载中","工具区与绘图区保留最终尺寸；结果正在读取。","来源：统计 · 条件已保留","2026-10-03 至 2026-10-12 · 实盘","实盘",normal,status="loading",points=[])
        elif kind=="empty": out=stats_shell(width,height,"没有已平仓回合","当前范围没有有效回合；不生成虚构数据。","来源：统计 · 条件已保留","2026-10-20 至 2026-10-25 · 实盘","实盘",stats_for(scope,"2026-10-20","2026-10-25"),status="empty",points=[])
        elif kind=="error": out=stats_shell(width,height,"统计读取失败","新范围未应用；保留上一组有效结果并提供重试。","来源：统计 · 条件已保留","2026-10-03 至 2026-10-12 · 实盘","实盘",normal,status="error")
        elif kind=="extreme":
            extreme=[]
            for exercise in fixture.get("boundary_exercises", []):
                result=lifo_rounds(exercise)
                for row in result["rounds"]:
                    extreme.append({**row, "date": exercise["saved_date"], "exercise": exercise["label"], "symbol": exercise["symbol"], "code": exercise["code"]})
            exs=stats_for(extreme,"2026-10-03","2026-10-07"); out=stats_shell(width,height,"极端收益分布","完整金额使用分组和刻度保持可读。","来源：统计 · 极值设计样例","2026-10-03 至 2026-10-07 · 实盘","实盘",exs)
        else:
            calculable=normal["rounds"][:1]; missing_meta=fixture["missing_inputs"]; missing={**stats_for(calculable),"missing_count":missing_meta["missing_count"],"missing_fields":missing_meta["missing_fields"]}; out=stats_shell(width,height,"统计输入缺失","可计算回合与缺失输入分别表达；缺失不进入分布。","来源：统计 · 输入缺失样例","2026-10-03 至 2026-10-12 · 实盘","实盘",missing,status="missing"); out.append(text(96, height - 56, f"缺失样本 · {missing_meta['missing_count']} 回合 · 净盈亏 — · {missing_meta['date']} 需补充{'、'.join(missing_meta['missing_fields'])}", 14, "warning"))
    else: raise ValueError(kind)
    if not isinstance(out, list): out=[out]
    return "".join(out+["</svg>"])


FRAME_KINDS = {
    "hcr06-final-sim-ab":"simulation-list", "hcr06-final-rounds-a":"rounds-a", "hcr06-final-replay-a1":"replay-a1", "hcr06-final-replay-a2":"replay-a2", "hcr06-final-replay-b1":"replay-b1", "01-live-normal":"live-stats", "02-simulation-normal":"simulation-stats", "03-distribution-selected":"distribution", "04-return":"return-stats", "handoff":"handoff", "hcr06-final-pending-library":"pending", "hcr06-final-pending-library-1280":"pending-1280", "library-return":"library-return", "hcr06-final-return":"return-stats", "05-loading":"loading", "06-empty":"empty", "07-error":"error", "08-extreme":"extreme", "09-missing-input":"missing", "journeys-date-month":"month-list", "journeys-trend-month":"trend-month", "journeys-trend-year":"trend-year", "journeys-trend-gap":"trend-gap", "journeys-trend-single":"trend-single", "journeys-trend-empty":"trend-empty", "journeys-view-restore":"view-restore", "journeys-library-list":"month-list", "journeys-live-rounds":"live-rounds", "journeys-library-replay":"library-replay", "journeys-live-rounds-return":"live-rounds", "journeys-library-list-return":"month-list",
}


def build_named_frame(stem: str, width: int, height: int, fixture: dict) -> str:
    if stem in ("journeys-date", "journeys-date-1280"): return build_date_frame(width, height, fixture)
    if stem in FRAME_KINDS: return state_frame(width, height, FRAME_KINDS[stem], fixture)
    if stem == "journeys-home-entry": return "".join(home_frame(width, height, fixture, "entry") + ["</svg>"])
    if stem == "journeys-library-return": return "".join(home_frame(width, height, fixture, "return") + ["</svg>"])
    raise ValueError(f"unknown frame: {stem}")


def write_frame(name: str, width: int, height: int, fixture: dict) -> Path:
    path = IMAGE_DIR / name; path.write_text(build_named_frame(path.stem, width, height, fixture), encoding="utf-8"); return path


def main() -> int:
    parser=argparse.ArgumentParser(); choices=["journeys-date","journeys-date-1280","journeys-home-entry","journeys-library-return",*FRAME_KINDS.keys()]; parser.add_argument("--frames",nargs="+",choices=choices,default=["journeys-date","journeys-date-1280"]); args=parser.parse_args(); fixture=json.loads(FIXTURE_PATH.read_text(encoding="utf-8")); errors=validate_fixture(fixture)
    if errors: raise SystemExit("fixture validation failed: "+"; ".join(errors))
    written=[]
    tall = {"01-live-normal", "02-simulation-normal", "03-distribution-selected", "04-return", "hcr06-final-return", "05-loading", "06-empty", "07-error", "08-extreme", "09-missing-input", "journeys-trend-gap", "journeys-trend-single", "journeys-trend-empty"}
    for frame in args.frames:
        if frame.endswith("-1280"):
            written.append(write_frame(f"{frame}.svg", 1280, 800, fixture))
        else:
            written.append(write_frame(f"{frame}.svg", 1440, 1400 if frame in tall else 1000, fixture))
    for path in written:
        root=ElementTree.fromstring(path.read_text(encoding="utf-8")); print(f"generated {path.name}: {root.attrib['width']}x{root.attrib['height']}, bytes={path.stat().st_size}")
    a=lifo_rounds(next(x for x in fixture["simulation_exercises"] if x["id"].startswith("practice-a"))); trends=derived_trends(fixture); print(f"fixture validation: PASS (A=2 closed rounds, open=70, net={sum(x['net'] for x in a['rounds']):.2f} CNY, open fees={a['open_fees']:.2f} CNY)"); print(f"derived trends: live={len(trends['live'])} valid dates, simulation={len(trends['simulation'])} valid dates; gap/single/empty modes derived")
    return 0


if __name__ == "__main__": raise SystemExit(main())
