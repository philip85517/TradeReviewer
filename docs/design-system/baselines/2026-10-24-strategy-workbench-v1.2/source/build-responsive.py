#!/usr/bin/env python3
"""Responsive comparison boards; 11-responsive is a design comparison plate."""
import sys
import json
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parent; OUT=ROOT/"images"
import importlib.util
_spec=importlib.util.spec_from_file_location("shared_primitives",ROOT/"shared-primitives.py"); _shared=importlib.util.module_from_spec(_spec); sys.modules["shared_primitives"]=_shared; _spec.loader.exec_module(_shared)
from shared_primitives import BG,PANEL,RAISED,BORDER,TEXT,MUTED,WEAK,ACTION,nav_rail,button,segmented,select_control
DATA=json.loads((ROOT/"example-data.json").read_text(encoding="utf-8"))
FONT="-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif"; GREEN="#53D7A0"; RED="#FF8592"
def esc(v): return str(v).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;")
def t(x,y,v,s=14,c=TEXT,w=400,a="start",num=False): return f'<text x="{x}" y="{y}" text-anchor="{a}" style="font-family:{FONT};font-size:{s}px;font-weight:{w};fill:{c};'+("font-variant-numeric:tabular-nums;" if num else '')+'">'+esc(v)+'</text>'
def r(x,y,w,h,f=PANEL,st=BORDER,rad=8): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rad}" fill="{f}" stroke="{st}"/>'
def l(x1,y1,x2,y2,st=BORDER,sw=1): return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{st}" stroke-width="{sw}"/>'
def open_svg(w,h,title,sub): return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{esc(title)}</title><desc>{esc(sub)}</desc>',r(0,0,w,h,BG,"none",0),nav_rail(h),l(54,48,w,48),t(78,30,"策略台",14,TEXT,600),t(142,30,"我的实验",14,ACTION,500),t(w-28,30,"林",14,TEXT,600,"end")]
def open_mobile(w,h,title,sub): return [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{esc(title)}</title><desc>{esc(sub)}</desc>',r(0,0,w,h,PANEL,"none",0),l(0,48,w,48),t(24,30,"策略台",14,TEXT,600),t(146,30,"EMA20 v1.4",12,MUTED),l(350,18,370,18,MUTED,1.5),l(350,24,370,24,MUTED,1.5),l(350,30,370,30,MUTED,1.5)]
def modes(x,y,active=0): return ''.join(segmented(x+i*92,y,n,84,i==active) for i,n in enumerate(("回放观察","阶段结果","组合对比")))
def result_modes(x,y): return ''.join(segmented(x+i*58,y,n,50,i==0) for i,n in enumerate(("净值","回撤","仓位")))
def chart(x,y,w,h,plot_h):
    left,right,top,bottom=x+52,x+w-24,y+112,y+112+plot_h
    vals=DATA["navA"]; lo,hi=.98,1.03
    dates=[date.fromisoformat(value) for value in DATA["dates"]]
    span=(dates[-1]-dates[0]).days
    pts=[(left+(dates[i]-dates[0]).days/span*(right-left),top+(hi-v)/(hi-lo)*plot_h) for i,v in enumerate(vals)]
    out=r(x,y,w,h)+t(x+18,y+28,"组合净值",16,TEXT,600)
    out+=segmented(x+18,y+44,"净值",84,True)+segmented(x+110,y+44,"标的 K 线",108)
    for v in (.98,1.0,1.03):
        yy=top+(hi-v)/(hi-lo)*plot_h
        out+=l(left,yy,right,yy)+t(left-8,yy+4,f"{v:.4f}" if v==1 else f"{v:.2f}",12,WEAK,400,"end",True)
    ticks=(0,2,4,6,7) if w<500 else range(8)
    for i in ticks:
        xx=pts[i][0]; mm,dd=DATA["dates"][i][5:].split("-")
        out+=t(xx,bottom+24,f"{int(mm)}/{int(dd)}",12,MUTED,400,"middle")
    d="M "+" ".join((f"{px:.1f},{py:.1f}" if i==0 else f"L {px:.1f},{py:.1f}") for i,(px,py) in enumerate(pts))
    out+=f'<path d="{d}" fill="none" stroke="{ACTION}" stroke-width="2.5"/>'
    return out+t(x+18,y+h-16,"EMA20 v1.4 · 当前 2024-09-13",12,MUTED)

def inspector(x,y,w,h):
    out=r(x,y,w,h)+t(x+18,y+30,"组合详情",18,TEXT,600)
    for i,(lab,width) in enumerate((("概览",64),("调仓记录",96),("统计指标",96))):
        xx=x+18+(0,72,176)[i];out+=segmented(xx,y+48,lab,width,i==0)
    for i,(lab,val) in enumerate((("现金","¥1.03万 · 10.0%"),("仓位","90.0%"),("结果截止","2024-09-13"))):
        yy=y+118+i*48;out+=t(x+18,yy,lab,14,MUTED)+t(x+w-18,yy,val,14,TEXT,500,"end",True)
    out+=t(x+18,y+278,"实际持仓",16,TEXT,600)
    for i,(lab,val,money) in enumerate((("合成股票 A","55.4%","¥5.68万"),("合成股票 B","34.6%","¥3.54万"))):
        yy=y+316+i*64;out+=t(x+18,yy,lab,14,TEXT)+t(x+w-18,yy,val,14,TEXT,500,"end",True)+t(x+18,yy+22,"持仓市值 "+money,12,MUTED)
    out+=t(x+18,y+434,"最近成交 · 9/13 期末调仓",14,TEXT)+t(x+18,y+462,"费用与执行原因在调仓记录中查看。",12,MUTED)
    return out

def replay(x,y,w):
    return r(x,y,w,96)+t(x+18,y+28,"回放 · 已完成",16,TEXT,600)+select_control(x+160,y+14,"2024-09-13",160,"calendar")+button(x+336,y+14,"播放",84,False,True)+button(x+432,y+14,"下一交易日",132,False,True)+select_control(x+576,y+14,"速度 1×",120,disabled=True)+t(x+18,y+76,"可选择历史日期回看；当前已在最新日期，运行已完成。",14,MUTED)

def replay_mobile(x,y,w):
    return r(x,y,w,232)+t(x+18,y+28,"回放 · 已完成",16,TEXT,600)+select_control(x+18,y+44,"2024-09-13",w-36,"calendar")+button(x+18,y+96,"播放",84,False,True)+button(x+114,y+96,"下一交易日",164,False,True)+select_control(x+18,y+148,"速度 1×",132,disabled=True)+t(x+18,y+214,"可选历史日期回看；当前已在最新日期。",12,MUTED)

def compact():
    w,h=1280,1100;o=open_svg(w,h,"策略台 · 紧凑桌面观察","同一实验的完整观察信息")
    o += [t(78,86,"EMA20 · 2024 Q3",24,TEXT,600),t(78,112,"EMA20 v1.4 · 运行已完成 · 独立本金 ¥100,000",14,MUTED),r(78,136,1124,88)]
    for i,(lab,val,col) in enumerate((("净资产","10.25万",TEXT),("累计收益","+2.54%",GREEN),("最大回撤","-3.20%",RED),("仓位","90.0%",TEXT))):
        xx=78+i*281;o+=[t(xx+16,164,lab,14,MUTED),t(xx+265,200,val,28,col,600,"end",True)]
    o += [modes(78,244),select_control(932,244,"当前 2024-09-13",270,"calendar"),chart(78,304,780,504,320),inspector(882,304,320,504),replay(78,832,1124),t(78,980,"已看后续至 2024-09-13 · 回看不会恢复为首次盲看。",14,MUTED)]
    return ''.join(o)+"</svg>"

def narrow():
    w,h=390,1910;o=open_mobile(w,h,"策略台 · 窄屏观察","完整观察顺序自然向下延续")
    o += [t(24,86,"EMA20 · 2024 Q3",24,TEXT,600),t(24,112,"EMA20 v1.4 · 运行已完成",14,MUTED),r(24,136,342,176)]
    for i,(lab,val,col) in enumerate((("净资产","10.25万",TEXT),("累计收益","+2.54%",GREEN),("最大回撤","-3.20%",RED),("仓位","90.0%",TEXT))):
        xx=24+(i%2)*171;yy=136+(i//2)*88;o += [t(xx+16,yy+26,lab,14,MUTED),t(xx+155,yy+64,val,28,col,600,"end",True)]
    o += [modes(24,332),t(24,402,"当前查看日",12,MUTED),select_control(24,414,"2024-09-13",342,"calendar"),chart(24,474,342,464,280),replay_mobile(24,962,342),inspector(24,1218,342,504),t(24,1760,"已看后续至 2024-09-13",14,MUTED),t(24,1788,"回看不会恢复为首次盲看。",14,MUTED)]
    return ''.join(o)+"</svg>"

def overview():
    w,h=1280,1200;o=open_svg(w,h,"响应式适配","布局分区示意；完整状态与真实图形另见1280及390画板")
    o += [t(78,86,"同一研究，两种空间安排",24,TEXT,600),t(78,116,"保持身份、摘要、日期、主图、回放和证据的阅读顺序；以下是分区示意，不是缩放后的产品画面。",14,MUTED)]
    o += [r(78,156,680,900),t(102,190,"紧凑桌面 · 1280px",18,TEXT,600),r(102,218,632,88),t(126,256,"连续摘要 · 净资产 / 收益 / 回撤 / 仓位",14,TEXT),r(102,330,632,64),t(126,368,"工作模式与查看日",14,TEXT),r(102,418,388,400),t(126,452,"主图",16,TEXT,600),r(126,474,340,320,BG),t(150,626,"净绘图区最低 320px",14,ACTION),r(514,418,220,400),t(538,452,"检查区",16,TEXT,600),t(538,490,"概览 / 调仓 / 统计",14,MUTED),t(538,530,"A/B 持仓与原因",14,MUTED),r(102,842,632,112),t(126,884,"回放槽 · 查看 / 播放 / 单步 / 速度",14,TEXT),t(102,1004,"检查区实际宽度 320px；分区宽度在此仅示意。",14,MUTED)]
    o += [r(790,156,412,1004),t(814,190,"窄屏 · 390px",18,TEXT,600),r(814,218,364,108),t(838,258,"四项摘要 · 两列重排",14,TEXT),r(814,350,364,64),t(838,388,"工作模式与查看日",14,TEXT),r(814,438,364,360),t(838,468,"净值 / 标的 K 线",16,TEXT,600),r(838,494,316,280,BG),t(862,640,"净绘图区最低 280px",14,ACTION),r(814,822,364,112),t(838,866,"回放槽 · 分行容纳动作",14,TEXT),r(814,958,364,164),t(838,998,"检查区 · 纵向延续",16,TEXT,600),t(838,1036,"概览 / 调仓 / 统计",14,MUTED),t(838,1070,"实际持仓与完整原因",14,MUTED)]
    return ''.join(o)+"</svg>"

BUILDERS={"11-compact.svg":compact,"11-narrow.svg":narrow,"11-responsive.svg":overview}
if __name__=="__main__":
    for name in (sys.argv[1:] or BUILDERS): (OUT/name).write_text(BUILDERS[name](),encoding="utf-8"); print(OUT/name)
