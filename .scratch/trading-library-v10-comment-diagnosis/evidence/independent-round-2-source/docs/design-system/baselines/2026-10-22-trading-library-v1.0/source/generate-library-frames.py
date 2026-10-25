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
            f'font-weight="{weight}" text-anchor="{anchor}"{c}>{esc(value)}'
            +(f'<title>{value.full_amount:,.2f} CNY</title>' if hasattr(value,'full_amount') else '')+'</text>')


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


class FormattedAmount(str):
    def __new__(cls, value, full_amount):
        result=super().__new__(cls,value);result.full_amount=full_amount;return result


def fmt(v: float | int | None) -> str:
    if v is None:
        return "—"
    return FormattedAmount(f"{v / 100000000:.2f} 亿" if abs(v) >= 100000000 else f"{v / 10000:.2f} 万" if abs(v) >= 10000 else f"{v:,.2f}",v)


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


# A panel owns its measured bottom; no caller guesses heights from row counts.
from dataclasses import dataclass

@dataclass
class Panel:
    svg: str
    bottom: float


def button(x, y, w, label, active=False, disabled=False, focus=False):
    return (rect(x, y, w, 36, 'raised' if active else 'surface', 'blue' if active or focus else 'border', 6)
            + text(x+w/2, y+23, label, 14, 'subtle' if disabled else 'blue' if active else 'text', 500, 'middle'))


def segments(x,y,labels,active,width=176):
    cell=width/len(labels)
    return ''.join(button(x+i*cell,y,cell-2,label,label==active) for i,label in enumerate(labels))


def range_label(state):
    return state['start'] if state['start']==state['end'] else f"{state['start']} 至 {state['end']}"


def common_chrome(width,height,title,subtitle,state,view='实盘',page='列表',return_label='返回首页'):
    out=[text(96,96,'首页 / 交易库',12,'muted'),text(96,130,title,24,'text',600),text(96,154,subtitle,14,'muted'),
         text(width-24,130,'已应用条件',12,'blue',600,'end'),text(width-24,154,range_label(state)+' · '+state['market']+(' · '+state.get('account','') if view=='实盘' else ''),12,'muted',400,'end'),
         text(96,188,'视角',12,'muted'),segments(96,196,['实盘','模拟盘'],view,182),text(302,188,'页面',12,'muted'),segments(302,196,['列表','统计'],page)]
    return out


def filter_controls(width,state,view='实盘',review=None):
    y=268 if width>1280 else 262
    # Long range dates have their own 300px budget; search retains 220+28+36.
    out=[control(96,y,300,'保存日期' if view=='模拟盘' else '成交 / 平仓日期',range_label(state),'date'),control(420,y,140,'市场',state['market'])]
    if view=='实盘':out.append(control(584,y,160,'账户',state['account']))
    out += [control(width-308,y,220,'交易搜索',state['search'] or '筛选当前列表','search'),button(width-60,y,36,''),icon_refresh(width-50,y+10)]
    return ''.join(out)


def document(width,height,title,body,state=None,view='实盘',return_label='返回首页',active='交易库',focus=None):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(title)}"><title>{esc(title)} · 设计样例</title>'
            +f'<style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>'
            +f'<rect width="{width}" height="{height}" fill="{COLORS["bg"]}"/>'+sidebar(height,active,focus)
            +header(width,'交易库','来源：首页' if return_label=='返回首页' else '来源：'+view+'列表',return_label)+''.join(body)+'</svg>')


def table(x,y,w,title,subtitle,headers,rows,count=None,page=1,page_size=6,selected=None,focus=None):
    total=len(rows) if count is None else count
    pages=max(1,math.ceil(total/page_size)); visible=rows[(page-1)*page_size:page*page_size]
    # Header 112, row 48, footer 64. Return actual lower edge.
    h=112+max(1,len(visible))*48+64
    out=[rect(x,y,w,h),text(x+24,y+34,title,18,'text',600),text(x+24,y+58,subtitle,12,'muted')]
    for label,offset,anchor in headers:out.append(text(x+offset,y+88,label,12,'muted',400,anchor))
    out.append(line(x+24,y+102,x+w-24,y+102))
    for i,row in enumerate(visible):
        ry=y+112+i*48
        rid=row['id']; cells=row['cells']
        if rid==selected or rid==focus:out.append(rect(x+12,ry,w-24,48,'raised','blue' if rid==focus else 'border',4))
        for (value,tone),(label,offset,anchor) in zip(cells,headers):out.append(text(x+offset,ry+29,value,14,tone,500 if rid==selected else 400,anchor))
        out.append(line(x+24,ry+48,x+w-24,ry+48))
    if not visible:out.append(text(x+24,y+141,'没有符合条件的记录',14,'muted'))
    out.extend([text(x+24,y+h-24,f'{(page-1)*page_size+1 if total else 0}–{min(page*page_size,total)} / {total} 项',12,'subtle'),button(x+w-188,y+h-48,36,'‹',disabled=page==1),text(x+w-112,y+h-25,f'{page} / {pages}',14,'muted',400,'middle'),button(x+w-60,y+h-48,36,'›',disabled=page==pages)])
    return Panel(''.join(out),y+h)


