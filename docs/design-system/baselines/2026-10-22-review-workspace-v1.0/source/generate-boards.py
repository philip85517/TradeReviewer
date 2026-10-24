from pathlib import Path
from html import escape
import math

OUT = Path(__file__).parent / "images"
OUT.mkdir(parents=True, exist_ok=True)

C = {
    "page": "#0B1019", "panel": "#111A26", "float": "#162233", "line": "#283448",
    "grid": "#1C2A3C", "text": "#E6EDF7", "muted": "#A8B6CB", "weak": "#71829B",
    "blue": "#6CA8FF", "focus": "#A9C8FF", "green": "#53D7A0", "red": "#FF8592",
    "amber": "#FFC66D", "up": "#26A69A", "down": "#EF5350", "disabled": "#53647B",
}
FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
MONO = "'SFMono-Regular','Roboto Mono','Menlo',monospace"

def esc(s):
    return escape(str(s), quote=True)

def R(x, y, w, h, fill, stroke=None, sw=1, rx=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + '/>'

def L(x1, y1, x2, y2, stroke, sw=1, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}/>'

def T(x, y, s, size=14, fill=None, weight=400, anchor="start", family=FONT):
    return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}px" font-weight="{weight}" fill="{fill or C["text"]}" text-anchor="{anchor}">{esc(s)}</text>'

def P(points, fill, stroke=None, sw=1):
    p = " ".join(f"{x},{y}" for x, y in points)
    return f'<polygon points="{p}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + '/>'

def diamond(x, y, color=C["blue"], size=6):
    return P([(x, y-size), (x+size, y), (x, y+size), (x-size, y)], color, C["text"], 1)

