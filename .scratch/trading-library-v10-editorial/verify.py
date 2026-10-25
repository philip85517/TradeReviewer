"""Scope-bound document integrity checks; no product or database writes."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re

root = Path(__file__).resolve().parents[2]
task = Path(__file__).resolve().parent
base = root / 'docs/design-system/baselines/2026-10-22-trading-library-v1.0'
source = (base / 'source/visual-design.candidate.md').read_text()
before = (task / 'evidence/source-before.md').read_text()
manifest = json.loads((base / 'document-manifest.json').read_text())
old_manifest = json.loads((task / 'evidence/manifest-before.json').read_text())
comments_path = root / 'docs/design-system/reviews/TRADING-LIBRARY-V10.json'
comments = json.loads(comments_path.read_text())
mapping = json.loads((base / 'comment-migration.json').read_text())
checks = []

def check(name, condition, detail):
    checks.append({'check': name, 'result': 'PASS' if condition else 'FAIL', 'detail': detail})

check('source fingerprint', hashlib.sha256(source.encode()).hexdigest() == manifest['fingerprint'], manifest['fingerprint'])
check('chapter anchors', re.findall(r'\{#chapter-BT\d{2}\}', source) == re.findall(r'\{#chapter-BT\d{2}\}', before), 'BT01–BT10 retained in order')
check('storyboard blocks unchanged', re.findall(r':::state-demo.*?\n:::', source, re.S) == re.findall(r':::state-demo.*?\n:::', before, re.S), 'All frame paths, captions and order')
image_fields = ['id', 'occurrenceId', 'chapter', 'src', 'fingerprint', 'alt']
check('referenced image identities and bytes', [{k:i[k] for k in image_fields} for i in manifest['images']] == [{k:i[k] for k in image_fields} for i in old_manifest['images']], f"{len(manifest['images'])} referenced images")
check('live comments preserved', comments_path.read_bytes() == (task / 'evidence/comments-before.json').read_bytes(), 'Original opinions, quotes, status, history and operations byte-identical')
check('offline snapshot current', json.loads((base / 'comments-snapshot.json').read_text()) == comments, f"revision {comments['revision']}")
blocks = {b['id']:b for b in manifest['blocks']}
check('unique block identities', len(blocks) == len(manifest['blocks']), f'{len(blocks)} blocks')
check('mapping fingerprints', mapping['fingerprint'] == manifest['fingerprint'], mapping['fingerprint'])
entries = {entry['commentId']:entry for entry in mapping['entries']}
for c in comments['comments']:
    entry = entries.get(c['id'], {})
    by_source = entry.get('targetBlockIdBySource', {})
    targets = [by_source.get(s['blockId'], entry.get('targetBlockId', s['blockId'])) for s in c['segments']]
    check('comment mapping ' + c['id'], all(t in blocks for t in targets), targets)

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids, self.links = [], []
        self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for field in ('href', 'src'):
            if field in attrs:
                self.links.append(attrs[field])

page = Page(base / 'visual-spec.html')
check('unique HTML anchors', len(page.ids) == len(set(page.ids)), f'{len(page.ids)} ids')
broken, verified = [], 0
for link in page.links:
    url = urlsplit(link)
    if url.scheme or url.netloc:
        continue
    target = (base / unquote(url.path)).resolve() if url.path else base / 'visual-spec.html'
    if not target.is_file():
        broken.append({'url':link, 'reason':'file absent'})
    elif url.fragment and target.suffix == '.html' and unquote(url.fragment) not in Page(target).ids:
        broken.append({'url':link, 'reason':'anchor absent'})
    else:
        verified += 1
check('document links and assets', not broken, {'verified':verified, 'broken':broken})
components = ['IconButton', 'SegmentedTabs', 'Select', 'Popover', 'FilterPopover', 'Token', 'DataTable', 'Metric', 'StatusBadge', 'ChartTooltip', 'EmptyState', 'RetryAction']
check('public component names preserved', all(c in source for c in components), components)
output = {'fingerprint':manifest['fingerprint'], 'checks':checks}
(task / 'evidence/integrity.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(output, ensure_ascii=False, indent=2))
raise SystemExit(1 if any(c['result'] == 'FAIL' for c in checks) else 0)
