#!/usr/bin/env python3
"""Rebuild the strategy desk visual proposal SVG boards.

Static design boards only.  The figures use fictional data and are deliberately
not wired to the product runtime.
"""
from pathlib import Path

OUT = Path(__file__).parent / "images"
OUT.mkdir(parents=True, exist_ok=True)

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
    return rect(x, y, w, 28, fill, color, 14) + t(x + w/2, y + 19, label, 12, color, 600, "middle")

def button(x, y, label, w, primary=False, disabled=False):
    fill = "#2D70D1" if primary else RAISED
    stroke = "#4F91F2" if primary else LINE
    color = "#FFFFFF" if primary else (WEAK if disabled else TEXT)
    if disabled:
        fill, stroke = "#151E2B", "#202B3A"
    return rect(x, y, w, 36, fill, stroke, 6) + t(x+w/2, y+23, label, 14, color, 600, "middle")

def field(x, y, w, label, value, hint=""):
    s = rect(x, y, w, 56, PANEL, LINE, 6)
    s += t(x+12, y+19, label, 12, MUTED)
    s += t(x+12, y+42, value, 14, TEXT, 500)
    if hint: s += t(x+w-12, y+42, hint, 12, WEAK, 400, "end")
    return s

def card(x, y, w, h, title, value="", sub="", accent=TEXT):
    s = rect(x, y, w, h)
    s += t(x+16, y+23, title, 12, MUTED)
    if value: s += t(x+w-16, y+34, value, 22, accent, 600, "end", "num")
    if sub: s += t(x+16, y+h-14, sub, 12, WEAK)
    return s

def chrome(title, subtitle, W=1440, H=1000, watermark=True):
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    s += f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    s += rect(0, 0, 54, H, "#0D1522", "none", 0)
    s += t(27, 31, "TR", 14, BLUE, 700, "middle") + line(54,0,54,H)
    s += line(54,48,W,48)
    s += t(78, 30, "策略", 15, TEXT, 600) + t(128, 30, "策略库", 13, BLUE, 500) + t(188, 30, "我的实验", 13, MUTED, 400)
    s += t(W-78, 30, "帮助", 13, MUTED, 400, "end") + t(W-32, 30, "林", 13, TEXT, 600, "end")
    s += t(100, 86, title, 24, TEXT, 600) + t(100, 112, subtitle, 14, MUTED)
    if watermark:
        s += rect(W-220, H-34, 196, 22, "#171E2A", "#303B4D", 11) + t(W-122, H-19, "虚构数据 · 视觉方案", 11, WEAK, 500, "middle")
    return s

def end(): return "</svg>"

def chart(x, y, w, h, mode="nav"):
    s = rect(x, y, w, h, "#0F1826", LINE, 8)
    s += t(x+18, y+24, "EMA20 v1.4", 12, MUTED) + t(x+18, y+50, "组合净值", 18, TEXT, 600)
    s += pill(x+w-174, y+16, "组合净值", BLUE, 78) + pill(x+w-88, y+16, "标的 K 线", MUTED, 72, "#151F2E")
    gx, gy, gw, gh = x+42, y+76, w-98, h-118
    for i in range(1,6): s += line(gx, gy+i*gh/6, gx+gw, gy+i*gh/6, LINE, 1)
    for i in range(1,9): s += line(gx+i*gw/9, gy, gx+i*gw/9, gy+gh, LINE, 1)
    vals = [0.18,0.12,0.26,0.22,0.48,0.42,0.58,0.53,0.73,0.68,0.77,0.63,0.7,0.65,0.79,0.84,0.75,0.88,0.82,0.91]
    pts=[]
    for i,v in enumerate(vals): pts.append((gx+i*gw/(len(vals)-1), gy+gh-(v*gh)))
    d="M "+" ".join((f"{px:.1f},{py:.1f}" if i==0 else f"L {px:.1f},{py:.1f}") for i,(px,py) in enumerate(pts))
    s += path(d, BLUE, 2.5)
    for i,(px,py) in enumerate(pts[::4]): s += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{BLUE}"/>'
    s += line(gx, gy+gh*.72, gx+gw, gy+gh*.72, MUTED, 1, "3 4")
    s += t(gx+gw+12, gy+gh*.72+5, "NAV 1.0254", 12, FOCUS, 600, cls="num")
    for i,lbl in enumerate(["6/14","7月","8/01","8/16","9月","9/13"]): s += t(gx+i*gw/5, gy+gh+27, lbl, 12, MUTED, 400, "middle")
    s += t(x+18, y+h-16, "净值基线 1.0000　·　当前查看日 2024-09-13　·　结果截止 2024-09-13", 12, WEAK)
    return s

