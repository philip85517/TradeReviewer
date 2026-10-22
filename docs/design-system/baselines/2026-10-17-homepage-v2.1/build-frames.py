"""Reproducible synthetic design boards; never reads account data."""
from pathlib import Path
from html import escape
import math, runpy
OUT=Path(__file__).parent/'images'; OUT.mkdir(exist_ok=True)
BG='#0B1019'; SURF='#111A26'; RAISED='#162233'; LINE='#283448'; TEXT='#E6EDF7'; MUTED='#A8B6CB'; BLUE='#6CA8FF'; GREEN='#53D7A0'; RED='#FF8592'; WARN='#FFC66D'
FONT="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
def text(x,y,s,size=14,color=TEXT,weight=400,anchor='start'):
 return f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">{escape(str(s))}</text>'
def box(x,y,w,h,color=SURF,stroke=LINE,r=8): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{color}" stroke="{stroke}"/>'
def line(x,y,xx,yy,color=LINE,width=1): return f'<path d="M{x} {y} L{xx} {yy}" stroke="{color}" stroke-width="{width}" fill="none"/>'
def icon(x,y,kind='search',active=False,disabled=False):
 c='#53647B' if disabled else BLUE if active else MUTED
 d={'search':'M7 7a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M15 11l6 6','filter':'M4 4h18l-7 8v8l-4 -2v-6z','eye':'M3 11q9 -12 18 0q-9 12 -18 0M9 11a3 3 0 1 0 6 0a3 3 0 1 0 -6 0','export':'M12 3v12m-5 -5l5 5 5 -5M4 18v4h16v-4','info':'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0 -18M12 10v7M12 6v1','library':'M4 4h16v18H4zM8 9h8M8 13h8M8 17h5','calendar':'M4 5h16v16H4zM4 10h16M8 2v6M16 2v6','refresh':'M20 9a8 8 0 1 0 -1 9M20 3v6h-6'}.get(kind,'M12 4v10M12 18v2')
 return box(x,y,36,36,'#203B62' if active else SURF,BLUE if active else LINE,6)+f'<path d="{d}" transform="translate({x+10} {y+10}) scale(0.6666667)" fill="none" stroke="{c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
def svg(w,h,b,title): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{escape(title)}"><style>text{{font-family:{FONT};font-variant-numeric:tabular-nums}}</style>'+box(0,0,w,h,BG,'none',0)+b+'</svg>'
def save(name,w,h,b,title=None): (OUT/(name+'.svg')).write_text(svg(w,h,b,title or name))
def tabs(x,y,selected='全部'):
 b=''
 for i,label in enumerate(['全部','A股','港股','美股']): b+=box(x+i*76,y,72,36,'#203B62' if label==selected else BG,BLUE if label==selected else 'none',6)+text(x+i*76+36,y+23,label,14,TEXT if label==selected else MUTED,500,'middle')
 return b
ROWS=[('贵州茅台','600519 · SSE','182','120','636.85','688.67',82640,6218),('宁德时代','300750 · SZSE','96','1,000','58.342','55.24',55240,-3102),('Cerebras Systems Inc. — Class A','CBRS · NASDAQ','44','8','2,180.25','2,480.25',19842,2400),('恒生科技ETF','513130 · SSE','302','3,600','8.155','7.808',28110,-1248),('招商银行','600036 · SSE','21','480','80.233','84.417',40520,2008),('Tesla, Inc.','TSLA · NASDAQ','18','25','509.04','492.16',12304,-422),('微软','MSFT · NASDAQ','12','60','503.633','598.033',35882,5664),('中证500ETF','510500 · SSE','7','800','22.285','23.428',18742,914)]
MV=sum(r[6] for r in ROWS); UP=sum(r[7] for r in ROWS)
def metrics(x,y,w,cur='CNY',net=18420,real=12240,mv=MV,loading=False):
 b=''
 for i,(label,value) in enumerate([('期间净盈亏',f'{net:+,}'),('期间已实现',f'{real:+,}'),('期间浮盈变动',f'{net-real:+,}'),('当前持仓市值',f'{mv:,}')]):
  xx=x+i*w/4
  if i: b+=line(xx,y+8,xx,y+76)
  b+=text(xx+16,y+24,label+(' ⓘ' if i==3 else ''),14,MUTED)+text(xx+16,y+58,value if not loading else '—',28,MUTED if loading else (GREEN if (net if i==0 else real if i==1 else net-real)>=0 else RED) if i<3 else TEXT,600)+text(xx+w/4-16,y+24,cur,12,MUTED,400,'end')
 return b

