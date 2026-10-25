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


def sidebar(h: int, active: str = "交易库") -> str:
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
        icon_color = COLORS["blue"] if label == active else COLORS["muted"]
        out.extend([
            f'<svg x="24" y="{y + 2:g}" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="{path}" fill="none" stroke="{icon_color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            text(36, y + 45, label, 12, "blue" if label == active else "muted", 400, "middle")
        ])
    out.append(line(16, h - 56, 56, h - 56, "border"))
    out.append(text(36, h - 28, "账户", 10, "subtle", 500, "middle"))
    return "".join(out)


def header(w: int, title: str = "交易库", source: str = "来源：日期入口 · 已应用", return_label: str = "返回首页") -> str:
    return (f'<rect x="72" y="0" width="{w - 72}" height="64" fill="{COLORS["surface"]}" stroke="{COLORS["border"]}"/>'
            + text(96, 38, title, 24, "text", 600)
            + text(w - 226, 38, source, 12, "muted", 400, "end")
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


def lifo_rounds(exercise: dict) -> dict:
    inventory = []
    rounds = []
    for trade in exercise["trades"]:
        if trade["side"] == "买入":
            inventory.append({"quantity": trade["quantity"], "price": trade["price"], "fee": trade["fee"]})
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
            rounds.append({
                "quantity": quantity,
                "gross": round(gross, 2),
                "opening_fee": round(opening_fee, 2),
                "closing_fee": round(closing_fee, 2),
                "net": round(gross - opening_fee - closing_fee, 2),
            })
            opening["quantity"] -= quantity
            opening["fee"] -= opening_fee
            remaining -= quantity
            remaining_exit_quantity -= quantity
            remaining_exit_fee -= closing_fee
            if opening["quantity"] == 0:
                inventory.pop()
    return {
        "rounds": rounds,
        "closed_fees": round(sum(x["opening_fee"] + x["closing_fee"] for x in rounds), 2),
        "open_fees": round(sum(x["fee"] for x in inventory), 2),
        "open_quantity": sum(x["quantity"] for x in inventory),
    }


def derive_live_rounds(fixture: dict) -> list[dict]:
    """Pair live trades per symbol with the same LIFO fee allocation."""
    by_symbol = {}
    rounds = []
    for trade in fixture["live_trades"]:
        by_symbol.setdefault(trade["code"], {"id": trade["code"], "trades": []})["trades"].append(trade)
    for item in by_symbol.values():
        result = lifo_rounds({"trades": item["trades"]})
        sells = [t for t in item["trades"] if t["side"] == "卖出"]
        for i, closed in enumerate(result["rounds"]):
            rounds.append({**closed, "date": sells[min(i, len(sells) - 1)]["date"]})
    return rounds


def derived_trends(fixture: dict) -> dict:
    live_rounds = derive_live_rounds(fixture)
    live_by_date = {}
    for row in live_rounds:
        live_by_date.setdefault(row["date"], 0.0)
        live_by_date[row["date"]] += row["net"]
    exercises = []
    for exercise in fixture["simulation_exercises"]:
        result = lifo_rounds(exercise)
        exercises.extend({**row, "date": exercise["saved_date"]} for row in result["rounds"])
    sim_by_date = {}
    for row in exercises:
        sim_by_date.setdefault(row["date"], 0.0)
        sim_by_date[row["date"]] += row["net"]
    return {
        "live": [{"date": date, "net": round(live_by_date[date], 2)} for date in sorted(live_by_date)],
        "simulation": [{"date": date, "net": round(sim_by_date[date], 2)} for date in sorted(sim_by_date)],
    }


def validate_fixture(fixture: dict) -> list[str]:
    errors = []
    a = next(x for x in fixture["simulation_exercises"] if x["id"].startswith("practice-a"))
    result = lifo_rounds(a)
    if len(result["rounds"]) != a["expected_closed_rounds"]:
        errors.append("练习 A 回合数不匹配")
    if result["open_quantity"] != a["expected_open_quantity"]:
        errors.append("练习 A 未平仓数量不匹配")
    if [r["quantity"] for r in result["rounds"]] != [50, 30]:
        errors.append("练习 A LIFO 配对顺序不匹配")
    if round(sum(x["net"] for x in result["rounds"]), 2) != 1884.0:
        errors.append("练习 A 闭合净盈亏不匹配")
    if result["open_fees"] != 7.0:
        errors.append("练习 A 未平仓费用不匹配")
    trends = derived_trends(fixture)
    if len(trends["live"]) < 5:
        errors.append("实盘趋势有效日期少于5个")
    if len(trends["simulation"]) < 5:
        errors.append("模拟盘趋势有效日期少于5个")
    same_day_symbols = [(x["saved_date"], x["symbol"]) for x in fixture["simulation_exercises"]]
    if len(same_day_symbols) == len(set(same_day_symbols)):
        errors.append("模拟盘缺少同标的同日独立练习")
    if fixture["trend_modes"]["empty_dates"]:
        errors.append("空样本边界应为空日期列表")
    return errors


def page_switches(x: int, view: str, page: str) -> str:
    view_active = 0 if view == "实盘" else 1
    page_active = 0 if page == "列表" else 1
    return "".join([
        text(x, 188, "视角", 12, "muted"), rect(x, 196, 182, 36, "raised"),
        f'<rect x="{x + 4}" y="200" width="82" height="28" rx="6" fill="{COLORS["blue"] if view_active == 0 else COLORS["surface"]}"/>',
        f'<rect x="{x + 96}" y="200" width="82" height="28" rx="6" fill="{COLORS["blue"] if view_active == 1 else COLORS["surface"]}"/>',
        text(x + 45, 219, "实盘", 14, "bg" if view_active == 0 else "muted", 600, "middle"),
        text(x + 137, 219, "模拟盘", 14, "bg" if view_active == 1 else "muted", 600, "middle"),
        text(x + 206, 188, "页面", 12, "muted"), rect(x + 206, 196, 176, 36, "raised"),
        f'<rect x="{x + 210}" y="200" width="78" height="28" rx="6" fill="{COLORS["blue"] if page_active == 0 else COLORS["surface"]}"/>',
        f'<rect x="{x + 292}" y="200" width="78" height="28" rx="6" fill="{COLORS["blue"] if page_active == 1 else COLORS["surface"]}"/>',
        text(x + 249, 219, "列表", 14, "bg" if page_active == 0 else "muted", 600, "middle"),
        text(x + 331, 219, "统计", 14, "bg" if page_active == 1 else "muted", 600, "middle")
    ])


def common_chrome(width: int, height: int, title: str, subtitle: str, source: str,
                  view: str, page: str, condition: str, return_label: str = "返回首页") -> list[str]:
    content_x = 96
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{title} {width}">',
           f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>',
           f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/>', sidebar(height),
           header(width, title, source, return_label), text(content_x, 96, "首页 / 交易库", 12, "muted"),
           text(content_x, 130, title, 24, "text", 600), text(content_x, 154, subtitle, 14, "muted"),
           text(width - 24, 130, "已应用条件", 12, "blue", 600, "end"),
           text(width - 24, 154, condition, 12, "muted", 400, "end"), page_switches(content_x, view, page)]
    return out


