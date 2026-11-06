"""Build responsive strategy workbench design boards from shared fictional data."""
from datetime import date
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "images"
DATA = json.loads((ROOT / "example-data.json").read_text(encoding="utf-8"))
DATES = [date.fromisoformat(item) for item in DATA["dates"]]
NAV = DATA["navA"]
BG, PANEL, RAISED, LINE = "#0B1019", "#111A26", "#162233", "#283448"
TEXT, MUTED, WEAK = "#E6EDF7", "#A8B6CB", "#71829B"
BLUE, FOCUS, GREEN, RED = "#6CA8FF", "#A9C8FF", "#53D7A0", "#FF8592"
FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"


def esc(value):
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def rect(x, y, w, h, fill, stroke="none", r=0, sw=1, opacity=None):
    extra = f' opacity="{opacity}"' if opacity is not None else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{extra}/>'


def line(x1, y1, x2, y2, stroke=LINE, sw=1, dash=None):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"' + (f' stroke-dasharray="{dash}"' if dash else "") + '/>'


def text(x, y, value, size=14, fill=TEXT, weight=400, anchor="start", cls=""):
    ca = f' class="{cls}"' if cls else ""
    return f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}px" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{ca}>{esc(value)}</text>'


def circle(cx, cy, r, fill, stroke="none", sw=1):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def path(d, stroke=BLUE, sw=2.5, fill="none"):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'


def hit(x, y, w=44, h=44):
    return rect(x, y, w, h, "#000000", "none", 6, opacity=0)


def button(x, y, w, label, primary=False, disabled=False):
    out = hit(x - 4, y - 4, w + 8, 44)
    if disabled:
        fill, stroke, ink = "#151E2B", "#202B3A", WEAK
    else:
        fill, stroke, ink = (BLUE, BLUE, BG) if primary else (RAISED, LINE, TEXT)
    return out + rect(x, y, w, 36, fill, stroke, 6) + text(x + w / 2, y + 23, label, 14, ink, 600, "middle")


def pill(x, y, w, label, active=False):
    fill, stroke, ink = (("#1A2A40", BLUE, TEXT) if active else (RAISED, LINE, MUTED))
    return hit(x - 4, y - 10, w + 8, 44) + rect(x, y, w, 24, fill, stroke, 6) + text(x + w / 2, y + 16, label, 12, ink, 500, "middle")


def metric(x, y, w, h, label, value, accent=TEXT):
    return rect(x, y, w, h, PANEL, LINE, 8) + text(x + 14, y + 24, label, 12, MUTED) + text(x + w - 14, y + 57, value, 20, accent, 600, "end", "num")


def mode_tabs(x, y, active="回放观察"):
    out, xx = "", x
    for label in ("回放观察", "阶段结果", "组合对比"):
        out += pill(xx, y, 84, label, label == active)
        xx += 92
    return out


def nav_chart(x, y, w, h, plot_h, footer=True):
    out = rect(x, y, w, h, "#0F1826", LINE, 8) + text(x + w - 16, y + 27, "结果截止 2024-09-13", 12, MUTED, 400, "end")
    gx, gy, gw, gh = x + 50, y + 60, w - 68, plot_h
    for value, yy in (("1.030", gy), ("1.005", gy + gh / 2), ("0.980", gy + gh)):
        out += line(gx, yy, gx + gw, yy) + text(gx - 8, yy + 4, value, 12, WEAK, 400, "end", "num")
    first, last = DATES[0], DATES[-1]
    span = max(1, (last - first).days)
    points = [(gx + (day - first).days / span * gw, gy + (1.030 - value) / 0.050 * gh) for day, value in zip(DATES, NAV)]
    out += line(gx, gy + (1.030 - 1.000) / 0.050 * gh, gx + gw, gy + (1.030 - 1.000) / 0.050 * gh, WEAK, 1, "4 4")
    out += path("M " + " L ".join(f"{px:.1f} {py:.1f}" for px, py in points))
    for px, py in points:
        out += circle(px, py, 3.5, BLUE, BG, 1.5)
    out += text(points[-1][0] - 2, points[-1][1] - 10, "1.0254", 12, BLUE, 600, "end", "num")
    for index, label in ((0, "6/14"), (3, "7/19"), (4, "8/02"), (7, "9/13")):
        anchor = "start" if index == 0 else ("end" if index == 7 else "middle")
        out += text(points[index][0], gy + gh + 24, label, 12, MUTED, 400, anchor)
    if footer:
        out += text(x + 18, y + h - 12, "净值基线 1.0000 · 当前查看日 2024-09-13 · 结果截止 2024-09-13", 12, WEAK)
    return out


