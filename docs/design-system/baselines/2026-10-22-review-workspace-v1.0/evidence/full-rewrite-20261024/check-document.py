from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re,hashlib,xml.etree.ElementTree as ET
b=Path('docs/design-system/baselines/2026-10-22-review-workspace-v1.0').resolve(); ev=b/'evidence/full-rewrite-20261024'
class Parser(HTMLParser):
 def __init__(self): super().__init__();self.ids=[];self.links=[];self.tags=[]
 def handle_starttag(self,t,a):
  d=dict(a); self.tags.append((t,d));
  if 'id' in d:self.ids.append(d['id'])
  for attr in ('href','src'):
   if d.get(attr):self.links.append(d[attr])
p=Parser();p.feed((b/'visual-spec.html').read_text())
errors=[];checked=0;external=0
for link in p.links:
 u=urlsplit(link)
 if u.scheme or u.netloc:external+=1;continue
 target=(b/unquote(u.path)).resolve() if u.path else b/'visual-spec.html'
 if not target.is_file():errors.append({'href':link,'error':'missing-file','target':str(target)});continue
 checked+=1
 if u.fragment and target.suffix=='.html':
  q=Parser();q.feed(target.read_text())
  if unquote(u.fragment) not in q.ids:errors.append({'href':link,'error':'missing-anchor'})
manifest=json.loads((b/'document-manifest.json').read_text())
comments_path=Path('docs/design-system/reviews/REVIEW-WORKSPACE-V10.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
comments=json.loads(comments_path.read_text())
source=(b/'source/visual-design.candidate.md').read_text()
chapter_ids=re.findall(r'^## .*\{#(chapter-RV\d+)\}',source,re.M)
assert len(chapter_ids)==10 and len(set(chapter_ids))==10
assert len(re.findall(r'^\|E\d{2} ',source,re.M))==22
assert len(re.findall(r'^\|N\d{2} ',source,re.M))==4
assert len(re.findall(r'^\|\d{2} ',source,re.M))==12
assert len(manifest['images'])==5
assert len(set(p.ids))==len(p.ids),'duplicate HTML ids'
for stem in ('rewrite-space-budget','rewrite-trade-pairing','rewrite-node-journey','rewrite-responsive-states','rewrite-rating-states'):ET.parse(b/'source/images'/f'{stem}.svg')
assert sha(comments_path)==sha(ev/'before/comments.json'),'comments changed'
for stable in ['HOME-DOC-B039','HOME-DOC-B383']:
 assert stable in [x['id'] for x in manifest['blocks']],stable
# Navigation mapping only, never modifies the comment store or resolves an issue.
target=next(x for x in manifest['images'] if x['src'].endswith('/rewrite-space-budget.svg'))
entries=[]
for c in comments['comments']:
 if c.get('image'):
  entries.append({'commentId':c['id'],'kind':'image','sourceOccurrenceId':c['image']['occurrenceId'],'sourceUrl':c['image'].get('src') or 'source/images/'+c['image']['id']+'.svg','target':{'occurrenceId':target['occurrenceId'],'chapter':'RV02'},'status':c.get('status'),'originalComment':'evidence/full-rewrite-20261024/before/comments.json','note':'仅关联新章节及解释图，原图与评论原文保留；不表示用户确认解决。'})
 else:
  ids={s['blockId']:s['blockId'] for s in c.get('segments',[])}
  entries.append({'commentId':c['id'],'kind':'text','target':{'blockIdBySource':ids},'status':c.get('status'),'originalComment':'evidence/full-rewrite-20261024/before/comments.json','note':'语义承接而非逐字引用；原评论状态不变，不表示用户确认解决。'})
(b/'comment-migration.json').write_text(json.dumps({'fromVersion':'1.0 before 2026-10-24 rewrite','toVersion':'1.0 candidate 2026-10-24','sourceFingerprint':json.loads((ev/'before/document-manifest.json').read_text())['fingerprint'],'targetFingerprint':manifest['fingerprint'],'entries':entries},ensure_ascii=False,indent=2)+'\n')
calculations={'1440_plot':1440-652,'1280_plot_left_collapsed':1280-468,'both_open_min':652+640,'left_collapsed_min':468+640,'right_collapsed_min':388+640,'both_collapsed_min':204+640,'remaining_qty':100+60-80,'exit_gross':60*(13-12)+20*(13-10),'combo_realized_R':120/160,'normal_net_R':298/100,'short_R':300/200,'peak_drawdown_R':-.5-2,'experience_candidate':((10-4)+8)/2}
result={'source_sha256':sha(b/'source/visual-design.candidate.md'),'html_sha256':sha(b/'visual-spec.html'),'manifest_fingerprint':manifest['fingerprint'],'chapters':chapter_ids,'element_rows':22,'new_element_rows':4,'task_rows':12,'svg_figures':len(manifest['images']),'local_link_occurrences_checked':checked,'external_link_occurrences_not_rechecked':external,'link_errors':errors,'comments_count':len(comments['comments']),'comments_sha256':sha(comments_path),'comment_statuses':[c.get('status') for c in comments['comments']],'comments_unchanged':True,'calculations':calculations}
(ev/'static-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
