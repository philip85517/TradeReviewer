#!/usr/bin/env python3
"""Build time/replay, result and comparison boards from shared primitives."""
from __future__ import annotations
import json, sys
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parent; OUT=ROOT/"images"
DATA=json.loads((ROOT/"example-data.json").read_text(encoding="utf-8"))
import importlib.util
_spec=importlib.util.spec_from_file_location("shared_primitives",ROOT/"shared-primitives.py"); _shared=importlib.util.module_from_spec(_spec); sys.modules["shared_primitives"]=_shared; _spec.loader.exec_module(_shared)
from shared_primitives import BG,PANEL,RAISED,BORDER,TEXT,MUTED,WEAK,ACTION,FOCUS,DISABLED,icon,nav_rail,button,segmented,select_control
GREEN,RED,WARN,NEG,PURPLE="#53D7A0","#FF8592","#FFC66D","#EF7F89","#B59AFF"
FONT="-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"
def esc(v): return str(v).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")
def txt(x,y,v,size=14,fill=TEXT,weight=400,anchor="start",num=False):
    size=14 if size in (13,15) else size
    st=f"font-family:{FONT};font-size:{size}px;font-weight:{weight};fill:{fill};"+ ("font-variant-numeric:tabular-nums;" if num else "")
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{st}">{esc(v)}</text>'
def rect(x,y,w,h,fill=PANEL,stroke=BORDER,r=8): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'
def line(x1,y1,x2,y2,stroke=BORDER,sw=1,dash=""): return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>'
def path(d,stroke=ACTION,sw=2,dash=""): return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>'
def chip(x,y,label,w=88,color=ACTION): return rect(x,y,w,24,"#172536",color,6)+txt(x+w/2,y+17,label,12,color,600,"middle")
def open_svg(w,h,title,subtitle): return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{esc(title)}</title><desc>{esc(subtitle)}</desc>',rect(0,0,w,h,BG,"none",0),nav_rail(h),line(54,48,w,48),txt(78,30,"策略台",15,TEXT,600),txt(142,30,"我的实验",13,ACTION,500),txt(230,30,"EMA20 v1.4",13,MUTED),txt(w-28,30,"林",13,TEXT,600,"end"),txt(100,86,title,24,TEXT,600),txt(100,112,subtitle,14,MUTED)]
def close(): return "</svg>"
def modes(x,y,active): return "".join(segmented(x+i*112,y,n,96,i==active) for i,n in enumerate(("回放观察","阶段结果","组合对比")))
def result_modes(x,y,active=0): return "".join(segmented(x+i*70,y,n,60,i==active) for i,n in enumerate(("净值","回撤","仓位")))
def date_field(x,y,label,value,w=220,kind="calendar"): return txt(x,y-8,label,12,MUTED)+select_control(x,y,value,w,kind)
def readonly_field(x,y,label,value,w=164): return txt(x,y-8,label,12,MUTED)+rect(x,y,w,36,PANEL,BORDER,6)+txt(x+12,y+23,value,14,TEXT,500,"start",True)
def metrics(x,y,w):
    vals=(("净资产","10.25万",TEXT,"完整值 ¥102,540.84"),("累计收益","+2.54%",GREEN,"净值"),("最大回撤","-3.20%",RED,"期间峰值回撤"),("仓位","90.0%",TEXT,"当前投影")); out=rect(x,y,w,88,PANEL,BORDER,8); cell=w/4
    for i,(lab,val,col,note) in enumerate(vals):
        if i: out+=line(x+i*cell,y+14,x+i*cell,y+74)
        out+=txt(x+i*cell+16,y+26,lab,14,MUTED)+txt(x+(i+1)*cell-16,y+61,val,28,col,600,"end",True)+txt(x+i*cell+16,y+78,note,12,WEAK)
    return out
OHLC=[("2024-06-10",10.12,10.22,10.05,10.26),("2024-06-11",10.18,10.36,10.14,10.40),("2024-06-12",10.31,10.28,10.18,10.34),("2024-06-13",10.24,10.52,10.21,10.56),("2024-06-14",10.47,10.58,10.39,10.62),("2024-06-17",10.53,10.83,10.49,10.86)]
def py(v,t,b): return b-((v-10)/(11-10))*(b-t)
def candles(x,y,w,h,count,marker=False):
    out=rect(x,y,w,h,PANEL,BORDER,8)+txt(x+16,y+26,"标的 K 线",16,TEXT,600)+txt(x+w-16,y+26,"价格轴 10.00—11.00",12,MUTED,400,"end",True); l,r,t,b=x+54,x+w-46,y+58,y+h-42
    for v in (10,10.25,10.5,10.75,11): out+=line(l,py(v,t,b),r,py(v,t,b))+txt(l-8,py(v,t,b)+4,f"{v:.2f}",12,WEAK,400,"end",True)
    step=(r-l-22)/5
    for i,(d,o,c,lo,hi) in enumerate(OHLC[:count]):
        xx=l+11+i*step; col=GREEN if c>=o else RED; out+=line(xx,py(hi,t,b),xx,py(lo,t,b),col,2)+rect(xx-8,py(max(o,c),t,b),16,max(6,py(min(o,c),t,b)-py(max(o,c),t,b)),col,col,2)+txt(xx,b+23,d[5:],12,MUTED,400,"middle")
    if marker:
        xx=l+11+(count-1)*step; out+=icon(xx-8,py(OHLC[-1][2],t,b)-20,"strategy",16,GREEN)+txt(xx-18,py(OHLC[-1][2],t,b)-24,"首次成交",12,GREEN,600,"end")
    return out