def side_check(x, y, w, h):
    s = rect(x,y,w,h)
    s += t(x+16,y+25,"当前组合",12,MUTED)+pill(x+w-96,y+12,"EMA20 v1.4",BLUE,80)
    s += t(x+16,y+54,"持仓概览",18,TEXT,600)+t(x+16,y+78,"随策略 · 每周 · 每组独立本金",12,WEAK)
    rows=[("合成股票 A","¥56,819.15","55.4%",GREEN),("合成股票 B","¥35,443.85","34.6%",GREEN),("现金","¥10,277.84","10.0%",TEXT),("组合净值","1.0254","","BLUE"),("总资产","¥102,540.84","",TEXT)]
    yy=y+110
    for name,val,pct,col in rows:
        s += line(x+16,yy-14,x+w-16,yy-14,LINE)
        s += t(x+16,yy,name,14,TEXT,500)+t(x+w-16,yy,val,14, GREEN if col==GREEN else TEXT,600,"end","num")
        if pct:s+=t(x+w-16,yy+20,pct,12,MUTED,400,"end","num")
        yy += 45
    return s

def make_observe():
    s=chrome("回测工作台","合成演示 · EMA20 v1.4 · 2024-09-13 · 已展开至 2024-09-13")
    x,w=100,1240
    s += pill(x,132,"已完成",GREEN,64,"#153128") + t(x+82,151,"EMA20 v1.4",16,TEXT,600) + t(x+214,151,"独立本金 ¥100,000.00",13,MUTED)
    s += pill(x+360,132,"低波动质量 v2.1",PURPLE,104,"#242038") + t(x+480,151,"独立本金 ¥100,000.00",13,MUTED)
    s += button(x+w-168,128,"实验列表",84)+button(x+w-76,128,"更多组合⌄",76)
    for i,(ttl,val,sub,col) in enumerate([("总资产","¥102,540.84","当前估值",TEXT),("累计收益","+2.54%","合成收益",GREEN),("组合当日收益","¥1,097.16 · +1.08%","收盘后",GREEN),("现金比例","10.0%","可用现金",TEXT)]):
        s += card(x+i*314,184,298,76,ttl,val,sub,col)
    s += rect(x,276,w,62,RAISED,LINE,8)
    s += pill(x+14,291,"运行已完成",GREEN,80,"#153128") + t(x+112,302,"2024-09-13 · 收盘后",14,TEXT,600) + t(x+112,321,"已展开至 2024-09-13",12,MUTED)
    s += button(x+w-286,289,"查看回测结果 →",136,True)+button(x+w-138,289,"比较组合",96)
    s += t(x+w-24,311,"回看",12,MUTED,"end") + field(x+w-196,283,172,"当前查看日","2024-09-13","⌄")
    s += t(x,371,"进度恢复",13,MUTED,500)+button(x+64,350,"展开剩余行情",112)+t(x+190,373,"已到计划结束日",13,WEAK)
    s += chart(x,392,894,458) + side_check(x+910,392,330,458)
    s += rect(x,866,w,94,RAISED,LINE,8)
    s += t(x+18,895,"调仓事件",16,TEXT,600)+pill(x+104,878,"14 条",BLUE,52)+t(x+190,895,"当前查看日 2024-09-13",12,MUTED)
    s += t(x+18,923,"前一交易日已定模板：每 5 个合成交易日开启一次再平衡。",14,TEXT)
    s += t(x+18,946,"价格、目标仓位与实际成交分开显示；详情可查看当时依据。",12,MUTED)
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
    s += pill(x+w-166,248,"紧凑列表",BLUE,80)+t(x+w-24,267,"已归档 2",12,WEAK,"end")
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
    s=chrome("新建完整策略","组合三类策略包；每次保存生成新版本，历史实验继续引用原版本")
    x,w=100,1240
    s+=t(x,151,"策略名称",14,MUTED)+field(x,160,580,"名称","EMA20 趋势质量 · 新版本","")+field(x+596,160,300,"来源","复制：EMA20 v1.3","锁定")+button(x+w-132,170,"保存新版本",132,True)
    s+=t(x,254,"三包组装",18,TEXT,600)+t(x+110,254,"每个槽位只承担一种职责",12,MUTED)
    items=[("01","标的筛选策略包","大盘质量 + 趋势强度","8 个候选 · 数据完整",CYAN),("02","买入信号包","突破后回踩确认","当前版本 v1.4",BLUE),("03","止盈止损策略包","移动止盈 8% · 固定止损 5%","参数可见 · 日线",ORANGE)]
    yy=278
    for no,title,desc,meta,col in items:
        s+=rect(x,yy,w,104,PANEL,LINE,8)+pill(x+18,yy+20,no,col,42,"#172536")+t(x+82,yy+38,title,16,TEXT,600)+t(x+82,yy+65,desc,14,MUTED)+t(x+82,yy+87,meta,12,WEAK)+button(x+w-176,yy+34,"更换包",76)+button(x+w-90,yy+34,"查看详情",76)
        yy+=120
    s+=rect(820,620,520,270,RAISED,LINE,8)+t(844,652,"版本摘要",16,TEXT,600)+t(844,681,"复制来源",12,MUTED)+t(1296,681,"EMA20 v1.3",14,TEXT,500,"end")+t(844,713,"适用市场",12,MUTED)+t(1296,713,"A股 · 日线",14,TEXT,500,"end")+t(844,745,"数据依赖",12,MUTED)+t(1296,745,"行情 / 财报 / 指标",14,TEXT,500,"end")+line(844,766,1316,766)+t(844,797,"保存后：新版本 v1.5，来源版本保持不变。",13,GREEN)+t(844,827,"编辑与复制都会留下来源标识，实验锁定版本不受影响。",12,MUTED)
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
    s=chrome("创建实验","四步正式流程：设置起点 → 选择策略 → 预览组合 → 确认创建")
    x,w=100,1240
    steps=[("1","设置起点",BLUE),("2","选择策略",MUTED),("3","预览组合",MUTED),("4","确认创建",MUTED)]
    for i,(n,l,c) in enumerate(steps):
        xx=x+i*310; s+=pill(xx,136,f"{n}  {l}",c,138,"#172536" if i==0 else "#151F2E")
        if i<3:s+=line(xx+146,150,xx+292,150,LINE,2)
    # Two frames are intentionally shown together so the transition is legible:
    # frame 1 fixes time/scope; frame 2 selects existing complete strategies.
    s+=rect(x,194,600,570,PANEL,LINE,8)+t(x+24,226,"第 1 步 · 设置起点",18,TEXT,600)+t(x+24,254,"固定当时可知的数据范围，实验从收盘后开始观察。",13,MUTED)
    s+=field(x+24,278,250,"起点日期","2024-06-14","📅")+field(x+290,278,250,"运行期限","3 个月","⌄")
    s+=field(x+24,350,250,"市场","A股","⌄")+field(x+290,350,250,"初始总额","¥200,000.00","独立资金")
    s+=t(x+24,454,"你将创建",16,TEXT,600)+t(x+24,488,"起点",12,MUTED)+t(x+540,488,"2024-06-14",14,TEXT,600,"end")+t(x+24,522,"名义结束",12,MUTED)+t(x+540,522,"2024-09-13",14,TEXT,600,"end")+t(x+24,556,"策略组合",12,MUTED)+t(x+540,556,"待下一步选择",14,WEAK,600,"end")+line(x+24,578,x+540,578)+t(x+24,614,"下一步会显示候选、目标仓位与数据截止。",13,MUTED)+button(x+24,680,"取消",80)+button(x+348,680,"下一步：选择策略 →",168,True)
    s+=rect(x+640,194,600,570,RAISED,LINE,8)+t(x+664,226,"第 2 步 · 选择策略",18,TEXT,600)+t(x+664,254,"选择一个或多个已有完整策略；需要新方法时可就地新建。",13,MUTED)
    s+=field(x+664,278,420,"搜索策略","EMA20、质量、趋势","⌕")+button(x+1098,288,"新建策略",118)
    s+=t(x+664,376,"可选完整策略",14,TEXT,600)+t(x+1188,376,"已选",12,MUTED,"end")
    for i,(nm,ver,col,desc) in enumerate([("EMA20 趋势质量","v1.4",BLUE,"筛选 + 买入 + 止盈止损"),("低波动质量","v2.1",PURPLE,"筛选 + 买入 + 止盈止损"),("价值回归实验版","v0.9",WEAK,"数据覆盖待检查")]):
        yy=402+i*72;s+=rect(x+664,yy,552,58,PANEL,LINE,6)+t(x+684,yy+24,nm,14,TEXT,600)+t(x+684,yy+45,desc,12,MUTED)+t(x+1062,yy+23,ver,13,col,600)+pill(x+1128,yy+15,"已选" if i<2 else "选择",GREEN if i<2 else WEAK,64,"#153128" if i<2 else "#151F2E")
    s+=t(x+664,646,"每个策略进入独立本金组合，资金与账本不会混用。",13,MUTED)+button(x+664,680,"← 返回起点",104)+button(x+1000,680,"下一步：预览组合 →",168,True)
    s+=end(); return s

