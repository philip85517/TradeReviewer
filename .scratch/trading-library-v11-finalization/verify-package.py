from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from xml.etree import ElementTree
import json, hashlib
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/design-system/baselines/2026-10-24-trading-library-v1.1'
OLD=BASE.with_name('2026-10-22-trading-library-v1.0')
class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.refs=[]; self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        for k in ('href','src'):
            if a.get(k):self.refs.append(a[k])
p=Parser();p.feed((BASE/'visual-spec.html').read_text())
errors=[]
for ref in p.refs:
    u=urlsplit(ref)
    if u.scheme or u.netloc or ref.startswith('/') or ref.startswith('data:'):continue
    target=(BASE/unquote(u.path)).resolve() if u.path else BASE/'visual-spec.html'
    if not target.exists():errors.append('missing link: '+ref)
    elif u.fragment and target==BASE/'visual-spec.html' and unquote(u.fragment) not in p.ids:errors.append('missing anchor: '+ref)
manifest=json.loads((BASE/'document-manifest.json').read_text())
assert manifest['documentId']=='TRADING-LIBRARY-V11' and manifest['version']=='1.1'
assert len(p.ids)==len(set(p.ids)), 'duplicate HTML id'
for file in (BASE/'source/images').glob('*.svg'):ElementTree.parse(file)
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(BASE/'navigation-e-prototype.html')==sha(OLD/'navigation-e-prototype.html')=='3b1068e9d156aa27af5a00cbaf676451dc492c38c0f47426b57a6cd3037c6025'
before=json.loads((Path(__file__).parent/'v10-before.json').read_text())
changed=[path for path,h in before.items() if sha(ROOT/path)!=h]
if changed:errors+=['V1.0 changed: '+path for path in changed]
result={'documentId':manifest['documentId'],'version':manifest['version'],'fingerprint':manifest['fingerprint'],'blocks':len(manifest['blocks']),'images':len(manifest['images']),'checkedLocalReferences':len(p.refs),'v10PreservedFiles':len(before),'prototypeSha256':sha(BASE/'navigation-e-prototype.html'),'errors':errors}
(Path(__file__).parent/'package-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
if errors:raise SystemExit(1)