def bounds(x,y,w,h,current,market,execution,result,seen="—"):
    out=rect(x,y,w,h,PANEL,BORDER,8)+txt(x+18,y+28,"日期边界",16,TEXT,600); rows=(("V 当前查看日",current,TEXT),("M 行情截止",market,ACTION),("E 成交截止",execution,GREEN if execution!="无" else MUTED),("R 结果截止",result.replace("（≤ M）","") or "未生成",TEXT),("已看后续",seen,WARN if seen!="—" else MUTED))
    for i,(lab,val,col) in enumerate(rows): out+=txt(x+18,y+66+i*47,lab,14,MUTED)+txt(x+w-18,y+84+i*47,val,14,col,600,"end",True)
    return out
def single(index):
    states=(("T0 起点 · 2024-06-14","2024-06-14","2024-06-14","无","未生成（≤ M）",5,False),("首日成交 · 2024-06-17","2024-06-17","2024-06-17","2024-06-17","未生成（≤ M）",6,True),("回看起点 · 2024-06-14","2024-06-14","2024-06-28","无","未生成（≤ M）",5,False)); title,current,market,execution,result,count,marker=states[index]; out=open_svg(920,720,"回放观察",f"{title}；V/M/E/R 分开记录")
    out += [rect(100,150,720,500,PANEL,BORDER,8),txt(124,184,title,18,TEXT,600),chip(124,204,"首次成交" if marker else ("回看" if index==2 else "T0"),100,GREEN if marker else (WARN if index==2 else ACTION)),txt(240,221,"推进后可见新增 K 线与成交事件",13,TEXT,500),candles(124,248,490,316,count,marker),bounds(632,248,164,316,current,market,execution,result,"6/28（来源保留）" if index==2 else "—"),button(124,592,"返回最新日期" if index==2 else ("暂停播放" if index==1 else "推进下一交易日"),160,index!=1),txt(100,682,"合成数据；日期边界用于说明结果可知范围。",12,MUTED),close()]; return "".join(out)
def time_states():
    out=open_svg(1440,1010,"推进与回看","三帧同尺度分镜：先隐藏未来，再揭示首日成交，最后回看起点"); frames=(("T0 起点","2024-06-14","2024-06-14","无",5,False),("首日推进","2024-06-17","2024-06-17","2024-06-17",6,True),("回看起点","2024-06-14","2024-06-28","无",5,False))
    for i,(title,day,market,execution,count,marker) in enumerate(frames):
        x=100+i*414; out += [rect(x,158,404,680,PANEL,BORDER,8),txt(x+20,193,title,18,TEXT,600),txt(x+20,219,"当前查看日 "+day,14,MUTED,500),chip(x+20,237,"首次成交" if marker else ("回看" if i==2 else "T0"),88,GREEN if marker else (WARN if i==2 else ACTION)),candles(x+20,278,364,300,count,marker),txt(x+20,609,"当前持仓",14,MUTED),txt(x+384,609,"A 44.5% · B 45.5% · 现金 10%" if marker else "A 0% · B 0% · 现金 100%",14,TEXT,600,"end"),txt(x+20,640,"未来信息",14,MUTED),txt(x+384,640,"不可见" if i<2 else "已看来源保留",14,WARN if i==2 else TEXT,500,"end"),line(x+20,690,x+384,690),button(x+20,716,"返回最新日期" if i==2 else ("暂停播放" if i==1 else "推进下一交易日"),156,i!=1)]
    out += [rect(100,866,1240,74,PANEL,BORDER,8),txt(118,894,"四条日期边界独立保存",16,TEXT,600),txt(118,919,"V 当前查看日　M 行情截止　E 成交截止　R 结果截止；切换组合、侧栏和缩放不推进游标。",14,MUTED),close()]; return "".join(out)
