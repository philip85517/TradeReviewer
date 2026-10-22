from pathlib import Path
from html import escape

OUT=Path(__file__).parent/'images'; OUT.mkdir(parents=True,exist_ok=True)
BG='#0B1019'; SURF='#111A26'; SURF2='#172235'; LINE='#283448'; TEXT='#E6EDF7'; MUTED='#A8B6CB'; BLUE='#6CA8FF'; GREEN='#53D7A0'; RED='#FF8592'; AMBER='#FFC66D'
FONT="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
def e(v): return escape(str(v))
def tx(x,y,s,size=12,fill=TEXT,weight=400,anchor='start',family=FONT,extra=''): return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}px" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{e(s)}</text>'
def rect(x,y,w,h,fill=SURF,stroke=LINE,r=7,extra=''): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" {extra}/>'
def ln(x1,y1,x2,y2,c=LINE,w=1,dash=''): return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="{w}"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>'
def svg(w,h,b,title): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{e(title)}"><rect width="{w}" height="{h}" fill="{BG}"/>{b}</svg>'
def icon(kind,x,y,c=BLUE):
    if kind=='search': return f'<circle cx="{x+8}" cy="{y+8}" r="5" fill="none" stroke="{c}" stroke-width="1.7"/><path d="M{x+12},{y+12}l5,5" stroke="{c}" stroke-width="1.7" stroke-linecap="round"/>'
    if kind=='filter': return f'<path d="M{x+2},{y+3}h16l-6,7v6l-4,2v-8z" fill="none" stroke="{c}" stroke-width="1.5"/>'
    if kind=='eye': return f'<path d="M{x+2},{y+9}q8,-8 16,0q-8,8-16,0z" fill="none" stroke="{c}" stroke-width="1.5"/><circle cx="{x+10}" cy="{y+9}" r="2.5" fill="none" stroke="{c}"/>'
    if kind=='download': return f'<path d="M{x+10},{y+3}v10m-4,-4 4,4 4,-4M{x+4},{y+17}h12" fill="none" stroke="{c}" stroke-width="1.6" stroke-linecap="round"/>'
    if kind=='refresh': return f'<path d="M{x+17},{y+8}a7,7 0 1 0 0,5" fill="none" stroke="{c}" stroke-width="1.6"/><path d="M{x+17},{y+3}v5h-5" fill="none" stroke="{c}" stroke-width="1.6"/>'
    if kind=='calendar': return f'<rect x="{x+3}" y="{y+4}" width="14" height="13" rx="2" fill="none" stroke="{c}" stroke-width="1.5"/><path d="M{x+3}, {y+8}h14M{x+7},{y+2}v4M{x+13},{y+2}v4" stroke="{c}"/>'
    if kind=='bell': return f'<path d="M{x+4},{y+14}h12l-2,-3v-4a4,4 0 0 0-8,0v4zM{x+9},{y+17}h2" fill="none" stroke="{c}" stroke-width="1.5"/>'
    return f'<circle cx="{x+10}" cy="{y+10}" r="7" fill="none" stroke="{c}" stroke-width="1.5"/>'