def inspector(x, y, w, h, compact=False):
    out = rect(x, y, w, h, PANEL, LINE, 8) + text(x + 16, y + 28, "检查区", 18 if compact else 16, TEXT, 600) + text(x + 16, y + 52, "当前组合 · EMA20 v1.4", 12, MUTED)
    out += pill(x + 16, y + 64, 54, "概览", True) + pill(x + 82, y + 64, 72, "调仓记录") + pill(x + 166, y + 64, 72, "统计指标")
    rows = (("合成股票 A", "¥56,819.15", "55.4%"), ("合成股票 B", "¥35,443.85", "34.6%"), ("现金", "¥10,277.84", "10.0%"), ("仓位", "90.0%", ""), ("结果截止", "2024-09-13", ""))
    yy, step = y + 138, 48 if compact or h >= 300 else 27
    for name, value, sub in rows:
        out += line(x + 16, yy - 15, x + w - 16, yy - 15) + text(x + 16, yy, name, 14 if compact else 12, TEXT if compact else MUTED) + text(x + w - 16, yy, value, 14, TEXT, 600, "end", "num")
        if sub:
            out += text(x + w - 16, yy + 18, sub, 12, MUTED, 400, "end", "num")
        yy += step
    if not compact:
        out += text(x + 16, y + h - 12, "回看只改变查看日，结果截止保持不变。", 12, MUTED)
    return out


def replay(x, y, w, narrow=False):
    out = rect(x, y, w, 112 if narrow else 92, RAISED, LINE, 8) + text(x + 18, y + 28, "回放", 16, TEXT, 600) + pill(x + 70, y + 16, 76, "当前 9/13", True)
    if narrow:
        out += text(x + 162, y + 28, "完成态 · 推进与速度禁用", 12, MUTED) + button(x + 14, y + 50, 84, "返回最新", True) + button(x + 106, y + 50, 124, "推进下一日", False, True) + button(x + 238, y + 50, 88, "速度 1×", False, True)
    else:
        out += button(x + 190, y + 14, 112, "返回最新日期", True) + button(x + 314, y + 14, 132, "推进下一交易日", False, True) + button(x + 458, y + 14, 86, "速度 1×", False, True) + text(x + 18, y + 70, "完成状态：推进与播放已锁定；回看只改变当前查看日，不改变结果截止。", 13, MUTED)
    return out


def svg_open(width, height, title, desc):
    return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">', f"<title>{esc(title)}</title>", f"<desc>{esc(desc)}</desc>", rect(0, 0, width, height, BG)]


def topbar(out, width, mobile=False):
    if mobile:
        out += [rect(0, 0, width, 48, PANEL), line(0, 47, width, 47), text(24, 30, "TradeReview", 14, TEXT, 600), text(146, 30, "虚构数据 · 视觉方案", 10, WEAK, 500), hit(338, 2, 44, 44), line(350, 18, 370, 18, MUTED, 1.5), line(350, 24, 370, 24, MUTED, 1.5), line(350, 30, 370, 30, MUTED, 1.5)]
    else:
        out += [rect(0, 0, 54, 1000, "#0D1522"), line(54, 0, 54, 1000), line(54, 48, width, 48), text(27, 31, "TR", 14, BLUE, 700, "middle"), text(78, 30, "策略", 15, TEXT, 600), text(128, 30, "我的实验", 13, BLUE, 500), text(218, 30, "EMA20 v1.4", 13, MUTED), text(width - 78, 30, "帮助", 13, MUTED, 400, "end"), text(width - 32, 30, "林", 13, TEXT, 600, "end")]


