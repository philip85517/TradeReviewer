"""Verify packaged design references; does not accept visual or product behavior."""
import hashlib
import json
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class Reader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.images = [], [], []
        self.summaries = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        if tag in ('img', 'script') and a.get('src'):
            self.images.append(a['src'])
        if tag == 'link' and a.get('href'):
            self.images.append(a['href'])
        if tag == 'summary':
            self.summaries += 1


reader = Reader()
reader.feed((ROOT / 'visual-spec.html').read_text())
errors = []
if len(set(reader.ids)) != len(reader.ids):
    errors.append('duplicate HTML IDs')
for ref in reader.links + reader.images:
    u = urlsplit(ref)
    if u.scheme or u.netloc:
        continue
    if not u.path and u.fragment and unquote(u.fragment) not in reader.ids:
        errors.append('missing anchor: ' + ref)
    if u.path and not (ROOT / unquote(u.path)).exists():
        errors.append('missing local file: ' + ref)
for f in (ROOT / 'source/images').glob('*.svg'):
    ET.parse(f)
manifest = json.loads((ROOT / 'document-manifest.json').read_text())
chapters = sorted({b['chapter'] for b in manifest['blocks'] if b['chapter'].startswith('ST')})
if chapters != [f'ST{i:02}' for i in range(1, 17)]:
    errors.append('chapter set differs from ST01–ST16 (15 chapters and reference appendix)')
if manifest['documentId'] != 'STRATEGY-DESK-V10':
    errors.append('incorrect document identity')
hashes = {}
for f in sorted(ROOT.rglob('*')):
    rel = f.relative_to(ROOT)
    if f.is_file() and rel.parts[0] != 'evidence' and '__pycache__' not in rel.parts:
        hashes[str(rel)] = hashlib.sha256(f.read_bytes()).hexdigest()
report = {
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'scope': 'Local references, SVG XML, document identity and content fingerprints only; not visual/product acceptance',
    'status': 'FAIL' if errors else 'PASS',
    'errors': errors,
    'documentFingerprint': manifest['fingerprint'],
    'chapters': chapters,
    'summaryCount': reader.summaries,
    'imageOccurrences': len(manifest.get('images', [])),
    'svgCount': len(list((ROOT / 'source/images').glob('*.svg'))),
    'sha256': hashes,
}
(ROOT / 'evidence').mkdir(exist_ok=True)
(ROOT / 'evidence/validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'sha256'}, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