def make_confirm():
    s=chrome("预览组合与确认","第 3 步展示候选与目标，第 4 步锁定独立资金和执行参数")
    x,w=100,1240
    s+=pill(x,136,"1 设置起点",GREEN,138,"#153128")+pill(x+154,136,"2 选择策略",GREEN,138,"#153128")+pill(x+308,136,"3 预览组合",BLUE,138,"#172536")+pill(x+462,136,"4 确认创建",MUTED,138,"#151F2E")
    s+=rect(x,194,w,212,PANEL,LINE,8)+t(x+24,226,"候选与目标",18,TEXT,600)+t(x+24,254,"EMA20 v1.4 · 2024-06-14 截止",13,MUTED)+t(x+24,286,"候选标的",12,MUTED)+t(x+350,286,"目标仓位",12,MUTED)+t(x+520,286,"实际持仓（T0）",12,MUTED)+t(x+710,286,"数据与规则截止",12,MUTED)
    for i,(nm,target,actual,cut,col) in enumerate([("合成股票 A","45.0%","0.0%","2024-06-14",CYAN),("合成股票 B","45.0%","0.0%","2024-06-14",BLUE),("现金","10.0%","100.0%","起点现金",TEXT)]):
        yy=310+i*28;s+=rect(x+16,yy-18,w-32,28,"#13202E","none",4)+t(x+30,yy,nm,13,TEXT,500)+t(x+350,yy,target,13,col,600,"start","num")+t(x+520,yy,actual,13,TEXT,600,"start","num")+t(x+710,yy,cut,13,MUTED,500)
    s+=rect(x,430,600,302,RAISED,LINE,8)+t(x+24,464,"独立资金",18,TEXT,600)+field(x+24,486,250,"策略 A 本金","¥100,000.00","独立核算")+field(x+300,486,250,"策略 B 本金","¥100,000.00","独立核算")+t(x+24,578,"两个组合共享日期范围，资金、持仓和账本分别计算。",13,MUTED)+t(x+24,612,"计划目标不是成交事实；从下一可交易日开始尝试执行。",13,MUTED)+pill(x+24,652,"T0：0 持仓 · 100% 现金",WARN,196,"#332918")
    s+=rect(x+624,430,616,302,PANEL,LINE,8)+t(x+648,464,"执行参数",18,TEXT,600)+field(x+648,486,252,"执行节奏","下一交易日开盘","⌄")+field(x+916,486,252,"费用口径","含交易费用","⌄")+field(x+648,558,252,"调仓频率","每 5 个交易日","⌄")+field(x+916,558,252,"数据截止","2024-06-14","锁定")+t(x+648,650,"确认后生成不可变版本；返回不会改写历史实验。",13,MUTED)+button(x+1020,680,"确认创建",148,True)
    s+=end(); return s