def narrow():
    out = svg_open(390, 1600, "策略台响应式适配 · 390 窄屏", "真实窄屏长画布：摘要、日期、三模式、图形切换、回放、检查区。")
    topbar(out, 390, True)
    out += [text(24, 72, "策略 / 我的实验 / EMA20 v1.4", 12, MUTED, 500), text(24, 108, "回测工作台", 24, TEXT, 600), text(24, 133, "完整观察 · 合成组合 · 2024 年 6 月—9 月", 14, MUTED), metric(24, 156, 165, 80, "净资产", "¥102,540.84"), metric(201, 156, 165, 80, "累计收益", "+2.54%", GREEN), metric(24, 252, 165, 80, "最大回撤", "-3.20%", RED), metric(201, 252, 165, 80, "仓位", "90.0%"), rect(24, 348, 342, 56, PANEL, LINE, 8), pill(38, 364, 88, "运行已完成"), text(140, 371, "结果截止 2024-09-13", 14, TEXT, 500), text(140, 390, "已锁定数据范围", 12, MUTED), hit(20, 416, 350, 64), rect(24, 420, 342, 56, PANEL, LINE, 6), text(38, 439, "当前查看日", 12, MUTED), text(38, 462, "2024-09-13", 14, TEXT, 500), text(348, 455, "⌄", 18, MUTED, 500, "middle"), rect(24, 492, 342, 480, "#0F1826", LINE, 8), text(40, 520, "净值", 18, TEXT, 600), pill(214, 504, 54, "净值", True), pill(280, 504, 72, "标的 K线"), mode_tabs(40, 538, "回放观察"), nav_chart(24, 564, 342, 350, 280, False), text(40, 958, "回放观察 · 图表、摘要与日期保持同一查看日", 12, MUTED), replay(24, 992, 342, True), inspector(24, 1122, 342, 408, False), text(24, 1570, "窄屏：重要说明保留，内容自然向下阅读。", 12, WEAK), "</svg>"]
    return "".join(out)


def compact():
    width, height = 1280, 1000
    out = svg_open(width, height, "策略台响应式适配 · 1280 紧凑桌面", "紧凑桌面保留三模式、320px 净绘图区、回放控制和检查区。")
    topbar(out, width)
    x = 72
    out += [text(x, 86, "回测工作台", 24, TEXT, 600), text(x, 112, "紧凑桌面 · 折叠导航 54 · 保留说明与回放槽", 14, MUTED), text(width - 24, 112, "虚构数据 · 视觉方案", 11, WEAK, 500, "end"), rect(x, 136, 1136, 88, RAISED, LINE, 8)]
    for i, (label, value, color) in enumerate((("净资产", "¥102,540.84", TEXT), ("累计收益", "+2.54%", GREEN), ("最大回撤", "-3.20%", RED), ("仓位", "90.0%", TEXT))):
        xx = x + i * 284
        if i: out += line(xx, 150, xx, 210)
        out += text(xx + 16, 163, label, 12, MUTED) + text(xx + 268, 197, value, 28, color, 600, "end", "num")
    out += [rect(x, 240, 1136, 64, PANEL, LINE, 8), pill(x + 16, 260, 88, "运行已完成"), text(x + 120, 269, "结果截止 2024-09-13 · 已锁定数据范围", 14, TEXT, 500), rect(x + 720, 244, 190, 56, PANEL, LINE, 6), text(x + 734, 263, "当前查看日", 12, MUTED), text(x + 734, 286, "2024-09-13", 14, TEXT, 500), text(x + 894, 280, "⌄", 18, MUTED, 500, "middle"), rect(x, 328, 796, 500, "#0F1826", LINE, 8), pill(x + 18, 344, 54, "净值", True), pill(x + 84, 344, 84, "标的 K线"), text(x + 18, 384, "净值", 18, TEXT, 600), mode_tabs(x + 300, 344, "回放观察"), nav_chart(x, 400, 796, 420, 320, False), inspector(x + 820, 328, 316, 500, True), replay(x, 848, 1136, False), text(x + 18, 818, "净值基线 1.0000 · 当前查看日 2024-09-13", 12, WEAK), text(x, 968, "紧凑桌面：图净高 320；完成态保留回看，推进与速度保持禁用。", 13, MUTED), "</svg>"]
    return "".join(out)