def controls():
    w,h=1180,1510;b=tx(28,38,'原子组件 · 11 类可复用样例',24,TEXT,600)+tx(28,66,'每行：默认 / 交互焦点 / 数据状态；完整适用性与键盘路径见正文矩阵',14,MUTED)
    names=['IconButton','SegmentedTabs','Select','Popover','Token','Metric','StatusBadge','DataTable','ChartTooltip','EmptyState','RetryAction']
    for i,name in enumerate(names):
        y=94+i*126;b+=tx(28,y+22,name,14,TEXT,600)
        for j in range(3):
            x=208+j*314;b+=rect(x,y,294,112)+tx(x+12,y+20,['默认','focus / selected','数据状态'][j],12,MUTED)
            xx=x+12;yy=y+34
            if name=='IconButton':
                b+=rect(xx,yy,36,36,SURF,"#A9C8FF" if j==1 else LINE,6,'stroke-width="2"' if j==1 else '')
                b+=icon('refresh' if j==2 else 'eye',xx+8,yy+8,BLUE)
                b+=tx(xx+52,yy+22,'更新中 · 状态环' if j==2 else '查看持仓详情',12)
            elif name=='SegmentedTabs':
                for k,t in enumerate(['全部','A股','美股']):b+=rect(xx+k*86,yy,80,36,'#243B5C' if k==(0 if j==2 else j) else BG,BLUE if k==(0 if j==2 else j) else LINE,6)+tx(xx+k*86+40,yy+23,t,14,TEXT,500,'middle')
                if j==2:b+=tx(xx,yy+58,'失败：回滚旧选中“全部”',12,AMBER)
            elif name=='Select':
                b+=rect(xx,yy,240,36,SURF,"#A9C8FF" if j==1 else LINE,6,'stroke-width="2"' if j==1 else '')+tx(xx+12,yy+23,'暂无可选账户' if j==2 else '全部账户                 ⌄',14,MUTED if j==2 else TEXT)
            elif name=='Popover':
                b+=rect(xx,yy,260,64,SURF2,"#A9C8FF" if j==1 else LINE,6,'stroke-width="2"' if j==1 else '')+tx(xx+12,yy+24,'无匹配结果 · 清除搜索' if j==2 else '搜索标的名称 / 代码',14)+tx(xx+12,yy+48,'Esc 返回触发器',12,MUTED)
            elif name=='Token':
                b+=rect(xx,yy,104,24,SURF2,"#A9C8FF" if j==1 else LINE,6,'stroke-width="2"' if j==1 else '')+tx(xx+10,yy+17,'ETF      ×',12)
                if j==2:b+=tx(xx,yy+55,'移除失败 · 已恢复 ETF',12,AMBER)
            elif name=='Metric':
                b+=tx(xx,yy+15,'期间净盈亏 · CNY',14,MUTED)
                b+=rect(xx,yy+30,160,28,LINE,'none',4) if j==2 else tx(xx,yy+55,'+18,420',28,GREEN,600)
                if j==1:b+=tx(xx+170,yy+52,'ⓘ 口径',12,BLUE)
            elif name=='StatusBadge':
                b+=icon('refresh',xx,yy,BLUE if j<2 else AMBER)+tx(xx+30,yy+16,['已更新 16:32','更新中','过期 · 原因 ⓘ'][j],12,AMBER if j==2 else TEXT)
            elif name=='DataTable':
                b+=rect(xx,yy,264,24,SURF2,LINE,0)+tx(xx+8,yy+17,'标的                         市值 ↓',12,MUTED)
                b+=tx(xx+8,yy+48,'没有匹配结果 · 清除搜索' if j==2 else '贵州茅台                 82,640',12,BLUE if j==1 else TEXT)
            elif name=='ChartTooltip':
                b+=rect(xx,yy,264,64,SURF2,BLUE,6)+tx(xx+10,yy+22,'2026-10-15 · CNY',12)+tx(xx+10,yy+46,'该日缺行情 · 不插值' if j==2 else '净盈亏 +18,420 · 浮盈变动 +6,180',12,AMBER if j==2 else MUTED)
            elif name=='EmptyState':
                b+=tx(xx,yy+22,['当前范围没有持仓','无搜索结果','暂无可归因数据'][j],14)+tx(xx,yy+50,['导入交易 →','清除搜索 →','查看数据覆盖 →'][j],12,BLUE)
            else:
                b+=rect(xx,yy,130,32,SURF2,"#A9C8FF" if j==1 else LINE,6,'stroke-width="2"' if j==1 else '')+icon('refresh',xx+4,yy+6)+tx(xx+30,yy+22,'重试中…' if j==2 else '异步重试',12)
                if j==2:b+=tx(xx,yy+56,'禁止重复提交',12,MUTED)
    return svg(w,h,b,'11 类原子控件实际状态样例')