def svg(w, h, title, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="{C["page"]}" role="img" aria-label="{esc(title)}"><title>{esc(title)}</title>{R(0, 0, w, h, C["page"])}{body}</svg>\n'

def button(x, y, w, label, active=False, disabled=False, h=36, size=12):
    size = max(14, size)
    fill = C["blue"] if active else (C["panel"] if disabled else C["float"])
    stroke = C["blue"] if active else (C["line"] if not disabled else C["disabled"])
    tc = C["text"] if active else (C["disabled"] if disabled else C["muted"])
    return R(x, y, w, h, fill, stroke, 1, 6) + T(x+w/2, y+h/2+4, label, size, tc, 600, "middle")

def input_box(x, y, w, label, value, unit=None, h=36, accent=False):
    out = T(x, y-7, label, 12, C["muted"], 600)
    out += R(x, y, w, h, C["page"], C["blue"] if accent else C["line"], 1, 6)
    out += T(x+12, y+h/2+5, value, 14, C["text"], 600)
    if unit:
        out += T(x+w-10, y+h/2+4, unit, 12, C["weak"], 500, "end")
    return out

def select_box(x, y, w, label, value, h=36, accent=False):
    out = T(x, y-7, label, 12, C["muted"], 600)
    out += R(x, y, w, h, C["page"], C["blue"] if accent else C["line"], 1, 6)
    out += T(x+12, y+h/2+5, value, 14, C["text"], 600)
    out += T(x+w-12, y+h/2+5, "⌄", 16, C["muted"], 500, "end")
    return out

def chips(x, y, labels, selected=0, widths=None, h=36):
    out = ""
    xx = x
    for i, lab in enumerate(labels):
        w = (widths[i] if widths else max(52, len(lab)*14+22))
        out += button(xx, y, w, lab, active=i == selected, h=h, size=14)
        xx += w + 6
    return out

def bars_data():
    close = []
    for d in range(1, 81):
        if d <= 15: v = 42 + d*0.27
        elif d <= 26: v = 46 + (d-15)*1.75
        elif d <= 35: v = 65.3 - (d-26)*2.0
        elif d <= 60: v = 47.3 + (d-35)*0.38 + (0.4 if d % 3 == 0 else -0.15)
        elif d <= 69: v = 57 + (d-60)*1.02 + (0.3 if d % 2 else -0.2)
        else: v = 66.1 - (d-69)*0.42 + (0.5 if d % 3 == 0 else 0)
        close.append(v)
    out = []
    # Keep each known execution inside the OHLC range of its own K so the
    # synthetic replay remains internally consistent.
    execution_ohlc = {
        61: (55.80, 57.10, 55.20, 56.30),  # buy 1000 @ 56.00
        74: (61.20, 62.00, 60.40, 61.50),  # clear 400 @ 61.00
    }
    for d, c in enumerate(close, 1):
        prev = out[-1][4] if out else c-0.4
        o = prev + (0.25 if d % 4 == 0 else -0.2 if d % 5 == 0 else 0)
        hi = max(o, c) + 0.8 + (d % 3)*0.15
        lo = min(o, c) - 0.7 - (d % 4)*0.12
        if d in execution_ohlc:
            o, hi, lo, c = execution_ohlc[d]
        vol = 16 + ((d*7) % 19) + (8 if d in (26, 35, 60, 68, 74) else 0)
        out.append((d,o,hi,lo,c,vol))
    return out

BARS = bars_data()

def price_y(price, top, bottom, lo=40, hi=70):
    return bottom - (price-lo)/(hi-lo)*(bottom-top)

def day_x(day, x0, x1, cutoff=80):
    """Map a known day into the currently revealed window only."""
    span = max(1, cutoff - 1)
    return x0 + (day-1)/span*(x1-x0)

def draw_chart(x, y, w, h, cutoff=60, stage="entry", compact=False):
    # Keep the chart's outer plot/axis boundary exact across desktop, mobile,
    # and export frames. Desktop shells pass plot_w + 96 here.
    plot_x = x
    axis_w = 96
    plot_w = w - axis_w
    axis_x = plot_x + plot_w
    if compact and h <= 240:
        # Mobile/thumbnail charts reserve a readable price area before the
        # compact volume band and keep day labels inside the chart frame.
        top = y + 20
        bottom = y + h - 20
        vol_top = bottom - 24
        vol_bottom = bottom - 8
        price_bottom = vol_top - 4
        date_y = bottom + 14
        tick_values = (60, 44)
        plan_label_h = 18
    else:
        top = y + 32
        bottom = y + h - 66
        vol_top = bottom - 82
        vol_bottom = bottom - 14
        price_bottom = vol_top - 10
        date_y = bottom + 28
        plan_label_h = 28
    lo, hi = (40,72) if stage == "final" else (40,70)
    out = R(x, y, w, h, "#101722", C["line"] if compact else None, 1, 0)
    out += R(axis_x, y, axis_w, h, C["panel"], C["line"], 1, 0)
    lo, hi = (40,72) if stage == "final" else (40,70)
    if not (compact and h <= 240):
        tick_values = tuple(hi - i*(hi-lo)/6 for i in range(7))
    for val in tick_values:
        yy = price_y(val, top, price_bottom, lo, hi)
        out += L(plot_x, yy, axis_x, yy, C["grid"])
        out += T(axis_x+axis_w-12, yy+4, f"{val:.2f}", 12, C["muted"], 500, "end", MONO)
    day_ticks = [d for d in (1, 10, 20, 30, 40, 50, 60, 70, 80) if d <= cutoff]
    if cutoff not in day_ticks:
        day_ticks.append(cutoff)
    if compact and h <= 240:
        day_ticks = [d for d in (1, 20, 40, 60, 80) if d <= cutoff]
        if cutoff not in day_ticks:
            day_ticks.append(cutoff)
    for d in day_ticks:
        xx = day_x(d, plot_x+6, axis_x-8, cutoff)
        out += L(xx, top, xx, bottom, C["grid"])
        out += T(xx, date_y, f"D{d:02d}", 12, C["muted"], 500, "start" if d == 1 else "end" if d == cutoff else "middle", MONO)
    out += T(axis_x+axis_w-12, y+10 if compact and h <= 240 else y+18, "CNY", 12, C["muted"], 600, "end")
    x0, x1 = plot_x+6, axis_x-8
    for d,o,hi_v,lo_v,c,vol in BARS:
        if d > cutoff: break
        xx = day_x(d, x0, x1, cutoff)
        yo, yh, yl, yc = [price_y(v, top, price_bottom, lo, hi) for v in (o,hi_v,lo_v,c)]
        color = C["up"] if c >= o else C["down"]
        out += L(xx, yh, xx, yl, color)
        candle_w = max(2, min(8, (x1-x0)/max(1, cutoff-1)*0.72))
        out += R(xx-candle_w/2, min(yo,yc), candle_w, max(3, abs(yc-yo)), color, None, 1, 1)
        if compact and h <= 240:
            vh = min(vol_bottom-vol_top-1, 4 + vol*0.35)
            volume_w = candle_w
        else:
            vh = 10 + vol*1.25
            volume_w = candle_w
        out += R(xx-volume_w/2, vol_bottom-vh, volume_w, vh, color, None, 1, 1)
    # plan lines and labels all share the same mapping with axis labels.
    plans = [(68, "目标", C["amber"]), (56, "入场", C["amber"]), (52, "止损", C["amber"])]
    for value, name, color in plans:
        yy = price_y(value, top, price_bottom, lo, hi)
        out += L(plot_x+8, yy, axis_x-8, yy, color, 1.5, "7 6")
        out += R(axis_x+8, yy-plan_label_h/2, axis_w-16, plan_label_h, "#1B273A", None, 1, 4)
        out += T(axis_x+14, yy+4, name, 12, color, 600)
        out += T(axis_x+axis_w-14, yy+4, f"{value:.2f}", 12, color, 600, "end", MONO)
    # revealed trade markers
    trades = []
    if stage in ("holding", "final"):
        trades = [(61, 56, "买入 1000", C["blue"]), (68, 64, "减仓 600", C["blue"])]
    if stage == "final": trades.append((74, 61, "清仓 400", C["green"]))
    for d, price, label, color in trades:
        xx, yy = day_x(d, x0, x1, cutoff), price_y(price, top, price_bottom, lo, hi)
        out += diamond(xx, yy, color)
        # Keep labels inside the plot when the revealed cutoff places a
        # marker next to the price-axis boundary (notably D68 at X69).
        tx = xx+10 if xx+150 <= axis_x-8 else max(plot_x+8, xx-142)
        out += T(tx, yy-9, label, 12, color, 600)
        out += T(tx, yy+8, f"D{d} · {price:.2f}", 12, C["muted"], 500)
    if stage == "entry":
        xx = day_x(60, x0, x1, cutoff)
        out += L(xx, top, xx, bottom, C["weak"], 1, "4 5")
        out += T(xx+8, bottom-2, "后续尚未揭示", 12, C["weak"], 500)
    if stage == "holding":
        xx = day_x(69, x0, x1, cutoff)
        out += L(xx, top, xx, bottom, C["weak"], 1, "4 5")
        label_x = min(axis_x-190, xx+8)
        out += T(label_x, bottom-2, "D69 · 当前剩余 400 股", 12, C["muted"], 500)
    # Every full stage keeps one short, anchored Text annotation on the graph.
    text_day, text_price, text_label = {
        "entry": (48, 60, "Text · 等待确认"),
        "holding": (65, 61, "Text · 持仓观察"),
        "final": (74, 63, "Text · 风险收缩")
    }[stage]
    tx = day_x(text_day, x0, x1, cutoff)
    ty = price_y(text_price, top, price_bottom, lo, hi)
    card_w = 152 if not compact else 132
    # Keep annotation cards in the chart's upper-right whitespace so they
    # cannot cover a trade marker or its label; the dotted leader preserves
    # the exact anchored day/price.
    card_x = max(plot_x + 8, axis_x - card_w - 8)
    card_y = top + (30 if compact and h <= 240 else 8)
    out += L(tx, ty, card_x, card_y+18, C["focus"], 1, "3 3")
    out += R(card_x, card_y, card_w, 24, C["float"], C["focus"], 1, 4)
    out += T(card_x+8, card_y+16, text_label, 14, C["focus"], 600)
    return out, (plot_x, axis_x, axis_w, top, bottom)

def nav(w, expanded=False):
    nw = 240 if expanded else 72
    out = R(0, 0, nw, 900 if w >= 1400 else 800, C["panel"])
    if expanded:
        out += T(24, 42, "TR", 20, C["text"], 700)
        out += T(24, 88, "交易空间", 14, C["muted"], 600)
        for i, lab in enumerate(("回合", "图表", "记录", "设置")):
            yy = 148 + i*52
            out += R(16, yy-24, 208, 40, C["float"] if i == 0 else "none", C["blue"] if i == 0 else None, 1, 6)
            out += T(32, yy+5, lab, 14, C["text"] if i == 0 else C["muted"], 600)
        return out
    out += T(36, 48, "TR", 18, C["text"], 700, "middle")
    for i, lab in enumerate(("回合", "图表", "记录")):
        yy = 100 + i*48
        out += T(36, yy, lab, 12, C["muted"], 600, "middle")
    return out

def desktop_shell(stage, side_fn, cutoff=60, title="入场前判断", save="保存中…", w=1440, h=900, nav_expanded=False, footer_mode="entry"):
    nw = 240 if nav_expanded else 72
    wx = 256 if nav_expanded else 88
    ww = w - wx - 16
    main_h = h - 176 if h >= 880 else h - 176
    footer_y = h - 72
    status_y = 72
    out = nav(w, nav_expanded)
    out += R(wx, 16, ww, h-32, C["panel"], C["line"], 1, 8)
    out += R(wx, 16, ww, 56, C["float"], None, 1, 8) + L(wx,72,wx+ww,72,C["line"])
    out += T(wx+16, 51, "‹", 30, C["muted"], 400)
    out += T(wx+48, 42, "示例股份 / 600000", 18, C["text"], 700)
    out += T(wx+284, 42, "日线", 14, C["muted"], 600)
    # stage buttons are stable and compact across desktop widths.
    labels = ["入场前判断", "持仓过程", "事后复盘"]
    # Compact headers keep the three stage controls together before the actions;
    # the expanded navigation layout has only 1008px of workspace width.
    sx = wx + (432 if ww >= 1200 else 320)
    sw = 126 if ww >= 1200 else 104
    for i, lab in enumerate(labels):
        active = (i == (0 if stage == "entry" else 1 if stage == "holding" else 2))
        out += button(sx+i*(sw+4), 26, sw, lab, active=active, h=36, size=12)
    if ww >= 1200:
        save_x, export_x, more_x, records_x = wx+ww-488, wx+ww-344, wx+ww-264, wx+ww-208
    elif nav_expanded:
        save_x, export_x, more_x, records_x = wx+ww-332, wx+ww-220, wx+ww-150, wx+ww-88
    else:
        save_x, export_x, more_x, records_x = wx+ww-390, wx+ww-270, wx+ww-194, wx+ww-130
    out += T(save_x, 42, save, 13, C["amber"] if "冲突" in save or "保存" in save else C["muted"], 600)
    out += T(export_x, 42, "导出", 14, C["muted"], 600)
    out += T(more_x, 42, "更多", 14, C["muted"], 600)
    out += T(records_x, 42, "记录", 14, C["muted"], 600)
    # status row, with both independent cutoffs.
    if stage == "entry": status = "复盘补记 · 行情截止 D60 · 成交截止 D60（买入前）"
    elif stage == "holding": status = "持仓过程 · 行情截止 D69 · 成交截止 D69（已知）"
    else: status = "已看后续后复盘 · 行情截止 D80 · 成交截止 D80（完整）"
    out += R(wx, 72, ww, 32, C["panel"]) + T(wx+16, 93, status, 13, C["muted"], 500)
    out += T(wx+ww-16, 93, "记录对象：" + ("入场前判断" if stage == "entry" else "持仓 D69" if stage == "holding" else "事后评价"), 12, C["amber"], 600, "end")
    if nav_expanded:
        # vertical layout; chart first, form below.
        out += draw_vertical_expanded(wx, 104, ww, 220, stage)
        out += side_entry_expanded(wx+16, 340, ww-32, 340) if stage == "entry" else side_fn(wx+16, 340, ww-32, 340)
        out += R(wx, footer_y, ww, 56, C["float"]) + L(wx,footer_y,wx+ww,footer_y,C["line"])
        out += footer_controls(wx, footer_y, ww, footer_mode, compact=True)
        return svg(w, h, title, out)
    tool_x, plot_x = wx, wx+48
    plot_w = ww - 48 - 96 - 14 - 304
    axis_x = plot_x + plot_w
    out += R(tool_x, 104, 48, main_h, C["float"], C["line"], 1, 6)
    for i, lab in enumerate(("⌁", "T", "╱", "―", "↔", "▱", "⋯", "↶")):
        yy = 132 + i*44
        out += R(tool_x+6, yy-16, 36, 36, C["blue"] if i == 0 else "none", C["blue"] if i == 0 else None, 1, 6)
        out += T(tool_x+24, yy+6, lab, 17, C["text"] if i == 0 else C["muted"], 600, "middle")
    out += T(tool_x+24, 104+main_h-20, "工具", 12, C["weak"], 500, "middle")
    chart, _ = draw_chart(plot_x, 104, plot_w+96, main_h, cutoff, stage)
    out += chart
    out += R(axis_x+96, 104, 14, main_h, C["page"])
    out += side_fn(axis_x+110, 104, 304, main_h)
    out += R(wx, footer_y, ww, 56, C["float"]) + L(wx,footer_y,wx+ww,footer_y,C["line"])
    out += T(wx+16, footer_y+34, "回放 · " + ("D60 / 买入前" if stage == "entry" else "D69 / 剩余400股" if stage == "holding" else "D80 / 已完成"), 13, C["muted"], 500)
    out += footer_controls(wx, footer_y, ww, footer_mode, compact=ww<1200)
    return svg(w, h, title, out)

def footer_controls(wx, y, ww, mode, compact=False):
    labels = ["上一根", "▶ 播放", "下一根 →", "下一决策", "留存快照", "侧栏"]
    if mode == "final": labels = ["上一根", "▶ 播放", "下一根 →", "返回工作图", "留存快照", "三图一表 →"]
    if mode == "conflict": labels = ["上一根", "▶ 播放", "下一根 →", "下一决策", "重试保存", "侧栏"]
    widths = [70, 78, 88, 92, 88, 92]
    total = sum(widths)+5*6
    x = wx + ww - total - 12
    out = ""
    for lab, bw in zip(labels, widths):
        disabled = (mode == "end" and lab in ("▶ 播放", "下一根 →")) or (mode == "final" and lab in ("▶ 播放", "下一根 →"))
        out += button(x, y+10, bw, lab, disabled=disabled, h=36, size=11)
        x += bw+6
    if mode == "final":
        out += T(wx+430, y+34, "已到 D80 末尾 · 播放/下一根不可用", 11, C["weak"], 500)
    return out

def side_header(x, y, w, kicker, title, subtitle, color=None):
    out = R(x, y, w, 64, C["float"], None, 1, 8)
    out += T(x+16, y+23, kicker, 12, C["muted"], 600)
    out += T(x+16, y+48, title, 18, C["text"], 700)
    if subtitle: out += T(x+16, y+84, subtitle, 12, C["muted"], 500)
    return out

def side_entry(x, y, w, h):
    out = R(x, y, w, h, C["panel"], C["line"], 1, 6)
    out += side_header(x, y+16, w, "01 / 入场前", "入场前计划", "边看走势，复盘补记草稿")
    yy = y+128
    out += input_box(x+16, yy, w-32, "计划入场价", "56.00", "CNY", accent=True)
    out += input_box(x+16, yy+76, (w-38)/2, "初始止损", "52.00")
    out += input_box(x+22+(w-38)/2, yy+76, (w-38)/2, "止盈目标", "68.00")
    out += T(x+16, yy+152, "计划规模", 12, C["muted"], 600)
    out += chips(x+16, yy+160, ["按数量", "按金额", "按仓位 %"], 0, [76,76,88])
    out += input_box(x+16, yy+214, w-32, "计划数量（股）", "1000", "股")
    out += R(x+16, yy+270, w-32, 36, C["float"], C["line"], 1, 6)
    out += T(x+28, yy+293, "▸ 参考资金与来源", 12, C["text"], 600)
    out += T(x+w-28, yy+293, "¥200,000", 12, C["amber"], 600, "end")
    out += T(x+16, yy+334, "初始风险", 12, C["muted"], 600)
    out += T(x+w-16, yy+334, "¥4,000 · 2.0%", 14, C["amber"], 600, "end")
    out += T(x+16, yy+370, "预期收益 / 风险", 12, C["muted"], 600)
    out += T(x+w-16, yy+370, "3.00R · 3.00:1", 14, C["amber"], 600, "end")
    out += L(x+16, yy+390, x+w-16, yy+390, C["line"])
    out += T(x+16, yy+418, "资金基数可展开：CNY · D60 · 手填参考", 12, C["weak"], 500)
    out += T(x+16, y+h-20, "↕ 侧栏内部可滚动 · 首屏保留核心输入", 12, C["weak"], 500)
    return out

def side_holding(x, y, w, h):
    out = R(x, y, w, h, C["panel"], C["line"], 1, 6)
    out += side_header(x, y+16, w, "02 / 持仓过程", "持仓过程", "当前已知事实 · 原计划只读")
    yy = y+120
    out += R(x+16, yy, w-32, 56, C["float"], C["line"], 1, 6)
    out += T(x+28, yy+22, "当前剩余仓位", 12, C["muted"], 600)
    out += T(x+w-28, yy+39, "400 股", 18, C["text"], 700, "end")
    out += T(x+16, yy+82, "已知成交", 12, C["muted"], 600)
    out += R(x+16, yy+92, w-32, 90, C["page"], C["line"], 1, 6)
    out += T(x+28, yy+116, "D61  买入", 13, C["text"], 600)
    out += T(x+w-28, yy+116, "1,000 股 @ 56.00", 13, C["muted"], 600, "end")
    out += L(x+28, yy+130, x+w-28, yy+130, C["line"])
    out += T(x+28, yy+157, "D68  减仓", 13, C["text"], 600)
    out += T(x+w-28, yy+157, "600 股 @ 64.00", 13, C["muted"], 600, "end")
    out += T(x+16, yy+212, "原计划（只读）", 12, C["muted"], 600)
    for i,(lab,val) in enumerate((("入场 / 止损 / 目标", "56.00 / 52.00 / 68.00"),("计划数量 / 风险", "1000 股 / ¥4,000"),("预期", "3.00R"))):
        out += T(x+16, yy+238+i*30, lab, 12, C["weak"], 500)
        out += T(x+w-16, yy+238+i*30, val, 12, C["muted"], 600, "end")
    out += R(x+16, yy+338, w-32, 54, C["float"], C["line"], 1, 6)
    out += T(x+28, yy+360, "Text · D69 持仓观察", 12, C["focus"], 600)
    out += T(x+28, yy+379, "回踩未破，保留初始风险基准。", 12, C["text"], 400)
    out += T(x+16, y+h-20, "↕ 侧栏内部可滚动 · 切换侧栏不改变观察时点", 12, C["weak"], 500)
    return out

def side_final(x, y, w, h):
    out = R(x, y, w, h, C["panel"], C["line"], 1, 6)
    out += side_header(x, y+16, w, "03 / 事后复盘", "执行复盘", "原计划与真实成交只读")
    yy = y+116
    rows = [("原计划 · 入场 / 止损 / 目标", "56.00 / 52.00 / 68.00"),("初始数量 / 风险基准", "1000 股 / ¥4,000"),("实际入场 · D61", "1,000 股 @ 56.00"),("最终净盈亏 / 实际R", "+¥6,760 / 1.69R")]
    for i,(a,b) in enumerate(rows):
        out += T(x+16, yy+i*28, a, 12, C["muted"], 500)
        out += T(x+w-16, yy+i*28, b, 12, C["text"] if i<3 else C["green"], 600, "end")
    yy += 132
    out += select_box(x+16, yy, w-32, "退出日期", "D68 · 2026-03-28")
    out += select_box(x+16, yy+64, w-32, "退出动作", "减仓")
    out += input_box(x+16, yy+128, (w-38)/2, "退出数量", "600", "股")
    out += input_box(x+22+(w-38)/2, yy+128, (w-38)/2, "退出价格", "64.00", "CNY")
    out += T(x+16, yy+198, "是否提前退出", 12, C["muted"], 600)
    out += chips(x+16, yy+206, ["是", "否", "不确定", "未评价"], 0, [48,48,64,64])
    out += select_box(x+16, yy+270, w-32, "退出原因", "风险收缩")
    out += T(x+16, yy+334, "相对原计划的执行", 12, C["muted"], 600)
    out += chips(x+16, yy+342, ["按计划", "偏离", "无原计划", "未评价"], 1, [62,62,80,64])
    out += T(x+16, yy+400, "未评价说明（仍可编辑）", 12, C["muted"], 600)
    out += R(x+16, yy+408, w-32, 38, C["page"], C["line"], 1, 6)
    out += T(x+28, yy+432, "若选择未评价，填写原因或证据来源…", 12, C["weak"], 400)
    out += T(x+16, y+h-20, "↕ 侧栏内部可滚动 · 下一笔退出可单独选择", 12, C["weak"], 500)
    return out

def side_records(x, y, w, h):
    out = R(x, y, w, h, C["panel"], C["line"], 1, 6)
    out += side_header(x, y+16, w, "记录与快照", "复盘记录", "当前阶段：事后复盘 · 预览与编辑入口分开")
    yy = y+116
    groups = [
        ("入场前判断", [("决策 D60", "补记 · 1 个快照"), ("快照 #01", "入场计划")]),
        ("持仓过程", [("决策 D69", "Text · 2 个快照"), ("快照 #02", "持仓观察"), ("快照 #03", "减仓后")]),
        ("事后复盘", [("决策 D68", "减仓 600 @ 64"), ("决策 D74", "清仓 400 @ 61"), ("快照 #04", "已完成")]),
    ]
    for gi,(group, rows) in enumerate(groups):
        out += T(x+16, yy, group, 12, C["amber"] if gi == 2 else C["muted"], 700)
        yy += 20
        for ri,(a,b) in enumerate(rows):
            selected = (a == "快照 #04")
            out += R(x+16, yy, w-32, 38, C["blue"] if selected else C["float"], C["blue"] if selected else C["line"], 1, 6)
            out += T(x+28, yy+16, a, 12, C["text"] if selected else C["muted"], 600)
            out += T(x+w-28, yy+16, b, 11, C["text"] if selected else C["weak"], 500, "end")
            out += T(x+28, yy+31, "来源：已看后续后补记" if gi == 2 else "来源：回放", 11, C["weak"], 500)
            yy += 44
        yy += 12
    out += R(x+16, y+h-118, w-32, 86, C["float"], C["line"], 1, 6)
    out += T(x+28, y+h-94, "已选快照 #04 · 事后复盘", 12, C["text"], 600)
    out += button(x+28, y+h-84, 112, "预览", active=True, h=36, size=14)
    out += button(x+146, y+h-84, 112, "编辑", h=36, size=14)
    out += button(x+28, y+h-42, 112, "更新此快照", h=36, size=14)
    out += button(x+146, y+h-42, 112, "返回工作图", h=36, size=14)
    return out

def side_conflict(x, y, w, h):
    out = R(x, y, w, h, C["panel"], C["line"], 1, 6)
    out += side_header(x, y+16, w, "保存冲突", "本地草稿已保留", "服务器版本较新 · 当前观察点仍为 D60")
    yy = y+122
    out += R(x+16, yy, w-32, 62, "#2A2330", C["red"], 1, 6)
    out += T(x+28, yy+24, "版本冲突：服务器已有新修改", 13, C["red"], 700)
    out += T(x+28, yy+46, "本地输入未丢失，选择恢复方式后再继续。", 12, C["muted"], 500)
    out += T(x+16, yy+96, "本地保留", 12, C["muted"], 600)
    for i,(a,b) in enumerate((("计划入场", "56.00"),("止损 / 目标", "52.00 / 68.00"),("数量", "1000 股"))):
        out += T(x+16, yy+120+i*26, a, 12, C["weak"], 500)
        out += T(x+w-16, yy+120+i*26, b, 12, C["text"], 600, "end")
    out += L(x+16, yy+204, x+w-16, yy+204, C["line"])
    out += T(x+16, yy+232, "服务器版本", 12, C["muted"], 600)
    out += T(x+w-16, yy+232, "数量 800 股", 12, C["red"], 600, "end")
    out += button(x+16, yy+266, w-32, "重试保存", active=True, h=36, size=13)
    out += button(x+16, yy+310, w-32, "比较版本", h=36, size=13)
    out += button(x+16, yy+354, w-32, "重新载入（替换本地）", h=36, size=13)
    out += T(x+16, yy+410, "重新载入前会提示替换未保存输入；取消保持本地。", 12, C["weak"], 500)
    out += T(x+16, y+h-20, "↕ 侧栏内部可滚动 · 图表与价格轴保持可见", 12, C["weak"], 500)
    return out

def draw_vertical_expanded(wx, y, ww, h, stage):
    out = ""
    chart, _ = draw_chart(wx+16, y, ww-32, h, 60 if stage == "entry" else 69 if stage == "holding" else 80, stage, compact=True)
    return chart

def side_entry_expanded(x, y, w, h):
    """Expanded-nav form: dense two-row inputs with a local-scroll affordance."""
    out = R(x, y, w, h, C["panel"], C["line"], 1, 6)
    out += R(x+16, y+16, w-32, 64, C["float"], None, 1, 8)
    out += T(x+32, y+39, "01 / 入场前", 12, C["muted"], 600)
    out += T(x+32, y+65, "入场前计划", 18, C["text"], 700)
    out += T(x+32, y+94, "边看走势，复盘补记草稿", 12, C["muted"], 500)
    col = (w-64)/3
    yy = y+122
    out += input_box(x+16, yy, col, "计划入场", "56.00", "CNY", h=44, accent=True)
    out += input_box(x+32+col, yy, col, "初始止损", "52.00", "CNY", h=44)
    out += input_box(x+48+2*col, yy, col, "止盈目标", "68.00", "CNY", h=44)
    out += T(x+16, y+186, "计划规模", 12, C["muted"], 600)
    out += chips(x+16, y+194, ["按数量", "按金额", "按仓位 %"], 0, [104,104,120], 36)
    out += input_box(x+384, y+180, 230, "计划数量", "1000", "股", h=44)
    out += R(x+632, y+180, w-648, 44, C["float"], C["line"], 1, 6)
    out += T(x+646, y+203, "参考资金与来源", 11, C["muted"], 500)
    out += T(x+w-96, y+203, "¥200,000", 13, C["amber"], 600, "end")
    out += T(x+w-28, y+203, "⌄ 展开", 11, C["focus"], 600, "end")
    out += R(x+16, y+246, w-32, 42, C["float"], C["line"], 1, 6)
    out += T(x+30, y+272, "风险摘要（只读）", 11, C["muted"], 500)
    out += T(x+220, y+272, "¥4,000 · 2.0%", 13, C["amber"], 600)
    out += T(x+430, y+272, "预期 3.00R · 资金 CNY · D60", 12, C["muted"], 500)
    out += T(x+w-16, y+h-18, "↕ 表单局部滚动 · 首屏保留核心输入", 11, C["weak"], 500, "end")
    return out

def board_entry(): return desktop_shell("entry", side_entry, 60, "入场前判断 · 1440×900", "保存中…", footer_mode="entry")
def board_holding(): return desktop_shell("holding", side_holding, 69, "持仓过程 · 1440×900", "已保存", footer_mode="holding")
def board_final(): return desktop_shell("final", side_final, 80, "事后复盘 · 1440×900", "已保存", footer_mode="final")
def board_records(): return desktop_shell("final", side_records, 80, "记录与快照 · 1440×900", "已保存", footer_mode="final")
def board_conflict(): return desktop_shell("entry", side_conflict, 60, "保存冲突 · 1440×900", "保存冲突", footer_mode="conflict")
def board_compact(): return desktop_shell("entry", side_entry, 60, "入场前判断 · 1280×800", "草稿", w=1280, h=800, footer_mode="entry")

def board_mobile():
    w,h = 390,844
    out = R(0,0,w,h,C["page"])
    out += R(0,0,w,56,C["float"]) + L(0,56,w,56,C["line"])
    out += T(16,37,"‹",30,C["muted"],400) + T(48,35,"600000",16,C["text"],700)
    out += button(158,6,70,"入场前",active=True,h=44,size=14) + button(234,6,52,"阶段⌄",h=44,size=14) + button(292,6,82,"更多",h=44,size=14)
    out += R(0,56,w,44,C["panel"]) + T(16,75,"行情截止 D60",12,C["muted"],600) + T(16,93,"成交截止 D60 · 买入前",12,C["amber"],600)
    chart,_ = draw_chart(0,100,w,220,60,"entry",compact=True)
    out += chart
    # form is a separately scrollable region with a clear scroll affordance.
    out += R(0,320,w,468,C["panel"]) + T(16,345,"入场前计划",18,C["text"],700) + T(w-16,345,"↕ 可滚动",12,C["weak"],500,"end")
    out += input_box(16,366,w-32,"计划入场价","56.00","CNY",h=44,accent=True)
    out += input_box(16,442,(w-38)/2,"初始止损","52.00",h=44)
    out += input_box(22+(w-38)/2,442,(w-38)/2,"止盈目标","68.00",h=44)
    out += T(16,520,"计划规模",12,C["muted"],600)
    out += chips(16,528,["按数量","按金额","按仓位 %"],0,[88,88,96],44)
    out += input_box(16,590,w-32,"计划数量","1000","股",h=44)
    out += R(16,650,w-32,44,C["float"],C["line"],1,6) + T(28,678,"▸ 参考资金与来源",12,C["text"],600) + T(w-28,678,"¥200,000",12,C["amber"],600,"end")
    out += T(16,715,"风险 ¥4,000 · 2.0% · 预期 3.00R",12,C["amber"],600)
    out += R(0,788,w,56,C["float"]) + L(0,788,w,788,C["line"])
    out += button(10,794,58,"上一根",h=44,size=14) + button(74,794,58,"▶ 播放",h=44,size=14) + button(138,794,64,"下一根",h=44,size=14) + button(208,794,74,"下一决策",h=44,size=14) + button(288,794,50,"留存",h=44,size=14) + button(344,794,36,"更多",h=44,size=14)
    return svg(w,h,"入场前判断 · 390×844",out)

def board_boundaries():
    w,h=1440,900
    out = nav(w)
    out += R(88,16,1336,868,C["panel"],C["line"],1,8) + R(88,16,1336,56,C["float"],None,1,8)
    out += T(104,50,"‹",30,C["muted"],400) + T(136,42,"600000 · 状态对照",18,C["text"],700)
    out += T(1320,42,"边界状态 · 每子帧独立",13,C["muted"],600,"end")
    panels=[("S03 · loading","行情加载中", "主图槽位保留，进度 68%", "loading"), ("S04 · no market","无行情数据","可重试行情 · 当前输入保留", "retry"), ("S05 · end","已到回放末尾","播放已禁用：没有下一根可知 K", "end"), ("S08 · missing","缺项 / 无效值","止损缺失 · 计划线不绘制", "missing"), ("S07 · longtext","长值与长文","证券身份可查全名 · 侧栏可滚动", "long"), ("S06 · same K","同 K 多决策候选","D68 两笔退出，按时间与 ID 区分", "same")]
    for i,(k,title,desc,kind) in enumerate(panels):
        col,row=i%3,i//3
        x=104+col*424; y=104+row*342
        out += R(x,y,400,314,C["panel"],C["line"],1,8) + T(x+18,y+28,k,12,C["amber"] if kind in ("missing","end") else C["muted"],700) + T(x+18,y+60,title,16,C["text"],700) + T(x+18,y+86,desc,12,C["muted"],500)
        if kind=="loading":
            out += R(x+18,y+118,364,120,C["page"],C["line"],1,6) + T(x+36,y+150,"加载行情与复盘字段…",13,C["text"],600)
            out += R(x+36,y+174,300,8,C["line"],None,1,4) + R(x+36,y+174,204,8,C["blue"],None,1,4) + T(x+36,y+214,"主图 / 侧栏仍可见",12,C["weak"],500)
        elif kind=="retry":
            out += R(x+18,y+118,364,120,C["page"],C["line"],1,6) + T(x+36,y+150,"暂时没有可知行情",13,C["text"],600) + T(x+36,y+176,"输入和已写 Text 保留。",12,C["muted"],500) + button(x+36,y+194,112,"重试行情",active=True,h=36,size=14)
        elif kind=="end":
            out += R(x+18,y+118,364,120,C["page"],C["line"],1,6) + T(x+36,y+150,"已到 D80 · 完整边界",13,C["text"],600) + button(x+36,y+174,112,"▶ 播放",disabled=True,h=36,size=14) + T(x+160,y+196,"禁用原因：没有下一根",12,C["weak"],500)
        elif kind=="missing":
            out += R(x+18,y+118,364,120,C["page"],C["line"],1,6) + T(x+36,y+150,"初始止损",12,C["muted"],600) + R(x+36,y+162,160,36,C["page"],C["red"],1,6) + T(x+48,y+186,"待填写",13,C["red"],600) + T(x+36,y+220,"依赖指标：待计算 · 计划线不绘制",12,C["weak"],500)
        elif kind=="long":
            out += R(x+18,y+118,364,120,C["page"],C["line"],1,6) + T(x+36,y+148,"示例股份有限公司（超长证券身份）",12,C["text"],600) + T(x+36,y+174,"金额 ¥200,000,000.00 · 可复制完整精度",12,C["muted"],500) + T(x+36,y+202,"长 Text 在侧栏内部换行，不挤掉动作。",12,C["weak"],500)
        else:
            out += R(x+18,y+118,364,154,C["page"],C["line"],1,6)
            out += T(x+32,y+142,"D68 · 同 K 多决策",12,C["focus"],700)
            items=[("10:14:03","减仓","600","64.00","dec-68-a"),("10:14:21","减仓","200","63.80","dec-68-b")]
            for j,it in enumerate(items):
                yy=y+166+j*44
                for xx,val in zip((x+32,x+106,x+174,x+236),(it[0],it[1],it[2],it[3])): out += T(xx,yy,val,11,C["text"],600)
                out += T(x+350,yy,it[4],10,C["weak"],500,"end")
    return svg(w,h,"复盘边界状态对照",out)

def mini_chart(x,y,w,h,stage,label):
    out=R(x,y,w,h,C["page"],C["line"],1,6)
    px=x+12; py=y+30; pw=w-58; ph=h-60; ax=px+pw
    cutoff=60 if stage=="entry" else 69 if stage=="holding" else 80
    lo, hi = 40, 72 if stage == "final" else 70
    price_top, price_bottom = py+10, y+h-42
    for i in range(4):
        yy = price_top+i*(price_bottom-price_top)/3
        out += L(px,yy,ax,yy,C["grid"])
        value = hi-i*(hi-lo)/3
        out += T(ax+10, yy+3, f"{value:.2f}", 9, C["muted"], 500, "start", MONO)
    day_ticks = [d for d in (1,20,40,60,80) if d <= cutoff]
    if cutoff not in day_ticks: day_ticks.append(cutoff)
    for d in day_ticks: out += T(day_x(d,px+4,ax-4,cutoff),y+h-14,f"D{d:02d}",9,C["weak"],500,"middle",MONO)
    for d,o,hi_v,lo_v,c,vol in BARS:
        if d>cutoff: break
        xx=day_x(d,px+4,ax-4,cutoff); yy=price_bottom-(c-lo)/(hi-lo)*(price_bottom-price_top)
        cc=C["up"] if c>=o else C["down"]
        out += L(xx,yy-6,xx,yy+6,cc) + R(xx-2,yy-3,4,6,cc,None,1,1)
    for price,nm in ((68,"目标"),(56,"入场"),(52,"止损")):
        yy=price_bottom-(price-lo)/(hi-lo)*(price_bottom-price_top); out += L(px,yy,ax,yy,C["amber"],1,"4 3")
    if stage!="entry":
        for d,p,lab in ((61,56,"买入 D61"),(68,64,"减仓 D68")):
            xx=day_x(d,px+4,ax-4,cutoff); yy=price_bottom-(p-lo)/(hi-lo)*(price_bottom-price_top); out += diamond(xx,yy,C["blue"],4) + T(xx+6,yy-5,lab,9,C["blue"],600)
    if stage=="final":
        xx=day_x(74,px+4,ax-4,cutoff); yy=price_bottom-(61-lo)/(hi-lo)*(price_bottom-price_top); out += diamond(xx,yy,C["green"],4) + T(xx+6,yy-5,"清仓 D74",9,C["green"],600)
    chart_text = "Text · 入场计划" if stage == "entry" else "Text · 持仓观察" if stage == "holding" else "Text · 退出复盘"
    out += T(x+12,y+18,label,11,C["muted"],700) + T(x+150,y+18,chart_text,9,C["focus"],500)
    return out

def board_export():
    w,h=1440,900; out=R(0,0,w,h,C["page"])
    out += R(64,24,1312,56,C["float"],C["line"],1,8) + T(88,58,"导出预览",18,C["text"],700) + T(280,58,"三张阶段图 + 一张总结表 · 冻结版本",13,C["muted"],500) + T(860,58,"示例股份 / 600000 · CNY",13,C["muted"],600) + T(1348,58,"已保存",13,C["green"],600,"end")
    out += T(88,112,"阶段图（保留计划线、Text 与该阶段已知成交；不含工具与回放条）",13,C["muted"],600)
    for i,(stage,label) in enumerate((("entry","01 入场前"),("holding","02 持仓"),("final","03 事后"))): out += mini_chart(88+i*424,132,392,230,stage,label)
    out += T(88,398,"总结表 · 原计划 / 风险基准 / 两笔退出 / 费用 / 全回合净额与 R",13,C["muted"],600)
    tx,ty,tw=88,420,1264
    out += R(tx,ty,tw,46,C["float"],C["line"],1,6)
    cols=[("字段",180),("原计划",228),("风险基准",140),("退出 1",192),("退出 2",192),("费用",110),("全回合净额",144),("实际 R",78)]
    xx=tx
    for lab,cw in cols: out += T(xx+14,ty+29,lab,12,C["text"],700) + L(xx+cw,ty,xx+cw,ty+240,C["line"]); xx+=cw
    rows=[
        ("计划入场 / 止损 / 目标","56.00 / 52.00 / 68.00","¥4,000 · 2%","D68 减仓 600 @ 64.00","D74 清仓 400 @ 61.00","¥40","+¥6,760","1.69R"),
        ("数量 / 资金","1000 股 · ¥200,000","3.00R 计划","已留存","已留存","原币 CNY","整个回合","冻结"),
        ("执行补充","退出均价62.80","计划仓位28%","提前：是 / 风险收缩 / 偏离","未评价","—","—","—"),
    ]
    for ri,row in enumerate(rows):
        yy=ty+46+ri*64; out += R(tx,yy,tw,64,C["panel"] if ri%2==0 else C["page"],C["line"],1,0); xx=tx
        for (lab,cw),val in zip(cols,row): out += T(xx+14,yy+30,val,11,C["green"] if lab in ("全回合净额","实际 R") and ri==0 else C["text"],600); xx+=cw
    out += R(88,684,1264,74,C["float"],C["line"],1,6) + T(108,714,"导出状态",12,C["muted"],600) + T(222,714,"三阶段已留存 · 当前未留存编辑不含在导出",13,C["amber"],600) + T(1328,714,"缺失阶段：无",12,C["muted"],600,"end")
    out += T(88,780,"图片保持各阶段独立价格轴；文字与总结表可编辑，成交与计划引用冻结版本。",12,C["weak"],500)
    return svg(w,h,"导出预览 · 三图一表",out)

def main():
    boards={
        "01-entry-1440.svg":board_entry(), "02-holding-1440.svg":board_holding(), "03-final-1440.svg":board_final(),
        "04-records-1440.svg":board_records(), "05-conflict-1440.svg":board_conflict(), "06-entry-1280.svg":board_compact(),
        "07-entry-390.svg":board_mobile(), "08-boundaries.svg":board_boundaries(), "09-export.svg":board_export(),
        "10-nav-expanded.svg":desktop_shell("entry", side_entry, 60, "入场前判断 · 导航展开", "草稿", w=1280, h=800, nav_expanded=True, footer_mode="entry"),
    }
    for name,data in boards.items(): (OUT/name).write_text(data, encoding="utf-8")
    print(f"generated {len(boards)} SVG boards in {OUT}")

if __name__ == "__main__": main()