def time_detail():
    out=open_svg(920,360,"回放时间控制","V/M/E/R 分开记录；回看不把未来成交投影到图上"); out += [rect(100,144,720,146,PANEL,BORDER,8)]
    for i,(lab,val,kind) in enumerate((("当前查看日 V","2024-06-14","calendar"),("行情截止 M","2024-06-28","readonly"),("成交 E","当前投影无","readonly"),("结果 R","未生成","readonly"))): out.append(date_field(118+i*174,164,lab,val,164,kind) if kind=="calendar" else readonly_field(118+i*174,164,lab,val,164))
    out += [button(118,238,"返回最新日期",132,True),button(260,238,"推进下一交易日",144,False,True),txt(436,261,"独立状态样例：结果/比较模式禁用推进与速度。",12,MUTED),close()]; return "".join(out)
def chart(x,y,w,h,compare=False):
    vals=DATA["navA"]; vals2=DATA["navB"]; left,right,top,bottom=x+64,x+w-26,y+112,y+h-48; out=rect(x,y,w,h,PANEL,BORDER,8)+txt(x+18,y+28,"阶段结果 · 合成净值",16,TEXT,600)+txt(x+w-18,y+28,"1.0000 起点 · 6/14—9/13",12,MUTED,400,"end")+modes(x+18,y+42,2 if compare else 1)+txt(x+18,y+92,"蓝线 · EMA20 v1.4",12,ACTION,600)
    if compare: out+=txt(x+190,y+92,"紫线 · 低波动质量 v2.1",12,PURPLE,600)
    else: out+=txt(x+648,y+92,"局部",12,MUTED)+result_modes(x+684,y+72,0)
    for v in (0.98,0.99,1,1.01,1.02,1.03): yy=top+(1.03-v)/.05*(bottom-top); out+=line(left,yy,right,yy,BORDER,1,"3 4" if v==1 else "")+txt(left-10,yy+4,f"{v:.3f}",12,WEAK,400,"end",True)
    dates=DATA["dates"]; start=date.fromisoformat(dates[0]); span=(date.fromisoformat(dates[-1])-start).days; xs=[left+(date.fromisoformat(d)-start).days/span*(right-left) for d in dates]
    for xx,d in zip(xs,dates): out+=txt(xx,bottom+25,d[5:],12,MUTED,400,"middle")
    for series,col in ((vals,ACTION),(vals2,PURPLE)) if compare else ((vals,ACTION),):
        pts=[(xx,top+(1.03-v)/.05*(bottom-top)) for xx,v in zip(xs,series)]; out+=path("M "+" ".join((f"{px:.1f},{py:.1f}" if i==0 else f"L {px:.1f},{py:.1f}") for i,(px,py) in enumerate(pts)),col,3,"6 5" if compare and col==PURPLE else ""); out+="".join(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="{col}"/>' for px,py in pts)+txt(pts[-1][0]-10,pts[-1][1]+(-12 if col==ACTION else 20),f"{series[-1]:.4f}",12,col,700,"end",True)
    return out
def side(x,y,w,h,compare=False):
    out=rect(x,y,w,h,PANEL,BORDER,8)+txt(x+18,y+28,"比较摘要" if compare else "阶段指标",18,TEXT,600)+txt(x+18,y+53,"共同有效区间内排名" if compare else "统计截止 R = 2024-09-13",12,MUTED); rows=(("EMA20 v1.4","1.0254","+2.54%",ACTION),("低波动质量 v2.1","1.0184","+1.84%",PURPLE),("实验 C · 执行失败","—","原因：行情覆盖至 8/01",RED)) if compare else (("收益率","+2.54%","",GREEN),("最大回撤","-3.20%","",RED),("费用","¥128.40","",TEXT),("成交笔数","14 笔","",TEXT))
    for i,(lab,val,note,col) in enumerate(rows):
        yy=y+94+i*70; out+=line(x+18,yy-24,x+w-18,yy-24) if i else ""; out+=txt(x+18,yy,lab,14,TEXT if compare else MUTED,600 if compare else 400)+txt(x+w-18,yy,val,14,col,700,"end",True); out+=txt(x+18,yy+21,note,12,RED if val=="—" else MUTED) if note else ""
    return out
def replay(x,y,w): return rect(x,y,w,72,RAISED,BORDER,8)+txt(x+18,y+29,"回放",14,TEXT,600)+select_control(x+74,y+18,"当前 2024-09-13",200,"select")+button(x+286,y+18,"返回观察后推进",148,False,True)+button(x+442,y+18,"速度 1×",86,False,True)+txt(x+556,y+41,"结果与比较为只读阶段。",12,MUTED)
def results():
    out=open_svg(1440,1410,"阶段结果","结果截止 R = 2024-09-13；从净值与风险到贡献、事件"); out += [rect(100,136,1240,64,PANEL,BORDER,8),chip(116,156,"运行已完成",100,ACTION),txt(234,164,"EMA20 v1.4",16,TEXT,600),txt(234,186,"合成实验 · 独立本金 ¥100,000.00 · 2024-06-14 15:00 Asia/Shanghai",12,MUTED),txt(1318,164,"2024-09-13",14,TEXT,600,"end",True),metrics(100,224,1240),rect(100,328,1240,60,PANEL,BORDER,8),chip(116,346,"结果已生成",100,ACTION),date_field(1120,348,"当前查看日","2024-09-13",204,"calendar"),chart(100,420,896,526),side(1020,420,320,526),replay(100,964,1240),rect(100,1058,896,260,PANEL,BORDER,8),txt(120,1088,"贡献明细",16,TEXT,600),txt(120,1111,"累计收益归因（百分点）",12,MUTED),txt(120,1228,"0",12,MUTED),line(230,1224,940,1224,MUTED)]
    for xx,label,val,col in ((280,"合成股票 A",3.09,GREEN),(420,"合成股票 B",-0.42,NEG),(560,"费用",-0.13,NEG),(700,"现金",0.00,MUTED)):
        if val > 0: out += rect(xx,1224-val*20,32,val*20,col,"none",3)
        elif val < 0: out += rect(xx,1224,32,-val*20,col,"none",3)
        out += txt(xx+16,1154 if val>0 else (1250 if val<0 else 1200),f"{val:+.2f}" if val else "0.00",12,col,700,"middle",True)+txt(xx+16,1280,label,12,MUTED,400,"middle")
    out += [txt(960,1298,"合计 +2.54084pp",12,MUTED,600,"end",True),rect(1020,1058,320,260,PANEL,BORDER,8),txt(1040,1088,"事件摘要",16,TEXT,600)]
    for i,(d,l,c) in enumerate((("6/17","首次建仓",GREEN),("8/30","风险减仓",WARN),("9/13","期末调仓",ACTION))): out += [chip(1040,1120+i*42,d,54,c),txt(1110,1137+i*42,l,13,TEXT),txt(1318,1137+i*42,"查看",13,ACTION,600,"end")]
    out.append(close()); return "".join(out)
def compare():
    out=open_svg(1440,1460,"组合对比","共同有效区间 2024-06-14—2024-09-13；独立本金账本"); out += [rect(100,136,1240,64,PANEL,BORDER,8),chip(116,156,"2 组可比",100,ACTION),txt(234,164,"EMA20 v1.4",16,TEXT,600),txt(234,186,"合成实验 · 独立本金 ¥100,000.00",12,MUTED),txt(1318,164,"2024-09-13",14,TEXT,600,"end",True),metrics(100,224,1240),rect(100,328,1240,60,PANEL,BORDER,8),readonly_field(116,348,"共同有效区间（锁定）","2024-06-14—2024-09-13",282),txt(420,372,"排名基线 1.0000 = 6/14；6/17 为首次成交事件。",12,MUTED),button(1188,340,"派生新实验",136,True),chart(100,478,896,526,True),side(1020,478,320,526,True),replay(100,1022,1240),rect(100,1116,1240,310,PANEL,BORDER,8),txt(120,1146,"比较明细",16,TEXT,600),txt(120,1169,"所有组从共同 6/14 基线计算；失效组保留原因但不排名",12,MUTED),rect(118,1186,1204,40,RAISED,BORDER,4)]
    for lab,xx in (("指标",134),("EMA20 v1.4",470),("低波动质量 v2.1",730),("差值",1250)): out.append(txt(xx,1212,lab,14,MUTED,600,"start" if lab=="指标" else "end"))
    for i,(name,a,b,d,c) in enumerate((("累计收益","+2.54%","+1.84%","+0.70 百分点",GREEN),("最大回撤","-3.20%","-0.17%","-3.03 百分点",RED),("费用","¥128.40","¥96.20","¥32.20",TEXT))):
        yy=1258+i*48; out += [line(118,yy+24,1322,yy+24),txt(134,yy,name,14,TEXT,500,"start"),txt(470,yy,a,14,c,600,"end",True),txt(730,yy,b,14,TEXT,600,"end",True),txt(1250,yy,d,14,c,600,"end",True)]
    out.append(close()); return "".join(out)
BUILDERS={"07-time-states.svg":time_states,"07a-t0.svg":lambda:single(0),"07b-first-day.svg":lambda:single(1),"07c-lookback.svg":lambda:single(2),"07-time-controls-detail.svg":time_detail,"08-results.svg":results,"09-compare.svg":compare}
def main(names=None):
    for n in names or BUILDERS:
        if n not in BUILDERS: raise SystemExit(f"unknown board: {n}")
        (OUT/n).write_text(BUILDERS[n](),encoding="utf-8"); print(OUT/n)
if __name__=="__main__": main(sys.argv[1:])