def tokens():
    w,h=1100,1130;b=tx(28,38,'Tokens · 同内容候选对比',24,TEXT,600)
    for i,(label,fam) in enumerate([('A 系统栈 · 选用',"-apple-system,BlinkMacSystemFont,sans-serif"),('B Web Sans · 无字体文件，仅回退示意',"Inter,sans-serif"),('C 整页等宽 · 不选',"monospace")]):
        y=92+i*76;b+=tx(28,y,label,12,MUTED)+tx(28,y+30,'贵州茅台 600519   0/O  1/I/l   −1,234,567.89 / +12.6%',14,TEXT,family=fam)
    b+=tx(28,330,'字号比较 · 同一行内容 / 同一 48px 行高',18,TEXT,600)
    for i,size in enumerate([12,14,16]):
        y=354+i*58;b+=rect(28,y,1044,48)+tx(44,y+29,'贵州茅台 600519      CNY 82,640.00      +6.18%',size)+tx(860,y+29,f'{size}px · '+('选用' if size==14 else '更密' if size==12 else '更宽'),12,BLUE if size==14 else MUTED)
    b+=tx(28,564,'色彩候选 · A 柔和语义色（选用） / B 高饱和（不选）',18,TEXT,600)
    for i,colors in enumerate([(GREEN,RED,BLUE),('#00FF66','#FF2233','#00CFFF')]):
        y=592+i*74;b+=rect(28,y,1044,62)+tx(44,y+38,'A' if i==0 else 'B',14)
        for j,(color,label) in enumerate(zip(colors,['+18,420 盈利','−3,240 亏损','查看详情 →'])):b+=tx(130+j*290,y+38,label,20,color,600)
    b+=tx(28,780,'A 降低暗底刺眼感；正负号补足色觉差异。14px 平衡扫描密度，12px 仅用于辅助信息。',14,MUTED)
    b+=tx(28,840,'行高 / 字重 · 相同 14px 字号',18,TEXT,600)
    for i,(height,weight,label) in enumerate([(40,400,'40px / 400 · 密集，不选'),(48,400,'48px / 400 · 正文选用'),(56,600,'56px / 600 · 过重，不选')]):
        y=866+i*76;b+=rect(28,y,1044,height)+tx(44,y+height/2+5,'贵州茅台 600519      CNY 82,640.00      +6.18%',14,TEXT,weight)+tx(740,y+height/2+5,label,14,BLUE if i==1 else MUTED)
    return svg(w,h,b,'字体字号行高字重与颜色候选同内容比较')

def motion():
    w,h=1180,1450;b=tx(28,38,'Motion · 真实状态分镜',24,TEXT,600)
    for i,(label,opacity,dy) in enumerate([('0ms',0,4),('80ms',.5,2),('160ms',1,0),('减少动态',1,0)]):
        x=28+i*286;b+=rect(x,70,266,170)+tx(x+16,98,label,14,BLUE)
        b+=f'<g opacity="{opacity}" transform="translate(0 {dy})">'+rect(x+16,122,234,86,SURF2,BLUE)+tx(x+28,150,'期间净盈亏 +18,420',14)+tx(x+28,178,'口径详情 · CNY',12,MUTED)+'</g>'
    b+=tx(28,280,'贡献：原 10 行始终可见，展开新增 10 行；旧列表顶端作为滚动锚点',16,TEXT,600)
    for i,(label,count,op) in enumerate([('0ms · 10 项',10,0),('100ms · 新行渐入',15,.5),('200ms · 20 项',20,1)]):
        x=28+i*380;b+=rect(x,310,350,712)+tx(x+16,342,label,14,BLUE)
        for j in range(count):
            yy=374+j*28;alpha=1 if j<10 else op
            b+=f'<g opacity="{alpha}">'+tx(x+16,yy,f'证券 {j+1:02d}',14)+rect(x+150,yy-12,80+(j%4)*18,10,GREEN if j%3 else RED,'none',3)+'</g>'
        b+=rect(x+16,390+count*28,318,36,SURF2,BLUE)+tx(x+175,414+count*28,'展开后按钮随列表底部向下' if i==1 else '收起 ↑' if i==2 else '再显示 10 项 ↓',12,TEXT,400,'middle')
    b+=tx(28,1060,'实现：高度 200ms ease-out，新增行 opacity 0→1；原行位置不变，不自动滚动到页底。',14,MUTED)
    b+=tx(28,1094,'prefers-reduced-motion：立即呈现右侧 20 项最终态；状态环改静态文字“更新中”。',14,MUTED)
    b+=tx(28,1164,'弹层动效候选 · 相同最终控件',18,TEXT,600)
    for i,(label,width,offset) in enumerate([('A 立即出现 · 减少动态选用',230,0),('B 160ms 淡入 · 默认选用',230,0),('C 300ms 弹性 · 不选',246,-8)]):
        x=28+i*380;b+=rect(x,1190,350,218)+tx(x+16,1220,label,14,BLUE if i<2 else MUTED)
        b+=rect(x+52+offset,1252,width,70,SURF2,BLUE)+tx(x+68,1280,'净盈亏 +18,420',14)+tx(x+68,1306,'C 图展示过冲，最终回到 230px' if i==2 else '最终宽度 230px，位置稳定',12,MUTED)
        b+=tx(x+16,1380,['立即可读，无过渡','淡入提供出现反馈，不吸走注意','过冲使文本短暂缩放，影响扫描'][i],12,MUTED)
    return svg(w,h,b,'弹层与贡献展开逐帧及候选比较')

