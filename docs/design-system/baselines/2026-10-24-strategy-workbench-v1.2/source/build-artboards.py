#!/usr/bin/env python3
"""Rebuild the strategy desk visual proposal SVG boards.

Static design boards only.  The figures use fictional data and are deliberately
not wired to the product runtime.
"""
from datetime import date
import json
from pathlib import Path
import importlib.util

_shared_spec = importlib.util.spec_from_file_location("strategy_shared_primitives", Path(__file__).with_name("shared-primitives.py"))
_shared = importlib.util.module_from_spec(_shared_spec)
_shared_spec.loader.exec_module(_shared)

OUT = Path(__file__).parent / "images"
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((Path(__file__).parent / "example-data.json").read_text(encoding="utf-8"))

BG = "#0B1019"
PANEL = "#111A26"
RAISED = "#162233"
LINE = "#283448"
TEXT = "#E6EDF7"
MUTED = "#A8B6CB"
WEAK = "#71829B"
BLUE = "#6CA8FF"
FOCUS = "#A9C8FF"
GREEN = "#53D7A0"
RED = "#FF8592"
WARN = "#FFC66D"
PURPLE = "#B59AFF"
CYAN = "#63D4DF"
ORANGE = "#F3A66B"
FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
NUM = "font-variant-numeric:tabular-nums"

def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def t(x, y, s, size=14, fill=TEXT, weight=400, anchor="start", cls=""):
    size = 14 if size in (13,15) else (12 if size == 11 else size)
    style = f"font-family:{FONT};font-size:{size}px;font-weight:{weight};fill:{fill};{NUM if cls == 'num' else ''}"
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{style}">{esc(s)}</text>'

def rect(x, y, w, h, fill=PANEL, stroke=LINE, r=8, sw=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def line(x1, y1, x2, y2, stroke=LINE, sw=1, dash=""):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}/>'

def path(d, stroke=BLUE, sw=2, fill="none", dash=""):
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<path d="{d}" stroke="{stroke}" stroke-width="{sw}" fill="{fill}" stroke-linecap="round" stroke-linejoin="round"{da}/>'

def pill(x, y, label, color=BLUE, w=None, fill=None):
    w = w or max(56, len(label) * 14 + 24)
    fill = fill or "#1B304A"
    # Visible chip is 24px / r6; transparent 36px wrapper documents the click target.
    hit = f'<rect x="{x}" y="{y-6}" width="{w}" height="36" rx="6" fill="none" stroke="none" opacity="0"/>'
    return hit + rect(x, y, w, 24, fill, color, 6) + t(x + w/2, y + 17, label, 12, color, 600, "middle")

def button(x, y, label, w, primary=False, disabled=False):
    return _shared.button(x, y, label, w, primary, disabled)

def field(x, y, w, label, value, hint=""):
    return t(x, y+12, label, 12, MUTED) + _shared.select_control(x, y+20, value, w, "calendar" if hint=="calendar" else "select")

def card(x, y, w, h, title, value="", sub="", accent=TEXT, metric=False):
    s = rect(x, y, w, h)
    s += t(x+16, y+19, title, 12, MUTED)
    if value: s += t(x+w-16, y+(48 if metric else (46 if h >= 80 else 42)), value, 28 if metric else 22, accent, 600, "end", "num")
    if sub: s += t(x+16, y+h-12, sub, 12, WEAK)
    return s

def mobile_metric(x, y, w, h, title, value, accent=TEXT):
    """Two-line metric card for narrow layouts; label and value never share a baseline."""
    return rect(x, y, w, h, PANEL, LINE, 8) + t(x+14, y+24, title, 12, MUTED) + t(x+w-14, y+53, value, 18, accent, 600, "end", "num")