def filter_controls(width: int, date_value: str = "2026-10-15", mode: str = "成交日期", include_account: bool = True) -> str:
    narrow = width <= 1280
    y = 262 if narrow else 268
    controls = [control(96, y, 220, mode, date_value, "date"), control(344, y, 160, "市场", "全部市场")]
    if include_account:
        controls.append(control(532, y, 176, "账户", "全部账户"))
    controls.extend([control(width - 24 - 220 - 28 - 36, y, 220, "交易搜索", "筛选当前列表", "search"),
                     f'<rect x="{width - 24 - 36}" y="{y:g}" width="36" height="36" rx="8" fill="{COLORS["surface"]}" stroke="{COLORS["border"]}"/>',
                     icon_refresh(width - 24 - 36 + 10, y + 10),
                     text(width - 24 - 36 + 18, y + 52, "刷新", 10, "subtle", 400, "middle")])
    return "".join(controls)


def generic_table(x: int, y: int, w: int, h: int, title: str, subtitle: str,
                  headers: list[tuple[str, int, str]], rows: list[list[tuple[str, str, int, str]]], count_label: str,
                  footer: str = "设计样例") -> str:
    out = [rect(x, y, w, h), text(x + 24, y + 34, title, 18, "text", 600),
           text(x + 24, y + 56, subtitle, 12, "muted"), text(x + w - 24, y + 34, count_label, 14, "muted", 500, "end")]
    for label, offset, anchor in headers:
        out.append(text(x + offset, y + 88, label, 12, "muted", 400, anchor))
    out.append(line(x + 24, y + 100, x + w - 24, y + 100, "border"))
    row_y = y + 136
    for row in rows:
        for i, (value, tone, size, _anchor) in enumerate(row):
            offset = headers[i][1]
            anchor = headers[i][2]
            out.append(text(x + offset, row_y, value, size, tone, 400, anchor))
        out.append(line(x + 24, row_y + 19, x + w - 24, row_y + 19, "border"))
        row_y += 48
    out.append(text(x + 24, y + h - 24, f"{footer} · 共 {len(rows)} 项 · 第 1 页", 12, "subtle"))
    return "".join(out)


