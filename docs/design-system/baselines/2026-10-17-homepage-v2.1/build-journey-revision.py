#!/usr/bin/env python3
"""V2.1 local, measurable storyboards. No miniaturized whole-page placeholders."""
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'images'
BG='#0B1019'; SUR='#111A26'; RAISED='#162233'; LINE='#283448'; TXT='#E6EDF7'; MUT='#A8B6CB'; BLUE='#6CA8FF'; GREEN='#53D7A0'; RED='#FF8592'; AMBER='#FFC66D'; FOCUS='#A9C8FF'
def t(x,y,s,size=14,color=TXT,weight=400): return f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-weight="{weight}">{escape(str(s))}</text>'
def r(x,y,w,h,fill=SUR,stroke=LINE,rad=8): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rad}" fill="{fill}" stroke="{stroke}"/>'
def ln(x,y,x2,y2,c=LINE):return f'<path d="M{x} {y}L{x2} {y2}" fill="none" stroke="{c}"/>'
def btn(x,y,label,w=140,focus=False,disabled=False):
 s=r(x,y,w,36,RAISED,BLUE if not disabled else LINE,6)+t(x+12,y+23,label,13,MUT if disabled else TXT)
 if focus:s+=f'<rect x="{x-3}" y="{y-3}" width="{w+6}" height="42" rx="8" fill="none" stroke="{FOCUS}" stroke-width="2"/>'
 return s
