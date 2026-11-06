#!/usr/bin/env python3
"""Rebuild the strategy desk visual proposal SVG boards.

Static design boards only.  The figures use fictional data and are deliberately
not wired to the product runtime.
"""
from datetime import date
import json
from pathlib import Path

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
    fill = BLUE if primary else RAISED
    stroke = FOCUS if primary else LINE
    color = "#0B1019" if primary else (WEAK if disabled else TEXT)
    if disabled:
        fill, stroke = "#151E2B", "#202B3A"
    return rect(x, y, w, 36, fill, stroke, 6) + t(x+w/2, y+23, label, 14, color, 600, "middle")

def field(x, y, w, label, value, hint=""):
    s = rect(x, y, w, 56, PANEL, LINE, 6)
    s += t(x+12, y+19, label, 12, MUTED)
    s += t(x+12, y+42, value, 14, TEXT, 500)
    if hint: s += t(x+w-12, y+42, hint, 12, WEAK, 400, "end")
    return s

def card(x, y, w, h, title, value="", sub="", accent=TEXT, metric=False):
    s = rect(x, y, w, h)
    s += t(x+16, y+19, title, 12, MUTED)
    if value: s += t(x+w-16, y+(48 if metric else (46 if h >= 80 else 42)), value, 28 if metric else 22, accent, 600, "end", "num")
    if sub: s += t(x+16, y+h-12, sub, 12, WEAK)
    return s

def mobile_metric(x, y, w, h, title, value, accent=TEXT):
    """Two-line metric card for narrow layouts; label and value never share a baseline."""
    return rect(x, y, w, h, PANEL, LINE, 8) + t(x+14, y+24, title, 12, MUTED) + t(x+w-14, y+53, value, 18, accent, 600, "end", "num")

def chrome(title, subtitle, W=1440, H=1000, watermark=True, breadcrumb=None):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    s += f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    s += rect(0, 0, 54, H, "#0D1522", "none", 0)
    s += t(27, 31, "TR", 14, BLUE, 700, "middle") + line(54,0,54,H)
    s += line(54,48,W,48)
    breadcrumb = breadcrumb or ("策略", "策略库", "我的实验")
    s += t(78, 30, breadcrumb[0], 15, TEXT, 600) + t(128, 30, breadcrumb[1], 13, BLUE, 500) + t(218, 30, breadcrumb[2], 13, MUTED, 400)
    s += t(W-78, 30, "帮助", 13, MUTED, 400, "end") + t(W-32, 30, "林", 13, TEXT, 600, "end")
    s += t(100, 86, title, 24, TEXT, 600) + t(100, 112, subtitle, 14, MUTED)
    if watermark:
        s += rect(W-220, H-34, 196, 22, "#171E2A", "#303B4D", 11) + t(W-122, H-19, "虚构数据 · 视觉方案", 11, WEAK, 500, "middle")
    return s

def end(): return "</svg>"

def chart(x, y, w, h, mode="nav"):
    s = rect(x, y, w, h, "#0F1826", LINE, 8)
    if mode in ("result", "compare"):
        s += t(x+18, y+24, "阶段结果 · EMA20 v1.4", 12, MUTED) + t(x+18, y+50, "净值", 18, TEXT, 600)
        s += pill(x+w-228, y+16, "净值", BLUE, 54) + pill(x+w-164, y+16, "回撤", MUTED, 54, "#151F2E") + pill(x+w-100, y+16, "仓位", MUTED, 54, "#151F2E")
    elif mode == "observe":
        s += t(x+18, y+24, "EMA20 v1.4", 12, MUTED) + t(x+18, y+50, "组合净值", 18, TEXT, 600)
        s += pill(x+130, y+16, "净值", BLUE, 54) + pill(x+196, y+16, "标的 K 线", MUTED, 84, "#151F2E")
        s += pill(x+w-276, y+16, "回放观察", BLUE, 84) + pill(x+w-184, y+16, "阶段结果", MUTED, 84, "#151F2E") + pill(x+w-92, y+16, "组合对比", MUTED, 84, "#151F2E")
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
    s += pill(x+16,y+90,"概览",BLUE,54) + pill(x+82,y+90,"调仓记录",MUTED,72,"#151F2E") + pill(x+166,y+90,"统计指标",MUTED,72,"#151F2E")
    rows=[("合成股票 A","¥56,819.15","55.4%",GREEN),("合成股票 B","¥35,443.85","34.6%",GREEN),("现金","¥10,277.84","10.0%",TEXT),("组合净值","1.0254","",BLUE),("总资产","¥102,540.84","",TEXT)]
    yy=y+150
    for name,val,pct,col in rows:
        s += line(x+16,yy-14,x+w-16,yy-14,LINE)
        # Market values are identity/position data; green is reserved for outcome deltas.
        s += t(x+16,yy,name,14,TEXT,500)+t(x+w-16,yy,val,14,TEXT,600,"end","num")
        if pct:s+=t(x+w-16,yy+20,pct,12,MUTED,400,"end","num")
        yy += 45
    s += t(x+16,y+h-16,"面板可切换：概览、调仓记录、统计指标。",12,MUTED)
    return s

def make_observe():
    s=chrome("回测工作台","合成演示 · EMA20 v1.4 · 2024-09-13 · 已展开至 2024-09-13",W=1440,H=1080,breadcrumb=("策略","我的实验","EMA20 · 2024 Q3"))
    x,w=100,1240
    s += pill(x,132,"已完成",BLUE,64,"#172536") + t(x+82,151,"EMA20 v1.4",16,TEXT,600) + t(x+214,151,"独立本金 ¥100,000.00",13,MUTED)
    s += pill(x+360,132,"低波动质量 v2.1",PURPLE,104,"#242038") + t(x+480,151,"独立本金 ¥100,000.00",13,MUTED)
    s += button(x+w-168,128,"实验列表",84)+button(x+w-76,128,"更多组合⌄",76)
    # One continuous metric band keeps the primary values aligned without four floating cards.
    s += rect(x,184,w,88,RAISED,LINE,8)
    for i,(ttl,val,sub,col) in enumerate([("净资产","¥102,540.84","当前估值",TEXT),("累计收益","+2.54%","合成收益",GREEN),("最大回撤","-3.20%","期间峰值回撤",RED),("仓位","90.0%","当前持仓",TEXT)]):
        xx=x+i*314
        if i: s += line(xx,198,xx,258,LINE)
        s += t(xx+16,211,ttl,12,MUTED) + t(xx+298,244,val,28,col,600,"end","num") + t(xx+16,264,sub,12,WEAK)
    s += rect(x,284,w,62,RAISED,LINE,8)
    s += pill(x+14,303,"运行已完成",BLUE,80,"#172536") + t(x+112,314,"2024-09-13 · 收盘后",14,TEXT,600) + t(x+112,333,"已展开至 2024-09-13",12,MUTED)
    # Controls have a dedicated lane so the date field never collides with actions.
    s += field(x+720,287,190,"当前查看日","2024-09-13","⌄")
    s += button(x+924,297,"查看回测结果 →",136,True)+button(x+1074,297,"比较组合",96)
    s += t(x+w-24,319,"回看",12,MUTED,400,"end")
    s += t(x,379,"进度",13,MUTED,500)+pill(x+52,365,"已到计划结束日",WEAK,112,"#151F2E")+t(x+190,379,"完成状态无需继续展开行情",13,WEAK)
    s += chart(x,392,896,510,mode="observe") + side_check(x+920,392,320,430)
    s += rect(x,924,w,94,RAISED,LINE,8)
    s += t(x+18,953,"回放",16,TEXT,600)+pill(x+78,936,"当前 9/13",BLUE,96)+button(x+190,930,"返回最新日期",112,True)+button(x+314,930,"推进下一交易日",132,False,True)+button(x+458,930,"速度 1×",86,False,True)
    s += t(x+18,988,"完成状态：推进与播放已锁定；回看只改变当前查看日，不改变结果截止。",13,MUTED)
    s += t(x+18,1009,"调仓事件 14 条 · 价格、目标仓位与实际成交分开显示。",12,WEAK)
    s += end(); return s

