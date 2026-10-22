from pathlib import Path
import xml.etree.ElementTree as ET
import sys
base=Path(__file__).resolve().parents[2]/'docs/design-system/baselines/2026-10-19-homepage-v2.4'
p=Path(sys.argv[1]) if len(sys.argv)>1 else base/'source/images/home-history-1440.svg'
rows=[]
def walk(e,ox=0,oy=0):
 if e.tag.endswith('svg'): ox+=float(e.get('x',0));oy+=float(e.get('y',0))
 if e.tag.endswith('text'):
  t=e.text or ''
  if t in ['当前表现','历史已平仓'] and e.get('text-anchor','start')=='start':rows.append((t,ox+float(e.get('x',0)),oy+float(e.get('y',0)),e.get('font-weight')))
 for child in e:walk(child,ox,oy)
walk(ET.parse(p).getroot())
print('Same-level heading anchors:',rows)
assert len(rows)==2, 'fixture must contain both same-level headings'
if rows[0][1]!=rows[1][1]:
 print(f'FAIL: same-level section headings differ by {abs(rows[0][1]-rows[1][1]):g}px');sys.exit(1)
print('PASS: same-level heading left anchors match')