def snapshot():
    w,h=1020,520;b=tx(28,42,'观察日期入口 · D01 两种待决方案',24,TEXT,700)+tx(28,68,'A 仅在曲线图点详情内查看当日敞口；B 图点不提供日期入口。',12,AMBER)
    for i,title in enumerate(['方案 A · 图点详情内查看','方案 B · 图点无日期入口']):
        x=28+i*490;b+=rect(x,100,460,360,SURF,LINE,8)+tx(x+20,132,title,15,TEXT,600)+rect(x+20,156,420,190,'#101B2B',LINE,7)+tx(x+38,184,'期间净盈亏曲线 · 今年至今',12,MUTED)
        pts=[(x+42,300),(x+120,268),(x+200,282),(x+286,232),(x+390,250)]; b+='<path d="M '+ ' L '.join(f'{a},{bb}' for a,bb in pts)+'" fill="none" stroke="#6CA8FF" stroke-width="2"/>'
        for px,py in pts:b+=f'<circle cx="{px}" cy="{py}" r="3" fill="#6CA8FF"/>'
        if i==0:
            b+=rect(x+220,202,208,94,'#1D3150',BLUE,6)+tx(x+236,226,'2026-08-14 · 图点详情',10,BLUE,600)+tx(x+236,248,'查看当日敞口 CNY 218,420',11,TEXT)+tx(x+236,270,'不是行情回放',10,MUTED)+tx(x+20,414,'仅从曲线图点进入二级查看。',10,MUTED)
        else:
            b+=tx(x+20,414,'图点无日期入口；不提供历史持仓查看。',10,MUTED)
    return svg(w,h,b,'观察日期方案对比')

def library_handoff():
    w,h=1180,600;b=tx(28,38,'交易库交接 · 日期检索与待复盘队列',24,TEXT,600)+tx(28,68,'独立场景：待复盘 3 条。D01 历史敞口不进入此路径。',14,MUTED)
    for i,title in enumerate(['1 首页导航','2 交易库日期检索','3 应用结果 / 返回']):
        x=28+i*380;b+=rect(x,100,350,438)+tx(x+16,134,title,18,TEXT,600)
        if i==0:
            b+=rect(x+16,160,318,48,SURF2,BLUE)+tx(x+32,190,'交易库                 待复盘 ③',14)+tx(x+16,242,'点击徽标：queue=pending-review',12,BLUE)+tx(x+16,274,'首页保留：美股 / 今年 / 实盘',12,MUTED)
        elif i==1:
            b+=tx(x+16,178,'待复盘 ×     美股 ×',14,BLUE)+rect(x+16,202,318,36)+tx(x+28,226,'日期检索：2026-08-14',14)+rect(x+16,256,104,36,SURF2,BLUE)+tx(x+42,280,'应用',14)+tx(x+16,330,'按平仓日筛选 · 业务时区',12,MUTED)
        else:
            b+=tx(x+16,178,'08-14 · 美股 · 待复盘（3）',14,BLUE)
            for j,(name,val) in enumerate([('CBRS','+120'),('TSLA','−85'),('MSFT','+260')]):
                yy=204+j*64;b+=rect(x+16,yy,318,48)+tx(x+28,yy+28,name,14)+tx(x+300,yy+28,val+' USD',14,GREEN if j!=1 else RED,400,'end')
            b+=tx(x+16,444,'← 返回首页',14,BLUE)+tx(x+16,478,'仍为美股 / 今年，不带回交易日期',12,MUTED)
    return svg(w,h,b,'日期与待复盘交易库交接')