def crop_shell(title, subtitle, W=920, H=360):
    """A 920px documentation crop with its own viewBox for readable review."""
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    s += f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    s += t(24, 30, title, 20, TEXT, 600) + t(24, 54, subtitle, 13, MUTED)
    s += rect(W-212, H-32, 188, 20, "#171E2A", "#303B4D", 10) + t(W-118, H-18, "虚构数据 · 视觉方案", 10, WEAK, 500, "middle")
    return s

def make_observe_status_detail():
    s=crop_shell("主状态与查看控制","完成态 · 当前查看日与结果动作独立排列；用于文档局部放大")
    s += rect(24,84,872,220,RAISED,LINE,8)
    s += pill(44,108,"运行已完成",BLUE,80,"#172536")
    s += t(140,127,"2024-09-13 · 收盘后",15,TEXT,600)+t(140,151,"已展开至 2024-09-13 · 已到计划结束日",13,MUTED)
    s += field(44,182,208,"当前查看日","2024-09-13","⌄")
    s += button(278,192,"查看回测结果 →",136,True)+button(428,192,"比较组合",96)
    s += line(548,108,548,270,LINE)
    s += t(580,127,"查看模式",12,MUTED)+pill(644,108,"回放观察",BLUE,72)+pill(718,108,"阶段结果",MUTED,72,"#151F2E")+pill(792,108,"组合对比",MUTED,72,"#151F2E")
    s += t(580,170,"查看范围",13,MUTED)+t(580,198,"结果截止",12,MUTED)+t(868,198,"2024-09-13",15,TEXT,600,"end")
    s += t(580,230,"主图",12,MUTED)+pill(644,212,"净值",BLUE,72)+pill(724,212,"标的 K 线",MUTED,96,"#151F2E")
    s += t(580,258,"状态说明",12,MUTED)+t(580,282,"完成状态无需继续展开行情 · 回看不改变结果截止",13,TEXT,500)
    s += end(); return s

def make_time_controls_detail():
    s=crop_shell("回放时间控制","四个日期边界分开显示；推进、回看与返回动作不混在同一语义里")
    s += rect(24,84,872,220,PANEL,LINE,8)
    s += field(44,106,196,"当前查看日","2024-06-14","⌄")
    s += field(256,106,196,"行情已展开至","2024-06-28","已看后续")
    s += field(468,106,196,"成交已展开至","2024-06-17","2 笔")
    s += field(680,106,196,"结果截止","2024-09-13","锁定")
    s += line(44,184,876,184,LINE)
    s += t(44,210,"当前回放",12,MUTED)+pill(112,194,"回看 6/14",WARN,88,"#332918")
    s += button(224,194,"返回最新日期",132,True)+button(368,194,"推进下一交易日",144)+button(524,194,"暂停播放",96)
    s += t(644,216,"回看不会泄露后续 K 线或成交",12,WEAK)
    s += end(); return s

def make_library_package_detail():
    s=crop_shell("策略包目录与归档确认","包目录保留职责与版本；归档是整理动作，已有完整策略仍可用")
    s += rect(24,84,548,220,PANEL,LINE,8)+t(44,112,"策略包目录",16,TEXT,600)+t(44,136,"3 类 · 19 个包",12,MUTED)+button(420,102,"按最近更新⌄",128)
    rows=[("标的筛选策略包","8 个","置顶 · v2.0",CYAN),("买入信号包","6 个","v1.3",BLUE),("止盈止损策略包","5 个","v1.1",ORANGE)]
    for i,(name,count,meta,col) in enumerate(rows):
        yy=156+i*42; s+=line(44,yy-10,548,yy-10,LINE)+rect(44,yy,6,24,col,"none",3)+t(62,yy+17,name,14,TEXT,600)+t(300,yy+17,count,13,col,600)+t(524,yy+17,meta,12,MUTED,500,"end")
    s += rect(592,84,304,220,RAISED,LINE,8)+t(612,112,"归档确认",16,TEXT,600)+pill(612,128,"整理动作",WARN,84,"#332918")
    s += t(612,180,"价值回归实验版 · v0.9",14,TEXT,500)+t(612,204,"从新增选择中隐藏",12,MUTED)+t(612,228,"已有完整策略仍可运行",12,GREEN)+button(612,252,"确认归档",112,True)
    s += end(); return s

def save(name, body):
    (OUT/name).write_text(body, encoding="utf-8")