def chrome(title, subtitle, W=1440, H=1000, watermark=True, breadcrumb=None, expanded=False):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    s += f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    s += _shared.nav_rail(H, expanded)
    breadcrumb = breadcrumb or ("策略台", "我的实验", "")
    s += t(78, 30, breadcrumb[0], 15, TEXT, 600) + t(150, 30, breadcrumb[1], 13, BLUE, 500) + t(250, 30, breadcrumb[2], 13, MUTED, 400)
    s += t(W-78, 30, "帮助", 13, MUTED, 400, "end") + t(W-32, 30, "林", 13, TEXT, 600, "end")
    s += t(100, 86, title, 24, TEXT, 600) + t(100, 112, subtitle, 14, MUTED)
    if watermark:
        s += rect(W-220, H-34, 196, 22, "#171E2A", "#303B4D", 11) + t(W-122, H-19, "虚构数据 · 视觉方案", 11, WEAK, 500, "middle")
    return s

def end(): return "</svg>"

def chart(x, y, w, h, mode="nav"):
    s = rect(x, y, w, h, PANEL, LINE, 8)
    if mode in ("result", "compare"):
        s += t(x+18, y+24, "阶段结果 · EMA20 v1.4", 12, MUTED) + t(x+18, y+50, "净值", 18, TEXT, 600)
        s += pill(x+w-228, y+16, "净值", BLUE, 54) + pill(x+w-164, y+16, "回撤", MUTED, 54, "#151F2E") + pill(x+w-100, y+16, "仓位", MUTED, 54, "#151F2E")
    elif mode == "observe":
        s += t(x+18, y+24, "EMA20 v1.4", 12, MUTED) + t(x+18, y+50, "组合净值", 16, TEXT, 600)
        s += _shared.segmented(x+130, y+10, "净值", 72, True) + _shared.segmented(x+208, y+10, "标的 K 线", 96, False)
        s += _shared.segmented(x+w-292, y+10, "回放观察", 92, True) + _shared.segmented(x+w-194, y+10, "阶段结果", 92, False) + _shared.segmented(x+w-96, y+10, "组合对比", 92, False)
    else:
        s += t(x+18, y+24, "EMA20 v1.4", 12, MUTED) + t(x+18, y+50, "组合净值", 18, TEXT, 600)
        s += pill(x+w-174, y+16, "组合净值", BLUE, 78) + pill(x+w-88, y+16, "标的 K 线", MUTED, 72, "#151F2E")
    gx, gy, gw = x+42, y+76, w-98
    # Keep the main net plot at 360px while giving its dates and the explanatory
    # baseline their own rows.  The old h-118 formula put both rows on one line.
    gh = min(360, h-150)
    for i in range(1,6): s += line(gx, gy+i*gh/6, gx+gw, gy+i*gh/6, LINE, 1)
    for i in range(1,9): s += line(gx+i*gw/9, gy, gx+i*gw/9, gy+gh, LINE, 1)
    values = DATA["navA"]
    dates = [date.fromisoformat(value) for value in DATA["dates"]]
    first, last = dates[0], dates[-1]
    span = max(1, (last-first).days)
    def plot_y(value):
        return gy + (1.030-value) / 0.050 * gh
    pts=[]
    for day, value in zip(dates, values):
        pts.append((gx+(day-first).days/span*gw, plot_y(value)))
    d="M "+" ".join((f"{px:.1f},{py:.1f}" if i==0 else f"L {px:.1f},{py:.1f}") for i,(px,py) in enumerate(pts))
    s += path(d, BLUE, 2.5)
    for px,py in pts: s += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{BLUE}"/>'
    if mode in ("result", "compare", "observe"):
        # The endpoint is an actual plotted point, with a readable y-axis scale.
        s += t(gx-10, gy+gh+4, "0.980", 11, MUTED, 400, "end", "num")
        s += t(gx-10, gy+gh*.50+4, "1.005", 11, MUTED, 400, "end", "num")
        s += t(gx-10, gy+4, "1.030", 11, MUTED, 400, "end", "num")
        endx, endy = pts[-1]
        # The endpoint is already one of the eight plotted points.
        s += t(endx+10, endy+5, "1.0254", 12, BLUE, 600, cls="num")
    else:
        s += line(gx, gy+gh*.72, gx+gw, gy+gh*.72, MUTED, 1, "3 4")
        s += t(gx+gw+12, gy+gh*.72+5, "NAV 1.0254", 12, FOCUS, 600, cls="num")
    if mode == "compare":
        date_labels = ["6/17","7/01","8/01","9/13"]
    elif mode == "compact":
        date_labels = ["6/14","7/01","8/01","9/13"]
    elif mode == "observe":
        date_labels = ["6/14","7/19","8/02","9/13"]
    else:
        date_labels = ["6/14","7月","8/01","8/16","9月","9/13"]
    if mode == "observe":
        label_indices = [0, 3, 4, 7]
        for index, lbl in zip(label_indices, date_labels):
            s += t(pts[index][0], gy+gh+27, lbl, 12, MUTED, 400, "middle")
    else:
        for i,lbl in enumerate(date_labels): s += t(gx+i*gw/(len(date_labels)-1), gy+gh+27, lbl, 12, MUTED, 400, "middle")
    if mode != "compact":
        s += t(x+18, y+h-12, "净值基线 1.0000　·　当前查看日 2024-09-13　·　结果截止 2024-09-13", 12, WEAK)
    return s