def make_time():
    s=chrome("回放时间状态","三帧分镜：T0 起点 → 首日新 K 线与成交 → 回看 6/14（保留已看后续）")
    x,w=100,1240
    frames=[("T0 · 2024-06-14","0 持仓 · 现金 100%","行情已展开至 2024-06-14",False), ("推进后 · 2024-06-17","首次建仓 · A 44.5% / B 45.5%","行情与成交已展开至 2024-06-17",True),("回看 · 2024-06-14","当前仍为 0 持仓 · 现金 100%","已展开至 2024-06-28 · 曾看至 6/28",False)]
    for i,(title,stat,cut,trade) in enumerate(frames):
        xx=x+i*414;s+=rect(xx,158,394,672,PANEL,LINE,8)+t(xx+18,190,title,16,TEXT,600)+t(xx+18,217,stat,13,GREEN if trade else TEXT,600)+t(xx+18,241,cut,12,MUTED)
        s+=rect(xx+18,264,358,280,"#0F1826",LINE,6)
        for gy in [314,364,414,464]:s+=line(xx+32,gy,xx+334,gy,LINE)
        vals=[.62,.52,.64,.58,.72,.65,.8,.7,.76,.7] if trade else [.45,.4,.5,.44,.55,.49,.58,.5,.56,.53]
        d="M "+" ".join((f"{xx+34+j*32:.1f},{464-v*170:.1f}" if j==0 else f"L {xx+34+j*32:.1f},{464-v*170:.1f}") for j,v in enumerate(vals));s+=path(d,BLUE,2)
        for j,v in enumerate(vals):
            if j in (3,6,8):s+=f'<circle cx="{xx+34+j*32}" cy="{464-v*170:.1f}" r="4" fill="{GREEN if trade and j==6 else BLUE}"/>'
        if trade:s+=pill(xx+214,298,"首次建仓",GREEN,86,"#153128")
        s+=t(xx+34,521,"6/14",12,MUTED)+t(xx+332,521,"6/28",12,MUTED,"end")+t(xx+18,582,"当前查看日",12,MUTED)+t(xx+350,582,"2024-06-14" if i==2 else ("2024-06-17" if i==1 else "2024-06-14"),14,TEXT,600,"end")+t(xx+18,616,"下一可知事件",12,MUTED)+t(xx+350,616,"6/17" if i!=1 else "6/28",14,BLUE,600,"end")+t(xx+18,662,"视野",12,MUTED)+t(xx+350,662,"保持当前图形",13,TEXT,500,"end")
        s+=button(xx+18,700,"返回最新日期" if i==2 else ("推进下一交易日" if i==0 else "暂停播放"),176 if i==2 else 164, i==0 or i==2)
        if i==2:s+=pill(xx+212,704,"已看后续：回看来源",WARN,164,"#332918")
    s+=t(x,866,"日期边界独立显示：当前查看日 / 行情已展开至 / 成交已展开至 / 结果截止。切换组合、侧栏或缩放不会推进任何边界。",13,MUTED)+end();return s