def metric_cards(x,y,w,data):
    gap=16;cw=(w-gap*(len(data)-1))/len(data);out=[]
    for i,(label,val) in enumerate(data):
        xx=x+i*(cw+gap);out += [rect(xx,y,cw,96),text(xx+16,y+28,label,12,'muted'),text(xx+16,y+70,val,28,'text',600)]
    return ''.join(out)


def trend_card(x,y,w,h,title,subtitle,values,value_key='cumulative',grain='day'):
    out=[rect(x,y,w,h),text(x+24,y+34,title,18,'text',600),text(x+24,y+57,subtitle,12,'muted')]
    left,right,top,bottom=x+92,x+w-48,y+94,y+h-48
    nums=[v.get(value_key) for v in values if v.get(value_key) is not None]
    if not nums:
        out += [line(left,yy,right,yy) for yy in [top,(top+bottom)/2,bottom]]
        out.append(text((left+right)/2,(top+bottom)/2,'正在加载…' if subtitle=='首次加载' else '没有可绘制的有效数据',14,'muted',400,'middle'))
        return Panel(''.join(out),y+h)
    lo,hi=min(0,min(nums)),max(0,max(nums));span=max(1,hi-lo);lo-=span*.12;hi+=span*.12
    yy=lambda v:bottom-(v-lo)/(hi-lo)*(bottom-top)
    zero=yy(0)
    for tick in [hi,0,lo]:out += [line(left,yy(tick),right,yy(tick),'muted' if tick==0 else 'border',1,'4 4' if tick==0 else ''),text(left-12,yy(tick)+4,fmt(tick),12,'subtle',400,'end')]
    prev=None
    for i,v in enumerate(values):
        xx=(left+right)/2 if len(values)==1 else left+(right-left)*i/(len(values)-1)
        label=v['date'][:4] if grain=='year' else v['date'][:7] if grain=='month' else v['date'][5:]
        out.append(text(xx,bottom+25,label,12,'subtle',400,'middle'))
        value=v.get(value_key)
        if value is None:
            out += [line(xx,top,xx,bottom,'warning',1,'3 5'),text(xx,top+22,'缺失',12,'warning',400,'middle')];prev=None;continue
        point=(xx,yy(value));out.append(f'<circle cx="{xx:g}" cy="{point[1]:g}" r="4" fill="{COLORS["blue"]}"><title>{esc(v["date"])} · {value:,.2f} CNY</title></circle>')
        if prev:out.append(line(*prev,*point,'blue',2))
        prev=point
        if v.get('status')=='no_trades':out.append(text(xx,min(bottom-14,point[1]+26),'无成交 · 0.00',12,'muted',400,'end'))
    return Panel(''.join(out),y+h)


