from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from xml.etree import ElementTree
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
TASK = Path(__file__).resolve().parent
BASE = ROOT / 'docs/design-system/baselines/2026-10-26-trading-library-v2.0'
errors = []
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids = [], []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        for key in ('href', 'src'):
            if a.get(key):
                self.refs.append(a[key])

page = Document()
page.feed((BASE / 'visual-spec.html').read_text())
for ref in page.refs:
    u = urlsplit(ref)
    if u.scheme or u.netloc or ref.startswith('/'):
        continue
    target = (BASE / unquote(u.path)).resolve() if u.path else BASE / 'visual-spec.html'
    if not target.is_file():
        errors.append('Missing local target: ' + ref)
    elif u.fragment and target.suffix == '.html':
        linked = page
        if target != BASE / 'visual-spec.html':
            linked = Document()
            linked.feed(target.read_text())
        if unquote(u.fragment) not in linked.ids:
            errors.append('Missing HTML anchor: ' + ref)
if len(page.ids) != len(set(page.ids)):
    errors.append('Duplicate HTML IDs')

manifest = json.loads((BASE / 'document-manifest.json').read_text())
identity = json.loads((BASE / 'document-identity.json').read_text())
for artifact in (manifest, identity):
    if artifact['documentId'] != 'TRADING-LIBRARY-V20' or artifact['version'] != '2.0':
        errors.append('Incorrect version/identity')
source = BASE / 'source/visual-design.candidate.md'
if manifest['fingerprint'] != sha(source):
    errors.append('Source fingerprint mismatch')
for entry in manifest['images']:
    p = BASE / entry['src']
    if not p.is_file() or sha(p) != entry['fingerprint']:
        errors.append('Image fingerprint mismatch: ' + entry['src'])
for p in (BASE / 'source/images').glob('*.svg'):
    ElementTree.parse(p)

before = json.loads((TASK / 'baseline-hashes.json').read_text())
for name, digest in before.items():
    p = ROOT / name
    if not p.is_file() or sha(p) != digest:
        errors.append('Frozen V1.1 changed: ' + name)

comments = json.loads((TASK / 'comment-baseline.json').read_text())
for name, digest in comments.items():
    p = ROOT / name
    if not p.is_file() or sha(p) != digest:
        errors.append('Historical comments changed: ' + name)

spec = ROOT / 'docs/design-system/trading-library-design-spec.md'
if not spec.read_text().startswith('# 交易库设计规范\n'):
    errors.append('Canonical design spec title mismatch')
if not any('trading-library-design-spec' in ref for ref in page.refs):
    errors.append('Missing canonical design spec reference')
for text, path in [(spec.read_text(), spec),
                   ((ROOT / 'docs/design-system/domain-language.md').read_text(), ROOT / 'docs/design-system/domain-language.md')]:
    for ref in re.findall(r'\]\(([^)]+)\)', text):
        u = urlsplit(ref)
        if not u.scheme and not u.netloc and u.path and not (path.parent / unquote(u.path)).is_file():
            errors.append('Missing spec reference: ' + ref)

spec_page_path = spec.with_suffix('.html')
spec_page = Document()
spec_html = spec_page_path.read_text()
spec_page.feed(spec_html)
if f'data-source-sha256="{sha(spec)}"' not in spec_html:
    errors.append('Canonical reading page is stale')
for ref in spec_page.refs:
    u = urlsplit(ref)
    if u.scheme or u.netloc or ref.startswith('/'):
        continue
    target = (spec.parent / unquote(u.path)).resolve() if u.path else spec_page_path
    if not target.is_file():
        errors.append('Missing canonical reading link: ' + ref)
    elif not u.path and u.fragment and unquote(u.fragment) not in spec_page.ids:
        errors.append('Missing canonical reading anchor: ' + ref)

result = dict(documentId=manifest['documentId'], version=manifest['version'],
              fingerprint=manifest['fingerprint'], blocks=len(manifest['blocks']),
              imageOccurrences=len(manifest['images']), checkedReferences=len(page.refs),
              preservedV11Files=len(before), preservedCommentStores=len(comments), errors=errors)
(TASK / 'package-check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