def inputbox(x,y,value,w=360): return r(x,y,w,36,BG)+t(x+12,y+23,value,14)+btn(x+w-36,y,'×',36)
def note(x,y,lines,color=MUT):return ''.join(t(x,y+i*23,a,13,color) for i,a in enumerate(lines))
def card(x,y,title,body,w=690,h=650):return r(x,y,w,h)+t(x+24,y+36,title,18,BLUE,600)+f'<g transform="translate({x+24},{y+64})">{body}</g>'
def save(name,title,frames,h=650,cols=2):
 w=cols*738+24;rows=(len(frames)+cols-1)//cols;hh=118+rows*(h+24)
 b=r(0,0,w,hh,BG,BG,0)+t(32,38,title,24,TXT,600)+t(32,68,'局部设计分镜 · 1 SVG 单位 = 1px；整页布局沿用主稿；注释位于控件之外。',14,MUT)
 for i,(label,body) in enumerate(frames):b+=card(24+(i%cols)*738,96+(i//cols)*(h+24),label,body,h=h)
 b+=t(32,hh-12,'静态设计合同；请求、焦点、返回与持久化仍需后续产品实现验收。',12,MUT)
 (OUT/f'journey-{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{hh}" viewBox="0 0 {w} {hh}" role="img" aria-label="{escape(title)}"><g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" style="font-variant-numeric:tabular-nums">{b}</g></svg>')
def chart(y=130,gap=False,variant=False):
 s=r(0,y,640,190)+t(16,y+26,'期间净盈亏（按日） · CNY',14)+ln(40,y+145,610,y+145)
 pts=[(40,120),(120,102),(200,112),(280,78),(360,85),(440,61),(520,68),(600,42)]
 if variant:pts=[(40,130),(120,122),(200,115),(280,108),(360,80),(440,83),(520,65),(600,42)]
 for i in range(len(pts)-1):
  if gap and i in (3,4):continue
  a,b=pts[i],pts[i+1];s+=f'<path d="M{a[0]} {a[1]+y}L{b[0]} {b[1]+y}" fill="none" stroke="{BLUE}" stroke-width="2"/>'
 for i,(x,z) in enumerate(pts):
  if gap and i==4:continue
  s+=f'<circle cx="{x}" cy="{z+y}" r="3" fill="{BLUE}"/>'
 s+=t(40,y+174,'10-01',12,MUT)+t(552,y+174,'10-15',12,MUT)
 return s
def kpis(y=0,values=None,currency='CNY'):
 values=values or ['+18,420','+7,440','+10,980','293,280']
 s=''
 for i,(lab,val) in enumerate(zip(['期间净盈亏','期间已实现','期间浮盈变动','最新市值 '+currency],values)):
  x=i*162;s+=r(x,y,154,88)+t(x+10,y+24,lab,12,MUT)+t(x+10,y+61,val,22,GREEN if val.startswith('+') else TXT,600)
 return s
# F02 real row geometry and displaced footer
frames=[]
for state,count,focusrow in [('10→20 前 · 10行',10,None),('10→20 中 · 可见15行',15,None),('10→20 后 / 20→30 前',20,11),('20→30 中 · 可见25行',25,None),('20→30 后 · 30行',30,21),('收起前 · 焦点先移第10行',30,10),('收起中 / 反向从当前高度继续',15,10),('收起完成 · 10行',10,10)]:
 b=t(0,22,'当前期间贡献 · 证券',18,TXT,600)+btn(450,0,'证券 / 市场',184)
 b+=t(0,56,'2026-01-01—10-15 · CNY · 几何示例序列，非首页金额样本',12,MUT)
 for i in range(count):
  y=76+i*32;val=2840-i*91;name=(['AAPL','MSFT','腾讯控股','中证红利ETF','SPY'][i] if i<5 else f'样例证券 {i+1:02d}')
  b+=ln(0,y+32,640,y+32)+t(8,y+22,f'{i+1:02d}  {name}',13)+r(200,y+10,210-i*6,12,BLUE,BLUE,2)+t(470,y+22,f'+{val:,}.00',13,GREEN)
  if focusrow==i+1:b+=f'<rect x="2" y="{y+2}" width="636" height="28" rx="3" fill="none" stroke="{FOCUS}" stroke-width="2"/>'
 end=76+count*32
 b+=btn(0,end+12,'再显示10行' if count<50 else '已全部显示',150)+btn(170,end+12,'收起到10行',150,disabled=count==10)+t(350,end+36,f'{count}/50 项',13,MUT)
 b+=r(0,end+66,640,48)+t(16,end+96,'后续内容随列表下移；已有行的视口位置不变',13)
 b+=note(0,1180,[f'局部坐标：首行y=76；末端按钮y={end+12}；scrollTop=S（不补偿）。',f'可见行={count}；过渡帧不代表已提交条数；展开结束焦点=首新增行。','行高32px；不补偿 scrollTop；按钮随列表末尾移动。','键盘：展开→第11/21行；收起前→第10行；鼠标不强移焦点。','200ms高度过渡；反向从当前高度继续；同向重复不追加。','reduced-motion：0ms。收起后按钮不可见才 nearest 滚入。'])
 frames.append((state,b))
save('contribution','F02 · 贡献列表：真实行、滚动锚点与反向动画',frames,h=1440)
# F03 routes and handoff
base='/trades?queue=pending-review&market=us&scope=live&accounts=all'
frames=[]
for state in ['首页入口','交易库直开 / 刷新','非法市场参数','返回首页']:
 b=t(0,24,'实盘 · 全部账户 · '+('全部市场' if state=='非法市场参数' else '美股'),18,TXT,600)
 if state=='首页入口':
  b+=r(0,55,640,150)+t(20,86,'历史已平仓 · 2026 · USD',16)+t(20,120,'38回合 · 待复盘 3',14)+btn(20,145,'前往交易库复盘',180)
  b+=note(0,245,['点击传入完整URL：',base[:49],base[49:],'日期入口另用 /trades?date=2026-10-14','&market=us&scope=live&accounts=all'])
 elif state=='交易库直开 / 刷新':
  b+=t(0,68,'交易库',24,TXT,600)+btn(0,95,'待复盘 3',130)+btn(145,95,'美股 · USD',140)+btn(300,95,'实盘',110)
  for i,name in enumerate(['MSFT · NASDAQ','AAPL · NASDAQ','SPY · ARCA']):b+=r(0,155+i*52,640,48)+t(16,185+i*52,name)+btn(500,161+i*52,'去复盘',120)
  b+=note(0,350,['URL 是直开/刷新权威；读取同一市场、账户和队列。','不从上一页面内存推测 market。空队列显示0项而非旧数量。'])
 elif state=='非法市场参数':
  b+=r(0,60,640,80,RAISED)+note(16,88,['无法识别 market=xyz；已改为全部市场。','其余合法 scope、accounts、date / queue 保留。'],AMBER)+btn(0,170,'全部 · CNY',150)
  b+=note(0,240,['URL规范化 market=all；未知scope回live并解释。','非法日期忽略该过滤条件并提示，不能查询错误日期。'])
 else:
  b+=t(0,70,'首页 · 今年至今 · 美股 USD',18)+r(0,95,640,150)+t(16,125,'历史已平仓 · 2026',16)+btn(16,155,'前往交易库复盘',180,focus=True)
  b+=note(0,290,['浏览器返回：恢复原期间、市场、账户、筛选与滚动位置。','焦点回来源入口；入口移除则回历史区标题。','复制链接不携带首页滚动状态；直开回首页使用首页默认值。'])
 frames.append((state,b))
save('library','F03 · 交易库交接：URL身份、刷新与返回',frames,h=600)
# F04 committed identity and race
frames=[]
for state in ['A 已提交','B 请求中','C 请求中 / B迟到','C 失败','重试 C 成功','首次无缓存失败']:
 success=state=='重试 C 成功';cold=state=='首次无缓存失败'
 b=t(0,22,'已应用：'+('模拟 R2 · 港股 · HKD' if success else '实盘 · 全部账户 · 全部市场 · CNY'),15,TXT,600)
 if state=='B 请求中':b+=btn(0,42,'候选B：美股 · 加载中',280)
 elif state in ['C 请求中 / B迟到','C 失败']:b+=btn(0,42,'候选C：模拟R2 / 港股 · 未应用',360)
 else:b+=t(0,65,'当前数据范围与标题、单位一致',13,MUT)
 if cold:
  for i in range(4):b+=r(i*162,94,154,88)+r(i*162+12,118,100,16,LINE)+r(i*162+12,148,122,18,LINE)
  b+=r(0,210,640,190)+t(20,260,'没有同范围缓存 · 数据不可用',18,MUT)+btn(20,295,'重试当前范围',180)
  b+=note(0,435,['首载固定骨架→失败；不显示0或上一scope的数据。','15秒超时，提供手动重试；不无限自动请求。'])
 else:
  b+=kpis(94,['+9,800','+7,000','+2,800','165,200'] if success else None,'HKD' if success else 'CNY')
  b+=chart(205,variant=success).replace('CNY','HKD' if success else 'CNY')
  b+=r(0,410,640,60)+t(12,435,'当前持仓（最新） · '+('港股 HKD · 4项' if success else '全部 CNY · 8项'),14)+t(12,457,'贡献与表格同组提交；最新持仓不变成历史日期',12,MUT)
  notes={'A 已提交':['generation 40，committed=A。','净盈亏 18,420 = 7,440 + 10,980。'], 'B 请求中':['generation 41，candidate=B；旧A整组保持可读。','B控件标加载中，不把B市场标题套在A金额上。'], 'C 请求中 / B迟到':['generation 42，candidate=C；取消B。','迟到B(gen41)被丢弃；仍显示A完整数据。'], 'C 失败':['C未应用；保留A的标题、金额、曲线、贡献、表格。','重试C发新generation43，不复用失败请求。'], '重试 C 成功':['generation43 且 scopeKey=C 匹配，整组提交C。','净盈亏 9,800 = 7,000 + 2,800；单位同时变HKD。']}[state]
  b+=note(0,505,notes,AMBER if state=='C 失败' else MUT)
  if state=='C 失败':b+=btn(0,560,'重试 C',150)
 frames.append((state,b))
save('scope','F04 · 范围A→B→C：保留旧值、迟到响应、失败恢复',frames,h=690)
# F05 gaps
frames=[]
for state in ['缺口入口','原因打开','重试仍失败','关闭返回']:
 b=chart(0,gap=True)+btn(320,105,'10-12 查看原因',180,focus=state in ['缺口入口','关闭返回'])
 if state in ['原因打开','重试仍失败']:
  b+=r(120,225,450,210,RAISED,BLUE)+t(140,257,'10-12 · 无可靠行情 / 汇率',18)+btn(518,237,'×',36)+note(140,294,['覆盖 7/8；此点不参与可用估值。','缺失不是0；曲线不插值、不自动连线。'])+btn(140,365,'重试行情',150,focus=state=='原因打开')
  if state=='重试仍失败':b+=t(315,389,'仍不可用 · 保留缺口',13,AMBER)
 else:b+=note(0,245,['Tab到“查看原因”，Enter打开；焦点环包围真实入口。','Esc/×关闭后焦点返回同一缺口；外点关闭原因浮层。'])
 b+=note(0,470,['首个原因控件可获焦；关闭不改变已应用期间和当前持仓。','缺口恢复仅在该范围新请求成功后绘制可靠点。'])
 frames.append((state,b))
save('gap','F05 · 缺口原因：进入、失败与焦点返回',frames,h=620)
# F06 year, zero queue distinct, details
frames=[]
for state in ['2026 年份菜单','2024 空年','2026 零待复盘','市场同步为美股','历史贡献详情','关闭详情返回']:
 empty=state=='2024 空年';us=state=='市场同步为美股';detail=state=='历史贡献详情'
 b=t(0,20,'历史已平仓 · '+('美股 USD' if us else '全部市场 CNY'),18,TXT,600)+btn(440,0,'2024 ⌄' if empty else '2026 ⌄',180)
 if state=='2026 年份菜单':
  b+=r(440,42,180,116,RAISED,BLUE)+t(455,69,'2026 ✓')+t(455,103,'2025')+t(455,137,'2024')
 if empty:b+=r(0,180,640,160)+t(22,225,'该年暂无已平仓回合',18,MUT)+t(22,260,'回合数 0；胜率 —，不显示 0%',14,MUT)
 else:
  for i,(a,z) in enumerate([('净盈亏','+12,240'),('回合数','38'),('胜率','22/38 · 57.9%'),('费用','640')]):b+=r(i*162,180,154,88)+t(i*162+10,205,a,12,MUT)+t(i*162+10,240,z,16,GREEN if i==0 else TXT)
  b+=btn(0,292,'查看历史贡献',180,focus=state=='关闭详情返回')+t(220,316,'暂无待复盘' if state=='2026 零待复盘' else '待复盘 3',14,MUT)
 if detail:
  b+=r(40,350,560,190,RAISED,BLUE)+t(60,380,'2026 历史已平仓贡献 · CNY',18)+btn(542,362,'×',36)
  for i,(name,val) in enumerate([('MSFT','+8,240'),('AAPL','+4,000')]):b+=t(60,422+i*40,name)+r(180,410+i*40,160-i*70,12,BLUE,BLUE,2)+t(420,422+i*40,val,14,GREEN)
 else:b+=note(0,390,['年份仅作用历史区；当前持仓保持最新。','零待复盘 ≠ 零平仓：保留38回合与盈亏，只清待办数量。','市场由公共tabs确定，同步历史币种；没有第二套市场筛选。'])
 b+=note(0,570,['贡献仅按所选年份平仓净额；Esc/×关闭，焦点回原入口。','年份菜单：上下键移动、Enter选择、Esc取消返回。'])
 frames.append((state,b))
save('history','F06 · 历史年份、空年、零待复盘与贡献返回',frames,h=700)
# F08 actual inputs, empty and modal exit
frames=[]
for state in ['搜索与清除入口','清除后','无匹配','选择候选 / 详情打开','详情关闭 / 返回','长名 tooltip']:
 b=t(0,22,'当前范围：实盘 · 全部账户 · 全部市场',15,MUT)+btn(584,0,'⌕',36)
 if state in ['搜索与清除入口','清除后','无匹配']:
  val={'搜索与清除入口':'微软','清除后':'搜索名称 / 代码 / 交易所','无匹配':'不存在的标的'}[state]
  b+=r(260,52,360,250,RAISED,BLUE)+inputbox(272,64,val,336)
  if state=='搜索与清除入口':b+=btn(272,124,'微软 · MSFT · NASDAQ · 股票',336,focus=True)
  elif state=='清除后':b+=t(278,142,'输入名称或代码搜索',14,MUT)+t(278,174,'query已清空；全局范围保留',13,MUT)
  else:b+=t(278,142,'没有匹配结果',16,MUT)+btn(278,172,'清除搜索',160)
 else:
  b+=t(0,76,'当前持仓（最新）',18,TXT,600)+r(0,100,640,96)+t(12,130,'微软 · MSFT / NASDAQ',14)+t(12,168,'+8,200 CNY',14,GREEN)+btn(580,120,'↗',36,focus=state=='详情关闭 / 返回')
  if state=='选择候选 / 详情打开':
   b+=r(60,235,540,230,RAISED,BLUE)+t(82,270,'微软 · MSFT · NASDAQ · 股票',18)+btn(546,247,'×',36,focus=True)+note(82,310,['当前范围内标的详情 · 原币 USD','只读当前持仓与交易记录；不修改全局scope。','Tab / Shift+Tab 限制在对话框；Esc / ×关闭。','外点不关闭。'])
  elif state=='长名 tooltip':b+=r(0,215,590,82,RAISED,BLUE)+note(14,244,['微软公司 · Microsoft Corporation','MSFT · NASDAQ · 股票；名称完整显示，不改变行高。'])
  else:b+=note(0,240,['对话框已移除；焦点回原行36px查看按钮。','若来源是页头搜索，回搜索入口；来源行失效则回表格标题。'])
 b+=note(0,520,['实体搜索选中→详情；局部持仓搜索仅筛表，不提交全局scope。','tooltip：hover300ms / focus立即；leave100ms；Esc隐藏到重入。','搜索Popover非模态：Esc/外点关闭；清除后焦点留输入框。'])
 frames.append((state,b))
save('search','F08 · 搜索、清除、详情关闭和长名提示',frames,h=680)
# F09 actual date popover and unobscured selected-day formula
frames=[]
for state in ['快捷范围草稿','应用请求中','10-14 非末端图点','应用失败 / 重试','重试应用成功','取消草稿返回']:
 b=kpis(0,['+11,200','+7,440','+3,760','293,280'] if state=='重试应用成功' else None)
 if state=='快捷范围草稿':
  b+=r(80,130,440,290,RAISED,BLUE)+t(100,163,'编辑期间 · 尚未应用',18)+btn(100,185,'今年',110)+btn(220,185,'本月',110)+btn(340,185,'本周',110)
  b+=inputbox(100,240,'2026-10-01',180)+inputbox(300,240,'2026-10-14',180)+btn(100,315,'取消',120)+btn(340,315,'应用',140)
  b+=note(0,465,['今年/本月/本周只写草稿；起始>结束时字段报错、禁用应用。','取消/Esc回旧范围10-01—10-15；最新市值293,280不动。'])
 elif state in ['重试应用成功','取消草稿返回']:
  b+=chart(125,variant=state=='重试应用成功')
  if state=='重试应用成功':
   b=b.replace('10-15','10-14')
   b+=note(0,380,['已应用10-01—10-14；前三KPI与曲线、贡献同时提交。','最新市值仍293,280；持仓不变成10-14的288,420。','generation与期间key匹配；迟到旧响应不得覆盖。'])
  else:b+=btn(0,350,'10-01—10-15 · 编辑期间',280,focus=True)+note(0,430,['草稿浮层已关闭；焦点回期间触发器。','当前期间、KPI、曲线与贡献保持已提交版本。'])
 elif state=='10-14 非末端图点':
  b+=chart(125)+r(70,345,510,235,RAISED,BLUE)+t(90,376,'所选日 2026-10-14（非期末）',18)
  b+=note(90,410,['当日持仓市值 288,420 CNY；最新市值仍293,280。','截至该日已实现 7,440；该日浮盈 10,012。','期初浮盈 6,252 → 浮盈变动 3,760。','截至该日净盈亏 = 7,440 + 10,012 − 6,252 = 11,200。'])
  b+=t(0,620,'此帧为点位详情，非改写整个期间；上方KPI仍为10-15期末。',13,MUT)
 else:
  b+=chart(125)+r(0,350,640,110,RAISED,BLUE)+t(16,380,'候选期间 10-01—10-14 · '+('更新中' if state=='应用请求中' else '未应用'),16)
  b+=t(16,415,'已提交仍为10-01—10-15；保留旧KPI/曲线/贡献。',14,MUT)
  if state=='应用失败 / 重试':b+=btn(0,490,'重试候选期间',180)+note(0,555,['15秒超时；重试用新generation，取消后仍保留旧期间。','成功才更新前三KPI为11,200 / 7,440 / 3,760及曲线/贡献。'])
  else:b+=note(0,510,['最新generation和期间key匹配后，前三KPI、曲线、贡献原子更新。','成功→11,200 / 7,440 / 3,760；最新持仓市值仍293,280。','失败→旧期间整组保留；不改变当前持仓查询日期。'])
 frames.append((state,b))
save('date','F09 · 日期草稿、应用、失败与非期末图点',frames,h=740)
print('7 V2.1 journey boards rebuilt')
