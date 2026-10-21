#!/usr/bin/env python3
"""Read-only checks of the published design package; no database writes."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,hashlib,sys
B=Path(__file__).resolve().parent
errors=[]
def check(ok,msg):
 if not ok: errors.append(msg)
m=json.loads((B/'document-manifest.json').read_text());original=json.loads((B/'review-records/comments-original.json').read_text());snapshot=json.loads((B/'comments-snapshot.json').read_text());migration=json.loads((B/'comment-migration.json').read_text())
check(m['version']=='2.4.1','manifest version')
check(hashlib.sha256((B/'source/visual-design.candidate.md').read_bytes()).hexdigest()==m['fingerprint'],'source fingerprint')
check(snapshot==original,'offline snapshot must preserve full original record at integration')
check(len(original['comments'])==32 and original['revision']==32,'original 32 comments/revision')
check({e['commentId'] for e in migration['entries']}=={c['id'] for c in original['comments']},'all comment mappings')
check(migration['fingerprint']==m['fingerprint'],'mapping fingerprint')
for i in m['images']:
 p=B/i['src'];check(p.is_file(),'image missing '+i['src'])
 if p.is_file():check(hashlib.sha256(p.read_bytes()).hexdigest()==i['fingerprint'],'image fingerprint '+i['src'])
for e in migration['entries']:
 if e.get('sourceUrl'):check((B/e['sourceUrl']).is_file(),'original image '+e['commentId'])
 if e['kind']=='image':check(e['targetOccurrenceId'] in {i['occurrenceId'] for i in m['images']},'image mapping '+e['commentId'])
 else:check(e['targetBlockId'] in {b['id'] for b in m['blocks']},'block mapping '+e['commentId'])
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ['src','href'] and v: self.links.append(v)
files=list(B.rglob('*.html'))
for f in files:
 if not f.exists():errors.append('page missing '+str(f));continue
 p=Links();p.links=[];p.feed(f.read_text())
 for link in p.links:
  u=urlsplit(link)
  if u.scheme or u.netloc or not u.path or u.path.startswith('/'):continue
  target=(f.parent/unquote(u.path)).resolve()
  check(target.exists(),str(f.relative_to(B))+' → missing '+link)
check(all(i['chapter']=='HP11' for i in m['images'] if i['id'] in ['home-history-1440','visual-samples-board']),'chapter 2 mapping')
print(json.dumps({'version':m['version'],'comments':len(original['comments']),'imageOccurrences':len(m['images']),'pagesChecked':len(files),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(bool(errors))