def stats_frame(width,minimum,fixture,kind):
    sim=kind in ['simulation-stats','trend-gap','trend-single']
    state=dict(fixture['navigation']['simulation' if sim else 'live']);view='模拟盘' if sim else '实盘'
    rounds=derive_sim_rounds(fixture) if sim else derive_live_rounds(fixture)
    status=kind if kind in ['loading','empty','error','missing'] else None
    grain='day';mode='金额' if kind in ['distribution','return-stats','amount-stats'] else '收益率';selected='盈利 > 100' if kind in ['distribution','return-stats'] else None
    title=f'{view}统计';subtitle='有效已平仓回合 · CNY'
    if kind=='trend-month':state.update(start='2026-01-01',end='2026-12-31');grain='month'
    if kind=='trend-year':state.update(start='2020-01-01',end='2026-12-31');grain='year'
    if kind in ['trend-empty','empty']:state.update(start='2026-10-20',end='2026-10-25');status='empty'
    if kind=='trend-single':state.update(start='2026-10-15',end='2026-10-15')
    if kind=='extreme':
        rounds=[dict(r,date=e['saved_date'],symbol=e['symbol'],round_id=e['id']) for e in fixture['boundary_exercises'] for r in lifo_rounds(e)['rounds']];state.update(start='2026-10-03',end='2026-10-07')
    stats=stats_for(rounds,state['start'],state['end']);points=stats['points']
    if grain!='day':
        groups={}
        for r in stats['rounds']:
            key=r['date'][:7] if grain=='month' else r['date'][:4];groups[key]=groups.get(key,0)+r['net']
        cum=0;points=[]
        for key,value in sorted(groups.items()):cum+=value;points.append({'date':key,'cumulative':round(cum,2)})
    if kind=='missing':
        missing_date=fixture['missing_inputs']['date'];total=stats['count'];stats=stats_for([r for r in stats['rounds'] if r['date']!=missing_date]);points=stats['points']+[{'date':missing_date,'cumulative':None}];subtitle=f"可计算 {stats['count']} / {total} 回合 · {missing_date} 平仓费用缺失 · 全范围净盈亏 —"
    if kind=='trend-gap':
        gap=fixture['trend_modes']['gap_scenario'];state.update(start=gap['start'],end=gap['end']);missing={d['date'] for d in gap['dates'] if d['status']=='missing'}
        stats=stats_for([r for r in rounds if r['date'] not in missing],state['start'],state['end']);known={p['date']:p['cumulative'] for p in stats['points']};cum=0;points=[]
        for d in gap['dates']:
            if d['status']=='missing':value=None
            else: value=known.get(d['date'],cum);cum=value
            points.append({**d,'cumulative':value})
        subtitle='10-17、10-18 文件缺失 · 全范围净盈亏 — · 可计算 5 回合'
    body=common_chrome(width,minimum,title,subtitle,state,view,'统计');body.append(filter_controls(width,state,view));y=342;w=width-120
    if status=='error':
        body += [rect(96,y,w,68,'raised'),text(120,y+27,'更新失败 · '+range_label(fixture['navigation']['error_attempt'])+' 未应用',14,'warning',600),text(120,y+50,'当前仍显示 '+range_label(state)+' 的完整结果',12,'muted'),button(width-156,y+16,108,'重试')];y+=92
    if status=='loading':metrics=[(l,'…') for l in ['有效回合','累计净盈亏','胜率','平均盈利','平均亏损','闭合费用']];points=[]
    else:metrics=[('有效回合',str(stats['count'])),('可计算净盈亏' if kind in ['missing','trend-gap'] else '累计净盈亏',fmt(stats['net'])),('胜率',f"{stats['win_rate']:.2f}%" if stats['win_rate'] is not None else '—'),('平均盈利',fmt(stats['average_profit'])),('平均亏损',fmt(stats['average_loss'])),('闭合费用',fmt(stats['fees']))]
    body.append(metric_cards(96,y,w,metrics));y+=120
    trend=trend_card(96,y,w,280,'可计算累计净盈亏' if kind in ['trend-gap','missing'] else '累计净盈亏趋势','首次加载' if status=='loading' else ('按保存日期' if sim else '按回合平仓日期')+' · '+{'day':'日','month':'月','year':'年'}[grain],points,grain=grain);body.append(trend.svg);y=trend.bottom+24
    dist=distribution_for(stats['rounds'] if status!='loading' else [],mode)
    rows=[{'id':d['label'],'cells':[(d['label'],'negative' if '亏损' in d['label'] else 'positive' if '盈利' in d['label'] else 'muted'),('…' if status=='loading' else str(d['count']),'text'),('…' if status=='loading' else f"{d['rate']:.2f}%" if d['rate'] is not None else '—','text')]} for d in dist]
    table_y=y
    panel=table(96,y,w,'收益分布','分母等待数据' if status=='loading' else f"当前范围 · {stats['count']} 个有效回合",[('区间',24,'start'),('回合数',606,'end'),('占比',760,'end')],rows,selected=selected)
    body.append(panel.svg);body.append(segments(width-240,table_y+16,['收益率','金额'],mode,192));y=panel.bottom+24
    if selected:
        chosen=next(d for d in dist if d['label']==selected);rows=[{'id':r['round_id'],'cells':[(r['date'],'text'),(r['symbol'],'text'),(fmt(r['net']),'positive'),('进入复盘 →','blue')]} for r in chosen['rounds']]
        panel=table(96,y,w,'区间回合 · '+selected,f"{len(rows)} 个回合 / 范围内 {stats['count']} 个回合",[('平仓日期',24,'start'),('标的',280,'start'),('净盈亏(CNY)',606,'end'),('操作',760,'start')],rows,focus=rows[0]['id'] if kind=='return-stats' and rows else None);body.append(panel.svg);y=panel.bottom+24
    if kind=='extreme':
        body += [rect(96,y,w,92,'raised'),text(120,y+30,'金额详情 · 平均盈利',14,'text',600),text(120,y+63,f"{stats['average_profit']:,.2f} CNY",18,'positive'),button(width-180,y+28,132,'复制完整金额')];y+=116
    if kind in ['missing','trend-gap']:
        body += [rect(96,y,w,68,'raised'),text(120,y+28,'缺失回合未进入统计与分布分母；全范围结果不可计算。',14,'warning'),text(120,y+51,'补充平仓费用后重新计算' if kind=='missing' else '10-17、10-18：文件读取失败；10-20：已确认无成交，日收益 0.00。',12,'muted')];y+=92
    return document(width,max(minimum,math.ceil(y)),title,body,state,view)


