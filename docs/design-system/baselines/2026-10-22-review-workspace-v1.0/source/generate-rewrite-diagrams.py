"""Explanatory vectors for the 2026-10-24 candidate; not product screenshots."""
from pathlib import Path
from html import escape
OUT=Path(__file__).resolve().parent/'images'
BG='#0B1019'; PANEL='#111A26'; LINE='#283448'; TEXT='#E6EDF7'; MUTED='#A8B6CB'; BLUE='#6CA8FF'; GOLD='#FFC66D'
def rect(x,y,w,h,fill=PANEL,rx=8,stroke=LINE): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}"/>'
def text(x,y,s,size=16,fill=TEXT,weight=400,anchor='start'): return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}">{escape(str(s))}</text>'
def lines(x,y,items,size=15,fill=MUTED,gap=24): return ''.join(text(x,y+i*gap,t,size,fill) for i,t in enumerate(items))
def path(d,color=BLUE): return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2" marker-end="url(#arrow)"/>'
def save(name,title,subtitle,h,body):
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="952" height="{h}" viewBox="0 0 952 {h}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="{BLUE}"/></marker></defs><g font-family="system-ui, -apple-system, PingFang SC, Microsoft YaHei, sans-serif">'+rect(1,1,950,h-2,BG,12)+text(28,40,title,23,weight=600)+text(28,70,subtitle,14,MUTED)+body+'</g></svg>'
 (OUT/name).write_text(s)
# A: widths represented proportionally, CSS sizes remain explicit labels.
body=''
for y,W,parts,caption in [(124,1440,[224,14,788,96,14,304],'1440×900 · 双侧展开 · 主区高 756px'),(282,1280,[40,14,812,96,14,304],'1280×800 · 左侧收起 · 主区高 656px')]:
 body+=text(28,y-18,caption,18,weight=600)
 x=28; scale=896/W
 for v,label,c in zip(parts,['左列表','分隔','主绘图区','价格轴','分隔','右编辑栏'],['#23334A',LINE,'#162C45','#2B3450',LINE,'#243D3D']):
  width=v*scale; body+=rect(x,y,width,56,c,0)
  if width>55: body+=text(x+width/2,y+23,label,14,anchor='middle')+text(x+width/2,y+44,str(v),14,MUTED,anchor='middle')
  x+=width
 body+=text(28,y+82,' + '.join(map(str,parts))+f' = {W}px',15,MUTED)
body+=lines(28,410,['两栏并排下限 1292 = 224 + 14 + 640 + 96 + 14 + 304','1280 若强留双栏：绘图区 628；收左栏后：812。','高度 = H − 顶栏52 − 信息行32 − 回放60；信息换行后按实占高重算。'],16)
body+=text(28,505,'本轮候选尺寸 · 比例条只解释预算，不代表已实现的 UI',14,GOLD)
save('rewrite-space-budget.svg','图 A · 全幅工作区的空间预算','不扣应用导航与外边距；主绘图区不含价格轴、两侧分隔。',540,body)
# B: conservation of quantities.
body=rect(28,108,280,158)+text(48,140,'第一笔独立交易',19,weight=600)+lines(48,173,['先买 100 @10','被本次退出匹配 20','剩余 80'],18)
body+=rect(336,108,280,158)+text(356,140,'第二笔独立交易',19,weight=600)+lines(356,173,['后买 60 @12','优先匹配全部 60','剩余 0'],18)
body+=rect(644,108,280,158)+text(664,140,'同一次卖出决策',19,weight=600)+lines(664,173,['卖 80 @13','保留一个退出决策身份','匹配片段：60 + 20'],18)
body+=path('M 784 278 V 318 H 476 V 278')+text(590,307,'① 最近的 60',15,BLUE)
body+=path('M 784 330 V 376 H 168 V 278')+text(330,365,'② 再匹配前批 20',15,BLUE)
body+=rect(28,408,896,74)+text(48,438,'数量守恒：100 + 60 − 80 = 80；原始成交不改写。',18,weight=600)+text(48,464,'最近优先为用户方向；聚合、同秒排序、费用分摊和单笔完成仍待确认。',15,MUTED)
save('rewrite-trade-pairing.svg','图 B · 一次退出可以匹配多笔独立交易','回合包容多次决策；批次辅助数量匹配，不能代替原始成交身份。',510,body)
# C: timeline.
body=''; cards=[('入场前置暂停',['M：上一完成 K','X：成交之前','右栏：计划','不露实际成交']),('继续揭示成交',['M：可保持不变','X：到本次成交','D：当前节点记录','未收盘 K 仍隐藏']),('普通播放 / 标注',['未到节点不换 D','新 K 进入视野','Text 编辑即暂停','草稿与快照分开']),('退出后置暂停',['X：到退出成交','M：最后完成 K','右栏：事实与评价','部分退出不算回合结束'])]
for i,(title,ls) in enumerate(cards):
 x=28+i*228; body+=rect(x,116,212,210)+text(x+16,148,title,17,weight=600)+lines(x+16,184,ls,15,gap=30)
 if i<3: body+=path(f'M {x+213} 220 H {x+227}')
body+=rect(28,366,896,108)+lines(48,395,['节点切换：暂停 + 显示当前节点 + 选中其记录；不以阶段按钮推进。','同 K 多事件依稳定序号逐个处理；入场先停、退出后停。','恢复：还原 M/X/D、观察窗口和已看后续来源，不重新默认到起点。'],16,gap=29)
save('rewrite-node-journey.svg','图 C · 沿节点连续推进，计划与评价各有时机','动作迁移示意；真实图表可见变化与持久化仍须另行验收。',505,body)
# D: schematics at intentionally annotated sizes.
body=''
for i,(title,sub) in enumerate([('桌面节点输入','左右参与布局'),('390px 窄屏','趋势区 + 单一内容'),('软键盘打开','当前字段优先')]):
 x=28+i*306; body+=text(x,112,title,18,weight=600)+text(x,137,sub,14,MUTED)+rect(x,154,284,340)
 body+=rect(x+8,162,268,35,'#243247',4)+text(x+20,185,'身份 / 保存 / 工作区关闭',13)
 if i==0:
  body+=rect(x+8,206,46,226,'#23334A',4)+text(x+31,235,'列表',12,anchor='middle')
  body+=rect(x+60,206,130,226,'#162C45',4)+text(x+125,316,'主图 + 轴',14,anchor='middle')
  body+=rect(x+196,206,80,226,'#243D3D',4)+text(x+236,285,'当前节点',13,anchor='middle')+text(x+236,310,'记录',13,anchor='middle')
 elif i==1:
  body+=rect(x+8,206,268,114,'#162C45',4)+text(x+142,250,'趋势概览高 220px（候选）',13,anchor='middle')+text(x+142,276,'绘图区 306 + 轴 84',13,anchor='middle')
  body+=rect(x+8,328,268,104,'#243D3D',4)+text(x+142,365,'列表 / 记录互斥',15,anchor='middle')+text(x+142,392,'完整内容可滚动',14,anchor='middle')
 else:
  body+=rect(x+8,206,268,30,'#162C45',4)+text(x+142,227,'展开趋势概览',13,anchor='middle')
  body+=rect(x+8,244,268,120,'#243D3D',4)+lines(x+24,274,['当前字段与单位','就近校验 / 完成输入','不触发回放快捷键'],14)
  body+=rect(x+8,372,268,106,'#293144',4)+text(x+142,426,'软件键盘占用区域',15,anchor='middle')
 if i<2: body+=rect(x+8,442,268,36,'#243247',4)+text(x+142,466,'回放 / 工具：局部横向滚动',13,anchor='middle')
body+=lines(28,534,['示意图不按设备像素等比例缩放；准确预算见第二章与第八章。','输入时暂停并保留草稿，收起趋势后仍能恢复；物理触控尚未验证。'],15)
save('rewrite-responsive-states.svg','图 D · 适配通过改变区域组合完成','不缩字、不遮价格轴；桌面、窄屏与软键盘的不同职责。',595,body)
# E: state semantics, not psychology inference.
body=''; cards=[('未评分','—',['尚未进行评价','保留输入入口','不自动显示三星']),('资料不足','—',['缺少可核验计划','说明缺失字段','没有系统建议']),('系统建议','★★★★☆',['纪律 C=3/4=0.75','V0 候选规则：四星','可以查看四条依据']),('人工修改','★★★★★',['原建议：四星','修改后：五星','保留理由 / 人 / 时间'])]
for i,(title,stars,ls) in enumerate(cards):
 x=28+i*228; body+=rect(x,116,212,238)+text(x+16,151,title,19,weight=600)+text(x+16,199,stars,23,GOLD)+lines(x+16,242,ls,15,gap=30)
body+=rect(28,390,896,102)+lines(48,420,['纪律 / 机会 / 仓位 / 体验分别保存状态与依据，不默认合成总星级。','资料不足不等于中等表现；盈利不自动提升纪律星级。','图中四星和五星仅演示来源差别；规则阈值仍待用户审阅。'],16,gap=29)
save('rewrite-rating-states.svg','图 E · 星级之外必须显示评价状态','同一维度的四种状态；不由停顿、点击记录或盈亏推断心理体验。',520,body)
print('Generated 5 explanatory SVGs in',OUT)