def side_check(x, y, w, h):
    s = rect(x,y,w,h)
    s += t(x+16,y+25,"当前组合",12,MUTED)+pill(x+w-96,y+12,"EMA20 v1.4",BLUE,80)
    s += t(x+16,y+54,"持仓概览",18,TEXT,600)+t(x+16,y+78,"随策略 · 每周 · 每组独立本金",12,WEAK)
    s += _shared.segmented(x+16,y+90,"概览",64,True) + _shared.segmented(x+86,y+90,"调仓记录",88) + _shared.segmented(x+180,y+90,"统计指标",88)
    rows=[("合成股票 A","¥5.68万","55.4%",GREEN),("合成股票 B","¥3.54万","34.6%",GREEN),("现金","¥1.03万","10.0%",TEXT),("组合净值","1.0254","",BLUE),("总资产","¥102,540.84","",TEXT)]
    yy=y+150
    for name,val,pct,col in rows:
        s += line(x+16,yy-14,x+w-16,yy-14,LINE)
        # Market values are identity/position data; green is reserved for outcome deltas.
        s += t(x+16,yy,name,14,TEXT,500)+t(x+w-16,yy,val.replace("102,540.84","10.25万"),14,TEXT,600,"end","num")
        if pct:s+=t(x+w-16,yy+20,pct,12,MUTED,400,"end","num")
        yy += 45
    s += t(x+16,y+h-16,"估值截止 2024-09-13",12,MUTED)
    return s