def trade_rows(fixture,state,pending=False):
    trades=sorted([t for t in fixture['live_trades'] if date_between(t['date'],state['start'],state['end']) and (not pending or t['review_status']=='pending')],key=lambda t:(t['date'],t['id']))
    return [{'id':t['id'],'cells':[(t['date'],'text'),(t['symbol']+' · '+t['code'],'text'),(t['side'],'text'),(str(t['quantity']),'text'),(f"{t['price']:,.2f}",'text'),('待复盘' if t['review_status']=='pending' else '已复盘','warning' if t['review_status']=='pending' else 'muted'),('查看回合 →','blue')]} for t in trades]


def list_frame(width,height,fixture,kind):
    sim=kind in ['simulation-list','view-simulation','simulation-return'];state=dict(fixture['navigation']['simulation' if sim else 'live']);view='模拟盘' if sim else '实盘';pending=kind=='pending'
    if kind=='date':state.update(start=fixture['source']['date'],end=fixture['source']['date'])
    if kind=='month-list':state.update(start='2026-10-01',end='2026-10-31')
    title='模拟盘练习' if sim else '实盘交易';subtitle='按保存日期' if sim else '按成交日期'
    body=common_chrome(width,height,title,subtitle,state,view);body.append(filter_controls(width,state,view));y=342 if width>1280 else 336
    body += [control(96,y,176,'复盘状态','待复盘' if pending else '全部'),text(width-24,y+23,state['sort'],14,'muted',400,'end')];y+=60
    if sim:
        rows=[]
        for e in sorted(fixture['simulation_exercises'],key=lambda e:(e['saved_date'],e['id'])):
            if not date_between(e['saved_date'],state['start'],state['end']):continue
            r=lifo_rounds(e);rows.append({'id':e['id'],'cells':[(e['saved_date'],'text'),(e['label'],'text'),(e['symbol']+' · '+e['code'],'text'),(str(len(r['rounds'])),'text'),(str(r['open_quantity']),'muted'),('查看回合 →','blue')]})
        headers=[('保存日期',24,'start'),('练习',180,'start'),('标的',340,'start'),('已平仓回合',720,'end'),('未平仓数量',880,'end'),('操作',960,'start')]
    else:
        rows=trade_rows(fixture,state,pending);headers=[('成交日期',24,'start'),('标的',180,'start'),('方向',480,'start'),('数量',600,'end'),('成交价',740,'end'),('复盘状态',800,'start'),('操作',980,'start')]
    focus=state['focus'] if kind in ['live-return','view-restore','simulation-return'] else None
    panel=table(96,y,width-120,title,('6 次练习 / 7 个已平仓回合' if sim else '一行一笔成交'),headers,rows,page=state['page'],page_size=state['page_size'],focus=focus)
    body.append(panel.svg)
    return document(width,max(height,int(panel.bottom+24)),title,body,state,view)


def object_state(fixture,live):
    state=fixture['navigation']['live' if live else 'simulation']
    if live:
        obj={'id':'600519','label':'贵州茅台','symbol':'贵州茅台','code':'600519','trades':[t for t in fixture['live_trades'] if t['code']=='600519']};rounds=[r for r in derive_live_rounds(fixture) if r['code']=='600519'];result=lifo_rounds(obj)
    else:obj=fixture['simulation_exercises'][0];result=lifo_rounds(obj);rounds=result['rounds']
    return state,obj,result,rounds