def make_library():
    s=chrome("策略库","方法可复用，版本可追溯；从这里管理完整策略与三类策略包")
    x,w=100,1240
    s += pill(x,132,"策略库",BLUE,72)+pill(x+80,132,"我的实验",MUTED,84,"#151F2E")
    s += button(x+w-100,128,"新建策略",100,True)
    s += field(x,184,390,"搜索策略或包","EMA20、质量、移动止盈","⌕")
    s += button(x+406,194,"全部类型⌄",116)+button(x+530,194,"全部状态⌄",116)+button(x+654,194,"最近更新⌄",116)
    s += t(x,267,"完整策略",18,TEXT,600)+t(x+108,267,"3 个结果",12,MUTED)
    s += pill(x+w-166,248,"紧凑列表",BLUE,80)+t(x+w-24,267,"已归档 2",12,WEAK,400,"end")
    headers=[("名称",x),("版本",x+390),("组成",x+550),("适用范围",x+760),("更新",x+954),("",x+1160)]
    s+=rect(x,286,w,40,RAISED,LINE,6)
    for h,xx in headers:s+=t(xx+12,312,h,12,MUTED,500)
    rows=[("EMA20 趋势质量","v1.4","筛选 · 买入 · 止盈止损","A股 · 日线","今天 10:24",GREEN),("低波动质量","v2.1","筛选 · 买入 · 止盈止损","A股 · 周线","昨天 16:08",PURPLE),("价值回归实验版","v0.9","筛选 · 买入 · 止盈止损","港股 · 日线","9月 28日",WARN)]
    yy=326
    for name,ver,parts,scope,upd,col in rows:
        s+=rect(x,yy,w,72,PANEL,LINE,0)+t(x+16,yy+29,name,15,TEXT,600)+t(x+16,yy+51,"完整策略 · 可用于新实验",12,MUTED)
        s+=t(x+402,yy+36,ver,14,col,600)+t(x+562,yy+36,parts,13,MUTED)+t(x+772,yy+36,scope,13,MUTED)+t(x+966,yy+36,upd,13,MUTED)
        s+=t(x+w-46,yy+38,"•••",18,MUTED,600,"end")
        yy+=72
    s+=t(x,566,"策略包",18,TEXT,600)+t(x+96,566,"三类包独立管理，选择时按职责理解",12,MUTED)
    for i,(label,count,col) in enumerate([("标的筛选策略包","8 个",CYAN),("买入信号包","6 个",BLUE),("止盈止损策略包","5 个",ORANGE)]):
        xx=x+i*414; s+=rect(xx,588,394,108,RAISED,LINE,8)+rect(xx+16,606,8,68,col,"none",4)+t(xx+42,625,label,16,TEXT,600)+t(xx+42,650,"按包查看规则摘要、数据要求与版本",12,MUTED)+t(xx+360,628,count,14,col,600,"end")+t(xx+360,652,"查看 →",12,BLUE,600,"end")
    s+=rect(x,728,w,116,PANEL,LINE,8)+t(x+18,757,"归档整理",14,TEXT,600)+t(x+18,783,"归档只影响列表与新增选择；已有完整策略仍可运行。编辑或复制时明确沿用归档版本。",13,MUTED)+pill(x+w-150,750,"显示已归档",WARN,110,"#332918")
    s+=end(); return s

def make_compose():
    s=chrome("复制完整策略","复制来源版本并生成独立副本；原策略与历史实验继续引用原版本")
    x,w=100,1240
    s+=t(x,151,"策略名称",14,MUTED)+field(x,160,580,"名称","EMA20 副本","")+field(x+596,160,300,"来源","复制：EMA20 v1.3","锁定")+button(x+w-132,170,"创建副本",132,True)
    s+=t(x,254,"三包组装",18,TEXT,600)+t(x+110,254,"每个槽位只承担一种职责",12,MUTED)
    items=[("01","标的筛选策略包","大盘质量 + 趋势强度","版本 v2.0 · 8 个候选",CYAN),("02","买入信号包","突破后回踩确认","版本 v1.3 · 日线",BLUE),("03","止盈止损策略包","移动止盈 8% · 固定止损 5%","版本 v1.1 · 参数可见",ORANGE)]
    yy=278
    for no,title,desc,meta,col in items:
        s+=rect(x,yy,w,104,PANEL,LINE,8)+pill(x+18,yy+20,no,col,42,"#172536")+t(x+82,yy+38,title,16,TEXT,600)+t(x+82,yy+65,desc,14,MUTED)+t(x+82,yy+87,meta,12,WEAK)+button(x+w-176,yy+34,"更换包",76)+button(x+w-90,yy+34,"查看详情",76)
        yy+=120
    s+=rect(820,620,520,270,RAISED,LINE,8)+t(844,652,"副本摘要",16,TEXT,600)+t(844,681,"复制来源",12,MUTED)+t(1296,681,"EMA20 v1.3",14,TEXT,500,"end")+t(844,713,"新副本名称",12,MUTED)+t(1296,713,"EMA20 副本",14,TEXT,500,"end")+t(844,745,"三包版本",12,MUTED)+t(1296,745,"筛选 v2.0 · 买入 v1.3 · 止盈 v1.1",12,TEXT,500,"end")+line(844,766,1316,766)+t(844,797,"创建后：生成独立副本，来源版本保持不变。",13,GREEN)+t(844,827,"编辑与复制都会留下来源标识，历史实验不受影响。",12,MUTED)
    s+=rect(x,650,680,180,PANEL,LINE,8)+t(x+20,682,"组装预览",16,TEXT,600)+t(x+20,715,"候选范围",12,MUTED)+t(x+650,715,"128",14,TEXT,600,"end")+t(x+20,747,"预热周期",12,MUTED)+t(x+650,747,"60 个交易日",14,TEXT,600,"end")+t(x+20,779,"可执行状态",12,MUTED)+pill(x+548,762,"可保存",GREEN,84,"#153128")
    s+=end(); return s

def make_experiments():
    s=chrome("我的实验","运行记录与草稿分开管理；新建后锁定起点、策略版本和独立本金")
    x,w=100,1240
    s+=button(x+w-100,128,"新建实验",100,True)+field(x,184,390,"搜索实验","EMA20、9月、暂停","⌕")+button(x+406,194,"全部状态⌄",116)+button(x+530,194,"最近更新⌄",116)
    s+=t(x,267,"实验列表",18,TEXT,600)+t(x+106,267,"4 条记录",12,MUTED)
    s+=rect(x,286,w,40,RAISED,LINE,6)
    for h,xx in [("名称",x),("状态",x+420),("起点与期限",x+590),("策略",x+800),("更新时间",x+1030)]:s+=t(xx+12,312,h,12,MUTED,500)
    rows=[("EMA20 · 2024 Q3","已完成","2024-06-14 · 3个月","2 套独立组合","今天 10:24",GREEN),("低波动质量 · 试跑","暂停","2024-09-02 · 1个月","1 套独立组合","昨天 18:40",WARN),("价值回归 · 预览","草稿","2024-10-01 · 6个月","未确认","9月 28日",BLUE),("趋势 + 质量 · 失败","失败","2024-01-02 · 1年","数据覆盖不足","9月 20日",RED)]
    yy=326
    for nm,st,range_,strat,upd,col in rows:
        s+=rect(x,yy,w,76,PANEL,LINE,0)+t(x+16,yy+31,nm,15,TEXT,600)+pill(x+420,yy+20,st,col,64,"#172536")+t(x+602,yy+32,range_,13,MUTED)+t(x+812,yy+32,strat,13,MUTED)+t(x+1042,yy+32,upd,13,MUTED)+t(x+w-48,yy+35,"•••",18,MUTED,600,"end")
        yy+=76
    s+=rect(x,672,w,126,RAISED,LINE,8)+t(x+20,705,"状态说明",15,TEXT,600)+t(x+20,734,"草稿可继续创建；暂停保留当前进度；失败保留原因与原输入；已完成可查看结果或重开。",13,MUTED)+t(x+20,764,"返回列表不会新建实验，也不会替换已锁定策略版本。",13,MUTED)
    s+=end(); return s