def chart(x,y,w,h,cur='CNY',end=18420,hover=False,gap=False,empty=False,history=False,week=False):
 title='历史已平仓净盈亏 · 按年' if history else '期间净盈亏 · 按日'
 b=box(x,y,w,h)+text(x+16,y+28,title,14,TEXT,600)+text(x+w-16,y+28,cur+' / 万',12,MUTED,400,'end')
 px=x+66; py=y+60; pw=w-100; ph=h-116
 vals=[round(v*end/12240) for v in [12602,-3240,9870,12240]] if history else [round(v*end/18420) for v in [0,2200,1800,8100,6000,13400,11200,18420]]
 if week: vals=[0,240,480,end]
 vmax=20000 if end>=10000 else 5000; vmin=-5000
 yy=lambda v:py+ph*(vmax-v)/(vmax-vmin)
 for v in ([20000,10000,0,-5000] if vmax==20000 else [5000,2500,0,-5000]):
  b+=line(px,yy(v),px+pw,yy(v),'#526176' if v==0 else '#1E2A3A')+text(px-12,yy(v)+4,f'{v/10000:g}',12,MUTED,400,'end')
 labels=['2023','2024','2025','2026'] if history else ['01-01','03-01','05-01','07-01','09-01','10-15']
 if week: labels=['10-12','10-13','10-14','10-15']
 for i,l in enumerate(labels): b+=text(px+pw*i/(len(labels)-1),py+ph+24,l,12,MUTED,400,'middle')
 if empty: return b+text(x+w/2,y+h/2,'无法合计 · 原币数据仍可查看',14,WARN,500,'middle')
 pts=[(px+pw*i/(len(vals)-1),yy(v)) for i,v in enumerate(vals)]
 groups=[pts[:4],pts[5:]] if gap else [pts]
 for group in groups: b+='<polyline points="'+' '.join(f'{a},{c}' for a,c in group)+f'" fill="none" stroke="{BLUE}" stroke-width="2" stroke-linejoin="round"/>'
 for i,(a,c) in enumerate(pts):
  if gap and i==4: continue
  b+=f'<circle cx="{a}" cy="{c}" r="3" fill="{BLUE}"/>'
 if gap: b+=text(px+pw*.56,py+ph*.9,'行情缺失 · 不插值',12,WARN,400,'middle')
 if hover:
  a,c=pts[-1]; bx=x+w-340; by=y+46
  b+=line(a,py,a,py+ph,BLUE)+box(bx,by,280,156,RAISED,BLUE)+text(bx+16,by+25,'2026-10-15 · '+cur,14,TEXT,600)
  for i,t in enumerate(['当日市值 293,280 · 汇率 10-15','期初 / 所选日浮盈 +6,252 / +12,432','期间已实现 +12,240','浮盈变动 +6,180','期间净盈亏 +18,420']): b+=text(bx+16,by+49+i*20,t,12,BLUE if i==4 else MUTED)
 return b

def table(x,y,w,n=8,page=1,empty_search=False,tooltip=False):
 b=box(x,y,w,520)+text(x+16,y+30,'当前持仓（最新）',18,TEXT,600)+text(x+w-112,y+28,f'{n} 项 · 16:32',12,MUTED,400,'end')+icon(x+w-96,y+6,'search')+icon(x+w-52,y+6,'export',disabled=n==0 or empty_search)
 # columns reserve full 8 fixed slots, all numbers right aligned
 edges=[.25,.33,.43,.54,.65,.80,.94]; xx=[x+16+(w-32)*e for e in edges]
 hy=y+48; b+=box(x+1,hy,w-2,40,'#162233','none',0)
 for label,end in zip(['标的','持仓天数','数量','成本价','最新价','市值（CNY）','当前浮盈（CNY）'],[x+16]+xx[1:]): b+=text(end,hy+25,label,12,MUTED,500,'start' if label=='标的' else 'end')
 start=(page-1)*8; count=0 if empty_search else max(0,min(8,n-start))
 for i in range(8):
  ry=hy+40+i*48; b+=line(x+16,ry+48,x+w-16,ry+48)
  if i>=count: continue
  name,code,days,qty,cost,price,val,pnl=ROWS[(start+i)%8]
  if start: name+=' '+str(start+i+1)
  if len(name)>24: name=name[:23]+'…'
  b+=text(x+16,ry+20,name,14,TEXT,500)+text(x+16,ry+37,code,12,MUTED)
  data=[days+' 天',qty,cost,price,f'{val:,}',f'{pnl:+,}']
  for j,t in enumerate(data): b+=text(xx[j+1],ry+28,t,14,GREEN if j==5 and pnl>=0 else RED if j==5 else TEXT,400,'end')
  b+=icon(x+w-46,ry+6,'eye')
 if not count:
  b+=text(x+w/2,y+250,'没有匹配的持仓' if empty_search else '当前范围没有持仓',18,TEXT,600,'middle')+text(x+w/2,y+280,'清除搜索，查看全部持仓' if empty_search else '切换市场，或在交易库导入交易',14,BLUE,400,'middle')
 fy=y+48+40+384
 b+=text(x+16,fy+30,'0 个结果' if not count else f'{start+1}–{start+count} / {n} 项 · 每页 8 行',12,MUTED)
 b+=text(x+w-16,fy+30,'‹   — / —   ›' if not count else f'‹   {page} / {math.ceil(n/8)}   ›',14,MUTED,400,'end')
 return b