def rounds_frame(width,height,fixture,kind):
    live=kind.startswith('live');state,obj,result,rounds=object_state(fixture,live)
    if kind=='rounds-b':obj=fixture['simulation_exercises'][1];result=lifo_rounds(obj);rounds=result['rounds']
    view='实盘' if live else '模拟盘';title=obj['label']+' · 回合集';body=common_chrome(width,height,title,obj['symbol']+' · '+obj['code'],state,view,return_label='返回列表');body.append(filter_controls(width,state,view));y=342
    rows=[{'id':str(i),'cells':[(f'回合 {i}','text'),(r['open_date']+' → '+r['close_date'],'text'),(str(r['quantity']),'text'),(fmt(r['net']),'positive' if r['net']>=0 else 'negative'),('进入复盘 →','blue')]} for i,r in enumerate(rounds,1)]
    panel=table(96,y,width-120,title,'已闭合回合',[('回合',24,'start'),('开仓 → 平仓',180,'start'),('配对数量',680,'end'),('净盈亏(CNY)',880,'end'),('操作',980,'start')],rows,focus=('2' if kind=='rounds-a-return' else '1') if kind.endswith('return') else None);body.append(panel.svg);y=panel.bottom+24
    body.append(metric_cards(96,y,width-120,[('闭合净盈亏',fmt(sum(r['net'] for r in rounds))),('闭合费用',fmt(result['closed_fees'])),('未平仓数量',str(result['open_quantity'])),('留存开仓费用',fmt(result['open_fees']))]));y+=120
    return document(width,max(height,int(y)),title,body,state,view,'返回列表')