def make_create():
    s=chrome("创建实验","四步正式流程：设置起点 → 选择策略 → 预览组合 → 确认创建",breadcrumb=("策略","我的实验","创建实验"))
    x,w=100,1240
    steps=[("1","设置起点",BLUE),("2","选择策略",MUTED),("3","预览组合",MUTED),("4","确认创建",MUTED)]
    for i,(n,l,c) in enumerate(steps):
        xx=x+i*310; s+=pill(xx,136,f"{n}  {l}",c,138,"#172536" if i==0 else "#151F2E")
        if i<3:s+=line(xx+146,150,xx+292,150,LINE,2)
    # Two frames are intentionally shown together so the transition is legible:
    # frame 1 fixes time/scope; frame 2 selects existing complete strategies.
    s+=rect(x,194,600,570,PANEL,LINE,8)+t(x+24,226,"第 1 步 · 设置起点",18,TEXT,600)+t(x+24,254,"固定当时可知的数据范围，实验从收盘后开始观察。",13,MUTED)
    s+=field(x+24,278,310,"起点时间（收盘后）","2024-06-14 16:00","Asia/Shanghai")+field(x+346,278,194,"运行期限","3 个月","⌄")
    s+=field(x+24,350,250,"市场","A股","⌄")+field(x+290,350,250,"每组独立本金","¥100,000.00","各一组")
    s+=t(x+24,454,"你将创建",16,TEXT,600)+t(x+24,488,"起点（含时区）",12,MUTED)+t(x+540,488,"2024-06-14 16:00",14,TEXT,600,"end")+t(x+24,522,"名义结束",12,MUTED)+t(x+540,522,"2024-09-14",14,TEXT,600,"end")+t(x+24,556,"最后完整交易日",12,MUTED)+t(x+540,556,"2024-09-13",14,TEXT,600,"end")+t(x+24,590,"策略组合",12,MUTED)+t(x+540,590,"待下一步选择",14,WEAK,600,"end")+line(x+24,610,x+540,610)+t(x+24,638,"下一步会显示候选、目标仓位与数据截止。",13,MUTED)+button(x+24,680,"取消",80)+button(x+348,680,"下一步：选择策略 →",168,True)
    s+=rect(x+640,194,600,570,RAISED,LINE,8)+t(x+664,226,"第 2 步 · 选择策略",18,TEXT,600)+t(x+664,254,"选择一个或多个已有完整策略；需要新方法时可就地新建。",13,MUTED)
    s+=field(x+664,278,420,"搜索策略","EMA20、质量、趋势","⌕")+button(x+1098,288,"新建策略",118)
    s+=t(x+664,376,"可选完整策略",14,TEXT,600)+t(x+1188,376,"已选",12,MUTED,400,"end")
    for i,(nm,ver,col,desc) in enumerate([("EMA20 趋势质量","v1.4",BLUE,"筛选 + 买入 + 止盈止损"),("低波动质量","v2.1",PURPLE,"筛选 + 买入 + 止盈止损"),("价值回归实验版","v0.9",WEAK,"数据覆盖待检查")]):
        yy=402+i*72;s+=rect(x+664,yy,552,58,PANEL,LINE,6)+t(x+684,yy+24,nm,14,TEXT,600)+t(x+684,yy+45,desc,12,MUTED)+t(x+1062,yy+23,ver,13,col,600)+pill(x+1128,yy+15,"已选" if i<2 else "选择",GREEN if i<2 else WEAK,64,"#153128" if i<2 else "#151F2E")
    s+=t(x+664,646,"每个策略进入独立本金组合，资金与账本不会混用。",13,MUTED)+button(x+664,680,"← 返回起点",104)+button(x+1000,680,"下一步：预览组合 →",168,True)
    s+=end(); return s

def make_confirm():
    s=chrome("预览组合与确认","第 3 步展示候选与目标，第 4 步锁定独立资金和执行参数",breadcrumb=("策略","我的实验","创建实验"))
    x,w=100,1240
    s+=pill(x,136,"1 设置起点",GREEN,138,"#153128")+pill(x+154,136,"2 选择策略",GREEN,138,"#153128")+pill(x+308,136,"3 预览组合",BLUE,138,"#172536")+pill(x+462,136,"4 确认创建",MUTED,138,"#151F2E")
    s+=rect(x,194,w,212,PANEL,LINE,8)+t(x+24,226,"候选与目标",18,TEXT,600)+t(x+24,254,"完整策略 EMA20 v1.4 · 筛选 v2.0 · 买入 v1.3 · 止盈止损 v1.1 · 2024-06-14 截止",13,MUTED)+t(x+24,286,"候选标的",12,MUTED)+t(x+350,286,"目标仓位",12,MUTED)+t(x+520,286,"实际持仓（T0）",12,MUTED)+t(x+710,286,"数据与规则截止",12,MUTED)
    for i,(nm,target,actual,cut,col) in enumerate([("合成股票 A","45.0%","0.0%","2024-06-14",CYAN),("合成股票 B","45.0%","0.0%","2024-06-14",BLUE),("现金","10.0%","100.0%","起点现金",TEXT)]):
        yy=310+i*28;s+=rect(x+16,yy-18,w-32,28,"#13202E","none",4)+t(x+30,yy,nm,13,TEXT,500)+t(x+350,yy,target,13,col,600,"start","num")+t(x+520,yy,actual,13,TEXT,600,"start","num")+t(x+710,yy,cut,13,MUTED,500)
    s+=rect(x,430,600,302,RAISED,LINE,8)+t(x+24,464,"独立资金",18,TEXT,600)+field(x+24,486,250,"策略 A 本金","¥100,000.00","独立核算")+field(x+300,486,250,"策略 B 本金","¥100,000.00","独立核算")+t(x+24,578,"锁定策略",12,MUTED)+t(x+552,578,"EMA20 v1.4",14,TEXT,600,"end")+t(x+24,606,"三包版本",12,MUTED)+t(x+552,606,"筛选 v2.0 · 买入 v1.3 · 止盈止损 v1.1",12,TEXT,500,"end")+t(x+24,634,"两个组合共享日期范围，资金、持仓和账本分别计算。",13,MUTED)+pill(x+24,668,"T0：0 持仓 · 100% 现金",WARN,196,"#332918")
    s+=rect(x+624,430,616,302,PANEL,LINE,8)+t(x+648,464,"执行参数",18,TEXT,600)+field(x+648,486,252,"执行节奏","下一交易日开盘","⌄")+field(x+916,486,252,"交易费用","0.10% / 笔","假设")+field(x+648,558,252,"滑点假设","0.05%","假设")+field(x+916,558,252,"调仓频率","每 5 个交易日","⌄")+t(x+648,638,"起点：2024-06-14 16:00（Asia/Shanghai）",12,MUTED)+t(x+648,660,"名义结束：2024-09-14 · 最后完整交易日：2024-09-13",12,MUTED)+button(x+1020,680,"确认创建",148,True)
    s+=end(); return s

