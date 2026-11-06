#!/usr/bin/env python3
"""Build the time, results, and compare design boards.

Static design source only.  Every number is synthetic and is labelled in the
rendered boards.  This file deliberately has its own small SVG vocabulary so
it can run after build-artboards.py without importing or mutating that module.
"""
from __future__ import annotations

from pathlib import Path
from datetime import date
import json
import sys

OUT = Path(__file__).parent / "images"
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((Path(__file__).parent / "example-data.json").read_text(encoding="utf-8"))

BG = "#0B1019"
PANEL = "#111A26"
RAISED = "#162233"
BORDER = "#283448"
TEXT = "#E6EDF7"
SECONDARY = "#A8B6CB"
MUTED = "#71829B"
BLUE = "#6CA8FF"
FOCUS = "#A9C8FF"
GREEN = "#53D7A0"
RED = "#FF8592"
WARN = "#FFC66D"
NEG = "#EF7F89"
PURPLE = "#B59AFF"
CYAN = "#63D4DF"
ORANGE = "#F3A66B"
FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
NUM = "font-variant-numeric:tabular-nums;"


def esc(value: object) -> str:
    return (str(value).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def txt(x, y, value, size=14, fill=TEXT, weight=400, anchor="start", num=False):
    style = f"font-family:{FONT};font-size:{size}px;font-weight:{weight};fill:{fill};"
    if num:
        style += NUM
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{style}">{esc(value)}</text>'


def rect(x, y, w, h, fill=PANEL, stroke=BORDER, radius=8, sw=1):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')


def ln(x1, y1, x2, y2, stroke=BORDER, sw=1, dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{extra}/>'


def path(d, stroke=BLUE, sw=2, fill="none", dash=""):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<path d="{d}" stroke="{stroke}" stroke-width="{sw}" fill="{fill}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'


def chip(x, y, label, color=BLUE, width=None, fill="#172536"):
    width = width or max(64, len(label) * 14 + 24)
    return (rect(x, y, width, 24, fill, color, 6) +
            txt(x + width / 2, y + 17, label, 12, color, 600, "middle"))


def button(x, y, label, width, primary=False, disabled=False):
    if disabled:
        return rect(x, y, width, 36, "#151E2B", "#202B3A", 6) + txt(x + width / 2, y + 23, label, 14, MUTED, 600, "middle")
    fill, stroke, color = (BLUE, FOCUS, BG) if primary else (RAISED, BORDER, TEXT)
    return rect(x, y, width, 36, fill, stroke, 6) + txt(x + width / 2, y + 23, label, 14, color, 600, "middle")


def field(x, y, width, label, value, hint=""):
    s = rect(x, y, width, 56, PANEL, BORDER, 6)
    s += txt(x + 12, y + 19, label, 12, SECONDARY)
    s += txt(x + 12, y + 42, value, 14, TEXT, 500, num=True)
    if hint:
        s += txt(x + width - 12, y + 42, hint, 12, MUTED, 400, "end")
    return s


def opening(title, subtitle, width, height):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
    s += f'<rect width="{width}" height="{height}" fill="{BG}"/>'
    s += rect(0, 0, 54, height, "#0D1522", "none", 0)
    s += txt(27, 31, "TR", 14, BLUE, 700, "middle") + ln(54, 0, 54, height) + ln(54, 48, width, 48)
    s += txt(78, 30, "策略", 15, TEXT, 600) + txt(128, 30, "我的实验", 13, BLUE, 500) + txt(218, 30, "EMA20 · 2024 Q3", 13, SECONDARY)
    s += txt(width - 78, 30, "帮助", 13, SECONDARY, 400, "end") + txt(width - 32, 30, "林", 13, TEXT, 600, "end")
    s += txt(100, 86, title, 24, TEXT, 600) + txt(100, 112, subtitle, 14, SECONDARY)
    s += rect(width - 220, height - 34, 196, 22, "#171E2A", "#303B4D", 11) + txt(width - 122, height - 19, "虚构数据 · 视觉方案", 11, MUTED, 500, "middle")
    return s


def close():
    return "</svg>"


def mode_slots(x, y, active):
    names = ["回放观察", "阶段结果", "组合对比"]
    s = txt(x, y + 17, "查看模式", 12, MUTED)
    for i, label in enumerate(names):
        selected = i == active
        s += chip(x + 74 + i * 112, y, label, BLUE if selected else MUTED, 96,
                  "#1B304A" if selected else "#151F2E")
    return s


def identity_and_summary(x, y, width, active, date_label, status="运行已完成", show_modes=True):
    mode_offset = 0 if show_modes else -64
    s = rect(x, y, width, 64, RAISED, BORDER, 8)
    s += chip(x + 16, y + 14, status, BLUE, 88, "#172536")
    s += txt(x + 122, y + 28, "EMA20 v1.4", 16, TEXT, 600)
    s += txt(x + 122, y + 49, "合成实验 · 独立本金 ¥100,000.00 · 2024-06-14 15:00 Asia/Shanghai", 12, SECONDARY)
    s += txt(x + width - 18, y + 28, date_label, 14, TEXT, 600, "end", True)
    s += txt(x + width - 18, y + 49, "当前实验身份", 12, MUTED, 400, "end")
    if show_modes:
        s += rect(x, y + 80, width, 48, PANEL, BORDER, 6) + mode_slots(x + 18, y + 92, active)
    metrics_y = y + 144 + mode_offset
    s += rect(x, metrics_y, width, 88, RAISED, BORDER, 8)
    metrics = [("净资产", "¥102,540.84", "结果末值", TEXT),
               ("累计收益", "+2.54%", "净值 1.0254", GREEN),
               ("最大回撤", "-3.20%", "期间峰值回撤", RED),
               ("仓位", "90.0%", "当前投影", TEXT)]
    cell = width / 4
    for i, (label, value, note, color) in enumerate(metrics):
        if i:
            s += ln(x + i * cell, metrics_y + 14, x + i * cell, metrics_y + 74)
        s += txt(x + i * cell + 16, metrics_y + 27, label, 12, SECONDARY)
        s += txt(x + (i + 1) * cell - 16, metrics_y + 60, value, 28, color, 600, "end", True)
        s += txt(x + i * cell + 16, metrics_y + 76, note, 12, MUTED)
    result_y = y + 248 + mode_offset
    s += rect(x, result_y, width, 60, RAISED, BORDER, 8)
    s += chip(x + 14, result_y + 18, "结果已生成", BLUE, 88, "#172536")
    s += txt(x + 120, result_y + 28, "统计截止", 12, MUTED) + txt(x + 120, result_y + 48, "2024-09-13 · 收盘后", 14, TEXT, 600)
    s += txt(x + 420, result_y + 28, "共同有效区间", 12, MUTED) + txt(x + 420, result_y + 48, "2024-06-14—2024-09-13", 14, TEXT, 600, "start", num=True)
    s += field(x + width - 220, result_y + 2, 220, "当前查看日", date_label, "⌄")
    return s


# Synthetic OHLC values.  Prices are deliberately in a real numeric range
# (10.00–11.00); y coordinates below are derived from these values.
OHLC = [
    ("2024-06-10", 10.12, 10.22, 10.05, 10.26),
    ("2024-06-11", 10.18, 10.36, 10.14, 10.40),
    ("2024-06-12", 10.31, 10.28, 10.18, 10.34),
    ("2024-06-13", 10.24, 10.52, 10.21, 10.56),
    ("2024-06-14", 10.47, 10.58, 10.39, 10.62),
    ("2024-06-17", 10.53, 10.83, 10.49, 10.86),
]


def price_y(value, top, bottom, low=10.0, high=11.0):
    return bottom - ((value - low) / (high - low)) * (bottom - top)


def candle_plot(x, y, width, height, count, marker=False, compact=False):
    """Render a clipped OHLC chart; all wick/body coordinates come from prices."""
    s = rect(x, y, width, height, "#0F1826", BORDER, 8)
    # Leave an interior gutter after the last bar.  This keeps the 6/17 bar,
    # wick, and trade annotation visible instead of clipping at the right edge.
    plot_l, plot_r = x + 54, x + width - 50
    bar_l, bar_r = plot_l + 12, plot_r - 12
    plot_t, plot_b = y + 46, y + height - 40
    clip_id = f"clip-{x}-{y}-{width}-{height}".replace(".", "_")
    s += f'<defs><clipPath id="{clip_id}"><rect x="{plot_l}" y="{plot_t}" width="{plot_r-plot_l}" height="{plot_b-plot_t}" rx="2"/></clipPath></defs>'
    s += txt(x + 16, y + 25, "标的 K 线 · 合成价格", 14 if not compact else 12, TEXT, 600)
    s += txt(x + width - 16, y + 25, "价格轴 10.00—11.00", 12, MUTED, 400, "end", True)
    price_ticks = (10.0, 10.5, 11.0) if compact else (10.0, 10.25, 10.5, 10.75, 11.0)
    for value in price_ticks:
        yy = price_y(value, plot_t, plot_b)
        s += ln(plot_l, yy, plot_r, yy, BORDER)
        s += txt(plot_l - 8, yy + 4, f"{value:.2f}", 12, MUTED, 400, "end", True)
    visible = OHLC[:count]
    step = (bar_r - bar_l) / max(1, len(OHLC) - 1)
    with_clip = []
    for idx, (_date, op, close, low, high) in enumerate(visible):
        bx = bar_l + idx * step
        wy1, wy2 = price_y(high, plot_t, plot_b), price_y(low, plot_t, plot_b)
        by1, by2 = price_y(max(op, close), plot_t, plot_b), price_y(min(op, close), plot_t, plot_b)
        color = GREEN if close >= op else NEG
        with_clip.append(ln(bx, wy1, bx, wy2, color, 2))
        with_clip.append(rect(bx - 8, by1, 16, max(6, by2 - by1), color, color, 2))
        show_date = (not compact) or idx in (0, len(visible) - 1)
        if show_date:
            s += txt(bx, plot_b + 24, _date[5:], 12, MUTED, 400, "middle")
    s += f'<g clip-path="url(#{clip_id})">' + "".join(with_clip) + "</g>"
    if marker:
        bx = bar_l + (count - 1) * step
        _date, op, close, low, high = visible[-1]
        cy = price_y(close, plot_t, plot_b)
        marker_x = max(plot_l + 14, bx - 22)
        s += f'<path d="M {marker_x} {cy-21} L {marker_x+11} {cy-9} L {marker_x} {cy+3} L {marker_x-11} {cy-9} Z" fill="{GREEN}" stroke="{GREEN}"/>'
        s += txt(marker_x - 16, cy - 12, "首次建仓 · 2 笔", 11, GREEN, 600, "end")
    return s


def mini_candle_plot(x, y, width, height, count, marker=False):
    return candle_plot(x, y, width, height, count, marker, True)


def make_time_states():
    width, height = 1440, 1010
    s = opening("推进与回看", "三帧同尺度分镜：先隐藏未来，再揭示首日成交，最后回看起点并保留已看来源", width, height)
    x, gap, card_w = 100, 10, 404
    frames = [
        ("07a · T0 起点", "当前查看日 2024-06-14", "行情 M = 6/14 · 成交 E = 无", BLUE, 5, False),
        ("07b · 首日推进", "当前查看日 2024-06-17", "行情 M = 6/17 · 成交 E = 6/17", GREEN, 6, True),
        ("07c · 回看起点", "当前查看日 2024-06-14", "行情 M = 6/28 · 当前投影成交无", WARN, 5, False),
    ]
    for i, (title, day, cutoff, color, count, marker) in enumerate(frames):
        xx = x + i * (card_w + gap)
        s += rect(xx, 158, card_w, 680, PANEL, BORDER, 8)
        s += txt(xx + 20, 193, title, 18, TEXT, 600)
        s += txt(xx + 20, 219, day, 14, SECONDARY, 500, num=True)
        s += chip(xx + 20, 237, "首日成交" if marker else ("回看" if i == 2 else "T0"), color, 82, "#153128" if marker else ("#332918" if i == 2 else "#172536"))
        s += txt(xx + 116, 254, cutoff, 12, MUTED)
        s += mini_candle_plot(xx + 20, 278, card_w - 40, 300, count, marker)
        s += txt(xx + 20, 609, "当前持仓", 12, MUTED) + txt(xx + card_w - 20, 609, "A 0% · B 0% · 现金 100%" if not marker else "A 44.5% · B 45.5% · 现金 10%", 13, GREEN if marker else TEXT, 600, "end")
        s += txt(xx + 20, 640, "结果 R", 12, MUTED) + txt(xx + card_w - 20, 640, "未生成（≤ M）", 13, TEXT, 500, "end")
        s += txt(xx + 20, 671, "未来信息", 12, MUTED) + txt(xx + card_w - 20, 671, "不可见" if i < 2 else "已看来源保留，不投影", 13, WARN if i == 2 else TEXT, 500, "end")
        s += ln(xx + 20, 690, xx + card_w - 20, 690)
        if i == 0:
            s += button(xx + 20, 716, "推进下一交易日", 156, True)
        elif i == 1:
            s += button(xx + 20, 716, "暂停播放", 112)
        else:
            s += button(xx + 20, 716, "返回最新日期", 132, True) + chip(xx + 168, 722, "已看后续：6/28", WARN, 146, "#332918")
    s += rect(100, 866, 1240, 74, RAISED, BORDER, 8)
    s += txt(118, 894, "四条日期边界独立保存", 15, TEXT, 600)
    s += txt(118, 919, "V 当前查看日　·　M 行情已展开至　·　E 成交已运行截止　·　R 结果截止；切换组合、侧栏、缩放不推进游标。", 13, SECONDARY)
    return s + close()


def make_time_single(index):
    width, height = 920, 720
    states = [
        ("07a · T0 起点 · 2024-06-14", "T0：候选只是计划 · 实际持仓 0 · 现金 100%", "2024-06-14", "无", "2024-06-14", "未生成（≤ M）", BLUE, 5, False),
        ("07b · 首日新 K 线与成交 · 2024-06-17", "推进后：新增 6/17 末 bar · 首次建仓 2 笔", "2024-06-17", "2024-06-17", "2024-06-17", "未生成（≤ M）", GREEN, 6, True),
        ("07c · 回看起点 · 2024-06-14", "图回到 T0；已看后续至 6/28 保留为来源记录；当前投影成交无（已运行截止 6/28）", "2024-06-14", "无 · 6/28 截止", "2024-06-28", "未生成（≤ M）", WARN, 5, False),
    ]
    title, subtitle, current, execution, market, result, color, count, marker = states[index]
    s = opening("回放观察", f"{title} · V/M/E/R 分开记录，合成数据仅用于视觉方案", width, height)
    s += rect(100, 150, 720, 500, PANEL, BORDER, 8) + txt(124, 184, title, 18, TEXT, 600)
    s += chip(124, 204, "首次建仓" if marker else ("回看" if index == 2 else "T0"), color, 82, "#153128" if marker else ("#332918" if index == 2 else "#172536"))
    s += txt(220, 221, subtitle, 13, GREEN if marker else TEXT, 600)
    s += candle_plot(124, 248, 490, 316, count, marker)
    s += rect(632, 248, 164, 316, RAISED, BORDER, 8) + txt(650, 278, "日期边界", 15, TEXT, 600)
    rows = [("V 当前查看日", current, TEXT), ("M 行情截止", market, BLUE), ("E 成交截止", execution, GREEN if marker else MUTED), ("R 结果截止", result, TEXT), ("已看后续", "6/28（不投影）" if index == 2 else "—", WARN if index == 2 else MUTED)]
    for i, (label, value, col) in enumerate(rows):
        yy = 310 + i * 47
        s += txt(650, yy, label, 11, MUTED)
        s += txt(778, yy + 17, value, 12, col, 600, "end", True)
    s += button(124, 592, "返回最新日期" if index == 2 else ("暂停播放" if index == 1 else "推进下一交易日"), 160, index != 1)
    if index == 2:
        s += chip(300, 598, "已看后续来源：6/28", WARN, 164, "#332918")
    s += txt(100, 682, "K 线价格轴由 10.00—11.00 数值映射；所有柱、影线和成交标记均在绘图区 clip 内。", 12, SECONDARY)
    return s + close()


def make_time_controls_detail():
    width, height = 920, 360
    s = opening("回放时间控制", "局部详图：V/M/E/R 不混为一个日期；回看不把未来成交投影到图上", width, height)
    s += rect(100, 144, 720, 146, PANEL, BORDER, 8)
    fields = [("当前查看日 V", "2024-06-14"), ("行情截止 M", "2024-06-28"), ("成交 E", "当前投影成交无"), ("结果 R", "未生成（≤ M）")]
    for i, (label, value) in enumerate(fields):
        s += field(118 + i * 174, 164, 164, label, value)
    s += button(118, 238, "返回最新日期", 132, True) + button(260, 238, "推进下一交易日", 144, False, True)
    s += txt(436, 261, "结果/比较页：推进与速度禁用；返回观察后才可继续。", 12, SECONDARY)
    return s + close()


def value_y(value, top, bottom, low=0.98, high=1.03):
    return bottom - ((value - low) / (high - low)) * (bottom - top)


def max_drawdown_pct(values):
    peak = values[0]
    worst = 0.0
    for value in values:
        peak = max(peak, value)
        worst = min(worst, (value / peak - 1.0) * 100.0)
    return worst


def nav_chart(x, y, width, height, compare=False, active=1, local_switcher=False):
    s = rect(x, y, width, height, "#0F1826", BORDER, 8)
    s += txt(x + 18, y + 26, "阶段结果 · 合成净值", 14, TEXT, 600)
    s += txt(x + width - 18, y + 26, "1.0000 起点 · 6/14—9/13", 12, MUTED, 400, "end")
    s += mode_slots(x + 18, y + 40, active)
    if local_switcher:
        s += txt(x + 548, y + 57, "局部", 12, MUTED)
        for i, label in enumerate(("净值", "回撤", "仓位")):
            s += chip(x + 584 + i * 70, y + 40, label, BLUE if i == 0 else MUTED, 60,
                      "#1B304A" if i == 0 else "#151F2E")
    left, right, top, bottom = x + 64, x + width - 26, y + 118, y + height - 48
    s += txt(x + 18, y + 88, "蓝线 · EMA20 v1.4", 12, BLUE, 600)
    if compare:
        s += txt(x + 166, y + 88, "紫线 · 低波动质量 v2.1", 12, PURPLE, 600)
    for val in (0.98, 0.99, 1.00, 1.01, 1.02, 1.03):
        yy = value_y(val, top, bottom)
        s += ln(left, yy, right, yy, BORDER, 1, "3 4" if val == 1.00 else "")
        s += txt(left - 10, yy + 4, f"{val:.3f}", 12, MUTED, 400, "end", True)
    axis_dates = DATA["dates"]
    date_labels = ["6/14", "6/21", "7/05", "7/19", "8/02", "8/16", "8/30", "9/13"]
    start_day = date.fromisoformat(axis_dates[0])
    span_days = (date.fromisoformat(axis_dates[-1]) - start_day).days
    x_positions = [left + ((date.fromisoformat(day) - start_day).days / span_days) * (right - left)
                   for day in axis_dates]
    for i, xx in enumerate(x_positions):
        s += ln(xx, top, xx, bottom, BORDER, 1, "3 4" if i == 0 else "")
        s += txt(xx, bottom + 25, date_labels[i], 12, MUTED, 400, "middle")
    # Shared eight-point synthetic series: the 1.0180 -> 0.985424 dip is 3.20%.
    vals_a = DATA["navA"]
    pts_a = [(xx, value_y(v, top, bottom)) for xx, v in zip(x_positions, vals_a)]
    d_a = "M " + " ".join((f"{px:.1f},{py:.1f}" if i == 0 else f"L {px:.1f},{py:.1f}") for i, (px, py) in enumerate(pts_a))
    s += path(d_a, BLUE, 3)
    for px, py in pts_a:
        s += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{BLUE}"/>'
    s += txt(pts_a[-1][0] - 10, pts_a[-1][1] - 12, "1.0254", 12, GREEN, 700, "end", True)
    if compare:
        vals_b = DATA["navB"]
        pts_b = [(xx, value_y(v, top, bottom)) for xx, v in zip(x_positions, vals_b)]
        d_b = "M " + " ".join((f"{px:.1f},{py:.1f}" if i == 0 else f"L {px:.1f},{py:.1f}") for i, (px, py) in enumerate(pts_b))
        s += path(d_b, PURPLE, 3)
        for px, py in pts_b:
            s += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{PURPLE}"/>'
        s += txt(pts_b[-1][0] - 10, pts_b[-1][1] + 20, "1.0184", 12, PURPLE, 700, "end", True)
    else:
        s += txt(x + 18, y + height - 10, "末值由数值轴映射：1.0254", 12, SECONDARY, 400, num=True)
    return s


def side_panel(x, y, width, height, compare=False):
    s = rect(x, y, width, height, PANEL, BORDER, 8)
    if compare:
        s += txt(x + 18, y + 28, "比较摘要", 18, TEXT, 600) + txt(x + 18, y + 53, "共同有效区间内排名", 12, SECONDARY)
        rows = [("EMA20 v1.4", "1.0254", "+2.54%", BLUE), ("低波动质量 v2.1", "1.0184", "+1.84%", PURPLE), ("实验 C · 执行失败", "—", "不排名", RED)]
        for i, (name, value, gain, color) in enumerate(rows):
            yy = y + 94 + i * 70
            s += ln(x + 18, yy - 18, x + width - 18, yy - 18)
            s += rect(x + 18, yy, 6, 38, color, "none", 3) + txt(x + 38, yy + 17, name, 13, TEXT, 600)
            s += txt(x + width - 18, yy + 17, value, 15, color if value != "—" else MUTED, 700, "end", True)
            s += txt(x + 38, yy + 37, gain if value != "—" else "原因：行情覆盖至 8/01", 12, SECONDARY if value != "—" else RED)
        s += ln(x + 18, y + 312, x + width - 18, y + 312)
        s += txt(x + 18, y + 339, "排名本金口径", 12, MUTED) + txt(x + width - 18, y + 339, "共同起点 6/14", 13, TEXT, 600, "end")
        s += txt(x + 18, y + 369, "首次建仓", 12, MUTED) + txt(x + width - 18, y + 369, "6/17（仅事件，不改区间）", 13, TEXT, 500, "end")
    else:
        s += txt(x + 18, y + 28, "阶段指标", 18, TEXT, 600) + txt(x + 18, y + 53, "统计截止 R = 2024-09-13", 12, SECONDARY)
        metrics = [("收益率", "+2.54%", GREEN), ("最大回撤", "-3.20%", RED), ("费用", "¥128.40", TEXT), ("成交笔数", "14 笔", TEXT)]
        for i, (label, value, color) in enumerate(metrics):
            yy = y + 94 + i * 54
            if i:
                s += ln(x + 18, yy - 30, x + width - 18, yy - 30)
            s += txt(x + 18, yy, label, 13, SECONDARY) + txt(x + width - 18, yy, value, 16, color, 700, "end", True)
        s += ln(x + 18, y + 322, x + width - 18, y + 322)
        s += txt(x + 18, y + 350, "事件往返", 14, TEXT, 600) + txt(x + 18, y + 376, "点击事件 → 同日观察 → 返回恢复筛选/滚动/R", 12, SECONDARY)
    return s


def replay_slot(x, y, width, current="2024-09-13"):
    s = rect(x, y, width, 72, RAISED, BORDER, 8)
    s += txt(x + 18, y + 28, "回放", 14, TEXT, 600) + chip(x + 74, y + 15, f"当前 {current}", BLUE, 106, "#172536")
    s += button(x + 194, y + 18, "返回观察后推进", 148, False, True) + button(x + 352, y + 18, "速度 1×", 86, False, True)
    s += txt(x + 466, y + 31, "结果与比较为只读阶段；推进和速度禁用。", 12, SECONDARY)
    return s


def contribution_details(x, y, width):
    s = rect(x, y, width, 260, PANEL, BORDER, 8)
    s += txt(x + 20, y + 29, "贡献明细", 16, TEXT, 600) + txt(x + 20, y + 52, "累计收益归因（百分点）· 正负从真实零线展开；真零不画假柱", 12, SECONDARY)
    zero = y + 170
    base_x, step, scale = x + 180, 140, 90 / 3.08924
    s += ln(base_x - 30, zero, x + width - 30, zero, SECONDARY, 1)
    s += txt(base_x - 38, zero + 4, "0", 12, MUTED, 400, "end", True)
    entries = [("合成股票 A", 3.08924, GREEN), ("合成股票 B", -0.42, NEG), ("费用", -0.1284, NEG), ("现金", 0.0, MUTED)]
    for i, (label, amount, color) in enumerate(entries):
        xx = base_x + i * step
        h = abs(amount) * scale
        top = zero - h if amount > 0 else zero
        if amount:
            s += rect(xx - 16, top, 32, max(3, h), color, "none", 3)
        s += txt(xx, y + 220, label, 12, SECONDARY, 500, "middle")
        s += txt(xx, y + 244, f"{amount:+.2f}" if amount else "0.00", 14, color, 600, "middle", True)
    s += txt(x + width - 20, y + 244, "合计 +2.54084pp", 12, SECONDARY, 600, "end", True)
    return s


def make_results():
    width, height = 1440, 1410
    s = opening("阶段结果", "结果截止 R = 2024-09-13 · 从净值与风险到贡献、事件，再回到同日观察", width, height)
    x, content = 100, 1240
    s += identity_and_summary(x, 136, content, 1, "2024-09-13", show_modes=False)
    chart_y = 420
    s += nav_chart(x, chart_y, 896, 526, active=1, local_switcher=True) + side_panel(x + 920, chart_y, 320, 526)
    s += replay_slot(x, 964, content)
    s += contribution_details(x, 1058, 896)
    s += rect(x + 920, 1058, 320, 260, RAISED, BORDER, 8) + txt(x + 938, 1088, "事件摘要", 16, TEXT, 600)
    events = [("6/17", "首次建仓", GREEN), ("8/30", "风险减仓", WARN), ("9/13", "期末调仓", BLUE)]
    for i, (date, label, color) in enumerate(events):
        yy = 1122 + i * 38
        s += chip(x + 938, yy - 15, date, color, 54, "#172536") + txt(x + 1008, yy + 2, label, 12, TEXT, 500) + txt(x + 1218, yy + 2, "查看 →", 12, BLUE, 600, "end")
    return s + close()


def compare_details(x, y, width):
    s = rect(x, y, width, 270, PANEL, BORDER, 8)
    s += txt(x + 20, y + 28, "比较明细", 16, TEXT, 600) + txt(x + 20, y + 51, "所有组从共同 6/14 基线计算；失效组保留原因但不排名", 12, SECONDARY)
    s += rect(x + 18, y + 70, width - 36, 40, RAISED, BORDER, 4)
    headers = [("指标", x + 34), ("EMA20 v1.4", x + 362), ("低波动质量 v2.1", x + 614), ("差值", x + 1048)]
    for label, xx in headers:
        s += txt(xx, y + 96, label, 14, MUTED, 600)
    dd_a = max_drawdown_pct(DATA["navA"])
    dd_b = max_drawdown_pct(DATA["navB"])
    rows = [("累计收益", "+2.54%", "+1.84%", "+0.70 百分点", GREEN),
            ("最大回撤", f"{dd_a:.2f}%", f"{dd_b:.2f}%", f"{dd_a - dd_b:+.2f} 百分点", NEG),
            ("费用", "¥128.40", "¥96.20", "¥32.20", TEXT)]
    for i, (name, a, b, delta, color) in enumerate(rows):
        yy = y + 132 + i * 48
        s += ln(x + 18, yy + 20, x + width - 18, yy + 20) + txt(x + 34, yy, name, 14, TEXT, 500)
        s += txt(x + 362, yy, a, 14, color, 600, num=True) + txt(x + 614, yy, b, 14, TEXT, 600, num=True) + txt(x + 1048, yy, delta, 14, color, 600, num=True)
    return s


def make_compare():
    width, height = 1440, 1460
    s = opening("组合对比", "共同有效区间 2024-06-14—2024-09-13 · 独立本金账本 · 首次建仓 6/17", width, height)
    x, content = 100, 1240
    s += identity_and_summary(x, 136, content, 2, "2024-09-13", "2 组可比", show_modes=False)
    s += rect(x, 408, content, 52, PANEL, BORDER, 6)
    s += field(x + 14, 406, 282, "共同有效区间", "2024-06-14—2024-09-13", "锁定")
    s += txt(x + 326, 439, "排名基线 1.0000 = 6/14；6/17 是首次成交事件，不是排名起点。", 12, SECONDARY)
    s += button(x + 1088, 416, "派生新实验", 136, True)
    chart_y = 478
    s += nav_chart(x, chart_y, 896, 526, True, active=2) + side_panel(x + 920, chart_y, 320, 526, True)
    s += replay_slot(x, 1022, content)
    s += compare_details(x, 1116, content)
    return s + close()


BUILDERS = {
    "07-time-states.svg": make_time_states,
    "07a-t0.svg": lambda: make_time_single(0),
    "07b-first-day.svg": lambda: make_time_single(1),
    "07c-lookback.svg": lambda: make_time_single(2),
    "07-time-controls-detail.svg": make_time_controls_detail,
    "08-results.svg": make_results,
    "09-compare.svg": make_compare,
}


def main(names=None):
    names = names or list(BUILDERS)
    unknown = [name for name in names if name not in BUILDERS]
    if unknown:
        raise SystemExit(f"unknown board(s): {', '.join(unknown)}")
    for name in names:
        (OUT / name).write_text(BUILDERS[name](), encoding="utf-8")
        print(f"wrote {name}")


if __name__ == "__main__":
    main(sys.argv[1:])