def make_time_single(index):
    """One full-size replay storyboard frame for documentation sequencing."""
    frames=[
        ("07a · T0 起点 · 2024-06-14", "0 持仓 · 现金 100%", "行情已展开至 2024-06-14", False, "2024-06-14", "6/17"),
        ("07b · 首日新 K 线与成交 · 2024-06-17", "首次建仓 · A 44.5% / B 45.5%", "行情与成交已展开至 2024-06-17", True, "2024-06-17", "6/28"),
        ("07c · 回看起点 · 2024-06-14", "当前仍为 0 持仓 · 现金 100%", "已展开至 2024-06-28 · 曾看至 6/28", False, "2024-06-14", "6/28"),
    ]
    title,stat,cut,trade,current,next_event=frames[index]
    s=chrome("回放时间状态",f"{title} · 日期边界分开记录，回看不会改变后续展开范围")
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
    vals=bars1 if trade else bars0
    for j,(lo,op,cl,hi) in enumerate(vals):
        base=py+ph-26
        bx=px+46+j*60; top=base-hi; bot=base-lo; body_top=base-max(op,cl); body_bot=base-min(op,cl)
        col=GREEN if cl>=op else RED
        s+=line(bx,top,bx,bot,col,2)+rect(bx-8,body_top,16,max(8,body_bot-body_top),col,"none",2)
    s+=path(f"M {px+42},{py+ph-86} L {px+150},{py+ph-102} L {px+258},{py+ph-96} L {px+366},{py+ph-126} L {px+474},{py+ph-118} L {px+582},{py+ph-162} L {px+690},{py+ph-148} L {px+778},{py+ph-184}",BLUE,2.5)
    if trade:
        tx,ty=px+46+9*60,py+ph-214-188
        s+=f'<path d="M {tx} {ty-16} L {tx+10} {ty} L {tx} {ty+16} L {tx-10} {ty} Z" fill="{GREEN}" stroke="{GREEN}"/>'
        s+=t(tx+18,ty+5,"首次建仓 · 2 笔",13,GREEN,600)
    else:
        s+=t(px+pw-24,py+ph-22,"无成交标记 · 只显示当时可知行情",12,MUTED,400,"end")
    for i,lbl in enumerate(["6/14","6/17","6/21","6/24","6/28"]): s+=t(px+48+i*190,py+ph+28,lbl,12,MUTED,400,"middle")
    s+=rect(x+866,274,350,358,RAISED,LINE,8)+t(x+888,306,"边界与执行",16,TEXT,600)
    s+=t(x+888,348,"当前查看日",12,MUTED)+t(x+1192,348,current,15,TEXT,600,"end")
    s+=t(x+888,390,"行情已展开至",12,MUTED)+t(x+1192,390,"2024-06-28" if index==2 else current,15,BLUE,600,"end")
    s+=t(x+888,432,"成交已展开至",12,MUTED)+t(x+1192,432,"2024-06-17" if trade else "—",15,GREEN if trade else WEAK,600,"end")
    s+=line(x+888,452,x+1192,452,LINE)
    s+=t(x+888,486,"下一可知事件",12,MUTED)+t(x+1192,486,next_event,15,BLUE,600,"end")
    s+=t(x+888,528,"结果截止",12,MUTED)+t(x+1192,528,"2024-09-13",15,TEXT,600,"end")
    s+=t(x+888,570,"查看后续",12,MUTED)+t(x+1192,570,"保留，不推进",15,WARN if index==2 else WEAK,600,"end")
    s+=button(x+24,678,"返回最新日期" if index==2 else ("推进下一交易日" if index==0 else "暂停播放"),176, index in (0,2))
    if index==2:s+=pill(x+224,682,"已看后续：回看来源",WARN,164,"#332918")
    s+=t(x,866,"本帧为文档分镜：当前查看日、行情展开日、成交展开日与结果截止分别表达。",13,MUTED)+end();return s