def tooltip():
    w,h=920,360;b=tx(28,42,'持仓长名称 Tooltip',24,TEXT,700)+tx(28,68,'截断仅用于扫描；hover/focus 展示完整证券名称与代码。',12,MUTED)
    b+=rect(28,104,864,94,SURF,LINE,8)+tx(54,140,'Cerebras Systems Inc. - Class A Common Stock…',14,TEXT,600)+tx(54,166,'CBRS · NASDAQ',12,MUTED)+rect(406,76,430,102,'#1D3150',BLUE,7)+tx(424,102,'Cerebras Systems Inc. - Class A Common Stock',12,TEXT,600)+tx(424,126,'代码 CBRS · NASDAQ · 股票',11,MUTED)+tx(424,150,'全称不改变表格列宽；160ms 淡入',10,BLUE)
    b+=rect(28,232,864,70,'#101B2B',LINE,8)+icon('eye',54,254,BLUE)+tx(84,265,'查看入口保持统一图标语义，tooltip 仅承担低频全称查看。',11,TEXT)
    return svg(w,h,b,'持仓长名称完整 Tooltip')

def all_states():
    names=['IconButton','SegmentedTabs','Select','Popover','Token','Metric','StatusBadge','DataTable','ChartTooltip','EmptyState','RetryAction']; states=['默认','hover','focus','pressed','disabled','loading','empty','error']
    b=tx(24,36,'原子状态全集 · 与正文矩阵配套',24,TEXT,600)
    for j,st in enumerate(states): b+=tx(184+j*184,72,st,14,BLUE)
    for i,name in enumerate(names):
        y=92+i*124;b+=tx(20,y+26,name,14,TEXT,600)
        for j,st in enumerate(states):
            x=174+j*184;b+=rect(x,y,174,112)
            na=(j==6 and name in ['IconButton','SegmentedTabs','RetryAction']) or (j==4 and name in ['Token','Metric','StatusBadge','ChartTooltip','EmptyState']) or (j==3 and name=='Metric') or (j==5 and name=='EmptyState')
            if na:
                b+=tx(x+10,y+46,'N/A · 无此业务状态',12,MUTED);continue
            color='#53647B' if j==4 else AMBER if j==7 else TEXT
            fill='#1C2B42' if j==1 else '#243B5C' if j==3 else SURF2
            if j==5:
                if name=='ChartTooltip':b+=tx(x+10,y+50,'不显示过期 tooltip',12,MUTED)
                elif name in ['Metric','DataTable']:b+=rect(x+10,y+34,150,18,LINE,'none',4)+rect(x+10,y+60,120,18,LINE,'none',4)
                else:b+=icon('refresh',x+10,y+32,BLUE)+tx(x+36,y+48,'更新中 · 保留旧值',12)
            elif j==6 and name=='Token':b+=tx(x+10,y+76,'无 token · 不占位置',12,MUTED)
            elif j==5 and name=='ChartTooltip':b+=tx(x+10,y+50,'不显示过期 tooltip',12,MUTED)
            elif j==6:b+=tx(x+10,y+42,'— / 暂无可用数据',12,MUTED)+tx(x+10,y+70,'查看原因 →',12,BLUE)
            elif j==7:b+=tx(x+10,y+42,'! '+('恢复旧选中：全部' if name=='SegmentedTabs' else '保留旧数据 / 原因'),12,AMBER)+tx(x+10,y+70,'详情 / 异步重试',12,BLUE)
            else:
                ww=36 if name=='IconButton' else 150;hh=24 if name in ['Token','StatusBadge'] else 36
                b+=rect(x+10,y+30,ww,hh,fill,'#A9C8FF' if j==2 else LINE,6,'stroke-width="2"' if j==2 else '')
                if name=='Metric':b+=tx(x+18,y+57,'+18,420',28,GREEN,600)
                elif name=='IconButton':b+=icon('eye',x+18,y+38,color)
                else:b+=tx(x+18,y+53,{'SegmentedTabs':'全部 | A股 | 美股','Select':'全部账户 ⌄','Popover':'输入代码 / 名称','Token':'ETF ×','Metric':'+18,420 CNY','StatusBadge':'已更新 16:32','DataTable':'茅台   82,640','ChartTooltip':'10-15  +18,420','EmptyState':'无持仓 · 导入 →','RetryAction':'↻ 异步重试'}[name],12,color)
                if j==2:b+=tx(x+10,y+91,'焦点可见 · Esc 返回',12,BLUE)
    return svg(1660,1480,b,'11 组件八种状态适用全集')

def main():
    for name,fn in [('controls-states.svg',all_states),('controls.svg',controls),('tokens.svg',tokens),('motion.svg',motion),('snapshot-options.svg',snapshot),('library-handoff.svg',library_handoff),('holdings-name-tooltip.svg',tooltip)]: (OUT/name).write_text(fn(),encoding='utf-8')
if __name__=='__main__': main()