def make_time():
    s=chrome("回放观察","三帧分镜：T0 起点 → 首日新 K 线与成交 → 回看 6/14（保留已看后续）")
    x,w=100,1240
    frames=[
        ("T0 · 2024-06-14","0 持仓 · 现金 100%","行情已展开至 2024-06-14",False,"2024-06-14","推进后可见",4),
        ("推进后 · 2024-06-17","首次建仓 · A 44.5% / B 45.5%","行情与成交已展开至 2024-06-17",True,"2024-06-17","推进后可见",5),
        ("回看 · 2024-06-14","当前仍为 0 持仓 · 现金 100%","已展开至 2024-06-28 · 曾看至 6/28",False,"2024-06-14","—",4),
    ]
    for i,(title,stat,cut,trade,current,next_event,visible) in enumerate(frames):
        xx=x+i*414;s+=rect(xx,158,394,672,PANEL,LINE,8)+t(xx+18,190,title,16,TEXT,600)+t(xx+18,217,stat,13,GREEN if trade else TEXT,600)+t(xx+18,241,cut,12,MUTED)
        s+=rect(xx+18,264,358,280,"#0F1826",LINE,6)
        for gy in [314,364,414,464]:s+=line(xx+32,gy,xx+334,gy,LINE)
        vals=[[.45,.40,.50,.44],[.45,.40,.50,.44,.55],[.45,.40,.50,.44]][i]
        base=500; step=300/max(1,visible-1)
        pts=[(xx+34+j*step, max(314,min(504,base-v*170))) for j,v in enumerate(vals)]
        d="M "+" ".join((f"{px:.1f},{py:.1f}" if j==0 else f"L {px:.1f},{py:.1f}") for j,(px,py) in enumerate(pts));s+=path(d,BLUE,2)
        for j,(px,py) in enumerate(pts):
            s+=f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{GREEN if trade and j==visible-1 else BLUE}"/>'
        # K bars stay inside the plot; b anchors the first fill marker to its new bar.
        for j,v in enumerate(vals):
            bx=xx+34+j*step; top=max(314,base-v*170-12); bot=min(504,base-v*170+12)
            s+=line(bx,top-12,bx,bot+12,GREEN if trade and j==visible-1 else BLUE,2)+rect(bx-5,top,10,max(6,bot-top),GREEN if trade and j==visible-1 else BLUE,"none",2)
        if trade:s+=pill(xx+214,298,"首次建仓",GREEN,86,"#153128")
        s+=t(xx+34,521,"6/14",12,MUTED)+t(xx+332,521,"可见截止 "+("6/17" if i==1 else "6/14"),12,MUTED,400,"end")+t(xx+18,582,"当前查看日",12,MUTED)+t(xx+350,582,current,14,TEXT,600,"end")+t(xx+18,616,"下一可知事件",12,MUTED)+t(xx+350,616,next_event,14,BLUE if i<2 else WEAK,600,"end")+t(xx+18,662,"视野",12,MUTED)+t(xx+350,662,"仅显示当前截止",13,TEXT,500,"end")
        s+=button(xx+18,700,"返回最新日期" if i==2 else ("推进下一交易日" if i==0 else "暂停播放"),176 if i==2 else 164, i==0 or i==2)
        if i==2:s+=pill(xx+212,704,"已看后续：回看来源",WARN,164,"#332918")
    s+=t(x,866,"日期边界独立显示：当前查看日 / 行情已展开至 / 成交已展开至 / 结果截止。切换组合、侧栏或缩放不会推进任何边界。",13,MUTED)+end();return s