def make_results():
    s=chrome("实验结果","结果截止 2024-09-13 · 从指标到事件，再回到同一日期的观察画面")
    x,w=100,1240
    s+=pill(x,136,"结果",BLUE,62)+pill(x+70,136,"事件",MUTED,62,"#151F2E")+pill(x+140,136,"组合对比",MUTED,92,"#151F2E")+field(x+w-220,124,220,"结果截止","2024-09-13","⌄")
    for i,(ttl,val,sub,col) in enumerate([("累计收益","+2.54%","净值 1.0254",GREEN),("最大回撤","-3.18%","共同有效区间",RED),("交易次数","14","已完成事件",TEXT),("费用","¥128.40","已计入结果",TEXT)]):s+=card(x+i*314,190,298,82,ttl,val,sub,col)
    s+=chart(x,296,804,390)+rect(x+828,296,412,390,PANEL,LINE,8)+t(x+850,329,"事件",18,TEXT,600)+t(x+850,355,"点击事件可回到同日观察",12,MUTED)
    for i,(date,desc,col) in enumerate([("2024-09-13","再平衡 · 实际成交 2 笔",GREEN),("2024-08-30","减仓 · 风险阈值触发",WARN),("2024-07-19","首次建仓 · 候选通过",BLUE),("2024-06-17","起点后首个交易日",MUTED)]):
        yy=390+i*62;s+=line(x+850,yy-16,x+1216,yy-16,LINE)+pill(x+850,yy-4,date, col,94,"#172536")+t(x+958,yy+15,desc,13,TEXT,500)+t(x+1198,yy+15,"查看 →",12,BLUE,600,"end")
    s+=rect(x,714,w,132,RAISED,LINE,8)+t(x+20,746,"返回链",16,TEXT,600)+t(x+20,775,"结果截止保持不变",12,MUTED)+t(x+240,775,"→",16,WEAK)+t(x+274,775,"事件详情（2024-09-13）",14,TEXT,500)+t(x+570,775,"→",16,WEAK)+t(x+604,775,"回到观察",14,BLUE,600)+t(x+20,812,"返回观察时保留原组合、当前查看日与侧栏滚动位置。",13,MUTED)
    s+=end();return s

