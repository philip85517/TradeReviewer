from pathlib import Path
from html.parser import HTMLParser
import json,re,xml.etree.ElementTree as E,collections,csv
root=Path('docs/design-system/baselines/2026-10-19-homepage-v2.4');out=Path('.scratch/homepage-v24-ch12-diagnosis')
class Scan(HTMLParser):
 def __init__(self):super().__init__();self.ch='文档导言';self.heading=False;self.rows=[];self.buf=''
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='h2':self.heading=True;self.buf=''
  if t=='img' and d.get('src','').endswith('.svg'):self.rows.append({'chapter':self.ch,'src':d['src'],'occurrence':d.get('data-comment-occurrence',''),'alt':d.get('alt','')})
 def handle_data(self,s):
  if self.heading:self.buf+=s
 def handle_endtag(self,t):
  if t=='h2':self.ch=self.buf;self.heading=False
s=Scan();s.feed((root/'visual-spec.html').read_text());(out/'image-occurrences.json').write_text(json.dumps(s.rows,ensure_ascii=False,indent=2))
files={r['src'] for r in s.rows}; data=[]
for f in sorted(files):
 r=E.parse(root/f).getroot();texts=[(e.text or '')+''.join(c.tail or '' for c in e) for e in r.iter() if e.tag.endswith('text')];raw=(root/f).read_text();flags=[]
 if any('成本价' in t for t in texts) and any('持仓' in t for t in texts):flags.append('holding-table')
 if '当前表现' in texts and '历史已平仓' in texts:flags.append('whole-home')
 if any('净盈亏 · 分期' in t for t in texts):flags.append('period-name')
 if '01' in texts and '12' in texts:flags.append('bare-month')
 if any('无回合' in t or '未来未覆盖' in t for t in texts):flags.append('chart-status')
 if any('盈利回合' in t for t in texts):flags.append('win-card')
 if '分类' in texts and '排序' in texts:flags.append('contribution-control')
 hollow=[e.attrib for e in r.iter() if e.tag.endswith('rect') and e.get('fill')=='none' and e.get('stroke-width')=='3' and e.get('height')=='10']
 if hollow:flags.append('outline-height10')
 if 'visual-samples-board' in f:flags.append('samples-board')
 if f.endswith('/journeys-date.svg') or (any('成交价' in t for t in texts) and any('交易记录' in t or '待复盘' in t for t in texts)):flags.append('trade-table')
 if f.endswith('/chart-hover--keyboard.svg') or ('01-01' in texts and '10-15' in texts):flags.append('date-ticks')
 if f.split('/')[-1] in ['contribution-current-a-share.svg','contribution-extreme.svg','contribution-mixed-sign-demo.svg','contribution-states.svg']:flags.append('related-hollow')
 data.append({'src':f,'flags':flags,'chapters':sorted({x['chapter'] for x in s.rows if x['src']==f}),'occurrences':sum(x['src']==f for x in s.rows),'hollow':hollow})
(out/'scan-results.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
for flag in sorted({f for d in data for f in d['flags']}):
 ds=[d for d in data if flag in d['flags']];print(flag,len(ds),'assets',sum(d['occurrences'] for d in ds),'occurrences',sorted({c for d in ds for c in d['chapters']}));print('  '+', '.join(d['src'].split('/')[-1] for d in ds))
print('TOTAL',len(s.rows),'occurrences',len(files),'assets')