def make_time_single(index):
    """One full-size replay storyboard frame for documentation sequencing."""
    frames=[
        ("07a · T0 起点 · 2024-06-14", "0 持仓 · 现金 100%", "行情已展开至 2024-06-14", False, "2024-06-14", "推进后可见", 4),
        ("07b · 首日新 K 线与成交 · 2024-06-17", "首次建仓 · A 44.5% / B 45.5%", "行情与成交已展开至 2024-06-17", True, "2024-06-17", "推进后可见", 5),
        ("07c · 回看起点 · 2024-06-14", "当前仍为 0 持仓 · 现金 100%", "已展开至 2024-06-28 · 曾看至 6/28", False, "2024-06-14", "—", 4),
    ]
    title,stat,cut,trade,current,next_event,visible=frames[index]
    s=chrome("回放观察",f"{title} · 日期边界分开记录，回看不会改变后续展开范围")
    x,w=100,1240
    s+=rect(x,158,w,672,PANEL,LINE,8)+t(x+24,192,title,18,TEXT,600)
    s+=pill(x+24,214,"首日成交" if trade else ("回看" if index==2 else "T0"),GREEN if trade else (WARN if index==2 else BLUE),86,"#153128" if trade else ("#332918" if index==2 else "#172536"))
    s+=t(x+128,234,stat,14,GREEN if trade else TEXT,600)+t(x+420,234,cut,13,MUTED)
    # Candle plot makes the time transition visible at a glance; b adds a trade marker.
    px,py,pw,ph=x+24,274,820,358
    s+=rect(px,py,pw,ph,"#0F1826",LINE,8)+t(px+18,py+28,"标的 K 线 · 价格可知范围",14,TEXT,600)+t(px+pw-18,py+28,"EMA20 v1.4",12,MUTED,500,"end")
    for gy in [py+92,py+156,py+220,py+284]: s+=line(px+22,gy,px+pw-22,gy,LINE)
    bars0=[(98,72,128,104),(128,96,160,112),(158,88,196,126),(190,110,226,144),(220,102,258,136),(252,126,292,158),(286,118,322,150),(318,140,356,174),(350,132,388,164),(384,152,422,188),(418,142,456,176),(452,166,490,202)]
    bars1=[(98,72,128,104),(128,96,160,112),(158,88,196,126),(190,110,226,144),(220,102,258,136),(252,126,292,158),(286,118,322,150),(318,140,356,174),(350,132,388,164),(384,152,422,188),(418,142,456,176),(452,166,490,202)]
    vals=(bars1 if trade else bars0)[:visible]
    step=(pw-100)/max(1,visible-1)
    for j,(lo,op,cl,hi) in enumerate(vals):
        base=py+ph-26
        bx=px+46+j*step; top=max(py+74,base-hi); bot=min(py+ph-26,base-lo); body_top=max(py+74,base-max(op,cl)); body_bot=min(py+ph-26,base-min(op,cl))
        col=GREEN if cl>=op else RED
        s+=line(bx,top,bx,bot,col,2)+rect(bx-8,body_top,16,max(8,body_bot-body_top),col,"none",2)
    nav_pts=[(px+46+j*step,max(py+74,min(py+ph-26,base-hi-10))) for j,(lo,op,cl,hi) in enumerate(vals)]
    s+=path("M "+" ".join((f"{px0:.1f},{py0:.1f}" if j==0 else f"L {px0:.1f},{py0:.1f}") for j,(px0,py0) in enumerate(nav_pts)),BLUE,2.5)
    if trade:
        tx,ty=nav_pts[-1]
        s+=f'<path d="M {tx} {ty-16} L {tx+10} {ty} L {tx} {ty+16} L {tx-10} {ty} Z" fill="{GREEN}" stroke="{GREEN}"/>'
        s+=t(tx-18,ty+5,"首次建仓 · 2 笔",13,GREEN,600,"end")
    else:
        s+=t(px+pw-24,py+ph-22,"无成交标记 · 只显示当时可知行情",12,MUTED,400,"end")
    axis_labels=["6/14","当前截止"] if visible==4 else ["6/14","6/17","当前截止"]
    for i,lbl in enumerate(axis_labels): s+=t(px+48+i*(pw-100)/max(1,len(axis_labels)-1),py+ph+28,lbl,12,MUTED,400,"middle")
    s+=rect(x+866,274,350,358,RAISED,LINE,8)+t(x+888,306,"边界与执行",16,TEXT,600)
    s+=t(x+888,348,"当前查看日",12,MUTED)+t(x+1192,348,current,15,TEXT,600,"end")
    s+=t(x+888,390,"行情已展开至",12,MUTED)+t(x+1192,390,current,15,BLUE,600,"end")
    s+=t(x+888,432,"成交已展开至",12,MUTED)+t(x+1192,432,"2024-06-17" if trade else "—",15,GREEN if trade else WEAK,600,"end")
    s+=line(x+888,452,x+1192,452,LINE)
    s+=t(x+888,486,"下一可知事件",12,MUTED)+t(x+1192,486,next_event,15,BLUE,600,"end")
    s+=t(x+888,528,"结果截止",12,MUTED)+t(x+1192,528,"2024-09-13",15,TEXT,600,"end")
    s+=t(x+888,570,"已看后续",12,MUTED)+t(x+1192,570,"2024-06-28（不投影）" if index==2 else "—",15,WARN if index==2 else WEAK,600,"end")
    s+=button(x+24,678,"返回最新日期" if index==2 else ("推进下一交易日" if index==0 else "暂停播放"),176, index in (0,2))
    if index==2:s+=pill(x+224,682,"已看后续：回看来源",WARN,164,"#332918")
    s+=t(x,866,"本帧为文档分镜：当前查看日、行情展开日、成交展开日与结果截止分别表达。",13,MUTED)+end();return s

def make_results():
    s=chrome("阶段结果","结果截止 2024-09-13 · 从指标到事件，再回到同一日期的观察画面",breadcrumb=("策略","我的实验","EMA20 · 2024 Q3"))
    x,w=100,1240
    s+=pill(x,136,"结果",BLUE,62)+pill(x+70,136,"事件",MUTED,62,"#151F2E")+pill(x+140,136,"组合对比",MUTED,92,"#151F2E")+field(x+w-220,124,220,"结果截止","2024-09-13","⌄")
    for i,(ttl,val,sub,col) in enumerate([("累计收益","+2.54%","净值 1.0254",GREEN),("最大回撤","-3.18%","共同有效区间",RED),("交易次数","14","已完成事件",TEXT),("费用","¥128.40","已计入结果",TEXT)]):s+=card(x+i*314,190,298,82,ttl,val,sub,col)
    s+=chart(x,296,804,390,mode="result")+rect(x+828,296,412,390,PANEL,LINE,8)+t(x+850,329,"事件",18,TEXT,600)+t(x+850,355,"点击事件可回到同日观察",12,MUTED)
    for i,(date,desc,col) in enumerate([("2024-09-13","再平衡 · 实际成交 2 笔",GREEN),("2024-08-30","减仓 · 风险阈值触发",WARN),("2024-06-17","首次建仓 · 候选通过",BLUE),("2024-06-14","起点 · 仅现金",MUTED)]):
        yy=390+i*62;s+=line(x+850,yy-16,x+1216,yy-16,LINE)+pill(x+850,yy-4,date, col,94,"#172536")+t(x+958,yy+15,desc,13,TEXT,500)+t(x+1198,yy+15,"查看 →",12,BLUE,600,"end")
    s+=rect(x,714,w,132,RAISED,LINE,8)+t(x+20,746,"返回链",16,TEXT,600)+t(x+20,775,"结果截止保持不变",12,MUTED)+t(x+240,775,"→",16,WEAK)+t(x+274,775,"事件详情（2024-09-13）",14,TEXT,500)+t(x+570,775,"→",16,WEAK)+t(x+604,775,"回到观察",14,BLUE,600)+t(x+20,812,"返回观察时保留原组合、当前查看日与侧栏滚动位置。",13,MUTED)
    s+=end();return s