def make_compare():
    s=chrome("组合对比","共同有效区间 2024-06-17—2024-09-13 · 各组合独立账本，结果按同一口径比较")
    x,w=100,1240
    s+=field(x,136,280,"共同有效区间","2024-06-17—09-13","锁定")+pill(x+300,150,"2 组有效",GREEN,84,"#153128")+button(x+w-118,146,"派生新实验",118,True)
    s+=rect(x,220,w,56,RAISED,LINE,6)
    for h,xx in [("指标",x+18),("EMA20 v1.4",x+390),("低波动质量 v2.1",x+656),("差值",x+1004)]:s+=t(xx,254,h,13,MUTED,600)
    rows=[("累计收益","+2.54%","+1.84%","+0.70%",GREEN),("最大回撤","-3.18%","-2.44%","-0.74%",RED),("交易次数","14","9","5",TEXT),("期末现金比例","10.0%","18.0%","-8.0%",WARN),("结果截止","2024-09-13","2024-09-13","一致",TEXT)]
    yy=276
    for name,a,b,d,col in rows:s+=rect(x,yy,w,62,PANEL,LINE,0)+t(x+18,yy+37,name,14,TEXT,500)+t(x+390,yy+37,a,15,col,600,"start","num")+t(x+656,yy+37,b,15,TEXT,600,"start","num")+t(x+1004,yy+37,d,14,col,600,"start","num");yy+=62
    s+=rect(x,610,w,198,RAISED,LINE,8)+t(x+20,642,"共同区间净值",16,TEXT,600)+t(x+20,664,"相同起点、相同结果截止；每条线对应独立组合。",12,MUTED)
    for i in range(5):s+=line(x+32,695+i*22,x+1184,695+i*22,LINE)
    s+=path("M 140,790 L 290,762 L 450,774 L 610,724 L 780,744 L 940,706 L 1120,718 L 1240,680",BLUE,2.5)+path("M 140,790 L 290,772 L 450,780 L 610,746 L 780,758 L 940,730 L 1120,736 L 1240,716",PURPLE,2.5)
    s+=pill(x+20,820,"EMA20 v1.4",BLUE,100)+pill(x+136,820,"低波动质量 v2.1",PURPLE,126)+end();return s

