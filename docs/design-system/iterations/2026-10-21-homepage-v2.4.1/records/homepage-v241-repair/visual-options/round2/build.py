# -*- coding: utf-8 -*-
from pathlib import Path
import xml.etree.ElementTree as E
import copy
O=Path(__file__).resolve().parent
B=O.parents[3]/'docs/design-system/baselines/2026-10-19-homepage-v2.4/source/images/home-1440.svg'
N='http://www.w3.org/2000/svg'; E.register_namespace('',N)
r=E.parse(B).getroot();h=next(x for x in r.iter() if x.tag.endswith('svg') and x.get('y')=='1130')
def tag(t):return '{'+N+'}'+t
def crop(tree,box):
 t=copy.deepcopy(tree)
 for a in ['x','y','aria-labelledby']:t.attrib.pop(a,None)
 t.set('viewBox',' '.join(map(str,box)));t.set('width',str(box[2]));t.set('height',str(box[3]));return t
def txt(t):return list(t.iter(tag('text')))
def raw(t):return E.tostring(t,encoding='unicode')
a=crop(r,(670,638,655,130));b=copy.deepcopy(a)
for n in txt(a):
 if n.get('y')=='660':
  n.text=(n.text or '').replace('（CNY）','(CNY)');n.set('class','ink-header');n.set('data-anchor',n.get('x'));n.set('data-value',{'791.52':'636.85','933.2':'688.67','1126.4':'12.53 万','1306.72':'+9,431.24'}.get(n.get('x'),'0'))
for n in txt(b):
 if n.get('y')=='660' and 'CNY' in (n.text or ''):
  title=n.text.split('（')[0].strip();n.text=title;n.set('y','651');n.set('class','ink-header');n.set('data-anchor',n.get('x'));n.set('data-value',{'791.52':'636.85','933.2':'688.67','1126.4':'12.53 万','1306.72':'+9,431.24'}[n.get('x')])
  u=E.SubElement(b,tag('text'),dict(n.attrib));u.set('y','670');u.set('font-size','11');u.text='CNY'
for t in [a,b]:
 t.set('role','img');t.set('aria-label','四列金额表头与原始数据的对齐候选')
 for x in [791.52,933.2,1126.4,1306.72]: E.SubElement(t,tag('line'),{'x1':str(x),'x2':str(x),'y1':'638','y2':'768','class':'guide','stroke':'#d9b75f','stroke-dasharray':'2 3','opacity':'.65'})
chart=crop(h,(0,214,1320,320));chart.set('class','chart-svg');chart.set('role','group');chart.set('aria-label','每月净盈亏状态区示例')
for n in txt(chart):
 if n.text=='净盈亏 · 分期':n.text='每月净盈亏';n.set('font-size','16');n.set('font-weight','600')
# Exclude off-crop content from the accessible chart rather than announcing invisible cards.
for node in list(chart):
 if node.tag not in [tag('style'),tag('defs'),tag('title'),tag('desc')] and 'y' in node.attrib and float(node.get('y','0')) < 214:
  chart.remove(node)
# Existing source uses continuous regions May–Oct, Nov–Dec; remove persistent annotations.
for p in chart.iter():
 for c in list(p):
  if c.tag==tag('text') and (c.text in ['无回合','未来未覆盖'] or any('未来未覆盖' in (z.text or '') for z in c)):
   p.remove(c)
# Put backgrounds after chart panel, before plotted grids, preserving original geometry.
insert=next(i for i,n in enumerate(chart) if n.tag==tag('rect') and n.get('y')=='214')+1
for x,w,fill in [(484.64,649.09,'#30291E'),(1133.73,162.27,'#1D2B40')]:
 chart.insert(insert,E.Element(tag('rect'),{'x':str(x),'y':'280','width':str(w),'height':'210','fill':fill}));insert+=1
for key,x,w,msg in [('empty',484.64,649.09,'05–10 月：当前范围没有已平仓回合，不绘制为零，也不连接缺口。'),('future',1133.73,162.27,'11–12 月：晚于示例截止日期 2026-10-15，未来期间尚未覆盖。')]:
 z=E.SubElement(chart,tag('rect'),{'x':str(x),'y':'280','width':str(w),'height':'210','fill':'transparent','class':'zone','tabindex':'0','role':'button','aria-label':msg,'data-reason':msg})
 E.SubElement(z,tag('title')).text=msg