def trend_card(x: int, y: int, w: int, h: int, title: str, subtitle: str,
               values: list[dict], break_on_gap: bool = False) -> str:
    out = [rect(x, y, w, h), text(x + 24, y + 34, title, 18, "text", 600), text(x + 24, y + 57, subtitle, 12, "muted")]
    left, right, top, bottom = x + 48, x + w - 32, y + 90, y + h - 42
    out.append(line(left, (top + bottom) // 2, right, (top + bottom) // 2, "border"))
    if not values:
        out.append(text(x + 24, y + 112, "—", 28, "muted", 600))
        return "".join(out)
    max_abs = max(abs(v["net"]) for v in values) or 1
    points = []
    for i, value in enumerate(values):
        xx = left + (right - left) * (i / max(1, len(values) - 1))
        yy = (top + bottom) / 2 - value["net"] / max_abs * ((bottom - top) / 2 - 8)
        points.append((xx, yy))
        out.append(f'<circle cx="{xx:g}" cy="{yy:g}" r="4" fill="{COLORS["positive"] if value["net"] >= 0 else COLORS["negative"]}"/>')
        out.append(text(xx, bottom + 22, value["date"][5:], 11, "subtle", 400, "middle"))
    for i, (a, b) in enumerate(zip(points, points[1:])):
        if break_on_gap:
            previous = date.fromisoformat(values[i]["date"])
            current = date.fromisoformat(values[i + 1]["date"])
            if (current - previous).days > 1:
                continue
        out.append(line(a[0], a[1], b[0], b[1], "blue" if b[1] <= (top + bottom) / 2 else "negative", 2))
    out.append(text(right, top - 12, f"{values[-1]['net']:.2f}", 14, "text", 500, "end"))
    return "".join(out)


def metric_cards(x: int, y: int, w: int, data: list[tuple[str, str]]) -> str:
    gap = 16
    cardw = (w - gap * (len(data) - 1)) / len(data)
    out = []
    for i, (label, value) in enumerate(data):
        xx = x + i * (cardw + gap)
        out.extend([rect(xx, y, cardw, 96), text(xx + 16, y + 28, label, 12, "muted"), text(xx + 16, y + 70, value, 28, "text", 600)])
    return "".join(out)


def state_frame(width: int, height: int, kind: str, fixture: dict) -> str:
    """Render every cited state inside the same full-page shell."""
    narrow = width <= 1280
    w = width - 120
    y = 342 if not narrow else 336
    trends = derived_trends(fixture)
    live_rows = fixture["live_trades"]
    exercises = fixture["simulation_exercises"]
    if kind == "simulation-list":
        out = common_chrome(width, height, "练习列表", "保存日期条件已应用；每次练习保持独立身份。", "来源：模拟盘视角 · 已应用", "模拟盘", "列表", "2026-10-15 · 全部市场")
        out.append(filter_controls(width, "2026-10-15", "保存日期", include_account=False))
        rows = []
        for ex in exercises:
            result = lifo_rounds(ex)
            rows.append([(ex["saved_date"], "text", 14, "start"), (ex["label"], "text", 14, "start"), (f'{ex["symbol"]} · {ex["code"]}', "text", 14, "start"), (str(len(result["rounds"])), "text", 14, "end"), ("已完成" if result["rounds"] else "未完成", "positive" if result["rounds"] else "muted", 14, "start")])
        headers=[("保存日期",24,"start"),("练习",156,"start"),("标的",456,"start"),("已平仓回合",606,"end"),("状态",760,"start")]
        out.append(generic_table(96, y, w, 452, "模拟盘练习", "按练习保存日期统计；不按行情日期替代。", headers, rows, f"{len(rows)} 项练习"))
    elif kind == "rounds-a":
        ex = exercises[0]; result = lifo_rounds(ex)
        out = common_chrome(width, height, "练习 A · 回合集", "点击练习后直接到达；LIFO 配对保留未平仓余量。", "来源：模拟盘练习列表 · 练习 A", "模拟盘", "列表", "练习 A · 贵州茅台 · 保存于 2026-10-15")
        out.append(filter_controls(width, "2026-10-15", "练习日期", include_account=False))
        rows=[]
        for i, r in enumerate(result["rounds"],1):
            rows.append([(f"回合 {i}", "text", 14, "start"), (f"LIFO · {r['quantity']} 股", "text", 14, "start"), (f"净盈亏 {r['net']:.2f}", "positive" if r["net"] >= 0 else "negative", 14, "end"), ("已平仓", "positive", 14, "start")])
        headers=[("回合",24,"start"),("配对",156,"start"),("净盈亏",606,"end"),("状态",760,"start")]
        out.append(generic_table(96, y, w, 360, "练习 A · 回合", "已平仓 2 回合 · 未平仓 70 股不纳入闭合统计。", headers, rows, "2 个回合"))
        out.append(metric_cards(96, y+384, w, [("闭合净盈亏", "1884.00"), ("闭合费用", "16.00"), ("未平仓", "70 股")]))
    elif kind in ("replay-a1", "replay-a2", "replay-b1"):
        ex = exercises[0] if kind != "replay-b1" else exercises[1]
        result = lifo_rounds(ex)
        index = 1 if kind == "replay-a1" else 2 if kind == "replay-a2" else 1
        round_data = result["rounds"][min(index-1, len(result["rounds"])-1)] if result["rounds"] else None
        label = f"{ex['label']} · 回合 {index} 复盘"
        out = common_chrome(width, height, label, "既有详情容器 · 复盘携带练习和回合身份。", "来源：回合集 · 已保留上下文", "模拟盘", "列表", f"{ex['label']} · {ex['symbol']} · 回合 {index}")
        out.append(filter_controls(width, ex["saved_date"], "保存日期", include_account=False))
        card = [rect(96, y, w, 460), text(120, y+36, label, 18, "text", 600), text(120, y+61, "开仓上下文与配对结果", 14, "muted"), line(120,y+84,width-48,y+84,"border")]
        if round_data:
            card.extend([text(120,y+130,"配对规则",12,"muted"),text(120,y+160,"LIFO · 最近开仓优先",14,"text"),text(120,y+214,"数量",12,"muted"),text(120,y+244,f"{round_data['quantity']} 股",28,"text",600),text(420,y+214,"净盈亏",12,"muted"),text(420,y+244,f"{round_data['net']:.2f} CNY",28,"positive" if round_data["net"]>=0 else "negative",600),text(720,y+214,"费用",12,"muted"),text(720,y+244,f"{round_data['opening_fee']+round_data['closing_fee']:.2f} CNY",28,"text",600),text(120,y+322,"复盘位置",12,"muted"),text(120,y+350,"交易图表 · 当前回合成交已定位",14,"text"),text(width-48,y+350,"返回回合集",14,"blue",500,"end")])
        out.append("".join(card))
    elif kind in ("live-stats", "simulation-stats", "distribution", "return-stats"):
        sim = kind == "simulation-stats"
        vals = trends["simulation"] if sim else trends["live"]
        if kind == "return-stats": vals = trends["live"]
        title = "模拟盘统计" if sim else "实盘统计"
        if kind == "distribution": title = "收益分布 · 区间已展开"
        if kind == "return-stats": title = "实盘统计 · 返回后恢复"
        source = "来源：模拟盘视角 · 练习保存日期" if sim else "来源：实盘视角 · 回合平仓日期"
        condition = "2026-10-15 至 2026-10-19 · 全部市场" if sim else "2026-10-15 至 2026-10-19 · 全部市场 · 全部账户"
        out = common_chrome(width, height, title, "统计仅纳入有效已平仓回合；范围、视角和位置可恢复。", source, "模拟盘" if sim else "实盘", "统计", condition)
        out.append(filter_controls(width, "2026-10-15 至 2026-10-19", "统计范围", include_account=not sim))
        net = sum(v["net"] for v in vals)
        out.append(metric_cards(96, y, w, [("有效回合", str(len(vals))), ("累计净盈亏", f"{net:.2f}"), ("胜率", f"{sum(1 for v in vals if v['net'] > 0) / max(1,len(vals)) * 100:.2f}%")]))
        out.append(trend_card(96, y+120, w, 280, "累计净盈亏趋势", "按保存日期" if sim else "按回合平仓日期", vals))
        if kind == "distribution":
            out.append(generic_table(96, y+424, w, 230, "收益分布", "占比分母固定为当前范围内全部有效回合。", [("区间",24,"start"),("回合数",606,"end"),("占比",760,"end")], [[("盈利", "positive",14,"start"),("3", "text",14,"end"),("60.00%", "text",14,"end")],[("亏损", "negative",14,"start"),("2", "text",14,"end"),("40.00%", "text",14,"end")]], "5 个回合", "设计样例"))
        else:
            out.append(text(120, y+438, "点击回合可进入复盘；返回后恢复原区间与列表位置。", 14, "muted"))
    elif kind in ("handoff", "library-return"):
        return "".join(home_frame(width, height, fixture, "handoff" if kind == "handoff" else "library-return"))
    elif kind in ("pending", "pending-1280"):
        cond = "2026-10-15 · 待复盘=是 · 全部市场"
        out = common_chrome(width, height, "待复盘交易", "库内显式筛选 · 来源条件保留。", "来源：交易库内筛选 · 已应用", "实盘", "列表", cond)
        out.append(filter_controls(width, "2026-10-15", "成交日期"))
        pending = [r for r in live_rows if r["side"] == "买入"]
        rows=[]
        for r in pending:
            rows.append([(r["date"],"text",14,"start"),(f'{r["symbol"]} · {r["code"]}',"text",14,"start"),(r["side"],"text",14,"start"),(str(r["quantity"]),"text",14,"end"),("待复盘","warning",14,"start")])
        out.append(generic_table(96, y, w, 404, "实盘交易 · 待复盘", "待复盘由交易库内显式筛选触发。", [("成交日期",24,"start"),("标的",156,"start"),("方向",456,"start"),("数量",576,"end"),("状态",760,"start")], rows, f"{len(rows)} 笔交易"))
    elif kind in ("month-list", "trend-gap", "trend-single", "trend-empty"):
        if kind == "month-list":
            out = common_chrome(width, height, "按月进入 · 实盘交易", "普通月份范围 · 起止日期已应用；列表按成交日筛选。", "来源：日期入口 · 月范围已应用", "实盘", "列表", "2026-10-01 至 2026-10-31 · 全部市场 · 全部账户")
            out.append(filter_controls(width, "2026-10-01 至 2026-10-31", "成交日期"))
            rows = [[(v["date"], "text", 14, "start"), ("实盘汇总", "text", 14, "start"), (f'{v["net"]:.2f}', "positive" if v["net"] >= 0 else "negative", 14, "end")] for v in trends["live"]]
            out.append(generic_table(96, y, w, 520, "月范围成交概览", "起止日期包含在内；缺口日期不补零。", [("日期",24,"start"),("口径",456,"start"),("净盈亏",760,"end")], rows, f"{len(rows)} 个有效日期"))
        else:
            vals = trends["live"] if kind == "trend-gap" else trends["live"][:1] if kind == "trend-single" else []
            title = {"trend-gap":"趋势 · 日期缺口", "trend-single":"趋势 · 单点样本", "trend-empty":"趋势 · 空样本"}[kind]
            subtitle = {"trend-gap":"按日展示；缺失日期保持断点。", "trend-single":"单个有效日期；不外推不存在的值。", "trend-empty":"当前范围没有有效样本；缺失值显示破折号。"}[kind]
            out = common_chrome(width, height, title, subtitle, "来源：统计 · 日期口径已保留", "实盘", "统计", "2026-10-15 · 全部市场 · 全部账户")
            out.append(filter_controls(width, "2026-10-15", "统计范围"))
            out.append(trend_card(96, y, w, 360, title, subtitle, vals, break_on_gap=kind == "trend-gap"))
            out.append(rect(96, y+384, w, 132)); out.append(text(120, y+426, "缺失日期" if kind == "trend-gap" else "有效样本", 12, "muted")); out.append(text(120, y+468, "不连接缺口" if kind == "trend-gap" else ("—" if kind == "trend-empty" else "1 个有效日期"), 28, "text", 600))
    elif kind in ("loading", "empty", "error", "extreme", "missing"):
        title = {"loading":"统计加载中", "empty":"没有已平仓回合", "error":"统计读取失败", "extreme":"极端收益分布", "missing":"统计输入缺失"}[kind]
        out = common_chrome(width, height, title, "统计结构保留；状态只改变结果区。", "来源：统计 · 条件已保留", "实盘", "统计", "2026-10-15 至 2026-10-19 · 全部市场 · 全部账户")
        out.append(filter_controls(width, "2026-10-15 至 2026-10-19", "统计范围"))
        if kind == "extreme":
            vals=[{"date":"2026-10-15","net":1884.0},{"date":"2026-10-16","net":-420.0},{"date":"2026-10-17","net":1240.0},{"date":"2026-10-18","net":-104.0},{"date":"2026-10-19","net":106.0}]
            out.append(metric_cards(96,y,w,[("有效回合","5"),("最大单回合","1884.00"),("最小单回合","-420.00")]))
            out.append(trend_card(96,y+120,w,280,"收益趋势","极端值保留正负刻度",vals))
        else:
            msg={"loading":"正在读取当前范围…","empty":"当前范围没有已平仓回合","error":"新范围未应用；可按原筛选条件重试","missing":"— · 不可计算；输入缺失不纳入分布"}[kind]
            out.append(rect(96,y,w,420)); out.append(text(120,y+62,msg,18,"text",600)); out.append(text(120,y+94,"日期、视角、工具区和结果区位置保持不变。",14,"muted"))
            if kind == "error": out.append(text(120,y+154,"重试",14,"blue",500))
    else:
        raise ValueError(kind)
    out.append("</svg>")
    return "".join(out)


def home_frame(width: int, height: int, fixture: dict, kind: str) -> list[str]:
    """Complete homepage host for entry/return; no historical pending badge."""
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="首页交易库入口 {width}">',
           f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>', f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/>', sidebar(height), header(width, "首页", "来源：交易库返回 · 范围已恢复", "返回交易库")]
    x, w = 96, width - 120
    out.extend([text(x,96,"首页",12,"muted"), text(x,130,"交易概览",24,"text",600), text(x,154,"原期间、位置与交易库入口焦点已恢复。",14,"muted")])
    metrics=[("总资产","1,240,000.00"),("今日盈亏","+1,240.00"),("持仓市值","820,000.00"),("可用资金","420,000.00")]
    gap=16; cardw=(w-gap*3)/4
    for i,(label,val) in enumerate(metrics):
        xx=x+i*(cardw+gap); out.extend([rect(xx,196,cardw,104),text(xx+16,224,label,12,"muted"),text(xx+16,272,val,28,"positive" if "+" in val else "text",600)])
    out.append(trend_card(x,324,w,260,"累计贡献趋势","当前期间 · 上海时区",derived_trends(fixture)["live"]))
    out.append(rect(x,608,w,252)); out.extend([text(x+24,642,"持仓预览",18,"text",600),text(x+w-24,642,"查看全部",14,"blue",500,"end")])
    holdings=[("中芯国际 · 688981","80 股","未平仓"),("贵州茅台 · 600519","60 股","已平仓部分")]
    for i,(name,qty,status) in enumerate(holdings):
        yy=686+i*64; out.extend([line(x+24,yy-20,x+w-24,yy-20,"border"),text(x+24,yy,name,14,"text"),text(x+520,yy,qty,14,"text",400,"end"),text(x+w-24,yy,status,14,"muted",400,"end")])
    out.append(rect(x+w-270,92,246,36,"raised")); out.append(text(x+w-147,115,"进入交易库 · 已恢复范围",14,"blue",500,"middle"))
    out.append("</svg>")
    return out


FRAME_KINDS = {
    "hcr06-final-sim-ab": "simulation-list",
    "hcr06-final-rounds-a": "rounds-a",
    "hcr06-final-replay-a1": "replay-a1",
    "hcr06-final-replay-a2": "replay-a2",
    "hcr06-final-replay-b1": "replay-b1",
    "01-live-normal": "live-stats",
    "02-simulation-normal": "simulation-stats",
    "03-distribution-selected": "distribution",
    "04-return": "return-stats",
    "handoff": "handoff",
    "hcr06-final-pending-library": "pending",
    "hcr06-final-pending-library-1280": "pending-1280",
    "library-return": "library-return",
    "hcr06-final-return": "return-stats",
    "05-loading": "loading",
    "06-empty": "empty",
    "07-error": "error",
    "08-extreme": "extreme",
    "09-missing-input": "missing",
    "journeys-date-month": "month-list",
    "journeys-trend-gap": "trend-gap",
    "journeys-trend-single": "trend-single",
    "journeys-trend-empty": "trend-empty",
}


def build_named_frame(stem: str, width: int, height: int, fixture: dict) -> str:
    if stem == "journeys-date":
        return build_date_frame(width, height, fixture)
    if stem == "journeys-date-1280":
        return build_date_frame(width, height, fixture)
    if stem in FRAME_KINDS:
        return state_frame(width, height, FRAME_KINDS[stem], fixture)
    if stem in ("journeys-home-entry", "journeys-library-return"):
        return "".join(home_frame(width, height, fixture, "handoff" if stem.endswith("entry") else "library-return"))
    raise ValueError(f"unknown frame: {stem}")


def write_frame(name: str, width: int, height: int, fixture: dict) -> Path:
    path = IMAGE_DIR / name
    path.write_text(build_named_frame(path.stem, width, height, fixture), encoding="utf-8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser()
    choices = ["journeys-date", "journeys-date-1280", "journeys-home-entry", "journeys-library-return", *FRAME_KINDS.keys()]
    parser.add_argument("--frames", nargs="+", choices=choices, default=["journeys-date", "journeys-date-1280"])
    args = parser.parse_args()
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    errors = validate_fixture(fixture)
    if errors:
        raise SystemExit("fixture validation failed: " + "; ".join(errors))
    written = []
    for frame in args.frames:
        if frame.endswith("-1280"):
            written.append(write_frame(f"{frame}.svg", 1280, 800, fixture))
        else:
            written.append(write_frame(f"{frame}.svg", 1440, 1000, fixture))
    for path in written:
        root = ElementTree.fromstring(path.read_text(encoding="utf-8"))
        width, height = int(root.attrib["width"]), int(root.attrib["height"])
        print(f"generated {path.name}: {width}x{height}, bytes={path.stat().st_size}")
    trends = derived_trends(fixture)
    print("fixture validation: PASS (A=2 closed rounds, open=70, net=1884.00 CNY, open fees=7.00 CNY)")
    print(f"derived trends: live={len(trends['live'])} valid dates, simulation={len(trends['simulation'])} valid dates; gap/single/empty modes declared")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