def make_states():
    s=chrome("异常与恢复","每个状态保留原输入、说明具体原因，并给出一个可理解的下一步")
    x,w=100,1240
    states=[("加载中","正在准备 2024-06-14 的数据…","保留原页面位置",BLUE),("无匹配","当前筛选没有找到策略包","清除筛选",WARN),("无候选","本日没有满足条件的标的","查看规则截止",WARN),("覆盖不足","缺少 2024-06—09 行情","返回修改起点",WARN),("运行失败","执行在 2024-07-19 停止","查看失败原因",RED),("数据落后","行情更新至 2024-09-12","继续等待",WARN),("版本冲突","策略版本已被另存为新版本","重新载入",PURPLE),("确认失败","未创建实验，输入仍保留","再次确认",RED)]
    for i,(title,desc,action,col) in enumerate(states):
        xx=x+(i%4)*310; yy=154+(i//4)*250;s+=rect(xx,yy,286,206,PANEL,LINE,8)+pill(xx+18,yy+18,title,col,82,"#172536")+t(xx+18,yy+72,desc,14,TEXT,500)+t(xx+18,yy+103,"不会把未知数据写成 0。",12,MUTED)+line(xx+18,yy+124,xx+268,yy+124,LINE)+t(xx+18,yy+158,"下一步",12,WEAK)+button(xx+18,yy+166,action,126, title in ("加载中","版本冲突"))
    s+=end();return s

def make_responsive():
    s=chrome("响应式适配","同一观察状态在紧凑桌面与窄屏的纵向阅读方案；不删说明，不缩字号",1280,900)
    s+=t(72,160,"1280 · 紧凑桌面",18,TEXT,600)+t(72,184,"导航折叠54 · 图净高320 · 图表与检查区并排",12,MUTED)
    s+=rect(72,210,560,614,PANEL,LINE,8)+t(92,240,"回测工作台",18,TEXT,600)+pill(92,258,"运行已完成",GREEN,80,"#153128")+card(92,306,250,70,"总资产","¥102,540.84","当前估值",TEXT)+card(358,306,250,70,"累计收益","+2.54%","合成收益",GREEN)+chart(92,400,516,260)+t(92,700,"检查区保持完整，内容自然滚动。",13,MUTED)
    s+=t(668,160,"390 · 窄屏",18,TEXT,600)+t(668,184,"顶端菜单 · 图表先于检查 · 触控命中44",12,MUTED)
    s+=rect(668,210,390,614,PANEL,LINE,8)+t(688,240,"回测工作台",18,TEXT,600)+pill(688,258,"运行已完成",GREEN,80,"#153128")+card(688,306,170,82,"总资产","¥102,540.84","",TEXT)+card(868,306,170,82,"累计收益","+2.54%","",GREEN)+card(688,400,170,82,"组合当日收益","¥1,097.16","",GREEN)+card(868,400,170,82,"现金比例","10.0%","",TEXT)+rect(688,506,350,250,"#0F1826",LINE,8)+t(706,532,"组合净值",16,TEXT,600)+path("M 708,710 L 760,680 L 810,692 L 860,650 L 910,668 L 960,622 L 1020,640",BLUE,2.3)+t(706,738,"图净高约280；检查区在下方连续阅读。",12,MUTED)
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
    s+=rect(x,540,w,286,RAISED,LINE,8)+t(x+20,572,"八态例子",16,TEXT,600)+t(x+20,596,"加载中 · 无匹配 · 无候选 · 覆盖不足 · 失败 · 落后 · 冲突 · 确认失败",12,MUTED)
    for i,(lab,col) in enumerate([("加载中",BLUE),("无匹配",WARN),("无候选",WARN),("覆盖不足",WARN),("失败",RED),("落后",WARN),("冲突",PURPLE),("确认失败",RED)]):
        xx=x+20+(i%4)*300;yy=626+(i//4)*72;s+=pill(xx,yy,lab,col,92,"#172536")+t(xx+108,yy+19,"保留输入 · 给下一步",12,MUTED)
    s+=end();return s

BUILDERS={"01-library.svg":make_library,"02-compose.svg":make_compose,"03-experiments.svg":make_experiments,"04-create.svg":make_create,"05-confirm.svg":make_confirm,"06-observe.svg":make_observe,"07-time-states.svg":make_time,"07a-t0.svg":lambda: make_time_single(0),"07b-first-day.svg":lambda: make_time_single(1),"07c-lookback.svg":lambda: make_time_single(2),"08-results.svg":make_results,"09-compare.svg":make_compare,"10-states.svg":make_states,"11-responsive.svg":make_responsive,"12-components.svg":make_components}

if __name__ == "__main__":
    for filename, builder in BUILDERS.items():
        save(filename, builder())
    print(f"wrote {len(BUILDERS)} SVG boards to {OUT}")
