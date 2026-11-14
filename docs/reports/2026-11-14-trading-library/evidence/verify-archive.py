#!/usr/bin/env python3
"""Check this documentation archive without running probes or opening a DB."""
import gzip
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote

evidence = Path(__file__).resolve().parent
report = evidence.parent
repo = report.parents[2]
failures = []
manifest = json.loads((evidence / 'ARCHIVE-MANIFEST.json').read_text())
expected = {item['path'] for item in manifest['files']}
actual = {str(p.relative_to(report)) for p in report.rglob('*') if p.is_file()
          and p.name not in ['ARCHIVE-MANIFEST.json', 'DOCUMENTATION-CHECK.md']}
if actual != expected:
    failures.append('archive inventory mismatch')
for item in manifest['files']:
    file = report / item['path']
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != item['sha256']:
        failures.append('archive checksum: ' + item['path'])
    elif item.get('compression') == 'gzip':
        raw = gzip.decompress(file.read_bytes())
        if hashlib.sha256(raw).hexdigest() != item['uncompressedSha256']:
            failures.append('decompressed checksum: ' + item['path'])

link_count = 0
for file in sorted(report.rglob('*.md')) + [repo / 'README.md']:
    for target in re.findall(r'\]\(([^)]+)\)', file.read_text()):
        if re.match(r'^(https?://|mailto:|#)', target):
            continue
        path, _, anchor = unquote(target).partition('#')
        if path.startswith('/'):
            failures.append(f'nonportable absolute link: {file.relative_to(repo)} -> {target}')
        linked = (file.parent / path).resolve()
        link_count += 1
        if not linked.exists():
            failures.append(f'broken link: {file.relative_to(repo)} -> {target}')
        elif anchor and linked.suffix == '.md':
            headings = re.findall(r'^#{1,6}\s+(.+)$', linked.read_text(), re.M)
            slugs = [re.sub(r'[^\w\- ]', '', h.lower()).replace(' ', '-') for h in headings]
            if anchor not in slugs:
                failures.append(f'unknown heading: {file.relative_to(repo)} -> {target}')

summary = json.loads((evidence / 'backend/source-summary.json').read_text())
frozen = gzip.decompress((evidence / 'backend/source-freeze.json.gz').read_bytes())
if hashlib.sha256(frozen).hexdigest() != summary['freezeFile']['uncompressedSha256']:
    failures.append('source-freeze decompression checksum')
freeze = json.loads(frozen)
for key in ['e0bb', '25db', '38a0', '0dc6']:
    if len(freeze[key]['files']) != summary[key]['fileCount']:
        failures.append('source-freeze file count: ' + key)

practice = json.loads((evidence / 'backend/practice-read-results-v2.json').read_text())
matrix = {r['count']: r for r in practice['results'] if r['groups'] == 50}
metrics = [s for s in matrix[50]['samples'] if s['operation'] == 'metricsList']
if len(metrics) != 3 or any(s['metric']['calls'] != 301 for s in metrics):
    failures.append('practice sample/SQL count')
readstore = json.loads((evidence / 'backend/readstore-results.json').read_text())
if len(readstore['samples']) != 3 or not all(s['totalMs'] > 1000 for s in readstore['samples']):
    failures.append('expected historical readstore performance FAIL')
stages = json.loads((evidence / 'backend/stages-results.json').read_text())
if len(stages['samples']) != 3 or any(s['stages']['nestedGroupCsvParser']['calls'] != 2500 for s in stages['samples']):
    failures.append('stage CSV parser call count')

result = {'scope': 'documentation links, archive SHA256, source-freeze integrity, historical sample consistency; no product tests or DB access',
          'filesHashed': len(manifest['files']), 'localLinksChecked': link_count,
          'frozenSourceFiles': sum(len(v['files']) for v in freeze.values()),
          'failures': failures}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(1 if failures else 0)
