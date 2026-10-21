from pathlib import Path
import xml.etree.ElementTree as E
import copy,json,hashlib
OUT=Path(__file__).resolve().parent
BASE=OUT.parents[2]/'docs/design-system/baselines/2026-10-19-homepage-v2.4/source/images'
NS='http://www.w3.org/2000/svg'; E.register_namespace('',NS)
home=E.parse(BASE/'home-1440.svg').getroot()
hist=next(x for x in home.iter() if x.tag==f'{{{NS}}}svg' and x.get('y')=='1130')
con=next(x for x in home.iter() if x.tag==f'{{{NS}}}svg' and x.get('y')=='1712.0')
records=[]
def crop(tree,box,name,modify=None):
 r=copy.deepcopy(tree)
 if modify: modify(r)
 for a in ['x','y','aria-labelledby']: r.attrib.pop(a,None)
 x,y,w,h=box;r.set('viewBox',f'{x} {y} {w} {h}');r.set('width',str(w));r.set('height',str(h));r.set('font-family',"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif")
 p=OUT/(name+'.svg');E.ElementTree(r).write(p,encoding='unicode')
 records.append({'asset':p.name,'source':'home-1440.svg','nested':tree.get('y','root'),'crop':box,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 return f'<img src="{p.name}" width="{w}" height="{h}" alt="{name}">'
def texts(r):return [n for n in r.iter() if n.tag==f'{{{NS}}}text']
def ascii_headers(r):
 for n in texts(r):
  if n.get('y')=='660' and n.text:n.text=n.text.replace('（CNY）','(CNY)')
def typography(r,role):
 for n in texts(r):
  if role=='history-section' and n.get('x')=='24' and n.get('y')=='32' and n.text=='历史已平仓':
   n.set('font-weight','600')
  if role=='history-chart' and n.get('x')=='24' and n.get('y')=='246' and n.text=='净盈亏 · 分期':
   n.set('font-size','16');n.set('font-weight','600')
def naming(r):
 for n in texts(r):
  if n.text=='分期⌄': n.text='按月⌄'
  if n.text=='净盈亏 · 分期':n.text='每月净盈亏'
def denominator(r):
 for n in texts(r):
  if n.get('x')=='682' and n.get('y')=='161':
   n.set('x','790');n.set('y','145')
   for child in n:
    if child.tag.endswith('tspan'):
     if 'x' in child.attrib:child.set('x','790')
     if 'y' in child.attrib:child.set('y','145')
def labels(r):
 for n in texts(r):
  if n.get('y')=='124':n.set('font-size','14')
def pair(tree,box,name,mod):
 return '<div class="pair"><figure><figcaption>当前 · V2.4</figcaption><div class="canvas">'+crop(tree,box,name+'-current')+'</div></figure><figure><figcaption>候选 · 待确认</figcaption><div class="canvas">'+crop(tree,box,name+'-proposed',mod)+'</div></figure></div>'
sections=[]
def section(id,title,desc,body,trade):
 sections.append(f'<section id="{id}" hidden><h2>{title}</h2><p>{desc}</p>{body}<p class="trade">{trade}</p></section>')
section('d01','金额表头：括号与可见右边缘','提取首页持仓表的四个金额列；原始字号与列锚点保持不变，上下直接比较。',pair(home,(670,638,655,130),'headers',ascii_headers),'候选只把全角括号改为半角。它缩小末尾字形留白，不会改变列宽；若仍显得不齐，应继续校准可见边缘，不能用“坐标相同”判定通过。')
body='<div class="rolegrid">'
for name,tree,box,label in [('current-section',home,(90,80,140,36),'一级功能区：当前表现'),('current-chart',home,(106,230,240,36),'图表：期间净盈亏'),('history-section',hist,(18,8,240,34),'一级功能区：历史已平仓'),('history-chart',hist,(18,222,240,40),'图表：历史净盈亏')]:
 body+=f'<div><h3>{label}</h3>'+pair(tree,box,name,lambda r:typography(r,name))+'</div>'
body+='</div>'
section('d03','标题层级：同一角色使用同一规格','当前表现的标题作为参照。候选将历史功能区统一为18px／600，图表标题统一为16px／600。',body,'优点：标题层级稳定。代价：历史模块原有的加粗强调减弱。未移动标题位置，本轮不把对齐位置问题混入字号选择。')
body=pair(hist,(880,14,414,54),'period-selector',naming)+pair(hist,(18,222,300,40),'period-title',naming)+'<details><summary>展开完整图表对照（原始尺寸，可横向滚动）</summary>'+pair(hist,(0,214,1320,320),'period-chart',naming)+'</details>'
body+='<p>年度粒度使用同一命名规则：选择器「按年」，标题「每年净盈亏」。此处展示月度原图的完整坐标系；年度文案不表示新增布局或新增数据。</p>'
section('d07','期间命名：让标题直接说明统计内容','候选将「分期」选择器改为「按月」，图表标题改为「每月净盈亏」。图形、刻度与标题字号保持原样。',body,'优点：不需要先解释“分期”的含义。代价：标题更长。年度场景对应「按年／每年净盈亏」；标题字号取舍见上一项。')
body=pair(hist,(666,82,321,88),'winrate',denominator)
# Narrow stress fixture: same font sizes and card geometry except explicitly declared width.
narrow=copy.deepcopy(hist)
for n in narrow.iter():
 if n.tag.endswith('rect') and n.get('x')=='666' and n.get('y')=='82':n.set('width','278')
for n in texts(narrow):
 if n.get('x')=='682' and n.get('y') in ('145','161'):
  val='100.0%' if n.get('y')=='145' else '1,000 / 1,000 盈利回合'
  n.text=val
  for ch in list(n):n.remove(ch)
body+='<h3>窄宽压力样例 · 278px卡片，合成100%数据</h3><p>空间不足时，候选将整条分母说明放回下一行，不拆开分母、不缩小主值。</p>'+pair(narrow,(666,82,278,88),'winrate-narrow',lambda r:None)
section('d10','胜率说明：靠近主值，窄宽保持完整','常规样例直接取自首页321×88px卡片：主值28px，分母说明11px。候选仅调整说明位置。',body,'优点：主值与分母读作一组。代价：横向空间紧张时仍需下一行；窄宽两版相同是预期回退，不是遗漏。')
section('d11','贡献标签：12px → 14px','分类、排序、全局市场标签放大到14px。文字颜色、36px控件高度、选中状态和位置均不变。',pair(con,(16,110,830,72),'contribution-labels',labels),'优点：标签更容易辨认。代价：标签与控件文字同字号，层级更依赖颜色区分；此次保留原有标签颜色。')
nav=''.join(f'<button data-section="{id}">{name}</button>' for id,name in [('d01','1 表头对齐'),('d03','2 标题层级'),('d07','3 期间命名'),('d10','4 胜率说明'),('d11','5 贡献标签')])
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>V2.4.1 · 五项视觉取舍对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#e6edf7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:15px;line-height:1.5}header,main{max-width:1440px;margin:auto;padding:20px 32px}header{padding-bottom:10px}h1{font-size:24px;margin:0 0 6px}h2{font-size:21px;margin:0 0 8px}h3{font-size:14px;color:#a8b6cb;margin:12px 0 4px}p{margin:6px 0 14px;color:#a8b6cb}.tag{color:#d8bb77;font-size:13px}nav{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}button{background:#152236;border:1px solid #344763;color:#dce6f4;padding:8px 14px;border-radius:6px;font:inherit;cursor:pointer}button[aria-pressed=true]{background:#254267;border-color:#75adff}button:focus-visible{outline:2px solid white;outline-offset:3px}figure{margin:0 0 12px;background:#0b111a;border:1px solid #283448;border-radius:6px;overflow:hidden}figcaption{padding:5px 12px;color:#a8b6cb;background:#152030;font-size:13px}.canvas{overflow:auto;padding:12px}.canvas img{display:block;max-width:none}.pair{display:block}.rolegrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 24px}#d10 .pair,#d07>.pair{display:flex;gap:16px;flex-wrap:wrap}summary{cursor:pointer;color:#8ebaff;padding:10px 0}.rolegrid .pair{display:flex;flex-wrap:wrap;gap:8px}.trade{border-left:3px solid #607a9d;padding:8px 14px;background:#121e2e;margin-top:16px}footer{font-size:12px;color:#71829b;margin-top:20px}a{color:#8ebaff}section[hidden]{display:none}@media(max-width:800px){header,main{padding:16px}.rolegrid{grid-template-columns:1fr}}
</style><header><div class="tag">视觉讨论原型 · 五项均待确认</div><h1>V2.4.1 视觉取舍对照</h1><p>按原图1:1提取局部；宽图可横向滚动。页面标签和边框仅用于对照说明，不属于产品设计。</p><nav>'''+nav+'''</nav></header><main>'''+''.join(sections)+'''<footer>来源：冻结V2.4的source/images/home-1440.svg。常规样例直接复制SVG节点；仅修改各项明确列出的属性。<a href="DERIVATION.md">来源与变更记录</a> · <a href="manifest.json">图稿校验记录</a></footer></main><script>
const allowed=['d01','d03','d07','d10','d11'];function show(id){if(!allowed.includes(id))id='d01';document.querySelectorAll('section').forEach(s=>s.hidden=s.id!==id);document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===id)));const u=new URL(location);u.searchParams.set('section',id);history.replaceState(null,'',u);window.scrollTo(0,0)}document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.section)));show(new URL(location).searchParams.get('section')||'d01');</script></html>'''
(OUT/'index.html').write_text(html)
(OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
(OUT/'DERIVATION.md').write_text('''# 五项视觉取舍对照来源

本页为讨论原型，尚未获批，不属于V2.4.1正式规范。

所有常规样例来自冻结V2.4 source/images/home-1440.svg，SHA256 609c6e79（完整校验见冻结清单）。历史局部为嵌套svg y=1130；贡献局部y=1712.0。具体裁切坐标及产物SHA256在manifest.json。

- 表头：y=660；锚点791.52/933.2/1126.4/1306.72；表头12px、数值14px。实际数据636.85、688.67、12.53万、+9,431.24。候选仅替换全角括号。
- 标题：当前18/600与16/600保持；历史18/700改18/600，图表18/400改16/600。
- 期间：分期⌄改按月⌄，净盈亏 · 分期改每月净盈亏。轴、图形不变。年度命名只在正文说明，未伪造年度数据图。
- 胜率：321×88卡片、60.0%/6 / 10原数据。候选说明从682,161到790,145；字号不变。278px压力样例明确为合成100.0%/1,000 / 1,000，说明整行回退原位置。
- 贡献：y124三组标签12→14px，颜色#71829B、控件高度36和选中做多均保持。

此前手绘原型已被此直接裁切版本替换。旧的C方案坐标不可作为本页来源；本页使用真实首页图稿。
''')
print('Generated',len(records),'direct SVG crops')
