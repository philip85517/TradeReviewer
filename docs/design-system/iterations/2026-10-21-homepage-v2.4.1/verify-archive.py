#!/usr/bin/env python3
"""Verify immutable archive bytes, portable reading links and prototype dependencies."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,re,sys
base=Path(__file__).resolve().parent
errors=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks=json.loads((base/'SHA256SUMS.json').read_text())
for name,expected in checks.items():
 p=base/name
 if not p.is_file() or sha(p)!=expected:errors.append('hash: '+name)
manifest=json.loads((base/'manifest.json').read_text())
for row in manifest['files']:
 p=base/row['archive']
 if not p.is_file() or sha(p)!=row['sha256']:errors.append('snapshot: '+row['archive'])
count=0
def link(source,url):
 global count
 parts=urlsplit(url)
 if parts.scheme or parts.netloc or not parts.path:return
 if parts.path.startswith('/'):
  errors.append('nonportable: '+str(source.relative_to(base))+': '+url);return
 p=(source.parent/unquote(parts.path)).resolve()
 count+=1
 if not p.exists():errors.append('missing: '+str(source.relative_to(base))+': '+url)
for p in base.glob('*.md'):
 for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)',p.read_text()):link(p,match.group(1))
class Resources(HTMLParser):
 def __init__(self,p):super().__init__();self.p=p
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ('src','href','poster') and v:link(self.p,v)
htmls=list((base/'records/homepage-v241-repair/visual-options').rglob('*.html'))
for p in htmls:Resources(p).feed(p.read_text())
result={'scope':'archive integrity and portable links; no new UI acceptance or full V2.4.1 acceptance','hashedFiles':len(checks),'byteExactSnapshots':len(manifest['files']),'prototypeHtmlFiles':len(htmls),'localLinksChecked':count,'errors':errors,'result':'PASS' if not errors else 'FAIL'}
print(json.dumps(result,ensure_ascii=False,indent=2))
if '--write-report' in sys.argv:(base/'VERIFICATION.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
sys.exit(bool(errors))