def make_compare():
    s=chrome("组合对比","共同有效区间 2024-06-17—2024-09-13 · 各组合独立账本，结果按同一口径比较",breadcrumb=("策略","我的实验","组合对比"))
    x,w=100,1240
    # Identity and summary stay above the shared stage; three fixed mode slots keep the stage stable.
    s+=rect(x,136,w,72,RAISED,LINE,8)+t(x+18,164,"组合对比",16,TEXT,600)+t(x+18,190,"2 组独立资金 · 同一策略版本口径",12,MUTED)
    s+=t(x+350,164,"EMA20 v1.4",14,BLUE,600)+t(x+350,190,"¥102,540.84 · +2.54%",13,TEXT,500)
    s+=t(x+650,164,"低波动质量 v2.1",14,PURPLE,600)+t(x+650,190,"¥101,840.12 · +1.84%",13,TEXT,500)
    s+=pill(x+1050,160,"2 组有效",GREEN,84,"#153128")+button(x+1140,154,"派生新实验",100,True)
    s+=rect(x,222,w,58,PANEL,LINE,6)+field(x+14,223,274,"共同有效区间","2024-06-17—09-13","锁定")
    s+=t(x+322,255,"查看模式",12,MUTED)+pill(x+390,239,"净值",BLUE,54)+pill(x+456,239,"回撤",MUTED,54,"#151F2E")+pill(x+522,239,"仓位",MUTED,54,"#151F2E")
    s+=t(x+650,255,"同一日期与结果截止 · 侧栏摘要随模式切换",12,MUTED)+button(x+1094,233,"导出摘要",106)
    s+=chart(x,302,804,360,mode="compare")
    s+=rect(x+828,302,412,360,PANEL,LINE,8)+t(x+850,334,"共享舞台",18,TEXT,600)+t(x+850,360,"当前模式：净值",13,BLUE,600)+t(x+850,392,"同一时间轴",12,MUTED)+t(x+1216,392,"6/17—9/13",14,TEXT,600,"end")
    for i,(nm,val,sub,col) in enumerate([("EMA20 v1.4","1.0254","期末净值",BLUE),("低波动质量 v2.1","1.0184","期末净值",PURPLE),("共同结果截止","2024-09-13","两组一致",TEXT)]):
        yy=434+i*62;s+=line(x+850,yy-18,x+1216,yy-18,LINE)+t(x+850,yy,nm,13,TEXT,500)+t(x+1216,yy,val,15,col,600,"end","num")+t(x+850,yy+22,sub,12,MUTED)
    s+=t(x+850,632,"切换模式时保留当前日期、侧栏与回放位置。",12,WEAK)
    s+=rect(x,682,w,56,RAISED,LINE,8)+t(x+18,716,"回放",13,MUTED,600)+pill(x+78,698,"当前 2024-09-13",BLUE,126)+button(x+224,692,"回看 6/17",104)+button(x+340,692,"返回最新日期",122,True)+t(x+500,716,"两组组合沿同一回放边界同步观察",13,MUTED)
    s+=rect(x,758,w,176,PANEL,LINE,8)+t(x+20,788,"明细",16,TEXT,600)+t(x+20,810,"固定舞台下方展开指标明细，不挤占主图和侧栏。",12,MUTED)
    s+=rect(x+18,824,w-36,32,RAISED,LINE,4)
    for h,xx in [("指标",x+32),("EMA20 v1.4",x+380),("低波动质量 v2.1",x+646),("差值",x+1010)]:s+=t(xx,846,h,12,MUTED,600)
    rows=[("累计收益","+2.54%","+1.84%","+0.70%",GREEN),("最大回撤","-3.18%","-2.44%","-0.74%",RED),("交易次数","14","9","5",TEXT)]
    yy=856
    for name,a,b,d,col in rows:
        s+=line(x+18,yy+30,x+w-18,yy+30,LINE)+t(x+32,yy+22,name,13,TEXT,500)+t(x+380,yy+22,a,14,col,600,"start","num")+t(x+646,yy+22,b,14,TEXT,600,"start","num")+t(x+1010,yy+22,d,14,col,600,"start","num"); yy+=25
    s+=end();return s