accepted=crop(h,(0,214,1320,66))
for n in txt(accepted):
 if n.text=='净盈亏 · 分期':n.text='每月净盈亏';n.set('font-size','16');n.set('font-weight','600')
(O/'accepted-chart-title.svg').write_text(raw(accepted))
arrow='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>'
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第二轮视觉对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b1019;color:#e6edf7;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}header,main{max-width:1400px;margin:auto;padding:20px 28px}h1{font-size:24px;margin:0}h2{font-size:19px;margin:14px 0 6px}h3{font-size:14px;margin:6px 0;color:#a8b6cb}p{margin:8px 0 14px;color:#a8b6cb}a{color:#8bbaff}button,select{font-family:inherit;font-size:14px}button{cursor:pointer}nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}nav button{background:#162233;color:#e6edf7;border:1px solid #344763;border-radius:6px;padding:8px 12px}nav button[aria-pressed=true]{background:#254267;border-color:#6ca8ff}button:focus-visible,select:focus-visible{outline:2px solid #8bbaff;outline-offset:3px}.tag{color:#d8bb77;font-size:13px}.accepted{color:#53d7a0}.sample{padding:12px;border:1px solid #283448;background:#111a26;border-radius:8px;margin:10px 0;overflow:auto}.sample>svg,.sample>img{display:block;max-width:none}.guide{display:none}.with-guides .guide{display:block}.note{font-size:13px}section[hidden]{display:none}.toolrow{display:flex;gap:16px;flex-wrap:wrap;align-items:center;min-height:64px}.field{display:inline-flex;align-items:center;gap:8px;color:#a8b6cb}.selectbox{display:inline-flex;position:relative;color:#e6edf7}select{appearance:none;color:#e6edf7;background:#111a26;border:1px solid #344763;border-radius:6px;height:36px;padding:0 36px 0 12px;cursor:pointer}.selectbox svg{position:absolute;right:12px;top:10px;width:16px;height:16px;pointer-events:none;fill:none;stroke:currentColor;stroke-width:1.5}.chart-scroll{overflow:auto;border-radius:8px;position:relative}.chart-svg{display:block;max-width:none}.zone:focus{outline:none;stroke:#9ebcff;stroke-width:2;stroke-dasharray:4 3}.tip{position:fixed;max-width:min(340px,90vw);padding:10px 14px;background:#22334c;border:1px solid #6b8cb6;color:#edf3fa;border-radius:6px;box-shadow:0 4px 24px #0008;pointer-events:none;z-index:30;font-size:13px}.legend{display:flex;gap:20px;flex-wrap:wrap;margin:10px 0;color:#a8b6cb;font-size:13px}.swatch{display:inline-block;width:14px;height:14px;margin-right:6px;vertical-align:-2px}.legend .empty{background:#30291e;border:1px solid #8e7846}.legend .future{background:#1d2b40;border:1px solid #5d7b9f}.fixture{width:390px;max-width:100%;border:1px dashed #60738d;padding:12px}.confirmed{border-left:3px solid #53d7a0;padding:8px 14px;background:#112420}.frames{width:100%;border:0;height:1800px}details{margin:12px 0}summary{cursor:pointer;color:#8bbaff}footer{font-size:12px;color:#71829b;padding:24px 28px}#d01 .sample{max-width:100%}@media(max-width:600px){header,main{padding:16px}.toolrow{gap:12px}}
.custom-select{position:relative;display:inline-block;vertical-align:middle}.custom-select > select{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;padding:0}.custom-select-trigger{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;height:36px;padding:0 12px;color:#e6edf7;background:#162233;border:1px solid #344763;border-radius:6px;font-family:inherit;font-size:14px;line-height:20px;white-space:nowrap;cursor:pointer}.custom-select-trigger:focus-visible{outline:2px solid #6ca8ff;outline-offset:2px}.custom-select-trigger .custom-select-arrow{width:16px;height:16px;flex:0 0 16px}.custom-select-menu{position:absolute;z-index:5;top:calc(100% + 4px);left:0;display:none;min-width:100%;width:max-content;padding:4px;background:#162233;border:1px solid #344763;border-radius:6px;box-shadow:0 8px 22px #0008}.custom-select.is-open .custom-select-menu{display:grid}.custom-select-option{display:block;width:100%;padding:8px 10px;color:#e6edf7;background:transparent;border:0;border-radius:4px;font-family:inherit;font-size:14px;line-height:20px;text-align:left;white-space:nowrap;cursor:pointer}.custom-select-option:hover,.custom-select-option[aria-selected=true]{background:#243b5c}.selectbox>svg{display:none}.selectbox .custom-select-arrow{position:static;fill:none;stroke:currentColor}</style><header><div class="tag">视觉讨论 · 第二轮；未确认候选不写入正式默认</div><h1>继续校准对齐、空间与控件密度</h1><p class="accepted">已确认：标题层级统一，以及「每月净盈亏」命名。</p><nav><button data-id="d01">1 表头对齐</button><button data-id="d03">2 标题层级 · 已确认</button><button data-id="d07">3 下拉与状态区域</button><button data-id="cards">4 胜率 / 5 贡献筛选</button></nav></header><main>
<section id="d01"><h2>表头：比较文字可见边缘，不只比较定位坐标</h2><p>上一轮只换了括号，残余字形留白仍在。这轮 A 校准表头文字的可见右边缘；B 将单位独立成行，进一步减少长表头的拥挤。</p><label><input type="checkbox" id="guides"> 显示列定位参考线（只用于文档检查）</label><h3>上一轮候选 · 只改半角括号</h3><div class="sample"><img src="../headers-proposed.svg" width="655" height="130" alt="上一轮只修改括号的表头"></div><h3>候选 A · 单行表头 + 字形边缘校准</h3><div class="sample">'''+raw(a)+'''</div><p class="note">保留列宽与数据位置，依据实际字体校准表头末端留白。每种字体与缩放仍需检查，不能给所有标题硬加同一偏移。</p><h3>候选 B · 名称 / 单位分两行</h3><div class="sample">'''+raw(b)+'''</div><p class="note">名称 12px、单位 11px；表头高度使用现有空隙，数据不移动；更清楚地区分名称与单位，但信息由一行变为两行，仍需你选择。</p></section>
<section id="d03" hidden><h2>标题层级已确认</h2><div class="confirmed">一级功能区：18px / 600；图表标题：16px / 600。仅统一角色规格，不移动已有布局。</div><div class="sample"><img src="../history-section-proposed.svg" alt="已确认的历史功能区标题"><img src="accepted-chart-title.svg" alt="已确认的图表标题字号"></div><p>图表名称采用「每月净盈亏」，下方第 3 项展示已确认名称与新的控件候选。</p></section>
<section id="d07" hidden><h2>下拉：箭头独立定位，宽度由内容决定</h2><p>原稿把“⌄”当作文字，并给三种不同长度的内容统一分配 120px。本轮使用独立 16px 箭头、文字与箭头 8px 间距、左右 12px 内边距，命中高度仍为 36px。</p><h3>上一轮候选</h3><div class="sample"><img src="../period-selector-proposed.svg" alt="上一轮固定宽度下拉候选"></div><h3>候选 · 可展开选择的实际控件</h3><div class="toolrow"><label class="field"><span class="selectbox select-wrap"><select id="period" aria-label="历史期间"><option value="2026">2026 (按月)</option><option value="2025">2025 (按月)</option></select>'''+arrow+'''</span></label><label class="field"><span class="selectbox select-wrap"><select id="mode" aria-label="展示方式"><option value="monthly">按月</option><option value="cumulative">累计</option></select>'''+arrow+'''</span></label><label class="field"><span class="selectbox select-wrap"><select id="metric" aria-label="盈亏指标"><option>净盈亏</option></select>'''+arrow+'''</span></label></div><p id="selection" class="note" aria-live="polite">控件尺寸演示；图表保持 2026 按月的原始示例，不模拟其它期间的数据。</p><h2>状态区域：保留颜色，移除常驻文字</h2><p>沿用原图坐标和已有数据线。将鼠标移入有色区域，或按 Tab 聚焦区域，即可查看原因；切换控件不会把此示例冒充另一种真实统计结果。</p><div class="chart-scroll">'''+raw(chart)+'''</div><div class="legend"><span><i class="swatch empty"></i>没有已平仓回合</span><span><i class="swatch future"></i>未来期间</span></div><p class="note">颜色含义置于图外；图内仅显示状态背景。缺失数据与真实零值不等同于“无回合”，本图未把这些状态混用。</p></section>
<section id="cards" hidden><iframe class="frames" src="cards.html" title="胜率与贡献控件的第二轮视觉对照"></iframe></section>
</main><div class="tip" role="tooltip" hidden></div><footer>原稿保持冻结。此次仅讨论所列控件；不更改首页模块顺序、不操作业务数据。<a href="../index.html">查看第一轮</a> · <a href="NOTES.md">本轮变更与边界</a></footer><script>
const ids=['d01','d03','d07','cards'];function show(id){if(!ids.includes(id))id='d01';document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!==id);document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===id));const u=new URL(location);u.searchParams.set('section',id);history.replaceState(null,'',u);scrollTo(0,0)}document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.id));show(new URL(location).searchParams.get('section'));
document.querySelector('#guides').onchange=e=>document.querySelector('#d01').classList.toggle('with-guides',e.target.checked);
// Calibrate ink edge using real browser font metrics; do not equate advance width with visible edge.
document.fonts.ready.then(()=>{const ctx=document.createElement('canvas').getContext('2d');document.querySelectorAll('.ink-header').forEach(n=>{const s=getComputedStyle(n);ctx.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;ctx.textAlign='left';const m=ctx.measureText(n.textContent);const headerBlank=m.width-m.actualBoundingBoxRight;ctx.font=`400 14px ${s.fontFamily}`;const v=ctx.measureText(n.dataset.value);const valueBlank=v.width-v.actualBoundingBoxRight;n.setAttribute('x',Number(n.dataset.anchor)+headerBlank-valueBlank);n.dataset.adjust=(headerBlank-valueBlank).toFixed(3)})});
const tip=document.querySelector('.tip');function openTip(z){tip.textContent=z.dataset.reason;tip.hidden=false;const r=z.getBoundingClientRect();const w=tip.getBoundingClientRect().width;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+8))+'px';tip.style.top=Math.min(innerHeight-tip.offsetHeight-8,Math.max(8,r.top+12))+'px'}document.querySelectorAll('.zone').forEach(z=>{z.onpointerenter=()=>openTip(z);z.onpointerleave=()=>{if(document.activeElement!==z)tip.hidden=true};z.onfocus=()=>openTip(z);z.onblur=()=>tip.hidden=true;z.onkeydown=e=>{if(e.key==='Escape')tip.hidden=true;else if(e.key==='Enter'||e.key===' '){e.preventDefault();openTip(z)}};z.onclick=()=>openTip(z)});document.addEventListener('scroll',()=>{const z=document.activeElement;if(z&&z.classList.contains('zone'))openTip(z);else tip.hidden=true},true);
document.querySelectorAll('select').forEach(s=>s.onchange=()=>{document.querySelector('#selection').textContent=`控件已选择：${document.querySelector('#period').selectedOptions[0].text} / ${document.querySelector('#mode').selectedOptions[0].text}。下图仍为 2026 按月原始示例，仅演示状态区域。`});
const frame=document.querySelector('iframe');function fitFrame(){const doc=frame.contentDocument;if(doc)frame.style.height=doc.documentElement.scrollHeight+'px'}frame.addEventListener('load',()=>{fitFrame();new ResizeObserver(fitFrame).observe(frame.contentDocument.body)});window.addEventListener('resize',fitFrame);
</script><script src="ui-select.js"></script></html>'''
(O/'index.html').write_text(html)
(O/'NOTES.md').write_text('''# 第二轮视觉讨论

已确认 D03 角色字号，以及 D07 每月净盈亏。其它候选未获批。

D01: 原 home-1440.svg root viewBox 670 638 655 130。A 仅替换半角并按当前实际字体 ink metrics 校准 header x；B 名称y651，单位y670/11px，数值位置不改。辅助线仅为文档层。
D07: source nested history y1130 原控件均120×36，箭头为文字⌄；候选自定义下拉（保留原select数据）、独立SVG，36高、padding12、箭头16、gap8。菜单2025/累计仅用于控件交互，不生成或声称对应业务图表。
D09: 原图月轴、线、坐标保留。05–10无回合区域#30291E，11–12未来区域#1D2B40；移除图内文字，pointer/focus显示原因，Esc关闭。不是数据缺失或真实零值。背景色是候选。
D10/D11: 见 cards-notes.md。保留第一轮所有文件及证据。

本次为桌面视觉候选，不是正式V2.4.1全部缺陷验收；不涉及业务数据库及持久化。\n''')
print(O/'index.html')