def replay_frame(width,height,fixture,kind):
    live=kind=='library-replay';state,obj,result,rounds=object_state(fixture,live);idx=1
    if kind=='replay-a2':idx=2
    if kind=='replay-b1':obj=fixture['simulation_exercises'][1];result=lifo_rounds(obj);rounds=result['rounds']
    rd=rounds[idx-1];view='实盘' if live else '模拟盘';title=obj['label']+f' · 回合 {idx} 复盘'
    body=common_chrome(width,height,title,obj['symbol']+' · '+obj['code'],state,view,return_label='返回回合集');body.append(filter_controls(width,state,view))
    x,y,w=96,342,width-120;h=580
    body += [rect(x,y,w,h),text(x+24,y+34,title,18,'text',600),segments(x+24,y+54,[f'回合 {i}' for i in range(1,len(rounds)+1)],f'回合 {idx}',max(100,len(rounds)*100)),button(x+w-300,y+54,120,'定位开仓'),button(x+w-156,y+54,132,'定位平仓',True)]
    left,right,top,bottom=x+84,x+w-92,y+130,y+410
    bars=fixture['chart_samples'][obj['id']]['bars'];lo=min(b['low'] for b in bars);hi=max(b['high'] for b in bars);pad=(hi-lo)*.15;lo-=pad;hi+=pad
    sy=lambda p:bottom-(p-lo)/(hi-lo)*(bottom-top)
    sx=lambda day:left+(right-left)*next(i for i,b in enumerate(bars) if b['date']==day)/max(1,len(bars)-1)
    for value in [lo,(lo+hi)/2,hi]:body += [line(left,sy(value),right,sy(value)),text(right+12,sy(value)+5,f'{value:,.2f}',12,'subtle')]
    for i,b in enumerate(bars):
        xx=left+(right-left)*i/max(1,len(bars)-1);tone='positive' if b['close']>=b['open'] else 'negative';body += [line(xx,sy(b['high']),xx,sy(b['low']),tone),rect(xx-7,min(sy(b['open']),sy(b['close'])),14,max(2,abs(sy(b['open'])-sy(b['close']))),tone,tone,1)]
        if i in [0,len(bars)//2,len(bars)-1]:body.append(text(xx,bottom+25,b['date'][5:],12,'subtle',400,'middle'))
    # Selected matched entry/exit are visible; other opening context remains muted.
    for t in obj['trades']:
        xx=sx(t['date']);yy=sy(t['price']);active=t['id'] in [rd['open_id'],rd['close_id']];tone='blue' if active else 'subtle';above=t['side']=='卖出'
        body.append(f'<circle cx="{xx:g}" cy="{yy:g}" r="9" fill="{COLORS["surface"]}" stroke="{COLORS[tone]}" stroke-width="2"/>')
        label=('卖' if above else '买')+' '+str(t['quantity'])+'股'+('' if active else ' · 上下文')
        body.append(text(xx,yy-20 if above else yy+30,label,14,tone,600,'middle'))
        if active and above:body += [line(xx,top,xx,bottom,'blue',1,'4 4')]
    body += [text(x+24,y+473,f"配对 {rd['quantity']} 股 · {rd['open_price']:,.2f} → {rd['close_price']:,.2f}",18,'text',600),text(x+24,y+504,f"开仓 {rd['open_date']}  /  平仓 {rd['close_date']}  ·  费用 {rd['fees']:.2f} CNY",14,'muted'),text(x+w-24,y+473,'净盈亏 '+fmt(rd['net'])+' CNY',18,'positive' if rd['net']>=0 else 'negative',600,'end'),text(x+24,y+549,'日线 · 设计行情样例 · 成交标记为原始成交数量',12,'muted'),button(x+w-156,y+525,132,'返回回合集')]
    return document(width,max(height,y+h+24),title,body,state,view,'返回回合集')


def home_valuation(fixture):
    valuation=fixture['valuation'];points=[]
    for day,quotes in sorted(valuation['quotes_by_date'].items()):
        partial={**fixture,'live_trades':[t for t in fixture['live_trades'] if t['date']<=day]}
        positions=derive_live_positions(partial);realized=sum(r['net'] for r in derive_live_rounds(partial))
        floating=sum(p['quantity']*(quotes[p['code']]-p['price'])-p['fee'] for p in positions)
        points.append({'date':day,'cumulative':round(realized+floating-valuation['opening_unrealized'],2)})
    quotes=valuation['quotes_by_date'][fixture['navigation']['home']['end']];positions=derive_live_positions(fixture)
    for p in positions:
        p['quote']=quotes[p['code']];p['market_value']=p['quantity']*p['quote'];p['floating']=p['quantity']*(p['quote']-p['price'])-p['fee']
    market=sum(p['market_value'] for p in positions);floating=sum(p['floating'] for p in positions);realized=stats_for(derive_live_rounds(fixture))['net']
    return {'positions':positions,'market_value':market,'floating':floating,'realized':realized,'total':realized+floating-valuation['opening_unrealized'],'points':points}


def home_frame(fixture,focus=False):
    # Copy the approved full homepage host through the period controls. Data
    # modules retain its absolute geometry, hierarchy and complete page length.
    reference=ROOT.parents[1]/'2026-10-22-homepage-v2.5/source/images/home-1440.svg'
    source=reference.read_text();prefix=source[:source.index('<rect x="96.0" y="124"')]
    prefix=re.sub(r'<rect x="48" y="134"[^>]*/><text x="60" y="151"[^>]*>12</text>','',prefix)
    prefix=prefix.replace('x="246" y="80" width="68" height="36" rx="6" fill="#162233" stroke="#6CA8FF"','x="246" y="80" width="68" height="36" rx="6" fill="#111A26" stroke="#283448"')
    prefix=prefix.replace('x="322" y="80" width="68" height="36" rx="6" fill="#111A26" stroke="#283448"','x="322" y="80" width="68" height="36" rx="6" fill="#162233" stroke="#6CA8FF"')
    prefix=prefix.replace('2026-01-01 — 10-15','2026-10-01 — 10-15').replace('16:32 更新','15:00 更新')
    value=home_valuation(fixture);out=[prefix]
    if focus:out.append('<rect x="8" y="137" width="56" height="56" rx="8" fill="none" stroke="#6CA8FF" stroke-width="2"/>')
    metrics=[('期间净盈亏(CNY)',value['total']),('期间已实现(CNY)',value['realized']),('期间浮盈变动(CNY)',value['floating']),('当前持仓市值(CNY)',value['market_value'])]
    for i,(label,amount) in enumerate(metrics):
        x=96+i*333;out += [rect(x,124,321,88),text(x+16,149,label,14,'muted'),f'<g><title>{amount:,.2f} CNY</title>'+text(x+16,188,fmt(amount),28,'text' if i==3 else 'positive',600)+'</g>']
    # Identical plot bounds to the approved homepage chart.
    out += [rect(96,226,1320,320),text(112,253,'期间净盈亏',18,'text',600),text(1400,253,'CNY',12,'muted',400,'end')]
    left,right,top,bottom=172,1380,276,496;points=value['points'];lo=min(0,min(p['cumulative'] for p in points));hi=max(p['cumulative'] for p in points);span=hi-lo;lo-=span*.1;hi+=span*.1
    sy=lambda v:bottom-(v-lo)/(hi-lo)*(bottom-top)
    for v in [hi,(hi+lo)/2,0,lo]:out += [line(left,sy(v),right,sy(v),'muted' if v==0 else 'border'),text(left-12,sy(v)+4,fmt(v),12,'muted',400,'end')]
    prev=None
    for i,p in enumerate(points):
        xx=left+(right-left)*i/(len(points)-1);yy=sy(p['cumulative'])
        if prev:out.append(line(*prev,xx,yy,'blue',2))
        out.append(f'<circle cx="{xx:g}" cy="{yy:g}" r="4" fill="{COLORS["blue"]}"><title>{p["date"]} · {p["cumulative"]:,.2f} CNY</title></circle>');prev=xx,yy
        if i in [0,2,4,6,8,len(points)-1]:out.append(text(xx,519,p['date'][5:],12,'muted',400,'middle'))
    out += [rect(96,586,1320,520),text(112,610,'当前持仓',18,'text',600),text(760,610,'市值 '+fmt(value['market_value']),14,'muted',400,'end'),text(950,610,'浮盈 '+fmt(value['floating']),14,'positive',400,'end'),control(1172,592,176,'','搜索持仓','search'),button(1356,592,44,'↗')]
    cols=[('标的',128,'start'),('持仓天数',521,'end'),('数量',650,'end'),('成本价',792,'end'),('最新价',934,'end'),('市值(CNY)',1127,'end'),('浮盈(CNY)',1307,'end'),('查看',1361,'middle')]
    for label,x,anchor in cols:out.append(text(x,660,label,12,'muted',400,anchor))
    for i,p in enumerate(value['positions']):
        yy=691+48*i;days=(date.fromisoformat(fixture['navigation']['home']['end'])-date.fromisoformat(p['date'])).days
        cells=[p['symbol'],str(days),str(p['quantity']),f"{p['price']+p['fee']/p['quantity']:,.2f}",f"{p['quote']:,.2f}",fmt(p['market_value']),fmt(p['floating']),'→']
        for j,(val,(_,x,a)) in enumerate(zip(cells,cols)):out.append(text(x,yy,val,14,'positive' if j==6 else 'blue' if j==7 else 'text',400,a))
        out += [text(128,yy+16,p['code'],12,'muted'),line(112,yy+23,1400,yy+23)]
    out += [text(112,1089,'1–2 / 2 项 · 估值 2026-10-15 15:00 · 覆盖 2/2 持仓',12,'muted'),button(1256,1064,36,'‹',disabled=True),text(1328,1087,'1 / 1',14,'muted',400,'middle'),button(1364,1064,36,'›',disabled=True)]
    # Full historical section, followed by current-period contribution, as in V2.5.
    x,y,w=96,1130,1320;st=stats_for(derive_live_rounds(fixture))
    out += [rect(x,y,w,558),text(x+24,y+32,'历史统计',18,'text',600),control(x+998,y+20,282,'','2026年 · 每月净盈亏')]
    for i,(label,val) in enumerate([('历史净盈亏(CNY)',fmt(st['net'])),('已平仓回合',str(st['count'])),('胜率',f"{st['win_rate']:.2f}%"),('闭合费用(CNY)',fmt(st['fees']))]):
        xx=x+i*333;out += [rect(xx,y+82,321,88),text(xx+16,y+108,label,14,'muted'),text(xx+16,y+145,val,28,'text',600)]
    out += [text(x+24,y+218,'历史净盈亏',18,'text',600),text(x+w-24,y+218,'按回合平仓日 · CNY',12,'muted',400,'end')]
    chart_left,chart_right,chart_top,chart_bottom=x+76,x+w-36,y+290,y+490
    for v in [1000,500,0,-250]:
        yy=chart_bottom-(v+250)/1250*(chart_bottom-chart_top);out += [line(chart_left,yy,chart_right,yy),text(chart_left-12,yy+4,fmt(v),12,'muted',400,'end')]
    yy=chart_bottom-(st['net']+250)/1250*(chart_bottom-chart_top);zero=chart_bottom-250/1250*(chart_bottom-chart_top)
    for month in range(1,13):
        xx=chart_left+(chart_right-chart_left)*(month-.5)/12
        if month==10:out += [rect(xx-20,yy,40,zero-yy,'positive','positive',2),text(xx,yy-10,fmt(st['net']),12,'positive',400,'middle')]
        out.append(text(xx,y+514,f'{month}月',12,'muted',400,'middle'))
    x,y,w=96,1712,1320;out += [rect(x,y,w,610),text(x+32,y+36,'当前期间贡献',18,'text',600),text(x+w-32,y+36,'期间净盈亏 '+fmt(value['total'])+' CNY',18,'positive',600,'end'),text(x+32,y+58,'本月 · 当前表现日期 2026-10-01 — 10-15 · 已实现 + 浮盈变动',12,'muted'),segments(x+32,y+70,['当前期间','历史'], '当前期间',200)]
    out += [text(x+32,y+124,'分类',12,'muted'),segments(x+32,y+130,['做多','做空','打新'],'做多',228),control(x+312,y+130,128,'排序','盈利最高'),text(x+460,y+153,'□ 仅当前持仓',14,'muted'),control(x+712,y+130,160,'市场','全部市场'),text(x+582,y+222,'● 已实现',12,'blue'),text(x+684,y+222,'● 浮盈变动',12,'positive'),text(x+32,y+264,'市场',12,'muted'),text(x+w-32,y+264,'净盈亏(CNY)',12,'muted',400,'end')]
    for i,label in enumerate(['A股','港股','美股']):
        yy=y+311+i*72;out += [text(x+32,yy,label,14),text(x+w-32,yy,fmt(value['total'] if i==0 else 0),18,'positive' if i==0 else 'muted',600,'end')]
        if i==0:
            totalwidth=700;realw=totalwidth*value['realized']/value['total'];out += [rect(x+180,yy-18,realw,24,'blue','blue',2),rect(x+180+realw,yy-18,totalwidth-realw,24,'positive','positive',2)]
        else:out.append(line(x+180,yy-6,x+880,yy-6))
    out += [line(x+32,y+506,x+w-32,y+506),text(x+32,y+548,'合计',18,'text',600),text(x+w-32,y+548,fmt(value['total'])+' CNY',28,'positive',600,'end'),text(x+32,y+574,'已实现 '+fmt(value['realized'])+' + 浮盈变动 '+fmt(value['floating']),12,'muted'),text(x+w-32,y+574,'市场合计与当前表现一致',12,'muted',400,'end'),'</g></svg>']
    return ''.join(out)


FRAMES={
 '01-live-normal.svg':'live-stats','02-simulation-normal.svg':'simulation-stats','03-distribution-selected.svg':'distribution','04-return.svg':'return-stats',
 '05-loading.svg':'loading','06-empty.svg':'empty','07-error.svg':'error','08-extreme.svg':'extreme','09-missing-input.svg':'missing',
 'journeys-date.svg':'date','journeys-date-1280.svg':'date','journeys-date-month.svg':'month-list',
 'hcr06-final-sim-ab.svg':'simulation-list','hcr06-final-rounds-a.svg':'rounds-a','hcr06-final-replay-a1.svg':'replay-a1','hcr06-final-replay-a2.svg':'replay-a2','hcr06-final-replay-b1.svg':'replay-b1',
 'journeys-trend-gap.svg':'trend-gap','journeys-trend-single.svg':'trend-single','journeys-trend-empty.svg':'trend-empty','journeys-trend-month.svg':'trend-month','journeys-trend-year.svg':'trend-year',
 'handoff.svg':'home','journeys-home-entry.svg':'home','journeys-library-list.svg':'live-list','journeys-live-rounds.svg':'live-rounds','journeys-library-replay.svg':'library-replay','journeys-live-rounds-return.svg':'live-rounds-return','journeys-library-list-return.svg':'live-return','journeys-view-restore.svg':'view-restore',
 'hcr06-final-pending-library.svg':'pending','hcr06-final-pending-library-1280.svg':'pending','library-return.svg':'home-return','journeys-library-return.svg':'home-return','hcr06-final-return.svg':'return-stats',
 'distribution-amount.svg':'amount-stats','journeys-view-simulation.svg':'view-simulation','journeys-simulation-return.svg':'simulation-return','journeys-rounds-a-return.svg':'rounds-a-return','journeys-rounds-b.svg':'rounds-b',
}


def generate(name,fixture):
    kind=FRAMES[name];width=1280 if '-1280' in name else 1440;height=800 if width==1280 else 1000
    if kind.startswith('home'):return home_frame(fixture,kind=='home-return')
    if kind in ['date','month-list','live-list','live-return','view-restore','pending','simulation-list','view-simulation','simulation-return']:return list_frame(width,height,fixture,kind)
    if kind in ['live-rounds','live-rounds-return','rounds-a','rounds-a-return','rounds-b']:return rounds_frame(width,height,fixture,kind)
    if kind in ['library-replay','replay-a1','replay-a2','replay-b1']:return replay_frame(width,height,fixture,kind)
    return stats_frame(width,height,fixture,kind)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--frames',nargs='*');parser.add_argument('--all',action='store_true');args=parser.parse_args()
    fixture=json.loads(FIXTURE_PATH.read_text());errors=validate_fixture(fixture)
    if errors:raise SystemExit('\n'.join(errors))
    names=list(FRAMES) if args.all or not args.frames else args.frames
    for name in names:
        if name not in FRAMES:raise SystemExit('Unknown frame: '+name)
        svg=generate(name,fixture);ElementTree.fromstring(svg);(IMAGE_DIR/name).write_text(svg)
    print(f'Generated {len(names)} frames; fixture invariants passed.')


if __name__=='__main__':main()