def make_states():
    s=chrome("异常与恢复","每个状态保留原输入、说明具体原因，并给出一个可理解的下一步")
    x,w=100,1240
    states=[("加载中","正在准备 2024-06-14 的数据…","保留原页面位置",BLUE),("无匹配","当前筛选没有找到策略包","清除筛选",WARN),("无候选","本日没有满足条件的标的","查看规则截止",WARN),("覆盖不足","缺少 2024-06—09 行情","返回修改起点",WARN),("运行失败","执行在 2024-07-19 停止","查看失败原因",RED),("数据落后","行情更新至 2024-09-12","继续等待",WARN),("版本冲突","策略版本已被另存为新版本","重新载入",PURPLE),("确认失败","未创建实验，输入仍保留","再次确认",RED)]
    for i,(title,desc,action,col) in enumerate(states):
        xx=x+(i%4)*310; yy=154+(i//4)*250;s+=rect(xx,yy,286,206,PANEL,LINE,8)+pill(xx+18,yy+18,title,col,82,"#172536")+t(xx+18,yy+72,desc,14,TEXT,500)+t(xx+18,yy+103,"不会把未知数据写成 0。",12,MUTED)+line(xx+18,yy+124,xx+268,yy+124,LINE)+t(xx+18,yy+158,"下一步",12,WEAK)+button(xx+18,yy+166,action,126, title in ("加载中","版本冲突"))
    s+=end();return s

def make_responsive():
    s=chrome("响应式适配","同一观察状态在紧凑桌面与窄屏的纵向阅读方案；不删说明，不缩字号",1280,1100)
    s+=t(72,160,"1280 · 紧凑桌面",18,TEXT,600)+t(72,184,"导航折叠54 · 图净高320 · 图表与检查区并排",12,MUTED)
    s+=rect(72,210,560,614,PANEL,LINE,8)+t(92,240,"回测工作台",18,TEXT,600)+pill(92,258,"运行已完成",BLUE,80,"#172536")+card(92,306,250,70,"净资产","¥102,540.84","当前估值",TEXT)+card(358,306,250,70,"累计收益","+2.54%","合成收益",GREEN)+chart(92,400,516,260,mode="compact")+t(92,700,"检查区保持完整，内容自然滚动。",13,MUTED)
    s+=t(668,160,"390 · 窄屏",18,TEXT,600)+t(668,184,"顶端菜单 · 图表先于检查 · 重要说明保留",12,MUTED)
    # Narrow reading order is summary → date → chart → replay → explanation.
    s+=rect(668,210,390,880,PANEL,LINE,8)+t(688,240,"回测工作台",18,TEXT,600)+pill(688,258,"运行已完成",BLUE,80,"#172536")
    s+=mobile_metric(688,306,170,74,"净资产","¥102,540.84",TEXT)+mobile_metric(868,306,170,74,"累计收益","+2.54%",GREEN)
    s+=field(688,398,350,"当前查看日","2024-09-13","⌄")
    s+=rect(688,470,350,280,"#0F1826",LINE,8)+t(706,496,"净值",16,TEXT,600)+t(1020,496,"结果截止 9/13",12,MUTED,400,"end")
    s+=line(714,556,1018,556,LINE)+line(714,616,1018,616,LINE)+line(714,676,1018,676,LINE)+line(714,716,1018,716,LINE)
    s+=path("M 714,700 L 760,672 L 810,684 L 860,640 L 910,656 L 960,602 L 1018,618",BLUE,2.3)+f'<circle cx="1018" cy="618" r="4" fill="{GREEN}"/>'
    s+=t(714,736,"1.000",11,MUTED,400,"start","num")+t(1018,736,"1.0254",11,GREEN,600,"end","num")
    s+=rect(688,764,350,58,RAISED,LINE,8)+t(706,798,"回放",13,MUTED,600)+pill(756,780,"回看 6/14",WARN,96,"#332918")+button(860,774,"返回最新",96,True)
    s+=rect(688,836,350,196,PANEL,LINE,8)+t(706,862,"检查区",14,TEXT,600)+t(706,890,"现金 10.0% · 仓位 90.0%",13,MUTED)+t(706,918,"净值图、回放与检查说明",13,MUTED)+t(706,946,"按顺序连续阅读。",13,MUTED)+t(706,984,"当前查看日 2024-09-13",12,WEAK)
    s+=end();return s

def make_components():
    s=chrome("组件与业务组合","公共控件沿用 V2.5；策略专属控件补充职责、版本与回放状态",1440,1000)
    x,w=100,1240
    s+=t(x,154,"公共控件",18,TEXT,600)+t(x+100,154,"统一字号、边线、焦点与右缘数字",12,MUTED)
    s+=field(x,180,260,"搜索","EMA20、质量","⌕")+button(x+276,190,"应用筛选",96,True)+button(x+380,190,"次要动作",96)+pill(x+492,194,"已选中",BLUE,72)+pill(x+580,194,"提醒",WARN,64,"#332918")
    s+=rect(x+670,180,300,56,RAISED,LINE,6)+t(x+686,202,"键盘焦点",12,MUTED)+t(x+686,225,"外框2px · #A9C8FF",14,FOCUS,600)+rect(x+984,180,256,56,PANEL,LINE,6)+t(x+1000,202,"数字右对齐",12,MUTED)+t(x+1216,225,"¥102,540.84",15,TEXT,600,"end","num")
    s+=t(x,286,"策略专属组合",18,TEXT,600)
    comps=[("三包组装槽位","筛选 / 买入 / 止盈止损",CYAN),("四步创建进度","起点 / 策略 / 预览 / 确认",BLUE),("独立资金卡","目标、实际与现金分开",GREEN),("日期边界条","当前查看日与已展开日",WARN),("候选与实际表","T0 计划 ≠ 成交事实",PURPLE),("事件返回链","结果 → 事件 → 观察",ORANGE)]
    for i,(nm,desc,col) in enumerate(comps):
        xx=x+(i%3)*414;yy=312+(i//3)*96;s+=rect(xx,yy,394,76,PANEL,LINE,8)+rect(xx+16,yy+18,6,40,col,"none",3)+t(xx+38,yy+31,nm,14,TEXT,600)+t(xx+38,yy+55,desc,12,MUTED)
    s+=rect(x,540,w,364,RAISED,LINE,8)+t(x+20,572,"控件八态",16,TEXT,600)+t(x+20,596,"默认、悬停、焦点、按下、禁用、加载、空状态与错误；保留真实控件形状。",12,MUTED)
    state_cards=[("默认 Button",BLUE,"button"),("悬停 Button",FOCUS,"hover"),("焦点 Input",FOCUS,"focus"),("按下 Select",BLUE,"pressed"),("禁用 Button",WEAK,"disabled"),("加载 Button",BLUE,"loading"),("空状态容器",MUTED,"empty"),("错误 Input",RED,"error")]
    for i,(lab,col,kind) in enumerate(state_cards):
        xx=x+20+(i%4)*300; yy=620+(i//4)*132
        s+=rect(xx,yy,280,110,PANEL,LINE,8)+t(xx+16,yy+24,lab,12,MUTED,600)
        if kind=="button":
            s+=button(xx+16,yy+44,"应用筛选",112,True)
        elif kind=="hover":
            s+=rect(xx+16,yy+44,112,36,FOCUS,FOCUS,6)+t(xx+72,yy+67,"应用筛选",14,"#0B1019",600,"middle")
        elif kind=="focus":
            s+=rect(xx+16,yy+44,190,36,PANEL,FOCUS,6,2)+t(xx+30,yy+67,"EMA20",14,TEXT,500)+t(xx+188,yy+67,"⌕",16,FOCUS,600,"end")
        elif kind=="pressed":
            s+=rect(xx+16,yy+44,166,36,"#1C2A3C",FOCUS,6)+t(xx+30,yy+67,"选择策略⌄",14,TEXT,600)+t(xx+166,yy+67,"⌄",14,BLUE,600,"end")
        elif kind=="disabled":
            s+=button(xx+16,yy+44,"继续",90,False,True)
        elif kind=="loading":
            s+=rect(xx+16,yy+44,112,36,BLUE,FOCUS,6)+f'<circle cx="{xx+36}" cy="{yy+62}" r="7" fill="none" stroke="#0B1019" stroke-width="2" stroke-dasharray="9 5"/>'+t(xx+86,yy+67,"处理中",14,"#0B1019",600,"middle")
        elif kind=="empty":
            s+=rect(xx+16,yy+42,210,42,"#131E2B",LINE,6)+t(xx+28,yy+61,"⌁",18,MUTED,600)+t(xx+52,yy+68,"暂无候选",14,TEXT,500)+t(xx+210,yy+68,"清除筛选",12,BLUE,600,"end")
        elif kind=="error":
            s+=rect(xx+16,yy+42,210,36,PANEL,RED,6,2)+t(xx+30,yy+65,"起点时间",14,TEXT,500)+t(xx+212,yy+65,"!",15,RED,700,"end")+t(xx+16,yy+96,"请填写收盘后时间",12,RED,500)
    s+=end();return s

BUILDERS={"01-library.svg":make_library,"01b-package-management.svg":make_library_package_detail,"02-compose.svg":make_compose,"03-experiments.svg":make_experiments,"04-create.svg":make_create,"05-confirm.svg":make_confirm,"06-observe.svg":make_observe,"06-observe-status-detail.svg":make_observe_status_detail,"07-time-states.svg":make_time,"07a-t0.svg":lambda: make_time_single(0),"07b-first-day.svg":lambda: make_time_single(1),"07c-lookback.svg":lambda: make_time_single(2),"07-time-controls-detail.svg":make_time_controls_detail,"08-results.svg":make_results,"09-compare.svg":make_compare,"10-states.svg":make_states,"11-responsive.svg":make_responsive,"12-components.svg":make_components}

if __name__ == "__main__":
    for filename, builder in BUILDERS.items():
        save(filename, builder())
    print(f"wrote {len(BUILDERS)} SVG boards to {OUT}")