def make_observe():
    s=chrome("回测工作台","合成演示 · EMA20 v1.4 · 2024-09-13 · 已展开至 2024-09-13",W=1440,H=1080,watermark=False,breadcrumb=("策略","我的实验","EMA20 · 2024 Q3"))
    x,w=100,1240
    s += pill(x,132,"已完成",BLUE,64,"#172536") + t(x+82,151,"EMA20 v1.4",16,TEXT,600) + t(x+214,151,"独立本金 ¥10.00万",13,MUTED)
    s += pill(x+360,132,"低波动质量 v2.1",PURPLE,104,"#242038") + t(x+480,151,"独立本金 ¥10.00万",13,MUTED)
    s += button(x+w-220,128,"实验列表",88)+_shared.select_control(x+w-120,128,"更多组合",120)
    # ALIGN-ST-02 revision 2: reuse the homepage metric cards.
    card_w = (w - 3 * 12) / 4
    for i,(ttl,val,col) in enumerate([("净资产","¥10.25万",TEXT),("累计收益","+2.54%",GREEN),("最大回撤","-3.20%",RED),("仓位","90.0%",TEXT)]):
        xx=x+i*(card_w+12)
        s += rect(xx,184,card_w,88,PANEL,LINE,8)
        s += t(xx+16,211,ttl,14,MUTED) + t(xx+16,250,val,28,col,600,"start","num")
        s += t(xx+card_w-20,211,"ⓘ",12,MUTED,400,"middle")
    s += rect(x,284,w,62,PANEL,LINE,8)
    s += pill(x+14,303,"运行已完成",BLUE,80,"#172536") + t(x+112,314,"2024-09-13 · 收盘后",14,TEXT,600) + t(x+112,333,"已展开至 2024-09-13",12,MUTED)
    # Controls have a dedicated lane so the date field never collides with actions.
    s += field(x+720,287,190,"当前查看日","2024-09-13","calendar")
    s += button(x+924,297,"查看回测结果",136,True)+button(x+1074,297,"比较组合",96)
    s += t(x+w-24,338,"结果截止 9/13",12,MUTED,400,"end")
    s += t(x,379,"进度",13,MUTED,500)+pill(x+52,365,"已到计划结束日",WEAK,112,"#151F2E")+t(x+190,379,"完成状态无需继续展开行情",13,WEAK)
    s += chart(x,392,896,510,mode="observe") + side_check(x+920,392,320,430)
    s += rect(x,924,w,94,PANEL,LINE,8)
    s += t(x+18,953,"回放",16,TEXT,600)+pill(x+78,936,"当前 9/13",BLUE,96)+button(x+190,930,"返回最新日期",112,False,True)+button(x+314,930,"推进下一交易日",132,False,True)+button(x+458,930,"速度 1×",86,False,True)
    s += t(x+18,988,"完成状态：推进与播放已锁定；回看只改变当前查看日，不改变结果截止。",13,MUTED)

    s += end(); return s

def crop_shell(title, subtitle, W=920, H=360, watermark=False):
    """A 920px documentation crop with its own viewBox for readable review."""
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    s += f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    s += t(24, 30, title, 20, TEXT, 600) + t(24, 54, subtitle, 13, MUTED)
    if watermark:
        s += rect(W-212, H-32, 188, 20, "#171E2A", "#303B4D", 10) + t(W-118, H-18, "虚构数据 · 视觉方案", 10, WEAK, 500, "middle")
    return s

def make_observe_status_detail():
    s=crop_shell("主状态与查看控制","完成状态：查看日可以回看；行情、成交与结果截止独立保留",H=400)
    s += rect(24,84,872,280,PANEL,LINE,8)
    s += pill(44,104,"运行已完成",BLUE,92,"#172536") + t(152,122,"结果截止 2024-09-13",14,TEXT,600)
    s += field(44,152,208,"当前查看日","2024-09-13","calendar")
    s += button(278,172,"查看回测结果",136,True)+button(428,172,"比较组合",96)
    s += line(548,104,548,340,LINE)
    s += t(580,122,"工作模式",12,MUTED)
    s += _shared.segmented(580,138,"回放观察",92,True)+_shared.segmented(678,138,"阶段结果",92)+_shared.segmented(776,138,"组合对比",92)
    s += t(580,214,"主图",12,MUTED)+_shared.segmented(580,230,"净值",88,True)+_shared.segmented(680,230,"标的 K 线",120)
    s += t(44,264,"行情已展开至",14,MUTED)+t(524,264,"2024-09-13",14,TEXT,600,"end")
    s += t(44,304,"成交已展开至",14,MUTED)+t(524,304,"2024-09-13",14,TEXT,600,"end")
    s += t(580,308,"回看只改变当前查看日。",14,MUTED)+t(580,332,"完成状态下，推进与播放禁用。",14,MUTED)
    return s+end()

def save(name, body):
    (OUT/name).write_text(body, encoding="utf-8")

BUILDERS={"06-observe.svg":make_observe,"06-observe-status-detail.svg":make_observe_status_detail}
if __name__ == "__main__":
    for filename, builder in BUILDERS.items(): save(filename,builder())