def overview():
    width, height = 1280, 1320
    out = svg_open(width, height, "响应式适配总览", "两种真实布局的组合总览；单独画板保留原尺寸阅读。")
    topbar(out, width)
    out += [text(72, 86, "响应式适配", 24, TEXT, 600), text(72, 112, "同一完成状态在紧凑桌面与窄屏的阅读顺序", 14, MUTED), text(width - 24, 112, "虚构数据 · 视觉方案", 11, WEAK, 500, "end"), rect(72, 148, 792, 110, RAISED, LINE, 8), text(96, 180, "1280 · 紧凑桌面", 18, TEXT, 600), text(96, 208, "摘要 → 日期 → 三模式 + 净值图 → 检查区 → 回放", 14, MUTED), pill(96, 222, 88, "图净 320"), pill(196, 222, 116, "推进与速度禁用"), pill(324, 222, 110, "速度 1× 禁用"), rect(888, 148, 320, 110, RAISED, LINE, 8), text(912, 180, "390 · 窄屏", 18, TEXT, 600), text(912, 208, "摘要 → 日期 → 三模式 → 图 → 回放", 14, MUTED), pill(912, 222, 84, "图净 280"), rect(72, 286, 1136, 380, PANEL, LINE, 8), text(96, 318, "紧凑桌面结构", 18, TEXT, 600), rect(96, 342, 1088, 82, RAISED, LINE, 8), text(116, 370, "连续摘要带", 14, MUTED), text(1160, 394, "¥102,540.84", 24, TEXT, 600, "end", "num"), text(1160, 414, "NAV 1.0254", 12, BLUE, 600, "end", "num"), line(96, 444, 860, 444), rect(96, 460, 764, 160, "#0F1826", LINE, 8), text(116, 490, "净值 · 三模式槽位", 16, TEXT, 600), mode_tabs(430, 478, "回放观察"), line(126, 550, 834, 550), line(126, 590, 834, 590), rect(884, 460, 300, 160, PANEL, LINE, 8), text(904, 490, "检查区", 16, TEXT, 600), text(904, 522, "现金", 12, MUTED), text(1164, 522, "10.0%", 14, TEXT, 600, "end", "num"), text(904, 550, "仓位", 12, MUTED), text(1164, 550, "90.0%", 14, TEXT, 600, "end", "num"), text(904, 578, "结果截止", 12, MUTED), text(1164, 578, "2024-09-13", 14, TEXT, 600, "end"), rect(72, 694, 1136, 560, PANEL, LINE, 8), text(96, 726, "窄屏结构（保持 390px 原始宽度）", 18, TEXT, 600), rect(96, 748, 390, 474, "#0F1826", LINE, 8), text(120, 780, "回测工作台", 20, TEXT, 600), rect(120, 800, 342, 60, RAISED, LINE, 8), text(138, 826, "净资产", 12, MUTED), text(446, 838, "¥102,540.84", 18, TEXT, 600, "end", "num"), mode_tabs(120, 878, "回放观察"), line(136, 934, 450, 934), line(136, 986, 450, 986), text(120, 1048, "2024-06-14", 12, MUTED), text(450, 1048, "2024-09-13", 12, MUTED, 400, "end"), rect(120, 1072, 342, 64, RAISED, LINE, 8), text(138, 1100, "回放", 14, TEXT, 600), pill(190, 1086, 72, "当前 9/13", True), text(520, 800, "窄屏读法", 16, TEXT, 600), text(520, 836, "两列摘要先确认结果，再确认查看日。", 14, MUTED), text(520, 868, "图表上方保留回放观察 / 阶段结果 / 组合对比。", 14, MUTED), text(520, 900, "图下固定回放槽，完成态推进与速度禁用。", 14, MUTED), text(520, 932, "检查区下移，长文自然换行，不缩小金额。", 14, MUTED), "</svg>"]
    return "".join(out)


BUILDERS = {"11-narrow.svg": narrow, "11-compact.svg": compact, "11-responsive.svg": overview}

if __name__ == "__main__":
    for filename, builder in BUILDERS.items():
        (OUT / filename).write_text(builder(), encoding="utf-8")
        print(OUT / filename)