CONTRIB=[('贵州茅台',9210),('微软',6840),('Cerebras Systems',4210),('宁德时代',2380),('招商银行',-1120),('Tesla',-1980),('恒生科技ETF',-2640),('中证500ETF',3520),('英伟达',-4780),('腾讯控股',2780)]
# all ten rows add exactly to 18,420; scenario sizes are synthetic independent sets
CONTRIB[-1]=(CONTRIB[-1][0],18420-sum(v for _,v in CONTRIB[:-1]))
def contribution(x,y,w,n=10,market=False,closed=False,custom=None):
 vals=[('A股',10680),('美股',9240),('港股',-1500)] if market else [(CONTRIB[i%10][0]+(' · '+str(i+1) if i>=10 else ''),round(CONTRIB[i%10][1]/(i//10+1))) for i in range(n)]
 if custom is not None: vals=custom
 if closed: vals=[('A股 · 20 回合',7100),('美股 · 12 回合',6140),('港股 · 6 回合',-1000)]
 vals=sorted(vals,key=lambda p:abs(p[1]),reverse=True)
 h=104+max(3,len(vals))*32
 b=box(x,y,w,h)+text(x+16,y+28,'当前期间贡献',18,TEXT,600)+text(x+w-16,y+28,'今年 · '+str(len(vals))+' 项 · CNY · 净 '+f'{sum(v for _,v in vals):+,}',12,MUTED,400,'end')
 b+=text(x+16,y+58,'证券' if not market else '证券',14,BLUE if not market else MUTED,600)+text(x+86,y+58,'市场',14,BLUE if market else MUTED,600)
 barleft=x+w*.46; barwidth=w*.38; zero=barleft+barwidth/2; maxv=max([abs(v) for _,v in vals] or [1])
 if not vals: b+=text(x+w/2,y+118,'暂无可归因数据 · 不用 0 代替缺失',14,MUTED,400,'middle')
 for i,(name,v) in enumerate(vals):
  yy=y+86+i*32; b+=text(x+16,yy,name,14)+text(x+w*.40,yy,f'{v:+,}',14,GREEN if v>=0 else RED,500,'end')
  width=abs(v)/maxv*barwidth/2
  b+=line(zero,yy-16,zero,yy+10,'#526176')+box(zero if v>=0 else zero-width,yy-11,width,12,GREEN if v>=0 else RED,'none',3)
 b+=text(x+w-16,y+h-14,'已显示全部' if n<=10 or market else f'已展开 {n} 项 · 收起 ↑',12,BLUE,400,'end')
 return b,h

def history_panel(x,y,w):
 b=text(x,y+24,'历史已平仓',18,TEXT,600)+text(x+w-48,y+24,'2026⌄ · 按平仓日归属',14,MUTED,400,'end')+icon(x+w-36,y,'calendar')
 for i,(label,value) in enumerate([('已平仓净盈亏','+12,240'),('已平仓回合','38'),('盈利回合 / 胜率','22/38 · 57.9%'),('费用（已扣除）','640')]):
  xx=x+i*w/4; b+=text(xx+16,y+60,label,14,MUTED)+text(xx+16,y+92,value,24,GREEN if i==0 else TEXT,600)
 b+=chart(x,y+116,w,240,end=12240,history=True)
 return b

def home(w):
 x=96; cw=w-120; h=2030
 b=box(0,0,72,h,'#0D141F','none',0)+text(36,38,'TR',20,BLUE,700,'middle')
 for i,label in enumerate(['首页','交易库','分析','数据','策略']):
  yy=90+i*62; b+=icon(18,yy,'library' if i==1 else 'info',active=i==0)+text(36,yy+51,label,12,MUTED,400,'middle')
  if i==1: b+=box(44,yy-4,22,18,BLUE,'none',8)+text(55,yy+9,'7',12,BG,600,'middle')
 b+=text(x,41,'我的交易室',24,TEXT,600)
 for dx,label,ww in [(238,'实盘⌄',92),(338,'全部账户⌄',128)]: b+=box(x+dx,16,ww,36)+text(x+dx+12,40,label,14)
 b+=icon(x+478,16)+icon(x+522,16,'filter')+text(x+cw,39,'16:32 更新  ·  本地用户',12,MUTED,400,'end')
 b+=line(x,64,x+cw,64)+text(x,108,'当前表现',18,TEXT,600)+text(x+144,107,'今年',14,BLUE,600)+text(x+200,107,'近1月',14,MUTED)+text(x+266,107,'近1周',14,MUTED)+tabs(x+cw-304,82)
 b+=metrics(x,132,cw)+text(x+16,236,'2026-01-01 — 2026-10-15 · Asia/Shanghai',12,MUTED)+chart(x,254,cw,260)
 b+=table(x,538,cw)+history_panel(x,1082,cw)
 cc,_=contribution(x,1462,cw); b+=cc
 b+=text(x,1970,'设计示例 · 当前持仓取最新；期间切换仅更新表现及期间贡献。',12,MUTED)
 save('home-'+str(w),w,h,b,'首页 V2 · '+str(w)+'px 桌面全文画板')

def overlay(kind):
 w=1000; h=500
 net,real,mv=(2840,1240,46852) if kind=='applied' else (18420,12240,MV)
 b=text(24,43,'公共控件',18,TEXT,600)+icon(300,18)+icon(344,18,'filter',active=kind!='search')+text(24,110,'当前表现',18)+metrics(24,128,952,net=net,real=real,mv=mv)
 b+=chart(24,230,952,240,end=net)
 if kind=='search':
  bx=300; by=62; b+=box(bx,by,360,300,RAISED,BLUE)+box(bx+12,by+12,336,36)+text(bx+24,by+36,'搜索名称 / 代码',14,MUTED)+box(bx+312,by+12,36,36)+text(bx+330,by+36,'×',18,MUTED,400,'middle')
  b+=text(bx+16,by+78,'股票   ETF   基金',14,BLUE)+text(bx+16,by+112,'最近使用',12,MUTED)
  for i,t in enumerate(['贵州茅台 · SSE:600519 · 股票','微软 · NASDAQ:MSFT · 股票','恒生科技ETF · SSE:513130 · ETF']): b+=text(bx+16,by+146+i*36,t,14)
  b+=text(bx+16,by+278,'Esc 关闭 · 保持原布局',12,MUTED)
 elif kind=='filter':
  bx=344; by=62; b+=box(bx,by,320,330,RAISED,BLUE)+text(bx+16,by+30,'筛选 · 草稿未应用',14,TEXT,600)
  for i,t in enumerate(['市场  全部⌄','账户  全部账户⌄','类别  ETF ☑','□ 仅有未实现数据','□ 仅待复盘']): b+=text(bx+16,by+68+i*40,t,14)
  b+=box(bx+16,by+276,100,36,'#203B62',BLUE)+text(bx+66,by+300,'应用',14,TEXT,600,'middle')+text(bx+144,by+300,'清除附加条件',14,MUTED)
 else:
  b+=box(370,10,20,18,BLUE,'none',8)+text(380,23,'1',12,BG,600,'middle')+box(400,18,94,36,RAISED)+text(414,41,'ETF  ×',14)
  b+=text(520,41,'已应用 · 全部市场 / 全部账户 / ETF',12,MUTED)
  # replace dependent synthetic values visibly
  b=b.replace('+18,420','+2,840').replace('+12,240','+1,240').replace('+6,180','+1,600')
 save('search-open' if kind=='search' else 'filter-open' if kind=='filter' else 'filter-applied',w,h,b)

def market(kind):
 us=kind=='美股'; cur='USD' if us else 'HKD' if kind=='港股' else 'CNY'; net=3600 if us else -1500 if kind=='港股' else 10680 if kind=='A股' else 18420; real=2400 if us else -1000 if kind=='港股' else 7100 if kind=='A股' else 12240
 b=text(24,42,'公共市场切换 · '+kind,18,TEXT,600)+tabs(672,18,kind)+metrics(24,68,952,cur,net,real,9718 if us else MV)
 b+=chart(24,180,952,250,cur,net)+text(24,476,'当前持仓（最新）  '+('MSFT · NASDAQ   120 股' if us else '8 项 · 多市场'),14)+text(976,476,'市值 '+cur+' '+('9,718' if us else f'{MV:,}'),14,TEXT,400,'end')
 b+=text(24,528,'历史已平仓 · 2026',18)+text(976,528,cur+f' {real:+,}',24,GREEN,600,'end')
 b+=text(24,582,'当前期间贡献',18)+text(24,620,('MSFT +2,600  ·  TSLA +1,000' if us else 'A股 +10,680  ·  美股 +9,240  ·  港股 −1,500'),14)+text(976,620,cur,14,MUTED,400,'end')
 tb=table(24,684,952,2 if us else 8)
 if us:
  for old,new in [('贵州茅台','微软'),('600519 · SSE','MSFT · NASDAQ'),('宁德时代','Tesla'),('300750 · SZSE','TSLA · NASDAQ'),('82,640','7,000'),('55,240','2,718'),('CNY','USD'),('688.67','58.333'),('636.85','6.517'),('55.24','2.718'),('58.342','5.820')]:tb=tb.replace(old,new)
 b+=tb
 b+=text(24,1250,'历史已平仓 · 2026 · '+cur,18)+chart(24,1270,952,260,cur,real,history=True)
 vals=[('MSFT',2600),('TSLA',1000)] if us else [('A股',10680),('美股',9240),('港股',-1500)]
 cb,ch=contribution(24,1560,952,len(vals),market=not us,custom=vals);b+=cb.replace('CNY',cur)
 save('market-us' if us else 'market-all',1000,1560+ch+24,b)

def state(kind):
 w=1000; h=480; b=text(24,42,'当前表现',18,TEXT,600)+text(976,42,'全部 · CNY',14,MUTED,400,'end')
 b+=metrics(24,66,952,loading=kind in ('loading','no-fx'))+chart(24,184,952,268,end=16420 if kind=='partial' else 18420,empty=kind in ('loading','no-fx'),gap=kind=='partial')
 if kind=='loading':
  b= text(24,42,'当前表现',18,TEXT,600)
  for i in range(4): b+=box(24+i*238,66,220,92,'#162233','none')+box(40+i*238,84,92,12,'#283448','none',4)+box(40+i*238,110,156,28,'#283448','none',4)
  b+=box(24,184,952,268)+text(500,320,'正在获取完整数据…',14,MUTED,400,'middle')
 elif kind=='updating':
  b+=text(680,42,'后台更新 · 保留 16:32 数据',12,BLUE)
  b+='''<style>@media(prefers-reduced-motion:reduce){.spin{display:none}.static{display:inline!important}}</style><g transform="translate(658 37)"><path class="spin" d="M0 -7a7 7 0 1 1 -7 7" fill="none" stroke="#6CA8FF" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.2s" repeatCount="indefinite"/></path><circle class="static" r="7" display="none" fill="none" stroke="#6CA8FF"/></g>'''
 elif kind=='no-fx': b+=text(24,168,'无法合计 · 原币 USD 9,718 可用',14,WARN)+icon(616,18,'info')
 elif kind=='partial':
  b=b.replace('+18,420','+16,420').replace('+6,180','+4,180').replace('293,280','273,438')
  b+=text(24,168,'已知小计 · 已覆盖 7/8（不等于完整总额）',12,WARN)
  h=690
  b+=box(24,478,952,180)+text(40,508,'当前持仓 · 1 行行情缺失',18)+text(40,544,'标的',12,MUTED)+text(400,544,'数量 / 成本',12,MUTED)+text(600,544,'最新价',12,MUTED)+text(800,544,'当前浮盈',12,MUTED)
  b+=text(40,580,'Cerebras Systems · CBRS / NASDAQ',14)+text(400,580,'8 / 2,180.25',14)+text(600,580,'待更新 ⓘ',14,WARN)+text(800,580,'—',14)+text(40,628,'缺失行保留数量及成本；市值 / 盈亏不记为 0，详情可异步重试。',12,MUTED)
 else:
  b+=icon(624,18,'info')+text(680,42,'16:32 缓存 · '+('已过期' if kind=='stale' else '更新失败'),12,WARN)
  b+=box(624,62,320,126,RAISED,WARN)+text(640,88,'上次有效数据仍可浏览',14,TEXT,600)+text(640,112,'行情服务暂不可用，未替换当前范围。',12,MUTED)+text(640,150,'↻ 异步重试',14,BLUE)+text(640,174,'详细信息⌄',12,MUTED)
 if kind=='loading':
  h=1030
  b+=box(24,478,952,520)+text(40,510,'当前持仓（最新）',18)+box(25,526,950,40,RAISED,'none')
  for i in range(8):
   yy=576+i*48
   for xx,ww in [(40,190),(340,90),(520,110),(740,140)]: b+=box(xx,yy,ww,16,LINE,'none',4)
  b+=text(40,982,'获取中 · 8 行固定槽位',12,MUTED)
 save('state-'+kind,w,h,b)

def details():
 b=text(24,38,'持仓极端值 · 1280px · 48px 固定行高',18)+table(24,64,1232,5)
 # Dedicated independent fixture for boundary typography, not summed into default KPI.
 for old,new in [('120','−1,250'),('636.85','暂无'),('688.67','待更新'),('82,640','−1,234,567.89'),('+6,218','—'),('1,000','0.000008'),('58.342','0.000012'),('55.24','0.000015'),('55,240','0.00000000012'),('-3,102','+0.000000000024')]: b=b.replace('>'+old+'<','>'+new+'<')
 b=b.replace('fill="'+RED+'" font-weight="400" text-anchor="end">+0.000000000024', 'fill="'+GREEN+'" font-weight="400" text-anchor="end">+0.000000000024')
 b+=text(40,620,'独立边界样本：负数量、极小数、缺成本/报价、大额。完整精度在 focus / hover 明细显示。',14,MUTED)
 import re
 b=re.sub(r'<text[^>]*>\+0\.000000000024</text>',lambda m:m.group(0).replace(RED,GREEN),b)
 b=re.sub(r'<text[^>]*>—</text>',lambda m:m.group(0).replace(GREEN,MUTED),b)
 save('holdings-extreme',1280,660,b)
 b=text(24,38,'当前持仓市值 · 信息详情',18)+metrics(24,64,952)
 b+=box(610,162,366,250,RAISED,BLUE)+text(630,192,'最新估值 · 2026-10-15 16:32',14,TEXT,600)
 for i,t in enumerate(['市值 CNY 293,280 · 当前浮盈 +12,432','行情覆盖 8 / 8 · 非期间浮盈变动','原币 USD 9,718 / HKD 31,226','CNY 195,868.14（示意拆分）','汇率：USD 7.10 / HKD 0.91 · 10-15','来源：设计占位，接入后显示真实提供方']): b+=text(630,224+i*28,t,12,MUTED)
 save('metric-detail',1000,440,b)
 for invalid in (False,True):
  b=text(24,38,'期间范围 · '+('校验失败' if invalid else '编辑草稿'),18)+text(24,80,'已应用：2026-01-01 — 2026-10-15 · 当前持仓仍取最新',14,MUTED)
  b+=box(24,112,360,342,RAISED,BLUE)+text(40,144,'自定义期间 · Asia/Shanghai',14,TEXT,600)
  b+=box(40,160,96,36)+text(88,184,'今年',14,BLUE,400,'middle')+box(144,160,96,36)+text(192,184,'本月',14,BLUE,400,'middle')+box(248,160,120,36)+text(308,184,'本周',14,BLUE,400,'middle')
  for i,(label,value) in enumerate([('开始','2026-10-16' if invalid else '2026-10-01'),('结束','2026-10-15')]):
   y=208+i*68;b+=text(40,y,label,12,MUTED)+box(40,y+10,328,36,RAISED,RED if invalid else LINE)+text(52,y+34,value,14)
  b+=text(40,366,'开始日期不能晚于结束日期' if invalid else '仅点击应用后提交新范围',12,RED if invalid else MUTED)+box(40,388,104,36,RAISED,LINE if invalid else BLUE)+text(92,412,'应用',14,MUTED if invalid else BLUE,500,'middle')+text(176,412,'取消',14,MUTED)
  save('date-invalid' if invalid else 'date-draft',1000,480,b)

def journeys():
 def button(x,y,label,disabled=False):
  return box(x,y,128,36,RAISED,LINE if disabled else BLUE)+text(x+64,y+24,label,14,MUTED if disabled else TEXT,500,'middle')
 for account in (False,True):
  b=text(24,38,'账户草稿 → 应用' if account else '实盘 → 模拟盘单一运行',18)
  for j in range(2):
   x=24+j*488;b+=box(x,70,464,410)+text(x+16,100,'② 已选择，可应用' if j else '① 展开菜单',14,BLUE)
   labels=['全部账户','现金账户 A','现金账户 B'] if account else ['实盘','模拟盘','运行 R2026-10-15 · 策略 A','运行 R2026-10-12 · 策略 B']
   for i,label in enumerate(labels):
    yy=126+i*52;chosen=(i==1 if account else i==2) if j else i==0
    b+=box(x+16,yy,432,44,'#203B62' if chosen else SURF,BLUE if chosen else LINE)+text(x+32,yy+28,('☑ ' if chosen else '□ ')+label,14)
   b+=button(x+16,370,'应用',not j)+button(x+160,370,'取消')+text(x+16,450,'Esc 关闭并返回原触发器；草稿不影响主页面',12,MUTED)
  b+=text(24,524,'③ 已应用：'+('账户 A · 实盘 · 全部市场' if account else '模拟盘 · R2026-10-15 · 单一运行'),18)+metrics(24,550,952,net=2840,real=1240,mv=46852)+chart(24,652,952,230,end=2840)
  save('account-menu' if account else 'scope-menu',1000,910,b)
 b=text(24,38,'证券搜索：结果 → 唯一标的详情',18)+box(24,68,440,350,RAISED,BLUE)+box(40,88,408,36)+text(56,112,'MSFT',14)+box(412,88,36,36)+text(430,112,'×',18,MUTED,400,'middle')
 b+=box(40,144,408,68,'#203B62',BLUE)+text(56,170,'微软 · NASDAQ:MSFT',16)+text(56,195,'股票 · USD · 美国',12,MUTED)+text(40,248,'↑ ↓ 选择结果 · Enter 打开 · Esc 返回',12,MUTED)
 b+=box(512,68,464,350)+text(532,108,'微软',24)+text(532,142,'NASDAQ:MSFT · 股票 · USD',14,MUTED)+text(532,194,'当前范围持仓 120 · 市值 7,000',14)+button(532,240,'查看相关交易')+button(676,240,'关闭 ×')+text(532,324,'关闭后回到页头搜索图标',12,MUTED)
 save('search-selected',1000,450,b)
 b=text(24,38,'筛选草稿 → 取消 / 清除附加条件 / 恢复默认',18)
 for j,(title,scope,token,net) in enumerate([('① 草稿 ETF；已应用股票','美股 / 账户 A','股票 ×',3600),('② 取消；保留旧范围','美股 / 账户 A','股票 ×',3600),('③ 清除附加类别','美股 / 账户 A','',3800),('④ 恢复默认','实盘 / 全部账户 / 全部市场','',18420)]):
  y=70+j*210;b+=box(24,y,952,192)+text(40,y+30,title,16,BLUE)+text(40,y+62,scope,14)
  if token:b+=box(330,y+42,96,28,RAISED,BLUE)+text(342,y+62,token,12)
  b+=text(40,y+108,'期间净盈亏',12,MUTED)+text(40,y+145,f'{net:+,}',28,GREEN,600)
  if j==0:b+=box(550,y+40,400,134,RAISED,BLUE)+text(566,y+66,'草稿：☑ ETF   □ 股票',14)+button(566,y+86,'应用')+button(710,y+86,'取消')
  elif j==1:b+=button(560,y+100,'清除附加条件')
  elif j==2:b+=button(560,y+100,'恢复默认')
  else:b+=text(550,y+128,'无 token · 筛选计数归零 · 失败恢复旧范围',12,MUTED)
 save('filter-reset',1000,930,b)
 b=text(24,38,'持仓局部搜索 → 无匹配 → 清除恢复',18)
 for j in range(3):
  y=70+j*590;b+=text(24,y+20,['① 微软 · 第 1 页 / 1 项','② 无匹配 · 第 0 页 / 0 项','③ 清除搜索 · 第 1 页 / 8 项'][j],16,BLUE)
  tb=table(24,y+40,952,1 if j==0 else 8,empty_search=j==1)
  if j==0:
   for old,new in [('贵州茅台','微软'),('600519 · SSE','MSFT · NASDAQ'),('182 天','12 天'),('120','60'),('636.85','503.633'),('688.67','598.033'),('82,640','35,882'),('+6,218','+5,664')]:tb=tb.replace('>'+old+'<','>'+new+'<')
  if j==1:tb=tb.replace('8 项 · 16:32','总持仓 8 / 匹配 0')
  b+=tb
  if j<2:b+=box(670,y+86,280,94,RAISED,BLUE)+box(686,y+102,248,36)+text(698,y+126,'微软' if j==0 else '不存在的标的',14)+text(686,y+162,'清除搜索 ×    Esc 返回搜索按钮',12,BLUE)
  if j==1:b+=box(600,y+200,350,80,RAISED)+text(616,y+228,'CSV 导出不可用',14)+text(616,y+256,'当前筛选结果为 0；清除搜索后可导出',12,MUTED)
 save('local-search',1000,1860,b)
 b=text(24,38,'首次请求失败 · 没有可用缓存',18)+metrics(24,64,952,loading=True)+chart(24,168,952,250,empty=True)
 b=b.replace('无法合计 · 原币数据仍可查看','暂无可用数据 · 请求失败')
 tb=table(24,442,952,0).replace('当前范围没有持仓','持仓数据未能加载').replace('切换市场，或在交易库导入交易','查看错误原因并重试').replace('0 个结果','数量尚不可用').replace('0 项 · 16:32','数量未知 · 未更新')
 b+=tb+box(600,484,350,144,RAISED,WARN)+text(616,514,'行情请求超时 · 尚无缓存',14,WARN)+text(616,542,'未展示数值，空槽不是 0 持仓结论',12,MUTED)+button(616,566,'异步重试')
 save('cold-error',1000,990,b)
 b=text(24,38,'异步重试：失败 → 进行中 → 成功 / 再失败',18)
 for j,(title,label) in enumerate([('① 缓存 16:32 · 更新失败','异步重试'),('② 缓存 16:32 · 正在重试','重试中…'),('③ 已更新 16:35 · 覆盖 8/8','已更新'),('④ 再次失败 · 仍保留 16:32 缓存','再次重试')]):
  y=70+j*240;b+=box(24,y,952,220)+text(40,y+30,title,16,BLUE if j==2 else WARN)+metrics(24,y+42,952)
  if j!=2:b+=box(560,y+136,396,68,RAISED,WARN)+text(576,y+158,'行情服务超时' if j!=1 else '请求进行中，禁止重复提交',12,MUTED)+button(808,y+156,label,j==1)
  else:b+=text(40,y+178,'成功替换当前范围数据 · 关闭错误提示 · 键盘焦点返回状态入口',14,MUTED)
 save('retry-result',1000,1060,b)

def main():
 for w in (1440,1280): home(w)
 for kind in ('全部','美股'): market(kind)
 for k in ('search','filter','applied'): overlay(k)
 for k in ('hover','gap'): save('chart-'+k,1000,420,chart(24,24,952,372,hover=k=='hover',gap=k=='gap'))
 for n in (0,5,10,20,50): save('holdings-'+str(n),1280,568,table(24,24,1232,n))
 save('holdings-last-page',1280,568,table(24,24,1232,50,7))
 save('holdings-no-match',1280,568,table(24,24,1232,8,empty_search=True))
 for n in (0,5,10,20,50):
  b,h=contribution(24,24,952,n); save('contribution-'+str(n),1000,h+48,b)
 b,h=contribution(24,24,952,3,market=True); save('contribution-market',1000,h+48,b)
 for k in ('loading','updating','stale','no-fx','partial','error'):state(k)
 save('history',1280,408,history_panel(24,24,1232))
 b,h=contribution(24,24,952,3,market=True,closed=True)
 b=b.replace('当前期间贡献','历史已平仓贡献').replace('今年 · 3 项','2026 · 38 回合')
 save('contribution-history',1000,h+48,b)
 details()
 journeys()

 for name,label,net,real,mv,cur in [('market-a','A股',10680,7100,195868,'CNY'),('market-hk','港股',-1500,-1000,31226,'HKD'),('period-month','近1月',2840,1240,MV,'CNY'),('period-week','近1周',840,240,MV,'CNY')]:
  b=text(24,38,label+' · 独立范围示例',18)+metrics(24,64,952,cur,net,real,mv)+chart(24,176,952,260,cur,net,week=name=='period-week')
  b+=text(24,474,'当前持仓取最新 · '+('2026-10-01 — 10-15' if name=='period-month' else '2026-10-12 — 10-15' if name=='period-week' else '今年至今'),14,MUTED)
  if name=='period-month':
   dates=['10-01','10-04','10-07','10-10','10-13','10-15'] if name=='period-month' else ['10-12','10-12','10-13','10-14','10-14','10-15']
   for old,new in zip(['01-01','03-01','05-01','07-01','09-01','10-15'],dates): b=b.replace('>'+old+'<','>'+new+'<')
  height=510
  if name.startswith('market-'):
   tb=table(24,508,952,5 if name=='market-a' else 1)
   if name=='market-a':
    tb=tb.replace('Cerebras Systems Inc. —…','中证红利ETF').replace('CBRS · NASDAQ','515080 · SSE').replace('40,520','10,036').replace('84.417','20.908').replace('80.233','16.725')
   else:
    for old,new in [('贵州茅台','腾讯控股'),('600519 · SSE','00700 · HKEX'),('82,640','31,226'),('688.67','260.217'),('636.85','208.40')]:tb=tb.replace(old,new)
   b+=tb
   b=b.replace('市值（CNY）','市值（'+cur+'）').replace('当前浮盈（CNY）','当前浮盈（'+cur+'）')
   b+=text(24,1070,'历史已平仓 · 2026 · '+cur+f' {real:+,}',18)+chart(24,1094,952,240,cur,real,history=True)
   values=[('主要证券',7100),('其余盈利',4580),('其余亏损',-1000)] if name=='market-a' else [('主要证券',1000),('其余盈利',500),('其余亏损',-3000)]
   cb,ch=contribution(24,1360,952,3,custom=values)
   cb=cb.replace('当前期间贡献','当前期间贡献 · '+label).replace('CNY',cur)
   b+=cb; height=1360+ch+24
  save(name,1000,height,b)
 b=text(24,38,'查看持仓详情 · 独立浮层，不展开表格行',18)+box(24,64,952,390)
 for i,t in enumerate(['贵州茅台 · SSE:600519 · 股票','数量 120 · 持仓 182 天','成本价 636.85 · 最新价 688.67 CNY','当前市值 82,640 · 当前浮盈 +6,218 CNY','行情 16:32 · 估值完整','查看相关交易 →   /   关闭 ×（Esc 返回原行查看按钮）']):b+=text(48,108+i*56,t,14,BLUE if i==5 else TEXT)
 save('holding-detail',1000,480,b)
 extra=Path(__file__).with_name('build-detail-frames.py')
 if extra.exists(): runpy.run_path(str(extra),run_name='__main__')
if __name__=='__main__':main()
